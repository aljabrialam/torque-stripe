import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { DocketSummary } from '../lib/types'
import { daysUntil } from '../lib/present'

const CATS = ['Large airplanes', 'Small airplanes', 'Rotorcraft', 'Engines', 'Other'] as const
const cat = (d: DocketSummary) => /engine/i.test(d.pt || '') ? 'Engines' : /rotor/i.test(d.pst || '') ? 'Rotorcraft'
  : /large/i.test(d.pst || '') ? 'Large airplanes' : /small/i.test(d.pst || '') ? 'Small airplanes' : 'Other'
const MAKES: [RegExp, string][] = [[/airbus helicopters|eurocopter/i, 'Airbus Helicopters'], [/airbus/i, 'Airbus'], [/mcdonnell|boeing/i, 'Boeing'],
  [/bombardier|de havilland|canadair/i, 'Bombardier'], [/embraer|empresa brasileira/i, 'Embraer'], [/general electric|\bGE\b/i, 'GE Aerospace'],
  [/pratt/i, 'Pratt & Whitney'], [/rolls/i, 'Rolls-Royce'], [/cfm/i, 'CFM International'], [/bell/i, 'Bell'], [/sikorsky/i, 'Sikorsky'],
  [/robinson/i, 'Robinson'], [/cessna|textron|beech|hawker/i, 'Textron Aviation'], [/gulfstream/i, 'Gulfstream'], [/dassault/i, 'Dassault'],
  [/agusta|leonardo/i, 'Leonardo'], [/atr|avions de transport/i, 'ATR'], [/pilatus/i, 'Pilatus'], [/safran|turbomeca/i, 'Safran']]
