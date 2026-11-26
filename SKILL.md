---
name: horror-3d-short
description: Use when creating a horror story video — standalone 55-90s viral short or 150-360s multi-chapter story (9:16 default), or 8-16 min multi-part series (16:9 default) — in Horror Engine v15.0 Option A (GTX 960 low-VRAM 3D World + 2.5D Photorealistic Normal-Mapped Characters via gen_cast_assets.py & sprite2d.ts + 7-Tier Uncanny Ghost >= Tier 4 + Mandatory 1-2 First-Frame-Conditioned AI Jumpscare Video Clips via gen_jumpscare_clip.py + Crisp actionTriggerFrame & 30fps RMS Lip-Sync + 1.0x Clean Gemini TTS / --import-voice + Auto-Fetched Openverse CC0 SFX at -1.0 dBTP + Single-Source pipeline_constitution.json).
---

# Horror 3D Story Video v15.0 (`Option A: Light 3D World · 2.5D Normal-Mapped Cast · AI Video Jumpscare`, Three.js + Remotion)

- **Single Source of Truth (`5B`):** `templates/pipeline_constitution.json` (`v15.0.0`, synced to `shorts-project/pipeline_constitution.json` — governs all 6 skills, Python scripts, and TypeScript engine modules).
- **Workspace:** `shorts-project/` (30 fps; `9:16` `1080×1920` or `16:9` `1920×1080`; integer-dimension multipliers `--scale 1`, `1.25`, or `1.5`).
- **Neutral Horror Engine v15.0:** `shorts-project/src/engine/` (**22 modules** including `sprite2d.ts` and `sceneAudit.ts` imported via `../engine`).
- **GTX 960 Low-VRAM Render Mode (Default on `psxHorror`):** `ShortPlayer.tsx` disables `OpaqueNormalPass`, `SSAOEffect`, and `LensBlur`, caps `BloomEffect` to `<= 3` mip levels, renders internal WebGL at `dpr 0.45` (`0.35` draft), mounts strictly ONE `<ThreeCanvas>` context, and `render-video.mjs` defaults to `--concurrency 1` while logging hardware GL (`angle-egl` vs `swangle`) + live FPS.
- **2.5D Photorealistic Cast + Automated AI Jumpscare + Clean Studio Audio (`GEMINI_API_KEY`):**
  - `scripts/gen_cast_assets.py`: Reads `castBlueprints[]` -> generates story-driven photorealistic dark-horror/found-footage character & ghost sprites (or imports free-tier/Antigravity green-screen renders via `--import-raw-dir`) -> removes background + aligns secondary expression canvases -> synthesizes Tangent-Space Normal Maps + auto-detects anatomical `rigMeta` (`neckV`, `shoulderV`, `waistV`, `mouthV`, `shoulderSpan`, `headCenterX`) -> saves into `src/<project>/assets/cast/`.
  - `scripts/gen_jumpscare_clip.py`: Captures clean 3D `jumpscare_anchor_frame.png` (`render-stills.mjs --raw-anchor --png`) right before the climax -> generates a 2–4s First-Frame-conditioned Jumpscare `.mp4` (`src/<project>/assets/jumpscare_<id>.mp4`) routed inside `ShortPlayer.tsx` through the exact same Grade + Grain + RetroPsx VHS pipeline beneath `HorrorHUD`.
  - `scripts/gen_horror_voice.py` + `scripts/sfx_manager.py` + `scripts/mix_cues.py`: Exact `1.0x` natural voice (zero tempo/pitch/F0 DSP by default, prefers whole-act Gemini TTS or clean `--import-voice`), exports `rms_envelope_30fps` for frame-accurate lip-sync, auto-fetches missing CC0 SFX via `sfx_manager.py auto-fetch-for-script`, forbids procedural `synth:` unless opted in, enforces **mandatory `min_jumpscares >= 1`** (1–2 per short, >= 1/chapter for series), and masters to `-16.0 LUFS` / `-1.0 dBTP`.
