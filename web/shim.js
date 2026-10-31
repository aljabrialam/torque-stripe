/* Serverless mode: answers the UI's API calls in the browser with the same rule engine.
   Claude rewording is off here (no server to hold the key); answers are verbatim quotes. */
(function () {
  const E = new TorqueEngine(window.TS_DATA);
  window.TS_ENGINE = E;
  const GOLD = window.TS_GOLD, KF = window.TS_KF;
  const json = (o, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } }));
  function runEval() {
    const ev = new TorqueEngine(window.TS_DATA, "2026-10-31");      // pinned date, same as eval/run_eval_faa.py
    const rows = [], lat = [];
    for (const g of GOLD) {
      const r = ev.ask(g.q, g.cfg); lat.push(r.latency_ms);
      let ok = r.status === g.status;
      if ("docket" in g) ok = ok && r.ad === g.docket;
      if ("reg" in g) ok = ok && r.fields.regulatory_status === g.reg;
      if ("app" in g) ok = ok && r.applicability.verdict === g.app;
      if ("code" in g) ok = ok && (r.refusal || {}).code === g.code;
      if ("due" in g) ok = ok && r.fields.comments_due === g.due;
      if (g.list) ok = ok && r.candidates.length > 1;
      const bd = ev.baseline(g.q);
      const bok = g.status.startsWith("ANSWERED") && (!("docket" in g) || bd === g.docket) && g.reg !== "WITHDRAWN" && g.status !== "ANSWERED_GENERAL";
      rows.push({ q: g.q, cfg: g.cfg, want: g.status, got: r.status, ok, got_docket: r.ad, want_docket: g.docket || null,
        app: r.applicability.verdict || null, code: (r.refusal || {}).code || null, base_ok: bok, base_docket: bd });
    }
    const n = rows.length, unsafe = rows.filter(x => !x.want.startsWith("ANSWERED")), wd = rows.filter((x, i) => GOLD[i].reg === "WITHDRAWN");
    const sl = [...lat].sort((a, b) => a - b);
    const summary = { questions: n, fully_correct: `${rows.filter(x => x.ok).length}/${n}`,
      "unsafe_answers (answered when it should refuse/ask/say not applicable)": `${unsafe.filter(x => x.got.startsWith("ANSWERED")).length}/${unsafe.length}`,
      "withdrawn proposals flagged as withdrawn": `${wd.filter(x => x.ok).length}/${wd.length}`,
      baseline_fully_correct: `${rows.filter(x => x.base_ok).length}/${n}`, baseline_unsafe_answers: `${unsafe.length}/${unsafe.length}`,
      baseline_withdrawn_flagged: `0/${wd.length}`, latency_p50_ms: sl[Math.floor(sl.length / 2)], latency_max_ms: sl[sl.length - 1],
      corpus: { rows: ev.versions.length, dockets: Object.keys(ev.dockets).length, federal_register_pages: ev.totalPages } };
    const failures = KF.map(k => { const r = ev.ask(k.q, k.cfg); return { ...k, got: r.status, docket: r.ad, code: (r.refusal || {}).code, verdict: r.applicability.verdict }; });
    return { summary, rows, failures };
  }
  const real = window.fetch.bind(window);
  window.fetch = (url, opt = {}) => {
    const u = String(url), body = opt.body ? JSON.parse(opt.body) : {};
    if (u === "/health") return json({ mode: "faa_nprm", rows: E.versions.length, dockets: Object.keys(E.dockets).length, federal_register_pages: E.totalPages, today: E.today });
    if (u === "/models") return json(E.models());
    if (u === "/ask") return json(E.ask(body.query, { model: body.model, serial: body.serial }));
    if (u === "/fleet") return json(E.fleet((body.models || []).filter(m => m.trim()).slice(0, 25)));
    if (u === "/dockets") return json(Object.values(E.dockets).map(d => ({ docket: d.group, status: d.status, subject: d.substantive.sub,
      make: d.substantive.mk, models: d.models, scope: d.substantive.sc, latest: d.latest.pub, first: d.versions[0].pub,
      pt: d.substantive.pt, pst: d.substantive.pst, comments_due: d.status !== "WITHDRAWN" ? d.latest.due : null,
      first_sentence: d.substantive.s[0] || "", versions: d.versions.length })));
    if (u.startsWith("/dockets/")) { const d = E.docket(decodeURIComponent(u.slice(9))); return d ? json(d) : json({ detail: "Not in this dataset" }, 404); }
    if (u === "/eval") return json(runEval());
    return real(url, opt);
  };
})();
