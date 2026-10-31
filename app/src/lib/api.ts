import type { EvalResult, TorqueApi } from './types'
import { createLocalApi } from './localApi'

// Set VITE_API_URL (e.g. https://api.torquestripe.dev) to use the real backend. It must serve the same routes
// as torquestripe/api.py: GET /health /models /dockets /eval, POST /ask /fleet.
function createHttpApi(base: string): TorqueApi {
  const get = async <T,>(p: string): Promise<T> => {
    const r = await fetch(base + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json()
  }
  const post = async <T,>(p: string, body: unknown): Promise<T> => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json()
  }
  return {
    kind: 'http',
    health: () => get('/health'),
    models: () => get('/models'),
    ask: (query, cfg = {}) => post('/ask', { query, model: cfg.model ?? null, serial: cfg.serial ?? null, use_llm: true }),
    fleet: models => post('/fleet', { models }),
    dockets: () => get('/dockets'),
    evaluate: async () => {
      const r = await get<EvalResult & { summary: Record<string, unknown> }>('/eval'), s = r.summary
      const pick = (k: string, ...alt: string[]) => (s[k] ?? alt.map(a => s[a]).find(v => v != null)) as string
      return { ...r, summary: { ...(s as unknown as EvalResult['summary']),
        unsafe: pick('unsafe', 'unsafe_answers (answered when it should refuse/ask/say not applicable)'),
        withdrawn: pick('withdrawn', 'withdrawn proposals flagged as withdrawn'),
        baseline_unsafe: pick('baseline_unsafe', 'baseline_unsafe_answers'),
        baseline_withdrawn: pick('baseline_withdrawn', 'baseline_withdrawn_flagged') } }
    },
  }
}

const base = import.meta.env.VITE_API_URL as string | undefined
export const api: TorqueApi = base ? createHttpApi(base.replace(/\/$/, '')) : createLocalApi()
