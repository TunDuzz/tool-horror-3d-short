---
name: horror-3d-short
description: Use when creating a standalone 55-75s horror story video (vertical 9:16 or horizontal 16:9), a haunted folklore/urban-legend/historical mystery short, or one Part of a multi-part horror series in Horror Engine v5.0 (PSX Low-Poly VHS/CRT default 1A+2A+3A or semiReal/painterly/comic, story-driven CharacterBlueprints, 5-pillar Maximum Dread kit, non-repeating LocationBlueprints, expressive multi-speaker & 1-file So-VITS-SVC VC-Pack voice, TRUE -48 dB Dead Silence, and automated SceneManifest Script-to-Frame lock).
---

# Horror 3D Story Video v5.0 (`PSX Low-Poly VHS/CRT & Maximum Dread POV`, Three.js + Remotion)

- **Workspace:** `shorts-project/` (30 fps; `9:16` `1080×1920` or `16:9` `1920×1080`; integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
- **Neutral Horror Engine v5.0:** `shorts-project/src/engine/` (**20 modules** imported via `../engine`).
- **Procedural Horror Audio DSP:** `shorts-project/audio/` (`dsp.py`, `horror_instruments.py` with **27 stereo SFX**, `mix_base.py` with **TRUE `-48 dB` Dead Silence**).
- **Automation & QA Scripts:** `shorts-project/scripts/` (`sync_workspace.py`, `horror_story.py`, `gen_horror_voice.py`, `align_manifest.py`, `validate_manifest.py`, `render-stills.mjs`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning, 2-round outline approval, entity rules, `appearanceBrief`s & 14 quality gates (before `SCRIPT.md`):** Activate `horror-story`.
- **Multi-part 8–10 min series (split into ~1 min Parts with constant context budget):** Activate `horror-series-pipeline`.
- **Expressive multi-speaker `SCRIPT.md`, 1-file So-VITS-SVC VC-Pack (`-na`), `align_manifest.py`, shot-scale & `story.ts` timing:** Activate `horror-script-storyboard`.
- **Non-repeating 3D worlds (`LocationBlueprint`), story-driven `CharacterBlueprint`s, PSX VHS/CRT & 5 Maximum Dread pillars, POV rigs & practical lights:** Activate `horror-world-lookdev`.
- **Expressive voice DSP, TRUE `-48 dB` Dead Silence & procedural horror score/SFX mix:** Activate `horror-audio-sfx`.

## Hard Workspace, Anti-Repetition & Directing Rules (`GEMINI.md`)

1. **Strict Engine Neutrality & Zero Cross-Project Imports:** Never add story-specific rooms, ghosts, props, portraits, dialogue, or coordinates into `src/engine/`. Every project lives independently in `src/<project>/` (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx`) and registers its `<Composition />` in `src/Root.tsx`. Never import across sibling `src/<projectA>/` ↔ `src/<projectB>/`.
2. **ZERO Background & Entity Cloning (`LocationBlueprint` + `CharacterBlueprint` + `LOCATION_REGISTRY.json`):**
   - Every location must begin with a story-driven `LocationBlueprint` built from neutral modular kits in `build.ts` + 11 Albedo/BumpMap surface pairs in `paint.ts`. Unrelated videos or unrelated Parts colliding in `LOCATION_REGISTRY.json` fail with **`ANTI_REPEAT_ERROR`** unless `"sameLocationOf": "<projectId>:<locationId>"` is explicitly declared for a real narrative revisit.
   - **Story-Driven Character Appearance (ZERO Hardcoded Monster Presets):** Never force gore, sutures, dislocated jaws, or matted hair onto unrelated videos! Declare every character and entity in `manifest.json` `castBlueprints[]` matching the story's lore (`storyDescription` from `appearanceBrief` / `SCRIPT.md`), build via `createCharacterFromBlueprint(bp)` (all body-horror flags default OFF unless opted in), and pass **`ANTI_REPEAT_ENTITY_ERROR`** (`sameCharacterOf` allowed ONLY for recurring villains).
3. **3-Layer Script↔Frame Fidelity Lock (`SceneManifest` + `align_manifest.py`):**
   - `manifest.json` + exported `MANIFEST` in `story.ts` are the **single source of truth** for locations, cast blueprints, beats, spoken lines, practical lamps (`lampsOn`), per-beat `fogOverride`, cast poses/visibility, diegetic prop states (`Phone3D` clock/messages), and `HorrorHUD` (including opt-in `camcorder`).
   - Run `align_manifest.py` to auto-lock beat frames to `words.json`, pass `validate_manifest.py` before rendering, AND inspect **100% of beat stills** (`render-stills.mjs --manifest`) via `read_file`.
4. **Render Style (`psxHorror` Default `1A+2A+3A`) & 5 Maximum Dread Opt-In Pillars:**
   - Default `renderStyle="psxHorror"` pairs angular low-poly PS1 vertex-snapped geometry, PBR BumpMaps + SSAO, 360×640 Bayer-dithered VHS/CRT post-processing, and `outlineMode: "off"` — switchable cleanly to `"semiReal"`, `"painterly"`, or `"comic"` per story.
   - Keep all characters, entities, and POV rigs on `NOINK` (layer 3) and zero 2D billboard cards or cute chibi heads. Deploy any of the 5 Maximum Dread opt-in pillars (`addCornerLurker3D`, `addSwarmingFlies3D` + Folk/Viscera dressing `addBloodHandprintDecal3D`/`addIchorPoolDecal3D`/`addTalismanPaper3D`/`addOtherworldGrimeDecal3D`/`addHauntedPortrait3D`, opt-in `bodyHorror`, 3-stage `doorwayPeek → stalkLoom → lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`, `camcorder` HUD + `fogOverride` + `RetroPsxEffect.dreadLevel`) ONLY when fitting the story.
5. **Physical Lighting (5 Presets), Practical Lights & Whip-Pan Motion Blur:**
   - Use strictly the 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), smooth `lerpLights`/`getLightBlend` transitions when lamps die, up to **6 real `PointLight`s** (`setLocalLights`) + **1 `SpotLight` cone** (`setSpotLight`), and selective HDR Bloom (`thr: 0.92`).
   - Use deterministic 6–8 frame `whipPan` turns paired with `WhipMotionBlurEffect`, and declare `WHIP_PANS` and `POV_MOTIONS` in `story.ts`.
6. **Expressive Word-Level Voice Acting v5.5 & TRUE `-48 dB` Dead Silence:**
   - Author `SCRIPT.md` with **10 acting moods** (`calm_omen`, `curious`, `tense`, `whisper`, `fear_tremble`, `stutter_panic`, `dread`, `panic`, `cold_twist`, `ghost_entity`) + inline word/phrase director tags (`[STUTTER]` / `K-không`, `[SLOW]...[/SLOW]`, `[FAST]...[/FAST]`, `[TREMBLE]...[/TREMBLE]`, `[UP]`, `[BEAT]`, `[GASP]`, `[SWALLOW]`, `[PAUSE Xs]`, `[DEAD SILENCE Xs]`).
   - Run `gen_horror_voice.py` (`--acting cinematic`, pluggable `--tts-engine auto|edge|gemini`) with the 1-file So-VITS-SVC VC-Pack (`-na` preserves all `0.68x..1.32x` tempo swings, acoustic stutters, 6.2 Hz tremor & rising/falling F0; True Breathy Whisper Vocoder runs post-SVC), and pass `dead_silences=load_dead_silences(words_json)` into `master_mix(...)` for TRUE `-48 dB` vacuum!

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
