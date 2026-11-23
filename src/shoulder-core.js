// Shoulder core: both scapulae, placed on the approved thorax and joined to the clavicles at the acromioclavicular joint.
// Units: mm. Character space as everywhere: x = subject's left, y = up (floor 0), z = anterior.
// Each scapula has its own local frame (u lateral along the spine of the scapula, v up in the scapular plane,
// w anterior = toward the ribs), origin at the acromioclavicular (AC) joint centre. Rest orientation R maps local to
// world. The right scapula is the exact mirror of the left. Stable IDs: SCAP_L, SCAP_R.
(function (root) {
"use strict";
const NODE = typeof module !== "undefined" && module.exports;
const C = NODE ? require("./spine-core.js") : root.SpineCore;
const Th = NODE ? require("./thorax-core.js") : root.ThoraxCore;
const DEG = Math.PI / 180;

// ---------- vectors / matrices ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const rotA = (k, a) => { const c = Math.cos(a), s = Math.sin(a), v = 1 - c, [x, y, z] = k;
  return [[c + x * x * v, x * y * v - z * s, x * z * v + y * s], [y * x * v + z * s, c + y * y * v, y * z * v - x * s], [z * x * v - y * s, z * y * v + x * s, c + z * z * v]]; };
const rx = (a) => rotA([1, 0, 0], a), ry = (a) => rotA([0, 1, 0], a), rz = (a) => rotA([0, 0, 1], a);
const MIR = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];

// ---------- parts (continue the skeleton's numbering) ----------
const P = { SUBSCAPULAR: 31, SUPRASPINOUS: 32, INFRASPINOUS: 33, SPINE: 34, ACROMION: 35, CORACOID: 36, GLENOID: 37,
  MEDIAL_BORDER: 38, LATERAL_BORDER: 39, SUPERIOR_BORDER: 40, SUPERIOR_ANGLE: 41, INFERIOR_ANGLE: 42 };
Object.assign(C.PART_NAMES, { 31: "Subscapular fossa (anterior, costal surface)", 32: "Supraspinous fossa (posterior surface)", 33: "Infraspinous fossa (posterior surface)",
  34: "Spine of scapula", 35: "Acromion", 36: "Coracoid process", 37: "Glenoid cavity", 38: "Medial border", 39: "Lateral border", 40: "Superior border",
  41: "Superior angle", 42: "Inferior angle" });

// ------------------------------------------------------------------------------------------
// 1. Reference data. Female adult scapulae (dry bone / CT), scaled toward 183 cm:
//    superior-to-inferior angle 140.6 mm (female mean, Folia Morphol 2008) → 148 mm here;
//    width (medial border at the spine root to the glenoid) ≈ 95 mm (Turkish CT 2025: 95.1 ± 8.1);
//    spine of scapula to the acromion tip ≈ 128–134 mm; acromion ≈ 44 × 23 × 8 mm; coracoid ≈ 41 mm;
//    glenoid 34.8 × 26.2 mm (female, BMC MSD 2017) → 36 × 27 mm, inclination ≈ 12° up, version ≈ −1°;
//    inferior angle ≈ 41°, superior angle ≈ 84°.
//    Resting orientation on the thorax ≈ 35–41° internal rotation, a few degrees of upward rotation, ≈ 10° anterior
//    tilt (Ludewig et al.; PLoS One 2019 summary). Superior angle at about T2, inferior angle at the T7 spinous process
//    (≈ T8 body), medial border 5–7.5 cm from the spinous processes.
// ------------------------------------------------------------------------------------------
// Landmarks of the LEFT scapula in a construction frame: origin at the trigonum spinae (TS, root of the spine on the
// medial border); u lateral, v up, wp POSTERIOR (converted to w = −wp, anterior, below).
const WIDTH = 1.1;                                   // construction coordinates below are scaled laterally to the female width for 183 cm
const L3 = (u, v, wp) => [u * WIDTH, v, -wp];
const LM = {
  TS: L3(0, 0, 0), SA: L3(7, 46, 0), AI: L3(12, -102, 0),
  notch: L3(58, 36, 0), corBase: L3(75, 31, -3), corKnee: L3(79, 45, -9), corTip: L3(91, 45, -40),
  LAtop: L3(83, 22, -1), IGT: L3(85, -11, -2), GF: L3(93, 9, -4),
  AA: L3(102, 31, 22), acTip: L3(106, 57, -24), facet: L3(94, 52, -15),
};
const SCAP = { height: 148, gapTarget: 10, restIR: 35, restUR: 4, restTilt: 10, glenoid: { h: 36, w: 27, depth: 2.6, incl: 12, version: -1 } };

