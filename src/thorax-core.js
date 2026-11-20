// Thorax core: rib cage (12 rib pairs, costal cartilages, sternum) and both clavicles, built onto the approved spine.
// Units: mm. Character space as in spine-core: x = subject's left, y = up (floor 0), z = anterior.
// Every thorax element keeps a world-aligned local frame (R = identity at rest) with its origin at its proximal
// joint: rib -> head (costovertebral joint), cartilage -> costochondral junction, sternum -> sternal angle,
// clavicle -> sternoclavicular joint. Shapes are swept sections (tubes) along anatomical centrelines.
// Stable IDs: RIB1_L..RIB12_R, CC1_L..CC12_R, STERNUM, CLAV_L, CLAV_R.
(function (root) {
"use strict";
const NODE = typeof module !== "undefined" && module.exports;
const C = NODE ? require("./spine-core.js") : root.SpineCore;
const DEG = Math.PI / 180;

// ---------- vectors ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mir = (p) => [-p[0], p[1], p[2]];

// ---------- parts ----------
const P = { RIB_HEAD: 20, RIB_NECK: 21, RIB_TUBERCLE: 22, RIB_SHAFT: 23, CARTILAGE: 24, MANUBRIUM: 25, STERNAL_BODY: 26,
  XIPHOID: 27, CLAV_STERNAL: 28, CLAV_SHAFT: 29, CLAV_ACROMIAL: 30 };
const PART_NAMES = { 20: "Rib head", 21: "Rib neck", 22: "Rib tubercle", 23: "Rib shaft", 24: "Costal cartilage", 25: "Manubrium",
  26: "Sternal body", 27: "Xiphoid process", 28: "Clavicle, sternal end", 29: "Clavicle, shaft", 30: "Clavicle, acromial end" };
Object.assign(C.PART_NAMES, PART_NAMES);

// ------------------------------------------------------------------------------------------
// 1. Reference data (female, scaled to 183 cm; see README "Rib cage and clavicles" for sources)
// ------------------------------------------------------------------------------------------
// Sternum: female CT means manubrium 46.7, body 86.6 mm (Folia Morphol. 2018) scaled ~1.08 for stature;
// jugular notch at the T2–T3 level (female: T3, Standring), sternal angle at T4–T5, xiphisternal joint at T8–T9.
const STERNUM = { notch: [0, 1492, 37], manubrium: 50, body: 95, xiphoid: 28, manubriumTilt: 28, bodyTilt: 12, xiphoidTilt: -4 };
// rib types (anatomical): true 1–7 (own cartilage to the sternum), false 8–10 (cartilage joins the one above),
// floating 11–12 (free cartilaginous tips)
const TYPE = (n) => (n <= 7 ? "true" : n <= 10 ? "false" : "floating");
// Per rib (left side, world mm): a = lateral half-width of the centreline; ang = rib angle distance lateral to the
// tubercle; back = how far the angle lies behind the tubercle; sec = shaft half height / half thickness;
// twist = rotation of the flat section (rib 1 faces up, rib 2 up-and-out);
// cc = costochondral junction relative to the sternal attachment (true ribs) or absolute (false / floating ribs).
const RIBS = [
  { n: 1, a: 57, ang: 0, back: 0, sec: [7.2, 2.7], twist: 82, cc: [20, -3, -10] },
  { n: 2, a: 81, ang: 12, back: 6, sec: [6.0, 3.0], twist: 38, cc: [27, 2, -9] },
  { n: 3, a: 97, ang: 22, back: 9, sec: [6.3, 3.0], twist: 12, cc: [37, -2, -9] },
  { n: 4, a: 108, ang: 30, back: 11, sec: [6.5, 3.1], twist: 4, cc: [46, -10, -10] },
  { n: 5, a: 117, ang: 36, back: 12, sec: [6.6, 3.1], twist: 0, cc: [57, -19, -13] },
  { n: 6, a: 124, ang: 40, back: 13, sec: [6.6, 3.1], twist: 0, cc: [67, -33, -17] },
  { n: 7, a: 128, ang: 44, back: 13, sec: [6.6, 3.1], twist: 0, cc: [71, -62, -26] },
  { n: 8, a: 131, ang: 48, back: 13, sec: [6.5, 3.1], twist: 0, E: [105, 1262, 37], join: 0.55 },
  { n: 9, a: 132, ang: 50, back: 13, sec: [6.3, 3.1], twist: 0, E: [116, 1229, 19], join: 0.58 },
  { n: 10, a: 130, ang: 50, back: 12, sec: [6.0, 3.0], twist: 0, E: [121, 1197, 1], join: 0.6 },
  { n: 11, a: 124, ang: 46, back: 10, sec: [5.0, 3.0], twist: 0, E: [119, 1196, -32], tip: 14 },
  { n: 12, a: 0, ang: 0, back: 0, sec: [4.3, 2.8], twist: 0, E: [84, 1211, -64], tip: 10 },
];
// Sternal attachment of each true rib's cartilage: position along the sternum (mm from the jugular notch) and the
// direction in which the cartilage enters the sternum (left side).
const STERNAL = { 1: { s: 19, dir: [-1, -0.12, 0.1] }, 2: { s: 50, dir: [-1, 0, 0.1] }, 3: { s: 50 + 0.22 * 95, dir: [-1, 0.05, 0.15] },
  4: { s: 50 + 0.44 * 95, dir: [-1, 0.15, 0.2] }, 5: { s: 50 + 0.64 * 95, dir: [-1, 0.35, 0.25] }, 6: { s: 50 + 0.82 * 95, dir: [-1, 0.65, 0.3] },
  7: { s: 50 + 0.98 * 95, dir: [-0.75, 1, 0.3] } };
// Clavicle (female CT: centreline length 151 ± 8 mm, Bernat et al. 2014; scaled for 183 cm): endpoint length,
// resting orientation relative to the thorax (Ludewig et al. 2009: ~20° retraction, ~6° elevation),
// medial (anterior convex) and lateral (anterior concave) curvature depths 8.6 / 9.1 mm.
const CLAVICLE = { length: 152, retraction: 20, elevation: 6, medialBow: 8.6, lateralBow: 9.1, sc: [27, 1494, 37] };

// ------------------------------------------------------------------------------------------
// 2. Swept-section tube: centreline nodes {p, rn, rb, N (section height axis), part}; elliptic sections
// ------------------------------------------------------------------------------------------
function makeSegs(nodes) {
  const segs = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const A = nodes[i], B = nodes[i + 1], d = sub(B.p, A.p), L = len(d) || 1e-6, u = mul(d, 1 / L);
    const R = L / 2 + Math.max(A.rn, A.rb, B.rn, B.rb) + 0.5;
    segs.push({ a: A.p, u, L, n0: A.N, n1: B.N, rn0: A.rn, rn1: B.rn, rb0: A.rb, rb1: B.rb, p0: A.part, p1: B.part, m: lerp(A.p, B.p, 0.5), R, f0: A.f, f1: B.f });
  }
  return segs;
}
function segD(s, x, y, z) {
  const px = x - s.a[0], py = y - s.a[1], pz = z - s.a[2], u = s.u;
  const h = (px * u[0] + py * u[1] + pz * u[2]) / s.L, hc = h < 0 ? 0 : h > 1 ? 1 : h;
  const qx = px - u[0] * s.L * hc, qy = py - u[1] * s.L * hc, qz = pz - u[2] * s.L * hc, da = (h - hc) * s.L;
  let nx = s.n0[0] + (s.n1[0] - s.n0[0]) * hc, ny = s.n0[1] + (s.n1[1] - s.n0[1]) * hc, nz = s.n0[2] + (s.n1[2] - s.n0[2]) * hc;
  const nd = nx * u[0] + ny * u[1] + nz * u[2]; nx -= nd * u[0]; ny -= nd * u[1]; nz -= nd * u[2];
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const bx = u[1] * nz - u[2] * ny, by = u[2] * nx - u[0] * nz, bz = u[0] * ny - u[1] * nx;
  const rn = s.rn0 + (s.rn1 - s.rn0) * hc, rb = s.rb0 + (s.rb1 - s.rb0) * hc, rm = rn < rb ? rn : rb;
  const dn = (qx * nx + qy * ny + qz * nz) / rn, db = (qx * bx + qy * by + qz * bz) / rb, dd = da / rm;
  return (Math.sqrt(dn * dn + db * db + dd * dd) - 1) * rm;
}
const unionSegs = (segs) => (x, y, z) => {
  let best = 1e9;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], cx = x - s.m[0], cy = y - s.m[1], cz = z - s.m[2];
    if (Math.sqrt(cx * cx + cy * cy + cz * cz) - s.R > best) continue;
    const v = segD(s, x, y, z); if (v < best) best = v;
  }
  return best;
};
function ellPrim(c, r) {
  return (x, y, z) => {
    const qx = (x - c[0]) / r[0], qy = (y - c[1]) / r[1], qz = (z - c[2]) / r[2];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz), k1 = Math.sqrt((qx / r[0]) ** 2 + (qy / r[1]) ** 2 + (qz / r[2]) ** 2);
    return k0 * (k0 - 1) / Math.max(k1, 1e-6);
  };
}
function smin(a, b, k) { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b * (1 - h) + a * h - k * h * (1 - h); }
const boxPts = (pts, pad) => {
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of pts) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], p[i] - pad); b[i + 3] = Math.max(b[i + 3], p[i] + pad); }
  return b;
};
// Shape compiled into chunks: each chunk = a few segments with its own bounding box (the renderer marches only the
// chunks a ray crosses), plus optional extra blobs (rib head) joined smoothly.
function compileTube(nodes, extras, origin, chunkN) {
  const loc = nodes.map((n) => ({ ...n, p: sub(n.p, origin) }));
  const segs = makeSegs(loc), K = chunkN || 7, chunks = [];
  const ex = (extras || []).map((e) => ({ ...e, c: sub(e.c, origin), d: ellPrim(sub(e.c, origin), e.r) }));
  for (let i = 0; i < segs.length; i += K) {
    const ss = segs.slice(i, i + K), pts = [], pad = Math.max(...ss.map((s) => Math.max(s.rn0, s.rn1, s.rb0, s.rb1))) + 1.5;
    for (const s of ss) { pts.push(s.a, add(s.a, mul(s.u, s.L))); }
    const box = boxPts(pts, pad), mine = ex.filter((e) => e.c.every((v, k) => v + e.r[k] + 3 >= box[k] && v - e.r[k] - 3 <= box[k + 3]));
    for (const e of mine) for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], e.c[k] - e.r[k] - 2); box[k + 3] = Math.max(box[k + 3], e.c[k] + e.r[k] + 2); }
    const u = unionSegs(ss);
    const sdf = mine.length ? (x, y, z) => { let d = u(x, y, z); for (const e of mine) d = smin(d, e.d(x, y, z), e.k || 2); return d; } : u;
    chunks.push({ box, sdf });
  }
  const all = unionSegs(segs);
  const sdf = ex.length ? (x, y, z) => { let d = all(x, y, z); for (const e of ex) d = smin(d, e.d(x, y, z), e.k || 2); return d; } : all;
  const partAt = (x, y, z) => {
    for (const e of ex) if (e.d(x, y, z) < 0.6) return e.part;
    let best = 1e9, part = 0;
    for (const s of segs) { const v = segD(s, x, y, z); if (v < best) { best = v; const h = Math.max(0, Math.min(1, dot(sub([x, y, z], s.a), s.u) / s.L)); part = h < 0.5 ? s.p0 : s.p1; } }
    return part;
  };
  const box = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const c of chunks) for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], c.box[k]); box[k + 3] = Math.max(box[k + 3], c.box[k + 3]); }
  return { sdf, partAt, box, chunks, segs };
}


