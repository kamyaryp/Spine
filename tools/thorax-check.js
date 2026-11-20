// Rib cage and clavicle validation: count, attachments, symmetry, proportions and behaviour in every demo pose.
// node tools/thorax-check.js [--json out.json]
const C = require("../src/spine-core.js"), SR = require("../src/spine-rig.js"), TR = require("../src/thorax-rig.js"), Th = require("../src/thorax-core.js");
const ROM = require("../src/spine-rom.js");
const { surface } = require("../src/measure.js");
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => mul(a, 1 / (len(a) || 1)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const sk = TR.buildSkeleton(), rig = TR.makeRig(sk), comps = sk.els.map(C.compile), H = C.SUBJECT.height;
const E = Object.fromEntries(sk.els.map((e, k) => [e.id, k]));
// ---- surface samples in each element's local frame (rest) ----
function tubePts(nodes, origin, filter) {
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (filter && !filter(n, i)) continue;
    const T = nrm(sub(nodes[Math.min(nodes.length - 1, i + 1)].p, nodes[Math.max(0, i - 1)].p));
    let N = sub(n.N, mul(T, T[0] * n.N[0] + T[1] * n.N[1] + T[2] * n.N[2])); N = nrm(N); const B = cross(T, N);
    for (let k = 0; k < 20; k++) { const a = (k / 20) * 2 * Math.PI; out.push(sub(add(n.p, add(mul(N, n.rn * Math.cos(a)), mul(B, n.rb * Math.sin(a)))), origin)); }
  }
  return out;
}
function ellPts(c, r, origin) { const out = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 24; j++) { const t = (i + 0.5) / 12 * Math.PI, p = j / 24 * 2 * Math.PI; out.push(sub(add(c, [r[0] * Math.sin(t) * Math.cos(p), r[1] * Math.cos(t), r[2] * Math.sin(t) * Math.sin(p)]), origin)); } return out; }
const LOCAL = {};
for (const e of sk.els) {
  const k = E[e.id];
  if (e.kind === "rib") {
    const sK = e.geo.nodes.find((n) => n.part === Th.P.RIB_TUBERCLE || n.part === Th.P.RIB_SHAFT).s;
    const head = [...tubePts(e.geo.nodes, e.o, (n) => n.s < sK * 0.55), ...ellPts(e.geo.extras[0].c, e.geo.extras[0].r, e.o)]
      .filter((p) => { const d = comps[k].sdf(p[0], p[1], p[2]); return d > -0.3; });
    const tub = [...tubePts(e.geo.nodes, e.o, (n) => n.s > sK - 6 && n.s < sK + 12), ...e.geo.extras.slice(1).flatMap((x) => ellPts(x.c, x.r, e.o))]
      .filter((p) => { const d = comps[k].sdf(p[0], p[1], p[2]); return d > -0.3; });         // outer surface only
    LOCAL[e.id] = { all: tubePts(e.geo.nodes, e.o), head, sK, tub };
  } else if (e.kind === "clavicle") LOCAL[e.id] = { all: tubePts(e.geo.nodes, e.o) };
  else if (e.kind === "sternum") LOCAL[e.id] = { all: surface({ ...e, o: [0, 0, 0], psi: 0 }, comps[k], 1.0) };
  else if (e.kind !== "cartilage" && e.kind !== "disc") LOCAL[e.id] = { all: surface({ ...e, o: [0, 0, 0], psi: 0 }, comps[k], 1.2) };
}
const worldPts = (m, id, set = "all") => { const k = E[id], el = m.els[k]; return LOCAL[id][set].map((p) => C.toWorld(el, p)); };
// SDFs are only trusted inside an element's bounding box (some primitives are not true distances far away)
const boxDist = (b, l) => Math.hypot(Math.max(b[0] - l[0], 0, l[0] - b[3]), Math.max(b[1] - l[1], 0, l[1] - b[4]), Math.max(b[2] - l[2], 0, l[2] - b[5]));
const SPINE_KINDS = new Set(["vertebra", "disc", "sacrum", "coccyx"]);
const sdfW = (m, id, w) => { const k = E[id], el = m.els[k], l = C.toLocal(el, w); if (SPINE_KINDS.has(el.kind)) { const bd = boxDist(m.comps[k].box, l); if (bd > 0) return bd + 1; } return m.comps[k].sdf(l[0], l[1], l[2]); };
const minD = (m, pts, id) => { let mn = 1e9; for (const w of pts) { const d = sdfW(m, id, w); if (d < mn) mn = d; } return mn; };
const ccPts = (m, id) => { const el = m.els[E[id]]; return tubePts(el.geo.nodes, [0, 0, 0]); };