// ---------- primitives (construction frame) ----------
function udTri(p, a, b, c) {      // unsigned distance to a triangle (Inigo Quilez)
  const ba = sub(b, a), pa = sub(p, a), cb = sub(c, b), pb = sub(p, b), ac = sub(a, c), pc = sub(p, c), n = cross(ba, ac);
  const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), d2 = (v) => dot(v, v), cl = (x) => Math.max(0, Math.min(1, x));
  if (sgn(dot(cross(ba, n), pa)) + sgn(dot(cross(cb, n), pb)) + sgn(dot(cross(ac, n), pc)) < 2)
    return Math.sqrt(Math.min(d2(sub(mul(ba, cl(dot(ba, pa) / d2(ba))), pa)), d2(sub(mul(cb, cl(dot(cb, pb) / d2(cb))), pb)), d2(sub(mul(ac, cl(dot(ac, pc) / d2(ac))), pc))));
  return Math.sqrt(dot(n, pa) * dot(n, pa) / d2(n));
}
let GROUP = 0;
function plate(fan, ring, half, part) {    // triangle fan with thickness (blade, spine fin, acromion): one primitive per triangle
  const g = ++GROUP, out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const t = [fan, ring[i], ring[i + 1]], c = mul(add(add(t[0], t[1]), t[2]), 1 / 3);
    let n = nrm(cross(sub(t[1], t[0]), sub(t[2], t[0]))); if (n[2] < 0) n = mul(n, -1);      // normal toward +w (anterior)
    out.push({ c, R: Math.max(...t.map((p) => len(sub(p, c)))) + half + 1, part, group: g, t, n, half,
      d(p) { return udTri(p, t[0], t[1], t[2]) - half; }, side(p) { return dot(sub(p, t[0]), n); } });
  }
  return out;
}
// The blade: a smooth slab over the outline polygon (u, v). Its mid-surface bulges a little posteriorly over the
// infraspinous fossa and dips into the supraspinous fossa, so the posterior surface catches the light like bone.
function bladePrim(outline, half) {
  const poly = outline.map((p) => [p[0], p[1]]), n = poly.length;
  // w of the mid-surface (w = anterior): the infraspinous and supraspinous fossae are shallow dishes on the posterior
  // surface; the whole blade curves gently forward toward its lateral part, following the rib cage
  const mid = (u, v) => 6.5 * Math.exp(-(((u - 48) / 26) ** 2) - (((v + 30) / 30) ** 2)) + 5.5 * Math.exp(-(((u - 38) / 20) ** 2) - (((v - 28) / 10) ** 2))
    - 3.5 * Math.exp(-(((u - 30) / 22) ** 2) - (((v + 85) / 18) ** 2)) + 0.00055 * (u - 20) * (u - 20);
  const d2 = (u, v) => {
    let d = 1e9, sgn = 1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = poly[j], b = poly[i], ex = b[0] - a[0], ey = b[1] - a[1], wx = u - a[0], wy = v - a[1];
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey))), dx = wx - ex * t, dy = wy - ey * t;
      d = Math.min(d, dx * dx + dy * dy);
      const c1 = v >= a[1], c2 = v < b[1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sgn = -sgn;
    }
    return sgn * Math.sqrt(d);
  };
  const c = [poly.reduce((a, p) => a + p[0], 0) / n, poly.reduce((a, p) => a + p[1], 0) / n, 0];
  return { c, R: Math.max(...poly.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) + 8, part: P.INFRASPINOUS, isBlade: true,
    d(p) { const a = d2(p[0], p[1]), b = Math.abs(p[2] - mid(p[0], p[1])) - half; return a > 0 && b > 0 ? Math.hypot(a, b) : Math.max(a, b); },
    side(p) { return p[2] - mid(p[0], p[1]); } };
}
function capsule(a, b, ra, rb, part) {
  const ab = sub(b, a), L2 = dot(ab, ab);
  return { c: lerp(a, b, 0.5), R: Math.sqrt(L2) / 2 + Math.max(ra, rb) + 1, part, d(p) {
    const h = Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2)); return len(sub(p, add(a, mul(ab, h)))) - (ra + (rb - ra) * h); } };
}
function chain(pts, rs, part) { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(capsule(pts[i], pts[i + 1], rs[i], rs[i + 1], part)); return out; }
function ellO(c, axes, r, part) {      // oriented ellipsoid: axes = 3 unit vectors, r = radii along them
  return { c, R: Math.max(...r) + 1, part, d(p) {
    const q = sub(p, c), x = dot(q, axes[0]) / r[0], y = dot(q, axes[1]) / r[1], z = dot(q, axes[2]) / r[2];
    const k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt((x / r[0]) ** 2 + (y / r[1]) ** 2 + (z / r[2]) ** 2);
    return k0 * (k0 - 1) / Math.max(k1, 1e-6); } };
}
function smin(a, b, k) { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b * (1 - h) + a * h - k * h * (1 - h); }

