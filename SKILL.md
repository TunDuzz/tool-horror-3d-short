---
name: horror-3d-short
description: Make a ~55-75 s horror story video (vertical 9:16 or horizontal 16:9) in the "Uncanny Toon-Noir" 2D-characters-in-inked-3D-world style (three.js + Remotion), with 5 horror lighting presets, translucent ghosts, procedural Python horror sound design + Dead Silence pacing, and dark-aware frame QA. Use when creating a standalone horror short, a haunted folklore/urban-legend/historical mystery video, or one Part of a multi-part horror series.
---

# Horror 3D Story Video (`Uncanny Toon-Noir`, three.js + Remotion)

Workspace: `shorts-project/` (30 fps; flexible `9:16` `1080x1920` -> 2K `1440x2560` OR `16:9` `1920x1080` -> 2K `2560x1440` via `--scale 1.3333`).
Neutral engine: `shorts-project/src/engine/` (imported via `../engine`).
Horror audio DSP: `shorts-project/audio/` (`dsp.py`, `horror_instruments.py`, `mix_base.py`).
Automation & QA scripts: `shorts-project/scripts/` (`render-stills.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Multi-part 8–10 min series (split into ~1 min Parts):** Activate `horror-series-pipeline` (`bible/` + `shared/` + `parts/p01..p10/` + `CONTINUITY.json` + `stitch_parts.py`).
- **Script, voice pacing & `story.ts` timing:** Activate `horror-script-storyboard`.
- **3D set dressing, lighting, outfits & ghosts:** Activate `horror-world-lookdev`.
- **Procedural horror score, Dead Silence & SFX mix:** Activate `horror-audio-sfx`.

## Hard Workspace Rules (`GEMINI.md`)

- **Strict Engine Neutrality:** NEVER put story-specific hats, ghosts, props, monsters, buildings, or coordinates into `src/engine/`. All custom outfits/props/ghosts go in `src/<project>/toon.ts` via `Outfit` hooks (`hatBehind`, `hatOn`, `torsoDetail`, `behindBody`, `inFrontHand`).
- **Zero Cross-Project Imports:** Never import between `src/<projectA>/` and `src/<projectB>/`, and never touch `.agents/skills/cartoon-3d-short/` or `src/bachdang/`.
- **EraGroup Isolation & Frame Purity:** Wrap each distinct era/location in its own `THREE.Group` and toggle `group.visible` by `shotId`. Reset fog, sky dome (`untone`), lights (`applyLightUniforms`), `FOREGROUND` props, and hide unused `Actor` / `Fx` cards every `world.update()` call.
- **No Unrequested Subtitles:** Keep rendered frames text/caption-free unless explicitly requested by the user.

## End-to-End 11-Step Pipeline

1. **Choose Aspect & Sub-Genre:** Confirm `9:16` (`1080x1920`) or `16:9` (`1920x1080`) and sub-genre (Vietnamese folk/spiritual, Urban/Rules/Liminal, or True Historical Mystery). For historical stories, log verified facts & sources at the top of `SCRIPT.md`.
2. **Script (~2.7–3.2 words/s, 55–75 s):** Follow the 8-beat horror formula in `horror-script-storyboard` with `[DEAD SILENCE]` beats before reveals.
3. **Voice & Word Timings:** Generate narrator `voice.wav` (48 kHz mono) + word-locked `words.json` using the calibrated `ngan` deep narrator pipeline:
   ```powershell
   python scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
   ```
   (Synthesizes `vi-VN-NamMinhNeural` @ `speed=0.86` -> converts via `D:/voice-engine/models/ngan/G_1001.pth` with `--auto-predict-f0`, `parselmouth`, `noise-scale=0.30`, `medF0 ~104 Hz` -> gates `[DEAD SILENCE Xs]` spans cleanly -> aligns `words.json`; pass `--no-vc` to use plain TTS.)
4. **Scaffold Project & Shot Plan (`shorts-project/src/<project>/`):**
   - Create `story.ts`, `world.ts`, `build.ts`, `toon.ts`, `cast.ts`, `index.tsx` and register `<Composition id="<CompId>" width={1080|1920} height={1920|1080} ... />` in `src/Root.tsx`.
   - In `story.ts`: define `SHOTS` (`light: "night" | "candle" | "storm" | "eerie" | "blood"`), `XFADE`, `OVERLAYS: ScreenBeat[]` (`lightning`, `flicker`, `blackout`, `flash`), `CAMS` (`pushK`, `dollyZoom`, `handheld`, `snapZoom`, `rolled`), `KICKS`, and `DOF`.
   - Visual reactions land **0–2 frames before** trigger words in `words.json`.
5. **World (`build.ts` + `world.ts`):**
   - Follow the 3-layer Value Separation rule in `horror-world-lookdev` (background fog silhouette brighter than dark geometry; HDR emissives `> 1.0` for `Bloom`).
   - Implement `ShortWorld` with `syncLighting()` so simultaneous crossfade canvases never bleed light uniforms.
6. **Cast & 2D FX (`toon.ts` + `cast.ts`):**
   - Stage with `CastStage`, `placePerson`, `pushContactShadow`, `lidAt`, horror expressions (`terrified`, `dread`, `suspicious`, `hollow`, `unhinged`), translucent ghosts (`opacity: 0.42–0.75` away from background pillars), `unlit` eye glints, and `fxMist`/`fxRain`/`fxLightning`/`fxFlickerGlow`/`fxBreath`.
7. **Post & Player (`index.tsx`):**
   - Mount `<ShortPlayer shots={SHOTS} overlays={OVERLAYS} dof={DOF} xfade={XFADE} grainAmount={0.015} background="#070b14" createWorld={...} />`.
   - `ShortPlayer` runs `InkPass` -> `LensBlur` -> `Bloom` -> `NEUTRAL ToneMapping` -> `GradeEffect` -> subtle `GrainEffect`, automatically scaling pixel effects by `Math.min(width, height) / 1080`.
   - Run `npm run typecheck` (`npx tsc --noEmit`) before rendering.
8. **Procedural Horror Audio (`out/<project>/audio/`):**
   - Lock picture timing first, then build `mix.wav` via `dsp.py`, `horror_instruments.py`, and `mix_base.py` (`-15 LUFS`, `<= -1.2 dBTP`, `LRA ~6–10 LU`, `0.35–0.85 s` Dead Silence before reveals).
9. **Pre-Final Still Gate (MANDATORY):**
   - Render scale-0.5 stills covering **100% of shots** (plus start/mid/end on camera glides & lightning/blackout frames):
     ```powershell
     $env:REMOTION_TMP="D:/remotion-tmp"; node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ 0,90,... 0.5
     ```
   - **Open and inspect EVERY `.jpg` directly using `read_file`** against [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md). Fix any crushed darks, pillar lines cutting across ghosts, floor-sliced mist cards, or cut-off boots and re-verify before final render.
10. **Final Render & Dark-Aware QA Gate:**
    - Render Full HD (`--scale 1`, `1080x1920` / `1920x1080`) or integer-scaled QHD (`--scale 1.25` or `--scale 1.5`; avoid non-integer scales like `1.3333` which fail Remotion 4 integer dimension validation):
      ```powershell
      $env:TEMP="D:/remotion-tmp"; $env:TMP="D:/remotion-tmp"; $env:REMOTION_TMP="D:/remotion-tmp"; npx remotion render src/index.ts <CompId> out/<project>/video.mp4 --codec h264 --crf 16 --scale 1 --gl angle --concurrency 3 --timeout 180000
      ```
    - Mux audio (`-map 0:v:0 -map 1:a:0`):
      ```powershell
      ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 out/<project>/final.mp4
      ```
    - Extract shots & run frame QA:
      ```powershell
      python scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json
      python scripts/short_qa.py out/<project>/final.mp4 out/<project>/qa out/<project>/shots.json
      ```
    - Confirm `0` unplanned black frames, `0` unplanned white frames, `0` frozen spans `>= 12 f` (outside `planned_black`), `0` unplanned pops, zero `[WARN: crushed darks p98<0.35]`, and inspect `out/<project>/qa/sheet_*.jpg`.
11. **Deliver & Clean Temp Disk:**
    - Present `out/<project>/final.mp4` (and `episode_full.mp4` if stitching a series).
    - Clean obsolete `remotion-webpack-bundle-*` and `puppeteer_dev_chrome_profile-*` folders in `D:/remotion-tmp`.

## Style Bible Reference

See [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) for pacing metrics, contrast targets, camera grammar, and grain/overlay calibration.
