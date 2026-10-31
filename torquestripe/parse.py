"""Deterministic AD parser. No LLM. Every field keeps a pointer to its source paragraph."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

AD_NUM = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
PARA_HEAD = re.compile(r"^\(([a-z]{1,2})\)\s+(.+?)\s*$", re.M)
HEADER = re.compile(r"^([A-Z][A-Z ]+):\s*(.+?)\s*$", re.M)


@dataclass
class Paragraph:
    pid: str          # "c"
    heading: str      # "Applicability"
    text: str

    @property
    def ref(self) -> str:
        return f"({self.pid}) {self.heading}"


@dataclass
class AD:
    number: str
    amendment: str | None
    effective: str | None
    subject: str | None
    supersedes: list[str]
    paragraphs: list[Paragraph]
    source: str
    synthetic: bool = False
    superseded_by: str | None = None
    applicability: "ApplicabilityRule | None" = None
    meta: dict = field(default_factory=dict)

    def para(self, name: str) -> Paragraph | None:
        name = name.lower()
        for p in self.paragraphs:
            if p.heading.lower().startswith(name):
                return p
        return None


def parse_text(raw: str, source: str) -> AD:
    head_end = PARA_HEAD.search(raw)
    header_block = raw[: head_end.start()] if head_end else raw
    hdr = {k.strip().upper(): v for k, v in HEADER.findall(header_block)}

    number = hdr.get("AD NUMBER") or (AD_NUM.search(raw).group(1) if AD_NUM.search(raw) else None)
    if not number:
        raise ValueError(f"No AD number found in {source}")

    paragraphs: list[Paragraph] = []
    heads = list(PARA_HEAD.finditer(raw))
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(raw)
        body = " ".join(raw[m.end():end].split())
        paragraphs.append(Paragraph(m.group(1), m.group(2), body))

    supersedes = AD_NUM.findall(hdr.get("SUPERSEDES", ""))
    aff = next((p for p in paragraphs if p.heading.lower().startswith("affected ad")), None)
    if aff and re.search(r"\b(replaces|supersedes)\b", aff.text, re.I):
        supersedes = sorted(set(supersedes) | set(AD_NUM.findall(aff.text)) - {number})

    return AD(
        number=number,
        amendment=hdr.get("AMENDMENT"),
        effective=hdr.get("EFFECTIVE DATE"),
        subject=hdr.get("SUBJECT"),
        supersedes=supersedes,
        paragraphs=paragraphs,
        source=source,
        synthetic="SYNTHETIC SAMPLE" in raw,
    )


def load_dir(path: str | Path) -> list[AD]:
    ads = [parse_text(p.read_text(encoding="utf-8", errors="replace"), p.name)
           for p in sorted(Path(path).glob("*.txt"))]
    return link_revisions(ads)


def link_revisions(ads: list[AD]) -> list[AD]:
    """Deterministic revision chain: A superseded by B if B lists A. Follows chains to the latest."""
    by_num = {a.number: a for a in ads}
    for a in ads:
        for old in a.supersedes:
            if old in by_num:
                by_num[old].superseded_by = a.number
    return ads


def latest(ad_number: str, by_num: dict[str, AD]) -> tuple[str, list[str]]:
    chain = [ad_number]
    cur = by_num[ad_number]
    while cur.superseded_by and cur.superseded_by in by_num and cur.superseded_by not in chain:
        cur = by_num[cur.superseded_by]
        chain.append(cur.number)
    return cur.number, chain
