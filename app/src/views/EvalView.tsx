import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { EvalResult } from '../lib/types'

const frac = (s: string) => { const [a, b] = s.split('/').map(Number); return { a, b } }

export function EvalView() {
  const [ev, setEv] = useState<EvalResult | null>(null)
  const [busy, setBusy] = useState(false)
  const run = () => { setBusy(true); api.evaluate().then(r => { setEv(r); setBusy(false) }) }
  useEffect(run, [])
  const s = ev?.summary
  const metric = (label: string, ours: string, base: string, goodHigh: boolean) => {
    const o = frac(ours), b = frac(base)
    return (
      <div className="glass card metric">
        <div className="label">{label}</div>
        <div className="readout" style={{ fontSize: 64 }}>{o.a}<small>/ {o.b}</small></div>
        <div className="m-bars">
          <div><span className="label">Torque Stripe</span><span className="mb"><i className={goodHigh ? 'good' : o.a ? 'bad' : 'good'} style={{ width: `${o.a / o.b * 100}%` }} /></span><span className="mono">{ours}</span></div>
          <div><span className="label">Search baseline</span><span className="mb"><i className={goodHigh ? 'base' : 'bad'} style={{ width: `${b.a / b.b * 100}%` }} /></span><span className="mono">{base}</span></div>
        </div>
      </div>
    )
  }
  return (
    <main className="view page scroll">
      <header className="page-h">
        <div>
          <h1>Evaluation</h1>
          <p className="lede">42 questions written against the real dataset, run live in your browser just now. The baseline gets exact docket lookup plus the same search, but no rules. We wrote the gold set; three gold answers were wrong and were fixed only after reading the source notices.</p>
        </div>
        <button className="glass-btn" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run evaluation again'}</button>
      </header>
      {s && <>
        <div className="metrics">
          {metric('Fully correct (status, docket, verdict, field)', s.fully_correct, s.baseline_fully_correct, true)}
          {metric('Unsafe answers (answered when it should refuse, ask or say not applicable)', s.unsafe, s.baseline_unsafe, false)}
          {metric('Withdrawn proposals flagged as withdrawn', s.withdrawn, s.baseline_withdrawn, true)}
          <div className="glass card metric">
            <div className="label">Rule check time over {s.corpus.federal_register_pages.toLocaleString()} Federal Register pages</div>
            <div className="readout" style={{ fontSize: 64 }}>{s.latency_p50_ms < 0.01 ? '<0.01' : s.latency_p50_ms.toFixed(2)}<small>ms p50</small></div>
            <div className="label">max {s.latency_max_ms.toFixed(1)} ms · {s.corpus.rows} notices · {s.corpus.dockets} dockets · target under 3 s</div>
          </div>
        </div>
        <section className="glass card">
          <div className="ph" style={{ padding: '0 0 10px' }}>Known failures<span className="meta">shown on purpose</span></div>
          <div className="fails">{ev!.failures.map((k, i) => (
            <div key={i} className="fail">
              <p className="q">“{k.q}”{k.cfg.model && <span className="mono label"> · {k.cfg.model}</span>}</p>
              <p><span className="label">Now returns</span> <span className="pill">{k.got}{k.code ? ` · ${k.code}` : ''}</span></p>
              <p><b>Why.</b> {k.why}</p><p><b>Impact.</b> {k.impact}</p><p><b>Fix.</b> {k.fix}</p>
            </div>
          ))}</div>
        </section>
        <section className="glass card" style={{ marginTop: 16 }}>
          <div className="ph" style={{ padding: '0 0 10px' }}>Every gold question<span className="meta">{ev!.rows.filter(r => r.ok).length} pass</span></div>
          <div className="scroll" style={{ maxHeight: 420 }}>
            <table className="evtab">
              <thead><tr><th>Question</th><th>Model</th><th>Expected</th><th>Got</th><th>Baseline</th></tr></thead>
              <tbody>{ev!.rows.map((r, i) => (
                <tr key={i}><td>{r.q}</td><td className="mono">{r.cfg.model || ''}</td><td className="mono">{r.want}</td>
                  <td className={`mono ${r.ok ? 't-ok' : 't-stop'}`}>{r.got}{r.got_docket ? ` · ${r.got_docket}` : ''}</td>
                  <td className={`mono ${r.base_ok ? 't-ok' : 't-stop'}`}>{r.base_ok ? 'correct' : r.want.startsWith('ANSWERED') ? 'wrong' : 'answered (unsafe)'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </>}
    </main>
  )
}