const make = (m: string) => { for (const [rx, n] of MAKES) if (rx.test(m || '')) return n; return (m || 'Unknown').replace(/^The /, '').split(/[ ,(]/).slice(0, 2).join(' ') || 'Unknown' }

type Row = DocketSummary & { cat: string; mk: string; year: number }

export function InsightsView({ onOpen, today }: { onOpen(d: string): void; today: string }) {
  const [all, setAll] = useState<Row[]>([])
  const [mk, setMk] = useState<string | null>(null)
  const [cell, setCell] = useState<{ y: number; c: string } | null>(null)
  useEffect(() => {
    api.dockets().then(ds => setAll(ds.map(d => ({ ...d, cat: cat(d), mk: make(d.make), year: +(d.first || d.latest || '0').slice(0, 4) }))))
  }, [])
  const rows = useMemo(() => all.filter(d => !mk || d.mk === mk), [all, mk])
  const years = useMemo(() => [...new Set(all.map(d => d.year))].filter(Boolean).sort(), [all])
  const makers = useMemo(() => {
    const c: Record<string, { live: number; wd: number }> = {}
    for (const d of all) { c[d.mk] ||= { live: 0, wd: 0 }; c[d.mk][d.status === 'WITHDRAWN' ? 'wd' : 'live']++ }
    return Object.entries(c).sort((a, b) => (b[1].live + b[1].wd) - (a[1].live + a[1].wd)).slice(0, 10)
  }, [all])
  const maxMk = Math.max(1, ...makers.map(([, v]) => v.live + v.wd))
  const grid = useMemo(() => {
    const g: Record<string, { live: number; wd: number }> = {}
    for (const d of rows) { const k = `${d.year}|${d.cat}`; g[k] ||= { live: 0, wd: 0 }; g[k][d.status === 'WITHDRAWN' ? 'wd' : 'live']++ }
    return g
  }, [rows])
  const maxCell = Math.max(1, ...Object.values(grid).map(v => v.live + v.wd))
  const upcoming = useMemo(() => rows.filter(d => d.comments_due && d.comments_due >= today).map(d => ({ ...d, days: daysUntil(d.comments_due!, today) }))
    .filter(d => d.days <= 60).sort((a, b) => a.days - b.days), [rows, today])
  const withModels = rows.filter(d => d.models.length).length
  const live = rows.filter(d => d.status !== 'WITHDRAWN').length
  const listed = cell ? rows.filter(d => d.year === cell.y && d.cat === cell.c) : []

  return (
    <main className="view page scroll">
      <header className="page-h">
        <div>
          <h1>Insights</h1>
          <p className="lede">What the {all.length} dockets in the dataset look like. Click a bar to list the proposals behind it, or a maker to filter.</p>
        </div>
        <div className="page-stats">
          <div><div className="readout" style={{ fontSize: 52 }}>{live}</div><div className="label">Still proposed</div></div>
          <div><div className="readout" style={{ fontSize: 52 }}>{rows.length - live}</div><div className="label">Withdrawn</div></div>
          <div><div className="readout" style={{ fontSize: 52 }}>{rows.length ? Math.round(withModels / rows.length * 100) : 0}<small>%</small></div><div className="label">Model list parsed</div></div>
        </div>
      </header>
      <div className="ins-grid">
        <section className="glass card ins-land">
          <div className="ph" style={{ padding: '0 0 12px' }}>Proposals by first publication year and category<span className="meta">{mk ? `${mk} · ` : ''}{rows.length} dockets</span></div>
          <div className="land" style={{ gridTemplateColumns: `120px repeat(${years.length}, 1fr)` }}>
            {CATS.map(c => (
              <div key={c} className="land-row" style={{ display: 'contents' }}>
                <span className="label land-c">{c}</span>
                {years.map(y => {
                  const v = grid[`${y}|${c}`] || { live: 0, wd: 0 }, n = v.live + v.wd
                  return (
                    <button key={y} className={`land-cell${cell?.y === y && cell.c === c ? ' sel' : ''}`} disabled={!n} onClick={() => setCell({ y, c })} title={`${y} · ${c}: ${v.live} proposed, ${v.wd} withdrawn`}>
                      <span className="bar" style={{ height: `${n / maxCell * 100}%` }}>
                        <span className="wd" style={{ height: n ? `${v.wd / n * 100}%` : 0 }} />
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <span />
            {years.map(y => <span key={y} className="label land-y mono">{String(y).slice(2)}</span>)}
          </div>
          <div className="legend label"><span><i className="lg-live" />Still proposed</span><span><i className="lg-wd" />Withdrawn</span></div>
          {cell && (
            <div className="land-list">
              <div className="ll-h"><b>{cell.y} · {cell.c}</b><span className="label">{listed.length} proposals</span><button className="glass-btn" onClick={() => setCell(null)}>Clear</button></div>
              <div className="cands">{listed.slice(0, 20).map(d => (
                <button key={d.docket} className="cand" onClick={() => onOpen(d.docket)}>
                  <div className="top"><b className="mono">{d.docket}</b><span className={`pill ${d.status === 'WITHDRAWN' ? 'mute' : 'info'}`}>{d.status === 'WITHDRAWN' ? 'Withdrawn' : 'Still proposed'}</span><span className="label">{d.mk}</span></div>
                  <div className="s">{d.first_sentence}</div>
                </button>
              ))}</div>
            </div>
          )}
        </section>
        <section className="glass card">
          <div className="ph" style={{ padding: '0 0 12px' }}>Makers<span className="meta">{mk ? <button className="glass-btn" style={{ height: 26 }} onClick={() => setMk(null)}>Clear filter</button> : 'top 10'}</span></div>
          <ul className="makers">{makers.map(([n, v]) => (
            <li key={n}><button aria-pressed={mk === n} onClick={() => setMk(mk === n ? null : n)}>
              <span className="mk-n">{n}</span>
              <span className="mk-b"><i style={{ width: `${v.live / maxMk * 100}%` }} /><i className="wd" style={{ width: `${v.wd / maxMk * 100}%` }} /></span>
              <span className="mono mk-v">{v.live + v.wd}</span>
            </button></li>
          ))}</ul>
        </section>
        <section className="glass card">
          <div className="ph" style={{ padding: '0 0 12px' }}>Comment deadlines · next 60 days<span className="meta">{upcoming.length}</span></div>
          {upcoming.length ? (
            <div className="timeline">
              <div className="tl-axis">{[0, 15, 30, 45, 60].map(d => <span key={d} style={{ left: `${d / 60 * 100}%` }} className="label mono">{d}d</span>)}</div>
              {upcoming.slice(0, 14).map(d => (
                <button key={d.docket} className="tl-row" onClick={() => onOpen(d.docket)} title={d.first_sentence}>
                  <span className="mono">{d.docket}</span>
                  <span className="tl-track"><i style={{ left: `${d.days / 60 * 100}%` }} /></span>
                  <span className="label">{d.days}d</span>
                </button>
              ))}
            </div>
          ) : <p className="label">No comment periods close in the next 60 days.</p>}
        </section>
      </div>
    </main>
  )
}
