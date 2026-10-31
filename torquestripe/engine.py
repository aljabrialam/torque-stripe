"""Deterministic answer engine. Decides status, selects evidence, builds structured, cited output.

The LLM is NOT called here. Everything this module returns can be reproduced byte-for-byte
from the same corpus + query + config.
"""
from __future__ import annotations

import re
import time
from dataclasses import asdict, dataclass, field
from enum import Enum

from .applicability import MODEL_TOKEN, Verdict, evaluate, extract_rule, norm_model
from .index import Index, terms
from .parse import AD, AD_NUM, latest

SERIAL_IN_Q = re.compile(r"\b(MSN|S/N|SN|ESN|serial(?:\s+number)?|line(?:\s+number)?|LN)\s*[:#]?\s*(\d{2,})", re.I)
SENT = re.compile(r"(?<=[.;])\s+(?=[A-Z(])")

INTENTS: list[tuple[str, re.Pattern, tuple[str, ...]]] = [
    ("corrective", re.compile(r"\b(part number|p/n|replace\w*|corrective|if .*(crack|found|damage))\b", re.I),
     ("corrective",)),
    ("interval", re.compile(r"\b(how often|interval|repeat\w*|recurring|repetitive)\b", re.I),
     ("repetitive",)),
    ("compliance_time", re.compile(r"\b(when|within|how soon|deadline|due|compliance time|how long|by when)\b", re.I),
     ("inspection", "ultrasonic", "modification", "repetitive")),
    ("reason", re.compile(r"\b(why|reason|unsafe|prompted|cause|risk)\b", re.I), ("unsafe condition",)),
    ("procedure", re.compile(r"\b(service bulletin|sb|procedure|how (do|to)|in accordance|steps?)\b", re.I),
     ("inspection", "ultrasonic", "modification")),
    ("requirements", re.compile(r"\b(require\w*|what (must|do) i do|actions?|tasks?)\b", re.I), ()),
    ("applicability", re.compile(r"\b(appl(y|ies|icable|icability)|affect\w*|covered|does .* need)\b", re.I),
     ("applicability",)),
]
ACTION_INTENTS = {"corrective", "interval", "compliance_time", "procedure", "applicability", "requirements"}
BOILERPLATE = ("effective date", "compliance", "subject", "affected ads")


class Status(str, Enum):
    ANSWERED = "ANSWERED"                    # evidence found AND applicability confirmed
    ANSWERED_GENERAL = "ANSWERED_GENERAL"    # informational question, no aircraft-specific claim
    NEEDS_INPUT = "NEEDS_INPUT"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    REFUSED = "REFUSED"


@dataclass
class Citation:
    ad: str
    amendment: str | None
    effective: str | None
    paragraph: str
    source: str
    synthetic: bool

    @property
    def label(self) -> str:
        return f"AD {self.ad} {self.paragraph}"


@dataclass
class Claim:
    id: str
    text: str            # verbatim sentence from the source
    cite: Citation


@dataclass
class Result:
    status: Status
    query: str
    config: dict
    ad: str | None = None
    revision: dict = field(default_factory=dict)
    applicability: dict = field(default_factory=dict)
    fields: dict = field(default_factory=dict)      # structured, each with a claim id
    claims: list[Claim] = field(default_factory=list)
    refusal: dict | None = None
    needs: list[str] = field(default_factory=list)
    candidates: list[dict] = field(default_factory=list)
    trace: list[str] = field(default_factory=list)  # every deterministic decision, in order
    latency_ms: float = 0.0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = self.status.value
        return d


