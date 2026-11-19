# Spine

A pixel-art character for demonstrating physical exercises. The character is built around a consistent skeleton.

The work goes in stages:

1. **Pixel-art style.** Done: a lumbar vertebra style study (`index.html`).
2. **Skeleton.** In progress: the complete spinal column (`spine/`).
3. Body built around the skeleton.
4. Close-fitting clothing, with each clothed region in its own colour.

The skeleton stays the structural base for every later layer.

## Vertebra Pixel Lab

`index.html` is an interactive lab for the style study. Open it in a browser, or serve the repository with GitHub Pages. It renders one lumbar vertebra (L3) from a 3D model straight to pixel art in the browser.

- **Views:** front, front 3/4, side, back 3/4 and back, all at eye level, plus a top view for reference. Custom angles move in 15° steps.
- **Scale and display:** 1 to 4 mm per pixel, zoom, a choice of backgrounds and pivot guides. Every view uses the same square 96 × 96 mm frame.
- **Light:** direction, how much it faces the viewer, ambient light, crevice shadow and exposure.
- **Pixel rules:** outline, interior contour lines, rim light and pixel-cluster cleanup.
- **Palette:** editable, with presets.
- **Anatomy:** a colour-by-anatomy mode, and a hover readout showing the part, tone and offset from the pivot.
- **Export:** PNG at 4×, and the current style settings as JSON.

## Spinal column (`spine/`)

`spine/index.html` renders the assembled column in the browser from eight fixed eye-level angles: front, back, both sides and four three-quarter views. Each view uses the same 800 × 800 frame at 1 px = 1 mm, rotated about one pivot. The page has vertebra labels, pivot guides, a colour-by-region mode, a hover readout and PNG export.

- **Subject:** adult female, 183 cm, 78 kg, neutral standing posture. Weight does not thicken the bones; it is left for muscle and soft tissue later.
- **Elements:** 24 vertebrae (C1–C7, T1–T12, L1–L5), the sacrum and the coccyx as fused units, and 23 discs (C2–C3 to L5–S1). Each has a stable ID: `C1` … `L5`, `S`, `Co`, `D_C2_C3` … `D_L5_S1`.
- **Regional anatomy:**
  - Cervical: uncinate processes, articular pillars, foramina transversaria, bifid spinous processes, and C7 as the vertebra prominens.
  - Atlas (C1) and axis (C2): built separately, with the dens.
  - Thoracic: heart-shaped bodies, coronal facets, and long sloping spinous processes.
  - Lumbar: based on the approved style study.
  - Sacrum: alae, foramina, median crest and hiatus.
- **Dimensions:** adult reference vertebral dimensions (Panjabi et al.) scaled to stature, with a female transverse factor.
- **Sagittal posture:** sacral slope 41°, lumbar lordosis about 57°, thoracic kyphosis T4–T12 about 36°, cervical lordosis about 18°. The C7 plumb line lands 20 mm in front of the S1 posterior corner.
- **Calibration:** body and disc heights are calibrated to landmarks of the whole figure: the hip, the iliac crest at L4–L5, cervicale at C7, and room left for the skull.
- **Rig:** each element has a local frame, origin at its body centre with y along the body axis. The sacrum is the root. Each of the 24 motion segments carries a pivot and a representative range of motion (White & Panjabi). Discs deform between their end plates.

| Command (Node, no dependencies) | Output |
|---|---|
| `node spine/tools/build-viewer.js` | rebuilds `spine/index.html` from `spine/src` and `spine/viewer` |
| `node spine/tools/render-views.js out 4` | eight transparent PNG views in `out/` |
| `node spine/tools/validate.js out` | validation report: counts, curves, balance, lengths, contacts, view consistency |
| `node spine/tools/export-rig.js out/spine-rig.json` | element frames, motion segments, pivots and ranges of motion |

## How the style works

- **One model, every view.** Each bone is a 3D shape (a signed distance field, in millimetres) projected orthographically onto the pixel grid. Every angle comes from the same model, so proportions and joint positions can't drift between views.
- **Axes.** x is the subject's left, y is up and z is forward. Every view rotates about the same pivot, which sits at the centre of the frame.
- **Eye-level camera.** A point keeps the same height on screen in every view, so poses line up across angles.
- **Fixed light.** Light comes from the top left, fixed to the camera, so every view is lit the same way.
- **Pixel rules:**
  - 4×4 supersampled coverage.
  - Hard tone steps; no gradients.
  - A 3×3 majority filter, so tones form clusters and no pixel sits alone.
  - A 1 px dark outline.
  - Interior contour lines where depth jumps by more than 3 mm; never single dots.
  - Rim light along top edges.
  - The darkest tone is kept for lines and cavities.

### Bone palette

| outline | line | shade | mid | light | highlight |
|---|---|---|---|---|---|
| `#2b211b` | `#5c4a3b` | `#8e7860` | `#bca98a` | `#e0d4b8` | `#faf4e3` |

## Repository layout

The repository is code only: every image is generated. Export sprites from the lab (Save PNG) or with `tools/vertebra.py`.


| Path | What it is |
|---|---|
| `index.html` | The lab as a single self-contained page (built from `lab/`). |
| `lab/` | Lab sources: `geo.js` (the shape and ray caster), `app.js` (UI and pixel rules), `shell.html` (page). Run `python lab/build.py` to rebuild `index.html`. |
| `tools/vertebra.py` | The original Python renderer (numpy and Pillow): `python tools/vertebra.py 1.0 out` writes the six views at 1 mm/px as 96 × 96 px frames. |

## Open question

At 4 mm/px and smaller, the slender processes collapse into outline. A 175 cm character at 8 mm/px is about 220 px tall, and each vertebra there is only about 10×4 px. The character's final on-screen height has to be chosen before the full skeleton is built.

## Credits

The "pixelfx bone" palette preset uses the bone colour ramp from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch, © 2026 Hugo Duprez).
