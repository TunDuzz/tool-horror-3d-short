---
name: horror-series-pipeline
description: Use when producing a long 5-12 minute multi-part horror video or series split into ~1-minute standalone parts (p01..p10) with constant context budget, named 3D ANCHORS, CONTINUITY.json handoff, and dual Shorts + full-episode output.
---

# Horror Series Pipeline v2 (8–10 Min via 1-Min Parts)

Solving context window overflow & 3D coordinate hallucination on long Three.js + Remotion horror episodes: **build the shared Gothic Ink-Noir 3D world and cast ONCE, lock every location behind named `ANCHORS`, author and render each ~1-minute Part in an isolated ~350–500 line budget with full shot-scale variety, and hand off state strictly through `CONTINUITY.json`.**

## 3-Tier Directory Architecture (`shorts-project/src/<episode>/`)

```text
shorts-project/src/<episode>/
├── bible/
│   ├── SERIES_BIBLE.md           # Full 8-10 min plot, monster rules, floorplan, cast list
│   ├── OUTLINE.json              # Parts 1..N (duration, era, light, aspect, transition_out, cliffhanger)
│   └── CONTINUITY.json           # External state contract updated after EVERY completed Part
├── shared/                       # BUILT & LOCKED IN PHASE 2 (never modified per Part)
│   ├── assets.ts                 # Named 3D ANCHORS, FLOOR_Y, CAM_ZONES (prevents coordinate guessing)
│   ├── build.ts                  # All non-box Gothic EraGroups + distant ridges + light shafts
│   ├── toon.ts                   # All Gothic Ink-Noir Outfits & props (via Outfit hooks)
│   └── worldBase.ts              # Reusable ShortWorld base (sky, fog, lighting, setLocalLights, EraGroup toggle)
├── parts/
│   ├── p01/                      # Local frames 0..TOTAL_P01 (30 fps), registered as <Ep_P01 />
│   │   ├── story.ts              # Only Part 1 SHOTS (with scale), CAMS, DOF, KICKS, OVERLAYS
│   │   ├── cast.ts               # Only Part 1 acting (Actions, bodyBack/glance, pushFlatDecal)
│   │   ├── world.ts              # Thin wrapper binding shared/worldBase + p01
│   │   └── index.tsx             # Exports EP_P01_FRAMES and <Ep_P01 />
│   └── p02/ ... p10/
└── index.tsx                     # Re-exports <Ep_P01 /> .. <Ep_PNN /> to src/Root.tsx
```

## Anti-Hallucination Constant-Context Rules

1. **Fixed Read Budget Per Part:** When building **Part `N`**, **NEVER read source files of `parts/p01 .. p(N-1)`**. Load ONLY:
   - `bible/CONTINUITY.json` (~60 lines)
   - `bible/OUTLINE.json` (only the Part `N` entry)
   - `shared/assets.ts` (`ANCHORS` + `CAM_ZONES` names)
   - Export list of `shared/toon.ts`
   - `out/<episode>/pNN/voice/words.json` (~150–210 words for that 1 minute)
2. **Zero Raw Coordinates in Parts:** Place every character, PointLight, and camera via `atAnchor(ANCHORS.NAME, dx, dy, dz)` and engine camera archetypes (`camOTS`, `camArc`, `camPOV`, `camECU`).
3. **Mandatory Pre-Flight Validator:** Before writing `parts/pNN/story.ts`, always run:
   ```bash
   python3 scripts/validate_continuity.py src/<episode> --part N
   ```
4. **Mandatory Session Reset Cadence:** Finish **1–2 Parts max** -> update `CONTINUITY.json` -> clear stale temp bundles -> recommend `/compact` before authoring later Parts.

## Execution Phases

### Phase 1: Series Bible, 8–10 Part Script & Per-Part Voice
1. Author `bible/SERIES_BIBLE.md` and `bible/OUTLINE.json` (see [SERIES_ARCHITECTURE.md](./references/SERIES_ARCHITECTURE.md)).
2. Lock `aspect` (`"9:16"` or `"16:9"`), global `audio_drone_hz`, and per-Part `transition_out` (`"cut"`, `"blackout:0.25"`, `"fade:0.25"`).
3. Write `out/<episode>/p01/SCRIPT.md` .. `p10/SCRIPT.md` (140–185 words each with `[PAUSE]` / `[DEAD SILENCE]` tags and mini-cliffhangers).
4. Generate `voice.wav` + `words.json` per Part via `scripts/gen_horror_voice.py`.

### Phase 2: Build & Lock `shared/` (One-Time World & Cast Approval)
1. Author `shared/assets.ts`, `shared/build.ts`, `shared/toon.ts`, `shared/worldBase.ts` following `horror-world-lookdev` (non-box Gothic geometry, gnarled trees/ridges inside FOV, real `setLocalLights`).
2. Verify `npm run typecheck` and inspect every `EraGroup` and `Outfit` via `render-stills.mjs` + `read_file`. Once approved, **freeze `shared/`**.

### Phase 3: Rolling Per-Part Production (`p01` -> `pNN`)
For each Part `N`:
1. Run `python3 scripts/validate_continuity.py src/<episode> --part N`.
2. Author `parts/pNN/{story.ts, cast.ts, world.ts, index.tsx}` obeying the **No-Repeat-Angle Rule** and **Action-to-Narration Binding**, and register `<Ep_PNN />` in `src/Root.tsx`.
3. Run the **Art Director's Pre-Final Still Gate** on `<Ep_PNN />` (100% of shots viewed via `read_file`).
4. Synthesize `out/<episode>/pNN/audio/mix.wav` locked to `CONTINUITY.json` `audio_bridge.drone_hz`.
5. Render `<Ep_PNN />` using integer-dimension scales (`--scale 1`, `--scale 1.25`, or `--scale 1.5`; NEVER `1.3333`), mux audio (`-map 0:v:0 -map 1:a:0`), and run `extract_shots.py` + `short_qa.py` confirming `DIRECTING_WARNS none` -> `out/<episode>/pNN/final.mp4`.
6. Update `bible/CONTINUITY.json` (`completed_part: N`, final character anchors/props, plot reveals, end camera/transition, audio bridge).
7. Clean stale bundles in `REMOTION_TMP`.

### Phase 4: Dual-Output Episode Assembly
Stitch all verified `out/<episode>/pNN/final.mp4` parts into one seamless 8–10 min feature:
```bash
python3 scripts/stitch_parts.py src/<episode>/bible/OUTLINE.json out/<episode>/episode_full.mp4 --videos-dir out/<episode>
```
Run `python3 scripts/short_qa.py out/<episode>/episode_full.mp4 out/<episode>/qa_full` on the full episode and inspect the contact sheets & loudness summary (`~-15.0 LUFS`).
