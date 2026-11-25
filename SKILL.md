---
name: horror-3d-short
description: Use when creating a horror story video — standalone 55-90s viral short or 150-360s multi-chapter story (9:16 default), or 8-16 min multi-part series (16:9 default) — in Horror Engine v14.0 (Single-Source pipeline_constitution.json, Viral 1-5s Cold Hook via cameraMode "cold_hook" into Anchored POV-First 2A, Whisper Forced Word Alignment <35ms 1B + shotsFromManifest, crisp 2.55-3.05 w/s effective / 3.15-3.45 w/s spoken oral Vietnamese folklore with regional grit & platform_safe_raw language, VieNeu-TTS 48kHz --speaker-lock, Openverse CC0 mix_cues.py --strict, and TRUE -48 dB Dead Silence / Uncanny Hush).
---

# Horror 3D Story Video v14.0 (`Viral Cold Hook · Crisp Oral Voice · Psychological Soundscape`, Three.js + Remotion)

- **Single Source of Truth (`5B`):** `templates/pipeline_constitution.json` (`v14.0.0`, synced to `shorts-project/pipeline_constitution.json` — governs all 6 skills, Python scripts, and TypeScript engine modules).
- **Workspace:** `shorts-project/` (30 fps; `9:16` `1080×1920` or `16:9` `1920×1080`; integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
- **Neutral Horror Engine v12.0:** `shorts-project/src/engine/` (**21 modules** including `sceneAudit.ts` imported via `../engine`).
- **Crisp Oral Voice & Narrative Soundscape v14.0:** `shorts-project/audio/` + `scripts/{prepare_emotion_refs.py, gen_horror_voice.py, sfx_manager.py, mix_cues.py}` (Pure-Vietnamese 8-mood horror bank + `VieNeu-TTS --speaker-lock` crisp spoken cadence `3.15–3.45 w/s`, `0.05s` Cold Hook entry, clause-level prosody `[BEAT Xs]`/`[PACE]`/`[PITCH]`/`[PROX=close]` + 25-voice NPC auto-casting + `<35ms` forced word alignment + Dual-Layer Occluded Beds + Rhythmic `motifs[]` + 4-Zone Binaural Space + `[SILENCE_DROP Xs]` Uncanny Hush + `0` Jumpscares by default at `-16.0 LUFS`).
- **Automation & QA Scripts:** `shorts-project/scripts/` (`sync_workspace.py`, `constitution.py`, `horror_story.py`, `gen_horror_voice.py`, `align_manifest.py`, `validate_manifest.py`, `render-stills.mjs`, `audit_storyboard.py`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning v3.2 (Viral `55–90s` Shorts & `2.5–10 min` Deep Stories — 1–5s Cold Hook, Khẩu ngữ truyền miệng 3 miền + `platform_safe_raw`, World Lore, Entity Rules, Clues/Twist Economy, 2D Floorplans & 26 quality gates including Gate 26):** Activate `horror-story`.
- **Seamless multi-chapter production (`150–360s` Shorts via 3–5 Chapters & `8–16 min` Series via 8–15 Chapters with constant context budget):** Activate `horror-series-pipeline`.
- **Expressive colloquial `SCRIPT.md` (0.05s Cold Hook, `align_manifest.py`, shot-scale & `story.ts` timing):** Activate `horror-script-storyboard`.
- **Non-repeating 3D worlds (`LocationBlueprint`), story-driven `CharacterBlueprint`s, PSX VHS/CRT & 5 Maximum Dread pillars, POV rigs & practical lights:** Activate `horror-world-lookdev`.
- **Expressive voice DSP, Uncanny Hush & procedural horror score/SFX mix:** Activate `horror-audio-sfx`.

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
4. **Anchored POV-First Cinema Grammar (`2A`), Cold Hook & Phrase-Locked Shots (`1B`):**
   - **Cold Hook `cold_hook` -> Master Establishing (`MASTER_ESTABLISHING_ERROR`):** Do NOT start `SCRIPT.md` with silent `[VISUAL 2.6s]` dead air! Shot #1 enters immediately on `cameraMode: "cold_hook"` (`<= 180 frames`, first word `<= 0.45s` + diegetic sound cue) and hands off immediately to Shot #2 `cameraMode: "master"` (`>= 60 frames`, `camMasterEstablish`) revealing full room architecture with **Zero Black Void** (`lights.ts` lifted `shade/lift` + `fogNear/fogFar`).
   - **80–90% Continuous Anchored POV + Strict 180° Axis (`AXIS_180_VIOLATION_ERROR`, `POV_PINGPONG_ERROR`):** Stay anchored inside the protagonist's eyes using `camPovChain()` smooth head-turn/eyeline scans (never cut to floating props in a black void; never flip 180° into the protagonist's front face!). Use at most `1–2` `ots_same_side` shots (`<= 22%` of frames) strictly at major act transitions.
   - **Phrase-Locked `manifest.shots[]` & `shotsFromManifest(MANIFEST)` (`SHOT_WORD_SYNC_ERROR`):** NEVER hardcode raw shot frame numbers in `story.ts`! Declare `shots[]` (`startPhrase`, `endPhrase`, `visualBeatIndex`, `actionTriggerPhrase`) in `manifest.json`, lock via `align_manifest.py`, and export `SHOTS = shotsFromManifest(MANIFEST)` in `story.ts`.
   - **3-Phase Acting, `dialogueMode` & 2-Joint `worldTarget` POV Hands:** Set `dialogueMode: "voiceOver"` on `C01` during `[NARRATOR]` internal monologue (`VOICEOVER_LIPSYNC_ERROR` blocks mouth-flapping on voice-over!) and `"directSpeech"` on speaking NPCs. Drive `PovRig3D` with 2-joint `fingerCurl` and `worldTarget` 3D prop coordinates so hands genuinely reach and grasp bolts, receipts, and ledgers.
   - **Default 4–8 Word Subtitles & Minimal HUD:** `align_manifest.py` emits word-timed `captionChunks[]` (`4–8 words`, `1–2 lines`, `enabledByDefault: true`, `headerStyle: "minimal"`).
5. **Render Style (`psxHorror` Default `1A+2A+3A`) & 5 Maximum Dread Opt-In Pillars:**
   - Default `renderStyle="psxHorror"` pairs angular low-poly PS1 vertex-snapped geometry, PBR BumpMaps + SSAO, 360×640 Bayer-dithered VHS/CRT post-processing, and `outlineMode: "off"` — switchable cleanly to `"semiReal"`, `"painterly"`, or `"comic"` per story.
   - Keep all characters, entities, and POV rigs on `NOINK` (layer 3) and zero 2D billboard cards or cute chibi heads. Deploy any of the 5 Maximum Dread opt-in pillars (`addCornerLurker3D`, `addSwarmingFlies3D` + Folk/Viscera dressing `addBloodHandprintDecal3D`/`addIchorPoolDecal3D`/`addTalismanPaper3D`/`addOtherworldGrimeDecal3D`/`addHauntedPortrait3D`, opt-in `bodyHorror`, 3-stage `doorwayPeek → stalkLoom → lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`, `camcorder` HUD + `fogOverride` + `RetroPsxEffect.dreadLevel`) ONLY when fitting the story.
5. **Physical Lighting (5 Presets), Practical Lights & Whip-Pan Motion Blur:**
   - Use strictly the 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), smooth `lerpLights`/`getLightBlend` transitions when lamps die, up to **6 real `PointLight`s** (`setLocalLights`) + **1 `SpotLight` cone** (`setSpotLight`), and selective HDR Bloom (`thr: 0.92`).
   - Use deterministic 6–8 frame `whipPan` turns paired with `WhipMotionBlurEffect`, and declare `WHIP_PANS` and `POV_MOTIONS` in `story.ts`.