// The left scapula's primitives in the construction frame
function scapulaPrims() {
  const { TS, SA, AI, notch, corBase, corKnee, corTip, LAtop, IGT, GF, AA, acTip, facet } = LM;
  // blade: thin plate, gently concave toward the ribs (centre bulges posteriorly)
  const blade = [bladePrim([SA, L3(32, 42, 0), notch, L3(70, 32, 0), LAtop, L3(84, 2, 0), IGT, L3(66, -40, 0), L3(40, -75, 0), AI, L3(4, -50, 0), TS, L3(2, 24, 0)], 1.6)];
  // spine of the scapula: a fin rising from the dorsal surface, thicker toward its free crest, running up into the acromion
  const c0 = L3(2, 1, 6), c1 = L3(38, 12, 18), c2 = L3(74, 24, 26), b0 = L3(0, 0, 3), b1 = L3(80, 18, 3);
  const fin = plate(L3(40, 12, 8), [b0, c0, c1, c2, b1, b0], 3.4, P.SPINE);
  const crest = chain([c0, c1, c2, L3(90, 30, 25), AA], [3.4, 5.0, 6.0, 6.2, 5.6], P.SPINE);
  // acromion: flat plate arching over the glenoid; the AC facet is on its anteromedial edge
  const acr = plate(L3(104, 45, -1), [AA, L3(116, 39, 10), L3(117, 50, -12), acTip, L3(100, 57, -23), facet, L3(88, 45, 6), L3(86, 33, 22), AA], 4.2, P.ACROMION);
  // coracoid process: ascends from the upper glenoid neck, bends and points forward and out (a bent finger)
  const cor = [capsule(corBase, corKnee, 6, 5.2, P.CORACOID), capsule(corKnee, L3(86, 46, -24), 5.2, 4.6, P.CORACOID), capsule(L3(86, 46, -24), corTip, 4.6, 3.6, P.CORACOID)];
  // borders: thin medial, sharp superior, thick lateral (axillary) border
  const medial = chain([SA, L3(2, 24, 0.5), TS, L3(4, -50, 1), AI], [2.8, 2.6, 2.8, 2.6, 3.6], P.MEDIAL_BORDER);
  const superior = chain([SA, L3(32, 42, 1), notch, L3(70, 32, 0), corBase], [2.2, 1.7, 1.6, 2.2, 3.5], P.SUPERIOR_BORDER);
  const lateral = chain([IGT, L3(66, -40, 1), L3(40, -75, 1.5), AI], [5.6, 4.6, 3.8, 3.6], P.LATERAL_BORDER);
  // glenoid: neck and an oval, pear-shaped articular head; the shallow cavity is subtracted below
  const g = SCAP.glenoid, n = nrm(mv(mm(rz(g.incl * DEG), ry(-g.version * DEG)), [1, 0, 0])), up = nrm(sub([0, 1, 0], mul(n, n[1]))), ap = cross(n, up);
  const head = ellO(sub(GF, mul(n, 3)), [n, up, ap], [5, g.h / 2, g.w / 2], P.GLENOID);
  const headLow = ellO(add(sub(GF, mul(n, 3)), mul(up, -6)), [n, up, ap], [5, g.h * 0.36, g.w * 0.56], P.GLENOID);   // wider below: pear shape
  const neck = [capsule(L3(72, 8, 1), sub(GF, mul(n, 5)), 9, 8.5, P.LATERAL_BORDER), capsule(L3(78, 18, 0), LAtop, 6, 5, P.SUPERIOR_BORDER)];
  const cavity = ellO(add(GF, mul(n, 9.2 - g.depth + 2)), [n, up, ap], [9.2, g.h / 2 - 2.2, g.w / 2 - 2], P.GLENOID);
  const prims = [...blade, ...fin, ...crest, ...acr, ...cor, ...medial, ...superior, ...lateral, head, headLow, ...neck];
  return { prims, cavity, glenoid: { c: GF, n, up }, spineLine: [b0, b1] };
}

