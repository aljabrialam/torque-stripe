"""Deterministic applicability rules. The LLM never decides whether an AD applies.

A rule is extracted from paragraph (c) with regexes. If the text has a construct we
do not model (e.g. "except", "as identified in", multiple disjoint ranges), the rule
is marked unparsed and every evaluation returns UNDETERMINED -> the system refuses.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

MODEL_TOKEN = re.compile(r"\b(?:[A-Z]{1,5}\d[\w]*(?:-[\w/]+)*|\d{3}-\d{3}\w*)")
RANGE = re.compile(
    r"(?P<kind>manufacturer serial numbers?|engine serial numbers?|serial numbers?|line numbers?|MSN|S/N)"
    r"[^.;]*?\b(?P<lo>[A-Z]{0,3}-?\d+)\s+(?:through|thru|to)\s+(?P<hi>[A-Z]{0,3}-?\d+)",
    re.I,
)
ALL_SERIALS = re.compile(r"\ball (manufacturer )?serial numbers\b", re.I)
UNMODELLED = re.compile(r"\b(except|excluding|as identified in|having|unless|other than)\b", re.I)


class Verdict(str, Enum):
    APPLIES = "APPLIES"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NEEDS_INPUT = "NEEDS_INPUT"
    UNDETERMINED = "UNDETERMINED"


@dataclass
class ApplicabilityRule:
    models: list[str]
    serial_kind: str | None          # "serial" | "line" | None
    serial_lo: int | None
    serial_hi: int | None
    all_serials: bool
    parsed: bool
    notes: list[str] = field(default_factory=list)
    source_text: str = ""


@dataclass
class Evaluation:
    verdict: Verdict
    reasons: list[str]               # each reason is a checkable statement
    missing: list[str] = field(default_factory=list)


def _num(s: str) -> int:
    return int(re.sub(r"\D", "", s))


def norm_model(m: str) -> str:
    return m.upper().replace(" ", "")


def extract_rule(text: str) -> ApplicabilityRule:
    notes: list[str] = []
    m_idx = re.search(r"\bModels?\b", text)
    model_zone = text[m_idx.end():] if m_idx else ""
    stop = re.search(r"\b(airplanes|engines|helicopters|turbofan|rotorcraft|propellers|certificated)\b", model_zone)
    model_zone = model_zone[: stop.start()] if stop else model_zone[:200]
    models = sorted({norm_model(t) for t in MODEL_TOKEN.findall(model_zone)})

    ranges = list(RANGE.finditer(text))
    all_serials = bool(ALL_SERIALS.search(text))
    parsed = True
    if not models:
        parsed = False
        notes.append("No model designations recognised in applicability text.")
    if len(ranges) > 1:
        parsed = False
        notes.append("Multiple serial ranges: not modelled, refusing rather than guessing.")
    if UNMODELLED.search(text):
        parsed = False
        notes.append(f"Conditional wording '{UNMODELLED.search(text).group(0)}' not modelled.")

    kind = lo = hi = None
    if len(ranges) == 1:
        r = ranges[0]
        kind = "line" if "line" in r.group("kind").lower() else "serial"
        lo, hi = _num(r.group("lo")), _num(r.group("hi"))
    elif not all_serials and parsed:
        notes.append("No serial restriction found; applies to all units of listed models.")
        all_serials = True

    return ApplicabilityRule(models, kind, lo, hi, all_serials, parsed, notes, text)


def evaluate(rule: ApplicabilityRule, model: str | None, serial: str | int | None,
             serial_kind: str | None = None) -> Evaluation:
    if not rule.parsed:
        return Evaluation(Verdict.UNDETERMINED, rule.notes)

    if not model:
        return Evaluation(Verdict.NEEDS_INPUT, ["Model is required to check applicability."], ["model"])
    m = norm_model(model)
    if m not in rule.models:
        return Evaluation(Verdict.NOT_APPLICABLE,
                          [f"Model {m} is not in the applicability list {rule.models}."])

    reasons = [f"Model {m} is listed in the applicability paragraph."]
    if rule.all_serials:
        return Evaluation(Verdict.APPLIES, reasons + ["No serial restriction."])

    if serial is None or str(serial).strip() == "":
        label = "line number" if rule.serial_kind == "line" else "serial number"
        return Evaluation(Verdict.NEEDS_INPUT,
                          reasons + [f"AD is limited to {label}s {rule.serial_lo}-{rule.serial_hi}."],
                          [label])
    if serial_kind and rule.serial_kind and serial_kind != rule.serial_kind:
        return Evaluation(Verdict.NEEDS_INPUT,
                          reasons + [f"AD is keyed on {rule.serial_kind} number, you gave a {serial_kind} number."],
                          [f"{rule.serial_kind} number"])
    try:
        s = _num(str(serial))
    except ValueError:
        return Evaluation(Verdict.UNDETERMINED, reasons + [f"Serial '{serial}' is not numeric."])

    if rule.serial_lo <= s <= rule.serial_hi:
        return Evaluation(Verdict.APPLIES,
                          reasons + [f"{s} is within {rule.serial_lo}-{rule.serial_hi} inclusive."])
    return Evaluation(Verdict.NOT_APPLICABLE,
                      reasons + [f"{s} is outside {rule.serial_lo}-{rule.serial_hi}."])
