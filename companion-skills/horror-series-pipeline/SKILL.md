---
name: horror-series-pipeline
description: Use when producing a seamless 55-90s viral horror short, 150-360s (2.5-6 min) standalone horror story (3-5 chapters, 9:16 default), or 8-16 minute (480-960s) multi-part horror series (8-15 chapters, 16:9 default) split into 45-105s renderable chapters (p01..pNN) governed by pipeline_constitution.json v14.0, Cold Hook -> Anchored POV-First (2A), Whisper Forced Word Alignment (1B), crisp 2.55-3.05 w/s effective / 3.15-3.45 w/s spoken oral folklore Vietnamese, shared 3D locations & ANCHORS, CONTINUITY.json handoff, and zero-drift stitch_parts.py assembly.
---

# Horror Multi-Chapter Pipeline v14.0 (`55–90s` Viral Short & `2.5–16 Min` Seamless Stories)

Solving context window overflow, background repetition & 3D coordinate hallucination on both **viral `55–90s` shorts**, **2.5–6 min standalone stories (`3–5` chapters)**, and **8–16 min feature episodes (`8–15` chapters)**: **build the shared Engine v14.0 3D locations (`LocationBlueprint`) and story-driven cast (`CharacterBlueprint`) ONCE, lock every spot behind named `ANCHORS` from `horror-story` (`export-blueprint --all-parts`), open Part 1 immediately with a `0.05–0.25s` Cold Hook (`cold_hook` -> `master`), author and render each `45–105s` Chapter in an isolated ~350–500 line budget, and hand off state strictly through `CONTINUITY.json`.**

## 3-Tier Directory Architecture (`shorts-project/src/<episode>/`)

```text
shorts-project/src/<episode>/
├── bible/
│   ├── SERIES_BIBLE.md           # Full 8-10 min plot, monster rules, floorplan, cast appearanceBriefs
│   ├── OUTLINE.json              # Exported via horror_story.py (parts, locations, castAppearanceBriefs, audio_drone_hz)
│   └── CONTINUITY.json           # External state contract updated after EVERY completed Part
├── shared/                       # BUILT & LOCKED IN PHASE 2 (never modified per Part)
│   ├── locations.ts              # Named 3D ANCHORS, FLOOR_Y, CAM_ZONES, LocationBlueprint[] (alias: assets.ts)
│   ├── castBlueprints.ts         # Story-driven CharacterBlueprint[] (createCharacterFromBlueprint + sameCharacterOf)
│   ├── build.ts                  # Isolated LocationGroups built from neutral modular v5.0 kits (build.ts + fx3d.ts)
│   └── worldBase.ts              # Reusable ShortWorld base (sky, fog, 5 physical lights, setLocalLights/SpotLight, LocationGroup toggle, PovRig3D)
├── parts/
│   ├── p01/                      # Local frames 0..TOTAL_P01 (30 fps), registered as <Ep_P01 />
│   │   ├── manifest.json         # Part 1 SceneManifest (auto-aligned to words.json via align_manifest.py)
│   │   ├── story.ts              # Part 1 MANIFEST, SHOTS (with scale & v5 LightKey), WHIP_PANS, POV_MOTIONS, CAMS, DOF, KICKS, OVERLAYS
│   │   ├── world.ts              # Thin wrapper binding shared/worldBase + p01 MANIFEST & cast posing
│   │   └── index.tsx             # Exports EP_P01_FRAMES and <Ep_P01 />
│   └── p02/ ... p10/
└── index.tsx                     # Re-exports <Ep_P01 /> .. <Ep_PNN /> to src/Root.tsx
```

## Anti-Hallucination & Anti-Repetition Constant-Context Rules

1. **Fixed Read Budget Per Part:** When building **Part `N`**, **NEVER read source files of `parts/p01 .. p(N-1)`**. Load ONLY:
   - `bible/CONTINUITY.json` (~60 lines)
   - `bible/OUTLINE.json` (only the Part `N` entry)
   - `shared/locations.ts` (`ANCHORS` + `CAM_ZONES` + `LocationBlueprint` IDs)
   - `shared/castBlueprints.ts` (exported `CharacterBlueprint` IDs)
   - `out/<episode>/pNN/voice/words.json` (~150–210 words for that 1 minute)
2. **Zero Raw Coordinates in Parts:** Place every character, practical `PointLight`, and camera via `atAnchor(ANCHORS.NAME, dx, dy, dz)` and engine camera archetypes (`whipPan`, `povBreath`, `camOTS`, `camArc`, `camPOV`, `camECU`).
3. **Explicit Revisit Contract (`sameLocationOf` & `sameCharacterOf`):**
   - When Part `N` revisits a physical room or recurring entity from Part `1`, declare `"sameLocationOf": "<episode>-p01:<locId>"` on that `LocationBlueprint` and `"sameCharacterOf": "<episode>-p01:<charId>"` on that `CharacterBlueprint` so `validate_manifest.py --registry LOCATION_REGISTRY.json` approves the intentional continuity while still blocking accidental cross-series cloning!
4. **Mandatory Pre-Flight Validator:** Before writing `parts/pNN/story.ts`, always run:
   ```bash
   python3 scripts/validate_continuity.py src/<episode> --part N
   ```
