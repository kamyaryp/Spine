// node tools/skel-demos.js <outDir> i/n [views] -> every skeleton demonstration pose in the given views (review sheets, GIFs)
// Optional: --frames -> eased in-between frames (0.1464, 0.5, 0.8536) for the playback GIFs; --only=id,id limits the demos.
const fs = require("fs"), path = require("path");
const C = require("../src/spine-core.js"), R = require("../src/spine-render.js"), TR = require("../src/thorax-rig.js"), { encodePNG } = require("./png.js");
const out = process.argv[2] || "out/skel", [wi, wn] = (process.argv[3] || "0/1").split("/").map(Number);
const views = (process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4] : "front,right,back,front-right").split(",");
const frames = process.argv.includes("--frames"), onlyArg = process.argv.find((a) => a.startsWith("--only=")), only = onlyArg ? onlyArg.slice(7).split(",") : null;
const GIF = { flexion: "right", extension: "right", "bend-left": "front", "rotate-left": "front-right", combined: "front-right", shrug: "front", "shoulders-back": "front-right" };
const sk = TR.buildSkeleton(), comps = sk.els.map(C.compile), rig = TR.makeRig(sk);
const jobs = [];
for (const d of TR.demoPoses()) {
  if (only && !only.includes(d.id)) continue;
  if (frames) { if (GIF[d.id]) for (const f of [0.1464, 0.5, 0.8536]) jobs.push([d, GIF[d.id], f]); }
  else for (const v of views) jobs.push([d, v, 1]);
}
jobs.forEach(([d, vid, f], k) => {
  if (k % wn !== wi) return;
  const v = [...R.VIEWS, { id: "top", yaw: 0, pitch: 90 }].find((x) => x.id === vid), m = TR.posedModel(rig, comps, TR.scalePose(d.pose, f));
  const g = R.cast(m, { ...R.FRAME, yaw: v.yaw, pitch: v.pitch || 0, ss: 3 }), st = R.stylise(g, m);
  fs.mkdirSync(path.join(out, d.id), { recursive: true });
  fs.writeFileSync(path.join(out, d.id, frames ? `${vid}_${f}.png` : `${vid}.png`), encodePNG(st.W, st.H, R.paint(st, m)));
  console.log(d.id, vid, f);
});
