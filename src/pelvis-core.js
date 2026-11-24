// Pelvis core: both hip bones (ilium, ischium and pubis fused), the sacroiliac joints, the pubic symphysis and the hyoid.
// Units: mm. Character space as everywhere: x = subject's left, y = up (floor 0), z = anterior.
// The approved sacrum and coccyx are not touched: the hip bones are built around them. Each hip bone's local frame has
// its origin at the centre of its acetabulum (the future hip joint centre) with world axes; the right bone is the exact
// mirror of the left. Stable IDs: HIP_L, HIP_R, SIJ_L, SIJ_R, PUBIC_SYMPHYSIS, HYOID.
(function (root) {
"use strict";
const NODE = typeof module !== "undefined" && module.exports;
const C = NODE ? require("./spine-core.js") : root.SpineCore;
const DEG = Math.PI / 180;

// ---------- vectors ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const bez = (a, m, b, t) => add(add(mul(a, (1 - t) * (1 - t)), mul(m, 2 * t * (1 - t))), mul(b, t * t));

// ---------- parts (continue the skeleton's numbering) ----------
const P = { CREST: 43, ASIS: 44, FOSSA: 45, GLUTEAL: 46, AURICULAR: 47, PSIS: 48, ACETABULUM: 49, RIM: 50, BRIM: 51,
  SUP_RAMUS: 52, PUBIC_BODY: 53, INF_RAMUS: 54, ISCH_RAMUS: 55, ISCHIUM: 56, TUBEROSITY: 57, ISCH_SPINE: 58,
  SYMPHYSIS: 59, SIJ: 60, HYOID_BODY: 61, GREATER_HORN: 62, LESSER_HORN: 63 };
Object.assign(C.PART_NAMES, { 43: "Iliac crest", 44: "Anterior iliac spines (ASIS, AIIS)", 45: "Iliac fossa (inner surface of the ala)",
  46: "Gluteal surface (outer surface of the ala)", 47: "Auricular surface and iliac tuberosity", 48: "Posterior iliac spines (PSIS, PIIS)",
  49: "Acetabulum (lunate surface and fossa)", 50: "Acetabular rim", 51: "Body of the ilium and arcuate line (pelvic brim)",
  52: "Superior pubic ramus", 53: "Body of the pubis (symphyseal surface, tubercle)", 54: "Inferior pubic ramus", 55: "Ischial ramus",
  56: "Body of the ischium", 57: "Ischial tuberosity", 58: "Ischial spine", 59: "Pubic symphysis (interpubic disc)",
  60: "Sacroiliac joint (articular cartilage)", 61: "Body of the hyoid", 62: "Greater horn of the hyoid", 63: "Lesser horn of the hyoid" });

// ------------------------------------------------------------------------------------------
// 1. Reference data (adult female pelvis, scaled toward 183 cm where a stature effect is expected).
//    Pelvic inlet transverse 127–135 mm, anatomical conjugate ≈ 120 mm, interspinous ≈ 107–110 mm, intertuberous
//    ≈ 111–118 mm, subpubic angle ≈ 85–95°, symphysis height ≈ 38–42 mm and interpubic gap ≈ 4–5 mm.
//    Inter-ASIS ≈ 230–250 mm, intercristal ≈ 260–285 mm, iliac crest summit at the L4–L5 interspace (women).
//    Hip joint centre ≈ 88 mm from the midline (Bell et al. 1990 regression on inter-ASIS width), acetabulum radiographic
//    inclination ≈ 44°, anteversion ≈ 17° (female means 40–45° / 15–20°), femoral head ≈ 47 mm for this stature.
//    The approved posture fixes the hip axis (y 951.6, z 0), sacral slope 41° and pelvic tilt 12°, so the pelvic
//    incidence is ≈ 53°. The anterior pelvic plane (ASIS–pubic tubercles) is close to vertical in standing.
// ------------------------------------------------------------------------------------------
const PELVIS = {
  hjc: [88, 951.6, 0],                     // left hip joint centre (world)
  socketR: 24.5, shellR: 31,               // acetabulum: articular radius (head 23.5 + cartilage), outer bony radius
  inclination: 44, anteversion: 17,
  siGap: 2.6,                              // sacroiliac joint space (cartilage on both surfaces)
  symphysisX: 2.2,                         // half of the interpubic gap at rest
};
const ROM = {   // limited relative movement at the pelvic joints (degrees); the whole pelvis moves with pose.root
  nutation: 2.0,          // sacral nutation / counternutation relative to both hip bones (Sturesson 1989/2000: mean 1.9–2.5° in women)
  counter: 0.5,           // antagonistic rotation of each hip bone in single-leg stance (Hungerford 2004 / Sturesson 2000: ≈ 0.5°)
  symphysisShear: 2.0,    // vertical shear at the symphysis in single-leg stance stays ≤ ≈ 2 mm (Walheim & Selvik 1984)
  refs: ["Sturesson et al. 1989, Spine 14:162 (RSA, SI joint motion: 2.5° mean rotation, 0.7 mm translation)",
    "Sturesson, Uden & Vleeming 2000, Spine 25:364 (standing hip flexion test: ≈ 0.5–2°)",
    "Hungerford, Gilleard & Hodges 2004 (innominate motion in single-leg stance)",
    "Walheim & Selvik 1984, Clin Orthop 191:129 (symphysis mobility ≈ 2 mm)",
    "Bell, Pedersen & Brand 1990, J Biomech 23:617 (hip joint centre from pelvic landmarks)",
    "Murray 1993 / Tannast 2007 (acetabular inclination and anteversion)",
    "Standring, Gray's Anatomy 42e (hip bone, sacroiliac joint, pubic symphysis, hyoid)"],
};
// acetabular axis (opening direction, left): radiographic inclination / anteversion
const ACET_N = (() => { const I = PELVIS.inclination * DEG, A = PELVIS.anteversion * DEG; return nrm([Math.sin(I) * Math.cos(A), -Math.cos(I) * Math.cos(A), Math.sin(A)]); })();

// ---------- primitives (left side, world coordinates) ----------
function udTri(p, a, b, c) {      // unsigned distance to a triangle (Inigo Quilez)
  const ba = sub(b, a), pa = sub(p, a), cb = sub(c, b), pb = sub(p, b), ac = sub(a, c), pc = sub(p, c), n = cross(ba, ac);
  const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), d2 = (v) => dot(v, v), cl = (x) => Math.max(0, Math.min(1, x));
  if (sgn(dot(cross(ba, n), pa)) + sgn(dot(cross(cb, n), pb)) + sgn(dot(cross(ac, n), pc)) < 2)
    return Math.sqrt(Math.min(d2(sub(mul(ba, cl(dot(ba, pa) / d2(ba))), pa)), d2(sub(mul(cb, cl(dot(cb, pb) / d2(cb))), pb)), d2(sub(mul(ac, cl(dot(ac, pc) / d2(ac))), pc))));
  return Math.sqrt(dot(n, pa) * dot(n, pa) / d2(n));
}
let GROUP = 0;
// barycentric coordinates of the closest point of triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5)
function closestBary(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [1 - v, v, 0]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [1 - w, 0, w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [0, 1 - w, w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [1 - v - w, v, w];
}
// a curved sheet from a grid of points G[i][j] (i along the crest, j down the wing), thickness per row.
// Each triangle is a Phong-tessellated patch: inside its projection the distance is measured to the curved surface
// through the vertex normals, so the sheet shades smoothly instead of as flat facets.
function sheet(G, halves, part, inward) {
  const g = ++GROUP, out = [], ni = G.length, nj = G[0].length;
  const N = G.map((row, i) => row.map((_, j) => {
    const du = sub(G[Math.min(ni - 1, i + 1)][j], G[Math.max(0, i - 1)][j]), dv = sub(G[i][Math.min(nj - 1, j + 1)], G[i][Math.max(0, j - 1)]);
    let n = nrm(cross(du, dv)); if (dot(n, inward) < 0) n = mul(n, -1); return n;
  }));
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const h = (halves[j] + halves[j + 1]) / 2;
    for (const ix of [[[i, j], [i + 1, j], [i + 1, j + 1]], [[i, j], [i + 1, j + 1], [i, j + 1]]]) {
      const t = ix.map(([a, b]) => G[a][b]), tn = ix.map(([a, b]) => N[a][b]);
      const c = mul(add(add(t[0], t[1]), t[2]), 1 / 3);
      let n = nrm(cross(sub(t[1], t[0]), sub(t[2], t[0]))); if (dot(n, inward) < 0) n = mul(n, -1);
      const e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]), d00 = dot(e1, e1), d01 = dot(e1, e2), d11 = dot(e2, e2), den = d00 * d11 - d01 * d01;
      out.push({ c, R: Math.max(...t.map((p) => len(sub(p, c)))) + h + 1, part, group: g, isSheet: true, n,
        d(p) {
          const bs = closestBary(p, t[0], t[1], t[2]);
          const q = add(add(mul(t[0], bs[0]), mul(t[1], bs[1])), mul(t[2], bs[2]));
          let ps = [0, 0, 0];
          for (let k = 0; k < 3; k++) ps = add(ps, mul(sub(q, mul(tn[k], dot(sub(q, t[k]), tn[k]))), bs[k]));
          const dd = len(sub(p, ps)) - h; return dd > 0 ? dd * 0.9 : dd;      // curved patch: keep the step conservative
        },
        side(p) { return dot(sub(p, t[0]), n); } });
    }
  }
  return out;
}
function capsule(a, b, ra, rb, part) {
  const ab = sub(b, a), L2 = dot(ab, ab) || 1e-9;
  return { c: lerp(a, b, 0.5), R: Math.sqrt(L2) / 2 + Math.max(ra, rb) + 1, part, d(p) {
    const h = Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2)); return len(sub(p, add(a, mul(ab, h)))) - (ra + (rb - ra) * h); } };
}
function chain(pts, rs, part) { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(capsule(pts[i], pts[i + 1], rs[i], rs[i + 1], part)); return out; }
function ellO(c, axes, r, part) {      // oriented ellipsoid: axes = 3 unit vectors, r = radii along them
  const rmin = Math.min(...r);
  return { c, R: Math.max(...r) + 1, part, d(p) {
    const q = sub(p, c), x = dot(q, axes[0]) / r[0], y = dot(q, axes[1]) / r[1], z = dot(q, axes[2]) / r[2];
    const k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt((x / r[0]) ** 2 + (y / r[1]) ** 2 + (z / r[2]) ** 2);
    return k0 * (k0 - 1) / Math.max(k1, 1e-6); } };
}
const ell = (c, r, part) => ellO(c, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], r, part);
const frameAlong = (a) => { const u = nrm(a), x = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], v = nrm(cross(u, x)); return [u, v, cross(u, v)]; };
function smin(a, b, k) { const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k)); return b * (1 - h) + a * h - k * h * (1 - h); }

