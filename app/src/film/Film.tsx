import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Stage, type StageApi } from '../components/Stage'
import { Layer, Plate, Typed, ease, mix, out, prog, vis } from './kit'
import demoScript from './demo-script.json'
import briefScript from './brief-script.json'
import { mascotSvg } from '../components/mascot.js'

type ScriptLine = { shot: string; section: string; caption: string; say?: string; k?: number; demo?: string; title?: string; layout?: string; prefix?: string; src?: string }
type Line = ScriptLine & { start: number; dur: number }
interface Cam { kind: string; model: string; state: string; zone: string | null; az: number; el: number; zoom: number }

const params = new URLSearchParams(location.search)
const FILM = (['demo', 'brief'] as const).find(f => f === params.get('film')) ?? 'teaser'
const script: ScriptLine[] = FILM === 'brief' ? briefScript : demoScript
export const TEASER_LEN = 30

declare global { interface Window { __seek(t: number): Promise<void>; __ready: boolean; __length: number } }

/** Estimate when no narration timeline exists yet (preview only). */
const estimate = (): Line[] => { let s = 0; return script.map(l => { const dur = 0.6 + (l.say || l.caption).split(/\s+/).length / 2.7; const x = { ...l, start: s, dur }; s += dur; return x }) }

export function Film() {
  const [t, setT] = useState(Number(params.get('t') || 0))
  const [lines, setLines] = useState<Line[] | null>(FILM === 'teaser' ? [] : null)
  const stage = useRef<StageApi | null>(null)
  const length = FILM === 'teaser' ? TEASER_LEN : lines?.length ? lines[lines.length - 1].start + lines[lines.length - 1].dur + 1.5 : 0

  useEffect(() => {
    if (FILM === 'teaser') return
    fetch(`/film/audio/${FILM}-timeline.json`).then(r => r.ok ? r.json() : estimate()).catch(estimate).then(setLines)
  }, [])

  const camAt = (x: number): Cam => FILM === 'teaser' ? teaserCam(x) : demoCam(x, lines || [])
  const applyCam = (x: number) => {
    const c = camAt(x), s = stage.current; if (!s) return
    s.setKind(c.kind, c.model); s.setState(c.state); s.setZone(c.zone); s.setCamera({ az: c.az, el: c.el, zoom: c.zoom, spin: 0, lookY: 0.9 })
  }
  useEffect(() => {
    if (!lines) return
    const srcs = [...document.querySelectorAll('img')].map(i => i.src)
    const all = FILM === 'teaser' ? TEASER_PLATES : [...new Set(script.flatMap(l => platesFor(l)))]
    Promise.all([...new Set([...srcs, ...all.map(s => `/film/plates/${s}.jpg`)])].map(s => { const i = new Image(); i.src = s; return i.decode().catch(() => {}) }))
      .then(() => document.fonts.ready).then(() => {
        window.__length = length
        window.__seek = async (x: number) => {
          flushSync(() => setT(x)); applyCam(x)
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        }
        applyCam(t); window.__ready = true
      })
    if (params.has('play')) {
      const t0 = performance.now(); let raf = 0
      const loop = () => { const x = ((performance.now() - t0) / 1000) % length; setT(x); applyCam(x); raf = requestAnimationFrame(loop) }
      raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
    }
  }, [lines]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="film">
      <div className="sky" />
      <Stage ref={stage} />
      <div className="vignette" />
      <div className="fstage">{FILM === 'teaser' ? <Teaser t={t} /> : lines && <Demo t={t} lines={lines} />}</div>
      <div className="grain" />
    </div>
  )
}

/* ============================== TEASER (30 s, music only) ============================== */
const TEASER_PLATES = ['servo-console', 'servo-checks', 'servo-proposal', 'servo-card', 'servo-sources', 'withdrawn-card', 'variant-card', 'refused-card', 'eval-metrics', 'servo-radar']

