// Spine Views: pick one of the eight fixed camera angles; the column is rendered in the browser from code.
(() => {
const $ = (id) => document.getElementById(id);
const C = window.SpineCore, R = window.SpineRender;
const built = C.build();
const model = { els: built.els, comps: built.els.map(C.compile) };
const REGION_COLOR = { cervical: "#d9a441", thoracic: "#5aa6c9", lumbar: "#8b7fd1", sacral: "#5fb38a", coccygeal: "#d9708a" };
const S = { view: "right", zoom: "fit", bg: "checker", labels: true, guides: true, regions: false };
try { Object.assign(S, JSON.parse(localStorage.getItem("spine-views") || "{}")); } catch (e) { /* no storage */ }
const save = () => { try { localStorage.setItem("spine-views", JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ---------- workers: each casts a share of the 49 elements; the main thread merges the z-buffers ----------
const SRC = $("core-src").textContent + "\n" + $("render-src").textContent + `
  let M = null;
  self.onmessage = (ev) => {
    const q = ev.data;
    if (!M) { const b = SpineCore.build(); M = { els: b.els, comps: b.els.map(SpineCore.compile) }; }
    const g = SpineRender.cast(M, q.view, (p) => self.postMessage({ id: q.id, progress: p }), q.only);
    self.postMessage({ id: q.id, g }, [g.depth.buffer, g.nx.buffer, g.ny.buffer, g.nz.buffer, g.ao.buffer, g.part.buffer, g.obj.buffer]);
  };`;
const nW = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
let workers = [];
try { const url = URL.createObjectURL(new Blob([SRC], { type: "text/javascript" })); for (let i = 0; i < nW; i++) workers.push(new Worker(url)); }
catch (e) { workers = []; }
// share elements by rough cost (bounding-box area)
const cost = model.comps.map((c) => (c.box[3] - c.box[0] + c.box[4] - c.box[1]) * (c.box[4] - c.box[1] + c.box[5] - c.box[2]));
const shares = Array.from({ length: Math.max(1, workers.length) }, () => ({ k: [], c: 0 }));
cost.map((c, k) => [c, k]).sort((a, b) => b[0] - a[0]).forEach(([c, k]) => { const s = shares.reduce((a, b) => (a.c <= b.c ? a : b)); s.k.push(k); s.c += c; });

const cache = new Map(); let jobId = 0;
function geometry(viewId, onProgress) {
  if (cache.has(viewId)) return Promise.resolve(cache.get(viewId));
  const v = R.VIEWS.find((x) => x.id === viewId);
  const view = { ...R.FRAME, yaw: v.yaw, pitch: 0, ss: 3 };
  if (!workers.length) return new Promise((res) => setTimeout(() => { const g = R.cast(model, view); cache.set(viewId, g); res(g); }, 20));
  const id = ++jobId, prog = new Array(workers.length).fill(0);
  return Promise.all(workers.map((w, i) => new Promise((res) => {
    const h = (ev) => { if (ev.data.id !== id) return; if (ev.data.g) { w.removeEventListener("message", h); res(ev.data.g); } else { prog[i] = ev.data.progress; onProgress(prog.reduce((a, b) => a + b, 0) / prog.length); } };
    w.addEventListener("message", h); w.postMessage({ id, view, only: shares[i].k });
  }))).then((parts) => {
    const g = parts[0];
    for (let p = 1; p < parts.length; p++) { const o = parts[p]; for (let i = 0; i < g.depth.length; i++) if (o.depth[i] < g.depth[i]) { g.depth[i] = o.depth[i]; g.nx[i] = o.nx[i]; g.ny[i] = o.ny[i]; g.nz[i] = o.nz[i]; g.ao[i] = o.ao[i]; g.part[i] = o.part[i]; g.obj[i] = o.obj[i]; } }
    cache.set(viewId, g); return g;
  });
}

// ---------- drawing ----------
const styled = new Map();
let current = null, hoverObj = 0;
function zoomFor() {
  if (S.zoom !== "fit") return +S.zoom;
  const st = $("stage"); return Math.max(1, Math.floor(Math.min((st.clientWidth - 40) / 800, (st.clientHeight - 60) / 800)));
}
function paintRegions(st) {
  const rgba = R.paint(st, model);
  if (!S.regions) return rgba;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let p = 0; p < st.W * st.H; p++) {
    if (!st.lab[p] || st.lab[p] === 1) continue;
    const el = model.els[st.obj[p] - 1]; const c = hex(el.kind === "disc" ? "#a7b2b0" : REGION_COLOR[el.region]);
    const k = [0, 0, 0.45, 0.62, 0.8, 0.95, 1.08][st.lab[p]];
    rgba[p * 4] = c[0] * k; rgba[p * 4 + 1] = c[1] * k; rgba[p * 4 + 2] = c[2] * k;
  }
  return rgba;
}
function draw() {
  if (!current) return;
  const st = current, z = zoomFor(), cv = $("cv");
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H;
  const rgba = paintRegions(st);
  if (hoverObj) for (let p = 0; p < st.W * st.H; p++) if (st.lab[p] && st.obj[p] !== hoverObj) { rgba[p * 4 + 3] = 255; rgba[p * 4] *= 0.55; rgba[p * 4 + 1] *= 0.55; rgba[p * 4 + 2] *= 0.6; }
  off.getContext("2d").putImageData(new ImageData(rgba, st.W, st.H), 0, 0);
  const dpr = 1; cv.width = Math.round(st.W * z * dpr); cv.height = Math.round(st.H * z * dpr);
  cv.style.width = st.W * z + "px"; cv.style.height = st.H * z + "px";
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  if (S.bg === "checker") { const c = 16; ctx.fillStyle = "#3b4149"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#434a53"; for (let y = 0; y < cv.height; y += c) for (let x = (y / c) % 2 ? c : 0; x < cv.width; x += 2 * c) ctx.fillRect(x, y, c, c); }
  else { ctx.fillStyle = { dark: "#121417", light: "#eef0f2", skin: "#c99a7c" }[S.bg]; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.drawImage(off, 0, 0, cv.width, cv.height);
  if (S.guides) {
    ctx.save(); ctx.strokeStyle = "rgba(124,196,216,0.6)"; ctx.setLineDash([6, 6]); ctx.beginPath();
    ctx.moveTo(0, cv.height / 2 + 0.5); ctx.lineTo(cv.width, cv.height / 2 + 0.5); ctx.moveTo(cv.width / 2 + 0.5, 0); ctx.lineTo(cv.width / 2 + 0.5, cv.height); ctx.stroke(); ctx.restore();
  }
  drawLabels(z);
}
function drawLabels(z) {
  const box = $("lbl-layer"); box.innerHTML = ""; if (!S.labels) return;
  const v = R.VIEWS.find((x) => x.id === S.view), view = { ...R.FRAME, yaw: v.yaw, pitch: 0 };
  const side = Math.sin((v.yaw * Math.PI) / 180);           // which way the column's front faces on screen
  model.els.forEach((el) => {
    if (el.kind === "disc") return;
    const p = R.project(el.o, view);
    const d = document.createElement("span"); d.className = "lbl"; d.textContent = el.id;
    const left = Math.abs(side) > 0.3 ? side > 0 : true;    // put labels in front of the bodies in side views
    d.style.top = p[1] * z + "px";
    if (left && Math.abs(side) > 0.3) { d.style.left = (p[0] + 44) * z + "px"; d.classList.add("r"); }
    else { d.style.left = (p[0] - 50) * z + "px"; d.classList.add("l"); }
    box.appendChild(d);
  });
}
let token = 0;
async function render() {
  save(); syncControls();
  const t = ++token; $("busy").hidden = false; $("busy").textContent = "Rendering…";
  const g = await geometry(S.view, (p) => { if (t === token) $("busy").textContent = `Rendering… ${Math.round(p * 100)}%`; });
  if (t !== token) return;
  if (!styled.has(S.view)) styled.set(S.view, R.stylise(g, model));
  current = styled.get(S.view); $("busy").hidden = true;
  const v = R.VIEWS.find((x) => x.id === S.view);
  $("caption").textContent = `${v.name} · yaw ${v.yaw}° · eye level · 800 × 800 px frame, 1 px = 1 mm`;
  draw();
  // warm the other views in the background
  setTimeout(() => R.VIEWS.forEach((x) => geometry(x.id, () => {})), 300);
}

// ---------- hover readout ----------
$("cv").addEventListener("mousemove", (e) => {
  if (!current) return;
  const r = e.target.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) / r.width) * current.W), y = Math.floor(((e.clientY - r.top) / r.height) * current.H);
  if (x < 0 || y < 0 || x >= current.W || y >= current.H) return;
  const p = y * current.W + x, o = current.obj[p];
  const h = Math.round(R.FRAME.pivot[1] + (current.H / 2 - y - 0.5) * R.FRAME.mm);
  let text = `pixel ${x}, ${y} · ${h} mm above the floor`;
  if (current.lab[p] && o) { const el = model.els[o - 1]; text = `${el.name} · ${C.PART_NAMES[current.part[p]] || ""} · ` + text; }
  $("status").textContent = text;
  const ho = current.lab[p] ? o : 0;
  if (ho !== hoverObj) { hoverObj = ho; draw(); }
});
$("cv").addEventListener("mouseleave", () => { hoverObj = 0; draw(); $("status").textContent = defaultStatus; });
const defaultStatus = `24 vertebrae, 23 discs, sacrum and coccyx · ${built.els.length} separately editable elements · hover to identify`;
$("status").textContent = defaultStatus;

// ---------- controls ----------
function seg(id, items, key) {
  const el = $(id); el.innerHTML = "";
  items.forEach(([val, label]) => { const b = document.createElement("button"); b.type = "button"; b.dataset.val = val; b.textContent = label;
    b.addEventListener("click", () => { S[key] = val; if (key === "view") render(); else { save(); syncControls(); draw(); } }); el.appendChild(b); });
}
seg("views", R.VIEWS.map((v) => [v.id, v.name]), "view");
seg("zoom", [["fit", "Fit"], ["1", "1×"], ["2", "2×"], ["3", "3×"], ["4", "4×"]], "zoom");
seg("bg", [["checker", "Clear"], ["dark", "Dark"], ["light", "Light"], ["skin", "Skin"]], "bg");
for (const k of ["labels", "guides", "regions"]) $(k).addEventListener("change", () => { S[k] = $(k).checked; save(); draw(); });
function syncControls() {
  for (const id of ["views", "zoom", "bg"]) { const key = { views: "view", zoom: "zoom", bg: "bg" }[id]; $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === String(S[key])))); }
  for (const k of ["labels", "guides", "regions"]) $(k).checked = S[k];
}
new ResizeObserver(() => { if (S.zoom === "fit") draw(); }).observe($("stage"));

// ---------- export: transparent PNG of the current view at 1 px = 1 mm ----------
let downloads = null;
const inClaude = () => !!(window.claude && typeof window.claude.use === "function");
(function initDl() { let n = 0; const tick = () => { if (inClaude()) { window.claude.use("downloads").then((d) => { downloads = d; if (!d) $("save").hidden = true; }).catch(() => {}); return; } if (++n < 6) setTimeout(tick, 500); }; tick(); })();
$("save").addEventListener("click", async () => {
  if (!current) return;
  const off = document.createElement("canvas"); off.width = current.W; off.height = current.H;
  off.getContext("2d").putImageData(new ImageData(R.paint(current, model), current.W, current.H), 0, 0);
  const blob = await new Promise((res) => off.toBlob(res, "image/png")), name = `spine_${S.view}.png`;
  if (downloads) { try { await downloads.save({ filename: name, data: blob }); } catch (e) { /* declined or unavailable */ } }
  else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
});
render();
})();
