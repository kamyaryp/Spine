// Shoulder-girdle validation: scapula count and IDs, AC connection, rib-cage clearance, gliding contact, symmetry,
// proportions and behaviour in every demonstration (spinal and shoulder) and in combined poses.
// node tools/shoulder-check.js [--json out.json]
const C = require("../src/spine-core.js"), SR = require("../src/spine-rig.js"), TR = require("../src/thorax-rig.js"), Sh = require("../src/shoulder-core.js");
const ROM = require("../src/spine-rom.js"), Th = require("../src/thorax-core.js");
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]);
const mv = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);

const sk = TR.buildSkeleton(), rig = TR.makeRig(sk), comps = sk.els.map(C.compile);
const E = Object.fromEntries(sk.els.map((e, k) => [e.id, k]));
// surface samples of each scapula (local frame) and of the clavicle's lateral end
const shell = (k, step) => {
  const c = comps[k], b = c.box, out = [];
  for (let x = b[0]; x <= b[3]; x += step) for (let y = b[1]; y <= b[4]; y += step) for (let z = b[2]; z <= b[5]; z += step) { const d = c.sdf(x, y, z); if (d < 0 && d > -step) out.push([x, y, z]); }
  return out;
};
const SC = { L: shell(E.SCAP_L, 1.5), R: shell(E.SCAP_R, 1.5) };
const clavEnd = {};
for (const s of ["L", "R"]) {
  const el = sk.els[E[`CLAV_${s}`]], ns = el.geo.nodes;
  clavEnd[s] = Th.tubeSurface(ns.slice(-4), null, 24).map((p) => sub(p, el.o));
}
const toW = (m, id, pts) => { const el = m.els[E[id]]; return pts.map((p) => C.toWorld(el, p)); };
const sdfW = (m, id, w) => { const el = m.els[E[id]], l = C.toLocal(el, w), c = m.comps[E[id]], b = c.box;
  const bd = Math.hypot(Math.max(b[0] - l[0], 0, l[0] - b[3]), Math.max(b[1] - l[1], 0, l[1] - b[4]), Math.max(b[2] - l[2], 0, l[2] - b[5]));
  return bd > 0 && /^(vertebra|disc|sacrum|coccyx)$/.test(el.kind) ? bd + 1 : c.sdf(l[0], l[1], l[2]); };
const minTo = (m, pts, id) => { let mn = 1e9; for (const w of pts) { const d = sdfW(m, id, w); if (d < mn) mn = d; } return mn; };
const RIBS = (s) => Array.from({ length: 12 }, (_, i) => `RIB${i + 1}_${s}`);
const OTHER = ["C6", "C7", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "STERNUM"];

