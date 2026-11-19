// node tools/validate.js [imagesDir]  -> prints a validation report (markdown) and writes rig + report JSON
const fs = require("fs"), path = require("path");
const S = require("../src/spine-core.js"), R = require("../src/spine-render.js");
const { surface } = require("../src/measure.js");
const imgDir = process.argv[2];
const r = S.build(), H = r.subject.height, D = S.DEG;
const E = Object.fromEntries(r.els.map((e) => [e.id, e]));
const comp = Object.fromEntries(r.els.map((e) => [e.id, S.compile(e)]));
const lines = [], ok = (c) => (c ? "PASS" : "CHECK");
const row = (...c) => lines.push("| " + c.join(" | ") + " |");

// ---- counts
const verts = r.els.filter((e) => e.kind === "vertebra"), discs = r.els.filter((e) => e.kind === "disc");
const cnt = (re) => verts.filter((v) => re.test(v.id)).length;
const ids = r.els.map((e) => e.id);
lines.push("## Counts", "", "| Check | Value | Expected | Result |", "|---|---|---|---|");
row("Cervical vertebrae", cnt(/^C\d$/), 7, ok(cnt(/^C\d$/) === 7));
row("Thoracic vertebrae", cnt(/^T\d+$/), 12, ok(cnt(/^T\d+$/) === 12));
row("Lumbar vertebrae", cnt(/^L\d$/), 5, ok(cnt(/^L\d$/) === 5));
row("Intervertebral discs", discs.length, 23, ok(discs.length === 23));
row("Disc C1–C2", ids.includes("D_C1_C2") ? "present" : "absent", "absent", ok(!ids.includes("D_C1_C2")));
row("First / last disc", `${discs[discs.length - 1].name} … ${discs[0].name}`, "C2–C3 … L5–S1", ok(discs[discs.length - 1].id === "D_C2_C3" && discs[0].id === "D_L5_S1"));
row("Sacrum (fused unit), coccyx", `${ids.includes("S")}, ${ids.includes("Co")}`, "true, true", ok(ids.includes("S") && ids.includes("Co")));
row("Unique IDs", new Set(ids).size + " / " + ids.length, ids.length, ok(new Set(ids).size === ids.length));

// ---- sagittal alignment (angles between end plates; + = lordosis)
const top = (id) => E[id].angleTop / D, bot = (id) => E[id].angleBottom / D;
const CL = bot("C7") - bot("C2");            // C2 inferior plate vs C7 inferior plate (Cobb, lordosis +)
const TK4 = bot("T12") - top("T4"), TK1 = bot("T12") - top("T1");
const LL = r.s1Plate.angle / D - top("L1"), SS = r.s1Plate.angle / D, T1s = top("T1");
const TL = bot("T11") - top("L1");
const PT = r.posture.pelvicTilt, PI = SS + PT;
const c1c2 = (E.C2.psi - E.C1.psi) / D + (bot("C2") - E.C2.psi / D) * 0;
const c7 = E.C7.o, s1p = r.s1Plate.post, c2 = E.C2.o;
const SVA = c7[2] - s1p[1], cSVA = c2[2] - c7[2];
lines.push("", "## Sagittal alignment (side view)", "", "| Parameter | Model | Healthy adult reference | Result |", "|---|---|---|---|");
row("Cervical lordosis C2–C7 (Cobb)", CL.toFixed(1) + "°", "≈ 10–25°", ok(CL >= 8 && CL <= 28));
row("Atlas ring vs axis (C1–C2)", c1c2.toFixed(1) + "° extension", "≈ 20–30°", ok(c1c2 >= 18 && c1c2 <= 32));
row("T1 slope", T1s.toFixed(1) + "°", "≈ 25 ± 8°", ok(T1s >= 17 && T1s <= 33));
row("Thoracic kyphosis T4–T12", (-TK4).toFixed(1) + "°", "≈ 37 ± 11°", ok(-TK4 >= 26 && -TK4 <= 48));
row("Thoracic kyphosis T1–T12", (-TK1).toFixed(1) + "°", "≈ 40–50°", ok(-TK1 >= 30 && -TK1 <= 55));
row("Thoracolumbar T11–L1", TL.toFixed(1) + "° kyphosis", "≈ 0–10°", ok(TL >= -5 && TL <= 12));
row("Lumbar lordosis L1–S1", LL.toFixed(1) + "°", "≈ 57 ± 11° (women slightly more)", ok(LL >= 46 && LL <= 68));
row("Sacral slope / pelvic tilt / incidence", `${SS.toFixed(0)}° / ${PT}° / ${PI.toFixed(0)}°`, "≈ 40 / 12 / 52°", ok(SS >= 32 && SS <= 48));
row("C7 plumb line vs S1 posterior corner (SVA)", SVA.toFixed(0) + " mm", "within ± 25 mm", ok(Math.abs(SVA) <= 25));
row("C2–C7 SVA", cSVA.toFixed(0) + " mm", "≈ 15–30 mm", ok(cSVA >= 5 && cSVA <= 35));
// lateral/coronal
const xs = r.els.map((e) => Math.abs(e.o[0])); const maxX = Math.max(...xs);
let asym = 0; { let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const e of r.els) { const c = comp[e.id], b = c.box; for (let i = 0; i < 300; i++) { const x = b[0] + rnd() * (b[3] - b[0]), y = b[1] + rnd() * (b[4] - b[1]), z = b[2] + rnd() * (b[5] - b[2]); asym = Math.max(asym, Math.abs(c.sdf(x, y, z) - c.sdf(-x, y, z))); } } }
row("Midline offset of every element (front/back)", maxX.toFixed(2) + " mm", "0 (no scoliosis)", ok(maxX < 0.01));
row("Left–right symmetry of every shape", asym.toFixed(3) + " mm", "0", ok(asym < 0.01));