function teaserCam(t: number): Cam {
  const heli = { kind: 'helicopter', model: 'AS350B3' }
  if (t < 4) return { ...heli, state: 'idle', zone: null, az: mix(-2.3, -1.5, ease(t / 4)), el: mix(1.0, 0.45, ease(t / 4)), zoom: mix(1.9, 1.25, ease(t / 4)) }
  if (t < 18) return { ...heli, state: t < 9 ? 'idle' : 'applied', zone: t > 9 ? 'rotor' : null, az: -1.5 + (t - 4) * 0.06, el: 0.42, zoom: 1.3 }
  if (t < 22.5) return { ...heli, state: 'broken', zone: null, az: -0.66 + (t - 18) * 0.05, el: 0.35, zoom: 1.35 }
  if (t < 26.5) return { kind: 'airliner', model: '787-9', state: 'general', zone: null, az: -0.9 + (t - 22.5) * 0.06, el: 0.5, zoom: 1.45 }
  return { ...heli, state: 'applied', zone: null, az: -1.2 + (t - 26.5) * 0.05, el: mix(0.4, 0.75, ease((t - 26.5) / 3.5)), zoom: mix(1.3, 1.7, ease((t - 26.5) / 3.5)) }
}

function Teaser({ t }: { t: number }) {
  return <>
    <div className="scrim" style={{ opacity: (vis(t, 0, 4.2, .01, .6) + vis(t, 26.6, 31, .8, 1)) * .55 }} />
    {/* A. title */}
    <Layer o={vis(t, 0.3, 4.2, 1.2, .6)}>
      <div className="title-block" style={{ transform: `translateY(${mix(14, 0, out(prog(t, .3, 2)))}px)` }}>
        <img className="cobrand" src="/cobrand.svg" alt="Torque Stripe × Airbus" />
        <div className="kicker">Autonomous SG 2026 · Airbus Challenge 4</div>
        <h1 className="mega" style={{ letterSpacing: `${mix(.12, -.01, out(prog(t, .3, 3)))}em` }}>Torque Stripe</h1>
        <p className="sub">Cited, rule-checked answers about FAA proposed airworthiness directives</p>
      </div>
    </Layer>
    {/* B. the console flies in */}
    {(() => { const k = ease(prog(t, 4, 6.6)), o = vis(t, 4, 9.3, .6, .5)
      return <Layer o={o}>
        <Plate src="servo-console" w={mix(1150, 1420, ease(prog(t, 4, 9.3)))} y={mix(640, 470, k)} rx={mix(42, 4, k)} z={mix(-500, 0, k)} glow />
        <Kicker t={t} a={5.4} b={9.2} text="Ask in plain words." />
      </Layer> })()}
    {/* C. panels explode into space */}
    {(() => { const k = ease(prog(t, 9, 11)), d = prog(t, 9, 14), o = vis(t, 9, 14.2, .5, .5)
      return <Layer o={o} style={{ transform: `rotateY(${mix(10, -8, d)}deg)` }}>
        <Plate src="servo-checks" w={600} x={mix(960, 560, k)} y={520} ry={14} z={mix(-300, 80, k)} glow />
        <Plate src="servo-proposal" w={560} x={mix(960, 1380, k)} y={500} ry={-14} z={mix(-300, 40, k)} glow />
        <Kicker t={t} a={10} b={14} text="Every safety decision is a rule." />
      </Layer> })()}
    {/* D. sources, scrolling close-up */}
    {(() => { const d = prog(t, 14, 18), o = vis(t, 14, 18.2, .5, .5)
      return <Layer o={o}>
        <Plate src="servo-sources" w={980} x={1080} y={mix(640, 470, ease(d))} rx={mix(24, 6, ease(d))} ry={-8} glow style={{ maxHeight: 'none' }} />
        <Plate src="servo-card" w={760} x={mix(380, 420, d)} y={560} ry={16} z={-200} o={.55} blur={1.5} />
        <Kicker t={t} a={14.6} b={18} text="Quoted word for word. Cited to the page." />
      </Layer> })()}
    {/* E. safety triptych */}
    {(() => { const o = vis(t, 18, 22.6, .5, .5)
      const card = (src: string, i: number) => { const k = ease(prog(t, 18.1 + i * .2, 19.1 + i * .2))
        return <Plate key={src} src={src} w={560} x={mix(960, 420 + i * 540, k)} y={mix(620, 520, k)} ry={(1 - i) * 10} rz={(i - 1) * mix(0, 2, k)} z={i === 1 ? 60 : 0} glow /> }
      return <Layer o={o}>{['withdrawn-card', 'variant-card', 'refused-card'].map(card)}
        <Kicker t={t} a={19} b={22.4} text="Withdrawn, needs input, refused. It says so." /></Layer> })()}
    {/* F. results */}
    {(() => { const k = ease(prog(t, 22.5, 26.5)), o = vis(t, 22.5, 26.7, .5, .5)
      return <Layer o={o}>
        <Plate src="eval-metrics" w={mix(1560, 1720, k)} y={mix(600, 520, k)} rx={mix(18, 2, k)} glow />
        <Kicker t={t} a={23.2} b={26.5} text="42 of 42 correct. 0 of 16 unsafe. Search baseline: 16 of 16 unsafe." />
      </Layer> })()}
    {/* G. close */}
    <Layer o={vis(t, 26.6, 31, .8, 1)}>
      <div className="title-block">
        <div style={{ transform: `scale(${mix(.8, 1, out(prog(t, 26.6, 28)))})` }}><img className="cobrand lg" src="/cobrand.svg" alt="Torque Stripe × Airbus" /></div>
        <h2 className="mega small">The AI reads. The rules decide.<br />The engineer signs.</h2>
        <p className="sub mono">torque-stripe.vercel.app</p>
        <div className="byline"><img src="/creator.jpg" alt="" /><span><b>Aljabri Alam</b><br />Technical Lead & AI Advocate</span></div>
        <p className="disc">Built for Airbus Challenge #4. Not an official Airbus product.</p>
      </div>
    </Layer>
    <div className="fade" style={{ opacity: 1 - Math.min(out(t / .8), out((TEASER_LEN - t) / .8)) }} />
  </>
}

