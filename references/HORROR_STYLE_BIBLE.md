# Horror Style Bible v3 ("3D Stylized Dark-Horror POV")

Reference visual standard calibrated for **Horror Engine v3** (`templates/engine/`), derived from high-retention 3D POV horror storytelling and pushed away from cute chibi proportions into **chilling, atmospheric dark horror**. Live-verified on `HorrorLabV3Vertical` (`1080×1920`) and `HorrorLabV3Wide` (`1920×1080`) across 3 radically distinct environments (`ruralFuneralRoom`, `hospitalCorridor`, `foggyVillageAlley`).

Verified full-HD benchmark stills live in `references/stills/`:
- `v3_B1_funeral_talk.jpg` — Rural thatched A-frame funeral vigil room, non-chibi 3D NPC, warm practical oil-lamp + altar candle light.
- `v3_whip_blur_f55.jpg` — Deterministic 7-frame GPU directional Whip-Pan Motion Blur sweeping past altar, coffin, and oil lamp.
- `v3_B2_whip_phone.jpg` — 1st-person POV hand gripping glowing `Phone3D` (`01:06`) synced with upper-third narrative notification card.
- `v3_B3_door_shadow.jpg` — Smooth `warmLamp → coldMoon` lights-out reveal of bolted double door crack blocked by 2 dark foot shadows.
- `v3_B4_entity_loom.jpg` — Tall gaunt crooked-neck silhouette entity looming at doorway with organic draped hair & HDR pinpoint eye glow.
- `v3_B5_hospital_corridor.jpg` — Ceramic-tiled institutional hospital corridor, flickering fluorescent tubes, floating dust motes, POV `Flashlight3D` SpotLight cone.
- `v3_B6_village_alley.jpg` — Wet asphalt foggy village alley, brick & concrete walls, corrugated tin eave, overhead power lines, warm sodium streetlamp pool.

---

## 1. Visual Identity ("3D Stylized Dark-Horror POV")

- **100% Real 3D Articulated Characters — ZERO 2D Billboards, ZERO Cute Chibi (`rig3d.ts`, `face2d.ts`):**
  - Legacy v2 2D Canvas billboard rigs (`toon.ts`, `cast.ts`, `cardshade.ts`), `Pen.grit` ink wobble, messy cross-hatching, and cute round chibi heads are permanently retired.
  - Human characters use **non-chibi adult horror proportions (`~5.6–6.0` head heights)** with sculpted angular jaws, 3D nose bridges, ears, sloping shoulder yokes, 3D garment collars/belts, clean UV garment folds, and 20 named articulation sockets.
  - Curved spherical-patch 512×512 2D face decals (`face2d.ts`) draw clean-line **sharp almond eyes, contracted pinpoint horror pupils, soft gradient under-eye hollows, furrowed brows, and restrained tense mouths** (`calm`, `wary`, `uneasy`, `dread`, `terrified`, `deadStare`, `unsettlingSmile`, `hollow`).
  - Supernatural entities layer `EntityConfig` modifiers onto the same 3D rig: tall gaunt elongation (`heightScale: 1.14–1.25`, `gauntness: 0.70–0.82`), unnaturally long arms/fingers (`armScale`, `fingerScale`), crooked neck tilts (`neckTiltDeg: ±20°..38°`), asymmetric shoulder skew, organic draped dark hair curtains, pitch-charcoal `silhouetteMode`, dead stillness (`breathing: false`), stepped `steppedFps`, and HDR emissive pinpoint `eyeGlow`.
- **Clean Bold Dual-Layer Outlines — ZERO Double-Outlines, ZERO Split Corners (`outline3d.ts`, `ink.ts`):**
  - **Characters, Entities & POV Props (Layer 3 / `NOINK`):** Smooth angle-weighted vertex normals (`computeSmoothNormals`) extruded along a view-distance-clamped BackSide Inverted-Hull shader (`~5–7 px` at 1080p, clamped in world units). Every actor mesh lives strictly on `NOINK` so architectural edge detection never double-outlines characters.
  - **Architecture & Environments (Layer 0):** Crisp screen-space depth/normal `InkPass` renders clean dark structural linework on walls, door frames, rafters, tiles, and furniture without jitter or grit artifacts.
- **1st-Person POV Immersion & Diegetic 3D Props (`povRig.ts`):**
  - Anchor the viewer inside the protagonist's body with `createPovRig3D` (visible seated knees or standing legs when looking down + camera-aligned forearms/hands sloping naturally from below the frame).
  - Use physical 3D interactive props: `Phone3D` (live Canvas2D lockscreen with HDR Bloom + real local `PointLight` illuminating gripping fingers), `Flashlight3D` (real GPU `SpotLight` beam + soft volumetric cone), `HandheldOilLamp3D`, and `PaperProp3D`.
- **Soft Stylized Shading + Practical Lights + HDR Bloom (`shade.ts`, `lights.ts`, `ShortPlayer.tsx`):**
  - Replaced harsh binary 2-tone cel cuts with smooth wrapped shading (`stylizedShade`) receiving **up to 6 real local `PointLight`s + 1 `SpotLight` + real soft directional shadows (`shadows="soft"`) + real 3D lightning**.
  - Selective HDR Bloom (`luminanceThreshold: 0.92`, `NEUTRAL` tone mapping) gives warm amber halos to glass oil lamps, candles, sodium streetlamps, fluorescent tubes, door-crack moonlight, and smartphone screens.
  - Clean subtle film finish: deterministic micro-grain `grainAmount={0.008}`, soft framing vignette, optional light chromatic aberration (`<= 0.12` base or subtle dread pulse). **ZERO `gradeGrime` vintage scratches and ZERO fake crimson `blood` screen washes.**
