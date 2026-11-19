// ---- Vertebra geometry: SDF in millimetres + orthographic ray caster -------------------------
// Axes: x = subject's left, y = up, z = forward (anterior). Views rotate about PIVOT.
const PIVOT = [0, 0, -11];
const PART_NAMES = ["", "Vertebral body", "Pedicle", "Lamina", "Transverse process",
  "Superior articular process", "Inferior articular process", "Spinous process"];

function nrm(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

// Oriented rounded box spanning a->b; v = second axis; cross-section half extents hv, hw; corner radius r.
function segBox(a, b, v, hv, hw, r, part) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  const u = nrm(d);
  const dot = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  const vv = nrm([v[0] - u[0] * dot, v[1] - u[1] * dot, v[2] - u[2] * dot]);
  const w = cross(u, vv);
  return { k: 0, part, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], u, v: vv, w,
    he: [L / 2 + r - r, hv - r, hw - r], r };
}
function caps(a, b, r, s, part) { return { k: 1, part, a, b, r, s: s || [1, 1, 1] }; }
function ell(c, rad, part) { return { k: 2, part, c, rad }; }

const PRIMS = [];
for (const s of [-1, 1]) {
  PRIMS.push(caps([s * 15.5, 4, 1], [s * 16, 3.5, -11], 5.0, [1, 1.55, 1], 2));
  PRIMS.push(segBox([s * 15.5, 1.5, -11], [s * 2, -2.5, -24], [0, 1, 0], 7.5, 5.2, 2.2, 3));
  PRIMS.push(segBox([s * 17, 3.5, -8.5], [s * 39, 4.5, -12.5], [0, 1, 0], 4.8, 3.2, 2.2, 4));
  PRIMS.push(ell([s * 38, 4.5, -12.5], [4.0, 5.0, 3.3], 4));
  PRIMS.push(segBox([s * 16, 5, -12], [s * 17.5, 21, -16], [s * -0.35, 0, -1], 3.8, 6.8, 2.4, 5));
  PRIMS.push(ell([s * 20, 15, -20], [3.0, 4.0, 3.0], 5));
  PRIMS.push(segBox([s * 8.5, -6, -23], [s * 9.5, -23, -24], [s * 1, 0, 0.3], 3.6, 5.2, 2.4, 6));
}
PRIMS.push(segBox([0, -1.5, -21], [0, -3.5, -49], [0, 1, 0], 11.0, 4.0, 2.5, 7));
const SPINE_KNOB = caps([0, 6.5, -49], [0, -14, -48.5], 4.0, null, 7);
// seg_box in the Python original adds r to the half length: he = (L/2 + r, hv, hw) minus r inside obox
for (const p of PRIMS) if (p.k === 0) { /* he already = (L/2, hv-r, hw-r) */ }

function primDist(p, x, y, z) {
  if (p.k === 0) {
    const qx = x - p.c[0], qy = y - p.c[1], qz = z - p.c[2];
    const lu = Math.abs(qx * p.u[0] + qy * p.u[1] + qz * p.u[2]) - p.he[0];
    const lv = Math.abs(qx * p.v[0] + qy * p.v[1] + qz * p.v[2]) - p.he[1];
    const lw = Math.abs(qx * p.w[0] + qy * p.w[1] + qz * p.w[2]) - p.he[2];
    const mu = Math.max(lu, 0), mv = Math.max(lv, 0), mw = Math.max(lw, 0);
    return Math.sqrt(mu * mu + mv * mv + mw * mw) + Math.min(Math.max(lu, lv, lw), 0) - p.r;
  }
  if (p.k === 1) {
    const s = p.s;
    const qx = x / s[0], qy = y / s[1], qz = z / s[2];
    const ax = p.a[0] / s[0], ay = p.a[1] / s[1], az = p.a[2] / s[2];
    const bx = p.b[0] / s[0] - ax, by = p.b[1] / s[1] - ay, bz = p.b[2] / s[2] - az;
    const px = qx - ax, py = qy - ay, pz = qz - az;
    let h = (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz);
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = px - h * bx, dy = py - h * by, dz = pz - h * bz;
    return (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.r) * Math.min(s[0], s[1], s[2]);
  }
  return ellD(x, y, z, p.c[0], p.c[1], p.c[2], p.rad[0], p.rad[1], p.rad[2]);
}
function ellD(x, y, z, cx, cy, cz, rx, ry, rz) {
  const qx = (x - cx) / rx, qy = (y - cy) / ry, qz = (z - cz) / rz;
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const k1 = Math.sqrt((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2);
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}
function smin(a, b, k) {
  let h = 0.5 + 0.5 * (b - a) / k; h = h < 0 ? 0 : h > 1 ? 1 : h;
  return b * (1 - h) + a * h - k * h * (1 - h);
}
const HH = 13.5;
function bodyD(x, y, z) {
  const de = (Math.hypot(x / 23, (z - 15.5) / 16.5) - 1) * 16.5;
  const back = (2.2 - 2.6 * (x / 20) ** 2) - z;
  let d = Math.max(de, back, Math.abs(y) - HH);
  const cup = ellD(x, y, z, 0, HH + 2.6, 15.5, 17.5, 4.0, 12);
  const cupb = ellD(x, y, z, 0, -HH - 2.6, 15.5, 17.5, 4.0, 12);
  d = Math.max(d, -cup, -cupb);
  const dl = (Math.hypot(x / 23.6, (z - 15.5) / 17.1) - 1) * 17.1;
  const lipT = Math.max(dl, back + 0.6, Math.abs(y - (HH - 1.2)) - 1.2, -cup);
  const lipB = Math.max(dl, back + 0.6, Math.abs(y + (HH - 1.2)) - 1.2, -cupb);
  d = Math.min(d, lipT, lipB);
  return d - 0.8;
}
function archD(x, y, z) {
  let d = 1e9;
  for (let i = 0; i < PRIMS.length; i++) { const v = primDist(PRIMS[i], x, y, z); if (v < d) d = v; }
  return smin(d, primDist(SPINE_KNOB, x, y, z), 3);
}
function sdf(x, y, z) { return smin(bodyD(x, y, z), archD(x, y, z), 2.6); }
function partAt(x, y, z) {
  let best = bodyD(x, y, z), id = 1;
  for (const p of PRIMS) { const v = primDist(p, x, y, z); if (v < best) { best = v; id = p.part; } }
  if (primDist(SPINE_KNOB, x, y, z) < best) id = 7;
  return id;
}

function rotMat(yaw, pitch) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // R = Rx(pitch) * Ry(yaw); model -> view
  return [
    [ca, 0, sa],
    [sb * sa, cb, -sb * ca],
    [-cb * sa, sb, cb * ca],
  ];
}

