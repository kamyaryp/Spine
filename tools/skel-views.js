// node tools/skel-views.js outDir ss view1 view2 ... -> rest skeleton (spine + thorax) PNGs at 1 mm/px
const fs = require("fs"), path = require("path");
const S = require("../src/spine-core.js"), Th = require("../src/thorax-core.js"), R = require("../src/spine-render.js"), { encodePNG } = require("./png.js");
const out = process.argv[2] || "out", ss = +(process.argv[3] || 3), only = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const sp = S.build(), th = Th.build(sp), els = [...sp.els, ...th.els];
const model = { els, comps: els.map(S.compile) };
for (const v of [...R.VIEWS, { id: "top", yaw: 0, pitch: 90 }]) {
  if (only.length && !only.includes(v.id)) continue;
  const t0 = Date.now();
  const g = R.cast(model, { ...R.FRAME, yaw: v.yaw, pitch: v.pitch || 0, ss });
  const st = R.stylise(g, model);
  fs.writeFileSync(path.join(out, `skel_${v.id}.png`), encodePNG(st.W, st.H, R.paint(st, model)));
  console.log(v.id, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
