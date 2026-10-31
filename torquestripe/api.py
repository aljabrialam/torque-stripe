"""HTTP API.

Real data (default):  uvicorn torquestripe.api:app --reload
Synthetic sample:     TORQUESTRIPE_DATA=data/sample uvicorn torquestripe.api:app --reload
"""
from __future__ import annotations

import os

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .phrase import phrase

DATA = os.environ.get("TORQUESTRIPE_DATA", "data/faa/ad_nprm.xlsx")
app = FastAPI(title="Torque Stripe", version="0.2")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if DATA.endswith(".xlsx"):
    from .nprm_engine import NprmEngine
    ENGINE = NprmEngine(DATA)
    MODE = "faa_nprm"
else:
    from .engine import Engine
    from .parse import load_dir
    ENGINE = Engine(load_dir(DATA))
    MODE = "sample"


class Ask(BaseModel):
    query: str
    model: str | None = None
    serial: str | None = None
    serial_kind: str | None = None
    use_llm: bool = True


@app.get("/health")
def health():
    if MODE == "faa_nprm":
        return {"mode": MODE, "rows": len(ENGINE.versions), "dockets": len(ENGINE.dockets),
                "federal_register_pages": ENGINE.total_pages, "today": str(ENGINE.today)}
    return {"mode": MODE, "ads": len(ENGINE.ads)}


@app.post("/ask")
def ask(body: Ask):
    r = ENGINE.ask(body.query, {"model": body.model, "serial": body.serial, "serial_kind": body.serial_kind})
    out = r.to_dict()
    out["answer"] = phrase(r, use_llm=body.use_llm)
    return out


class Fleet(BaseModel):
    models: list[str]


@app.post("/fleet")
def fleet_check(body: Fleet):
    if MODE != "faa_nprm":
        raise HTTPException(400, "Only available with FAA NPRM data")
    from .nprm_engine import fleet
    return fleet(ENGINE, [m for m in body.models if m.strip()][:25])


@app.get("/models")
def models():
    if MODE == "faa_nprm":
        return sorted({m.rstrip("*") for m in ENGINE.all_models})
    return sorted(ENGINE.models)


@app.get("/dockets")
def dockets():
    if MODE != "faa_nprm":
        raise HTTPException(400, "Only available with FAA NPRM data")
    return [{"docket": g, "status": d.status, "subject": d.substantive.subject, "make": d.substantive.make,
             "models": d.models, "scope": d.substantive.scope, "latest": str(d.latest.publish_date),
             "first": str(d.versions[0].publish_date), "pt": d.substantive.product_type, "pst": d.substantive.product_subtype,
             "comments_due": str(d.latest.comments_due) if d.latest.comments_due and d.status != "WITHDRAWN" else None,
             "first_sentence": d.substantive.sentences[0] if d.substantive.sentences else "",
             "versions": len(d.versions)} for g, d in ENGINE.dockets.items()]


@app.get("/dockets/{docket}")
def docket(docket: str):
    d = ENGINE.by_docket.get(docket.upper()) if MODE == "faa_nprm" else None
    if not d:
        raise HTTPException(404, "Not in this dataset")
    return {"docket": d.group, "status": d.status, "models": d.models,
            "withdrawn_by": d.withdrawn_by.docket if d.withdrawn_by else None,
            "versions": [{"docket": v.docket, "action": v.action, "publish_date": str(v.publish_date),
                          "issue_date": str(v.issue_date), "comments_due": str(v.comments_due),
                          "fr_citation": v.fr_citation, "pages": v.pages, "link": v.link, "sheet_row": v.row,
                          "subject": v.subject, "make": v.make, "scope": v.scope,
                          "sentences": v.sentences} for v in d.versions]}


STATIC = Path(__file__).parent / "static"
from fastapi.staticfiles import StaticFiles  # noqa: E402
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/eval")
def run_eval():
    """Runs the real-data gold set live (deterministic, no LLM)."""
    import sys
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / "eval"))
    from run_eval_faa import main
    summary, rows = main(str(root / "data/faa/ad_nprm.xlsx"), str(root / "eval/gold_faa.json"))
    import json as _json
    failures = []
    for k in _json.loads((root / "eval/known_failures.json").read_text()):
        r = ENGINE.ask(k["q"], k["cfg"])
        failures.append({**k, "got": r.status.value, "docket": r.ad, "code": (r.refusal or {}).get("code"),
                         "verdict": r.applicability.get("verdict")})
    return {"summary": summary, "rows": rows, "failures": failures}
