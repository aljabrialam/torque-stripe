// Display helpers. They only describe the engine's result; they never decide anything.
import type { AskResult, RegStatus } from './types'

export type Tone = 'ok' | 'warn' | 'stop' | 'info' | 'mute'

export const REG: Record<RegStatus, [Tone, string]> = {
  PROPOSED: ['info', 'Proposed · not binding'],
  REVISED_PROPOSAL: ['info', 'Revised proposal · not binding'],
  WITHDRAWN: ['mute', 'Withdrawn · imposes nothing'],
}

export function headline(r: AskResult): { tone: Tone; label: string; head: string; lede?: string } {
  const m = r.config?.model, v = r.applicability?.verdict, f = r.fields || {}
  const reasons = (r.applicability.reasons || []).join(' ')
  if (r.status === 'REFUSED') return { tone: 'stop', label: 'Refused', head: "I can't answer that from this data", lede: r.refusal?.message }
  if (r.status === 'NOT_APPLICABLE') return { tone: 'mute', label: 'Not applicable', head: `${m} is not covered by ${r.ad}`, lede: reasons }
  if (r.status === 'NEEDS_INPUT') {
    if (v === 'NEEDS_VARIANT') return { tone: 'info', label: 'Needs input', head: `Which ${m} variant?`, lede: reasons }
    if (r.candidates?.length) return { tone: 'info', label: 'Needs input', head: 'Several proposals match. Which one?', lede: 'Pick a docket to see its details.' }
    return { tone: 'info', label: 'Needs input', head: 'Tell me the model or a docket', lede: 'Set an aircraft or engine model, or name a docket such as FAA-2026-11814.' }
  }
  if (r.candidates?.length && !r.ad) return { tone: 'ok', label: 'Answered', head: `${f.count} proposals list ${m || 'this topic'}`,
    lede: `${f.by_status?.PROPOSED ?? 0} proposed, ${f.by_status?.REVISED_PROPOSAL ?? 0} revised, ${f.by_status?.WITHDRAWN ?? 0} withdrawn. Newest first.` }
  if (f.regulatory_status === 'WITHDRAWN') return { tone: 'ok', label: 'Answered', head: `${r.ad} was withdrawn`, lede: 'This proposal imposes no requirement. The sentences below are quoted from the notice.' }
  if (v === 'MODEL_LISTED_ALL_UNITS') return { tone: 'ok', label: 'Answered', head: `Proposed for all ${m} units`, lede: 'The model is listed and the notice says the proposal applies to all units.' }
  if (v === 'MODEL_LISTED_UNITS_UNCONFIRMED') return { tone: 'info', label: 'Answered · units unconfirmed', head: `${m} is listed, but only certain units are covered`,
    lede: "The serial-number or configuration criteria are only in the full Federal Register text, which this dataset doesn't contain. Check them before acting." }
  if (v === 'UNDETERMINED') return { tone: 'info', label: 'Answered · applicability unknown', head: `About ${r.ad}`, lede: reasons }
  return { tone: 'info', label: 'Answered', head: `About ${r.ad}`, lede: 'Set your aircraft or engine model to check whether it is covered.' }
}

export interface Check { tone: Tone | 'na'; title: string; sub: string; state: string }

export function ruleChecks(r: AskResult | null): { checks: Check[]; pct: number } {
  if (!r) return { checks: [], pct: 0 }
  const f = r.fields || {}, app = r.applicability || {}, rev = r.revision || {}, c: Check[] = []
  if (r.status === 'REFUSED') c.push({ tone: 'stop', title: 'Answer refused', sub: r.refusal?.message || '', state: 'Stop' })
  if (r.ad) c.push({ tone: 'ok', title: 'Docket identified', sub: r.ad, state: 'Nominal' })
  else if (r.candidates?.length) c.push({ tone: r.status === 'ANSWERED' ? 'ok' : 'warn', title: 'Dockets matched', sub: `${r.candidates.length} proposals`, state: r.status === 'ANSWERED' ? 'Nominal' : 'Pick one' })
  else if (r.status !== 'REFUSED') c.push({ tone: 'warn', title: 'Docket', sub: 'Not identified yet', state: 'Input' })
  const vs = rev.versions || []
  if (vs.length) c.push({ tone: 'ok', title: 'Latest version used', sub: `${vs.length} version${vs.length > 1 ? 's' : ''}, newest ${vs[vs.length - 1].date}`, state: 'Nominal' })
  if (f.regulatory_status) {
    const wd = f.regulatory_status === 'WITHDRAWN'
    c.push({ tone: wd ? 'warn' : 'ok', title: 'Regulatory status', sub: wd ? 'Withdrawn, imposes nothing' : 'Proposed, not binding', state: wd ? 'Withdrawn' : 'Proposed' })
  }
  const V: Record<string, Check> = {
    MODEL_LISTED_ALL_UNITS: { tone: 'ok', title: 'Model listed', sub: 'All units covered', state: 'Nominal' },
    MODEL_LISTED_UNITS_UNCONFIRMED: { tone: 'warn', title: 'Model listed', sub: 'Only certain units; criteria in full text', state: 'Warn' },
    NOT_LISTED: { tone: 'stop', title: 'Model not listed', sub: 'This proposal does not cover it', state: 'Stop' },
    NEEDS_VARIANT: { tone: 'warn', title: 'Model family', sub: 'Give the exact variant', state: 'Input' },
    UNDETERMINED: { tone: 'warn', title: 'Model list', sub: 'Not machine-readable', state: 'Warn' },
    NO_MODEL_GIVEN: { tone: 'na', title: 'Model', sub: 'No model set', state: 'Skipped' },
  }
  if (app.verdict && V[app.verdict]) c.push(V[app.verdict])
  if (r.claims?.length && r.status !== 'REFUSED') c.push({ tone: 'ok', title: 'Evidence quoted', sub: `${r.claims.length} sentence${r.claims.length > 1 ? 's' : ''}, word for word`, state: 'Nominal' })
  const scored = c.filter(x => x.tone !== 'na'), ok = c.filter(x => x.tone === 'ok').length
  return { checks: c, pct: scored.length ? Math.round(ok / scored.length * 100) : 0 }
}

