// Pixel Character Lab: three tabs (Skeleton, Body, Clothing). Skeleton always shows the assembled skeleton.
// Workflow first: view → angle → movement → play → export. Occasional and technical settings sit in collapsed sections.
// Every view is the same anatomy model (spine-core + thorax-core) through the same pixel-art renderer (spine-render).
(() => {
const $ = (id) => document.getElementById(id);
const C = window.SpineCore, R = window.SpineRender, TR = window.ThoraxRig, SR = window.SpineRig, ROM = window.SpineROM, PV = window.PelvisCore;

// ---------- constants ----------
const TABS = [
  { id: "skeleton", name: "Skeleton" },
  { id: "body", name: "Body", empty: "The body is built around the finished skeleton in a later stage. No body artwork exists yet." },
  { id: "clothing", name: "Clothing", empty: "Close-fitting clothing follows the body in a later stage. No clothing artwork exists yet." },
];
// camera: angle kind + which side of the body faces the camera (subject's right / left)
const ANGLES = [["front", "Front"], ["q", "¾"], ["side", "Side"], ["back", "Back"], ["qb", "¾ back"]];
const viewIdOf = (a, s) => (a === "front" || a === "back" ? a : a === "side" ? (s === "R" ? "right" : "left") : `${a === "q" ? "front" : "back"}-${s === "R" ? "right" : "left"}`);
const angleOf = (id) => (id === "front" || id === "back" ? [id, null] : id === "right" || id === "left" ? ["side", id[0].toUpperCase()] : [id.startsWith("front") ? "q" : "qb", id.endsWith("right") ? "R" : "L"]);
const ANGLE_NAMES = { front: "Front", q: "Front ¾", side: "Side", back: "Back", qb: "Back ¾" };
const PRESETS = {
  "Study bone (approved)": ["#2b211b", "#5c4a3b", "#8e7860", "#bca98a", "#e0d4b8", "#faf4e3"],
  "pixelfx bone": ["#1a1814", "#3a352c", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0"],
  "Cool ivory": ["#1e2128", "#4a4f5c", "#7f8593", "#b3b6bd", "#dcdcd8", "#f7f6f0"],
  "X-ray": ["#0b1a24", "#1f4257", "#3f7590", "#6fa9c2", "#a9d6e6", "#e6f7fb"],
};
const SLOT = ["outline", "line", "shade", "mid", "light", "hi"];
const BGS = { neutral: ["Neutral", "#2a2f35"], checker: ["Transparent", null], dark: ["Dark", "#121417"], light: ["Light", "#eef0f2"], skin: ["Skin", "#c99a7c"] };
const PART_COLORS = { 1: "#d9a441", 2: "#5aa6c9", 3: "#8b7fd1", 4: "#5fb38a", 5: "#d9708a", 6: "#c98b5a", 7: "#7c9cd9", 8: "#e0605a", 9: "#59b7c9",
  10: "#a87fc9", 11: "#c9c25a", 12: "#a7b2b0", 13: "#b59a72", 14: "#e3b98f", 15: "#c7a5c9", 16: "#e89a4f", 17: "#6fcf9a", 18: "#d9a441", 19: "#3a3330",
  20: "#e0605a", 21: "#e89a4f", 22: "#c9c25a", 23: "#d9b98a", 24: "#a7b2b0", 25: "#59b7c9", 26: "#5aa6c9", 27: "#8b7fd1", 28: "#6fcf9a", 29: "#5fb38a", 30: "#c7a5c9",
  31: "#7c9cd9", 32: "#5fb38a", 33: "#d9a441", 34: "#e0605a", 35: "#c98b5a", 36: "#a87fc9", 37: "#59b7c9", 38: "#6fcf9a", 39: "#e89a4f", 40: "#c9c25a", 41: "#d9708a", 42: "#8b7fd1",
  43: "#e0605a", 44: "#e89a4f", 45: "#5aa6c9", 46: "#7c9cd9", 47: "#5fb38a", 48: "#c98b5a", 49: "#d9a441", 50: "#c9c25a", 51: "#8b7fd1", 52: "#59b7c9",
  53: "#d9708a", 54: "#6fcf9a", 55: "#a87fc9", 56: "#b59a72", 57: "#e3b98f", 58: "#c7a5c9", 59: "#cfd8d4", 60: "#a7b2b0", 61: "#d9a441", 62: "#5aa6c9", 63: "#e0605a" };
const REGION_COLORS = { cervical: "#d9a441", thoracic: "#5aa6c9", lumbar: "#8b7fd1", sacral: "#5fb38a", coccygeal: "#d9708a", disc: "#a7b2b0",
  ribcage: "#e3b98f", cartilage: "#cfd8d4", sternum: "#e0605a", clavicle: "#6fcf9a", scapula: "#c9c25a", pelvis: "#d98a5f", joint: "#b9c4c0", hyoid: "#a87fc9" };
const REGION_NAMES = { cervical: "Cervical", thoracic: "Thoracic", lumbar: "Lumbar", sacral: "Sacral", coccygeal: "Coccygeal", disc: "Discs", ribcage: "Ribs", cartilage: "Costal cartilage", sternum: "Sternum", clavicle: "Clavicles", scapula: "Scapulae", pelvis: "Hip bones", joint: "Pelvic joints", hyoid: "Hyoid" };
const DEMO_NAMES = { neutral: "Neutral", flexion: "Bend forward", extension: "Bend back", "bend-left": "Side bend left", "bend-right": "Side bend right",
  "rotate-left": "Twist left", "rotate-right": "Twist right", combined: "Combined", shrug: "Shrug", "shoulders-back": "Shoulder blades back",
  "reach-forward": "Reach forward", "upward-rotation": "Upward rotation",
  "pelvic-tilt-anterior": "Pelvic tilt forward", "pelvic-tilt-posterior": "Pelvic tilt back" };
const REGIONS = [["cervical", "Neck"], ["thoracic", "Upper back"], ["lumbar", "Lower back"], ["clavicle", "Shoulders"], ["pelvis", "Pelvis"]];
const LOOK = { lightDir: 136, lightFront: 32, ambient: 0.16, aoStr: 1, exposure: 1, outline: true, lines: true, gap: 3, rim: true, clusters: true, mm: 1, bg: "neutral",
  bone6: PRESETS["Study bone (approved)"], disc6: R.PALETTES.disc, preset: "Study bone (approved)" };
const DEFAULTS = { tab: "skeleton", view: "front", side: "R", zoom: "fit", labels: false, guides: false, colorby: "none",
  layers: { spine: true, ribcage: true, clavicles: true, pelvis: true, hyoid: true }, region: "thoracic", clavLink: true };
const KEY = "pixel-character-lab-v2";
const clone = (o) => JSON.parse(JSON.stringify(o));
let S = load();
function load() {
  const base = { ...clone(DEFAULTS), ...clone(LOOK) };
  try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) return { ...base, ...o, layers: { ...base.layers, ...(o.layers || {}) } }; } catch (e) { /* no storage */ }
  return base;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ---------- model and rig ----------
const sk = TR.buildSkeleton();
const full = { els: sk.els, comps: sk.els.map(C.compile) };
const rig = TR.makeRig(sk);
const layerOf = (el) => (["rib", "cartilage", "sternum"].includes(el.kind) ? "ribcage" : el.kind === "clavicle" || el.kind === "scapula" ? "clavicles"
  : el.kind === "hip" || el.kind === "joint" ? "pelvis" : el.kind === "hyoid" ? "hyoid" : "spine");
const normPose = (p) => { const z = TR.ZERO(); p = p || {}; for (const k of [...ROM.REGIONS, "root"]) z[k] = { ...z[k], ...(p[k] || {}) }; for (const s of ["L", "R"]) { const c = (p.clavicle || {})[s] || {}; for (const k of ["elev", "prot", "up"]) z.clavicle[s][k] = +c[k] || 0; } return z; };
const poseKey = (p) => JSON.stringify(normPose(p));
S.pose = normPose(S.pose);
delete S.sacrumFixed;                                    // older saved state: the pelvis is now a region of its own
const posedCache = new Map();
function posed(pose) {
  const k = poseKey(pose); if (posedCache.has(k)) return posedCache.get(k);
  const m = TR.posedModel(rig, full.comps, normPose(pose)); posedCache.set(k, m); if (posedCache.size > 24) posedCache.delete(posedCache.keys().next().value); return m;
}
const modelFor = (pose) => ({ ...posed(pose), frameMM: R.FRAME.W * R.FRAME.mm, pivot: R.FRAME.pivot });
let model = modelFor(S.pose);
const VIEW = (id) => R.VIEWS.find((v) => v.id === id);
const viewSpec = (m, id, mm) => { const W = Math.round(m.frameMM / mm); return { yaw: VIEW(id).yaw, pitch: 0, mm, W, H: W, pivot: m.pivot, ss: 3 }; };
const visible = () => full.els.map((e, k) => (S.layers[layerOf(e)] ? k : -1)).filter((k) => k >= 0);

// ---------- workers ----------
const SRC = ["core-src", "rom-src", "rig-src", "thorax-src", "shoulder-src", "pelvis-src", "thorax-rig-src", "render-src"].map((id) => $(id).textContent).join("\n") + `
  let SK = null, FULL = null, RIGW = null;
  function full() { if (!FULL) { SK = ThoraxRig.buildSkeleton(); FULL = { els: SK.els, comps: SK.els.map(SpineCore.compile) }; RIGW = ThoraxRig.makeRig(SK); } return FULL; }
  // per-element cache for the pelvic bones: they do not move in spinal or shoulder poses, so they are not cast again
  const PART = new Map(), CACHED = { hip: 1, sacrum: 1, coccyx: 1, joint: 1 }; let PART_BYTES = 0;
  const keep = (key, g) => { PART.set(key, g); PART_BYTES += g.idx.length * 26;
    while (PART_BYTES > 64e6 && PART.size > 1) { const [k0, g0] = PART.entries().next().value; PART.delete(k0); PART_BYTES -= g0.idx.length * 26; } };
  self.onmessage = (ev) => {
    const q = ev.data; full(); const M = ThoraxRig.posedModel(RIGW, FULL.comps, q.pose), v = q.view, parts = [], rest = [];
    const vk = [v.yaw, v.pitch, v.mm, v.W, v.H, v.ss, v.pivot].join(",");
    q.only.forEach((it) => {
      const k = Array.isArray(it) ? it[0] : it, el = M.els[k];
      if (!CACHED[el.kind]) { rest.push(it); return; }
      const key = JSON.stringify([it, el.R || el.psi, el.o]) + vk;
      let g = PART.get(key); if (!g) { g = SpineRender.cast(M, v, null, [it]); keep(key, g); }
      parts.push(g);
    });
    if (rest.length || !parts.length) parts.push(SpineRender.cast(M, v, (p) => self.postMessage({ id: q.id, progress: p }), rest));
    const m = parts.length ? SpineRender.merge(parts) : SpineRender.cast(M, v, null, []);
    const g = { ...m, idx: m.idx.slice(), depth: m.depth.slice(), nx: m.nx.slice(), ny: m.ny.slice(), nz: m.nz.slice(), ao: m.ao.slice(), part: m.part.slice(), obj: m.obj.slice() };
    self.postMessage({ id: q.id, g }, [g.idx.buffer, g.depth.buffer, g.nx.buffer, g.ny.buffer, g.nz.buffer, g.ao.buffer, g.part.buffer, g.obj.buffer]);
  };`;
let workers = [];
try { const url = URL.createObjectURL(new Blob([SRC], { type: "text/javascript" })); const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)); for (let i = 0; i < n; i++) workers.push(new Worker(url)); }
catch (e) { workers = []; }
const HEAVY = { hip: 3, scapula: 1.6, sacrum: 1.4 };            // measured cast cost relative to the box estimate
const cost = full.comps.map((c, k) => (c.box[3] - c.box[0] + c.box[4] - c.box[1]) * (c.box[4] - c.box[1] + c.box[5] - c.box[2]) * (c.chunks ? 0.35 : 1) * (HEAVY[full.els[k].kind] || 1));
function sharesFor(ks) {
  const nW = Math.max(1, workers.length), sh = Array.from({ length: nW }, () => ({ k: [], c: 0 }));
  const target = ks.reduce((a, k) => a + cost[k], 0) / nW, items = [];
  for (const k of ks) {             // a bone that would dominate one worker is cast in horizontal bands by several
    const nb = nW > 1 ? Math.min(nW, Math.ceil(cost[k] / (0.5 * target))) : 1;
    if (nb <= 1) items.push([cost[k], k]); else for (let i = 0; i < nb; i++) items.push([cost[k] / nb, [k, i / nb, (i + 1) / nb]]);
  }
  items.sort((a, b) => b[0] - a[0]).forEach(([c, k]) => { const s = sh.reduce((a, b) => (a.c <= b.c ? a : b)); s.k.push(k); s.c += c; });
  return sh;
}
const cache = new Map(); let jobId = 0;
function geometry(viewId, mm, onProgress, pose) {
  pose = normPose(pose || S.pose);
  const vis = visible(), key = `${poseKey(pose)}|${vis.join(",")}|${viewId}|${mm}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const m = modelFor(pose), view = viewSpec(m, viewId, mm);
  if (!workers.length) return new Promise((res) => setTimeout(() => { const g = R.cast(m, view, null, vis); cache.set(key, g); res(g); }, 10));
  const id = ++jobId;
  const jobs = sharesFor(vis).map((s, i) => ({ w: workers[i], only: s.k })).filter((j) => j.only.length);
  if (!jobs.length) { const g = R.cast(m, view, null, []); cache.set(key, g); return Promise.resolve(g); }
  const prog = jobs.map(() => 0);
  return Promise.all(jobs.map((j, i) => new Promise((res) => {
    const h = (ev) => { if (ev.data.id !== id) return; if (ev.data.g) { j.w.removeEventListener("message", h); res(ev.data.g); } else { prog[i] = ev.data.progress; onProgress && onProgress(prog.reduce((a, b) => a + b, 0) / prog.length); } };
    j.w.addEventListener("message", h); j.w.postMessage({ id, view, only: j.only, pose });
  }))).then((parts) => { const g = R.merge(parts); cache.set(key, g); if (cache.size > 40) cache.delete(cache.keys().next().value); return g; });
}

// ---------- pixels ----------
let geo = null, st = null, hoverObj = 0;
const styleOf = () => ({ lightDir: S.lightDir, lightFront: S.lightFront, ambient: S.ambient, aoStr: S.aoStr, exposure: S.exposure, gap: S.gap, outline: S.outline, lines: S.lines, rim: S.rim, clusters: S.clusters });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// clean = palette colours only (artwork); otherwise diagnostic colouring and hover highlight as shown
function pixels(s, m, clean) {
  const rgba = R.paint(s, m, { bone: S.bone6, disc: S.disc6 });
  if (clean) return rgba;
  if (S.colorby !== "none") {
    const mul = [0, 0, 0.45, 0.62, 0.8, 0.95, 1.08];
    for (let p = 0; p < s.W * s.H; p++) {
      const v = s.lab[p]; if (!v || v === 1) continue;
      const el = m.els[s.obj[p] - 1];
      const c = hex(S.colorby === "part" ? PART_COLORS[s.part[p]] || "#888888" : REGION_COLORS[el.kind === "disc" ? "disc" : el.kind === "joint" ? "joint" : el.region] || "#888888");
      rgba[p * 4] = c[0] * mul[v]; rgba[p * 4 + 1] = c[1] * mul[v]; rgba[p * 4 + 2] = c[2] * mul[v];
    }
  }
  return rgba;
}

// ---------- zoom ----------
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 2, 3, 4, 6, 8];
function fitZoom() {
  const vp = $("viewport"), cs = getComputedStyle(vp);
  const aw = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = vp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const W = st ? st.W : Math.round(R.FRAME.W / S.mm), s = Math.min(aw / W, ah / W);
  if (!(s > 0)) return 1;
  return s >= 1 ? Math.floor(s) : s;           // integer above 1× keeps pixels crisp; below 1× the exact fit
}
const zoomNow = () => (S.zoom === "fit" ? fitZoom() : +S.zoom);
function stepZoom(dir) {
  const z = zoomNow();
  const next = dir > 0 ? ZOOMS.find((v) => v > z + 1e-6) : [...ZOOMS].reverse().find((v) => v < z - 1e-6);
  if (next) { S.zoom = next; save(); syncZoom(); draw(); }
}
function syncZoom() {
  const z = zoomNow();
  $("zoom-out-val").textContent = `${Math.round(z * 100)} %`;
  $("zoom-fit").setAttribute("aria-pressed", String(S.zoom === "fit"));
  $("zoom-in").disabled = z >= ZOOMS[ZOOMS.length - 1]; $("zoom-out").disabled = z <= ZOOMS[0];
}

// ---------- drawing ----------
function paintBg(ctx, w, h, z) {
  const bg = BGS[S.bg] || BGS.neutral;
  if (bg[1]) { ctx.fillStyle = bg[1]; ctx.fillRect(0, 0, w, h); return; }
  const c = Math.max(4, 8 * Math.max(1, Math.round(z / 2))); ctx.fillStyle = "#3b4149"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#434a53";
  for (let y = 0; y < h; y += c) for (let x = (y / c) % 2 ? c : 0; x < w; x += 2 * c) ctx.fillRect(x, y, c, c);
}
function drawGuides(ctx, z) {
  ctx.save(); ctx.strokeStyle = "rgba(124,196,216,0.65)"; ctx.lineWidth = 1; ctx.setLineDash([Math.max(4, z * 2), Math.max(4, z * 2)]); ctx.beginPath();
  const cy = Math.floor(st.H / 2) * z + 0.5, cx = Math.floor(st.W / 2) * z + 0.5;
  ctx.moveTo(0, cy); ctx.lineTo(st.W * z, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, st.H * z); ctx.stroke(); ctx.restore();
}
function draw() {
  if (!st || S.tab !== "skeleton") return;
  const z = zoomNow(), cv = $("cv"), w = Math.max(1, Math.round(st.W * z)), h = Math.max(1, Math.round(st.H * z));
  const rgba = pixels(st, model, false);
  if (hoverObj) for (let p = 0; p < st.W * st.H; p++) if (st.lab[p] && st.obj[p] !== hoverObj) { rgba[p * 4] *= 0.5; rgba[p * 4 + 1] *= 0.5; rgba[p * 4 + 2] *= 0.55; }
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H; off.getContext("2d").putImageData(new ImageData(rgba, st.W, st.H), 0, 0);
  cv.width = w; cv.height = h; cv.classList.toggle("soft", z < 1);
  const ctx = cv.getContext("2d");
  paintBg(ctx, w, h, z);
  ctx.imageSmoothingEnabled = z < 1; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, w, h);
  if (S.guides) drawGuides(ctx, z);
  const vp = $("viewport"); vp.classList.toggle("scroll", w > vp.clientWidth - 24 || h > vp.clientHeight - 24);
  drawLabels(z); syncZoom();
}
// labels: vertebrae beside the column (outside the cage in front / back views), rib numbers at the cage's edge
function labelList() {
  const out = []; if (!S.labels) return out;
  const v = VIEW(S.view), spec = viewSpec(model, S.view, S.mm), side = Math.sin((v.yaw * Math.PI) / 180);
  if (S.layers.spine) for (const el of model.els) {
    if (!["vertebra", "sacrum", "coccyx"].includes(el.kind)) continue;
    const p = R.project(el.o, spec);
    const off = S.layers.ribcage && Math.abs(side) < 0.75 && el.kind === "vertebra" && /^(C7|T\d+)$/.test(el.id) ? 175 : 50;
    if (side > 0.3) out.push({ x: p[0] + 44 / S.mm, y: p[1], t: el.id, right: true }); else out.push({ x: p[0] - off / S.mm, y: p[1], t: el.id, right: false });
  }
  if (S.layers.ribcage && Math.abs(side) < 0.75) {
    const ribSide = Math.cos((v.yaw * Math.PI) / 180) >= 0 ? "L" : "R"; let lastY = -1e9;
    const ribs = [];
    model.els.forEach((el, k) => {
      if (el.kind !== "rib" || el.side !== ribSide) return;
      const rest = full.els[k]; let best = null, bx = -1e9;
      for (const nd of rest.geo.nodes) { const q = R.project(C.toWorld(el, [nd.p[0] - rest.o[0], nd.p[1] - rest.o[1], nd.p[2] - rest.o[2]]), spec); if (q[0] > bx) { bx = q[0]; best = q; } }
      if (best) ribs.push({ x: best[0] + 8 / S.mm, y: best[1], t: String(el.n), right: true });
    });
    ribs.sort((a, b) => a.y - b.y).forEach((r) => { if (r.y - lastY >= 11 / S.mm) { out.push(r); lastY = r.y; } });
  }
  return out;
}
function drawLabels(z) {
  const box = $("lbl-layer"); box.innerHTML = "";
  for (const l of labelList()) {
    const d = document.createElement("span"); d.className = "lbl" + (l.right ? "" : " l"); d.textContent = l.t;
    d.style.top = l.y * z + "px"; d.style.left = l.x * z + "px"; box.appendChild(d);
  }
}
let restyleT = 0;
function restyle() { stopPlay(true); cancelAnimationFrame(restyleT); restyleT = requestAnimationFrame(() => { if (!geo) return; model = modelFor(S.pose); st = R.stylise(geo, model, styleOf()); draw(); }); }
let token = 0;
async function render() {
  stopPlay(true); save(); syncTab();
  if (S.tab !== "skeleton") return;
  model = modelFor(S.pose); syncAll();
  const t = ++token; $("busy").hidden = false; $("busy").textContent = "Rendering…";
  const g = await geometry(S.view, S.mm, (p) => { if (t === token) $("busy").textContent = `Rendering… ${Math.round(p * 100)} %`; });
  if (t !== token) return;
  geo = g; st = R.stylise(geo, model, styleOf()); $("busy").hidden = true;
  draw(); updateTech();
}

// ---------- hover readout (only while pointing at a bone) ----------
$("cv").addEventListener("mousemove", (e) => {
  if (!st || playing) return;
  const r = e.target.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * st.W), y = Math.floor(((e.clientY - r.top) / r.height) * st.H);
  if (x < 0 || y < 0 || x >= st.W || y >= st.H) return;
  const p = y * st.W + x, o = st.lab[p] ? st.obj[p] : 0;
  if (o) { const el = model.els[o - 1]; $("hover").textContent = `${el.name} · ${C.PART_NAMES[st.part[p]] || ""}`; $("hover").hidden = false; }
  else $("hover").hidden = true;
  if (o !== hoverObj) { hoverObj = o; draw(); }
});
$("cv").addEventListener("mouseleave", () => { $("hover").hidden = true; if (hoverObj) { hoverObj = 0; draw(); } });

// ---------- generic controls ----------
function seg(id, items, get, set, opts = {}) {
  const el = $(id); el.innerHTML = "";
  for (const [val, label, title] of items) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.val = String(val); b.textContent = label; if (title) b.title = title;
    b.addEventListener("click", () => { if (!b.disabled) set(val); });
    el.appendChild(b);
  }
  el._sync = () => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === String(get()))));
  return el;
}
// slider with a label, a value readout and end labels
function slider(parent, o) {
  const id = o.id, wrap = document.createElement("div"); wrap.className = "slider";
  wrap.innerHTML = `<div class="top"><label for="${id}">${o.label}</label><output id="${id}-out" for="${id}"></output></div>
    <input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step || 0.5}">${o.ends ? `<div class="ends" aria-hidden="true"><span>${o.ends[0]}</span><span>${o.ends[1]}</span></div>` : ""}`;
  parent.appendChild(wrap);
  const inp = wrap.querySelector("input"), out = wrap.querySelector("output");
  const sync = () => { const v = o.get(); inp.value = v; out.textContent = o.fmt(v); if (o.disabled) inp.disabled = o.disabled(); };
  inp.addEventListener("input", () => { o.set(+inp.value); out.textContent = o.fmt(+inp.value); });
  wrap._sync = sync; sync(); return wrap;
}
const deg = (v, neg, pos, dp = 1) => (Math.abs(v) < 0.5 * 10 ** -dp ? "0°" : `${Math.abs(v).toFixed(dp)}° ${v > 0 ? pos : neg}`);

