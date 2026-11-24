# Spine

A pixel-art character for demonstrating physical exercises, built stage by stage in **one environment**:
the approved vertebra grew into the spinal column and now into the skeleton; the body and close-fitting clothing follow.
Everything is a view onto the same anatomical model and the same pixel-art renderer, so the style, scale,
camera angles and joint positions stay consistent from stage to stage.

**Open `index.html`** (or the GitHub Pages site) — the Pixel Character Lab.

The lab has exactly three tabs:

| Tab | Status | What it shows |
|---|---|---|
| **Skeleton** | spine, rig, rib cage, clavicles approved; scapulae, pelvis and hyoid awaiting review | the complete trunk skeleton: C1–C7, T1–T12, L1–L5, sacrum, coccyx, 23 discs, 12 rib pairs with their costal cartilages, sternum, both clavicles, both scapulae, both hip bones with the sacroiliac joints and pubic symphysis, and the hyoid. Skull, face and limbs are not built yet |
| **Body** | not started | muscle and soft tissue around the skeleton (weight is accounted for here) |
| **Clothing** | not started | close-fitting garments following the body |

The Skeleton tab is built around one workflow: view the character → choose an angle → pick or adjust a movement → play it → export.

- **Preview first.** The preview takes most of the window. Above it: Front, ¾, Side, Back and ¾ back, a Right / Left switch for the side of the body facing the camera, a small top-down compass, and zoom (Fit, −, +). Fit always fits the whole frame, below 1× when needed (crisp whole-number zoom from 1× up). Below it: Play / Pause (Space) and Reset pose.
- **Movement.** Presets first (spinal, shoulder and two controlled pelvic tilts). *Adjust pose* (collapsed) has Neck, Upper back, Lower back, Shoulders and Pelvis, each with plain controls (Bend forward / back, Bend sideways, Twist; Raise / lower, Forward / back, Shoulder blade rotation; Tilt, Hip hike, Turn) and the angle beside each. Both shoulders move together unless unlinked. The pelvis has a small *Advanced: pelvic joints* subsection (sacroiliac nutation, hip bone counter-rotation).
- **Visibility** (collapsed): spine, rib cage, shoulder girdle, pelvis, hyoid, anatomical labels, centre guides, diagnostic colouring. Labels and guides start off.
- **Appearance** (collapsed): palette presets and custom colours, background, pixel detail (mm per pixel, independent of zoom), lighting, pixel rules, style JSON, and *Reset appearance*, which resets only these.
- **Technical details** (collapsed): range-of-motion envelopes, rib-cage response, shoulder girdle, pelvis (pose, joint spaces, hip joint centres), segment angles, how movement works.
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

## Shoulder girdle: scapulae

Added on top of the approved spine, rib cage, sternum and clavicles; none of their shapes change.