// ------------------------------------------------------------------------------------------
// 2. Thoracic gliding surface: the outer surface of the same-side ribs 1–10 blended into one smooth sheet (a soft
//    minimum of the rib distance fields, which bridges the intercostal spaces). The scapula glides over it at a
//    soft-tissue distance; it never forms a bony joint with the ribs or the spine. The surface moves with the ribs, so
//    every spinal pose carries it along.
// ------------------------------------------------------------------------------------------
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  const x = new Array(n).fill(0); for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
function smin2(a, b, k) { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b * (1 - h) + a * h - k * h * (1 - h); }
function gliding(thorax, comps) {
  const ribs = { L: [], R: [] };
  thorax.els.forEach((el, i) => { if (el.kind === "rib" && el.n <= 10) ribs[el.side].push({ el, comp: (comps && comps[i]) || C.compile(el) }); });
  // surface distance for a world point q, given each rib's current transform T (world = T.R * rest + T.t)
  return (side, q, T) => {
    let d = 1e9;
    for (const r of ribs[side]) {
      const t = T && T[r.el.id], w = t ? mv(tr(t.R), sub(q, t.t)) : q, l = sub(w, r.el.o);
      const b = r.comp.box, bd = Math.hypot(Math.max(b[0] - l[0], 0, l[0] - b[3]), Math.max(b[1] - l[1], 0, l[1] - b[4]), Math.max(b[2] - l[2], 0, l[2] - b[5]));
      const v = bd > 30 ? bd : r.comp.sdf(l[0], l[1], l[2]);
      d = d === 1e9 ? v : smin2(d, v, 7);
    }
    return d;
  };
}

