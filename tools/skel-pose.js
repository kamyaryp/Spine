// node tools/skel-pose.js outDir ss demoId view [view...] -> posed skeleton PNGs (1 mm/px)
const fs = require("fs"), path = require("path");
const C = require("../src/spine-core.js"), SR = require("../src/spine-rig.js"), TR = require("../src/thorax-rig.js"), R = require("../src/spine-render.js"), { encodePNG } = require("./png.js");
const [out, ss, demo, ...views] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sk = TR.buildSkeleton(), rig = TR.makeRig(sk), comps = sk.els.map(C.compile);
const d = SR.demoPoses().find((x) => x.id === demo) || { pose: JSON.parse(demo) };
const m = TR.posedModel(rig, comps, d.pose);
for (const vid of views) {
  const v = [...R.VIEWS, { id: "top", yaw: 0, pitch: 90 }].find((x) => x.id === vid);
  const g = R.cast(m, { ...R.FRAME, yaw: v.yaw, pitch: v.pitch || 0, ss: +ss }), st = R.stylise(g, m);
  fs.writeFileSync(path.join(out, `${d.id || "pose"}_${vid}.png`), encodePNG(st.W, st.H, R.paint(st, m)));
}
