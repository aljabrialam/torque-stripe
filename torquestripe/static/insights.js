/* Insights view: a 3D landscape of the 323 dockets (year x aircraft category, stacked by status)
   plus three interactive 2D charts. Everything is computed from the dockets list; clicking any mark
   filters the others and lists the dockets behind it. */
(function () {
  const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const CATS = ["Large airplanes", "Small airplanes", "Rotorcraft", "Engines", "Other"];
  const cat = d => /engine/i.test(d.pt || "") ? "Engines" : /rotor/i.test(d.pst || "") ? "Rotorcraft"
    : /large/i.test(d.pst || "") ? "Large airplanes" : /small/i.test(d.pst || "") ? "Small airplanes" : "Other";
  const MAKES = [[/airbus helicopters|eurocopter/i, "Airbus Helicopters"], [/airbus/i, "Airbus"], [/mcdonnell|boeing/i, "Boeing"],
    [/bombardier|de havilland|canadair/i, "Bombardier"], [/embraer|empresa brasileira/i, "Embraer"], [/general electric|\bGE\b/i, "GE Aerospace"],
    [/pratt/i, "Pratt & Whitney"], [/rolls/i, "Rolls-Royce"], [/cfm/i, "CFM International"], [/bell/i, "Bell"], [/sikorsky/i, "Sikorsky"],
    [/robinson/i, "Robinson"], [/cessna|textron|beech|hawker/i, "Textron Aviation"], [/gulfstream/i, "Gulfstream"], [/dassault/i, "Dassault"],
    [/agusta|leonardo/i, "Leonardo"], [/atr|avions de transport/i, "ATR"], [/pilatus/i, "Pilatus"], [/safran|turbomeca/i, "Safran"]];
  const make = m => { for (const [rx, n] of MAKES) if (rx.test(m || "")) return n; return (m || "Unknown").replace(/^The /, "").split(/[ ,(]/).slice(0, 2).join(" ") || "Unknown"; };
  let all = [], F = { make: null, status: "all", cell: null }, built = false;
  const live = d => d.status !== "WITHDRAWN";
  const filtered = () => all.filter(d => (!F.make || d.mk === F.make) && (F.status === "all" || (F.status === "live" ? live(d) : !live(d))));
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    all = (await (await fetch("/dockets")).json()).map(d => ({ ...d, cat: cat(d), mk: make(d.make), year: +(d.first || d.latest || "0").slice(0, 4) }));
  }

  // ---------- filters ----------
  function filters() {
    const counts = {}; all.forEach(d => counts[d.mk] = (counts[d.mk] || 0) + 1);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    $("#if-make").innerHTML = [`<button class="seg" data-m="">All makers</button>`].concat(top.map(m => `<button class="seg" data-m="${esc(m)}">${esc(m)}</button>`)).join("");
    $("#if-make").onclick = e => { const b = e.target.closest(".seg"); if (!b) return; F.make = b.dataset.m || null; F.cell = null; update(); };
    $("#if-status").onclick = e => { const b = e.target.closest(".seg"); if (!b) return; F.status = b.dataset.s; F.cell = null; update(); };
    $("#if-table").onclick = () => { const t = $("#land-table"); t.hidden = !t.hidden; $("#if-table").textContent = t.hidden ? "Show as table" : "Hide table"; };
  }
  function markFilters() {
    document.querySelectorAll("#if-make .seg").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.m || null) === F.make)));
    document.querySelectorAll("#if-status .seg").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.s === F.status)));
  }

  // ---------- 3D landscape ----------
  let L = null;
  function land() {
    const host = $("#land"), cv = $("#landcv");
    if (!window.THREE) { host.insertAdjacentHTML("beforeend", '<div class="fallback">3D view unavailable offline. Use “Show as table”.</div>'); return; }
    const T = THREE, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.1, 300);
    scene.add(new T.AmbientLight(0xffffff, 0.72)); const sun = new T.DirectionalLight(0xffffff, 0.55); sun.position.set(-6, 14, 9); scene.add(sun);
    const years = all.map(d => d.year).filter(Boolean), y0 = Math.min(...years), y1 = Math.max(...years), NY = y1 - y0 + 1;
    const W = 0.62, gapX = 0.8, gapZ = 1.5, ox = -(NY - 1) * gapX / 2, oz = -(CATS.length - 1) * gapZ / 2;
    const matA = new T.MeshLambertMaterial(), matB = new T.MeshLambertMaterial(), edge = new T.LineBasicMaterial({ transparent: true, opacity: 0.9 });
    const geo = new T.BoxGeometry(W, 1, W); geo.translate(0, 0.5, 0); const eg = new T.EdgesGeometry(geo);
    const bars = [];   // {y, c, kind, mesh, edges, h, target}
    for (let yi = 0; yi < NY; yi++) for (let ci = 0; ci < CATS.length; ci++) for (const kind of ["live", "wd"]) {
      const m = new T.Mesh(geo, kind === "live" ? matA : matB), e = new T.LineSegments(eg, edge);
      m.position.set(ox + yi * gapX, 0, oz + ci * gapZ); e.position.copy(m.position); m.scale.y = e.scale.y = 0.0001; m.visible = e.visible = false;
      const b = { y: y0 + yi, c: CATS[ci], kind, mesh: m, edges: e, h: 0, target: 0 }; m.userData.b = b; bars.push(b); scene.add(m, e);
    }
    const grid = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ transparent: true, opacity: 0.6 }));
    { const a = [], xA = ox - 0.6, xB = ox + (NY - 1) * gapX + 0.6;
      CATS.forEach((_, ci) => a.push(xA, 0, oz + ci * gapZ, xB, 0, oz + ci * gapZ));
      for (let yi = 0; yi < NY; yi += 5) a.push(ox + yi * gapX, 0, oz - 0.7, ox + yi * gapX, 0, oz + (CATS.length - 1) * gapZ + 0.7);
      grid.geometry.setAttribute("position", new T.Float32BufferAttribute(a, 3)); scene.add(grid); }
    const hov = new T.LineSegments(eg, new T.LineBasicMaterial()); hov.visible = false; scene.add(hov);
    const labels = [];
    function label(text, x, y, z, align) {
      const c = document.createElement("canvas"), g = c.getContext("2d"), fs = 44; g.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
      const w = Math.ceil(g.measureText(text).width) + 8; c.width = w; c.height = fs + 12;
      const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      const s = 0.0105; sp.scale.set(w * s, c.height * s, 1); sp.center.set(align === "right" ? 1 : align === "left" ? 0 : 0.5, 0.5);
      sp.position.set(x, y, z); sp.userData = { c, g, text, fs, w }; scene.add(sp); labels.push(sp); return sp;
    }
    for (let yr = Math.ceil(y0 / 5) * 5; yr <= y1; yr += 5) label(String(yr), ox + (yr - y0) * gapX, 0.02, oz + (CATS.length - 1) * gapZ + 1.15);
    if (y1 % 5 > 1) label(String(y1), ox + (y1 - y0) * gapX, 0.02, oz + (CATS.length - 1) * gapZ + 1.15);
    CATS.forEach((c, ci) => label(c, ox - 0.9, 0.02, oz + ci * gapZ, "right"));
    function paintLabels() { const col = css("--text-2"); labels.forEach(sp => { const { c, g, text, fs } = sp.userData; g.clearRect(0, 0, c.width, c.height);
      g.font = `500 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; g.fillStyle = col; g.textBaseline = "middle"; g.fillText(text, 4, c.height / 2); sp.material.map.needsUpdate = true; }); }
    function colors() { matA.color.set(css("--s1")); matB.color.set(css("--s2")); edge.color.set(css("--surface")); grid.material.color.set(css("--wire-dim")); hov.material.color.set(css("--text")); paintLabels(); kick(); }
    let az = 1.22, el = 0.5, dist = 30, drag = false, moved = 0, px = 0, py = 0, autoT = 0;
    const ray = new T.Raycaster(), ptr = new T.Vector2(), tip = $("#land-tip");
    function pick(e) { const r = cv.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ptr, cam); const h = ray.intersectObjects(bars.filter(b => b.mesh.visible).map(b => b.mesh))[0]; return h && h.object.userData.b; }
    function showTip(b, e) {
      if (!b) { tip.hidden = true; hov.visible = false; kick(); return; }
      const cell = cellData(b.y, b.c), r = host.getBoundingClientRect();
      tip.innerHTML = `<b>${b.y} · ${esc(b.c)}</b><span>${cell.length} proposal${cell.length === 1 ? "" : "s"}</span>
        <span><i class="key s1"></i>Still proposed ${cell.filter(live).length}</span><span><i class="key s2"></i>Withdrawn ${cell.filter(d => !live(d)).length}</span><em>Click to list them</em>`;
      tip.hidden = false; const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 8), y = Math.max(8, e.clientY - r.top - tip.offsetHeight - 10);
      tip.style.left = x + "px"; tip.style.top = y + "px";
      hov.position.copy(b.mesh.position); hov.scale.set(1.04, Math.max(0.05, colHeight(b) + 0.02), 1.04); hov.position.y = 0; hov.visible = true; kick();
    }
    const colHeight = b => bars.filter(x => x.y === b.y && x.c === b.c).reduce((s, x) => s + x.h, 0);
    cv.addEventListener("pointerdown", e => { drag = true; moved = 0; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => {
      if (drag) { const dx = e.clientX - px, dy = e.clientY - py; moved += Math.abs(dx) + Math.abs(dy); az -= dx * 0.007; el = Math.max(0.2, Math.min(1.25, el + dy * 0.005)); px = e.clientX; py = e.clientY; autoT = 4; tip.hidden = true; kick(); return; }
      if (e.pointerType === "mouse") showTip(pick(e), e);
    });
    cv.addEventListener("pointerup", e => { drag = false; if (moved < 6) { const b = pick(e); if (b) { F.cell = { y: b.y, c: b.c }; showTip(b, e); listCell(); } else { F.cell = null; showTip(null); listCell(); } } });
    cv.addEventListener("pointerleave", () => { if (!drag) showTip(null); });
    $("#land-zoom").oninput = e => { dist = 46 - +e.target.value; kick(); };
    function size() { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height);
      cam.fov = r.width < 560 ? 44 : 30; cam.updateProjectionMatrix(); kick(); }
    new ResizeObserver(size).observe(host);
    let visible = true, raf = 0, last = 0;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(host);
    function kick() { if (!raf && visible && !document.hidden && !host.closest("[hidden]")) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function frame(now) {
      raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now; let busy = drag;
      if (!reduce && autoT <= 0) { az += dt * 0.05; busy = true; } else autoT -= dt;
      const byCell = {};
      for (const b of bars) { b.h += (b.target - b.h) * Math.min(1, reduce ? 1 : dt * 7); if (Math.abs(b.target - b.h) > 0.002) busy = true;
        const k = b.y + "|" + b.c, base = b.kind === "wd" ? (byCell[k] || 0) : 0; if (b.kind === "live") byCell[k] = b.h;
        const on = b.h > 0.01; b.mesh.visible = b.edges.visible = on;
        b.mesh.scale.y = b.edges.scale.y = Math.max(0.0001, b.h); b.mesh.position.y = b.edges.position.y = base; }
      // wd bars sit on live bars: second pass to fix base for cells processed in order
      for (const b of bars) if (b.kind === "wd") { const base = bars.find(x => x.kind === "live" && x.y === b.y && x.c === b.c).h; b.mesh.position.y = b.edges.position.y = base; }
      cam.position.set(dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az)); cam.lookAt(0, 1.6, 0);
      renderer.render(scene, cam); if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colors);
    new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.fonts && document.fonts.ready.then(paintLabels);
    L = { bars, colors, kick, size, setHeights(rows) {
      const max = Math.max(1, ...Object.values(countCells(all)).map(v => v.live + v.wd)), cells = countCells(rows), S = 6.5 / max;
      for (const b of bars) { const v = cells[b.y + "|" + b.c] || { live: 0, wd: 0 }; b.target = (b.kind === "live" ? v.live : v.wd) * S; }
      kick(); } };
    colors(); size();
  }
  function countCells(rows) { const o = {}; for (const d of rows) { const k = d.year + "|" + d.cat; (o[k] ||= { live: 0, wd: 0 }); live(d) ? o[k].live++ : o[k].wd++; } return o; }
  const cellData = (y, c) => filtered().filter(d => d.year === y && d.cat === c);

  // ---------- 2D charts ----------
  function makersChart(rows) {
    const counts = {}; rows.forEach(d => { (counts[d.mk] ||= { live: 0, wd: 0 }); live(d) ? counts[d.mk].live++ : counts[d.mk].wd++; });
    const top = Object.entries(counts).sort((a, b) => (b[1].live + b[1].wd) - (a[1].live + a[1].wd)).slice(0, 8);
    const max = Math.max(1, ...top.map(([, v]) => v.live + v.wd));
    $("#ch-makers").innerHTML = top.map(([m, v]) => `<button class="hbar${F.make === m ? " sel" : ""}" data-m="${esc(m)}" aria-label="${esc(m)}: ${v.live} still proposed, ${v.wd} withdrawn">
      <span class="hl">${esc(m)}</span><span class="track"><i class="s1" style="width:${v.live / max * 100}%"></i><i class="s2" style="width:${v.wd / max * 100}%"></i></span>
      <span class="hv mono">${v.live + v.wd}</span></button>`).join("") || `<div class="empty">No proposals match.</div>`;
    $("#ch-makers").onclick = e => { const b = e.target.closest(".hbar"); if (!b) return; F.make = F.make === b.dataset.m ? null : b.dataset.m; F.cell = null; update(); };
  }
  function commentChart(rows) {
    const open = rows.filter(d => live(d) && d.comments_due && d.comments_due >= today).sort((a, b) => a.comments_due.localeCompare(b.comments_due));
    const span = 60, day = s => Math.round((Date.parse(s) - Date.parse(today)) / 864e5);
    const inWin = open.filter(d => day(d.comments_due) <= span);
    $("#ch-comments-n").textContent = open.length;
    const lanes = {}; const dots = inWin.map(d => { const x = day(d.comments_due); const lane = lanes[x] = (lanes[x] || 0) + 1; return { d, x, lane }; });
    const W = 100;
    $("#ch-comments").innerHTML = `<div class="tlwrap"><div class="tlaxis">${[0, 15, 30, 45, 60].map(t => `<span style="left:${t / span * W}%">${t === 0 ? "Today" : "+" + t + "d"}</span>`).join("")}</div>
      <div class="tlplot">${dots.map(({ d, x, lane }) => `<button class="tdot" style="left:${x / span * W}%;bottom:${(lane - 1) * 16 + 6}px" data-d="${esc(d.docket)}"
        aria-label="${esc(d.docket)}, comments due ${esc(d.comments_due)}"><span class="ttip"><b class="mono">${esc(d.docket)}</b>${esc(d.mk)} · due ${esc(d.comments_due)}<em>Click to open</em></span></button>`).join("")}</div></div>
      ${open.length > inWin.length ? `<div class="stats">${open.length - inWin.length} more due later than 60 days.</div>` : ""}
      ${!open.length ? `<div class="empty">No open comment periods in this selection.</div>` : ""}`;
    $("#ch-comments").onclick = e => { const b = e.target.closest(".tdot"); if (b) openDocket(b.dataset.d); };
  }
  function coverageChart(rows) {
    const g = { all: 0, certain: 0, unclear: 0, none: 0 };
    rows.forEach(d => { if (!d.models || !d.models.length) g.none++; else if (d.scope === "ALL") g.all++; else if (d.scope === "CERTAIN") g.certain++; else g.unclear++; });
    const n = Math.max(1, rows.length), seg = [["all", "Model listed, all units", "c1"], ["certain", "Model listed, certain units", "c2"], ["unclear", "Model listed, scope unclear", "c3"], ["none", "No model list", "c4"]];
    $("#ch-cov").innerHTML = `<div class="stack">${seg.map(([k, l, c]) => g[k] ? `<i class="${c}" style="width:${g[k] / n * 100}%" title="${l}: ${g[k]}"></i>` : "").join("")}</div>
      <ul class="covl">${seg.map(([k, l, c]) => `<li><i class="key ${c}"></i>${l}<span class="mono">${g[k]}</span><span class="stats mono">${Math.round(g[k] / n * 100)}%</span></li>`).join("")}</ul>
      <p class="stats">Rules can confirm coverage for a model only in the first group. The rest are answered with "check the Federal Register text".</p>`;
  }
  function table(rows) {
    const cells = countCells(rows), ys = [...new Set(rows.map(d => d.year))].sort();
    $("#land-table").innerHTML = `<table><thead><tr><th>Year</th>${CATS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${ys.map(y => `<tr><td class="mono">${y}</td>${CATS.map(c => { const v = cells[y + "|" + c]; return `<td class="mono">${v ? `${v.live + v.wd}<span class="stats"> (${v.wd} wd)</span>` : "·"}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  }
  function listCell() {
    const rows = F.cell ? cellData(F.cell.y, F.cell.c) : [];
    $("#land-list").innerHTML = F.cell ? `<div class="lh"><b>${F.cell.y} · ${esc(F.cell.c)}</b><span class="stats">${rows.length} proposal${rows.length === 1 ? "" : "s"}${F.make ? " · " + esc(F.make) : ""}</span>
      <button class="btn" id="land-clear">Clear</button></div>
      <div class="cands">${rows.slice(0, 30).map(d => `<button class="cand" data-d="${esc(d.docket)}"><div class="top"><span class="mono"><b>${esc(d.docket)}</b></span>
        <span class="pill ${live(d) ? "p-info" : "p-mute"}">${live(d) ? "Still proposed" : "Withdrawn"}</span><span class="stats">${esc(d.mk)}</span></div><div class="s">${esc(d.first_sentence)}</div></button>`).join("")}</div>`
      : `<p class="stats">Click a bar to list the proposals behind it.</p>`;
    $("#land-list").onclick = e => { const b = e.target.closest(".cand"); if (b) openDocket(b.dataset.d); if (e.target.id === "land-clear") { F.cell = null; listCell(); } };
  }
  function openDocket(d) { $("#q").value = `Status of ${d}`; document.querySelector('.tab[data-view="ask"]').click(); window.tsAsk && window.tsAsk(); }

  function update() {
    const rows = filtered(); markFilters();
    $("#ins-count").textContent = `${rows.length} of ${all.length} dockets`;
    L && L.setHeights(rows); makersChart(rows); commentChart(rows); coverageChart(rows); table(rows); listCell();
  }
  window.Insights = { async show() {
    if (!built) { built = true; await load(); filters(); land(); }
    update(); L && (L.size(), L.colors());
  } };
})();
