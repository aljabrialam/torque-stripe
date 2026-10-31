"""Deterministic question answering over the FAA AD NPRM dataset.

All decisions (which docket, which version is current, whether the proposal was withdrawn,
whether the user's model is covered, answer status, refusal) are rules in this file.
"""
from __future__ import annotations

import re
import sqlite3
import time
from dataclasses import dataclass
from datetime import date

from .engine import Claim, Result, Status
from .index import STOP, terms
from .nprm import AD_NUM, DOCKET, Docket, Version, load_xlsx, norm_model

MODEL_IN_Q = re.compile(r"\b(?:[A-Z]{1,5}[-]?\d[\w]*(?:[-/][\w]+)*|\d{3}-\d{1,3}\w*|[A-Z]+-[IVX]+)\b")
SERIAL_IN_Q = re.compile(r"\b(MSN|S/N|SN|ESN|serial(?:\s+number)?|line(?:\s+number)?|LN)\s*[:#]?\s*(\d{2,})", re.I)

INTENTS = [
    ("status", re.compile(r"\b(withdraw\w*|status|still (open|active|proposed)|latest|current|revis\w*|final(ised|ized)?|in (force|effect))\b", re.I)),
    ("supersede", re.compile(r"\b(supersed\w*|replac\w*|which ad|existing ad)\b", re.I)),
    ("comments", re.compile(r"\b(comment\w*)\b", re.I)),
    ("compliance_time", re.compile(r"\b(when|how (long|soon)|by when|deadline|due)\b.*\b(inspect\w*|finish\w*|complet\w*|comply|compliance|do (it|this|the)|replace\w*|modif\w*)\b|\bcompliance time\b", re.I)),
    ("reason", re.compile(r"\b(why|reason|prompted|unsafe|cause|what happened)\b", re.I)),
    ("requirements", re.compile(r"\b(requir\w*|propos\w* to|what does .* propose|what (does|would) .* (do|require)|actions?|inspect\w*|replace\w*|must)\b", re.I)),
    ("list", re.compile(r"\b(any|which|list|all|show)\b.*\b(nprms?|ads?|proposals?|proposed)\b", re.I)),
]
INTENT_SENT = {
    "requirements": re.compile(r"\bwould (also )?(require|prohibit|continue|mandate|revise)|\bproposes? to require\b|\bwould require\b|\brequires\b", re.I),
    "reason": re.compile(r"\bprompted by\b|\bsince the faa issued\b|\bwas notified\b|\bif not addressed\b|\bcould result\b|\bto address\b", re.I),
    "supersede": re.compile(r"\bsupersed|\brequires\b", re.I),
    "status": re.compile(r"\bwithdraw|\brevis|\bcorrect|\breopen", re.I),
}
INTENT_WORDS = set("""withdraw withdrawn withdrawal status still open active proposed latest current revised revision
final finalised finalized force effect supersede supersedes superseded replace replaces replaced existing comment comments
due date deadline why reason prompted unsafe cause happened require requires required requirement requirements propose
proposes proposal proposals action actions must any which list all show nprm nprms ads model models aircraft airplane
airplanes engine engines helicopter helicopters msn serial number line faa""".split())


@dataclass
class NCite:
    docket: str
    version_date: str | None
    action: str
    fr_citation: str
    pages: str
    link: str | None
    sheet_row: int
    sentence: int

    @property
    def label(self) -> str:
        return f"{self.docket} ({self.version_date}) {self.pages} S{self.sentence + 1}"


