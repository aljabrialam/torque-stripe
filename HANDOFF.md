# Torque Stripe — Brainstorm & Handoff

> **Read this first if you are picking up this project (human or AI agent).**
> It is the single source of truth for what we are building, why, what exists, and what to do next.
> Last updated: 31 Oct 2026, ~12:15 SGT. **Submissions close 16:15; aim to submit by ~15:30.**

---

## 0. TL;DR

- **Event:** Autonomous SG 2026 hackathon, NUS (Acacia Hackathon Society x NUS Product Club), 31 Oct 2026.
- **Track:** AI & Aerospace (Airbus). **Challenge #4:** *"How might AI help people find, understand, and verify regulated technical information?"*
- **Product:** **Torque Stripe**, a web app where a licensed aircraft maintenance engineer asks about FAA proposed Airworthiness Directives (NPRMs) and gets **cited, model-checked, revision-aware answers, or a clear refusal**.
- **Core rule (non-negotiable):** **every safety decision is deterministic code.** Claude only rewords evidence the engine already selected. A deterministic verifier drops any reworded sentence it can't trace; on failure we show the verbatim source.
- **Name:** a torque stripe is the paint mark a technician puts on a fastener once it's been verified. It means "checked; if this mark moves, stop." That's what the product does for AD answers.
- **Tagline:** *The AI reads. The rules decide. The engineer signs.*
- **Status (12:15):** engine runs on the **real dataset** (431 rows, 323 dockets, 1,302 Federal Register pages). Gold set **42/42 correct, 0/16 unsafe, 6/6 withdrawals flagged** vs baseline **5/42, 16/16 unsafe, 0/6** (baseline gets exact docket lookup + BM25). Full web UI done (Ask console with per-model 3D, Fleet, Insights, Evaluation; light/dark; guided tour; mobile). Engine also ported to JS so the site runs **fully static** with no server. Playwright e2e: ALL PASS. Committed locally in git.
- **Update 12:50:** Pushed to https://github.com/aljabrialam/torque-stripe. Front end rebuilt as a **React app** (`app/`, Vite + React + TS + Tailwind, sepia glassmorphism) live at **https://torque-stripe.vercel.app**; it runs the same JS engine on the real data behind a `TorqueApi` adapter (`VITE_API_URL` switches to the real backend). Classic UI fallback: https://torque-stripe-classic.vercel.app. Smoke test: `cd app && node scripts/shots.mjs <url>` → RESULT: ALL PASS (42/42 and 0/16 checked live). Deploy React: `cd app && npm run build && mkdir -p dist/.vercel && cp ../web/dist/.vercel/project.json dist/.vercel/ && cd dist && vercel --prod --yes`.
- **Update 13:30:** Inspection stage now renders **solid PBR 3D** from the same 23 parametric archetypes (Render/Wire toggle; generic shapes, not CAD). README rewritten in the antabay style (summary table, mermaid flows, results). Videos: `app/film/out/torque-stripe-teaser.mp4` (30 s, music) and `torque-stripe-demo.mp4` (~2.5 min, narrated with macOS `say`, burned-in captions). Pipeline: `cd app && node scripts/capture.mjs && node scripts/film.mjs teaser 30 && node scripts/narrate.mjs && node scripts/film.mjs demo 24` (dev server must be running on :5173; don't edit app/src during a render, HMR reloads the page).
- **Deploys (13:45):** the Vercel project `torque-stripe` is Git-connected, so **every push to main redeploys production**. Root `vercel.json` now builds the React app (`app/dist`); no manual CLI deploy needed. The FastAPI config moved to `vercel.python.json` (deploy it as a separate project for the real backend). Classic UI fallback: torque-stripe-classic.vercel.app (static copy, not Git-connected).
- **Not done:** submission form, pitch rehearsal, upload the videos (YouTube) and link them in README. See §6 and §12.
---

## 1. Challenge #4 requirements (from the official brief)

| Requirement (brief wording) | How Torque Stripe meets it | Status |
|---|---|---|
| Traceable, context-aware search engine; ingests multi-page technical docs | Spreadsheet ingest → per-sentence records; SQLite FTS5 index over 1,302 FR pages of summaries | Done |
| Answers natural-language queries with citations | Every sentence is verbatim with docket, publication date, FR volume/number, page range, sheet row, sentence no. | Done |
| Refuse confidently when ambiguous | Statuses + refusal codes; never guesses | Done |
| **Specific references** | `cite` on every claim (see §5) | Done |
| **Zero hallucination** | LLM only rewords selected claims; verifier; verbatim fallback | Done |
| **Configuration filtering** | Model rules: exact / series (FAA "-200 series" convention) / family needs variant / not listed; "all" vs "certain" units | Done |
| **Revision logic** | Docket version chain (proposed → revised → corrected → withdrawn); superseded ADs; latest version decides status | Done |
| **Out of scope / contradicts documents / ambiguous** | `OUT_OF_SCOPE`, `CONTRADICTS_SOURCE`, `NEEDS_INPUT` | Done |
| **Clear communication of uncertainty** | `NEEDS_INPUT`, `REFUSED`, and `MODEL_LISTED_UNITS_UNCONFIRMED` when serial criteria aren't in the data | Done |
| **Sub-3 s retrieval across 1000+ pages** | 1,302 pages; p50 0.2 ms, max 9 ms | Done |
| Avoid LLM guessing | LLM never sees anything but selected claims; never decides status | Done |
| Avoid unformatted data | Structured JSON: status, fields, applicability, revision, claims, trace | Done |

---

## 2. The real dataset (read this before changing the parser)

File: `data/faa/ad_nprm.xlsx` (from the organisers' Drive folder "Challenge 4 Airbus / 432 Entries of FFA Airworthiness Directive"). One sheet, 22 columns, **431 non-empty rows**.

**It is NOT 432 full AD documents.** Each row is one Federal Register publication of a **proposed** AD (NPRM): metadata + a summary paragraph (≤ 294 words).

| Fact | Number | Consequence |
|---|---|---|
| Rows / unique dockets | 431 / 323 | 99 dockets have 2–4 versions → revision chain |
| Row actions (parsed from summary) | new AD 198, withdrawn 123, supersede 79, revised proposal 22, other 9 | Status depends on latest version |
| Docket status | proposed 188, withdrawn 123, revised 12 | Withdrawn proposals impose nothing |
| Model column filled | 86 rows | Rest parsed from summary text (FAA shorthand like "A330-243, -243F, -841") |
| Dockets with a parsed model list | **297 / 323 (92%)** | 26 dockets (seatbelts, "various rotorcraft"…) can't be model-checked → said so |
| Scope wording among parsed | all 101, certain 165, unclear 31 | "certain" → serial/config criteria are only in the full FR text → we **don't confirm** unit applicability |
| Serial ranges in data | none | Serial-level check impossible; we say so explicitly |
| Federal Register pages covered | **1,302** | Meets "1000+ pages" |
| Columns always empty | AC Reference, AIR Policy Reference, Additional Reference | Ignored |
| "Status" column | always "Current" | Useless; we derive status from summaries |

**Key nuance for the pitch:** these are **proposals, not ADs in force**. Every answer carries `binding: "No. This is a proposed rule (NPRM)…"`. A generic chatbot would tell a mechanic "you must do X".

> The Airbus PDF's rubric pages contain an older hidden draft layer ("Draft for discussion with Airbus", unweighted). Harmless. Follow the visible weighted rubric. A full scan of both PDFs found **no hidden prompts or instructions**.

---

## 3. Judging rubric (Airbus track; use the weighted version)

| Criterion | Weight | What wins it for us |
|---|---|---|
| Problem realism | 20% | Named user: **B1 licensed aircraft maintenance engineer / CAMO planner** tracking which proposed ADs affect their fleet. Status quo: reading Federal Register notices; withdrawn and revised proposals mixed in. |
| Technical soundness | 25% | Clear **LLM / non-LLM split**: rules for model coverage, revisions and status; LLM only for wording. |
| Honest evaluation | 20% | Real-data gold set + baseline + coverage stats + visible refusals + two gold-set errors we found and documented. |
| Trust & traceability | 20% | Citations to docket / FR volume / pages / sentence; "proposed, not binding" label; refusal path; trace. |
| Impact | 10% | Baseline 16/16 unsafe → 0/16; withdrawn flagged 0/6 → 6/6. |
| Time discipline | 5% | **Submit early**; 3-minute pitch. |

---

## 4. Why Challenge #4 (decision record)

Expected weighted score (rubric weights × estimated 1–5 scores × chance of finishing): **#4 90.0**, #1 69.0, #3 62.2, #5 60.6, #2 51.0. Under random ±1 error on every estimate (20,000 runs) #4 ranked first 97.9% of the time. Brief asks for exactly a rules-first, cited, refusing system. Multi-agent (that's #2) was rejected: the rubric penalises LLMs making legality/compliance decisions.

**Form factor:** responsive **web app** (laptop/tablet), not native mobile.

---

## 5. Architecture & code

```mermaid
flowchart LR
  Q[Query + aircraft model] --> P[Regex parser<br/>docket, AD no., model, serial, intent, topic]
  P --> S{Known docket / AD / model?<br/>topic terms in corpus?}
  S -- no --> R1[REFUSED]
  S -- yes --> F[Filter dockets by model rules]
  F --> I[BM25 over sentences<br/>+ per-docket relevance gate]
  I -- several equal --> L[NEEDS_INPUT: pick one / list]
  I -- one --> V[Version chain:<br/>proposed / revised / withdrawn]
  V --> A[Model applicability:<br/>exact, series, family, not listed;<br/>all vs certain units]
  A --> E[Verbatim sentences + structured fields<br/>each cited to docket / FR pages / sentence]
  E --> C[Claude rewords - optional]
  C --> VF{Verifier}
  VF -- fail --> X[Verbatim evidence]
  VF -- pass --> OK[Answer]
```

### Files

```
torque-stripe/
├── torquestripe/
│   ├── nprm.py          # REAL DATA: xlsx ingest, action type, model parsing, scope, docket version chains
│   ├── nprm_engine.py   # REAL DATA: query parsing, model rules, ranking, status, citations, fleet()
│   ├── parse.py / applicability.py / engine.py / index.py   # synthetic full-text AD engine (sample mode only)
│   ├── phrase.py        # optional Claude rewording + deterministic verify()
│   ├── api.py           # FastAPI: /health /ask /fleet /models /dockets /dockets/{d} /eval, serves static/ at /
│   └── static/
│       ├── index.html   # the whole UI (Ask console, Fleet, Insights, Evaluation, theme switch, tour)
│       ├── stage.js     # three.js r128 wireframe stage: 23 parametric aircraft/engine archetypes, zones, stripe states
│       ├── insights.js  # Insights view: 3D year x category landscape, makers bars, comment-deadline timeline, coverage
│       ├── motion.js    # motion.dev (inlined at build)
│       └── logo.svg favicon.svg icon-*.png apple-touch-icon.png og.png creator.jpg
├── web/
│   ├── engine.js        # JS port of the engine (Porter stemmer == SQLite's; exact FTS5 bm25)
│   ├── shim.js          # in-browser fetch shim answering the same API routes
│   ├── build.py         # -> web/dist/index.html (static site) + web/dist/artifact.html (Claude artifact)
│   ├── data.json        # dataset snapshot embedded by build.py
│   └── dist/            # BUILD OUTPUT: deployable static site
├── api/index.py + vercel.json   # Vercel Python entry (alternative to static deploy)
├── data/faa/ad_nprm.xlsx        # real dataset
├── data/sample/                 # 4 SYNTHETIC full-text ADs (serial-range demo), labelled synthetic
├── eval/gold_faa.json (42 q) + run_eval_faa.py + known_failures.json (4 honest failures shown in UI)
├── tests/e2e.py (Playwright) + parity_gen.py / parity.mjs (Python vs JS engine parity)
└── README.md (non-technical + technical), HANDOFF.md, LICENSE (MIT), requirements.txt
```

### Run

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...           # optional; server-side only; never commit, never in front-end
export ANTHROPIC_MODEL=claude-sonnet-5-5
uvicorn torquestripe.api:app --port 8000       # real data by default; UI at http://localhost:8000/
python3 eval/run_eval_faa.py                   # real-data eval (must stay 42/42, 0/16 unsafe)
python3 web/build.py                           # rebuild static site after ANY change to static/ or engine
pip install playwright && python3 tests/e2e.py http://localhost:8000   # must print RESULT: ALL PASS
python3 tests/parity_gen.py && node tests/parity.mjs                   # only if you touch an engine
```

Endpoints: `GET /health`, `POST /ask`, `POST /fleet`, `GET /models`, `GET /dockets`, `GET /dockets/{docket}`, `GET /eval`.

```bash
curl -X POST localhost:8000/ask -H 'content-type: application/json' \
  -d '{"query":"main rotor servo-control torque inspection","model":"AS350B3","use_llm":false}'
```

**Two engines, keep them in sync.** Python (`torquestripe/nprm_engine.py`) is the reference; `web/engine.js` is a port used by the static site. If you change a rule in one, change it in the other and run the parity test (expected ~494/495 structured; the remaining diffs are search tie-ordering).

### Statuses and verdicts

| `status` | Meaning |
|---|---|
| `ANSWERED` | Evidence found AND model confirmed for **all** units, or a list answer for a given model, or a withdrawn-proposal answer |
| `ANSWERED_GENERAL` | Information about the proposal, but unit-level applicability not confirmed (no model given, or "certain" units) |
| `NEEDS_INPUT` | Need exact model variant, or several dockets match (see `candidates`) |
| `NOT_APPLICABLE` | User's model isn't in the proposal's model list |
| `REFUSED` | `UNKNOWN_MODEL`, `UNKNOWN_AD`, `UNKNOWN_DOCKET`, `OUT_OF_SCOPE`, `NO_MATCH`, `CONTRADICTS_SOURCE` (question assumes a withdrawal or an AD link the notices don't support), `NOT_IN_DATA` (e.g. compliance times, which NPRM summaries don't state) |

| `applicability.verdict` | Meaning |
|---|---|
| `MODEL_LISTED_ALL_UNITS` | Model listed, summary says "all" |
| `MODEL_LISTED_UNITS_UNCONFIRMED` | Model listed, summary says "certain": criteria only in the full FR text |
| `NEEDS_VARIANT` | User gave a family (A330, A350-900) that matches several variants |
| `NOT_LISTED` | Not in list |
| `UNDETERMINED` | Proposal's model list not machine-readable |
| `NO_MODEL_GIVEN` | — |

**Model rules (deterministic):** exact match; `X series` covers `X…` (777-300 → 777-300ER); FAA convention `-200 series` covers `-2xx` (A330-200 → A330-243); user family `A350-900` matches listed `A350-941` → needs variant; bare `787` accepted only if it's a known family.

### `/ask` response (abridged, real data)

```json
{
  "status": "ANSWERED", "ad": "FAA-2026-11814",
  "revision": {"docket": "FAA-2026-11814", "status": "PROPOSED",
               "versions": [{"date": "2026-10-19", "action": "NEW_AD", "fr": "Federal Register, Volume 91 Number 200 (...)", "pages": "(Pages 66019-66022)", "row": 2, "link": "https://www.federalregister.gov/..."}],
               "supersedes_ads": [], "withdrawn_by": null, "resulting_ad": null},
  "applicability": {"verdict": "MODEL_LISTED_ALL_UNITS", "reasons": ["AS350B3 matches listed model AS350B3.", "Summary says the proposal applies to ALL units of the listed models."]},
  "fields": {"regulatory_status": "PROPOSED", "binding": "No. This is a proposed rule (NPRM), not an AD in force.",
             "comments_due": "2026-12-03 (open)", "models_listed": ["AS350B3", "..."], "scope_wording": "ALL", "link": "..."},
  "claims": [{"id": "FAA-2026-11814@2026-10-19:S3", "text": "This proposed AD would require an inspection of ...",
              "cite": {"docket": "FAA-2026-11814", "version_date": "2026-10-19", "action": "NEW_AD", "fr_citation": "...", "pages": "(Pages 66019-66022)", "link": "...", "sheet_row": 2, "sentence": 2}}],
  "candidates": [], "trace": ["intent=...", "model AS350B3 listed in N dockets", "..."], "latency_ms": 3.7,
  "answer": {"mode": "extractive|llm_verified", "sentences": [...], "rejected": [], "note": "..."}
}
```

### Results (real data, `eval/gold_faa.json`, 42 questions)

| Metric | Torque Stripe | Naive BM25 baseline |
|---|---|---|
| Fully correct (status + docket + verdict + field) | **42/42** | 5/42 |
| Unsafe answers (answered when it should refuse / ask / say not applicable) | **0/16** | 16/16 |
| Withdrawn proposals flagged as withdrawn | **6/6** | 0/6 |
| Latency over 1,302 pages | p50 0.2 ms, max 9 ms | |

**Honesty notes (say these in the pitch):**
- We wrote the gold set; **3 gold items were wrong** and were corrected only after reading the source summaries (VHF radio issue has two separate withdrawn proposals; an A350-941 landing-gear NPRM exists; the AmSafe seatbelt proposal was withdrawn). All noted in `gold_faa.json`.
- First run was 29/33 with 2 unsafe answers; fixes were general rules (series convention, stricter out-of-scope gate, per-docket relevance gate), not per-question patches.
- Model-list parse: 92% of dockets. Spot-check of 14 random parses found 1 bug (747SP), fixed.

### Visible failures (shown live in the Evaluation tab, from `eval/known_failures.json`)

1. Synonyms like "pulled back" aren't understood → safe refusal.
2. Vague question with several matching proposals is routed to the top one before a refusal names it.
3. Supersede notices: model list can describe the old AD's wider applicability.
4. 26 dockets have no model list → applicability unknown. **Found in testing:** the model filter used to drop them silently (a missed proposal); fixed, now kept and marked UNDETERMINED.

### Known limits

- Unit-level applicability for "certain" proposals (165 dockets) can't be confirmed: the dataset has no serial ranges. We say so and link the FR page.
- Scope "all" is read from the summary's first sentence; for supersede NPRMs this describes the old AD's applicability, which the new one may narrow ("also reduces the applicability").
- Intent detection is keyword regex; odd phrasing falls back to BM25.
- Verifier can't catch every meaning change; verbatim source always shown.

---

## 6. Next steps (priority order, as of 12:15)

| # | Task | Notes |
|---|---|---|
| 1 | **Push to GitHub** | Create empty public repo `aljabrialam/torque-stripe`, then `git remote add origin ... && git push -u origin main` (branch may be `master`; check `git branch`). Stray screenshots/logs already removed. |
| 2 | **Deploy to Vercel (static, recommended)** | See §12. Static = no server, no key, nothing to break during judging. |
| 3 | Verify live URL on desktop + phone; run `python3 tests/e2e.py <live-url>` | Tour, 10 demo chips, Fleet, Insights, Eval, theme switch |
| 4 | **Submit by ~15:30** at boardingpass.work/experience (one per table; need table number) | Link + short description (§13) |
| 5 | Rehearse 3-min pitch (§8) | Use the live URL, not localhost |
| 6 | Optional: Python deploy with Claude rewording on | Only after 1–4. Key as Vercel env var `ANTHROPIC_API_KEY` only. Set a Console spend limit. |
| 7 | Optional polish | Answer cache; version diff view |

Done already: web UI, fleet check, version timeline, live eval tab, Insights, 3D console, per-model silhouettes, light/dark, tour, mobile, e2e tests, JS port.

---

## 7. UI / UX (as built)

Minimal, no emojis, Apple-HIG-ish, one accent (#e8763f dark / #d9622b light), IBM Plex Mono for dockets/models/data, motion.dev entrances. Status colours always paired with text.

- **Top bar:** aircraft model field (autocomplete from `/models`), "Rules engine" pill, **System / Light / Dark** switch (localStorage `ts_theme`), `?` replays the tour.
- **Sidebar tabs:** Ask · Fleet · Insights · Evaluation.
- **Ask:** status strip (open proposals sparkline) → ask bar + demo chips → **console**: full-bleed three.js wireframe stage over a wireframe terrain, with overlays *Rule checks* (left; each deterministic check pass/fail) and *Proposal* (right; tiles, comment-deadline dial, version timeline). Below: answer card and cited source sentences.
- **3D stage (`stage.js`):** the shape is chosen from the **real model designation** by regex rules → 23 archetypes (narrow-body, wide-body, quad, jumbo hump, double-deck, rear-twin T-tail, trijet, bizjet, turboprop, GA high/low/twin, helicopters by blade count/fenestron/twin/tandem, high/low-bypass turbofan, turboshaft, turboprop engine). Rotors/props spin. The answer's topic highlights a zone (engines, gear, rotor, fuel, avionics, tail...). A "torque stripe" mark shows the verdict state: applied (answered), general, n/a, broken (refused/withdrawn), idle. **These are generic silhouettes, not CAD, not to scale, no liveries** — real per-model 3D files are licensed and not fetchable here. Say this if judges ask.
- **Fleet:** paste models → table of open proposals per model, withdrawn hidden.
- **Insights:** 3D landscape of proposals by year × category (stacked live/withdrawn; hover tooltip, click to list, zoom, table view), makers bar chart (click to filter), comment-deadline timeline (next 60 days), model-coverage bar.
- **Evaluation:** live gold-set run vs baseline + the 4 known failures shown honestly.
- **Brand:** plain-text "Built for Airbus Challenge #4 · Autonomous SG 2026". **No Airbus logo** (not ours to use; must not imply an official Airbus product). Creator credit card uses `creator.jpg`.

---

## 8. 3-minute demo script (real data)

| Time | Action | Proves |
|---|---|---|
| 0:00–0:20 | "A B1 engineer / CAMO planner: 431 FAA notices, 1,302 pages, proposals revised and withdrawn. Which ones touch my aircraft?" | Problem realism |
| 0:20–0:45 | Model AS350B3 → "main rotor servo-control torque inspection" → FAA-2026-11814, all units, comments open, tap [S3] | Traceability |
| 0:45–1:05 | Model AS350B on FAA-2026-11800 → ANSWERED; switch to AS350B3 → **Not applicable** | Configuration filtering |
| 1:05–1:25 | "Status of FAA-2026-1338" → revised proposal, supersedes 3 ADs, timeline | Revision logic |
| 1:25–1:40 | "Is FAA-2013-0541 still active?" → **Withdrawn · imposes nothing** | Revision logic, safety |
| 1:40–2:05 | "Does FAA-2026-1335 apply to my 787?" → needs variant; 787-9 → listed but "certain" units, can't confirm serial; A380-841 → refused | Honest uncertainty |
| 2:05–2:20 | "Why this answer": every step a rule; Claude only rewords | LLM / non-LLM split |
| 2:20–2:50 | Eval tab: 42/42, 0/16 unsafe vs baseline 5/42 and 16/16 unsafe; 92% model coverage; 2 gold errors we found | Honest evaluation |
| 2:50–3:00 | "The AI reads. The rules decide. The engineer signs." | Close |

---

## 9. Constraints & practicalities

- **Budget:** S$50 Claude Console credit. Claude is called only to reword answered questions (~1k tokens in / 200 out). Set a Console spend limit. Develop with `use_llm=false`. Cache. Sonnet, not Opus.
- **Secrets:** key only as a server env var; never in front-end code or the repo (`.env` is git-ignored).
- **Synthetic data:** `data/sample` ADs are invented and labelled; never present as real.
- **Dates:** "comments open/closed" uses the server's date (`today`); eval pins 2026-10-31.

---

## 10. Brainstorm space

**Open questions**
- Submission form fields; can a submission be edited after sending? Table number?
- Deadline is fixed: **16:15**. Judging 16:30–17:30.

**Ideas (only if core is done)**
- **Fleet check:** enter fleet models → table of open proposals per model, comment deadlines, withdrawn ones hidden.
- **Comment-deadline radar:** proposals affecting my fleet whose comment period is still open (operators can comment).
- **Version diff** for multi-version dockets.
- **Ingest-time LLM extraction (with span check)** for the 26 dockets without parsed models: accept only if every model string appears verbatim in the source.

**Do NOT do**
- Let the LLM decide applicability, revision, or status.
- Let the LLM answer from its own knowledge when retrieval is empty.
- Present proposals as binding, hide failures, or present synthetic data as real.

---

## 11. Prompt for another AI agent (copy-paste)

```
You are continuing a hackathon project called Torque Stripe (Airbus Challenge #4, Autonomous SG 2026, NUS, 31 Oct 2026).
Submissions close 16:15 SGT; we want to submit by 15:30. Prioritise shipping over new features.
Read HANDOFF.md fully first (sections 0, 2, 5, 6, 12). Then README.md.
Hard rules:
- Every safety decision (model applicability, revision/withdrawal status, answer status, refusal) stays deterministic code.
  The LLM may only reword claims the engine already selected; output must pass phrase.verify() or fall back to verbatim text.
- Never loosen refusals to make demos look better. Every answer must say proposals (NPRMs) are not binding.
- Never put the Anthropic API key in the repo, chat, or front-end code. Server env var only.
- No Airbus logo or anything implying an official Airbus product.
- Two engines exist (Python reference + web/engine.js port). Change both or neither; run parity.
Before and after any change run: python3 eval/run_eval_faa.py (must stay 42/42, 0/16 unsafe),
python3 web/build.py, and python3 tests/e2e.py <url> (must print RESULT: ALL PASS).
Don't edit gold answers to match the engine; only fix a gold item after checking the source, and record why in its "note".
Your next task is the top unfinished item in section 6 (GitHub push, then the static Vercel deploy in section 12).
```

---

## 12. Deploy

**Option A — static (recommended, ~2 min).** `web/dist/` is a complete site: engine, data, gold set and three.js (cdnjs) all run in the browser. No server, no API key.

```bash
python3 web/build.py                     # regenerate web/dist
cd web/dist && npx vercel --prod         # or Vercel dashboard: import repo, Root Directory = web/dist, Framework = Other, no build command
```
If importing the GitHub repo in the dashboard, set **Root Directory `web/dist`** so the root `vercel.json` (Python) is ignored. Vercel team used before: `aljs-projects`.

**Option B — Python (FastAPI on Vercel, enables Claude rewording).** Root `vercel.json` + `api/index.py` route everything to FastAPI. Add env vars `ANTHROPIC_API_KEY` (secret) and `ANTHROPIC_MODEL=claude-sonnet-5-5`. Cold starts take a few seconds (xlsx parse); warm the URL before judging. Only do this after Option A is live.

**Smoke test after deploy:** open the URL → tour appears → click chip "main rotor servo-control torque inspection" with model AS350B3 → ANSWERED, FAA-2026-11814, helicopter shape → Evaluation tab shows 42/42 → toggle Light/Dark → check on a phone.

---

## 13. Submission text (draft, copy-paste)

**Torque Stripe** — find, understand and verify FAA proposed Airworthiness Directives.
An engineer types their aircraft model and a question. Rule-based code (not an LLM) finds the proposal, checks the docket's revision/withdrawal history, checks the model against the proposal's model list (exact, series, family, "certain units"), and answers with cited Federal Register sentences, or refuses with a reason. Claude can only reword evidence the rules already selected, and a verifier rejects any rewording that changes numbers, adds negation or drifts from the source.
On 42 real questions: 42/42 correct and 0/16 unsafe answers, vs a search baseline at 5/42 and 16/16 unsafe. Every withdrawn proposal is flagged (6/6). Answers in under 10 ms over 1,302 pages.
*The AI reads. The rules decide. The engineer signs.*
