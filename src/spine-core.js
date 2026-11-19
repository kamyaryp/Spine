// Spine core: anatomy data, assembly (rig) and SDF shapes for every element of the spinal column.
// Units: millimetres. Character space: x = subject's left, y = up (0 = floor), z = anterior.
// Every element (vertebra, disc, sacrum, coccyx) has a local frame: origin at its body centre,
// y along the body axis (normal to the mid-plane between its end plates), z anterior, x left.
// Local -> world is a rotation about x by `psi` (sagittal tilt) plus a translation.
(function (root) {
"use strict";
const DEG = Math.PI / 180;

// ------------------------------------------------------------------------------------------
// 1. Subject and scaling
// ------------------------------------------------------------------------------------------
const SUBJECT = { sex: "female", height: 1830, mass: 78 };
// Reference vertebral dimensions below are adult means (Panjabi et al. 1991/1992 style,
// mostly male specimens of ~176 cm). Lengths scale with stature; transverse/AP sizes get a
// further female factor (female vertebral cross-sections are smaller at equal stature).
const LEN = SUBJECT.height / 1760;      // 1.04
const WID = LEN * 0.93;                 // 0.967
// Regional height calibration so the assembled column meets external landmarks of the whole figure
// (S1 from the hip, cervicale = C7 spinous tip, atlas below the skull). Applied to body/disc heights.
const HCAL = { cervical: 1.0, thoracolumbar: 1.03 };

// ------------------------------------------------------------------------------------------
// 2. Per-level table, C3..L5 (reference values before scaling)
//    W/D: end-plate width/depth; hp: posterior body height; w: body wedge (deg, + = anterior taller)
//    cw/cd: canal width/depth; pw/ph: pedicle width/height; tp: transverse-process tip span;
//    spL: spinous length beyond the lamina; spA: spinous downward inclination (deg); spH: spinous height
// ------------------------------------------------------------------------------------------
const T = (id, W, D, hp, w, cw, cd, pw, ph, tp, spL, spA, spH) => ({ id, W, D, hp, w, cw, cd, pw, ph, tp, spL, spA, spH });
const LEVELS = [
  T("C3", 16.5, 15.5, 14.0, 0, 23.5, 14.5, 5.5, 7.5, 50, 15, 32, 7),
  T("C4", 17.0, 15.8, 13.8, 0, 24.5, 14.5, 5.5, 7.5, 52, 15, 34, 7),
  T("C5", 18.0, 16.2, 13.5, 0, 25.0, 14.5, 5.8, 7.5, 54, 16, 36, 7),
  T("C6", 19.5, 16.8, 13.6, -0.5, 25.0, 14.5, 6.0, 7.5, 56, 20, 38, 8),
  T("C7", 21.0, 16.5, 14.8, -1, 24.0, 14.5, 6.5, 8.0, 70, 30, 42, 10),
  T("T1", 26.0, 17.0, 15.5, -0.5, 21.0, 14.5, 8.0, 9.5, 76, 34, 40, 9),
  T("T2", 26.0, 18.5, 17.0, -1.5, 18.0, 15.0, 7.0, 11.0, 72, 37, 48, 8),
  T("T3", 26.5, 20.5, 17.5, -3, 16.5, 15.0, 5.0, 11.5, 68, 38, 55, 8),
  T("T4", 27.0, 22.5, 17.8, -3.5, 16.0, 15.0, 5.0, 11.5, 66, 38, 60, 8),
  T("T5", 28.0, 24.5, 18.2, -4, 16.0, 15.0, 5.0, 11.5, 64, 39, 63, 8),
  T("T6", 29.0, 26.0, 18.8, -4.5, 16.0, 15.0, 5.2, 12.0, 62, 39, 65, 8),
  T("T7", 30.0, 27.5, 19.3, -4.5, 16.0, 15.0, 5.5, 12.0, 60, 39, 65, 8),
  T("T8", 31.5, 28.5, 19.8, -4, 16.5, 15.0, 6.0, 12.5, 58, 37, 62, 8),
  T("T9", 33.0, 29.5, 20.6, -3.5, 16.5, 15.5, 6.5, 13.0, 56, 35, 56, 9),
  T("T10", 35.0, 30.5, 21.5, -3, 17.0, 15.5, 7.0, 14.0, 54, 33, 46, 10),
  T("T11", 38.0, 31.0, 22.5, -2.5, 18.0, 16.0, 8.0, 15.0, 46, 31, 30, 12),
  T("T12", 40.0, 32.0, 23.5, -2, 20.5, 16.5, 8.0, 15.5, 40, 30, 10, 16),
  T("L1", 42.0, 33.0, 25.5, -3, 22.0, 17.0, 8.5, 15.0, 68, 29, 0, 20),
  T("L2", 44.0, 34.0, 26.5, -1, 22.0, 17.0, 9.0, 14.5, 76, 29, 0, 22),
  T("L3", 46.0, 35.0, 26.8, 0, 23.0, 17.0, 10.5, 14.5, 84, 28, 2, 22),
  T("L4", 48.0, 35.0, 26.2, 1, 24.0, 17.0, 13.0, 14.0, 84, 27, 8, 21),
  T("L5", 50.0, 35.0, 24.5, 4.5, 26.0, 16.0, 17.0, 14.0, 88, 23, 22, 18),
];
// Intervertebral discs: mid-depth height (reference, healthy young adult) and wedge (deg, + = lordotic).
const DISCS = [
  ["C2", "C3", 4.5, 3], ["C3", "C4", 5.0, 4], ["C4", "C5", 5.2, 5], ["C5", "C6", 5.5, 5], ["C6", "C7", 5.5, 3], ["C7", "T1", 4.8, 0],
  ["T1", "T2", 4.2, -0.3], ["T2", "T3", 4.2, -0.3], ["T3", "T4", 4.3, -0.6], ["T4", "T5", 4.3, -0.6], ["T5", "T6", 4.5, -0.6],
  ["T6", "T7", 4.7, -0.6], ["T7", "T8", 5.0, -0.6], ["T8", "T9", 5.3, -0.6], ["T9", "T10", 5.8, -0.6], ["T10", "T11", 6.3, -0.6],
  ["T11", "T12", 7.0, -0.5], ["T12", "L1", 8.0, 1],
  ["L1", "L2", 9.5, 6], ["L2", "L3", 10.5, 8], ["L3", "L4", 11.0, 10], ["L4", "L5", 11.5, 13], ["L5", "S1", 11.0, 19],
];
// Global posture targets (healthy adult female, neutral standing).
const POSTURE = {
  sacralSlope: 41,          // S1 end plate to horizontal (deg)
  pelvicTilt: 12,           // hip axis -> S1 centre, from vertical (deg)
  hipToS1: 95,              // hip axis to S1 end-plate centre (mm)
  hipHeight: 0.52 * 1830,   // hip joint centre above the floor (mm)
  c1c2: 22,                 // atlas ring extension relative to the axis (deg)
};
// Range of motion per motion segment (deg): flexion+extension, one-side lateral bend, one-side axial rotation.
// Representative values from White & Panjabi, Clinical Biomechanics of the Spine (2nd ed.).
const ROM = {
  "C1-C2": [20, 5, 40], "C2-C3": [10, 10, 3], "C3-C4": [15, 11, 7], "C4-C5": [20, 11, 7], "C5-C6": [20, 8, 7],
  "C6-C7": [17, 7, 6], "C7-T1": [9, 4, 2], "T1-T2": [4, 6, 9], "T2-T3": [4, 6, 8], "T3-T4": [4, 6, 8], "T4-T5": [4, 6, 8],
  "T5-T6": [4, 6, 8], "T6-T7": [5, 6, 7], "T7-T8": [6, 6, 7], "T8-T9": [6, 6, 6], "T9-T10": [6, 6, 4], "T10-T11": [9, 7, 2],
  "T11-T12": [12, 9, 2], "T12-L1": [12, 8, 2], "L1-L2": [12, 6, 2], "L2-L3": [14, 6, 2], "L3-L4": [15, 8, 2],
  "L4-L5": [16, 6, 2], "L5-S1": [17, 3, 1],
};

// ------------------------------------------------------------------------------------------
// 3. SDF primitives (local coordinates). Each returns {d(x,y,z), box:[x0,y0,z0,x1,y1,z1], part, g}
//    g = group: 0 body (smooth-joined to the arch), 1 arch/processes, 2 subtract.
// ------------------------------------------------------------------------------------------
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h); }
function ellD(x, y, z, cx, cy, cz, rx, ry, rz) {
  const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz;
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz), k1 = Math.sqrt((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2);
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}
function boxOf(cs, pad) {
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const c of cs) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], c[i] - pad[i]); b[i + 3] = Math.max(b[i + 3], c[i] + pad[i]); }
  return b;
}
// oriented rounded box spanning a->b; v: second axis hint; hv, hw half sizes; r corner radius
function seg(a, b, v, hv, hw, r, part, g = 1) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]);
  const u = nrm(d), dt = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  const vv = nrm([v[0] - u[0] * dt, v[1] - u[1] * dt, v[2] - u[2] * dt]), w = cross(u, vv);
  const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  r = Math.min(r, hv, hw);
  const h0 = L / 2, h1 = hv - r, h2 = hw - r;
  const ext = [0, 1, 2].map((i) => Math.abs(u[i]) * (h0 + r) + Math.abs(vv[i]) * hv + Math.abs(w[i]) * hw);
  return { part, g, box: boxOf([c], ext), d(x, y, z) {
    const qx = x - c[0], qy = y - c[1], qz = z - c[2];
    const l0 = Math.abs(qx * u[0] + qy * u[1] + qz * u[2]) - h0, l1 = Math.abs(qx * vv[0] + qy * vv[1] + qz * vv[2]) - h1, l2 = Math.abs(qx * w[0] + qy * w[1] + qz * w[2]) - h2;
    const m0 = l0 > 0 ? l0 : 0, m1 = l1 > 0 ? l1 : 0, m2 = l2 > 0 ? l2 : 0;
    return Math.sqrt(m0 * m0 + m1 * m1 + m2 * m2) + Math.min(Math.max(l0, l1, l2), 0) - r;
  } };
}
function caps(a, b, ra, rb, part, g = 1, s = [1, 1, 1]) {
  const ax = a[0] / s[0], ay = a[1] / s[1], az = a[2] / s[2];
  const bx = b[0] / s[0] - ax, by = b[1] / s[1] - ay, bz = b[2] / s[2] - az, bb = bx * bx + by * by + bz * bz;
  const sm = Math.min(s[0], s[1], s[2]), R = Math.max(ra, rb);
  return { part, g, box: boxOf([a, b], [R * s[0], R * s[1], R * s[2]]), d(x, y, z) {
    const px = x / s[0] - ax, py = y / s[1] - ay, pz = z / s[2] - az;
    const h = clamp((px * bx + py * by + pz * bz) / bb, 0, 1);
    const dx = px - h * bx, dy = py - h * by, dz = pz - h * bz;
    return (Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h)) * sm;
  } };
}
// cervical articular pillar: vertical block whose top/bottom are oblique facet planes (angle a from horizontal,
// superior facet facing up-and-back, inferior facet facing down-and-forward)
function pillar(c, hx, hy, hz, a, r, part, g = 1) {
  const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), ext = hy + hz * Math.tan(a * DEG);
  return { part, g, box: boxOf([c], [hx + 1, ext + 1, hz + 1]), d(x, y, z) {
    const yy = y - c[1], zz = z - c[2], q = Math.min(1, Math.abs(yy) / hy);
    const dx = Math.abs(x - c[0]) - (hx * (1 - 0.35 * q * q) - r), dz = Math.abs(z - c[2]) - (hz - r);
    const dt = (yy - hy) * ca - zz * sa + r * 0, db = -(yy + hy) * ca + zz * sa;
    const e = Math.max(dx, dz);
    const box = (e > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : e) - r;
    return Math.max(box, dt, db);
  } };
}
function ell(c, r, part, g = 1) {
  return { part, g, box: boxOf([c], r), d: (x, y, z) => ellD(x, y, z, c[0], c[1], c[2], r[0], r[1], r[2]) };
}
// cylinder (for holes): axis through c along unit a, radius r, half length hl
function cyl(c, a, r, hl, part = 19, g = 2) {
  const u = nrm(a);
  return { part, g, box: boxOf([c], [hl + r, hl + r, hl + r]), d(x, y, z) {
    const qx = x - c[0], qy = y - c[1], qz = z - c[2], t = qx * u[0] + qy * u[1] + qz * u[2];
    const rx = qx - t * u[0], ry = qy - t * u[1], rz = qz - t * u[2];
    const dr = Math.sqrt(rx * rx + ry * ry + rz * rz) - r, dh = Math.abs(t) - hl;
    return Math.min(Math.max(dr, dh), 0) + Math.hypot(Math.max(dr, 0), Math.max(dh, 0));
  } };
}
// vertebral body / disc prism: elliptic (optionally heart or kidney shaped) section, wedge end planes.
// opt: {W, D, hc, w (deg), back (posterior concavity mm), heart (0..1 anterior narrowing), cup (end-plate cup depth),
//       lip (ring apophysis), bulge (disc bulge mm), part}
function prism(o) {
  const rx = o.W / 2, rz = o.D / 2, tw = Math.tan((o.w || 0) * DEG / 2), hh = o.hc / 2;
  const back = o.back || 0, heart = o.heart || 0, cup = o.cup || 0, bulge = o.bulge || 0;
  const aff = o.aff, extra = aff ? 4 : 0;          // aff: posed disc -> rest frames of the upper / lower end plates
  const pad = [rx + bulge + 1 + extra, hh + Math.abs(tw) * rz + 1 + extra, rz + bulge + 1 + extra];
  return { part: o.part, g: o.g != null ? o.g : 0, box: [-pad[0], -pad[1], -pad[2], pad[0], pad[1], pad[2]], d(x, y, z) {
    const yt = hh + z * tw, yb = -hh - z * tw;       // top / bottom planes (wedge)
    const ym = (yt + yb) / 2, yh = (yt - yb) / 2;
    const s = 1 + (bulge > 0 ? (bulge / rx) * Math.max(0, 1 - ((y - ym) / yh) ** 2) : 0);
    const kx = rx * s * (1 - heart * Math.max(0, z / rz) ** 2 * 0.35), kz = rz * s;
    let d = (Math.hypot(x / kx, z / kz) - 1) * Math.min(kx, kz);
    if (back > 0) d = Math.max(d, (-rz + back * (1 - (x / (rx * 0.85)) ** 2)) - z);
    if (aff) {
      const U = aff.up, Lo = aff.lo;
      const uy = U[3] * x + U[4] * y + U[5] * z + U[10], uz = U[6] * x + U[7] * y + U[8] * z + U[11];
      const ly = Lo[3] * x + Lo[4] * y + Lo[5] * z + Lo[10], lz = Lo[6] * x + Lo[7] * y + Lo[8] * z + Lo[11];
      d = Math.max(d, uy - (hh + uz * tw), (-hh - lz * tw) - ly);   // the disc follows both end plates
    } else d = Math.max(d, Math.abs(y - ym) - yh);
    if (cup > 0) {
      const c1 = ellD(x, y, z, 0, yt + cup * 0.75, 0, rx * 0.72, cup * 1.4, rz * 0.68);
      const c2 = ellD(x, y, z, 0, yb - cup * 0.75, 0, rx * 0.72, cup * 1.4, rz * 0.68);
      d = Math.max(d, -c1, -c2);
    }
    return d;
  } };
}

