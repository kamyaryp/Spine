# Spine

A pixel-art character for demonstrating physical exercises. The character is built around a consistent skeleton.

The work goes in stages:

1. **Pixel-art style.** Current stage: a lumbar vertebra style study.
2. Full skeleton.
3. Body built around the skeleton.
4. Close-fitting clothing, with each clothed region in its own colour.

The skeleton stays the structural base for every later layer.

## Vertebra Pixel Lab

`index.html` is an interactive lab for the style study. Open it in a browser, or serve the repository with GitHub Pages. It renders one lumbar vertebra (L3) from a 3D model straight to pixel art in the browser.

- **Views:** front, front 3/4, side, back 3/4 and back, all at eye level, plus a top view for reference. Custom angles move in 15° steps.
- **Scale and display:** 1 to 4 mm per pixel, zoom, a choice of backgrounds, a pixel grid and pivot guides.
- **Light:** direction, how much it faces the viewer, ambient light, crevice shadow and exposure.
- **Pixel rules:** outline, interior contour lines, rim light and pixel-cluster cleanup.
- **Palette:** editable, with presets.
- **Anatomy:** a colour-by-anatomy mode, and a hover readout showing the part, tone and offset from the pivot.
- **Export:** PNG at 1× or 4×, and the current style settings as JSON.

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
| `tools/vertebra.py` | The original Python renderer (numpy and Pillow): `python tools/vertebra.py 1.0 out` writes the six views at 1 mm/px. |

## Open question

At 4 mm/px and smaller, the slender processes collapse into outline. A 175 cm character at 8 mm/px is about 220 px tall, and each vertebra there is only about 10×4 px. The character's final on-screen height has to be chosen before the full skeleton is built.

## Credits

The "pixelfx bone" palette preset uses the bone colour ramp from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch, © 2026 Hugo Duprez).
