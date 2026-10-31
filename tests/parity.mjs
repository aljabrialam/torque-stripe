// Compare the browser engine (web/engine.js) with the Python engine (tests/parity_py.json from tests/parity_gen.py).
import fs from "fs"; import vm from "vm";
const root = new URL("..", import.meta.url).pathname;
const ctx = { performance, console }; vm.createContext(ctx); ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(root + "web/engine.js", "utf8"), ctx);
const data = JSON.parse(fs.readFileSync(root + "web/data.json", "utf8"));
const E = new ctx.TorqueEngine(data, "2026-10-31");
const { cases, fleet } = JSON.parse(fs.readFileSync(root + "tests/parity_py.json", "utf8"));
let ok = 0; const bad = [];
for (const c of cases) {
  const r = E.ask(c.q, c.cfg);
  const js = { status: r.status, ad: r.ad, code: r.refusal?.code || null, verdict: r.applicability?.verdict || null,
    cands: r.candidates.map(x => x.docket).sort(), claims: r.claims.map(x => x.id), due: r.fields.comments_due || null, reg: r.fields.regulatory_status || null };
  const diff = Object.keys(c.py).filter(k => JSON.stringify(c.py[k] ?? null) !== JSON.stringify(js[k] ?? null));
  if (diff.length) bad.push({ q: c.q, cfg: c.cfg, diff: Object.fromEntries(diff.map(k => [k, { py: c.py[k], js: js[k] }])) }); else ok++;
}
const fj = E.fleet(fleet.map(f => f.model));
let fok = 0;
fleet.forEach((f, i) => {
  const same = JSON.stringify([...f.dockets].sort()) === JSON.stringify(fj[i].dockets.map(x => x.docket).sort()) && f.known === fj[i].known && f.open === fj[i].open_comments;
  if (same) fok++; else bad.push({ fleet: f.model });
});
const randomWord = b => b.q && !/FAA-|AD |Any proposed|Status of|Why was|Does |What does|Which NPRM/.test(b.q) && !c0.has(b.q);
const c0 = new Set(cases.slice(0, 46).map(c => c.q));
const structured = cases.filter(c => !randomWord(c)).length, sbad = bad.filter(b => b.q && !randomWord(b)).length;
console.log(`ask parity: ${ok}/${cases.length} overall | structured questions (gold, dockets, ADs, models): ${structured - sbad}/${structured} | random 3-word search probes: ${cases.length - structured - (bad.length - sbad - bad.filter(b=>b.fleet).length)}/${cases.length - structured}   fleet parity: ${fok}/${fleet.length}`);
for (const b of bad.slice(0, 15)) console.log(JSON.stringify(b).slice(0, 500));
process.exit(bad.length ? 1 : 0);