// surface points of a swept tube / an ellipsoid (world), for contact checks
function tubeSurface(nodes, filter, k = 20) {
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (filter && !filter(n, i)) continue;
    const T = nrm(sub(nodes[Math.min(nodes.length - 1, i + 1)].p, nodes[Math.max(0, i - 1)].p));
    const N = nrm(sub(n.N, mul(T, dot(T, n.N)))), B = cross(T, N);
    for (let j = 0; j < k; j++) { const a = (j / k) * 2 * Math.PI; out.push(add(n.p, add(mul(N, n.rn * Math.cos(a)), mul(B, n.rb * Math.sin(a))))); }
  }
  return out;
}
function ellSurface(c, r) { const out = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 20; j++) { const t = (i + 0.5) / 10 * Math.PI, p = j / 20 * 2 * Math.PI; out.push(add(c, [r[0] * Math.sin(t) * Math.cos(p), r[1] * Math.cos(t), r[2] * Math.sin(t) * Math.sin(p)])); } return out; }

// ---------- curves ----------
// centripetal Catmull-Rom through pts, sampled every `step` mm (approximately); returns [{p, t (0..1 by arc)}]
function catmull(pts, step) {
  const P = [add(pts[0], sub(pts[0], pts[1])), ...pts, add(pts[pts.length - 1], sub(pts[pts.length - 1], pts[pts.length - 2]))];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const t0 = 0, t1 = t0 + Math.sqrt(len(sub(p1, p0))) + 1e-6, t2 = t1 + Math.sqrt(len(sub(p2, p1))) + 1e-6, t3 = t2 + Math.sqrt(len(sub(p3, p2))) + 1e-6;
    const n = Math.max(2, Math.ceil(len(sub(p2, p1)) / step));
    for (let k = 0; k < n; k++) {
      const t = t1 + (t2 - t1) * (k / n);
      const A1 = add(mul(p0, (t1 - t) / (t1 - t0)), mul(p1, (t - t0) / (t1 - t0))), A2 = add(mul(p1, (t2 - t) / (t2 - t1)), mul(p2, (t - t1) / (t2 - t1)));
      const A3 = add(mul(p2, (t3 - t) / (t3 - t2)), mul(p3, (t - t2) / (t3 - t2)));
      const B1 = add(mul(A1, (t2 - t) / (t2 - t0)), mul(A2, (t - t0) / (t2 - t0))), B2 = add(mul(A2, (t3 - t) / (t3 - t1)), mul(A3, (t - t1) / (t3 - t1)));
      out.push(add(mul(B1, (t2 - t) / (t2 - t1)), mul(B2, (t - t1) / (t2 - t1))));
    }
  }
  out.push(pts[pts.length - 1].slice());
  let acc = 0; const L = [0];
  for (let i = 1; i < out.length; i++) { acc += len(sub(out[i], out[i - 1])); L.push(acc); }
  return out.map((p, i) => ({ p, t: L[i] / acc, s: L[i] })).map((o, i, a) => ({ ...o, total: acc }));
}
const bez = (P0, P1, P2, P3, t) => { const u = 1 - t; return add(add(mul(P0, u * u * u), mul(P1, 3 * u * u * t)), add(mul(P2, 3 * u * t * t), mul(P3, t * t * t))); };
const bezT = (P0, P1, P2, P3, t) => { const u = 1 - t; return nrm(add(add(mul(sub(P1, P0), 3 * u * u), mul(sub(P2, P1), 6 * u * t)), mul(sub(P3, P2), 3 * t * t))); };
// tangent of a sampled curve at index i
const tanAt = (S, i) => nrm(sub(S[Math.min(S.length - 1, i + 1)].p, S[Math.max(0, i - 1)].p));

