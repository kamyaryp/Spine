# Spine

A pixel-art character for demonstrating physical exercises, built stage by stage in **one environment**:
the approved vertebra grew into the spinal column and now into the skeleton; the body and close-fitting clothing follow.
Everything is a view onto the same anatomical model and the same pixel-art renderer, so the style, scale,
camera angles and joint positions stay consistent from stage to stage.

**Open `index.html`** (or the GitHub Pages site) — the Pixel Character Lab.

The lab has exactly three tabs:

| Tab | Status | What it shows |
|---|---|---|
| **Skeleton** | spine, rig, rib cage and clavicles approved | the assembled skeleton: C1–C7, T1–T12, L1–L5, sacrum, coccyx, 23 discs, 12 rib pairs with their costal cartilages, sternum and both clavicles |
| **Body** | not started | muscle and soft tissue around the skeleton (weight is accounted for here) |
| **Clothing** | not started | close-fitting garments following the body |

The Skeleton tab is built around one workflow: view the character → choose an angle → pick or adjust a movement → play it → export.

- **Preview first.** The preview takes most of the window. Above it: Front, ¾, Side, Back and ¾ back, a Right / Left switch for the side of the body facing the camera, a small top-down compass, and zoom (Fit, −, +). Fit always fits the whole frame, below 1× when needed (crisp whole-number zoom from 1× up). Below it: Play / Pause (Space) and Reset pose.
- **Movement.** Presets first. *Adjust pose* (collapsed) has Neck, Upper back, Lower back and Clavicles, each with plain controls (Bend forward / back, Bend sideways, Twist; Raise / lower, Forward / back, Roll back) and the angle beside each. Clavicles move together unless unlinked. The pelvis (sacrum) sits in an advanced subsection and stays fixed by default.
- **Visibility** (collapsed): spine, rib cage, clavicles, anatomical labels, centre guides, diagnostic colouring. Labels and guides start off.
- **Appearance** (collapsed): palette presets and custom colours, background, pixel detail (mm per pixel, independent of zoom), lighting, pixel rules, style JSON, and *Reset appearance*, which resets only these.
- **Technical details** (collapsed): range-of-motion envelopes, rib-cage response, segment angles, how movement works.
- **Export:** *Artwork PNG* is the clean sprite (transparent, palette colours, 1 px per pixel, no labels, guides or diagnostic colours). *Preview PNG* is exactly what the preview shows, at 2×.
- **Narrow screens:** the preview comes first and stays pinned while the settings scroll below it.

The repository is code only: every image is generated.

## Subject and anatomy

- Adult female, 183 cm, 78 kg, neutral standing. Character space: millimetres, x = left, y = up (floor = 0), z = forward.
- Vertebral dimensions from adult reference data (Panjabi et al.) scaled to stature, with a female transverse factor; weight does not thicken bones.
- Regional characteristics: atlas and axis with dens; cervical uncinate processes, articular pillars, foramina transversaria, bifid spinous processes, C7 vertebra prominens; thoracic heart-shaped bodies, coronal facets, long sloping spinous processes; lumbar bodies and processes from the approved study; sacrum with alae, foramina, median crest and hiatus; four-segment coccyx.
- Posture: sacral slope 41°, lumbar lordosis ≈ 57°, thoracic kyphosis T4–T12 ≈ 36°, cervical lordosis ≈ 18°, C7 plumb line 20 mm in front of S1. Body and disc heights are calibrated to whole-figure landmarks (hip, iliac crest at L4–L5, cervicale at C7, room for the skull).
- Rig: each element has a stable ID (`C1` … `L5`, `S`, `Co`, `D_C2_C3` … `D_L5_S1`) and a local frame (origin at the body centre, y along the body axis). The sacrum is the root; 24 motion segments carry pivots and ranges of motion. Discs deform between their end plates.

## Spinal rig

The approved neutral column is the rest pose; posing never edits the anatomy, it only produces new transforms for the same shapes.