// Cast one view. Returns per-subsample buffers.
function castView(yaw, pitch, mm, W, H, ss, onProgress) {
  const R = rotMat(yaw, pitch);
  const SW = W * ss, SH = H * ss, N = SW * SH;
  const hit = new Uint8Array(N), depth = new Float32Array(N), ao = new Float32Array(N), part = new Uint8Array(N);
  const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
  const RB = 68, Z0 = 120;
  // view (vx,vy,vz) -> model: m = R^T v + PIVOT
  const m = (vx, vy, vz, out) => {
    out[0] = R[0][0] * vx + R[1][0] * vy + R[2][0] * vz + PIVOT[0];
    out[1] = R[0][1] * vx + R[1][1] * vy + R[2][1] * vz + PIVOT[1];
    out[2] = R[0][2] * vx + R[1][2] * vy + R[2][2] * vz + PIVOT[2];
  };
  const P = [0, 0, 0];
  const dmx = -R[2][0], dmy = -R[2][1], dmz = -R[2][2];   // ray direction in model space
  const e = 0.12;
  for (let j = 0; j < SH; j++) {
    const vy = (H / 2 - (j + 0.5) / ss) * mm;
    for (let i = 0; i < SW; i++) {
      const vx = ((i + 0.5) / ss - W / 2) * mm;
      const r2 = vx * vx + vy * vy;
      if (r2 >= RB * RB) continue;
      const half = Math.sqrt(RB * RB - r2);
      let t = Z0 - half; const tEnd = Z0 + half;
      m(vx, vy, Z0, P);
      const ox = P[0], oy = P[1], oz = P[2];
      let found = false;
      for (let k = 0; k < 160 && t < tEnd; k++) {
        const x = ox + dmx * t, y = oy + dmy * t, z = oz + dmz * t;
        const d = sdf(x, y, z);
        if (d < 0.05) { found = true; break; }
        t += d * 0.85;
      }
      if (!found) continue;
      const idx = j * SW + i;
      const x = ox + dmx * t, y = oy + dmy * t, z = oz + dmz * t;
      // tetrahedral normal
      const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d4 = sdf(x + e, y + e, z + e);
      let gx = a - b - c + d4, gy = -a - b + c + d4, gz = -a + b - c + d4;
      const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
      let occ = 0, wgt = 1;
      for (const dd of [0.8, 1.8, 3.2]) {
        occ += (dd - Math.min(sdf(x + gx * dd, y + gy * dd, z + gz * dd), dd)) / dd * wgt; wgt *= 0.6;
      }
      hit[idx] = 1; depth[idx] = t; nx[idx] = gx; ny[idx] = gy; nz[idx] = gz;
      ao[idx] = Math.max(0, Math.min(1, 1 - 0.75 * occ));
      part[idx] = partAt(x, y, z);
    }
    if (onProgress && (j & 15) === 0) onProgress(j / SH);
  }
  return { yaw, pitch, mm, W, H, ss, R, hit, depth, nx, ny, nz, ao, part };
}

if (typeof module !== "undefined") module.exports = { castView, rotMat, PART_NAMES, sdf };
