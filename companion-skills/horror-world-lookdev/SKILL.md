---
name: horror-world-lookdev
description: Use when designing unique non-repeating 3D horror environments (LocationBlueprint + Zero Black Void architectural lights), story-driven characters & entities (CharacterBlueprint + 3-phase acting curves + dialogueMode), Anchored POV-First camera blocking (camMasterEstablish + camPovChain), 2-joint fingerCurl + worldTarget POV rigs (povRig.ts), or PSX VHS/CRT & 5-pillar Maximum Dread FX in Three.js + Remotion Engine v11.0.
---

# Horror World, Story-Driven Cast, 3-Phase Acting & Embodied POV Look-Dev v11.0

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
- **Anchored POV-First (`2A`) & 2-Joint `worldTarget` POV Rig (`4B` · `povRig.ts`):**
  - **Open every location with `camMasterEstablish`** (`cameraMode: "master"`, `>= 60 frames`) showing both protagonist `C01` and the room's full architectural depth (`Zero Black Void` — walls, rafters, doors, and hero props clearly readable under `lights.ts`).
  - **Stay 80–90% in Continuous Anchored POV (`camPovChain`)** with `C01` hidden and `PovRig3D` active (`idle`, `leanDesk`, `reachBolt`, `holdPaper`, `holdHandset`, `shieldFace`, `phone`, `flashlight`), using **2-joint `fingerCurl` (`0..1`) + `worldTarget: V3`** so POV hands visibly reach toward and grip real 3D prop coordinates (`bolt`, `receipt`, `ledger`) instead of floating in empty air! Use at most `1–2` `ots_same_side` shots on a strict 180° axis.
- **Hero Prop Craft, Sightline Rule & `getAuditTargets()` Registry (v12.0 Semantic Still Lock):**
  - Construct multi-part hero props with distinct visual states matching spoken adjectives/verbs (e.g. `burningEmbers` glowing honeycomb holes vs `coldDead`; exterior rain streaks outside open doorways; `handoverProp` & `fleePanic` actor poses in `rig3d.ts`).
  - **Architectural Window Sightline Rule:** Any interior window looking out onto exterior story landmarks (`waitingBench`, `pier`, `alley`) MUST keep sill bottom `y0 <= 0.76m` so standing POV cameras (`y ~ 1.44–1.56m`) have an unobstructed 3D sightline!
  - Implement **`getAuditTargets()`** on every `ShortWorld` mapping `mustShow` IDs (`"oilLamp"`, `"ledgerBook"`, `"waitingBench"`, `"coalStove"`, `"C01"`, `"C02:head"`, etc.) to their live `THREE.Object3D` nodes so `render-stills.mjs --strict-audit` generates `storyboard_proof.html` with 9-Ray Occlusion verification.
- **Spatial Stage Solver, 3-Phase Acting & `dialogueMode` (`stage.ts` + `rig3d.ts` — v11.0):**
  - Drive all actors via **`applyManifestActors(MANIFEST, frame, actors, extraAnchors, { words, speakerMap, blackouts })`**. Always set `dialogueMode: "voiceOver"` on `C01` during `[NARRATOR]` internal monologue (`VOICEOVER_LIPSYNC_ERROR` forbids mouth-flapping on voice-over!) and `dialogueMode: "directSpeech"` on speaking characters. `rig3d.ts` automatically applies 3-phase `Hold → Anticipation → Ease → Settle` gestures, `Head/Eye Lead` on pose blends, and grounded asymmetric gait on `walk`/`creep`.
- **Practical Lights & Whip-Pan Motion Blur:** Update `applyLightUniforms`, `setLocalLights` (up to 6 practical `PointLight`s), and `setSpotLight` in BOTH `world.update()` and `world.syncLighting()`. Implement `getLightBlend(...)` for smooth lamp-death shifts and `getMotionVelocity(...)` delegating to `evalShotMotion(...)` for deterministic 13-tap `WhipMotionBlurEffect`.

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) and [HORROR_STYLE_BIBLE.md](../../references/HORROR_STYLE_BIBLE.md) for calibrated values and verified v5.0 benchmark stills.
