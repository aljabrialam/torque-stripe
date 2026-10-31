// Proof plates for the brief video, rendered from real engine output:
//   json-response.jpg : the structured /ask response (JS engine, real FAA data)
//   serial-sample.jpg : serial-range rule evaluation (Python sample engine, labelled SYNTHETIC ADs)
// Usage (from app/): node scripts/brief-plates.mjs   (needs /tmp/ask-json.json and /tmp/sample-serial.json)
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const root = new URL('..', import.meta.url).pathname, out = `${root}film/plates/`
const F = `file://${root}node_modules/@fontsource`
const ask = JSON.parse(readFileSync('/tmp/ask-json.json', 'utf8')), ser = JSON.parse(readFileSync('/tmp/sample-serial.json', 'utf8'))
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const hl = json => esc(JSON.stringify(json, null, 2))
  .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="k">$1</span>$2')
  .replace(/: ("(?:[^"\\]|\\.)*")/g, ': <span class="s">$1</span>')
  .replace(/: (-?\d+(?:\.\d+)?)/g, ': <span class="n">$1</span>')
  .replace(/: (true|false|null)/g, ': <span class="b">$1</span>')
const css = `
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-500-normal.woff2); font-weight: 500; }
@font-face { font-family: B; src: url(${F}/barlow/files/barlow-latin-600-normal.woff2); font-weight: 600; }
@font-face { font-family: C; src: url(${F}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2); }
@font-face { font-family: M; src: url(${F}/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2); }
* { box-sizing: border-box; margin: 0; } body { width: 1600px; height: 900px; font-family: B; color: #0b1f45; background: linear-gradient(180deg, #f7faff, #eaf1f9); padding: 36px 44px; }
h2 { font-family: C; font-size: 40px; color: #00205b; } .sub { color: #3c4f72; font-size: 19px; margin-top: 4px; }
.tag { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 15px; font-weight: 600; }
pre { font-family: M; font-size: 17px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; background: #0b1f45; color: #dfe9f6; border-radius: 16px; padding: 22px 26px; overflow: hidden; }
.k { color: #8cc8ff; } .s { color: #b8e6a1; } .n { color: #ffcf7a; } .b { color: #ff9e9e; }
.card { background: #fff; border: 1px solid #dbe5f1; border-radius: 16px; padding: 18px 22px; box-shadow: 0 14px 36px -24px rgba(0,32,91,.5); }
.mono { font-family: M; }`
const page = body => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`

const jsonHtml = page(`
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px">
    <div><h2>POST /ask returns structured data, not loose text</h2><div class="sub">AS350B3 · "main rotor servo-control torque inspection" · real FAA data, abridged</div></div>
    <span class="tag" style="background:#e6f4ec;color:#138a52">status: ${ask.status}</span>
  </div>
  <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:20px">
    <pre style="height:720px">${hl({ status: ask.status, ad: ask.ad, applicability: ask.applicability, revision: ask.revision, fields: ask.fields })}</pre>
    <pre style="height:720px">${hl({ claims: ask.claims, latency_ms: ask.latency_ms })}</pre>
  </div>`)

const row = o => {
  const c = { ANSWERED: ['#e6f4ec', '#138a52', 'Applies'], NOT_APPLICABLE: ['#fbe9e7', '#d1352b', 'Not applicable'], NEEDS_INPUT: ['#fff4e0', '#b86e00', 'Needs input'] }[o.status]
  return `<div class="card" style="display:grid;grid-template-columns:220px 210px 1fr;gap:18px;align-items:center">
    <div><div class="sub" style="margin:0">A320-214</div><div class="mono" style="font-size:26px;color:#00205b">${o.serial ? 'MSN ' + o.serial : 'no serial given'}</div></div>
    <span class="tag" style="background:${c[0]};color:${c[1]};font-size:20px;text-align:center">${c[2]}</span>
    <div style="font-size:19px;color:#3c4f72">${o.applicability.reasons.map(esc).join('<br>')}</div></div>`
}
const rule = ser[0].applicability.rule
const serialHtml = page(`
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div><h2>Serial-range applicability, evaluated as a rule</h2><div class="sub">Sample full-text AD engine · "When must I inspect the wing spar fitting?"</div></div>
    <span class="tag" style="background:#fff4e0;color:#b86e00;font-size:17px">SYNTHETIC SAMPLE ADs, labelled · not real FAA ADs</span>
  </div>
  <div style="display:grid;grid-template-columns:560px 1fr;gap:22px">
    <div style="display:grid;gap:14px;align-content:start">
      <div class="card"><div class="sub" style="margin:0 0 6px">AD 2025-02-07 · (c) Applicability</div><div style="font-size:19px;line-height:1.45">"This AD applies to Airbus SAS Model A320-214 and A320-232 airplanes, … manufacturer serial numbers (MSN) <b>1000 through 1800 inclusive</b>."</div></div>
      <pre style="font-size:16px">${hl({ parsed_rule: { models: rule.models, serial_kind: rule.serial_kind, range: rule.range, all_serials: rule.all_serials } })}</pre>
      <div class="card" style="font-size:18px;color:#3c4f72"><b style="color:#00205b">Revision logic:</b> AD 2024-05-11 (MSN 1000 to 1500) is superseded by 2025-02-07. Questions about the old AD are answered from the latest one.</div>
    </div>
    <div style="display:grid;gap:14px;align-content:start">${[ser[0], ser[2], ser[3], ser[1]].map(row).join('')}
      <div class="sub" style="font-size:16px">Compliance when it applies: "${esc(ser[0].fields.compliance_time[0].value)}", cited to ${esc(ser[0].fields.compliance_time[0].claim)}.</div>
    </div>
  </div>`)

const b = await chromium.launch()
for (const [name, html] of [['json-response', jsonHtml], ['serial-sample', serialHtml]]) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
  writeFileSync(`/tmp/${name}.html`, html); await p.goto(`file:///tmp/${name}.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}${name}.jpg`, type: 'jpeg', quality: 92 }); await p.close()
}
await b.close(); console.log('plates written')