// ------------------------------------------------------------------------------------------
// 4. Element builders. Each returns {prims, k} in local coordinates.
// ------------------------------------------------------------------------------------------
const P = { BODY: 1, PEDICLE: 2, LAMINA: 3, TP: 4, SAP: 5, IAP: 6, SPINOUS: 7, DENS: 8, ANT_ARCH: 9, POST_ARCH: 10,
  LAT_MASS: 11, DISC: 12, ALA: 13, CREST: 14, COCCYX: 15, UNCINATE: 16, PILLAR: 17, SACRAL_BODY: 18, FORAMEN: 19 };
const PART_NAMES = { 1: "Vertebral body", 2: "Pedicle", 3: "Lamina", 4: "Transverse process", 5: "Superior articular process",
  6: "Inferior articular process", 7: "Spinous process", 8: "Dens (odontoid process)", 9: "Anterior arch", 10: "Posterior arch",
  11: "Lateral mass", 12: "Intervertebral disc", 13: "Sacral ala / lateral part", 14: "Median sacral crest", 15: "Coccygeal segment",
  16: "Uncinate process", 17: "Articular pillar", 18: "Sacral vertebral body", 19: "Foramen" };

function scaled(L) {
  const hk = L.id[0] === "C" ? HCAL.cervical : HCAL.thoracolumbar;
  return { id: L.id, W: L.W * WID, D: L.D * WID, hp: L.hp * LEN * hk, w: L.w, cw: L.cw * WID, cd: L.cd * WID, pw: L.pw * WID,
    ph: L.ph * LEN, tp: L.tp * WID, spL: L.spL * LEN, spA: L.spA, spH: L.spH * LEN };
}
const hcOf = (v) => v.hp + (v.D / 2) * Math.tan(v.w * DEG);

