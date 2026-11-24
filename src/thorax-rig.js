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
const Sh = NODE ? require("./shoulder-core.js") : root.ShoulderCore;
const Pv = NODE ? require("./pelvis-core.js") : root.PelvisCore;
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
  const spine = C.build(), thorax = Th.build(spine), shoulder = Sh.build(spine, thorax), pelvis = Pv.build(spine);
  return { spine, thorax, shoulder, pelvis, els: [...spine.els, ...thorax.els, ...shoulder.els, ...pelvis.els], nSpine: spine.els.length };
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
  const shoulder = makeShoulder(sk, els);
  return { attachRest: attachments(els), spineRig, sk, els, byId, ribs, ribEl, ccs, ccDefs, st, solved, links, shoulder, restLen: Object.fromEntries(ccs.map((c) => [c.id, c.restLen])),
    restVec: Object.fromEntries(ccs.map((c) => [c.id, c.restVec])) };
}

const SC = ROM.SC, ST = ROM.ST, K = ROM.SETTINGS.conservative;
const clavLimits = () => ({ elev: [-SC.depression * K, SC.elevation * K], prot: [-SC.retraction * K, SC.protraction * K], rot: [0, SC.posteriorRotation * K],
  up: [-ST.downwardRotation * K, ST.upwardRotation * K] });
// pose.clavicle[side] = { elev, prot, up }: the shoulder-girdle controls of one side. elev / prot drive the clavicle at the
// sternoclavicular joint; up is scapular upward rotation. The clavicle's axial rotation and the scapula's tilt and
// internal rotation are solved (rot, if present in older poses, is ignored).
const ZERO_CLAV = () => ({ L: { elev: 0, prot: 0, up: 0 }, R: { elev: 0, prot: 0, up: 0 } });
const clavZero = (p) => !p || !p.clavicle || ["L", "R"].every((s) => !p.clavicle[s] || Object.values(p.clavicle[s]).every((v) => !v));
const isZero = (p) => SR.isZero(p) && clavZero(p);
// pose.root = whole pelvis (tilt, obliquity, rotation about the hip axis: spine, sacrum and both hip bones together, applied
// once at the root) + the small relative movements at the pelvic joints: nutation (sacrum against both hip bones) and
// counter (antagonistic rotation of the hip bones against the sacrum, + = left hip bone posterior).
const ZERO = () => { const z = { ...SR.ZERO(), clavicle: ZERO_CLAV() }; z.root = { ...z.root, nutation: 0, counter: 0 }; return z; };
const pelvisLimits = () => ({ tilt: ROM.SETTINGS.root.tilt, obliquity: ROM.SETTINGS.root.obliquity, rotation: ROM.SETTINGS.root.rotation, nutation: Pv.ROM.nutation, counter: Pv.ROM.counter });
// halfway between two rigid transforms (joint cartilage that belongs to both bones)
function halfway(A, B, p) {
  const Rr = mm(tr(A.R), B.R), c = Math.max(-1, Math.min(1, (Rr[0][0] + Rr[1][1] + Rr[2][2] - 1) / 2)), a = Math.acos(c);
  let H = I3();
  if (a > 1e-9) { const s2 = 2 * Math.sin(a), k = [(Rr[2][1] - Rr[1][2]) / s2, (Rr[0][2] - Rr[2][0]) / s2, (Rr[1][0] - Rr[0][1]) / s2]; H = axisAngle(k, a / 2); }
  const pa = app(A, p), pb = app(B, p), o = pa.map((v, i) => (v + pb[i]) / 2), R = mm(A.R, H);
  return { R, t: o.map((v, i) => v - mv(R, p)[i]) };
}
// attachment frames for the parts that are not built yet (femurs, humeri, head): origin + axes in world space
function attachments(els) {
  const E = Object.fromEntries(els.map((e) => [e.id, e])), out = {};
  const Rof = (e) => e.R || rx(e.psi || 0), W = (e, l) => mv(Rof(e), l).map((v, i) => v + e.o[i]);
  for (const s of ["L", "R"]) {
    const h = E[`HIP_${s}`], R = Rof(h), mirN = s === "L" ? Pv.ACET_N : [-Pv.ACET_N[0], Pv.ACET_N[1], Pv.ACET_N[2]];
    out[`HIP_${s}`] = { parent: h.id, child: `FEMUR_${s} (not built)`, o: h.o.slice(), axis: mv(R, mirN), x: mv(R, [1, 0, 0]), y: mv(R, [0, 1, 0]), z: mv(R, [0, 0, 1]), radius: Pv.PELVIS.socketR };
    const sc = E[`SCAP_${s}`]; if (sc) { const Rs = Rof(sc); out[`SHOULDER_${s}`] = { parent: sc.id, child: `HUMERUS_${s} (not built)`, o: W(sc, sc.glenoid.c), axis: mv(Rs, sc.glenoid.n) }; }
  }
  const c1 = E.C1; if (c1) { const R = Rof(c1); out.HEAD = { parent: "C1", child: "SKULL (not built): occipital condyles on the atlas", o: W(c1, [0, c1.hc / 2, 0]), y: mv(R, [0, 1, 0]), z: mv(R, [0, 0, 1]) }; }
  const hy = E.HYOID; if (hy) out.HYOID = { parent: "none (suspended)", follows: hy.follows, o: hy.o.slice() };
  return out;
}