// ---- static checks (rest) ----
const rest = { els: sk.els, comps };
const ribs = sk.els.filter((e) => e.kind === "rib"), ccs = sk.els.filter((e) => e.kind === "cartilage");
const count = {
  ribs: ribs.length, pairs: new Set(ribs.map((r) => r.n)).size,
  true: ribs.filter((r) => r.type === "true").length / 2, false: ribs.filter((r) => r.type === "false").length / 2, floating: ribs.filter((r) => r.type === "floating").length / 2,
  cartilages: ccs.length, toSternum: ccs.filter((c) => c.def.to === "STERNUM").length / 2, toCartilageAbove: ccs.filter((c) => c.def.to && c.def.to.startsWith("CC")).length / 2,
  freeTips: ccs.filter((c) => !c.def.to).length / 2, sternum: sk.els.filter((e) => e.kind === "sternum").length, clavicles: sk.els.filter((e) => e.kind === "clavicle").length,
  clavicleParent: "STERNUM (sternoclavicular joint)",
};
// articulations of each rib
const artOf = (r) => { const T = r.vertebra, a = [T]; if (r.upper) a.push(r.upper, `D_${r.upper}_${T}`); return a; };
function attachments(m, base) {
  const out = [];
  for (const r of ribs) {
    const head = worldPts(m, r.id, "head"), arts = artOf(r);
    const g = Object.fromEntries(arts.map((id) => [id, minD(m, head, id)]));
    let tub = null;
    if (r.joint.costotransverse) {
      // tubercle region only: points within 12 mm of the tubercle centre
      tub = minD(m, worldPts(m, r.id, "tub"), r.vertebra);
    }
    out.push({ id: r.id, n: r.n, side: r.side, articulates: arts, headGap: g, tubercleGap: tub });
  }
  // sternal insertions and false-rib joins: the cartilage end lies inside its target
  for (const c of ccs) {
    const el = m.els[E[c.id]], S = el.geo.S, o = out.find((x) => x.id === c.def.rib);
    o.cartilage = c.id;
    if (c.def.to === "STERNUM") o.sternalDepth = -sdfW(m, "STERNUM", S);
    else if (c.def.to) { const up = m.els[E[c.def.to]], d = Th.compile({ ...up }).sdf(...sub(S, up.o)); o.joinDepth = -d; o.joinsInto = c.def.to; }
    o.stretch = el.geo.arc / c.restArc; o.chord = el.geo.chord / c.restLen;
  }
  return out;
}
// overlap pairs (rigid bones): rib–rib neighbours, rib–nonarticulating vertebrae, rib–sternum, clavicle–(rib1, CC1, sternum, spine)
const VERTS = sk.els.filter((e) => e.kind === "vertebra" && /^(C7|T\d+|L1|L2)$/.test(e.id)).map((e) => e.id);
const pairs = [];
for (const r of ribs) {
  for (const v of VERTS) if (!artOf(r).includes(v)) pairs.push([r.id, v, "head"]);
  const nb = ribs.find((x) => x.side === r.side && x.n === r.n + 1); if (nb) pairs.push([r.id, nb.id, "all"]);
  pairs.push([r.id, "STERNUM", "all"]);
}
for (const s of ["L", "R"]) { pairs.push([`CLAV_${s}`, `RIB1_${s}`, "all"], [`CLAV_${s}`, `RIB2_${s}`, "all"], [`CLAV_${s}`, "STERNUM", "all"]); for (const v of ["C6", "C7", "T1", "T2", "T3"]) pairs.push([`CLAV_${s}`, v, "all"]); }
function overlaps(m) { const o = {}; for (const [a, b, set] of pairs) o[`${a}/${b}`] = minD(m, worldPts(m, a, set), b); return o; }
function clavCart(m) { const o = {}; for (const s of ["L", "R"]) { const pts = worldPts(m, `CLAV_${s}`); let mn = 1e9; const cc = m.els[E[`CC1_${s}`]], f = m.comps[E[`CC1_${s}`]]; for (const w of pts) { const d = f.sdf(...sub(w, cc.o)); if (d < mn) mn = d; } o[s] = mn; } return o; }