function Kicker({ t, a, b, text }: { t: number; a: number; b: number; text: string }) {
  const o = vis(t, a, b, .5, .4)
  return o > 0 ? <div className="kick" style={{ opacity: o, transform: `translateY(${mix(10, 0, out(prog(t, a, a + .6)))}px)` }}>{text}</div> : null
}

/* ============================== DEMO (narrated, captioned) ============================== */
function platesFor(l: ScriptLine): string[] {
  const L = l as { layout?: string; prefix?: string; src?: string }
  if (L.src) return [L.src]
  if (!L.prefix) return ['eval-metrics', 'eval-fails', 'idle-console', 'askbar']
  if (L.layout === 'report') return ['report-top', 'report-bottom']
  return { full: [`${L.prefix}-console`], pair: [`${L.prefix}-checks`, `${L.prefix}-proposal`, `${L.prefix}-console`], card: [`${L.prefix}-card`, `${L.prefix}-sources`, `${L.prefix}-console`] }[L.layout || 'full'] || []
}
const SHOT_STAGE: Record<string, Partial<Cam>> = {
  servo: { kind: 'helicopter', model: 'AS350B3', state: 'applied', zone: 'rotor' },
  config: { kind: 'helicopter', model: 'AS350B3', state: 'na' },
  revision: { kind: 'airliner', model: 'A330-243', state: 'general' },
  withdrawn: { kind: 'airliner', model: '', state: 'applied' },
  variant: { kind: 'airliner', model: '787-9', state: 'broken' },
  refused: { kind: 'airliner', model: 'A380-841', state: 'broken', zone: 'gear' },
}
function demoCam(t: number, lines: Line[]): Cam {
  const l = lines.find(x => t >= x.start && t < x.start + x.dur) || lines[lines.length - 1]
  const s = SHOT_STAGE[l?.shot] || {}
  const pull = ['title', 'close', 'approach', 'problem'].includes(l?.shot)
  return { kind: 'helicopter', model: 'AS350B3', state: 'idle', zone: null, ...s, az: -1.6 + t * 0.035, el: pull ? 0.6 : 0.42, zoom: pull ? 1.55 : 1.3 } as Cam
}

const NODES = [
  ['Parse', 'docket, AD, model, intent'], ['Gate', 'unknown or out of scope: refuse'], ['Version chain', 'latest notice, withdrawn, superseded'],
  ['Model rules', 'exact, series, all vs certain units'], ['Evidence', 'verbatim sentences, cited'], ['Claude, optional', 'rewords only; verifier or verbatim'],
]
const NODE_LIT = [[0, 1], [2], [3], [4, 5]]

