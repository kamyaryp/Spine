// Thorax rig: rib cage and clavicles on top of the approved spinal rig (spine-rig is used unchanged).
//
// Hierarchy
//   vertebra Tn ──(costovertebral + costotransverse joints: one rotation about the head–tubercle axis)──> rib n
//   true-rib ends 1–7 ──(costal cartilages, deformable)──> sternum (rigid: manubrium, body, xiphoid)
//   false-rib ends 8–10 ──(cartilage)──> cartilage above;   floating ribs 11–12: free cartilaginous tips
//   sternum (manubrium) ──(sternoclavicular joint: elevation, protraction, axial rotation)──> clavicle L / R
// For any spinal pose the ribs move rigidly with their vertebrae; each rib may also turn on its costovertebral axis
// and the sternum finds the position that disturbs the cartilages least (least squares on cartilage length and
// shape). Bones never deform: only cartilages are rebuilt for a pose.
//
// pose.clavicle = { L: { elev, prot, rot }, R: { elev, prot, rot } }  (degrees; + elevation, + protraction, + posterior rotation)
(function (root) {
"use strict";
const NODE = typeof module !== "undefined" && module.exports;
const C = NODE ? require("./spine-core.js") : root.SpineCore;
const Th = NODE ? require("./thorax-core.js") : root.ThoraxCore;
const SR = NODE ? require("./spine-rig.js") : root.SpineRig;
const ROM = NODE ? require("./spine-rom.js") : root.SpineROM;
const DEG = Math.PI / 180;

// ---------- transform kit (T = { R, t }, p' = R p + t) ----------
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const comp = (A, B) => ({ R: mm(A.R, B.R), t: mv(A.R, B.t).map((v, i) => v + A.t[i]) });
const inv = (A) => { const Rt = tr(A.R); return { R: Rt, t: mv(Rt, A.t).map((v) => -v) }; };
const app = (A, p) => mv(A.R, p).map((v, i) => v + A.t[i]);
const about = (R, p) => ({ R, t: p.map((v, i) => v - mv(R, p)[i]) });
const ID = () => ({ R: I3(), t: [0, 0, 0] });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
function axisAngle(k, a) {
  const c = Math.cos(a), s = Math.sin(a), v = 1 - c, [x, y, z] = k;
  return [[c + x * x * v, x * y * v - z * s, x * z * v + y * s], [y * x * v + z * s, c + y * y * v, y * z * v - x * s], [z * x * v - y * s, z * y * v + x * s, c + z * z * v]];
}
const rotvec = (w) => { const a = Math.hypot(w[0], w[1], w[2]); return a < 1e-12 ? I3() : axisAngle([w[0] / a, w[1] / a, w[2] / a], a); };
const rx = (a) => axisAngle([1, 0, 0], a), ry = (a) => axisAngle([0, 1, 0], a), rz = (a) => axisAngle([0, 0, 1], a);
const MIR = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
// Kabsch: best rigid map of points A onto B
function kabsch(A, B) {
  const n = A.length, ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ca[k] += A[i][k] / n; cb[k] += B[i][k] / n; }
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) H[r][c] += (A[i][r] - ca[r]) * (B[i][c] - cb[c]);
  // polar decomposition by iteration (robust for near-identity rotations): R = closest rotation to H^T
  let R = tr(H), fro = Math.sqrt(R.flat().reduce((s, v) => s + v * v, 0)) || 1;
  R = R.map((r) => r.map((v) => v / fro));
  for (let it = 0; it < 40; it++) {
    const Ri = inv3(R); if (!Ri) break;
    R = R.map((r, i) => r.map((v, j) => 0.5 * (v + Ri[j][i])));
  }
  return { R, t: sub(cb, mv(R, ca)) };
}
function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  if (Math.abs(det) < 1e-12) return null;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
function solveLin(A, b) {   // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-12); }
  return x;
}

// ---------- skeleton = spine + thorax ----------
function buildSkeleton() {
  const spine = C.build(), thorax = Th.build(spine);
  return { spine, thorax, els: [...spine.els, ...thorax.els], nSpine: spine.els.length };
}
function makeRig(sk) {
  const spineRig = SR.makeRig(sk.spine);
  const els = sk.els, byId = Object.fromEntries(els.map((e, k) => [e.id, k]));
  const ribs = els.filter((e) => e.kind === "rib"), ccs = els.filter((e) => e.kind === "cartilage"), st = els.find((e) => e.kind === "sternum");
  const ribEl = Object.fromEntries(ribs.map((e) => [e.id, e]));
  const ccDefs = sk.thorax.ccDefs;
  // solver unknowns: costovertebral angle of ribs 1–10 on both sides, sternum correction (rotation vector, translation)
  const solved = ribs.map((r) => r.id);
  // intercostal coupling of the floating ribs: corresponding points on rib n and rib n-1 (fractions of their length)
  const at = (r, f) => r.geo.nodes[Math.round(f * (r.geo.nodes.length - 1))].p;
  const links = ribs.filter((r) => r.n >= 11).map((r) => {
    const up = ribs.find((x) => x.side === r.side && x.n === r.n - 1);
    return { id: r.id, up: up.id, f: [0.35, 0.55, 0.75, 1].map((f) => [at(r, f), at(up, f)]) };
  });
  return { spineRig, sk, els, byId, ribs, ribEl, ccs, ccDefs, st, solved, links, restLen: Object.fromEntries(ccs.map((c) => [c.id, c.restLen])),
    restVec: Object.fromEntries(ccs.map((c) => [c.id, c.restVec])) };
}

