// Social graphics: HTML sources + PNG exports. Run from the repo root: node docs/social/build.mjs
// Uses real app captures from app/film/plates (regenerate with app/scripts/capture.mjs).
import { chromium } from '../../app/node_modules/@playwright/test/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(new URL('../..', import.meta.url).pathname), out = `${root}/docs/social`
mkdirSync(out, { recursive: true })
const F = `file://${root}/app/node_modules/@fontsource`, P = `file://${root}/app/film/plates`, B = `file://${root}/docs/brand`
const HEX = '49.32,42 32,52 14.68,42 14.68,22 32,12 49.32,22'
const mark = (s, edge = '#fff') => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><defs><clipPath id="c${s}"><polygon points="${HEX}"/></clipPath></defs><rect x="28" y="3" width="8" height="58" rx="1.2" fill="#0085CA" transform="rotate(32 32 32)"/><polygon points="${HEX}" fill="#00205B"/><g clip-path="url(#c${s})"><rect x="28" y="3" width="8" height="58" rx="1.2" fill="#0085CA" transform="rotate(32 32 32)"/></g><polygon points="${HEX}" fill="none" stroke="${edge}" stroke-width="3.2" stroke-linejoin="round"/></svg>`

const css = `
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-400-normal.woff2); font-weight: 400; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: M; src: url(${F}/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2); }
* { box-sizing: border-box; margin: 0; }
body { width: var(--w); height: var(--h); overflow: hidden; font-family: B, sans-serif; color: #0b1f45;
  background: radial-gradient(60% 40% at 82% 6%, #fff, transparent 70%), radial-gradient(50% 30% at 10% 16%, rgba(255,255,255,.7), transparent 70%),
  radial-gradient(90% 50% at 50% 112%, rgba(0,133,202,.18), transparent 70%), linear-gradient(180deg, #cfe0f2 0%, #e4edf7 40%, #eef3f9 72%, #e3ebf5 100%); }
.glass { background: linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.45)); border: 1px solid rgba(255,255,255,.9); border-radius: 22px;
  box-shadow: inset 0 1px 0 #fff, 0 30px 70px -30px rgba(0,32,91,.35); backdrop-filter: blur(20px); }
.k { font-family: C; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: #0085ca; }
h1 { font-family: C; font-weight: 600; line-height: .98; letter-spacing: -.01em; color: #00205b; }
.lede { color: #3c4f72; }
.shot { display: block; border-radius: 16px; border: 1px solid #fff; box-shadow: 0 40px 90px -30px rgba(0,32,91,.5), 0 0 0 1px rgba(0,32,91,.06); }
.num { font-family: C; font-weight: 600; color: #00205b; line-height: .9; }
.num small { font-size: .45em; color: #3c4f72; font-weight: 500; }
.lab { color: #3c4f72; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand b { font-family: C; font-weight: 600; letter-spacing: .04em; color: #00205b; }
.brand b span { color: #0085ca; }
.me { display: flex; align-items: center; gap: 12px; }
.me img { border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 8px 20px -8px rgba(0,32,91,.45); }
.me b { display: block; color: #00205b; }
.me span { color: #3c4f72; }
.mono { font-family: M; }
`
const page = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${w}"><style>:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`
const footer = (size = 1) => `
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><img src="${B}/cobrand-light-compact.svg" style="height:${44 * size}px;display:block"><div class="lab" style="font-size:${14 * size}px;margin:6px 0 0 ${52 * size}px">Not an official Airbus product</div></div>
    <div class="me"><img src="${B}/creator.jpg" width="${56 * size}" height="${56 * size}"><div style="font-size:${18 * size}px"><b>Aljabri Alam</b><span>Autonomous SG 2026 · Airbus Challenge 4</span></div></div>
  </div>`

const G = {
  // 1. LinkedIn / Instagram portrait: the product in one frame
  'torque-stripe-portrait-1080x1350': [1080, 1350, `
  <div style="padding:64px 64px 56px;height:100%;display:flex;flex-direction:column;gap:30px">
    <div class="k" style="font-size:24px">FAA proposed airworthiness directives</div>
    <h1 style="font-size:92px">Cited answers,<br>or a clear refusal.</h1>
    <p class="lede" style="font-size:28px;line-height:1.35;max-width:880px">An engineer asks about their aircraft. Rules check the docket, its revisions and the model list, then quote the notice word for word.</p>
    <img class="shot" src="${P}/servo-console.jpg" style="width:952px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div class="glass" style="padding:22px 24px"><div class="num" style="font-size:64px">42<small>/42</small></div><div class="lab" style="font-size:20px;margin-top:8px">real questions correct</div></div>
      <div class="glass" style="padding:22px 24px"><div class="num" style="font-size:64px">0<small>/16</small></div><div class="lab" style="font-size:20px;margin-top:8px">unsafe answers</div></div>
      <div class="glass" style="padding:22px 24px"><div class="num" style="font-size:64px">6<small>/6</small></div><div class="lab" style="font-size:20px;margin-top:8px">withdrawals flagged</div></div>
    </div>
    <div style="flex:1"></div>${footer()}
  </div>`],

  // 2. Square: the result, against a plain search baseline
  'torque-stripe-results-1080x1080': [1080, 1080, `
  <div style="padding:64px;height:100%;display:flex;flex-direction:column;gap:28px">
    <div class="k" style="font-size:24px">We measured it</div>
    <h1 style="font-size:84px">Rules beat search where it matters.</h1>
    <div class="glass" style="padding:34px 36px;display:grid;gap:30px">
      ${[['Fully correct', 42, 42, 5, 42, false], ['Unsafe answers', 0, 16, 16, 16, true], ['Withdrawals flagged', 6, 6, 0, 6, false]].map(([l, a, n, b, m, low]) => `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:28px;font-weight:600">${l}</span><span class="lab" style="font-size:20px">${low ? 'lower is better' : 'higher is better'}</span></div>
        <div style="display:grid;grid-template-columns:230px 1fr 110px;gap:16px;align-items:center;margin-top:14px;font-size:22px">
          <span>Torque Stripe</span><span style="height:16px;border-radius:9px;background:rgba(0,32,91,.08);overflow:hidden"><i style="display:block;height:100%;width:${Math.max(a / n * 100, 1.5)}%;background:${low ? '#138a52' : '#0085ca'};border-radius:9px"></i></span><b class="num" style="font-size:40px;text-align:right">${a}<small>/${n}</small></b>
          <span class="lab">Search baseline</span><span style="height:16px;border-radius:9px;background:rgba(0,32,91,.08);overflow:hidden"><i style="display:block;height:100%;width:${Math.max(b / m * 100, 1.5)}%;background:${low ? '#d1352b' : '#9fb3cf'};border-radius:9px"></i></span><b class="num" style="font-size:40px;text-align:right;color:#6d7d98">${b}<small>/${m}</small></b>
        </div>
      </div>`).join('')}
    </div>
    <p class="lab" style="font-size:19px">42 questions on 431 real FAA notices (1,302 Federal Register pages). The baseline gets exact docket lookup and the same search, but no rules.</p>
    <div style="flex:1"></div>${footer()}
  </div>`],

  // 3. Landscape for X / LinkedIn link posts
  'torque-stripe-landscape-1600x900': [1600, 900, `
  <div style="padding:70px 72px;height:100%;display:grid;grid-template-columns:560px 1fr;gap:56px;align-items:center">
    <div style="display:flex;flex-direction:column;gap:26px;height:100%">
      <div><img src="${B}/cobrand-light-compact.svg" style="height:58px;display:block"><div class="lab" style="font-size:16px;margin:6px 0 0 68px">Built for Airbus Challenge #4. Not an official Airbus product.</div></div>
      <h1 style="font-size:92px">The AI reads.<br>The rules decide.<br>The engineer signs.</h1>
      <p class="lede" style="font-size:26px;line-height:1.35">Cited, model-checked, revision-aware answers about FAA proposed ADs. Every safety decision is a rule, not a model's guess.</p>
      <div style="flex:1"></div>
      <div class="me"><img src="${B}/creator.jpg" width="60" height="60"><div style="font-size:19px"><b>Aljabri Alam</b><span class="mono" style="font-size:16px">torque-stripe.vercel.app</span></div></div>
    </div>
    <img class="shot" src="${P}/servo-console.jpg" style="width:900px;transform:perspective(1800px) rotateY(-9deg);transform-origin:left center">
  </div>`],

  // 4. Portrait: the signed report
  'torque-stripe-report-1080x1350': [1080, 1350, `
  <div style="padding:64px 64px 56px;height:100%;display:flex;flex-direction:column;gap:28px">
    <div class="k" style="font-size:24px">The engineer signs</div>
    <h1 style="font-size:88px">Every answer becomes a report you can file.</h1>
    <div style="position:relative;height:720px">
      <img class="shot" src="${P}/report-top.jpg" style="position:absolute;left:10px;top:10px;width:520px;transform:rotate(-3deg)">
      <img class="shot" src="${P}/report-bottom.jpg" style="position:absolute;right:10px;top:50px;width:520px;transform:rotate(2.5deg)">
    </div>
    <div style="display:flex;gap:10px;flex-wrap:nowrap;font-size:19px;white-space:nowrap">
      ${['Verdict and rule checks', 'Quoted evidence, cited to the page', 'SHA-256 fingerprint', 'Sign-off block'].map(x => `<span class="glass" style="padding:10px 18px;border-radius:999px">${x}</span>`).join('')}
    </div>
    <div style="flex:1"></div>${footer()}
  </div>`],
}

const b = await chromium.launch()
for (const [name, [w, h, body]] of Object.entries(G)) {
  writeFileSync(`${out}/${name}.html`, page(w, h, body))
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto(`file://${out}/${name}.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300)
  const over = await p.evaluate(() => document.body.scrollHeight > innerHeight + 1 || document.body.scrollWidth > innerWidth + 1)
  await p.screenshot({ path: `${out}/${name}.png` }); await p.close()
  console.log(name, over ? 'OVERFLOW' : 'ok')
}
await b.close()