// sternoclavicular rotation (left side; the right side is mirrored) about the joint centre
// combined motions share one envelope (as in the spinal rig): |(e, p, r) / limits|_2 <= 1
function clavSolve(a) {
  const lim = clavLimits(), cl = (v, r) => Math.max(r[0], Math.min(r[1], v || 0));
  let e = cl(a.elev, lim.elev), p = cl(a.prot, lim.prot), u = cl(a.up, lim.up);
  const n = Math.hypot(e / (e >= 0 ? lim.elev[1] : -lim.elev[0]), p / (p >= 0 ? lim.prot[1] : -lim.prot[0]), u / (u >= 0 ? lim.up[1] : -lim.up[0]));
  if (n > 1) { e /= n; p /= n; u /= n; }
  return { elev: e, prot: p, up: u, envelope: n, scaled: n > 1 };
}
// sternoclavicular rotation for given angles (left side; right mirrored): axial (posterior) rotation about the clavicle's
// rest axis, then elevation about the AP axis, then protraction about the vertical axis
function clavRaw(side, e, p, r, axis) {
  const u = side === "L" ? axis : mv(MIR, axis);
  const RL = mm(ry(-p * DEG), mm(rz(e * DEG), axisAngle(u, -r * DEG)));
  return side === "L" ? RL : mm(MIR, mm(RL, MIR));
}
const clavR = (side, a, axis) => { const q = clavSolve(a); return clavRaw(side, q.elev, q.prot, 0, axis); };