function lumbar(v) {
  const hc = hcOf(v), D = v.D, zp = -D / 2, cw = v.cw, cd = v.cd, pw = v.pw;
  const px = cw / 2 + pw / 2 - 0.5, yp = hc * 0.14, pl = Math.max(9, cd * 0.55), lt = 4.6;
  const zl = zp - cd - lt / 2;                         // lamina midline (centre of thickness)
  const pr = [prism({ W: v.W, D, hc, w: v.w, back: 2.4, cup: 3.2, part: P.BODY })];
  const isL5 = v.id === "L5";
  for (const s of [-1, 1]) {
    pr.push(caps([s * px, yp, zp + 3], [s * px, yp - 0.5, zp - pl], pw / 2, pw / 2, P.PEDICLE, 1, [1, v.ph / pw, 1]));
    pr.push(seg([s * px, yp, zp - pl], [s * 2, yp - 5.5, zl], [0, 1, 0], 6.5, lt, 2, P.LAMINA));
    // transverse process: long and slender, flattened front-to-back; L5's is stout and arises from the body too
    const tx = v.tp / 2, tz = zp - pl * 0.45 - 2;
    if (isL5) {
      pr.push(caps([s * (px - 2), yp - 2, zp + 2], [s * (tx - 4), yp - 3, tz - 1], 7.5, 4.2, P.TP, 1, [1, 1.1, 0.8]));
    } else {
      pr.push(seg([s * (px + 1), yp, tz + 2], [s * (tx - 3), yp + 1, tz - 2.5], [0, 1, 0], 4.6, 3.0, 2.0, P.TP));
      pr.push(ell([s * (tx - 3), yp + 1, tz - 2.5], [3.8, 4.8, 3.2], P.TP));
    }
    // superior articular process: rises above the pedicle, facet facing back-and-in; mammillary process on its rim
    const zs = zp - pl - 1;
    pr.push(seg([s * (px + 0.5), yp + 1, zs], [s * (px + 2), hc / 2 + 7.5, zs - 4], [-0.35 * s, 0, -1], 3.7, 6.6, 2.3, P.SAP));
    pr.push(ell([s * (px + 4.5), hc / 2 + 1.5, zs - 8], [2.8, 3.8, 2.8], P.SAP));
    // inferior articular process: hangs below the lamina, facet facing forward-and-out
    const xi = isL5 ? cw / 2 - 0.5 : cw / 2 - 2;
    pr.push(seg([s * xi, -hc / 2 + 7, zl - 1.5], [s * (xi + 1), -hc / 2 - (isL5 ? 5 : 6.5), zl - 3], [s, 0, 0.3], 3.5, 5.0, 2.3, P.IAP));
  }
  // spinous process: hatchet-shaped, horizontal, thick posterior border
  const a = v.spA * DEG, z0 = zl - 2, y0 = -1.5, dz = -Math.cos(a), dy = -Math.sin(a);
  const z1 = z0 + dz * v.spL, y1 = y0 + dy * v.spL;
  pr.push(seg([0, y0, z0], [0, y1, z1], [0, 1, 0], v.spH / 2, 3.6, 2.4, P.SPINOUS));
  pr.push(caps([0, y1 + v.spH / 2 - 2, z1 - 0.5], [0, y1 - v.spH / 2 + 2, z1 + 0.5], 3.6, 3.6, P.SPINOUS));
  return { prims: pr, k: 2.6 };
}

