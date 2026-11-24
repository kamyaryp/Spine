// node tools/build.js -> index.html: the single Pixel Character Lab page (Skeleton, Body, Clothing), self-contained
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
let page = fs.readFileSync(path.join(root, "app/shell.html"), "utf8");
for (const [k, f] of [["CORE", "src/spine-core.js"], ["ROM", "src/spine-rom.js"], ["RIG", "src/spine-rig.js"], ["THORAXRIG", "src/thorax-rig.js"], ["THORAX", "src/thorax-core.js"], ["SHOULDER", "src/shoulder-core.js"], ["PELVIS", "src/pelvis-core.js"], ["RENDER", "src/spine-render.js"], ["APP", "app/app.js"]])
  page = page.replace(`/*${k}*/`, () => fs.readFileSync(path.join(root, f), "utf8"));
fs.writeFileSync(path.join(root, "index.html"), page); console.log("wrote index.html");
