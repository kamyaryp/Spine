// node tools/build-viewer.js -> index.html (self-contained page; everything rendered in the browser)
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
let page = fs.readFileSync(path.join(root, "viewer/shell.html"), "utf8");
for (const [k, f] of [["CORE", "src/spine-core.js"], ["RENDER", "src/spine-render.js"], ["VIEWER", "viewer/viewer.js"]])
  page = page.replace(`/*${k}*/`, () => fs.readFileSync(path.join(root, f), "utf8"));
fs.writeFileSync(path.join(root, "index.html"), page); console.log("wrote index.html");
