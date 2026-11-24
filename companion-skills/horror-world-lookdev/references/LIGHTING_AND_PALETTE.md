# Horror Lighting Presets, Practical Lights, BumpMap Surfaces & Fog v5.0 (`src/engine/`)

Calibrated for **Horror Engine v5.0** in `lights.ts`, `shade.ts`, `grade.ts`, `paint.ts`, `retroPsx.ts`, and `ShortPlayer.tsx`.

---

## 1. Five Physical Story-Driven Presets (`LightKey`)

Only these **5 physical horror presets** are valid (all non-physical crimson-wash presets are rejected by `validate_manifest.py` and `horror_story.py`):

| Preset | Mood & Story Use Case | Lit / Shade Contrast | Rim Light | Default Fog Range (`m`) | Sky / Atmosphere |
|---|---|---|---|---|---|
| `warmLamp` | Rural funeral room, candle/oil-lamp interior, warm vigil table | Amber `[0.68, 0.50, 0.36]` / plum-ink `[0.068, 0.052, 0.072]` | Warm `[0.95, 0.64, 0.34]` @ `0.34` | `7.5 → 44` (`#1d151d`) | Warm interior hearth framed by velvety plum shadows |
| `coldMoon` | Post-blackout room, late-night bedroom, door-crack moonlight | Slate-blue `[0.46, 0.56, 0.76]` / deep navy `[0.044, 0.050, 0.076]` | Cool `[0.58, 0.72, 0.96]` @ `0.44` | `6.5 → 46` (`#161b29`) | Desaturated indigo-slate night dread |
| `fluorescent` | Hospital corridor, old apartment hall, morgue, school | Pale jade-white `[0.70, 0.84, 0.78]` / teal-ink `[0.056, 0.076, 0.082]` | Mint `[0.68, 0.92, 0.84]` @ `0.30` | `6.0 → 38` (`#142224`) | Clinical cold institutional corridor glow |
| `duskFog` | Foggy village alley, wet night road, rural exterior | Twilight blue `[0.56, 0.66, 0.84]` / night indigo `[0.055, 0.068, 0.102]` | Silver `[0.74, 0.84, 1.00]` @ `0.38` | `5.5 → 42` (`#1f2a3e`) | Misty blue twilight cut by warm sodium streetlamp pools |
| `flashlight` | Pitch-dark basement, cave, unlit storage room | Low slate `[0.22, 0.26, 0.34]` / near-black `[0.026, 0.030, 0.044]` | Dim `[0.46, 0.56, 0.74]` @ `0.28` | `5.0 → 32` (`#0c1018`) | Near-black interior carved primarily by `Flashlight3D` SpotLight |

### Smooth In-Shot Light Transitions & Per-Beat Creeping Fog (`getLightBlend` + `beat.fogOverride`)
- When an oil lamp dies or a breaker trips mid-scene, declare `blendTo` and `blendRange` in `manifest.json` (`lightState`) and expose `getLightBlend(shotId, frame)` on your `ShortWorld` so `ShortPlayer` interpolates `gradeFor` + `applyLightUniforms` seamlessly.
- Declare optional `fogOverride: { color, near, far }` on any beat to pull suffocating claustrophobic fog closer around the camera before an entity reveal (reset cleanly to the preset fog on every subsequent beat!).

---

## 2. Real Dynamic Practical Lights (`setLocalLights` × 6 & `setSpotLight` × 1)

`stylizedShade` evaluates **soft wrapped directional shading + PBR BumpMaps + real soft shadow maps + SSAO + up to 6 dynamic `PointLight`s + 1 focused `SpotLight` cone + real 3D lightning flash** across all 3D geometry, characters, and POV props:

