import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { FleetRow } from '../lib/types'
import { SAMPLE_OPERATOR } from '../lib/demo'
import { REG } from '../lib/present'
import { IconFleet } from '../components/Icons'

export function FleetView({ onOpen }: { onOpen(d: string): void }) {
  const [text, setText] = useState(SAMPLE_OPERATOR.fleet.map(f => f.model).join(', '))
  const [rows, setRows] = useState<FleetRow[]>([])
  const [showWd, setShowWd] = useState(false)
  const run = () => api.fleet(text.split(/[,\n]/)).then(setRows)
  useEffect(() => { run() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const tails = (m: string) => SAMPLE_OPERATOR.fleet.find(f => f.model === m)?.tails ?? []
  const totalOpen = rows.reduce((s, r) => s + r.open_comments, 0)
  const totalLive = rows.reduce((s, r) => s + r.dockets.filter(d => d.status !== 'WITHDRAWN').length, 0)
  return (
    <main className="view page scroll">
      <header className="page-h">
        <div>
          <h1>Fleet check</h1>
          <p className="lede">Paste your fleet's models. Each row lists the proposals that name the model, newest first. Withdrawn proposals impose nothing and are hidden unless you ask.</p>
        </div>
        <div className="page-stats">
          <div><div className="readout" style={{ fontSize: 52 }}>{totalLive}</div><div className="label">Live proposals</div></div>
          <div><div className="readout" style={{ fontSize: 52 }}>{totalOpen}</div><div className="label">Open for comment</div></div>
        </div>
      </header>
      <form className="glass strong fleet-form" onSubmit={e => { e.preventDefault(); run() }}>
        <IconFleet />
        <input className="mono" value={text} onChange={e => setText(e.target.value.toUpperCase())} aria-label="Fleet models, comma separated" />
        <label className="label tog"><input type="checkbox" checked={showWd} onChange={e => setShowWd(e.target.checked)} /> Show withdrawn</label>
        <button className="glass-btn pri">Check fleet</button>
      </form>
      <p className="label" style={{ margin: '8px 4px 18px' }}>{SAMPLE_OPERATOR.name} · {SAMPLE_OPERATOR.base} · tail numbers are sample data, proposals are real.</p>
      <div className="fleet-grid">
        {rows.map(r => {
          const ds = r.dockets.filter(d => showWd || d.status !== 'WITHDRAWN')
          return (
            <section key={r.model} className="glass card fleet-card">
              <div className="fc-h">
                <div><div className="readout" style={{ fontSize: 34 }}>{r.model}</div>
                  <div className="label">{tails(r.model).length ? `${tails(r.model).length} aircraft · ${tails(r.model).join(' ')}` : 'Not in sample fleet'}</div></div>
                <div className="fc-n">
                  <span className="pill info">{r.counts.PROPOSED + r.counts.REVISED_PROPOSAL} live</span>
                  {r.open_comments > 0 && <span className="pill warn">{r.open_comments} open</span>}
                  {r.counts.WITHDRAWN > 0 && <span className="pill mute">{r.counts.WITHDRAWN} withdrawn</span>}
                </div>
              </div>
              {!r.known ? <p className="label">No proposal in this dataset lists this model.</p> : !ds.length ? <p className="label">No live proposals list this exact model.</p> : (
                <ul className="fc-list">{ds.slice(0, 6).map(d => (
                  <li key={d.docket}><button onClick={() => onOpen(d.docket)}>
                    <span className="mono"><b>{d.docket}</b></span><span className={`pill ${REG[d.status][0]}`}>{REG[d.status][1]}</span>
                    <span className="label">{d.comments_open ? `comments due ${d.comments_due}` : d.latest}</span>
                    <span className="s">{d.first_sentence}</span>
                  </button></li>
                ))}{ds.length > 6 && <li className="label">+{ds.length - 6} more</li>}</ul>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}
