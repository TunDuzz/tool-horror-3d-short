---
name: horror-series-pipeline
description: Produce 8-10 minute multi-part horror series split into ~1-minute standalone parts (p01..p10) with zero context overflow, zero 3D coordinate hallucination, and seamless state/audio continuity, assembling both individual 1-min Shorts and a stitched full episode (9:16 or 16:9). Use when the user asks to make a long horror video (5-12 minutes), a multi-part horror story, or a horror series split into parts.
---

# Horror Series Pipeline (8–10 Min via 1-Min Parts)

Solving context window overflow & hallucination on long Three.js + Remotion videos: **build the shared 3D world and cast ONCE, lock coordinates behind named `ANCHORS`, author and render each ~1-minute Part in an isolated ~350-line budget, and hand off state strictly through `CONTINUITY.json`.**

## 3-Tier Directory Architecture (`shorts-project/src/<episode>/`)

```text
shorts-project/src/<episode>/
├── bible/
│   ├── SERIES_BIBLE.md           # Full 8-10 min plot, monster rules, floorplan, cast list
│   ├── OUTLINE.json              # Parts 1..N (duration, era, light, aspect, transition_out, cliffhanger)
│   └── CONTINUITY.json           # External state contract updated after EVERY completed Part
├── shared/                       # BUILT & LOCKED IN PHASE 2 (never modified per Part)
│   ├── assets.ts                 # Named 3D ANCHORS, FLOOR_Y, CAM_ZONES (prevents coordinate guessing)
│   ├── build.ts                  # All EraGroups for the entire episode
│   ├── toon.ts                   # All project Outfits, monster looks, props (via Outfit hooks)
│   └── worldBase.ts              # Reusable ShortWorld base (sky, fog, lighting, EraGroup switching)
├── parts/
│   ├── p01/                      # Local frames 0..TOTAL_P01 (30 fps), registered as <Ep_P01 />
│   │   ├── story.ts              # Only Part 1 SHOTS, CAMS, DOF, KICKS, OVERLAYS
│   │   ├── cast.ts               # Only Part 1 acting & 2D FX
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
2. **Zero Raw Coordinates in Parts:** Place every character and camera via `atAnchor(ANCHORS.NAME, dx, dy, dz)` instead of guessing `(x, y, z)` numbers from memory.
3. **Mandatory Pre-Flight Validator:** Before writing `parts/pNN/story.ts`, always run:
   ```powershell
   python scripts/validate_continuity.py src/<episode> --part N
   ```
   Fix any missing/invalid anchor, mismatched `completed_part`, or drifted `audio_bridge.drone_hz` before writing code.
4. **Mandatory Session Reset Cadence:** Finish **1–2 Parts max** -> update `CONTINUITY.json` -> clear `D:/remotion-tmp` -> recommend `/compact` (or start a fresh conversation) before authoring later Parts.

## Execution Phases

### Phase 1: Series Bible, 8–10 Part Script & Per-Part Voice
1. Author `bible/SERIES_BIBLE.md` and `bible/OUTLINE.json` (see [SERIES_ARCHITECTURE.md](./references/SERIES_ARCHITECTURE.md)).
2. Lock `aspect` (`"9:16"` or `"16:9"`), global `audio_drone_hz` (e.g. `43.65`), and per-Part `transition_out` (`"cut"`, `"blackout:0.2"`, `"fade:0.25"`).
3. Write `out/<episode>/p01/SCRIPT.md` .. `p10/SCRIPT.md` (each ~140–185 words for ~50–65 s @ `2.7–3.2 words/s`, including `[PAUSE Xs]` / `[DEAD SILENCE Xs]` tags and ending on a micro-tension beat or cliffhanger).
4. Generate consistent `ngan` narrator `voice.wav` + `words.json` per Part via `scripts/gen_horror_voice.py`:
   ```powershell
   python scripts/gen_horror_voice.py --script out/<episode>/p01/SCRIPT.md --out-dir out/<episode>/p01/voice
   ```

### Phase 2: Build & Lock `shared/` (One-Time World & Cast Approval)
1. Author `shared/assets.ts`, `shared/build.ts`, `shared/toon.ts`, `shared/worldBase.ts`.
2. Verify `npx tsc --noEmit`.
3. Optionally mount a temporary dev preview composition or test shots in `p01` to inspect every `EraGroup` and `Outfit` once via `render-stills.mjs` + `read_file`. Once approved, **freeze `shared/`**.

### Phase 3: Rolling Per-Part Production (`p01` -> `pNN`)
For each Part `N`:
1. Run `python scripts/validate_continuity.py src/<episode> --part N`.
2. Author `parts/pNN/{story.ts, cast.ts, world.ts, index.tsx}` and register `<Ep_PNN />` in `src/Root.tsx` (`1080x1920` for `9:16`, or `1920x1080` for `16:9`).
3. Run **Pre-Final Still Gate** on `<Ep_PNN />` (100% of shots viewed via `read_file`).
4. Synthesize `out/<episode>/pNN/audio/mix.wav` locked to `CONTINUITY.json` `audio_bridge.drone_hz` (using `horror-audio-sfx`).
5. Render `<Ep_PNN />` (`REMOTION_TMP=D:/remotion-tmp`; 2K `--scale 1.3333`), mux audio (`-map 0:v:0 -map 1:a:0`), and run `extract_shots.py` + `short_qa.py` -> output `out/<episode>/pNN/final.mp4`.
6. Update `bible/CONTINUITY.json` (`completed_part: N`, final character anchors/props, plot reveals, end camera/transition, audio bridge).
7. Clean stale bundles in `D:/remotion-tmp`.

### Phase 4: Dual-Output Episode Assembly
Stitch all verified `out/<episode>/pNN/final.mp4` parts into one seamless 8–10 min feature:
```powershell
python scripts/stitch_parts.py src/<episode>/bible/OUTLINE.json out/<episode>/episode_full.mp4 --videos-dir out/<episode>
```
Run `python scripts/short_qa.py out/<episode>/episode_full.mp4 out/<episode>/qa_full` on the full episode and inspect the resulting contact sheets & loudness summary (`~-15 LUFS`).