// ------------------------------------------------------------------------------------------
// 2. The left hip bone. Landmarks are placed on the approved sacrum and hip axis (see PELVIS); everything else follows.
// ------------------------------------------------------------------------------------------
const LM = {
  ASIS: [122, 1030, 50], AIIS: [110, 990, 41], tubercle: [132, 1076, 14], summit: [129, 1081, -6],
  PSIS: [49, 1022, -86], PIIS: [52, 994, -77], notchApex: [74, 961, -36], ischialSpine: [55, 911, -50],
  tuberosity: [67, 880, -26], pubicTubercle: [20, 927, 54], symphysisTop: [2.2, 930, 46], symphysisBottom: [2.2, 890, 33],
  eminence: [68, 961, 30], brimWide: [65, 985, 10], obturator: [49, 909, 18],
};
function hipPrims() {
  const H = PELVIS.hjc, n = ACET_N, out = [];
  // --- ilium: the ala is a curved sheet between the iliac crest and the pelvic brim / anterior border
  const T = [[122, 1030, 50], [127, 1050, 44], [131, 1066, 31], [132, 1076, 14], [129, 1081, -6], [119, 1081, -26], [104, 1073, -44], [86, 1060, -60]];
  const B = [[110, 990, 40], [94, 980, 34], [73, 969, 27], [66, 983, 12], [64, 998, 0], [61, 1014, -11], [58, 1030, -20], [58, 1044, -30]];
  const K = [0, 4, 8, 10, 10, 9, 6, 3];                               // iliac fossa depth: the ala bows laterally, its inner face is concave
  // subdivide along the crest (Catmull-Rom) so the sheet reads as a smooth surface, not facets
  const cr = (A, t) => { const n = A.length - 1, f = Math.min(n - 1e-9, Math.max(0, t * n)), i = Math.floor(f), u = f - i;
    const g = (k) => A[Math.max(0, Math.min(n, k))], p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const one = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
    return Array.isArray(p1) ? [0, 1, 2].map((k) => one(p0[k], p1[k], p2[k], p3[k])) : one(p0, p1, p2, p3); };
  const NC = 16, NR = 7, G = [];
  for (let c = 0; c < NC; c++) {
    const t = c / (NC - 1), tp = cr(T, t), bp = cr(B, t), k = cr(K, t), cd = nrm(sub(bp, tp));
    const lat = nrm(sub([1, -0.9, 0], mul(cd, dot([1, -0.9, 0], cd)))), m = add(lerp(tp, bp, 0.5), mul(lat, k));
    G.push(Array.from({ length: NR }, (_, r) => bez(tp, m, bp, r / (NR - 1))));
  }
  const ala = sheet(G, [3.2, 2.6, 2.2, 2.1, 2.3, 3.0, 4.2], P.FOSSA, [-1, 0.6, 0.2]);
  out.push(...ala);
  // iliac crest: thick rounded rim with inner and outer lips (tubercle laterally), PSIS / ASIS at its ends
  out.push(...chain([...T, [68, 1045, -74], LM.PSIS], [5.2, 5.0, 5.8, 6.8, 6.2, 5.8, 6.2, 7.0, 7.4, 6.6], P.CREST));
  out.push(ellO(LM.ASIS, frameAlong([0.3, -1, 0.3]), [8, 6.5, 6], P.ASIS));
  out.push(...chain([LM.ASIS, [116, 1009, 46], LM.AIIS], [4.6, 3.6, 5.0], P.ASIS));
  out.push(ell(LM.AIIS, [6, 7, 6], P.ASIS));
  // posterior ilium: auricular surface (seated on the sacrum, carved to the joint space) and the iliac tuberosity behind it
  out.push(ellO([60, 1019, -42], frameAlong([0, 1, -0.45]), [37, 14, 25], P.AURICULAR));
  // posterior ilium: the gluteal surface continues behind the ala down to the greater sciatic notch and the PIIS
  out.push(...sheet([[[117, 1079, -28], [104, 1026, -20], [97, 984, -10]], [[104, 1073, -44], [98, 1020, -36], [92, 978, -24]], [[86, 1060, -60], [82, 1010, -50], [74, 963, -36]],
    [[68, 1045, -74], [66, 1008, -64], [63, 975, -57]], [[50, 1023, -84], [51, 1008, -82], [52, 994, -77]]], [4.5, 6, 7], P.GLUTEAL, [-1, 0, 0.3]));
  out.push(Object.assign(ellO([60, 1028, -62], frameAlong([0, 1, -0.3]), [24, 11, 13], P.AURICULAR), { k: 6 }));
  out.push(ellO(LM.PSIS, frameAlong([0.2, 1, -0.2]), [10, 7, 6.5], P.PSIS));
  out.push(ell(LM.PIIS, [6, 6.5, 6], P.PSIS));
  // greater sciatic notch: the posterior border from the PIIS down to the ischial spine (wide in the female pelvis)
  out.push(...chain([LM.PIIS, [57, 983, -68], [65, 971, -53], LM.notchApex, [73, 943, -38], [68, 924, -40], [64, 915, -41]], [5.6, 5.8, 6.4, 7.6, 8.0, 7.2, 6.4], P.ISCHIUM));
  // body of the ilium and pelvic brim (arcuate line → iliopectineal eminence): a thick wedge between the brim and the cup
  out.push(...chain([[57, 1040, -26], [60, 1022, -14], [63, 1004, -3], [65, 986, 9], [67, 972, 21], LM.eminence], [4.6, 4.2, 4.0, 4.2, 4.6, 5.6], P.BRIM));
  out.push(Object.assign(ellO([84, 986, 2], frameAlong([1, -0.12, 0]), [20, 15, 29], P.BRIM), { k: 7 }));
  out.push(Object.assign(ellO([74, 1010, -26], frameAlong([0.3, -1, 0.2]), [22, 10, 14], P.BRIM), { k: 7 }));
  out.push(Object.assign(ellO([77, 950, -28], frameAlong([0, 1, 0.12]), [27, 11, 12], P.ISCHIUM), { k: 7 }));
  // --- acetabulum: a hemispherical cup (outer shell, flat rim) opening down, out and forward; socket carved below
  const shellC = sub(H, mul(n, 3));
  out.push({ c: H, R: PELVIS.shellR + 4, part: P.RIM, isCup: true, d(p) { return Math.max(len(sub(p, shellC)) - PELVIS.shellR, dot(sub(p, H), n) - 0.5); } });
  // --- pubis: superior ramus (pectineal line above, obturator crest below) to the body; symphyseal surface carved flat
  out.push(...chain([[13, 926, 47], [32, 936, 46], [50, 946, 40], LM.eminence, [80, 962, 20]], [6.0, 5.6, 6.2, 7.6, 9.5], P.SUP_RAMUS));
  out.push(...sheet([[[12, 928, 48], [14, 915, 42]], [[30, 937, 47], [32, 921, 37]], [[48, 947, 41], [50, 927, 29]], [[66, 959, 31], [68, 935, 17]], [[80, 962, 20], [80, 938, 8]]],
    [5, 5], P.SUP_RAMUS, [0, 0, -1]));
  const pubAx = nrm([0, 1, 0.32]);
  out.push(ellO([11.5, 911, 41], [pubAx, [1, 0, 0], nrm(cross(pubAx, [1, 0, 0]))], [19.5, 10.5, 7.5], P.PUBIC_BODY));
  out.push(ell(LM.pubicTubercle, [5, 5, 5], P.PUBIC_BODY), ...chain([[4, 926, 48], [20, 926.5, 52]], [4.0, 4.6], P.PUBIC_BODY));
  out.push(Object.assign(ellO([27, 915, 39], frameAlong([1, 0.5, 0]), [12, 9, 7.5], P.PUBIC_BODY), { k: 5 }));     // body–ramus junction
  out.push(capsule([64, 927, 17], [77, 918, -4], 5.5, 6, P.ISCHIUM));                                                 // foramen margin below the acetabular notch
  // ischiopubic ramus: a flat bar (inferior pubic ramus + ischial ramus) framing the subpubic arch and the obturator foramen
  const RU = [[13, 906, 38], [23, 900, 31], [35, 896, 20], [47, 895, 8], [59, 898, -5]], RL = [[6, 895, 34], [16, 883, 27], [28, 874, 18], [42, 872, 5], [57, 873, -8]];
  const rib = RU.map((u, i) => [u, RL[i]]);
  out.push(...sheet(rib.slice(0, 3), [4.6, 4.6], P.INF_RAMUS, [0, 0, 1]), ...sheet(rib.slice(2), [4.6, 5.2], P.ISCH_RAMUS, [0, 0, 1]));
  // --- ischium: body behind and below the acetabulum, tuberosity, spine, lesser sciatic notch
  out.push(Object.assign(ellO([79, 914, -20], frameAlong([0, 1, 0.15]), [24, 10, 12], P.ISCHIUM), { k: 7 }));
  out.push(...sheet([[[74, 952, -38], [67, 915, -40], [65, 891, -33]], [[86, 946, -24], [80, 906, -26], [72, 886, -24]], [[80, 934, 1], [73, 906, 1], [63, 890, -3]]],
    [7, 7.5, 7], P.ISCHIUM, [-1, 0, 0]));
  const tubAx = nrm([0, 1, 0.45]);
  out.push(Object.assign(ellO([67, 880, -26], [tubAx, [1, 0, 0], nrm(cross(tubAx, [1, 0, 0]))], [21, 11.5, 13], P.TUBEROSITY), { k: 7 }));
  out.push(capsule([65, 915, -41], LM.ischialSpine, 5.4, 1.6, P.ISCH_SPINE));
  out.push(...chain([[66, 913, -40], [64, 900, -38], [65, 891, -34]], [5.4, 5.8, 7.5], P.ISCHIUM));
  // quadrilateral plate: the thin medial wall of the acetabulum inside the lesser pelvis
  out.push(...sheet([[[66, 975, 14], [66, 948, 12]], [[64, 968, -6], [64, 935, -14]], [[64, 950, -34], [66, 918, -36]]], [3, 3], P.ISCHIUM, [-1, 0, 0]));
  return out;
}
// carving: the acetabular socket (+ acetabular fossa and notch), the symphyseal plane and the sacrum's joint space
function cutters() {
  const H = PELVIS.hjc, n = ACET_N, e0 = sub([0, -1, 0.25], mul(n, dot([0, -1, 0.25], n))), e = nrm(e0);
  const fossaC = add(sub(H, mul(n, 16.5)), mul(e, 5)), notchA = add(add(H, mul(e, 17)), mul(n, 7)), notchB = add(add(H, mul(e, 29)), mul(n, 8));
  const notch = capsule(notchA, notchB, 8.5, 8.5, 0);
  return { H, n, e, socket: (p) => len(sub(p, H)) - PELVIS.socketR, fossa: (p) => len(sub(p, fossaC)) - 11, notch: (p) => notch.d(p), fossaC };
}