- **Automation & QA Scripts:** `shorts-project/scripts/` (`sync_workspace.py`, `constitution.py`, `horror_story.py`, `gen_cast_assets.py`, `gen_jumpscare_clip.py`, `gen_horror_voice.py`, `sfx_manager.py`, `mix_cues.py`, `align_manifest.py`, `validate_manifest.py`, `render-stills.mjs`, `audit_storyboard.py`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py`).

## Companion Skills (Activate as Needed)

- **Story planning v3.2 (Viral `55–90s` Shorts & `2.5–16 min` Deep Stories — 1–5s Cold Hook, Khẩu ngữ truyền miệng 3 miền + `platform_safe_raw`, 7-tier ghost design, mandatory climax Jumpscare, 2D Floorplans & 26 quality gates):** Activate `horror-story`.
- **Seamless multi-chapter production (`150–360s` Shorts via 3–5 Chapters & `8–16 min` Series via 8–15 Chapters with constant context budget):** Activate `horror-series-pipeline`.
- **Expressive colloquial `SCRIPT.md` (0.05s Cold Hook, `align_manifest.py`, `actionTriggerFrame`, shot-scale & `story.ts` timing):** Activate `horror-script-storyboard`.
- **Non-repeating 3D worlds (`LocationBlueprint`), 2.5D Photorealistic Normal-Mapped `sprite2d.ts` cast, 7-tier horror entities, First-Frame AI Jumpscare transitions (`transitionStyle`), GTX 960 low-VRAM lookdev & practical lights:** Activate `horror-world-lookdev`.
- **Clean 1.0x Gemini TTS / `--import-voice`, `sfx_manager.py auto-fetch-for-script`, Uncanny Hush `[SILENCE_DROP]` & Real-SFX-first Jumpscare mix (`-1.0 dBTP`):** Activate `horror-audio-sfx`.

## Hard Workspace, Anti-Repetition & Directing Rules (`GEMINI.md`)

1. **Strict Engine Neutrality & Zero Cross-Project Imports:** Never add story-specific rooms, ghosts, props, portraits, dialogue, or coordinates into `src/engine/`. Every project lives independently in `src/<project>/` (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx`, `assets/cast/`, `assets/jumpscare_*.mp4`) and registers its `<Composition />` in `src/Root.tsx`. Never import across sibling `src/<projectA>/` ↔ `src/<projectB>/`.
2. **ZERO Background & Entity Cloning (`LocationBlueprint` + `CharacterBlueprint` + `LOCATION_REGISTRY.json`):**
   - Every independent video (without `sameLocationOf`) MUST build a 100% fresh story-driven `LocationBlueprint` from neutral modular kits in `build.ts` + Albedo/BumpMap surface pairs in `paint.ts`. Colliding in `LOCATION_REGISTRY.json` fails with **`ANTI_REPEAT_ERROR`**.
   - **Story-Driven 2.5D Cast Isolation (`ANTI_REPEAT_ENTITY_ERROR`):** Every independent video (without `sameCharacterOf`) MUST generate fresh cast sprites saved inside its own `src/<project>/assets/cast/` matching `storyDescription` (age, outfit, Vietnamese region, ghost form). `validate_manifest.py` fails with **`ANTI_REPEAT_ENTITY_ERROR`** if an unrelated video reuses another project's sprite path or clones an entity's visual signature.
3. **7-Tier Entity Scare Scale (`>= Tier 4` Mandatory) & Mandatory Synchronized Jumpscare (`min_jumpscares >= 1`):**
   - Primary horror entities MUST select a non-bland Uncanny Valley design from **Tier 4 to Tier 7** (`ENTITY_SCARE_TIER_ERROR` rejects mild Tier 1–3 primary ghosts; keep platform-safe without crude gore):
     - *Tier 1:* Backlit dark shadow silhouette
     - *Tier 2:* Familiar person with subtly wrong detail / head tilt
     - *Tier 3:* Blank / blurred / static-smeared face
     - *Tier 4:* Figure clinging to ceiling corner / doorway crack
     - *Tier 5:* Stretched unnatural smile / sunken eyes with pinpoint gleam
     - *Tier 6:* Elongated neck / twisted joints with rapid stop-motion twitch
     - *Tier 7:* Motionless hollow stare snapping abruptly into distorted lens-filling lunge
   - **Mandatory Jumpscare (`MISSING_JUMPSCARE_ERROR` & `JUMPSCARE_AV_SYNC_ERROR`):** Every short (`55–90s`) MUST have **1–2 synchronized visual + audio Jumpscares** (`>= 1` per chapter for series), aligned within `<= 0.15s` between `manifest.jumpscareClips[]` and `cues.json`.
   - **Story-Driven Transition Style (`transitionStyle` — NEVER force flashlight on unrelated stories!):** Choose per script: `first_frame_seamless` (default, locked to `jumpscare_anchor_frame.png`), `whip_pan_turn`, `diegetic_reveal` (door opening, curtain pull, fluorescent flicker, thunder flash, breaker trip — only if in script), or `silence_hard_cut` (after `[SILENCE_DROP 0.5–1.2s]`).
