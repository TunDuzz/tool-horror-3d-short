---
name: horror-world-lookdev
description: Build moody inked 3D horror worlds, EraGroups, lighting/fog presets (night, candle, storm, eerie, blood), HDR emissive light pools, translucent ghosts (opacity), horror Outfit hooks, and 2D atmospheric FX (fxMist, fxRain, fxLightning, fxFlickerGlow, fxBreath) in Three.js + Remotion. Use when designing 3D environments, lighting, characters, or visual FX for horror shorts and series.
---

# Horror World & Character Look-Dev ("Uncanny Toon-Noir")

All custom horror outfits, props, ghosts, and environments stay strictly inside `shorts-project/src/<project>/` (or `src/<episode>/shared/`) — never put project assets into `src/engine/` (`GEMINI.md`).

## 1. Three-Layer Value Separation (Anti-Muddy-Dark Rule)

Never build an all-black room. Separate depth planes into 3 distinct brightness bands so silhouettes pop even at 50% phone brightness:
1. **Foreground Character (`charGain 0.62–0.68`):** Dark desaturated wardrobe (`#252a34`, `#3d4656`, `#4a282c`) contrasted with crisp `#241726` plum ink outlines and muted rim light (`rimCol`).
2. **Midground Architecture (`Batch` + `lam()`/`phong()`):** Weathered stone, dark timber, cobbles (`#4d524c`–`#857f7a`) plus **HDR emissive anchors** (`color.multiplyScalar(1.8..2.6)` with `toneMapped: false`) such as warm windows, oil lanterns, or buzzing ceiling tubes that catch `Bloom`.
3. **Background & Fog Silhouette (`fogNear 8–14 m`, `fogFar 65–125 m`):** Keep horizon sky & fog slightly brighter/tinted (`#1a2b48`, `#233340`, `#162a2a`, `#330e15`) than shadowed solid geometry so roof ridges, crooked trees, tombstones, and doorways carve clean silhouettes.

## 2. `EraGroup` & Named `ANCHORS`

- Wrap each distinct location (courtyard, hallway, ancestral room, flashback) in its own `THREE.Group` and toggle `group.visible` inside `world.update()`.
- Always reset sky dome (`untone`), fog (`untone`), `applyLightUniforms(LIGHTS[s.light], LOOK[s.light])`, HDR emissive flicker (`flickerAt(frame, ...)`), and unused `Actor`/`Fx` visibility on every `world.update()`.
- Keep `FOREGROUND` props `>= 2.0 m` from the camera lens and validate same-era sight lines via `inTheWay(rays, ...)`.

## 3. Horror Cast & Translucent Ghosts (`src/<project>/toon.ts` + `cast.ts`)

- **Horror Expressions (`Expr`):** `suspicious`, `dread` (under-eye circles), `terrified` (scream + sweat bead), `hollow` (empty dark eye sockets, unblinking), `unhinged` (pinpoint pupils + wide toothy grin).
- **Custom Horror Props & Silhouettes via `Outfit` Hooks:**
  - `inFrontHand`: handheld lantern, flashlight, candle, umbrella, key.
  - `hatBehind` / `hatOn`: shrouded hoods, wet hair strands, conical hats (`nón lá`), veiled silhouettes.
  - `torsoDetail`: tattered hems, coat lapels, blood-stain/mud flecks, traditional collar patterns.
- **Translucent Ghosts (`Place.opacity`):** Set `opacity: 0.42–0.75` on `Place`.
  - **Crucial InkPass Placement Rule:** Because `InkPass` runs after `RenderPass` and checks `tMainDepth` (which translucent `depthWrite: false` sprites do not write), **stage translucent ghosts inside open doorways, rooms, or gaps—not straddling high-contrast background pillars**, otherwise background world ink lines draw cleanly across the ghost's face.
- **Glowing Eyes / Lamps (`Place.unlit`):** Set `unlit: true` when an entity/silhouette should ignore shade falloff (e.g., glowing eyes in total shadow).

## 4. 2D Atmospheric FX (`src/engine/toon.ts`)

- `fxMist(p, t, col)`: Place center `y >= h * 0.48` so the `y = 0` ground plane never slices a hard line across the mist card.
- `fxRain(p, t, slant, col)`: Fine diagonal rain streaks (`soft: true`).
- `fxLightning(p, seed, col)`: Distant forked sky bolt synced to `{ kind: "lightning", f }` overlay.
- `fxFlickerGlow(p, intensity, rgb)`: Soft radial light pool (`soft: true`) driven by `flickerAt(frame, seed)`.
- `fxBreath(p, t, dir)`: Pass `dir = view.mirror ? -1 : 1` and offset `x` in `dir` so breath vapor always leaves forward from the mouth.

## Lighting & Palette Tables

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) for the full calibrated 5-preset parameter reference and `9:16` vs `16:9` framing values.