class Engine:
    def __init__(self, ads: list[AD], min_coverage: float = 0.5):
        self.ads = ads
        self.by_num = {a.number: a for a in ads}
        for a in ads:
            p = a.para("applicability")
            a.applicability = extract_rule(p.text) if p else None
        self.models = {m for a in ads if a.applicability for m in a.applicability.models}
        self.index = Index(ads)
        self.min_coverage = min_coverage

    # ---------- query understanding (deterministic) ----------
    def _intent(self, q: str) -> str | None:
        for name, rx, _ in INTENTS:
            if rx.search(q):
                return name
        return None

    def _config_from_query(self, q: str, cfg: dict) -> dict:
        cfg = {k: v for k, v in (cfg or {}).items() if v not in (None, "")}
        if "model" not in cfg:
            hits = [norm_model(t) for t in MODEL_TOKEN.findall(q.upper())]
            known = [h for h in hits if h in self.models]
            if known:
                cfg["model"] = known[0]
            elif hits and not AD_NUM.search(q):
                cfg["_unknown_model"] = hits[0]
        if "serial" not in cfg:
            m = SERIAL_IN_Q.search(q)
            if m:
                cfg["serial"] = m.group(2)
                cfg.setdefault("serial_kind", "line" if m.group(1).lower().startswith(("line", "ln")) else "serial")
        return cfg

    # ---------- main ----------
    def ask(self, query: str, config: dict | None = None) -> Result:
        t0 = time.perf_counter()
        cfg = self._config_from_query(query, config or {})
        r = Result(Status.REFUSED, query, {k: v for k, v in cfg.items() if not k.startswith("_")})
        try:
            self._run(query, cfg, r)
        finally:
            r.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return r

    def _refuse(self, r: Result, code: str, msg: str):
        r.status = Status.REFUSED
        r.refusal = {"code": code, "message": msg}
        r.trace.append(f"REFUSE {code}: {msg}")

    def _run(self, q: str, cfg: dict, r: Result):
        intent = self._intent(q)
        r.trace.append(f"intent={intent}")

        if cfg.get("_unknown_model"):
            return self._refuse(r, "UNKNOWN_MODEL",
                                f"Model {cfg['_unknown_model']} does not appear in any AD in this corpus. "
                                f"I can't confirm whether any AD applies to it.")

        # 1. Which AD?
        asked = AD_NUM.findall(q)
        if asked:
            missing = [n for n in asked if n not in self.by_num]
            if missing:
                return self._refuse(r, "UNKNOWN_AD", f"AD {', '.join(missing)} is not in the indexed corpus.")
            target = asked[0]
            r.trace.append(f"AD named in query: {target}")
        else:
            cov = self.index.coverage(q)
            r.trace.append(f"corpus term coverage={cov:.2f}")
            if cov < self.min_coverage:
                return self._refuse(r, "OUT_OF_SCOPE",
                                    "The question uses terms that don't appear in the indexed ADs.")
            hits = self.index.search(q, k=20)
            pool = hits
            if cfg.get("model"):
                pool = [h for h in hits if self._model_ok(h[0], cfg["model"])]
                r.trace.append(f"filtered by model {cfg['model']}: {len(hits)} -> {len(pool)} paragraphs")
            if not pool:
                return self._refuse(r, "NO_MATCH", "No AD paragraph matches this question for the given aircraft.")
            best: dict[str, float] = {}
            for ad, _, s in pool:
                head = latest(ad, self.by_num)[0]
                best[head] = max(best.get(head, 0), s)
            ranked = sorted(best.items(), key=lambda x: -x[1])
            top = ranked[0][1]
            close = [a for a, s in ranked if s >= 0.8 * top]
            r.trace.append("candidates " + ", ".join(f"{a}:{s:.2f}" for a, s in ranked[:5]))
            if len(close) > 1:
                r.status = Status.NEEDS_INPUT
                r.needs = ["ad"]
                r.candidates = [{"ad": a, "subject": self.by_num[a].subject} for a in close]
                r.trace.append("AMBIGUOUS: several ADs match equally; asking user to choose")
                return
            target = ranked[0][0]

        # 2. Revision logic
        head, chain = latest(target, self.by_num)
        r.revision = {"requested": target, "latest": head, "chain": chain,
                      "superseded": head != target}
        if head != target:
            r.trace.append(f"{target} superseded -> using latest {head} (chain {' -> '.join(chain)})")
        ad = self.by_num[head]
        r.ad = head

        # 3. Applicability (rules only)
        rule = ad.applicability
        app_para = ad.para("applicability")
        if rule is None:
            return self._refuse(r, "NO_APPLICABILITY", f"AD {head} has no parsable applicability paragraph.")
        ev = evaluate(rule, cfg.get("model"), cfg.get("serial"), cfg.get("serial_kind"))
        r.applicability = {"verdict": ev.verdict.value, "reasons": ev.reasons,
                           "rule": {"models": rule.models, "serial_kind": rule.serial_kind,
                                    "range": [rule.serial_lo, rule.serial_hi], "all_serials": rule.all_serials,
                                    "parsed": rule.parsed}}
        r.trace.append(f"applicability={ev.verdict.value}: " + " | ".join(ev.reasons))
        app_claim = self._claim(ad, app_para, app_para.text, "app")

        if ev.verdict == Verdict.UNDETERMINED:
            r.claims = [app_claim]
            return self._refuse(r, "RULE_NOT_MODELLED",
                                "The applicability wording can't be evaluated by fixed rules. "
                                "Check paragraph (c) manually: " + " ".join(ev.reasons))
        if ev.verdict == Verdict.NOT_APPLICABLE:
            r.status = Status.NOT_APPLICABLE
            r.claims = [app_claim]
            return

        informational = intent not in ACTION_INTENTS and intent is not None
        if ev.verdict == Verdict.NEEDS_INPUT and not informational:
            r.status = Status.NEEDS_INPUT
            r.needs = ev.missing
            r.claims = [app_claim]
            return

        # 4. Evidence selection
        paras = self._select_paragraphs(ad, q, intent)
        if intent == "applicability":
            paras = [app_para]
        if not paras:
            return self._refuse(r, "NO_SUPPORTING_TEXT", f"AD {head} has no paragraph that answers this question.")
        claims: list[Claim] = []
        for p in paras:
            for i, s in enumerate(self._sentences(p.text)):
                claims.append(self._claim(ad, p, s, f"{p.pid}{i}"))
        if intent == "applicability":
            claims = [app_claim]
        r.claims = claims
        r.fields = self._fields(claims)
        r.status = Status.ANSWERED if ev.verdict == Verdict.APPLIES else Status.ANSWERED_GENERAL
        r.trace.append(f"evidence paragraphs: {[p.ref for p in paras]}")

    # ---------- helpers ----------
    def _model_ok(self, ad_num: str, model: str) -> bool:
        a = self.by_num[ad_num]
        rule = a.applicability
        return rule is None or not rule.parsed or norm_model(model) in rule.models

    def _select_paragraphs(self, ad: AD, q: str, intent: str | None):
        if intent == "requirements" or (intent is None and AD_NUM.search(q)):
            skip = BOILERPLATE + ("applicability", "unsafe condition")
            return [p for p in ad.paragraphs if not p.heading.lower().startswith(skip)]
        if intent:
            heads = next(h for n, _, h in INTENTS if n == intent)
            found = [p for p in ad.paragraphs if any(p.heading.lower().startswith(h) for h in heads)]
            if intent == "compliance_time":
                found = [p for p in found if re.search(r"\b(within|interval|not to exceed)\b", p.text, re.I)]
            if found:
                return found
        hits = self.index.search(q, ad=ad.number, k=6)
        out = []
        for _, pid, _ in hits:
            p = next((x for x in ad.paragraphs if x.pid == pid), None)
            if p and not p.heading.lower().startswith(BOILERPLATE) and p not in out:
                out.append(p)
        return out[:2]

    @staticmethod
    def _sentences(text: str) -> list[str]:
        return [s.strip() for s in SENT.split(text) if s.strip()]

    @staticmethod
    def _claim(ad: AD, p, text: str, cid: str) -> Claim:
        return Claim(f"{ad.number}:{cid}", text,
                     Citation(ad.number, ad.amendment, ad.effective, p.ref, ad.source, ad.synthetic))

    @staticmethod
    def _fields(claims: list[Claim]) -> dict:
        """Regex-extracted structured fields. Each value carries the claim id it came from."""
        out: dict[str, list[dict]] = {}
        pats = {
            "compliance_time": r"\b(Within [\d,]+ [a-z ]+?(?:after|since) [A-Za-z ]+?)(?=,| do | perform| inspect)",
            "repeat_interval": r"\b(intervals? not to exceed [\d,]+ [a-z ]+?)(?=\.|,)",
            "part_number": r"\bpart number ([A-Z0-9\-]+)",
            "service_document": r"\b((?:Alert )?Service Bulletin [A-Z0-9][\w\-/ ]*?\d(?: Revision \d+)?)(?=\.|,|$)",
        }
        for c in claims:
            for k, rx in pats.items():
                for m in re.finditer(rx, c.text):
                    out.setdefault(k, []).append({"value": m.group(1).strip(), "claim": c.id})
        return out
