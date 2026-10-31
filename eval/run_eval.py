"""Run the gold set against the engine and a naive RAG baseline. Deterministic: no LLM involved."""
import json, statistics, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from torquestripe.parse import load_dir
from torquestripe.engine import Engine

def baseline(e, q):
    """Plain retrieval: top BM25 paragraph's AD, always answers. What a typical RAG demo does."""
    hits = e.index.search(q, k=1)
    return ("ANSWERED", hits[0][0]) if hits else ("ANSWERED", None)

def main(data_dir, gold_path):
    e = Engine(load_dir(data_dir))
    gold = json.loads(Path(gold_path).read_text())
    rows, lat = [], []
    for g in gold:
        r = e.ask(g["q"], g["cfg"]); lat.append(r.latency_ms)
        b_status, b_ad = baseline(e, g["q"])
        field_ok = None
        if "field" in g:
            k, v = g["field"]; field_ok = any(x["value"] == v for x in r.fields.get(k, []))
        rows.append(dict(q=g["q"], cfg=g["cfg"], want=g["status"], got=r.status.value,
                         status_ok=r.status.value == g["status"],
                         ad_ok=("ad" not in g) or r.ad == g["ad"], field_ok=field_ok,
                         base_status_ok=b_status == g["status"],
                         base_ad_ok=("ad" not in g) or b_ad == g["ad"],
                         refusal=(r.refusal or {}).get("code")))
    n = len(rows)
    should_not_answer = [x for x in rows if not x["want"].startswith("ANSWERED")]
    answered_wrongly = [x for x in should_not_answer if x["got"].startswith("ANSWERED")]
    base_answered_wrongly = should_not_answer  # baseline answers everything
    fields = [x for x in rows if x["field_ok"] is not None]
    summary = {
        "questions": n,
        "status_accuracy": f'{sum(x["status_ok"] for x in rows)}/{n}',
        "correct_latest_ad": f'{sum(x["ad_ok"] for x in rows)}/{n}',
        "field_exact_match": f'{sum(x["field_ok"] for x in fields)}/{len(fields)}',
        "unsafe_answers (answered when it should refuse/ask)": f'{len(answered_wrongly)}/{len(should_not_answer)}',
        "baseline_status_accuracy": f'{sum(x["base_status_ok"] for x in rows)}/{n}',
        "baseline_correct_latest_ad": f'{sum(x["base_ad_ok"] for x in rows)}/{n}',
        "baseline_unsafe_answers": f'{len(base_answered_wrongly)}/{len(should_not_answer)}',
        "latency_p50_ms": round(statistics.median(lat), 2),
        "latency_max_ms": round(max(lat), 2),
    }
    print(json.dumps(summary, indent=2))
    fails = [x for x in rows if not (x["status_ok"] and x["ad_ok"] and x["field_ok"] in (None, True))]
    for f in fails:
        print("FAIL:", json.dumps(f))
    return summary, rows

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/sample",
         sys.argv[2] if len(sys.argv) > 2 else "eval/gold_sample.json")
