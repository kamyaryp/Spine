// ---- Vertebra Pixel Lab: UI, styling pass, worker queue ------------------------------------
(() => {
const $ = (id) => document.getElementById(id);

const VIEWS = [
  { id: "front", name: "Front", yaw: 0, pitch: 0 },
  { id: "front34", name: "Front 3/4", yaw: 45, pitch: 0 },
  { id: "side", name: "Side", yaw: 90, pitch: 0 },
  { id: "back34", name: "Back 3/4", yaw: 135, pitch: 0 },
  { id: "back", name: "Back", yaw: 180, pitch: 0 },
  { id: "top", name: "Top", yaw: 0, pitch: 90 },
];
const SLOTS = ["outline", "line", "shade", "mid", "light", "hi"];
const SLOT_LABEL = { outline: "Outline", line: "Line / cavity", shade: "Shade", mid: "Mid", light: "Light", hi: "Highlight" };
const PRESETS = {
  "Study bone": ["#2b211b", "#5c4a3b", "#8e7860", "#bca98a", "#e0d4b8", "#faf4e3"],
  "pixelfx bone": ["#1a1814", "#3a352c", "#8a806c", "#b8ad96", "#e4dcc8", "#fffaf0"],
  "Cool ivory": ["#1e2128", "#4a4f5c", "#7f8593", "#b3b6bd", "#dcdcd8", "#f7f6f0"],
  "X-ray": ["#0b1a24", "#1f4257", "#3f7590", "#6fa9c2", "#a9d6e6", "#e6f7fb"],
};
const PART_COLORS = [null, "#d9a441", "#5aa6c9", "#8b7fd1", "#5fb38a", "#d9708a", "#c98b5a", "#7c9cd9"];
const DEFAULTS = {
  mode: "sheet", view: "front", yaw: 0, pitch: 0, mm: 1, zoom: "fit", bg: "checker",
  grid: false, guides: true, anatomy: false,
  lightDir: 136, lightFront: 32, ambient: 0.16, aoStr: 1, exposure: 1,
  outline: true, lines: true, gap: 3, rim: true, clusters: true,
  palette: PRESETS["Study bone"].slice(), preset: "Study bone",
};
let S = loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem("vertebra-pixel-lab");
    if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw), { palette: (JSON.parse(raw).palette || DEFAULTS.palette).slice() });
  } catch (e) { /* storage unavailable */ }
  return Object.assign({}, DEFAULTS, { palette: DEFAULTS.palette.slice() });
}
function saveSettings() { try { localStorage.setItem("vertebra-pixel-lab", JSON.stringify(S)); } catch (e) { /* ignore */ } }

const hexRgb = (h) => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const rgbHex = (r) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

// ---------- geometry cache + worker ----------
const cache = new Map();
const pending = new Map();   // key -> {resolvers, progress}
const frameSize = (mm, pitch) => {
  const W = Math.round(96 / mm);
  return { W, H: pitch === 0 ? Math.round(64 / mm) : W };
};
const keyOf = (yaw, pitch, mm) => `${yaw}|${pitch}|${mm}`;

let worker = null;
try {
  const src = $("geo-src").textContent + `
    self.onmessage = (ev) => {
      const q = ev.data;
      const r = castView(q.yaw, q.pitch, q.mm, q.W, q.H, q.ss, (p) => self.postMessage({ key: q.key, progress: p }));
      self.postMessage({ key: q.key, result: r }, [r.hit.buffer, r.depth.buffer, r.nx.buffer, r.ny.buffer, r.nz.buffer, r.ao.buffer, r.part.buffer]);
    };`;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  worker.onmessage = (ev) => {
    const m = ev.data, p = pending.get(m.key);
    if (!p) return;
    if (m.result) { cache.set(m.key, m.result); pending.delete(m.key); p.resolvers.forEach((f) => f(m.result)); updateBusy(); }
    else { p.progress = m.progress; updateBusy(); }
  };
  worker.onerror = () => { worker = null; };
} catch (e) { worker = null; }

