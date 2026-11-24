---
name: horror-3d-short
description: Use when creating a horror story video — standalone 150-300s (2.5-5 min) short (9:16 default), 8-15 min (480-900s) multi-part series (16:9 default), or quick 45-90s micro test — in Horror Engine v5.1/v9.0 (PSX Low-Poly VHS/CRT default 1A+2A+3A, story-driven CharacterBlueprints, 5-pillar Maximum Dread kit, non-repeating LocationBlueprints, 24-gate Horror Story Architect v3.0 with Tension Curve & 2D SVG Floorplans, stage.ts anatomical solver, VieNeu-TTS 48kHz single-voice lock, Openverse CC0 multi-style Jumpscare mix, and TRUE -48 dB Dead Silence).
---

# Horror 3D Story Video v5.0 (`PSX Low-Poly VHS/CRT & Maximum Dread POV`, Three.js + Remotion)

- **Workspace:** `shorts-project/` (30 fps; `9:16` `1080×1920` or `16:9` `1920×1080`; integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
- **Neutral Horror Engine v5.0:** `shorts-project/src/engine/` (**20 modules** imported via `../engine`).
- **Procedural Horror Audio DSP:** `shorts-project/audio/` (`dsp.py`, `horror_instruments.py` with **27 stereo SFX**, `mix_base.py` with **TRUE `-48 dB` Dead Silence**).
- **Automation & QA Scripts:** `shorts-project/scripts/` (`sync_workspace.py`, `horror_story.py`, `gen_horror_voice.py`, `align_manifest.py`, `validate_manifest.py`, `render-stills.mjs`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning v3.0 (`150–300s` Shorts & `8–15 min` Series — 3-round approval, World Lore, Entity 4-Stage Rules, Character Psychology/Trapped Stakes, Clues/Twist Economy, Tension Curve SVG, 2D Floorplans & 24 quality gates):** Activate `horror-story`.
- **Seamless multi-chapter production (`150–300s` Shorts via 3–5 Chapters & `8–15 min` Series via 8–15 Chapters with constant context budget):** Activate `horror-series-pipeline`.
- **Expressive multi-speaker `SCRIPT.md`, 1-file So-VITS-SVC VC-Pack (`-na`), `align_manifest.py`, shot-scale & `story.ts` timing:** Activate `horror-script-storyboard`.
- **Non-repeating 3D worlds (`LocationBlueprint`), story-driven `CharacterBlueprint`s, PSX VHS/CRT & 5 Maximum Dread pillars, POV rigs & practical lights:** Activate `horror-world-lookdev`.
- **Expressive voice DSP, TRUE `-48 dB` Dead Silence & procedural horror score/SFX mix:** Activate `horror-audio-sfx`.

## Hard Workspace, Anti-Repetition & Directing Rules (`GEMINI.md`)

1. **Strict Engine Neutrality & Zero Cross-Project Imports:** Never add story-specific rooms, ghosts, props, portraits, dialogue, or coordinates into `src/engine/`. Every project lives independently in `src/<project>/` (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx`) and registers its `<Composition />` in `src/Root.tsx`. Never import across sibling `src/<projectA>/` ↔ `src/<projectB>/`.
2. **ZERO Background & Entity Cloning (`LocationBlueprint` + `CharacterBlueprint` + `LOCATION_REGISTRY.json`):**
   - Every location must begin with a story-driven `LocationBlueprint` built from neutral modular kits in `build.ts` + 11 Albedo/BumpMap surface pairs in `paint.ts`. Unrelated videos or unrelated Parts colliding in `LOCATION_REGISTRY.json` fail with **`ANTI_REPEAT_ERROR`** unless `"sameLocationOf": "<projectId>:<locationId>"` is explicitly declared for a real narrative revisit.
   - **Story-Driven Character Appearance (ZERO Hardcoded Monster Presets):** Never force gore, sutures, dislocated jaws, or matted hair onto unrelated videos! Declare every character and entity in `manifest.json` `castBlueprints[]` matching the story's lore (`storyDescription` from `appearanceBrief` / `SCRIPT.md`), build via `createCharacterFromBlueprint(bp)` (all body-horror flags default OFF unless opted in), and pass **`ANTI_REPEAT_ENTITY_ERROR`** (`sameCharacterOf` allowed ONLY for recurring villains).
3. **Single-Source Story→Manifest→3D Spatial & Action Lock (v8.0):**
   - Start from `horror-story` v2.0 (`story.json` with `dimensions` + `landmarks[]` + `actionBeats[]` + prop state machines → pass **18 Quality Gates** + approve **2D SVG Floorplan** in `story-report.html` → `horror_story.py export-blueprint`!).
   - `manifest.json` + exported `MANIFEST` in `story.ts` are the **single source of truth** for `locations[].anchors`, `castBlueprints`, beats, spoken lines, practical lamps (`lampsOn`), per-beat `fogOverride`, cast poses/trajectories (`moveFromAnchor -> moveToAnchor`, `alignPart`), prop state machines (`fromState -> state`, `triggerWord -> triggerFrame`), and `HorrorHUD`.
   - Drive actors in `world.ts` via **`stage.ts`** (`applyManifestActors`, `alignCharacterPartTo`, `getCharacterPartWorldPos`) instead of manual `if (frame >= ...)` coordinate guesses.
   - Run `align_manifest.py` → `validate_manifest.py --script ... --words ... --cues ... --registry ...` (catching out-of-bounds anchors, intra-room teleports, prop state regressions & audio drift!) before rendering, AND inspect **100% of beat stills** (`render-stills.mjs --manifest`) via `read_file`.
4. **Render Style (`psxHorror` Default `1A+2A+3A`) & 5 Maximum Dread Opt-In Pillars:**
   - Default `renderStyle="psxHorror"` pairs angular low-poly PS1 vertex-snapped geometry, PBR BumpMaps + SSAO, 360×640 Bayer-dithered VHS/CRT post-processing, and `outlineMode: "off"` — switchable cleanly to `"semiReal"`, `"painterly"`, or `"comic"` per story.
   - Keep all characters, entities, and POV rigs on `NOINK` (layer 3) and zero 2D billboard cards or cute chibi heads. Deploy any of the 5 Maximum Dread opt-in pillars (`addCornerLurker3D`, `addSwarmingFlies3D` + Folk/Viscera dressing `addBloodHandprintDecal3D`/`addIchorPoolDecal3D`/`addTalismanPaper3D`/`addOtherworldGrimeDecal3D`/`addHauntedPortrait3D`, opt-in `bodyHorror`, 3-stage `doorwayPeek → stalkLoom → lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`, `camcorder` HUD + `fogOverride` + `RetroPsxEffect.dreadLevel`) ONLY when fitting the story.
5. **Physical Lighting (5 Presets), Practical Lights & Whip-Pan Motion Blur:**
   - Use strictly the 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), smooth `lerpLights`/`getLightBlend` transitions when lamps die, up to **6 real `PointLight`s** (`setLocalLights`) + **1 `SpotLight` cone** (`setSpotLight`), and selective HDR Bloom (`thr: 0.92`).
   - Use deterministic 6–8 frame `whipPan` turns paired with `WhipMotionBlurEffect`, and declare `WHIP_PANS` and `POV_MOTIONS` in `story.ts`.
6. **Studio-Clean Neural Voice Acting v6.0 (100% Free & Open-Source), Asset-First Real SFX & TRUE `-48 dB` Dead Silence:**
   - Author `SCRIPT.md` in **2–4 coherent Act-level paragraphs** (NEVER fragmented into 15+ choppy snippets; NEVER use distorting DSP hacks to fake whisper/tremor/stuttering!).
   - Generate clean 48 kHz Vietnamese narration via **`VieNeu-TTS v3 Turbo`** (`--tts-engine vieneu`, ONNX CPU + 3–8s emotional voice cloning `--ref-audio`/`--emotion-refs` + native `[thở dài]`/`[hắng giọng]`), OR export a GPU acting pack (`--export-gpu-voice-pack` for **`dinhthuan/index-tts-2-vietnamese`** 8-D emotion vectors / **`F5-TTS-Vietnamese`** → `--import-acts`), OR pass clean guide audio through 1-file **So-VITS-SVC (`-na`)**.
   - Prefer real recorded CC0 Foley (`sfx_manager.py fetch-freesound` / `import-local`) or GPU neural SFX (`sfx_manager.py export-sfx-pack` for **`declare-lab/TangoFlux`** & **`hkchengrex/MMAudio`**) loaded via `mix_base.load_sfx_asset(...)`, and always pass `dead_silences=load_dead_silences(words_json)` into `master_mix(...)` for TRUE `-48 dB` vacuum!

## End-to-End 11-Step Pipeline (Engine v5.0)

1. **Sync Workspace & Choose Aspect / Render Style / Blueprints:**
   - Sync templates safely in 1 command (never touches existing `src/<story>/` folders):
     ```bash
     python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo
     ```
   - Confirm `9:16` (`1080×1920`) or `16:9` (`1920×1080`), `renderStyle` (`"psxHorror"` default), unique `LocationBlueprint`(s), and story-driven `CharacterBlueprint`(s).
2. **Expressive Multi-Speaker Script (`2.7–3.2 words/s`, 55–75 s):**
   - Author `out/<project>/SCRIPT.md` with `[NARRATOR | mood=calm_omen|tense|whisper|dread|panic|cold_twist|ghost_entity]`, `[SPEAKER: NAME | voice=... | mood=... | fx=dry|room|phone|ghost]`, `[PAUSE Xs]`, `[DEAD SILENCE Xs]`, and mid-sentence `...` hesitations.
3. **Expressive Voice & Word Timings (1-File So-VITS-SVC VC-Pack or `--no-vc`):**
   - **2-Machine So-VITS-SVC Narrator Workflow (Recommended):**
     ```bash
     # Step 1 (This PC): Export 1 expressive narrator guide WAV + -na helper scripts
     python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --export-vc-pack out/<project>/vc_pack
     # Step 2 (SVC PC): Run run_svc_win.bat / run_svc_unix.sh (-na preserves F0 intonation!) -> narrator_svc_out.wav
     # Step 3 (This PC): Exact 1:1 re-assembly + character dialogue + breaths + mood EQ -> voice.wav + words.json
     python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
       --vc-pack out/<project>/vc_pack \
       --narrator-vc-wav out/<project>/vc_pack/narrator_svc_out.wav \
       --out-dir out/<project>/voice
     ```
   - *Quick preview / no SVC:* `python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice --no-vc`
4. **Author `manifest.json`, Auto-Align Frames & Validate Anti-Repetition Gates:**
   - Create `shorts-project/src/<project>/manifest.json` with `locations[]`, `castBlueprints[]`, and `beats[]`.
   - Auto-lock frames to `words.json` and validate both location & entity registries:
     ```bash
     python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
     python3 scripts/validate_manifest.py src/<project>/manifest.json \
       --script out/<project>/SCRIPT.md \
       --words out/<project>/voice/words.json \
       --registry LOCATION_REGISTRY.json \
       --update-registry \
       --still-out out/<project>/still_manifest.json
     ```
5. **Scaffold `story.ts`, `build.ts`, `world.ts`, `index.tsx` & Register in `src/Root.tsx`:**
   - `story.ts`: Export `MANIFEST`, `SHOTS` (each with valid `LightKey` + `ShotScale`), `WHIP_PANS`, `POV_MOTIONS`, `CAMS`, `OVERLAYS` (`dipBlack`, `blackout`, `lightning`, `aberration`, `flicker`, `vignettePulse`), `KICKS`, `DOF`.
   - `build.ts`: Build each unique `LocationBlueprint` into an isolated `THREE.Group` using neutral modular kits (`build.ts` + `fx3d.ts`) and 11 Albedo+BumpMap surface pairs in `paint.ts`.
   - `world.ts`: Construct actors via `createCharacterFromBlueprint(bp)`, drive `beatAt(MANIFEST, frame)` for location visibility, `beat.fogOverride`, cast poses (`doorwayPeek`/`stalkLoom`/`lungeCloseUp`), `PovRig3D` + diegetic props (`Phone3D`, `Flashlight3D`), and up to 6 `PointLight`s + 1 `SpotLight`.
6. **Mount `<ShortPlayer />` (`index.tsx`) & Typecheck:**
   - Mount `<ShortPlayer renderStyle="psxHorror" shots={SHOTS} overlays={OVERLAYS} dof={DOF} hud={hudFromManifest(MANIFEST)} background="#06060b" createWorld={...} />`.
   - Run `npm run typecheck` (`tsc --noEmit`) — must exit `0`.
7. **Procedural Horror Audio & TRUE Dead Silence (`out/<project>/audio/`):**
   - Lock picture timing first, build stems using `dsp.py` + 27 stereo SFX in `horror_instruments.py` (including `vhs_static_burst`, `flashlight_click_sputter`, `neck_crack_wet`, `fly_buzz_loop`), and master with `master_mix(voice, music, sfx, dead_silences=load_dead_silences(words_json), target_lufs=-15.0, ceil_db=-1.2)`.
8. **Mandatory Beat-by-Beat Pre-Final Still Gate (`--manifest`):**
   - Render 100% of manifest peak frames at scale `1` + Whip-Pan midpoint frames:
     ```bash
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
     REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/whip_ <whip_frames> 1
     ```
     *(On Windows PowerShell use `$env:REMOTION_TMP="D:/remotion-tmp"`.)*
   - **Open and visually inspect EVERY `.jpg` directly using `read_file`** against [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md).
9. **Final Render (Hardware GPU Auto-Detected) & Audio Mux:**
   - Optional fast draft (`--draft`, `scale 0.5`): `node scripts/render-video.mjs <CompId> out/<project>/draft.mp4 --draft`
   - Final Full HD (`--scale 1`) or QHD (`--scale 1.25` or `1.5`; NEVER `1.3333`) with automatic Linux NVIDIA `angle-egl` GPU detection + `swangle` fallback:
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

- [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) — Engine v5.0 visual standard (`psxHorror` default `1A+2A+3A`, Story-Driven `CharacterBlueprint`, 5 Maximum Dread pillars & Whip-Pan blur).
- [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) — 5 physical presets, 6 PointLights + 1 SpotLight, HDR Bloom, SSAO, per-beat `fogOverride` & 11 Albedo+BumpMap surface pairs.
- [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md) — 3-layer Script↔Frame Lock, `align_manifest.py`, Location & Entity Anti-Repetition Gates & QA checklist.
