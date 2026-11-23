// Spinal range-of-motion limits, distribution and coupling: the single place to review and adjust movement.
//
// Reference framework (kept consistent on purpose)
//  - Measure: ACTIVE, PHYSIOLOGICAL, in vivo motion of healthy adults, degrees, from NEUTRAL to the end of range in ONE
//    direction (flexion, extension, left OR right bending, left OR right rotation). Left and right are symmetric.
//  - Per-segment values come from in vivo segmental (radiographic / CT / MRI / fluoroscopic) studies. Regional values are
//    the SUM of those segments; no single joint ever receives a whole region's range.
//  - Passive / cadaveric values (White & Panjabi) are kept only as an upper "never exceed" reference (`passive`) and do
//    not drive the rig. Injury limits are not modelled.
//  - Where a study gives only a region or a range, the per-level split is an approximation and is marked `approx`.
//
// Units: degrees. Sign conventions of the rig (subject's frame): flexion +, extension −; left bend +, right bend −;
// left rotation +, right rotation −. Segment "C4-C5" = motion of the cranial vertebra (C4) relative to the caudal one (C5).
(function (root) {
"use strict";

const REFS = {
  anderst17: "Anderst et al. 2017, J Biomech: dynamic in vivo 3D atlanto-axial kinematics, upright rotation (biplane radiography). C1/C2 axial rotation 36.8 ± 6.7° to one side; coupled contralateral bending 9.8 ± 3.8°.",
  ishii04ax: "Ishii et al. 2004, Spine 29(7): upper cervical kinematics in head rotation, in vivo 3D MRI. C1/C2 axial rotation 36.2° at maximum head rotation.",
  ishii04: "Ishii et al. 2004, Spine 29(24): subaxial cervical kinematics in rotation, in vivo 3D MRI (10 volunteers). Axial rotation C2-3 2.2°, C3-4 4.5°, C4-5 4.6°, C5-6 4.0°, C6-7 1.6°, C7-T1 1.5°; coupled same-side bending 3.6/5.4/5.0/5.3/4.9/1.2°.",
  ishii06: "Ishii et al. 2006, Spine 31(2): cervical kinematics in lateral bending, in vivo 3D MRI (12 volunteers). 1.6–5.7° per level to one side; C1/C2 coupled contralateral rotation 17.1°; subaxial coupled rotation to the same side.",
  wu07: "Wu et al. 2007, Eur Spine J: videofluoroscopy of 56 healthy adults, cervical flexion-extension. C2/3 13.5° to C4/5 22.6° (flexion + extension) per level.",
  atlantoaxialFE: "Atlanto-axial flexion-extension ≈ 20° in total (review statement, Eur Spine J 2023).",
  fujimori12: "Fujimori et al. 2012, Spine 37(21): thoracic trunk rotation, in vivo 3D CT, supine. T1–L1 ≈ 25° to one side (as summarised by Pan et al. 2018).",
  fujimori14: "Fujimori et al. 2014, Spine J 14(9): thoracic lateral bending, in vivo 3D CT, 15 men. T1–L1 15.6 ± 6.3° to one side; T9-10 1.6°, T10-11 1.8°, T11-12 2.3°, T12-L1 2.2°; coupled same-side rotation 6.2°.",
  pan18: "Pan et al. 2018, J Biomech: systematic review of in vivo thoracic shape and mobility. Standing T1–T12 flexion ≈ 21°, extension ≈ 13°; lower levels contribute most to flexion, middle levels most to extension.",
  pearcy84: "Pearcy, Portek & Shepherd 1984, Spine 9(3): biplanar radiography, active standing flexion/extension. Flexion L1-2 8°, L2-3 10°, L3-4 12°, L4-5 13°, L5-S1 9°; extension 5°, 3°, 1°, 2°, 5°.",
  pearcy84b: "Pearcy & Tibrewal 1984, Spine 9(6): biplanar radiography, active axial rotation and lateral bending. About 2° rotation per level (L5-S1 less); bending about 5–6° per level, less at L4-5 and least at L5-S1.",
  fujimori07: "Fujimori et al. 2007, Eur Spine J: lumbar kinematics in trunk rotation, in vivo 3D MRI. 1.2–1.7° per segment at 45° trunk rotation; coupled bending opposite at L1/2–L4/5, same side at L5/S1.",
  whitePanjabi: "White & Panjabi 1990, Clinical Biomechanics of the Spine: representative (largely cadaveric) segmental ranges; used only as a passive upper reference.",
  neumann: "Neumann, Kinesiology of the Musculoskeletal System (3rd ed.): sternoclavicular joint ranges ≈ 45° elevation, 10° depression, 15–20° protraction, 15–30° retraction, 20–35° posterior rotation.",
  ludewig09: "Ludewig et al. 2009, J Bone Joint Surg Am 91(2): in vivo bone-pin kinematics; resting clavicle ≈ 20° retracted and ≈ 6° elevated; with arm elevation it retracts 15–30°, elevates ≈ 10° and rotates posteriorly ≈ 30°.",
  mcclure01: "McClure et al. 2001, J Shoulder Elbow Surg 10(3): bone-pin 3D scapular kinematics in vivo (8 volunteers). Scapular upward rotation, posterior tilt and external rotation increase with arm elevation; maximum upward rotation ≈ 50° (original ISB axes).",
  ludewig10: "Ludewig et al. 2010, J Biomech 43(8): ISB scapular axes compared; maximum upward rotation 43 ± 8° (current standard) at maximum arm elevation.",
  jsesi23: "Cadaveric isolated scapulothoracic motions (JSES International 2023): shrug elevates the clavicle ≈ 25° with ≈ 26° scapular lateral (upward) rotation and ≈ 3° anterior tilt; protraction ≈ +7°, retraction and shrug reduce protraction.",
  wilke17: "Wilke et al. 2017, PLoS One (PMC5453693): in vitro thoracic segments with vs without the rib cage; the rib cage stiffens the segments, most in axial rotation (more than half the range). In vivo values above already include the intact rib cage.",
};

// share = this segment's part of the region's primary motion (deg, one direction, active in vivo)
// cap   = largest magnitude the segment may reach on that axis (primary or documented coupled motion)
// couple: angles reached at 100 % of the region's primary motion: { lb: { ar } } = rotation that accompanies full bending
//         (+ same direction, − opposite); { ar: { lb } } likewise.
const S = (id, region, flex, ext, lb, ar, o = {}) => ({ id, region, flex, ext, lb, ar, ...o });
const SEGMENTS = [
  // cervical (C1-C2 .. C7-T1)
  S("C1-C2", "cervical", 10, 10, 3, 36, { cap: { lb: 10, ar: 37 }, couple: { lb: { ar: -17.1 }, ar: { lb: -9.8 } }, refs: ["anderst17", "ishii04ax", "ishii06", "atlantoaxialFE"], approx: "flexion/extension split evenly; primary bending small", passive: [25, 5, 40] }),
  S("C2-C3", "cervical", 6, 7.5, 5.0, 2.2, { cap: { lb: 5.0 }, couple: { lb: { ar: 2.5 }, ar: { lb: 3.6 } }, refs: ["wu07", "ishii06", "ishii04"], approx: "45/55 flexion/extension split; bending per level within the reported 1.6–5.7°", passive: [10, 10, 3] }),
  S("C3-C4", "cervical", 7.5, 9.5, 5.7, 4.5, { cap: { lb: 5.7 }, couple: { lb: { ar: 2.8 }, ar: { lb: 5.4 } }, refs: ["wu07", "ishii06", "ishii04"], approx: "C3/4 flexion+extension interpolated (17°)", passive: [15, 11, 7] }),
  S("C4-C5", "cervical", 10, 12.5, 5.5, 4.6, { couple: { lb: { ar: 2.7 }, ar: { lb: 5.0 } }, refs: ["wu07", "ishii06", "ishii04"], approx: "45/55 split", passive: [20, 11, 7] }),
  S("C5-C6", "cervical", 9, 11, 4.5, 4.0, { cap: { lb: 5.3 }, couple: { lb: { ar: 2.2 }, ar: { lb: 5.3 } }, refs: ["wu07", "ishii06", "ishii04"], approx: "C5/6 flexion+extension interpolated (20°)", passive: [20, 8, 7] }),
  S("C6-C7", "cervical", 7, 9, 3.5, 1.6, { cap: { lb: 4.9 }, couple: { lb: { ar: 1.7 }, ar: { lb: 4.9 } }, refs: ["wu07", "ishii06", "ishii04"], approx: "C6/7 flexion+extension estimated (16°)", passive: [17, 7, 6] }),
  S("C7-T1", "cervical", 3.5, 4, 1.6, 1.5, { couple: { lb: { ar: 0.8 }, ar: { lb: 1.2 } }, refs: ["ishii06", "ishii04"], approx: "flexion/extension estimated (≈ 7.5° total)", passive: [9, 4, 2] }),
  // thoracic (T1-T2 .. T12-L1)
  S("T1-T2", "thoracic", 1.2, 0.8, 0.9, 2.5, { couple: { lb: { ar: 0.36 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split of regional values", passive: [4, 6, 9] }),
  S("T2-T3", "thoracic", 1.2, 0.9, 0.9, 2.5, { couple: { lb: { ar: 0.36 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [4, 6, 8] }),
  S("T3-T4", "thoracic", 1.3, 1.1, 0.9, 2.5, { couple: { lb: { ar: 0.36 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [4, 6, 8] }),
  S("T4-T5", "thoracic", 1.4, 1.4, 1.0, 2.5, { couple: { lb: { ar: 0.4 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [4, 6, 8] }),
  S("T5-T6", "thoracic", 1.5, 1.5, 1.0, 2.5, { couple: { lb: { ar: 0.4 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [4, 6, 8] }),
  S("T6-T7", "thoracic", 1.6, 1.5, 1.0, 2.5, { couple: { lb: { ar: 0.4 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [5, 6, 7] }),
  S("T7-T8", "thoracic", 1.8, 1.4, 1.1, 2.0, { couple: { lb: { ar: 0.44 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [6, 6, 7] }),
  S("T8-T9", "thoracic", 2.0, 1.2, 1.4, 2.0, { couple: { lb: { ar: 0.56 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "per-level split", passive: [6, 6, 6] }),
  S("T9-T10", "thoracic", 2.2, 1.0, 1.6, 2.0, { couple: { lb: { ar: 0.64 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "bending from Fujimori 2014; rest split", passive: [6, 6, 4] }),
  S("T10-T11", "thoracic", 2.4, 1.0, 1.8, 1.5, { couple: { lb: { ar: 0.72 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "bending from Fujimori 2014; rest split", passive: [9, 7, 2] }),
  S("T11-T12", "thoracic", 2.6, 1.1, 2.3, 1.0, { couple: { lb: { ar: 0.92 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "bending from Fujimori 2014; rest split", passive: [12, 9, 2] }),
  S("T12-L1", "thoracic", 2.8, 1.5, 2.2, 0.8, { couple: { lb: { ar: 0.88 } }, refs: ["pan18", "fujimori14", "fujimori12"], approx: "bending from Fujimori 2014; rest split", passive: [12, 8, 2] }),
  // lumbar (L1-L2 .. L5-S1)
  S("L1-L2", "lumbar", 8, 5, 5.5, 2, { couple: { lb: { ar: -0.8 }, ar: { lb: -1.0 } }, refs: ["pearcy84", "pearcy84b", "fujimori07"], approx: "left/right averaged; coupling magnitudes approximate", passive: [12, 6, 2] }),
  S("L2-L3", "lumbar", 10, 3, 5.5, 2, { couple: { lb: { ar: -0.8 }, ar: { lb: -1.0 } }, refs: ["pearcy84", "pearcy84b", "fujimori07"], approx: "left/right averaged; coupling approximate", passive: [14, 6, 2] }),
  S("L3-L4", "lumbar", 12, 1, 5.5, 2, { couple: { lb: { ar: -0.8 }, ar: { lb: -1.0 } }, refs: ["pearcy84", "pearcy84b", "fujimori07"], approx: "left/right averaged; coupling approximate", passive: [15, 8, 2] }),
  S("L4-L5", "lumbar", 13, 2, 4, 2, { couple: { lb: { ar: -0.6 }, ar: { lb: -1.0 } }, refs: ["pearcy84", "pearcy84b", "fujimori07"], approx: "left/right averaged; coupling approximate", passive: [16, 6, 2] }),
  S("L5-S1", "lumbar", 9, 5, 1, 1, { cap: { lb: 1.5 }, couple: { lb: { ar: 0 }, ar: { lb: 0.5 } }, refs: ["pearcy84", "pearcy84b", "fujimori07"], approx: "bending small and variable; coupling approximate", passive: [17, 3, 1] }),
];
for (const s of SEGMENTS) {
  s.cap = { flex: s.flex, ext: s.ext, lb: s.lb, ar: s.ar, ...(s.cap || {}) };
  s.couple = s.couple || {};
}
const REGIONS = ["cervical", "thoracic", "lumbar"];
// Regional maxima are sums of segment shares (never a single joint).
const REGION = Object.fromEntries(REGIONS.map((r) => {
  const ss = SEGMENTS.filter((s) => s.region === r), sum = (k) => ss.reduce((a, s) => a + s[k], 0);
  return [r, { flex: sum("flex"), ext: sum("ext"), lb: sum("lb"), ar: sum("ar") }];
}));
const SETTINGS = {
  conservative: 0.85,        // controls reach 85 % of the mean active range (mean, not mean + SD)
  envelope: 2,               // combined-motion envelope per region: |(f, b, r) / limits|_p <= 1 with p = 2 (an ellipsoid)
  root: { tilt: 15, obliquity: 10, rotation: 10 },   // whole-sacrum (pelvis) control limits; sacrum fixed by default
  hipPivot: null,            // filled by the rig from the anatomy (hip axis)
  // rib cage (thorax rig): ribs turn on their costovertebral axes, the sternum floats on the true-rib cartilages
  ribcage: { costovertebralMax: 10, cartilageStretchWarn: 0.06 },
};
// Sternoclavicular joint: clavicle relative to the manubrium, degrees from the resting position (one direction).
// Controls reach SETTINGS.conservative of these. Anterior rotation is not modelled (posterior rotation returns to 0).
// Scapulothoracic gliding (scapula relative to the thorax, on top of the clavicle's motion). Upward rotation is the only
// independent scapular control; tilt and internal / external rotation are solved so the scapula keeps gliding on the
// rib cage. Downward rotation below rest is poorly documented in vivo: 10° is an approximation, marked as such.
// AC joint rotations stay within acRange (bone-pin studies report up to ≈ 15–20° per axis; approximation).
// Without arms, scapular upward rotation is limited to what the girdle reaches on its own: ≈ 26° in isolated shrugging
// (jsesi23). The 43–50° reached with full arm elevation (ludewig10, mcclure01) is kept as withArm for the arm stage.
const ST = { upwardRotation: 26, withArm: 45, downwardRotation: 10, acRange: 25, softTissueMin: 5,
  refs: ["jsesi23", "ludewig10", "mcclure01", "ludewig09"], approx: "isolated upward rotation from cadaveric shrugging; downward rotation (10°) and AC range (25°) approximate" };
const SC = { elevation: 45, depression: 10, protraction: 17.5, retraction: 22.5, posteriorRotation: 27.5,
  refs: ["neumann", "ludewig09"], approx: "textbook (largely passive) ranges; mid-points where a range is given" };

const API = { REFS, SEGMENTS, REGIONS, REGION, SETTINGS, SC, ST };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.SpineROM = API;
})(typeof self !== "undefined" ? self : this);
