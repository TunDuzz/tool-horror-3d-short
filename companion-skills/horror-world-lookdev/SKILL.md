---
name: horror-world-lookdev
description: Use when designing unique non-repeating 3D horror environments optimized for GTX 960 low-VRAM (LocationBlueprint + Zero Black Void practical lights), 2.5D Photorealistic Normal-Mapped Characters & Tier 4-7 Uncanny Entities (gen_cast_assets.py + sprite2d.ts), First-Frame-Conditioned AI Jumpscare transitions (gen_jumpscare_clip.py + transitionStyle), Anchored POV-First camera blocking (camMasterEstablish + camPovChain), 2-joint fingerCurl + worldTarget POV rigs (povRig.ts), or PSX VHS/CRT & 5-pillar Maximum Dread FX in Three.js + Remotion Engine v15.0.
---

# Horror World, 2.5D Photorealistic Cast, 7-Tier Ghosts & GTX 960 Look-Dev v15.0

All project environments, custom textures, `CharacterBlueprint` configs, generated 2.5D cast PNGs (`assets/cast/`), Jumpscare `.mp4` clips, and story-specific props stay strictly inside `shorts-project/src/<project>/` (or `src/<episode>/shared/`) — never put story-specific code into `src/engine/` (`GEMINI.md`).

---

## 1. GTX 960 Low-VRAM Render Pipeline & Visual Render Styles (`renderStyle` on `<ShortPlayer />`)

Engine v15.0 defaults to **`renderStyle="psxHorror"` with `lowVram: true`** so 4–6 GB VRAM GPUs (GTX 960 / 960M) render smoothly without dropping to software rendering (`swangle`):
- Disables expensive full-res `OpaqueNormalPass`, `SSAOEffect`, and `LensBlur` (`pre` & `main`), which would otherwise be pixelated away by `RetroPsxEffect`.
- Caps `BloomEffect` to `<= 3` mipmap levels (or disabled when not needed).
- Renders internal WebGL directly at low resolution (`dpr: 0.45`, `0.35` draft; equivalent to ~`486×864` / `378×672`) instead of supersampling full `1080×1920`.
- Mounts strictly **ONE `<ThreeCanvas>`** WebGL context at all times (even across `xfade` transitions and Jumpscare video inserts).

| `renderStyle` | Visual Identity & Post-Processing | When to Use |
|---|---|---|
| **`"psxHorror"` *(default)*** | Lightweight 3D architectural world + PS1 `vertexSnap` (`280`), 11 PBR Albedo+BumpMap surface pairs, low-VRAM `dpr 0.45`, 360×640 Bayer-dithered VHS/CRT pass + `tapeTear` (`dreadLevel`), `outlineMode: "off"`. | **Default** for GTX 960 indie PS1/VHS psychological, liminal, rural folklore & found-footage horror. |
| `"semiReal"` | Smooth high-poly dark realism (`lowPoly: false`), `outlineMode: "off"`, full PBR BumpMaps + optional SSAO, subtle film grain (`0.008`), no pixelation/CRT. | Crisp modern 3D cinematic horror without retro CRT filter. |
| `"painterly"` | Gritty thin ink accents (`outlineMode: "grittyThin"`), rich BumpMaps, painterly brush grain. | Dark illustrated / graphic-novel folklore. |
| `"comic"` | Clean bold Inverted-Hull outlines (`~5–7 px`, `NOINK` layer 3) + architectural `InkPass` (layer 0), smooth stylized shading. | Clean 3D stylized animated horror shorts. |

---

## 2. Mandatory `LocationBlueprint` First (Zero Background Repetition!)

Before writing `build.ts`, define a unique `LocationBlueprint` in `manifest.json` for every location (boarding room, freight elevator, hospital corridor, village alley, underground parking, late-night diner — NEVER reuse an existing house template for unrelated videos!):
1. **`archetype`:** Story-authentic environment class tailored to `SCRIPT.md`.
2. **`dimensions` (`[width, depth, height]`):** Realistic proportions tailored to the space.
3. **`ceilingType`:** `"aFrameThatch" | "aFrameTile" | "flatConcrete" | "dropCeiling" | "vaulted" | "openSky" | "vehicleCabin"`.
4. **`materials` (`wall`, `floor`, `ceiling`):** Use `paint.ts` textures — including **11 Albedo + BumpMap paired surfaces** scaled via `repPair`.
5. **`practicalLights` & `heroProps`:** 1–3 motivated practical light sources + 3–5 story-specific hero props that matter to the plot.
6. **`signatureShadowBeat`:** One unforgettable lighting/shadow visual motif.
7. **Anti-Repetition Check:** `validate_manifest.py --registry LOCATION_REGISTRY.json` enforces **`ANTI_REPEAT_ERROR`** on unrelated collisions; only explicit narrative revisits may declare `sameLocationOf: "<projectId>:<locationId>"`.

---

## 3. 2.5D Photorealistic Normal-Mapped Cast (`sprite2d.ts`) & 7-Tier Uncanny Ghost Scale (`>= Tier 4`)

