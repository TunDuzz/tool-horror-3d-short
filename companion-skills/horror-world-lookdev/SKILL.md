---
name: horror-world-lookdev
description: Use when designing unique non-repeating 3D horror environments (LocationBlueprint), modular architecture/props, real practical PointLights/SpotLights, non-chibi 3D dark-horror characters & uncanny entities (rig3d.ts, face2d.ts), 1st-person POV rigs & diegetic 3D props (povRig.ts), or atmospheric 3D FX (fx3d.ts) in Three.js + Remotion Engine v3.
---

# Horror World, Character & POV Look-Dev v3 (`3D Stylized Dark-Horror POV`)

All project environments, custom textures, character configurations, and story-specific props stay strictly inside `shorts-project/src/<project>/` (or `src/<episode>/shared/`) — never put story-specific code into `src/engine/` (`GEMINI.md`).

---

## 1. Mandatory `LocationBlueprint` First (Zero Background Repetition!)

**Legacy v2 Retirement:** NEVER copy the old generic wooden box room (`[-4..4] × 3.5m` + 4 pillars + back-left window + right table + bolted door) and NEVER force `addGnarledTree`/`addReedCluster`/`addStormLantern3D` into unrelated stories. Those helpers remain strictly optional exterior tools ONLY when a rural river/forest story calls for them.

Before writing a single line of `build.ts`, define a unique `LocationBlueprint` inside `manifest.json` for every setting:
1. **`archetype`:** Story-authentic environment class (e.g. `ruralThatchedHouse`, `hospitalMorgueWing`, `foggyVillageAlley`, `oldApartmentStairwell`, `boardingRoom`, `abandonedClassroom`, `nightBusInterior`, `mountainTemple`, `basementStorage`).
2. **`dimensions` (`[width, depth, height]`):** Realistic proportions tailored to the space (`[2.8, 16.0, 2.95]` narrow hospital hall vs `[6.4, 7.6, 4.3]` A-frame thatch house vs `[4.2, 26.0, 9.0]` village alley).
3. **`ceilingType`:** `"aFrameThatch" | "aFrameTile" | "flatConcrete" | "dropCeiling" | "vaulted" | "openSky" | "vehicleCabin"`.
4. **`materials` (`wall`, `floor`, `ceiling`):** Pick 3 cohesive clean painterly textures from `paint.ts` (`thatchRoofTex`, `tileRoofTex`, `concreteCeilingTex`, `corrugatedTinTex`, `mottledPlasterTex`, `brickWallTex`, `hospitalTileTex`, `paintedConcreteTex`, `darkTimberWallTex`, `terracottaFloorTex`, `vintagePatternTileTex`, `reedMatTex`, `wetAsphaltTex`, `packedEarthTex`, `woodenFloorTex`, `garmentFoldTex`).
5. **`practicalLights` & `heroProps`:** 1–3 motivated practical light sources + 3–5 story-specific hero props that actually matter to the plot.
6. **`signatureShadowBeat`:** One unforgettable lighting/shadow visual motif (e.g., *"cold moonlight under bolted double door blocked by 2 dark foot shadows"* or *"flickering fluorescent tube + flashlight beam revealing gaunt figure down hallway"*).
7. **Anti-Repetition Check:** Validate with `validate_manifest.py --registry LOCATION_REGISTRY.json`. Unrelated videos and unrelated Parts MUST NOT collide; only explicit narrative revisits may declare `sameLocationOf: "<projectId>:<locationId>"`.

---

## 2. Neutral Modular Architecture & Hero-Prop Kits (`build.ts` + `fx3d.ts`)

Compose unique sets cleanly from Engine v3's neutral builders (all lit with `stylizedShade`, architectural meshes on layer 0 for crisp `InkPass` linework, detailed actors/props on `NOINK` with smooth Inverted-Hull outlines):

- **Walls, Openings & Doors:** `addWallWithOpening` (real geometric doorway/window cutouts — zero overlapping Z-fighting planes!), `addDoubleDoorWithCracks` (hinged leaves + locking bolt + toggleable center/bottom HDR moonlight strips + toggleable 2 dark foot-shadow blockers via `doorCtrl.setMoonlight(moonOn, feetShadow)`).
- **Roofs, Corridors & Verticality:** `addAFrameRoof` (exposed beams + king posts + pitched roof decks), `addCorridorBay` (modular hallway bays with recessed ward/apartment doors + baseboards), `addStairFlight` (real stepped staircases + landings + handrails).
- **Practical 3D Light Fixtures & Furniture:** `addGlassOilLamp3D` (translucent glass chimney + flickering HDR flame + `setLit`), `addIncenseBurner3D` (3 glowing incense embers), `addFluorescentTube3D` (`setIntensity` flicker), `addStreetLamp3D` (`bulbWorldPos` for synced sodium light + cone), `addSimpleTable`, `addWoodenBedFrame`.
- **Atmospheric 3D FX (`fx3d.ts`, strictly on `NOINK`):** `addRisingSmokeWisps` (deterministic curling incense/candle wisps), `addDustMotes` (drifting particles inside flashlight/moon beams), `addVolumetricCone` (soft directional additive light shafts), `createFlatDecalMesh` (flush floor puddles, footprints, blood/water marks — NEVER upright billboards).
- **Depth Framing in `9:16`:** Keep walls, distant alley end-caps/rooftops, practical lamps, and hero props within narrow `9:16` horizontal FOV so backgrounds never look like empty sky cutouts.

