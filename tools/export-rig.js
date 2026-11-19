// node tools/export-rig.js [out.json] -> element frames, motion segments (pivots, limits, coupling) and control limits
const fs = require("fs");
const S = require("../src/spine-core.js"), Rig = require("../src/spine-rig.js"), ROM = require("../src/spine-rom.js");
const r = S.build(), D = S.DEG, rig = Rig.makeRig(r);
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;
const axes = (e) => ({ x: [1, 0, 0], y: [0, r3(Math.cos(e.psi)), r3(Math.sin(e.psi))], z: [0, r3(-Math.sin(e.psi)), r3(Math.cos(e.psi))] });
const parentOf = { S: null, Co: "S" }; for (let i = 1; i < Rig.CHAIN.length; i++) parentOf[Rig.CHAIN[i]] = Rig.CHAIN[i - 1];
const elements = r.els.map((e) => ({
  id: e.id, name: e.name, kind: e.kind, region: e.region, parent: e.kind === "disc" ? null : parentOf[e.id] ?? null, rigid: e.kind !== "disc",
  between: e.kind === "disc" ? { cranial: e.up, caudal: e.lo === "S1" ? "S" : e.lo } : undefined,
  restOrigin: e.o.map(r1), restAxes: axes(e), sagittalTiltDeg: r1(e.psi / D), size: { width: r1(e.W), depth: r1(e.D), height: r1(e.hc) },
}));
const segments = ROM.SEGMENTS.map((s) => {
  const p = rig.pivots[s.id];
  return { id: s.id, region: s.region, cranial: p.up, caudal: p.lo, pivotWorld: p.world.map(r1), pivotLocalToCaudal: p.local.map(r1),
    activeDeg: { flexion: s.flex, extension: s.ext, lateralBendEachSide: s.lb, axialRotationEachSide: s.ar }, capDeg: s.cap, coupling: s.couple,
    passiveReferenceDeg: s.passive, sources: s.refs, approximation: s.approx };
});
const out = {
  about: "Spinal rig for a 183 cm, 78 kg adult female; rest pose = approved neutral standing column. Units mm, degrees. x left, y up (floor 0), z anterior.",
  conventions: { pose: "flexion +, extension −; left bend +; left rotation +. Segment 'C4-C5' = C4 relative to C5.",
    rotationOrder: "in the caudal vertebra's frame: flexion about x, then bending about z, then axial rotation about y, each about the segment pivot",
    discs: "deformable: each end plate follows its own vertebra; the disc body sits halfway", root: "sacrum is the root, fixed by default; whole-sacrum control rotates about the hip axis" },
  measure: "active, physiological, in vivo, neutral to one side", conservative: ROM.SETTINGS.conservative, envelope: ROM.SETTINGS.envelope,
  regions: Object.fromEntries(ROM.REGIONS.map((k) => [k, { activeDeg: ROM.REGION[k], controlLimitsDeg: Rig.regionLimits(k) }])),
  references: ROM.REFS, elements, segments, demos: Rig.demoPoses(),
};
const f = process.argv[2] || "spine-rig.json"; fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log("wrote", f, elements.length, "elements,", segments.length, "segments");