function thoracic(v, lumbarLike) {
  const hc = hcOf(v), D = v.D, zp = -D / 2, cw = v.cw, cd = v.cd, pw = v.pw;
  const px = cw / 2 + pw / 2, yp = hc * 0.18, pl = Math.max(7, cd * 0.5), lt = 3.6;
  const zl = zp - cd - lt / 2;
  const pr = [prism({ W: v.W, D, hc, w: v.w, back: 1.6, heart: 1, cup: 2.4, part: P.BODY })];
  for (const s of [-1, 1]) {
    pr.push(caps([s * px, yp, zp + 2], [s * px, yp, zp - pl], pw / 2, pw / 2, P.PEDICLE, 1, [1, v.ph / pw, 1]));
    // lamina: broad, shingled plate reaching below the body
    pr.push(seg([s * (px + 1), yp + 2, zp - pl], [s * 2, -hc / 2 - 1, zl], [0, 0.6, -0.4], hc * 0.36, lt / 2 + 0.6, 1.6, P.LAMINA));
    // transverse process: backwards-and-out, slightly up, club-shaped tip (costal facet)
    const bx = px + 1.5, bz = zp - pl + 1, tx = v.tp / 2 - 3.5;
    const back = Math.tan((22 + (v.idx - 5) * 1.2) * DEG) * (tx - bx);
    const tipZ = bz - back, tipY = yp + 2.5;
    pr.push(seg([s * bx, yp + 1, bz], [s * tx, tipY, tipZ], [0, 1, 0], v.id === "T12" ? 3.2 : 4.4, v.id === "T12" ? 2.6 : 3.6, 1.8, P.TP));
    pr.push(ell([s * tx, tipY, tipZ], v.id === "T12" ? [3, 3.5, 3] : [4.6, 5, 4.4], P.TP));
    // superior articular process: thin plate, facet nearly coronal (faces back)
    const zs = zp - pl - 0.5, zsap = v.id === "T1" ? zs + 2 : zs;
    pr.push(seg([s * (px - 0.5), yp + 2, zsap], [s * (px - 0.5), hc / 2 + 4.5, zsap - 1.5], [s, 0, 0], 4.0, 2.2, 1.6, P.SAP));
    // inferior articular process: below the lamina, facet faces forward (lumbar-like in T12 and lumbarLike)
    if (lumbarLike) {
      pr.push(seg([s * (cw / 2 - 2.5), -hc / 2 + 5, zl - 1], [s * (cw / 2 - 1.5), -hc / 2 - 8, zl - 2], [s, 0, 0.3], 3.2, 4.5, 2, P.IAP));
    } else {
      pr.push(seg([s * (px - 1.5), -hc / 2 + 2, zs - 5.4], [s * (px - 1.5), -hc / 2 - 5.5, zs - 6.2], [s, 0, 0], 3.8, 2.0, 1.5, P.IAP));
    }
  }
  // spinous process: long, slender, sloping steeply downwards in the mid-thoracic region
  const a = v.spA * DEG, z0 = zl - 1, y0 = -hc * 0.12, dz = -Math.cos(a), dy = -Math.sin(a);
  const z1 = z0 + dz * v.spL, y1 = y0 + dy * v.spL;
  pr.push(seg([0, y0, z0], [0, y1, z1], [0, -dz, dy], v.spH / 2, 2.6, 1.8, P.SPINOUS));
  pr.push(ell([0, y1, z1], [3.2, Math.max(3.4, v.spH / 2 + 0.6), 3.2], P.SPINOUS));
  return { prims: pr, k: 2.2 };
}

function cervical(v) {
  const hc = hcOf(v), D = v.D, zp = -D / 2, cw = v.cw, cd = v.cd, pw = v.pw;
  const isC7 = v.id === "C7", px = cw / 2 + pw / 2, pl = 5.5, lt = 3.0;
  const zl = zp - cd - lt / 2;
  const pr = [prism({ W: v.W, D, hc, w: v.w, back: 0.8, cup: 0, part: P.BODY })];
  // anterior-inferior lip of the body
  pr.push({ ...ell([0, -hc / 2 + 0.5, D / 2 - 2.2], [v.W * 0.33, 2.4, 2.6], P.BODY), g: 0 });
  for (const s of [-1, 1]) {
    // uncinate processes: raised lateral lips of the superior end plate
    pr.push({ ...ell([s * (v.W / 2 - 1.6), hc / 2 + 0.6, -1], [1.8, 3.2, D * 0.33], P.UNCINATE), g: 0 });
    pr.push(caps([s * px, 0.5, zp + 2], [s * px, 0.5, zp - pl], pw / 2, pw / 2, P.PEDICLE, 1, [1, v.ph / pw, 1]));
    // articular pillar (lateral mass) with oblique facets: top faces up-and-back
    const zc = zp - pl - 2.5, xc = px + 1.2;
    pr.push(pillar([s * xc, 0, zc], 5.0, hc / 2 + 1.5, 5.2, 45, 1.6, P.PILLAR));
    // lamina: thin, slanting back to the midline
    pr.push(seg([s * (xc - 2), -0.5, zc - 3], [s * 1.5, -2, zl], [0, 1, 0], hc * 0.26, lt / 2, 1.2, P.LAMINA));
    // transverse process: anterolateral, gutter with foramen transversarium; tubercles at the tip
    const tx = v.tp / 2, tz = zp + 3.5;
    pr.push(seg([s * (v.W / 2 - 2), -0.5, tz], [s * (tx - 2.5), -2.2, tz + (isC7 ? -3 : 0.5)], [0, 1, 0], 2.8, isC7 ? 3.4 : 5.2, 1.4, P.TP));
    if (!isC7) pr.push(ell([s * (tx - 2.5), -2.8, tz + 3], [2.4, 2.8, 2.4], P.TP));
    pr.push(ell([s * (tx - 2.5), -2.6, tz - (isC7 ? 3 : 2.6)], [2.6, 3, 2.6], P.TP));
    pr.push(cyl([s * (v.W / 2 + 3.2), 0, tz + 0.4], [0, 1, 0], isC7 ? 2.0 : 2.7, 8));
  }
  // spinous process: short and bifid (C3-C6); long with a single tubercle at C7 (vertebra prominens)
  const a = v.spA * DEG, z0 = zl - 0.5, y0 = -1, dz = -Math.cos(a), dy = -Math.sin(a);
  const z1 = z0 + dz * v.spL, y1 = y0 + dy * v.spL;
  pr.push(seg([0, y0, z0], [0, y1, z1], [0, -dz, dy], v.spH / 2, isC7 ? 3.2 : 2.6, 1.6, P.SPINOUS));
  if (isC7) pr.push(ell([0, y1, z1], [4.4, 4.6, 4.2], P.SPINOUS));
  else for (const s of [-1, 1]) pr.push(ell([s * 2.8, y1 - 0.5, z1 + 0.5], [2.4, 3.0, 2.8], P.SPINOUS));
  return { prims: pr, k: 1.8 };
}

