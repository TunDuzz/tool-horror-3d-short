# Horror Style Bible v15.0 ("Option A: GTX 960 Lightweight 3D World · 2.5D Photorealistic Cast · AI Jumpscare")

Reference visual standard calibrated for **Horror Engine v15.0** (`templates/engine/`), combining **GTX 960 low-VRAM PSX VHS/CRT 3D environments**, **2.5D photorealistic normal-mapped characters (`sprite2d.ts`)**, **7-tier Uncanny Valley ghosts (`scareTier >= 4`)**, and **First-Frame-conditioned AI Video Jumpscares (`gen_jumpscare_clip.py`)** routed through the exact same Grade + Grain + RetroPsx VHS pipeline under `HorrorHUD`.

---

## 1. Visual Render Modes & GTX 960 Low-VRAM Pipeline (`renderStyle` on `<ShortPlayer />`)

Engine v15.0 defaults to **`psxHorror` with `lowVram: true`**: disables full-res `OpaqueNormalPass`, `SSAOEffect`, and `LensBlur`; caps `BloomEffect` to `<= 3` mip levels; renders internal WebGL at `dpr: 0.45` (`0.35` draft); mounts strictly **ONE `<ThreeCanvas>`** context.

| `renderStyle` | Geometry & Shading | Post-Processing & Outlines |
|---|---|---|
| **`"psxHorror"` *(default)*** | Angular low-poly meshes (`lowPoly: true`), PS1 `vertexSnap` (`280`), 11 PBR Albedo+BumpMap surface pairs, `lowVram: true` (`dpr 0.45`, no SSAO/LensBlur). | 360×640 virtual pixel grid (`pixelScale: 3.0`), 22-level RGB quantization + 4×4 Bayer dithering, luminance-preserving CRT scanlines & subtle curvature, VHS `tapeTear` (`dreadLevel`), `outlineMode: "off"`. |
| `"semiReal"` | Smooth high-poly meshes (`lowPoly: false`), full PBR BumpMaps, clammy specular shading. | Clean cinematic HDR Bloom + subtle `0.008` grain, `outlineMode: "off"`, zero retro CRT/pixelation. |
| `"painterly"` | Smooth or sculptural 3D meshes + PBR BumpMaps. | Gritty thin outline accents (`outlineMode: "grittyThin"`), subtle brushwork grain. |
| `"comic"` | Clean stylized 3D meshes, soft wrapped cel-influenced shading. | Dual-layer outlines: bold `~5–7 px` Inverted-Hull shells on `NOINK` (layer 3) + architectural `InkPass` on layer 0. |

---

## 2. 2.5D Photorealistic Normal-Mapped Characters (`sprite2d.ts`) & 7-Tier Uncanny Ghosts (`>= Tier 4`)

- **Default `characterMode: "sprite2d"` (`gen_cast_assets.py` + `sprite2d.ts`):**
  - Automated script `gen_cast_assets.py` reads `castBlueprints[]` -> generates dark found-footage / photorealistic human & ghost cutouts (never flat cartoons) -> removes background -> synthesizes Tangent-Space Normal Maps -> saves into `src/<project>/assets/cast/`.
  - `sprite2d.ts` renders Y-axis billboards with Albedo + Normal Map + `stylizedShade` so every character receives real 3D practical lights (`PointLight`, `SpotLight`, lightning, fog) + grounded contact shadow + breathing (`scale.y`), RMS speech cadence bob, `headTwitch`, `steppedFps` (`10–12fps`), and 5 expressions (`calm`, `talk`, `fear`, `shock`, `entity_scare`).
  - Legacy `rig3d.ts` (`characterMode: "rig3d"`) remains supported for backward compatibility.
- **7-Tier Entity Scare Scale (Primary Entity MUST be `scareTier >= 4` — `ENTITY_SCARE_TIER_ERROR`):**
  - Tiers 4–7 prioritize **Uncanny Valley + high-contrast chiaroscuro** (ceiling/corner lurker, stretched unnatural smile & pinpoint gleaming eyes, elongated twitching neck/joints, motionless stare snapping into distorted lens lunge) without crude gore so videos stay YouTube/TikTok safe.
- **First-Frame-Conditioned AI Jumpscare Clips (`gen_jumpscare_clip.py`):**
  - Captures clean 3D `jumpscare_anchor_frame.png` (`render-stills.mjs --raw-anchor --png`) right before the climax, generates a 2–4s First-Frame-locked MP4 (`assets/jumpscare_<id>.mp4`), and composites it inside `ShortPlayer.tsx` BEFORE `gradeTailPass -> psxPass` so VHS grain, quantization, and `HorrorHUD` match 100%.
  - Story-driven `transitionStyle`: `first_frame_seamless`, `whip_pan_turn`, `diegetic_reveal`, or `silence_hard_cut` (never hardcoded flashlight across unrelated scripts!).

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