// ---------- sacrum distance, baked once on a grid around the sacroiliac joint (rest pose, world coordinates) ----------
let SAC = null;
function bakeSacrum(sacrumEl) {
  const comp = C.compile(sacrumEl), lo = [14, 950, -102], hi = [82, 1068, 6], cs = 2;
  const n = [0, 1, 2].map((i) => Math.round((hi[i] - lo[i]) / cs) + 1), v = new Float32Array(n[0] * n[1] * n[2]);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const w = [lo[0] + i * cs, lo[1] + j * cs, lo[2] + k * cs], l = C.toLocal(sacrumEl, w);
    v[(i * n[1] + j) * n[2] + k] = Math.min(comp.sdf(l[0], l[1], l[2]), 40);
  }
  SAC = { lo, cs, n, v };
  return SAC;
}
function sacDist(p) {
  if (!SAC) return 99;
  const { lo, cs, n, v } = SAC, f = [0, 1, 2].map((i) => (p[i] - lo[i]) / cs);
  if (f[0] < 0 || f[1] < 0 || f[2] < 0 || f[0] >= n[0] - 1 || f[1] >= n[1] - 1 || f[2] >= n[2] - 1) return 99;
  const i = Math.floor(f[0]), j = Math.floor(f[1]), k = Math.floor(f[2]), a = f[0] - i, b = f[1] - j, c = f[2] - k;
  const g = (di, dj, dk) => v[((i + di) * n[1] + (j + dj)) * n[2] + (k + dk)];
  const x00 = g(0, 0, 0) * (1 - a) + g(1, 0, 0) * a, x10 = g(0, 1, 0) * (1 - a) + g(1, 1, 0) * a, x01 = g(0, 0, 1) * (1 - a) + g(1, 0, 1) * a, x11 = g(0, 1, 1) * (1 - a) + g(1, 1, 1) * a;
  return (x00 * (1 - b) + x10 * b) * (1 - c) + (x01 * (1 - b) + x11 * b) * c;
}