```ts
setLocalLights([
  // 1. Table glass oil lamp with deterministic flicker
  { pos: [tx - 0.18, 0.84, tz + 0.05], color: [2.45 * flk, 1.42 * flk, 0.56 * flk], radius: 5.8 },
  // 2. Altar tall candle
  { pos: [ax - 0.46, 1.32, az + 0.08], color: [1.85 * flk, 1.05 * flk, 0.42 * flk], radius: 4.5 },
  // 3. Diegetic Phone3D screen lighting POV fingers and nearby chest
  phone.getLight(1.45),
  // 4. Cold moonlight bounce pouring under a bolted double door
  { pos: [dx, 0.35, dz + 0.45], color: [0.64, 0.82, 1.18], radius: 3.6 },
]);

// Optional handheld flashlight cone (pass null when flashlight is off)
setSpotLight(flashlight.getSpotLight());
```

- **Rule:** Every visible practical light source MUST have a matching `setLocalLights()` / `setSpotLight()` entry synced to `beat.lightState.lampsOn`.
- **Anti-Blowout Calibration:** Keep `Flashlight3D` power around `0.85–1.05` and pale garments below `#68706e` under direct spotlights so Bloom highlights stay sculptural rather than turning pure white.
- **PSX CRT Luminance Balance:** In `psxHorror` mode, `RetroPsxEffect` uses luminance-preserving phosphor scanline gain (`1.0 + uScanline * (0.58 - 1.24 * scanWave)`) so dark `coldMoon` interiors never drop into accidental black frames.

---

## 3. HDR Emissives (`Bloom` Threshold `0.92`, `NEUTRAL` Tone Mapping)

Use `new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false })` on `NOINK` emissive cores:

| Practical Source | Recommended Linear RGB `(r, g, b)` | Notes |
|---|---|---|
| Glass oil lamp / altar candle flame | `(3.4–3.6, 2.1–2.25, 0.72–0.78) × flk` | Warm golden halo through translucent chimney |
| `Phone3D` lockscreen | `(1.42, 1.46, 1.56)` × Canvas2D map | Crisp readable clock + subtle luminous bezel glow |
| Overhead `FluorescentTube3D` | `(1.9, 2.35, 2.15) × flk` | Clinical pale mint-white flicker |
| Sodium `StreetLamp3D` bulb | `(2.9, 1.85, 0.72)` | Pair with soft `addVolumetricCone` (`opacity: 0.10–0.14`) |
| Door-crack moonlight strips | `moonColor: "#a2b8dc"` scaled `~1.35×` | Crisp cool silver-blue beam on dark floor |
| Silhouette entity `eyeGlow` | `(2.2, 2.35, 2.8)` | Piercing pinpoint cold glints in pitch dark |

---

## 4. Albedo Discipline & 11 PBR Albedo+BumpMap Surface Pairs (`paint.ts`)

- **Never use pure `#000000` or pure `#ffffff` on lit 3D meshes:** `#000000` kills depth and shadow readability; `#ffffff` triggers Bloom blowout under practical lights.
- Use the **11 paired Albedo + BumpMap builders** in `paint.ts` (`{ map, bumpMap, bumpScale }`, tiled with `repPair`) for rich damp grime, brick mortar, hospital tile seams, peeling plaster, wet asphalt, dark timber, skin, and tattered fabric relief under `stylizedShade` / PBR:
  - **Architecture & Ground (6 pairs):** `mottledPlasterPair`, `hospitalTilePair`, `paintedConcretePair`, `brickWallPair`, `wetAsphaltPair`, `darkTimberPair`
  - **Characters, Cloth & Decay (5 pairs):** `wovenFabricPair`, `hairStrandPair`, `humanSkinPair`, `cadaverSkinPair`, `tatteredGownPair`
  - **Clean Painterly Textures (`paint.ts`):** `thatchRoofTex`, `tileRoofTex`, `concreteCeilingTex`, `corrugatedTinTex`, `terracottaFloorTex`, `vintagePatternTileTex`, `reedMatTex`, `packedEarthTex`, `woodenFloorTex`, `garmentFoldTex`
- Ground every room with `addFloorCornerAO`, `addRoomBaseboard`, and `addContactShadow` (plus SSAO) so no wall junction or actor ever looks like it is floating.
