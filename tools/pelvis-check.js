// Pelvis / complete-trunk validation: inventory of the trunk skeleton, hip-bone proportions measured on the built
// surfaces, sacroiliac and symphysis joint spaces, clearances, hyoid placement, attachment frames and rig behaviour
// (whole-pelvis movement applied once, limited pelvic-joint movement, demos incl. controlled pelvic tilts, exact reset).
// node tools/pelvis-check.js [--json out.json]
const C = require("../src/spine-core.js"), SR = require("../src/spine-rig.js"), TR = require("../src/thorax-rig.js"), Pv = require("../src/pelvis-core.js");
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]);
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const tr = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const angOf = (R) => Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2))) * 180 / Math.PI;
const Rof = (e) => e.R || (() => { const c = Math.cos(e.psi || 0), s = Math.sin(e.psi || 0); return [[1, 0, 0], [0, c, -s], [0, s, c]]; })();

const sk = TR.buildSkeleton(), rig = TR.makeRig(sk), comps = sk.els.map(C.compile);
const E = Object.fromEntries(sk.els.map((e, k) => [e.id, k]));
const results = [], info = {};
const check = (ok, text) => { results.push({ ok, text }); };

// ---------- 1. inventory ----------
const kinds = {}; sk.els.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
info.inventory = kinds;
const need = { vertebra: 24, disc: 23, sacrum: 1, coccyx: 1, rib: 24, cartilage: 24, sternum: 1, clavicle: 2, scapula: 2, hip: 2, joint: 3, hyoid: 1 };
const missing = Object.entries(need).filter(([k, n]) => (kinds[k] || 0) !== n).map(([k, n]) => `${k} ${kinds[k] || 0}/${n}`);
check(!missing.length, `trunk skeleton complete: 24 vertebrae, sacrum, coccyx, 23 discs, 12 rib pairs + cartilages, sternum, 2 clavicles, 2 scapulae, 2 hip bones, 2 SI joints, pubic symphysis, hyoid${missing.length ? " — " + missing.join(", ") : ""}`);
const ids = sk.els.map((e) => e.id);
check(new Set(ids).size === ids.length && ["HIP_L", "HIP_R", "SIJ_L", "SIJ_R", "PUBIC_SYMPHYSIS", "HYOID", "S", "Co"].every((i) => E[i] !== undefined), "stable unique IDs (HIP_L/R, SIJ_L/R, PUBIC_SYMPHYSIS, HYOID; sacrum S and coccyx Co unchanged)");

// ---------- surface samples ----------
const shell = (k, step) => {
  const c = comps[k], b = c.box, out = [];
  for (let x = b[0]; x <= b[3]; x += step) for (let y = b[1]; y <= b[4]; y += step) for (let z = b[2]; z <= b[5]; z += step) { const d = c.sdf(x, y, z); if (d < 0 && d > -step) out.push([x, y, z]); }
  return out;
};
const HL = shell(E.HIP_L, 1.6), HR = shell(E.HIP_R, 1.6);
const toW = (m, id, pts) => { const el = m.els[E[id]]; return pts.map((p) => C.toWorld(el, p)); };
const sdfW = (m, id, w) => { const el = m.els[E[id]], l = C.toLocal(el, w), c = m.comps[E[id]], b = c.box;
  const bd = Math.hypot(Math.max(b[0] - l[0], 0, l[0] - b[3]), Math.max(b[1] - l[1], 0, l[1] - b[4]), Math.max(b[2] - l[2], 0, l[2] - b[5]));
  return bd > 25 ? bd : c.sdf(l[0], l[1], l[2]); };
const minTo = (m, pts, id) => { let mn = 1e9; for (const w of pts) { const d = sdfW(m, id, w); if (d < mn) mn = d; } return mn; };
const rest = { els: sk.els, comps };
const WL = toW(rest, "HIP_L", HL), WR = toW(rest, "HIP_R", HR);

