// Spine renderer: orthographic, per-element ray casting into a shared z-buffer, then the approved pixel-art pass.
// Works in the browser (global SpineRender) and in Node (module.exports).
(function (root) {
"use strict";

const PALETTES = {
  bone: ["#2b211b", "#5c4a3b", "#8e7860", "#bca98a", "#e0d4b8", "#faf4e3"],
  disc: ["#2b211b", "#4b5157", "#7b878a", "#a7b2b0", "#cdd6d1", "#eef3ee"],
};
const STYLE = { lightDir: 136, lightFront: 32, ambient: 0.16, aoStr: 1, exposure: 1, gap: 3, thresholds: [0.22, 0.45, 0.70, 0.92],
  outline: true, lines: true, rim: true, clusters: true };

function rotView(yaw, pitch) {
  const a = (yaw * Math.PI) / 180, b = (pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return [[ca, 0, sa], [sb * sa, cb, -sb * ca], [-cb * sa, sb, cb * ca]];
}
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const rotX = (p) => { const c = Math.cos(p), s = Math.sin(p); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };

// model = { els, comps } ; view = { yaw, pitch, mm, W, H, pivot, ss }
function cast(model, view, onProgress, only) {
  const { mm, W, H, ss } = view, SW = W * ss, SH = H * ss, N = SW * SH;
  const Rv = rotView(view.yaw, view.pitch || 0);
  const depth = new Float32Array(N).fill(Infinity), nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
  const ao = new Float32Array(N), part = new Uint8Array(N), obj = new Uint8Array(N);
  const Z0 = 3000, e = 0.1;
  model.els.forEach((el, k) => {
    if (only && !only.includes(k)) return;
    const comp = model.comps[k], sdf = comp.sdf, b = comp.box;
    const M = mul(Rv, rotX(el.psi));
    const d0 = [el.o[0] - view.pivot[0], el.o[1] - view.pivot[1], el.o[2] - view.pivot[2]];
    const Ov = [0, 1, 2].map((i) => Rv[i][0] * d0[0] + Rv[i][1] * d0[1] + Rv[i][2] * d0[2]);
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
      const vx = Ov[0] + M[0][0] * x + M[0][1] * y + M[0][2] * z, vy = Ov[1] + M[1][0] * x + M[1][1] * y + M[1][2] * z;
      const si = (vx / mm + W / 2) * ss, sj = (H / 2 - vy / mm) * ss;
      i0 = Math.min(i0, si); i1 = Math.max(i1, si); j0 = Math.min(j0, sj); j1 = Math.max(j1, sj);
    }
    i0 = Math.max(0, Math.floor(i0)); i1 = Math.min(SW - 1, Math.ceil(i1)); j0 = Math.max(0, Math.floor(j0)); j1 = Math.min(SH - 1, Math.ceil(j1));
    const ldx = -M[2][0], ldy = -M[2][1], ldz = -M[2][2];          // ray direction in local space
    for (let j = j0; j <= j1; j++) {
      const vy = (H / 2 - (j + 0.5) / ss) * mm;
      for (let i = i0; i <= i1; i++) {
        const vx = ((i + 0.5) / ss - W / 2) * mm;
        const qx = vx - Ov[0], qy = vy - Ov[1], qz = Z0 - Ov[2];
        const ox = M[0][0] * qx + M[1][0] * qy + M[2][0] * qz, oy = M[0][1] * qx + M[1][1] * qy + M[2][1] * qz, oz = M[0][2] * qx + M[1][2] * qy + M[2][2] * qz;
        // slab test against the local bounding box
        let t0 = 0, t1 = 1e9, ok = true;
        for (const [o, d, lo, hi] of [[ox, ldx, b[0], b[3]], [oy, ldy, b[1], b[4]], [oz, ldz, b[2], b[5]]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
          let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
          if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
        }
        if (!ok) continue;
        const idx = j * SW + i;
        if (t0 >= depth[idx]) continue;
        let t = t0, hit = false;
        for (let s = 0; s < 200 && t < t1; s++) {
          const d = sdf(ox + ldx * t, oy + ldy * t, oz + ldz * t);
          if (d < 0.04) { hit = true; break; }
          t += Math.max(d * 0.9, 0.02);
        }
        if (!hit || t >= depth[idx]) continue;
        const x = ox + ldx * t, y = oy + ldy * t, z = oz + ldz * t;
        const a1 = sdf(x + e, y - e, z - e), a2 = sdf(x - e, y - e, z + e), a3 = sdf(x - e, y + e, z - e), a4 = sdf(x + e, y + e, z + e);
        let gx = a1 - a2 - a3 + a4, gy = -a1 - a2 + a3 + a4, gz = -a1 + a2 - a3 + a4;
        const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
        let occ = 0, wgt = 1;
        for (const dd of [0.8, 1.8, 3.2]) { occ += (dd - Math.min(sdf(x + gx * dd, y + gy * dd, z + gz * dd), dd)) / dd * wgt; wgt *= 0.6; }
        depth[idx] = t;
        nx[idx] = M[0][0] * gx + M[0][1] * gy + M[0][2] * gz;
        ny[idx] = M[1][0] * gx + M[1][1] * gy + M[1][2] * gz;
        nz[idx] = M[2][0] * gx + M[2][1] * gy + M[2][2] * gz;
        ao[idx] = Math.max(0, Math.min(1, 1 - 0.75 * occ));
        part[idx] = comp.partAt(x, y, z);
        obj[idx] = k + 1;
      }
    }
    if (onProgress) onProgress((k + 1) / model.els.length);
  });
  return { W, H, ss, depth, nx, ny, nz, ao, part, obj };
}

// labels: 0 empty, 1 outline, 2 line, 3 shade, 4 mid, 5 light, 6 hi ; per pixel also obj (element index+1) and part
function stylise(g, model, st0) {
  const st = Object.assign({}, STYLE, st0 || {});
  const { W, H, ss } = g, SW = W * ss, n = W * H;
  const th = (st.lightDir * Math.PI) / 180, ph = (st.lightFront * Math.PI) / 180;
  const L = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
  const cnt = new Uint16Array(n), shSum = new Float32Array(n), dSum = new Float32Array(n);
  const objOf = new Uint8Array(n), partOf = new Uint8Array(n);
  const ov = new Map();
  for (let j = 0; j < H * ss; j++) for (let i = 0; i < SW; i++) {
    const idx = j * SW + i; if (!g.obj[idx]) continue;
    const lam = Math.max(0, g.nx[idx] * L[0] + g.ny[idx] * L[1] + g.nz[idx] * L[2]);
    const aoT = 1 - st.aoStr * 0.7 * (1 - g.ao[idx]);
    const sh = (st.ambient + 0.76 * Math.pow(lam, 1.25) + 0.10 * Math.max(0, g.nz[idx])) * aoT * st.exposure;
    const p = ((j / ss) | 0) * W + ((i / ss) | 0);
    cnt[p]++; shSum[p] += sh; dSum[p] += g.depth[idx];
    const key = p * 65536 + g.obj[idx] * 256 + g.part[idx]; ov.set(key, (ov.get(key) || 0) + 1);
  }
  // majority element/part per pixel
  const best = new Uint16Array(n);
  for (const [key, c] of ov) { const p = Math.floor(key / 65536); if (c > best[p]) { best[p] = c; objOf[p] = (key >> 8) & 255; partOf[p] = key & 255; } }
  const cover = new Uint8Array(n), depth = new Float32Array(n);
  let tone = new Int8Array(n).fill(-1);
  const TH = st.thresholds;
  for (let p = 0; p < n; p++) {
    if (cnt[p] / (ss * ss) < 0.45) continue;
    cover[p] = 1; depth[p] = dSum[p] / cnt[p];
    const s = shSum[p] / cnt[p]; let t = 0; while (t < 4 && s >= TH[t]) t++; tone[p] = t;
  }
  const at = (arr, x, y, def) => (x < 0 || y < 0 || x >= W || y >= H ? def : arr[y * W + x]);
  // clusters: 3x3 majority (same element only), then remove lone pixels
  for (let it = 0; it < (st.clusters ? 3 : 0); it++) {
    const out = tone.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, t = tone[p]; if (t < 0) continue;
      const c = [0, 0, 0, 0, 0], o = objOf[p];
      if (it === 0) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = p + dy * W + dx, v = at(tone, x + dx, y + dy, -1); if (v >= 0 && objOf[q] === o) c[v]++; }
        let b = 0; for (let k = 1; k < 5; k++) if (c[k] > c[b]) b = k;
        if (c[b] >= 5) out[p] = b;
      } else {
        let same = false, any = false;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const v = at(tone, x + dx, y + dy, -1); if (v >= 0) { c[v]++; any = true; if (v === t) same = true; } }
        if (any && !same) { let b = 0; for (let k = 1; k < 5; k++) if (c[k] > c[b]) b = k; out[p] = b; }
      }
    }
    tone = out;
  }
  let lab = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (!cover[p]) continue;
    lab[p] = tone[p] + 2;
    let edge = false, inner = false;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!at(cover, x + dx, y + dy, 0)) edge = true;
      else if (at(depth, x + dx, y + dy, 0) - depth[p] > st.gap) inner = true;
    }
    if (edge && st.outline) lab[p] = 1; else if (inner && st.lines) lab[p] = tone[p] >= 1 ? 2 : 1;
  }
  // foramen walls read as holes: darkest tone
  for (let p = 0; p < n; p++) if (lab[p] >= 2 && partOf[p] === 19) lab[p] = 2;
  // rim light on top edges, step down above bottom edges
  const isEdge = (x, y) => { const v = at(lab, x, y, 0); return v === 1 || v === 0; };
  if (st.rim) { const out = lab.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, v = lab[p]; if (v < 2) continue; const ti = v - 2;
      if (isEdge(x, y - 1) && lab[p - 1] !== 0 && (ti === 1 || ti === 2)) out[p] = v + 1;
      else if (isEdge(x, y + 1) && ti >= 2 && lab[p - W] >= 2) out[p] = v - 1;
    }
    lab = out; }
  // interior lines are strokes, never dots
  if (st.lines) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x; if (lab[p] !== 2) continue; let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const v = lab[p + dy * W + dx]; if (v === 1 || v === 2) { ok = true; break; } }
    if (!ok) lab[p] = Math.max(1, tone[p]) + 2;
  }
  return { W, H, lab, obj: objOf, part: partOf };
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function paint(st, model, palettes = PALETTES) {
  const { W, H, lab, obj } = st, rgba = new Uint8ClampedArray(W * H * 4);
  const pals = { bone: palettes.bone.map(hexRgb), disc: palettes.disc.map(hexRgb) };
  for (let p = 0; p < W * H; p++) {
    const v = lab[p]; if (!v) continue;
    const el = model.els[obj[p] - 1];
    const pal = el && el.kind === "disc" ? pals.disc : pals.bone;
    const c = v === 1 ? pals.bone[0] : pal[v - 1];
    rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = 255;
  }
  return rgba;
}