- **Story-Driven Non-Repeating 3D Environments (`build.ts`, `paint.ts`):**
  - Every location is built from a unique `LocationBlueprint` using neutral modular architecture kits (`addWallWithOpening`, `addAFrameRoof`, `addDoubleDoorWithCracks`, `addCorridorBay`, `addStairFlight`) and 16 clean painterly textures across 4 surface families.
  - **Zero cross-video or cross-part background repetition** — unrelated videos or unrelated video parts must never reuse an existing environment.

---

## 2. Dark-Screen Readability Targets (Phone @ 50% Brightness)

Calibrated against reference POV horror footage and live-verified on `HorrorLabV3Vertical` (`short_qa.py`):

| Scene Type | Target Luma `mean` | Target `p2` (shadow floor) | Target `p98` (practical highlight) | Measured `HorrorLabV3` Proof |
|---|---|---|---|---|
| Warm practical interior (`warmLamp`) | `0.14 – 0.30` | `0.020 – 0.040` | `0.65 – 0.97` | `mean 0.152–0.280`, `p98 0.729–0.965` |
| Lights-out moonlight (`coldMoon`) | `0.070 – 0.120` | `0.020 – 0.038` | `0.36 – 0.58` | `mean 0.078–0.091`, `p98 0.456–0.525` |
| Institutional hall (`fluorescent` + `flashlight`) | `0.15 – 0.24` | `0.030 – 0.050` | `0.48 – 0.75` | `mean 0.209`, `p98 0.538` |
| Foggy exterior night (`duskFog`) | `0.11 – 0.18` | `0.028 – 0.050` | `0.36 – 0.65` | `mean 0.137`, `p98 0.392` |

- `short_qa.py` enforces dark readability floors (`p98 >= 0.34`, `mean >= 0.065`) so deliberate lights-out scenes stay haunting yet legible on mobile screens.
- Keep `grainAmount={0.008}` to suppress 8-bit H.264 dark-gradient banding cleanly without dirtying the stylized art.

---

## 3. Orientation & Framing Grammar (`9:16` vs `16:9`)

All post-processing (`InkPass`, `LensBlur`, `WhipMotionBlurEffect`, `Bloom`, `GrainEffect`) and `outline3d.ts` screen-space hull widths scale automatically invariant to aspect ratio (`1080×1920` vs `1920×1080`).

| Aspect | Framing Strength | Mandatory Staging Practices |
|---|---|---|
| **`9:16` Vertical (`1080×1920`)** | 1st-person POV immersion, exposed A-frame ceilings, looming tall doorways, tight corridor tunnels, close `Phone3D` reads | Frame architectural depth within `±16–20°` horizontal FOV (e.g., narrow alleys `~4.0–4.4m`, corridors `~2.8m`, practical lamps/altars inside visible thirds). Reserve top `10–24%` for optional header/notification HUD and lower `18–26%` for optional speaker pill + subtitle. |
| **`16:9` Wide (`1920×1080`)** | Unsettling negative space, lateral peripheral threats, wide interior geography | Stage NPCs or POV props off-center so doorways, dark hallways, or shadow strips occupy the opposite third. |

---

## 4. Mandatory Cinematography, Whip-Pan & Transition Grammar

- **POV & Cinematic Shot Scales:** Label every shot with its exact `ShotScale`: `POV`, `POV_PROP`, `POV_TURN`, `POV_DOWN`, `POV_CU`, `WS`, `MS`, `OTS`, `MCU`, `CU`, `ECU`, `LOW`.
- **No-Repeat-Angle Rule:** Never hold a static identical vantage across consecutive cuts unless executing an explicit POV reaction (`POV` → `POV_TURN`/`POV_PROP` → `POV_DOWN` → `POV_CU`). Never perform filter-swap jump-cuts on a frozen framing.
- **Deterministic Whip-Pan Motion Blur (`whipPan` + `WhipMotionBlurEffect`):**
  - Use `whipPan(eyePos, { f0, dur: 6..8, fromLook, toLook, rollPeak }, frame, fov)` for visceral 1st-person head-snap turns (e.g., snapping from an NPC to a ringing phone or dark doorway).
  - Declare every Whip-Pan in `WHIP_PANS` and fast close-to-lens POV prop raises in `POV_MOTIONS` inside `story.ts` so `extract_shots.py` registers them as planned motion for `short_qa.py`.
- **Natural Living Motion:** Apply subtle `povBreath` camera breathing (`0.008–0.014`), natural character poses (`setPose`) and gaze tracking (`lookAtWorld`) for humans, contrasted against `breathing: false` stillness and rare 2-frame `uncannyTwitch` snaps on entities.
- **Purposeful Transitions & Opt-In HUD:**
  - Use `{ kind: "dipBlack", at, dur: 8..12, hold: 1..2 }` across location or time jumps, `{ kind: "blackout", a, b }` for `[DEAD SILENCE]` beats, and `getLightBlend` for smooth in-shot lamp-death shifts (`warmLamp → coldMoon`).
  - `HorrorHUD` (`header`, `notifications`, `captions`, `timeSkips`, `choiceCard`) is **opt-in** and driven directly from `hudFromManifest(MANIFEST)` so on-screen text, clock timestamps, and 3D props never drift out of sync.