- **Scapulae:** `SCAP_L`, `SCAP_R`, mirror images, each with body (blade), spine, acromion, coracoid process, glenoid cavity, medial, lateral and superior borders, superior and inferior angles. The costal (anterior) surface carries the subscapular fossa; the dorsal surface the supraspinous and infraspinous fossae (hover names them). Female references scaled to 183 cm: superior to inferior angle 148 mm (female mean 140.6), width to the glenoid 103 mm, spine to the acromion tip 132 mm (128–134), glenoid 36 × 27 mm (female 34.8 × 26.2), inclination 12°.
- **Placement:** each acromion meets the end of its approved clavicle at the acromioclavicular joint (≈ 1.5 mm joint space). The medial border rests on the rib cage at a 10 mm soft-tissue distance (serratus anterior, subscapularis). Superior angle at T2, root of the spine at T4, inferior angle at the T8 body (T7 spinous process), as palpation references give.
- **Orientation, and one point for review:** with the approved clavicle (20° retraction) and rib cage, the solved resting scapula is ≈ 10° anteriorly tilted and ≈ 2° upwardly rotated (references: ≈ 10° and a few degrees), but only ≈ 6° internally rotated measured from the spine root to the acromial angle (references: ≈ 26–41°). The glenoid faces ≈ 16° forward of lateral and 10° upward. The medial border sits 90–104 mm from the midline (palpation references: ≈ 50–75 mm in average-size adults). Both follow from the clavicle's lateral end sitting fairly far back for this rib cage. Bringing the shoulder forward (less clavicle retraction) or deepening the upper posterior rib cage would raise the internal rotation; neither was changed without approval.
- **Rig:** scapula = clavicle (sternoclavicular joint) → acromioclavicular joint (3 rotations) → scapula, gliding on the rib cage. The gliding surface is the outer surface of the same-side ribs 1–10 blended into one sheet; it moves with the ribs in every spinal pose. Controls per side: **raise / lower** and **forward / back** (clavicle at the sternoclavicular joint, 85 % of the approved ranges) and **shoulder blade rotation** (scapular upward / downward rotation). The clavicle's axial rotation, extra clavicle elevation for upward rotation, and the AC rotations (tilt, internal / external rotation) are solved each pose so that the trigonum spinae and inferior angle keep their rest distance to the ribs, the rest of the costal surface stays ≥ 5 mm off the ribs, the AC joint space stays 0.5–3 mm, and joints turn as little as possible. Large inputs are approached in steps from rest; the right side is solved as the mirror of the left, so symmetric inputs give exactly mirrored shoulders.
- **Limits:** upward rotation without arms: 26° (cadaveric isolated shrug, JSES Int 2023), controls 85 % (22°); the 43–50° reached with full arm elevation (Ludewig 2010, McClure 2001) is stored for the arm stage. Downward rotation 10° and the AC range 25° are approximations, marked in `src/spine-rom.js`. No scapulohumeral rhythm is imposed. Combined shoulder inputs share one envelope per side.
- **Change to clavicle behaviour:** the clavicle's axial (posterior) rotation is now solved by the girdle instead of being a separate control; the clavicle's shape, rest position, elevation and protraction controls and limits are unchanged.

| Command | Output |
|---|---|
| `node tools/shoulder-check.js [--json out.json]` | scapula IDs, AC connection, rib-cage clearance, gliding contact, symmetry, proportions, limits, neutral restoration, in every spinal and shoulder demonstration and in combined poses |

## Pelvis and hyoid

Added around the approved sacrum and coccyx (unchanged) and the approved hip axis and posture (pelvic incidence ≈ 53°, sacral slope 41°, pelvic tilt 12°).

- **Hip bones:** `HIP_L`, `HIP_R`, mirror images, each the fused ilium, ischium and pubis: iliac crest with tubercle, ASIS and AIIS, iliac fossa, gluteal surface, auricular surface and iliac tuberosity, PSIS and PIIS, greater sciatic notch, arcuate line (pelvic brim), acetabulum (lunate surface, fossa, notch, rim), superior and inferior pubic rami, pubic body and tubercle, obturator foramen (open), ischial body, spine, tuberosity and ramus. Hover names each region. The local frame of each bone has its origin at the acetabulum centre, the future hip joint.
- **Measured on the built surfaces** (`tools/pelvis-check.js`; female references, scaled for 183 cm where stature matters): inlet transverse 129 mm (127–135), obstetric conjugate 118 mm (115–127), interspinous 108 mm (107–110), intertuberous 111 mm (111–118), subpubic angle 85° (85–95), symphysis height 42 mm, interpubic gap 4.4 mm (4–5), inter-ASIS 242 mm, intercristal 278 mm, crest summit at the L4–L5 interspace, hip bone height 226 mm (≈ 200 at 163 cm), hip joint centres 176 mm apart (Bell et al. 1990 regression), socket Ø 49 mm, acetabulum inclination 44° and anteversion 17°.
- **Joints:** the sacroiliac joints are a 2.5 mm joint space whose iliac side is carved from the sacrum's own surface, so the auricular surfaces stay congruent; the cartilage layer (`SIJ_L`, `SIJ_R`) sits between them. The pubic symphysis is a fibrocartilaginous disc (`PUBIC_SYMPHYSIS`) between flat symphyseal surfaces. Both joint elements use the disc / cartilage palette and sit halfway between the bones they join.
- **Rig:** the pelvis is the root. *Tilt*, *Hip hike* and *Turn* (pose.root, ±15°, ±10°, ±10°) rotate both hip bones and the sacrum together about the hip axis — one transform, applied once; the spine's own angles ride on top, so pelvic movement is never applied twice. Separate, much smaller relative movement at the pelvic joints: sacroiliac **nutation / counternutation** (sacrum, with the spine, against both hip bones about the transverse SI axis, ±2°; Sturesson 1989/2000) and **counter-rotation** of the hip bones (±0.5° each, single-leg-stance values; the symphysis shears ≤ 1.5 mm, Walheim & Selvik 1984). Inputs beyond these are clamped. Zero input returns the rest skeleton itself.
- **Demonstrations:** *Pelvic tilt forward* and *Pelvic tilt back*: the pelvis tilts 10° and the lumbar spine compensates by the same angle, so T12 and everything above stay upright (exact).
- **Attachment frames** (in every posed model and in `export-rig.js`): acetabulum centre and axis of each hip bone (future femurs), glenoid centre and normal of each scapula (future humeri), atlas top (future skull). No limb or skull geometry is built.
- **Hyoid:** `HYOID`, U-shaped body with greater and lesser horns, at the level of C3 (the most common level in women), body ≈ 37 mm in front of C3. It has no bony joint; until the head and neck soft tissue exist it follows C3 as a stand-in.
- **Approximations for review:** obturator foramen 58 × 29 mm (a little narrow); sacroiliac contact ≈ 11 cm² per side, limited by the approved sacrum's lateral surface (adult auricular surfaces ≈ 12–18 cm²); the pelvic-joint axis is a fixed transverse axis (real SI motion is helical and small); the hyoid's position will be revisited with the mandible and neck.

