# Horror Engine v3 Graphics Overhaul — Design Specification

**Date:** 2026-11-24
**Scope:** Phase 1 of the `tool-horror-3d-short` skill suite overhaul — **Graphics, 3D Rendering Pipeline, Character & POV Rigging, Anti-Repetition Environments, and Look-Dev/QA Skills**.
*(Phase 2 — story architecture `horror-story`, POV dialogue scriptwriting `horror-script-storyboard`, and multi-voice/audio `horror-audio-sfx` — will be designed separately once Phase 1 graphics are built and visually verified.)*

---

## 1. Intent & The Why

The current v2 skill suite (`Gothic Ink-Noir × Shadow-Depth`) suffers from two severe graphics failures observed across rendered projects (`mada`, `ma-xo`, `ong-ke`):

1. **Severe cross-video background repetition:** `mada/build.ts`, `ma-xo/build.ts`, and `ong-ke/build.ts` all reuse the exact same rectangular wooden box room (`[-4..4] × 3.5m`) with identical 4 pillars, 5 ceiling rafters, back-left 3-bar window, right table + `addStormLantern3D`, bolted `doorCrossbar`, and outside `addGnarledTree` + `addReedCluster`. This happens because v2 skill docs mandate those exact 6 prop helpers on every story and provide no diverse architectural/material grammar.
2. **Art-style & technology mismatch:** v2 renders characters as **flat 2D Canvas billboards** (`toon.ts` + `cast.ts`) with jagged `Pen.grit` lines, heavy `cross-hatching`, rigid 4.8-head diamond torsos, solid black "sunglass" eye sockets, harsh 2-tone lighting, fake crimson `blood` screen washes, and fake `gradeGrime` film scratches. Flat billboards cannot rotate smoothly in 3D, cannot be viewed from steep above/below angles, and cannot render 1st-person POV legs/hands interacting with 3D objects.

