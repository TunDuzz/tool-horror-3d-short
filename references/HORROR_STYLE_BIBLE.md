# Horror Style Bible v5.0 ("PSX Low-Poly VHS/CRT & Maximum Dread POV")

Reference visual standard calibrated for **Horror Engine v5.0** (`templates/engine/`), combining **PS1/PSX low-poly VHS/CRT dread (`1A+2A+3A`)**, **story-driven `CharacterBlueprint` anatomy**, and **5 opt-in Maximum Dread pillars** across radically distinct non-repeating environments (`ruralFuneralRoom`, `hospitalCorridor`, `foggyVillageAlley`).

---

## 1. Visual Render Modes (`renderStyle` on `<ShortPlayer />`)

Engine v5.0 supports 4 clean deterministic visual modes selectable per story, defaulting to **`psxHorror`**:

| `renderStyle` | Geometry & Shading | Post-Processing & Outlines |
|---|---|---|
| **`"psxHorror"` *(default)*** | Angular low-poly meshes (`lowPoly: true`), PS1 `vertexSnap` (`280`), 11 PBR Albedo+BumpMap surface pairs, SSAO contact darkening, wrapped practical lighting. | 360×640 virtual pixel grid (`pixelScale: 3.0`), 22-level RGB quantization + 4×4 Bayer dithering, luminance-preserving CRT scanlines & subtle barrel curvature, VHS horizontal tracking wave + razor-thin `tapeTear` tracking band (`dreadLevel`), `outlineMode: "off"`. |
| `"semiReal"` | Smooth high-poly meshes (`lowPoly: false`), full PBR BumpMaps + SSAO, clammy specular shading. | Clean cinematic HDR Bloom + subtle `0.008` grain, `outlineMode: "off"`, zero retro CRT/pixelation. |
| `"painterly"` | Smooth or sculptural 3D meshes + PBR BumpMaps + SSAO. | Gritty thin outline accents (`outlineMode: "grittyThin"`), subtle brushwork grain. |
| `"comic"` | Clean stylized 3D meshes, soft wrapped cel-influenced shading. | Dual-layer outlines: bold `~5–7 px` Inverted-Hull shells on `NOINK` (layer 3) + clean architectural `InkPass` on layer 0. |

---

## 2. Story-Driven 3D Characters & Uncanny Entities (`CharacterBlueprint`)

- **100% Real 3D Articulated Characters — ZERO 2D Billboards, ZERO Cute Chibi (`rig3d.ts`, `face2d.ts`, `bodyHorror.ts`):**
  - Human characters use **non-chibi adult horror proportions (`~5.6–6.0` head heights)** with sculpted angular jaws, 3D nose bridges, ears, sloping shoulder yokes, 3D garment collars/belts, UV garment folds, and 20 named articulation sockets.
  - Curved spherical-patch 512×512 2D face decals (`face2d.ts`) draw clean **sharp almond eyes, contracted pinpoint horror pupils, subtle under-eye hollows, furrowed brows, and restrained tense mouths** (`calm`, `wary`, `uneasy`, `dread`, `terrified`, `deadStare`, `unsettlingSmile`, `hollow`) with deterministic `autoBlink` and Vietnamese vowel-aware `mouthFromWords`.
- **ZERO Hardcoded Monster Templates — Strictly Driven by Story Lore:**
  - Every actor and supernatural entity MUST be declared in `manifest.json` `castBlueprints[]` with `storyDescription` lifted from the story's `appearanceBrief` / `SCRIPT.md`, and instantiated via **`createCharacterFromBlueprint(bp)`**.
  - **All visceral/body-horror flags default OFF (`false`/`0`)** and are toggled ONLY when matching the story:
    - *Ordinary human / ghost / quiet specter:* Clean `createCharacter3D` proportions, zero gore flags.
    - *Pitch-black faceless silhouette:* `silhouetteMode: true`, `eyeGlow: true`, `breathing: false`, zero body-horror gore.
    - *Visceral folklore / corpse entity (when story calls for it):* Opt-in `bodyHorror` flags (`skullHollows`, `jawDrop3D`, `crookedTeeth`, `neckStretch`, `exposedRibs`, `protrudingSpine`, `clawHands`, `twistedJoints`, `extraArms`, `cadaverSkin`, `bloodStainLevel`, `eyeHorror`, `cheekSplitGrin`, `tatteredCloth`, plus v5.0 opt-ins `mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`).
- **Outline Layer Discipline (`NOINK`):** All characters, entities, and POV rigs stay isolated on layer 3 (`NOINK`) so architectural passes never double-outline actors.

---

## 3. The 5 Maximum Dread Pillars (100% Opt-In Per Beat)

