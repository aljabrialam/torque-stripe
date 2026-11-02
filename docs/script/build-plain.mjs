// Read-aloud script, two parts only: "In plain words" and "Our solution". Run from the repo root: node docs/script/build-plain.mjs
import { chromium } from '../../app/node_modules/@playwright/test/index.mjs'
import { writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(new URL('../..', import.meta.url).pathname), out = `${root}/docs/script`
const F = `file://${root}/app/node_modules/@fontsource`, B = `file://${root}/docs/brand`

const PARTS = [
  ['1', 'In plain words', 'The problem, for anyone outside aviation', [
    ['Think of a car recall, but for aircraft.', true],
    ['When a safety problem is found on a type of aircraft or engine, the US aviation regulator, the FAA, issues an order to inspect it or fix it. That order is called an Airworthiness Directive.'],
    ['Before the order becomes final, the FAA publishes it as a proposal, so airlines and manufacturers can comment. And proposals change. Some are rewritten. Some replace older orders. Some are cancelled years later.'],
    ['Aircraft maintenance engineers have to keep track of all of this for the aircraft they look after. Today that means reading government notices one by one. In our data alone that is 431 notices and about 1,300 pages.'],
    ['Three things make it harder than it sounds.', true],
    ['First, a cancellation is published as a separate notice, so you can read the original and never see that it was called off.'],
    ['Second, every notice names exact models. An A350-941 is not "any A350", the same way a recall for one phone model does not cover the one next to it.'],
    ['Third, some notices cover only certain aircraft, by serial number, and that list is not in the summary.'],
    ['Now imagine asking a normal AI chatbot.', true],
    ['It sounds sure of itself even when it is guessing. It might tell an engineer to inspect a part for a proposal that was cancelled. It might say a notice applies because the name looks similar. It might make up a number it has never seen.'],
    ['In a hangar, a wrong answer means an unnecessary repair, or a missed safety check.'],
  ]],
  ['2', 'Our solution', 'Torque Stripe', [
    ['So we built Torque Stripe.', true],
    ['You enter your aircraft model and ask a question in plain words. Torque Stripe then does four things.'],
    ['One, it finds the right notice and checks its latest version: still proposed, changed, or cancelled.', false, 'step'],
    ['Two, it checks whether your exact model is on the list.', false, 'step'],
    ['Three, it answers by quoting the notice word for word, with the page it came from.', false, 'step'],
    ['Four, when it cannot be sure, it says so plainly instead of guessing.', false, 'step'],
    ['The checking is done by fixed rules written in code, not by AI judgement. AI can help put the answer into clearer words, but every sentence is checked against the original notice. And the engineer makes the final call: every answer can be exported as a PDF report for them to review and sign.'],
    ['We tested it on 42 real questions. It got all 42 right, with zero unsafe answers.'],
    ['Why the name? A torque stripe is the line of paint a mechanic draws across a bolt once it has been tightened and checked. If that line is ever broken, someone knows to stop and look.'],
    ['Torque Stripe aims to be that mark for answers: checked, traceable, and clear about when to stop.'],
    ['The AI reads. The rules decide. The engineer signs.', true, 'close'],
  ]],
]
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const words = PARTS.flatMap(p => p[3].map(l => l[0])).join(' ').split(/\s+/).length
const mins = (words / 140).toFixed(1)

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); }
@page { size: A4; margin: 16mm 18mm 16mm; }
* { box-sizing: border-box; margin: 0; } body { font-family: B, sans-serif; color: #0b1f45; }
header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #00205b; padding-bottom: 8px; margin-bottom: 14px; }
header img { height: 28px; } header span { font-size: 9pt; color: #3c4f72; text-align: right; }
.part { page-break-inside: auto; margin-bottom: 18px; }
.ph { display: flex; align-items: baseline; gap: 12px; margin: 6px 0 10px; }
.ph .n { font-family: C; font-size: 15pt; color: #fff; background: #0085ca; border-radius: 8px; padding: 1px 10px; }
.ph h1 { font-family: C; font-size: 24pt; color: #00205b; line-height: 1; }
.ph small { font-size: 10pt; color: #6d7d98; }
p { font-size: 13.5pt; line-height: 1.5; margin: 0 0 9px; page-break-inside: avoid; }
p.lead { font-weight: 600; color: #00205b; margin-top: 12px; }
p.step { margin-left: 18px; padding-left: 12px; border-left: 3px solid #0085ca; }
p.close { font-family: C; font-size: 18pt; color: #0085ca; margin-top: 14px; }
.pb { page-break-before: always; }
.foot { margin-top: 16px; font-size: 8.5pt; color: #6d7d98; border-top: 1px solid #dbe5f1; padding-top: 6px; }
</style></head><body>
<header><img src="${B}/cobrand-light-compact.svg"><span>Read-aloud script · about ${mins} minutes at a calm pace</span></header>
${PARTS.map(([n, title, sub, lines], i) => `<section class="part${i ? ' pb' : ''}">
  <div class="ph"><span class="n">${n}</span><h1>${esc(title)}</h1><small>${esc(sub)}</small></div>
  ${lines.map(([t, lead, cls]) => `<p class="${[lead && 'lead', cls].filter(Boolean).join(' ')}">${esc(t)}</p>`).join('')}
</section>`).join('')}
<p class="foot">Torque Stripe · torque-stripe.vercel.app · Built for Airbus Challenge #4 at Autonomous SG 2026 by Aljabri Alam. Not an official Airbus or FAA product.</p>
</body></html>`

writeFileSync(`${out}/torque-stripe-plain-script.html`, html)
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`file://${out}/torque-stripe-plain-script.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400)
await p.pdf({ path: `${out}/torque-stripe-plain-script.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
await p.setViewportSize({ width: 794, height: 1123 }); await p.screenshot({ path: '/tmp/ts-shots/plain.png', fullPage: true })
await b.close()
console.log(`${words} words, ~${mins} min, ${(statSync(`${out}/torque-stripe-plain-script.pdf`).size / 1024).toFixed(0)} KB`)