const SC = ROM.SC, K = ROM.SETTINGS.conservative;
const clavLimits = () => ({ elev: [-SC.depression * K, SC.elevation * K], prot: [-SC.retraction * K, SC.protraction * K], rot: [0, SC.posteriorRotation * K] });
const ZERO_CLAV = () => ({ L: { elev: 0, prot: 0, rot: 0 }, R: { elev: 0, prot: 0, rot: 0 } });
const clavZero = (p) => !p || !p.clavicle || ["L", "R"].every((s) => !p.clavicle[s] || Object.values(p.clavicle[s]).every((v) => !v));
const isZero = (p) => SR.isZero(p) && clavZero(p);
const ZERO = () => ({ ...SR.ZERO(), clavicle: ZERO_CLAV() });

// sternoclavicular rotation (left side; the right side is mirrored) about the joint centre
// combined motions share one envelope (as in the spinal rig): |(e, p, r) / limits|_2 <= 1
function clavSolve(a) {
  const lim = clavLimits(), cl = (v, r) => Math.max(r[0], Math.min(r[1], v || 0));
  let e = cl(a.elev, lim.elev), p = cl(a.prot, lim.prot), r = cl(a.rot, lim.rot);
  const n = Math.hypot(e / (e >= 0 ? lim.elev[1] : -lim.elev[0]), p / (p >= 0 ? lim.prot[1] : -lim.prot[0]), r / lim.rot[1]);
  if (n > 1) { e /= n; p /= n; r /= n; }
  return { elev: e, prot: p, rot: r, envelope: n, scaled: n > 1 };
}
function clavR(side, a, axis) {
  const q = clavSolve(a), e = q.elev * DEG, p = q.prot * DEG, r = q.rot * DEG;
  const u = side === "L" ? axis : mv(MIR, axis);                            // rest long axis in left-side terms
  const RL = mm(ry(-p), mm(rz(e), axisAngle(u, -r)));
  return side === "L" ? RL : mm(MIR, mm(RL, MIR));
}

// Rib-cage solution for given vertebral transforms (delta: id -> T)
function solveRibcage(rig, delta) {
  const { ribs, ribEl, ccDefs, solved, restLen, restVec, st, links } = rig;
  const cfg = ROM.SETTINGS.ribcage, idx = Object.fromEntries(solved.map((id, i) => [id, i])), nT = solved.length;
  const ribT = (r, th) => comp(delta[r.vertebra] || ID(), about(axisAngle(r.joint.axis, th * DEG), r.joint.head));
  // initial sternum: carried by the true-rib ends with no costovertebral rotation
  const A = [], B = [];
  for (const r of ribs) if (r.n <= 7) { A.push(r.end.p); B.push(app(ribT(r, 0), r.end.p)); }
  const T0 = kabsch(A, B), cen = app(T0, st.o);
  const unpack = (x) => {
    const ribsT = {}; for (const r of ribs) ribsT[r.id] = ribT(r, x[idx[r.id]]);
    const w = [x[nT] * DEG, x[nT + 1] * DEG, x[nT + 2] * DEG], corr = comp({ R: I3(), t: [x[nT + 3], x[nT + 4], x[nT + 5]] }, about(rotvec(w), cen));
    return { ribs: ribsT, sternum: comp(corr, T0) };
  };
  const resid = (x) => {
    const P = unpack(x), g = Th.cartilageGeometry(ribEl, ccDefs, P, true), Rt = tr(P.sternum.R), out = [];
    for (const cd of ccDefs) {
      if (!cd.to) continue;
      // first rib: synchondrosis with the manubrium (stiff); second rib: at the sternal angle (stiffer)
      const c = g[cd.id], v = mv(Rt, c.vec), v0 = restVec[cd.id], w = cd.n === 1 ? 4 : cd.n === 2 ? 1.6 : 1;
      out.push(w * (len(c.vec) - restLen[cd.id]));
      for (let k = 0; k < 3; k++) out.push(w * 0.15 * (v[k] - v0[k]));
    }
    for (const L of links) {                      // floating ribs keep their place relative to the rib above
      const Ta = P.ribs[L.id], Tb = P.ribs[L.up], Rv = tr((delta[ribEl[L.id].vertebra] || ID()).R);
      for (const [pa, pb] of L.f) { const v = mv(Rv, sub(app(Ta, pa), app(Tb, pb))), v0 = sub(pa, pb); for (let k = 0; k < 3; k++) out.push(0.25 * (v[k] - v0[k])); }
    }
    for (let i = 0; i < nT; i++) { const a = Math.abs(x[i]); out.push(0.25 * x[i], a > cfg.costovertebralMax ? 4 * (a - cfg.costovertebralMax) : 0); }
    return out;
  };
  let x = new Array(nT + 6).fill(0), r = resid(x), f = r.reduce((s, v) => s + v * v, 0), mu = 1e-2;
  for (let it = 0; it < 14; it++) {
    const J = x.map((_, j) => { const xp = x.slice(); xp[j] += 1e-3; return resid(xp).map((v, i) => (v - r[i]) / 1e-3); });   // J[j][i]
    const n = x.length, JTJ = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => { let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * J[b][i]; return s; }));
    const g = x.map((_, a) => { let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * r[i]; return s; });
    let accepted = false;
    for (let k = 0; k < 8; k++) {
      const M = JTJ.map((row, a) => row.map((v, b) => v + (a === b ? mu * (1 + JTJ[a][a]) : 0)));
      const dx = solveLin(M, g.map((v) => -v)), xn = x.map((v, i) => v + dx[i]), rn = resid(xn), fn = rn.reduce((s, v) => s + v * v, 0);
      if (fn < f) { const gain = f - fn; x = xn; r = rn; f = fn; mu = Math.max(1e-7, mu / 3); accepted = gain > 1e-6; break; }
      mu *= 4;
    }
    if (!accepted) break;
  }
  const P = unpack(x);
  const theta = {}; for (const id of solved) theta[id] = x[idx[id]];
  return { ...P, theta, residual: Math.sqrt(f), sternumCorrection: x.slice(nT) };
}