const VIEWS = [
  { id: "front", name: "Front", yaw: 0 }, { id: "front-right", name: "Front 3/4 right", yaw: 45 },
  { id: "right", name: "Right side", yaw: 90 }, { id: "back-right", name: "Back 3/4 right", yaw: 135 },
  { id: "back", name: "Back", yaw: 180 }, { id: "back-left", name: "Back 3/4 left", yaw: 225 },
  { id: "left", name: "Left side", yaw: 270 }, { id: "front-left", name: "Front 3/4 left", yaw: 315 },
];
const FRAME = { W: 800, H: 800, mm: 1, pivot: [0, 1302, -25] };

function project(p, view) {
  const Rv = rotView(view.yaw, view.pitch || 0), d = [p[0] - view.pivot[0], p[1] - view.pivot[1], p[2] - view.pivot[2]];
  const vx = Rv[0][0] * d[0] + Rv[0][1] * d[1] + Rv[0][2] * d[2], vy = Rv[1][0] * d[0] + Rv[1][1] * d[1] + Rv[1][2] * d[2];
  return [vx / view.mm + view.W / 2, view.H / 2 - vy / view.mm];
}
const API = { PALETTES, STYLE, VIEWS, FRAME, cast, stylise, paint, rotView, project };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.SpineRender = API;
})(typeof self !== "undefined" ? self : this);