// Axis (C2): body + dens, large superior facets, thick laminae, big bifid spinous process.
function axis(v) {
  const hc = v.hc, D = v.D, zp = -D / 2, W = v.W;
  const pr = [prism({ W, D, hc, w: 0, back: 0.8, part: P.BODY })];
  pr.push({ ...ell([0, -hc / 2 + 0.6, D / 2 - 2.4], [W * 0.33, 3.4, 2.8], P.BODY), g: 0 });   // anterior-inferior lip
  const lean = Math.tan(v.densLean * DEG), dTop = hc / 2 + v.densH - v.densR;
  pr.push({ ...caps([0, hc / 2 - 2, v.densZ], [0, dTop, v.densZ - (v.densH - v.densR + 2) * lean], v.densR, v.densR * 0.92, P.DENS, 0, [0.9, 1, 1]) });
  pr.push(ell([0, dTop + v.densR * 0.1, v.densZ - (v.densH - v.densR * 0.9 + 2) * lean], [v.densR * 0.95, v.densR * 1.05, v.densR], P.DENS));
  for (const s of [-1, 1]) {
    // superior articular facets: broad, flat, sloping laterally, lateral to the dens
    pr.push(seg([s * 8, hc / 2 - 1.2, v.facetZ], [s * 21, hc / 2 - 5, v.facetZ], [0, 1, 0], 3.2, 8, 2.2, P.SAP));
    pr.push(seg([s * 13, hc / 2 - 5, v.facetZ], [s * 12.5, -hc / 2 + 3, zp - 4], [1, 0, 0], 5, 5, 2.2, P.PEDICLE));
    // inferior articular process (C2-C3 facet), behind the pedicle
    pr.push(pillar([s * 14.5, -hc / 2 + 3, zp - 11], 5.0, 5.4, 5.0, 45, 1.6, P.PILLAR));
    // thick lamina
    pr.push(seg([s * 14, -hc / 2 + 6, zp - 13], [s * 2, -hc / 2 + 4, zp - 25], [0, 1, 0], 6.5, 3.0, 1.6, P.LAMINA));
    // small transverse process pointing down-and-out, with foramen
    pr.push(seg([s * 15, hc / 2 - 7, zp + 1], [s * 26, hc / 2 - 12, zp], [0, 1, 0], 3.2, 4, 1.4, P.TP));
    pr.push(cyl([s * 18.5, hc / 2 - 8, zp + 1], [0.3 * s, 1, 0], 2.6, 7));
  }
  // large bifid spinous process
  const ca = Math.cos(32 * DEG), sa = Math.sin(32 * DEG), y0 = -hc / 2 + 5, z0 = zp - 24, L = 20 * LEN;
  pr.push(seg([0, y0, z0], [0, y0 - sa * L, z0 - ca * L], [0, ca, -sa], 5.6, 3.6, 2.0, P.SPINOUS));
  for (const s of [-1, 1]) pr.push(ell([s * 4.0, y0 - sa * L - 0.5, z0 - ca * L - 0.5], [3.4, 5.0, 3.6], P.SPINOUS));
  return { prims: pr, k: 1.8 };
}

// Atlas (C1): no body. Ring of anterior arch, two lateral masses and a long posterior arch; wide TPs with foramina.
// Local origin: between the lateral masses, at their mid-height; z anterior.
function atlas(a) {
  const pr = [];
  const lmX = a.lmX, lmH = a.lmH;
  for (const s of [-1, 1]) {
    pr.push({ ...seg([s * lmX, 0, a.lmZ + 10], [s * lmX, 0, a.lmZ - 10], [0, 1, 0], lmH / 2, 6.2, 2.6, P.LAT_MASS), g: 0 });
    pr.push({ ...ell([s * (lmX - 2), lmH / 2 + 3.4, a.lmZ], [6.5, 4.2, 10], 0), g: 2 });       // concave superior facet
    // transverse process: large, with foramen transversarium
    pr.push(seg([s * (lmX + 4), 1, a.lmZ - 1], [s * a.tpX, 0, a.lmZ - 3], [0, 1, 0], 3.6, 4.6, 1.8, P.TP));
    pr.push(ell([s * a.tpX, 0, a.lmZ - 3], [3.6, 4.6, 4.6], P.TP));
    pr.push(cyl([s * (lmX + 8), 0, a.lmZ - 1], [0, 1, 0], 2.8, 8));
  }
  // anterior arch: short curve in front of the dens, with an anterior tubercle
  const arc = (r0x, r0z, cz, a0, a1, n, hv, hw, yc, part) => {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = a0 + (a1 - a0) * (i / n), pt = [r0x * Math.sin(t), yc, cz + r0z * Math.cos(t)];
      if (prev) pr.push(seg(prev, pt, [0, 1, 0], hv, hw, Math.min(hv, hw) * 0.8, part));
      prev = pt;
    }
  };
  arc(lmX + 1, a.archR, 0, -0.95, 0.95, 6, 5.0, 3.0, a.archY, P.ANT_ARCH);
  pr.push(ell([0, a.archY + 0.5, a.archR + 0.4], [5, 5, 2.6], P.ANT_ARCH));
  arc(lmX + 2, a.postR, 0, Math.PI - 1.35, Math.PI + 1.35, 10, 3.8, 3.2, -1.5, P.POST_ARCH);
  pr.push(ell([0, -1.5, -a.postR - 1], [4.5, 4.8, 3.2], P.POST_ARCH));
  return { prims: pr, k: 1.8 };
}

function disc(o) {
  return { prims: [prism({ W: o.W, D: o.D, hc: o.hc, w: o.w, back: o.back, bulge: 0.7, heart: o.heart || 0, part: P.DISC, aff: o.aff })], k: 0 };
}

// Tapered slab between two points of a sagittal centreline: lateral half-width and front/back offsets
// (along the anterior normal) interpolate linearly from a to b. x stays the lateral axis.
function taper(a, b, hx0, hx1, zf0, zf1, zb0, zb1, r, part, g = 1, topCut, round = 0) {
  const dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dy, dz), uy = dy / len, uz = dz / len;
  const ny = -uz, nz = uy;                       // in-plane normal; choose the one pointing anterior (+z)
  const sgn = nz >= 0 ? 1 : -1, Ny = ny * sgn, Nz = nz * sgn;
  const cs = [];
  for (const [p, hx, zf, zb] of [[a, hx0, zf0, zb0], [b, hx1, zf1, zb1]]) for (const zz of [zf, zb]) for (const xx of [-hx, hx]) cs.push([xx, p[1] + Ny * zz, p[2] + Nz * zz]);
  return { part, g, box: boxOf(cs, [r + 1, r + 1, r + 1]), d(x, y, z) {
    const qy = y - a[1], qz = z - a[2], s = qy * uy + qz * uz, Z = qy * Ny + qz * Nz;
    const t = s < 0 ? 0 : s > len ? 1 : s / len;
    const hx = hx0 + (hx1 - hx0) * t, q = Math.min(1, Math.abs(x) / Math.max(hx, 1)), q2 = q * q;
    let zf = zf0 + (zf1 - zf0) * t, zb = zb0 + (zb1 - zb0) * t;
    if (round) { zf -= round * 0.25 * q2 * (zf - zb); zb += round * 0.4 * q2 * (zf - zb); }   // rounder section laterally
    const dx = Math.abs(x) - hx + r, dzz = Math.abs(Z - (zf + zb) / 2) - (zf - zb) / 2 + r, du = Math.abs(s - len / 2) - len / 2 - 0.6 + r;
    let d = Math.hypot(Math.max(dx, 0), Math.max(dzz, 0), Math.max(du, 0)) + Math.min(Math.max(dx, dzz, du), 0) - r;
    if (topCut) d = Math.max(d, topCut(x, y, z));
    return d;
  } };
}

