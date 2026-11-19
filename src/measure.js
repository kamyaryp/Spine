// Landmarks and checks computed from the assembled model (surface samples in world space).
const S = require("./spine-core.js");
function surface(el, comp, step = 1.2) {
  const b = comp.box, pts = [];
  for (let x = b[0]; x <= b[3]; x += step) for (let y = b[1]; y <= b[4]; y += step) for (let z = b[2]; z <= b[5]; z += step) {
    const d = comp.sdf(x, y, z); if (d < 0 && d > -step) pts.push(S.toWorld(el, [x, y, z]));
  }
  return pts;
}
function measure(r, opts = {}) {
  const out = {};
  const E = Object.fromEntries(r.els.map((e) => [e.id, e]));
  const comp = Object.fromEntries(r.els.map((e) => [e.id, S.compile(e)]));
  const surf = (id) => surface(E[id], comp[id], opts.step || 1.2);
  const C1 = surf("C1"), C7 = surf("C7"), Co = surf("Co"), C2 = surf("C2");
  out.c1Top = Math.max(...C1.map((p) => p[1]));
  out.densTip = Math.max(...C2.map((p) => p[1]));
  // C7 spinous tip = most posterior C7 point
  let tip = C7[0]; for (const p of C7) if (p[2] < tip[2]) tip = p; out.c7SpinousTip = tip;
  out.coccyxTip = Math.min(...Co.map((p) => p[1]));
  return out;
}
module.exports = { measure, surface };
if (require.main === module) {
  const r = S.build(); const m = measure(r);
  const H = r.subject.height;
  const ang = (id) => (r.els.find((e) => e.id === id));
  const top = (id) => { const e = ang(id); return e.angleTop / S.DEG; }, bot = (id) => ang(id).angleBottom / S.DEG;
  console.log("C1 top", m.c1Top.toFixed(0), "(vertex -", (H - m.c1Top).toFixed(0), ")  dens tip", m.densTip.toFixed(0));
  console.log("C7 spinous tip y", m.c7SpinousTip[1].toFixed(0), "=", (m.c7SpinousTip[1] / H).toFixed(3), "H  (ANSUR II female cervicale ~0.850 H)");
  console.log("coccyx tip", m.coccyxTip.toFixed(0));
  const L4L5 = ang("D_L4_L5").o[1]; console.log("L4-L5 disc y", L4L5.toFixed(0), "=", (L4L5 / H).toFixed(3), "H (iliocristale ~0.593 H)");
  console.log("LL L1sup-S1", (r.s1Plate.angle / S.DEG - top("L1")).toFixed(1), " TK T4sup-T12inf", (bot("T12") - top("T4")).toFixed(1) * -1, " T1-T12", (bot("T12") - top("T1")) * -1);
  console.log("CL C2inf-C7inf", (bot("C7") - bot("C2")).toFixed(1) * -1, " T1 slope", top("T1").toFixed(1), " SS", (r.s1Plate.angle / S.DEG).toFixed(1));
  const c7 = ang("C7").o, s1p = r.s1Plate.post; console.log("SVA (C7 centre vs S1 post-sup corner) mm", (c7[2] - s1p[1]).toFixed(1));
  const c2 = ang("C2").o; console.log("C2-C7 SVA mm", (c2[2] - c7[2]).toFixed(1));
}