- **Controls:** flexion/extension, left/right bending and left/right rotation for the cervical (C1–T1), thoracic (T1–L1) and lumbar (L1–S1) regions, plus a whole-sacrum root control (pelvic tilt, obliquity, rotation about the hip axis) that is off by default so the sacrum stays fixed.
- **Distribution:** each regional angle is spread over its motion segments in proportion to their measured share; no joint ever takes a region's range. C1–C2 is handled separately (rotation about the dens; bending about the loaded lateral mass).
- **Limits:** active, physiological, in vivo ranges from neutral to one side (`src/spine-rom.js`, with sources and approximations per segment). Controls reach 85 % of the mean; combined motions share one ellipsoidal envelope so all axes cannot peak together; every segment is capped.
- **Coupling:** cervical bending ↔ same-side rotation (opposite at C1–C2), thoracic bending → same-side rotation, lumbar rotation → opposite bending (same side at L5–S1), as reported in vivo.
- **Articulation:** rigid vertebrae rotate about anatomically placed centres (within the caudal body in the neck, disc centre in the thorax, posterior half of the disc in the lumbar spine). Discs stay attached: each end plate follows its own vertebra and the disc deforms between them.
- **Neutral:** zero input returns the rest model itself; the rig is stateless, so there is no drift.
- **Views:** one pose drives all eight views; the spine frame is 1040 × 1040 px at 1 mm/px in every pose.

| Command | Output |
|---|---|
| `node tools/rig-report.js out/rig --render 0/1` | every demonstration pose in all eight views |
| `node tools/rig-report.js out/rig --report` | limits table and checks: limits, distribution, discs, contacts, view consistency, neutral restoration |
| `node tools/rig-frames.js out/rig` | eased playback frames for each demonstration |

## Rib cage and clavicles

Built onto the approved spine without changing it (spine-only renders are pixel-identical to the approved ones).