// Sacrum: one fused bone built from a curved centreline through S1..S5 (sacral local frame = S1 body frame).
function sacrum(sg) {
  const pr = [];
  const nY = (p) => Math.cos(p), nZ = (p) => Math.sin(p);
  // centreline nodes: S1 plate, the four fused junctions, apex
  const nodes = [[0, sg[0].cy + nY(sg[0].psi) * sg[0].h / 2, sg[0].cz + nZ(sg[0].psi) * sg[0].h / 2]];
  for (let i = 0; i < sg.length - 1; i++) nodes.push([0, (sg[i].cy + sg[i + 1].cy) / 2, (sg[i].cz + sg[i + 1].cz) / 2]);
  const last = sg[sg.length - 1];
  nodes.push([0, last.cy - nY(last.psi) * last.h / 2, last.cz - nZ(last.psi) * last.h / 2]);
  const hw = [53, 50, 42, 31, 19, 9].map((v) => v * WID);
  const zf = [sg[0].D / 2 - 2, (sg[0].D + sg[1].D) / 4 - 2, (sg[1].D + sg[2].D) / 4 - 1.5, (sg[2].D + sg[3].D) / 4 - 1, (sg[3].D + sg[4].D) / 4 - 1, last.D / 2 - 1];
  const zb = [-35, -31, -26, -21, -15, -8].map((v) => v * WID);
  const W0 = sg[0].W, top = nodes[0][1];
  // the alae: superior surface a little below the S1 end plate, sloping down laterally
  const D0 = sg[0].D;
  const alaCut = (x, y, z) => y - (top - 4 - 0.2 * Math.max(0, Math.abs(x) - W0 / 2) - 0.45 * Math.max(0, -D0 / 2 - z));
  const slabs = [];
  for (let i = 0; i < nodes.length - 1; i++)
    slabs.push(taper(nodes[i], nodes[i + 1], hw[i], hw[i + 1], zf[i], zf[i + 1], zb[i], zb[i + 1], 2.5, P.ALA, 1, i === 0 ? alaCut : null, 1));
  // one continuous bone: blend the slabs smoothly
  const sb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of slabs) for (let k = 0; k < 3; k++) { sb[k] = Math.min(sb[k], p.box[k]); sb[k + 3] = Math.max(sb[k + 3], p.box[k + 3]); }
  pr.push({ part: P.ALA, g: 1, box: sb, d(x, y, z) { let d = slabs[0].d(x, y, z); for (let i = 1; i < slabs.length; i++) d = smin(d, slabs[i].d(x, y, z), 5); return d; } });
  // vertebral bodies on the pelvic (anterior) surface; S1 keeps a true end plate and the promontory
  sg.forEach((s, i) => {
    const toL = (p) => [p[0], s.cy + p[1] * Math.cos(s.psi) - p[2] * Math.sin(s.psi), s.cz + p[1] * Math.sin(s.psi) + p[2] * Math.cos(s.psi)];
    if (i === 0) {
      const b = prism({ W: s.W, D: s.D, hc: s.h, w: 0, back: 1.5, cup: 2.2, part: P.SACRAL_BODY });
      pr.push({ part: P.SACRAL_BODY, g: 0, box: b.box, d: b.d });
    }
    // transverse ridge (fused disc) between bodies
    if (i < sg.length - 1) pr.push({ ...ell([0, nodes[i + 1][1], nodes[i + 1][2]], [s.W / 2 - 2, 1.6, (s.D + sg[i + 1].D) / 4 - 1.2], P.SACRAL_BODY), g: 0 });
    // median sacral crest tubercles S1-S4
    // sacral cornua beside the hiatus
    if (i === 4) for (const sx of [-1, 1]) pr.push(ell(toL([sx * 5, 1.5, -s.D / 2 - 4]), [2.4, 3.6, 2.4], P.CREST));
  });
  // median sacral crest: a low ridge of fused spinous tubercles down the dorsal midline (S1-S4)
  const n0 = [0, nodes[0][1] + (nodes[1][1] - nodes[0][1]) * 0.45, nodes[0][2] + (nodes[1][2] - nodes[0][2]) * 0.45];
  const zb0 = zb[0] + (zb[1] - zb[0]) * 0.45;
  pr.push(taper(n0, nodes[3], 3.6 * WID, 2.6 * WID, zb0 + 3, zb[3] + 3, zb0 - 5, zb[3] - 3.5, 1.6, P.CREST));
  // sacral canal (open at the base) and the hiatus behind S4-S5
  const cw = [15, 13, 11, 9, 7, 5].map((v) => v * WID), cf = sg.map((s) => -s.D / 2 - 0.6), cb = sg.map((s) => -s.D / 2 - s.cd);
  const above = [0, nodes[0][1] + 12 * Math.cos(sg[0].psi), nodes[0][2] + 12 * Math.sin(sg[0].psi)];
  pr.push(taper(above, nodes[1], cw[0], cw[1], cf[0], (cf[0] + cf[1]) / 2, cb[0], (cb[0] + cb[1]) / 2, 2, 19, 2));
  for (let i = 1; i < 4; i++) pr.push(taper(nodes[i], nodes[i + 1], cw[i], cw[i + 1], (cf[i - 1] + cf[i]) / 2, (cf[i] + cf[i + 1]) / 2, (cb[i - 1] + cb[i]) / 2, (cb[i] + cb[i + 1]) / 2, 2, 19, 2));
  pr.push(taper(nodes[3], nodes[5], 7, 5, cf[3], cf[4], cb[3] + 1, -60, 1.5, 19, 2));   // hiatus: canal opens dorsally
  // anterior/posterior sacral foramina at the four fused junctions (through-holes)
  for (let i = 1; i <= 4; i++) {
    const r = [5.6, 5.0, 4.2, 3.4][i - 1] * WID, n = nodes[i];
    const bw = (sg[i - 1].W + sg[i].W) / 4;
    const dy = nodes[i + 1][1] - nodes[i - 1][1], dz = nodes[i + 1][2] - nodes[i - 1][2], l = Math.hypot(dy, dz);
    const ny = -dz / l, nz = dy / l;                                         // anterior normal at the junction
    const zfj = zf[i] - 1, zbj = zb[i] + 1;
    for (const sx of [-1, 1]) {
      // anterior (pelvic) foramen: a pit from the front surface; posterior foramen: smaller pit from the back
      pr.push(cyl([sx * (bw + r + 2.5), n[1] + ny * zfj, n[2] + nz * zfj], [0, ny, nz], r, 13));
      pr.push(cyl([sx * (bw + r + 1), n[1] + ny * zbj, n[2] + nz * zbj], [0, ny, nz], r * 0.75, 11));
    }
  }
  // S1 superior articular processes (articulate with L5)
  const s0 = sg[0];
  for (const sx of [-1, 1]) {
    pr.push(seg([sx * (s0.cw / 2 + 4), s0.h / 2 - 4, -s0.D / 2 - 7], [sx * (s0.cw / 2 + 5.5), s0.h / 2 + 9, -s0.D / 2 - 12], [-0.35 * sx, 0, -1], 3.6, 6.4, 2.2, P.SAP));
  }
  return { prims: pr, k: 3.0 };
}

