// node tools/export-rig.js [out.json] -> element frames, motion segments (pivots, limits, coupling), control limits, thorax
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
// thorax: ribs, cartilages, sternum, clavicles (rest frames are world-aligned; origin = proximal joint)
const TR = require("../src/thorax-rig.js"), sk = TR.buildSkeleton();
const r1v = (v) => v.map(r1);
out.thorax = {
  about: "Rib cage and clavicles on the spinal rig. Rest frames are world-aligned (axes x, y, z); origin = proximal joint.",
  hierarchy: { rib: "follows its vertebra rigidly + one rotation about its costovertebral axis (head -> tubercle), solved per pose",
    sternum: "rigid; placed per pose where it disturbs the true-rib cartilages least", cartilage: "deformable, rebuilt per pose; keeps its rest arc length (bends, does not stretch)",
    clavicle: "child of the sternum (sternoclavicular joint): elevation, protraction, posterior rotation; never attached to the spine" },
  settings: ROM.SETTINGS.ribcage, sternoclavicular: { rangesDeg: ROM.SC, controlLimitsDeg: TR.clavLimits(), envelope: "|(e, p, r) / limits|_2 <= 1 per side" },
  elements: sk.thorax.els.map((e) => ({ id: e.id, name: e.name, kind: e.kind, side: e.side, number: e.n, type: e.type, restOrigin: r1v(e.o),
    parent: e.kind === "rib" ? e.vertebra : e.kind === "clavicle" ? "STERNUM" : e.kind === "cartilage" ? e.def.rib : null,
    attachesTo: e.kind === "rib" ? [e.vertebra, e.upper].filter(Boolean) : e.kind === "cartilage" ? e.def.to : e.kind === "clavicle" ? "STERNUM" : undefined,
    joint: e.joint ? Object.fromEntries(Object.entries(e.joint).map(([k, v]) => [k, Array.isArray(v) ? r1v(v) : v])) : undefined,
    landmarks: e.landmarks ? Object.fromEntries(Object.entries(e.landmarks).map(([k, v]) => [k, r1v(v)])) : undefined,
    restArcLength: e.restArc ? r1(e.restArc) : undefined })),
  demos: [],
};
// shoulder girdle: scapulae on the clavicles, gliding on the rib cage
const SRig = TR.makeRig(sk), Cc = require("../src/spine-core.js");
out.shoulder = {
  about: "Scapulae hang from the clavicles at the AC joint and glide over the rib cage (soft-tissue gap); no bony joint with ribs or spine.",
  controls: "pose.clavicle[side] = { elev, prot, up }: clavicle elevation and protraction (sternoclavicular), scapular upward rotation; clavicle axial rotation and scapular tilt / internal rotation are solved",
  limitsDeg: TR.clavLimits(), scapulothoracic: ROM.ST,
  elements: sk.shoulder.els.map((e) => ({ id: e.id, name: e.name, side: e.side, parent: e.joint.parent, acJoint: r1v(e.o),
    landmarksWorld: Object.fromEntries(Object.entries(e.landmarks).map(([k, p]) => [k, r1v(Cc.toWorld(e, p))])),
    glenoid: { centre: r1v(Cc.toWorld(e, e.glenoid.c)), normalWorld: e.R.map((row) => r3(row[0] * e.glenoid.n[0] + row[1] * e.glenoid.n[1] + row[2] * e.glenoid.n[2])) }, restAngles: SRig.shoulder[e.side].rest })),
  demos: TR.demoPoses().filter((d) => ["shrug", "shoulders-back", "reach-forward", "upward-rotation"].includes(d.id)),
};
const f = process.argv[2] || "spine-rig.json"; fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log("wrote", f, elements.length, "spine elements,", segments.length, "segments,", out.thorax.elements.length, "thorax elements");