export type StripeState = 'applied' | 'general' | 'na' | 'broken' | 'idle'
export function stripeState(r: AskResult | null): { state: StripeState; text: string } {
  if (!r) return { state: 'idle', text: 'Waiting for a question' }
  const v = r.applicability?.verdict, f = r.fields || {}
  if (r.status === 'REFUSED') return { state: 'broken', text: 'Stripe broken · refused, nothing in the data supports an answer' }
  if (r.status === 'NEEDS_INPUT') return { state: 'broken', text: 'Stripe broken · needs more input before checking' }
  if (r.status === 'NOT_APPLICABLE') return { state: 'na', text: "No stripe · this proposal doesn't list the model" }
  if (f.regulatory_status === 'WITHDRAWN') return { state: 'applied', text: 'Stripe intact · verified withdrawn, imposes nothing' }
  if (v === 'MODEL_LISTED_ALL_UNITS' || (r.candidates?.length && r.status === 'ANSWERED')) return { state: 'applied', text: 'Stripe intact · rules confirm the model is listed' }
  return { state: 'general', text: 'Proposal found · your units not confirmed' }
}

const ZONE_RULES: [string, string, RegExp][] = [
  ['gear', 'Landing gear', /\b(landing gear|MLG|NLG|nose gear|main gear|brake\w*|wheel\w*|tire\w*|skid\w*|shock strut)\b/i],
  ['rotor', 'Rotor system', /\b(main rotor|tail rotor|rotor blade\w*|servo-control\w*|swashplate|rotor hub|MR |TR )\b/i],
  ['fan', 'Fan section', /\b(fan blade\w*|fan disk\w*|fan hub|fan case)\b/i],
  ['core', 'Engine core', /\b(compressor|turbine|HPT|HPC|LPT|combustor|disk\w*|hub\w*|air seal\w*)\b/i],
  ['engines', 'Engines', /\b(engine\w*|nacelle\w*|thrust reverser\w*|pylon\w*|strut\w*|APU)\b/i],
  ['fuel', 'Fuel system', /\b(fuel|tank\w*|boost pump\w*)\b/i],
  ['wings', 'Wings', /\b(wing\w*|spar\w*|flap\w*|slat\w*|aileron\w*|spoiler\w*|winglet\w*)\b/i],
  ['tail', 'Tail', /\b(stabilizer\w*|elevator\w*|rudder\w*|vertical fin|empennage|tail boom|tailcone)\b/i],
  ['avionics', 'Avionics bay', /\b(avionics|radio\w*|altimeter\w*|display\w*|VHF|software|flight control computer|autopilot|antenna\w*|wiring|electrical|panel\w*)\b/i],
  ['fuselage', 'Fuselage', /\b(fuselage|skin|lap splice|frame\w*|stringer\w*|door\w*|bulkhead\w*|floor beam\w*|cabin|seat\w*|window\w*|lavator\w*|galley)\b/i],
]
const ZONE_FALLBACK: Record<string, Record<string, string | null>> = {
  turbofan: { gear: null, rotor: null, fuel: 'core', wings: null, tail: null, avionics: 'core', fuselage: 'nacelle', engines: 'nacelle' },
  helicopter: { fan: 'engines', core: 'engines', wings: 'rotor' }, airliner: { rotor: null, fan: 'engines', core: 'engines' },
}
export function zoneFor(r: AskResult | null, kind: string, has: (z: string) => boolean) {
  const text = (r?.claims || []).map(c => c.text).join(' ')
  if (!r || !text || r.status === 'REFUSED') return null
  for (const [z, label, rx] of ZONE_RULES) {
    const m = rx.exec(text); if (!m) continue
    const fb = ZONE_FALLBACK[kind] || {}
    const zz = has(z) ? z : (fb[z] && has(fb[z]!) ? fb[z]! : null); if (!zz) continue
    return { zone: zz, label, word: m[0].trim() }
  }
  return null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function kindFor(m: string): 'airliner' | 'helicopter' | 'turbofan' {
  const u = (m || '').toUpperCase().replace(/\s+/g, '')
  const data = (globalThis as any).TS_DATA as any[] | undefined
  if (data && u) {
    const n = { airliner: 0, helicopter: 0, turbofan: 0 }
    for (const d of data) for (const v of d.v) if (v.m.some((x: string) => x.replace(/\*$/, '') === u)) {
      if (/engine/i.test(v.pt || '')) n.turbofan++; else if (/rotor/i.test(v.pst || '')) n.helicopter++; else n.airliner++
    }
    const best = (Object.entries(n) as [keyof typeof n, number][]).sort((a, b) => b[1] - a[1])[0]
    if (best[1]) return best[0]
  }
  if (/^(CFM|PW\d|GE\d|GENX|CF\d|TRENT|RB211|ARRIUS|PT6|LEAP|V25|TAY|AE\d|HTF)/.test(u)) return 'turbofan'
  if (/^(AS3|AS5|EC1|H1|BK|MBB|S-7|S-9|R22|R44|R66|AW1|AB1|20[46]|407|412|429|SA-3|SA3)/.test(u)) return 'helicopter'
  return 'airliner'
}

export const daysUntil = (iso: string, today: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 864e5)