---

## 3. Non-Chibi 3D Dark-Horror Characters & Uncanny Entities (`rig3d.ts` + `face2d.ts`)

- **Create Human Characters (`createCharacter3D`):**
  - Adult `~5.6` head-height proportions with sculpted jaw, 3D nose bridge, ears, sloping shoulder yoke, 3D collar/belt, clean UV garment folds, and 20 named sockets.
  - Hair styles: `shortParted`, `spiky`, `elderThin`, `bun`, `longDraped`, `messyFringe`, `bald` (plus optional `headbandCol`).
  - Garments: `funeralRobe`, `shirt`, `coat`, `hospitalGown`, `casualJacket`, `shroud`. Choose clothes darker or distinctly contrasted against skin (`#2d3340`, `#3a424e`, `#566360`) so pale faces read sharply in low light.
  - Expressions (`FaceExpr`): `calm`, `wary`, `uneasy`, `dread`, `terrified`, `deadStare`, `unsettlingSmile`, `hollow` + 9 lip-sync `MouthShape`s + `gazeX/Y` + `lid` blinks + `lookAtWorld(...)`.
  - Poses (`PoseAction`): `standIdle`, `sitCrossLegged`, `sitChair`, `walk`, `creep`, `peerForward`, `recoil`, `holdPhone`, `holdLantern`, `point`, `lunge`, `loomingStill`, `peekAroundDoor`, `turnHead`.
- **Create Uncanny Supernatural Entities (`entity: EntityConfig`):**
  - Push silhouette and posture into dark horror: `heightScale: 1.14–1.24`, `gauntness: 0.72–0.80`, `armScale: 1.20–1.30`, `fingerScale: 1.30–1.40`, `neckTiltDeg: ±24..34`, `shoulderSkew: 0.10`, `hairCurtain: true` (organic parted hair wisps — never thick outline blocks), `breathing: false`, optional `steppedFps: 8–10`, `silhouetteMode: true` + `eyeGlow: true` (`eyeGlowColor: [2.2, 2.35, 2.8]`) for chilling blackout reveals.
- **Outline Layer Discipline:** `createCharacter3D` automatically attaches angle-weighted smooth-normal Inverted-Hull outlines (`~5.8–6.2 px`) and puts the entire rig on `NOINK` (layer 3) so architectural `InkPass` never double-outlines actors.

---

## 4. 1st-Person POV Rig & Diegetic 3D Props (`povRig.ts`)

- Mount `createPovRig3D({ skinCol, sleeveCol, pantsCol, shoeCol })` once in `world.ts` and call `pov.update(cam, { stance, anchor, bodyYaw, propMode, rightArmRaise, leftArmRaise, frame })` every frame:
  - `stance: "seated" | "standing"` renders visible knees/legs/shoes when camera pitches down (`POV_DOWN`).
  - `povRightHand` / `povLeftHand` hold camera-aligned props whose forearms slope cleanly downward/back behind the prop (`-Z`) so sleeves NEVER clip across screens.
- **Diegetic 3D Props:**
  - `createPhone3D`: Live 420×820 Canvas2D lockscreen (`clock`, `date`, `carrier`, `battery`, `notifications`), slender bezel-hugging fingers, HDR Bloom screen, and `phone.getLight(intensity)` illuminating fingers & face. Always sync `clock` and notification body directly from `beat.propStates.phone.detail`!
  - `createFlashlight3D`: Metal barrel, HDR lens, soft beam cone, and `flashlight.getSpotLight()` feeding `setSpotLight(...)`. Keep intensity around `0.85–1.0` to avoid garment highlight blowout.
  - `createHandheldOilLamp3D`: Flickering portable lamp + `lamp.getLight(frame)`.
  - `createPaperProp3D`: Live Canvas2D letter/rule-sheet/talisman prop.

---

## 5. Practical Lighting, Smooth Light-Loss Shifts & Whip-Pan Motion Blur

- Always update `applyLightUniforms(L, K)`, `setLocalLights([...])` (up to 6 practical lights), and `setSpotLight(...)` in BOTH `world.update()` and `world.syncLighting()` directly from `beat.lightState`.
- Implement `getLightBlend(shotId, frame)` using `beat.lightState.blendTo` / `blendRange` for smooth lights-out shifts (`warmLamp → coldMoon`).
- Implement `getMotionVelocity(shotId, frame, aspect, heightPx)` delegating to `evalShotMotion(...)` so `WhipMotionBlurEffect` delivers deterministic 13-tap directional motion blur during `whipPan` bursts while remaining zero-overhead pass-through on calm shots.

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) and [HORROR_STYLE_BIBLE.md](../../references/HORROR_STYLE_BIBLE.md) for calibrated values and verified benchmark stills.
