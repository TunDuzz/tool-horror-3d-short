# Horror Lighting Presets, Local PointLights & Palette Reference (`src/engine/`)

Calibrated for Horror Engine v2 ("Gothic Ink-Noir × Shadow-Depth") in `lights.ts`, `shade.ts`, `cardshade.ts`, and `grade.ts`.

## 1. Five Dedicated Horror Presets

| Preset | Mood & Use Case | Sun `(az, el)` | `charGain` & Rim | Fog Range (`m`) | Vignette `(k, r0)` | Sky / Atmosphere |
|---|---|---|---|---|---|---|
| `night` | Moonlit river, graveyard, forest road | `(28, 26)` | `0.68` / cool `[0.46,0.68,1.0]` @ `0.52` | `7 -> 68` (`#1d3152`) | `(0.40, 0.34)` | Deep ink-navy moonlight |
| `candle` | Watchman's shack, ancestral hall, oil lamp | `(44, 22)` | `0.70` / amber `[1.0,0.52,0.18]` @ `0.55` | `6 -> 46` (`#24181f`) | `(0.46, 0.28)` | Warm amber key, deep plum shadows |
| `storm` | Driving rain, wind, 3D lightning strikes | `(102, 34)` | `0.68` / steel `[0.68,0.82,0.98]` @ `0.42` | `6 -> 54` (`#243646`) | `(0.42, 0.32)` | Cold storm slate + high-contrast flash |
| `eerie` | Liminal corridor, 3 AM apartment, dread peer | `(56, 46)` | `0.70` / jade `[0.36,0.90,0.72]` @ `0.48` | `6 -> 52` (`#193332`) | `(0.44, 0.30)` | Sickly fluorescent jade-teal |
| `blood` | Climax struggle, curse trigger, haunting twist | `(18, 18)` | `0.68` / crimson `[1.0,0.26,0.22]` @ `0.70` | `6 -> 54` (`#3a1019`) | `(0.50, 0.26)` | Crimson mist & obsidian-plum shade |

## 2. Real Dynamic Local PointLights (`setLocalLights`) & 3D Lightning (`setLightningFlash`)

Both world geometry (`twoTone`) and 2D character cards (`cardShade`) evaluate up to **3 real local point lights** every frame:

```ts
setLocalLights([
  // 1. Handheld storm lantern moving dynamically with character (warms face, coat, planks & water!)
  { pos: [tuX + 0.32, tuY + 1.02, tuZ - 0.35], color: [2.15 * k, 1.18 * k, 0.42], radius: 5.2 },
  // 2. Architectural oil lamp / hanging lantern post
  { pos: [lx, ly, lz], color: [1.85 * k, 1.05 * k, 0.38], radius: 5.8 },
  // 3. Distant glowing window beacon
  { pos: [wx, wy, wz], color: [1.5, 0.85, 0.32], radius: 5.0 },
]);
```

- **Rule:** Never fake a practical lamp with only a flat `fxFlickerGlow` sprite! Always pair every visible lantern, candle, flashlight, or glowing window with a real `setLocalLights()` entry so nearby characters and surfaces actually catch directional warmth/glow.
- **Lightning:** `ShortPlayer` automatically feeds `lightningAt(overlays, frame)` into `setLightningFlash()`, blasting real cold-blue 3D light across meshes, water, and characters during `{ kind: "lightning", f }` strikes while keeping screen overlays subtle (`0.28` screen sheen).

## 3. Albedo & Texture Guidelines for Gothic Inked Worlds

- **Never use pure `#000000` or pure `#ffffff` on lit 3D meshes:** `#000000` kills `#060409` `InkPass` edges; `#ffffff` blows out `Bloom`.
- **Use Gothic HD Painters (`paint.ts`):** `darkPlanksHD()`, `mudBankHD()`, `crackedPlasterHD()`, `horrorCloudHD()` (streaky storm stratus — never bright cartoon `grass()` or puffy `cloudHD()`!).
- **Safe albedos:** Stone/plaster `#565258`–`#7c7672`; damp timber `#3d3028`–`#6e5a4c`; night foliage/reeds `#243228`–`#3b463a`.
- **HDR Emissives (`Bloom > 1.0`):** `new THREE.MeshBasicMaterial({ color: new THREE.Color(...), toneMapped: false })`:
  - Oil lamp / storm lantern core: `(2.6, 1.65, 0.65)` × `(0.85 + 0.35 * flk)`
  - Eerie tube / spirit glow: `(0.55, 1.85, 1.35)`
  - Blood beacon: `(2.4, 0.55, 0.48)`
- **Volumetric Shafts (`addVolumetricShaft`):** Place angled soft moonbeams or window shafts (`opacity: 0.10–0.16`) to carve depth through dark interiors and misty exteriors.