| Command | Output |
|---|---|
| `node tools/pelvis-check.js [--json out.json]` | inventory of the trunk skeleton, hip-bone proportions, joint spaces, clearances, hyoid level, rig behaviour (root applied once, pelvic-joint limits, every demonstration, pelvic tilts, attachment frames, exact reset) |

## Pixel style

One model, every view: each bone is a signed distance field in millimetres, projected orthographically. Light is fixed to the
camera (top left). 4×4 supersampling, hard tone steps, 3×3 majority clusters (no lone pixels), 1 px outline, contour lines where
depth jumps more than 3 mm (never single dots), rim light on top edges, darkest tone kept for lines and cavities. Where two
thorax bones touch without a depth jump (clavicle on the manubrium, rib head on its vertebra) a joint line separates them.

| | outline | line | shade | mid | light | highlight |
|---|---|---|---|---|---|---|
| Bone | `#2b211b` | `#5c4a3b` | `#8e7860` | `#bca98a` | `#e0d4b8` | `#faf4e3` |
| Disc, costal and joint cartilage | (bone) | `#4b5157` | `#7b878a` | `#a7b2b0` | `#cdd6d1` | `#eef3ee` |

## Code

| Path | What it is |
|---|---|
| `src/spine-core.js` | anatomy data, assembly (rig) and the shapes of every element |
| `src/spine-rom.js` | movement limits, distribution, coupling and references (one place to review and adjust) |
| `src/spine-rig.js` | the rig: pose → segment angles → rigid vertebrae and deforming discs |
| `src/thorax-core.js` | ribs, costal cartilages, sternum and clavicles: data, placement on the spine, shapes |
| `src/shoulder-core.js` | both scapulae: reference data, shape, placement on the clavicle and rib cage, gliding surface |
| `src/pelvis-core.js` | both hip bones, sacroiliac joints, pubic symphysis and hyoid: reference data, shapes, placement on the sacrum, pelvic-joint ranges |
| `src/thorax-rig.js` | the full skeleton rig: rib-cage response to spinal poses, shoulder girdle solver, pelvis root and pelvic joints, attachment frames, demonstrations |
| `src/spine-render.js` | ray caster and the pixel-art pass |
| `src/measure.js` | landmark measurements from the model |
| `app/` | the lab's page (`shell.html`) and interface (`app.js`) |
| `index.html` | built from `src/` and `app/` by `node tools/build.js` |

| Command (Node, no dependencies) | Output |
|---|---|
| `node tools/build.js` | rebuilds `index.html` |
| `node tools/render-views.js out 4` | the eight spine views as transparent PNGs in `out/` |
| `node tools/validate.js out` | validation report: counts, curves, balance, lengths, contacts, view consistency |
| `node tools/export-rig.js out/spine-rig.json` | element frames, motion segments, pivots, limits, coupling, demo poses, the thorax, shoulder girdle and pelvis (frames, joints, attachments, limits, attachment frames for the future limbs and skull) |

## Credits

The "pixelfx bone" palette preset uses the bone ramp from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, © 2026 Patch, © 2026 Hugo Duprez).
