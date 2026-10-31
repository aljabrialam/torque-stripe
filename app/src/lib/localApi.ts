// In-browser adapter: runs the same deterministic rule engine as the Python reference (web/engine.js)
// over the real FAA NPRM dataset. No AI, no server. Answers are verbatim quotes.
import '../../../web/engine.js'
import data from '../../../web/data.json'
import gold from '../../../eval/gold_faa.json'
import knownFailures from '../../../eval/known_failures.json'
import type { AskResult, DocketSummary, EvalResult, EvalRow, FleetRow, Health, KnownFailure, TorqueApi } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Engine = any
const EngineCtor = (globalThis as any).TorqueEngine as new (data: unknown, today?: string) => Engine
interface Gold { q: string; cfg: Record<string, string>; status: string; docket?: string; reg?: string; app?: string; code?: string; due?: string; list?: boolean }

const later = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 0))

export function createLocalApi(): TorqueApi {
  const E: Engine = new EngineCtor(data)
  ;(globalThis as any).TS_DATA = data

  function evaluate(): EvalResult {
    const ev: Engine = new EngineCtor(data, '2026-10-31') // pinned date, same as eval/run_eval_faa.py
    const G = gold as Gold[]
    const rows: EvalRow[] = [], lat: number[] = []
    for (const g of G) {
      const r: AskResult = ev.ask(g.q, g.cfg); lat.push(r.latency_ms)
      let ok = r.status === g.status
      if ('docket' in g) ok = ok && r.ad === g.docket
      if ('reg' in g) ok = ok && r.fields.regulatory_status === g.reg
      if ('app' in g) ok = ok && r.applicability.verdict === g.app
      if ('code' in g) ok = ok && (r.refusal || ({} as any)).code === g.code
      if ('due' in g) ok = ok && r.fields.comments_due === g.due
      if (g.list) ok = ok && r.candidates.length > 1
      const bd: string | null = ev.baseline(g.q)
      const bok = g.status.startsWith('ANSWERED') && (!('docket' in g) || bd === g.docket) && g.reg !== 'WITHDRAWN' && g.status !== 'ANSWERED_GENERAL'
      rows.push({ q: g.q, cfg: g.cfg, want: g.status, got: r.status, ok, got_docket: r.ad, want_docket: g.docket || null,
        app: r.applicability.verdict || null, code: r.refusal?.code || null, base_ok: bok, base_docket: bd })
    }
    const n = rows.length, unsafe = rows.filter(x => !x.want.startsWith('ANSWERED')), wd = rows.filter((_, i) => G[i].reg === 'WITHDRAWN')
    const sl = [...lat].sort((a, b) => a - b)
    const failures = (knownFailures as KnownFailure[]).map(k => {
      const r: AskResult = ev.ask(k.q, k.cfg)
      return { ...k, got: r.status, docket: r.ad ?? undefined, code: r.refusal?.code, verdict: r.applicability.verdict }
    })
    return {
      summary: {
        questions: n, fully_correct: `${rows.filter(x => x.ok).length}/${n}`,
        unsafe: `${unsafe.filter(x => x.got.startsWith('ANSWERED')).length}/${unsafe.length}`,
        withdrawn: `${wd.filter(x => x.ok).length}/${wd.length}`,
        baseline_fully_correct: `${rows.filter(x => x.base_ok).length}/${n}`, baseline_unsafe: `${unsafe.length}/${unsafe.length}`,
        baseline_withdrawn: `0/${wd.length}`, latency_p50_ms: sl[Math.floor(sl.length / 2)], latency_max_ms: sl[sl.length - 1],
        corpus: { rows: ev.versions.length, dockets: Object.keys(ev.dockets).length, federal_register_pages: ev.totalPages },
      },
      rows, failures,
    }
  }

  return {
    kind: 'local',
    health: () => later<Health>({ mode: 'faa_nprm', rows: E.versions.length, dockets: Object.keys(E.dockets).length, federal_register_pages: E.totalPages, today: E.today }),
    models: () => later<string[]>(E.models()),
    ask: (query, cfg = {}) => later<AskResult>(E.ask(query, { model: cfg.model || undefined, serial: cfg.serial || undefined })),
    fleet: models => later<FleetRow[]>(E.fleet(models.map(m => m.trim()).filter(Boolean).slice(0, 25))),
    dockets: () => later<DocketSummary[]>(Object.values(E.dockets).map((d: any) => ({
      docket: d.group, status: d.status, subject: d.substantive.sub, make: d.substantive.mk, models: d.models, scope: d.substantive.sc,
      latest: d.latest.pub, first: d.versions[0].pub, pt: d.substantive.pt, pst: d.substantive.pst,
      comments_due: d.status !== 'WITHDRAWN' ? d.latest.due : null, first_sentence: d.substantive.s[0] || '', versions: d.versions.length,
    }))),
    evaluate: () => later(evaluate()),
  }
}
