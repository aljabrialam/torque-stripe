// Demo script PDF (plain-language pitch + live demo). Run from the repo root: node docs/script/build.mjs
import { chromium } from '../../app/node_modules/@playwright/test/index.mjs'
import { writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(new URL('../..', import.meta.url).pathname), out = `${root}/docs/script`
const F = `file://${root}/app/node_modules/@fontsource`, B = `file://${root}/docs/brand`, Q = `file://${root}/docs/qr`

// [time, section, say (spoken, plain words), show (what to click / point at)]
const BEATS = [
  ['0:00', 'Hook', [
    'Think of a car recall, but for aircraft.',
    'When a safety problem is found, the US aviation regulator, the FAA, orders airlines to inspect or fix it. That order is called an Airworthiness Directive.',
    'Before it becomes final, it is published as a proposal. And proposals change: some are rewritten, some replace older orders, some are cancelled years later.'],
    ['App open on the Ask screen. Torq is waving on the welcome card.', 'Point at the header: 431 notices, 1,302 pages.']],
  ['0:25', 'The problem', [
    'An aircraft engineer has to know which of these apply to the aircraft in front of them. Today that means reading government notices one by one. Hundreds of them, thousands of pages.',
    'Three things make it hard. A cancellation is a separate notice from the original. Each notice names exact models: an A350-941 is not "any A350". And some cover only certain serial numbers that are not in the summary.'],
    ['Stay on the Ask screen.', 'Optional: open the model dropdown to show the 769 models.']],
  ['0:50', 'Why not a chatbot?', [
    'A normal AI chatbot sounds sure of itself even when it is guessing. It might tell an engineer to inspect a part for a proposal that was cancelled, or say a notice applies because the name looks similar.',
    'In a hangar, a wrong answer means an unnecessary repair, or a missed safety check.'],
    ['No clicks. Look at the judges.']],
  ['1:05', 'Our solution', [
    'So we built Torque Stripe. The rule is simple: the AI reads, the rules decide, the engineer signs.',
    'Every safety decision is made by fixed rules in code. The answer quotes the official notice word for word, with the page it came from. And when it cannot be sure, it says so.'],
    ['Click the demo chip "AS350B3 · main rotor servo-control torque inspection".']],
  ['1:20', 'Demo 1 · Answered, with sources', [
    'I set my helicopter, an AS350B3, and ask in plain words.',
    'It found the notice, checked it is the latest version, checked my model is listed, and every line here is quoted from the notice. This chip takes me to the exact sentence and page.'],
    ['Point at Rule checks (all green) and the Proposal panel: proposed, not binding, 33 days left to comment.', 'Click a blue S citation; the source sentence highlights.']],
  ['1:40', 'Demo 2 · Exact model', [
    'Now the same notice, for two models one letter apart.',
    'For the AS350B it applies. For the AS350B3 it says: not applicable, and shows the models that are listed. No "close enough".'],
    ['Click chip "AS350B · What does FAA-2026-11800 require?"', 'Then chip "AS350B3 · What does FAA-2026-11800 require?"']],
  ['1:55', 'Demo 3 · Latest version', [
    'Is this older proposal still active? No. It was withdrawn, so it imposes nothing. A chatbot reading only the original would not know that.'],
    ['Click chip "Is FAA-2013-0541 still active?"', 'Point at the version timeline: two versions, the latest is the withdrawal.']],
  ['2:10', 'Demo 4 · Says when it is unsure', [
    'If I ask about "my 787", that is ambiguous, so it asks which variant instead of guessing.',
    'And if I ask for a torque value for the A380 landing gear, that is not in these notices, so it refuses and tells me why.'],
    ['Click chip "Does FAA-2026-1335 apply to my 787?" and show the variant buttons.', 'Click chip "A380-841 landing gear torque" and show the Refused card.']],
  ['2:30', 'Proof', [
    'We tested it on 42 real questions. It got all 42 right and gave zero unsafe answers. A plain search tool answered all 16 of the questions it should have refused.',
    'And every answer can be exported as a PDF report for the engineer to review and sign.'],
    ['Click the Evaluation tab: 42/42, 0/16, 6/6.', 'Optional: back on Ask, click Export PDF.']],
  ['2:50', 'Close', [
    'A torque stripe is the paint line a mechanic draws across a bolt once it is checked. If the line breaks, you stop and look.',
    'Torque Stripe does that for answers. The AI reads. The rules decide. The engineer signs. Thank you.'],
    ['Leave the app on screen, or show the QR codes on the last page of this script.']],
]
const QA = [
  ['Is this using AI?', 'Yes, but only to reword answers. Which notice, which version, whether your model is covered, and when to refuse are all fixed rules. Every reworded sentence is checked against the source, and if it fails, the original text is shown.'],
  ['What about serial numbers?', 'The FAA summaries in this dataset do not list serial numbers, so for "certain units" it says it cannot confirm and links the official page. Our sample engine shows serial ranges working as rules on labelled sample documents. In production we would read the full notices.'],
  ['How fast is it?', 'About a tenth of a millisecond per question on average across 1,302 pages, and under 10 milliseconds at worst. The brief asked for under 3 seconds.'],
  ['Is this an Airbus product?', 'No. It was built for Airbus Challenge #4 at Autonomous SG 2026. It is not an official Airbus or FAA product.'],
  ['What would production need?', 'Company sign-in with roles, a daily sync of new FAA and EASA notices, the rules engine as a hosted service, signed reports stored in a tamper-proof audit log, and the 42-question test as a release gate.'],
]
const CHECK = ['Open torque-stripe.vercel.app in a full-screen browser window (it runs in the browser, no server needed).', 'Close the guided tour, or keep it for the first 10 seconds if time allows.', 'Model field set to AS350B3.', 'Zoom the browser so the demo chips are readable from the back of the room.', 'Have the demo video ready as a backup: youtu.be/rkj4_BeG5zw.']

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); }
@font-face { font-family: M; src: url(${F}/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2); }
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; margin: 0; } body { font-family: B, sans-serif; color: #0b1f45; font-size: 11pt; line-height: 1.45; }
header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00205b; padding-bottom: 8px; }
header img { height: 30px; } header .r { text-align: right; font-size: 9pt; color: #3c4f72; }
h1 { font-family: C; font-size: 30pt; color: #00205b; line-height: 1; margin: 14px 0 4px; }
.lede { color: #3c4f72; font-size: 10.5pt; margin-bottom: 10px; }
.legend { display: flex; gap: 18px; font-size: 9pt; color: #3c4f72; margin-bottom: 8px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
.beat { display: grid; grid-template-columns: 52px 1fr 190px; gap: 12px; padding: 9px 0; border-top: 1px solid #dbe5f1; page-break-inside: avoid; }
.t { font-family: M; font-size: 10pt; color: #0085ca; padding-top: 2px; }
.sec { font-family: C; font-size: 12.5pt; color: #00205b; letter-spacing: .02em; margin-bottom: 3px; }
.say p { margin: 0 0 5px; font-size: 11.5pt; }
.show { background: #eef4fb; border-left: 3px solid #0085ca; border-radius: 4px; padding: 6px 8px; font-size: 8.8pt; color: #3c4f72; align-self: start; }
.show div + div { margin-top: 4px; }
h2 { font-family: C; font-size: 16pt; color: #00205b; margin: 18px 0 6px; padding-top: 4px; }
.qa { page-break-inside: avoid; padding: 6px 0; border-top: 1px solid #dbe5f1; } .qa b { color: #00205b; } .qa p { font-size: 10pt; color: #3c4f72; margin-top: 2px; }
ul { padding-left: 18px; font-size: 10pt; color: #3c4f72; } li { margin: 2px 0; }
.qrs { display: flex; gap: 28px; margin-top: 10px; page-break-inside: avoid; } .qrs div { text-align: center; font-size: 9pt; color: #3c4f72; } .qrs img { width: 110px; display: block; margin: 0 auto 4px; }
.qrs b { display: block; color: #00205b; font-size: 10pt; }
.foot { margin-top: 14px; font-size: 8pt; color: #6d7d98; }
.pb { page-break-before: always; }
</style></head><body>
<header><img src="${B}/cobrand-light-compact.svg"><div class="r">Demo script · about 3 minutes<br>torque-stripe.vercel.app</div></header>
<h1>Torque Stripe: the 3-minute demo</h1>
<p class="lede">Read the left column out loud. The blue boxes say what to click or point at in the live app. Times are a guide; skip anything marked optional if you are running long.</p>
<div class="legend"><span><i style="background:#0b1f45"></i>Say</span><span><i style="background:#0085ca"></i>Show or click</span></div>
${BEATS.map(([t, sec, say, show]) => `<div class="beat"><div class="t">${t}</div><div class="say"><div class="sec">${esc(sec)}</div>${say.map(s => `<p>${esc(s)}</p>`).join('')}</div><div class="show">${show.map(s => `<div>${esc(s)}</div>`).join('')}</div></div>`).join('')}
<h2 class="pb">If judges ask</h2>
${QA.map(([q, a]) => `<div class="qa"><b>${esc(q)}</b><p>${esc(a)}</p></div>`).join('')}
<h2>Before you start</h2>
<ul>${CHECK.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
<h2>Share</h2>
<div class="qrs">
  <div><img src="${Q}/qr-live-app.png"><b>Live app</b>torque-stripe.vercel.app</div>
  <div><img src="${Q}/qr-demo-video.png"><b>Demo video</b>youtu.be/rkj4_BeG5zw</div>
</div>
<p class="foot">Built for Airbus Challenge #4 at Autonomous SG 2026 by Aljabri Alam. Not an official Airbus or FAA product. Figures are from the live evaluation on the real FAA dataset (42 questions, 431 notices, 1,302 Federal Register pages).</p>
</body></html>`

writeFileSync(`${out}/torque-stripe-demo-script.html`, html)
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`file://${out}/torque-stripe-demo-script.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400)
await p.pdf({ path: `${out}/torque-stripe-demo-script.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: '/tmp/ts-shots/script.png', fullPage: true })
await b.close()
console.log('pdf', (statSync(`${out}/torque-stripe-demo-script.pdf`).size / 1024).toFixed(0), 'KB')