// ---------- the hip bone field with a grid cache (construction frame = left hip in world coordinates) ----------
let SHAPE = null;
function shapeCache() {
  if (SHAPE) return SHAPE;
  const prims = hipPrims(), cut = cutters(), Ks = 3.4;
  const gv = new Float64Array(GROUP + 2), gl = [];
  const unite = (p, list) => {        // plain minimum inside one sheet (its triangles), smooth union between parts
    let d = 1e9; gl.length = 0;
    for (let i = 0; i < list.length; i++) { const q = list[i], v = q.d(p);
      if (q.group) { if (gv[q.group] === 0) { gv[q.group] = v === 0 ? 1e-12 : v; gl.push(q.group); } else if (v < gv[q.group]) gv[q.group] = v; }
      else d = d === 1e9 ? v : smin(d, v, q.k || Ks); }
    for (const g of gl) { d = d === 1e9 ? gv[g] : smin(d, gv[g], Ks); gv[g] = 0; }
    return d;
  };
  const carve = (p, d) => {
    d = Math.max(d, -cut.socket(p), -cut.fossa(p), -cut.notch(p), PELVIS.symphysisX - p[0]);
    const s = sacDist(p);
    if (s < 20) d = Math.max(d, PELVIS.siGap - s);
    return d;
  };
  const raw = (p) => unite(p, prims);
  const full = (p) => carve(p, raw(p));
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const q of prims) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q.c[i] - q.R); b[i + 3] = Math.max(b[i + 3], q.c[i] + q.R); }
  b[0] = Math.max(b[0], PELVIS.symphysisX - 1);
  const cs = 4, n = [0, 1, 2].map((i) => Math.ceil((b[i + 3] - b[i]) / cs)), half = (cs * Math.sqrt(3)) / 2, cells = new Array(n[0] * n[1] * n[2]);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const c = [b[0] + (i + 0.5) * cs, b[1] + (j + 0.5) * cs, b[2] + (k + 0.5) * cs];
    let lb = 1e9; const cand = [];
    for (const q of prims) { const s0 = len(sub(c, q.c)) - q.R; if (s0 < half + (q.k || Ks) + 1) cand.push(q); else lb = Math.min(lb, s0); }
    const dr = cand.length ? Math.min(unite(c, cand), lb) : lb;
    const near = dr < 1.3 * half + 2 ? cand.filter((q) => q.d(c) < 1.3 * half + (q.k || Ks) + 1) : null;
    cells[(i * n[1] + j) * n[2] + k] = { dc: dr, near };
  }
  const field = (p) => {
    const i = Math.floor((p[0] - b[0]) / cs), j = Math.floor((p[1] - b[1]) / cs), k = Math.floor((p[2] - b[2]) / cs);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) {
      const q = [Math.max(b[0], Math.min(b[3], p[0])), Math.max(b[1], Math.min(b[4], p[1])), Math.max(b[2], Math.min(b[5], p[2]))];
      return len(sub(p, q)) + 0.5;
    }
    const cell = cells[(i * n[1] + j) * n[2] + k];
    if (!cell.near) return cell.dc - half;                         // far from bone: a safe lower bound (carving only removes)
    const d = unite(p, cell.near);
    return d === 1e9 ? cell.dc - half : carve(p, d);
  };
  const rawFast = (p) => {                                         // uncarved field (joint layers use it)
    const i = Math.floor((p[0] - b[0]) / cs), j = Math.floor((p[1] - b[1]) / cs), k = Math.floor((p[2] - b[2]) / cs);
    if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return 50;
    const cell = cells[(i * n[1] + j) * n[2] + k];
    if (!cell.near) return cell.dc - half;
    const d = unite(p, cell.near); return d === 1e9 ? cell.dc - half : d;
  };
  const D = 4, chunks = [];
  for (let a = 0; a < D; a++) for (let bb = 0; bb < D; bb++) for (let c = 0; c < D; c++) {
    const lo = [a, bb, c].map((v, i) => Math.floor((v * n[i]) / D)), hi = [a, bb, c].map((v, i) => Math.floor(((v + 1) * n[i]) / D));
    const cb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = lo[0]; i < hi[0]; i++) for (let j = lo[1]; j < hi[1]; j++) for (let k = lo[2]; k < hi[2]; k++) {
      if (cells[(i * n[1] + j) * n[2] + k].dc > 1.3 * half + 1) continue;
      const q = [b[0] + i * cs, b[1] + j * cs, b[2] + k * cs];
      for (let t = 0; t < 3; t++) { cb[t] = Math.min(cb[t], q[t] - 1); cb[t + 3] = Math.max(cb[t + 3], q[t] + cs + 1); }
    }
    if (cb[0] < 1e8) chunks.push(cb);
  }
  const nearAt = (p) => {
    const i = Math.floor((p[0] - b[0]) / cs), j = Math.floor((p[1] - b[1]) / cs), k = Math.floor((p[2] - b[2]) / cs);
    const cell = i >= 0 && j >= 0 && k >= 0 && i < n[0] && j < n[1] && k < n[2] ? cells[(i * n[1] + j) * n[2] + k] : null;
    return cell && cell.near && cell.near.length ? cell.near : prims;
  };
  SHAPE = { prims, cut, field, raw, rawFast, box: b, chunks, nearAt, unite };
  return SHAPE;
}
function partOf(p, near, cut) {
  if (cut.socket(p) < 1.5 || cut.fossa(p) < 1.2) return P.ACETABULUM;
  if (p[0] < PELVIS.symphysisX + 1.2 && p[1] > 880 && p[1] < 940) return P.PUBIC_BODY;
  if (sacDist(p) < PELVIS.siGap + 1.2) return P.AURICULAR;
  let best = 1e9, q = null; for (const pr of near) { const v = pr.d(p); if (v < best) { best = v; q = pr; } }
  if (!q) return P.GLUTEAL;
  if (q.isSheet && q.part === P.FOSSA) return q.side(p) > 0 ? P.FOSSA : P.GLUTEAL;
  return q.part;
}
function compileHip(el) {
  const S = shapeCache(), H = PELVIS.hjc, sg = el.mirror ? -1 : 1;
  const toC = (x, y, z) => [sg * x + H[0], y + H[1], z + H[2]];
  const sdf = (x, y, z) => S.field(toC(x, y, z));
  const partAt = (x, y, z) => { const p = toC(x, y, z); return partOf(p, S.nearAt(p), S.cut); };
  const toL = (c) => (sg > 0 ? [c[0] - H[0], c[1] - H[1], c[2] - H[2], c[3] - H[0], c[4] - H[1], c[5] - H[2]]
    : [-(c[3] - H[0]), c[1] - H[1], c[2] - H[2], -(c[0] - H[0]), c[4] - H[1], c[5] - H[2]]);
  return { sdf, partAt, box: toL(S.box), chunks: S.chunks.map((c) => ({ box: toL(c), sdf })) };
}

