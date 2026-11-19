# Spine

A pixel-art character for demonstrating physical exercises, built level by level in **one environment**:
the approved vertebra grows into the spinal column, then the full skeleton, the body and close-fitting clothing.
Every level is a view onto the same anatomical model and the same pixel-art renderer, so the style, scale,
camera angles and joint positions stay consistent from level to level.

**Open `index.html`** (or the GitHub Pages site) — the Pixel Character Lab.

| Level | Status | What it shows |
|---|---|---|
| 1 · Vertebra | done | Any single bone of the column in its own upright frame (L3 is the approved style study), with a top view for reference |
| 2 · Spine | done, awaiting review | C1–C7, T1–T12, L1–L5, sacrum, coccyx and the 23 discs (C2–C3 … L5–S1), assembled in neutral standing posture |
| 3 · Skeleton | next | skull, rib cage, pelvis, limbs on the same rig |
| 4 · Body | later | muscle and soft tissue around the skeleton (weight is accounted for here) |
| 5 · Clothing | later | close-fitting garments following the body |

The lab has one set of controls for every level: camera angle (eight eye-level views about one pivot; a point keeps
its screen height in every view), pixel scale (1–4 mm/px), zoom, background, light, pixel rules, palette, colour by
anatomy or region, vertebra labels, a hover readout, PNG export and a copy of the style settings as JSON.
The repository is code only: every image is generated.

## Subject and anatomy

- Adult female, 183 cm, 78 kg, neutral standing. Character space: millimetres, x = left, y = up (floor = 0), z = forward.
- Vertebral dimensions from adult reference data (Panjabi et al.) scaled to stature, with a female transverse factor; weight does not thicken bones.
- Regional characteristics: atlas and axis with dens; cervical uncinate processes, articular pillars, foramina transversaria, bifid spinous processes, C7 vertebra prominens; thoracic heart-shaped bodies, coronal facets, long sloping spinous processes; lumbar bodies and processes from the approved study; sacrum with alae, foramina, median crest and hiatus; four-segment coccyx.
- Posture: sacral slope 41°, lumbar lordosis ≈ 57°, thoracic kyphosis T4–T12 ≈ 36°, cervical lordosis ≈ 18°, C7 plumb line 20 mm in front of S1. Body and disc heights are calibrated to whole-figure landmarks (hip, iliac crest at L4–L5, cervicale at C7, room for the skull).
- Rig: each element has a stable ID (`C1` … `L5`, `S`, `Co`, `D_C2_C3` … `D_L5_S1`) and a local frame (origin at the body centre, y along the body axis). The sacrum is the root; 24 motion segments carry pivots and ranges of motion (White & Panjabi). Discs deform between their end plates.

## Pixel style

One model, every view: each bone is a signed distance field in millimetres, projected orthographically. Light is fixed to the
camera (top left). 4×4 supersampling, hard tone steps, 3×3 majority clusters (no lone pixels), 1 px outline, contour lines where
depth jumps more than 3 mm (never single dots), rim light on top edges, darkest tone kept for lines and cavities.

| | outline | line | shade | mid | light | highlight |
|---|---|---|---|---|---|---|
| Bone | `#2b211b` | `#5c4a3b` | `#8e7860` | `#bca98a` | `#e0d4b8` | `#faf4e3` |
| Disc | (bone) | `#4b5157` | `#7b878a` | `#a7b2b0` | `#cdd6d1` | `#eef3ee` |

## Code

| Path | What it is |
|---|---|
| `src/spine-core.js` | anatomy data, assembly (rig) and the shapes of every element |
| `src/spine-render.js` | ray caster and the pixel-art pass |
| `src/measure.js` | landmark measurements from the model |
| `app/` | the lab's page (`shell.html`) and interface (`app.js`) |
| `index.html` | built from `src/` and `app/` by `node tools/build.js` |

| Command (Node, no dependencies) | Output |
|---|---|
| `node tools/build.js` | rebuilds `index.html` |
| `node tools/render-views.js out 4` | the eight spine views as transparent PNGs in `out/` |
| `node tools/validate.js out` | validation report: counts, curves, balance, lengths, contacts, view consistency |
| `node tools/export-rig.js out/spine-rig.json` | element frames, motion segments, pivots and ranges of motion |

## Credits

The "pixelfx bone" palette preset uses the bone ramp from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch, © 2026 Hugo Duprez).