function getGeo(yaw, pitch, mm) {
  const key = keyOf(yaw, pitch, mm);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return new Promise((res) => pending.get(key).resolvers.push(res));
  const { W, H } = frameSize(mm, pitch);
  return new Promise((res) => {
    pending.set(key, { resolvers: [res], progress: 0 });
    updateBusy();
    if (worker) worker.postMessage({ key, yaw, pitch, mm, W, H, ss: 4 });
    else setTimeout(() => {
      const r = castView(yaw, pitch, mm, W, H, 4);
      cache.set(key, r); const p = pending.get(key); pending.delete(key); p.resolvers.forEach((f) => f(r)); updateBusy();
    }, 10);
  });
}
function updateBusy() {
  const n = pending.size;
  const el = $("busy");
  if (!n) { el.hidden = true; return; }
  let prog = 0; pending.forEach((p) => { prog += p.progress || 0; });
  el.hidden = false;
  el.textContent = `Rendering ${n} view${n > 1 ? "s" : ""}… ${Math.round((prog / n) * 100)}%`;
}

// ---------- styling pass: geometry -> labelled pixels ----------
// labels: 0 empty, 1 outline, 2 line, 3 shade, 4 mid, 5 light, 6 hi
function stylise(g) {
  const { W, H, ss, R } = g, SW = W * ss;
  const th = (S.lightDir * Math.PI) / 180, ph = (S.lightFront * Math.PI) / 180;
  const L = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
  const n = W * H;
  const cnt = new Uint16Array(n), shSum = new Float32Array(n), dSum = new Float32Array(n);
  const votes = new Uint16Array(n * 8);
  for (let j = 0; j < H * ss; j++) {
    for (let i = 0; i < SW; i++) {
      const idx = j * SW + i;
      if (!g.hit[idx]) continue;
      const mx = g.nx[idx], my = g.ny[idx], mz = g.nz[idx];
      const vx = R[0][0] * mx + R[0][1] * my + R[0][2] * mz;
      const vy = R[1][0] * mx + R[1][1] * my + R[1][2] * mz;
      const vz = R[2][0] * mx + R[2][1] * my + R[2][2] * mz;
      const lam = Math.max(0, vx * L[0] + vy * L[1] + vz * L[2]);
      const facing = Math.max(0, vz);
      const aoT = 1 - S.aoStr * 0.7 * (1 - g.ao[idx]);
      const sh = (S.ambient + 0.76 * Math.pow(lam, 1.25) + 0.10 * facing) * aoT * S.exposure;
      const p = ((j / ss) | 0) * W + ((i / ss) | 0);
      cnt[p]++; shSum[p] += sh; dSum[p] += g.depth[idx]; votes[p * 8 + g.part[idx]]++;
    }
  }
  const cover = new Uint8Array(n), shade = new Float32Array(n), depth = new Float32Array(n), part = new Uint8Array(n);
  let tone = new Int8Array(n).fill(-1);
  const TH = [0.22, 0.45, 0.70, 0.92];
  for (let p = 0; p < n; p++) {
    if (cnt[p] / (ss * ss) < 0.45) continue;
    cover[p] = 1; shade[p] = shSum[p] / cnt[p]; depth[p] = dSum[p] / cnt[p];
    let b = 1, bv = 0; for (let k = 1; k < 8; k++) if (votes[p * 8 + k] > bv) { bv = votes[p * 8 + k]; b = k; }
    part[p] = b;
    let t = 0; while (t < 4 && shade[p] >= TH[t]) t++;
    tone[p] = t;
  }
  const at = (arr, x, y, def) => (x < 0 || y < 0 || x >= W || y >= H ? def : arr[y * W + x]);
  if (S.clusters) {
    for (let it = 0; it < 3; it++) {
      const out = tone.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = tone[y * W + x]; if (t < 0) continue;
        const c = [0, 0, 0, 0, 0];
        if (it === 0) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = at(tone, x + dx, y + dy, -1); if (v >= 0) c[v]++; }
          let b = 0; for (let k = 1; k < 5; k++) if (c[k] > c[b]) b = k;
          if (c[b] >= 5) out[y * W + x] = b;
        } else {
          let same = false, any = false;
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const v = at(tone, x + dx, y + dy, -1); if (v >= 0) { c[v]++; any = true; if (v === t) same = true; } }
          if (any && !same) { let b = 0; for (let k = 1; k < 5; k++) if (c[k] > c[b]) b = k; out[y * W + x] = b; }
        }
      }
      tone = out;
    }
  }
  let lab = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (!cover[p]) continue;
    lab[p] = tone[p] + 2;
    let edge = false, inner = false;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!at(cover, x + dx, y + dy, 0)) edge = true;
      else if (at(depth, x + dx, y + dy, 0) - depth[p] > S.gap) inner = true;
    }
    if (edge && S.outline) lab[p] = 1;
    else if (inner && S.lines) lab[p] = tone[p] >= 1 ? 2 : 1;
  }
  const isEdge = (x, y) => { const v = at(lab, x, y, 0); return v === 1 || v === 0; };
  if (S.rim) {
    const out = lab.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, v = lab[p]; if (v < 2) continue;
      const ti = v - 2;
      if (isEdge(x, y - 1) && lab[p - 1] !== 0 && (ti === 1 || ti === 2)) out[p] = v + 1;
      else if (isEdge(x, y + 1) && ti >= 2 && lab[p - W] >= 2) out[p] = v - 1;
    }
    lab = out;
  }
  if (S.lines) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x; if (lab[p] !== 2) continue;
      let ok = false;
      for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const v = lab[p + dy * W + dx]; if (v === 1 || v === 2) { ok = true; break; }
      }
      if (!ok) lab[p] = Math.max(1, tone[p]) + 2;
    }
  }
  return { W, H, lab, part };
}

