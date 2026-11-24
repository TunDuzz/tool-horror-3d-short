---
name: horror-world-lookdev
description: Use when designing unique non-repeating 3D horror environments (LocationBlueprint), story-driven characters & supernatural entities (CharacterBlueprint + createCharacterFromBlueprint), PSX VHS/CRT or semi-realistic render styles, 5-pillar Maximum Dread horror staging (peripheral lurkers, decay props, opt-in body horror, 3-stage lunge escalation, VHS camcorder HUD), 1st-person POV rigs & diegetic 3D props (povRig.ts), or atmospheric 3D FX (fx3d.ts) in Three.js + Remotion Engine v5.0.
---

# Horror World, Story-Driven Cast & Maximum Dread Look-Dev v5.0

All project environments, custom textures, `CharacterBlueprint` configs, and story-specific props stay strictly inside `shorts-project/src/<project>/` (or `src/<episode>/shared/`) — never put story-specific code into `src/engine/` (`GEMINI.md`).

---

## 1. Visual Render Styles (`renderStyle` on `<ShortPlayer />`)

Engine v5.0 defaults to the acclaimed **PSX Low-Poly VHS/CRT Dark-Horror (`psxHorror`, `1A+2A+3A`)** aesthetic while remaining cleanly switchable per story:

| `renderStyle` | Visual Identity & Post-Processing | When to Use |
|---|---|---|
| **`"psxHorror"` *(default)*** | Low-poly angular geometry + PS1 `vertexSnap` (`280`), 360×640 virtual pixel grid (`pixelScale: 3.0`), 22-level color quantization + 4×4 Bayer dithering, subtle luminance-preserving CRT scanlines & curvature, VHS horizontal tracking wobble + `tapeTear` surges (`dreadLevel`), `outlineMode: "off"`, PBR BumpMaps + SSAO. | **Default** for indie PS1/VHS psychological, liminal, rural folklore, found-footage & visceral horror. |
| `"semiReal"` | Smooth high-poly dark realism (`lowPoly: false`), `outlineMode: "off"`, full PBR BumpMaps + SSAO + subtle film grain (`0.008`), no pixelation/CRT. | Crisp modern 3D cinematic horror without retro CRT filter. |
| `"painterly"` | Gritty thin ink accents (`outlineMode: "grittyThin"`), rich BumpMaps + SSAO, painterly brush grain. | Dark illustrated / graphic-novel folklore. |
| `"comic"` | Clean bold Inverted-Hull outlines (`~5–7 px`, `NOINK` layer 3) + architectural `InkPass` (layer 0), smooth stylized shading. | Clean 3D stylized animated horror shorts. |

---

## 2. Mandatory `LocationBlueprint` First (Zero Background Repetition!)

Before writing `build.ts`, define a unique `LocationBlueprint` in `manifest.json` for every location:
1. **`archetype`:** Story-authentic environment class (e.g. `ruralThatchedHouse`, `hospitalMorgueWing`, `foggyVillageAlley`, `oldApartmentStairwell`, `boardingRoom`, `abandonedClassroom`, `nightBusInterior`, `mountainTemple`, `basementStorage`).
2. **`dimensions` (`[width, depth, height]`):** Realistic proportions tailored to the space (`[2.8, 16.0, 2.95]` narrow hospital hall vs `[6.4, 7.6, 4.3]` A-frame thatch house vs `[4.2, 26.0, 9.0]` village alley).
3. **`ceilingType`:** `"aFrameThatch" | "aFrameTile" | "flatConcrete" | "dropCeiling" | "vaulted" | "openSky" | "vehicleCabin"`.
4. **`materials` (`wall`, `floor`, `ceiling`):** Use `paint.ts` textures — including **11 Albedo + BumpMap paired surfaces** (`mottledPlasterPair`, `hospitalTilePair`, `paintedConcretePair`, `brickWallPair`, `wetAsphaltPair`, `darkTimberPair`, `wovenFabricPair`, `hairStrandPair`, `humanSkinPair`, `cadaverSkinPair`, `tatteredGownPair`, scaled via `repPair`) plus clean painterly builders (`thatchRoofTex`, `tileRoofTex`, `concreteCeilingTex`, `corrugatedTinTex`, `terracottaFloorTex`, `vintagePatternTileTex`, `reedMatTex`, `packedEarthTex`, `woodenFloorTex`, `garmentFoldTex`).
5. **`practicalLights` & `heroProps`:** 1–3 motivated practical light sources + 3–5 story-specific hero props that matter to the plot.
6. **`signatureShadowBeat`:** One unforgettable lighting/shadow visual motif.
7. **Anti-Repetition Check:** `validate_manifest.py --registry LOCATION_REGISTRY.json` enforces **`ANTI_REPEAT_ERROR`** on unrelated collisions; only explicit narrative revisits may declare `sameLocationOf: "<projectId>:<locationId>"`.