1. **Pillar A — Peripheral Lurkers (`addCornerLurker3D`):** Subtle half-hidden figures peeking at window sills, dark doorways, or foggy alley corners inside `9:16` portrait FOV (`±16–20°`).
2. **Pillar B — Environmental Decay & Folk/Viscera Dressing (`addSwarmingFlies3D`, `addBloodHandprintDecal3D`, `addIchorPoolDecal3D`, `addTalismanPaper3D`, `addOtherworldGrimeDecal3D`, `addHauntedPortrait3D`):** Erratic buzzing fly clouds, haunted shifting ancestral portraits, and grounded rot/talisman decals (`NOINK`).
3. **Pillar C — Story-Driven Visceral Anatomy (`mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`):** Oil-slicked parted hair exposing one bloodshot eye, surgical sutures, orbital shadow bruising.
4. **Pillar D — 3-Stage Escalating Stalk & Lunge (`doorwayPeek → stalkLoom → lungeCloseUp`):** Slow doorway head-crane into open threshold (never leaning into solid wall!) → stepped-FPS (`8–10 fps`) stiff stalking approach (+ `jacobsLadderTwitch` / `torchMalfunction`) → sudden jaw-snapping foreground lunge.
5. **Pillar E — Analog Camcorder HUD, Creeping Fog & Tape-Tear Surges:** Opt-in `hud.camcorder` (`● REC`, ticking timecode, VHS label), per-beat `fogOverride` pulling darkness inward, and razor-thin `RetroPsxEffect.dreadLevel` / `aberration` tape tracking surges positioned cleanly away from the monster's eyes.

---

## 4. 1st-Person POV Immersion & Practical Lighting

- **POV Rig (`povRig.ts`):** Visible seated knees or standing legs on downward tilts (`POV_DOWN`) + camera-aligned forearms gripping physical 3D props: `Phone3D` (live Canvas2D lockscreen + HDR Bloom + local `PointLight` synced to `HorrorHUD`), `Flashlight3D` (real GPU `SpotLight` + soft volumetric cone), `HandheldOilLamp3D`, and `PaperProp3D`.
- **Physical Lighting (`lights.ts`, `shade.ts`):** Strictly 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), up to **6 real `PointLight`s + 1 `SpotLight` + soft directional shadows + SSAO + selective HDR Bloom (`0.92`)**. Zero fake crimson screen washes or muddy overlay scratches.

---

## 5. Dark-Screen Readability Targets (Phone @ 50% Brightness)

Calibrated across both `psxHorror` (luminance-preserving phosphor scanline gain) and `semiReal` modes (`short_qa.py` verified on `HorrorLabV3Vertical` 300-frame Full HD GPU render):

| Scene Type | Target Luma `mean` | Target `p2` (shadow floor) | Target `p98` (practical highlight) |
|---|---|---|---|
| Warm practical interior (`warmLamp`) | `0.14 – 0.30` | `0.020 – 0.040` | `0.65 – 0.97` |
| Lights-out moonlight (`coldMoon`) | `0.068 – 0.120` | `0.018 – 0.038` | `0.36 – 0.58` |
| Institutional hall (`fluorescent` + `flashlight`) | `0.15 – 0.24` | `0.030 – 0.050` | `0.48 – 0.75` |
| Foggy exterior night (`duskFog`) | `0.11 – 0.18` | `0.026 – 0.050` | `0.36 – 0.65` |

- `short_qa.py` enforces dark readability floors (`p98 >= 0.34`, `mean >= 0.065`) so deliberate lights-out scenes stay haunting yet legible on mobile screens.

---

## 6. Orientation & Cinematography Grammar (`9:16` vs `16:9`)

- **Aspect-Invariant Post-Processing:** `RetroPsxEffect`, `SSAO`, `InkPass`, `LensBlur`, `WhipMotionBlurEffect`, `Bloom`, and `GrainEffect` scale automatically across `1080×1920` (`9:16`) and `1920×1080` (`16:9`).
- **`9:16` Framing:** Keep walls, alleys (`~4.0–4.4 m` wide), corridors (`~2.8 m`), practical lamps, and peripheral lurkers within `±16–20°` horizontal FOV so nothing sits outside frame.
- **Shot Scales & Whip-Pan Blur:** Label every shot with `ShotScale` (`POV`, `POV_PROP`, `POV_TURN`, `POV_DOWN`, `POV_CU`, `WS`, `MS`, `OTS`, `MCU`, `CU`, `ECU`, `LOW`). Pair 6–8f `whipPan` turns with `WhipMotionBlurEffect` and declare `WHIP_PANS` / `POV_MOTIONS` in `story.ts`.
- **Purposeful Transitions:** Use `dipBlack` across location/time jumps, `blackout` for `[DEAD SILENCE]` beats, `aberration` for VHS `tapeTear` surges, and `getLightBlend` for smooth lamp-death transitions (`warmLamp → coldMoon`).