6. **Crisp Oral Horror Voice, Retention Hook & Living Soundscape v14.0:**
   - **1–5s Cold Hook & Khẩu ngữ truyền miệng:** Start at `0.05–0.25s` with one of 4 hook archetypes (`paradox_prop`, `blunt_taboo_dialogue`, `flash_forward_crisis`, `raw_confession`, `<= 24 words`), zero chronological weather/year intros (*"Đêm cuối năm 2003..."*) and zero AI literary clichés (*"một cảm giác lạnh lẽo bao trùm"*). Match 3-region dialect (`north` / `central` / `south`) and controlled `platform_safe_raw` exclamations (*"Mẹ kiếp"*, *"Chó chết"*, *"Bỏ mẹ rồi"*) per story character.
   - **Crisp Pacing (`gen_horror_voice.py` v14.0):** Spoken rate `3.15–3.45 words/s` (hard max `3.65`), effective rate `2.55–3.05 words/s` (`0.5–1.0s` punchier than v13 via tighter `clean_tempo` + `tail_pad` `0.11–0.24s` and `--strict-hook`), keeping clause pauses `[BEAT Xs]` / `[PACE]` / `[PITCH]` / `[PROX=close]` and automatic 25-voice `VieNeu-TTS` casting.
   - **Narrative Soundscape (`mix_cues.py` v8.0):** Pair `near` + `far` (occluded) beds, at least 1 recurring `motifs[]`, 4 physical spaces (`close_ear`, `room`, `adjacent_muffled`, `exterior_occluded`), prefer `[SILENCE_DROP Xs]` uncanny hush over cliché `reverse_suck` risers, and keep **`max_jumpscares = 0` by default** (`-16.0 LUFS`, `LRA 7–12 LU`).