function paint(st, hoverPart) {
  const { W, H, lab, part } = st;
  const img = new ImageData(W, H);
  const pal = S.palette.map(hexRgb);
  const toneMul = [0, 0.32, 0.5, 0.68, 0.84, 1.0, 1.12];
  for (let p = 0; p < W * H; p++) {
    const v = lab[p]; if (!v) continue;
    let c;
    if (S.anatomy) {
      if (v === 1) c = pal[0];
      else {
        const pc = hexRgb(PART_COLORS[part[p]]);
        c = pc.map((x) => x * toneMul[v]);
        if (hoverPart && part[p] !== hoverPart) c = c.map((x, i) => x * 0.45 + pal[3][i] * 0.12);
      }
    } else c = pal[v - 1];
    img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = 255;
  }
  return img;
}

// ---------- drawing ----------
const styled = new Map();   // canvas id -> {st, view}
function zoomFor(W, H) {
  if (S.zoom !== "fit") return +S.zoom;
  const stage = $("stage");
  const sw = stage.clientWidth - 48, sh = stage.clientHeight - 48;
  if (S.mode === "sheet") {
    const cols = sw > 1050 ? 3 : sw > 600 ? 2 : 1;
    const z = Math.floor((sw - (cols - 1) * 24 - cols * 2) / (cols * 96 / S.mm));
    return Math.max(1, Math.min(10, z));
  }
  return Math.max(1, Math.min(16, Math.floor(Math.min(sw / W, (sh - 30) / H))));
}

function drawBg(ctx, w, h, z) {
  if (S.bg === "checker") {
    const c = 8 * Math.max(1, Math.round(z / 2));
    ctx.fillStyle = "#3b4149"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#454c55";
    for (let y = 0; y < h; y += c) for (let x = (y / c) % 2 ? c : 0; x < w; x += 2 * c) ctx.fillRect(x, y, c, c);
  } else {
    ctx.fillStyle = { dark: "#121417", mid: "#6b7178", light: "#eef0f2", skin: "#c99a7c" }[S.bg] || "#121417";
    ctx.fillRect(0, 0, w, h);
  }
}