// parts present on the surface
const parts = new Set(HL.map((p) => comps[E.HIP_L].partAt(...p)));
const needParts = [43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58];
const lack = needParts.filter((p) => !parts.has(p));
check(!lack.length, `hip bone regions present: crest, ASIS/AIIS, iliac fossa, gluteal surface, auricular surface, PSIS/PIIS, acetabulum + rim, brim, pubic rami and body, ischial body, ramus, tuberosity, spine${lack.length ? " — missing " + lack.map((p) => C.PART_NAMES[p]).join(", ") : ""}`);

// ---------- 2. proportions (measured on the surfaces) ----------
const S = sk.els[E.S], cS = comps[E.S], sac = (w) => { const l = C.toLocal(S, w); return cS.sdf(l[0], l[1], l[2]); };
let prom = null; for (let y = 1025; y <= 1050; y += 0.5) for (let z = 20; z > -40; z -= 0.25) if (sac([0, y, z]) < 0) { if (!prom || z > prom[2]) prom = [0, y, z]; break; }
const pub = WL.filter((p) => p[0] < 6);
const symTop = pub.reduce((a, p) => (p[1] > a[1] ? p : a)), symBot = pub.reduce((a, p) => (p[1] < a[1] ? p : a));
const obst = Math.min(...pub.map((p) => len(sub(p, [0, p[1], p[2]])) < 9 ? len(sub(p, prom)) : 1e9));
const anat = len(sub([0, symTop[1], Math.min(...pub.filter((p) => p[1] > symTop[1] - 3).map((p) => p[2]))], prom));
// inlet transverse: widest opening in the inlet plane (promontory → top of the symphysis), measured from the midline outward
const inlet = (() => { const a = prom, b = [0, symTop[1], symTop[2] - 8], d = sub(b, a); let best = 0, at = null;
  const hipL = (w) => sdfW(rest, "HIP_L", w);
  for (let s = 0.05; s <= 0.95; s += 0.01) { const c = [0, a[1] + d[1] * s, a[2] + d[2] * s];
    for (let x = 5; x < 110; x += 0.5) { if (hipL([x, c[1], c[2]]) < 0) { const pt = comps[E.HIP_L].partAt(...C.toLocal(sk.els[E.HIP_L], [x, c[1], c[2]]));
      if ([51, 52, 47].includes(pt) && x > best) { best = x; at = [x, c[1], c[2]]; } break; } } }
  return { width: 2 * best, at }; })();
