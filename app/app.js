// Pixel Character Lab: one environment for every build level (vertebra -> spine -> skeleton -> body -> clothing).
// Every level is a view onto the same anatomy model (spine-core) and the same pixel-art renderer (spine-render).
(() => {
const $ = (id) => document.getElementById(id);
const C = window.SpineCore, R = window.SpineRender;

const LEVELS = [
  { n: 1, name: "1 · Vertebra", sub: "Style study, any single bone" },
  { n: 2, name: "2 · Spine", sub: "24 vertebrae, sacrum, coccyx, 23 discs" },
  { n: 3, name: "3 · Skeleton", sub: "Next", off: true },
  { n: 4, name: "4 · Body", sub: "Later", off: true },
  { n: 5, name: "5 · Clothing", sub: "Later", off: true },
];
const TOP = { id: "top", name: "Top", yaw: 0, pitch: 90 };
const VIEWS = [...R.VIEWS.map((v) => ({ ...v, pitch: 0 })), TOP];
const SHORT = { front: "Front", "front-right": "Front ¾ R", right: "Right", "back-right": "Back ¾ R", back: "Back", "back-left": "Back ¾ L", left: "Left", "front-left": "Front ¾ L", top: "Top" };
const PRESETS = {
  "Study bone": ["#2b211b", "#5c4a3b", "#8e7860", "#bca98a", "#e0d4b8", "#faf4e3"],
  "pixelfx bone": ["#1a1814", "#3a352c", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0"],
  "Cool ivory": ["#1e2128", "#4a4f5c", "#7f8593", "#b3b6bd", "#dcdcd8", "#f7f6f0"],
  "X-ray": ["#0b1a24", "#1f4257", "#3f7590", "#6fa9c2", "#a9d6e6", "#e6f7fb"],
};
const SLOT = ["outline", "line", "shade", "mid", "light", "hi"];
const PART_COLORS = { 1: "#d9a441", 2: "#5aa6c9", 3: "#8b7fd1", 4: "#5fb38a", 5: "#d9708a", 6: "#c98b5a", 7: "#7c9cd9", 8: "#e0605a", 9: "#59b7c9",
  10: "#a87fc9", 11: "#c9c25a", 12: "#a7b2b0", 13: "#b59a72", 14: "#e3b98f", 15: "#c7a5c9", 16: "#e89a4f", 17: "#6fcf9a", 18: "#d9a441", 19: "#3a3330" };
const REGION_COLORS = { cervical: "#d9a441", thoracic: "#5aa6c9", lumbar: "#8b7fd1", sacral: "#5fb38a", coccygeal: "#d9708a", disc: "#a7b2b0" };
const DEFAULTS = {
  level: 2, bone: "L3", view: "front", mm: 1, zoom: "fit", bg: "checker", guides: true, labels: true, colorby: "none",
  lightDir: 136, lightFront: 32, ambient: 0.16, aoStr: 1, exposure: 1, outline: true, lines: true, gap: 3, rim: true, clusters: true,
  bone6: PRESETS["Study bone"].slice(), disc6: R.PALETTES.disc.slice(), preset: "Study bone",
};
let S = load();
function load() {
  try { const o = JSON.parse(localStorage.getItem("pixel-character-lab") || "null"); if (o) return { ...DEFAULTS, ...o, bone6: (o.bone6 || DEFAULTS.bone6).slice(), disc6: (o.disc6 || DEFAULTS.disc6).slice() }; } catch (e) { /* no storage */ }
  return { ...DEFAULTS, bone6: DEFAULTS.bone6.slice(), disc6: DEFAULTS.disc6.slice() };
}
const save = () => { try { localStorage.setItem("pixel-character-lab", JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ---------- models ----------
const built = C.build();
const full = { els: built.els, comps: built.els.map(C.compile) };
const BONES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S", "Co"];
function boneModel(id) {
  const k = full.els.findIndex((e) => e.id === id), el = { ...full.els[k], o: [0, 0, 0], psi: 0 }, comp = full.comps[k], b = comp.box;
  const span = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  return { els: [el], comps: [comp], frameMM: Math.max(96, Math.ceil((span * 1.12) / 8) * 8), pivot: [0, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] };
}
const RIG = window.SpineRig, ROM = window.SpineROM, rig = RIG.makeRig(built);
const poseKey = (p) => JSON.stringify(p || RIG.ZERO());
const posedCache = new Map();
function posed(pose) {
  const k = poseKey(pose); if (posedCache.has(k)) return posedCache.get(k);
  const m = RIG.posedModel(rig, full.comps, pose); posedCache.set(k, m); if (posedCache.size > 24) posedCache.delete(posedCache.keys().next().value); return m;
}
const modelFor = (level, bone, pose) => (level === 1 ? boneModel(bone) : { ...posed(pose), frameMM: R.FRAME.W * R.FRAME.mm, pivot: R.FRAME.pivot });
if (!S.pose || !S.pose.root) S.pose = RIG.ZERO();
let model = modelFor(S.level, S.bone, S.pose);
function viewSpec(m, v, mm) { const W = Math.round(m.frameMM / mm); return { yaw: v.yaw, pitch: v.pitch || 0, mm, W, H: W, pivot: m.pivot, ss: S.level === 1 ? 4 : 3 }; }

// ---------- workers ----------
const SRC = $("core-src").textContent + "\n" + $("rom-src").textContent + "\n" + $("rig-src").textContent + "\n" + $("render-src").textContent + `
  let FULL = null; const BONE = {};
  let RIGW = null;
  function full() { if (!FULL) { const b = SpineCore.build(); FULL = { els: b.els, comps: b.els.map(SpineCore.compile) }; RIGW = SpineRig.makeRig(b); } return FULL; }
  function bone(id) { if (!BONE[id]) { const F = full(), k = F.els.findIndex((e) => e.id === id); BONE[id] = { els: [{ ...F.els[k], o: [0, 0, 0], psi: 0 }], comps: [F.comps[k]] }; } return BONE[id]; }
  self.onmessage = (ev) => {
    const q = ev.data, M = q.level === 1 ? bone(q.bone) : (full(), SpineRig.posedModel(RIGW, FULL.comps, q.pose));
    const g = SpineRender.cast(M, q.view, (p) => self.postMessage({ id: q.id, progress: p }), q.only);
    self.postMessage({ id: q.id, g }, [g.idx.buffer, g.depth.buffer, g.nx.buffer, g.ny.buffer, g.nz.buffer, g.ao.buffer, g.part.buffer, g.obj.buffer]);
  };`;
let workers = [];
try { const url = URL.createObjectURL(new Blob([SRC], { type: "text/javascript" })); const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)); for (let i = 0; i < n; i++) workers.push(new Worker(url)); }
catch (e) { workers = []; }
const cost = full.comps.map((c) => (c.box[3] - c.box[0] + c.box[4] - c.box[1]) * (c.box[4] - c.box[1] + c.box[5] - c.box[2]));
const shares = Array.from({ length: Math.max(1, workers.length) }, () => ({ k: [], c: 0 }));
cost.map((c, k) => [c, k]).sort((a, b) => b[0] - a[0]).forEach(([c, k]) => { const s = shares.reduce((a, b) => (a.c <= b.c ? a : b)); s.k.push(k); s.c += c; });

const cache = new Map(); let jobId = 0;
function geometry(level, bone, viewId, mm, onProgress, pose) {
  pose = pose || S.pose;
  const key = `${level}|${level === 1 ? bone : poseKey(pose)}|${viewId}|${mm}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const m = modelFor(level, bone, pose), v = VIEWS.find((x) => x.id === viewId), view = viewSpec(m, v, mm);
  if (!workers.length) return new Promise((res) => setTimeout(() => { const g = R.cast(m, view); cache.set(key, g); res(g); }, 10));
  const id = ++jobId;
  const jobs = level === 1 ? [{ w: workers[0], only: null }] : workers.map((w, i) => ({ w, only: shares[i].k }));
  const prog = jobs.map(() => 0);
  return Promise.all(jobs.map((j, i) => new Promise((res) => {
    const h = (ev) => { if (ev.data.id !== id) return; if (ev.data.g) { j.w.removeEventListener("message", h); res(ev.data.g); } else { prog[i] = ev.data.progress; onProgress && onProgress(prog.reduce((a, b) => a + b, 0) / prog.length); } };
    j.w.addEventListener("message", h); j.w.postMessage({ id, level, bone, view, only: j.only, pose });
  }))).then((parts) => {
    const g = R.merge(parts);
    cache.set(key, g); if (cache.size > 40) cache.delete(cache.keys().next().value);
    return g;
  });
}

// ---------- styling + drawing ----------
let geo = null, st = null, hoverObj = 0;
const styleOf = () => ({ lightDir: S.lightDir, lightFront: S.lightFront, ambient: S.ambient, aoStr: S.aoStr, exposure: S.exposure, gap: S.gap, outline: S.outline, lines: S.lines, rim: S.rim, clusters: S.clusters });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function pixels(forExport) {
  const rgba = R.paint(st, model, { bone: S.bone6, disc: S.disc6 });
  if (forExport) return rgba;
  if (S.colorby !== "none") {
    const mul = [0, 0, 0.45, 0.62, 0.8, 0.95, 1.08];
    for (let p = 0; p < st.W * st.H; p++) {
      const v = st.lab[p]; if (!v || v === 1) continue;
      const el = model.els[st.obj[p] - 1];
      const c = hex(S.colorby === "part" ? PART_COLORS[st.part[p]] || "#888888" : REGION_COLORS[el.kind === "disc" ? "disc" : el.region]);
      rgba[p * 4] = c[0] * mul[v]; rgba[p * 4 + 1] = c[1] * mul[v]; rgba[p * 4 + 2] = c[2] * mul[v];
    }
  }
  if (hoverObj && model.els.length > 1) for (let p = 0; p < st.W * st.H; p++) if (st.lab[p] && st.obj[p] !== hoverObj) { rgba[p * 4] *= 0.5; rgba[p * 4 + 1] *= 0.5; rgba[p * 4 + 2] *= 0.55; }
  return rgba;
}
function zoomFor() {
  if (S.zoom !== "fit") return +S.zoom;
  const el = $("stage"); return Math.max(1, Math.floor(Math.min((el.clientWidth - 44) / st.W, (el.clientHeight - 70) / st.H)));
}
function draw() {
  if (!st) return;
  const z = zoomFor(), cv = $("cv");
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H;
  off.getContext("2d").putImageData(new ImageData(pixels(false), st.W, st.H), 0, 0);
  cv.width = st.W * z; cv.height = st.H * z;
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  if (S.bg === "checker") { const c = 8 * Math.max(1, Math.round(z / 2)); ctx.fillStyle = "#3b4149"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#434a53"; for (let y = 0; y < cv.height; y += c) for (let x = (y / c) % 2 ? c : 0; x < cv.width; x += 2 * c) ctx.fillRect(x, y, c, c); }
  else { ctx.fillStyle = { dark: "#121417", mid: "#6b7178", light: "#eef0f2", skin: "#c99a7c" }[S.bg]; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.drawImage(off, 0, 0, cv.width, cv.height);
  if (S.guides) {
    ctx.save(); ctx.strokeStyle = "rgba(124,196,216,0.65)"; ctx.setLineDash([Math.max(4, z * 2), Math.max(4, z * 2)]); ctx.beginPath();
    const cy = Math.floor(st.H / 2) * z + 0.5, cx = Math.floor(st.W / 2) * z + 0.5;
    ctx.moveTo(0, cy); ctx.lineTo(cv.width, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, cv.height); ctx.stroke(); ctx.restore();
  }
  drawLabels(z);
}
function drawLabels(z) {
  const box = $("lbl-layer"); box.innerHTML = "";
  if (S.level !== 2 || !S.labels) return;
  const v = VIEWS.find((x) => x.id === S.view), spec = viewSpec(model, v, S.mm), side = Math.sin((v.yaw * Math.PI) / 180);
  for (const el of model.els) {
    if (el.kind === "disc") continue;
    const p = R.project(el.o, spec), d = document.createElement("span");
    d.className = "lbl"; d.textContent = el.id; d.style.top = p[1] * z + "px";
    if (side > 0.3) { d.style.left = (p[0] + 44 / S.mm) * z + "px"; } else { d.style.left = (p[0] - 50 / S.mm) * z + "px"; d.classList.add("l"); }
    box.appendChild(d);
  }
}
let restyleT = 0;
function restyle() { cancelAnimationFrame(restyleT); restyleT = requestAnimationFrame(() => { if (!geo) return; st = R.stylise(geo, model, styleOf()); draw(); }); }
let token = 0;
async function render() {
  model = modelFor(S.level, S.bone, S.pose); stopPlay();
  save(); sync();
  const t = ++token; $("busy").hidden = false; $("busy").textContent = "Rendering…";
  const g = await geometry(S.level, S.bone, S.view, S.mm, (p) => { if (t === token) $("busy").textContent = `Rendering… ${Math.round(p * 100)}%`; });
  if (t !== token) return;
  geo = g; st = R.stylise(geo, model, styleOf()); $("busy").hidden = true;
  const v = VIEWS.find((x) => x.id === S.view);
  const what = S.level === 1 ? (model.els[0].name || S.bone) : "Spinal column";
  $("caption").textContent = `${what} · ${v.name}${v.pitch ? " (reference)" : ", eye level"} · ${st.W} × ${st.H} px frame at ${S.mm} mm/px · ${zoomFor()}×`;
  draw();
  updatePoseUI();
}

// ---------- hover ----------
const defaultStatus = () => S.level === 1
  ? `${model.els[0].name || S.bone} · hover to read pixels and anatomy`
  : `C1–C7, T1–T12, L1–L5, sacrum, coccyx, 23 discs · ${full.els.length} separately editable elements · hover to identify`;
$("cv").addEventListener("mousemove", (e) => {
  if (!st) return;
  const r = e.target.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * st.W), y = Math.floor(((e.clientY - r.top) / r.height) * st.H);
  if (x < 0 || y < 0 || x >= st.W || y >= st.H) return;
  const p = y * st.W + x, o = st.lab[p] ? st.obj[p] : 0;
  const dy = (st.H / 2 - y - 0.5) * S.mm;
  let text = S.level === 2 ? `px ${x}, ${y} · ${Math.round(model.pivot[1] + dy)} mm above the floor` : `px ${x}, ${y} · ${(dy).toFixed(0)} mm from pivot`;
  if (o) { const el = model.els[o - 1]; text = `${el.name} · ${C.PART_NAMES[st.part[p]] || ""} · ${text}`; }
  $("status").textContent = text;
  if (o !== hoverObj && S.level === 2) { hoverObj = o; draw(); }
});
$("cv").addEventListener("mouseleave", () => { if (hoverObj) { hoverObj = 0; draw(); } $("status").textContent = defaultStatus(); });

// ---------- controls ----------
function seg(id, items, key, after) {
  const el = $(id); el.innerHTML = "";
  for (const [val, label] of items) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.val = String(val); b.textContent = label;
    b.addEventListener("click", () => { S[key] = val; after(); });
    el.appendChild(b);
  }
}
const nav = $("levels");
LEVELS.forEach((L) => {
  const b = document.createElement("button"); b.type = "button"; b.dataset.val = L.n; b.disabled = !!L.off;
  b.innerHTML = `<b>${L.name}</b><span>${L.sub}</span>`;
  b.addEventListener("click", () => { if (L.off) return; S.level = L.n; if (S.level === 2 && S.view === "top") S.view = "front"; hoverObj = 0; render(); });
  nav.appendChild(b);
});
seg("bones", BONES.map((b) => [b, b]), "bone", render);
seg("views", VIEWS.map((v) => [v.id, SHORT[v.id]]), "view", render);
seg("mm", [1, 1.5, 2, 3, 4].map((v) => [v, String(v)]), "mm", render);
seg("zoom", [["fit", "Fit"], ...[1, 2, 3, 4, 6, 8].map((v) => [v, v + "×"])], "zoom", () => { save(); sync(); draw(); });
seg("bg", [["checker", "Clear"], ["dark", "Dark"], ["mid", "Grey"], ["light", "Light"], ["skin", "Skin"]], "bg", () => { save(); sync(); draw(); });
seg("colorby", [["none", "Palette"], ["part", "Anatomy"], ["region", "Region"]], "colorby", () => { save(); sync(); draw(); });
const RANGES = { lightDir: (v) => v + "°", lightFront: (v) => v + "°", ambient: (v) => v.toFixed(2), aoStr: (v) => v.toFixed(2), exposure: (v) => v.toFixed(2), gap: (v) => v.toFixed(1) + " mm" };
for (const k in RANGES) $(k).addEventListener("input", () => { S[k] = +$(k).value; $(k + "-out").textContent = RANGES[k](S[k]); save(); restyle(); });
for (const k of ["outline", "lines", "rim", "clusters"]) $(k).addEventListener("change", () => { S[k] = $(k).checked; save(); sync(); restyle(); });
for (const k of ["guides", "labels"]) $(k).addEventListener("change", () => { S[k] = $(k).checked; save(); draw(); });
function palRow(id, key, from) {
  const el = $(id); el.innerHTML = "";
  SLOT.forEach((name, i) => {
    if (i < from) return;
    const l = document.createElement("label"); l.htmlFor = `${id}-${i}`;
    l.innerHTML = `<input type="color" id="${id}-${i}">${name}`;
    l.querySelector("input").addEventListener("input", (e) => { S[key][i] = e.target.value; if (key === "bone6") S.preset = ""; save(); sync(); draw(); });
    el.appendChild(l);
  });
}
palRow("pal-bone", "bone6", 0); palRow("pal-disc", "disc6", 1);
$("preset").innerHTML = Object.keys(PRESETS).map((k) => `<option value="${k}">${k}</option>`).join("") + `<option value="">Custom</option>`;
$("preset").addEventListener("change", (e) => { if (PRESETS[e.target.value]) { S.bone6 = PRESETS[e.target.value].slice(); S.preset = e.target.value; save(); sync(); draw(); } });
$("reset").addEventListener("click", () => { const keep = { level: S.level, bone: S.bone, view: S.view }; S = { ...DEFAULTS, bone6: DEFAULTS.bone6.slice(), disc6: DEFAULTS.disc6.slice(), ...keep }; render(); });
$("copy").addEventListener("click", async () => {
  const txt = JSON.stringify({ mmPerPx: S.mm, bone: Object.fromEntries(SLOT.map((s, i) => [s, S.bone6[i]])), disc: Object.fromEntries(SLOT.slice(1).map((s, i) => [s, S.disc6[i + 1]])),
    light: { direction: S.lightDir, towardViewer: S.lightFront }, ambient: S.ambient, crevice: S.aoStr, exposure: S.exposure,
    rules: { outline: S.outline, interiorLines: S.lines, lineGapMm: S.gap, rimLight: S.rim, clusters: S.clusters } }, null, 2);
  try { await navigator.clipboard.writeText(txt); flash("Style settings copied as JSON."); } catch (e) { flash("The browser blocked the clipboard."); }
});
function sync() {
  $("app").dataset.level = S.level;
  nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.val === S.level)));
  const mark = (id, val) => $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === String(val))));
  mark("bones", S.bone); mark("views", S.view); mark("mm", S.mm); mark("zoom", S.zoom); mark("bg", S.bg); mark("colorby", S.colorby);
  $("views").querySelector('[data-val="top"]').disabled = S.level !== 1;
  $("colorby").querySelector('[data-val="region"]').disabled = S.level !== 2;
  $("bone-name").textContent = S.level === 1 ? (full.els.find((e) => e.id === S.bone).name || "") : "";
  for (const k in RANGES) { $(k).value = S[k]; $(k + "-out").textContent = RANGES[k](S[k]); }
  for (const k of ["outline", "lines", "rim", "clusters", "guides", "labels"]) $(k).checked = S[k];
  $("gap").disabled = !S.lines;
  SLOT.forEach((_, i) => { $(`pal-bone-${i}`).value = S.bone6[i]; if (i) $(`pal-disc-${i}`).value = S.disc6[i]; });
  $("preset").value = PRESETS[S.preset] ? S.preset : "";
  const lg = $("legend");
  if (S.colorby === "none") lg.hidden = true;
  else {
    lg.hidden = false;
    const items = S.colorby === "region" ? Object.entries(REGION_COLORS).map(([k, c]) => [k[0].toUpperCase() + k.slice(1), c])
      : [...new Set(Object.keys(C.PART_NAMES).map(Number))].filter((k) => k !== 18).map((k) => [C.PART_NAMES[k], PART_COLORS[k]]);
    lg.innerHTML = items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("");
  }
  $("status").textContent = defaultStatus();
}
let flashT; function flash(m) { const el = $("toast"); el.textContent = m; el.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => (el.hidden = true), 2400); }
new ResizeObserver(() => { if (S.zoom === "fit") draw(); }).observe($("stage"));

// ---------- export: the current frame at 1 px per pixel, transparent ----------
let downloads = null;
const inClaude = () => !!(window.claude && typeof window.claude.use === "function");
(function initDl() { let n = 0; const tick = () => { if (inClaude()) { window.claude.use("downloads").then((d) => { downloads = d; if (!d) $("save").hidden = true; }).catch(() => {}); return; } if (++n < 6) setTimeout(tick, 500); }; tick(); })();
$("save").addEventListener("click", async () => {
  if (!st) return;
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H;
  off.getContext("2d").putImageData(new ImageData(pixels(true), st.W, st.H), 0, 0);
  const blob = await new Promise((res) => off.toBlob(res, "image/png"));
  const name = `${S.level === 1 ? "vertebra_" + S.bone : "spine"}_${S.view}_${S.mm}mm.png`;
  if (downloads) { try { await downloads.save({ filename: name, data: blob }); flash("Saved " + name); } catch (e) { if (e && e.code === "declined") flash("Save cancelled."); } }
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); flash("Downloaded " + name); }
});
// ---------- pose: regional controls, demonstrations, playback ----------
const DEMOS = RIG.demoPoses();
const AXES = [["fe", "Flex · Ext", (l) => [-l.ext, l.flex]], ["lb", "Bend L · R", (l) => [-l.lb, l.lb]], ["ar", "Rotate L · R", (l) => [-l.ar, l.ar]]];
const RNAME = { cervical: "Cervical (C1–T1)", thoracic: "Thoracic (T1–L1)", lumbar: "Lumbar (L1–S1)" };
const ps = $("pose-sliders");
for (const r of ROM.REGIONS) {
  const l = RIG.regionLimits(r), h = document.createElement("div");
  h.className = "region-h"; h.innerHTML = `${RNAME[r]}<span id="env-${r}"></span>`; ps.appendChild(h);
  for (const [ax, label, rng] of AXES) {
    const [lo, hi] = rng(l), row = document.createElement("div"); row.className = "range pose";
    row.innerHTML = `<label for="p-${r}-${ax}">${label}</label><input type="range" id="p-${r}-${ax}" min="${lo.toFixed(1)}" max="${hi.toFixed(1)}" step="0.5"><output id="p-${r}-${ax}-out"></output>`;
    ps.appendChild(row);
    // sliders read left = extension / right bend / right rotation; the rig's sign is + flexion, + left
    row.querySelector("input").addEventListener("input", (e) => { const v = +e.target.value; S.pose[r][ax] = ax === "fe" ? v : -v; onPose(); });
  }
}
const ROOT = [["tilt", "Pelvic tilt", ROM.SETTINGS.root.tilt], ["obliquity", "Obliquity", ROM.SETTINGS.root.obliquity], ["rotation", "Rotation", ROM.SETTINGS.root.rotation]];
for (const [ax, label, lim] of ROOT) {
  const row = document.createElement("div"); row.className = "range pose";
  row.innerHTML = `<label for="p-root-${ax}">${label}</label><input type="range" id="p-root-${ax}" min="${-lim}" max="${lim}" step="0.5"><output id="p-root-${ax}-out"></output>`;
  $("root-sliders").appendChild(row);
  row.querySelector("input").addEventListener("input", (e) => { S.pose.root[ax] = +e.target.value; onPose(); });
}
if (S.sacrumFixed === undefined) S.sacrumFixed = true;
$("sacrum-fixed").addEventListener("change", (e) => { S.sacrumFixed = e.target.checked; if (S.sacrumFixed) S.pose.root = { tilt: 0, obliquity: 0, rotation: 0 }; onPose(); });
DEMOS.forEach((d) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = d.name; b.dataset.val = d.id;
  b.addEventListener("click", () => { S.pose = JSON.parse(JSON.stringify(d.pose)); onPose(true); });
  $("demos").appendChild(b);
});
$("to-neutral").addEventListener("click", () => { S.pose = RIG.ZERO(); onPose(true); });
let poseT = 0;
function onPose(now) { stopPlay(); updatePoseUI(); save(); clearTimeout(poseT); poseT = setTimeout(render, now ? 0 : 350); }
const fmt = (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "°";
function updatePoseUI() {
  if (S.level !== 2) return;
  const sol = RIG.solve(S.pose);
  for (const r of ROM.REGIONS) {
    for (const [ax] of AXES) { const v = S.pose[r][ax], shown = ax === "fe" ? v : -v; $(`p-${r}-${ax}`).value = shown; $(`p-${r}-${ax}-out`).textContent = fmt(v); }
    const e = sol.regions[r].envelope; $(`env-${r}`).textContent = e ? `${Math.round(Math.min(1, e) * 100)} % of envelope${sol.regions[r].scaled ? " (scaled)" : ""}` : "";
  }
  for (const [ax] of ROOT) { $(`p-root-${ax}`).value = S.pose.root[ax]; $(`p-root-${ax}-out`).textContent = fmt(S.pose.root[ax]); $(`p-root-${ax}`).disabled = S.sacrumFixed; }
  $("sacrum-fixed").checked = S.sacrumFixed;
  const d = DEMOS.find((x) => JSON.stringify(x.pose) === JSON.stringify(S.pose));
  $("pose-state").textContent = RIG.isZero(S.pose) ? "neutral" : d ? d.name.toLowerCase() : "custom";
  $("demos").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(!!d && b.dataset.val === d.id)));
  // per-segment readout: angle and share of that segment's cap
  const rows = ROM.SEGMENTS.map((s) => { const a = sol.segments[s.id], c = Math.max(Math.abs(a.fe) / (a.fe >= 0 ? s.cap.flex : s.cap.ext), Math.abs(a.lb) / s.cap.lb, Math.abs(a.ar) / s.cap.ar);
    return `<tr><td>${s.id}</td><td>${a.fe.toFixed(1)}</td><td>${a.lb.toFixed(1)}</td><td>${a.ar.toFixed(1)}</td><td class="bar">${Math.round(c * 100)}%</td></tr>`; }).join("");
  $("seg-table").innerHTML = `<table><tr><th>Segment</th><th>Flex</th><th>Bend L</th><th>Rot L</th><th>of cap</th></tr>${rows}</table>`;
  $("play").disabled = RIG.isZero(S.pose);
}
// playback: neutral -> pose -> neutral, eased (in-out sine, as in pixelfx); five unique poses rendered once, then reused
const FRACS = [0, 0.1464, 0.5, 0.8536, 1], SEQ = [0, 1, 2, 3, 4, 4, 4, 3, 2, 1, 0, 0, 0];
let playT = 0, playing = false;
function stopPlay() { if (playT) clearInterval(playT); playT = 0; if (playing) { playing = false; $("play").textContent = "Play"; } }
$("play").addEventListener("click", async () => {
  if (playing) { stopPlay(); render(); return; }
  playing = true; $("play").textContent = "Stop";
  const target = JSON.parse(JSON.stringify(S.pose)), view = S.view, mmv = S.mm, frames = [];
  for (let i = 0; i < FRACS.length; i++) {
    if (!playing) return;
    $("busy").hidden = false; $("busy").textContent = `Preparing playback ${i + 1}/${FRACS.length}…`;
    const p = RIG.scalePose(target, FRACS[i]), g = await geometry(2, "", view, mmv, null, p), m = modelFor(2, "", p);
    frames.push({ st: R.stylise(g, m, styleOf()), m });
  }
  $("busy").hidden = true; if (!playing) return;
  let k = 0;
  playT = setInterval(() => { const f = frames[SEQ[k % SEQ.length]]; st = f.st; model = f.m; draw(); k++; }, 110);
});
render();
})();
