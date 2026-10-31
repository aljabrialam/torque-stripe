/* Torque Stripe inspection stage: a wireframe airliner, helicopter or turbofan drawn with three.js lines.
   The orange ring is the torque stripe. It is intact when the rules confirm coverage, broken when the
   system refuses or needs input, and grey when the proposal does not list the model.
   Decoration only: it shows the engine's verdict and never makes one. */
(function () {
  const cv = document.getElementById("stagecv"), host = document.getElementById("stage");
  const api = { setKind() {}, setState() {}, scan() {} };
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
    M.wire.color.set(css("--wire")); M.dim.color.set(css("--wire-dim")); M.dots.color.set(css("--wire-dim"));
    M.scan.color.set(css("--accent")); M.scanFill.color.set(css("--accent")); paintStripe();
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

  // ---------- models ----------
  function airliner() {
    const g = new T.Group();
    g.add(lathe([[-5, 0], [-4.85, .22], [-4.6, .38], [-4.2, .52], [-3.6, .6], [-2.5, .62], [1.5, .62], [3, .58], [3.8, .46], [4.5, .28], [5, .1]], 18, 1));
    const wing = [[-0.9, -0.18, 0.6], [1.35, 0.17, 5.1], [1.95, 0.17, 5.1], [1.05, -0.18, 0.6]];
    g.add(panel(wing, 7), panel(mirrorZ(wing), 7));
    const ht = [[3.7, 0.12, 0.25], [4.45, 0.22, 1.9], [4.8, 0.22, 1.9], [4.55, 0.12, 0.25]];
    g.add(panel(ht, 3), panel(mirrorZ(ht), 3));
    g.add(panel([[3.2, 0.55, 0], [4.45, 2.1, 0], [4.85, 2.1, 0], [4.75, 0.5, 0]], 3));
    for (const z of [1.95, -1.95]) { const e = lathe([[-0.75, .24], [-0.65, .33], [0.35, .31], [0.65, .2]], 14, 1, M.dim); e.position.set(0.1, -0.62, z); g.add(e); }
    buildStripe(0.68); stripe.position.set(-0.35, 0, 0); g.add(stripe);
    g.userData = { len: 10.6, span: 10.4, scale: 1 };
    return g;
  }
  let rotor = null, tailRotor = null, fan = null;
  function helicopter() {
    const g = new T.Group();
    g.add(lathe([[-1.7, 0], [-1.6, .38], [-1.2, .66], [-0.3, .78], [0.7, .7], [1.3, .42], [1.6, .2]], 18, 1));
    g.add(lathe([[1.5, .2], [3, .13], [4.6, .08], [4.7, 0]], 10, 3, M.wire));
    g.add(panel([[4.2, 0.05, 0], [4.65, 0.95, 0], [4.85, 0.95, 0], [4.75, 0.05, 0]], 2));
    g.add(panel([[3.6, 0.05, 0.05], [3.6, 0.05, 0.75], [3.85, 0.05, 0.75], [3.85, 0.05, 0.05]], 1, M.dim));
    for (const z of [0.6, -0.6]) {
      g.add(seg([-1.5, -1.05, z, 1.3, -1.05, z, -1.5, -1.05, z, -1.75, -0.92, z, -0.7, -1.05, z, -0.5, -0.62, z * 0.75, 0.7, -1.05, z, 0.55, -0.6, z * 0.75], M.dim));
    }
    g.add(seg([0, 0.78, 0, 0, 1.12, 0]));
    rotor = new T.Group(); rotor.position.set(0, 1.12, 0);
    for (let k = 0; k < 4; k++) { const b = panel([[0.15, 0, -0.09], [3.9, 0, -0.07], [3.9, 0, 0.07], [0.15, 0, 0.09]], 4); b.rotation.y = k * Math.PI / 2; rotor.add(b); }
    g.add(rotor);
    tailRotor = new T.Group(); tailRotor.position.set(4.65, 0.55, 0.16);
    for (let k = 0; k < 2; k++) { const b = seg([0, -0.55, 0, 0, 0.55, 0]); b.rotation.z = k * Math.PI / 2; tailRotor.add(b); }
    g.add(tailRotor);
    buildStripe(0.82); stripe.position.set(-0.15, 0, 0); g.add(stripe);
    g.userData = { len: 6.6, span: 7.8, scale: 1.25 };
    return g;
  }
  function turbofan() {
    const g = new T.Group();
    g.add(lathe([[-2.2, .95], [-2.05, 1.06], [-1.4, 1.1], [0.6, 1.04], [1.5, .84], [1.9, .66]], 20, 1));
    g.add(lathe([[0.4, .6], [1.9, .58], [2.7, .44], [3.1, .26]], 14, 1, M.dim));
    g.add(lathe([[-2.0, 0], [-1.75, .2], [-1.45, .34]], 10, 2, M.dim));
    fan = new T.Group(); fan.position.set(-1.45, 0, 0);
    const a = []; for (let k = 0; k < 22; k++) { const t = k / 22 * Math.PI * 2, t2 = t + 0.18; a.push(0, .34 * Math.cos(t), .34 * Math.sin(t), 0.08, 1.0 * Math.cos(t2), 1.0 * Math.sin(t2)); }
    fan.add(seg(a)); fan.add(seg(ring(1.0, 60), M.dim)); g.add(fan);
    buildStripe(1.13); stripe.position.set(-0.6, 0, 0); g.add(stripe);
    g.userData = { len: 5.4, span: 2.3, scale: 1.3 };
    return g;
  }
  // ---------- scene ----------
  const floor = (() => { const a = []; for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) a.push(i * 0.55, 0, j * 0.55);
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(a, 3)); return new T.Points(g, M.dots); })();
  scene.add(floor);
  const scanner = new T.Group();
  scanner.add(seg([0, -1.6, -5.6, 0, 1.6, -5.6, 0, 1.6, -5.6, 0, 1.6, 5.6, 0, 1.6, 5.6, 0, -1.6, 5.6, 0, -1.6, 5.6, 0, -1.6, -5.6], M.scan));
  const sp = new T.Mesh(new T.PlaneGeometry(11.2, 3.2), M.scanFill); sp.rotation.y = Math.PI / 2; scanner.add(sp);
  scene.add(scanner);
  let model = null, kind = null;
  function setKind(k) {
    k = k || "airliner"; if (k === kind) return; kind = k;
    if (model) scene.remove(model);
    rotor = tailRotor = fan = null; stripe.rotation.set(0, 0, 0);
    model = { airliner, helicopter, turbofan }[k]();
    const s = model.userData.scale; model.scale.setScalar(s); model.position.y = 1.15;
    floor.position.y = k === "helicopter" ? -0.2 : 0; scene.add(model); paintStripe(); kick();
  }
  // ---------- camera, drag, resize ----------
  let az = -0.75, el = 0.42, dragging = false, px = 0, py = 0, autoT = 0;
  cv.addEventListener("pointerdown", e => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!dragging) return; az -= (e.clientX - px) * 0.008; el = Math.max(0.08, Math.min(1.2, el + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; autoT = 2.5; kick(); });
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
    if (!reduce) { if (autoT > 0) autoT -= dt; else az += dt * 0.12; }
    if (rotor) rotor.rotation.y += dt * (reduce ? 0 : 1.6);
    if (tailRotor) tailRotor.rotation.x += dt * (reduce ? 0 : 6);
    if (fan) fan.rotation.x += dt * (reduce ? 0 : 0.9);
    broken += (brokenTarget - broken) * Math.min(1, dt * 6);
    halfB.position.set(broken * 0.16, broken * 0.05, 0); halfB.rotation.x = broken * 0.22;
    if (scanT >= 0 && model) {
      scanT += dt / 0.9; const L = model.userData.len * model.userData.scale, x = -L / 2 + L * Math.min(1, scanT);
      scanner.position.set(x, model.position.y, 0);
      const f = Math.sin(Math.min(1, scanT) * Math.PI); M.scan.opacity = 0.9 * f; M.scanFill.opacity = 0.07 * f;
      if (scanT >= 1) { scanT = -1; M.scan.opacity = 0; M.scanFill.opacity = 0; }
    }
    const R = 15.5; cam.position.set(R * Math.cos(el) * Math.cos(az), R * Math.sin(el) + 1, R * Math.cos(el) * Math.sin(az));
    cam.lookAt(0, 1.0, 0); renderer.render(scene, cam);
    const moving = !reduce || scanT >= 0 || Math.abs(brokenTarget - broken) > 0.002 || dragging;
    if (moving && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  api.setKind = setKind;
  api.setState = s => { state = s; brokenTarget = s === "broken" ? 1 : 0; paintStripe(); kick(); };
  api.scan = () => { if (reduce) return; scanT = 0; kick(); };
  colors(); setKind("airliner"); size();
})();