function Demo({ t, lines }: { t: number; lines: Line[] }) {
  const shots = useMemo(() => {
    const m: Record<string, { a: number; b: number; lines: Line[] }> = {}
    for (const l of lines) { (m[l.shot] ||= { a: l.start, b: 0, lines: [] }); m[l.shot].b = l.start + l.dur; m[l.shot].lines.push(l) }
    return m
  }, [lines])
  const cur = lines.find(x => t >= x.start && t < x.start + x.dur) || null
  const S = (id: string) => shots[id]
  const so = (id: string) => S(id) ? vis(t, S(id).a, S(id).b + .25, .45, .45) : 0
  const total = lines[lines.length - 1].start + lines[lines.length - 1].dur + 1.5
  const scrim = Math.min(1, ['title', 'hook', 'problem', 'approach', 'arch', 'results', 'close', 'brief', 'ingest', 'checklist'].reduce((m, id) => m + so(id), 0) + (t > (S('close')?.b ?? 1e9) ? 1 : 0))
  return <>
    <div className="scrim" style={{ opacity: scrim * .78 }} />
    {/* title */}
    <Layer o={so('title')}>
      <div className="title-block">
        <img className="cobrand" src="/cobrand.svg" alt="Torque Stripe × Airbus" />
        <div className="kicker">Autonomous SG 2026 · Airbus Challenge 4</div>
        <h1 className="mega">Torque Stripe</h1>
        <p className="sub">Find, understand and verify FAA proposed airworthiness directives</p>
        <p className="disc">Hackathon prototype built for Airbus Challenge #4. Not an official Airbus or FAA product.</p>
      </div>
    </Layer>
    {/* brief: the challenge's own words */}
    {S('brief') && <Layer o={so('brief')}>
      <div className="brief-card glass">
        <div className="kicker">Airbus Challenge #4 · what the brief asks for</div>
        <p className="brief-q">“A traceable and context-aware search engine that ingests multi-page technical documents, parses exact applicability rules, answers natural language queries with citations. If the information is ambiguous, it should confidently refuse to answer.”</p>
        <div className="brief-tags">{['Specific references', 'Zero hallucination', 'Configuration filtering', 'Revision logic', 'Clear uncertainty', 'Sub 3-second latency'].map((x, i) => <span key={x} style={{ opacity: out(prog(t, S('brief').a + 0.6 + i * 0.35, S('brief').a + 1 + i * 0.35)) }}>{x}</span>)}</div>
      </div>
    </Layer>}
    {/* ingest: corpus numbers */}
    {S('ingest') && <Layer o={so('ingest')}>
      <div className="stat-row" style={{ top: 300, gap: 90 }}>
        {[['431', 'FAA notices'], ['323', 'dockets'], ['1,302', 'Federal Register pages'], ['2,169', 'citable sentences']].map(([n, l], i) => {
          const o = out(prog(t, S('ingest').a + 0.3 + i * 0.5, S('ingest').a + 0.9 + i * 0.5))
          return <div key={l} style={{ opacity: o, transform: `translateY(${mix(16, 0, o)}px)` }}><div className="readout" style={{ fontSize: 132 }}>{n}</div><div className="sub">{l}</div></div>
        })}
      </div>
      <div className="risk" style={{ color: 'var(--sand-2)', fontSize: 34, top: 640 }}>Parsed into dockets, version chains, model lists and applicability scope, then indexed.</div>
    </Layer>}
    {/* checklist: every brief item, ticked */}
    {S('checklist') && <Layer o={so('checklist')}>
      <div className="check-wrap">
        <div className="check-torq" dangerouslySetInnerHTML={{ __html: mascotSvg('check', { size: 300 }) }} />
        <div className="check-list glass">
          <div className="kicker" style={{ marginBottom: 10 }}>The brief, checked</div>
          {[['Ingests 1,000+ pages, natural-language queries', 'real FAA data, 1,302 pages'], ['Specific references', 'docket, FR pages, sentence'], ['Zero hallucination', 'verbatim + verifier, 0/16 unsafe'],
            ['Configuration filtering', 'models and serial ranges as rules'], ['Revision logic', 'versions, latest, withdrawn'], ['Clear communication of uncertainty', 'ambiguous, outside data, contradicts'],
            ['Sub 3-second latency', 'under 10 ms worst case'], ['Avoids LLM guessing', 'rules decide, Claude only rewords'], ['Avoids unformatted data', 'structured JSON on every answer']].map(([a, d], i) => {
            const o = out(prog(t, S('checklist').a + 0.2 + i * 0.28, S('checklist').a + 0.5 + i * 0.28))
            return <div key={a} className="check-row" style={{ opacity: o, transform: `translateX(${mix(-14, 0, o)}px)` }}><span className="tick">✓</span><b>{a}</b><span>{d}</span></div>
          })}
        </div>
      </div>
    </Layer>}
    {/* hook: typed question */}
    {S('hook') && <Layer o={so('hook')}>
      <div className="fake-ask glass strong">
        <div className="fa-m"><span className="label">Aircraft or engine model</span><span className="mono">AS350B3</span></div>
        <div className="fa-q"><span className="label">Question</span><span><Typed text="Which proposed ADs touch my AS350B3?" t={t} a={S('hook').a + .4} dur={2.2} /></span></div>
        <span className="glass-btn pri">Check</span>
      </div>
    </Layer>}
    {/* problem */}
    {S('problem') && <Layer o={so('problem')}>
      <div className="stat-row">
        {[['431', 'FAA notices'], ['1,302', 'Federal Register pages'], ['123', 'withdrawn proposals']].map(([n, l], i) => {
          const a = S('problem').lines[1]?.start ?? S('problem').a, o = out(prog(t, a + i * .5, a + i * .5 + .6))
          return <div key={l} style={{ opacity: o, transform: `translateY(${mix(16, 0, o)}px)` }}><div className="readout" style={{ fontSize: 150 }}>{n}</div><div className="sub">{l}</div></div>
        })}
      </div>
      {(() => { const a = S('problem').lines[2]?.start; const o = a ? out(prog(t, a, a + .5)) : 0
        return <div className="risk" style={{ opacity: o }}>A chatbot doesn't know a proposal was withdrawn in 2014.</div> })()}
    </Layer>}
    {/* approach */}
    {S('approach') && <Layer o={so('approach')}>
      <div className="title-block">
        <h2 className="mega small">The AI reads. The rules decide.<br />The engineer signs.</h2>
        <div className="split">
          <div style={{ opacity: out(prog(t, S('approach').a + .3, S('approach').a + 1)) }}><b className="t-ok">Rules</b><span>docket, revision, model coverage, status, refusals</span></div>
          <div style={{ opacity: out(prog(t, S('approach').lines[1]?.start ?? 0, (S('approach').lines[1]?.start ?? 0) + .6)) }}><b className="t-warn">AI</b><span>rewords selected evidence only, then a verifier checks it</span></div>
        </div>
      </div>
    </Layer>}
    {/* architecture */}
    {S('arch') && <Layer o={so('arch')}>
      <div className="arch">
        {NODES.map(([n, d], i) => {
          const li = S('arch').lines.findIndex(l => t >= l.start && t < l.start + l.dur)
          const lit = li >= 0 && NODE_LIT[li]?.includes(i), seen = NODE_LIT.slice(0, Math.max(0, li) + 1).flat().includes(i)
          return <div key={n} className={`node glass${lit ? ' lit' : ''}`} style={{ opacity: seen ? 1 : .4 }}>
            <div className="n-i mono">{String(i + 1).padStart(2, '0')}</div><b>{n}</b><span>{d}</span>
          </div>
        })}
        <div className="zones"><span style={{ gridColumn: '1 / 6' }}>Deterministic rules</span><span style={{ gridColumn: '6 / 7' }}>AI, read-only</span></div>
      </div>
    </Layer>}
    {/* app demos */}
    {lines.filter(l => (l as { layout?: string }).layout).map((l, i) => <DemoShot key={i} l={l} t={t} />)}
    {/* results */}
    {S('results') && <Layer o={so('results')}>
      <Plate src="eval-metrics" w={mix(1600, 1700, prog(t, S('results').a, S('results').b))} y={470} rx={mix(10, 2, ease(prog(t, S('results').a, S('results').a + 2)))} glow
        o={1 - out(prog(t, (S('results').lines[2]?.start ?? 1e9), (S('results').lines[2]?.start ?? 1e9) + .5)) * .75} />
      {(() => { const a = S('results').lines[2]?.start ?? 1e9, o = out(prog(t, a, a + .6))
        return <Plate src="eval-fails" w={1400} y={mix(640, 520, o)} o={o} glow /> })()}
    </Layer>}
    {/* close */}
    <Layer o={so('close') + (t > (S('close')?.b ?? 1e9) ? 1 : 0)}>
      <div className="title-block">
        <img className="cobrand lg" src="/cobrand.svg" alt="Torque Stripe × Airbus" />
        <h2 className="mega small">The AI reads. The rules decide.<br />The engineer signs.</h2>
        <p className="sub mono">torque-stripe.vercel.app · github.com/aljabrialam/torque-stripe</p>
        <div className="byline"><img src="/creator.jpg" alt="" /><span><b>Aljabri Alam</b><br />Technical Lead & AI Advocate</span></div>
        <p className="disc">Built for Airbus Challenge #4. Not an official Airbus product.</p>
      </div>
    </Layer>

    {/* chrome */}
    {cur && cur.shot !== 'title' && cur.shot !== 'close' && <>
      <div className="chrome-tl"><span className="chip-s">{cur.section}</span><span className="badge"><span className="dot ok" />Live on torque-stripe.vercel.app</span></div>
      {(cur as { demo?: string }).demo && <div className="demo-t"><div className="label">{(cur as { demo?: string }).demo}</div><div className="dt">{(cur as { title?: string }).title}</div></div>}
    </>}
    {cur && <div className="caption" key={cur.caption}><span>{cur.caption}</span></div>}
    <div className="progress"><i style={{ width: `${t / total * 100}%` }} /></div>
    <div className="fade" style={{ opacity: 1 - Math.min(out(t / .8), out((total - t) / 1)) }} />
  </>
}

function DemoShot({ l, t }: { l: Line; t: number }) {
  const L = l as Line & { layout: string; prefix?: string; src?: string }
  const o = vis(t, l.start, l.start + l.dur + .2, .45, .45)
  if (o <= 0) return null
  const d = prog(t, l.start, l.start + l.dur), k = ease(prog(t, l.start, l.start + 1.2))
  const bg = L.prefix ? <Plate src={`${L.prefix}-console`} w={1760} y={560} o={.32} blur={3} z={-200} /> : null
  if (L.layout === 'full') return <Layer o={o}><Plate src={`${L.prefix}-console`} w={mix(1540, 1640, d)} y={mix(600, 560, k)} rx={mix(14, 2, k)} glow /></Layer>
  if (L.layout === 'report') return <Layer o={o}>
    <Plate src="report-top" w={600} x={mix(820, 700, k)} y={mix(560, 540, d)} ry={10} z={30} glow radius={6} />
    <Plate src="report-bottom" w={600} x={mix(1100, 1250, k)} y={mix(580, 540, d)} ry={-12} z={-20} glow radius={6} />
  </Layer>
  if (L.layout === 'single') return <Layer o={o}><Plate src={L.src!} w={mix(1540, 1620, d)} y={mix(620, 560, k)} rx={mix(12, 2, k)} glow /></Layer>
  if (L.layout === 'pair') return <Layer o={o}>{bg}
    <Plate src={`${L.prefix}-checks`} w={620} x={mix(860, 640, k)} y={540} ry={mix(4, 12, d)} z={mix(-100, 40, k)} glow />
    <Plate src={`${L.prefix}-proposal`} w={580} x={mix(1060, 1300, k)} y={530} ry={mix(-4, -12, d)} z={mix(-100, 20, k)} glow />
  </Layer>
  return <Layer o={o}>{bg}
    <Plate src={`${L.prefix}-card`} w={940} x={mix(820, 690, k)} y={mix(560, 530, d)} ry={8} z={30} glow />
    <Plate src={`${L.prefix}-sources`} w={640} x={mix(1300, 1440, k)} y={540} ry={-12} z={-40} glow o={1} />
  </Layer>
}
