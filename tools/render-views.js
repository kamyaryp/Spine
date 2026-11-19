// node tools/render-views.js [outDir] [ss] [viewIds...]  -> transparent PNG per view at 1 mm/px
const fs = require("fs"), path = require("path");
const S = require("../src/spine-core.js"), R = require("../src/spine-render.js"), { encodePNG } = require("./png.js");
const out = process.argv[2] || "out"; const ss = +(process.argv[3] || 3); const only = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const built = S.build(); const model = { els: built.els, comps: built.els.map(S.compile) };
for (const v of R.VIEWS) {
  if (only.length && !only.includes(v.id)) continue;
  const t0 = Date.now();
  const g = R.cast(model, { ...R.FRAME, yaw: v.yaw, pitch: 0, ss });
  const st = R.stylise(g, model);
  fs.writeFileSync(path.join(out, `spine_${v.id}.png`), encodePNG(st.W, st.H, R.paint(st, model)));
  console.log(v.id, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
