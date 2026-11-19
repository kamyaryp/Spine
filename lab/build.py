"""Inline geo.js and app.js into shell.html -> ../index.html (one self-contained page)."""
from pathlib import Path
here = Path(__file__).parent
page = (here / "shell.html").read_text(encoding="utf-8")
page = page.replace("/*GEO*/", (here / "geo.js").read_text(encoding="utf-8"))
page = page.replace("/*APP*/", (here / "app.js").read_text(encoding="utf-8"))
(here.parent / "index.html").write_text(page, encoding="utf-8")
print("wrote", here.parent / "index.html")