5. **Mandatory Session Reset Cadence:** Finish **1–2 Parts max** → update `CONTINUITY.json` → clear stale temp bundles → recommend `/compact` before authoring later Parts.

## Execution Phases

### Phase 1: Series Bible, 8–10 Part Expressive Scripts & Per-Part Voice
1. Author `story.json` via `horror-story` and export `bible/OUTLINE.json` (`horror_story.py export-outline`).
2. Lock `aspect` (`"9:16"` or `"16:9"`), global `audio_drone_hz`, `renderStyle` (`"psxHorror"` default or `"semiReal"` / `"painterly"` / `"comic"`), and per-Part `transition_out` (`"cut"`, `"blackout:0.25"`, `"fade:0.25"`).
3. Write `out/<episode>/p01/SCRIPT.md` .. `pNN/SCRIPT.md` (`2.55–3.05 words/s` effective / `3.15–3.45 words/s` spoken, `platform_safe_raw` 3-region colloquial prose): Part 1 opens straight at `0.05–0.20s` with a `<= 24 words` Cold Hook (ZERO opening `[VISUAL 2.6s]` dead air!), keeping mid-part `[BEAT 0.18–0.35s]` / `[SILENCE_DROP]` / `[VISUAL 0.8–1.4s]` strictly at suspense pivots and cliffhangers.
4. Generate studio-clean `1.0x` 48 kHz `voice.wav` + Whisper forced-aligned `words.json` (`<35ms` + `rms_envelope_30fps`) per Part via `scripts/gen_horror_voice.py --tts-engine auto --word-aligner auto --strict-hook --no-vc` (or `--import-voice` for real human/RVC recordings).
5. Auto-generate shared series 2.5D normal-mapped cast PNGs in `src/<episode>/shared/assets/cast/` via `gen_cast_assets.py` (primary entity `scareTier >= 4`; later chapters declare `sameCharacterOf` for returning characters so cross-series `ANTI_REPEAT_ENTITY_ERROR` stays strict).

### Phase 2: Build & Lock `shared/` (One-Time World & Cast Approval)
1. Author `shared/locations.ts`, `shared/castBlueprints.ts`, `shared/build.ts`, `shared/worldBase.ts` following `horror-world-lookdev` v5.0 (story-driven `LocationBlueprint`s with BumpMap surfaces, `CharacterBlueprint`s via `createCharacterFromBlueprint`, real `setLocalLights` / `setSpotLight`).
2. Verify `npm run typecheck` and inspect every `LocationGroup` and `CharacterBlueprint` via `render-stills.mjs` + `read_file`. Once approved, **freeze `shared/`**.

### Phase 3: Rolling Per-Part Production (`p01` → `pNN`)
For each Part `N`:
1. Run `python3 scripts/validate_continuity.py src/<episode> --part N`.
2. Draft `parts/pNN/manifest.json` (`beats[]` + `shots[]`, with `cold_hook` -> `master` on Part 1), lock frames & captions automatically via `align_manifest.py`, and pass `validate_manifest.py --script ... --words ... --cues ... --strict-cinema --strict-retention --registry LOCATION_REGISTRY.json --update-registry --still-out ...`.
3. Author `parts/pNN/{story.ts, world.ts, index.tsx}` using `SHOTS = shotsFromManifest(MANIFEST)`, `camMasterEstablish` + `camPovChain` (`Anchored POV-First 2A`), `dialogueMode` (`voiceOver` vs `directSpeech`), and 2-joint `worldTarget` POV hands (`4B`), then register `<Ep_PNN />` in `src/Root.tsx`.
4. Run `gen_jumpscare_clip.py` for the chapter's mandatory Jumpscare (`>= 1` per chapter), then run the **5-Layer Semantic Pre-Final Still Gate** on `<Ep_PNN />` (`render-stills.mjs --manifest ... --strict-audit` -> `storyboard_proof.html` verifying `mustShow` 3D Raycast sightlines & pixel luma + 100% viewed via `read_file`).
5. Auto-fetch missing CC0 SFX (`sfx_manager.py auto-fetch-for-script`) and mix `out/<episode>/pNN/audio/mix.wav` via `scripts/mix_cues.py --cues ... --out ... --strict` (`min_jumpscares >= 1`, `-1.0 dBTP`, Real-SFX-first) locked to `CONTINUITY.json` `audio_bridge`!
6. Render `<Ep_PNN />` via `render-video.mjs` (GTX 960 `--concurrency 1` default, `--scale 1`, `1.25`, or `1.5`), mux audio (`-map 0:v:0 -map 1:a:0`), and run `extract_shots.py` + `short_qa.py` → `out/<episode>/pNN/final.mp4`.
7. Update `bible/CONTINUITY.json` (`completed_part: N`, final character anchors/props, plot reveals, end camera/transition, audio bridge).
8. Clean stale bundles in `REMOTION_TMP`.

### Phase 4: Dual-Output Episode Assembly
Stitch all verified `out/<episode>/pNN/final.mp4` parts into one seamless 8–10 min feature:
```bash
python3 scripts/stitch_parts.py src/<episode>/bible/OUTLINE.json out/<episode>/episode_full.mp4 --videos-dir out/<episode>
```
Run `python3 scripts/short_qa.py out/<episode>/episode_full.mp4 out/<episode>/qa_full` on the full episode and inspect the contact sheets & loudness summary (`~-15.0 LUFS`).