class NprmEngine:
    def __init__(self, xlsx_path: str, today: date | None = None, min_coverage: float = 0.75):
        self.versions, self.dockets = load_xlsx(xlsx_path)
        self.today = today or date.today()
        self.min_coverage = min_coverage
        self.by_docket = {}
        for g, d in self.dockets.items():
            for v in d.versions:
                self.by_docket[v.docket.upper()] = d
            self.by_docket[g.upper()] = d
        self.all_models = {m for d in self.dockets.values() for m in d.models}
        self.ads_mentioned: dict[str, list[str]] = {}
        for g, d in self.dockets.items():
            for v in d.versions:
                for a in v.mentioned_ads + ([v.ad_number] if v.ad_number else []):
                    self.ads_mentioned.setdefault(a, [])
                    if g not in self.ads_mentioned[a]:
                        self.ads_mentioned[a].append(g)
        self._build_index()
        self.total_pages = sum(v.page_count for v in self.versions)

    # ---------------- index ----------------
    def _build_index(self):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.execute("CREATE VIRTUAL TABLE s USING fts5(grp UNINDEXED, row UNINDEXED, idx UNINDEXED, subject, make, body, tokenize='porter')")
        rows = [(v.group, v.row, i, v.subject, v.make, s) for v in self.versions for i, s in enumerate(v.sentences)]
        self.db.executemany("INSERT INTO s VALUES (?,?,?,?,?,?)", rows)
        self.vocab = {t for r in rows for t in terms(f"{r[3]} {r[4]} {r[5]}")}
        self.row_to_version = {v.row: v for v in self.versions}

    def _search(self, q_terms: list[str], groups: set[str] | None, k: int = 60):
        if not q_terms:
            return []
        match = " OR ".join(f'"{t}"' for t in q_terms)
        res = self.db.execute("SELECT grp,row,idx,bm25(s,0,0,0,0.5,0.5,1.0) FROM s WHERE s MATCH ? ORDER BY 4 LIMIT ?",
                              (match, 400)).fetchall()
        out = [(g, r, i, -sc) for g, r, i, sc in res if groups is None or g in groups]
        return out[:k]

    def _coverage(self, ts: list[str]) -> float:
        if not ts:
            return 1.0
        stems = {v[:5] for v in self.vocab if len(v) >= 5}
        return sum(t in self.vocab or (len(t) >= 5 and t[:5] in stems) for t in ts) / len(ts)

    def _doc_coverage(self, g: str, ts: list[str]) -> float:
        """Share of topic terms that occur (5-char stem) anywhere in this docket's text."""
        d = self.dockets[g]
        words = {w[:5] for v in d.versions for w in terms(v.summary + " " + v.subject)}
        return sum(t[:5] in words for t in ts) / len(ts) if ts else 1.0

    # ---------------- model matching (rules) ----------------
    @staticmethod
    def match_model(user: str, listed: list[str]) -> tuple[str, list[str]]:
        u = norm_model(user)
        exact = [m for m in listed if m.rstrip("*") == u]
        if exact:
            return ("SERIES" if exact[0].endswith("*") else "EXACT"), exact
        series = [m for m in listed if m.endswith("*") and NprmEngine._in_series(u, m[:-1])]
        if series:
            return "SERIES", series
        fam = re.fullmatch(r"(.*-\d)00", u)            # user gave a series name, e.g. A350-900 -> A350-9xx
        family = [m for m in listed if m.rstrip("*").startswith(u + "-") or m.rstrip("*").startswith(u)
                  or (fam and re.fullmatch(re.escape(fam.group(1)) + r"\d{2}[A-Z]*", m.rstrip("*")))]
        if family:
            return "FAMILY_ONLY", family
        return "NONE", []

    @staticmethod
    def _in_series(u: str, base: str) -> bool:
        """FAA convention: 'A330-200 series' covers A330-2xx variants (A330-243); '777-300 series' covers 777-300ER."""
        if u.startswith(base):
            return True
        m = re.fullmatch(r"(.*-\d)00", base)
        return bool(m and re.fullmatch(re.escape(m.group(1)) + r"\d{2}[A-Z]*", u))

    def _known_model(self, tok: str) -> bool:
        u = norm_model(tok)
        return any(self.match_model(u, [m])[0] != "NONE" for m in self.all_models)

    # ---------------- query parsing ----------------
    def _parse(self, q: str, cfg: dict) -> dict:
        p: dict = {"dockets": [m.upper() for m in DOCKET.findall(q)]}
        q_wo = DOCKET.sub(" ", q)
        p["ads"] = AD_NUM.findall(q_wo)
        q_wo = AD_NUM.sub(" ", q_wo)
        s = SERIAL_IN_Q.search(q_wo)
        p["serial"] = cfg.get("serial") or (s.group(2) if s else None)
        if s:
            q_wo = q_wo.replace(s.group(0), " ")
        toks = [t for t in MODEL_IN_Q.findall(q_wo) if re.search(r"\d", t) or re.search(r"-[IVX]+$", t)]
        toks += [t for t in re.findall(r"(?<![\w-])\d{3}(?![\w-])", q_wo) if self._known_model(t) and t not in toks]
        p["model"] = cfg.get("model")
        p["unknown_models"] = []
        for t in toks:
            if self._known_model(t):
                p["model"] = p["model"] or norm_model(t)
            else:
                p["unknown_models"].append(t)
            q_wo = q_wo.replace(t, " ")
        p["intent"] = next((n for n, rx in INTENTS if rx.search(q)), None)
        p["topic"] = [t for t in terms(q_wo) if t not in INTENT_WORDS and t not in STOP and not t.isdigit()]
        return p

    # ---------------- main ----------------
    def ask(self, query: str, config: dict | None = None) -> Result:
        t0 = time.perf_counter()
        cfg = {k: v for k, v in (config or {}).items() if v not in (None, "")}
        p = self._parse(query, cfg)
        r = Result(Status.REFUSED, query, {"model": p["model"], "serial": p["serial"]})
        try:
            self._run(query, p, r)
        finally:
            r.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return r

    def _refuse(self, r: Result, code: str, msg: str):
        r.status = Status.REFUSED
        r.refusal = {"code": code, "message": msg}
        r.trace.append(f"REFUSE {code}: {msg}")

    def _run(self, q: str, p: dict, r: Result):
        r.trace.append(f"intent={p['intent']} model={p['model']} serial={p['serial']} topic={p['topic']}")
        if p["unknown_models"] and not p["model"]:
            return self._refuse(r, "UNKNOWN_MODEL",
                                f"{', '.join(p['unknown_models'])} does not appear in any NPRM in this dataset, "
                                "so I can't say whether any proposal covers it.")

        # 1. candidate dockets
        if p["dockets"]:
            missing = [d for d in p["dockets"] if d not in self.by_docket]
            if missing:
                return self._refuse(r, "UNKNOWN_DOCKET", f"Docket {', '.join(missing)} is not in this dataset.")
            groups = [self.by_docket[p["dockets"][0]].group]
            r.trace.append(f"docket named in query -> {groups[0]}")
        elif p["ads"]:
            hits = [g for a in p["ads"] for g in self.ads_mentioned.get(a, [])]
            if not hits:
                return self._refuse(r, "UNKNOWN_AD",
                                    f"AD {', '.join(p['ads'])} isn't referenced by any NPRM in this dataset. "
                                    "This dataset holds proposals only, not the full AD register.")
            groups = list(dict.fromkeys(hits))
            r.trace.append(f"AD {p['ads']} referenced by dockets {groups}")
        else:
            pool = set(self.dockets)
            if p["model"]:
                pool = {g for g, d in self.dockets.items()
                        if not d.models or self.match_model(p["model"], d.models)[0] != "NONE"}   # no model list -> keep, verdict UNDETERMINED
                r.trace.append(f"model {p['model']} listed in {len(pool)} dockets")
                if not pool:
                    return self._refuse(r, "UNKNOWN_MODEL", f"No NPRM in this dataset lists model {p['model']}.")
            if p["topic"]:
                cov = self._coverage(p["topic"])
                r.trace.append(f"topic coverage={cov:.2f}")
                if cov < self.min_coverage:
                    return self._refuse(r, "OUT_OF_SCOPE",
                                        "The question uses terms that don't appear in any NPRM in this dataset.")
                hits = self._search(p["topic"], pool)
                best: dict[str, float] = {}
                for g, _, _, sc in hits:
                    best[g] = max(best.get(g, 0.0), sc)
                ranked = sorted(best.items(), key=lambda x: -x[1])
                if not ranked:
                    return self._refuse(r, "NO_MATCH", "No NPRM matches this question"
                                        + (f" for model {p['model']}." if p["model"] else "."))
                r.trace.append("ranked " + ", ".join(f"{g}:{s:.1f}" for g, s in ranked[:5]))
                ranked = [(g, s) for g, s in ranked if self._doc_coverage(g, p["topic"]) >= 0.5]
                if not ranked:
                    return self._refuse(r, "NO_MATCH", "No NPRM" + (f" for {p['model']}" if p["model"] else "")
                                        + " mentions most of: " + ", ".join(p["topic"]) + ".")
                top = ranked[0][1]
                close = [g for g, s in ranked if s >= 0.85 * top]
                groups = close[:8] if (len(close) > 1 or p["intent"] == "list") else [ranked[0][0]]
            elif p["model"]:
                unknown = [g for g in pool if not self.dockets[g].models]
                pool = [g for g in pool if self.dockets[g].models]           # list only real model matches
                r.trace.append(f"{len(unknown)} dockets have no model list; not counted as matches")
                groups = sorted(pool, key=lambda g: self.dockets[g].latest.publish_date or date.min, reverse=True)
                p["intent"] = "list"
            else:
                r.status = Status.NEEDS_INPUT
                r.needs = ["model", "docket or topic"]
                r.trace.append("nothing to search on")
                return

        if len(groups) > 1:
            return self._list(r, p, groups)
        return self._single(r, p, self.dockets[groups[0]])

    # ---------------- list answer ----------------
    def _list(self, r: Result, p: dict, groups: list[str]):
        rows = []
        for g in groups:
            d = self.dockets[g]
            lvl = self.match_model(p["model"], d.models)[0] if p["model"] else None
            rows.append({"docket": g, "subject": d.substantive.subject, "status": d.status,
                         "latest": str(d.latest.publish_date), "scope": d.substantive.scope,
                         "model_match": lvl, "first_sentence": d.substantive.sentences[0] if d.substantive.sentences else ""})
        r.candidates = rows
        if p["intent"] == "list":
            r.status = Status.ANSWERED if p["model"] else Status.ANSWERED_GENERAL
            r.fields = {"count": len(rows),
                        "by_status": {s: sum(x["status"] == s for x in rows) for s in ("PROPOSED", "REVISED_PROPOSAL", "WITHDRAWN")}}
            r.trace.append(f"list answer: {len(rows)} dockets")
        else:
            r.status = Status.NEEDS_INPUT
            r.needs = ["docket"]
            r.trace.append("several dockets match about equally; asking user to pick")
        r.claims = [Claim(f"{x['docket']}:s0", x["first_sentence"], self._cite(self.dockets[x["docket"]].substantive, 0))
                    for x in rows if x["first_sentence"]]

    # ---------------- single docket ----------------
    def _single(self, r: Result, p: dict, d: Docket):
        sub, last = d.substantive, d.latest
        r.ad = d.group
        q = r.query
        if re.search(r"\b(why|when|how)\b.{0,40}\bwithdraw|\bwas withdrawn\b|\bsince .{0,40}withdrawn", q, re.I) and d.status != "WITHDRAWN":
            r.claims = [self._claim(last, 0)]
            return self._refuse(r, "CONTRADICTS_SOURCE",
                                f"The question assumes {d.group} was withdrawn, but no withdrawal notice exists in this "
                                f"dataset. Its latest notice ({last.publish_date}) is still a proposal.")
        if p["ads"] and re.search(r"\bsupersed|\breplac", q, re.I):
            known = {a for v in d.versions for a in v.mentioned_ads}
            wrong = [a for a in p["ads"] if a not in known]
            if wrong:
                r.claims = [self._claim(sub, 0)]
                return self._refuse(r, "CONTRADICTS_SOURCE",
                                    f"The question links {d.group} to AD {', '.join(wrong)}, but its notices only reference "
                                    + (f"AD {', '.join(sorted(known))}." if known else "no AD numbers."))
        r.revision = {
            "docket": d.group, "status": d.status,
            "versions": [{"date": str(v.publish_date), "action": v.action, "fr": v.fr_citation, "pages": v.pages,
                          "row": v.row, "link": v.link} for v in d.versions],
            "latest_action": last.action,
            "withdrawn_by": d.withdrawn_by.docket if d.withdrawn_by else None,
            "supersedes_ads": sorted({a for v in d.versions if v.action in ("SUPERSEDE", "REVISED_PROPOSAL", "WITHDRAWN") for a in v.mentioned_ads}),
            "resulting_ad": next((v.ad_number for v in reversed(d.versions) if v.ad_number), None),
        }
        r.trace.append(f"docket {d.group}: {len(d.versions)} version(s); status {d.status}")

        due = last.comments_due if last.action != "WITHDRAWN" else None
        r.fields = {
            "regulatory_status": d.status,
            "binding": "No. This is a proposed rule (NPRM), not an AD in force." if d.status != "WITHDRAWN"
                       else "No. This proposal was withdrawn.",
            "latest_publication": f"{last.fr_citation} {last.pages}",
            "comments_due": (f"{due} ({'open' if due >= self.today else 'closed'})" if due else None),
            "supersedes_ads": r.revision["supersedes_ads"] or None,
            "make": sub.make, "models_listed": d.models[:40], "models_source": sub.models_from,
            "scope_wording": sub.scope, "link": last.link or sub.link,
        }

        # applicability (rules only)
        app = self._applicability(d, p)
        r.applicability = app
        r.trace.append(f"applicability={app['verdict']}: " + " | ".join(app["reasons"]))

        # evidence
        intent = p["intent"]
        if d.status == "WITHDRAWN":
            wv = d.withdrawn_by or last
            claims = [self._claim(wv, i) for i in range(min(2, len(wv.sentences)))]
            if intent in ("requirements", "reason") and sub is not wv:
                claims += self._pick(sub, intent, p, 2)
            r.claims = claims
            r.status = Status.ANSWERED
            r.trace.append("proposal withdrawn: answer states it imposes no requirement")
            return

        if app["verdict"] == "NOT_LISTED":
            r.status = Status.NOT_APPLICABLE
            r.claims = [self._claim(sub, 0)]
            return
        if app["verdict"] == "NEEDS_VARIANT":
            r.status = Status.NEEDS_INPUT
            r.needs = ["exact model variant"]
            r.claims = [self._claim(sub, 0)]
            return

        if intent == "compliance_time":
            timing = re.compile(r"\bwithin \d|\b\d[\d,]* (days?|months?|years?|flight hours|flight cycles|cycles|hours)\b", re.I)
            if not any(timing.search(x) for v in d.versions for x in v.sentences):
                r.claims = self._pick(sub, "requirements", p, 1)
                return self._refuse(r, "NOT_IN_DATA",
                                    f"{d.group}'s notice summary doesn't state compliance times. They are in the full "
                                    "Federal Register text, and for a proposal they may still change before a final AD.")
        src = last if intent == "status" else sub
        claims = self._pick(src, intent, p, 3)
        if intent == "status" and src is not sub:
            claims += self._pick(sub, "requirements", p, 1)
        if not any(c.cite.sentence == 0 and c.cite.sheet_row == sub.row for c in claims):
            claims.insert(0, self._claim(sub, 0))
        r.claims = claims
        r.status = Status.ANSWERED if app["verdict"] == "MODEL_LISTED_ALL_UNITS" else Status.ANSWERED_GENERAL

    def _applicability(self, d: Docket, p: dict) -> dict:
        sub = d.substantive
        if not p["model"]:
            return {"verdict": "NO_MODEL_GIVEN", "reasons": ["No aircraft model given; answer is about the proposal only."]}
        if not d.models:
            return {"verdict": "UNDETERMINED",
                    "reasons": ["The model list in this NPRM's summary is not machine-readable. Check the Federal Register text."]}
        lvl, hits = self.match_model(p["model"], d.models)
        if lvl == "NONE":
            return {"verdict": "NOT_LISTED", "listed": [m.rstrip("*") for m in d.models],
                    "reasons": [f"{p['model']} is not among the listed models."]}
        if lvl == "FAMILY_ONLY":
            return {"verdict": "NEEDS_VARIANT", "variants": [h.rstrip("*") for h in hits],
                    "reasons": [f"'{p['model']}' matches several listed variants ({', '.join(h.rstrip('*') for h in hits[:6])}). Give the exact variant."]}
        why = f"{p['model']} matches listed {'series ' if lvl == 'SERIES' else ''}model {hits[0].rstrip('*')}."
        if sub.scope == "ALL":
            return {"verdict": "MODEL_LISTED_ALL_UNITS", "reasons": [why, "Summary says the proposal applies to ALL units of the listed models."]}
        extra = ("Summary says 'certain' units: the unit criteria (serial numbers, configurations) are in the full "
                 "Federal Register text, which this dataset does not contain.")
        reasons = [why, extra]
        if p["serial"]:
            reasons.append(f"Cannot check serial {p['serial']} against this dataset.")
        return {"verdict": "MODEL_LISTED_UNITS_UNCONFIRMED", "reasons": reasons}

    # ---------------- evidence helpers ----------------
    def _pick(self, v: Version, intent: str | None, p: dict, n: int) -> list[Claim]:
        rx = INTENT_SENT.get(intent or "")
        idx = [i for i, s in enumerate(v.sentences) if rx and rx.search(s)]
        if intent == "reason":
            pri = ["prompted by", "since the faa issued", "was notified", "if not addressed", "could result", "to address"]
            idx.sort(key=lambda i: next((k for k, w in enumerate(pri) if w in v.sentences[i].lower()), 99))
        if intent == "requirements":
            idx.sort(key=lambda i: 0 if re.search(r"\bwould\b|\bproposes? to require", v.sentences[i], re.I) else 1)
        if not idx and p["topic"]:
            tt = set(p["topic"])
            scored = sorted(range(len(v.sentences)), key=lambda i: -len(tt & set(terms(v.sentences[i]))))
            idx = [i for i in scored if tt & set(terms(v.sentences[i]))]
        if not idx:
            idx = list(range(min(n, len(v.sentences))))
        return [self._claim(v, i) for i in idx[:n]]

    def _cite(self, v: Version, i: int) -> NCite:
        return NCite(v.docket, str(v.publish_date), v.action, v.fr_citation, v.pages, v.link, v.row, i)

    def _claim(self, v: Version, i: int) -> Claim:
        return Claim(f"{v.docket}@{v.publish_date}:S{i + 1}", v.sentences[i], self._cite(v, i))


def fleet(engine: "NprmEngine", models: list[str]) -> list[dict]:
    """For each model: every docket whose model list covers it (rules only), newest first."""
    out = []
    for raw in models:
        m = norm_model(raw)
        rows = []
        for g, d in engine.dockets.items():
            lvl, hits = engine.match_model(m, d.models)
            if lvl in ("EXACT", "SERIES"):
                last = d.latest
                due = last.comments_due if d.status != "WITHDRAWN" else None
                rows.append({"docket": g, "status": d.status, "match": lvl, "scope": d.substantive.scope,
                             "subject": d.substantive.subject, "latest": str(last.publish_date),
                             "comments_due": str(due) if due else None,
                             "comments_open": bool(due and due >= engine.today),
                             "first_sentence": d.substantive.sentences[0] if d.substantive.sentences else ""})
            elif lvl == "FAMILY_ONLY":
                pass
        rows.sort(key=lambda x: x["latest"], reverse=True)
        known = engine._known_model(m)
        out.append({"model": m, "known": known, "dockets": rows,
                    "counts": {s: sum(r["status"] == s for r in rows) for s in ("PROPOSED", "REVISED_PROPOSAL", "WITHDRAWN")},
                    "open_comments": sum(r["comments_open"] for r in rows)})
    return out
