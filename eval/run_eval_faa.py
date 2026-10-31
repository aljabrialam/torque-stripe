"""Gold-set evaluation on the real FAA NPRM data. Deterministic: no LLM involved.
Baseline = plain BM25 retrieval that always answers with the top docket (typical RAG demo)."""
import json, statistics, sys
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from torquestripe.nprm_engine import NprmEngine
from torquestripe.index import terms
from torquestripe.nprm import DOCKET

ROOT = Path(__file__).resolve().parents[1]


def main(xlsx=str(ROOT / "data/faa/ad_nprm.xlsx"), gold=str(ROOT / "eval/gold_faa.json")):
    e = NprmEngine(xlsx, today=date(2026, 10, 31))
    G = json.loads(Path(gold).read_text())
    rows, lat = [], []
    for g in G:
        r = e.ask(g["q"], g["cfg"]); lat.append(r.latency_ms)
        ok = r.status.value == g["status"]
        if "docket" in g: ok &= r.ad == g["docket"]
        if "reg" in g: ok &= r.fields.get("regulatory_status") == g["reg"]
        if "app" in g: ok &= r.applicability.get("verdict") == g["app"]
        if "code" in g: ok &= (r.refusal or {}).get("code") == g["code"]
        if "due" in g: ok &= r.fields.get("comments_due") == g["due"]
        if g.get("list"): ok &= len(r.candidates) > 1
        # baseline
        named = DOCKET.search(g["q"])            # give the baseline exact docket lookup, like a real RAG demo would
        hits = e._search(terms(g["q"]), None, k=1)
        b_docket = (e.by_docket[named.group(1).upper()].group if named and named.group(1).upper() in e.by_docket
                    else (hits[0][0] if hits else None))
        b_ok = g["status"].startswith("ANSWERED") and (("docket" not in g) or b_docket == g["docket"]) \
               and g.get("reg") != "WITHDRAWN" and g.get("status") != "ANSWERED_GENERAL"
        rows.append(dict(q=g["q"], cfg=g["cfg"], want=g["status"], got=r.status.value, ok=ok, got_docket=r.ad,
                         want_docket=g.get("docket"), app=r.applicability.get("verdict"),
                         code=(r.refusal or {}).get("code"), base_ok=b_ok, base_docket=b_docket))
    n = len(rows)
    unsafe_cases = [x for x in rows if not x["want"].startswith("ANSWERED")]
    wd = [x for x, g in zip(rows, G) if g.get("reg") == "WITHDRAWN"]
    summary = {
        "questions": n,
        "fully_correct": f'{sum(x["ok"] for x in rows)}/{n}',
        "unsafe_answers (answered when it should refuse/ask/say not applicable)":
            f'{sum(x["got"].startswith("ANSWERED") for x in unsafe_cases)}/{len(unsafe_cases)}',
        "withdrawn proposals flagged as withdrawn": f'{sum(x["ok"] for x in wd)}/{len(wd)}',
        "baseline_fully_correct": f'{sum(x["base_ok"] for x in rows)}/{n}',
        "baseline_unsafe_answers": f'{len(unsafe_cases)}/{len(unsafe_cases)}',
        "baseline_withdrawn_flagged": f'0/{len(wd)}',
        "latency_p50_ms": round(statistics.median(lat), 2), "latency_max_ms": round(max(lat), 2),
        "corpus": {"rows": len(e.versions), "dockets": len(e.dockets), "federal_register_pages": e.total_pages},
    }
    print(json.dumps(summary, indent=2))
    for x in rows:
        if not x["ok"]:
            print("FAIL:", json.dumps(x))
    return summary, rows

if __name__ == "__main__":
    main(*sys.argv[1:])