// Posed skeleton. Spine through SpineRig.posedModel (unchanged); thorax follows.
function posedModel(rig, restComps, pose) {
  const nS = rig.sk.nSpine;
  if (isZero(pose)) return { els: rig.els, comps: restComps, solved: SR.solve(SR.ZERO()), neutral: true, thorax: null };
  const sp = SR.posedModel(rig.spineRig, restComps.slice(0, nS), pose);
  const delta = {}; sp.els.forEach((e) => { if (e.delta) delta[e.id] = e.delta; });
  const sol = solveRibcage(rig, delta);
  const els = sp.els.slice(), comps = sp.comps.slice();
  const geo = Th.cartilageGeometry(rig.ribEl, rig.ccDefs, sol);
  const clav = (pose.clavicle) || ZERO_CLAV();
  const clavT = {};
  for (let k = nS; k < rig.els.length; k++) {
    const el = rig.els[k];
    if (el.kind === "rib") { const T = sol.ribs[el.id]; els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]); }
    else if (el.kind === "sternum") { const T = sol.sternum; els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]); }
    else if (el.kind === "clavicle") {
      const T = comp(sol.sternum, about(clavR(el.side, clav[el.side] || {}, el.joint.axis), el.joint.pivot)); clavT[el.id] = T;
      els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]);
    } else if (el.kind === "cartilage") {
      const g = geo[el.id], pel = { ...el, o: g.nodes[0].p.slice(), geo: g, R: undefined, psi: 0, stretch: g.arc / el.restArc, chordRatio: g.chord / el.restLen };
      els.push(pel); comps.push(C.compile(pel));
    }
  }
  return { els, comps, solved: sp.solved, neutral: false, thorax: { theta: sol.theta, residual: sol.residual, sternum: sol.sternum, clavicles: clavT,
    stretch: Object.fromEntries(rig.ccs.map((c) => [c.id, geo[c.id].arc / c.restArc])),
    chord: Object.fromEntries(rig.ccs.map((c) => [c.id, geo[c.id].chord / c.restLen])) } };
}

// demonstration poses: the approved spinal demos (unchanged ids) plus clavicle demos for the future shoulder girdle
function demoPoses() {
  const D = SR.demoPoses().map((d) => ({ ...d, pose: { ...d.pose, clavicle: ZERO_CLAV() } }));
  const lim = clavLimits(), both = (o) => ({ L: { elev: 0, prot: 0, rot: 0, ...o }, R: { elev: 0, prot: 0, rot: 0, ...o } });
  const r1 = (v) => Math.round(v * 10) / 10;
  D.push({ id: "shrug", name: "Shrug", pose: { ...SR.ZERO(), clavicle: both({ elev: r1(lim.elev[1]) }) } });
  D.push({ id: "shoulders-back", name: "Shoulders back", pose: { ...SR.ZERO(), clavicle: both({ prot: r1(lim.prot[0] * 0.85), elev: r1(lim.elev[0] * 0.5) }) } });
  return D;
}
// scale every angle of a pose (nested clavicle sides included)
const scalePose = (p, f) => JSON.parse(JSON.stringify(p), (k, v) => (typeof v === "number" ? v * f : v));
const API = { demoPoses, scalePose, buildSkeleton, makeRig, posedModel, solveRibcage, clavLimits, clavSolve, clavR, ZERO, ZERO_CLAV, isZero, clavZero, kabsch };
if (NODE) module.exports = API;
else root.ThoraxRig = API;
})(typeof self !== "undefined" ? self : this);
