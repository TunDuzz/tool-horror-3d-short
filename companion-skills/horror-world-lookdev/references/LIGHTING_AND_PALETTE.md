# Horror Lighting Presets, Practical Lights & Painterly Surfaces v3 (`src/engine/`)

Calibrated for **Horror Engine v3 ("3D Stylized Dark-Horror POV")** in `lights.ts`, `shade.ts`, `grade.ts`, `paint.ts`, and `ShortPlayer.tsx`.

---

## 1. Five Physical Story-Driven Presets (`LightKey`)

The legacy v2 `blood` crimson-wash preset is **permanently removed and rejected by `validate_manifest.py`**. Use only these 5 physical horror presets:

| Preset | Mood & Story Use Case | Lit / Shade Contrast | Rim Light | Fog Range (`m`) | Sky / Atmosphere |
|---|---|---|---|---|---|
| `warmLamp` | Rural funeral room, candle/oil-lamp interior, warm vigil table | Amber `[0.68, 0.50, 0.36]` / plum-ink `[0.068, 0.052, 0.072]` | Warm `[0.95, 0.64, 0.34]` @ `0.34` | `7.5 → 44` (`#1d151d`) | Warm interior hearth framed by velvety plum shadows |
| `coldMoon` | Post-blackout room, late-night bedroom, door-crack moonlight | Slate-blue `[0.46, 0.56, 0.76]` / deep navy `[0.044, 0.050, 0.076]` | Cool `[0.58, 0.72, 0.96]` @ `0.44` | `6.5 → 46` (`#161b29`) | Desaturated indigo-slate night dread |
| `fluorescent` | Hospital corridor, old apartment hall, morgue, school | Pale jade-white `[0.70, 0.84, 0.78]` / teal-ink `[0.056, 0.076, 0.082]` | Mint `[0.68, 0.92, 0.84]` @ `0.30` | `6.0 → 38` (`#142224`) | Clinical cold institutional corridor glow |
| `duskFog` | Foggy village alley, wet night road, rural exterior | Twilight blue `[0.56, 0.66, 0.84]` / night indigo `[0.055, 0.068, 0.102]` | Silver `[0.74, 0.84, 1.00]` @ `0.38` | `5.5 → 42` (`#1f2a3e`) | Misty blue twilight cut by warm sodium streetlamp pools |
| `flashlight` | Pitch-dark basement, cave, unlit storage room | Low slate `[0.22, 0.26, 0.34]` / near-black `[0.026, 0.030, 0.044]` | Dim `[0.46, 0.56, 0.74]` @ `0.28` | `5.0 → 32` (`#0c1018`) | Near-black interior carved primarily by `Flashlight3D` SpotLight |

### Smooth In-Shot Light Transitions (`lerpLights`, `lerpLook`, `getLightBlend`)
When an oil lamp dies or a breaker trips mid-scene, declare `blendTo` and `blendRange` in `manifest.json` (`lightState`) and expose `getLightBlend(shotId, frame)` on your `ShortWorld`:
- `ShortPlayer` automatically interpolates `gradeFor` + `applyLightUniforms` smoothly across the transition frames without a jarring filter pop.
- In `world.syncLighting()`, extinguish practical local lights (`isLampLit(beat, "oilLamp")`) in lockstep with `beat.lightState.lampsOn`.

---

## 2. Real Dynamic Practical Lights (`setLocalLights` × 6 & `setSpotLight` × 1)

`stylizedShade` evaluates **soft wrapped directional shading + real soft shadow maps + up to 6 dynamic `PointLight`s + 1 focused `SpotLight` cone + real 3D lightning flash** across all 3D geometry, characters, and POV props:

```ts
setLocalLights([
  // 1. Table glass oil lamp with deterministic flicker
  { pos: [tx - 0.18, 0.84, tz + 0.05], color: [2.45 * flk, 1.42 * flk, 0.56 * flk], radius: 5.8 },
  // 2. Altar tall candle
  { pos: [ax - 0.46, 1.32, az + 0.08], color: [1.85 * flk, 1.05 * flk, 0.42 * flk], radius: 4.5 },
  // 3. Diegetic Phone3D screen lighting POV fingers and nearby chest
  phone.getLight(1.45),
  // 4. Cold moonlight bounce pouring under a bolted double door
  { pos: [dx, 0.35, dz + 0.45], color: [0.58, 0.76, 1.12], radius: 3.4 },
]);

// Optional handheld flashlight cone (automatically sets attenuation, outer cone angle & penumbra)
setSpotLight(flashlight.getSpotLight()); // pass null when flashlight is off
```

- **Rule:** Every visible practical light source (oil lamp, candle, phone screen, fluorescent tube, sodium streetlamp, door-crack moonlight) MUST have a matching `setLocalLights()` / `setSpotLight()` entry synced to `beat.lightState.lampsOn`.
- **Anti-Blowout Calibration:** Keep `Flashlight3D` power around `0.85–1.05` and light-colored character garments (`hospitalGown`, white shirts) below `#68706e` under direct spotlights so Bloom highlights stay sculptural rather than turning torsos pure white.

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

## 4. Albedo Discipline & 16 Clean Painterly Textures (`paint.ts`)

- **Never use pure `#000000` or pure `#ffffff` on lit 3D meshes:** `#000000` destroys `#06060a` outline contrast; `#ffffff` triggers unwanted Bloom blowout under practical lamps.
- Choose surface textures matching your `LocationBlueprint` from the 16 clean painterly builders in `paint.ts`:
  - **Ceilings & Roofs (4):** `thatchRoofTex`, `tileRoofTex`, `concreteCeilingTex`, `corrugatedTinTex`
  - **Walls (5):** `mottledPlasterTex`, `brickWallTex`, `hospitalTileTex`, `paintedConcreteTex`, `darkTimberWallTex`
  - **Floors & Ground (6):** `terracottaFloorTex`, `vintagePatternTileTex`, `reedMatTex`, `wetAsphaltTex`, `packedEarthTex`, `woodenFloorTex`
  - **Fabric & Garments (1):** `garmentFoldTex` (plus automatic garment seams in `rig3d.ts`)
- Every texture painter in `paint.ts` uses gentle painterly brushwork and realistic wear—zero harsh cross-hatching or muddy black noise.
