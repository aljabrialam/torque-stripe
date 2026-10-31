// Printable / PDF report of one answer. Built only from the engine's structured result (never from free text),
// fingerprinted with SHA-256 so a printed copy can be matched to the exact result, and ending in an engineer sign-off.
import type { AskResult, Health } from './types'
import { REG, headline, ruleChecks } from './present'

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const LOGO = `<svg width="34" height="34" viewBox="0 0 64 64"><defs><clipPath id="h"><polygon points="49.32,42 32,52 14.68,42 14.68,22 32,12 49.32,22"/></clipPath></defs><rect x="28" y="3" width="8" height="58" rx="1.2" fill="#0085CA" transform="rotate(32 32 32)"/><polygon points="49.32,42 32,52 14.68,42 14.68,22 32,12 49.32,22" fill="#00205B"/><g clip-path="url(#h)"><rect x="28" y="3" width="8" height="58" rx="1.2" fill="#0085CA" transform="rotate(32 32 32)"/></g><polygon points="49.32,42 32,52 14.68,42 14.68,22 32,12 49.32,22" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/></svg>`
const TONE: Record<string, string> = { ok: '#138a52', warn: '#b86e00', info: '#b86e00', stop: '#d1352b', mute: '#6d7d98', na: '#6d7d98' }

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function exportReport(r: AskResult, query: string, model: string, health: Health | null) {
  const generated = new Date()
  const fingerprint = await sha256(JSON.stringify({ query, model, status: r.status, ad: r.ad, verdict: r.applicability.verdict,
    fields: r.fields, claims: r.claims.map(c => [c.id, c.text]), dataset: health && [health.rows, health.dockets] }))
  const id = fingerprint.slice(0, 12).toUpperCase()
  const h = headline(r), { checks } = ruleChecks(r), f = r.fields || {}, vs = r.revision?.versions || []
  const reg = f.regulatory_status ? REG[f.regulatory_status][1] : null
  const kv: [string, string | undefined][] = [
    ['Docket', r.ad ?? undefined], ['Regulatory status', reg ?? undefined], ['Binding', f.binding], ['Comments due', f.comments_due],
    ['Supersedes', (f.supersedes_ads || []).map(a => `AD ${a}`).join(', ') || undefined], ['Make', f.make],
    ['Scope wording', f.scope_wording === 'ALL' ? 'All units of listed models' : f.scope_wording === 'CERTAIN' ? 'Certain units (criteria only in the full Federal Register text)' : f.scope_wording ? 'Not stated' : undefined],
    ['Applicability', (r.applicability.reasons || []).join(' ') || undefined], ['Latest publication', f.latest_publication],
  ]
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Torque Stripe report ${id}</title><style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; } body { margin: 0; font: 10.5pt/1.45 "Helvetica Neue", Arial, sans-serif; color: #0b1f45; }
  .mono { font-family: "IBM Plex Mono", Menlo, monospace; font-size: 9pt; }
  header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #00205b; padding-bottom: 8px; }
  header .t { flex: 1; } header b { font-size: 14pt; letter-spacing: .02em; } header .s { color: #3c4f72; font-size: 9pt; }
  header .id { text-align: right; font-size: 8.5pt; color: #3c4f72; }
  h2 { font-size: 9pt; letter-spacing: .1em; text-transform: uppercase; color: #3c4f72; margin: 16px 0 6px; border-bottom: 1px solid #d5deea; padding-bottom: 3px; }
  .q { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; }
  .q dt { color: #6d7d98; } .q dd { margin: 0; }
  .verdict { margin-top: 12px; padding: 10px 12px; border: 1px solid #d5deea; border-left: 4px solid ${TONE[h.tone]}; border-radius: 4px; background: #f6f9fc; }
  .verdict .lab { color: ${TONE[h.tone]}; font-weight: 700; font-size: 9pt; letter-spacing: .06em; text-transform: uppercase; }
  .verdict .head { font-size: 13pt; font-weight: 700; margin: 2px 0; } .verdict p { margin: 0; color: #3c4f72; }
  table { width: 100%; border-collapse: collapse; } td, th { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e6ecf4; vertical-align: top; }
  th { font-size: 8.5pt; color: #6d7d98; font-weight: 600; }
  .ev { page-break-inside: avoid; margin: 0 0 8px; padding: 6px 10px; border-left: 3px solid #0085ca; background: #f6f9fc; }
  .ev p { margin: 0 0 3px; } .ev .c { color: #3c4f72; font-size: 8.5pt; }
  ol.trace { margin: 0; padding-left: 18px; color: #3c4f72; font-size: 8.5pt; }
  .note { font-size: 9pt; color: #3c4f72; } .note li { margin-bottom: 2px; }
  .sign { page-break-inside: avoid; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; margin-top: 10px; }
  .sign div { border-bottom: 1px solid #0b1f45; height: 34px; position: relative; } .sign span { position: absolute; bottom: -15px; font-size: 8pt; color: #6d7d98; }
  .boxes { margin-top: 26px; font-size: 9.5pt; } .boxes label { margin-right: 18px; } .boxes i { display: inline-block; width: 10px; height: 10px; border: 1px solid #0b1f45; margin-right: 5px; vertical-align: -1px; }
  footer { margin-top: 22px; border-top: 1px solid #d5deea; padding-top: 6px; font-size: 8pt; color: #6d7d98; display: flex; justify-content: space-between; gap: 12px; }
  </style></head><body>
  <header>${LOGO}<div class="t"><b>TORQUE STRIPE</b><div class="s">FAA proposed AD applicability report</div></div>
    <div class="id">Report <span class="mono">${id}</span><br>${esc(generated.toISOString().replace('T', ' ').slice(0, 19))} UTC</div></header>

  <h2>Question</h2>
  <dl class="q"><dt>Aircraft / engine model</dt><dd class="mono">${esc(model || 'Not set')}</dd><dt>Question</dt><dd>${esc(query)}</dd>
  <dt>Dataset</dt><dd>${health ? `${health.rows} FAA NPRM notices, ${health.dockets} dockets, ${health.federal_register_pages.toLocaleString()} Federal Register pages · as of ${esc(health.today)}` : '—'}</dd></dl>

  <div class="verdict"><div class="lab">${esc(h.label)}</div><div class="head">${esc(h.head)}</div>${h.lede ? `<p>${esc(h.lede)}</p>` : ''}</div>

  <h2>Rule checks (deterministic)</h2>
  <table><tr><th>Check</th><th>Detail</th><th>Result</th></tr>${checks.map(c => `<tr><td>${esc(c.title)}</td><td>${esc(c.sub)}</td><td style="color:${TONE[c.tone]};font-weight:600">${esc(c.state)}</td></tr>`).join('') || '<tr><td colspan="3">No checks ran.</td></tr>'}</table>

  ${kv.some(x => x[1]) ? `<h2>Proposal</h2><table>${kv.filter(x => x[1]).map(([k, v]) => `<tr><th style="width:150px">${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
  ${vs.length ? `<h2>Version history</h2><table><tr><th>Date</th><th>Action</th><th>Federal Register</th><th>Sheet row</th></tr>${vs.map(v => `<tr><td class="mono">${esc(v.date)}</td><td>${esc(v.action.replace(/_/g, ' ').toLowerCase())}</td><td>${esc(v.fr)} ${esc(v.pages)}</td><td class="mono">${esc(v.row)}</td></tr>`).join('')}</table>` : ''}
  ${r.candidates?.length ? `<h2>Matching proposals</h2><table><tr><th>Docket</th><th>Status</th><th>Latest</th><th>Summary</th></tr>${r.candidates.map(c => `<tr><td class="mono">${esc(c.docket)}</td><td>${esc(REG[c.status][1])}</td><td class="mono">${esc(c.latest)}</td><td>${esc(c.first_sentence)}</td></tr>`).join('')}</table>` : ''}

  ${r.claims?.length && r.status !== 'REFUSED' ? `<h2>Evidence, quoted word for word</h2>${r.claims.map(c => `<div class="ev"><p>“${esc(c.text)}”</p><div class="c"><span class="mono">S${c.cite.sentence + 1} · ${esc(c.cite.docket)}</span> · ${esc(c.cite.version_date)} · ${esc(c.cite.action.replace(/_/g, ' ').toLowerCase())} · ${esc(c.cite.fr_citation)} ${esc(c.cite.pages)} · sheet row ${esc(c.cite.sheet_row)}${c.cite.link ? `<br>${esc(c.cite.link)}` : ''}</div></div>`).join('')}
    <p class="note">${r.answer?.mode === 'llm_verified' ? 'Answer wording was reworded by Claude and every sentence was verified against the cited text.' : 'No AI rewording: sentences are quoted directly from the notice.'}</p>` : ''}

  <h2>Rule trace</h2><ol class="trace">${r.trace.map(t => `<li class="mono">${esc(t)}</li>`).join('')}</ol>

  <h2>Limitations</h2><ul class="note">
    <li>These are proposed rules (NPRMs), not airworthiness directives in force. Withdrawn proposals impose no requirement.</li>
    <li>Where the notice covers "certain" units, serial-number or configuration criteria are only in the full Federal Register text and were not confirmed here.</li>
    <li>Status, applicability and refusals are decided by deterministic rules over the dataset named above. Check the cited Federal Register pages before acting.</li></ul>

  <h2>Engineer review</h2>
  <div class="boxes"><label><i></i>Accepted</label><label><i></i>Not applicable to our fleet</label><label><i></i>Further review required</label></div>
  <div class="sign"><div><span>Name</span></div><div><span>Licence / authorisation number</span></div><div><span>Signature</span></div><div><span>Date</span></div></div>

  <footer><span>The AI reads. The rules decide. The engineer signs.</span><span class="mono">SHA-256 ${fingerprint}</span></footer>
  </body></html>`

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open(); doc.write(html); doc.close()
  const title = document.title
  document.title = `TorqueStripe-${r.ad || 'answer'}-${id}`
  await new Promise(res => setTimeout(res, 250))
  frame.contentWindow!.focus(); frame.contentWindow!.print()
  setTimeout(() => { document.title = title; frame.remove() }, 1500)
  return id
}
