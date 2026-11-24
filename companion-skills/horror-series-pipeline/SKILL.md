---
name: horror-series-pipeline
description: Use when producing a long 5-12 minute multi-part horror video or series split into ~1-minute standalone parts (p01..p10) with constant context budget, named 3D ANCHORS, story-driven LocationBlueprints & CharacterBlueprints, CONTINUITY.json handoff, and dual Shorts + full-episode output.
---

# Horror Series Pipeline v5.0 (8–10 Min via 1-Min Parts)

Solving context window overflow, background repetition & 3D coordinate hallucination on long Three.js + Remotion horror episodes: **build the shared Engine v5.0 3D locations (`LocationBlueprint`) and story-driven cast (`CharacterBlueprint`) ONCE, lock every spot behind named `ANCHORS`, author and render each ~1-minute Part in an isolated ~350–500 line budget with full shot-scale variety, and hand off state strictly through `CONTINUITY.json`.**

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
3. Write `out/<episode>/p01/SCRIPT.md` .. `p10/SCRIPT.md` (140–185 words each using `[NARRATOR | mood=...]`, `[SPEAKER: ... | fx=...]`, `[PAUSE]`, `[DEAD SILENCE]` and mini-cliffhangers).
4. Generate expressive `voice.wav` + `words.json` per Part via `scripts/gen_horror_voice.py` (1-file So-VITS-SVC VC-Pack `-na` workflow or `--no-vc`).

### Phase 2: Build & Lock `shared/` (One-Time World & Cast Approval)
1. Author `shared/locations.ts`, `shared/castBlueprints.ts`, `shared/build.ts`, `shared/worldBase.ts` following `horror-world-lookdev` v5.0 (story-driven `LocationBlueprint`s with BumpMap surfaces, `CharacterBlueprint`s via `createCharacterFromBlueprint`, real `setLocalLights` / `setSpotLight`).
2. Verify `npm run typecheck` and inspect every `LocationGroup` and `CharacterBlueprint` via `render-stills.mjs` + `read_file`. Once approved, **freeze `shared/`**.

### Phase 3: Rolling Per-Part Production (`p01` → `pNN`)
For each Part `N`:
1. Run `python3 scripts/validate_continuity.py src/<episode> --part N`.
2. Draft `parts/pNN/manifest.json`, lock beat frames automatically via `align_manifest.py`, and pass `validate_manifest.py --script ... --words ... --registry LOCATION_REGISTRY.json --update-registry --still-out ...`.
3. Author `parts/pNN/{story.ts, world.ts, index.tsx}` obeying the **No-Repeat-Angle Rule** and **Script↔Frame Manifest Lock**, and register `<Ep_PNN />` in `src/Root.tsx`.
4. Run the **Beat-by-Beat Pre-Final Still Gate** on `<Ep_PNN />` (`render-stills.mjs --manifest` + 100% viewed via `read_file`).
5. Synthesize `out/<episode>/pNN/audio/mix.wav` locked to `CONTINUITY.json` `audio_bridge.drone_hz` and passing `dead_silences=load_dead_silences(words_json)` into `master_mix(...)` for TRUE `-48 dB` Dead Silence!
6. Render `<Ep_PNN />` via `render-video.mjs` (`--scale 1`, `1.25`, or `1.5`; NEVER `1.3333`), mux audio (`-map 0:v:0 -map 1:a:0`), and run `extract_shots.py` + `short_qa.py` confirming `DIRECTING_WARNS none` → `out/<episode>/pNN/final.mp4`.
7. Update `bible/CONTINUITY.json` (`completed_part: N`, final character anchors/props, plot reveals, end camera/transition, audio bridge).
8. Clean stale bundles in `REMOTION_TMP`.

### Phase 4: Dual-Output Episode Assembly
Stitch all verified `out/<episode>/pNN/final.mp4` parts into one seamless 8–10 min feature:
```bash
python3 scripts/stitch_parts.py src/<episode>/bible/OUTLINE.json out/<episode>/episode_full.mp4 --videos-dir out/<episode>
```
Run `python3 scripts/short_qa.py out/<episode>/episode_full.mp4 out/<episode>/qa_full` on the full episode and inspect the contact sheets & loudness summary (`~-15.0 LUFS`).
