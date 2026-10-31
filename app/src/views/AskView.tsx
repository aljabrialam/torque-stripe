import { useState, type RefObject } from 'react'
import type { AskResult, FleetRow, Health } from '../lib/types'
import { DEMO_QUESTIONS } from '../lib/demo'
import { REG, daysUntil, headline, ruleChecks, stripeState } from '../lib/present'
import type { StageApi } from '../components/Stage'
import { IconChecks, IconCube, IconDoc, IconLink, IconQuote } from '../components/Icons'
import { Radar } from '../components/Radar'
import { exportReport } from '../lib/report'
import { mascotSvg } from '../components/mascot.js'

interface Props {
  model: string; setModel(m: string): void; query: string; setQuery(q: string): void
  ask(q?: string, m?: string): void; result: AskResult | null; busy: boolean; models: string[]; health: Health | null
  modelInfo: { label: string; fleet: FleetRow | null }; zone: { zone: string; label: string; word: string } | null
  stage: RefObject<StageApi | null>; openDocket(d: string): void
}

export function AskView(p: Props) {
  const { result: r, health } = p
  const today = health?.today ?? new Date().toISOString().slice(0, 10)
  const f = r?.fields || {}
  const due = (f.comments_due || '').slice(0, 10), open = /open/.test(f.comments_due || '')
  const days = due && open ? daysUntil(due, today) : null
  return (
    <main className="view ask scroll" id="ask">
      <section className="console">
        <form className="askbar glass strong" onSubmit={e => { e.preventDefault(); p.ask() }} data-tour="ask">
          <label className="ab-model">
            <span className="label">Aircraft or engine model</span>
            <input className="mono" value={p.model} onChange={e => p.setModel(e.target.value.toUpperCase())} list="models" placeholder="e.g. AS350B3" spellCheck={false} aria-label="Aircraft or engine model" />
            <datalist id="models">{p.models.map(m => <option key={m} value={m} />)}</datalist>
          </label>
          <label className="ab-q">
            <span className="label">Question</span>
            <input value={p.query} onChange={e => p.setQuery(e.target.value)} placeholder="Ask about a proposed AD, a docket or a model" aria-label="Question" />
          </label>
          <button className="glass-btn pri" type="submit" disabled={p.busy}>{p.busy ? 'Checking…' : 'Check'}</button>
        </form>
        <div className="chips" data-tour="chips">
          {DEMO_QUESTIONS.map((d, i) => (
            <button key={i} className="chip glass" onClick={() => p.ask(d.q, d.model)} title={d.shows}>
              {d.model && <span className="mono k">{d.model}</span>}{d.label || d.q}
            </button>
          ))}
        </div>

        <RuleChecks r={r} />
        <Proposal r={r} today={today} />

        <div className="hud bl" data-tour="stage">
          <div className="model-tag">
            <div className="readout" style={{ fontSize: 46 }}>{p.model || '—'}</div>
            <div className="label">{p.modelInfo.label || 'Set a model to load its silhouette'}</div>
            <div className="model-sum">{modelSummary(p.modelInfo.fleet)}</div>
          </div>
          <div className="readouts">
            <div><div className="readout">{days ?? '—'}<small>d</small></div><div className="label">Comment period left</div></div>
            <div><div className="readout">{r ? r.latency_ms.toFixed(1) : '—'}<small>ms</small></div><div className="label">Rule check time</div></div>
          </div>
        </div>
        <StripeLegend r={r} zone={p.zone} stage={p.stage} />
        <Radar fleet={p.modelInfo.fleet} today={today} model={p.model} onOpen={p.openDocket} />
      </section>

      <section className="results" id="answer">
        {r ? <Answer r={r} ask={p.ask} openDocket={p.openDocket} health={health} fallbackQuery={p.query} /> : (
          <div className="glass strong card empty">
            <div className="empty-torq" aria-hidden="true" dangerouslySetInnerHTML={{ __html: mascotSvg('wave', { size: 104 }) }} />
            <h2>Ask about FAA proposed airworthiness directives</h2>
            <p>Set your aircraft model, then ask a question or pick a demo above. Every answer is quoted from the Federal Register notice and checked by rules. If the data can't support an answer, it says so.</p>
            <p className="label" style={{ marginTop: 10 }}>Built for Airbus Challenge #4 at Autonomous SG 2026. Not an official Airbus product.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function modelSummary(f: FleetRow | null) {
  if (!f) return ''
  if (!f.known) return 'No proposal in this dataset lists this model.'
  if (!f.dockets.length) return 'Listed only as part of a family. Give the exact variant.'
  return `${f.dockets.length} proposal${f.dockets.length > 1 ? 's list' : ' lists'} this model · ${f.open_comments} open for comment${f.counts.WITHDRAWN ? ` · ${f.counts.WITHDRAWN} withdrawn` : ''}`
}

function RuleChecks({ r }: { r: AskResult | null }) {
  const { checks, pct } = ruleChecks(r)
  const segColor = r?.status === 'REFUSED' ? 'var(--stop)' : pct < 100 ? 'var(--amber)' : 'var(--ok)'
  return (
    <aside className="hud left glass" aria-label="Rule checks" data-tour="checks">
      <div className="ph"><IconChecks />Rule checks<span className="meta">deterministic</span></div>
      <div className="readiness">
        <div className="segs" style={{ ['--seg' as string]: segColor }}>{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < Math.round(pct / 100 * 12) ? 'on' : ''} />)}</div>
        <span className="cond pct">{r ? `${pct}%` : '—'}</span>
      </div>
      <ul className="checks">
        {checks.length ? checks.map((c, i) => (
          <li key={i}><span className={`dot ${c.tone}`} /><span className="ct"><b>{c.title}</b><span>{c.sub}</span></span><span className={`cs t-${c.tone}`}>{c.state}</span></li>
        )) : <li className="idle">Ask a question to run the checks.</li>}
      </ul>
    </aside>
  )
}

function Proposal({ r, today }: { r: AskResult | null; today: string }) {
  const f = r?.fields || {}, vs = r?.revision?.versions || []
  const wd = f.regulatory_status === 'WITHDRAWN'
  const due = (f.comments_due || '').slice(0, 10), open = /open/.test(f.comments_due || '')
  const days = due ? daysUntil(due, today) : null
  const frac = days === null || !open ? 0 : Math.max(0, Math.min(1, days / 60)), C = 2 * Math.PI * 34
  return (
    <aside className="hud right glass" aria-label="Proposal" data-tour="proposal">
      <div className="ph"><IconDoc />Proposal<span className="meta mono">{r?.ad || ''}</span></div>
      {!r?.ad ? (
        <div className="pad">{r?.candidates?.length ? (
          <div className="tiles"><Tile l="Proposals" v={String(r.candidates.length)} /><Tile l="Withdrawn" v={String(r.candidates.filter(c => c.status === 'WITHDRAWN').length)} tone="mute" /></div>
        ) : <p className="label">No docket behind this answer yet.</p>}</div>
      ) : (
        <div className="pad">
          <div className="tiles">
            <Tile l="Binding" v="No" tone={wd ? 'mute' : 'warn'} />
            <Tile l="Status" v={wd ? 'Withdrawn' : f.regulatory_status === 'REVISED_PROPOSAL' ? 'Revised' : 'Proposed'} />
            <Tile l="Units" v={f.scope_wording === 'ALL' ? 'All' : f.scope_wording === 'CERTAIN' ? 'Certain' : 'Unclear'} tone={f.scope_wording === 'ALL' ? 'ok' : 'warn'} />
            <Tile l="Supersedes" v={(f.supersedes_ads || []).length ? `${f.supersedes_ads![0]}${f.supersedes_ads!.length > 1 ? ` +${f.supersedes_ads!.length - 1}` : ''}` : 'None'} tone="mute" small />
          </div>
          <div className="dial">
            <svg viewBox="0 0 84 84" aria-hidden="true">
              <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(0,32,91,.08)" strokeWidth="6" />
              <circle cx="42" cy="42" r="34" fill="none" stroke={open ? 'var(--molten)' : 'var(--sand-3)'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 42 42)" style={{ filter: open ? 'drop-shadow(0 0 6px rgba(0,133,202,.35))' : undefined }} />
            </svg>
            <div>
              <div className="label">Comment period</div>
              <div className="readout" style={{ fontSize: 34 }}>{wd ? 'Closed' : !due ? '—' : open ? <>{days}<small>days</small></> : 'Closed'}</div>
              <div className="label">{wd ? 'Proposal withdrawn' : due ? `${open ? 'due' : 'ended'} ${due}` : 'No deadline in the notice'}</div>
            </div>
          </div>
          {vs.length > 0 && (
            <div className="vtl-wrap">
              <div className="label">Versions</div>
              <div className="vtl">{vs.map((v, i) => (
                <span key={i} className="vtl-step">{i > 0 && <span className="ln" />}<span className={`n ${v.action === 'WITHDRAWN' ? 'wd' : i === vs.length - 1 ? 'cur' : ''}`} title={`${v.action} ${v.date}`} /></span>
              ))}</div>
              <div className="vtl-l mono"><span>{vs[0].date}</span>{vs.length > 1 && <span>{vs[vs.length - 1].date}</span>}</div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function Tile({ l, v, tone, small }: { l: string; v: string; tone?: string; small?: boolean }) {
  return <div className="tile"><div className="label">{l}</div><div className={`tv cond t-${tone || ''}`} style={small ? { fontSize: 15 } : undefined}>{v}</div></div>
}

function StripeLegend({ r, zone, stage }: { r: AskResult | null; zone: Props['zone']; stage: RefObject<StageApi | null> }) {
  const s = stripeState(r)
  const [v, setV] = useState<'3d' | 'top' | 'side'>('3d')
  const [mode, setMode] = useState<'solid' | 'wire'>('solid')
  const pick = (x: typeof v) => { setV(x); stage.current?.setView(x) }
  const render = (x: typeof mode) => { setMode(x); stage.current?.setRender(x) }
  return (
    <div className="hud bc glass">
      <span className={`heat ${s.state}`} aria-hidden="true"><i /></span>
      <div className="sl-t"><b>{s.text}</b>{zone && <span className="label">Affected area · {zone.label} · matched “{zone.word}” in the quoted notice</span>}</div>
      <div className="views-col">
      <div className="views" role="group" aria-label="Camera">
        <IconCube />
        {(['3d', 'top', 'side'] as const).map(x => <button key={x} className="glass-btn" aria-pressed={v === x} onClick={() => pick(x)}>{x === '3d' ? '3D' : x === 'top' ? 'Top' : 'Side'}</button>)}
      </div>
      <div className="views" role="group" aria-label="Render mode">
        {(['solid', 'wire'] as const).map(x => <button key={x} className="glass-btn" aria-pressed={mode === x} onClick={() => render(x)}>{x === 'solid' ? 'Render' : 'Wire'}</button>)}
      </div>
      </div>
    </div>
  )
}

function Answer({ r, ask, openDocket, health, fallbackQuery }: { r: AskResult; ask(q?: string, m?: string): void; openDocket(d: string): void; health: Health | null; fallbackQuery: string }) {
  const h = headline(r), f = r.fields || {}, app = r.applicability || {}, rev = r.revision || {}
  const reg = f.regulatory_status ? REG[f.regulatory_status] : null
  const claims = Object.fromEntries((r.claims || []).map((c, i) => [c.id, { c, n: i + 1 }]))
  const [cur, setCur] = useState<string | null>(null)
  const kv: [string, string | undefined][] = r.ad && f.regulatory_status ? [
    ['Status', reg?.[1]], ['Comments due', f.comments_due], ['Supersedes', (f.supersedes_ads || []).map(a => `AD ${a}`).join(', ')],
    ['Make', f.make], ['Scope wording', f.scope_wording === 'ALL' ? 'All units of listed models' : f.scope_wording === 'CERTAIN' ? 'Certain units (criteria in full text)' : 'Not stated'],
    ['Published', f.latest_publication],
  ] : []
  return (
    <div className="answer-grid">
      <article className="glass strong card ans">
        <div className="pillrow">
          <span className={`pill ${h.tone}`}>{h.label}</span>
          {reg && <span className={`pill ${reg[0]}`}>{reg[1]}</span>}
          {r.ad && <span className="pill mono">{r.ad}</span>}
          {(rev.versions?.length ?? 0) > 1 && <span className="pill">v{rev.versions!.length} of {rev.versions!.length}</span>}
          {(f.supersedes_ads || []).slice(0, 3).map(a => <span key={a} className="pill mono">Supersedes AD {a}</span>)}
          <span style={{ flex: 1 }} />
          <button className="glass-btn" onClick={() => exportReport(r, r.query || fallbackQuery, r.config?.model || '', health)} title="Opens the print dialog; choose Save as PDF">Export PDF</button>
        </div>
        <h2 className="headline">{h.head}</h2>
        {h.lede && <p className="lede">{h.lede}</p>}
        {app.verdict === 'NEEDS_VARIANT' && !!app.variants?.length && (
          <div className="acts">{app.variants.slice(0, 12).map(v => <button key={v} className="glass-btn mono" onClick={() => ask(undefined, v)}>{v}</button>)}</div>
        )}
        {app.verdict === 'NOT_LISTED' && !!app.listed?.length && (
          <details><summary className="label">Show the {app.listed.length} listed models</summary><p className="mono listed">{app.listed.join(' · ')}</p></details>
        )}
        {(app.verdict === 'MODEL_LISTED_UNITS_UNCONFIRMED' || app.verdict === 'UNDETERMINED') && f.link && (
          <div className="acts"><a className="glass-btn pri" href={f.link} target="_blank" rel="noopener">Check unit criteria in the Federal Register</a></div>
        )}
        {kv.length > 0 && <dl className="kv">{kv.filter(x => x[1]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        {r.candidates?.length ? (
          <div className="cands">{r.candidates.map(c => {
            const st = REG[c.status]
            return <button key={c.docket} className="cand" onClick={() => openDocket(c.docket)}>
              <div className="top"><b className="mono">{c.docket}</b><span className={`pill ${st[0]}`}>{st[1]}</span><span className="label">{c.latest}</span></div>
              <div className="s">{c.first_sentence}</div>
            </button>
          })}</div>
        ) : r.answer?.sentences?.length ? (
          <div className="sents">
            {r.answer.sentences.map((s, i) => (
              <p key={i} className="sent">{s.text}{(s.cites || []).map(cid => claims[cid] && (
                <button key={cid} className={`cite mono${cur === cid ? ' cur' : ''}`} onClick={() => setCur(cid)} aria-label={`Source sentence ${claims[cid].n}`}>S{claims[cid].c.cite.sentence + 1}</button>
              ))}</p>
            ))}
            <p className="label mode">{r.answer.mode === 'llm_verified' ? 'Reworded by Claude · every sentence verified against the cited text' : 'Quoted word for word from the notice · no AI rewording'}</p>
          </div>
        ) : null}
        {f.binding && <p className="binding"><span className="dot" />{f.binding}</p>}
        <details className="trace"><summary className="label">Why this answer · {r.trace.length} rule steps</summary><ol className="mono">{r.trace.map((t, i) => <li key={i}>{t}</li>)}</ol></details>
      </article>
      {r.claims?.length > 0 && r.status !== 'REFUSED' && (
        <aside className="glass strong card sources" aria-label="Sources">
          <div className="ph" style={{ padding: '0 0 10px' }}><IconQuote />Cited source sentences<span className="meta">{r.claims.length}</span></div>
          {r.claims.map(c => (
            <div key={c.id} className={`src${cur === c.id ? ' cur' : ''}`} onClick={() => setCur(c.id)}>
              <div className="src-h"><b className="mono">S{c.cite.sentence + 1}</b><span className="mono">{c.cite.docket}</span><span className="label">{c.cite.version_date} · {c.cite.action.replace(/_/g, ' ').toLowerCase()}</span></div>
              <p>“{c.text}”</p>
              <div className="label src-f">{c.cite.fr_citation} {c.cite.pages} · sheet row {c.cite.sheet_row}
                {c.cite.link && <a href={c.cite.link} target="_blank" rel="noopener" aria-label="Open in the Federal Register"><IconLink width={14} height={14} /></a>}</div>
            </div>
          ))}
        </aside>
      )}
    </div>
  )
}
