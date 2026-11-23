---
name: horror-world-lookdev
description: Use when designing 3D Gothic horror environments, EraGroups, real local PointLights, non-box architecture/nature, foreground Shadow-Depth silhouettes, Gothic Ink-Noir characters/ghosts, or perspective-locked 2D FX in Three.js + Remotion.
---

# Horror World & Character Look-Dev v2 (`Gothic Ink-Noir × Shadow-Depth`)

All project outfits, ghosts, and 3D environments stay strictly inside `shorts-project/src/<project>/` (or `src/<episode>/shared/`) — never put story-specific code into `src/engine/` (`GEMINI.md`).

## 1. Three-Layer Shadow-Depth Value Separation (No Flat Horizons, No Lego Boxes)

Every exterior and interior frame must build **4 tangible depth layers** so silhouettes read powerfully at 50% phone brightness:
1. **Near Foreground Silhouette (`addForegroundSilhouette`):** Ultra-dark (`#050409`) overhanging gnarled branches, reeds, doorway jambs, or roof rafters framing edges of wide shots (`toggle visible` off during close-ups so they never block faces!).
2. **Subject Plane (`charGain 0.68–0.70` + `setLocalLights`):** Gaunt Gothic Ink-Noir characters (`~4.8` heads tall, cross-hatched coats, shadowed eye sockets) sculpted by real nearby `PointLight`s (handheld lantern, oil lamp) plus directional rim light (`rimCol`).
3. **Midground Gothic Architecture (`build.ts`):** Ban stacked rectangular Lego boxes! Use:
   - `taperedBoxGeo` (sloping/crooked walls, posts, gravestones) & `pitchedRoofGeo` (real gabled eaves)
   - `addGnarledTree` (multi-branching twisted limbs + claw twigs placed **within horizontal camera FOV**, e.g. `x ∈ [-3.2, +3.2]` for `9:16`!)
   - `addReedCluster`, `addHyacinthCluster`, `addSampanHull`, `addStormLantern3D`
   - `addVolumetricShaft` (angled soft moonbeams or window light shafts cutting through mist)
   - Gothic HD painters (`darkPlanksHD`, `mudBankHD`, `crackedPlasterHD`, `horrorCloudHD` — never bright cartoon `grass()` or puffy `cloudHD()`!).
4. **Distant Silhouette & Luminous Fog (`addDistantRidge`, `fogNear 6–7 m`, `fogFar 46–68 m`):** Place undulating treeline/hill ridges in **every camera direction** (both front and reverse angles!) against tinted horizon fog so the background is NEVER a straight flat bar.

## 2. Real Dynamic PointLights & 3D Lightning (`shade.ts` + `cardshade.ts`)

- Always call `setLocalLights([...])` (up to 3 lights) in BOTH `world.update()` and `world.syncLighting()`:
  - Attach a warm `PointLight` to every handheld lantern, table oil lamp, candle, or glowing window so light genuinely falls across the character's face, coat, wood planks, and water!
- `ShortPlayer` automatically drives `setLightningFlash(lightningAt(overlays, frame))` so `{ kind: "lightning", f }` illuminates 3D meshes, water, and characters with cold blue-white storm contrast (never opaque white HTML washes).

## 3. Uncanny Ink-Noir Cast, 3 Views & Motion Mismatch (`src/<project>/toon.ts` + `cast.ts`)

- **Builds & Uncanny Mode (`Outfit`):** `"adult"` (gaunt tall), `"elder"` (stooped, `ageLines: true`), `"gaunt"` + **`uncanny: true`** (for supernatural entities: scratchy double-ink `Pen.grit = 1.55`, asymmetric eye sizing/gaze, cheek-splitting Junji Ito needle-teeth grins, elongated `jawDrop`, ichor `Pen.drip` tears, hyper-elongated clawed arms, `tattered: true` & `eyeGlow`), `"kid"`.
- **Horror Expressions (`Expr`):** `stoic`, `wary`, `suspicious`, `uneasy`, `dread`, `terrified` (obsidian orbital hollows, bloodshot veined pinpoint eyes, clenched-teeth scream grimace — zero cute round `O` mouths), `hollow` (pitch-black void sockets + dripping ichor + stretched jaw), `unhinged` (Junji Ito wide needle-teeth grin), `possessed` (glowing slits).
- **3 True Views (`viewOf` / explicit override):** `front` (with `facing: -1 | 0 | 1`), `side` (angular Gothic profile + IK legs), AND **`back`** (`bodyBack` with optional **`glance: -1 | 1`** over-the-shoulder profile turn for OTS shots & twist reveals!).
- **Uncanny Motion Mismatch (`camera.ts` + `PoseOpts`):**
  - Humans run smooth 30 fps (`time: frame / FPS`, `shiver`, `wind`, `underLight` when peering down with a lantern).
  - Supernatural entities run **stepped 6–8 fps (`uncannyTime(frame, 4)`)**, violent 2-frame neck snaps (`headTilt: 24 + uncannyTwitch(frame, ...)`), `jawDrop: 0.7..0.95`, and hallucinatory double-exposure trails (**`pushAfterimage(...)`**)!
- **Translucent Ghosts (`Place.opacity`):** Stage `opacity: 0.48–0.88` apparitions in open doorways, water, or fog voids — never straddling sharp background pillar edges (`InkPass` depth rule).

## 4. Perspective-Locked Decals, Chiaroscuro Shadows & Subliminal 2D FX (`cast.ts` + `toon.ts`)

- **MANDATORY `pushFlatDecal(...)` (`flat: true`):** ALWAYS use `pushFlatDecal` for water ripples (`fxWaterRipple`), wet mud footprints (`fxWetFootprints`), distorted elongated shadows (**`fxLongShadow`**), puddles, and ground runes — NEVER mount them as vertical camera-facing billboards!
- **Subliminal Peripheral Horror FX:** Plant **`fxLurkingEyes`** deep in dark reeds/trees/windows on early shots, **`fxWindowHand`** pressed outside dark glass behind unsuspecting characters, and gravity-defying upward **`fxFloatingAsh`** on `eerie`/`blood` beats.
- **Hallucinatory Post-Processing (`grade.ts` + `camera.ts`):** Trigger radial RGB chromatic aberration surges via `{ kind: "aberration", a, b, strength, pulse: true }` (pairs with built-in smoky ink-wash vignette & analog film scratches).
- **`fxMist` / `fxRain` / `fxBreath`:** Feathered mist above floor (`y >= deckY + 0.55`), needle-sharp translucent storm rain, curling breath vapor (`dir = view.mirror ? -1 : 1`).
- **Key 3D Props:** Prefer real 3D meshes (`conicalHat`, animated `doorCrossbar`, `Strand` rope, `addStormLantern3D`) over flat 2D stickers whenever a prop interacts closely with 3D geometry.

## Lighting & Palette Reference

See [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) for the calibrated 5-preset parameter tables and PointLight recipes.
