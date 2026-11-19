// node tools/rig-frames.js <outDir> i/n  -> eased playback frames (neutral -> pose) for each demonstration in one view
const fs = require("fs"), path = require("path");
const C = require("../src/spine-core.js"), R = require("../src/spine-render.js"), Rig = require("../src/spine-rig.js"), { encodePNG } = require("./png.js");
const out = process.argv[2] || "out/frames", [wi, wn] = (process.argv[3] || "0/1").split("/").map(Number);
const VIEW = { flexion: "right", extension: "right", "bend-left": "back", "bend-right": "back", "rotate-left": "front-right", "rotate-right": "front-right", combined: "front-right" };
const FR = [0.1464, 0.5, 0.8536];   // in-out sine between neutral (0) and the pose (1), as in pixelfx easing
const built = C.build(), comps = built.els.map(C.compile), rig = Rig.makeRig(built);
let k = 0;
for (const d of Rig.demoPoses()) {
  if (!VIEW[d.id]) continue;
  for (const f of FR) {
    if (k++ % wn !== wi) continue;
    const v = R.VIEWS.find((x) => x.id === VIEW[d.id]), m = Rig.posedModel(rig, comps, Rig.scalePose(d.pose, f));
    const g = R.cast(m, { ...R.FRAME, yaw: v.yaw, pitch: 0, ss: 3 }), st = R.stylise(g, m);
    fs.mkdirSync(path.join(out, d.id), { recursive: true });
    fs.writeFileSync(path.join(out, d.id, `${v.id}_${f}.png`), encodePNG(st.W, st.H, R.paint(st, m)));
    console.log(d.id, f);
  }
}