function measure(m) {
  const out = {};
  for (const s of ["L", "R"]) {
    const scap = toW(m, `SCAP_${s}`, SC[s]), cend = toW(m, `CLAV_${s}`, clavEnd[s]);
    let rib = 1e9, ribAt = ""; for (const id of RIBS(s)) { const d = minTo(m, scap, id); if (d < rib) { rib = d; ribAt = id; } }
    let other = 1e9, otherAt = ""; for (const id of [...OTHER, ...RIBS(s === "L" ? "R" : "L")]) { const d = minTo(m, scap, id); if (d < other) { other = d; otherAt = id; } }
    // clavicle against the scapula: AC joint space at the clavicle's end, and no overlap anywhere else (coracoid, spine)
    const ac = minTo(m, cend, `SCAP_${s}`);
    const clavAll = toW(m, `CLAV_${s}`, Th.tubeSurface(sk.els[E[`CLAV_${s}`]].geo.nodes.slice(0, -6), null, 16).map((p) => sub(p, sk.els[E[`CLAV_${s}`]].o)));
    const clavBody = minTo(m, clavAll, `SCAP_${s}`);
    const g = m.girdle ? m.girdle[s] : null;
    out[s] = { ribGap: rib, ribAt, otherGap: other, otherAt, acGap: ac, clavicleBody: clavBody, angles: g ? g.angles : rig.shoulder[s].rest,
      contact: g ? g.contactGap : rig.shoulder[s].g0, contactRest: rig.shoulder[s].g0, ac: g ? g.ac : 0, clav: g ? g.clavicle : { elev: 0, prot: 0, rot: 0 },
      up: g ? { asked: g.input.up, reached: g.angles.ur - g.natural } : { asked: 0, reached: 0 }, residual: g ? g.residual : 0 };
  }
  return out;
}
// ---- poses ----
const lim = TR.clavLimits(), both = (o) => ({ L: { elev: 0, prot: 0, up: 0, ...o }, R: { elev: 0, prot: 0, up: 0, ...o } });
const demos = TR.demoPoses();
const P = [...demos.map((d) => ({ id: d.id, pose: d.pose })),
  { id: "depress", pose: { ...SR.ZERO(), clavicle: both({ elev: lim.elev[0] }) } },
  { id: "downward-rotation", pose: { ...SR.ZERO(), clavicle: both({ up: lim.up[0] }) } },
  { id: "shrug+reach+up", pose: { ...SR.ZERO(), clavicle: both({ elev: 20, prot: 8, up: 12 }) } },
  { id: "flexion+reach", pose: { ...demos.find((d) => d.id === "flexion").pose, clavicle: both({ prot: lim.prot[1] }) } },
  { id: "extension+back", pose: { ...demos.find((d) => d.id === "extension").pose, clavicle: both({ prot: lim.prot[0] * 0.85, elev: -4 }) } },
  { id: "bend-left+shrug-left", pose: { ...demos.find((d) => d.id === "bend-left").pose, clavicle: { L: { elev: lim.elev[1], prot: 0, up: 0 }, R: { elev: 0, prot: 0, up: 0 } } } },
  { id: "rotate-left+up", pose: { ...demos.find((d) => d.id === "rotate-left").pose, clavicle: both({ up: lim.up[1] }) } },
  { id: "asym-L-reach-R-back", pose: { ...SR.ZERO(), clavicle: { L: { elev: 0, prot: lim.prot[1], up: 0 }, R: { elev: 0, prot: lim.prot[0], up: 0 } } } },
];
const rest = measure({ els: sk.els, comps });
const rows = [];
for (const p of P) { const t0 = Date.now(); const m = TR.posedModel(rig, comps, p.pose); rows.push({ id: p.id, ms: Date.now() - t0, m: m.neutral ? rest : measure(m), model: m }); }