// ---------- tabs ----------
const tabsEl = $("tabs");
TABS.forEach((T) => {
  const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab"); b.id = `tab-${T.id}`; b.dataset.val = T.id; b.textContent = T.name;
  b.addEventListener("click", () => { S.tab = T.id; hoverObj = 0; render(); });
  b.addEventListener("keydown", (e) => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; const i = TABS.findIndex((x) => x.id === S.tab), n = TABS[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3]; S.tab = n.id; render(); $(`tab-${n.id}`).focus(); });
  tabsEl.appendChild(b);
});
function syncTab() {
  $("app").dataset.tab = S.tab;
  tabsEl.querySelectorAll("button").forEach((b) => { const on = b.dataset.val === S.tab; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  const T = TABS.find((t) => t.id === S.tab), sk = S.tab === "skeleton";
  $("work").hidden = !sk; $("export-wrap").hidden = !sk; $("empty").hidden = sk;
  if (!sk) { $("empty-title").textContent = `${T.name}: nothing here yet`; $("empty-text").textContent = T.empty; }
}

// ---------- view toolbar ----------
const setView = (a, s) => { const [ca, cs] = angleOf(S.view); S.side = s || cs || S.side; S.view = viewIdOf(a || ca, S.side); hoverObj = 0; render(); };
seg("angle", ANGLES.map(([a, n]) => [a, n, a === "q" ? "Three-quarter front" : a === "qb" ? "Three-quarter back" : ""]), () => angleOf(S.view)[0], (a) => setView(a, null));
seg("side", [["R", "Right", "Subject's right side toward the camera"], ["L", "Left", "Subject's left side toward the camera"]], () => S.side, (s) => setView(null, s));
function syncView() {
  const [a, s] = angleOf(S.view); if (s) S.side = s;
  $("angle")._sync(); $("side")._sync();
  $("side").querySelectorAll("button").forEach((b) => { b.disabled = !s; });
  const yaw = VIEW(S.view).yaw * Math.PI / 180, cx = 18 - Math.sin(yaw) * 14, cy = 18 + Math.cos(yaw) * 14;
  // top-down compass: body (front facing down), camera dot; subject's left drawn on the right
  $("orient").innerHTML = `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" fill="none" stroke="#424a54"/>
    <ellipse cx="18" cy="18" rx="8" ry="4.5" fill="#8f969e"/><rect x="16.5" y="21" width="3" height="3" fill="#8f969e"/>
    <text x="27.5" y="20.5" font-size="7" fill="#8f969e" font-family="sans-serif">L</text><text x="5" y="20.5" font-size="7" fill="#8f969e" font-family="sans-serif">R</text>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" fill="#7cc4d8"/></svg>
    <span>${ANGLE_NAMES[a]}${s ? ` · ${s === "R" ? "right" : "left"} side toward you` : ""}</span>`;
}
$("zoom-in").addEventListener("click", () => stepZoom(1));
$("zoom-out").addEventListener("click", () => stepZoom(-1));
$("zoom-fit").addEventListener("click", () => { S.zoom = "fit"; save(); draw(); });
new ResizeObserver(() => draw()).observe($("viewport"));

// ---------- movement ----------
const DEMOS = TR.demoPoses();
DEMOS.forEach((d) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = DEMO_NAMES[d.id] || d.name; b.dataset.val = d.id;
  b.addEventListener("click", () => { const was = playing; S.pose = normPose(clone(d.pose)); onPose(true, was); });
  $("demos").appendChild(b);
});
seg("region", REGIONS, () => S.region, (r) => { S.region = r; save(); buildRegion(); });
let regionSliders = [];
function buildRegion() {
  $("region")._sync();
  const box = $("region-controls"); box.innerHTML = ""; regionSliders = [];
  if (S.region === "pelvis") {
    const L = TR.pelvisLimits();
    const hint = document.createElement("p"); hint.className = "hint";
    hint.textContent = "Moves the whole pelvis (both hip bones and the sacrum) about the hip joints; the spine rides on top.";
    box.appendChild(hint);
    regionSliders.push(slider(box, { id: "pv-tilt", label: "Tilt", min: -L.tilt, max: L.tilt, ends: ["back", "forward"],
      get: () => S.pose.root.tilt, set: (v) => { S.pose.root.tilt = v; onPose(); }, fmt: (v) => deg(v, "back", "forward") }));
    regionSliders.push(slider(box, { id: "pv-obl", label: "Hip hike", min: -L.obliquity, max: L.obliquity, ends: ["left hip up", "left hip down"],
      get: () => S.pose.root.obliquity, set: (v) => { S.pose.root.obliquity = v; onPose(); }, fmt: (v) => deg(v, "left up", "left down") }));
    regionSliders.push(slider(box, { id: "pv-rot", label: "Turn", min: -L.rotation, max: L.rotation, ends: ["left", "right"],
      get: () => -S.pose.root.rotation, set: (v) => { S.pose.root.rotation = -v; onPose(); }, fmt: (v) => deg(-v, "right", "left") }));
    const adv = document.createElement("details"); adv.className = "inner adv"; adv.id = "pelvis-joints";
    adv.innerHTML = `<summary>Advanced: pelvic joints</summary><div></div>`; box.appendChild(adv);
    const ab = adv.querySelector("div");
    regionSliders.push(slider(ab, { id: "pv-nut", label: "Sacrum nods (sacroiliac)", min: -L.nutation, max: L.nutation, step: 0.1, ends: ["counternutation", "nutation"],
      get: () => S.pose.root.nutation, set: (v) => { S.pose.root.nutation = v; onPose(); }, fmt: (v) => deg(v, "counter", "nutation", 1) }));
    regionSliders.push(slider(ab, { id: "pv-ctr", label: "Hip bones counter-rotate", min: -L.counter, max: L.counter, step: 0.05, ends: ["right back", "left back"],
      get: () => S.pose.root.counter, set: (v) => { S.pose.root.counter = v; onPose(); }, fmt: (v) => deg(v, "right back", "left back", 2) }));
    const n2 = document.createElement("p"); n2.className = "hint";
    n2.textContent = `Real sacroiliac and symphysis motion is tiny: ±${L.nutation}° nutation, ±${L.counter}° per hip bone (in vivo RSA studies).`;
    ab.appendChild(n2);
    const env = document.createElement("p"); env.className = "hint"; env.id = "env-note"; box.appendChild(env);
  } else if (S.region !== "clavicle") {
    const r = S.region, l = SR.regionLimits(r);
    regionSliders.push(slider(box, { id: "p-fe", label: "Bend forward / back", min: (-l.ext).toFixed(1), max: l.flex.toFixed(1), ends: ["back", "forward"],
      get: () => S.pose[r].fe, set: (v) => { S.pose[r].fe = v; onPose(); }, fmt: (v) => deg(v, "back", "forward") }));
    regionSliders.push(slider(box, { id: "p-lb", label: "Bend sideways", min: (-l.lb).toFixed(1), max: l.lb.toFixed(1), ends: ["left", "right"],
      get: () => -S.pose[r].lb, set: (v) => { S.pose[r].lb = -v; onPose(); }, fmt: (v) => deg(-v, "right", "left") }));
    regionSliders.push(slider(box, { id: "p-ar", label: "Twist", min: (-l.ar).toFixed(1), max: l.ar.toFixed(1), ends: ["left", "right"],
      get: () => -S.pose[r].ar, set: (v) => { S.pose[r].ar = -v; onPose(); }, fmt: (v) => deg(-v, "right", "left") }));
    const env = document.createElement("p"); env.className = "hint"; env.id = "env-note"; box.appendChild(env);
  } else {
    const ck = document.createElement("label"); ck.className = "check"; ck.htmlFor = "clav-link";
    ck.innerHTML = `<input type="checkbox" id="clav-link"> Move both shoulders together`; box.appendChild(ck);
    const inp = ck.querySelector("input"); inp.checked = S.clavLink;
    inp.addEventListener("change", () => { S.clavLink = inp.checked; if (S.clavLink) { S.pose.clavicle.R = { ...S.pose.clavicle.L }; onPose(); } save(); buildRegion(); });
    const L = TR.clavLimits();
    for (const side of S.clavLink ? ["L"] : ["L", "R"]) {
      if (!S.clavLink) { const h = document.createElement("div"); h.className = "sub"; h.textContent = side === "L" ? "Left shoulder" : "Right shoulder"; box.appendChild(h); }
      const setC = (ax) => (v) => { S.pose.clavicle[side][ax] = v; if (S.clavLink) S.pose.clavicle.R[ax] = v; onPose(); };
      regionSliders.push(slider(box, { id: `c-${side}-elev`, label: "Raise / lower", min: L.elev[0].toFixed(1), max: L.elev[1].toFixed(1), ends: ["lower", "raise"],
        get: () => S.pose.clavicle[side].elev, set: setC("elev"), fmt: (v) => deg(v, "down", "up") }));
      regionSliders.push(slider(box, { id: `c-${side}-prot`, label: "Forward / back", min: L.prot[0].toFixed(1), max: L.prot[1].toFixed(1), ends: ["back", "forward"],
        get: () => S.pose.clavicle[side].prot, set: setC("prot"), fmt: (v) => deg(v, "back", "forward") }));
      regionSliders.push(slider(box, { id: `c-${side}-up`, label: "Shoulder blade rotation", min: L.up[0].toFixed(1), max: L.up[1].toFixed(1), ends: ["downward", "upward"],
        get: () => S.pose.clavicle[side].up, set: setC("up"), fmt: (v) => deg(v, "downward", "upward") }));
    }
    const env = document.createElement("p"); env.className = "hint"; env.id = "env-note"; box.appendChild(env);
  }
  syncPose();
}
$("reset-pose").addEventListener("click", () => { S.pose = TR.ZERO(); onPose(true); });
let poseT = 0;
function onPose(now, keepPlaying) { stopPlay(true); syncPose(); save(); clearTimeout(poseT); poseT = setTimeout(() => render().then(() => { if (keepPlaying && !TR.isZero(S.pose)) play(); }), now ? 0 : 300); }
function syncPose() {
  regionSliders.forEach((s) => s._sync());
  const key = poseKey(S.pose), d = DEMOS.find((x) => poseKey(x.pose) === key);
  $("demos").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(!!d && b.dataset.val === d.id)));
  $("pose-name").innerHTML = `Pose: <b>${TR.isZero(S.pose) ? "Neutral" : d ? DEMO_NAMES[d.id] : "Custom"}</b>`;
  $("play").disabled = TR.isZero(S.pose); $("reset-pose").disabled = TR.isZero(S.pose);
  $("play").title = TR.isZero(S.pose) ? "Choose a movement first" : "Play neutral → pose → neutral (Space)";
  const env = $("env-note");
  if (env) {
    if (S.region === "pelvis") { const r = S.pose.root, L = TR.pelvisLimits(), e = Math.max(Math.abs(r.tilt) / L.tilt, Math.abs(r.obliquity) / L.obliquity, Math.abs(r.rotation) / L.rotation);
      env.textContent = e ? `Using ${Math.round(e * 100)} % of the pelvis range on the busiest axis.` : ""; }
    else if (S.region === "clavicle") { const q = TR.clavSolve(S.pose.clavicle.L), q2 = TR.clavSolve(S.pose.clavicle.R), e = Math.max(q.envelope, q2.envelope);
      env.textContent = e ? `Using ${Math.round(Math.min(1, e) * 100)} % of the shoulders' combined range${q.scaled || q2.scaled ? " (scaled back to stay in range)" : ""}.` : ""; }
    else { const r = SR.solve(S.pose).regions[S.region]; env.textContent = r.envelope ? `Using ${Math.round(Math.min(1, r.envelope) * 100)} % of this region's combined range${r.scaled ? " (scaled back to stay in range)" : ""}.` : ""; }
  }
}