// ------------------------------------------------------------------------------------------
// 3. Build: rest placement. The AC joint centre sits 1 mm beyond the clavicle's lateral end (approved clavicle, unchanged);
//    the acromion's facet meets it. The orientation is solved so the medial border (trigonum spinae and inferior angle)
//    rests on the gliding surface with a soft-tissue gap (serratus anterior and subscapularis), close to the reported
//    resting angles.
// ------------------------------------------------------------------------------------------
// Clinical angles of a LEFT scapula from world landmarks (thorax axes; mirror x first for the right side):
// internal rotation = scapular axis TS→AA against the frontal plane (horizontal projection), upward rotation = medial
// border (AI→SA) against vertical within the scapular plane (+ = glenoid up), tilt = medial border against vertical in
// the plane perpendicular to it (+ = anterior, top forward).
function angles(TS, AA, SA, AI) {
  const ir = Math.atan2(AA[2] - TS[2], AA[0] - TS[0]), c = Math.cos(ir), s = Math.sin(ir), mb = sub(SA, AI);
  return { ir: ir / DEG, ur: Math.atan2(-(mb[0] * c + mb[2] * s), mb[1]) / DEG, tilt: Math.atan2(mb[2] * c - mb[0] * s, mb[1]) / DEG };
}
const restR = (ir, ur, tilt) => mm(ry(-ir * DEG), mm(rz(ur * DEG), rx(tilt * DEG)));   // construction frame → world (left)
function build(spine, thorax) {
  const shape = scapulaPrims();
  const clav = thorax.els.find((e) => e.id === "CLAV_L"), g = clav.geo, last = g.nodes[g.nodes.length - 1];
  const tEnd = nrm(sub(last.p, g.nodes[g.nodes.length - 3].p));
  const J = add(g.ac, mul(tEnd, Math.min(last.rn, last.rb) + 1.2));                 // AC joint centre (world, rest)
  // facet normal (construction frame): out of the acromion's anteromedial edge, medially and a little forward
  const facetN = nrm(L3(-1, 0.15, -0.35));
  let Fj = add(LM.facet, mul(facetN, 4.0 + 1.2));
  const glide = gliding(thorax);
  const ant = (p) => add(p, [0, 0, 1.6]);                                            // anterior (costal) surface of a medial-border point
  const world = (R, p) => add(J, mv(R, sub(p, Fj)));
  const resid = (a) => { const R = restR(...a);
    return [2 * (glide("L", world(R, ant(LM.TS))) - SCAP.gapTarget), 2 * (glide("L", world(R, ant(LM.AI))) - SCAP.gapTarget),
      ...(() => { const m = angles(world(R, LM.TS), world(R, LM.AA), world(R, LM.SA), world(R, LM.AI));
        return [0.3 * (m.ir - SCAP.restIR), 0.3 * (m.ur - SCAP.restUR), 0.3 * (m.tilt - SCAP.restTilt)]; })()]; };
  let a = [SCAP.restIR, SCAP.restUR, SCAP.restTilt];
  // the AC joint space is set on the real surfaces: clavicle end against the acromion, ~1.5 mm (articular disc)
  const clavComp = Th.compile(clav), clavEnd = Th.tubeSurface(g.nodes.slice(-4), null, 24);
  for (let pass = 0; pass < 4; pass++) {
  for (let it = 0; it < 40; it++) {
    const r0 = resid(a), Jm = a.map((_, j) => { const ap = a.slice(); ap[j] += 1e-3; return resid(ap).map((v, i) => (v - r0[i]) / 1e-3); });
    const A = [0, 1, 2].map((p) => [0, 1, 2].map((q) => Jm[p].reduce((s, v, i) => s + v * Jm[q][i], 0) + (p === q ? 1e-4 : 0)));
    const dx = solve(A, [0, 1, 2].map((p) => -Jm[p].reduce((s, v, i) => s + v * r0[i], 0)));
    a = a.map((v, i) => v + dx[i]); if (Math.hypot(...dx) < 1e-6) break;
  }
  {
    SHAPE = null; FJ = Fj;
    const R = restR(...a), sc = compile({ mirror: false }), toL = (w) => mv(tr(R), sub(w, J));
    let gap = 1e9; for (const w of clavEnd) { const l = toL(w); gap = Math.min(gap, sc.sdf(l[0], l[1], l[2])); }
    if (Math.abs(gap - 1.5) < 0.1) break;
    Fj = add(Fj, mul(facetN, 1.5 - gap));
  }
  }
  SHAPE = null; FJ = Fj;
  const R = restR(...a);
  // local frame of the element: origin = AC joint centre, axes = construction axes (u lateral, v up, w anterior)
  const local = (p) => sub(p, Fj);
  const lm = Object.fromEntries(Object.entries(LM).map(([k, p]) => [k, local(p)]));
  const els = [];
  for (const side of ["L", "R"]) {
    const m = side === "L" ? (p) => p : (p) => [-p[0], p[1], p[2]];
    const Rs = side === "L" ? R : mm(MIR, mm(R, MIR));
    els.push({ kind: "scapula", id: `SCAP_${side}`, name: `Scapula ${side === "L" ? "left" : "right"}`, region: "scapula", side, psi: 0,
      o: m(J), R: Rs, mirror: side === "R", restR: Rs, landmarks: Object.fromEntries(Object.entries(lm).map(([k, p]) => [k, m(p)])),
      joint: { ac: m(J), parent: `CLAV_${side}`, gliding: "thorax (ellipsoid), not a bony joint" },
      glenoid: { c: m(local(shape.glenoid.c)), n: side === "L" ? shape.glenoid.n : [-shape.glenoid.n[0], shape.glenoid.n[1], shape.glenoid.n[2]] },
      restAngles: { internalRotation: a[0], upwardRotation: a[1], anteriorTilt: a[2] } });
  }
  return { els, glide, J, restAngles: a, gapTarget: SCAP.gapTarget, Fj, facetN };
}