// ------------------------------------------------------------------------------------------
// 3. Joints. Sacroiliac joint: the two articular cartilages in the joint space between the auricular surfaces (drawn as
//    one thin layer; the joint follows the mean of sacrum and hip bone). Pubic symphysis: the fibrocartilaginous
//    interpubic disc between the symphyseal surfaces.
// ------------------------------------------------------------------------------------------
const SIJ_C = [52, 1020, -40];             // local origin of the left SI joint (world, rest)
const SYM_C = [0, 910, 40];                // local origin of the symphysis
function compileSIJ(el) {
  const S = shapeCache(), sg = el.mirror ? -1 : 1, O = SIJ_C;
  const toC = (x, y, z) => [sg * x + O[0], y + O[1], z + O[2]];
  const sdf = (x, y, z) => {
    const p = toC(x, y, z), s = sacDist(p);
    if (s > 12) return s - 4;
    const layer = Math.max(s - (PELVIS.siGap - 0.5), 0.4 - s);
    return Math.max(layer, S.rawFast(p) + 1.5);                         // only where the hip bone reaches over the sacrum
  };
  const box = sg > 0 ? [-6, -40, -36, 14, 34, 30] : [-14, -40, -36, 6, 34, 30];
  return { sdf, partAt: () => P.SIJ, box };
}
function compileSymphysis() {
  const S = shapeCache(), pub = S.prims.filter((q) => q.part === P.PUBIC_BODY);
  const sdf = (x, y, z) => {
    const p = [Math.abs(x) + 4, y + SYM_C[1], z + SYM_C[2]];        // the symphyseal surface outline, just lateral to the face
    let d = 1e9; for (const q of pub) d = Math.min(d, q.d(p));
    return Math.max(Math.abs(x) - (PELVIS.symphysisX - 0.15), d + 1.2);
  };
  return { sdf, partAt: () => P.SYMPHYSIS, box: [-3, -26, -16, 3, 28, 22] };
}