**Target Reference & Creative Direction:**
Forensic analysis of the user's reference video (`videomau` — *"Đếm người canh linh cữu — Phần 2"*, 576×1024, 30 fps) revealed its visual formula:
- **100% real 3D stylized characters & environments** with **clean bold black outlines** (Inverted-Hull + architectural edges), **soft stylized lighting**, real local practical lights, **strong HDR Bloom**, and story-specific architectural spaces with painterly textures.
- **Immersive 1st-person POV camera** (showing the viewer's own 3D knees, shoes, arms, and hands gripping diegetic 3D props like a glowing smartphone), moving across the room via **6–8 frame Whip-Pan head turns with directional Motion Blur**, plus optional clean narrative HUD elements (speaker pill, keyword-highlighted subtitles, synced phone notification cards, clock time-skip cards).
- **User's Creative Upgrade (Non-Chibi Dark Horror):** Keep the complete technical & cinematic DNA of `videomau`, **but eliminate the cute round big-eyed chibi aesthetic** and push character anatomy, facial expressions, supernatural entities, and real shadow/lighting contrast significantly harder into **chilling, unsettling psychological horror**.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **True 3D Stylized Dark-Horror Rig (`rig3d.ts` + `face2d.ts`):** Procedural Three.js articulated 3D humanoids & supernatural entities with realistic-slender horror proportions (`5.5–6.0` head-heights), clean sculpted faces/noses/hair/garments, smooth 3D pose animation, and high-res clean-line animated 2D face decals.
2. **1st-Person POV Body & Diegetic Prop Rig (`povRig.ts`):** Visible 3D lower body when pitching downward + articulated dual 3D arms/hands holding glowing 3D smartphones (with live Canvas2D screens), flashlights (real SpotLight cones), handheld oil lamps, or paper notes/talismans.
3. **Clean Bold Ink + Soft Stylized Lighting + HDR Bloom (`outline3d.ts`, `ink.ts`, `shade.ts`, `lights.ts`, `grade.ts`):**
   - Smooth-normal Inverted-Hull outlines on 3D characters and hero curved props + tuned clean screen-space `InkPass` on architecture (with strict layer separation so nothing gets double-outlined).
   - Soft stylized cel/Lambert shading with real soft shadow maps, up to **6 local PointLights + 1 SpotLight**, rich HDR Bloom on flames/screens/eyes, and **physical story-driven lighting presets** (warm lamp → cold moonlight when lights die, flickering hospital fluorescent, dusk fog, pitch-dark flashlight).
4. **Deterministic Whip-Pan Directional Motion Blur (`motionblur.ts` + `camera.ts`):** Pure frame-deterministic GPU velocity blur driven by `cam(frame) - cam(frame - 1)` so fast 6–8 frame head-turns streak smoothly like `videomau` while remaining 100% compatible with Remotion's parallel out-of-order frame rendering.
5. **Anti-Repetition World Architecture System (`build.ts` + `paint.ts` + `horror-world-lookdev`):** Diverse neutral architectural primitives + 15+ clean painterly procedural textures + mandatory per-story `LocationBlueprint` gate banning recycled box-room shells.
6. **Optional Modular POV Narrative HUD (`HorrorHUD.tsx`):** Clean opt-in React overlay layer inside `ShortPlayer` for timestamps, speaker pills + keyword subtitles, synced phone notifications, time-skip clock cards, and interactive choice endings.
7. **Script-to-Frame Consistency Architecture (`manifest.ts` + `validate_manifest.py` + Beat-by-Beat Still Fidelity Gate):** A single-source-of-truth declarative `SceneManifest` / `ScriptBeat[]` contract that drives `world.ts`, character poses, prop states, practical lights, and `HorrorHUD` captions from the exact same beat timeline, paired with an automated pre-render validator and mandatory Beat-by-Beat Script↔Frame visual audit before final render.
8. **Look-Dev Visual Proof (`templates/horror-lab-v3/`):** A multi-archetype verification composition rendering **3 completely distinct horror sets** (rural thatched funeral room, dim tiled hospital/apartment corridor, foggy rural alley/road) driven by a real `SceneManifest`, with 3D horror characters, an unsettling entity, POV phone/flashlight hands, light-off transition, and Whip-Pan blur—verified directly via rendered stills before proceeding to Phase 2.
9. **Updated Graphics Skills, References & QA Scripts:** Overhaul `SKILL.md`, `horror-world-lookdev/SKILL.md`, `HORROR_STYLE_BIBLE.md`, `LIGHTING_AND_PALETTE.md`, `READABILITY_AND_QA.md`, `GEMINI.md`, `extract_shots.py`, `validate_manifest.py`, and `short_qa.py`.

### Non-Goals (Deferred to Phase 2)
- Rewriting `horror-story`, `horror-script-storyboard`, `horror-series-pipeline`, or `horror-audio-sfx`.
- External 3D software (Blender) or bundled binary `.glb` model packs.
- Photorealistic PBR skin shaders or AAA muscle sculpting.

### Anti-Goals (Unacceptable Failure Modes)
- Cute/chibi proportions (giant round eyes, bulbous spherical noses, stubby 3-head bodies).
- Reverting to messy v2 aesthetics (`Pen.grit` wobble, `cross-hatching` grids, solid-black sunglass eye holes, flat 2D billboard characters, fake crimson `blood` tint washes, fake `gradeGrime` film scratches).
- Two unrelated videos sharing the same room shell or default prop layout.
- Double-outlined characters (Inverted-Hull + `InkPass` colliding) or z-fighting flicker on doors/fingers.
- Unreadable crushed black frames (`p5 < 0.02`, `p95 < 0.30`) or dead-frozen static holds.
- **Script-to-Frame drift:** Rendered frames contradicting the planned script/storyboard (e.g., lamp still lit after script says lights go out, wrong clock/message on `Phone3D`, missing or misplaced character/prop, or actions mistimed from narration/dialogue).

---

## 3. Technical Constraints

- **Runtime & Hardware:** Node v22+, Three.js `0.170.0`, `@react-three/fiber` `^9.7`, `postprocessing` `^6.36`, Remotion `^4.0.545`, tested on Linux (NVIDIA GTX 960M 4GB VRAM) with cross-platform Linux/macOS/Windows WebGL support (`swangle` / `angle`).
- **Resolution & Scaling:** `9:16` (`1080×1920`, primary) and `16:9` (`1920×1080`), integer-clean `--scale` (`1`, `1.25`, `1.5`). All pixel-sized post effects scale by `Math.min(width, height) / 1080`.
- **Remotion Parallel Determinism:** Every frame render MUST be a pure function of `frame` (no `Math.random()`, no mutable frame-to-frame velocity cache).
- **Strict Engine Neutrality (`GEMINI.md`):** `src/engine/` contains ONLY neutral reusable primitives, shaders, rigs, textures, and HUD widgets—zero story-specific characters, rooms, or scripts.

---

## 4. Approaches Considered & Selected

| Approach | Summary | Trade-offs | Decision |
|---|---|---|---|
| **A. Pure Code Procedural 3D Engine v3 (`Three.js + Remotion`)** | Replace 2D billboards with procedural articulated 3D rigged meshes + smooth-normal Inverted-Hull outlines + soft stylized shaders + deterministic GPU Whip-Pan motion blur + modular architectural kits & painterly textures. | 100% programmatic for autonomous AI agents, lightweight repo, fast WebGL preview/stills on GTX 960M. Stylized comic-horror 3D anatomy rather than AAA sculpts. | **SELECTED** (approved by user) |
| **B. Hybrid `Three.js` + Bundled `.glb` Rigged Models** | Keep Three.js lighting/scenes, load external rigged `.glb` base characters. | Slightly smoother cloth folds, but bloats repo/Remotion temp bundles and limits AI code-driven monster distortion & custom outfits. | Rejected |
| **C. Switch to Blender Python (`bpy` + Eevee + Grease Pencil)** | Replace Three.js with headless Blender renders. | Native 3D modeling & motion blur, but Blender is not installed, GTX 960M struggles with modern Eevee Next, breaks Remotion live workflow, slows agent loops. | Rejected |

---

## 5. Detailed Graphics & Engine Architecture (v3)

### 5.1 Module Layout (`templates/engine/`)

Clean break from v2 2D billboards: remove `toon.ts`, `cast.ts`, and `cardshade.ts` from `templates/engine/` so future agents cannot accidentally generate flat 2D stick-card characters. *(Builder call: archive/remove stale v2 templates `mada`, `ma-xo`, `ong-ke` only if they break `tsc` in `shorts-project`, or keep them cleanly outside v3 `Root.tsx` while introducing `templates/horror-lab-v3/` as the canonical v3 template — see Section 6.)*

```
templates/engine/
  index.ts          # Barrel exports
  camera.ts         # 30fps timeline, POV breathing, whipPan, cam archetypes, deterministic velocity
  lights.ts         # 5 physical horror lighting presets + smooth preset blending + LocalLight/SpotLight types
  shade.ts          # Soft stylized cel/Lambert shader + up to 6 PointLights + 1 SpotLight + real shadows + flash
  outline3d.ts      # Smooth-normal Inverted-Hull outline material & recursive mesh helper
  ink.ts            # Clean architectural screen-space InkPass (layer 0 only; actors/FX on NOINK)
  motionblur.ts     # Deterministic GPU Whip-Pan directional motion blur Effect
  lensblur.ts       # Thin-lens DOF + minimal anti-banding GrainEffect
  grade.ts          # Clean cinematic tone curve, subtle edge CA, soft vignette (NO gradeGrime scratches)
  paint.ts          # 15+ clean painterly procedural Canvas2D textures (seamless, non-plastic)
  build.ts          # Neutral modular architectural & hero-prop 3D builders + Batch + Strand
  face2d.ts         # 512x512 clean-line dark-horror Canvas2D animated face generator & cache
  rig3d.ts          # Articulated 3D stylized dark-horror humanoid & uncanny entity builder + pose solver
  povRig.ts         # 1st-person POV 3D lower-body + dual arms/hands + diegetic 3D props (phone/flashlight/lamp/note)
  fx3d.ts           # 3D atmospheric FX: rising incense smoke wisps, dust motes, volumetric shafts, flat decals, rain
  manifest.ts       # Single-source-of-truth SceneManifest / ScriptBeat[] types & beat/state evaluators
  HorrorHUD.tsx     # Opt-in Remotion narrative HUD (header, speaker pills, subtitles, phone popup, time-skip, choice)
  ShortPlayer.tsx   # Unified R3F + EffectComposer + WhipMotionBlur + HorrorHUD player
```

---

### 5.2 3D Stylized Dark-Horror Characters (`rig3d.ts` + `face2d.ts`)

#### Anatomy & Non-Chibi Proportions
- **Adult Human (`~1.72m` tall, `5.6` head-heights):**
  - **Head (`0.20m W × 0.26m H × 0.22m D`):** Sculpted via deformed `LatheGeometry`/sphere with narrower angular jaw, subtle cheekbones, distinct cranium, and recessed brow overhang (NO round chibi balls).
  - **3D Sculpted Nose & Ears:** Narrow tapered 3D nose bridge/ridge protruding cleanly from the face (catching real under-lighting shadows!) + thin curved 3D ear shells.
  - **3D Hair System:** Procedural layered hair shells + tapered 3D locks/bangs/spiky tufts/buns/long draped curtains (`hairStyle`: `"shortParted" | "spiky" | "elderThin" | "bun" | "longDraped" | "messyFringe"`).
  - **15-Bone Hierarchy:** `root → pelvis → spine → chest → neck → head`; `chest → L/R shoulder → upperArm → forearm → hand (palm + thumb + 4 finger capsules)`; `pelvis → L/R thigh → calf → foot`. Limbs use smooth tapered capsules/lathes with subtle joint blending so sleeves, collars, wrists, and ankles read cleanly from every 3D angle (front, 3/4, back, top-down).
  - **Garments & UV Detail:** Clean 3D torso/sleeve/trouser/robe shells with subtle UV-painted fabric folds, lapel lines, buttons, cuff stitches, or funeral headband (`khăn tang`), plus custom project attachment hooks on `head`, `chest`, `leftHand`, `rightHand`, `back`.

#### Clean-Line Uncanny Face System (`face2d.ts`)
- Rendered to a cached `512×512` `CanvasTexture` mapped onto a curved spherical-patch mesh sitting `+0.003m` flush on the front face (`NOINK` layer, receives scene lighting via `stylizedShade` with `alphaTest: 0.05` transparent blend so the face catches warm lantern/phone light naturally!).
- **Horror Face Styling (Zero Chibi, Zero Grit):**
  - Realistic narrower almond eyes (`~0.24` head-width each, NOT huge Doraemon circles).
  - **Dynamic Pupil Contraction (`pupilScale: 0.28..0.95`):** Tiny contracted pinpoint pupils for terror, shock, or uncanny entity stares; normal iris for calm dialogue.
  - **Soft Shaded Under-Eye Hollows & Brow Furrows:** Soft semi-transparent cool-plum gradient shading beneath eyes and upper lids—creating exhaustion and dread WITHOUT solid black sunglass patches.
  - **Clean Bold Ink Brows & Eyelids:** Smooth variable-weight Bézier curves, deterministic blinks (`lid: 0..1`), half-lidded exhaustion/suspicion, smooth gaze tracking `(gazeX, gazeY)`.
  - **Subtle Mouth Rig:** `closed`, `parted`, `talkA`, `talkO`, `talkE`, `tense`, `gasp`, `unsettlingSmile`, `jawSlack`.

#### Supernatural Entity Modifiers (`EntityConfig`)
- Built on the same `rig3d.ts` skeleton with eerie anatomical overrides:
  - `heightScale` (`1.08–1.25`), `gauntness` (`0.72–0.85` narrower waist/limbs), `armScale` (`1.15–1.30` unnaturally long arms), `fingerScale` (`1.35` long thin fingers), `neckTiltDeg` (`±20–38°` crooked head snap), `shoulderSkew` (`±0.12 rad`), `hairCurtain` (long dark 3D strands draping over half the face with subtle wind sway), `silhouetteMode` (near-black figure with HDR emissive pinpoint eyes `[2.4, 2.5, 2.8]`), `breathing: false` (uncanny stillness contrasting with living characters' chest rise), and optional `twitch(frame)` micro neck-snaps.

#### Built-in 3D Pose & Action Library
- Continuous pure-function pose solver `(t, action, params) => BoneRotations`:
  - `sitCrossLegged`, `sitChair`, `standIdle`, `walk`, `creep`, `turnHead`, `peerForward`, `recoil`, `point`, `holdPhone`, `holdLantern`, `lunge`, `loomingStill`, `peekAroundDoor`.

---

### 5.3 1st-Person POV Rig & Diegetic 3D Props (`povRig.ts`)

- **POV Lower Body:** Positioned at protagonist's floor/seat anchor so pitching the camera downward reveals natural 3D knees, trousers/robe hem, and shoes/feet (supporting `seated` and `standing` modes).
- **POV Dual Arms & Hands:** Attached relative to camera yaw/position with subtle breathing inertia so raising a prop brings articulated 3D forearms, wrists, palms, and slender fingers naturally into the lower/mid frame.
- **Diegetic 3D Props (all pure Three.js + Canvas2D dynamic textures):**
  1. **`Phone3D`:** Beveled smartphone mesh + `NOINK` HDR-emissive `CanvasTexture` lockscreen (live time, date, carrier, battery %, 1–2 message preview cards) + automatic attached cool-white `PointLight` illuminating the protagonist's gripping fingers and nearby floor/wall with HDR Bloom.
  2. **`Flashlight3D`:** Cylindrical metal torch + HDR lens disc + synchronized real `SpotLight` cone + subtle volumetric cone mesh.
  3. **`HandheldOilLamp3D`:** Portable glass-chimney oil lamp + flickering flame core + warm local `PointLight`.
  4. **`PaperProp3D`:** Held note, old photograph, or talisman rendered via custom `CanvasTexture`.

---

### 5.4 Hybrid Outline & Soft Stylized Shading Pipeline (`outline3d.ts`, `ink.ts`, `shade.ts`, `lights.ts`, `grade.ts`)

#### Clean Dual-Layer Outline Strategy (Zero Double-Outlines)
1. **Characters & Curved Hero Props → Smooth-Normal Inverted-Hull (`outline3d.ts`):**
   - Custom `ShaderMaterial` (`side: THREE.BackSide`, `depthWrite: true`, `color: #06060a`).
   - Vertex shader extrudes vertices along **precomputed smooth averaged vertex normals** (eliminates gaps at hard edges) using view-space distance clamping:
     `extrudeWorld = clamp(dist * kFov * pxWidth, minWorld, maxWorld)`
     so outline thickness measures a clean **~5–7 px at 1080p** (matching `videomau`'s ~3.5–4.5 px at 576p) across close-ups (`0.4m` POV hand) and mid-shots (`2–6m` characters) without ballooning or disappearing.
   - All inverted-hull actors and props live on the `NOINK` layer so `InkPass` never draws a second pass on top of them.
2. **Architecture & Static Furniture → Tuned Clean `InkPass` (`ink.ts`):**
   - Operates strictly on layer 0 (walls, rafters, doors, tables, corridors, stairs, exterior landmarks).
   - Parameters calibrated for clean comic lines: `color: "#06060b"`, `widthNear: 4.6`, `widthFar: 2.2`, `angleLo: 42`, `angleHi: 58`, `concaveGain: 0.58`, `depthLo: 0.012`.

#### Soft Stylized Shading & Real Lighting (`shade.ts` + `lights.ts`)
- Replace harsh v2 two-tone hard cutoff with **`stylizedShade`** (injected via `onBeforeCompile` on `MeshLambertMaterial` / `MeshPhongMaterial`):
  - **Soft Wrapped Toon Ramp:** `smoothstep(-0.18, 0.72, ndl)` blends smoothly from deep cool-tinted shadow (`uShadeCol`) to lit albedo, preserving 3D volume curvature on faces, cloth, and wood while keeping stylized comic readability.
  - **Real Soft Shadows:** Three.js `PCFSoftShadowMap` enabled for directional moonlight/key light AND optional 1 primary shadow-casting `SpotLight` or `PointLight` (e.g., flashlight shadows or door-crack shadow figures!).
  - **Up to 6 Real Local PointLights + 1 Real SpotLight (`setLocalLights` / `setSpotLight`):** Smooth quadratic attenuation (`pow(clamp(1.0 - d/r, 0.0, 1.0), 1.85)`) with colored radiance > 1.0 for realistic oil-lamp warmth, candle pools, phone-screen finger glow, and flashlight cones.
  - **5 Grounded Physical Lighting Presets (`lights.ts`) + Smooth Blending (`lerpLights(a, b, t)`):**
    1. `warmLamp` — Practical amber oil-lamp/candle warmth (`#f0b878`) against deep velvet plum-indigo shadows (`#1e1722`), target luma `p5 ≈ 0.038, p50 ≈ 0.14–0.19, p95 ≈ 0.80–0.92`.
    2. `coldMoon` — Post-blackout / late-night desaturated moonlight slate-blue (`#191c26` → `#565c6e`), target luma `p5 ≈ 0.035, p50 ≈ 0.085–0.12, p95 ≈ 0.38–0.50`.
    3. `fluorescent` — Cold green-white institutional corridor/hospital light (`#c8e2d8` / `#162022`) with deterministic ballast flicker.
    4. `duskFog` — Exterior misty night streetlamp / village alley (`#283448` fog + warm amber sodium-vapor pools).
    5. `flashlight` — Near-black cavernous ambient (`#0a0c12`) carved sharply by a bright warm-white `SpotLight` cone (`p95 >= 0.75`).
  - **Clean Post-Processing Chain (`ShortPlayer.tsx`):**
    `RenderPass (MSAA 4)` → `InkPass` → `LensBlur (light DOF when active)` → `WhipMotionBlurEffect` → `BloomEffect (thr 0.92, int 0.68, radius 0.72, levels 6)` → `ToneMapping (NEUTRAL)` → `GradeEffect (clean tone curve, subtle edge CA <= 0.12 base, soft vignette, ZERO scratches)` → `GrainEffect (subtle 0.008 anti-banding default)` → `<HorrorHUD />` React DOM overlay.

---

### 5.5 Deterministic Whip-Pan Motion Blur (`motionblur.ts` + `camera.ts`)

- **Why deterministic:** Remotion renders frames out-of-order across parallel Chromium tabs, so stateful frame-history buffers break.
- **How it works:**
  1. `camera.ts` exports `whipPan(fromLook, toLook, f0, dur = 7)` (fast ease-in-out 6–8 frame head turn) and `povBreath(cam, f, amp = 0.014, freq = 0.14)`.
  2. Each frame in `ShortPlayer`, `ShortWorld.update()` (or a helper `evalCamVelocity(evalAtFrame, frame)`) evaluates the camera at `frame` and `frame - 1` (clamping `frame - 1` to `shot.a` at hard cuts so cuts never smear!).
  3. Computes angular delta `(Δyaw, Δpitch)` relative to the current camera basis and converts to normalized UV screen-space velocity `(vx, vy) = (-Δyaw / hFov, Δpitch / vFov) * shutterScale` (with `shutterScale ≈ 0.65`, clamped to `maxBlurPx = 42` scaled by `min(w, h) / 1080`).
  4. `WhipMotionBlurEffect` skips completely (pass-through, 0 blur) when `length(vPx) < 2.5px` (normal breathing/slow pans stay tack-sharp), and performs a clean 13-tap Gaussian-weighted directional gather along `(vx, vy)` during fast Whip-Pans!

---

### 5.6 Anti-Repetition Environment & Material Architecture (`paint.ts`, `build.ts`, `horror-world-lookdev`)

#### Expanded Clean Painterly Texture Library (`paint.ts`)
15+ tileable, hand-painted Canvas2D textures (zero muddy plastic, zero cartoon grass):
- **Roofs & Ceilings:** `thatchRoofTex` (layered brown-plum straw/palm strips like `videomau`), `tileRoofTex` (aged clay tiles), `concreteCeilingTex` (water-stained institutional plaster), `corrugatedTinTex` (rusted metal ribs).
- **Walls:** `mottledPlasterTex` (aged lime/earth wall with soft dark damp patches & fine cracks like `videomau`), `brickWallTex` (exposed weathered brick), `hospitalTileTex` (grimy pale green-white ceramic wall tiles), `paintedConcreteTex` (peeling corridor paint with wainscoting band), `darkTimberWallTex` (aged vertical boards).
- **Floors & Ground:** `terracottaFloorTex`, `vintagePatternTileTex` (Vietnamese colonial `gạch bông`), `reedMatTex` (`chiếu cói` fine woven ribs + red woven border), `wetAsphaltTex`, `packedEarthTex`, `woodenFloorTex`.

#### Modular Neutral Architectural Primitives (`build.ts`)
Strictly neutral composable components (NEVER a pre-built themed room):
- `addWallWithOpening(b, mat, ...)` — clean wall segments around arbitrary doorway/window cutouts.
- `addAFrameRoof(b, trussMat, roofMat, ...)` — exposed timber A-frame trusses + pitched interior underside (thatch, tile, or tin).
- `addDoubleDoorWithCracks(parent, ...)` — hinged double door with explicit center/bottom light-crack slit, optional horizontal bolt bar, **floor moonlight trapezoid projection**, and **dynamic blocker shadows** (e.g., 2 feet shadows cutting across the moonlight strip under the door!).
- `addCorridorBay(b, ...)` — modular apartment/hospital hallway segment (baseboard, molding, recessed door alcoves, ceiling conduit).
- `addStairFlight(b, ...)` — modular concrete/wood steps + metal/wood railing.
- `addGlassOilLamp3D(parent, ...)` — round oil reservoir + **translucent glass chimney** (`MeshPhysicalMaterial` / translucent lambert) + flickering HDR flame core.
- `addIncenseBurner3D(parent, ...)` — ceramic bowl + incense sticks + animated rising translucent smoke wisps (`fx3d.ts`).
- `addFluorescentTube3D`, `addStreetLamp3D`, `addSimpleTable`, `addWoodenBedFrame`.

#### Hard Anti-Repetition Skill Protocol (`horror-world-lookdev/SKILL.md`, `SKILL.md` & `validate_manifest.py`)
1. **Retire the v2 "6 forced props" rule AND legacy forced-reuse pressure:** `addGnarledTree`, `addReedCluster`, `addDistantRidge`, `addStormLantern3D`, `addVolumetricShaft`, and `addForegroundSilhouette` become purely optional exterior/atmosphere tools, NOT mandatory defaults. Reusing a set across different videos or unrelated video parts is **strictly forbidden** unless the script explicitly revisits the exact same physical location (`sameLocationOf`).
2. **Mandatory `LocationBlueprint` before coding `build.ts`:** Every location in every video/part must declare a unique structured blueprint:
   - `id`, `archetype` (chosen from 8+ distinct families: Rural Thatched House, Old Apartment/Dorm Corridor, Hospital/Morgue Wing, Foggy Village Alley/Road, Night Bus/Train Interior, Abandoned Classroom, Elevator/Parking Basement, Riverbank/Graveyard, or custom),
   - `dimensions` & `ceilingType` (`aFrameThatch`, `aFrameTile`, `flatConcrete`, `dropCeiling`, `vaulted`, `openSky`, `vehicleCabin`),
   - `materials` (`{ wall, floor, ceiling }` — distinct texture trio),
   - `practicalLights` (oil lamp, fluorescent tube, phone screen, flashlight, streetlamp, moonlight slit),
   - `heroProps` (`>= 3` story-unique hero props, e.g. coffin + portrait altar; gurney + IV stand; rusted lockers + chalkboard; bus seats + dashboard),
   - `signatureShadowBeat` (e.g., shadows blocking door-crack moonlight; flickering corridor tube revealing figure closer each blink; flashlight sweeping past an empty corner),
   - `sameLocationOf?: string` (ONLY allowed when a multi-part series or scene explicitly returns to the exact same narrative place—never across unrelated videos or unrelated story locations).
3. **Automated Cross-Video & Cross-Part Anti-Repetition Gate (`LOCATION_REGISTRY.json` + `validate_manifest.py`):**
   - `validate_manifest.py` scans sibling projects / `LOCATION_REGISTRY.json` and all locations declared across unrelated parts of a series.
   - Emits hard **`ANTI_REPEAT_ERROR`** if any two **unrelated** videos or **unrelated** parts (without explicit `sameLocationOf`) reuse the same `(archetype + ceilingType + wall/floor material trio)`, overlap `>= 60%` on `(archetype, materials, heroProps)`, or duplicate a sibling project's room shell dimensions + fixture layout.
4. **Art Director Still Gate Anti-Repetition Check:** Visually reject any `build.ts` still that resembles a previous unrelated video's room shell, window wall, or table/lantern staging.

---

### 5.7 Opt-In Modular POV Narrative HUD (`HorrorHUD.tsx`)

Rendered cleanly in Remotion DOM above `<ThreeCanvas>` (so motion blur and DOF never blur readable text):
- `header?: { title: string; subtitle?: string; badge?: string }` (top-left timestamp/location + top-right `"PHIM NGẮN HƯ CẤU"` pill).
- `captions?: Array<{ a: number; b: number; speaker?: string; speakerColor?: string; text: string; highlight?: string[] }>` (speaker pill + crisp bold white text with thick black stroke & yellow highlighted keywords).
- `notifications?: Array<{ a: number; b: number; sender: string; time: string; body: string; footer?: string }>` (clean rounded notification card in upper third, synced to `Phone3D`).
- `timeSkips?: Array<{ a: number; b: number; clockFrom: string; clockTo: string; label: string }>` (clean dark transition overlay with ticking digital clock, e.g., `00:44 → 00:57`, *"50 PHÚT SAU"*).
- `choiceCard?: { a: number; b: number; header: string; question: string; options: [string, string]; prompt?: string }` (optional interactive ending CTA).

---

### 5.8 Script-to-Frame Consistency Architecture (`manifest.ts` + `validate_manifest.py` + Beat-by-Beat Fidelity Gate)

To guarantee rendered 3D frames strictly match the approved story & script (eliminating silent drift between `SCRIPT.md`, `world.ts`, `cast`, lights, props, and captions), Engine v3 enforces a **3-layer Script-to-Frame Lock**:

1. **Single-Source-of-Truth `SceneManifest` (`templates/engine/manifest.ts`):**
   Every project defines a typed `MANIFEST: SceneManifest` in `story.ts` (and exports its JSON snapshot `manifest.json` alongside `shots.json`):
   - `locations`: Array of `LocationBlueprint` entries (`id`, `archetype`, `dimensions`, `materials`, `practicalLights`, `heroProps`, `signatureShadowBeat`).
   - `beats`: Contiguous array of `ScriptBeat` entries covering `0..TOTAL_FRAMES`, each declaring:
     - `beatId`, `shotId`, `a`, `b`, `peakFrame` (exact frame to verify during Still Gate).
     - `locationId` (must exist in `locations`).
     - `spokenLine?: { speaker?: string; speakerColor?: string; text: string; highlight?: string[] }` (directly feeds `HorrorHUD` captions—impossible for subtitles and script to diverge!).
     - `lightState: { preset: LightKey; blendTo?: LightKey; blendRange?: [number, number]; lampsOn: string[]; doorMoonlight?: boolean; feetShadow?: boolean }` (`world.ts` reads `evalBeat(MANIFEST, frame).lightState` directly to drive `setLocalLights`, emissives, and moonlight blockers!).
     - `castStates: Record<string, { visible: boolean; anchor: string; pose: PoseAction; expr?: FaceExpr; lookAt?: string | V3; eyeGlow?: boolean }>` (drives `rig3d.ts` directly!).
     - `propStates: Record<string, { visible: boolean; state: string; detail?: Record<string, string | number | boolean> }>` (e.g. `phone: { visible: true, state: "raised", detail: { clock: "01:06", notifSender: "Cô Lan" } }`—same `detail` drives BOTH the `Phone3D` Canvas2D texture AND the `HorrorHUD` notification card!).
     - `cameraIntent: string` (explicit human-readable expectation of what MUST be visible in frame at `peakFrame`).
   - Helper evaluators in `manifest.ts`: `beatAt(manifest, frame)`, `isLampLit(beat, lampId)`, `propStateOf(beat, propId)`, `hudFromManifest(manifest)` (automatically generates `HorrorHUD` captions & synced phone notification configs directly from `MANIFEST`!).

2. **Automated Pre-Render Consistency Validator (`templates/scripts/validate_manifest.py`):**
   - Validates `manifest.json` (exported via `extract_shots.py` or a small manifest dump step) against `SCRIPT.md` and `words.json` (when present):
     - Zero timeline gaps or overlaps across `0..TOTAL_FRAMES`.
     - Every `beat.locationId` exists in `locations`; every `locations` entry has unique non-empty `archetype` & `>= 3` `heroProps`.
     - Every `spokenLine.text` matches a line in `SCRIPT.md` and aligns with `words.json` start/end timestamps within `±0.35s`.
     - Every `propStates` phone `clock` / notification text matches its synced HUD notification entry.
     - Emits **`still_manifest.json`** containing the exact `peakFrame` + `cameraIntent` + expected `locationId` / `lightState` / `castStates` / `propStates` / `spokenLine` for 100% of beats.

3. **Script-Locked Beat-by-Beat Still Fidelity Gate (`render-stills.mjs` + `READABILITY_AND_QA.md`):**
   - `render-stills.mjs` adds support for `--manifest <still_manifest.json>` so one command renders every beat's `peakFrame` automatically.
   - During the mandatory Pre-Final Still Gate, the agent inspects every rendered still with `read_file` and fills an explicit **Beat-by-Beat Script↔Frame Audit** checking:
     - Location matches `locationId` & `LocationBlueprint`?
     - Lighting & practical lamps match `lightState` (`lampsOn`, `doorMoonlight`, `feetShadow`)?
     - Every visible character/entity matches `castStates` (position, pose, expression, gaze)?
     - Every hero prop matches `propStates` (e.g., door open/bolted, `Phone3D` time & text matching HUD popup)?
     - Framing fulfills `cameraIntent` cleanly?
   - **Hard Gate:** Any single mismatch = mandatory **REJECT & FIX** before final render. *(Phase 2 `horror-story` & `horror-script-storyboard` will output directly into this exact `SceneManifest` schema so Story → Script → 3D Frames share one unbroken chain.)*

---

### 5.9 Verification & Look-Dev Proof (`templates/horror-lab-v3/` + `short_qa.py`)

- Update `extract_shots.py` and `short_qa.py`:
  - Support POV shot scale taxonomy (`POV`, `POV_TURN`, `POV_DOWN`, `POV_PROP`, `POV_CU`, `WS`, `MS`, `OTS`, `LOW`, `ECU`) without falsely flagging consecutive POV beats that move via Whip-Pans or camera pitch shifts.
  - Export planned `whipPan` frame ranges into `shots.json` (`planned`) so intentional directional motion-blur bursts are not flagged as unplanned `pops`.
- Build **`templates/horror-lab-v3/`** (vertical `1080×1920`, 30fps, ~300 frames / 10s showcase) testing **3 radically different environments** + full graphics features:
  1. **Scene 1 — Rural Thatched Funeral Room (`warmLamp` → Whip-Pan → `coldMoon`):** Exposed A-frame thatch roof, mottled plaster walls, coffin & incense altar, glass oil lamp with HDR bloom, 3D dark-horror NPC sitting across from POV protagonist, Whip-Pan turn to POV hands holding glowing `Phone3D` + HUD notification, then lights-out shift to `coldMoon` showing doorway moonlight crack with 2 dark foot-shadows + tall uncanny entity looming at the door.
  2. **Scene 2 — Old Hospital / Apartment Corridor (`fluorescent` + `flashlight`):** Tiled walls, corridor bays, flickering overhead fluorescent tube, POV flashlight beam sweeping down the hallway onto a gaunt crooked-neck entity standing motionless in the distance.
  3. **Scene 3 — Foggy Rural Night Alley (`duskFog`):** Wet ground/asphalt, concrete/brick village walls, warm sodium streetlamp pool cutting through mist, 3D dark-horror figure turning in mid-shot.
- Render scale-1 stills of all key frames + a short test render of the Whip-Pan sequence, inspect every still directly, and present visual proof to the user before moving to Phase 2.

---

## 6. Decisions Made by Designer (Open for User Override) & What's Left to the Builder

### Designer Calls (Confirmable on Review)
1. **Clean Engine v3 Replacement:** Replace v2 2D billboard modules (`toon.ts`, `cast.ts`, `cardshade.ts`) in `templates/engine/` directly with v3 3D modules rather than maintaining parallel v2/v3 character pipelines (prevents AI agents from accidentally generating old 2D cards). Legacy v2 project templates (`templates/mada`, `templates/ma-xo`, `templates/ong-ke`) will be moved/retired or noted as legacy v2 archived outside active `Root.tsx` so `npm run typecheck` stays 100% green on v3.
2. **Strict v3 `LightKey` Contract + Minimal Python Sync:** `LightKey` in TypeScript (`camera.ts`, `lights.ts`, `grade.ts`) will be **strictly v3-only** (`"warmLamp" | "coldMoon" | "fluorescent" | "duskFog" | "flashlight"`, zero v2 `blood`/`eerie` aliases so agents never fall back to v2 filters). To avoid breaking existing validation scripts before Phase 2, Phase 1 includes a minimal contract sync of `VALID_LIGHTS` and default light emission (`"warmLamp"` / `"coldMoon"`) in `templates/scripts/horror_story.py`, `companion-skills/horror-story/scripts/horror_story.py`, and `templates/scripts/validate_continuity.py` (without redesigning story/series workflows, which remain Phase 2).
3. **HUD Default Behavior:** `HorrorHUD` is opt-in via props on `ShortPlayer`, with POV horror shorts enabling speaker pills + crisp subtitles + synced phone cards by default (matching `videomau`), while still allowing pure-cinematic caption-free renders when requested.
4. **Outline Thickness Calibration:** Target **5–7 px** at `1080×1920` for Inverted-Hull character outlines and **4.5 → 2.2 px** for architectural `InkPass` edges—visually calibrated against `videomau` during the `HorrorLabV3` still check.

### Left to the Builder (Implementation Details)
- Exact vertex segment counts and lathe control points for sculpted head, torso, clothing folds, and hand capsules (tuned visually during `HorrorLabV3` still inspection).
- Exact GLSL sampling weights for the 13-tap `WhipMotionBlurEffect` kernel and `stylizedShade` wrap curve constants.
- Specific pixel-art/procedural drawing strokes inside the 15+ `paint.ts` Canvas2D texture generators.
- Exact `package.json` / `shorts-project/` test harness setup for rendering `HorrorLabV3` stills and running `tsc --noEmit` + `short_qa.py`.