const near = (pts, c, r) => pts.filter((p) => len(sub(p, c)) < r);
const spineTip = Math.min(...near(WL, Pv.LM.ischialSpine, 14).map((p) => p[0]));
const tub = WL.filter((p) => p[1] < 886 && p[2] < -15 && p[0] > 40);
const tubMed = Math.min(...tub.map((p) => p[0]));
// subpubic angle: lower contour of the arch in front view, fitted between 4 and 16 mm from the midline
const arch = []; for (let x = 4; x <= 16; x += 1) { const col = WL.filter((p) => Math.abs(p[0] - x) < 0.9 && p[1] < 905 && p[2] > 0); if (col.length) arch.push([x, Math.min(...col.map((p) => p[1]))]); }
const mx = arch.reduce((s, p) => s + p[0], 0) / arch.length, my = arch.reduce((s, p) => s + p[1], 0) / arch.length;
const slope = arch.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / arch.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
const subpubic = 2 * Math.atan(1 / Math.abs(slope)) * 180 / Math.PI;
const asis = WL.filter((p) => p[1] > 1010).reduce((a, p) => (p[2] > a[2] ? p : a));
const widest = WL.reduce((a, p) => (p[0] > a[0] ? p : a)), top = WL.reduce((a, p) => (p[1] > a[1] ? p : a)), bottom = WL.reduce((a, p) => (p[1] < a[1] ? p : a));
const L45 = sk.els[E.D_L4_L5] || sk.els.find((e) => e.kind === "disc" && e.up === "L4");
const dims = {
  inletTransverse: inlet.width, anatomicalConjugate: anat, obstetricConjugate: obst, interspinous: 2 * spineTip, intertuberous: 2 * tubMed,
  subpubicAngle: subpubic, symphysisHeight: symTop[1] - symBot[1], interpubicGap: (() => { let g = 1e9; for (let y = symBot[1] + 4; y < symTop[1] - 4; y += 2) for (let z = 30; z < 50; z += 2) { for (let x = 0; x < 6; x += 0.05) if (sdfW(rest, "HIP_L", [x, y, z]) < 0) { g = Math.min(g, 2 * x); break; } } return g; })(),
  interASIS: 2 * asis[0], intercristal: 2 * widest[0], crestSummitY: top[1], L4L5discY: L45.o[1], hipBoneHeight: top[1] - bottom[1],
  hipCentres: 2 * Pv.PELVIS.hjc[0], acetabulumDiameter: 2 * Pv.PELVIS.socketR, promontory: prom,
};
info.dimensions = dims;
const rng = (v, a, b) => v >= a && v <= b;
const f1 = (v) => v.toFixed(1);
check(rng(dims.inletTransverse, 125, 138), `pelvic inlet transverse diameter ${f1(dims.inletTransverse)} mm (female 127–135)`);
check(rng(dims.obstetricConjugate, 110, 128) && rng(dims.anatomicalConjugate, 112, 132), `conjugates: obstetric ${f1(dims.obstetricConjugate)} mm (115–127), anatomical ${f1(dims.anatomicalConjugate)} mm (≈ 120)`);
check(rng(dims.interspinous, 100, 118), `interspinous diameter ${f1(dims.interspinous)} mm (≈ 107–110)`);
check(rng(dims.intertuberous, 105, 125), `intertuberous diameter ${f1(dims.intertuberous)} mm (≈ 111–118)`);
check(rng(dims.subpubicAngle, 82, 98), `subpubic angle ${f1(dims.subpubicAngle)}° (female ≈ 85–95°)`);
check(rng(dims.symphysisHeight, 36, 44) && rng(dims.interpubicGap, 3.5, 6), `pubic symphysis: height ${f1(dims.symphysisHeight)} mm (38–42 at 163 cm; ≈ 40–45 at 183 cm), interpubic gap ${f1(dims.interpubicGap)} mm (4–5)`);
check(rng(dims.interASIS, 225, 260) && rng(dims.intercristal, 260, 290), `inter-ASIS ${f1(dims.interASIS)} mm (230–250), intercristal ${f1(dims.intercristal)} mm (260–285)`);
check(Math.abs(dims.crestSummitY - dims.L4L5discY) < 12, `iliac crest summit at the L4–L5 interspace (crest y ${f1(dims.crestSummitY)}, disc y ${f1(dims.L4L5discY)})`);
check(rng(dims.hipBoneHeight, 210, 230), `hip bone height ${f1(dims.hipBoneHeight)} mm (female ≈ 200 at 163 cm → ≈ 215–225 at 183 cm)`);
// acetabulum: socket radius, orientation and bony coverage (directions of the socket sphere backed by bone)
{
  const H = Pv.PELVIS.hjc, n = Pv.ACET_N, I = Math.atan2(n[0], -n[1]) * 180 / Math.PI, A = Math.asin(n[2]) * 180 / Math.PI;
  let cov = 0, tot = 0;
  for (let i = 0; i < 400; i++) { const u = 1 - 2 * (i + 0.5) / 400, phi = i * 2.399963, r = Math.sqrt(1 - u * u), d = [r * Math.cos(phi), u, r * Math.sin(phi)];
    if (d[0] * n[0] + d[1] * n[1] + d[2] * n[2] > 0) continue; tot++;
    const q = [H[0] + d[0] * (Pv.PELVIS.socketR + 1.2), H[1] + d[1] * (Pv.PELVIS.socketR + 1.2), H[2] + d[2] * (Pv.PELVIS.socketR + 1.2)];
    if (sdfW(rest, "HIP_L", q) < 0) cov++; }
  info.acetabulum = { inclination: I, anteversion: A, coverage: cov / tot };
  check(rng(I, 40, 48) && rng(A, 12, 22) && cov / tot > 0.6, `acetabulum: Ø ${f1(dims.acetabulumDiameter)} mm socket, inclination ${f1(I)}°, anteversion ${f1(A)}°, bony backing ${(100 * cov / tot).toFixed(0)} % of the hemisphere (notch and fossa open)`);
}
// obturator foramen: open — a ray across its centre (normal to the foramen) meets no bone; its height along the ramus–ramus line
{
  const c = Pv.LM.obturator, up = (() => { const d = [2, 46, 28], l = len(d); return d.map((v) => v / l); })(), side = (() => { const d = [52, 0, -46], l = len(d); return d.map((v) => v / l); })();
  const nrm = [up[1] * side[2] - up[2] * side[1], up[2] * side[0] - up[0] * side[2], up[0] * side[1] - up[1] * side[0]];
  const at = (d, t) => [c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t], hipL = (w) => sdfW(rest, "HIP_L", w);
  let hit = false; for (let t = -25; t <= 25; t += 0.5) if (hipL(at(nrm, t)) < 0) hit = true;
  const reach = (d) => { for (let t = 0; t < 60; t += 0.5) if (hipL(at(d, t)) < 0) return t; return 60; };
  const s2 = (() => { const k = up[0] * side[0] + up[1] * side[1] + up[2] * side[2], v = side.map((x, i) => x - k * up[i]), l = len(v); return v.map((x) => x / l); })();
  const r = []; for (let a = 0; a < 360; a += 5) { const q = (a * Math.PI) / 180, d = up.map((u, i) => u * Math.cos(q) + s2[i] * Math.sin(q)); r.push(reach(d)); }
  info.obtR = r; const n2 = r.length / 2, dia = r.slice(0, n2).map((v, i) => v + r[i + n2]), h = Math.max(...dia), w = Math.min(...dia);
  info.obturator = { height: h, width: w };
  check(!hit && rng(h, 45, 64) && rng(w, 25, 42), `obturator foramen open (no bone across it): ${f1(h)} mm long, ${f1(w)} mm wide (female ≈ 45–55 × 30–35 at 163 cm; ×1.12 for 183 cm)`);
}
// symmetry
{
  let e = 0; for (let i = 0; i < HL.length; i += 37) { const p = WL[i], q = [-p[0], p[1], p[2]]; e = Math.max(e, Math.abs(sdfW(rest, "HIP_R", q) - sdfW(rest, "HIP_L", p))); }
  check(e < 0.05, `left/right symmetric (mirror error ${e.toExponential(1)} mm)`);
}

