// Pose checks: limits, distribution, discs, contacts. Used by tools/rig-report.js and the lab's test.
const C = require("../src/spine-core.js"), Rig = require("../src/spine-rig.js"), ROM = require("../src/spine-rom.js");
const { surface } = require("../src/measure.js");
function setup() {
  const built = C.build(), comps = built.els.map(C.compile), rig = Rig.makeRig(built);
  const local = {};   // rigid bones: local surface samples computed once
  built.els.forEach((e, k) => { if (e.kind !== "disc") local[e.id] = surface({ ...e, o: [0, 0, 0], psi: 0 }, comps[k], 1.0); });
  const pairs = [];
  for (let i = 1; i < Rig.CHAIN.length; i++) { pairs.push([Rig.CHAIN[i], Rig.CHAIN[i - 1], 1]); if (i > 1) pairs.push([Rig.CHAIN[i], Rig.CHAIN[i - 2], 2]); }
  pairs.push(["Co", "S", 1]);
  return { built, comps, rig, local, pairs };
}
function contacts(ctx, model) {
  const E = Object.fromEntries(model.els.map((e, k) => [e.id, { e, c: model.comps[k] }]));
  const res = {};
  for (const [a, b, gap] of ctx.pairs) {
    let mn = 1e9; const A = E[a].e, B = E[b];
    for (const p of ctx.local[a]) { const w = C.toWorld(A, p), l = C.toLocal(B.e, w), d = B.c.sdf(l[0], l[1], l[2]); if (d < mn) mn = d; }
    res[`${a}/${b}`] = { min: mn, gap };
  }
  return res;
}
function check(ctx, pose, baseline) {
  const m = Rig.posedModel(ctx.rig, ctx.comps, pose);
  const out = { segments: m.solved.segments, regions: m.solved.regions };
  // limits
  let worstCap = 0, worstCapId = "";
  for (const s of ROM.SEGMENTS) {
    const a = m.solved.segments[s.id];
    for (const [ax, cap] of [["fe", a.fe >= 0 ? s.cap.flex : s.cap.ext], ["lb", s.cap.lb], ["ar", s.cap.ar]]) {
      const r = cap ? Math.abs(a[ax]) / cap : 0; if (r > worstCap) { worstCap = r; worstCapId = `${s.id} ${ax}`; }
    }
  }
  out.worstCap = { ratio: worstCap, where: worstCapId };
  // regional totals actually applied vs limits
  out.regionTotals = Object.fromEntries(ROM.REGIONS.map((r) => {
    const ss = ROM.SEGMENTS.filter((s) => s.region === r), sum = (k) => ss.reduce((a, s) => a + m.solved.segments[s.id][k], 0);
    // distribution: largest single segment as a share of the region's PRIMARY motion (axes the pose actually asks for)
    const prim = ["fe", "lb", "ar"].filter((k) => pose && pose[r] && pose[r][k]);
    return [r, { fe: sum("fe"), lb: sum("lb"), ar: sum("ar"), maxShare: Math.max(0, ...prim.map((k) => { const t = Math.abs(sum(k)); return t > 0.5 ? Math.max(...ss.map((s) => Math.abs(m.solved.segments[s.id][k]))) / t : 0; })) }];
  }));
  // discs
  let dmin = 9, dmax = 0, dwhere = "";
  for (const e of m.els) if (e.kind === "disc") { const h = Rig.discHeights(e); for (const k in h) { if (h[k].ratio < dmin) { dmin = h[k].ratio; dwhere = `${e.id} ${k}`; } dmax = Math.max(dmax, h[k].ratio); } }
  out.discs = { minRatio: dmin, maxRatio: dmax, where: dwhere };
  // contacts vs neutral
  const c = contacts(ctx, m);
  let pen = 0, penPair = "", sep = 0, sepPair = "";
  for (const k in c) {
    const base = baseline ? baseline[k].min : 0, extra = -(c[k].min) - Math.max(0, -base);
    if (extra > pen) { pen = extra; penPair = k; }
    if (c[k].gap === 1) { const d = c[k].min; if (d > sep) { sep = d; sepPair = k; } }
  }
  out.contacts = { newOverlap: pen, overlapPair: penPair, maxNeighbourGap: sep, gapPair: sepPair, raw: c };
  return { model: m, out };
}
module.exports = { setup, contacts, check };