---

## 3. Story-Driven `CharacterBlueprint` (ZERO Hardcoded Monster Templates!)

**CRITICAL RULE:** Never blindly paste blood, sutures, dislocated jaws, or matted hair onto every video's monster! Every character and supernatural entity MUST be customized strictly from the story's lore via `castBlueprints[]` in `manifest.json` and constructed with **`createCharacterFromBlueprint(bp)`**:

- **All horror/body-horror traits default to OFF (`false`/`0`).** Turn on ONLY traits explicitly described in `bp.storyDescription` (sourced from `story.json` `appearanceBrief` / `SCRIPT.md`):
  - **Ordinary human / village elder / ghost in ao dai:** Standard `createCharacter3D` proportions (`~5.6` head heights, sculpted jaw/nose, 20 sockets, `face2d.ts` almond eyes + vowel lip-sync `mouthFromWords`), zero gore flags.
  - **Silent faceless shadow silhouette:** `role: "silhouette"`, `entity: { heightScale: 1.20, gauntness: 0.78, silhouetteMode: true, eyeGlow: true, breathing: false }`, zero body-horror gore.
  - **Uncanny folklore / body-horror corpse entity (ONLY when story calls for it):** Opt-in `entity.bodyHorror` modifiers (`bodyHorror.ts`): `skullHollows`, `jawDrop3D`, `crookedTeeth`, `neckStretch`, `exposedRibs`, `protrudingSpine`, `clawHands`, `twistedJoints`, `extraArms: 2`, `cadaverSkin`, `bloodStainLevel`, `eyeHorror` (`sanpaku | voidSockets | weepingIchor | stitched | multiEye`), `cheekSplitGrin`, `tatteredCloth`, and v5.0 opt-ins `mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`.
- **Entity Anti-Repetition Gate (`ANTI_REPEAT_ENTITY_ERROR`):** `validate_manifest.py --registry LOCATION_REGISTRY.json` fingerprints every `entity`/`silhouette`/`lurker` blueprint and blocks accidental cloning across unrelated videos unless `"sameCharacterOf": "<projectId>:<charId>"` is declared for an explicit recurring villain!

---

## 4. The 5 Maximum Dread Pillars (100% Opt-In Per Story Beat)

Deploy any subset of these 5 dread tools when a story's tone and beats call for maximum terror:

1. **Pillar A — Peripheral Dread & Stalking Lurkers (`bodyHorror.ts`):**
   - `addCornerLurker3D(parent, { pos, height, eyeGlow, ... })`: Semi-hidden figure peering from window sills, doorway frames, or fog-drenched alley corners. Keep clearly inside `9:16` portrait FOV (`±16–20°`) so attentive viewers spot it!
2. **Pillar B — Atmospheric Grime, Folk & Viscera Storytelling (`fx3d.ts` + `build.ts`):**
   - `addSwarmingFlies3D(parent, center, opts)`: Deterministic erratic buzzing flies around rot/altars/corpses.
   - Opt-in Folk/Viscera kit in `build.ts`: `addBloodHandprintDecal3D`, `addIchorPoolDecal3D`, `addTalismanPaper3D`, `addOtherworldGrimeDecal3D`, and `addHauntedPortrait3D` (`setHaunt(dreadLevel, gazeX)`).
   - Pair with `addContactShadow`, `addFloorCornerAO`, `addRoomBaseboard`, `addWetPuddleDecal`, `addLampHalo3D`, `addRisingSmokeWisps`, `addDustMotes`, `addVolumetricCone`.
