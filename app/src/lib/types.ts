export type Status = 'ANSWERED' | 'ANSWERED_GENERAL' | 'NEEDS_INPUT' | 'NOT_APPLICABLE' | 'REFUSED'
export type RegStatus = 'PROPOSED' | 'REVISED_PROPOSAL' | 'WITHDRAWN'
export type Verdict =
  | 'MODEL_LISTED_ALL_UNITS' | 'MODEL_LISTED_UNITS_UNCONFIRMED' | 'NEEDS_VARIANT'
  | 'NOT_LISTED' | 'UNDETERMINED' | 'NO_MODEL_GIVEN'

export interface Cite {
  docket: string; version_date: string; action: string; fr_citation: string
  pages: string; link: string; sheet_row: number; sentence: number
}
export interface Claim { id: string; text: string; cite: Cite }
export interface Candidate { docket: string; status: RegStatus; latest: string; first_sentence: string }
export interface Version { date: string; action: string; fr: string; pages: string; row: number; link: string }

export interface AskResult {
  status: Status
  query?: string
  ad: string | null
  config?: { model?: string | null; serial?: string | null }
  revision: { docket?: string; status?: RegStatus; versions?: Version[]; supersedes_ads?: string[]; withdrawn_by?: string | null }
  applicability: { verdict?: Verdict; reasons?: string[]; variants?: string[]; listed?: string[] }
  fields: {
    regulatory_status?: RegStatus; binding?: string; comments_due?: string; models_listed?: string[]
    scope_wording?: 'ALL' | 'CERTAIN' | 'UNCLEAR'; link?: string; supersedes_ads?: string[]; make?: string
    latest_publication?: string; count?: number; by_status?: Partial<Record<RegStatus, number>>
  }
  claims: Claim[]
  candidates: Candidate[]
  refusal?: { code: string; message: string } | null
  trace: string[]
  latency_ms: number
  answer?: { mode: 'extractive' | 'llm_verified'; sentences: { text: string; cites?: string[] }[]; rejected?: unknown[]; note?: string }
}

export interface Health { mode: string; rows: number; dockets: number; federal_register_pages: number; today: string }

export interface FleetDocket {
  docket: string; status: RegStatus; match: string; scope: string; subject: string
  latest: string; comments_due: string | null; comments_open: boolean; first_sentence: string
}
export interface FleetRow { model: string; known: boolean; dockets: FleetDocket[]; counts: Record<RegStatus, number>; open_comments: number }

export interface DocketSummary {
  docket: string; status: RegStatus; subject: string; make: string; models: string[]; scope: string
  latest: string; first: string; pt: string; pst: string; comments_due: string | null; first_sentence: string; versions: number
}

export interface EvalRow {
  q: string; cfg: Record<string, string>; want: string; got: string; ok: boolean
  got_docket: string | null; want_docket: string | null; app: string | null; code: string | null; base_ok: boolean; base_docket: string | null
}
export interface KnownFailure { q: string; cfg: Record<string, string>; why: string; impact: string; fix: string; got?: string; docket?: string; code?: string; verdict?: string }
export interface EvalResult {
  summary: {
    questions: number; fully_correct: string; unsafe: string; withdrawn: string
    baseline_fully_correct: string; baseline_unsafe: string; baseline_withdrawn: string
    latency_p50_ms: number; latency_max_ms: number
    corpus: { rows: number; dockets: number; federal_register_pages: number }
  }
  rows: EvalRow[]
  failures: KnownFailure[]
}

/** The contract the UI depends on. Today it is answered in the browser; the real backend implements the same routes. */
export interface TorqueApi {
  readonly kind: 'local' | 'http'
  health(): Promise<Health>
  models(): Promise<string[]>
  ask(query: string, cfg?: { model?: string | null; serial?: string | null }): Promise<AskResult>
  fleet(models: string[]): Promise<FleetRow[]>
  dockets(): Promise<DocketSummary[]>
  evaluate(): Promise<EvalResult>
}
