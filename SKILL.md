---
name: horror-3d-short
description: Use when creating a standalone 55-75s horror story video (vertical 9:16 or horizontal 16:9), a haunted folklore/urban-legend/historical mystery short, or one Part of a multi-part horror series in the "Gothic Ink-Noir x Shadow-Depth" 2D-characters-in-inked-3D-world style (Three.js + Remotion).
---

# Horror 3D Story Video v2 (`Gothic Ink-Noir × Shadow-Depth`, Three.js + Remotion)

Workspace: `shorts-project/` (30 fps; `9:16` `1080x1920` or `16:9` `1920x1080`; scale cleanly with integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
Neutral Horror Engine v2: `shorts-project/src/engine/` (imported via `../engine`).
Procedural Horror Audio DSP: `shorts-project/audio/` (`dsp.py`, `horror_instruments.py`, `mix_base.py`).
Automation & QA scripts: `shorts-project/scripts/` (`horror_story.py`, `gen_horror_voice.py`, `render-stills.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning, 2-round outline approval, entity rules, character tiers & narrative props (before `SCRIPT.md`):** Activate `horror-story`.
- **Multi-part 8–10 min series (split into ~1 min Parts):** Activate `horror-series-pipeline`.
- **Script, voice pacing, shot scale planning & `story.ts` timing:** Activate `horror-script-storyboard`.
- **Gothic Ink-Noir 3D worlds, real local PointLights, non-box props, outfits & FX:** Activate `horror-world-lookdev`.
- **Procedural horror score, Dead Silence & SFX mix:** Activate `horror-audio-sfx`.

## Hard Workspace & Directing Rules (`GEMINI.md`)

1. **Strict Engine Neutrality & Zero Cross-Project Imports:** Never add story-specific hats, ghosts, props, buildings, or coordinates into `src/engine/`. All custom outfits/props go in `src/<project>/toon.ts` via `Outfit` hooks (`hatBehind`, `hatOn`, `torsoDetail`, `behindBody`, `inFrontHand`). Never import between sibling `src/<projectA>/` and `src/<projectB>/`.
2. **No-Repeat-Angle Rule (Zero Static Stage):** NEVER hold the same camera angle across consecutive shots. Label every shot's `scale` (`WS`, `OTS`, `LOW`, `MCU`, `ECU`, `CU`, `MS`, `POV`) and change camera vantage `>= 30°` OR switch shot scale on every cut. Never use filter-swap jump-cuts on a frozen framing.
3. **Gothic Ink-Noir Art & Non-Box Worlds:** Never build flat-horizon Lego box sets. Use `taperedBoxGeo`, `pitchedRoofGeo`, `addGnarledTree`, `addReedCluster`, `addDistantRidge`, `addStormLantern3D`, `addSampanHull`, `addVolumetricShaft`, and `addForegroundSilhouette` (toggled on wide shots).
4. **Action-to-Narration Binding & Uncanny Motion Mismatch:** Never leave characters statue-frozen in `idle`. Pass `time: frame / FPS`, `shiver`, `wind`, and `underLight` on humans (smooth 30 fps), while driving supernatural entities with `uncanny: true`, stepped **`uncannyTime(frame, 4)`** (6–8 fps), violent 2-frame **`uncannyTwitch(...)`** neck snaps (`headTilt`), `jawDrop`, and **`pushAfterimage(...)`** double-exposure trails. Bind every script verb to a matching `Action` (`creep`, `peer`, `recoil`, `lunge`, `emerge`, `flee`, `boltDoor`) and use `bodyBack` + `glance: -1 | 1` for over-the-shoulder reveals.
5. **Horror Reveal Discipline & Subliminal Dread:** Never spoil the main monster/ghost clearly in Shot 1 (Cold Hook) — plant subtle peripheral cues instead (`fxLurkingEyes` in dark reeds/windows, `fxWindowHand` pressed on dark glass, upward-drifting `fxFloatingAsh`, distorted `fxLongShadow`). Escalate: atmosphere + subliminal cue → uncanny prop (`LOW`/`ECU`) → investigation (`MCU` + `underLight`) → partial threat (`ECU`) → `[DEAD SILENCE]` → climax reveal (`LOW` + real 3D lightning + `{ kind: "aberration" }`).
6. **Real PointLights & Perspective-Locked Decals:** Always pair visible lanterns/lamps/windows with real `setLocalLights(...)` (max 3), rely on `ShortPlayer`'s automatic 3D lightning flash (`lightningAt`), and ALWAYS use `pushFlatDecal(...)` (`flat: true`) for water ripples, mud footprints, and ground markings.
7. **EraGroup Isolation & No Unrequested Subtitles:** Toggle each era's `THREE.Group` visibility cleanly in `world.update()`, reset sky/fog/lights/local lights every frame, and render frames caption-free unless explicitly requested.

## End-to-End 11-Step Pipeline

1. **Choose Aspect & Sub-Genre:** Confirm `9:16` (`1080x1920`) or `16:9` (`1920x1080`) and sub-genre (Vietnamese folk/spiritual, Urban/Rules/Liminal, or True Historical Mystery). Log verified facts at the top of `SCRIPT.md` for historical stories.
2. **Script (`2.7–3.2 words/s`, 55–75 s):** Follow the 8-beat horror formula in `horror-script-storyboard` with `[PAUSE Xs]` and `[DEAD SILENCE Xs]` directives before reveals.
3. **Voice & Word Timings:** Generate narrator `voice.wav` (48 kHz mono) + word-locked `words.json`:
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
   ```
   *(Uses `vi-VN-NamMinhNeural` @ `speed=0.86` -> optional So-VITS-SVC `ngan` clone -> exact `[DEAD SILENCE]` gating -> `words.json`; pass `--no-vc` for plain `edge-tts` without a local VC checkpoint.)*
4. **Scaffold Project & Cinematic Shot Plan (`shorts-project/src/<project>/`):**
   - Create `story.ts`, `world.ts`, `build.ts`, `toon.ts`, `cast.ts`, `index.tsx` and register `<Composition />` in `src/Root.tsx`.
   - Plan **distinct shot scales & angles** in `story.ts`: `SHOTS` (each with `light` + `scale`), `OVERLAYS` (`lightning`, `flicker`, `blackout`, `dipBlack`, `vignettePulse`, `aberration`, `flash`), `CAMS` (`camOTS`, `camArc`, `camPOV`, `camECU`, `dollyZoom`, `handheld`, `snapZoom`, `rolled`), `KICKS`, and `DOF`.
   - Land visual reactions **0–2 frames before** trigger words in `words.json`.
5. **World (`build.ts` + `world.ts`):**
   - Build non-box Gothic `EraGroup`s with undulating `addDistantRidge` horizons (in every camera direction!), gnarled trees/reeds placed inside horizontal FOV, volumetric light shafts, and dark foreground silhouettes on wide shots.
   - Implement `ShortWorld` with `syncLighting()` updating `applyLightUniforms` AND `setLocalLights(...)`.
6. **Cast & Perspective-Locked FX (`toon.ts` + `cast.ts`):**
   - Style characters with Gothic Ink-Noir `Outfit`s (`build: "adult" | "elder" | "gaunt" | "kid"`, `tattered`, `coatLen`, `eyeGlow`, `ageLines`, custom `Outfit` hooks).
   - Stage with `placePerson` (3 views: `front`, `side`, `back` + `glance`), horror `Action`s, `pushContactShadow`, `pushFlatDecal` (`fxWaterRipple`, `fxWetFootprints`), and feathered `fxMist`/`fxRain`/`fxLightning`/`fxFlickerGlow`/`fxBreath`.
7. **Post & Player (`index.tsx`):**
   - Mount `<ShortPlayer shots={SHOTS} overlays={OVERLAYS} dof={DOF} xfade={XFADE} grainAmount={0.026} background="#06080f" createWorld={...} />`.
   - Run `npm run typecheck` (`tsc --noEmit`) before rendering.
8. **Procedural Horror Audio (`out/<project>/audio/`):**
   - Lock picture timing first, then build `mix.wav` via `dsp.py`, `horror_instruments.py`, and `mix_base.py` (`-15.0 LUFS`, `<= -1.2 dBTP`, `0.35–0.85 s` Dead Silence before reveals).
9. **Art Director's Pre-Final Still Gate (MANDATORY):**
   - Render scale-0.5 stills covering **100% of shots** (plus lightning/blackout/action peak frames):
     ```bash
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ 90,340,... 0.5
     ```
     *(On Windows PowerShell use `$env:REMOTION_TMP="D:/remotion-tmp"`.)*
   - **Open and inspect EVERY `.jpg` directly using `read_file`** against the Art Director's Rejection Checklist in [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md). Reject and re-engineer any repeated camera angle, empty horizon, statue pose, broken decal perspective, or fake lighting before final render.
10. **Final Render & Dark/Directing-Aware QA Gate:**
    - Render Full HD (`--scale 1`) or QHD (`--scale 1.25` or `--scale 1.5`; NEVER non-integer `--scale 1.3333`):
      ```bash
      REMOTION_TMP=/tmp/remotion-tmp npx remotion render src/index.ts <CompId> out/<project>/video.mp4 --codec h264 --crf 16 --scale 1 --gl angle --concurrency 3 --timeout 180000
      ```
    - Mux audio (`-map 0:v:0 -map 1:a:0`):
      ```bash
      ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 out/<project>/final.mp4
      ```
    - Run automated QA:
      ```bash
      python3 scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json
      python3 scripts/short_qa.py out/<project>/final.mp4 out/<project>/qa out/<project>/shots.json
      ```
    - Confirm `0` unplanned black/white frames, `0` frozen spans `>= 12 f`, `0` unplanned `pops`, `DIRECTING_WARNS none`, zero `[WARN: crushed darks]` / `[WARN: too dark]`, and inspect `out/<project>/qa/sheet_*.jpg`.
11. **Deliver & Clean Temp Disk:**
    - Present `out/<project>/final.mp4` (or stitched `episode_full.mp4`) and delete stale `remotion-webpack-bundle-*` / `puppeteer_dev_chrome_profile-*` temp folders.

## Style Bible Reference

See [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) for Gothic Ink-Noir × Shadow-Depth standards, framing grammar, and directing rules.
