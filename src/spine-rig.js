// Spinal rig: turns a small regional pose into per-segment rotations, rigid vertebrae and deforming discs.
// The anatomy (spine-core) is never edited: posing only produces new transforms for the same shapes.
//
// pose = {
//   cervical: { fe, lb, ar }, thoracic: { fe, lb, ar }, lumbar: { fe, lb, ar },   // degrees: flexion +, left bend +, left rotation +
//   root: { tilt, obliquity, rotation },                                          // whole sacrum about the hip axis (pelvis later)
// }
// Zero pose returns the approved rest model itself (no arithmetic), so neutral is restored exactly, without drift.
(function (root) {
"use strict";
const C = typeof module !== "undefined" && module.exports ? require("./spine-core.js") : root.SpineCore;
const ROM = typeof module !== "undefined" && module.exports ? require("./spine-rom.js") : root.SpineROM;
const DEG = Math.PI / 180;
let FE_C1_DEPTH = 3, FE_C1_Z = -3;

// ---------- small rigid-transform kit: T = { R: 3x3, t: [3] }, p' = R p + t ----------
const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const comp = (A, B) => ({ R: mm(A.R, B.R), t: mv(A.R, B.t).map((v, i) => v + A.t[i]) });          // A after B
const inv = (A) => { const Rt = tr(A.R); return { R: Rt, t: mv(Rt, A.t).map((v) => -v) }; };
const app = (A, p) => mv(A.R, p).map((v, i) => v + A.t[i]);
const about = (R, p) => ({ R, t: p.map((v, i) => v - mv(R, p)[i]) });                              // rotate about point p
const restT = (el) => ({ R: rx(el.psi), t: el.o.slice() });
// half of a rotation (for the disc's mid frame): axis-angle of R, halved
function halfRot(R) {
  const c = Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)), a = Math.acos(c);
  if (a < 1e-9) return I3();
  const s = 2 * Math.sin(a), k = [(R[2][1] - R[1][2]) / s, (R[0][2] - R[2][0]) / s, (R[1][0] - R[0][1]) / s];
  const h = a / 2, ch = Math.cos(h), sh = Math.sin(h), v = 1 - ch, [x, y, z] = k;
  return [[ch + x * x * v, x * y * v - z * sh, x * z * v + y * sh], [y * x * v + z * sh, ch + y * y * v, y * z * v - x * sh], [z * x * v - y * sh, z * y * v + x * sh, ch + z * z * v]];
}

// ---------- the chain: sacrum (root) -> L5 -> ... -> C2 -> C1 ----------
const CHAIN = ["S", "L5", "L4", "L3", "L2", "L1", "T12", "T11", "T10", "T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2", "T1", "C7", "C6", "C5", "C4", "C3", "C2", "C1"];
const segId = (up, lo) => `${up}-${lo === "S" ? "S1" : lo}`;

function makeRig(built) {
  const E = Object.fromEntries(built.els.map((e) => [e.id, e]));
  const discOf = (up) => built.els.find((d) => d.kind === "disc" && d.up === up);
  // Articulation pivot of each motion segment, in the caudal element's local frame (anatomically informed approximation
  // of the mean centre of rotation): see ROM notes in the README.
  const pivots = {};
  for (let i = 1; i < CHAIN.length; i++) {
    const up = E[CHAIN[i]], lo = E[CHAIN[i - 1]], id = segId(up.id, lo.id), disc = discOf(up.id);
    let w;
    if (up.id === "C1") w = C.toWorld(lo, [0, lo.hc / 2 + 8, lo.axis.densZ - 1.5]);                  // dens axis at the atlanto-dental joint
    else if (up.region === "cervical") w = C.toWorld(lo, [0, -lo.hc * 0.2, 0]);                   // within the caudal body (facets glide on their 45° planes)
    else if (up.region === "thoracic") w = disc.o.slice();                                           // centre of the disc
    else w = C.toWorld(disc, [0, -disc.hc * 0.25, -disc.D * 0.15]);                                  // posterior half of the disc, low
    pivots[id] = { up: up.id, lo: lo.id, local: C.toLocal(lo, w), world: w };
    // C1-C2 bending (coupled to rotation) tilts the atlas about the lateral mass that bears the load, not the dens
    if (up.id === "C1") {
      pivots[id].lbSide = { x: up.atlas.lmX, y: lo.hc / 2 - 1.0, z: lo.axis.facetZ };
      // flexion-extension: the atlas rocks on the convex axis facets; centre below the joint, behind the dens
      pivots[id].fe = [0, lo.hc / 2 - 1.0 - FE_C1_DEPTH, lo.axis.facetZ + FE_C1_Z];
    }
  }
  const hip = [0, built.hip[0], built.hip[1]];
  return { built, E, pivots, hip, discOf };
}

