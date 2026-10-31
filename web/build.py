"""Build web/dist/index.html: one self-contained page (UI + rule engine + data). No server needed.
Run after changing the UI, the engine or the data:  python3 web/build.py"""
import base64, json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
from torquestripe.nprm import load_xlsx

V, D = load_xlsx(ROOT / "data/faa/ad_nprm.xlsx")
data = [{"g": g, "wb": d.withdrawn_by.docket if d.withdrawn_by else None,
         "v": [{"d": v.docket, "a": v.action, "pub": str(v.publish_date) if v.publish_date else None,
                "due": str(v.comments_due) if v.comments_due else None, "fr": v.fr_citation, "pg": v.pages, "pc": v.page_count,
                "ln": v.link, "row": v.row, "sub": v.subject, "mk": v.make, "m": v.models, "mf": v.models_from, "sc": v.scope,
                "s": v.sentences, "ads": v.mentioned_ads, "adn": v.ad_number, "pt": v.product_type, "pst": v.product_subtype} for v in d.versions]} for g, d in D.items()]
(ROOT / "web/data.json").write_text(json.dumps(data, separators=(",", ":")))

S = ROOT / "torquestripe/static"
html = (S / "index.html").read_text()
b64 = lambda p, mime: f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
safe = lambda s: s.replace("</", "<\\/")
html = html.replace('<script src="/static/motion.js"></script>', "<script>" + (S / "motion.js").read_text() + "</script>")
html = html.replace('<script src="/static/stage.js"></script>', "<script>" + (S / "stage.js").read_text() + "</script>")
html = html.replace('src="/static/logo.svg"', f'src="{b64(S / "logo.svg", "image/svg+xml")}"')
html = html.replace('src="/static/creator.jpg"', f'src="{b64(S / "creator.jpg", "image/jpeg")}"')
html = html.replace('href="/static/favicon.svg"', f'href="{b64(S / "favicon.svg", "image/svg+xml")}"')
html = re.sub(r'\s*<link rel="icon" type="image/png"[^>]*>', "", html)
html = html.replace('href="/static/apple-touch-icon.png"', 'href="apple-touch-icon.png"').replace('content="/static/og.png"', 'content="og.png"')
payload = ("<script>window.TS_DATA=" + safe(json.dumps(data, separators=(",", ":"))) + ";window.TS_GOLD="
           + safe((ROOT / "eval/gold_faa.json").read_text()) + ";window.TS_KF=" + safe((ROOT / "eval/known_failures.json").read_text())
           + ";</script>\n<script>" + (ROOT / "web/engine.js").read_text() + "</script>\n<script>" + (ROOT / "web/shim.js").read_text() + "</script>\n")
marker = "<script>\nconst $ = s =>"
assert marker in html, "UI script marker not found"
html = html.replace(marker, payload + marker, 1)
out = ROOT / "web/dist"; out.mkdir(exist_ok=True)
(out / "index.html").write_text(html)
for f in ("og.png", "apple-touch-icon.png", "icon-512.png", "icon-64.png", "favicon.svg"):
    (out / f).write_bytes((S / f).read_bytes())
print(f"web/dist/index.html {len(html)/1e6:.2f} MB")

# Artifact variant: page content only (the host adds doctype/head/body), no analytics, side-gutter meta.
art = html
art = re.sub(r"<!doctype html>\s*<html[^>]*>\s*<head>\s*", "", art, flags=re.I)
art = re.sub(r'<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*', "", art)
art = art.replace("<title>Torque Stripe</title>", '<title>Torque Stripe</title>\n<meta name="claude:viewport-fit-sides" content="cover">', 1)
art = re.sub(r"<!-- Vercel Web Analytics.*?</script>\s*<script defer src=\"/_vercel/insights/script.js\"[^>]*></script>", "", art, flags=re.S)
art = re.sub(r'\s*<meta property="og:[^>]*>|\s*<meta name="twitter:[^>]*>|\s*<link rel="apple-touch-icon"[^>]*>', "", art)
art = re.sub(r"</head>\s*<body>", "", art, count=1)
art = re.sub(r"</body>\s*</html>\s*$", "", art.rstrip()) + "\n"
assert "<html" not in art[:500] and "<body" not in art and "insights" not in art
(out / "artifact.html").write_text(art)
print(f"web/dist/artifact.html {len(art)/1e6:.2f} MB")