// ---------- 3. joints and clearances (rest) ----------
function joints(m) {
  const wl = toW(m, "HIP_L", HL), wr = toW(m, "HIP_R", HR), o = {};
  for (const [s, w] of [["L", wl], ["R", wr]]) {
    const ds = w.map((p) => sdfW(m, "S", p)), close = ds.filter((d) => d < Pv.PELVIS.siGap + 1.7).length;
    o[s] = { si: Math.min(...ds), siArea: close * 1.6 * 1.6, coccyx: minTo(m, w, "Co"), L5: minTo(m, w, "L5"), L4: minTo(m, w, "L4"), discL5: minTo(m, w, "D_L5_S1") };
  }
  // symphysis: the two symphyseal faces (same landmark on each bone): gap across the midline and vertical shear
  const fL = C.toWorld(m.els[E.HIP_L], sub([Pv.PELVIS.symphysisX, 911, 41], Pv.PELVIS.hjc));
  const fR = C.toWorld(m.els[E.HIP_R], sub([-Pv.PELVIS.symphysisX, 911, 41], [-Pv.PELVIS.hjc[0], Pv.PELVIS.hjc[1], Pv.PELVIS.hjc[2]]));
  o.symphysis = { gap: len(sub(fL, fR)), shear: Math.abs(fL[1] - fR[1]) };
  const faceL = wl.filter((p, i) => HL[i][0] < -Pv.PELVIS.hjc[0] + 5), faceR = wr.filter((p, i) => HR[i][0] > Pv.PELVIS.hjc[0] - 5);
  const disc = m.els[E.PUBIC_SYMPHYSIS], dc = m.comps[E.PUBIC_SYMPHYSIS];
  let pen = 0; for (const p of [...faceL, ...faceR]) { const l = C.toLocal(disc, p); pen = Math.min(pen, dc.sdf(l[0], l[1], l[2])); }
  o.symphysis.discPen = pen;
  return o;
}
const J0 = joints(rest); info.joints = J0;
check(J0.L.si >= 2.0 && J0.L.si <= 3.2 && J0.L.siArea > 600, `sacroiliac joint space ${f1(J0.L.si)} mm (2–3 mm), auricular contact ≈ ${(J0.L.siArea / 100).toFixed(0)} cm² per side (adult ≈ 12–18 cm²)`);
check(rng(J0.symphysis.gap, 3.5, 6) && J0.symphysis.discPen > -1.0, `pubic symphysis: faces ${f1(J0.symphysis.gap)} mm apart, interpubic disc fills the gap without entering bone (${f1(J0.symphysis.discPen)} mm)`);
check(Math.min(J0.L.L5, J0.L.L4, J0.L.coccyx, J0.L.discL5) > 2, `hip bones clear L4, L5, the L5–S1 disc and the coccyx (min ${f1(Math.min(J0.L.L5, J0.L.L4, J0.L.coccyx, J0.L.discL5))} mm)`);
{
  const ribs = sk.els.filter((e) => e.kind === "rib" && e.n >= 10).map((e) => e.id);
  let mn = 1e9; for (const id of ribs) mn = Math.min(mn, minTo(rest, WL.filter((_, i) => i % 3 === 0), id));
  info.ribToCrest = mn;
  check(mn > 40, `lowest ribs clear the iliac crest (${f1(mn)} mm)`);
}
// hyoid: level and distance from C3, no contact with any bone
{
  const hy = sk.els[E.HYOID], C3 = sk.els[E.C3], c3f = C.toWorld(C3, [0, 0, C3.D / 2]);
  const hs = shell(E.HYOID, 1.0).map((p) => C.toWorld(hy, p));
  let mn = 1e9, at = ""; for (const e of sk.els) { if (e.id === "HYOID" || !/vertebra|disc/.test(e.kind)) continue; if (Math.abs(e.o[1] - hy.o[1]) > 60) continue;
    const d = minTo(rest, hs, e.id); if (d < mn) { mn = d; at = e.id; } }
  const C2 = sk.els[E.C2], C4 = sk.els[E.C4];
  info.hyoid = { o: hy.o, toC3front: hy.o[2] - c3f[2], minToSpine: mn, nearest: at };
  check(hy.o[1] < C2.o[1] && hy.o[1] > C4.o[1] && rng(hy.o[2] - c3f[2], 28, 45) && mn > 8, `hyoid at the C3 level (y ${f1(hy.o[1])} between C2 and C4), body ${f1(hy.o[2] - c3f[2])} mm anterior to C3, ${f1(mn)} mm from the nearest vertebra (${at}): no bony joint`);
}

