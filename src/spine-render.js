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
// Returns SPARSE geometry: only covered subsamples, in row-major order of their subsample index `idx`.
// Buffers cover just the union of the elements' screen rectangles, so a large frame costs little memory.
function cast(model, view, onProgress, only) {
  const { mm, W, H, ss } = view, SW = W * ss, SH = H * ss;
  const Rv = rotView(view.yaw, view.pitch || 0);
  const Z0 = 3000, e = 0.1, jobs = [];
  let U0 = 1e9, U1 = -1e9, V0 = 1e9, V1 = -1e9;
  // `only`: element indices, or [index, from, to] to cast just a horizontal band (fractions of the element's rows), so a
  // heavy bone can be shared between workers
  const sel = only ? only.map((o) => (Array.isArray(o) ? o : [o, 0, 1])) : model.els.map((_, k) => [k, 0, 1]);
  sel.forEach(([k, bandA, bandB]) => {
    const el = model.els[k]; if (!el) return;
    const comp = model.comps[k], b = comp.box, M = mul(Rv, el.R || rotX(el.psi));
    const d0 = [el.o[0] - view.pivot[0], el.o[1] - view.pivot[1], el.o[2] - view.pivot[2]];
    const Ov = [0, 1, 2].map((i) => Rv[i][0] * d0[0] + Rv[i][1] * d0[1] + Rv[i][2] * d0[2]);
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
    for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
      const vx = Ov[0] + M[0][0] * x + M[0][1] * y + M[0][2] * z, vy = Ov[1] + M[1][0] * x + M[1][1] * y + M[1][2] * z;
      const si = (vx / mm + W / 2) * ss, sj = (H / 2 - vy / mm) * ss;
      i0 = Math.min(i0, si); i1 = Math.max(i1, si); j0 = Math.min(j0, sj); j1 = Math.max(j1, sj);
    }
    i0 = Math.max(0, Math.floor(i0)); i1 = Math.min(SW - 1, Math.ceil(i1)); j0 = Math.max(0, Math.floor(j0)); j1 = Math.min(SH - 1, Math.ceil(j1));
    if (bandA > 0 || bandB < 1) { const nj = j1 - j0 + 1, a = j0 + Math.floor(nj * bandA), z = j0 + Math.floor(nj * bandB) - 1; j0 = a; j1 = z; }
    if (i0 > i1 || j0 > j1) return;
    jobs.push({ k, el, comp, M, Ov, i0, i1, j0, j1 });
    U0 = Math.min(U0, i0); U1 = Math.max(U1, i1); V0 = Math.min(V0, j0); V1 = Math.max(V1, j1);
  });
  const empty = () => ({ W, H, ss, idx: new Uint32Array(0), depth: new Float32Array(0), nx: new Float32Array(0), ny: new Float32Array(0), nz: new Float32Array(0), ao: new Float32Array(0), part: new Uint8Array(0), obj: new Uint8Array(0) });
  if (!jobs.length) return empty();
  const UW = U1 - U0 + 1, UN = UW * (V1 - V0 + 1);
  const zb = new Float32Array(UN).fill(Infinity), slot = new Int32Array(UN).fill(-1);
  let cap = 1 << 15, n = 0;
  let hT = new Float32Array(cap), hN = new Float32Array(cap * 3), hA = new Float32Array(cap), hK = new Uint8Array(cap), hL = new Float32Array(cap * 3);
  const grow = () => { cap *= 2; const g = (A, m) => { const B = new A.constructor(cap * m); B.set(A); return B; }; hT = g(hT, 1); hN = g(hN, 3); hA = g(hA, 1); hK = g(hK, 1); hL = g(hL, 3); };
  jobs.forEach((J, q) => {
    const { k, comp, M, Ov, i0, i1, j0, j1 } = J, sdf = comp.sdf, b = comp.box, chunks = comp.chunks || null;
    const ldx = -M[2][0], ldy = -M[2][1], ldz = -M[2][2];          // ray direction in local space
    for (let j = j0; j <= j1; j++) {
      const vy = (H / 2 - (j + 0.5) / ss) * mm;
      for (let i = i0; i <= i1; i++) {
        const vx = ((i + 0.5) / ss - W / 2) * mm;
        const qx = vx - Ov[0], qy = vy - Ov[1], qz = Z0 - Ov[2];
        const ox = M[0][0] * qx + M[1][0] * qy + M[2][0] * qz, oy = M[0][1] * qx + M[1][1] * qy + M[2][1] * qz, oz = M[0][2] * qx + M[1][2] * qy + M[2][2] * qz;
        let t0 = 0, t1 = 1e9, ok = true;                              // slab test against the local bounding box
        for (const [o, d, lo, hi] of [[ox, ldx, b[0], b[3]], [oy, ldy, b[1], b[4]], [oz, ldz, b[2], b[5]]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
          let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
          if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
        }
        if (!ok) continue;
        const u = (j - V0) * UW + (i - U0);
        if (t0 >= zb[u]) continue;
        let t = t0, hit = false;
        if (chunks) {
          // long thin shapes (ribs, clavicles): march only the chunks this ray crosses, nearest hit wins
          let best = zb[u];
          for (let c = 0; c < chunks.length; c++) {
            const cb = chunks[c].box; let a0 = t0, a1 = t1, ok2 = true;
            for (let ax = 0; ax < 3 && ok2; ax++) {
              const o = ax === 0 ? ox : ax === 1 ? oy : oz, d = ax === 0 ? ldx : ax === 1 ? ldy : ldz;
              if (Math.abs(d) < 1e-9) { if (o < cb[ax] || o > cb[ax + 3]) ok2 = false; continue; }
              let ta = (cb[ax] - o) / d, tb = (cb[ax + 3] - o) / d; if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
              if (ta > a0) a0 = ta; if (tb < a1) a1 = tb; if (a0 > a1) ok2 = false;
            }
            if (!ok2 || a0 >= best) continue;
            const cs = chunks[c].sdf; let tt = a0;
            for (let s = 0; s < 160 && tt < a1 && tt < best; s++) {
              const d = cs(ox + ldx * tt, oy + ldy * tt, oz + ldz * tt);
              if (d < 0.04) { best = tt; hit = true; break; }
              tt += Math.max(d * 0.9, 0.02);
            }
          }
          t = best;
        } else for (let s = 0; s < 200 && t < t1; s++) {
          const d = sdf(ox + ldx * t, oy + ldy * t, oz + ldz * t);
          if (d < 0.04) { hit = true; break; }
          t += Math.max(d * 0.9, 0.02);
        }
        if (!hit || t >= zb[u]) continue;
        const x = ox + ldx * t, y = oy + ldy * t, z = oz + ldz * t;
        const a1 = sdf(x + e, y - e, z - e), a2 = sdf(x - e, y - e, z + e), a3 = sdf(x - e, y + e, z - e), a4 = sdf(x + e, y + e, z + e);
        let gx = a1 - a2 - a3 + a4, gy = -a1 - a2 + a3 + a4, gz = -a1 + a2 - a3 + a4;
        const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
        let occ = 0, wgt = 1;
        for (const dd of [0.8, 1.8, 3.2]) { occ += (dd - Math.min(sdf(x + gx * dd, y + gy * dd, z + gz * dd), dd)) / dd * wgt; wgt *= 0.6; }
        let sl = slot[u]; if (sl < 0) { if (n === cap) grow(); sl = n++; slot[u] = sl; }
        zb[u] = t; hT[sl] = t;
        hN[sl * 3] = M[0][0] * gx + M[0][1] * gy + M[0][2] * gz; hN[sl * 3 + 1] = M[1][0] * gx + M[1][1] * gy + M[1][2] * gz; hN[sl * 3 + 2] = M[2][0] * gx + M[2][1] * gy + M[2][2] * gz;
        hA[sl] = Math.max(0, Math.min(1, 1 - 0.75 * occ)); hK[sl] = k + 1; hL[sl * 3] = x; hL[sl * 3 + 1] = y; hL[sl * 3 + 2] = z;
      }
    }
    if (onProgress) onProgress((q + 1) / jobs.length);
  });
  // compact, in subsample-index order
  const g = empty(); const m = n;
  g.idx = new Uint32Array(m); g.depth = new Float32Array(m); g.nx = new Float32Array(m); g.ny = new Float32Array(m); g.nz = new Float32Array(m); g.ao = new Float32Array(m); g.part = new Uint8Array(m); g.obj = new Uint8Array(m);
  let q = 0;
  for (let u = 0; u < UN; u++) {
    const sl = slot[u]; if (sl < 0) continue;
    const vj = (u / UW) | 0, ui = u - vj * UW;
    g.idx[q] = (V0 + vj) * SW + (U0 + ui); g.depth[q] = hT[sl]; g.nx[q] = hN[sl * 3]; g.ny[q] = hN[sl * 3 + 1]; g.nz[q] = hN[sl * 3 + 2]; g.ao[q] = hA[sl];
    const k = hK[sl] - 1; g.obj[q] = k + 1; g.part[q] = model.comps[k].partAt(hL[sl * 3], hL[sl * 3 + 1], hL[sl * 3 + 2]);
    q++;
  }
  return g;
}
// Merge sparse geometries of disjoint element sets (nearest surface wins per subsample)
function merge(parts) {
  let a = parts[0];
  for (let p = 1; p < parts.length; p++) {
    const b = parts[p], n = a.idx.length + b.idx.length, o = { W: a.W, H: a.H, ss: a.ss };
    for (const k of ["idx", "depth", "nx", "ny", "nz", "ao", "part", "obj"]) o[k] = new a[k].constructor(n);
    let i = 0, j = 0, q = 0;
    const take = (s, x) => { for (const k of ["idx", "depth", "nx", "ny", "nz", "ao", "part", "obj"]) o[k][q] = s[k][x]; q++; };
    while (i < a.idx.length || j < b.idx.length) {
      if (j >= b.idx.length || (i < a.idx.length && a.idx[i] < b.idx[j])) take(a, i++);
      else if (i >= a.idx.length || b.idx[j] < a.idx[i]) take(b, j++);
      else { if (a.depth[i] <= b.depth[j]) take(a, i); else take(b, j); i++; j++; }
    }
    for (const k of ["idx", "depth", "nx", "ny", "nz", "ao", "part", "obj"]) o[k] = o[k].subarray(0, q);
    a = o;
  }
  return a;
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
  for (let q = 0; q < g.idx.length; q++) {
    const sidx = g.idx[q], j = (sidx / SW) | 0, i = sidx - j * SW, idx = q;
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
  // no stray pixels: a covered pixel needs at least one covered neighbour (8-connected)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (!cover[p]) continue; let nb = 0;
    for (let dy = -1; dy <= 1 && !nb; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(cover, x + dx, y + dy, 0)) { nb = 1; break; }
    if (!nb) { cover[p] = 0; tone[p] = -1; }
  }
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
  // separate bones that touch without a depth jump (clavicle on the manubrium, rib head on its vertebra): a joint line,
  // drawn on the farther of the two. Applies to skeletal elements added after the spine; spine-only pairs are unchanged.
  const THX = { rib: 1, sternum: 1, clavicle: 1, scapula: 1, hip: 1, hyoid: 1 }, SOFT = { cartilage: 1, disc: 1, joint: 1 };
  const joint = (p, q) => { const a = model.els[objOf[p] - 1], b = model.els[objOf[q] - 1];
    return a && b && a !== b && (THX[a.kind] || THX[b.kind]) && !SOFT[a.kind] && !SOFT[b.kind] && depth[q] <= depth[p]; };
  let lab = new Uint8Array(n);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (!cover[p]) continue;
    lab[p] = tone[p] + 2;
    let edge = false, inner = false;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!at(cover, x + dx, y + dy, 0)) edge = true;
      else if (at(depth, x + dx, y + dy, 0) - depth[p] > st.gap) inner = true;
      else if (objOf[p + dy * W + dx] !== objOf[p] && joint(p, p + dy * W + dx)) inner = true;
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
    const pal = el && (el.kind === "disc" || el.kind === "cartilage" || el.kind === "joint") ? pals.disc : pals.bone;   // cartilage tissue: disc ramp
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
const FRAME = { W: 1040, H: 1040, mm: 1, pivot: [0, 1302, -25] };   // room for the full range of motion at a constant scale

function project(p, view) {
  const Rv = rotView(view.yaw, view.pitch || 0), d = [p[0] - view.pivot[0], p[1] - view.pivot[1], p[2] - view.pivot[2]];
  const vx = Rv[0][0] * d[0] + Rv[0][1] * d[1] + Rv[0][2] * d[2], vy = Rv[1][0] * d[0] + Rv[1][1] * d[1] + Rv[1][2] * d[2];
  return [vx / view.mm + view.W / 2, view.H / 2 - vy / view.mm];
}
const API = { PALETTES, STYLE, VIEWS, FRAME, cast, merge, stylise, paint, rotView, project };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.SpineRender = API;
})(typeof self !== "undefined" ? self : this);
