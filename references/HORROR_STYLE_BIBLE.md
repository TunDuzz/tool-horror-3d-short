# Horror Style Bible v2 ("Gothic Ink-Noir × Shadow-Depth")

Reference standard calibrated for Horror Engine v2 (`templates/engine/`), verified across `HorrorLab` (`9:16` & `16:9`) and `MadaShort` v2.

## 1. Visual Identity ("Junji Ito × Darkest Dungeon × Silent Hill × Mike Mignola")

- **Woodcut Dip-Pen Grit & Uncanny Anatomy (`toon.ts`):** Gaunt, elongated Gothic proportions (`~4.6–5.2` heads tall, sunken cheekbones, slender neck, articulated 2-segment tapered limbs, 4-finger gaunt/clawed hands). Every contour uses deterministic dip-pen ink wobble (`Pen.grit`: `0.95` for humans, `1.55` scratchy double-ink for entities) plus dripping ichor/ink tears (`Pen.drip`). **Zero clean geometric vector lines, zero bean-heads, zero cute round `O` mouths.**
- **Uncanny Valley Entities & Expressions:**
  - Deep obsidian *Darkest Dungeon* orbital eye hollows (`#06030a`) + bloodshot veined sclera + razor-tiny pinpoint pupils + clenched-teeth terror grimaces on humans.
  - Set `uncanny: true` on supernatural entities for **asymmetric eye sizing/gaze**, **cheek-splitting Junji Ito needle-teeth grins (`eerieGrin`)**, **elongated jaw-drop voids (`jawDrop`)**, **violent neck snaps (`headTilt` + `uncannyTwitch`)**, and **stepped 6–8 fps supernatural motion (`uncannyTime`)** contrasting against smooth 30 fps human motion!
- **Extreme *Chiaroscuro* & Real Local Lighting (`lights.ts`, `shade.ts`, `cardshade.ts`):** "Island of light in an ocean of ink" — deep obsidian shadows outside tight quadratic `PointLight` pools (`setLocalLights`), `underLight` facial shadows, crisp spectral rim light, real 3D lightning (`setLightningFlash`), and distorted `fxLongShadow` floor decals (`flat: true`).
- **Hallucinatory Post-Processing & Subliminal Horror (`grade.ts`, `cast.ts`, `toon.ts`):** Radial RGB **chromatic aberration** (`{ kind: "aberration" }`), organic smoky ink-wash vignette, vintage film scratches/dust grime, double-exposure spectral trails (`pushAfterimage`), and peripheral dread FX (`fxLurkingEyes`, `fxWindowHand`, `fxFloatingAsh`).
- **3D Shadow-Depth Worlds (`build.ts` + `paint.ts`):** Crooked Gothic silhouettes (`taperedBoxGeo`, `pitchedRoofGeo`), multi-branching `addGnarledTree`, `addReedCluster`, undulating `addDistantRidge` horizons, wet mold-stained `darkPlanksHD` / `crackedPlasterHD`, **real volumetric light shafts (`addVolumetricShaft`)**, and **dark foreground silhouette framing (`addForegroundSilhouette`)**.

## 2. Dark-Screen Readability (Phone @ 50% Brightness)

- Target median shot luma: **`0.12 – 0.28`** (avoid `< 0.08` across whole shots).
- Target `p2`: **`0.012 – 0.038`** (velvet ink-black depth without muddy grey washout).
- Target `p98`: **`>= 0.45`** (driven by HDR emissives `> 1.0`, local PointLights, moon shafts, and rim lighting; `short_qa.py` flags `p98 < 0.38`).
- **Film Grain:** `grainAmount={0.018}` deterministic PCG grain smooths dark fog banding cleanly under H.264/YouTube compression.

## 3. Orientation & Framing Grammar (`9:16` vs `16:9`)

Post-processing (`InkPass`, `LensBlur`, `Bloom`, `GrainEffect`, `CARD_K.uPx`) scales automatically by `Math.min(width, height) / 1080`.

| Aspect | Framing Strength | Mandatory Staging Practices |
|---|---|---|
| **`9:16` Vertical (`1080x1920`)** | Claustrophobia, looming height, overhead branches, steep POV look-downs | Bring gnarled trees, reeds & background structures **within `x ∈ [-3.2, +3.2]`** so narrow vertical frames are never empty! Frame boots cleanly on wide shots or cut purposefully to chest-up `MCU`/`ECU`. |
| **`16:9` Wide (`1920x1080`)** | Unsettling **negative space**, dark foreground columns/doorways flanking edges | Stage protagonist in left/right third; let an ominous window, looming silhouette, or light shaft occupy the opposite third. |

## 4. Mandatory Cinematography, Acting & Transition Grammar

- **No-Repeat-Angle Rule (Zero Static Stage):** Never hold the same camera vantage across consecutive shots. Alternate purposefully across shot scales: `WS` → `OTS` (`bodyBack`) → `LOW` → `MCU` (side/3-4) → `ECU`/`POV` → `CU` (Dutch tilt) → `Reverse WS`.
- **Horror Reveal Discipline:** NEVER expose the monster clearly in Shot 1. Build dread progressively: atmospheric stillness → uncanny prop cue (`LOW`/`ECU`) → protagonist investigation (`MCU` + `dollyZoom`) → partial threat (`ECU` hand/shadow) → `[DEAD SILENCE]` → explosive reveal (`LOW` + real 3D lightning).
- **Continuous Living Animation:** Always pass `time: frame / FPS` so characters breathe, shiver (`shiver`), and sway coats/hair in the wind (`wind`). Match every script verb to a real `Action` (`creep`, `peer`, `recoil`, `lunge`, `emerge`, `flee`, `boltDoor`) and use `bodyBack` + `glance: -1 | 1` for over-the-shoulder reveals.
- **Purposeful Horror Transitions:**
  - Hard cuts ONLY when camera angle (`>= 30°`) AND/OR shot scale changes dramatically (never filter-swap jump-cuts!).
  - Use `{ kind: "dipBlack", at, dur: 12, hold: 2 }` across major location/era changes (`wharf` → `shack`).
  - Use `{ kind: "blackout", a, b }` for `[DEAD SILENCE]` pre-climax cuts, paired with `{ kind: "lightning", f }` (real 3D flash) and `{ kind: "vignettePulse" }` during creeping dread finales.
