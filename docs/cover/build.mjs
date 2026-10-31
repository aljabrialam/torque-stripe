// Cover image: node docs/cover/build.mjs  ->  docs/cover/torque-stripe-cover.jpg (1920x1080) + -1280x640.jpg (GitHub social preview)
// Built from real app captures (app/film/plates, regenerate with app/scripts/capture.mjs) and the Torq mascot.
import { chromium } from '../../app/node_modules/@playwright/test/index.mjs'
import { mascotSvg } from '../../app/src/components/mascot.js'
import { writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(new URL('../..', import.meta.url).pathname), out = `${root}/docs/cover`
const F = `file://${root}/app/node_modules/@fontsource`, P = `file://${root}/app/film/plates`, B = `file://${root}/docs/brand`

const icon = d => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0085CA" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const FEATURES = [
  [icon('<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="m7.5 12 3 3 6-6"/>'), 'Rule-checked status', 'proposed, revised or withdrawn'],
  [icon('<path d="M2.5 13.5 21 8l-1.2 3.2-6.3 2.1-3 6.2H8.6l1.3-5.2-4.6 1.4-1.6 2H2.2l.9-3.3Z"/>'), 'Exact model filtering', 'AS350B listed, AS350B3 not'],
  [icon('<path d="M5 18c2.5-1 4-3 4-6V7H4v5h3M15 18c2.5-1 4-3 4-6V7h-5v5h3"/>'), 'Quoted, cited evidence', 'docket, FR page, sentence'],
  [icon('<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8"/>'), 'Refuses when unsure', 'and says why'],
  [icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>'), 'Signed PDF report', 'fingerprinted, engineer signs'],
  [icon('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'), 'Rendered 3D inspection', 'affected area shaded'],
]

function html(w, h, compact) {
  const s = compact ? 0.88 : 1
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: M; src: url(${F}/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2); }
* { box-sizing: border-box; margin: 0; }
body { width: ${w}px; height: ${h}px; overflow: hidden; position: relative; font-family: B, sans-serif; color: #0b1f45;
  background: radial-gradient(55% 50% at 78% 8%, #fff, transparent 70%), radial-gradient(40% 35% at 8% 10%, rgba(255,255,255,.75), transparent 70%),
  radial-gradient(70% 55% at 70% 115%, rgba(0,133,202,.22), transparent 70%), linear-gradient(180deg, #cadcf0 0%, #e2ecf7 42%, #eef3f9 75%, #e3ebf5 100%); }
.grid { position: absolute; inset: 0; opacity: .5; background-image: linear-gradient(rgba(0,32,91,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,32,91,.05) 1px, transparent 1px);
  background-size: 48px 48px; mask-image: radial-gradient(70% 70% at 70% 60%, #000, transparent 75%); }
.left { position: absolute; left: ${86 * s}px; top: ${compact ? 52 : 74}px; width: ${760 * s}px; display: flex; flex-direction: column; gap: ${22 * s}px; }
.k { font-family: C; font-weight: 500; font-size: ${22 * s}px; letter-spacing: .16em; text-transform: uppercase; color: #0085ca; }
h1 { font-family: C; font-weight: 600; font-size: ${compact ? 78 : 96}px; line-height: .96; letter-spacing: -.012em; color: #00205b; }
h1 em { font-style: normal; color: #0085ca; }
.lede { font-size: ${24 * s}px; line-height: 1.4; color: #3c4f72; max-width: ${700 * s}px; }
.feats { display: grid; grid-template-columns: 1fr 1fr; gap: ${12 * s}px; margin-top: 4px; }
.f { display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: center; padding: ${compact ? 10 : 14}px 16px; border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.55)); border: 1px solid #fff; box-shadow: inset 0 1px 0 #fff, 0 16px 40px -22px rgba(0,32,91,.35); }
.f i { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: rgba(0,133,202,.1); }
.f b { display: block; font-size: ${20 * s}px; font-weight: 600; color: #00205b; } .f span { font-size: ${15.5 * s}px; color: #6d7d98; }
.stats { display: flex; gap: ${36 * s}px; margin-top: ${6 * s}px; }
.stats div { font-family: C; font-weight: 600; font-size: ${54 * s}px; color: #00205b; line-height: .9; }
.stats small { font-size: .42em; color: #3c4f72; font-weight: 500; }
.stats span { display: block; font-family: B; font-size: ${15 * s}px; font-weight: 500; color: #3c4f72; margin-top: 6px; }
.shot { position: absolute; border-radius: 18px; border: 2px solid #fff; box-shadow: 0 60px 120px -40px rgba(0,32,91,.55), 0 0 0 1px rgba(0,32,91,.06); }
.console { left: ${compact ? 860 : 900}px; top: ${compact ? 120 : 150}px; width: ${compact ? 1000 : 1080}px; transform: perspective(2200px) rotateY(-11deg) rotateX(2deg); transform-origin: left center; }
.report { left: ${compact ? 1520 : 1600}px; top: ${compact ? 470 : 560}px; width: ${compact ? 300 : 330}px; height: ${compact ? 360 : 420}px; object-fit: cover; object-position: top; border-radius: 10px; transform: rotate(4deg); }
.evalc { left: ${compact ? 1090 : 1150}px; top: ${compact ? 780 : 880}px; width: ${compact ? 560 : 640}px; border-radius: 12px; transform: rotate(-1.5deg); }
.torq { position: absolute; left: ${compact ? 800 : 846}px; top: ${compact ? 600 : 712}px; filter: drop-shadow(0 18px 24px rgba(0,32,91,.25)); }
.bubble { position: absolute; left: ${compact ? 960 : 1030}px; top: ${compact ? 640 : 760}px; padding: 10px 16px; border-radius: 16px 16px 16px 4px; z-index: 3; background: #00205b; color: #fff; font-size: 18px; font-weight: 600; box-shadow: 0 14px 30px -14px rgba(0,32,91,.6); }
.foot { position: absolute; left: ${86 * s}px; right: 86px; bottom: ${compact ? 40 : 56}px; display: flex; align-items: center; gap: 28px; }
.me { display: flex; align-items: center; gap: 12px; }
.me img { width: ${52 * s}px; height: ${52 * s}px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 8px 20px -8px rgba(0,32,91,.45); }
.me b { display: block; color: #00205b; font-size: ${18 * s}px; } .me span { color: #3c4f72; font-size: ${15 * s}px; }
.url { font-family: M; font-size: ${17 * s}px; color: #0085ca; }
.disc { font-size: ${13 * s}px; color: #6d7d98; }
</style></head><body>
<div class="grid"></div>
<img class="shot console" src="${P}/servo-console.jpg">
<img class="shot report" src="${P}/report-top.jpg">
<img class="shot evalc" src="${P}/eval-metrics.jpg">
<div class="bubble">Checked by rules. Quoted from the notice.</div>
<div class="torq">${mascotSvg('point', { size: compact ? 180 : 210 })}</div>
<div class="left">
  <img src="${B}/cobrand-light-compact.svg" style="height:${50 * s}px;width:auto;align-self:flex-start">
  <div class="k">Airbus Challenge #4 · Autonomous SG 2026</div>
  <h1>Cited answers about FAA proposed ADs, <em>or a clear refusal.</em></h1>
  ${compact ? '' : '<p class="lede">A licensed engineer asks about their aircraft. Rules check the docket, its revisions and the model list, then quote the Federal Register word for word.</p>'}
  <div class="feats">${FEATURES.map(([ic, t, d]) => `<div class="f"><i>${ic}</i><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
  <div class="stats">
    <div>42<small>/42</small><span>real questions correct</span></div>
    <div>0<small>/16</small><span>unsafe answers</span></div>
    <div>6<small>/6</small><span>withdrawals flagged</span></div>
  </div>
</div>
<div class="foot">
  <div class="me"><img src="${B}/creator.jpg"><div><b>Aljabri Alam</b><span>Technical Lead & AI Advocate</span></div></div>
  <div><span class="url">torque-stripe.vercel.app</span><div class="disc" style="margin-top:4px">The AI reads. The rules decide. The engineer signs. · Not an official Airbus product.</div></div>
</div>
</body></html>`
}

const b = await chromium.launch()
for (const [name, w, h, ow, oh, compact] of [['torque-stripe-cover', 1920, 1080, 1920, 1080, false], ['torque-stripe-cover-1280x640', 1920, 960, 1280, 640, true]]) {
  writeFileSync(`${out}/${name}.html`, html(w, h, compact))
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: ow / w })
  await p.goto(`file://${out}/${name}.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 94 })
  await p.close()
  console.log(name, `${ow}x${oh}`, `${(statSync(`${out}/${name}.jpg`).size / 1024).toFixed(0)} KB`)
}
await b.close()