function coccyx(sg) {
  const pr = [];
  sg.forEach((s, i) => {
    const up = [0, Math.cos(s.psi - sg[0].psi), Math.sin(s.psi - sg[0].psi)];
    const a = [0, s.cy + up[1] * (s.h / 2 - 1), s.cz + up[2] * (s.h / 2 - 1)], b = [0, s.cy - up[1] * (s.h / 2 - 1), s.cz - up[2] * (s.h / 2 - 1)];
    pr.push({ ...seg(a, b, [0, -up[2], up[1]], s.D / 2, s.W / 2, Math.min(2.2, s.D / 2 - 0.2), P.COCCYX), g: 0 });
    if (i === 0) for (const sx of [-1, 1]) {
      pr.push(seg([sx * 3, s.cy + 1, s.cz - 1], [sx * (s.W / 2 + 5.5), s.cy - 0.5, s.cz - 1.5], [0, 1, 0], 2.4, 2.4, 1.6, P.COCCYX));   // rudimentary TPs
      pr.push(ell([sx * 3.4, s.cy + s.h / 2 + 1.2, s.cz - s.D / 2 - 0.4], [1.8, 3, 1.8], P.COCCYX));                             // cornua
    }
  });
  return { prims: pr, k: 1.6 };
}

// ------------------------------------------------------------------------------------------
// 5. Assembly: build the column from the sacral base upwards, posterior body walls aligned.
// ------------------------------------------------------------------------------------------
function build() {
  const lv = LEVELS.map((L, idx) => ({ ...scaled(L), idx }));
  const byId = Object.fromEntries(lv.map((v) => [v.id, v]));
  const discs = DISCS.map(([up, lo, h, w]) => ({ up, lo, h: h * LEN * (up[0] === "C" ? HCAL.cervical : HCAL.thoracolumbar), w }));   // up = cranial vertebra, lo = caudal
  // C2 dimensions (female, scaled): body without dens, dens, facets
  const C2 = { id: "C2", W: 17.5 * WID, D: 16 * WID, hp: 21 * LEN * HCAL.cervical, w: 0, hc: 21 * LEN * HCAL.cervical, densH: 15.5 * LEN, densR: 5.0 * WID, densZ: 0.8, densLean: 10, facetZ: -4 };
  const S1 = { W: 48 * WID, D: 31 * WID };
  // chain bottom-up: [L5-S1 disc, L5, L4-L5 disc, ..., C2-C3 disc, C2]
  const order = [];
  const ids = ["C2", ...lv.map((v) => v.id)];
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    const below = i === ids.length - 1 ? "S1" : ids[i + 1];
    order.push({ kind: "disc", d: discs.find((d) => d.up === id && d.lo === below) });
    order.push({ kind: "vertebra", id });
  }
  const els = [];
  const n = (a) => [Math.cos(a), Math.sin(a)];      // [y, z] of the end-plate normal tilted by a toward anterior
  const t = (a) => [-Math.sin(a), Math.cos(a)];     // [y, z] anterior direction within the plate
  // S1 superior end plate: centre from hip axis + pelvic tilt
  const hip = [POSTURE.hipHeight, 0];
  const pt = POSTURE.pelvicTilt * DEG;
  const s1c = [hip[0] + POSTURE.hipToS1 * Math.cos(pt), hip[1] - POSTURE.hipToS1 * Math.sin(pt)];
  let a = POSTURE.sacralSlope * DEG;
  let Pc = [s1c[0] - t(a)[0] * S1.D / 2, s1c[1] - t(a)[1] * S1.D / 2];   // posterior corner of the S1 plate
  const s1Plate = { center: s1c, post: Pc.slice(), angle: a };
  let prevD = S1.D, prevW = S1.W;
  for (const o of order) {
    let D, W, hp, w, hc, v;
    if (o.kind === "disc") {
      const up = o.d.up === "C2" ? C2 : byId[o.d.up];
      D = (prevD + up.D) / 2; W = (prevW + up.W) / 2; w = o.d.w; hc = o.d.h; hp = hc - (D / 2) * Math.tan(w * DEG);
    } else {
      v = o.id === "C2" ? C2 : byId[o.id];
      D = v.D; W = v.W; w = v.w; hp = v.hp; hc = o.id === "C2" ? v.hc : hcOf(v);
    }
    const psi = a - (w * DEG) / 2;
    const bc = [Pc[0] + t(a)[0] * D / 2, Pc[1] + t(a)[1] * D / 2];
    const center = [bc[0] + n(psi)[0] * hc / 2, bc[1] + n(psi)[1] * hc / 2];
    const el = { kind: o.kind, D, W, hc, hp, w, psi, o: [0, center[0], center[1]], postBottom: Pc.slice(), angleBottom: a };
    if (o.kind === "disc") {
      el.id = `D_${o.d.up}_${o.d.lo}`; el.name = `${o.d.up}–${o.d.lo} disc`; el.lo = o.d.lo; el.up = o.d.up;
      el.region = o.d.up[0] === "C" ? "cervical" : o.d.up[0] === "T" ? "thoracic" : "lumbar";
    } else {
      el.id = o.id; el.name = o.id; el.v = v; el.region = o.id[0] === "C" ? "cervical" : o.id[0] === "T" ? "thoracic" : "lumbar";
    }
    els.push(el);
    Pc = [Pc[0] + n(psi)[0] * hp, Pc[1] + n(psi)[1] * hp];
    a = a - w * DEG;
    el.postTop = Pc.slice(); el.angleTop = a;
    prevD = D; prevW = W;
  }
  // Atlas on the axis
  const c2 = els.find((e) => e.id === "C2");
  const at = { lmX: 19.5 * WID, lmH: 16 * LEN, lmZ: 0, tpX: 36 * WID, postR: 29 * WID, archR: 13 * WID, archY: 1.5 };
  {
    // Seat the atlas: anterior arch just in front of the dens (atlanto-dental interval ~1 mm),
    // lateral masses on the axis facets, ring extended by c1c2 about the atlanto-dental joint.
    const lean = Math.tan(C2.densLean * DEG);
    const facetTop = C2.hc / 2 - 1.0;
    const y0 = facetTop + at.lmH / 2;                                  // C1 origin height (C2 local) before tilt
    const yArch = y0 + at.archY;
    const densZ = C2.densZ - (yArch - (C2.hc / 2 - 2)) * lean;         // dens centre at the arch level
    const z0 = densZ + C2.densR + 1 - (at.archR - 3);                  // C1 origin z
    const Q = [0, yArch, densZ];                                       // pivot: atlanto-dental joint
    const tau = -POSTURE.c1c2 * DEG, c = Math.cos(tau), sn = Math.sin(tau);
    const rot = (p) => { const ry = p[1] - Q[1], rz = p[2] - Q[2]; return [p[0], Q[1] + ry * c - rz * sn, Q[2] + ry * sn + rz * c]; };
    // lift so the lowest lateral-mass corner rests on the facet
    let low = 1e9;
    for (const zz of [-10, 0, 10]) low = Math.min(low, rot([0, y0 - at.lmH / 2, z0 + zz])[1]);
    const lift = facetTop - low - 0.4;
    const oC2 = rot([0, y0, z0]); oC2[1] += lift;
    const psi = c2.psi + tau;
    els.push({ kind: "vertebra", id: "C1", name: "C1 (atlas)", region: "cervical", psi, o: toWorld(c2, oC2), atlas: at, hc: at.lmH, D: 30, W: 2 * at.tpX, c2Local: oC2 });
  }
  c2.name = "C2 (axis)"; c2.axis = C2;
  // Sacrum: segments going down from the S1 plate, curving forward (kyphotic)
  const SEG = [
    { h: 27, W: 48, D: 31, L: 54, cw: 30, cd: 14, c: 2 }, { h: 22, W: 40, D: 25, L: 47, cw: 26, cd: 11, c: 6 },
    { h: 18, W: 33, D: 19, L: 37, cw: 22, cd: 9, c: 10 }, { h: 14, W: 25, D: 14, L: 25, cw: 18, cd: 7, c: 10 },
    { h: 11, W: 19, D: 11, L: 13, cw: 13, cd: 5, c: 0 },
  ].map((s) => ({ ...s, h: s.h * LEN, W: s.W * WID, D: s.D * WID, L: s.L * WID, cw: s.cw * WID, cd: s.cd * WID }));
  const sacPsi = s1Plate.angle;   // sacrum frame = S1 plate orientation, origin at S1 body centre
  let ang = s1Plate.angle, pC = s1Plate.center;  // centre of the current segment's superior plate
  const segW = [];
  for (const s of SEG) {
    const psi = ang - (s.c * DEG) / 2 * 0;     // segment axis
    const center = [pC[0] - n(psi)[0] * s.h / 2, pC[1] - n(psi)[1] * s.h / 2];
    segW.push({ ...s, psi, center });
    const nb = ang - s.c * DEG;                  // next segment turns forward
    pC = [center[0] - n(psi)[0] * (s.h / 2 + 1), center[1] - n(psi)[1] * (s.h / 2 + 1)];
    // bend about the anterior edge so the anterior surface stays concave
    ang = nb;
  }
  const sacO = [0, segW[0].center[0], segW[0].center[1]];
  const sacEl = { kind: "sacrum", id: "S", name: "Sacrum (S1–S5, fused)", region: "sacral", psi: sacPsi, o: sacO, hc: SEG[0].h, D: SEG[0].D, W: 2 * SEG[0].L };
  sacEl.segs = segW.map((s) => {
    const l = toLocal(sacEl, [0, s.center[0], s.center[1]]);
    return { ...s, cy: l[1], cz: l[2], psi: s.psi - sacPsi };
  });
  els.push(sacEl);
  // Coccyx: four small segments continuing the curve forward
  const CO = [{ h: 9, W: 12, D: 8, c: 12 }, { h: 7, W: 9, D: 6.5, c: 12 }, { h: 6, W: 7, D: 5.5, c: 10 }, { h: 5, W: 5.5, D: 4.5, c: 0 }]
    .map((s) => ({ ...s, h: s.h * LEN, W: s.W * WID, D: s.D * WID }));
  let cAng = ang, cP = [pC[0] - n(ang)[0] * 2.2, pC[1] - n(ang)[1] * 2.2];
  const coW = [];
  for (const s of CO) {
    const center = [cP[0] - n(cAng)[0] * s.h / 2, cP[1] - n(cAng)[1] * s.h / 2];
    coW.push({ ...s, psi: cAng, center });
    cP = [center[0] - n(cAng)[0] * (s.h / 2 + 1.2), center[1] - n(cAng)[1] * (s.h / 2 + 1.2)];
    cAng -= s.c * DEG;
  }
  const coEl = { kind: "coccyx", id: "Co", name: "Coccyx (Co1–Co4, fused)", region: "coccygeal", psi: coW[0].psi, o: [0, coW[0].center[0], coW[0].center[1]], hc: CO[0].h, D: CO[0].D, W: CO[0].W };
  coEl.segs = coW.map((s) => { const l = toLocal(coEl, [0, s.center[0], s.center[1]]); return { ...s, cy: l[1], cz: l[2] }; });
  els.push(coEl);
  return { els, s1Plate, hip, subject: SUBJECT, posture: POSTURE };
}
function toWorld(el, l) {
  if (el.R) { const R = el.R; return [0, 1, 2].map((i) => el.o[i] + R[i][0] * l[0] + R[i][1] * l[1] + R[i][2] * l[2]); }
  const c = Math.cos(el.psi), s = Math.sin(el.psi);
  return [el.o[0] + l[0], el.o[1] + l[1] * c - l[2] * s, el.o[2] + l[1] * s + l[2] * c];
}
function toLocal(el, w) {
  if (el.R) { const R = el.R, d = [w[0] - el.o[0], w[1] - el.o[1], w[2] - el.o[2]]; return [0, 1, 2].map((j) => R[0][j] * d[0] + R[1][j] * d[1] + R[2][j] * d[2]); }
  const c = Math.cos(el.psi), s = Math.sin(el.psi), dy = w[1] - el.o[1], dz = w[2] - el.o[2];
  return [w[0] - el.o[0], dy * c + dz * s, -dy * s + dz * c];
}

