"""Deterministic ingest of the FAA AD NPRM spreadsheet (Challenge #4 data).

Each spreadsheet row is one Federal Register publication (a *version*) of a proposed AD.
Rows sharing a docket form a version chain: proposed -> revised / corrected -> withdrawn.
No LLM is used anywhere in this file.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

AD_NUM = re.compile(r"\b((?:19|20)\d{2}-\d{2}-\d{2})\b")
DOCKET = re.compile(r"\b(FAA-\d{4}-\d{3,6}(?:R\d+)?|\d{4}-[A-Z]{2,3}-\d{1,4}-AD)\b", re.I)
SENT = re.compile(r"(?<=[.;])\s+(?=[A-Z(])")
PERIOD = re.compile(r"(?<=\.)\s+(?=[A-Z(])")
PRODUCT_NOUN = r"(?:airplanes?|helicopters?|rotorcraft|engines?|propellers?|gliders?|balloons?|appliances?|aircraft|turbofan|turboprop|turboshaft)"

ACTION_RULES = [
    ("NOT_AD", re.compile(r"\b(Standard Instrument Approach|Special Federal Aviation Regulation|SFAR)\b", re.I)),
    ("WITHDRAWN", re.compile(r"\bwithdraw(ing|s|n)?\b", re.I)),
    ("RESCIND_AD", re.compile(r"\brescind", re.I)),
    ("CORRECTION", re.compile(r"\bcorrect(ing|ion)\b.{0,40}\b(notice|nprm|proposed)", re.I)),
    ("REVISED_PROPOSAL", re.compile(r"\b(revising|revises|revise) (a|an|the|an earlier) (notice of proposed|nprm|proposed|earlier)|\brevis\w* an earlier\b|\bsupplemental\b|\breopen", re.I)),
    ("REVISE_EXISTING_AD", re.compile(r"\brevise (an )?existing (airworthiness directive|ad)\b", re.I)),
    ("SUPERSEDE", re.compile(r"\bsupersed", re.I)),
    ("NEW_AD", re.compile(r"\b(adopt\w*|propos\w*|issu\w*)\b.{0,40}\bnew\b", re.I)),
]


@dataclass
class Version:
    row: int                      # spreadsheet row number (1-based incl. header) -> exact source pointer
    docket: str
    group: str                    # docket without "R1" correction suffix
    action: str
    subject: str
    make: str
    models: list[str]
    models_from: str              # "Model column" | "summary text" | "none"
    scope: str                    # ALL | CERTAIN | UNKNOWN
    product_type: str
    product_subtype: str
    issue_date: date | None
    publish_date: date | None
    comments_due: date | None
    ad_number: str | None         # resulting AD number when the sheet gives one
    mentioned_ads: list[str]
    fr_citation: str
    pages: str
    page_count: int
    link: str | None
    summary: str
    sentences: list[str]
    comments: str
    withdraws_docket: str | None

    @property
    def vid(self) -> str:
        return f"{self.docket}@{self.publish_date}"


@dataclass
class Docket:
    group: str
    versions: list[Version] = field(default_factory=list)   # oldest -> newest
    withdrawn_by: Version | None = None                       # cross-docket withdrawal

    @property
    def latest(self) -> Version:
        return self.versions[-1]

    @property
    def status(self) -> str:
        if self.withdrawn_by or self.latest.action == "WITHDRAWN":
            return "WITHDRAWN"
        if len(self.versions) > 1:
            return "REVISED_PROPOSAL"
        return "PROPOSED"

    @property
    def substantive(self) -> Version:
        """Latest version that states what is proposed (skips withdrawal / correction notices)."""
        for v in reversed(self.versions):
            if v.action not in ("WITHDRAWN", "CORRECTION"):
                return v
        return self.versions[0]

    @property
    def models(self) -> list[str]:
        out: list[str] = []
        for v in self.versions:
            out += [m for m in v.models if m not in out]
        return out


# ---------------- model parsing ----------------
def norm_model(m: str) -> str:
    m = re.sub(r"\s+", " ", m.upper()).strip(" ,.;")
    m = m.replace(" FREIGHTER", "F")
    return m.replace(" ", "")


def _expand(items: list[str]) -> list[str]:
    """'A330-243', '-243F', '-841' -> A330-243, A330-243F, A330-841 (FAA shorthand)."""
    out, base, hyph = [], None, False
    for it in items:
        it = re.sub(r"\(.*?\)", "", it).strip(" ,.;")
        it = re.sub(r"^(and|or)\s+", "", it, flags=re.I).strip()
        if not it:
            continue
        if it.startswith("-") and base:
            it = base + it
            hyph = True
        elif hyph and base and re.fullmatch(r"\d{3}[A-Z]*", it) and not it.startswith(base):
            it = f"{base}-{it}"                      # '-900, and 900ER' -> 737-900ER
        elif "-" in it:
            base, hyph = it.split("-")[0], True
        else:
            base, hyph = it, False
        out.append(it)
    return out


def clean_text(t: str) -> str:
    t = t.replace("\\n", " ")
    t = re.sub(r"(\d)-\s+(\d)", r"\1-\2", t)          # 'DC-10- 15' -> 'DC-10-15', '2004-16- 01'
    t = re.sub(r"(\w)/\s+(\w)", r"\1/\2", t)
    return " ".join(t.split())


MODELISH = re.compile(r"\b[A-Z][A-Z0-9]*(?:[-/ ]?[A-Z0-9]+)*\d[\w\-/]*\b")


def models_from_summary(summary: str) -> tuple[list[str], str]:
    first = " ".join(PERIOD.split(summary)[:2])
    listings: list[tuple[str, bool]] = []
    for m in re.finditer(r"\bModels?\b\s+(.+?)\s+(series\s+)?(?i:" + PRODUCT_NOUN + ")", first):
        listings.append((m.group(1), bool(m.group(2)) or bool(re.search(r"\bseries\b", m.group(1), re.I))))
    src = "summary text"
    if not listings:
        m = re.search(r"\b(?:for|to|applies to|applicable to)\s+(?:all|certain)\s+(.+?)\s+(series\s+)?" + PRODUCT_NOUN, first, re.I)
        if m:
            toks = [t for t in MODELISH.findall(m.group(1)) if re.search(r"[A-Z]", t)]
            if toks:
                listings.append((", ".join(toks), bool(m.group(2))))
                src = "summary text (no 'Model' keyword)"
    models: list[str] = []
    for listing, series in listings:
        listing = re.sub(r"\bseries\b", "", listing, flags=re.I)
        listing = re.sub(r"\([^)]*\)", "", listing)
        listing = re.sub(r"\band\s+Models?\b|\bModels?\b", ",", listing, flags=re.I)
        parts = re.split(r",\s*|;\s*|\s+and\s+|\s+or\s+", listing)
        for x in _expand(parts):
            if re.search(r"\d", x) or re.fullmatch(r"[A-Z]+-?[IVX]+(-[A-Z]+)?", x.strip()):
                nm = norm_model(x) + ("*" if series else "")
                if nm not in models:
                    models.append(nm)
    return models, (src if models else "none")


def scope_of(summary: str) -> str:
    first = " ".join(PERIOD.split(summary)[:1])
    if re.search(r"\b(for|to|applies to|apply to|applied to) all\b", first, re.I):
        return "ALL"
    if re.search(r"\bcertain\b", first, re.I):
        return "CERTAIN"
    return "UNKNOWN"


def action_of(summary: str) -> str:
    first = SENT.split(summary)[0] if summary else ""
    for name, rx in ACTION_RULES:
        if rx.search(first):
            return name
    return "OTHER"


def _date(s) -> date | None:
    if isinstance(s, datetime):
        return s.date()
    if isinstance(s, date):
        return s
    try:
        return datetime.strptime(str(s).strip(), "%m/%d/%Y").date()
    except Exception:
        return None


def load_xlsx(path: str | Path) -> tuple[list[Version], dict[str, Docket]]:
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h).strip() for h in rows[0]]
    versions: list[Version] = []
    for i, r in enumerate(rows[1:], start=2):
        d = {h: ("" if v is None else str(v).strip()) for h, v in zip(hdr, r)}
        if not any(d.values()):
            continue
        summary = clean_text(d.get("Summary", ""))
        col_models = [norm_model(m) for m in d.get("Model", "").split("|") if m.strip()]
        if col_models:
            models, src = col_models, "Model column"
        else:
            models, src = models_from_summary(summary)
        pg = re.findall(r"\d+", d.get("Page Number", ""))
        docket = d["Docket Number"]
        comments = d.get("Comments", "")
        wd = DOCKET.search(comments) if re.search(r"withdraw", comments, re.I) else None
        versions.append(Version(
            row=i, docket=docket, group=re.sub(r"R\d+$", "", docket), action=action_of(summary),
            subject=d.get("Subject Heading", ""), make=d.get("Make", ""), models=models, models_from=src,
            scope=scope_of(summary), product_type=d.get("Product Type", ""),
            product_subtype=d.get("Product Subtype", ""), issue_date=_date(d.get("Issue Date")),
            publish_date=_date(d.get("Citation Publish Date")), comments_due=_date(d.get("Comments Due Date")),
            ad_number=d.get("AD Number") or None,
            mentioned_ads=sorted(set(AD_NUM.findall(summary))),
            fr_citation=d.get("Citation", ""), pages=d.get("Page Number", ""),
            page_count=(int(pg[1]) - int(pg[0]) + 1) if len(pg) >= 2 else 0,
            link=d.get("Link for Submitting Public Comment") or None, summary=summary,
            sentences=[s.strip() for s in SENT.split(summary) if s.strip()],
            comments=comments, withdraws_docket=wd.group(1) if wd else None,
        ))
    dockets: dict[str, Docket] = defaultdict(lambda: None)  # type: ignore
    dockets = {}
    for v in sorted(versions, key=lambda v: (v.publish_date or date.min, v.row)):
        dockets.setdefault(v.group, Docket(v.group)).versions.append(v)
    for v in versions:
        if v.withdraws_docket:
            tgt = dockets.get(re.sub(r"R\d+$", "", v.withdraws_docket))
            if tgt and tgt.group != v.group:
                tgt.withdrawn_by = v
    return versions, dockets
