import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './lib/api'
import type { AskResult, FleetRow, Health } from './lib/types'
import { kindFor, stripeState, zoneFor } from './lib/present'
import type { StageApi } from './components/Stage'
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
  const [fleetInfo, setFleetInfo] = useState<FleetRow | null>(null)
  const [arcLabel, setArcLabel] = useState('')
  const [zone, setZone] = useState<{ zone: string; label: string; word: string } | null>(null)
  const [tour, setTour] = useState(() => !localStorage.getItem('ts_tour_v3') && !new URLSearchParams(location.search).has('notour'))
  const stage = useRef<StageApi | null>(null)

  useEffect(() => { api.health().then(setHealth); api.models().then(setModels) }, [])
  useEffect(() => {
    const on = () => setView(viewFromHash())
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on)
  }, [])
  const go = (v: View) => { location.hash = `/${v}`; setView(v) }

  /** Push model + verdict to the 3D stage. Called on change and whenever the stage (re)mounts. */
  const syncStage = useCallback((r: AskResult | null = result) => {
    const s = stage.current; if (!s) return
    const m = model.trim(), k = kindFor(m)
    s.setKind(k, m); setArcLabel(m ? s.archetype(m, k)?.label || '' : '')
    if (!r) { s.setState('idle'); s.setZone(null); setZone(null); return }
    s.setState(stripeState(r).state)
    const z = zoneFor(r, s.kind() || 'airliner', n => !!s.hasZone(n)); s.setZone(z?.zone ?? null); setZone(z)
  }, [model, result])

  useEffect(() => {
    syncStage()
    const m = model.trim(); let live = true
    if (!m) { setFleetInfo(null); return }
    api.fleet([m]).then(([f]) => { if (live) setFleetInfo(f) })
    return () => { live = false }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = useCallback(async (q?: string, m?: string) => {
    const query_ = (q ?? query).trim(); if (!query_) return
    const model_ = (m ?? model).trim()
    if (q !== undefined) setQuery(q)
    if (m !== undefined) setModel(m)
    setBusy(true); stage.current?.scan()
    const r = await api.ask(query_, { model: model_ || null })
    setResult(r); setBusy(false)
    const s = stage.current
    if (s) {
      s.setKind(kindFor(model_), model_); s.setState(stripeState(r).state)
      const z = zoneFor(r, s.kind() || 'airliner', n => !!s.hasZone(n)); s.setZone(z?.zone ?? null); setZone(z)
    }
  }, [query, model])

  const openDocket = (d: string) => { go('ask'); ask(`Status of ${d}`) }

  return (
    <>
      <div className="sky" />
      <div className="vignette" />
      <div className="grain" />
      <div className="shell">
        <header className="topbar">
          <span className="tb-item brand"><Logo size={26} /><b>Torque Stripe</b></span>
          <span className="tb-item hide-sm"><span className="dot ok" />{health ? `${health.rows} notices · ${health.dockets} dockets · ${health.federal_register_pages.toLocaleString()} Federal Register pages` : 'Loading dataset'}</span>
          <span className="tb-sp" />
          <span className="tb-item hide-sm">Rules engine{api.kind === 'local' ? ', in your browser' : ', server'}</span>
          <span className="tb-item hide-sm mono">{health?.today ?? ''}</span>
          <button className="tb-help" onClick={() => setTour(true)} aria-label="Show the guided tour"><IconHelp /></button>
        </header>
        {view === 'ask' && <AskView {...{ model, setModel, query, setQuery, ask, result, busy, models, health, fleetInfo, arcLabel, zone, stage, openDocket }} onStageReady={() => syncStage()} />}
        {view === 'fleet' && <FleetView onOpen={openDocket} />}
        {view === 'insights' && <InsightsView onOpen={openDocket} today={health?.today ?? ''} />}
        {view === 'eval' && <EvalView />}
      </div>
      <nav className="dock glass" aria-label="Views">
        {VIEWS.map(({ id, label, Icon }) => (
          <button key={id} className="dock-btn" aria-current={view === id ? 'page' : undefined} onClick={() => go(id)} data-tab={id}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
      {tour && <Tour onClose={() => { setTour(false); localStorage.setItem('ts_tour_v3', '1') }} go={go} />}
    </>
  )
}