- **Ribs:** 12 pairs, IDs `RIB1_L` … `RIB12_R` (L = subject's left). True ribs 1–7 reach the sternum through their own cartilage; false ribs 8–10 join the cartilage above; floating ribs 11–12 end in free cartilaginous tips. Each rib is a swept section along an anatomical centreline: head, neck, tubercle, angle, shaft, costochondral end; rib 1 is short, broad and flat with its faces up and down.
- **Attachments:** heads of ribs 2–9 sit in the notch formed by the demifacets of two vertebrae and their disc (rib *n* on T*n*−1 and T*n*); ribs 1, 10, 11, 12 on a single body. Tubercles of ribs 1–10 rest on the front of their transverse-process tips; 11–12 have no costotransverse joint. Joint spaces are 0–1 mm (articular cartilage).
- **Costal cartilages:** `CC1_L` … `CC12_R`, drawn with the disc (cartilage) ramp. 1–7 insert into the sternum (rib 1 on the manubrium, rib 2 at the sternal angle, 3–7 along the body, 7 at the xiphisternal joint); 8–10 join the cartilage above and form the costal margin (infrasternal angle ≈ 75°, lowest point at L2).
- **Sternum:** `STERNUM`, one rigid bone (manubrium, body, xiphoid; the manubriosternal joint is a symphysis). Female CT means scaled to 183 cm: manubrium 50 mm, body 95 mm, xiphoid 28 mm. Jugular notch at the T2–T3 disc (female: T3), sternal angle at T4–T5, xiphisternal joint at T8–T9.
- **Clavicles:** `CLAV_L`, `CLAV_R`, S-shaped (medial two-thirds convex forward, lateral third concave), 156 mm centreline / 152 mm end to end (female CT 151 ± 8 mm, scaled), bulky sternal end, flattened acromial end. Rest orientation ≈ 20° retracted and 6° elevated. Each sits in the clavicular notch of the manubrium with a 2 mm joint space and clears the first rib; neither touches the spine.
- **Proportions (outer):** rib-cage width 130 mm at rib 1, 224 mm at rib 4, 274 mm at rib 9 (widest); depth 181 mm at rib 8; sternum to T8 122 mm inside; acromial ends 344 mm apart. No scapulae or arms yet.

## Thorax rig

`src/thorax-rig.js` sits on top of the spinal rig, which is used unchanged (same IDs, controls, demonstrations and limits).

- **Hierarchy:** vertebra T*n* → rib *n* (costovertebral and costotransverse joints) → costal cartilage → sternum; sternum → clavicle L / R (sternoclavicular joint).
- **Ribs** move rigidly with their vertebra and may also turn about their costovertebral axis (head → tubercle, the axis of pump- and bucket-handle motion), at most ±10°. **Cartilages** are flexible but keep their rest length: for each pose they are rebuilt between the moved ends and bend instead of stretching. **The sternum** takes the place where the true-rib cartilages are disturbed least (least squares on cartilage length and shape; rib 1's synchondrosis and rib 2 are weighted stiffer). Floating ribs keep their place relative to the rib above (intercostal tissue).
- **Clavicles** follow the sternum and have their own controls per side: elevation / depression, protraction / retraction, posterior rotation about the long axis, about a pivot on the joint surface. Limits are 85 % of the sternoclavicular ranges (Neumann: 45° elevation, 10° depression, 17.5° protraction, 22.5° retraction, 27.5° posterior rotation; Ludewig et al. 2009 for the rest position and functional motion); combined motions share one envelope per side. Zero is the rest position; the controls are ready for the shoulder girdle.
- **Neutral:** zero spine and clavicle input returns the rest skeleton itself (stateless, no drift).

**Thoracic constraints with the rib cage — review, no change made.** The approved thoracic limits come from in vivo
studies of people with an intact rib cage, so they already include its stiffening (in vitro, removing the rib cage
more than doubles thoracic axial rotation; Wilke et al. 2017). The check below confirms the rib cage can follow every
approved demonstration: ribs turn at most 6° at their costovertebral joints, cartilage ends move within 97–103 % of
their rest distance while the cartilages keep their length (≤ 0.8 %), no bones intersect, and no joint opens by more
than 0.3 mm. The thoracic limits in `src/spine-rom.js` are therefore unchanged. Additions: `SETTINGS.ribcage`
(costovertebral limit, cartilage tolerance) and `SC` (clavicle ranges) in the same file.

| Command | Output |
|---|---|
| `node tools/thorax-check.js [--json out.json]` | rib count and types, attachments, symmetry, proportions, and behaviour in every demonstration and clavicle extreme |
| `node tools/skel-views.js out 3` | the rest skeleton in eight views plus top |
| `node tools/skel-demos.js out/skel 0/1` | every demonstration (spine and clavicles) in four views; `--frames` for playback in-betweens |

## Pixel style

One model, every view: each bone is a signed distance field in millimetres, projected orthographically. Light is fixed to the
camera (top left). 4×4 supersampling, hard tone steps, 3×3 majority clusters (no lone pixels), 1 px outline, contour lines where
depth jumps more than 3 mm (never single dots), rim light on top edges, darkest tone kept for lines and cavities. Where two
thorax bones touch without a depth jump (clavicle on the manubrium, rib head on its vertebra) a joint line separates them.

| | outline | line | shade | mid | light | highlight |
|---|---|---|---|---|---|---|
| Bone | `#2b211b` | `#5c4a3b` | `#8e7860` | `#bca98a` | `#e0d4b8` | `#faf4e3` |
| Disc, costal cartilage | (bone) | `#4b5157` | `#7b878a` | `#a7b2b0` | `#cdd6d1` | `#eef3ee` |

## Code

| Path | What it is |
|---|---|
| `src/spine-core.js` | anatomy data, assembly (rig) and the shapes of every element |
| `src/spine-rom.js` | movement limits, distribution, coupling and references (one place to review and adjust) |
| `src/spine-rig.js` | the rig: pose → segment angles → rigid vertebrae and deforming discs |
| `src/thorax-core.js` | ribs, costal cartilages, sternum and clavicles: data, placement on the spine, shapes |
| `src/thorax-rig.js` | rib-cage response to spinal poses, clavicle controls, skeleton demonstrations |
| `src/spine-render.js` | ray caster and the pixel-art pass |
| `src/measure.js` | landmark measurements from the model |
| `app/` | the lab's page (`shell.html`) and interface (`app.js`) |
| `index.html` | built from `src/` and `app/` by `node tools/build.js` |

| Command (Node, no dependencies) | Output |
|---|---|
| `node tools/build.js` | rebuilds `index.html` |
| `node tools/render-views.js out 4` | the eight spine views as transparent PNGs in `out/` |
| `node tools/validate.js out` | validation report: counts, curves, balance, lengths, contacts, view consistency |
| `node tools/export-rig.js out/spine-rig.json` | element frames, motion segments, pivots, limits, coupling, demo poses, and the thorax (frames, joints, attachments, clavicle limits) |

## Credits

The "pixelfx bone" palette preset uses the bone ramp from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch, © 2026 Hugo Duprez).