Engine v15.0 uses **`characterMode: "sprite2d"` by default** (`rig3d.ts` remains supported as an opt-in legacy fallback):
- **100% Automated Photorealistic Cast Pipeline (`scripts/gen_cast_assets.py` + `GEMINI_API_KEY`):**
  1. Reads every entry in `manifest.json` `castBlueprints[]` (age, outfit, Vietnamese region, ghost scare tier & traits).
  2. Generates photorealistic dark-horror / found-footage character & ghost sprites (NEVER flat cartoons!) -> removes chroma background -> generates a matching **Tangent-Space Normal Map** -> saves strictly into `src/<project>/assets/cast/`.
  3. `sprite2d.ts` renders each actor on a **24×36 anatomical puppet mesh** using Albedo + Normal Map + single-draw-call crossfade shader (`stylizedSpriteShade`), receiving real 3D lighting from `lights.ts` (oil lamp, fluorescent, moonlight, flashlight, fog) with grounded contact shadows. Choreograph bespoke story-driven acting per beat via **`actingCues[]`** combining **20 composable gestures** (`shrug`, `sighDrop`, `heavyPant`, `breathHold`, `shiver`, `nodSlow`, `nodDouble`, `headShake`, `tiltListen`, `glanceAside`, `chinTuck`, `flinch`, `leanIn`, `leanBack`, `cower`, `stepSway`, `neckCrack`, `neckTwitch`, `jawStretch`, `loomSwell`) or freeform `gesture: "custom"` + `customDeform`, locked to exact spoken phrases (`onPhrase` → `atFrame`) with multi-step `exprTo` crossfade (`calm`, `talk`, `fear`, `shock`, `entity_scare`). Free-Tier / Antigravity green-screen renders can be imported directly via `gen_cast_assets.py --import-raw-dir`.
- **Mandatory 7-Tier Entity Scare Scale (Primary Entity MUST be `scareTier >= 4` — NO bland/mild ghosts!):**
  - *Tier 1:* Backlit dark silhouette
  - *Tier 2:* Familiar person with subtly wrong detail / crooked neck tilt
  - *Tier 3:* Blank / blurred / static-obscured face
  - *Tier 4 (Min Primary):* Figure clinging silently in ceiling corner or doorway crack
  - *Tier 5:* Stretched unnatural smile / sunken shadowed eyes with tiny pinpoint gleam
  - *Tier 6:* Elongated neck / twisted impossible joints with erratic stop-motion twitch
  - *Tier 7:* Motionless hollow stare abruptly distorting & lunging straight into camera lens
  - Prioritize **Uncanny Valley + high-contrast chiaroscuro** (YouTube/TikTok safe — avoid crude gore). `validate_manifest.py` fails with **`ENTITY_SCARE_TIER_ERROR`** if a primary entity has `scareTier < 4`, and **`ANTI_REPEAT_ENTITY_ERROR`** if an unrelated project reuses another project's sprite paths or entity signature!

---

## 4. First-Frame-Conditioned AI Video Jumpscare & Story-Driven `transitionStyle`

- Run `python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json --comp <CompId> --workspace . --overwrite` to:
  1. Capture the exact clean 3D frame right before the Jumpscare (`jumpscare_anchor_frame.png` via `render-stills.mjs --raw-anchor --png`).
  2. Condition a 2–4s AI Video clip directly on that First Frame + the project's ghost reference image (`src/<project>/assets/jumpscare_<id>.mp4`), guaranteeing 100% matching room layout, angle, and lighting at `t = 0.00s`.
  3. Route the `.mp4` inside `ShortPlayer.tsx` through the **exact same Grade + Film Grain + RetroPsx VHS pipeline under `HorrorHUD`** so the seam is invisible!
- **Select `transitionStyle` per script (NEVER hardcode flashlight transitions across unrelated videos!):**
  - `first_frame_seamless` *(default)*: Direct seam from 3D anchor frame into First-Frame-locked AI clip.
  - `whip_pan_turn`: 4–6f 3D whip-pan motion blur turning directly onto the AI entity behind the camera.
  - `diegetic_reveal`: Triggered by a real in-story action/light (opening door, pulling curtain, fluorescent flicker, lightning flash, breaker trip — only if present in `SCRIPT.md`).
  - `silence_hard_cut`: Compress tension with `[SILENCE_DROP 0.5–1.2s]` then hard-cut to closeup AI video on the audio impact.

---

## 5. Neutral Modular Architecture, Embodied POV Rig, `actionTriggerFrame` & Practical Lighting

- **Modular Builders (`build.ts`):** `addWallWithOpening`, `addDoubleDoorWithCracks`, `addAFrameRoof`, `addCorridorBay`, `addStairFlight`, `addGlassOilLamp3D`, `addIncenseBurner3D`, `addFluorescentTube3D`, `addStreetLamp3D`, `addSimpleTable`, `addWoodenBedFrame`, `addExitSign3D`, `addPipeRun3D`, `addWallSwitch3D`, `addAltarOfferingPlate3D`.
- **Anchored POV-First (`2A`) & 2-Joint `worldTarget` POV Rig (`povRig.ts`):** Open with `cold_hook` → `camMasterEstablish` (`>= 60f`), stay `80–90%` in continuous `camPovChain`, implement **`getAuditTargets()`** on `ShortWorld` so `render-stills.mjs --strict-audit` generates `storyboard_proof.html` with 9-Ray Occlusion checks.
- **Sharp Acting Sync (`stage.ts` v15.0):** Use `actionTriggerPhrase` → `actionTriggerFrame` + `actionSnapFrames` (`3–5f` crisp snap instead of slow smeared lerp across the whole beat!) and pass `rmsEnvelope` from `words.json` (`rms_envelope_30fps`) so `Character25D` & `Character3D` lip-sync directly to real vocal amplitude!
- **Practical Lights:** Update `applyLightUniforms`, `setLocalLights` (up to 6 real `PointLight`s), and `setSpotLight` in BOTH `world.update()` and `world.syncLighting()` so 2.5D normal-mapped characters react vividly to every lamp flicker and lightning flash.

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) and [HORROR_STYLE_BIBLE.md](../../references/HORROR_STYLE_BIBLE.md) for calibrated values.