// ------------------------------------------------------------------------------------------
// 3. Sternum (one rigid element: manubrium, body, xiphoid; the manubriosternal joint is a symphysis)
// ------------------------------------------------------------------------------------------
function sternumFrame() {
  const st = STERNUM, J = st.notch.slice();
  const dir = (a) => [0, -Math.cos(a * DEG), Math.sin(a * DEG)];
  const m = dir(st.manubriumTilt), b = dir(st.bodyTilt), xd = dir(st.xiphoidTilt);
  const A = add(J, mul(m, st.manubrium)), X = add(A, mul(b, st.body)), Xt = add(X, mul(xd, st.xiphoid));
  // centreline point and anterior normal at distance s below the notch
  const at = (s) => {
    if (s <= st.manubrium) return { p: add(J, mul(m, s)), u: m };
    if (s <= st.manubrium + st.body) return { p: add(A, mul(b, s - st.manubrium)), u: b };
    return { p: add(X, mul(xd, s - st.manubrium - st.body)), u: xd };
  };
  // half-width and half-thickness profile along the sternum (piecewise linear)
  const W = [[0, 25], [8, 25.5], [st.manubrium * 0.55, 21], [st.manubrium - 2, 14.5], [st.manubrium + 2, 13], [st.manubrium + 0.62 * st.body, 16], [st.manubrium + st.body - 3, 11.5],
    [st.manubrium + st.body + 2, 7], [st.manubrium + st.body + st.xiphoid, 2.2]];
  const TH = [[0, 6.2], [st.manubrium, 4.9], [st.manubrium + st.body, 4.0], [st.manubrium + st.body + 2, 2.4], [st.manubrium + st.body + st.xiphoid, 1.5]];
  const pw = (tab, s) => { for (let i = 0; i < tab.length - 1; i++) if (s <= tab[i + 1][0]) { const t = (s - tab[i][0]) / (tab[i + 1][0] - tab[i][0]); return tab[i][1] + (tab[i + 1][1] - tab[i][1]) * Math.max(0, t); } return tab[tab.length - 1][1]; };
  return { J, A, X, Xt, m, b, xd, at, hw: (s) => pw(W, s), ht: (s) => pw(TH, s), total: st.manubrium + st.body + st.xiphoid };
}
// sternum SDF: stack of rounded slabs following the bent centreline, notches subtracted
function compileSternum(SF, origin) {
  const st = STERNUM, cuts = [0, 8, st.manubrium * 0.55, st.manubrium, st.manubrium + 0.62 * st.body, st.manubrium + st.body, st.manubrium + st.body + st.xiphoid];
  const slabs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1], a = sub(SF.at(s0 + 1e-3).p, origin), u = SF.at((s0 + s1) / 2).u, L = s1 - s0;
    const n = nrm(cross([1, 0, 0], u));                       // anterior normal (u points down)
    const part = s1 <= st.manubrium + 1e-6 ? P.MANUBRIUM : s1 <= st.manubrium + st.body + 1e-6 ? P.STERNAL_BODY : P.XIPHOID;
    slabs.push({ a, u, n, L, s0, part, d(x, y, z) {
      const qx = x - a[0], qy = y - a[1], qz = z - a[2], t = qy * u[1] + qz * u[2], zz = qy * n[1] + qz * n[2];
      const tc = Math.max(0, Math.min(L, t)), s = s0 + tc;
      const hw = SF.hw(s), ht = SF.ht(s), r = Math.min(ht * 0.8, 3.2);
      const dx = Math.abs(qx) - hw + r, dz = Math.abs(zz) - ht + r, du = Math.abs(t - L / 2) - L / 2 + r * 0.3;
      return Math.hypot(Math.max(dx, 0), Math.max(dz, 0), Math.max(du, 0)) + Math.min(Math.max(dx, dz, du), 0) - r;
    } });
  }
  const top = sub(SF.J, origin), mn = nrm(cross([1, 0, 0], SF.m));
  const notch = (x, y, z) => { const dx = x - top[0], dy = y - (top[1] + 5.5), dz = (z - top[2]); return Math.hypot(dx, dy) - 9.5 + Math.max(0, Math.abs(dz - mn[2] * 0) - 30); };
  const clav = [-1, 1].map((sg) => ellPrim([top[0] + sg * 23, top[1] + 3.5, top[2] + 0.5], [8.5, 6, 9]));
  const sdf = (x, y, z) => {
    let d = 1e9; for (const s of slabs) d = smin(d, s.d(x, y, z), 2.2);
    d = Math.max(d, -notch(x, y, z), -clav[0](x, y, z), -clav[1](x, y, z));
    return d;
  };
  const partAt = (x, y, z) => { let best = 1e9, p = 0; for (const s of slabs) { const v = s.d(x, y, z); if (v < best) { best = v; p = s.part; } } return p; };
  const pts = []; for (let s = 0; s <= SF.total; s += 4) pts.push(sub(SF.at(s).p, origin));
  const box = boxPts(pts, 28);
  return { sdf, partAt, box };
}