function drawSprite(canvas, st, z, hoverPart) {
  const { W, H } = st;
  canvas.width = W * z; canvas.height = H * z;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  drawBg(ctx, canvas.width, canvas.height, z);
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  off.getContext("2d").putImageData(paint(st, hoverPart), 0, 0);
  ctx.drawImage(off, 0, 0, W * z, H * z);
  if (S.grid && z >= 5) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < W; x++) { ctx.moveTo(x * z + 0.5, 0); ctx.lineTo(x * z + 0.5, H * z); }
    for (let y = 1; y < H; y++) { ctx.moveTo(0, y * z + 0.5); ctx.lineTo(W * z, y * z + 0.5); }
    ctx.stroke();
  }
  if (S.guides) {
    ctx.save();
    ctx.strokeStyle = "rgba(124,196,216,0.75)"; ctx.setLineDash([z * 2, z * 2]); ctx.lineWidth = 1; ctx.beginPath();
    const cy = Math.floor(H / 2) * z + 0.5, cx = Math.floor(W / 2) * z + 0.5;
    ctx.moveTo(0, cy); ctx.lineTo(W * z, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H * z);
    ctx.stroke(); ctx.restore();
  }
}

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  saveSettings();
  const stage = $("stage");
  stage.dataset.mode = S.mode;
  if (S.mode === "sheet") {
    const grid = $("sheet");
    if (!grid.children.length) buildSheet();
    VIEWS.forEach((v) => getGeo(v.yaw, v.pitch, S.mm).then((g) => {
      if (token !== renderToken) return;
      const st = stylise(g); const z = zoomFor(st.W, st.H);
      const cv = $("cv-" + v.id);
      styled.set(cv.id, { st, view: v, z });
      drawSprite(cv, st, z);
      $("sz-" + v.id).textContent = `${st.W}×${st.H} px`;
    }));
    // pre-warm the others? keep it lazy.
  } else {
    const { yaw, pitch } = currentAngle();
    const g = await getGeo(yaw, pitch, S.mm);
    if (token !== renderToken) return;
    const st = stylise(g); const z = zoomFor(st.W, st.H);
    const cv = $("cv-single");
    styled.set("cv-single", { st, view: { name: viewName(yaw, pitch) }, z });
    drawSprite(cv, st, z, hoverState.part && S.anatomy ? hoverState.part : 0);
    $("single-label").textContent = `${viewName(yaw, pitch)} · yaw ${yaw}° · pitch ${pitch}° · ${st.W}×${st.H} px at ${S.mm} mm/px · ${z}×`;
  }
  syncStatus();
}
function currentAngle() { return { yaw: ((S.yaw % 360) + 360) % 360, pitch: S.pitch }; }
function viewName(yaw, pitch) {
  const v = VIEWS.find((v) => v.yaw === yaw && v.pitch === pitch);
  return v ? v.name : "Custom angle";
}

function buildSheet() {
  const grid = $("sheet");
  grid.innerHTML = "";
  VIEWS.forEach((v) => {
    const fig = document.createElement("figure");
    fig.className = "card";
    fig.innerHTML = `<button type="button" class="card-hit" id="open-${v.id}" aria-label="Open ${v.name} view on its own"><canvas id="cv-${v.id}"></canvas></button>
      <figcaption><span>${v.name}${v.pitch ? " · reference" : ""}</span><span class="mono" id="sz-${v.id}">…</span></figcaption>`;
    grid.appendChild(fig);
    $("open-" + v.id).addEventListener("click", () => { S.mode = "single"; S.yaw = v.yaw; S.pitch = v.pitch; syncControls(); render(); });
    attachHover($("cv-" + v.id));
  });
}