// ---------- compile: shape in the element's local frame (origin AC joint; mirrored for the right side) ----------
// The full field is a smooth union of ~30 primitives. A coarse grid (8 mm cells) in the construction frame caches, for
// each cell, the field at its centre and the primitives that can matter there, so a ray only evaluates a handful.
let SHAPE = null, FJ = null, PRIMS = null;
function shapeCache() {
  if (SHAPE) return SHAPE;
  const s = PRIMS || (PRIMS = scapulaPrims()), J0 = FJ || add(LM.facet, mul(nrm(L3(-1, 0.15, -0.35)), 5.2)), prims = s.prims, cav = s.cavity, K = 2.0;
  const unite = (p, list) => {      // plain minimum inside one plate (its triangles), smooth union between parts
    const gm = new Map(); let d = 1e9;
    for (const q of list) { const v = q.d(p); if (q.group) { const o = gm.get(q.group); if (o === undefined || v < o) gm.set(q.group, v); } else d = d === 1e9 ? v : smin(d, v, K); }
    for (const v of gm.values()) d = d === 1e9 ? v : smin(d, v, K);
    return d;
  };
  const full = (p) => Math.max(unite(p, prims), -cav.d(p));
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const q of prims) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q.c[i] - q.R); b[i + 3] = Math.max(b[i + 3], q.c[i] + q.R); }
  const cs = 6, n = [0, 1, 2].map((i) => Math.ceil((b[i + 3] - b[i]) / cs)), half = (cs * Math.sqrt(3)) / 2, cells = new Array(n[0] * n[1] * n[2]);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const c = [b[0] + (i + 0.5) * cs, b[1] + (j + 0.5) * cs, b[2] + (k + 0.5) * cs], dc = full(c);
    const near = dc < half + 6 ? prims.filter((q) => q.d(c) < half + 6 + K) : null;
    cells[(i * n[1] + j) * n[2] + k] = { dc, near, cav: len(sub(c, cav.c)) - cav.R < half + 2 };
  }
  const field = (p) => {
    const i = Math.floor((p[0] - b[0]) / cs), j = Math.floor((p[1] - b[1]) / cs), k = Math.floor((p[2] - b[2]) / cs);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) {
      const q = [Math.max(b[0], Math.min(b[3], p[0])), Math.max(b[1], Math.min(b[4], p[1])), Math.max(b[2], Math.min(b[5], p[2]))];
      return len(sub(p, q)) + 0.5;
    }
    const cell = cells[(i * n[1] + j) * n[2] + k];
    if (!cell.near) return cell.dc - half;                         // far from bone: a safe lower bound
    const d = unite(p, cell.near);
    if (d === 1e9) return cell.dc - half;
    return cell.cav ? Math.max(d, -cav.d(p)) : d;
  };
  // chunks for the renderer: tight boxes around the cells that hold bone surface (rays skip the empty rest of the box)
  const D = 4, chunks = [];
  for (let a = 0; a < D; a++) for (let bb = 0; bb < D; bb++) for (let c = 0; c < D; c++) {
    const lo = [a, bb, c].map((v, i) => Math.floor((v * n[i]) / D)), hi = [a, bb, c].map((v, i) => Math.floor(((v + 1) * n[i]) / D));
    const cb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = lo[0]; i < hi[0]; i++) for (let j = lo[1]; j < hi[1]; j++) for (let k = lo[2]; k < hi[2]; k++) {
      if (cells[(i * n[1] + j) * n[2] + k].dc > half + 0.5) continue;
      const q = [b[0] + i * cs, b[1] + j * cs, b[2] + k * cs];
      for (let t = 0; t < 3; t++) { cb[t] = Math.min(cb[t], q[t] - 1); cb[t + 3] = Math.max(cb[t + 3], q[t] + cs + 1); }
    }
    if (cb[0] < 1e8) chunks.push(cb);
  }
  const nearAt = (p) => {
    const i = Math.floor((p[0] - b[0]) / cs), j = Math.floor((p[1] - b[1]) / cs), k = Math.floor((p[2] - b[2]) / cs);
    const cell = i >= 0 && j >= 0 && k >= 0 && i < n[0] && j < n[1] && k < n[2] ? cells[(i * n[1] + j) * n[2] + k] : null;
    return cell && cell.near && cell.near.length ? cell.near : prims;
  };
  SHAPE = { s, J0, field, box: b, unite, chunks, nearAt };
  return SHAPE;
}
function compile(el) {
  const { s, J0, field, box: cb, nearAt } = shapeCache(), sg = el.mirror ? -1 : 1, cav = s.cavity;
  const toC = (x, y, z) => [sg * x + J0[0], y + J0[1], z + J0[2]];        // element local → construction frame
  const sdf = (x, y, z) => field(toC(x, y, z));
  const spineA = s.spineLine[0], spineB = s.spineLine[1], sl = sub(spineB, spineA);
  const partAt = (x, y, z) => {
    const p = toC(x, y, z);
    if (cav.d(p) < 1.2 && len(sub(p, s.glenoid.c)) < 22) return P.GLENOID;
    let best = 1e9, q = null; for (const pr of nearAt(p)) { const v = pr.d(p); if (v < best) { best = v; q = pr; } }
    if (!q) return P.INFRASPINOUS;
    if (q.part === P.MEDIAL_BORDER || q.part === P.SUPERIOR_BORDER || q.part === P.LATERAL_BORDER || q.isBlade) {
      if (len(sub(p, LM.SA)) < 11) return P.SUPERIOR_ANGLE;
      if (len(sub(p, LM.AI)) < 13) return P.INFERIOR_ANGLE;
    }
    if (q.isBlade) {
      if (q.side(p) > 0) return P.SUBSCAPULAR;                                     // costal (anterior) surface
      const above = (p[0] - spineA[0]) * sl[1] - (p[1] - spineA[1]) * sl[0] > 0;   // above the line of the spine
      return above ? P.SUPRASPINOUS : P.INFRASPINOUS;
    }
    return q.part;
  };
  const toL = (c) => (sg > 0 ? [c[0] - J0[0], c[1] - J0[1], c[2] - J0[2], c[3] - J0[0], c[4] - J0[1], c[5] - J0[2]]
    : [-(c[3] - J0[0]), c[1] - J0[1], c[2] - J0[2], -(c[0] - J0[0]), c[4] - J0[1], c[5] - J0[2]]);
  const box = toL(cb), chunks = shapeCache().chunks.map((c) => ({ box: toL(c), sdf }));
  return { sdf, partAt, box, chunks };
}
C.registerKind && C.registerKind("scapula", compile);

const API = { angles, P, LM, SCAP, build, compile, scapulaPrims, gliding, restR, solve };
if (NODE) module.exports = API;
else root.ShoulderCore = API;
})(typeof self !== "undefined" ? self : this);