// ------------------------------------------------------------------------------------------
// 4. Build: place every rib onto the spine (contact found against the vertebral SDFs), then sternum,
//    cartilages and clavicles. Returns rest elements plus the anatomical data the rig needs.
// ------------------------------------------------------------------------------------------
function build(spine) {
  const E = Object.fromEntries(spine.els.map((e) => [e.id, e]));
  const compiled = {}, comp = (id) => compiled[id] || (compiled[id] = C.compile(E[id]));
  const sdfW = (id, w) => { const l = C.toLocal(E[id], w); return comp(id).sdf(l[0], l[1], l[2]); };
  const SF = sternumFrame();
  const ribs = [];
  for (const def of RIBS) {
    const n = def.n, T = E["T" + n], v = T.v, prev = n >= 2 && n <= 9 ? "T" + (n - 1) : null, disc = prev ? `D_${prev}_T${n}` : null;
    const near = [T.id, prev, disc].filter(Boolean);
    const clear = (w, r) => { let m = 1e9; for (const id of near) for (const d of DIRS) m = Math.min(m, sdfW(id, add(w, [d[0] * r[0], d[1] * r[1], d[2] * r[2]]))); return m; };
    // --- head: at the disc level for ribs 2–9 (demifacets of two vertebrae), on the own body for 1, 10, 11, 12
    let yh;
    if (disc) yh = C.toLocal(T, E[disc].o)[1];
    else if (n === 1 || n === 10) yh = T.hc / 2 - 4.2;
    else yh = T.hc * 0.12;
    const zh = n >= 11 ? -T.D / 2 + 4 : -T.D / 2 + 0.24 * T.D;
    const rH = n >= 11 ? [4.3, 5.2, 4.6] : n === 1 ? [4.4, 5, 4.8] : [4.5, 6.2, 5.0];
    const gapTo = (id, w, r) => { let m = 1e9; for (const d of DIRS) m = Math.min(m, sdfW(id, add(w, [d[0] * r[0], d[1] * r[1], d[2] * r[2]]))); return m; };
    const seat = (dy) => { let xh = T.W / 2 - 2; while (clear(C.toWorld(T, [xh, yh + dy, zh]), rH) < 0.3 && xh < 60) xh += 0.1; return xh; };
    // ribs 2–9: slide the head along the disc line until it sits evenly in the notch of the two demifacets
    let dyBest = 0, xh = seat(0);
    if (disc) {
      let best = 1e9;
      for (let dy = -3; dy <= 3.01; dy += 0.5) {
        const x = seat(dy), w = C.toWorld(T, [x, yh + dy, zh]), g = Math.max(gapTo(T.id, w, rH), gapTo(prev, w, rH));
        if (g < best) { best = g; dyBest = dy; xh = x; }
      }
    }
    yh += dyBest;
    let H = C.toWorld(T, [xh, yh, zh]);
    // --- tubercle: centreline just in front of the transverse-process tip (costotransverse joint), ribs 1–10
    const tx = v.tp / 2 - 3.5, pw = v.pw, px = v.cw / 2 + pw / 2, pl = Math.max(7, v.cd * 0.5), bz = -T.D / 2 - pl + 1, bx = px + 1.5;
    const tipZ = bz - Math.tan((22 + (v.idx - 5) * 1.2) * DEG) * (tx - bx), tipY = T.hc * 0.18 + 2.5;
    const rK = [def.sec[1] + 0.6, def.sec[0] * 0.75, def.sec[1] + 0.6];
    let K, art = n <= 10;
    let Kb = null;
    if (art) {
      let zk = tipZ; const kx = tx - 0.5, ky = tipY - 2.2;
      while (clear(C.toWorld(T, [kx, ky, zk]), rK) < 1.2 && zk < 40) zk += 0.1;
      K = C.toWorld(T, [kx, ky, zk]);
      // articular tubercle: a knob on the back of the rib, pushed against the front of the transverse-process tip
      const tip = C.toWorld(T, [tx, tipY, tipZ]), dir = nrm(sub(tip, K)), rb = [3.3, 3.2, 3.3];
      Kb = K.slice(); for (let i = 0; i < 80 && clear(add(Kb, mul(dir, 0.1)), rb) >= 0.3; i++) Kb = add(Kb, mul(dir, 0.1));
    } else {
      // floating ribs: no costotransverse joint; the neck runs out and back below the small transverse process
      let kx = xh + 9; const ky = yh - 3, kz = zh - 9;
      while (clear(C.toWorld(T, [kx, ky, kz]), rK) < 1.5 && kx < 60) kx += 0.1;
      K = C.toWorld(T, [kx, ky, kz]);
    }
    // --- shaft key points (world): angle A, lateral L, anterolateral F, costochondral end Ec
    const make = (H, K, Kb) => {
      let Ec, S = null;
      if (n <= 7) { const sa = SF.at(STERNAL[n].s); S = add(sa.p, [SF.hw(STERNAL[n].s) - 2.2, 0, 0]); Ec = add(S, def.cc); }
      else Ec = def.E.slice();
      const pts = [H, K];
      if (n === 12) {
        pts.push(lerp(K, Ec, 0.5).map((v, i) => v + [6, 0, -4][i]), Ec);
      } else {
        const A = def.ang ? [K[0] + def.ang, 0, Math.min(K[2], C.toWorld(T, [tx, tipY, tipZ])[2]) - def.back] : null;
        const z0 = A ? A[2] : K[2];
        const L = [def.a, 0, z0 + 0.47 * (Ec[2] - z0)];
        if (n === 11) { L[2] = z0 + 0.62 * (Ec[2] - z0); }
        const F = [Ec[0] + 0.74 * (def.a - Ec[0]), 0, L[2] + 0.74 * (Ec[2] - L[2])];
        // heights: descend from the tubercle to the end in proportion to the horizontal path length
        const chain = [K, ...(A ? [A] : []), L, ...(n === 11 ? [] : [F]), Ec];
        let acc = 0; const hl = [0];
        for (let i = 1; i < chain.length; i++) { acc += Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][2] - chain[i - 1][2]); hl.push(acc); }
        // lower ribs level out towards their anterior ends (the costal margin turns up into the cartilages)
        const ease = (f) => (n === 1 ? Math.pow(f, 0.7) : n === 2 ? Math.pow(f, 0.85) : n <= 5 ? Math.pow(f, 1.05) : 1 - Math.pow(1 - f, 1.35));
        for (let i = 1; i < chain.length - 1; i++) { const f = hl[i] / acc; chain[i][1] = K[1] + (Ec[1] - K[1]) * ease(f); }
        pts.push(...chain.slice(1));
      }
      // floating ribs: tapering cartilaginous tip beyond the bony end
      const samp = catmull(pts, 3.5);
      const tot = samp[samp.length - 1].s, sH = 0, sK = len(sub(K, H));
      const center = [0, (H[1] + Ec[1]) / 2, (K[2] + (n <= 10 ? Ec[2] : K[2])) / 2 - 10];
      const nodes = samp.map((o, i) => {
        const T0 = tanAt(samp, i), p = o.p, s = o.s;
        let out = nrm([p[0] - center[0], 0, p[2] - center[2]]);
        out = nrm(sub(out, mul(T0, dot(out, T0))));
        let N0 = cross(out, T0); if (N0[1] < 0) N0 = mul(N0, -1);
        // twist: rib 1 broad face up, rib 2 up-and-out; the anterior part of the upper ribs turns flat again
        const tw = def.twist * DEG * (s < sK ? s / sK : 1);
        const N = nrm(add(mul(N0, Math.cos(tw)), mul(out, Math.sin(tw))));
        // section along the rib: head -> neck (narrow) -> tubercle -> shaft (tall, thin) -> slightly taller anterior end
        let rn, rb, part;
        const fK = s / Math.max(sK, 1e-3), fE = (s - sK) / Math.max(tot - sK, 1);
        if (s < sK * 0.35) { rn = 4.6; rb = 4.2; part = P.RIB_HEAD; }
        else if (s < sK) { rn = 3.9 + 0.6 * fK; rb = 3.4; part = P.RIB_NECK; }
        else if (s < sK + 9) { rn = def.sec[0] * 0.78; rb = def.sec[1] + 0.6; part = art ? P.RIB_TUBERCLE : P.RIB_SHAFT; }
        else { const g = Math.min(1, (s - sK - 9) / 30); rn = def.sec[0] * (0.78 + 0.22 * g) * (1 + 0.1 * fE * fE); rb = (def.sec[1] + 0.6 * (1 - g)) * (1 - 0.08 * fE); part = P.RIB_SHAFT; }
        if (n >= 11) { rn *= 1 - 0.45 * Math.max(0, fE - 0.55) / 0.45; rb *= 1 - 0.25 * Math.max(0, fE - 0.55) / 0.45; }
        return { p, rn, rb, N, part, s };
      });
      const endT = tanAt(samp, samp.length - 1), endN = nodes[nodes.length - 1].N;
      const extras = [{ c: H, r: rH, part: P.RIB_HEAD, k: 2.5 }];
      if (art) extras.push({ c: Kb, r: [3.3, 3.2, 3.3], part: P.RIB_TUBERCLE, k: 1.6 });
      return { Ec, S, nodes, endT, endN, extras, tot, sK };
    };
    // --- seat the joints on the true swept surface: tubercle on the transverse process, head in its facet(s)
    const localDir = (v) => sub(C.toWorld(T, v), C.toWorld(T, [0, 0, 0]));
    let Hc = H, Kc = K, Kbc = Kb, R0;
    for (let it = 0; it < 10; it++) {
      R0 = make(Hc, Kc, Kbc);
      const cmp = compileTube(R0.nodes, R0.extras, Hc, 7), on = (p) => cmp.sdf(p[0] - Hc[0], p[1] - Hc[1], p[2] - Hc[2]) > -0.3;
      const hp = [...tubeSurface(R0.nodes, (q) => q.s < R0.sK * 0.55), ...ellSurface(Hc, rH)].filter(on);
      const hg = Math.min(...near.filter((id) => !/^D_/.test(id)).map((id) => Math.min(...hp.map((w) => sdfW(id, w)))));
      let moved = false;
      if (art) {
        const tp = [...tubeSurface(R0.nodes, (q) => q.s > R0.sK - 6 && q.s < R0.sK + 12), ...ellSurface(Kbc, [3.3, 3.2, 3.3])].filter(on);
        const tg = Math.min(...tp.map((w) => sdfW(T.id, w)));
        if (tg < 0.15) { const d = mul(localDir([0, 0, 1]), 0.2 - tg); Kc = add(Kc, d); Kbc = add(Kbc, d); moved = true; }
      }
      if (hg > 0.7 || hg < 0.1) { Hc = add(Hc, mul(localDir([1, 0, 0]), -0.6 * (hg - 0.35))); moved = true; }
      if (!moved) break;
    }
    const { Ec, S, nodes, endT, endN, extras, tot } = R0;
    H = Hc; K = Kc;
    ribs.push({ n, type: TYPE(n), def, H, K, Ec, S, nodes, endT, endN, extras, axis: nrm(sub(K, H)), tot, art, vertebra: T.id, upper: prev });
  }
  // --- elements: ribs (left, right), sternum, cartilages, clavicles
  const els = [];
  const mirNode = (o) => ({ ...o, p: mir(o.p), N: mir(o.N) });
  const ribEl = {};
  for (const side of ["L", "R"]) for (const r of ribs) {
    const m = side === "L" ? (p) => p : mir;
    const el = { kind: "rib", id: `RIB${r.n}_${side}`, name: `Rib ${r.n} ${side === "L" ? "left" : "right"} (${r.type})`, region: "ribcage", side, n: r.n, type: r.type,
      psi: 0, o: m(r.H), vertebra: r.vertebra, upper: r.upper,
      geo: { nodes: side === "L" ? r.nodes : r.nodes.map(mirNode), extras: r.extras.map((e) => ({ ...e, c: m(e.c) })) },
      joint: { head: m(r.H), tubercle: m(r.K), axis: side === "L" ? r.axis : mir(r.axis), costotransverse: r.art },
      end: { p: m(r.Ec), t: side === "L" ? r.endT : mir(r.endT), N: side === "L" ? r.endN : mir(r.endN), rn: r.nodes[r.nodes.length - 1].rn, rb: r.nodes[r.nodes.length - 1].rb } };
    els.push(el); ribEl[el.id] = el;
  }
  const stO = SF.A.slice();
  const sternum = { kind: "sternum", id: "STERNUM", name: "Sternum (manubrium, body, xiphoid)", region: "sternum", psi: 0, o: stO, SF,
    landmarks: { jugularNotch: SF.J, sternalAngle: SF.A, xiphisternal: SF.X, xiphoidTip: SF.Xt } };
  els.push(sternum);
  // cartilages: the sternal (or upper-cartilage) end is attached; geometry is rebuilt from the posed ends
  const ccDefs = [];
  for (const side of ["L", "R"]) for (const r of ribs) {
    const m = side === "L" ? (p) => p : mir, rib = ribEl[`RIB${r.n}_${side}`];
    const cd = { id: `CC${r.n}_${side}`, n: r.n, side, rib: rib.id, type: r.type };
    if (r.n <= 7) { cd.to = "STERNUM"; cd.S = m(r.S); cd.Sdir = side === "L" ? nrm(STERNAL[r.n].dir) : mir(nrm(STERNAL[r.n].dir)); }
    else if (r.n <= 10) { cd.to = `CC${r.n - 1}_${side}`; cd.u = r.def.join; }
    else { cd.to = null; cd.tip = r.def.tip; }
    ccDefs.push(cd);
  }
  const rest = { ribs: Object.fromEntries(els.filter((e) => e.kind === "rib").map((e) => [e.id, { R: I3(), t: [0, 0, 0] }])), sternum: { R: I3(), t: [0, 0, 0] } };
  const cgeo = cartilageGeometry(ribEl, ccDefs, rest);
  for (const cd of ccDefs) cd.arc = cgeo[cd.id].arc;         // rest arc length: preserved in every pose
  for (const cd of ccDefs) {
    const g = cgeo[cd.id];
    els.push({ kind: "cartilage", id: cd.id, name: `Costal cartilage ${cd.n} ${cd.side === "L" ? "left" : "right"}`, region: "cartilage", side: cd.side, n: cd.n, type: cd.type,
      psi: 0, o: g.nodes[0].p.slice(), def: cd, geo: g, restLen: g.chord, restArc: g.arc, restVec: g.vec });
  }
  // clavicles
  const stComp = compileSternum(SF, stO);
  const stD = (w) => stComp.sdf(w[0] - stO[0], w[1] - stO[1], w[2] - stO[2]);
  // seat: ~2 mm sternoclavicular joint space (articular cartilage and disc) and an open costoclavicular space above
  // the first rib and its cartilage (subclavian vessels pass between them)
  const r1 = ribs[0], r1c = compileTube(r1.nodes, r1.extras, r1.H, 7), c1 = cgeo["CC1_L"], c1c = compileTube(c1.nodes, [], c1.nodes[0].p, 50);
  const below = (w) => Math.min(r1c.sdf(...sub(w, r1.H)), c1c.sdf(...sub(w, c1.nodes[0].p)));
  let lift = -12;
  for (; lift < 25; lift += 0.25) {
    const g = clavicleGeometry("L", lift), pts = tubeSurface(g.nodes), q = Math.round(g.nodes.length * 0.25) * 20;
    let m = 1e9, b = 1e9, bl = 1e9; for (const w of pts.slice(0, 14 * 20)) m = Math.min(m, stD(w));
    pts.forEach((w, i) => { const d = below(w); if (i < q) b = Math.min(b, d); else bl = Math.min(bl, d); });
    if (m >= 2.0 && b >= 1.0 && bl >= 5) break;      // sternal end on the notch and first cartilage; open space laterally
  }
  // sternoclavicular pivot: on the articular surface (closest point to the notch), a little inside the bone
  let pivot = null; {
    const g = clavicleGeometry("L", lift); let best = 1e9;
    g.nodes.slice(0, 14).forEach((nd) => { for (const w of tubeSurface([nd, nd])) { const d = stD(w); if (d < best) { best = d; pivot = add(w, mul(nrm(sub(nd.p, w)), PIVOT_DEPTH)); } } });
  }
  for (const side of ["L", "R"]) {
    const g = clavicleGeometry(side, lift);
    els.push({ kind: "clavicle", id: `CLAV_${side}`, name: `Clavicle ${side === "L" ? "left" : "right"}`, region: "clavicle", side, psi: 0, o: g.sc.slice(), geo: g,
      joint: { sc: g.sc, pivot: side === "L" ? pivot : mir(pivot), acromial: g.ac, axis: g.axis } });
  }
  return { els, ribs, SF, ccDefs };
}
const PIVOT_DEPTH = 3;
const DIRS = (() => { const d = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) d.push(nrm([x, y, z])); return d; })();
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mv = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const app = (T, p) => add(mv(T.R, p), T.t);