// ---------- hover readout ----------
const hoverState = { part: 0, text: "" };
const TONE_NAMES = ["", "Outline", "Line / cavity", "Shade", "Mid", "Light", "Highlight"];
function attachHover(cv) {
  cv.addEventListener("mousemove", (e) => {
    const rec = styled.get(cv.id); if (!rec) return;
    const r = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * rec.st.W), y = Math.floor(((e.clientY - r.top) / r.height) * rec.st.H);
    if (x < 0 || y < 0 || x >= rec.st.W || y >= rec.st.H) return;
    const p = y * rec.st.W + x, v = rec.st.lab[p];
    const cx = x - Math.floor(rec.st.W / 2), cy = Math.floor(rec.st.H / 2) - y;
    let text = `${rec.view.name} · pixel (${x}, ${y}) · ${cx >= 0 ? "+" : ""}${cx}, ${cy >= 0 ? "+" : ""}${cy} from pivot`;
    let part = 0;
    if (v) { part = rec.st.part[p]; text += ` · ${PART_NAMES[part]} · ${TONE_NAMES[v]} ${S.palette[v - 1]}`; }
    hoverState.text = text;
    if (part !== hoverState.part) {
      hoverState.part = part;
      if (S.anatomy) { drawSprite(cv, rec.st, rec.z, part); highlightLegend(part); }
    }
    syncStatus();
  });
  cv.addEventListener("mouseleave", () => {
    hoverState.text = ""; const had = hoverState.part; hoverState.part = 0;
    const rec = styled.get(cv.id);
    if (had && S.anatomy && rec) drawSprite(cv, rec.st, rec.z, 0);
    highlightLegend(0); syncStatus();
  });
}
function syncStatus() {
  $("status").textContent = hoverState.text || `Pivot = centre of every frame (dashed). 1 px = ${S.mm} mm. Hover a sprite to read its pixels.`;
}
function highlightLegend(part) {
  document.querySelectorAll("#legend li").forEach((li) => li.classList.toggle("on", +li.dataset.part === part));
}

// ---------- controls ----------
function seg(id, values, key, fmt, cast) {
  const el = $(id); el.innerHTML = "";
  values.forEach((val) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = fmt ? fmt(val) : val; b.dataset.val = val;
    b.addEventListener("click", () => { S[key] = cast ? cast(val) : val; syncControls(); render(); });
    el.appendChild(b);
  });
}
function bindRange(id, key, fmt, cast = Number) {
  const el = $(id), out = $(id + "-out");
  el.addEventListener("input", () => { S[key] = cast(el.value); out.textContent = fmt(S[key]); if (key === "yaw" || key === "pitch") { S.mode = "single"; syncControls(); } render(); });
}
function bindCheck(id, key) { $(id).addEventListener("change", () => { S[key] = $(id).checked; if (key === "anatomy") syncLegend(); render(); }); }

