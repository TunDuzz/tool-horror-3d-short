# Horror Lighting Presets & Palette Reference (`src/engine/`)

Calibrated in `lights.ts`, `grade.ts`, `cardshade.ts`, and verified in `HorrorLab` across both `9:16` and `16:9`.

## 1. Five Calibrated Horror Presets

| Preset | Mood & Use Case | Sun `(az, el)` | `charGain` & Rim | Fog Range (`m`) | Vignette `(k, r0)` | Sky / Fog Mood |
|---|---|---|---|---|---|---|
| `night` | Moonlight exterior, graveyard, forest road | `(22, 24)` | `0.64` / cool `[0.42,0.62,0.96]` @ `0.45` | `12 -> 125` (`#1a2b48`) | `(0.36, 0.34)` | Deep moonlight navy |
| `candle` | Ancestral house, cabin, oil lamp interior | `(48, 18)` | `0.68` / warm `[0.95,0.46,0.14]` @ `0.50` | `8 -> 65` (`#1d141a`) | `(0.44, 0.28)` | Amber key, plum-brown shade |
| `storm` | Heavy rain, wind, sudden lightning | `(105, 34)` | `0.66` / steel `[0.62,0.76,0.92]` @ `0.32` | `10 -> 95` (`#233340`) | `(0.38, 0.32)` | Cold slate storm grey |
| `eerie` | Liminal hallway, 3 AM elevator, clinic | `(60, 52)` | `0.68` / sickly `[0.36,0.84,0.66]` @ `0.38` | `9 -> 85` (`#162a2a`) | `(0.40, 0.30)` | Sickly fluorescent jade-teal |
| `blood` | Climax, curse trigger, supernatural reveal | `(12, 14)` | `0.62` / red `[0.96,0.20,0.18]` @ `0.65` | `10 -> 90` (`#330e15`) | `(0.50, 0.24)` | Crimson haze & black-plum shade |

## 2. Albedo Guidelines for Inked Dark Worlds

- **Never use pure `#000000` or pure `#ffffff` on 3D meshes:** Near-black `#000000` swallows `#030303` `InkPass` outlines; bright `#ffffff` blows out under `Bloom`.
- **Safe stone / plaster / concrete:** `#5c5a5f` to `#8f8882` (low saturation `< 20%`).
- **Safe wood / timber / wet dirt:** `#4d443d` to `#705c4d`.
- **Safe foliage / night grass:** `#38443c` to `#4d564c`.
- **HDR Emissives (Bloom > 1.0):** Use `new THREE.MeshBasicMaterial({ color: new THREE.Color(...), toneMapped: false })`:
  - Warm lantern / window: `(2.0, 1.25, 0.52)` × `(0.85 + 0.3 * flickerAt(...))`
  - Eerie fluorescent: `(0.55, 1.85, 1.35)`
  - Blood warning / eyes: `(2.2, 0.45, 0.40)`

## 3. Orientation Framing (`9:16` vs `16:9`)

Post-processing (`InkPass`, `LensBlur`, `Bloom`, `GrainEffect`, and `CARD_K.uPx`) automatically scales by `Math.min(width, height) / 1080`, so pixel line weights and DOF CoC match identically across vertical and horizontal compositions.

| Setting | `9:16` Vertical (`1080x1920`) | `16:9` Wide (`1920x1080`) |
|---|---|---|
| Typical FOV | `38–44 deg` | `38–46 deg` (horizontal FOV naturally ~`65–74 deg`) |
| Staging Strength | Tight vertical corridors, looming ceilings, close-up tension | Negative space on flanks (lurking silhouette at frame edge!) |
| Safe Camera Clear | Pull back `~0.5–1.0 m` on full-body shots so boots + contact shadow stay above bottom edge | Keep characters off exact dead-center; pair subject left with ominous window/doorway right |