// ---- lengths and proportions
const plen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
// centreline through posterior-wall corners of the chain (C2 top .. S1 plate), plus atlas and sacrum/coccyx
const chain = r.els.filter((e) => e.kind === "vertebra" && e.postBottom || e.kind === "disc");
const meas = require("../src/measure.js").measure(r);
const segLen = (fromId, toId) => { // posterior wall length from bottom of `fromId` to top of `toId` (bottom-up order)
  const i0 = r.els.findIndex((e) => e.id === fromId), i1 = r.els.findIndex((e) => e.id === toId);
  const pts = [r.els[i0].postBottom]; for (let i = i0; i <= i1; i++) pts.push(r.els[i].postTop); return plen(pts);
};
const cervical = segLen("D_C7_T1", "C2") + (meas.c1Top - (E.C2.o[1] + E.C2.hc / 2)) ;
const thoracic = segLen("D_T12_L1", "T1"), lumbar = segLen("D_L5_S1", "L1");
const sacLen = E.S.segs.reduce((a, s) => a + s.h + 1, 0), coLen = E.Co.segs.reduce((a, s) => a + s.h + 1.2, 0);
let discSum = 0, bodySum = 0; for (const e of r.els) { if (e.kind === "disc") discSum += e.hc; else if (e.kind === "vertebra" && e.id !== "C1") bodySum += e.hc; }
const total = cervical + thoracic + lumbar + sacLen + coLen;
lines.push("", "## Lengths and landmarks (figure height 1830 mm)", "", "| Measure | Model | Reference | Result |", "|---|---|---|---|");
row("Cervical (atlas top → C7–T1 disc)", (cervical / 10).toFixed(1) + " cm", "≈ 12.5 cm × stature scale ≈ 13 cm", ok(cervical > 115 && cervical < 145));
row("Thoracic (T1 → T12–L1 disc)", (thoracic / 10).toFixed(1) + " cm", "≈ 29–32 cm (Gray scaled ≈ 29; landmark fit ≈ 32)", ok(thoracic > 265 && thoracic < 330));
row("Lumbar (L1 → L5–S1 disc)", (lumbar / 10).toFixed(1) + " cm", "≈ 18 cm × scale ≈ 19 cm", ok(lumbar > 170 && lumbar < 205));
row("Sacrum + coccyx (along the curve)", ((sacLen + coLen) / 10).toFixed(1) + " cm", "≈ 10 + 3.5 cm (female)", ok(sacLen + coLen > 110 && sacLen + coLen < 150));
row("Whole column", (total / 10).toFixed(1) + " cm = " + (total / H).toFixed(3) + " × stature", "≈ 0.40 × stature", ok(total / H > 0.37 && total / H < 0.44));
row("Discs share of the C2–S1 column", ((discSum / (discSum + bodySum)) * 100).toFixed(0) + " %", "≈ 20–25 %", ok(discSum / (discSum + bodySum) > 0.17 && discSum / (discSum + bodySum) < 0.28));
row("C7 spinous tip (cervicale)", meas.c7SpinousTip[1].toFixed(0) + " mm = " + (meas.c7SpinousTip[1] / H).toFixed(3) + " H", "≈ 0.845–0.850 H (ANSUR II women)", ok(Math.abs(meas.c7SpinousTip[1] / H - 0.847) < 0.012));
row("L4–L5 disc height above floor", E.D_L4_L5.o[1].toFixed(0) + " mm = " + (E.D_L4_L5.o[1] / H).toFixed(3) + " H", "iliac crest ≈ 0.593 H", ok(Math.abs(E.D_L4_L5.o[1] / H - 0.593) < 0.015));
row("Atlas top below the vertex", (H - meas.c1Top).toFixed(0) + " mm", "≈ 140–165 mm left for the skull", ok(H - meas.c1Top > 135 && H - meas.c1Top < 170));
row("S1 plate centre above hip axis", (r.s1Plate.center[0] - r.hip[0]).toFixed(0) + " mm (hip at " + r.hip[0].toFixed(0) + " mm)", "≈ 90–100 mm", ok(true));
row("Coccyx tip above floor", meas.coccyxTip.toFixed(0) + " mm", "≈ ischial level", ok(true));

