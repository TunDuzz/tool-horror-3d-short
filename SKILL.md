---
name: horror-3d-short
description: Use when creating a standalone 55-75s horror story video (vertical 9:16 or horizontal 16:9), a haunted folklore/urban-legend/historical mystery short, or one Part of a multi-part horror series in the "3D Stylized Dark-Horror POV" style (pure-code Three.js + Remotion Engine v3 with non-chibi 3D characters, clean Inverted-Hull outlines, 1st-person POV rigs, Whip-Pan GPU motion blur, non-repeating LocationBlueprints, and SceneManifest Script-to-Frame lock).
---

# Horror 3D Story Video v3 (`3D Stylized Dark-Horror POV`, Three.js + Remotion)

Workspace: `shorts-project/` (30 fps; `9:16` `1080×1920` or `16:9` `1920×1080`; scale cleanly with integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
Neutral Horror Engine v3: `shorts-project/src/engine/` (18 modules imported via `../engine`).
Procedural Horror Audio DSP: `shorts-project/audio/` (`dsp.py`, `horror_instruments.py`, `mix_base.py`).
Automation & QA scripts: `shorts-project/scripts/` (`validate_manifest.py`, `horror_story.py`, `gen_horror_voice.py`, `render-stills.mjs`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning, 2-round outline approval, entity rules, character tiers & narrative props (before `SCRIPT.md`):** Activate `horror-story`.
- **Multi-part 8–10 min series (split into ~1 min Parts):** Activate `horror-series-pipeline`.
- **Script, voice pacing, shot scale planning & `story.ts` timing:** Activate `horror-script-storyboard`.
- **Non-repeating 3D worlds (`LocationBlueprint`), non-chibi 3D characters/entities, 1st-person POV rigs, practical lights & FX:** Activate `horror-world-lookdev`.
- **Procedural horror score, Dead Silence & SFX mix:** Activate `horror-audio-sfx`.

## Hard Workspace, Anti-Repetition & Directing Rules (`GEMINI.md`)

1. **Strict Engine Neutrality & Zero Cross-Project Imports:** Never add story-specific rooms, ghosts, props, portraits, dialogue, or coordinates into `src/engine/`. Every project lives independently in `src/<project>/` (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx`) and registers its `<Composition />` in `src/Root.tsx`. Never import across sibling `src/<projectA>/` ↔ `src/<projectB>/`.
2. **ZERO Cross-Video & Cross-Part Background Repetition (`LocationBlueprint` + `LOCATION_REGISTRY.json`):**
   - The legacy v2 "generic wooden box room + 6 forced props" pattern is **permanently banned**.
   - Every location must begin with a story-driven `LocationBlueprint` (distinct `archetype`, realistic `[width, depth, height]`, `ceilingType`, 3 `paint.ts` materials, practical lights, 3–5 hero props, `signatureShadowBeat`) built from neutral modular kits in `build.ts`.
   - Unrelated videos — and unrelated Parts of a series — MUST NEVER reuse an existing environment. `validate_manifest.py --registry LOCATION_REGISTRY.json` enforces this automatically with **`ANTI_REPEAT_ERROR`**. Only an explicit narrative revisit may set `sameLocationOf: "<projectId>:<locationId>"`.
3. **3-Layer Script↔Frame Fidelity Lock (`SceneManifest`):**
   - `manifest.json` + exported `MANIFEST` in `story.ts` are the **single source of truth** for locations, beats, spoken lines, practical lamps (`lampsOn`), cast poses/visibility, diegetic prop states (`Phone3D` clock/messages), and `HorrorHUD`.
   - `world.ts` MUST read `beatAt(MANIFEST, frame)`, `isLampLit(...)`, and `propStateOf(...)` directly — never duplicate hard-coded frame ranges that drift from the script.
   - Always pass `validate_manifest.py` before rendering AND inspect **100% of beat stills** (`render-stills.mjs --manifest`) via `read_file`.
4. **Non-Chibi 3D Dark-Horror Art & Clean Dual-Layer Outlines:**
   - Use 100% real 3D articulated characters (`createCharacter3D` — `~5.6` head-height adult proportions, sculpted jaw/nose, curved 512×512 `face2d.ts` almond eyes/pinpoint pupils, `EntityConfig` uncanny modifiers) and 1st-person POV rigs (`createPovRig3D`, `createPhone3D`, `createFlashlight3D`).
   - Keep all characters, entities, and POV rigs isolated on `NOINK` (layer 3) with smooth angle-weighted BackSide Inverted-Hull outlines (`~5–7 px`); keep architectural `InkPass` strictly on layer 0.
   - **Zero 2D billboard cards, zero cute chibi heads, zero `Pen.grit` / cross-hatching, zero `gradeGrime` film scratches, zero fake `blood` screen washes.**
5. **Physical Lighting (5 v3 Presets) & Whip-Pan Motion Blur:**
   - Use strictly the 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), smooth `lerpLights`/`getLightBlend` transitions when lamps die, up to **6 real `PointLight`s** (`setLocalLights`) + **1 `SpotLight` cone** (`setSpotLight`), and selective HDR Bloom (`thr: 0.92`).
   - Use deterministic 6–8 frame `whipPan` turns paired with `WhipMotionBlurEffect`, and declare `WHIP_PANS` and `POV_MOTIONS` in `story.ts` so `extract_shots.py` tracks them cleanly.
6. **Strict LocationGroup Isolation & Opt-In HUD:**
   - Encapsulate each `locationId` in its own `THREE.Group` toggled by `beat.locationId` in `world.update()`, reset sky/fog/lights/spotLight every frame, and enable `HorrorHUD` (`hud={hudFromManifest(MANIFEST)}`) only when requested or narratively designed.

## End-to-End 11-Step Pipeline (Engine v3)

1. **Choose Aspect, Sub-Genre & Unique `LocationBlueprint`(s):** Confirm `9:16` (`1080×1920`) or `16:9` (`1920×1080`). Design bespoke locations tailored to the story (never copy a previous video's room) and check `LOCATION_REGISTRY.json`.
2. **Script (`2.7–3.2 words/s`, 55–75 s):** Author `out/<project>/SCRIPT.md` with clear POV narrative progression, `[PAUSE Xs]` / `[DEAD SILENCE Xs]` beats, and concrete visual/prop cues.
3. **Voice & Word Timings:** Generate narrator/character `voice.wav` (48 kHz mono) + word-locked `words.json`:
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
   ```
   *(Pass `--no-vc` for plain `edge-tts` without a local VC checkpoint.)*
4. **Author `manifest.json` & Validate Script↔Frame + Anti-Repetition Gate:**
   - Create `shorts-project/src/<project>/manifest.json` locking every beat (`a`, `b`, `peakFrame`, `locationId`, `spokenLine`, `lightState`, `castStates`, `propStates`, `cameraIntent`) to `words.json`.
   - Validate before writing world code:
     ```bash
     python3 scripts/validate_manifest.py src/<project>/manifest.json \
       --script out/<project>/SCRIPT.md \
       --words out/<project>/voice/words.json \
       --registry LOCATION_REGISTRY.json \
       --update-registry \
       --still-out out/<project>/still_manifest.json
     ```
5. **Scaffold `story.ts`, `build.ts`, `world.ts`, `index.tsx` & Register in `src/Root.tsx`:**
   - `story.ts`: Export `MANIFEST`, `SHOTS` (each with v3 `LightKey` + `ShotScale`), `WHIP_PANS`, `POV_MOTIONS`, `CAMS` (`whipPan`, `povBreath`, `dolly`, `camOTS`, `camPOV`, `camECU`, `dollyZoom`), `OVERLAYS` (`dipBlack`, `blackout`, `lightning`, `aberration`, `vignettePulse`), `KICKS`, `DOF`.
   - `build.ts`: Build each unique `LocationBlueprint` into an isolated `THREE.Group` using modular neutral kits (`addWallWithOpening`, `addAFrameRoof`, `addDoubleDoorWithCracks`, `addCorridorBay`, `addStairFlight`, `addGlassOilLamp3D`, `addIncenseBurner3D`, `addFluorescentTube3D`, `addStreetLamp3D`, `addRisingSmokeWisps`, `addDustMotes`, `addVolumetricCone`) and 16 `paint.ts` textures.
   - `world.ts`: Implement `ShortWorld` (`update`, `syncLighting`, `getLightBlend`, `getMotionVelocity`, `dispose`) reading `beatAt(MANIFEST, frame)` for location visibility, cast poses (`createCharacter3D`), 1st-person `PovRig3D` + diegetic props (`Phone3D`, `Flashlight3D`), and up to 6 `PointLight`s + 1 `SpotLight`.
6. **Mount `<ShortPlayer />` (`index.tsx`) & Typecheck:**
   - Mount `<ShortPlayer shots={SHOTS} overlays={OVERLAYS} dof={DOF} hud={hudFromManifest(MANIFEST)} grainAmount={0.008} background="#06060b" createWorld={...} />`.
   - Run `npm run typecheck` (`tsc --noEmit`) — must exit `0`.
7. **Procedural Horror Audio (`out/<project>/audio/`):**
   - Lock picture timing first, then build `mix.wav` via `dsp.py`, `horror_instruments.py`, and `mix_base.py` (`-15.0 LUFS`, `<= -1.2 dBTP`, `0.35–0.85 s` Dead Silence before reveals).
8. **Mandatory Beat-by-Beat Pre-Final Still Gate (`--manifest`):**
   - Render 100% of manifest peak frames at scale `1` + Whip-Pan midpoint frames:
     ```bash
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/whip_ <whip_frames> 1
     ```
     *(On Windows PowerShell use `$env:REMOTION_TMP="D:/remotion-tmp"`.)*
   - **Open and visually inspect EVERY `.jpg` directly using `read_file`** against the Beat-by-Beat Audit Checklist in [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md). Reject and fix any script↔frame drift, hair/hand clipping, blowout, or outline defect before final render.
9. **Final Render (Hardware GPU Auto-Detected) & Audio Mux:**
   - Optional fast draft preview (`--draft`, `scale 0.5`, MSAA off): `node scripts/render-video.mjs <CompId> out/<project>/draft.mp4 --draft`
   - Final Full HD (`--scale 1`) or QHD (`--scale 1.25` or `--scale 1.5`; NEVER `1.3333`) with automatic Linux NVIDIA `angle-egl` GPU detection + graceful `swangle` fallback and automatic temp bundle cleanup:
     ```bash
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-video.mjs <CompId> out/<project>/video.mp4 --scale 1 --crf 16 --concurrency 2
     ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 out/<project>/final.mp4
     ```
10. **Post-Render Automated QA Gate:**
    ```bash
    python3 scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json
    python3 scripts/short_qa.py out/<project>/final.mp4 out/<project>/qa out/<project>/shots.json
    ```
    Confirm `0` unplanned black/white frames, `0` frozen spans `>= 12 f`, `0` unplanned `pops`, `DIRECTING_WARNS none`, zero dark readability warnings, and inspect `out/<project>/qa/sheet_*.jpg` via `read_file`.
11. **Deliver & Clean Temp Disk:**
    - Present `out/<project>/final.mp4` (or stitched `episode_full.mp4`) and delete stale `/tmp/remotion-tmp/remotion-webpack-bundle-*` and `puppeteer_dev_chrome_profile-*` folders.

## Style & Technical References

- [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) — Engine v3 visual standard, non-chibi 3D proportions, Whip-Pan blur & verified benchmark stills (`references/stills/v3_*.jpg`).
- [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) — 5 physical presets, 6 PointLights + 1 SpotLight recipes, HDR Bloom & 16 painterly textures.
- [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md) — 3-layer Script↔Frame Lock, Anti-Repetition Gate & QA checklist.
