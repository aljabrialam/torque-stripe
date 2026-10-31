import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './lib/api'
import type { AskResult, FleetRow, Health } from './lib/types'
import { kindFor, stripeState, zoneFor } from './lib/present'
import { Stage, type StageApi } from './components/Stage'
import { IconAsk, IconEval, IconFleet, IconHelp, IconInsights, Logo } from './components/Icons'
import { AskView } from './views/AskView'
import { FleetView } from './views/FleetView'
import { InsightsView } from './views/InsightsView'
import { EvalView } from './views/EvalView'
import { Tour } from './components/Tour'

export type View = 'ask' | 'fleet' | 'insights' | 'eval'
const VIEWS: { id: View; label: string; Icon: typeof IconAsk }[] = [
  { id: 'ask', label: 'Ask', Icon: IconAsk },
  { id: 'fleet', label: 'Fleet', Icon: IconFleet },
  { id: 'insights', label: 'Insights', Icon: IconInsights },
  { id: 'eval', label: 'Evaluation', Icon: IconEval },
]
const viewFromHash = (): View => {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as View
  return VIEWS.some(v => v.id === h) ? h : 'ask'
}

export default function App() {
  const [view, setView] = useState<View>(viewFromHash)
  const [health, setHealth] = useState<Health | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('AS350B3')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<AskResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [modelInfo, setModelInfo] = useState<{ label: string; fleet: FleetRow | null }>({ label: '', fleet: null })
  const [zone, setZone] = useState<{ zone: string; label: string; word: string } | null>(null)
  const [tour, setTour] = useState(() => !localStorage.getItem('ts_tour_v2') && !new URLSearchParams(location.search).has('notour'))
  const stage = useRef<StageApi | null>(null)

  useEffect(() => { api.health().then(setHealth); api.models().then(setModels) }, [])
  useEffect(() => {
    const on = () => setView(viewFromHash())
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on)
  }, [])
  const go = (v: View) => { location.hash = `/${v}`; setView(v) }

  // model -> stage silhouette + how many proposals list it
  useEffect(() => {
    const m = model.trim(), k = kindFor(m)
    stage.current?.setKind(k, m)
    const arc = stage.current?.archetype(m, k)
    let live = true
    if (!m) { setModelInfo({ label: '', fleet: null }); return }
    api.fleet([m]).then(([f]) => { if (live) setModelInfo({ label: arc?.label || '', fleet: f }) })
    return () => { live = false }
  }, [model])

  const ask = useCallback(async (q?: string, m?: string) => {
    const query_ = (q ?? query).trim(); if (!query_) return
    const model_ = (m ?? model).trim()
    if (q !== undefined) setQuery(q)
    if (m !== undefined) setModel(m)
    setBusy(true); stage.current?.scan()
    const r = await api.ask(query_, { model: model_ || null })
    setResult(r); setBusy(false)
    const s = stripeState(r); stage.current?.setState(s.state)
    const kind = stage.current?.kind() || 'airliner'
    const z = zoneFor(r, kind, n => !!stage.current?.hasZone(n)); stage.current?.setZone(z?.zone ?? null); setZone(z)
  }, [query, model])

  const openDocket = (d: string) => { go('ask'); ask(`Status of ${d}`) }

  return (
    <>
      <div className="sky" />
      <Stage ref={stage} dim={view !== 'ask'} />
      <div className="vignette" />
      <div className="grain" />
      <div className="shell">
        <nav className="rail glass" aria-label="Views">
          <a className="rail-logo" href="#/ask" onClick={() => go('ask')} aria-label="Torque Stripe home"><Logo /></a>
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} className="rail-btn" aria-current={view === id ? 'page' : undefined} onClick={() => go(id)} data-tab={id}>
              <Icon /><span>{label}</span>
            </button>
          ))}
          <span className="rail-gap" />
          <button className="rail-btn" onClick={() => setTour(true)} aria-label="Show the guided tour"><IconHelp /><span>Tour</span></button>
          <a className="rail-me" href="https://www.linkedin.com/in/aljabri-alam/" target="_blank" rel="noopener" title="Built by Aljabri Alam, Technical Lead & AI Advocate">
            <img src="/creator.jpg" alt="Aljabri Alam" width="40" height="40" /><span>Aljabri<br />Alam</span>
          </a>
        </nav>
        <header className="topbar">
          <span className="tb-item brand"><b>Torque Stripe</b></span>
          <span className="tb-item"><span className="dot ok" />Dataset · {health ? `${health.rows} notices · ${health.dockets} dockets · ${health.federal_register_pages.toLocaleString()} FR pages` : 'loading'}</span>
          <span className="tb-item hide-sm"><span className="dot" />Mode · rules engine{api.kind === 'local' ? ' · in browser' : ' · server'}</span>
          <span className="tb-sp" />
          <span className="tb-item hide-sm"><span className="dot" />Model · <span className="mono">{model || 'none'}</span></span>
          <span className="tb-item hide-sm"><span className="dot" />Today · <span className="mono">{health?.today ?? ''}</span></span>
        </header>
        {view === 'ask' && <AskView {...{ model, setModel, query, setQuery, ask, result, busy, models, health, modelInfo, zone, stage, openDocket }} />}
        {view === 'fleet' && <FleetView onOpen={openDocket} />}
        {view === 'insights' && <InsightsView onOpen={openDocket} today={health?.today ?? ''} />}
        {view === 'eval' && <EvalView />}
      </div>
      {tour && <Tour onClose={() => { setTour(false); localStorage.setItem('ts_tour_v2', '1') }} go={go} />}
    </>
  )
}