4. **Anchored POV-First Cinema Grammar (`2A`), Cold Hook, `actionTriggerFrame` & RMS Lip-Sync:**
   - Shot #1 enters immediately on `cameraMode: "cold_hook"` (`<= 180 frames`, first word `<= 0.45s`) → Shot #2 `cameraMode: "master"` (`>= 60 frames`, `camMasterEstablish`), then `80–90%` continuous `camPovChain()`. Export `SHOTS = shotsFromManifest(MANIFEST)`.
   - Use `characterMode: "sprite2d"` by default (`rig3d` remains supported as legacy fallback). `sprite2d.ts` uses a lightweight 24×36 anatomical puppet mesh with **20 composable story-driven gestures** (`shrug`, `sighDrop`, `heavyPant`, `breathHold`, `shiver`, `nodSlow`, `nodDouble`, `headShake`, `tiltListen`, `glanceAside`, `chinTuck`, `flinch`, `leanIn`, `leanBack`, `cower`, `stepSway`, `neckCrack`, `neckTwitch`, `jawStretch`, `loomSwell`, plus freeform `custom` + `customDeform`) choreographed via phrase-locked **`actingCues[]`** (`onPhrase` → `atFrame` by `align_manifest.py`, auto-seeded by `horror_story.py`) + single-draw-call multi-step expression crossfade (`exprTo`, `exprBlendFrames`). Drive actors via **`stage.ts`** (`applyManifestActors`) with **`actionTriggerFrame`** and **30fps vocal `rmsEnvelope`**.
   - `align_manifest.py` emits `4–8 word` `captionChunks[]` (`enabledByDefault: true`, `headerStyle: "minimal"`).
5. **Physical Lighting (5 Presets), Practical Lights & GTX 960 Performance Discipline:**
   - Use strictly the 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), up to **6 real `PointLight`s** + **1 `SpotLight`**, so 2.5D normal-mapped characters in `sprite2d.ts` receive real directional rim/key/fog shading and grounded shadows.
   - Keep `lowVram: true` (default on `psxHorror`) and single `<ThreeCanvas>` context so GTX 960 4–6GB renders smoothly on GPU (`angle-egl`) at `--concurrency 1`.
6. **Clean 1.0x Studio Voice, Real-SFX-First & `-1.0 dBTP` Mastering:**
   - **Zero Tempo/Pitch/F0 DSP by Default:** `gen_horror_voice.py` keeps exact `1.0x` tempo and `0.0` pitch shift (45 Hz HPF + light RMS balance only), never chops sentences on `[PACE]`/`[PITCH]`, defaults to whole-act **Gemini TTS** (`GEMINI_API_KEY`) or clean single-file `--import-voice` + Whisper forced alignment, and outputs `rms_envelope_30fps`.
   - **Automated Real SFX:** Run `sfx_manager.py auto-fetch-for-script --cues out/<project>/cues.json --library shorts-project/audio/sfx_library` before `mix_cues.py --strict` (`min_jumpscares >= 1`, real recorded WAVs for beds/foley/jumpscare, `-16.0 LUFS`, `-1.0 dBTP`).

## End-to-End 12-Step Pipeline (Engine v15.0 Option A)

1. **Sync Workspace & Verify `pipeline_constitution.json`:**
   ```bash
   python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo
   ```
2. **Viral Script With 0.05s Cold Hook (`55–90s` viral short or `45–105s`/chapter):**
   - Author `SCRIPT.md` opening straight at `0.05–0.20s` with `[NARRATOR]` or `[SPEAKER]` Cold Hook (`<= 24 words`), placing `[SILENCE_DROP 0.6–1.2s]` right before the climax Jumpscare.