3. **Pillar C — Story-Driven Visceral Anatomy (`bodyHorror.ts`):**
   - Opt-in `mattedLongHair` (wet black hair parted over half-face exposing 1 glaring eye), `suturesAndWounds` (surgical stitches & raw tears), `uncannySkullMask` (deep orbital shadow bruises & clotted lip decay), triggered strictly via `CharacterBlueprint.appearance.entity.bodyHorror`.
4. **Pillar D — 3-Stage Escalating Stalk & Lunge Choreography (`rig3d.ts` + `camera.ts`):**
   - `doorwayPeek` (Stage 0: head/fingers craning around open doorframe — check lean sign so head enters the doorway opening, NEVER into solid wall!).
   - `stalkLoom` (Stage 1: unnatural stiff-jointed creeping advance at `steppedFps: 8..10` with zero human breathing; pair with `jacobsLadderTwitch` head snaps or `torchMalfunction`).
   - `lungeCloseUp` (Stage 2: sudden jaw-snapping forward lunge filling lens foreground; also supports `jawUnlatch`, `crawler`, `backbendCrab`).
   - Use `setPoseBlend(from, to, t, frame, opts)` for seamless terror transitions.
5. **Pillar E — Analog VHS Camcorder HUD, Creeping Fog & Tape-Tear Surges (`HorrorHUD.tsx`, `manifest.ts`, `retroPsx.ts`):**
   - Opt-in `hud.camcorder: { enabled: true, label: "VHS · SP", startClock: "01:06:00", dateLabel: "22/11/1998" }` renders subtle blinking `● REC` + live ticking timecode + CRT corners.
   - Per-beat `fogOverride: { color, near, far }` smoothly pulls claustrophobic fog inward right before a reveal.
   - `{ kind: "aberration", a, b, strength }` overlay automatically drives `RetroPsxEffect.dreadLevel` razor-thin horizontal VHS `tapeTear` & chromatic split during monster surges without obscuring monster faces.

---

## 5. Neutral Modular Architecture, 1st-Person POV Rig & Practical Lighting

- **Modular Builders (`build.ts`):** `addWallWithOpening`, `addDoubleDoorWithCracks` (`doorCtrl.setMoonlight(moonOn, feetShadow)`), `addAFrameRoof`, `addCorridorBay`, `addStairFlight`, `addGlassOilLamp3D`, `addIncenseBurner3D`, `addFluorescentTube3D`, `addStreetLamp3D`, `addSimpleTable`, `addWoodenBedFrame`, `addExitSign3D`, `addPipeRun3D`, `addWallSwitch3D`, `addAltarOfferingPlate3D`.
- **1st-Person POV Rig (`povRig.ts`):** `createPovRig3D` (`seated | standing`) + diegetic 3D props: `createPhone3D` (420×820 Canvas2D lockscreen + `phone.getLight()`), `createFlashlight3D` (`getSpotLight()`, keep `0.85–1.0` to prevent blowout), `createHandheldOilLamp3D`, `createPaperProp3D`.
- **Practical Lights & Whip-Pan Motion Blur:** Update `applyLightUniforms`, `setLocalLights` (up to 6 practical `PointLight`s), and `setSpotLight` in BOTH `world.update()` and `world.syncLighting()`. Implement `getLightBlend(...)` for smooth lamp-death shifts and `getMotionVelocity(...)` delegating to `evalShotMotion(...)` for deterministic 13-tap `WhipMotionBlurEffect`.

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) and [HORROR_STYLE_BIBLE.md](../../references/HORROR_STYLE_BIBLE.md) for calibrated values and verified v5.0 benchmark stills.