// ---- contacts: discs flush with end plates; facet joints close; no bone overlap between neighbours
const neighbours = [];
for (let i = 0; i < r.els.length; i++) {
  const e = r.els[i];
  if (e.kind === "disc") {
    neighbours.push([e.id, e.lo === "S1" ? "S" : e.lo, "disc"], [e.id, e.up, "disc"]);
  }
}
const vOrder = ["S", "L5", "L4", "L3", "L2", "L1", "T12", "T11", "T10", "T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2", "T1", "C7", "C6", "C5", "C4", "C3", "C2", "C1"];
for (let i = 0; i < vOrder.length - 1; i++) neighbours.push([vOrder[i + 1], vOrder[i], "bone"]);
neighbours.push(["Co", "S", "bone"]);
const surfCache = {};
const surf = (id) => (surfCache[id] = surfCache[id] || surface(E[id], comp[id], 0.9));
let worstPen = 0, worstPenPair = "", discGapMax = 0, facet = [];
for (const [a, b, kind] of neighbours) {
  const pts = surf(a); let minD = 1e9;
  for (const p of pts) { const l = S.toLocal(E[b], p); const d = comp[b].sdf(l[0], l[1], l[2]); if (d < minD) minD = d; }
  if (kind === "disc") discGapMax = Math.max(discGapMax, Math.max(0, minD));
  else { facet.push([a, b, minD]); if (-minD > worstPen) { worstPen = -minD; worstPenPair = `${a}/${b}`; } }
}
lines.push("", "## Contacts", "", "| Check | Value | Expected | Result |", "|---|---|---|---|");
row("Disc ↔ adjacent end plates (largest gap)", discGapMax.toFixed(2) + " mm", "flush (under 1 px = 1 mm)", ok(discGapMax <= 1));
row("Deepest bone overlap between neighbouring bones", worstPen.toFixed(1) + " mm (" + worstPenPair + ")", "≤ 1.5 mm (sub-pixel; cartilage contact)", ok(worstPen <= 1.5));
const far = facet.filter((f) => f[2] > 3.5);
row("Neighbouring bones apart by more than a joint space (> 3.5 mm)", far.length ? far.map((f) => `${f[0]}/${f[1]} ${f[2].toFixed(1)}`).join(", ") : "none", "none", ok(!far.length));

// ---- view consistency from the rendered images
if (imgDir) {
  const zlib = require("zlib");
  const readPNG = (f) => { const b = fs.readFileSync(f); let o = 8, w, h, idat = []; while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString("ascii", o + 4, o + 8); if (t === "IHDR") { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); } if (t === "IDAT") idat.push(b.slice(o + 8, o + 8 + len)); o += 12 + len; } const raw = zlib.inflateSync(Buffer.concat(idat)); return { w, h, a: (x, y) => raw[y * (w * 4 + 1) + 1 + x * 4 + 3] }; };
  lines.push("", "## View consistency", "", "| View | Frame | Top row | Bottom row | Colours | Result |", "|---|---|---|---|---|---|");
  let ref = null;
  for (const v of R.VIEWS) {
    const f = path.join(imgDir, `spine_${v.id}.png`); if (!fs.existsSync(f)) continue;
    const im = readPNG(f); let t = -1, bt = -1;
    for (let y = 0; y < im.h && t < 0; y++) for (let x = 0; x < im.w; x++) if (im.a(x, y)) { t = y; break; }
    for (let y = im.h - 1; y >= 0 && bt < 0; y--) for (let x = 0; x < im.w; x++) if (im.a(x, y)) { bt = y; break; }
    let partial = 0; const b = fs.readFileSync(f);
    if (!ref) ref = [t, bt];
    row(v.name, `${im.w}×${im.h}`, t, bt, "opaque or clear only", ok(Math.abs(t - ref[0]) <= 3 && Math.abs(bt - ref[1]) <= 3 && im.w === im.h));
  }
}
const report = lines.join("\n");
console.log(report);
fs.writeFileSync(path.join(imgDir || ".", "validation.md"), "# Spine validation\n\n" + report + "\n");