// ------------------------------------------------------------------------------------------
// 4. Hyoid: U-shaped bone suspended by muscles and ligaments, at the level of C3 (most common in women), its body
//    ≈ 34 mm anterior to C3. No bony joint with the spine or anything else.
// ------------------------------------------------------------------------------------------
function hyoidPrims() {
  const out = [];
  out.push(...chain([[-12, -1, -3.5], [-6, 0, -0.5], [0, 0.3, 0.3], [6, 0, -0.5], [12, -1, -3.5]], [3.4, 4.2, 4.4, 4.2, 3.4], P.HYOID_BODY));
  out.push(ellO([0, 0.6, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [10, 5.4, 3.6], P.HYOID_BODY));
  for (const s of [-1, 1]) {
    out.push(...chain([[12 * s, -1, -3.5], [16.5 * s, 2.5, -12], [19.5 * s, 6, -21], [21 * s, 8.5, -27]], [3.0, 2.3, 1.9, 1.7], P.GREATER_HORN));
    out.push(ell([21.3 * s, 8.9, -28.2], [2.4, 2.4, 2.4], P.GREATER_HORN));
    out.push(capsule([10 * s, 2.5, -3.5], [11.5 * s, 7.5, -6], 1.9, 1.2, P.LESSER_HORN));
  }
  return out;
}
let HY = null;
function compileHyoid() {
  const prims = HY || (HY = hyoidPrims());
  const sdf = (x, y, z) => { let d = 1e9; for (const q of prims) d = d === 1e9 ? q.d([x, y, z]) : smin(d, q.d([x, y, z]), 1.2); return d; };
  const partAt = (x, y, z) => { let b = 1e9, part = P.HYOID_BODY; for (const q of prims) { const v = q.d([x, y, z]); if (v < b) { b = v; part = q.part; } } return part; };
  return { sdf, partAt, box: [-26, -8, -33, 26, 13, 7] };
}

// ------------------------------------------------------------------------------------------
// 5. Build: elements, landmarks and attachment frames (rest pose).
// ------------------------------------------------------------------------------------------
function build(spine) {
  const S = spine.els.find((e) => e.id === "S"), C3 = spine.els.find((e) => e.id === "C3");
  bakeSacrum(S); SHAPE = null;
  const I = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const H = PELVIS.hjc, mir = (p) => [-p[0], p[1], p[2]];
  const els = [];
  for (const side of ["L", "R"]) {
    const m = side === "L" ? (p) => p : mir, nm = side === "L" ? "left" : "right";
    els.push({ kind: "hip", id: `HIP_${side}`, name: `Hip bone ${nm}`, region: "pelvis", side, o: m(H), R: I(), psi: 0, mirror: side === "R",
      landmarks: Object.fromEntries(Object.entries(LM).map(([k, p]) => [k, m(p)])),
      acetabulum: { c: m(H), n: side === "L" ? ACET_N : mir(ACET_N), radius: PELVIS.socketR },
      joint: { sacroiliac: `SIJ_${side}`, symphysis: "PUBIC_SYMPHYSIS", hip: "future femoral head (not built)" } });
  }
  for (const side of ["L", "R"]) {
    const m = side === "L" ? (p) => p : mir;
    els.push({ kind: "joint", joint: "sacroiliac", id: `SIJ_${side}`, name: `Sacroiliac joint ${side === "L" ? "left" : "right"}`, region: "pelvis", side,
      o: m(SIJ_C), R: I(), psi: 0, mirror: side === "R", between: ["S", `HIP_${side}`] });
  }
  els.push({ kind: "joint", joint: "symphysis", id: "PUBIC_SYMPHYSIS", name: "Pubic symphysis", region: "pelvis", side: "M", o: SYM_C.slice(), R: I(), psi: 0, between: ["HIP_L", "HIP_R"] });
  // hyoid at C3: body centre 34 mm anterior to the anterior surface of C3, at its lower half
  const c3Front = C.toWorld(C3, [0, -C3.hc * 0.2, C3.D / 2]);
  const hy = [0, c3Front[1] - 2, c3Front[2] + 34 + 4];
  els.push({ kind: "hyoid", id: "HYOID", name: "Hyoid", region: "hyoid", side: "M", o: hy, R: I(), psi: 0, follows: "C3",
    note: "suspended by muscles and ligaments: no bony joint; follows C3 as a stand-in until the head and neck soft tissue exist" });
  return { els, landmarks: LM, acetN: ACET_N, pelvis: PELVIS, rom: ROM, siAxis: { o: [0, SIJ_C[1] - 4, SIJ_C[2] - 6], u: [1, 0, 0] } };
}
C.registerKind && C.registerKind("hip", compileHip);
C.registerKind && C.registerKind("joint", (el) => (el.joint === "symphysis" ? compileSymphysis(el) : compileSIJ(el)));
C.registerKind && C.registerKind("hyoid", compileHyoid);

const API = { P, LM, PELVIS, ROM, ACET_N, build, compileHip, hipPrims, cutters, sacDist, shapeCache, SIJ_C, SYM_C };
if (NODE) module.exports = API;
else root.PelvisCore = API;
})(typeof self !== "undefined" ? self : this);