// ---------- shoulder girdle: clavicle + scapula gliding on the rib cage ----------
// Each scapula hangs from its clavicle at the AC joint and glides over the thoracic surface (rib cage blended into one
// sheet) at its rest soft-tissue distance. Unknowns per side: extra clavicle elevation, clavicle axial rotation and the
// three AC rotations. The two medial-border contacts (trigonum spinae, inferior angle) keep their rest gap; the rest of
// the costal surface may not come closer than ST.softTissueMin. Upward rotation is the user's independent control; the
// other rotations follow from the contacts with as little AC and clavicle rotation as possible.
function makeShoulder(sk, els) {
  const sh = sk.shoulder, glide = sh.glide, out = {};
  for (const scap of els.filter((e) => e.kind === "scapula")) {
    const side = scap.side, clav = els.find((e) => e.id === `CLAV_${side}`), lm = scap.landmarks;
    const toW = (p) => C.toWorld(scap, p);
    const ant = (p) => [p[0], p[1], p[2] + 1.6];                // costal surface of a medial-border point (local w = anterior)
    const contacts = ["TS", "AI"].map((k) => toW(ant(lm[k])));
    // other costal-surface samples: along the medial and lateral borders and across the blade
    const S = Sh.LM, sg = side === "L" ? 1 : -1, J0 = sh.Fj;
    const loc = (p) => [sg * (p[0] - J0[0]), p[1] - J0[1], p[2] - J0[2]];
    const extra = [[7, 46, 0], [2, 24, 0.5], [4, -50, 1], [40, -75, 1.5], [66, -40, 1], [42, -22, 3.5], [32, 42, 1.5], [70, 32, 0], [20, -88, 1]]
      .map(([u, v, wp]) => toW(ant(loc([u * 1.1, v, -wp]))));
    // costal-surface samples from the real shape: the points of the scapula nearest the rib cage at rest
    const sc = C.compile(scap), b = sc.box, shell = [];
    for (let x = b[0]; x <= b[3]; x += 4) for (let y = b[1]; y <= b[4]; y += 4) for (let z = b[2]; z <= b[5]; z += 4) { const d = sc.sdf(x, y, z); if (d < 0 && d > -4) shell.push(toW([x, y, z])); }
    const near = shell.map((p) => [p, glide(side, p)]).filter(([, g]) => g < 30).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < near.length && extra.length < 32; i += Math.max(1, Math.floor(near.length / 22))) extra.push(near[i][0]);
    const g0 = contacts.map((p) => glide(side, p)), gx = extra.map((p) => glide(side, p));
    // acromioclavicular joint: points on the clavicle's lateral end, kept 0.5–3 mm from the acromion
    const cl = els.find((e) => e.id === `CLAV_${side}`), acPts = Th.tubeSurface(cl.geo.nodes.slice(-3), null, 10);
    const lmW = Object.fromEntries(["TS", "AA", "SA", "AI"].map((k) => [k, toW(lm[k])]));
    out[side] = { side, scap, clav, contacts, extra, g0, gx, J: scap.o.slice(), lmW, rest: angleSet(side, lmW, ID()), sc, acPts };
  }
  return out;
}
function angleSet(side, w, T) {      // clinical angles in the thorax frame T (sternum); right side mirrored onto the left
  const inv = (p) => { const q = mv(tr(T.R), sub(p, T.t)); return side === "L" ? q : [-q[0], q[1], q[2]]; };
  return Sh.angles(inv(w.TS), inv(w.AA), inv(w.SA), inv(w.AI));
}
const mirT = (T) => ({ R: mm(MIR, mm(T.R, MIR)), t: mv(MIR, T.t) });
// Both sides are solved by the same left-side problem: the right side's thorax state is mirrored onto the left, solved,
// and mirrored back. Symmetric inputs therefore give exactly mirrored shoulders.
function solveShoulder(rig, side, Tst, ribsT, input) {
  if (side === "L") return solveShoulderL(rig, Tst, ribsT, input);
  const rm = {}; if (ribsT) for (const id in ribsT) if (id.endsWith("_R")) rm[id.replace(/_R$/, "_L")] = mirT(ribsT[id]);
  const r = solveShoulderL(rig, mirT(Tst), ribsT ? rm : null, input);
  return { ...r, Tc: mirT(r.Tc), Ts: mirT(r.Ts) };
}
function solveShoulderL(rig, Tst, ribsT, input) {
  const side = "L";
  // continuation: large inputs are approached in steps from rest, each step starting from the previous solution,
  // so the solver follows the gliding path instead of jumping to a distant (unnatural) solution
  const q0 = clavSolve(input || {}), N = Math.max(1, Math.ceil(Math.max(Math.abs(q0.elev) / 8, Math.abs(q0.prot) / 6, Math.abs(q0.up) / 6)));
  let x = [0, 0, 0, 0, 0], res = null;
  for (let s = 1; s <= N; s++) { res = solveShoulderStep(rig, "L", Tst, ribsT, { elev: q0.elev * s / N, prot: q0.prot * s / N, up: q0.up * s / N }, x); x = res.x; }
  res.input = q0; return res;
}
function solveShoulderStep(rig, side, Tst, ribsT, input, x0) {
  const S = rig.shoulder[side], clav = S.clav, q = clavSolve(input || {}), lim = clavLimits();
  const glide = rig.sk.shoulder.glide, Rn = (x) => x * DEG;
  const pose = (x) => {
    const Tc = comp(Tst, about(clavRaw(side, q.elev + x[0], q.prot, x[1], clav.joint.axis), clav.joint.pivot));
    const Ts = comp(Tc, about(rotvec([Rn(x[2]), Rn(x[3]), Rn(x[4])]), S.J));
    return { Tc, Ts };
  };
  const wl = (Ts) => Object.fromEntries(Object.entries(S.lmW).map(([k, p]) => [k, app(Ts, p)]));
  const soft = ST.softTissueMin;
  const resid = (x, urTarget) => {
    const { Tc, Ts } = pose(x), r = [];
    // AC joint space: clavicle end points (moved with the clavicle) in the scapula's frame
    let acMin = 1e9; const iTs = inv(Ts);
    for (const p of S.acPts) { const w = app(iTs, app(Tc, p)), l = C.toLocal(S.scap, w), d = S.sc.sdf(l[0], l[1], l[2]); if (d < acMin) acMin = d; }
    r.push(acMin < 0.5 ? 4 * (0.5 - acMin) : acMin > 3 ? 2 * (acMin - 3) : 0);
    S.contacts.forEach((p, i) => r.push(2 * (glide(side, app(Ts, p), ribsT) - S.g0[i])));
    S.extra.forEach((p, i) => { const g = glide(side, app(Ts, p), ribsT), m = Math.min(soft, S.gx[i]); r.push(g < m ? 3 * (m - g) : 0); });
    if (urTarget != null) r.push(1.5 * (angleSet(side, wl(Ts), Tst).ur - urTarget));
    const e = q.elev + x[0], over = (v, a, b) => (v < a ? a - v : v > b ? v - b : 0);
    // clavicle elevation follows the user exactly unless upward rotation asks for more; the clavicle's axial rotation and
    // the AC rotations are kept as small as the gliding allows
    r.push((urTarget == null ? 5 : 0.12) * x[0], 0.04 * x[1], 0.08 * x[2], 0.08 * x[3], 0.08 * x[4]);
    r.push(4 * over(e, lim.elev[0], lim.elev[1]), 4 * over(x[1], -5, lim.rot[1]), 10 * over(Math.hypot(x[2], x[3], x[4]), 0, ST.acRange));
    return r;
  };
  const lm = (x0, urTarget) => {
    let x = x0.slice(), r = resid(x, urTarget), f = r.reduce((a, v) => a + v * v, 0), mu = 1e-2;
    for (let it = 0; it < 40; it++) {
      const J = x.map((_, j) => { const xp = x.slice(); xp[j] += 1e-3; return resid(xp, urTarget).map((v, i) => (v - r[i]) / 1e-3); });
      const n = x.length, A = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => { let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * J[b][i]; return s; }));
      const g = x.map((_, a) => { let s = 0; for (let i = 0; i < r.length; i++) s += J[a][i] * r[i]; return -s; });
      let acc = false;
      for (let k = 0; k < 8; k++) {
        const dx = solveLin(A.map((row, a) => row.map((v, b) => v + (a === b ? mu * (1 + A[a][a]) : 0))), g), xn = x.map((v, i) => v + dx[i]);
        const rn = resid(xn, urTarget), fn = rn.reduce((a, v) => a + v * v, 0);
        if (fn < f) { acc = f - fn > 1e-8; x = xn; r = rn; f = fn; mu = Math.max(1e-7, mu / 3); break; } mu *= 4;
      }
      if (!acc) break;
    }
    return { x, f };
  };
  // natural position for this clavicle input (no upward-rotation target), then the user's upward rotation on top of it
  const xs = x0.slice(); xs[1] = 0;
  let sol = lm(Math.abs(q.up) > 1e-9 ? [x0[0] * 0, 0, 0, 0, 0] : x0, null);
  const natural = angleSet(side, wl(pose(sol.x).Ts), Tst).ur;
  if (Math.abs(q.up) > 1e-9) sol = lm(x0, natural + q.up);
  const { Tc, Ts } = pose(sol.x), ang = angleSet(side, wl(Ts), Tst);
  const gaps = [...S.contacts, ...S.extra].map((p) => glide(side, app(Ts, p), ribsT));
  return { Tc, Ts, x: sol.x, input: q, angles: ang, rest: S.rest, natural, minGap: Math.min(...gaps), contactGap: gaps.slice(0, 2), clavicle: { elev: q.elev + sol.x[0], prot: q.prot, rot: sol.x[1] },
    ac: Math.hypot(sol.x[2], sol.x[3], sol.x[4]), residual: Math.sqrt(sol.f) };
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
  if (isZero(pose)) return { els: rig.els, comps: restComps, solved: SR.solve(SR.ZERO()), neutral: true, thorax: null, attach: rig.attachRest };
  const sp = SR.posedModel(rig.spineRig, restComps.slice(0, nS), pose);
  // pelvis: the whole-pelvis transform Pw is the spine rig's root (sacrum about the hip axis) — applied once. Nutation
  // turns the sacrum (and the whole spine above it) relative to both hip bones about the transverse sacroiliac axis.
  const rp = pose.root || {}, Pw = (sp.els.find((e) => e.id === "S") || {}).delta || ID();
  const ax = rig.sk.pelvis.siAxis.o, nut = Math.max(-Pv.ROM.nutation, Math.min(Pv.ROM.nutation, rp.nutation || 0));
  const ctr = Math.max(-Pv.ROM.counter, Math.min(Pv.ROM.counter, rp.counter || 0));
  if (nut) {
    const Wn = comp(Pw, comp(about(rx(nut * DEG), ax), inv(Pw)));
    sp.els = sp.els.map((e) => ({ ...e, R: mm(Wn.R, e.R || rx(e.psi || 0)), o: app(Wn, e.o), ...(e.delta ? { delta: comp(Wn, e.delta) } : {}) }));
  }
  const Ssac = sp.els.find((e) => e.id === "S").delta || ID();
  const hipT = { L: comp(Pw, about(rx(-ctr * DEG), [Pv.SIJ_C[0], ax[1], ax[2]])), R: comp(Pw, about(rx(ctr * DEG), [-Pv.SIJ_C[0], ax[1], ax[2]])) };
  const delta = {}; sp.els.forEach((e) => { if (e.delta) delta[e.id] = e.delta; });
  const sol = solveRibcage(rig, delta);
  const els = sp.els.slice(), comps = sp.comps.slice();
  const geo = Th.cartilageGeometry(rig.ribEl, rig.ccDefs, sol);
  const clav = (pose.clavicle) || ZERO_CLAV();
  const clavT = {}, girdle = {};
  for (const side of ["L", "R"]) girdle[side] = solveShoulder(rig, side, sol.sternum, sol.ribs, clav[side]);
  for (let k = nS; k < rig.els.length; k++) {
    const el = rig.els[k];
    if (el.kind === "rib") { const T = sol.ribs[el.id]; els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]); }
    else if (el.kind === "sternum") { const T = sol.sternum; els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]); }
    else if (el.kind === "clavicle") {
      const T = girdle[el.side].Tc; clavT[el.id] = T;
      els.push({ ...el, R: T.R, o: app(T, el.o), delta: T }); comps.push(restComps[k]);
    } else if (el.kind === "scapula") {
      const T = girdle[el.side].Ts;
      els.push({ ...el, R: mm(T.R, el.R), o: app(T, el.o), delta: T }); comps.push(restComps[k]);
    } else if (el.kind === "hip" || el.kind === "joint" || el.kind === "hyoid") {
      const T = el.kind === "hip" ? hipT[el.side] : el.kind === "hyoid" ? delta[el.follows] || ID()
        : el.joint === "symphysis" ? halfway(hipT.L, hipT.R, el.o) : halfway(Ssac, hipT[el.side], el.o);
      els.push({ ...el, R: mm(T.R, el.R), o: app(T, el.o), delta: T }); comps.push(restComps[k]);
    } else if (el.kind === "cartilage") {
      const g = geo[el.id], pel = { ...el, o: g.nodes[0].p.slice(), geo: g, R: undefined, psi: 0, stretch: g.arc / el.restArc, chordRatio: g.chord / el.restLen };
      els.push(pel); comps.push(C.compile(pel));
    }
  }
  const pelvis = { whole: { tilt: rp.tilt || 0, obliquity: rp.obliquity || 0, rotation: rp.rotation || 0 }, nutation: nut, counter: ctr };
  return { els, comps, solved: sp.solved, neutral: false, girdle, pelvis, attach: attachments(els), thorax: { theta: sol.theta, residual: sol.residual, sternum: sol.sternum, clavicles: clavT,
    stretch: Object.fromEntries(rig.ccs.map((c) => [c.id, geo[c.id].arc / c.restArc])),
    chord: Object.fromEntries(rig.ccs.map((c) => [c.id, geo[c.id].chord / c.restLen])) } };
}