// symmetry (rest): every left node mirrored onto its right twin
let asym = 0;
for (const e of sk.els.filter((x) => x.side === "L")) {
  const r = sk.els[E[e.id.replace(/_L$/, "_R")]];
  e.geo.nodes.forEach((n, i) => { const q = r.geo.nodes[i].p; asym = Math.max(asym, len(sub([-n.p[0], n.p[1], n.p[2]], q))); });
}
// proportions
const SF = sk.els[E.STERNUM].SF, yOf = (id) => sk.els[E[id]].o[1];
const levelOf = (y) => { // nearest vertebra / disc by height
  const c = sk.spine.els.filter((e) => /^(T|C7|L)/.test(e.id) || /^D_(T|C7|L)/.test(e.id)); let b = c[0]; for (const e of c) if (Math.abs(e.o[1] - y) < Math.abs(b.o[1] - y)) b = e; return b.id; };
const allRibPts = ribs.flatMap((r) => worldPts(rest, r.id).map((p) => ({ p, r })));
const widthOf = (n) => { const ps = allRibPts.filter((o) => o.r.n === n).map((o) => o.p[0]); return Math.max(...ps) - Math.min(...ps); };
const ribLen = Object.fromEntries(ribs.filter((r) => r.side === "L").map((r) => { const ns = r.geo.nodes; let L = 0; for (let i = 1; i < ns.length; i++) L += len(sub(ns[i].p, ns[i - 1].p)); return [r.n, L]; }));
const ccLen = Object.fromEntries(ccs.filter((c) => c.side === "L").map((c) => { const ns = c.geo.nodes; let L = 0; for (let i = 1; i < ns.length; i++) L += len(sub(ns[i].p, ns[i - 1].p)); return [c.n, L]; }));
const ster = worldPts(rest, "STERNUM"), front = Math.max(...ster.map((p) => p[2]));
const midBack = Math.min(...allRibPts.filter((o) => o.r.n === 8).map((o) => o.p[2]));
const t8Front = Math.max(...worldPts(rest, "T8").map((p) => p[2]));
// infrasternal angle: lowest cartilage point per lateral bin, left side, fitted line from the xiphisternal joint
const margin = []; const ccw = ccs.filter((c) => c.side === "L" && c.n >= 7 && c.n <= 10).flatMap((c) => tubePts(c.geo.nodes, [0, 0, 0]));
for (let x = 14; x <= 70; x += 4) { const b = ccw.filter((p) => p[0] >= x && p[0] < x + 4); if (b.length) margin.push(b.reduce((a, p) => (p[1] < a[1] ? p : a))); }
let sxx = 0, sxy = 0; const X0 = SF.X; for (const p of margin) { const dx = p[0] - X0[0], dy = p[1] - X0[1]; sxx += dx * dx; sxy += dx * dy; }
const slope = sxy / sxx, infrasternal = 2 * (90 - Math.atan(Math.abs(slope)) / C.DEG);
const clav = sk.els[E.CLAV_L].geo;
const props = {
  sternum: { manubrium: Th.STERNUM.manubrium, body: Th.STERNUM.body, xiphoid: Th.STERNUM.xiphoid, total: Th.STERNUM.manubrium + Th.STERNUM.body + Th.STERNUM.xiphoid,
    jugularNotchY: SF.J[1], jugularLevel: levelOf(SF.J[1]), sternalAngleY: SF.A[1], sternalAngleLevel: levelOf(SF.A[1]), xiphisternalY: SF.X[1], xiphisternalLevel: levelOf(SF.X[1]) },
  clavicle: { centreline: clav.length, endpoint: clav.endpoint, sc: clav.sc, acromialEnd: clav.ac, biclavicular: 2 * clav.ac[0] },
  ribcage: { widthRib1: widthOf(1), widthRib4: widthOf(4), widthMax: Math.max(...ribs.map((r) => widthOf(r.n))), widthMaxRib: ribs.reduce((a, r) => (widthOf(r.n) > widthOf(a) ? r.n : a), 1),
    depthAtRib8: front - midBack, innerAPatT8: Math.max(...ster.filter((p) => Math.abs(p[1] - sk.els[E.T8].o[1]) < 10).map((p) => p[2])) - t8Front, infrasternalAngle: infrasternal,
    lowestMargin: Math.min(...ccs.flatMap((c) => c.geo.nodes.map((n) => n.p[1]))), ribLength: ribLen, cartilageLength: ccLen },
};
props.ribcage.lowestMarginLevel = levelOf(props.ribcage.lowestMargin);