// ---------- 4. rig ----------
const ZP = () => TR.ZERO();
const withRoot = (o, base) => { const p = base ? JSON.parse(JSON.stringify(base)) : ZP(); p.root = { ...p.root, ...o }; return p; };
const dR = (m, id) => mm(Rof(m.els[E[id]]), tr(Rof(sk.els[E[id]])));                 // rotation of a bone from its rest orientation
const relRot = (m, a, b) => angOf(mm(tr(dR(m, a)), dR(m, b)));
// whole-pelvis movement applied once
{
  const m = TR.posedModel(rig, comps, withRoot({ tilt: 10 }));
  const sacR = angOf(dR(m, "S")), hipR = angOf(dR(m, "HIP_L")), rel = relRot(m, "S", "HIP_L"), l5 = relRot(m, "L5", "S");
  const hipMove = len(sub(m.els[E.HIP_L].o, Pv.PELVIS.hjc));
  info.tilt = { sacR, hipR, rel, l5, hipMove };
  check(Math.abs(sacR - 10) < 1e-4 && Math.abs(hipR - 10) < 1e-4 && rel < 1e-4 && Math.abs(l5) < 1e-4 && hipMove < 1e-6,
    `whole-pelvis tilt 10°: sacrum ${f1(sacR)}°, hip bones ${f1(hipR)}°, sacrum–hip ${rel.toFixed(4)}°, L5–sacrum unchanged, hip centres stay on the hip axis — applied once`);
}
// pelvic joints: nutation and counter-rotation, limited and kept apart from whole-pelvis movement
const jointPoses = [
  { id: "nutation+", pose: withRoot({ nutation: 2 }) }, { id: "nutation-", pose: withRoot({ nutation: -2 }) },
  { id: "counter+", pose: withRoot({ counter: 0.5 }) }, { id: "counter-", pose: withRoot({ counter: -0.5 }) },
  { id: "tilt+nutation", pose: withRoot({ tilt: -12, nutation: -2, obliquity: 6 }) },
];
const jrows = [];
for (const P of jointPoses) {
  const m = TR.posedModel(rig, comps, P.pose), j = joints(m);
  jrows.push({ id: P.id, sacHip: relRot(m, "S", "HIP_L"), hipHip: relRot(m, "HIP_L", "HIP_R"), si: Math.min(j.L.si, j.R.si), shear: j.symphysis.shear, gap: j.symphysis.gap, pen: j.symphysis.discPen });
}
info.pelvicJoints = jrows;
{
  const n = jrows.find((r) => r.id === "nutation+"), c = jrows.find((r) => r.id === "counter+");
  check(Math.abs(n.sacHip - 2) < 0.01 && n.hipHip < 1e-6, `nutation 2°: sacrum turns ${n.sacHip.toFixed(2)}° against both hip bones, hip bones keep their relation (${n.hipHip.toExponential(0)}°)`);
  check(Math.abs(c.hipHip - 1) < 0.01 && c.shear <= Pv.ROM.symphysisShear, `counter-rotation 0.5° per side: hip bones ${c.hipHip.toFixed(2)}° apart, symphysis vertical shear ${f1(c.shear)} mm (≤ ${Pv.ROM.symphysisShear} mm)`);
  const worstSi = Math.min(...jrows.map((r) => r.si)), worstGap = Math.min(...jrows.map((r) => r.gap)), worstPen = Math.min(...jrows.map((r) => r.pen));
  check(worstSi > 1.2 && worstGap > 3 && worstPen > -1.2, `pelvic joints stay congruent at their limits: SI space ≥ ${f1(worstSi)} mm, symphysis faces ≥ ${f1(worstGap)} mm apart, disc ≤ ${f1(-worstPen)} mm into bone`);
  const mc = TR.posedModel(rig, comps, withRoot({ nutation: 9 })), mh = TR.posedModel(rig, comps, withRoot({ counter: 4 }));
  const jn = relRot(mc, "S", "HIP_L"), jh = relRot(mh, "HIP_L", "HIP_R") / 2;
  check(Math.abs(jn - Pv.ROM.nutation) < 1e-3 && Math.abs(jh - Pv.ROM.counter) < 1e-3, `pelvic-joint inputs clamped to their reference range (asked 9° nutation → ${jn.toFixed(2)}°, asked 4° counter-rotation → ${jh.toFixed(2)}° per hip bone)`);
}
// every demo (spinal, shoulder, pelvic tilt): joints keep their spaces, nothing intersects
{
  const demos = TR.demoPoses(); let worst = { si: 1e9, gap: 1e9, l5: 1e9, at: "" };
  for (const d of demos) {
    const m = TR.posedModel(rig, comps, d.pose), j = joints(m);
    const si = Math.max(Math.abs(j.L.si - J0.L.si), Math.abs(j.R.si - J0.R.si)), l5 = Math.min(j.L.L5, j.R.L5, j.L.discL5, j.R.discL5);
    worst.dsi = Math.max(worst.dsi || 0, si); worst.dgap = Math.max(worst.dgap || 0, Math.abs(j.symphysis.gap - J0.symphysis.gap)); worst.l5 = Math.min(worst.l5, l5);
  }
  info.demos = worst;
  check(worst.dsi < 0.05 && worst.dgap < 0.05 && worst.l5 > 1.5,
    `all ${demos.length} demos keep the SI space (change ≤ ${worst.dsi.toFixed(3)} mm) and the symphysis (≤ ${worst.dgap.toFixed(3)} mm); hip bones clear L5 / L5–S1 disc (≥ ${f1(worst.l5)} mm)`);
  for (const id of ["pelvic-tilt-anterior", "pelvic-tilt-posterior"]) {
    const d = demos.find((x) => x.id === id), m = TR.posedModel(rig, comps, d.pose);
    const t12 = angOf(dR(m, "T12")), pel = angOf(dR(m, "HIP_L"));
    const a = m.attach, w = len(sub(a.HIP_L.o, a.HIP_R.o));
    check(Math.abs(pel - 10) < 1e-6 && t12 < 0.05 && Math.abs(w - 2 * Pv.PELVIS.hjc[0]) < 1e-6, `${d.name}: pelvis ${f1(pel)}°, T12 orientation change ${t12.toFixed(3)}° (lumbar compensates), hip attachment frames ${f1(w)} mm apart`);
  }
}
// attachment frames
{
  const a = rig.attachRest, ok = ["HIP_L", "HIP_R", "SHOULDER_L", "SHOULDER_R", "HEAD"].every((k) => a[k] && a[k].o);
  const H = a.HIP_L, ax = H.axis;
  check(ok && len(sub(H.o, Pv.PELVIS.hjc)) < 1e-9 && Math.abs(len(ax) - 1) < 1e-9, `attachment frames ready for the future femurs (acetabular centre + axis), humeri (glenoid) and skull (atlas); no limb or skull geometry built`);
}
// reset
{
  const z = TR.posedModel(rig, comps, TR.ZERO());
  const m = TR.posedModel(rig, comps, withRoot({ tilt: 1e-6, nutation: 1e-6, counter: 1e-6 }));
  let mv = 0; for (const id of ["HIP_L", "HIP_R", "S", "PUBIC_SYMPHYSIS", "SIJ_L", "HYOID", "C1"]) mv = Math.max(mv, len(sub(m.els[E[id]].o, sk.els[E[id]].o)));
  check(z.neutral && z.els === sk.els && mv < 1e-4, `neutral restored exactly (zero input returns the rest skeleton; a 1e-6° pelvic input moves nothing more than ${mv.toExponential(1)} mm)`);
}

// ---------- report ----------
console.log("pelvic joints at their limits");
console.log("pose              sac–hip°  hip–hip°   SI mm  sym gap  shear  disc pen");
for (const r of jrows) console.log(r.id.padEnd(17), r.sacHip.toFixed(2).padStart(8), r.hipHip.toFixed(2).padStart(9), f1(r.si).padStart(7), f1(r.gap).padStart(8), f1(r.shear).padStart(6), f1(r.pen).padStart(9));
for (const r of results) console.log((r.ok ? "PASS  " : "FAIL  ") + r.text);
const nf = results.filter((r) => !r.ok).length;
console.log(nf ? `${nf} check(s) failed` : `all ${results.length} pelvis checks passed`);
const ji = process.argv.indexOf("--json"); if (ji > 0) require("fs").writeFileSync(process.argv[ji + 1], JSON.stringify({ results, info }, null, 1));