// Shapes for every element
function shapeOf(el) {
  if (el.kind === "disc") {
    const heart = el.region === "thoracic" ? 1 : 0;
    return disc({ W: el.W * 0.98, D: el.D * 0.98, hc: el.hc, w: el.w, back: el.region === "lumbar" ? 2 : el.region === "thoracic" ? 1.2 : 0.6, heart, aff: el.aff });
  }
  if (el.kind === "sacrum") return sacrum(el.segs);
  if (el.kind === "coccyx") return coccyx(el.segs);
  if (el.id === "C1") return atlas(el.atlas);
  if (el.id === "C2") return axis(el.axis);
  const v = el.v;
  if (v.id[0] === "C") return cervical(v);
  if (v.id[0] === "T") return thoracic(v, v.id === "T12");
  return lumbar(v);
}
// Compile an element into a fast SDF + part lookup + local bounds
function compile(el) {
  const sh = shapeOf(el);
  const body = sh.prims.filter((p) => p.g === 0), arch = sh.prims.filter((p) => p.g === 1), hole = sh.prims.filter((p) => p.g === 2);
  const k = sh.k;
  const sdf = (x, y, z) => {
    let db = 1e9, da = 1e9;
    for (let i = 0; i < body.length; i++) { const v = body[i].d(x, y, z); if (v < db) db = v; }
    for (let i = 0; i < arch.length; i++) { const v = arch[i].d(x, y, z); if (v < da) da = v; }
    let d = body.length && arch.length ? smin(db, da, k) : Math.min(db, da);
    for (let i = 0; i < hole.length; i++) { const v = -hole[i].d(x, y, z); if (v > d) d = v; }
    return d;
  };
  const partAt = (x, y, z) => {
    for (const h of hole) if (h.part === 19 && Math.abs(h.d(x, y, z)) < 0.5) return 19;   // wall of a foramen: drawn dark
    let best = 1e9, id = 0;
    for (const p of sh.prims) { if (p.g === 2) continue; const v = p.d(x, y, z); if (v < best) { best = v; id = p.part; } }
    return id;
  };
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of sh.prims) { if (p.g === 2) continue; for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], p.box[i]); b[i + 3] = Math.max(b[i + 3], p.box[i + 3]); } }
  for (let i = 0; i < 3; i++) { b[i] -= k + 1; b[i + 3] += k + 1; }
  return { sdf, partAt, box: b };
}

const API = { SUBJECT, LEN, WID, HCAL, LEVELS, DISCS, POSTURE, ROM, P, PART_NAMES, build, compile, toWorld, toLocal, DEG };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.SpineCore = API;
})(typeof self !== "undefined" ? self : this);
