/* Torque Stripe inspection stage: a wireframe airliner, helicopter or turbofan drawn with three.js lines.
   The orange ring is the torque stripe. It is intact when the rules confirm coverage, broken when the
   system refuses or needs input, and grey when the proposal does not list the model.
   Decoration only: it shows the engine's verdict and never makes one. */
(function () {
  const cv = document.getElementById("stagecv"), host = document.getElementById("stage");
  const api = { setKind() {}, setState() {}, scan() {}, setView() {}, setZone() {} };
  window.Stage = api;
  if (!cv || !window.THREE) { if (host) host.insertAdjacentHTML("beforeend", '<div class="fallback">3D view unavailable offline</div>'); return; }
  const T = THREE, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, 0.1, 200);
  const M = { wire: new T.LineBasicMaterial({ transparent: true, opacity: 0.72 }), dim: new T.LineBasicMaterial({ transparent: true, opacity: 0.55 }),
              stripe: new T.LineBasicMaterial({ transparent: true, opacity: 1 }), scan: new T.LineBasicMaterial({ transparent: true, opacity: 0 }),
              scanFill: new T.MeshBasicMaterial({ transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }),
              dots: new T.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.8 }) };
  function colors() {
    M.wire.color.set(css("--wire")); M.dim.color.set(css("--wire-dim")); M.dots.color.set(css("--wire-dim")); scene.fog && scene.fog.color.set(css("--stage"));
    M.scan.color.set(css("--accent")); M.scanFill.color.set(css("--accent")); zoneFill.color.set(css("--accent")); zoneEdge.color.set(css("--accent")); paintStripe();
  }
  // ---------- geometry helpers ----------
  const seg = (arr, mat) => { const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(arr, 3)); return new T.LineSegments(g, mat || M.wire); };
  function lathe(profile, long = 16, ringEvery = 1, mat) {   // profile: [[x, r], ...] along X
    const a = [];
    for (let k = 0; k < long; k++) { const t = k / long * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      for (let i = 0; i < profile.length - 1; i++) { const [x0, r0] = profile[i], [x1, r1] = profile[i + 1]; a.push(x0, r0 * c, r0 * s, x1, r1 * c, r1 * s); } }
    profile.forEach(([x, r], i) => { if (i % ringEvery || r < 0.02) return;
      for (let k = 0; k < 40; k++) { const t0 = k / 40 * Math.PI * 2, t1 = (k + 1) / 40 * Math.PI * 2; a.push(x, r * Math.cos(t0), r * Math.sin(t0), x, r * Math.cos(t1), r * Math.sin(t1)); } });
    return seg(a, mat);
  }
  function panel(pts, ribs = 0, mat) {   // closed polygon of [x,y,z] + optional ribs between edge 0-1 and 3-2
    const a = []; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a.push(...p, ...q); });
    for (let i = 1; i <= ribs; i++) { const t = i / (ribs + 1), L = (p, q) => p.map((v, j) => v + (q[j] - v) * t);
      a.push(...L(pts[0], pts[1]), ...L(pts[3], pts[2])); }
    return seg(a, mat);
  }
  const mirrorZ = pts => pts.map(([x, y, z]) => [x, y, -z]);
  function ring(r, n = 64) { const a = []; for (let k = 0; k < n; k++) { const t0 = k / n * Math.PI * 2, t1 = (k + 1) / n * Math.PI * 2; a.push(0, r * Math.cos(t0), r * Math.sin(t0), 0, r * Math.cos(t1), r * Math.sin(t1)); } return a; }

  // ---------- the torque stripe: two half rings so it can "break" ----------
  const stripe = new T.Group(), halfA = seg([], M.stripe), halfB = seg([], M.stripe);
  stripe.add(halfA, halfB);
  function buildStripe(r) {
    const half = s => { const a = []; for (let k = 0; k < 32; k++) { const t0 = s + k / 32 * Math.PI, t1 = s + (k + 1) / 32 * Math.PI;
      for (const dx of [-0.035, 0, 0.035]) a.push(dx, r * Math.cos(t0), r * Math.sin(t0), dx, r * Math.cos(t1), r * Math.sin(t1)); } return a; };
    halfA.geometry.setAttribute("position", new T.Float32BufferAttribute(half(0), 3));
    halfB.geometry.setAttribute("position", new T.Float32BufferAttribute(half(Math.PI), 3));
  }
  let state = "idle", broken = 0, brokenTarget = 0;
  function paintStripe() {
    const c = { applied: "--accent", general: "--accent", na: "--text-3", broken: "--warn", idle: "--wire-dim" }[state] || "--wire-dim";
    M.stripe.color.set(css(c)); M.stripe.opacity = state === "general" ? 0.7 : 1;
  }

  // ---------- models: generic silhouettes driven by the aircraft family (not to scale, no liveries) ----------
  let spinners = [];   // {o, axis, speed}
  const spin = (o, axis, speed) => { spinners.push({ o, axis, speed }); return o; };
  function propeller(r, blades) { const g = new T.Group(); for (let k = 0; k < blades; k++) { const b = panel([[0, 0.05, -0.04], [0, r, -0.06], [0, r, 0.06], [0, 0.05, 0.04]], 0); b.rotation.x = k * Math.PI * 2 / blades; g.add(b); }
    g.add(seg(ring(r, 40), M.dim)); return g; }
  function nacelle(len, r, prop) { const g = new T.Group();
    r *= 1.15; g.add(lathe([[-len / 2, r * 0.82], [-len / 2 + 0.1, r], [len * 0.25, r * 0.95], [len / 2, r * 0.6]], 14, 2, M.wire));
    if (!prop) { const f = seg(ring(r * 0.8, 24)); f.position.x = -len / 2 + 0.02; g.add(f); }
    if (prop) { const p = spin(propeller(r * 2.6, 4), "x", 9); p.position.x = -len / 2 - 0.08; g.add(p); } return g; }
  function fixedWing(S) {
    const g = new T.Group(), L = S.len / 2, R = S.rad, Z = [];
    const nose = S.ga ? [[-L, 0], [-L + 0.15, R * 0.45], [-L + 0.6, R * 0.85], [-L + 1.4, R]] : [[-L, 0], [-L + .15, R * .36], [-L + .4, R * .62], [-L + .8, R * .84], [-L + 1.4, R * .97], [-L + 2.5, R]];
    const prof = nose.concat([[L - 2.0, R], [L - 1.2, R * .82], [L - 0.5, R * .45], [L, R * .14]]);
    g.add(lathe(prof, S.ga ? 14 : 18, 1));
    if (S.hump) g.add(lathe([[-L + 1.2, 0.02], [-L + 1.6, R * 0.5], [-L + 2.6, R * 0.62], [-L + 4.2, R * 0.55], [-L + 5.2, 0.05]], 10, 1, M.dim)).children.slice(-1)[0].position.y = R * 0.62;
    if (S.deck2) { const d = lathe([[-L + 1, 0.05], [-L + 1.8, R * 0.7], [L - 2.4, R * 0.7], [L - 1.4, 0.05]], 12, 2, M.dim); d.position.y = R * 0.55; g.add(d); }
    const wy = S.high ? R * 0.85 : -R * 0.3, wx = S.wingX, span = S.span / 2, sw = S.sweep, cr = S.chord, ct = cr * S.taper, dih = S.high ? -0.02 : 0.07;
    const wing = [[wx - cr / 2, wy, R * 0.9], [wx - cr / 2 + sw, wy + span * dih, span], [wx - cr / 2 + sw + ct, wy + span * dih, span], [wx + cr / 2, wy, R * 0.9]];
    g.add(panel(wing, S.ga ? 4 : 7), panel(mirrorZ(wing), S.ga ? 4 : 7));
    Z.push(["wings", [wx + sw / 2, wy, span / 2 + R / 2, cr + sw + 0.3, 0.5, span - R + 0.4]], ["wings", [wx + sw / 2, wy, -(span / 2 + R / 2), cr + sw + 0.3, 0.5, span - R + 0.4]]);
    Z.push(["fuel", [wx + sw / 3, wy, span / 3, cr, 0.4, span / 2]], ["fuel", [wx + sw / 3, wy, -span / 3, cr, 0.4, span / 2]]);
    // tail
    const tx = L - 1.3, fh = S.fin;
    g.add(panel([[tx - 0.7, R * 0.7, 0], [tx + 0.4, R * 0.7 + fh, 0], [tx + 0.95, R * 0.7 + fh, 0], [L - 0.15, R * 0.4, 0]], 3));
    const hy = S.ttail ? R * 0.7 + fh : R * 0.3, hs = S.hspan / 2;
    const ht = [[tx - 0.2 + (S.ttail ? 0.4 : 0), hy, 0.15], [tx + 0.5 + (S.ttail ? 0.4 : 0), hy + 0.05, hs], [tx + 0.9 + (S.ttail ? 0.4 : 0), hy + 0.05, hs], [tx + 0.75 + (S.ttail ? 0.4 : 0), hy, 0.15]];
    g.add(panel(ht, 3), panel(mirrorZ(ht), 3));
    Z.push(["tail", [tx + 0.3, R * 0.5 + fh / 2, 0, 2.2, fh + R, hs * 2 + 0.3]]);
    // engines
    const er = S.engR || 0.3, el = S.engL || 1.4;
    (S.engines || []).forEach(([ex, ey, ez, prop]) => { const n = nacelle(prop ? el * 0.8 : el, prop ? er * 0.7 : er, prop); n.position.set(ex, ey, ez); g.add(n);
      Z.push(["engines", [ex, ey, ez, el + 0.3, er * 2.4, er * 2.4]]); });
    if (S.noseProp) { const p = spin(propeller(R * 2.1, S.noseBlades || 3), "x", 10); p.position.x = -L - 0.12; g.add(p); Z.push(["engines", [-L + 0.6, 0, 0, 1.5, R * 2.2, R * 2.2]]); }
    if (S.ga && !S.high && false) {}
    Z.push(["fuselage", [0, 0, 0, S.len * 0.62, R * 2.2, R * 2.2]], ["avionics", [-L + 0.8, 0, 0, 1.6, R * 2, R * 2]],
      ["gear", [wx + 0.3, -R - 0.25, 0, 1.4, 0.5, R * 3.2]], ["gear", [-L + 1.6, -R - 0.2, 0, 0.5, 0.4, 0.5]]);
    buildStripe(R * 1.09); stripe.position.set(wx - cr * 0.8, 0, 0); g.add(stripe);
    g.userData = { len: S.len + 0.6, span: S.span, scale: S.scale || 1, zones: Z };
    return g;
  }
  function helicopter(S) {
    const g = new T.Group(), Z = [];
    if (S.tandem) {   // CH-47 style: long box fuselage, two rotors
      g.add(lathe([[-3.2, 0], [-3.1, .5], [-2.7, .8], [2.8, .8], [3.2, .55]], 16, 1));
      for (const x of [-2.7, 2.9]) { const h = x > 0 ? 1.65 : 1.15; g.add(seg([x, 0.8, 0, x, h, 0])); const r = spin(new T.Group(), "y", x > 0 ? -1.6 : 1.6); r.position.set(x, h, 0);
        for (let k = 0; k < 3; k++) { const b = panel([[0.15, 0, -0.09], [3.3, 0, -0.07], [3.3, 0, 0.07], [0.15, 0, 0.09]], 3); b.rotation.y = k * Math.PI * 2 / 3; r.add(b); } g.add(r);
        Z.push(["rotor", [x, h, 0, 6.7, 0.1, 6.7]]); }
      for (const z of [0.7, -0.7]) g.add(seg([-1.6, -1.0, z, -1.6, -0.75, z, 1.8, -1.0, z, 1.8, -0.75, z], M.dim));
      Z.push(["fuselage", [0, 0, 0, 6.2, 1.7, 1.7]], ["engines", [2.6, 0.95, 0, 1.4, 0.5, 1.9]], ["gear", [0, -0.95, 0, 4, 0.4, 1.6]], ["avionics", [-2.9, 0, 0, 0.8, 1.4, 1.6]], ["tail", [2.9, 1, 0, 1, 1.2, 1]], ["fuel", [0, -0.5, 0.75, 3.5, 0.6, 0.4]]);
      buildStripe(0.86); stripe.position.set(0, 0, 0); g.add(stripe);
      g.userData = { len: 7.2, span: 7.6, scale: 1.05, zones: Z }; return g;
    }
    const pod = S.small ? [[-1.3, 0], [-1.2, .32], [-0.9, .55], [-0.2, .62], [0.5, .52], [0.9, .28], [1.1, .14]] : [[-1.7, 0], [-1.6, .38], [-1.2, .66], [-0.3, .78], [0.7, .7], [1.3, .42], [1.6, .2]];
    g.add(lathe(pod, 18, 1));
    const tb = S.small ? 3.8 : 4.6;
    g.add(lathe([[pod[pod.length - 1][0], .18], [3, .12], [tb, .07], [tb + 0.1, 0]], 10, 3, M.wire));
    g.add(panel([[tb - 0.45, 0.05, 0], [tb, 0.95, 0], [tb + 0.2, 0.95, 0], [tb + 0.1, 0.05, 0]], 2));
    g.add(panel([[tb - 1.1, 0.05, 0.05], [tb - 1.1, 0.05, 0.75], [tb - 0.85, 0.05, 0.75], [tb - 0.85, 0.05, 0.05]], 1, M.dim));
    const sk = S.small ? 1.25 : 1.5;
    if (S.wheels) { for (const [x, z] of [[-1.2, 0], [0.4, 0.6], [0.4, -0.6]]) g.add(seg([x, -0.7, z, x, -1.0, z], M.dim), (() => { const w = seg(ring(0.15, 20), M.dim); w.rotation.y = Math.PI / 2; w.position.set(x, -1.05, z); return w; })()); }
    else for (const z of [0.6, -0.6]) g.add(seg([-sk, -1.05, z, sk * 0.85, -1.05, z, -sk, -1.05, z, -sk - 0.25, -0.92, z, -0.7, -1.05, z, -0.5, -0.62, z * 0.75, 0.7, -1.05, z, 0.55, -0.6, z * 0.75], M.dim));
    const mh = S.small ? 0.95 : 1.12; g.add(seg([0, pod[3][1], 0, 0, mh, 0]));
    const rr = S.small ? 3.3 : 3.9, rotor = spin(new T.Group(), "y", 1.6); rotor.position.set(0, mh, 0);
    for (let k = 0; k < S.blades; k++) { const b = panel([[0.15, 0, -0.09], [rr, 0, -0.07], [rr, 0, 0.07], [0.15, 0, 0.09]], 4); b.rotation.y = k * Math.PI * 2 / S.blades; rotor.add(b); }
    g.add(rotor);
    if (S.fenestron) { const f = new T.Group(); f.add(seg(ring(0.38, 32))); const fan = spin(new T.Group(), "x", 8);
        const a = []; for (let k = 0; k < 9; k++) { const t = k / 9 * Math.PI * 2; a.push(0, 0.06 * Math.cos(t), 0.06 * Math.sin(t), 0, 0.34 * Math.cos(t + 0.3), 0.34 * Math.sin(t + 0.3)); } fan.add(seg(a));
        f.add(fan); f.rotation.y = Math.PI / 2; f.position.set(tb - 0.1, 0.45, 0); f.rotation.set(0, Math.PI / 2, 0); g.add(f);
        const ff = new T.Group(); ff.add(f); }
    else { const tr = spin(new T.Group(), "x", 6); tr.position.set(tb + 0.05, 0.55, 0.16); for (let k = 0; k < 2; k++) { const b = seg([0, -0.55, 0, 0, 0.55, 0]); b.rotation.x = k * Math.PI / 2; tr.add(b); } g.add(tr); }
    if (S.twin) g.add((() => { const e = lathe([[-0.2, .12], [0.9, .14], [1.2, .08]], 8, 1, M.dim); e.position.set(0.2, pod[3][1] * 0.95, 0.22); return e; })(),
                      (() => { const e = lathe([[-0.2, .12], [0.9, .14], [1.2, .08]], 8, 1, M.dim); e.position.set(0.2, pod[3][1] * 0.95, -0.22); return e; })());
    Z.push(["rotor", [0, mh, 0, rr * 2 + 0.1, 0.1, rr * 2 + 0.1]], ["fuselage", [-0.1, 0, 0, pod[pod.length - 1][0] - pod[0][0] + 0.2, 1.6, 1.6]],
      ["tail", [(tb + 1.5) / 2, 0.3, 0, tb - 1.3, 1.4, 0.9]], ["gear", [-0.2, -0.95, 0, sk * 2 + 0.3, 0.4, 1.5]], ["engines", [0.4, mh - 0.35, 0, 1.4, 0.45, 0.9]],
      ["avionics", [pod[0][0] + 0.4, 0, 0, 0.8, 1.2, 1.4]], ["fuel", [0.3, -0.45, 0, 1.4, 0.6, 1.3]]);
    buildStripe(pod[3][1] * 1.06); stripe.position.set(-0.15, 0, 0); g.add(stripe);
    g.userData = { len: tb + 2, span: rr * 2, scale: S.small ? 1.4 : 1.25, zones: Z };
    return g;
  }
  function engineModel(S) {
    const g = new T.Group(), Z = [];
    if (S.turboshaft) {   // PT6 / Arriel style: compact core, reverse-flow exhaust stubs, optional propeller
      g.add(lathe([[-1.8, .35], [-1.5, .55], [0.8, .6], [1.6, .45], [2.2, .3]], 16, 1));
      g.add(lathe([[0.2, .62], [0.5, .75], [0.9, .72], [1.1, .6]], 12, 1, M.dim));
      for (const z of [0.7, -0.7]) g.add(seg([0.6, 0.2, z * 0.8, 0.9, 0.45, z * 1.3, 0.9, 0.45, z * 1.3, 1.2, 0.3, z * 1.2], M.dim));
      if (S.prop) { const p = spin(propeller(1.9, 4), "x", 7); p.position.x = -2.0; g.add(p); Z.push(["fan", [-2.0, 0, 0, 0.4, 3.9, 3.9]]); }
      Z.push(["core", [0, 0, 0, 3.6, 1.3, 1.3]], ["nacelle", [0.2, 0, 0, 4.2, 1.5, 1.5]], ["engines", [0.2, 0, 0, 4.2, 1.5, 1.5]]);
      buildStripe(0.64); stripe.position.set(-0.4, 0, 0); g.add(stripe);
      g.userData = { len: 4.4, span: 1.6, scale: 1.45, zones: Z }; return g;
    }
    const fr = S.bypass === "low" ? 0.72 : 1.0, ln = S.bypass === "low" ? 1.25 : 1;
    g.add(lathe([[-2.2, .95 * fr], [-2.05, 1.06 * fr], [-1.4, 1.1 * fr], [0.6 * ln, 1.04 * fr], [1.5 * ln, .84 * fr], [1.9 * ln, .66 * fr]], 20, 1));
    g.add(lathe([[0.4, .6 * fr], [1.9 * ln, .58 * fr], [2.7 * ln, .44 * fr], [3.1 * ln, .26 * fr]], 14, 1, M.dim));
    g.add(lathe([[-2.0, 0], [-1.75, .2 * fr], [-1.45, .34 * fr]], 10, 2, M.dim));
    const fan = spin(new T.Group(), "x", 0.9); fan.position.set(-1.45, 0, 0);
    const nb = S.bypass === "low" ? 30 : S.blades || 22, a = [];
    for (let k = 0; k < nb; k++) { const t = k / nb * Math.PI * 2, t2 = t + 0.18; a.push(0, .34 * fr * Math.cos(t), .34 * fr * Math.sin(t), 0.08, fr * Math.cos(t2), fr * Math.sin(t2)); }
    fan.add(seg(a)); fan.add(seg(ring(fr, 60), M.dim)); g.add(fan);
    Z.push(["fan", [-1.5, 0, 0, 0.6, 2.25 * fr, 2.25 * fr]], ["core", [1.7 * ln, 0, 0, 2.8 * ln, 1.3 * fr, 1.3 * fr]], ["nacelle", [-0.3, 0, 0, 4.4, 2.35 * fr, 2.35 * fr]], ["engines", [0.3, 0, 0, 5.4, 2.3 * fr, 2.3 * fr]]);
    buildStripe(1.13 * fr); stripe.position.set(-0.6, 0, 0); g.add(stripe);
    g.userData = { len: 5.4 * ln, span: 2.3 * fr, scale: S.bypass === "low" ? 1.45 : 1.3, zones: Z };
    return g;
  }
  // ---------- archetypes: designation -> silhouette parameters ----------
  const W2 = (x, y, z) => [[x, y, z], [x, y, -z]];
  const A = {
    narrowbody: { label: "Twin-engine narrow-body", f: "w", len: 10, rad: 0.6, span: 9.6, wingX: 0.2, sweep: 1.9, chord: 1.9, taper: 0.3, fin: 1.6, hspan: 3.6, engines: W2(-0.3, -0.62, 1.75) },
    widebody: { label: "Twin-engine wide-body", f: "w", len: 11, rad: 0.78, span: 11.6, wingX: 0.3, sweep: 2.4, chord: 2.4, taper: 0.26, fin: 1.9, hspan: 4.4, engR: 0.42, engL: 1.8, engines: W2(-0.4, -0.85, 2.3), scale: 0.92 },
    quad: { label: "Four-engine wide-body", f: "w", len: 11.6, rad: 0.82, span: 12, wingX: 0.3, sweep: 2.6, chord: 2.5, taper: 0.25, fin: 2, hspan: 4.6, engR: 0.36, engL: 1.6, engines: [...W2(-0.6, -0.85, 2.2), ...W2(0.6, -0.6, 4.1)], scale: 0.88 },
    jumbo: { label: "Four-engine wide-body, upper deck", f: "w", hump: true, len: 11.8, rad: 0.84, span: 12, wingX: 0.3, sweep: 2.6, chord: 2.5, taper: 0.25, fin: 2.1, hspan: 4.6, engR: 0.38, engL: 1.6, engines: [...W2(-0.6, -0.88, 2.2), ...W2(0.6, -0.62, 4.1)], scale: 0.86 },
    double: { label: "Four-engine double-deck", f: "w", deck2: true, len: 11.6, rad: 0.95, span: 13, wingX: 0.2, sweep: 2.8, chord: 2.8, taper: 0.24, fin: 2.2, hspan: 5, engR: 0.42, engL: 1.7, engines: [...W2(-0.6, -0.95, 2.4), ...W2(0.6, -0.68, 4.5)], scale: 0.82 },
    reartwin: { label: "Rear-engine jet, T-tail", f: "w", ttail: true, len: 9.4, rad: 0.5, span: 8.4, wingX: 0.6, sweep: 1.5, chord: 1.6, taper: 0.32, fin: 1.4, hspan: 3, engR: 0.27, engL: 1.3, engines: W2(2.6, 0.35, 0.95) },
    trijet: { label: "Three-engine wide-body", f: "w", len: 11, rad: 0.78, span: 11.2, wingX: 0.3, sweep: 2.3, chord: 2.3, taper: 0.27, fin: 1.4, hspan: 4.2, engR: 0.4, engL: 1.7, engines: [...W2(-0.4, -0.85, 2.3), [4.3, 1.95, 0]], scale: 0.92 },
    bizjet3: { label: "Three-engine business jet", f: "w", len: 9, rad: 0.5, span: 8.2, wingX: 0.5, sweep: 1.5, chord: 1.6, taper: 0.3, fin: 1.4, hspan: 3.2, engR: 0.24, engL: 1.2, engines: [...W2(2.5, 0.35, 0.85), [3, 0.75, 0]] },
    turboprop: { label: "High-wing twin turboprop", f: "w", high: true, ttail: true, len: 9.6, rad: 0.55, span: 10.4, wingX: -0.2, sweep: 0.15, chord: 1.4, taper: 0.55, fin: 1.6, hspan: 3.4, engR: 0.3, engL: 1.5, engines: [[-0.6, 0.35, 2.0, 1], [-0.6, 0.35, -2.0, 1]] },
    ga_high: { label: "Single-engine high-wing", f: "w", ga: true, high: true, noseProp: true, noseBlades: 2, len: 6.6, rad: 0.5, span: 9, wingX: -0.5, sweep: 0, chord: 1.2, taper: 0.9, fin: 1.1, hspan: 2.6, engines: [], scale: 1.2 },
    ga_low: { label: "Single-engine low-wing", f: "w", ga: true, noseProp: true, noseBlades: 3, len: 7.2, rad: 0.52, span: 9, wingX: -0.2, sweep: 0.2, chord: 1.4, taper: 0.7, fin: 1.2, hspan: 2.8, engines: [], scale: 1.15 },
    ga_twin: { label: "Twin piston / turboprop, high wing", f: "w", ga: true, high: true, len: 7.8, rad: 0.55, span: 9.8, wingX: -0.3, sweep: 0.1, chord: 1.3, taper: 0.7, fin: 1.3, hspan: 3, engR: 0.26, engL: 1.2, engines: [[-0.7, 0.5, 1.6, 1], [-0.7, 0.5, -1.6, 1]], scale: 1.1 },
    heli_light: { label: "Single-engine helicopter, 3 blades", f: "h", blades: 3 },
    heli_light2: { label: "Light helicopter, 2 blades", f: "h", blades: 2, small: true },
    heli_fen: { label: "Helicopter with shrouded tail fan", f: "h", blades: 3, fenestron: true },
    heli_twin4: { label: "Twin-engine helicopter, 4 blades", f: "h", blades: 4, twin: true },
    heli_twin4f: { label: "Twin-engine helicopter, 4 blades, tail fan", f: "h", blades: 4, twin: true, fenestron: true },
    heli_5: { label: "Twin-engine helicopter, 5 blades", f: "h", blades: 5, twin: true, wheels: true },
    heli_tandem: { label: "Tandem-rotor helicopter", f: "h", tandem: true },
    hbpr: { label: "High-bypass turbofan", f: "e", bypass: "high" },
    lbpr: { label: "Low-bypass turbofan", f: "e", bypass: "low" },
    turboshaft: { label: "Turboshaft / turboprop engine", f: "e", turboshaft: true },
    tprop_eng: { label: "Turboprop engine with propeller", f: "e", turboshaft: true, prop: true },
  };
  const RULES = [
    [/^A38/, "double"], [/^(A34|A340)/, "quad"], [/^747/, "jumbo"], [/^(A35|A33|A30|A31[0-9]?-?[2-6]|A300|A310|767|777|787|A350)/, "widebody"],
    [/^(DC-10|MD-11|MD-10|L-?1011)/, "trijet"], [/^(FALCON\s?(7X|8X|900|50))/, "bizjet3"],
    [/^(DC-9|MD-8|MD-9|717|CL-600|CRJ|BD-700|BD-100|GIV|G-IV|GV|G-V|G[2-7]\d\d|GVII|GULFSTREAM|ERJ-?1[34]|EMB-?1[34]5|FALCON|F\.?28|F28|FOKKER|LEARJET|HAWKER|CITATION|C-?5\d\d)/, "reartwin"],
    [/^(ATR|DHC-8|DASH|EMB-?120|SAAB|DORNIER|CASA|C-?212|CN-?235|BEECH|KING ?AIR|B300|1900)/, "turboprop"],
    [/^(68[05]|69[05]|PA-?3[14]|PA-?44|BN-?2|DHC-6)/, "ga_twin"], [/^(PC-?6|1[5-9]\d|20[5-8]|210|DHC-[23]|A?17EU)/, "ga_high"], [/^(PC-?12|PC-?7|PA-?2|PA-?46|SR2|BONANZA|M20|750XL|TBM)/, "ga_low"],
    [/^(A31[89]|A32|A22|BD-500|737|757|EMB-?17|EMB-?19|ERJ-?17|ERJ-?19|ERJ 1[79]|MD-?9)/, "narrowbody"],
    [/^(CH-?47|234)/, "heli_tandem"], [/^(AW1[0-9]|AB139|A139|A169|A189|S-92|H175|EC175)/, "heli_5"],
    [/^(EC13|EC135|H135|EC130|H130|EC120|EC635)/, "heli_fen"], [/^(EC145|BK|MBB-BK|H145|EC155|AS365|SA-?365|AS-365)/, "heli_twin4f"],
    [/^(S-76|S-70|UH-60|412|212|AS332|EC225|H225|A109|AW109|429|430|427)/, "heli_twin4"],
    [/^(R22|R44|R66|206|204|205|47|269|300C)/, "heli_light2"], [/^(AS350|AS355|AS-3|H125|H120|407|505|MD-?500|369|600N|S-?300)/, "heli_light"],
    [/^(CFM|LEAP|GE90|GENX|GE9X|CF6|PW4|PW2|PW1[1-9]\d\dG|TRENT|RB211|V25|CF34|PW8|PW3|AE-?3007|BR7|PS-90|D-436)/, "hbpr"], [/^(TAY|JT8|JT9|SPEY|JT3|CF-?700|TFE|ALF|LF507|PW5|PW6|PW3)/, "lbpr"],
    [/^(PT6|PW1[0-2]\d(?!\dG)|PW2[0-1]\d|ARRIEL|ARRIUS|MAKILA|250-|RR300|T53|T55|TPE|LTS|ARDIDEN|CT7)/, "turboshaft"],
  ];
  function archetype(model, fallbackKind) {
    const u = (model || "").toUpperCase().replace(/\s+/g, " ").trim();
    for (const [rx, k] of RULES) if (rx.test(u) || rx.test(u.replace(/^[A-Z]+[- ]/, ""))) return k;
    return { helicopter: "heli_light", turbofan: "hbpr", airliner: "narrowbody", ga: "ga_high" }[fallbackKind] || "narrowbody";
  }
  // ---------- affected-area zones come from each built model ----------
  const zoneGroup = new T.Group(), zoneFill = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        zoneEdge = new T.LineBasicMaterial({ transparent: true, opacity: 0 });
  let zonePulse = 0, zoneOn = false;
  function setZone(name) {
    zoneGroup.clear(); zoneOn = false;
    const boxes = name && model && (model.userData.zones || []).filter(z => z[0] === name).map(z => z[1]);
    if (boxes && boxes.length) { for (const [x, y, z, sx, sy, sz] of boxes) { const g = new T.BoxGeometry(sx, sy, sz);
        const m = new T.Mesh(g, zoneFill), e = new T.LineSegments(new T.EdgesGeometry(g), zoneEdge); m.position.set(x, y, z); e.position.set(x, y, z); zoneGroup.add(m, e); }
      zoneOn = true; zonePulse = 0; }
    if (model && zoneGroup.parent !== model) model.add(zoneGroup);
    kick();
  }
  const hasZone = name => !!(model && (model.userData.zones || []).some(z => z[0] === name));

  // ---------- scene ----------
  // wireframe terrain: a valley under the aircraft, ridges rising toward the horizon, fading into fog
  const floor = (() => {
    const N = 64, S = 1.1, H = (x, z) => { const d = Math.hypot(x, z), ridge = Math.max(0, d - 7) / 10;
      return -2.6 + ridge * ridge * 2.2 * (0.55 + 0.45 * Math.sin(x * 0.23 + Math.cos(z * 0.17) * 2) * Math.cos(z * 0.21 - x * 0.07))
        + 0.25 * Math.sin(x * 0.9) * Math.cos(z * 0.8) * Math.min(1, ridge); };
    const a = [], P = (i, j) => { const x = (i - N / 2) * S, z = (j - N / 2) * S; return [x, H(x, z), z]; };
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { a.push(...P(i, j), ...P(i, j + 1)); a.push(...P(j, i), ...P(j + 1, i)); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(a, 3)); return new T.LineSegments(g, M.dim);
  })();
  scene.fog = new T.Fog(0x000000, 16, 46);
  scene.add(floor);
  const scanner = new T.Group();
  scanner.add(seg([0, -1.6, -5.6, 0, 1.6, -5.6, 0, 1.6, -5.6, 0, 1.6, 5.6, 0, 1.6, 5.6, 0, -1.6, 5.6, 0, -1.6, 5.6, 0, -1.6, -5.6], M.scan));
  const sp = new T.Mesh(new T.PlaneGeometry(11.2, 3.2), M.scanFill); sp.rotation.y = Math.PI / 2; scanner.add(sp);
  scene.add(scanner);
  let model = null, kind = null, arch = null;
  function setKind(k, modelName) {
    const ak = archetype(modelName, k || "airliner"); if (ak === arch) return; arch = ak;
    const S = A[ak]; kind = S.f === "h" ? "helicopter" : S.f === "e" ? "turbofan" : "airliner";
    if (model) scene.remove(model);
    spinners = []; stripe.rotation.set(0, 0, 0);
    model = S.f === "h" ? helicopter(S) : S.f === "e" ? engineModel(S) : fixedWing(S);
    const sc = model.userData.scale; model.scale.setScalar(sc); model.position.y = 1.15;
    floor.position.y = kind === "helicopter" ? -0.3 : 0; scene.add(model); model.add(zoneGroup); setZone(null); paintStripe(); kick();
  }
  // ---------- camera, drag, resize ----------
  let az = -0.75, el = 0.42, dragging = false, px = 0, py = 0, autoT = 0, view = "3d", tAz = null, tEl = null;
  function setView(v) { view = v; if (v === "top") { tAz = Math.round(az / (Math.PI * 2)) * Math.PI * 2 - Math.PI / 2; tEl = 1.5; }
    else if (v === "side") { tAz = Math.round(az / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2; tEl = 0.06; } else { tAz = null; tEl = 0.42; } kick(); }
  cv.addEventListener("pointerdown", e => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!dragging) return; tAz = null; tEl = null; az -= (e.clientX - px) * 0.008; el = Math.max(0.08, Math.min(1.2, el + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; autoT = 2.5; kick(); });
  cv.addEventListener("pointerup", () => dragging = false);
  function size() { const r = host.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); kick(); }
  new ResizeObserver(size).observe(host);
  // ---------- loop (pauses off-screen and in background tabs) ----------
  let visible = true, raf = 0, last = performance.now(), scanT = -1;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; kick(); }).observe(host);
  document.addEventListener("visibilitychange", kick);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colors);
  new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  function kick() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce && view === "3d" && tAz === null) { if (autoT > 0) autoT -= dt; else az += dt * 0.12; }
    let easing = false;
    if (tAz !== null && !dragging) { az += (tAz - az) * Math.min(1, dt * 4); if (Math.abs(tAz - az) > 0.002) easing = true; }
    if (tEl !== null && !dragging) { el += (tEl - el) * Math.min(1, dt * 4); if (Math.abs(tEl - el) > 0.002) easing = true; else if (view === "3d") tEl = null; }
    if (zoneOn) { zonePulse += dt; const f = reduce ? 0.6 : 0.45 + 0.35 * Math.sin(zonePulse * 2.4); zoneFill.opacity = 0.10 * f + 0.04; zoneEdge.opacity = 0.55 + 0.4 * f; }
    if (!reduce) for (const sp of spinners) sp.o.rotation[sp.axis] += dt * sp.speed;
    broken += (brokenTarget - broken) * Math.min(1, dt * 6);
    halfB.position.set(broken * 0.16, broken * 0.05, 0); halfB.rotation.x = broken * 0.22;
    if (scanT >= 0 && model) {
      scanT += dt / 0.9; const L = model.userData.len * model.userData.scale, x = -L / 2 + L * Math.min(1, scanT);
      scanner.position.set(x, model.position.y, 0);
      const f = Math.sin(Math.min(1, scanT) * Math.PI); M.scan.opacity = 0.9 * f; M.scanFill.opacity = 0.07 * f;
      if (scanT >= 1) { scanT = -1; M.scan.opacity = 0; M.scanFill.opacity = 0; }
    }
    const R = view === "top" ? 17 : 15.5; cam.position.set(R * Math.cos(el) * Math.cos(az), R * Math.sin(el) + 1, R * Math.cos(el) * Math.sin(az));
    cam.lookAt(0, 1.0, 0); renderer.render(scene, cam);
    const moving = !reduce || scanT >= 0 || Math.abs(brokenTarget - broken) > 0.002 || dragging || easing || zoneOn;
    if (moving && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  api.setKind = setKind; api.setZone = setZone; api.setView = setView; api.kind = () => kind; api.hasZone = hasZone;
  api.archetype = (m, k) => { const a = archetype(m, k); return { key: a, label: A[a].label }; };
  api.setState = s => { state = s; brokenTarget = s === "broken" ? 1 : 0; paintStripe(); kick(); };
  api.scan = () => { if (reduce) return; scanT = 0; kick(); };
  colors(); setKind("airliner", ""); size();
})();