// ---------- pose -> segment angles (distribution, coupling, envelope, caps) ----------
const ZERO = () => ({ cervical: { fe: 0, lb: 0, ar: 0 }, thoracic: { fe: 0, lb: 0, ar: 0 }, lumbar: { fe: 0, lb: 0, ar: 0 }, root: { tilt: 0, obliquity: 0, rotation: 0 } });
function regionLimits(region) {
  const R = ROM.REGION[region], k = ROM.SETTINGS.conservative;
  return { flex: R.flex * k, ext: R.ext * k, lb: R.lb * k, ar: R.ar * k };
}
function solve(pose) {
  const k = ROM.SETTINGS.conservative, out = {}, regions = {};
  for (const r of ROM.REGIONS) {
    const p = (pose && pose[r]) || { fe: 0, lb: 0, ar: 0 }, L = regionLimits(r);
    let n = [p.fe >= 0 ? p.fe / L.flex : p.fe / L.ext, p.lb / L.lb, p.ar / L.ar].map((v) => Math.max(-1, Math.min(1, v || 0)));
    const e = ROM.SETTINGS.envelope, norm = Math.pow(n.reduce((a, v) => a + Math.pow(Math.abs(v), e), 0), 1 / e);
    const scaled = norm > 1;
    if (scaled) n = n.map((v) => v / norm);                       // combined motions cannot all reach their maxima at once
    regions[r] = { input: p, normalized: n, envelope: norm, scaled, applied: { fe: n[0] * (n[0] >= 0 ? L.flex : L.ext), lb: n[1] * L.lb, ar: n[2] * L.ar } };
    for (const s of ROM.SEGMENTS.filter((x) => x.region === r)) {
      let fe = n[0] * k * (n[0] >= 0 ? s.flex : s.ext);
      let lb = n[1] * k * s.lb + n[2] * k * ((s.couple.ar && s.couple.ar.lb) || 0);
      let ar = n[2] * k * s.ar + n[1] * k * ((s.couple.lb && s.couple.lb.ar) || 0);
      const cf = fe >= 0 ? s.cap.flex : s.cap.ext;
      const clamp = (v, c) => Math.max(-c, Math.min(c, v));
      out[s.id] = { fe: clamp(fe, cf), lb: clamp(lb, s.cap.lb), ar: clamp(ar, s.cap.ar), region: r };
    }
  }
  return { segments: out, regions };
}
const isZero = (pose) => !pose || [...ROM.REGIONS.map((r) => pose[r] || {}), pose.root || {}].every((o) => Object.values(o).every((v) => !v));

// ---------- posed model ----------
function posedModel(rig, restComps, pose) {
  const { built, E, pivots } = rig;
  if (isZero(pose)) return { els: built.els, comps: restComps, solved: solve(ZERO()), neutral: true };
  const sol = solve(pose), delta = {};
  const rp = pose.root || {};
  // root: whole sacrum (and everything above it) about the hip axis; zero = sacrum fixed
  const Rroot = mm(ry((rp.rotation || 0) * DEG), mm(rz(-(rp.obliquity || 0) * DEG), rx((rp.tilt || 0) * DEG)));
  delta.S = about(Rroot, rig.hip);
  for (let i = 1; i < CHAIN.length; i++) {
    const up = CHAIN[i], lo = CHAIN[i - 1], sid = segId(up, lo), a = sol.segments[sid] || { fe: 0, lb: 0, ar: 0 };
    // rotation of the cranial vertebra in the caudal vertebra's frame: flexion about x, bending about z, rotation about y
    const pv = pivots[sid];
    let J = comp(about(ry(a.ar * DEG), pv.local), about(rx(a.fe * DEG), pv.fe || pv.local));
    if (a.lb) {
      const pl = pv.lbSide ? [Math.sign(a.lb) * pv.lbSide.x, pv.lbSide.y, pv.lbSide.z] : pv.local;
      J = comp(J, about(rz(-a.lb * DEG), pl));
    }
    const Rlo = restT(E[lo]);
    delta[up] = comp(delta[lo], comp(Rlo, comp(J, inv(Rlo))));
  }
  delta.Co = delta.S;
  const els = [], comps = [];
  built.els.forEach((el, k) => {
    if (el.kind !== "disc") {
      const P = comp(delta[el.id], restT(el));
      els.push({ ...el, R: P.R, o: P.t, delta: delta[el.id] }); comps.push(restComps[k]);
      return;
    }
    // disc: rides halfway between its two vertebrae; each end plate follows its own vertebra
    const dU = delta[el.up], dL = delta[el.lo === "S1" ? "S" : el.lo], R0 = restT(el);
    const Rh = mm(dL.R, halfRot(mm(tr(dL.R), dU.R)));
    const pu = app(dU, el.o), pl = app(dL, el.o), o = pu.map((v, i) => (v + pl[i]) / 2);
    const P = { R: mm(Rh, R0.R), t: o };
    // affine maps: posed disc local -> rest disc local as carried by the upper / lower vertebra
    const toRest = (d) => comp(inv(R0), comp(inv(d), P));
    const flat = (A) => [...A.R[0], ...A.R[1], ...A.R[2], ...A.t];
    const pel = { ...el, R: P.R, o: P.t, aff: { up: flat(toRest(dU)), lo: flat(toRest(dL)) } };
    els.push(pel); comps.push(C.compile(pel));
  });
  return { els, comps, solved: sol, neutral: false };
}