// ---------- playback: neutral → pose → neutral, eased, five unique poses rendered once ----------
const FRACS = [0, 0.1464, 0.5, 0.8536, 1], SEQ = [0, 1, 2, 3, 4, 4, 4, 3, 2, 1, 0, 0, 0];
let playT = 0, playing = false, frames = null, framesKey = "", frameK = 0, preparing = false;
const playKey = () => `${poseKey(S.pose)}|${S.view}|${S.mm}|${visible().join(",")}|${JSON.stringify(styleOf())}`;
function setPlayBtn() { $("play").textContent = playing ? "❚❚ Pause" : "▶ Play"; $("play").setAttribute("aria-pressed", String(playing)); }
function stopPlay(invalidate) {
  if (playT) clearInterval(playT); playT = 0; preparing = false;
  if (invalidate) { frames = null; frameK = 0; }
  if (playing) { playing = false; setPlayBtn(); }
}
async function play() {
  if (TR.isZero(S.pose)) return;
  playing = true; setPlayBtn(); $("hover").hidden = true; hoverObj = 0;
  const key = playKey();
  if (!frames || framesKey !== key) {
    frames = null; preparing = true; const target = clone(S.pose), list = [];
    for (let i = 0; i < FRACS.length; i++) {
      if (!playing || !preparing) return;
      $("busy").hidden = false; $("busy").textContent = `Preparing playback ${i + 1}/${FRACS.length}…`;
      const p = TR.scalePose(target, FRACS[i]), g = await geometry(S.view, S.mm, null, p), m = modelFor(p);
      list.push({ st: R.stylise(g, m, styleOf()), m });
    }
    preparing = false; $("busy").hidden = true; if (!playing) return;
    frames = list; framesKey = key; frameK = 0;
  }
  playT = setInterval(() => { const f = frames[SEQ[frameK % SEQ.length]]; st = f.st; model = f.m; draw(); frameK++; }, 110);
}
$("play").addEventListener("click", () => { if (playing) { stopPlay(false); $("busy").hidden = true; } else play(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
  if (S.tab !== "skeleton" || e.target.closest("input, select, textarea, button, summary")) return;
  if (e.key === " ") { e.preventDefault(); $("play").click(); }
});

// ---------- visibility ----------
for (const k of ["spine", "ribcage", "clavicles", "pelvis", "hyoid"]) $(`layer-${k}`).addEventListener("change", (e) => { S.layers[k] = e.target.checked; hoverObj = 0; render(); });
for (const k of ["labels", "guides"]) $(k).addEventListener("change", (e) => { S[k] = e.target.checked; save(); syncExportNote(); draw(); });
seg("colorby", [["none", "Off"], ["part", "Anatomy"], ["region", "Region"]], () => S.colorby, (v) => { S.colorby = v; save(); syncVis(); draw(); });
function syncVis() {
  for (const k of ["spine", "ribcage", "clavicles", "pelvis", "hyoid"]) $(`layer-${k}`).checked = S.layers[k];
  $("labels").checked = S.labels; $("guides").checked = S.guides; $("colorby")._sync();
  const lg = $("legend");
  if (S.colorby === "none") lg.hidden = true;
  else {
    lg.hidden = false;
    const items = S.colorby === "region" ? Object.entries(REGION_COLORS).map(([k, c]) => [REGION_NAMES[k], c])
      : [...new Set(Object.keys(C.PART_NAMES).map(Number))].filter((k) => k !== 18).map((k) => [C.PART_NAMES[k], PART_COLORS[k]]);
    lg.innerHTML = items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("");
  }
  syncExportNote();
}

// ---------- appearance ----------
$("preset").innerHTML = Object.keys(PRESETS).map((k) => `<option value="${k}">${k}</option>`).join("") + `<option value="">Custom</option>`;
$("preset").addEventListener("change", (e) => { if (PRESETS[e.target.value]) { S.bone6 = PRESETS[e.target.value].slice(); S.preset = e.target.value; save(); syncLook(); draw(); } });
function palRow(id, key, from) {
  const el = $(id); el.innerHTML = "";
  SLOT.forEach((name, i) => {
    if (i < from) return;
    const l = document.createElement("label"); l.htmlFor = `${id}-${i}`;
    l.innerHTML = `<input type="color" id="${id}-${i}">${name}`;
    l.querySelector("input").addEventListener("input", (e) => { S[key] = S[key].slice(); S[key][i] = e.target.value; if (key === "bone6") S.preset = ""; save(); syncLook(); draw(); });
    el.appendChild(l);
  });
}
palRow("pal-bone", "bone6", 0); palRow("pal-disc", "disc6", 1);
seg("bg", Object.entries(BGS).map(([k, v]) => [k, v[0]]), () => S.bg, (v) => { S.bg = v; save(); syncLook(); draw(); });
seg("mm", [[1, "Fine · 1 mm"], [1.5, "1.5"], [2, "2"], [3, "3"], [4, "Coarse · 4"]], () => S.mm, (v) => { S.mm = v; render(); });
const lightSliders = [["lightDir", "Direction", 0, 355, 1, (v) => v + "°"], ["lightFront", "Toward viewer", 0, 85, 1, (v) => v + "°"], ["ambient", "Ambient", 0, 0.5, 0.01, (v) => v.toFixed(2)],
  ["aoStr", "Crevice shadow", 0, 1.5, 0.05, (v) => v.toFixed(2)], ["exposure", "Exposure", 0.6, 1.5, 0.01, (v) => v.toFixed(2)]]
  .map(([k, label, min, max, step, fmt]) => slider($("light-controls"), { id: k, label, min, max, step, get: () => S[k], set: (v) => { S[k] = v; save(); restyle(); }, fmt }));
const gapSlider = slider($("gap-control"), { id: "gap", label: "Contour depth jump", min: 1, max: 10, step: 0.5, get: () => S.gap, set: (v) => { S.gap = v; save(); restyle(); }, fmt: (v) => v.toFixed(1) + " mm", disabled: () => !S.lines });
for (const k of ["outline", "lines", "rim", "clusters"]) $(k).addEventListener("change", () => { S[k] = $(k).checked; save(); syncLook(); restyle(); });
$("reset-look").addEventListener("click", () => {
  const mmChanged = S.mm !== LOOK.mm; Object.assign(S, clone(LOOK)); save(); syncLook();
  if (mmChanged) render(); else restyle();
  flash("Appearance reset: palette, background, pixel detail, lighting, pixel rules.");
});
$("copy").addEventListener("click", async () => {
  const txt = JSON.stringify({ mmPerPx: S.mm, bone: Object.fromEntries(SLOT.map((s, i) => [s, S.bone6[i]])), cartilageAndDisc: Object.fromEntries(SLOT.slice(1).map((s, i) => [s, S.disc6[i + 1]])),
    background: BGS[S.bg][1] || "transparent", light: { direction: S.lightDir, towardViewer: S.lightFront }, ambient: S.ambient, crevice: S.aoStr, exposure: S.exposure,
    rules: { outline: S.outline, interiorLines: S.lines, lineGapMm: S.gap, rimLight: S.rim, clusters: S.clusters } }, null, 2);
  try { await navigator.clipboard.writeText(txt); flash("Style settings copied as JSON."); } catch (e) { flash("The browser blocked the clipboard."); }
});
function syncLook() {
  $("preset").value = PRESETS[S.preset] ? S.preset : "";
  SLOT.forEach((_, i) => { $(`pal-bone-${i}`).value = S.bone6[i]; if (i) $(`pal-disc-${i}`).value = S.disc6[i]; });
  $("bg")._sync(); $("mm")._sync(); lightSliders.forEach((s) => s._sync()); gapSlider._sync();
  for (const k of ["outline", "lines", "rim", "clusters"]) $(k).checked = S[k];
  syncExportNote();
}

// ---------- technical details ----------
function updateTech() {
  const sol = SR.solve(S.pose), pc = (e) => (e ? `${Math.round(Math.min(1, e) * 100)} %${e > 1 ? " (scaled)" : ""}` : "0 %");
  const q = ["L", "R"].map((s) => TR.clavSolve(S.pose.clavicle[s]));
  $("envelopes").innerHTML = [["Neck", sol.regions.cervical.envelope], ["Upper back", sol.regions.thoracic.envelope], ["Lower back", sol.regions.lumbar.envelope], ["Shoulder left", q[0].envelope], ["Shoulder right", q[1].envelope]]
    .map(([n, e]) => `<dt>${n}</dt><dd>${pc(e)}</dd>`).join("");
  const th = model.thorax;
  if (!th) $("ribcage").innerHTML = `<dt>State</dt><dd>at rest</dd>`;
  else {
    const cv = Math.max(...Object.values(th.theta).map(Math.abs)), ch = Object.values(th.chord), ar = Object.values(th.stretch);
    $("ribcage").innerHTML = `<dt>Costovertebral rotation, max</dt><dd>${cv.toFixed(1)}°</dd><dt>Cartilage end distance</dt><dd>${(Math.min(...ch) * 100).toFixed(1)}–${(Math.max(...ch) * 100).toFixed(1)} %</dd>
      <dt>Cartilage length, max</dt><dd>${(Math.max(...ar) * 100).toFixed(1)} %</dd><dt>Sternum fit residual</dt><dd>${th.residual.toFixed(2)}</dd>`;
  }
  const gd = model.girdle, rs = rig.shoulder, f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "°";
  const ga = (side) => (gd ? gd[side].angles : rs[side].rest);
  $("girdle").innerHTML = [["Internal rotation", (a) => a.ir], ["Upward rotation", (a) => a.ur], ["Anterior tilt", (a) => a.tilt]]
    .map(([n, fn]) => `<dt>${n}</dt><dd>${f1(fn(ga("L")))} / ${f1(fn(ga("R")))}</dd>`).join("") +
    (gd ? `<dt>Clavicle elev · prot · axial</dt><dd>${["L", "R"].map((sd) => [gd[sd].clavicle.elev, gd[sd].clavicle.prot, gd[sd].clavicle.rot].map((v) => v.toFixed(0)).join(" · ")).join(" / ")}</dd>
      <dt>AC joint rotation</dt><dd>${gd.L.ac.toFixed(1)}° / ${gd.R.ac.toFixed(1)}°</dd><dt>Scapula–rib gap, min</dt><dd>${gd.L.minGap.toFixed(1)} / ${gd.R.minGap.toFixed(1)} mm</dd>
      <dt>Upward rotation asked · reached</dt><dd>${["L", "R"].map((sd) => `${gd[sd].input.up.toFixed(0)} · ${(gd[sd].angles.ur - gd[sd].natural).toFixed(0)}`).join(" / ")}</dd>` : `<dt>State</dt><dd>at rest</dd>`);
  const pv = model.pelvis || { whole: { tilt: 0, obliquity: 0, rotation: 0 }, nutation: 0, counter: 0 }, at = model.attach || rig.attachRest;
  const sg = (v, dp = 1) => (v >= 0 ? "+" : "") + v.toFixed(dp) + "°";
  $("pelvis-info").innerHTML = `<dt>Whole pelvis tilt · hike · turn</dt><dd>${[pv.whole.tilt, pv.whole.obliquity, pv.whole.rotation].map((v) => sg(v)).join(" · ")}</dd>
    <dt>Sacroiliac nutation</dt><dd>${sg(pv.nutation)} (sacrum against both hip bones)</dd><dt>Hip bone counter-rotation</dt><dd>${sg(pv.counter, 2)} per side</dd>
    <dt>Sacroiliac joint space</dt><dd>${PV.PELVIS.siGap.toFixed(1)} mm</dd><dt>Interpubic gap</dt><dd>${(2 * PV.PELVIS.symphysisX).toFixed(1)} mm</dd>
    <dt>Hip joint centres (future femurs)</dt><dd>${Math.hypot(...at.HIP_L.o.map((v, i) => v - at.HIP_R.o[i])).toFixed(0)} mm apart · socket Ø ${(2 * PV.PELVIS.socketR).toFixed(0)} mm</dd>
    <dt>Acetabulum inclination · anteversion</dt><dd>${PV.PELVIS.inclination}° · ${PV.PELVIS.anteversion}°</dd>`;
  const rows = ROM.SEGMENTS.map((s) => { const a = sol.segments[s.id], c = Math.max(Math.abs(a.fe) / (a.fe >= 0 ? s.cap.flex : s.cap.ext), Math.abs(a.lb) / s.cap.lb, Math.abs(a.ar) / s.cap.ar);
    return `<tr><td>${s.id}</td><td>${a.fe.toFixed(1)}</td><td>${a.lb.toFixed(1)}</td><td>${a.ar.toFixed(1)}</td><td>${Math.round(c * 100)}%</td></tr>`; }).join("");
  $("seg-table").innerHTML = `<table><tr><th>Segment</th><th>Flex</th><th>Bend L</th><th>Rot L</th><th>of cap</th></tr>${rows}</table>`;
  const n = (k) => full.els.filter((e) => e.kind === k).length;
  $("model-info").innerHTML = `<dt>Subject</dt><dd>female, 183 cm, 78 kg</dd><dt>Elements</dt><dd>${full.els.length}</dd><dt>Vertebrae, discs</dt><dd>24 + S + Co, ${n("disc")}</dd>
    <dt>Ribs, cartilages</dt><dd>${n("rib")}, ${n("cartilage")}</dd><dt>Sternum, clavicles, scapulae</dt><dd>${n("sternum")}, ${n("clavicle")}, ${n("scapula")}</dd>
    <dt>Hip bones, pelvic joints, hyoid</dt><dd>${n("hip")}, ${n("joint")}, ${n("hyoid")}</dd>
    <dt>Frame</dt><dd>${st ? `${st.W} × ${st.H} px` : ""} at ${S.mm} mm/px</dd>`;
}

// ---------- export ----------
let downloads = null;
const inClaude = () => !!(window.claude && typeof window.claude.use === "function");
(function initDl() { let n = 0; const tick = () => { if (inClaude()) { window.claude.use("downloads").then((d) => { downloads = d; }).catch(() => {}); return; } if (++n < 6) setTimeout(tick, 500); }; tick(); })();
function closeMenu() { $("export-menu").hidden = true; $("export").setAttribute("aria-expanded", "false"); }
$("export").addEventListener("click", (e) => { e.stopPropagation(); const m = $("export-menu"); m.hidden = !m.hidden; $("export").setAttribute("aria-expanded", String(!m.hidden)); if (!m.hidden) { syncExportNote(); $("exp-art").focus(); } });
document.addEventListener("click", (e) => { if (!e.target.closest("#export-wrap")) closeMenu(); });
function syncExportNote() {
  const extra = [BGS[S.bg][1] ? `${BGS[S.bg][0].toLowerCase()} background` : "transparent background", S.colorby !== "none" ? `${S.colorby === "part" ? "anatomy" : "region"} colours` : null, S.labels ? "labels" : null, S.guides ? "guides" : null].filter(Boolean);
  $("exp-view-note").textContent = `Exactly what the preview shows (${extra.join(", ")}), at 2× so text stays readable.`;
}
async function saveBlob(canvas, name) {
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (downloads) { try { await downloads.save({ filename: name, data: blob }); flash("Saved " + name); } catch (e) { if (e && e.code === "declined") flash("Save cancelled."); } }
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); flash("Downloaded " + name); }
}
const baseName = () => { const d = DEMOS.find((x) => poseKey(x.pose) === poseKey(S.pose)); return `skeleton_${TR.isZero(S.pose) ? "neutral" : d ? d.id : "custom"}_${S.view}_${S.mm}mm`; };
$("exp-art").addEventListener("click", () => {
  closeMenu(); if (!st) return;
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H;
  off.getContext("2d").putImageData(new ImageData(pixels(st, model, true), st.W, st.H), 0, 0);
  saveBlob(off, baseName() + ".png");
});
$("exp-view").addEventListener("click", () => {
  closeMenu(); if (!st) return;
  const z = 2, src = document.createElement("canvas"); src.width = st.W; src.height = st.H;
  src.getContext("2d").putImageData(new ImageData(pixels(st, model, false), st.W, st.H), 0, 0);
  const off = document.createElement("canvas"); off.width = st.W * z; off.height = st.H * z;
  const ctx = off.getContext("2d"); paintBg(ctx, off.width, off.height, z); ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, off.width, off.height);
  if (S.guides) drawGuides(ctx, z);
  ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#8f969e"; ctx.textBaseline = "middle";
  for (const l of labelList()) { ctx.textAlign = l.right ? "left" : "right"; ctx.fillText(l.t, l.x * z, l.y * z); }
  saveBlob(off, baseName() + "_preview.png");
});
let flashT; function flash(m) { const el = $("toast"); el.textContent = m; el.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => (el.hidden = true), 2600); }

// ---------- start ----------
function syncAll() { syncView(); syncVis(); syncLook(); syncPose(); syncZoom(); setPlayBtn(); }
buildRegion();
render();
})();