// Cartilage tubes from rib ends (moved by `pose.ribs[id]`) to the sternum (moved by `pose.sternum`) or to the
// cartilage above (false ribs). Each is a cubic Bezier leaving the rib along its end tangent and entering the
// sternum along the notch direction, so it bends rather than stretches when its two ends move.
function cartilageGeometry(ribEl, ccDefs, pose, lean) {
  const out = {};
  for (const cd of ccDefs) {
    const rib = ribEl[cd.rib], T = pose.ribs[rib.id], H0 = rib.o;
    // rib transforms act about the world origin on rest world points
    const E = app(T, rib.end.p), tE = mv(T.R, rib.end.t), NE = mv(T.R, rib.end.N);
    let S, tS, NS, rnS, rbS;
    if (cd.to === "STERNUM") { S = app(pose.sternum, cd.S); tS = mv(pose.sternum.R, cd.Sdir); NS = mv(pose.sternum.R, [0, 1, 0]); rnS = cd.n === 1 ? 6.2 : 5.0; rbS = 3.6; }
    else if (cd.to) {
      const up = out[cd.to], k = up.curve;
      S = bez(k[0], k[1], k[2], k[3], cd.u); const tu = bezT(k[0], k[1], k[2], k[3], cd.u);
      // enter the upper cartilage from below and slightly behind
      tS = nrm(add(mul(tu, -0.35), mv(pose.sternum.R, [0, 0.9, 0.12])));
      S = add(S, mul(mv(pose.sternum.R, [0, 1, 0]), -2.5));
      NS = mv(pose.sternum.R, [0, 0, 1]); rnS = 5.0; rbS = 3.6;
    } else {
      S = add(E, mul(tE, cd.tip)); tS = tE; NS = NE; rnS = 1.6; rbS = 1.4;
    }
    const L = len(sub(S, E)), ch = nrm(sub(S, E));
    // leave the rib between its own direction and the chord (cartilage bends, never loops back)
    const tE2 = cd.to ? nrm(add(tE, mul(ch, cd.n >= 8 ? 2.2 : 0.8))) : tE;
    const tS2 = cd.to && cd.n >= 8 ? nrm(add(tS, mul(ch, 1.2))) : tS;
    const a1 = cd.to ? (cd.n >= 8 ? 0.28 : 0.36) : 0.33, a2 = cd.to ? 0.34 : 0.33;
    const curveOf = (h) => [E, add(E, mul(tE2, a1 * h * L)), sub(S, mul(tS2, a2 * h * L)), S];
    const arcOf = (k) => { let a = 0, q = k[0]; for (let i = 1; i <= 16; i++) { const p = bez(k[0], k[1], k[2], k[3], i / 16); a += len(sub(p, q)); q = p; } return a; };
    // cartilage is flexible but nearly inextensible: keep its rest arc length by bending (handle length), not stretching
    let h = 1;
    if (cd.arc && cd.to) {
      let lo = 0.02, hi = 2.5;
      if (arcOf(curveOf(lo)) >= cd.arc) h = lo;
      else if (arcOf(curveOf(hi)) <= cd.arc) h = hi;
      else { for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (arcOf(curveOf(m)) < cd.arc) lo = m; else hi = m; } h = (lo + hi) / 2; }
    }
    const [P0, P1, P2, P3] = curveOf(h), arc = arcOf([P0, P1, P2, P3]);
    if (lean) { out[cd.id] = { curve: [P0, P1, P2, P3], chord: L, arc, vec: sub(S, E), S, E }; continue; }
    const nodes = [], n = Math.max(6, Math.ceil(L / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = bez(P0, P1, P2, P3, t), N = nrm(lerp(NE, NS, t));
      const rn = rib.end.rn + (rnS - rib.end.rn) * t, rb = rib.end.rb + 0.5 + (rbS - rib.end.rb - 0.5) * t;
      nodes.push({ p, rn: Math.max(rn, 1), rb: Math.max(rb, 1), N, part: P.CARTILAGE });
    }
    // pull the first node slightly into the rib so the costochondral junction is closed
    nodes[0] = { ...nodes[0], p: sub(nodes[0].p, mul(tE, 1.5)) };
    out[cd.id] = { nodes, curve: [P0, P1, P2, P3], chord: L, arc, bend: h, vec: sub(S, E), S, E };
  }
  return out;
}

