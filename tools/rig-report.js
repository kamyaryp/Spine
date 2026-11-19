// node tools/rig-report.js <outDir> [--render a/b] [--report] [--ss 3]
//   --render i/n : render the demonstration poses (every view) assigned to worker i of n -> <outDir>/<demo>/<view>.png
//   --report     : run every check and write <outDir>/rig-report.md (+ rig-report.json)
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const C = require("../src/spine-core.js"), R = require("../src/spine-render.js"), Rig = require("../src/spine-rig.js"), ROM = require("../src/spine-rom.js");
const { encodePNG } = require("./png.js"), { DEMOS } = require("./demos.js"), RC = require("./rig-check.js");
const args = process.argv.slice(2), out = args[0] || "out/rig";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ss = +opt("--ss", 3);
fs.mkdirSync(out, { recursive: true });
const built = C.build(), comps = built.els.map(C.compile), rig = Rig.makeRig(built);

function renderPose(pose, view) {
  const m = Rig.posedModel(rig, comps, pose);
  const g = R.cast(m, { ...R.FRAME, yaw: view.yaw, pitch: 0, ss });
  const st = R.stylise(g, m);
  return { st, rgba: R.paint(st, m), m };
}
if (args.includes("--render")) {
  const [i, n] = opt("--render", "0/1").split("/").map(Number);
  const jobs = []; DEMOS.forEach((d) => R.VIEWS.forEach((v) => jobs.push([d, v])));
  jobs.forEach(([d, v], k) => {
    if (k % n !== i) return;
    const t0 = Date.now(), { st, rgba } = renderPose(d.pose, v);
    fs.mkdirSync(path.join(out, d.id), { recursive: true });
    fs.writeFileSync(path.join(out, d.id, `${v.id}.png`), encodePNG(st.W, st.H, rgba));
    console.log(d.id, v.id, ((Date.now() - t0) / 1000).toFixed(1) + "s");
  });
}
if (args.includes("--report")) {
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1), pct = (v) => Math.round(v * 100) + " %";
  const L = [];
  const ctx = RC.setup(), base = RC.contacts(ctx, Rig.posedModel(ctx.rig, ctx.comps, Rig.ZERO()));
  L.push("# Spinal rig: limits and demonstration checks", "");
  L.push("Active, physiological, in vivo ranges (degrees, from neutral to one side). Controls reach " + pct(ROM.SETTINGS.conservative) + " of these means.", "");
  L.push("## Regional limits (sums of the segment values below)", "", "| Region | Flexion | Extension | Bend (each side) | Rotation (each side) | Control limit (×" + ROM.SETTINGS.conservative + ") |", "|---|---|---|---|---|---|");
  for (const r of ROM.REGIONS) { const g = ROM.REGION[r], l = Rig.regionLimits(r); L.push(`| ${r} | ${f1(g.flex)} | ${f1(g.ext)} | ${f1(g.lb)} | ${f1(g.ar)} | ${f1(l.flex)} / ${f1(l.ext)} / ${f1(l.lb)} / ${f1(l.ar)} |`); }
  L.push("", "## Segment limits", "", "| Segment | Flex | Ext | Bend | Rot | Coupling at full primary motion | Passive ref. (F+E / bend / rot) | Sources | Approximation |", "|---|---|---|---|---|---|---|---|---|");
  for (const s of ROM.SEGMENTS) {
    const cp = []; if (s.couple.lb && s.couple.lb.ar) cp.push(`bend → ${s.couple.lb.ar > 0 ? "same-side" : "opposite"} rot ${Math.abs(s.couple.lb.ar)}°`); if (s.couple.ar && s.couple.ar.lb) cp.push(`rot → ${s.couple.ar.lb > 0 ? "same-side" : "opposite"} bend ${Math.abs(s.couple.ar.lb)}°`);
    L.push(`| ${s.id} | ${s.flex} | ${s.ext} | ${s.lb}${s.cap.lb !== s.lb ? ` (cap ${s.cap.lb})` : ""} | ${s.ar}${s.cap.ar !== s.ar ? ` (cap ${s.cap.ar})` : ""} | ${cp.join("; ") || "—"} | ${s.passive ? s.passive.join(" / ") : "—"} | ${s.refs.join(", ")} | ${s.approx || ""} |`);
  }
  // demonstrations
  const results = [];
  L.push("", "## Demonstrations", "", "| Pose | Applied C / T / L (fe, bend, rot) | Largest single-segment share | Worst segment vs its cap | Discs: min / max height ratio | New bone overlap | Largest neighbour gap | Views consistent |", "|---|---|---|---|---|---|---|---|");
  for (const d of DEMOS) {
    const { out: o, model } = RC.check(ctx, d.pose, base);
    const tot = ROM.REGIONS.map((r) => { const t = o.regionTotals[r]; return `${f1(t.fe)}, ${f1(t.lb)}, ${f1(t.ar)}`; }).join(" / ");
    const share = Math.max(...ROM.REGIONS.map((r) => o.regionTotals[r].maxShare));
    // view consistency: top and bottom rows of every view image, and landmark rows
    let views = "not rendered";
    const dir = path.join(out, d.id);
    if (fs.existsSync(dir)) {
      const rows = R.VIEWS.map((v) => { const f = path.join(dir, `${v.id}.png`); return fs.existsSync(f) ? extent(f) : null; }).filter(Boolean);
      const same = rows.length === R.VIEWS.length && rows.every((r) => Math.abs(r[0] - rows[0][0]) <= 1 && Math.abs(r[1] - rows[0][1]) <= 1);
      views = (same ? "yes" : "NO") + ` (rows ${rows[0][0]}–${rows[0][1]}, ${rows.length} views)`;
    }
    const okDisc = o.discs.minRatio >= 0.6 && o.discs.maxRatio <= 1.4, okPen = o.contacts.newOverlap <= 1.0, okGap = o.contacts.maxNeighbourGap <= 5, okCap = o.worstCap.ratio <= 1.0001;
    L.push(`| ${d.name} | ${tot} | ${pct(share)} | ${pct(o.worstCap.ratio)} ${o.worstCap.where} ${okCap ? "✓" : "✗"} | ${o.discs.minRatio.toFixed(2)} / ${o.discs.maxRatio.toFixed(2)} ${okDisc ? "✓" : "✗"} | ${o.contacts.newOverlap.toFixed(2)} mm ${o.contacts.overlapPair} ${okPen ? "✓" : "✗"} | ${o.contacts.maxNeighbourGap.toFixed(1)} mm ${o.contacts.gapPair} ${okGap ? "✓" : "✗"} | ${views} |`);
    results.push({ id: d.id, pose: d.pose, regions: o.regionTotals, envelope: Object.fromEntries(ROM.REGIONS.map((r) => [r, o.regions[r].envelope])), worstCap: o.worstCap, discs: o.discs, contacts: { newOverlap: o.contacts.newOverlap, pair: o.contacts.overlapPair, maxGap: o.contacts.maxNeighbourGap } });
  }
  // exact neutral restoration and no drift
  const zero = Rig.posedModel(rig, comps, Rig.ZERO());
  const same = zero.els === built.els && zero.comps === comps;
  let drift = 0;
  for (const d of DEMOS) Rig.posedModel(rig, comps, d.pose);                    // animate through every pose ...
  const back = Rig.posedModel(rig, comps, Rig.ZERO());                           // ... and return to zero
  back.els.forEach((e, k) => { drift = Math.max(drift, Math.abs(e.o[0] - built.els[k].o[0]), Math.abs(e.o[1] - built.els[k].o[1]), Math.abs(e.o[2] - built.els[k].o[2]), Math.abs(e.psi - built.els[k].psi)); });
  const tiny = Rig.posedModel(rig, comps, { ...Rig.ZERO(), lumbar: { fe: 1e-9, lb: 0, ar: 0 } });
  let eps = 0; tiny.els.forEach((e, k) => { eps = Math.max(eps, Math.hypot(e.o[0] - built.els[k].o[0], e.o[1] - built.els[k].o[1], e.o[2] - built.els[k].o[2])); });
  L.push("", "## Neutral restoration", "", `- Zero input returns the approved rest model itself: ${same ? "yes" : "NO"}.`,
    `- After stepping through every demonstration and back to zero, largest difference from rest: ${drift} (mm / rad); the rig is stateless, so no drift can accumulate.`,
    `- A near-zero input (1e-9°) moves no element by more than ${eps.toExponential(1)} mm (continuous around neutral).`);
  if (fs.existsSync(path.join(out, "neutral", "front.png")) && args.includes("--baseline")) {
    const bdir = opt("--baseline", ""); let diff = 0, total = 0;
    for (const v of R.VIEWS) { const a = readPNG(path.join(out, "neutral", `${v.id}.png`)), b = readPNG(path.join(bdir, `spine_${v.id}.png`)); const ox = (a.w - b.w) / 2, oy = (a.h - b.h) / 2;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { total++; const pa = a.px(x + ox, y + oy), pb = b.px(x, y); if (pa !== pb) diff++; } }
    L.push(`- Neutral renders vs the approved images: ${diff} of ${total} pixels differ.`);
  }
  fs.writeFileSync(path.join(out, "rig-report.md"), L.join("\n") + "\n");
  fs.writeFileSync(path.join(out, "rig-report.json"), JSON.stringify({ results, drift, neutralIsRest: same }, null, 1));
  console.log(L.join("\n"));
}
function readPNG(f) {
  const b = fs.readFileSync(f); let o = 8, w, h; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), t = b.toString("ascii", o + 4, o + 8); if (t === "IHDR") { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); } if (t === "IDAT") idat.push(b.slice(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * 4 + 1;
  return { w, h, a: (x, y) => raw[y * st + 1 + x * 4 + 3], px: (x, y) => raw.readUInt32BE(y * st + 1 + x * 4) };
}
function extent(f) {
  const im = readPNG(f); let t = -1, b = -1;
  for (let y = 0; y < im.h && t < 0; y++) for (let x = 0; x < im.w; x++) if (im.a(x, y)) { t = y; break; }
  for (let y = im.h - 1; y >= 0 && b < 0; y--) for (let x = 0; x < im.w; x++) if (im.a(x, y)) { b = y; break; }
  return [t, b];
}