## End-to-End 11-Step Pipeline (Engine v14.0 — Unified Single Constitution)

1. **Sync Workspace & Verify `pipeline_constitution.json`:**
   ```bash
   python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo
   ```
2. **Viral Script With 0.05s Cold Hook (`2.55–3.05 words/s` effective, `55–90s` viral short or `45–105s`/chapter):**
   - Author `SCRIPT.md` opening straight at `0.05–0.20s` with `[NARRATOR]` or `[SPEAKER]` Cold Hook (`<= 24 words`, no opening `[VISUAL 2.6s]` dead air!), keeping mid-story `[BEAT 0.18–0.35s]` / `[VISUAL 0.8–1.4s]` / `[SILENCE_DROP 1.0–1.5s]` strictly at suspense turns and twists.
3. **Studio-Clean Neural Voice (`--strict-hook`) + Whisper Forced Word Alignment (`1B`, `< 35ms`):**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
     --tts-engine vieneu --speaker-lock --word-aligner auto --strict-hook \
     --out-dir out/<project>/voice --no-vc
   ```
   *(Optional GPU IndexTTS-2/F5-TTS `--export-gpu-voice-pack` or So-VITS-SVC `--export-vc-pack` remain supported as auxiliary workflows.)*
4. **Author `manifest.json` (`beats[]` + `shots[]` with `cold_hook` -> `master`), Single-Lock & Retention Validation:**
   ```bash
   python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
   python3 scripts/validate_manifest.py src/<project>/manifest.json \
     --script out/<project>/SCRIPT.md \
     --words out/<project>/voice/words.json \
     --cues out/<project>/cues.json \
     --strict-cinema --strict-retention \
     --registry LOCATION_REGISTRY.json \
     --update-registry \
     --still-out out/<project>/still_manifest.json
   ```
5. **Scaffold `story.ts`, `build.ts`, `world.ts`, `index.tsx` & Register in `src/Root.tsx`:**
   - `story.ts`: Export `MANIFEST`, `SHOTS = shotsFromManifest(MANIFEST)` (ZERO manual shot frame numbers!), `camMasterEstablish` on Shot 1, `camPovChain` for continuous POV head-turns, max `1–2` `ots_same_side` cuts.
   - `world.ts`: Drive actors via `applyManifestActors` (`dialogueMode: "voiceOver"` on `C01` vs `"directSpeech"` on speaking NPCs) and `PovRig3D` with 2-joint `fingerCurl` + `worldTarget` prop coordinates.
6. **Mount `<ShortPlayer />` (`index.tsx`) & Typecheck (`npx tsc --noEmit` -> Exit 0).**
7. **Declarative Openverse CC0 Foley & Mastering (`cues.json` + `mix_cues.py --strict`):**
   ```bash
   python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/audio/mix.wav --strict
   ```
8. **Mandatory 5-Layer Semantic Still Gate (`--audit --strict-audit` -> `storyboard_proof.html`):**
   ```bash
   REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ \
     --manifest out/<project>/still_manifest.json --scale 0.75 --strict-audit
   ```
   Enforces `mustShow` 9:16 Safe Frustum, 9-Ray 3D Occlusion sightlines, foreground `maxScreenBlockPct` (`<= 28%` OTS shoulder, `<= 38%` held paper), Subject-Locked DOF, and per-target pixel luminance/washout checks, generating `storyboard_proof.html` — inspect 100% of stills via `read_file` (and get user approval when requested) BEFORE running `render-video.mjs`!
9. **Final Render (`--scale 1`, `1.25`, or `1.5`) & Audio Mux.**
10. **Post-Render Automated QA Gate (`extract_shots.py` + `short_qa.py`):**
    Confirm `DIRECTING_WARNS none`, `DEAD_CAMERA_WARNS none`, `DARK_VOID_WARNS none`, `0` unplanned black/white/frozen/pops, and `-16.0 LUFS` (`LRA 7–12 LU`).
11. **Deliver & Clean Temp Disk.**

## Style & Technical References

- [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) — Engine v5.0 visual standard (`psxHorror` default `1A+2A+3A`, Story-Driven `CharacterBlueprint`, 5 Maximum Dread pillars & Whip-Pan blur).
- [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) — 5 physical presets, 6 PointLights + 1 SpotLight, HDR Bloom, SSAO, per-beat `fogOverride` & 11 Albedo+BumpMap surface pairs.
- [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md) — 3-layer Script↔Frame Lock, `align_manifest.py`, Location & Entity Anti-Repetition Gates & QA checklist.