function clavicleGeometry(side, lift = 0) {
  const c = CLAVICLE, sg = side === "L" ? 1 : -1;
  const sc = [sg * (c.sc[0] + lift * 0.6), c.sc[1] + lift * 0.8, c.sc[2]];
  const d = nrm([sg * Math.cos(c.elevation * DEG) * Math.cos(c.retraction * DEG), Math.sin(c.elevation * DEG), -Math.cos(c.elevation * DEG) * Math.sin(c.retraction * DEG)]);
  const fwd = nrm(cross(d, [0, sg, 0]).map((v) => v * -1));     // horizontal, anterior side of the chord
  const fw = fwd[2] < 0 ? mul(fwd, -1) : fwd;
  // S-curve: medial two-thirds convex forward, lateral third concave forward; slight superior arch
  const bow = [[0, 0], [0.12, 0.55], [0.3, 1], [0.47, 0.6], [0.62, 0], [0.78, -0.75], [0.9, -1], [1, -0.55]];
  const pts = bow.map(([t, b]) => add(add(sc, mul(d, t * c.length)), add(mul(fw, b * (b > 0 ? c.medialBow : c.lateralBow)), [0, 3.5 * Math.sin(Math.PI * t), 0])));
  const samp = catmull(pts, 3);
  const nodes = samp.map((o, i) => {
    const T0 = tanAt(samp, i), t = o.t;
    let N = sub([0, 1, 0], mul(T0, T0[1])); N = nrm(N);
    // sections: bulky prismatic sternal end, rounded shaft, flattened acromial end
    const prof = [[0, 10.5, 11.5], [0.1, 8.2, 8.8], [0.25, 6.4, 6.6], [0.5, 5.8, 6.0], [0.7, 5.6, 7.2], [0.88, 5.2, 10.4], [1, 5.0, 10.8]];
    let k = 0; while (k < prof.length - 2 && t > prof[k + 1][0]) k++;
    const f = (t - prof[k][0]) / (prof[k + 1][0] - prof[k][0]);
    const rn = prof[k][1] + (prof[k + 1][1] - prof[k][1]) * f, rb = prof[k][2] + (prof[k + 1][2] - prof[k][2]) * f;
    return { p: o.p, rn, rb, N, part: t < 0.16 ? P.CLAV_STERNAL : t > 0.8 ? P.CLAV_ACROMIAL : P.CLAV_SHAFT };
  });
  return { nodes, sc, ac: samp[samp.length - 1].p, axis: d, length: samp[samp.length - 1].s, endpoint: len(sub(samp[samp.length - 1].p, sc)) };
}

// ---------- compile (called by SpineCore.compile for these kinds) ----------
function compile(el) {
  if (el.kind === "sternum") return compileSternum(el.SF, el.o);
  const g = el.geo;
  return compileTube(g.nodes, g.extras, el.o, el.kind === "cartilage" ? 50 : 7);
}
C.registerKind && ["rib", "cartilage", "sternum", "clavicle"].forEach((k) => C.registerKind(k, compile));

const API = { tubeSurface, ellSurface, P, PART_NAMES, RIBS, STERNUM, STERNAL, CLAVICLE, TYPE, build, compile, cartilageGeometry, clavicleGeometry, sternumFrame, catmull, bez, bezT };
if (NODE) module.exports = API;
else root.ThoraxCore = API;
})(typeof self !== "undefined" ? self : this);
