/* Torque Stripe rule engine, browser port of torquestripe/nprm_engine.py.
   Every decision (docket, revision, withdrawal, model coverage, status, refusal) is a rule here.
   No AI is involved. Parity with the Python engine is checked by tests/parity.py. */
(function (root) {
"use strict";

// ---------- text helpers (match torquestripe/index.py) ----------
const STOP = new Set(`a an and are as at be by can do does for from has have how i if in is it its
me my of on or our should that the this to was we what when where which who why will with
you your ad ads apply applies applicable need required were been being did has had there they them those these about into than then so`.split(/\s+/));
const terms = q => (q.toLowerCase().match(/[a-z0-9][a-z0-9\-/]*/g) || []).filter(t => !STOP.has(t) && t.length > 1);
const normModel = m => m.toUpperCase().replace(/\s+/g, " ").replace(/^[ ,.;]+|[ ,.;]+$/g, "").replace(/ FREIGHTER/g, "F").replace(/ /g, "");

// ---------- Porter stemmer (same algorithm as SQLite FTS5 'porter') ----------
const porter = (() => {
  const step2 = { ational: "ate", tional: "tion", enci: "ence", anci: "ance", izer: "ize", bli: "ble", alli: "al", entli: "ent", eli: "e", ousli: "ous",
    ization: "ize", ation: "ate", ator: "ate", alism: "al", iveness: "ive", fulness: "ful", ousness: "ous", aliti: "al", iviti: "ive", biliti: "ble", logi: "log" };
  const step3 = { icate: "ic", ative: "", alize: "al", iciti: "ic", ical: "ic", ful: "", ness: "" };
  const c = "[^aeiou]", v = "[aeiouy]", C = c + "[^aeiouy]*", V = v + "[aeiou]*";
  const mgr0 = new RegExp("^(" + C + ")?" + V + C), meq1 = new RegExp("^(" + C + ")?" + V + C + "(" + V + ")?$"),
        mgr1 = new RegExp("^(" + C + ")?" + V + C + V + C), sV = new RegExp("^(" + C + ")?" + v);
  return w => {
    if (w.length < 3) return w;
    let stem, suffix, re, re2, re3, re4;
    const first = w[0]; if (first === "y") w = "Y" + w.slice(1);
    re = /^(.+?)(ss|i)es$/; re2 = /^(.+?)([^s])s$/;
    if (re.test(w)) w = w.replace(re, "$1$2"); else if (re2.test(w)) w = w.replace(re2, "$1$2");
    re = /^(.+?)eed$/; re2 = /^(.+?)(ed|ing)$/;
    if (re.test(w)) { const fp = re.exec(w); if (mgr0.test(fp[1])) w = w.replace(/.$/, ""); }
    else if (re2.test(w)) {
      const fp = re2.exec(w); stem = fp[1];
      if (sV.test(stem)) {
        w = stem; re2 = /(at|bl|iz)$/; re3 = /([^aeiouylsz])\1$/; re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
        if (re2.test(w)) w += "e"; else if (re3.test(w)) w = w.replace(/.$/, ""); else if (re4.test(w)) w += "e";
      }
    }
    re = /^(.+?)y$/; if (re.test(w)) { const fp = re.exec(w); stem = fp[1]; if (sV.test(stem)) w = stem + "i"; }
    re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
    if (re.test(w)) { const fp = re.exec(w); stem = fp[1]; suffix = fp[2]; if (mgr0.test(stem)) w = stem + step2[suffix]; }
    re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
    if (re.test(w)) { const fp = re.exec(w); stem = fp[1]; suffix = fp[2]; if (mgr0.test(stem)) w = stem + step3[suffix]; }
    re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/; re2 = /^(.+?)(s|t)(ion)$/;
    if (re.test(w)) { const fp = re.exec(w); stem = fp[1]; if (mgr1.test(stem)) w = stem; }
    else if (re2.test(w)) { const fp = re2.exec(w); stem = fp[1] + fp[2]; if (mgr1.test(stem)) w = stem; }
    re = /^(.+?)e$/;
    if (re.test(w)) { const fp = re.exec(w); stem = fp[1]; re2 = new RegExp("^" + C + v + "[^aeiouwxy]$");
      if (mgr1.test(stem) || (meq1.test(stem) && !re2.test(stem))) w = stem; }
    if (/ll$/.test(w) && mgr1.test(w)) w = w.replace(/.$/, "");
    if (first === "y") w = "y" + w.slice(1);
    return w;
  };
})();
const toks = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).map(porter);

// ---------- regexes (match Python) ----------
const AD_NUM = /\b((?:19|20)\d{2}-\d{2}-\d{2})\b/g;
const DOCKET = /\b(FAA-\d{4}-\d{3,6}(?:R\d+)?|\d{4}-[A-Z]{2,3}-\d{1,4}-AD)\b/gi;
const MODEL_IN_Q = /\b(?:[A-Z]{1,8}[-]?\d\w*(?:[-/]\w+)*|\d{3}-\d{1,3}\w*|[A-Z]+-[IVX]+)\b/g;
const SERIAL_IN_Q = /\b(MSN|S\/N|SN|ESN|serial(?:\s+number)?|line(?:\s+number)?|LN)\s*[:#]?\s*(\d{2,})/i;
const INTENTS = [
  ["status", /\b(withdraw\w*|status|still (open|active|proposed)|latest|current|revis\w*|final(ised|ized)?|in (force|effect))\b/i],
  ["supersede", /\b(supersed\w*|replac\w*|which ad|existing ad)\b/i],
  ["comments", /\b(comment\w*)\b/i],
  ["compliance_time", /\b(when|how (long|soon)|by when|deadline|due)\b.*\b(inspect\w*|finish\w*|complet\w*|comply|compliance|do (it|this|the)|replace\w*|modif\w*)\b|\bcompliance time\b/i],
  ["reason", /\b(why|reason|prompted|unsafe|cause|what happened)\b/i],
  ["requirements", /\b(requir\w*|propos\w* to|what does .* propose|what (does|would) .* (do|require)|actions?|inspect\w*|replace\w*|must)\b/i],
  ["list", /\b(any|which|list|all|show)\b.*\b(nprms?|ads?|proposals?|proposed)\b/i],
];
const INTENT_SENT = {
  requirements: /\bwould (also )?(require|prohibit|continue|mandate|revise)|\bproposes? to require\b|\bwould require\b|\brequires\b/i,
  reason: /\bprompted by\b|\bsince the faa issued\b|\bwas notified\b|\bif not addressed\b|\bcould result\b|\bto address\b/i,
  supersede: /\bsupersed|\brequires\b/i,
  status: /\bwithdraw|\brevis|\bcorrect|\breopen/i,
};
const INTENT_WORDS = new Set(`withdraw withdrawn withdrawal status still open active proposed latest current revised revision
final finalised finalized force effect supersede supersedes superseded replace replaces replaced existing comment comments
due date deadline why reason prompted unsafe cause happened require requires required requirement requirements propose
proposes proposal proposals action actions must any which list all show nprm nprms ads model models aircraft airplane
airplanes engine engines helicopter helicopters msn serial number line faa`.split(/\s+/));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const uniq = a => [...new Set(a)];

class Engine {
  constructor(data, today) {
    this.today = today || new Date().toISOString().slice(0, 10);
    this.minCoverage = 0.75;
    this.dockets = {}; this.byDocket = {}; this.adsMentioned = {}; this.versions = [];
    for (const d of data) {
      const D = { group: d.g, versions: d.v, withdrawnBy: d.wb };
      D.latest = d.v[d.v.length - 1];
      D.status = (d.wb || D.latest.a === "WITHDRAWN") ? "WITHDRAWN" : d.v.length > 1 ? "REVISED_PROPOSAL" : "PROPOSED";
      D.substantive = [...d.v].reverse().find(v => v.a !== "WITHDRAWN" && v.a !== "CORRECTION") || d.v[0];
      D.models = []; for (const v of d.v) for (const m of v.m) if (!D.models.includes(m)) D.models.push(m);
      this.dockets[d.g] = D;
      for (const v of d.v) { this.byDocket[v.d.toUpperCase()] = D; this.versions.push(v); v.group = d.g;
        for (const a of v.ads.concat(v.adn ? [v.adn] : [])) { (this.adsMentioned[a] ||= []); if (!this.adsMentioned[a].includes(d.g)) this.adsMentioned[a].push(d.g); } }
      this.byDocket[d.g.toUpperCase()] = D;
    }
    this.allModels = new Set(Object.values(this.dockets).flatMap(d => d.models));
    this.totalPages = this.versions.reduce((s, v) => s + (v.pc || 0), 0);
    this._index();
  }

  // ---------- BM25 index (FTS5-compatible scoring: k1=1.2, b=0.75, weights subject .5, make .5, body 1) ----------
  _index() {
    this.rows = []; this.vocab = new Set();
    for (const v of this.versions) v.s.forEach((s, i) => {
      const cols = [toks(v.sub), toks(v.mk), toks(s)];
      this.rows.push({ g: v.group, row: v.row, idx: i, cols });
      for (const t of terms(`${v.sub} ${v.mk} ${s}`)) this.vocab.add(t);
    });
    this.N = this.rows.length;
    this.avg = [0, 1, 2].map(c => this.rows.reduce((s, r) => s + r.cols[c].length, 0) / this.N);
    this.stems5 = new Set([...this.vocab].filter(v => v.length >= 5).map(v => v.slice(0, 5)));
    this.docWords = {};
    for (const [g, d] of Object.entries(this.dockets))
      this.docWords[g] = new Set(d.versions.flatMap(v => terms(v.s.join(" ") + " " + v.sub)).map(w => w.slice(0, 5)));
  }
  _phraseHits(col, ph) {          // positions where phrase ph (array of stems) occurs in column tokens
    let n = 0; for (let i = 0; i + ph.length <= col.length; i++) { let ok = true; for (let j = 0; j < ph.length; j++) if (col[i + j] !== ph[j]) { ok = false; break; } if (ok) n++; } return n;
  }
  _search(qTerms, groups, k = 60) {
    if (!qTerms.length) return [];
    const phrases = qTerms.map(t => toks(t)).filter(p => p.length);
    const W = [0.5, 0.5, 1.0], k1 = 1.2, b = 0.75;
    const nDocs = phrases.map(ph => this.rows.reduce((s, r) => s + (r.cols.some(c => this._phraseHits(c, ph)) ? 1 : 0), 0));
    const idf = nDocs.map(n => Math.max(1e-6, Math.log((this.N - n + 0.5) / (n + 0.5))));
    // FTS5 bm25(): per phrase, column-weighted frequency; document length = whole row (all indexed columns)
    const avgdl = this.avg[0] + this.avg[1] + this.avg[2];
    const scored = [];
    for (const r of this.rows) {
      const D = r.cols[0].length + r.cols[1].length + r.cols[2].length;
      let score = 0, any = false;
      phrases.forEach((ph, pi) => {
        let f = 0;
        for (let c = 0; c < 3; c++) { const tf = this._phraseHits(r.cols[c], ph); if (tf) { any = true; f += W[c] * tf; } }
        if (f) score += idf[pi] * (f * (k1 + 1)) / (f + k1 * (1 - b + b * D / avgdl));
      });
      if (any) scored.push([r.g, r.row, r.idx, score]);
    }
    scored.sort((a, b2) => b2[3] - a[3]);
    return scored.slice(0, 400).filter(x => !groups || groups.has(x[0])).slice(0, k);
  }
  _coverage(ts) { if (!ts.length) return 1; return ts.filter(t => this.vocab.has(t) || (t.length >= 5 && this.stems5.has(t.slice(0, 5)))).length / ts.length; }
  _docCoverage(g, ts) { if (!ts.length) return 1; const w = this.docWords[g]; return ts.filter(t => w.has(t.slice(0, 5))).length / ts.length; }

  // ---------- model rules ----------
  static inSeries(u, base) {
    if (u.startsWith(base)) return true;
    const m = /^(.*-\d)00$/.exec(base);
    return !!(m && new RegExp("^" + esc(m[1]) + "\\d{2}[A-Z]*$").test(u));
  }
  static matchModel(user, listed) {
    const u = normModel(user), strip = m => m.replace(/\*$/, "");
    const alias = /[A-Z]/.test(u) && /\d/.test(u) && u.length >= 3;
    const exact = listed.filter(m => strip(m) === u || (alias && strip(m).endsWith("-" + u)));   // GVII-G500 ~ G500
    if (exact.length) return [exact[0].endsWith("*") ? "SERIES" : "EXACT", exact];
    const series = listed.filter(m => m.endsWith("*") && Engine.inSeries(u, m.slice(0, -1)));
    if (series.length) return ["SERIES", series];
    const fam = /^(.*-\d)00$/.exec(u);
    const family = listed.filter(m => strip(m).startsWith(u + "-") || strip(m).startsWith(u) ||
      (fam && new RegExp("^" + esc(fam[1]) + "\\d{2}[A-Z]*$").test(strip(m))));
    if (family.length) return ["FAMILY_ONLY", family];
    return ["NONE", []];
  }
  knownModel(tok) { const u = normModel(tok); for (const m of this.allModels) if (Engine.matchModel(u, [m])[0] !== "NONE") return true; return false; }

  // ---------- parse ----------
  _parse(q, cfg) {
    const p = { dockets: (q.match(DOCKET) || []).map(s => s.toUpperCase()) };
    let qw = q.replace(DOCKET, " ");
    p.ads = qw.match(AD_NUM) || []; qw = qw.replace(AD_NUM, " ");
    const s = SERIAL_IN_Q.exec(qw);
    p.serial = cfg.serial || (s ? s[2] : null);
    if (s) qw = qw.replace(s[0], " ");
    let tk = (qw.match(MODEL_IN_Q) || []).filter(t => /\d/.test(t) || /-[IVX]+$/.test(t));
    for (const t of (qw.match(/(?<![\w-])\d{3}(?![\w-])/g) || [])) if (this.knownModel(t) && !tk.includes(t)) tk.push(t);
    p.model = cfg.model || null; p.unknownModels = [];
    for (const t of tk) { if (this.knownModel(t)) p.model = p.model || normModel(t); else p.unknownModels.push(t); qw = qw.split(t).join(" "); }
    p.intent = (INTENTS.find(([, rx]) => rx.test(q)) || [null])[0];
    p.topic = terms(qw).filter(t => !INTENT_WORDS.has(t) && !STOP.has(t) && !/^\d+$/.test(t));
    return p;
  }

  // ---------- main ----------
  ask(query, config = {}) {
    const t0 = performance.now();
    const cfg = Object.fromEntries(Object.entries(config || {}).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    const p = this._parse(query, cfg);
    const r = { status: "REFUSED", query, config: { model: p.model, serial: p.serial }, ad: null, revision: {}, applicability: {},
      fields: {}, claims: [], refusal: null, needs: [], candidates: [], trace: [], latency_ms: 0 };
    this._run(query, p, r);
    r.latency_ms = Math.round((performance.now() - t0) * 100) / 100;
    r.answer = { mode: "extractive", sentences: r.claims.map(c => ({ text: c.text, cites: [c.id], verified: true })), rejected: [] };
    return r;
  }
  _refuse(r, code, msg) { r.status = "REFUSED"; r.refusal = { code, message: msg }; r.trace.push(`REFUSE ${code}: ${msg}`); }

  _run(q, p, r) {
    r.trace.push(`intent=${p.intent} model=${p.model} serial=${p.serial} topic=[${p.topic.join(", ")}]`);
    if (p.unknownModels.length && !p.model)
      return this._refuse(r, "UNKNOWN_MODEL", `${p.unknownModels.join(", ")} does not appear in any NPRM in this dataset, so I can't say whether any proposal covers it.`);
    let groups;
    if (p.dockets.length) {
      const missing = p.dockets.filter(d => !this.byDocket[d]);
      if (missing.length) return this._refuse(r, "UNKNOWN_DOCKET", `Docket ${missing.join(", ")} is not in this dataset.`);
      groups = [this.byDocket[p.dockets[0]].group]; r.trace.push(`docket named in query -> ${groups[0]}`);
    } else if (p.ads.length) {
      const hits = p.ads.flatMap(a => this.adsMentioned[a] || []);
      if (!hits.length) return this._refuse(r, "UNKNOWN_AD", `AD ${p.ads.join(", ")} isn't referenced by any NPRM in this dataset. This dataset holds proposals only, not the full AD register.`);
      groups = uniq(hits); r.trace.push(`AD ${p.ads.join(", ")} referenced by dockets ${groups.join(", ")}`);
    } else {
      let pool = new Set(Object.keys(this.dockets));
      if (p.model) {
        pool = new Set(Object.entries(this.dockets).filter(([, d]) => !d.models.length || Engine.matchModel(p.model, d.models)[0] !== "NONE").map(([g]) => g));
        r.trace.push(`model ${p.model} listed in ${pool.size} dockets`);
        if (!pool.size) return this._refuse(r, "UNKNOWN_MODEL", `No NPRM in this dataset lists model ${p.model}.`);
      }
      if (p.topic.length) {
        const cov = this._coverage(p.topic); r.trace.push(`topic coverage=${cov.toFixed(2)}`);
        if (cov < this.minCoverage) return this._refuse(r, "OUT_OF_SCOPE", "The question uses terms that don't appear in any NPRM in this dataset.");
        const best = {};
        for (const [g, , , sc] of this._search(p.topic, pool)) best[g] = Math.max(best[g] || 0, sc);
        let ranked = Object.entries(best).sort((a, b) => b[1] - a[1]);
        if (!ranked.length) return this._refuse(r, "NO_MATCH", "No NPRM matches this question" + (p.model ? ` for model ${p.model}.` : "."));
        r.trace.push("ranked " + ranked.slice(0, 5).map(([g, s]) => `${g}:${s.toFixed(1)}`).join(", "));
        ranked = ranked.filter(([g]) => this._docCoverage(g, p.topic) >= 0.5);
        if (!ranked.length) return this._refuse(r, "NO_MATCH", "No NPRM" + (p.model ? ` for ${p.model}` : "") + " mentions most of: " + p.topic.join(", ") + ".");
        const top = ranked[0][1], close = ranked.filter(([, s]) => s >= 0.85 * top).map(([g]) => g);
        groups = (close.length > 1 || p.intent === "list") ? close.slice(0, 8) : [ranked[0][0]];
      } else if (p.model) {
        const unknown = [...pool].filter(g => !this.dockets[g].models.length);
        const real = [...pool].filter(g => this.dockets[g].models.length);
        r.trace.push(`${unknown.length} dockets have no model list; not counted as matches`);
        groups = real.sort((a, b) => (this.dockets[b].latest.pub || "").localeCompare(this.dockets[a].latest.pub || ""));
        p.intent = "list";
      } else { r.status = "NEEDS_INPUT"; r.needs = ["model", "docket or topic"]; r.trace.push("nothing to search on"); return; }
    }
    if (!groups.length) return this._refuse(r, "NO_MATCH", "No NPRM in this dataset matches" + (p.model ? ` model ${p.model}.` : " this question."));
    if (groups.length > 1) return this._list(r, p, groups);
    return this._single(r, p, this.dockets[groups[0]]);
  }

  _list(r, p, groups) {
    const rows = groups.map(g => { const d = this.dockets[g];
      return { docket: g, subject: d.substantive.sub, status: d.status, latest: d.latest.pub, scope: d.substantive.sc,
        model_match: p.model ? Engine.matchModel(p.model, d.models)[0] : null, first_sentence: d.substantive.s[0] || "" }; });
    r.candidates = rows;
    if (p.intent === "list") {
      r.status = p.model ? "ANSWERED" : "ANSWERED_GENERAL";
      r.fields = { count: rows.length, by_status: Object.fromEntries(["PROPOSED", "REVISED_PROPOSAL", "WITHDRAWN"].map(s => [s, rows.filter(x => x.status === s).length])) };
      r.trace.push(`list answer: ${rows.length} dockets`);
    } else { r.status = "NEEDS_INPUT"; r.needs = ["docket"]; r.trace.push("several dockets match about equally; asking user to pick"); }
    r.claims = rows.filter(x => x.first_sentence).map(x => ({ ...this._claim(this.dockets[x.docket].substantive, 0), id: `${x.docket}:s0` }));
  }

  _single(r, p, d) {
    const sub = d.substantive, last = d.latest, q = r.query;
    r.ad = d.group;
    if (/\b(why|when|how)\b.{0,40}\bwithdraw|\bwas withdrawn\b|\bsince .{0,40}withdrawn/i.test(q) && d.status !== "WITHDRAWN") {
      r.claims = [this._claim(last, 0)];
      return this._refuse(r, "CONTRADICTS_SOURCE", `The question assumes ${d.group} was withdrawn, but no withdrawal notice exists in this dataset. Its latest notice (${last.pub}) is still a proposal.`);
    }
    if (p.ads.length && /\bsupersed|\breplac/i.test(q)) {
      const known = new Set(d.versions.flatMap(v => v.ads)), wrong = p.ads.filter(a => !known.has(a));
      if (wrong.length) { r.claims = [this._claim(sub, 0)];
        return this._refuse(r, "CONTRADICTS_SOURCE", `The question links ${d.group} to AD ${wrong.join(", ")}, but its notices only reference ` + (known.size ? `AD ${[...known].sort().join(", ")}.` : "no AD numbers.")); }
    }
    const supersedes = [...new Set(d.versions.filter(v => ["SUPERSEDE", "REVISED_PROPOSAL", "WITHDRAWN"].includes(v.a)).flatMap(v => v.ads))].sort();
    r.revision = { docket: d.group, status: d.status, latest_action: last.a, withdrawn_by: d.withdrawnBy, supersedes_ads: supersedes,
      versions: d.versions.map(v => ({ date: v.pub, action: v.a, fr: v.fr, pages: v.pg, row: v.row, link: v.ln })),
      resulting_ad: ([...d.versions].reverse().find(v => v.adn) || {}).adn || null };
    r.trace.push(`docket ${d.group}: ${d.versions.length} version(s); status ${d.status}`);
    const due = last.a !== "WITHDRAWN" ? last.due : null;
    r.fields = { regulatory_status: d.status,
      binding: d.status !== "WITHDRAWN" ? "No. This is a proposed rule (NPRM), not an AD in force." : "No. This proposal was withdrawn.",
      latest_publication: `${last.fr} ${last.pg}`, comments_due: due ? `${due} (${due >= this.today ? "open" : "closed"})` : null,
      supersedes_ads: supersedes.length ? supersedes : null, make: sub.mk, models_listed: d.models.slice(0, 40), models_source: sub.mf,
      scope_wording: sub.sc, link: last.ln || sub.ln };
    const app = this._applicability(d, p); r.applicability = app;
    r.trace.push(`applicability=${app.verdict}: ` + app.reasons.join(" | "));
    const intent = p.intent;
    if (d.status === "WITHDRAWN") {
      const wv = (d.withdrawnBy && this.byDocket[d.withdrawnBy.toUpperCase()]?.versions.find(v => v.d === d.withdrawnBy)) || last;
      let claims = wv.s.slice(0, 2).map((_, i) => this._claim(wv, i));
      if ((intent === "requirements" || intent === "reason") && sub !== wv) claims = claims.concat(this._pick(sub, intent, p, 2));
      r.claims = claims; r.status = "ANSWERED"; r.trace.push("proposal withdrawn: answer states it imposes no requirement"); return;
    }
    if (app.verdict === "NOT_LISTED") { r.status = "NOT_APPLICABLE"; r.claims = [this._claim(sub, 0)]; return; }
    if (app.verdict === "NEEDS_VARIANT") { r.status = "NEEDS_INPUT"; r.needs = ["exact model variant"]; r.claims = [this._claim(sub, 0)]; return; }
    if (intent === "compliance_time") {
      const timing = /\bwithin \d|\b\d[\d,]* (days?|months?|years?|flight hours|flight cycles|cycles|hours)\b/i;
      if (!d.versions.some(v => v.s.some(x => timing.test(x)))) {
        r.claims = this._pick(sub, "requirements", p, 1);
        return this._refuse(r, "NOT_IN_DATA", `${d.group}'s notice summary doesn't state compliance times. They are in the full Federal Register text, and for a proposal they may still change before a final AD.`);
      }
    }
    const src = intent === "status" ? last : sub;
    let claims = this._pick(src, intent, p, 3);
    if (intent === "status" && src !== sub) claims = claims.concat(this._pick(sub, "requirements", p, 1));
    if (!claims.some(c => c.cite.sentence === 0 && c.cite.sheet_row === sub.row)) claims.unshift(this._claim(sub, 0));
    r.claims = claims;
    r.status = app.verdict === "MODEL_LISTED_ALL_UNITS" ? "ANSWERED" : "ANSWERED_GENERAL";
  }

  _applicability(d, p) {
    const sub = d.substantive;
    if (!p.model) return { verdict: "NO_MODEL_GIVEN", reasons: ["No aircraft model given; answer is about the proposal only."] };
    if (!d.models.length) return { verdict: "UNDETERMINED", reasons: ["The model list in this NPRM's summary is not machine-readable. Check the Federal Register text."] };
    const [lvl, hits] = Engine.matchModel(p.model, d.models), strip = m => m.replace(/\*$/, "");
    if (lvl === "NONE") return { verdict: "NOT_LISTED", listed: d.models.map(strip), reasons: [`${p.model} is not among the listed models.`] };
    if (lvl === "FAMILY_ONLY") return { verdict: "NEEDS_VARIANT", variants: hits.map(strip),
      reasons: [`'${p.model}' matches several listed variants (${hits.slice(0, 6).map(strip).join(", ")}). Give the exact variant.`] };
    const why = `${p.model} matches listed ${lvl === "SERIES" ? "series " : ""}model ${strip(hits[0])}.`;
    if (sub.sc === "ALL") return { verdict: "MODEL_LISTED_ALL_UNITS", reasons: [why, "Summary says the proposal applies to ALL units of the listed models."] };
    const reasons = [why, "Summary says 'certain' units: the unit criteria (serial numbers, configurations) are in the full Federal Register text, which this dataset does not contain."];
    if (p.serial) reasons.push(`Cannot check serial ${p.serial} against this dataset.`);
    return { verdict: "MODEL_LISTED_UNITS_UNCONFIRMED", reasons };
  }

  _pick(v, intent, p, n) {
    const rx = INTENT_SENT[intent || ""];
    let idx = v.s.map((s, i) => i).filter(i => rx && rx.test(v.s[i]));
    if (intent === "reason") { const pri = ["prompted by", "since the faa issued", "was notified", "if not addressed", "could result", "to address"];
      const k = i => { const l = v.s[i].toLowerCase(); const f = pri.findIndex(w => l.includes(w)); return f < 0 ? 99 : f; };
      idx = idx.map((i, o) => [i, o]).sort((a, b) => k(a[0]) - k(b[0]) || a[1] - b[1]).map(x => x[0]); }
    if (intent === "requirements") { const k = i => /\bwould\b|\bproposes? to require/i.test(v.s[i]) ? 0 : 1;
      idx = idx.map((i, o) => [i, o]).sort((a, b) => k(a[0]) - k(b[0]) || a[1] - b[1]).map(x => x[0]); }
    if (!idx.length && p.topic.length) {
      const tt = new Set(p.topic), ov = i => new Set(terms(v.s[i]).filter(t => tt.has(t))).size;
      idx = v.s.map((s, i) => [i, ov(i)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]).filter(x => x[1] > 0).map(x => x[0]);
    }
    if (!idx.length) idx = v.s.slice(0, n).map((_, i) => i);
    return idx.slice(0, n).map(i => this._claim(v, i));
  }
  _cite(v, i) { return { docket: v.d, version_date: v.pub, action: v.a, fr_citation: v.fr, pages: v.pg, link: v.ln, sheet_row: v.row, sentence: i }; }
  _claim(v, i) { return { id: `${v.d}@${v.pub}:S${i + 1}`, text: v.s[i], cite: this._cite(v, i) }; }

  fleet(models) {
    return models.map(raw => { const m = normModel(raw), rows = [];
      for (const [g, d] of Object.entries(this.dockets)) {
        const [lvl] = Engine.matchModel(m, d.models);
        if (lvl === "EXACT" || lvl === "SERIES") { const due = d.status !== "WITHDRAWN" ? d.latest.due : null;
          rows.push({ docket: g, status: d.status, match: lvl, scope: d.substantive.sc, subject: d.substantive.sub, latest: d.latest.pub,
            comments_due: due, comments_open: !!(due && due >= this.today), first_sentence: d.substantive.s[0] || "" }); }
      }
      rows.sort((a, b) => (b.latest || "").localeCompare(a.latest || ""));
      return { model: m, known: this.knownModel(m), dockets: rows,
        counts: Object.fromEntries(["PROPOSED", "REVISED_PROPOSAL", "WITHDRAWN"].map(s => [s, rows.filter(x => x.status === s).length])),
        open_comments: rows.filter(x => x.comments_open).length };
    });
  }
  docket(id) { const d = this.byDocket[id.toUpperCase()]; if (!d) return null;
    return { docket: d.group, status: d.status, models: d.models, withdrawn_by: d.withdrawnBy,
      versions: d.versions.map(v => ({ docket: v.d, action: v.a, publish_date: v.pub, comments_due: v.due, fr_citation: v.fr, pages: v.pg,
        link: v.ln, sheet_row: v.row, subject: v.sub, make: v.mk, scope: v.sc, sentences: v.s })) }; }
  models() { return [...new Set([...this.allModels].map(m => m.replace(/\*$/, "")))].sort(); }
  baseline(q) {   // plain retrieval: exact docket lookup if named, else top BM25 docket; always answers
    const named = (q.match(DOCKET) || [])[0];
    if (named && this.byDocket[named.toUpperCase()]) return this.byDocket[named.toUpperCase()].group;
    const h = this._search(terms(q), null, 1); return h.length ? h[0][0] : null;
  }
}
root.TorqueEngine = Engine; root.tsTerms = terms;
})(typeof window !== "undefined" ? window : globalThis);
