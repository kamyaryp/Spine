// node tools/export-rig.js [out.json] -> element frames, motion segments, pivots and ranges of motion
const fs = require("fs");
const S = require("../src/spine-core.js");
const r = S.build(), D = S.DEG, E = Object.fromEntries(r.els.map((e) => [e.id, e]));
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;
const axes = (e) => ({ x: [1, 0, 0], y: [0, r3(Math.cos(e.psi)), r3(Math.sin(e.psi))], z: [0, r3(-Math.sin(e.psi)), r3(Math.cos(e.psi))] });
const order = ["S", "L5", "L4", "L3", "L2", "L1", "T12", "T11", "T10", "T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2", "T1", "C7", "C6", "C5", "C4", "C3", "C2", "C1"];
const parentOf = { S: null, Co: "S" }; for (let i = 1; i < order.length; i++) parentOf[order[i]] = order[i - 1];
const elements = r.els.map((e) => ({
  id: e.id, name: e.name, kind: e.kind, region: e.region,
  parent: e.kind === "disc" ? null : parentOf[e.id] ?? null,
  rigid: e.kind !== "disc",
  between: e.kind === "disc" ? { cranial: e.up, caudal: e.lo === "S1" ? "S" : e.lo } : undefined,
  origin: e.o.map(r1), axes: axes(e), sagittalTiltDeg: r1(e.psi / D),
  size: { width: r1(e.W), depth: r1(e.D), height: r1(e.hc) }, wedgeDeg: e.w != null ? e.w : undefined,
}));
// Motion segments: pivot = estimated mean centre of rotation for flexion-extension (sagittal plane)
const segs = [];
const toW = (e, l) => S.toWorld(e, l).map(r1);
for (let i = 1; i < order.length; i++) {
  const lo = E[order[i - 1]], up = E[order[i]], name = `${up.id}-${lo.id === "S" ? "S1" : lo.id}`;
  const disc = r.els.find((d) => d.kind === "disc" && d.up === up.id);
  let pivot, rule;
  if (up.id === "C1") { pivot = toW(lo, [0, lo.hc / 2 + 8, lo.axis.densZ]); rule = "C1–C2: axis of the dens (rotation), atlanto-dental level"; }
  else if (up.region === "cervical") { pivot = toW(lo, [0, lo.hc * 0.2, 0]); rule = "cervical: upper part of the caudal vertebral body"; }
  else if (up.region === "thoracic") { pivot = toW(disc, [0, 0, 0]); rule = "thoracic: centre of the disc"; }
  else { pivot = toW(disc, [0, -disc.hc * 0.25, -disc.D * 0.15]); rule = "lumbar: posterior half of the disc, near the caudal end plate"; }
  const rom = S.ROM[name] || null;
  segs.push({ id: name, cranial: up.id, caudal: lo.id, disc: disc ? disc.id : null, pivot, pivotRule: rule,
    romDeg: rom && { flexionExtension: rom[0], lateralBendOneSide: rom[1], axialRotationOneSide: rom[2] } });
}
const out = {
  about: "Spinal column rig for a 183 cm, 78 kg adult female in neutral standing. Units mm, degrees. Character space: x left, y up (floor = 0), z anterior.",
  subject: r.subject, posture: r.posture,
  conventions: { localFrame: "origin at the body centre; y along the body axis (normal to the mid-plane between end plates); z anterior; x left",
    discs: "deformable: recompute from the end plates of their two vertebrae", hierarchy: "sacrum is the root (attach to the pelvis later); each vertebra's parent is the one below" },
  romSource: "White & Panjabi, Clinical Biomechanics of the Spine, 2nd ed. (representative values)",
  elements, motionSegments: segs,
};
const f = process.argv[2] || "spine-rig.json"; fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log("wrote", f, elements.length, "elements,", segs.length, "segments");