3. **Clean 1.0x Neural Voice (Gemini TTS / `--import-voice`) + Whisper Forced Alignment + 30fps RMS Envelope:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
     --tts-engine auto --word-aligner auto --strict-hook \
     --out-dir out/<project>/voice --no-vc
   ```
   *(Or pass `--import-voice recording.wav` to ingest a clean human/RVC recording with 0% tempo/pitch DSP.)*
4. **Author `manifest.json` (`characterMode: "sprite2d"`, Tier 4–7 entity, `jumpscareClips[]`, `shots[]`) & Lock Timeline:**
   ```bash
   python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
   ```
5. **Auto-Generate 2.5D Photorealistic Cast + Normal Maps (`src/<project>/assets/cast/`):**
   ```bash
   python3 scripts/gen_cast_assets.py src/<project>/manifest.json --update-manifest
   # Free-Tier / Antigravity image-generator import (0 API cost):
   python3 scripts/gen_cast_assets.py src/<project>/manifest.json --import-raw-dir <raw_dir> --update-manifest
   ```
6. **Auto-Fetch Missing Real CC0 SFX & Master Mix (`mix_cues.py --strict`, `min_jumpscares >= 1`, `-1.0 dBTP`):**
   ```bash
   python3 scripts/sfx_manager.py auto-fetch-for-script --cues out/<project>/cues.json --library audio/sfx_library
   python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/audio/mix.wav --strict
   ```
7. **Pre-Render Validation (`validate_manifest.py` — Anti-Repeat Location + 2D Cast + Tier >= 4 + Jumpscare AV Sync):**
   ```bash
   python3 scripts/validate_manifest.py src/<project>/manifest.json \
     --script out/<project>/SCRIPT.md --words out/<project>/voice/words.json \
     --cues out/<project>/cues.json --strict-cinema --strict-retention \
     --registry LOCATION_REGISTRY.json --update-registry --still-out out/<project>/still_manifest.json
   ```
8. **Scaffold `story.ts`, `build.ts`, `world.ts`, `index.tsx` & Typecheck (`npx tsc --noEmit` -> Exit 0).**
9. **Generate First-Frame-Conditioned Jumpscare AI Video Clip (`src/<project>/assets/jumpscare_<id>.mp4`):**
   ```bash
   python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json --comp <CompId> --workspace . --overwrite
   ```
10. **Mandatory 5-Layer Semantic Still Gate (`--strict-audit` -> `storyboard_proof.html`) + Jumpscare Seam Visual Check:**
    ```bash
    REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ \
      --manifest out/<project>/still_manifest.json --scale 0.75 --strict-audit
    ```
    Inspect 100% of beat stills AND Jumpscare seam frames (`anchorFrame`, `clip.a`, `clip.a + 8`) via `read_file` BEFORE rendering!
11. **GTX 960 Single-Concurrency Render & Audio Mux:**
    ```bash
    REMOTION_TMP=/tmp/remotion-tmp node scripts/render-video.mjs <CompId> out/<project>/video.mp4 --scale 1
    ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest out/<project>/final.mp4
    ```
12. **Post-Render Automated QA Gate (`extract_shots.py` + `short_qa.py`) & Clean Temp Disk.**

## Style & Technical References

- [HORROR_STYLE_BIBLE.md](./references/HORROR_STYLE_BIBLE.md) — Engine v15.0 Option A visual standard (GTX 960 low-VRAM `psxHorror`, 2.5D Normal-Mapped `sprite2d.ts`, 7-Tier Uncanny Ghosts & First-Frame AI Jumpscare).
- [LIGHTING_AND_PALETTE.md](./references/LIGHTING_AND_PALETTE.md) — 5 physical presets, 6 PointLights + 1 SpotLight, HDR Bloom, per-beat `fogOverride` & 11 Albedo+BumpMap surface pairs.
- [READABILITY_AND_QA.md](./references/READABILITY_AND_QA.md) — Single-Source Lock, `align_manifest.py`, Dual Location & 2D Entity Anti-Repetition Gates, Jumpscare AV Sync Gate & QA checklist.