function syncControls() {
  document.querySelectorAll("#mode-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === S.mode)));
  document.querySelectorAll("#mm-seg button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.val === S.mm)));
  document.querySelectorAll("#zoom-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === String(S.zoom))));
  document.querySelectorAll("#bg-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === S.bg)));
  const { yaw, pitch } = currentAngle();
  document.querySelectorAll("#view-btns button").forEach((b) => {
    const v = VIEWS.find((x) => x.id === b.dataset.view);
    b.setAttribute("aria-pressed", String(S.mode === "single" && v.yaw === yaw && v.pitch === pitch));
  });
  const ranges = { yaw: (v) => v + "°", pitch: (v) => v + "°", lightDir: (v) => v + "°", lightFront: (v) => v + "°",
    ambient: (v) => v.toFixed(2), aoStr: (v) => v.toFixed(2), exposure: (v) => v.toFixed(2), gap: (v) => v.toFixed(1) + " mm" };
  for (const k in ranges) { $(k).value = S[k]; $(k + "-out").textContent = ranges[k](S[k]); }
  for (const k of ["outline", "lines", "rim", "clusters", "grid", "guides", "anatomy"]) $(k).checked = S[k];
  $("gap").disabled = !S.lines;
  SLOTS.forEach((s, i) => { $("pal-" + s).value = S.palette[i]; $("pal-" + s + "-hex").textContent = S.palette[i]; });
  $("preset").value = PRESETS[S.preset] ? S.preset : "";
  $("angle-group").classList.toggle("dim", S.mode !== "single");
  syncLegend();
}
function syncLegend() { $("legend").hidden = !S.anatomy; }

function buildControls() {
  seg("mode-seg", ["sheet", "single"], "mode", (v) => (v === "sheet" ? "All views" : "Single view"));
  seg("mm-seg", [1, 1.5, 2, 3, 4], "mm", (v) => String(v), Number);
  seg("zoom-seg", ["fit", 2, 3, 4, 6, 8, 12], "zoom", (v) => (v === "fit" ? "Fit" : v + "×"), (v) => (v === "fit" ? "fit" : +v));
  seg("bg-seg", ["checker", "dark", "mid", "light", "skin"], "bg", (v) => ({ checker: "Clear", dark: "Dark", mid: "Grey", light: "Light", skin: "Skin" }[v]));
  const vb = $("view-btns");
  VIEWS.forEach((v) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = v.name; b.dataset.view = v.id;
    b.addEventListener("click", () => { S.mode = "single"; S.yaw = v.yaw; S.pitch = v.pitch; syncControls(); render(); });
    vb.appendChild(b);
  });
  bindRange("yaw", "yaw", (v) => v + "°"); bindRange("pitch", "pitch", (v) => v + "°");
  bindRange("lightDir", "lightDir", (v) => v + "°"); bindRange("lightFront", "lightFront", (v) => v + "°");
  bindRange("ambient", "ambient", (v) => v.toFixed(2)); bindRange("aoStr", "aoStr", (v) => v.toFixed(2));
  bindRange("exposure", "exposure", (v) => v.toFixed(2)); bindRange("gap", "gap", (v) => v.toFixed(1) + " mm");
  ["outline", "lines", "rim", "clusters", "grid", "guides", "anatomy"].forEach((k) => bindCheck(k, k));
  $("lines").addEventListener("change", () => { $("gap").disabled = !S.lines; });
  // palette
  const pw = $("palette");
  SLOTS.forEach((s, i) => {
    const row = document.createElement("label"); row.className = "swatch"; row.htmlFor = "pal-" + s;
    row.innerHTML = `<input type="color" id="pal-${s}"><span>${SLOT_LABEL[s]}</span><span class="mono" id="pal-${s}-hex"></span>`;
    pw.appendChild(row);
    row.querySelector("input").addEventListener("input", (e) => { S.palette[i] = e.target.value; S.preset = ""; syncControls(); render(); });
  });
  const pre = $("preset");
  pre.innerHTML = Object.keys(PRESETS).map((k) => `<option value="${k}">${k}</option>`).join("") + `<option value="">Custom</option>`;
  pre.addEventListener("change", () => { if (PRESETS[pre.value]) { S.palette = PRESETS[pre.value].slice(); S.preset = pre.value; syncControls(); render(); } });
  // legend
  $("legend").innerHTML = PART_NAMES.slice(1).map((n, i) => `<li data-part="${i + 1}"><i style="background:${PART_COLORS[i + 1]}"></i>${n}</li>`).join("");
  $("reset").addEventListener("click", () => { const mode = S.mode; S = Object.assign({}, DEFAULTS, { palette: DEFAULTS.palette.slice(), mode }); syncControls(); render(); });
  $("copy-settings").addEventListener("click", async () => {
    const txt = JSON.stringify({ mmPerPx: S.mm, palette: Object.fromEntries(SLOTS.map((s, i) => [s, S.palette[i]])),
      light: { direction: S.lightDir, towardViewer: S.lightFront }, ambient: S.ambient, ao: S.aoStr, exposure: S.exposure,
      rules: { outline: S.outline, interiorLines: S.lines, lineGapMm: S.gap, rimLight: S.rim, clusters: S.clusters } }, null, 2);
    try { await navigator.clipboard.writeText(txt); flash("Style settings copied as JSON."); }
    catch (e) { flash("The browser blocked the clipboard. Settings are shown in the status bar."); $("status").textContent = txt.replace(/\s+/g, " "); }
  });
}

let flashT;
function flash(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => (el.hidden = true), 2600); }

// ---------- export ----------
let downloads = null;
// Inside claude.ai the page saves through the `downloads` capability; anywhere else (GitHub Pages, a local file)
// it falls back to an ordinary browser download.
const inClaude = () => !!(window.claude && typeof window.claude.use === "function");
function initDownloads() {
  const tryUse = () => {
    if (!inClaude()) return false;
    window.claude.use("downloads").then((d) => { downloads = d; $("export").hidden = !d; }).catch(() => { $("export").hidden = true; });
    return true;
  };
  if (!tryUse()) { let n = 0; const iv = setInterval(() => { if (tryUse() || ++n > 6) clearInterval(iv); }, 500); }
}
function browserDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function spriteCanvas(st, z) {
  const c = document.createElement("canvas"); c.width = st.W * z; c.height = st.H * z;
  const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const off = document.createElement("canvas"); off.width = st.W; off.height = st.H;
  off.getContext("2d").putImageData(paint(st, 0), 0, 0);
  ctx.drawImage(off, 0, 0, st.W * z, st.H * z);
  return c;
}
async function exportPng(scale) {
  if (inClaude() && !downloads) return;
  let canvas, name;
  if (S.mode === "single") {
    const rec = styled.get("cv-single"); if (!rec) return;
    canvas = spriteCanvas(rec.st, scale);
    const { yaw, pitch } = currentAngle();
    name = `vertebra_y${yaw}_p${pitch}_${S.mm}mm${scale > 1 ? "_x" + scale : ""}.png`;
  } else {
    const recs = VIEWS.map((v) => styled.get("cv-" + v.id)).filter(Boolean);
    if (recs.length < VIEWS.length) { flash("Wait until all six views have rendered."); return; }
    const gap = 8 * scale;
    const w = recs.reduce((a, r) => a + r.st.W * scale, 0) + gap * (recs.length - 1);
    const h = Math.max(...recs.map((r) => r.st.H * scale));
    canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); let x = 0;
    recs.forEach((r) => { const c = spriteCanvas(r.st, scale); ctx.drawImage(c, x, Math.round((h - c.height) / 2)); x += c.width + gap; });
    name = `vertebra_sheet_${S.mm}mm${scale > 1 ? "_x" + scale : ""}.png`;
  }
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!downloads) { browserDownload(blob, name); flash("Downloaded " + name); return; }
  try { await downloads.save({ filename: name, data: blob }); flash("Saved " + name); }
  catch (e) {
    const code = e && e.code;
    if (code === "declined") flash("Save cancelled.");
    else if (code === "rate_limited") flash("A save prompt is already open.");
    else { flash("Saving isn't available in this view."); $("export").hidden = true; }
  }
}

// ---------- boot ----------
buildControls();
syncControls();
$("save-1x").addEventListener("click", () => exportPng(1));
$("save-zoom").addEventListener("click", () => exportPng(4));
let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(render, 120); }).observe($("stage"));
attachHover($("cv-single"));
initDownloads();
render();
// warm the other scales' main views in the background once the first set is in
setTimeout(() => VIEWS.forEach((v) => getGeo(v.yaw, v.pitch, S.mm)), 50);
})();