// Disc heights at four rim points, posed vs rest (mm)
function discHeights(el) {
  const hh = el.hc / 2, tw = Math.tan((el.w || 0) * DEG / 2), pts = [["anterior", 0, el.D * 0.4], ["posterior", 0, -el.D * 0.4], ["left", el.W * 0.4, 0], ["right", -el.W * 0.4, 0]];
  const yOf = (A, top, x, z) => {   // solve plane in posed-local for y at (x, z)
    // plane: A.y(q) - (±hh + A.z(q) tw) = 0, with A rows [3..5] and [6..8]
    const ay = top ? A[4] - tw * A[7] : A[4] + tw * A[7], ax = top ? A[3] - tw * A[6] : A[3] + tw * A[6], az = top ? A[5] - tw * A[8] : A[5] + tw * A[8];
    const c0 = top ? A[10] - tw * A[11] - hh : A[10] + tw * A[11] + hh;
    return -(ax * x + az * z + c0) / ay;
  };
  const res = {};
  for (const [n, x, z] of pts) {
    const rest = (hh + z * tw) - (-hh - z * tw);
    const now = el.aff ? yOf(el.aff.up, true, x, z) - yOf(el.aff.lo, false, x, z) : rest;
    res[n] = { rest, now, ratio: now / rest };
  }
  return res;
}

// Demonstration poses built from the control limits (kept here so the lab and the tools share them)
function demoPoses() {
  const all = (key, sign, frac) => Object.fromEntries(ROM.REGIONS.map((r) => {
    const l = regionLimits(r), v = key === "fe" ? (sign > 0 ? l.flex : l.ext) : l[key];
    return [r, { fe: 0, lb: 0, ar: 0, [key]: Math.round(sign * frac * v * 10) / 10 }];
  }));
  const D = [
    { id: "neutral", name: "Neutral", pose: ZERO() },
    { id: "flexion", name: "Flexion", pose: all("fe", 1, 1) },
    { id: "extension", name: "Extension", pose: all("fe", -1, 1) },
    { id: "bend-left", name: "Bend left", pose: all("lb", 1, 1) },
    { id: "bend-right", name: "Bend right", pose: all("lb", -1, 1) },
    { id: "rotate-left", name: "Rotate left", pose: all("ar", 1, 1) },
    { id: "rotate-right", name: "Rotate right", pose: all("ar", -1, 1) },
    { id: "combined", name: "Combined", pose: Object.fromEntries(ROM.REGIONS.map((r) => {
      const l = regionLimits(r); return [r, { fe: Math.round(0.5 * l.flex * 10) / 10, lb: Math.round(-0.4 * l.lb * 10) / 10, ar: Math.round(-0.6 * l.ar * 10) / 10 }];
    })) },
  ];
  for (const d of D) d.pose.root = { tilt: 0, obliquity: 0, rotation: 0 };
  return D;
}
const scalePose = (p, f) => Object.fromEntries(Object.entries(p).map(([k, o]) => [k, Object.fromEntries(Object.entries(o).map(([a, v]) => [a, v * f]))]));
const API = { demoPoses, scalePose, setC1Pivot: (d, z) => { FE_C1_DEPTH = d; FE_C1_Z = z; }, CHAIN, makeRig, solve, posedModel, regionLimits, discHeights, ZERO, isZero, segId };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.SpineRig = API;
})(typeof self !== "undefined" ? self : this);