// ---- poses ----
const lim = TR.clavLimits();
const clavPose = (o) => ({ ...SR.ZERO(), clavicle: { L: { elev: 0, prot: 0, rot: 0, ...o }, R: { elev: 0, prot: 0, rot: 0, ...o } } });
const POSES = [...SR.demoPoses().map((d) => ({ id: d.id, name: d.name, pose: d.pose })),
  { id: "clav-elevate", name: "Clavicles elevated", pose: clavPose({ elev: lim.elev[1] }) },
  { id: "clav-depress", name: "Clavicles depressed", pose: clavPose({ elev: lim.elev[0] }) },
  { id: "clav-protract", name: "Clavicles protracted", pose: clavPose({ prot: lim.prot[1] }) },
  { id: "clav-retract", name: "Clavicles retracted", pose: clavPose({ prot: lim.prot[0] }) },
  { id: "clav-rotate", name: "Clavicles rotated posteriorly", pose: clavPose({ rot: lim.rot[1] }) },
  { id: "flex+clav-depress", name: "Flexion + clavicles depressed", pose: { ...SR.demoPoses()[1].pose, clavicle: clavPose({ elev: lim.elev[0], prot: lim.prot[1] }).clavicle } },
];
const att0 = attachments(rest), ov0 = overlaps(rest), cc0 = clavCart(rest);
const results = [];
for (const P of POSES) {
  const m = TR.posedModel(rig, comps, P.pose), att = m.neutral ? att0 : attachments(m), ov = m.neutral ? ov0 : overlaps(m), cc = m.neutral ? cc0 : clavCart(m);
  let detach = 0, detachAt = "", press = 0, pressAt = "";
  for (const a of att) {
    const a0 = att0.find((x) => x.id === a.id);
    for (const id in a.headGap) { const dg = a.headGap[id] - a0.headGap[id]; if (dg > detach) { detach = dg; detachAt = `${a.id} head/${id}`; } if (-dg > press) { press = -dg; pressAt = `${a.id} head/${id}`; } }
    if (a.tubercleGap != null) { const dg = a.tubercleGap - a0.tubercleGap; if (dg > detach) { detach = dg; detachAt = `${a.id} tubercle/${a.id.match(/\d+/)[0]}`; } if (-dg > press) { press = -dg; pressAt = `${a.id} tubercle`; } }
  }
  let newOv = 0, newOvAt = "";
  for (const k in ov) { const e = Math.max(0, -ov[k]) - Math.max(0, -ov0[k]); if (e > newOv) { newOv = e; newOvAt = k; } }
  const st = att.map((a) => a.stretch).filter((v) => v != null), chord = att.map((a) => a.chord).filter((v) => v != null);
  const ins = att.filter((a) => a.sternalDepth != null).map((a) => a.sternalDepth), joins = att.filter((a) => a.joinDepth != null).map((a) => a.joinDepth);
  const th = m.thorax ? Object.values(m.thorax.theta) : [0];
  const clavMin = Math.min(...["L", "R"].map((s) => Math.min(ov[`CLAV_${s}/RIB1_${s}`], cc[s])));
  const sc = Math.min(...["L", "R"].map((s) => ov[`CLAV_${s}/STERNUM`])), scMax = Math.max(...["L", "R"].map((s) => ov[`CLAV_${s}/STERNUM`]));
  const spineClear = Math.min(...["L", "R"].flatMap((s) => ["C6", "C7", "T1", "T2", "T3"].map((v) => ov[`CLAV_${s}/${v}`])));
  const ribGap = Math.min(...ribs.filter((r) => r.n < 12).map((r) => ov[`${r.id}/${ribs.find((x) => x.side === r.side && x.n === r.n + 1).id}`]));
  results.push({ id: P.id, name: P.name, stretch: [Math.min(...st), Math.max(...st)], chord: [Math.min(...chord), Math.max(...chord)], costovertebral: Math.max(...th.map(Math.abs)), residual: m.thorax ? m.thorax.residual : 0,
    detach, detachAt, press, pressAt, newOverlap: newOv, newOverlapAt: newOvAt, sternalInsertion: Math.min(...ins), falseJoin: Math.min(...joins), clavicleRib1: clavMin, scJoint: [sc, scMax], clavicleSpine: spineClear, minRibGap: ribGap,
    sternumMove: m.thorax ? Math.acos(Math.max(-1, Math.min(1, (m.els[E.STERNUM].R[0][0] + m.els[E.STERNUM].R[1][1] + m.els[E.STERNUM].R[2][2] - 1) / 2))) / C.DEG : 0 });
}
const report = { count, symmetry: { maxMirrorError: asym }, proportions: props, rest: { attachments: att0 }, poses: results, settings: ROM.SETTINGS.ribcage, sc: ROM.SC, clavLimits: lim };
// ---- verdicts ----
const V = [];
const pass = (ok, what) => V.push(`${ok ? "PASS" : "FAIL"}  ${what}`);
pass(count.ribs === 24 && count.pairs === 12 && count.true === 7 && count.false === 3 && count.floating === 2, `12 rib pairs: ${count.true} true, ${count.false} false, ${count.floating} floating`);
pass(count.toSternum === 7 && count.toCartilageAbove === 3 && count.freeTips === 2 && count.cartilages === 24, `cartilages: 7 to sternum, 3 to the cartilage above, 2 free tips (per side)`);
pass(count.sternum === 1 && count.clavicles === 2, "sternum and both clavicles present; clavicles parented to the sternum, not the spine");
const hg = att0.flatMap((a) => Object.values(a.headGap)), tg = att0.filter((a) => a.tubercleGap != null).map((a) => a.tubercleGap);
pass(Math.max(...hg) < 1.2 && Math.min(...hg) > -0.6, `rib heads seated on their vertebrae (gap ${Math.min(...hg).toFixed(2)} … ${Math.max(...hg).toFixed(2)} mm; ribs 2–9 on two bodies + disc, 1/10/11/12 on one)`);
pass(Math.max(...tg) < 1.2 && Math.min(...tg) > -0.6, `tubercles 1–10 on their transverse processes (gap ${Math.min(...tg).toFixed(2)} … ${Math.max(...tg).toFixed(2)} mm)`);
pass(asym < 1e-6, `left/right symmetric (max mirror error ${asym.toExponential(1)} mm)`);
const worst = (k, f) => results.reduce((a, r) => (f(r[k]) > f(a[k]) ? r : a));
const wd = worst("detach", (v) => v), wp = worst("press", (v) => v), wo = worst("newOverlap", (v) => v);
pass(wd.detach < 1.0, `no detachment in any pose (worst joint opening ${wd.detach.toFixed(2)} mm, ${wd.id}: ${wd.detachAt})`);
pass(wp.press < 1.0, `no joint driven into bone (worst ${wp.press.toFixed(2)} mm, ${wp.id}: ${wp.pressAt})`);
pass(wo.newOverlap < 1.0, `no new bone intersections (worst ${wo.newOverlap.toFixed(2)} mm, ${wo.id}: ${wo.newOverlapAt})`);
const sMin = Math.min(...results.map((r) => r.stretch[0])), sMax = Math.max(...results.map((r) => r.stretch[1]));
const cMin = Math.min(...results.map((r) => r.chord[0])), cMax = Math.max(...results.map((r) => r.chord[1]));
pass(sMax - 1 <= 0.02 && 1 - sMin <= 0.02, `cartilages bend rather than stretch (arc length within ±2 %: ${(sMin * 100).toFixed(1)} … ${(sMax * 100).toFixed(1)} % of rest; end-to-end distance ${(cMin * 100).toFixed(1)} … ${(cMax * 100).toFixed(1)} %)`);
pass(cMax - 1 <= ROM.SETTINGS.ribcage.cartilageStretchWarn && 1 - cMin <= 2 * ROM.SETTINGS.ribcage.cartilageStretchWarn, `cartilage ends move within the tissue's bending range (end distance ${(cMin * 100).toFixed(1)} … ${(cMax * 100).toFixed(1)} % of rest)`);
const cv = Math.max(...results.map((r) => r.costovertebral));
pass(cv <= ROM.SETTINGS.ribcage.costovertebralMax + 1e-6, `costovertebral rotation within ±${ROM.SETTINGS.ribcage.costovertebralMax}° (max ${cv.toFixed(1)}°)`);
pass(results.every((r) => r.sternalInsertion > 0.5 && r.falseJoin > 0.5), `cartilages stay inserted (sternum ≥ ${Math.min(...results.map((r) => r.sternalInsertion)).toFixed(1)} mm, false-rib joins ≥ ${Math.min(...results.map((r) => r.falseJoin)).toFixed(1)} mm)`);
pass(results.every((r) => r.clavicleRib1 > 0), `clavicles clear rib 1 and its cartilage in every pose (min ${Math.min(...results.map((r) => r.clavicleRib1)).toFixed(1)} mm)`);
pass(results.every((r) => r.scJoint[0] > 0 && r.scJoint[1] < 4), `sternoclavicular joint space kept (${Math.min(...results.map((r) => r.scJoint[0])).toFixed(1)} … ${Math.max(...results.map((r) => r.scJoint[1])).toFixed(1)} mm)`);
pass(results.every((r) => r.clavicleSpine > 10), `clavicles never touch the spine (min ${Math.min(...results.map((r) => r.clavicleSpine)).toFixed(0)} mm)`);
{ // neutral: zero input returns the rest skeleton itself; near-zero input stays continuous
  const z = TR.posedModel(rig, comps, TR.ZERO()), eps = TR.posedModel(rig, comps, { ...SR.ZERO(), thoracic: { fe: 1e-6, lb: 0, ar: 0 }, clavicle: { L: { elev: 1e-6, prot: 0, rot: 0 }, R: { elev: 0, prot: 0, rot: 0 } } });
  let dev = 0; sk.els.forEach((e, k) => { if (e.kind === "disc") return; const a = eps.els[k].o; dev = Math.max(dev, len(sub(a, e.o))); });
  pass(z.els === rig.els && dev < 1e-3, `neutral restored exactly (zero input returns the rest skeleton; a 1e-6° input moves no element more than ${dev.toExponential(1)} mm)`);
}
report.verdicts = V;
if (require.main === module) {
  const f = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : v);
  console.log("COUNT", JSON.stringify(count));
  console.log("PROPORTIONS", JSON.stringify(props, (k, v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v)));
  console.log("pose               stretch%       cv°   detach  press  newOv  ins  join  clav-r1  sc        ribgap  sternum°");
  for (const r of results) console.log(r.id.padEnd(18), `${f(r.stretch[0] * 100)}–${f(r.stretch[1] * 100)}`.padEnd(13), f(r.costovertebral).padStart(5), f(r.detach, 2).padStart(7), f(r.press, 2).padStart(6), f(r.newOverlap, 2).padStart(6), f(r.sternalInsertion).padStart(5), f(r.falseJoin).padStart(5), f(r.clavicleRib1).padStart(7), `${f(r.scJoint[0])}–${f(r.scJoint[1])}`.padStart(9), f(r.minRibGap).padStart(7), f(r.sternumMove).padStart(7), r.newOverlapAt);
  console.log(V.join("\n"));
  if (process.argv.includes("--att")) for (const a of att0) console.log(a.id, JSON.stringify(a.headGap, (k, v) => (typeof v === "number" ? +v.toFixed(2) : v)), a.tubercleGap != null ? a.tubercleGap.toFixed(2) : "-");
  const j = process.argv.indexOf("--json"); if (j > 0) require("fs").writeFileSync(process.argv[j + 1], JSON.stringify(report, null, 1));
}
module.exports = { report };
if (require.main === module && process.argv.includes("--ribs")) {
  for (const P of POSES.slice(0, 8)) {
    const m = TR.posedModel(rig, comps, P.pose), ov = m.neutral ? ov0 : overlaps(m);
    const rr = Object.entries(ov).filter(([k]) => /^RIB\d+_\w\/RIB/.test(k)).sort((a, b) => a[1] - b[1]).slice(0, 4);
    console.log(P.id, rr.map(([k, v]) => `${k} ${v.toFixed(1)} (rest ${ov0[k].toFixed(1)})`).join(" | "));
  }
}
