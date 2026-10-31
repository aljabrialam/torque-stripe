"""Optional LLM phrasing layer + deterministic verifier.

Claude only sees the claims the engine already selected. It may rewrite them into a
readable answer, but every sentence it writes must cite claim ids, and a deterministic
verifier checks each sentence against those claims. Any sentence that fails is dropped;
if anything is dropped, we fall back to the verbatim extractive answer.
The status (ANSWERED / REFUSED / ...) is never decided or changed by the LLM.
"""
from __future__ import annotations

import json
import os
import re

from .engine import Result, Status
from .index import terms

NUMERIC = re.compile(r"\b[A-Z]*\d[\w\-./,]*\b")
SYSTEM = """You rewrite verified airworthiness-directive evidence into a short answer for a licensed aircraft maintenance engineer.
Rules:
- Use ONLY the claims provided. Do not add facts, numbers, part numbers, documents or advice that are not in them.
- Copy every number, interval, part number, AD number and document reference exactly as written.
- Every sentence must cite one or more claim ids.
- Output JSON only: {"sentences":[{"text":"...","cites":["<claim id>",...]}]}"""


def extractive(r: Result) -> list[dict]:
    return [{"text": c.text, "cites": [c.id], "verified": True} for c in r.claims]


def verify(sentence: str, cited_texts: list[str]) -> tuple[bool, str]:
    """Deterministic support check. Returns (ok, reason)."""
    if not cited_texts:
        return False, "no valid citation"
    src = " ".join(cited_texts)
    norm = lambda s: s.replace(",", "").rstrip(".").upper()
    src_nums = {norm(t) for t in NUMERIC.findall(src)}
    for tok in NUMERIC.findall(sentence):
        if norm(tok) not in src_nums:
            return False, f"token '{tok}' not in cited text"
    for neg in ("not", "no", "never", "without", "unless", "except"):
        if re.search(rf"\b{neg}\b", sentence, re.I) and not re.search(rf"\b{neg}\b", src, re.I):
            return False, f"adds '{neg}', which changes meaning"
    words = [w for w in terms(sentence) if not any(ch.isdigit() for ch in w)]
    src_terms = set(terms(src))
    src_stems = {t[:5] for t in src_terms}
    if words:
        covered = sum(w in src_terms or w[:5] in src_stems for w in words) / len(words)
        if covered < 0.7:
            return False, f"only {covered:.0%} of content words appear in cited text"
    return True, "ok"


def phrase(r: Result, use_llm: bool = True, model: str | None = None) -> dict:
    out = {"mode": "extractive", "sentences": extractive(r), "rejected": []}
    if not use_llm or r.status not in (Status.ANSWERED, Status.ANSWERED_GENERAL) or not r.claims:
        return out
    if not os.environ.get("ANTHROPIC_API_KEY"):
        out["note"] = "ANTHROPIC_API_KEY not set; showing verbatim evidence."
        return out
    try:
        import anthropic
        client = anthropic.Anthropic()
        claims = [{"id": c.id, "text": c.text, "source": getattr(c.cite, "label", "")} for c in r.claims]
        msg = client.messages.create(
            model=model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
            max_tokens=600,
            temperature=0,
            system=SYSTEM,
            messages=[{"role": "user", "content": json.dumps({"question": r.query, "claims": claims})}],
        )
        raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    except Exception as e:  # network, auth, bad JSON -> deterministic fallback
        out["note"] = f"LLM unavailable ({type(e).__name__}); showing verbatim evidence."
        return out

    by_id = {c.id: c.text for c in r.claims}
    kept, rejected = [], []
    for s in data.get("sentences", []):
        cites = [c for c in s.get("cites", []) if c in by_id]
        ok, why = verify(s.get("text", ""), [by_id[c] for c in cites])
        (kept if ok else rejected).append({"text": s.get("text", ""), "cites": cites, "verified": ok, "reason": why})
    if rejected or not kept:
        out["rejected"] = rejected
        out["note"] = f"{len(rejected)} LLM sentence(s) failed verification; showing verbatim evidence instead."
        return out
    return {"mode": "llm_verified", "sentences": kept, "rejected": []}
