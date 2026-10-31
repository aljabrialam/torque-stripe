"""End-to-end UI test (Playwright). Run with the server up:
    uvicorn torquestripe.api:app --port 8000 &
    python3 tests/e2e.py http://localhost:8000
Checks every demo path, the tour, Fleet, Evaluation, mobile layout and console errors."""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CASES = [  # (model, question, expected pill text, expected headline fragment)
    ("AS350B3", "main rotor servo-control torque inspection", "Answered", "Proposed for all AS350B3 units"),
    ("AS350B", "What does FAA-2026-11800 require?", "Answered", "Proposed for all AS350B units"),
    ("AS350B3", "What does FAA-2026-11800 require?", "Not applicable", "is not covered"),
    ("", "Status of FAA-2026-1338", "Answered", "About FAA-2026-1338"),
    ("", "Is FAA-2013-0541 still active?", "Answered", "was withdrawn"),
    ("", "Does FAA-2026-1335 apply to my 787?", "Needs input", "Which 787 variant?"),
    ("", "Why was FAA-2026-11814 withdrawn?", "Refused", "can't answer"),
    ("", "What is the torque for the A380-841 landing gear?", "Refused", "can't answer"),
    ("A330-941", "Any proposed ADs for A330-941?", "Answered", "proposals list A330-941"),
    ("AS350B3", "When must the MR servo-control inspection be completed?", "Refused", "can't answer"),
]

async def main():
    fails, errors = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1360, "height": 900})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "insights" not in m.text and "Failed to load resource" not in m.text else None)
        await pg.goto(BASE + "/")
        # tour opens on first visit
        await pg.wait_for_selector("#tour:not([hidden])", timeout=4000)
        for _ in range(12):
            if await pg.locator("#tour").is_hidden(): break
            await pg.click("#tournext"); await pg.wait_for_timeout(250)
        if not await pg.locator("#tour").is_hidden(): fails.append("tour did not close")
        await pg.reload(); await pg.wait_for_timeout(700)
        if not await pg.locator("#tour").is_hidden(): fails.append("tour reopened after finishing")
        for model, q, pill, head in CASES:
            await pg.fill("#model", model); await pg.fill("#q", q); await pg.click(".go")
            await pg.wait_for_selector("#answer .headline", timeout=5000); await pg.wait_for_timeout(250)
            got_pill = await pg.inner_text("#answer .pill"); got_head = await pg.inner_text("#answer .headline")
            ok = got_pill.startswith(pill) and head in got_head
            print(("PASS" if ok else "FAIL"), "|", model or "-", "|", q, "->", got_pill, "/", got_head)
            if not ok: fails.append(q)
        # variant buttons
        await pg.fill("#model", ""); await pg.fill("#q", "Does FAA-2026-1335 apply to my 787?"); await pg.click(".go"); await pg.wait_for_timeout(500)
        await pg.click("[data-variant='787-9']"); await pg.wait_for_timeout(700)
        h = await pg.inner_text("#answer .headline")
        print("PASS" if "787-9 is listed" in h else "FAIL", "| variant button ->", h)
        if "787-9 is listed" not in h: fails.append("variant button")
        # citation opens source with highlight
        await pg.click("#answer .cite >> nth=0"); await pg.wait_for_timeout(500)
        if not await pg.locator("#src .ss.on").count(): fails.append("citation highlight")
        # fleet
        await pg.click('.tab[data-view="fleet"]'); await pg.click("#ff .go"); await pg.wait_for_selector("#fleetout .fcard", timeout=5000)
        n = await pg.locator("#fleetout .fcard").count(); print("PASS" if n == 5 else "FAIL", "| fleet cards", n)
        if n != 5: fails.append("fleet")
        # evaluation
        await pg.click('.tab[data-view="eval"]'); await pg.wait_for_selector("#evalhead .metric", timeout=15000)
        v = await pg.inner_text("#evalhead .metric >> nth=0")
        print("PASS" if "42/42" in v else "FAIL", "| eval", v.replace("\n", " "))
        if "42/42" not in v: fails.append("eval")
        # insights: charts render, maker filter works, table toggle
        await pg.click('.tab[data-view="insights"]'); await pg.wait_for_selector("#ch-makers .hbar", timeout=5000)
        before = await pg.inner_text("#ins-count"); await pg.click("#ch-makers .hbar >> nth=0"); await pg.wait_for_timeout(300)
        after = await pg.inner_text("#ins-count"); ok = before != after and "of 323" in after
        print("PASS" if ok else "FAIL", "| insights filter", before, "->", after)
        if not ok: fails.append("insights filter")
        await pg.click("#if-table"); n = await pg.locator("#land-table tr").count(); print("PASS" if n > 5 else "FAIL", "| insights table rows", n)
        if n <= 5: fails.append("insights table")
        cov = await pg.inner_text("#ch-cov"); print("PASS" if "No model list" in cov else "FAIL", "| coverage chart")
        await pg.click('.tab[data-view="ask"]')
        # mobile: no horizontal scroll
        m = await b.new_page(viewport={"width": 390, "height": 844}); await m.goto(BASE + "/?notour")
        await m.fill("#q", "Is FAA-2013-0541 still active?"); await m.click(".go"); await m.wait_for_timeout(600)
        sw = await m.evaluate("document.documentElement.scrollWidth"); print("PASS" if sw <= 392 else "FAIL", "| mobile width ask", sw)
        if sw > 392: fails.append("mobile overflow")
        for view in ("insights", "fleet", "eval"):
            await m.click(f'.tab[data-view="{view}"]'); await m.wait_for_timeout(900)
            sw = await m.evaluate("document.documentElement.scrollWidth"); print("PASS" if sw <= 392 else "FAIL", f"| mobile width {view}", sw)
            if sw > 392: fails.append(f"mobile overflow {view}")
        await b.close()
    print("\nconsole/page errors:", errors or "none")
    print("RESULT:", "ALL PASS" if not fails and not errors else f"FAILED {fails} {errors}")
    sys.exit(1 if fails or errors else 0)

asyncio.run(main())