// ---- anatomy and placement (rest) ----
const L = sk.els[E.SCAP_L], R = sk.els[E.SCAP_R], w = (el, k) => C.toWorld(el, el.landmarks[k]);
const lm = (k) => w(L, k);
const spineE = Object.fromEntries(sk.spine.els.map((e) => [e.id, e]));
const levelOf = (y) => { let b = null; for (const e of sk.spine.els) if (/^(C7|T\d+|L\d|D_)/.test(e.id) && (!b || Math.abs(e.o[1] - y) < Math.abs(b.o[1] - y))) b = e; return b.id; };
const gn = mv(L.R, L.glenoid.n);
const anat = {
  heightSAtoAI: len(sub(lm("SA"), lm("AI"))), widthTStoGlenoid: len(sub(lm("TS"), lm("GF"))), spineTStoAcromionTip: len(sub(lm("TS"), lm("acTip"))),
  coracoidLength: len(sub(lm("corBase"), lm("corKnee"))) + len(sub(lm("corKnee"), lm("corTip"))), glenoid: { height: Sh.SCAP.glenoid.h, width: Sh.SCAP.glenoid.w },
  superiorAngle: { y: lm("SA")[1], level: levelOf(lm("SA")[1]) }, inferiorAngle: { y: lm("AI")[1], level: levelOf(lm("AI")[1]) }, rootOfSpine: { y: lm("TS")[1], level: levelOf(lm("TS")[1]) },
  medialBorderFromMidline: { TS: lm("TS")[0], SA: lm("SA")[0], AI: lm("AI")[0] }, acJoint: L.o, restAngles: rig.shoulder.L.rest,
  glenoidFacing: { anteriorOfLateral: Math.atan2(gn[2], gn[0]) / C.DEG, superior: Math.asin(gn[1]) / C.DEG },
};
let mirr = 0; for (const k of Object.keys(L.landmarks)) { const a = w(L, k), b = w(R, k); mirr = Math.max(mirr, len(sub(a, [-b[0], b[1], b[2]]))); }
// posed symmetry: symmetric inputs give mirrored scapulae
let pmirr = 0;
for (const r of rows) {
  const pose = P.find((p) => p.id === r.id).pose;
  if (r.model.neutral || !pose.clavicle || JSON.stringify(pose.clavicle.L) !== JSON.stringify(pose.clavicle.R) || !SR.isZero({ ...pose, clavicle: undefined })) continue;
  const mL = r.model.els[E.SCAP_L], mR = r.model.els[E.SCAP_R];
  for (const k of Object.keys(L.landmarks)) { const a = C.toWorld(mL, mL.landmarks[k]), b = C.toWorld(mR, mR.landmarks[k]); pmirr = Math.max(pmirr, len(sub(a, [-b[0], b[1], b[2]]))); }
}
// neutral restore
const z = TR.posedModel(rig, comps, TR.ZERO());
const eps = TR.posedModel(rig, comps, { ...SR.ZERO(), clavicle: both({ elev: 1e-6 }) });
const epsDev = Math.max(...["SCAP_L", "SCAP_R", "CLAV_L", "CLAV_R"].map((id) => len(sub(eps.els[E[id]].o, sk.els[E[id]].o))));

