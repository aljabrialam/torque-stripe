"""Generate parity cases and Python engine outputs (for comparison with the browser engine)."""
import json, random, sys
from datetime import date
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
from torquestripe.nprm_engine import NprmEngine, fleet
e = NprmEngine(str(ROOT / "data/faa/ad_nprm.xlsx"), today=date(2026, 10, 31))
random.seed(42)
cases = [{"q": g["q"], "cfg": g["cfg"]} for g in json.loads((ROOT / "eval/gold_faa.json").read_text())]
cases += [{"q": k["q"], "cfg": k["cfg"]} for k in json.loads((ROOT / "eval/known_failures.json").read_text())]
gs = list(e.dockets)
for g in random.sample(gs, 80):
    d = e.dockets[g]; ms = [m.rstrip("*") for m in d.models]
    cases.append({"q": f"What does {g} propose?", "cfg": {}})
    cases.append({"q": f"Status of {g}", "cfg": {}})
    cases.append({"q": f"Why was {g} proposed?", "cfg": {}})
    if ms:
        cases.append({"q": f"Does {g} apply to my aircraft?", "cfg": {"model": random.choice(ms)}})
        cases.append({"q": f"Does {g} apply to my aircraft?", "cfg": {"model": "A380-841"}})
    words = [w for w in d.substantive.sentences[1].split()[:14] if len(w) > 4] if len(d.substantive.sentences) > 1 else []
    if len(words) >= 3:
        cases.append({"q": " ".join(random.sample(words, 3)), "cfg": {"model": random.choice(ms)} if ms else {}})
for m in random.sample(sorted({m.rstrip('*') for m in e.all_models}), 40):
    cases.append({"q": f"Any proposed ADs for {m}?", "cfg": {}})
for a in random.sample(sorted(e.ads_mentioned), 25):
    cases.append({"q": f"Which NPRM supersedes AD {a}?", "cfg": {}})
def sig(r):
    return {"status": r.status.value, "ad": r.ad, "code": (r.refusal or {}).get("code"), "verdict": r.applicability.get("verdict"),
            "cands": sorted(c["docket"] for c in r.candidates), "claims": [c.id for c in r.claims],
            "due": r.fields.get("comments_due"), "reg": r.fields.get("regulatory_status")}
out = [{**c, "py": sig(e.ask(c["q"], c["cfg"]))} for c in cases]
fl = fleet(e, ["AS350B3", "A330-243", "787-9", "PW1524G-3", "A380-841", "737-800", "A320-214", "CFM56-7B"])
json.dump({"cases": out, "fleet": [{"model": f["model"], "known": f["known"], "dockets": [x["docket"] for x in f["dockets"]], "open": f["open_comments"]} for f in fl]},
          open(ROOT / "tests/parity_py.json", "w"))
print(len(out), "cases")