// demonstration poses: the approved spinal demos (unchanged ids) plus clavicle demos for the future shoulder girdle
function demoPoses() {
  const D = SR.demoPoses().map((d) => ({ ...d, pose: { ...d.pose, clavicle: ZERO_CLAV() } }));
  const lim = clavLimits(), both = (o) => ({ L: { elev: 0, prot: 0, up: 0, ...o }, R: { elev: 0, prot: 0, up: 0, ...o } });
  const r1 = (v) => Math.round(v * 10) / 10;
  D.push({ id: "shrug", name: "Shrug", pose: { ...SR.ZERO(), clavicle: both({ elev: r1(lim.elev[1]) }) } });
  D.push({ id: "shoulders-back", name: "Shoulders back", pose: { ...SR.ZERO(), clavicle: both({ prot: r1(lim.prot[0] * 0.85), elev: r1(lim.elev[0] * 0.5) }) } });
  D.push({ id: "reach-forward", name: "Reach forward", pose: { ...SR.ZERO(), clavicle: both({ prot: r1(lim.prot[1]) }) } });
  D.push({ id: "upward-rotation", name: "Upward rotation", pose: { ...SR.ZERO(), clavicle: both({ up: r1(lim.up[1]) }) } });
  // controlled pelvic tilts: the pelvis tilts about the hip axis while the lumbar spine compensates by the same angle,
  // so the trunk above stays upright (exactly: lumbar flexion = −tilt keeps T12 level). Pelvic-joint motion stays zero.
  const pt = (id, name, t) => { const p = ZERO(); p.root.tilt = t; p.lumbar.fe = -t; return { id, name, pose: p }; };
  D.push(pt("pelvic-tilt-anterior", "Pelvic tilt forward", 10), pt("pelvic-tilt-posterior", "Pelvic tilt back", -10));
  D.forEach((d) => { d.pose.root = { nutation: 0, counter: 0, ...d.pose.root }; });
  return D;
}
// scale every angle of a pose (nested clavicle sides included)
const scalePose = (p, f) => JSON.parse(JSON.stringify(p), (k, v) => (typeof v === "number" ? v * f : v));
const API = { demoPoses, scalePose, attachments, pelvisLimits, halfway, buildSkeleton, makeRig, posedModel, solveRibcage, solveShoulder, clavLimits, clavSolve, clavR, clavRaw, ZERO, ZERO_CLAV, isZero, clavZero, kabsch };
if (NODE) module.exports = API;
else root.ThoraxRig = API;
})(typeof self !== "undefined" ? self : this);