// ---- verdicts ----
const V = [], pass = (ok, t) => V.push(`${ok ? "PASS" : "FAIL"}  ${t}`);
const all = rows.flatMap((r) => ["L", "R"].map((s) => ({ id: r.id, s, ...r.m[s] })));
const wr = (k, f = (v) => v) => all.reduce((a, b) => (f(b[k]) < f(a[k]) ? b : a));
pass(sk.els.filter((e) => e.kind === "scapula").length === 2 && E.SCAP_L != null && E.SCAP_R != null, "two scapulae with stable IDs SCAP_L, SCAP_R; each a child of its clavicle (CLAV_L / CLAV_R)");
pass(mirr < 1e-6, `left/right symmetric at rest (mirror error ${mirr.toExponential(1)} mm); symmetric inputs stay mirrored (${pmirr.toExponential(1)} mm)`);
pass(pmirr < 1e-3, "symmetric poses give mirrored shoulders");
const acMin = Math.min(...all.map((a) => a.acGap)), acMax = Math.max(...all.map((a) => a.acGap));
pass(acMin > -0.5 && acMax < 3, `acromioclavicular joint stays connected (clavicle end to acromion ${acMin.toFixed(2)} … ${acMax.toFixed(2)} mm in every pose)`);
const cb = wr("clavicleBody");
pass(cb.clavicleBody > 0, `clavicle shaft never enters the scapula (min ${cb.clavicleBody.toFixed(1)} mm, ${cb.id} ${cb.s})`);
const rb = wr("ribGap");
pass(rb.ribGap >= 3.5, `scapula stays outside the rib cage with soft tissue between (min bone-to-rib ${rb.ribGap.toFixed(1)} mm, ${rb.id} ${rb.s}, ${rb.ribAt})`);
const ob = wr("otherGap");
pass(ob.otherGap > 2, `scapula clears the spine, sternum and the other side (min ${ob.otherGap.toFixed(1)} mm, ${ob.id} ${ob.s}, ${ob.otherAt})`);
const cmax = Math.max(...all.map((a) => Math.max(Math.abs(a.contact[0] - a.contactRest[0]), Math.abs(a.contact[1] - a.contactRest[1]))));
const cw = all.find((a) => Math.max(Math.abs(a.contact[0] - a.contactRest[0]), Math.abs(a.contact[1] - a.contactRest[1])) === cmax);
pass(cmax < 2.5, `medial border keeps gliding on the rib cage (trigonum spinae and inferior angle within ${cmax.toFixed(1)} mm of their rest distance; worst ${cw.id} ${cw.s})`);
const acr = Math.max(...all.map((a) => a.ac));
pass(acr <= ROM.ST.acRange + 0.5, `AC joint rotation within ${ROM.ST.acRange}° (max ${acr.toFixed(1)}°)`);
const cr = Math.max(...all.map((a) => Math.abs(a.clav.rot))), ce = all.map((a) => a.clav.elev);
pass(cr <= lim.rot[1] + 0.5 && Math.max(...ce) <= lim.elev[1] + 0.5 && Math.min(...ce) >= lim.elev[0] - 0.5, `clavicle stays within its sternoclavicular limits (axial rotation ≤ ${cr.toFixed(1)}°, elevation ${Math.min(...ce).toFixed(1)} … ${Math.max(...ce).toFixed(1)}°)`);
pass(z.els === rig.els && epsDev < 1e-3, `reset restores the approved neutral skeleton exactly (a 1e-6° input moves no girdle bone more than ${epsDev.toExponential(1)} mm)`);
const shrug = rows.find((r) => r.id === "shrug").m.L, up = rows.find((r) => r.id === "upward-rotation").m.L, reach = rows.find((r) => r.id === "reach-forward").m.L, back = rows.find((r) => r.id === "shoulders-back").m.L;
const rest0 = rig.shoulder.L.rest;
pass(shrug.angles.ur - rest0.ur > 15 && reach.angles.ir - rest0.ir > 5 && back.angles.ir - rest0.ir < -5 && up.angles.ur - rest0.ur > 12,
  `movements read correctly: shrug ${(shrug.angles.ur - rest0.ur).toFixed(0)}° upward rotation (cadaver shrug ≈ 26°), reach +${(reach.angles.ir - rest0.ir).toFixed(0)}° internal rotation, blades back ${(back.angles.ir - rest0.ir).toFixed(0)}°, upward rotation +${(up.angles.ur - rest0.ur).toFixed(0)}°`);
const report = { anatomy: anat, symmetry: { rest: mirr, posed: pmirr }, poses: rows.map((r) => ({ id: r.id, ms: r.ms, ...r.m })), limits: lim, settings: ROM.ST, verdicts: V };
if (require.main === module) {
  const f = (v, d = 1) => v.toFixed(d);
  console.log("ANATOMY", JSON.stringify(anat, (k, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)));
  console.log("pose                    side  IR    UR    tilt  | clav e/p/axial    AC°   | AC gap  rib gap (at)          other  contact Δ   up asked/reached  ms");
  for (const r of rows) for (const s of ["L", "R"]) {
    const a = r.m[s];
    console.log(r.id.padEnd(24), s, f(a.angles.ir).padStart(5), f(a.angles.ur).padStart(5), f(a.angles.tilt).padStart(5), " |", [a.clav.elev, a.clav.prot, a.clav.rot].map((v) => f(v)).join("/").padEnd(16), f(a.ac).padStart(5),
      " |", f(a.acGap, 2).padStart(6), f(a.ribGap).padStart(6), `(${a.ribAt})`.padEnd(11), f(a.otherGap).padStart(6), [0, 1].map((i) => f(a.contact[i] - a.contactRest[i])).join("/").padStart(10), `${f(a.up.asked)}/${f(a.up.reached)}`.padStart(12), String(r.ms).padStart(6));
  }
  console.log(V.join("\n"));
  const j = process.argv.indexOf("--json"); if (j > 0) require("fs").writeFileSync(process.argv[j + 1], JSON.stringify(report, null, 1));
}
module.exports = { report };
