# Script↔Frame Fidelity Lock, Anti-Repetition Gate & QA Reference v3

Every Horror Engine v3 video MUST pass **three hard verification gates** before delivery:
1. **Pre-Render Manifest & Anti-Repetition Gate** (`validate_manifest.py`)
2. **Mandatory Beat-by-Beat Pre-Final Still Gate** (`render-stills.mjs --manifest` + direct `read_file` visual inspection)
3. **Post-Render Video & Directing QA Gate** (`extract_shots.py` + `short_qa.py`)

Any single gate failure requires fixing the source (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, or `engine/`) and re-verifying before proceeding.

---

## 1. Layer 1 & 2: Single-Source-of-Truth `SceneManifest` & Automated Validation

Never hardcode conflicting captions, light toggles, prop states, or timestamps across `SCRIPT.md`, `story.ts`, `world.ts`, and `HorrorHUD`.

1. Author `src/<project>/manifest.json` (and export matching `MANIFEST: SceneManifest` in `story.ts`) defining:
   - `locations[]`: Complete `LocationBlueprint`s (`id`, `archetype`, `dimensions [w, d, h]`, `ceilingType`, `materials { wall, floor, ceiling }`, `practicalLights`, `heroProps`, `signatureShadowBeat`, and optional `sameLocationOf`).
   - `beats[]`: Contiguous timeline `[0..totalFrames)` with `beatId`, `shotId`, `a`, `b`, `peakFrame`, `locationId`, `spokenLine`, `lightState`, `castStates`, `propStates`, and `cameraIntent`.
2. Drive `world.ts` strictly from `beatAt(MANIFEST, frame)`, `isLampLit(beat, id)`, `propStateOf(beat, id)`, and pass `hud={hudFromManifest(MANIFEST)}` into `<ShortPlayer />`.
3. Run pre-render machine validation:
   ```bash
   python3 scripts/validate_manifest.py src/<project>/manifest.json \
     --script out/<project>/SCRIPT.md \
     --words out/<project>/voice/words.json \
     --registry LOCATION_REGISTRY.json \
     --update-registry \
     --still-out out/<project>/still_manifest.json
   ```
   `validate_manifest.py` fails immediately on:
   - Timeline gaps, overlaps, or `peakFrame` outside `[a, b)`.
   - Missing `LocationBlueprint` fields or undeclared `locationId`.
   - Legacy/banned lighting presets (e.g. `blood`, `night`, `candle`, `storm`, `eerie` — ONLY `warmLamp | coldMoon | fluorescent | duskFog | flashlight` allowed).
   - `spokenLine.text` drift from `SCRIPT.md` or `words.json` timing drift `> ±0.35 s`.
   - `Phone3D` lockscreen clock contradicting HUD notification timestamp (`detail.clock !== detail.notifTime`).
   - **`ANTI_REPEAT_ERROR`** (see Section 2).

---

## 2. Cross-Video & Cross-Part Background Anti-Repetition Gate (`LOCATION_REGISTRY.json`)

**Hard Policy:** Unrelated horror videos — and unrelated parts of a series — MUST NEVER repeat the same environment architecture, archetype, or material kit.

- Every project registers its locations into `LOCATION_REGISTRY.json` via `validate_manifest.py --registry LOCATION_REGISTRY.json --update-registry`.
- If a new video or unrelated Part collides with an existing entry's `(archetype, ceilingType, wall+floor materials, similar dimensions)` without an explicit narrative justification, `validate_manifest.py` exits non-zero with **`ANTI_REPEAT_ERROR`**.
- **Legitimate Narrative Revisit Exception:** Only when the story explicitly returns to the exact same physical room/site from an earlier Part or episode, declare:
  ```json
  "sameLocationOf": "<previousProjectId>:<previousLocationId>"
  ```
  Even on an explicit revisit, shift camera angles, lighting state, or prop states to reflect narrative progression.

---

## 3. Layer 3: Mandatory Beat-by-Beat Pre-Final Still Gate (`read_file`)

Before rendering the final MP4, render **100% of manifest beat peak frames at scale `1`** plus Whip-Pan burst midpoint frames:

```bash
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/whip_ <f_whip_mid,...> 1
```

Open and visually inspect **EVERY rendered `.jpg` directly using `read_file`** and verify this Beat-by-Beat Audit Checklist:

1. **REJECT — Script↔Frame Contradiction:**
   - Does the visible location match `beat.locationId`?
   - Are practical lamps visibly lit/extinguished matching `beat.lightState.lampsOn`?
   - Are the right characters visible/hidden in the exact posed action (`sitCrossLegged`, `loomingStill`, `turnHead`, etc.) with NO early monster spoilers?
   - Does `Phone3D` lockscreen clock/message text match the HUD notification card and subtitle verbatim?
   - Does the subtitle text accurately describe what is visible on screen?
2. **REJECT — Chibi / Uncanny Breakdown / v2 Artifacts:**
   - Characters must look **non-chibi dark-horror 3D** (`~5.6` head-height adult proportions, angular jaws, almond eyes, clean garment collars/folds) — reject cute round chibi heads, black hair-cap clipping over eyes, popped-out detached shoulders, popsicle-stick hair strips, or v2 scratchy 2D billboard cards.
3. **REJECT — Outline / Clipping / Blowout Defects:**
   - Outlines must be clean bold `~5–7 px` Inverted-Hull shells with zero double-outlines and zero split corners.
   - POV hands/wrists/sleeves must NEVER clip through the front of `Phone3D` or block lockscreen text.
   - Spotlights/practical lights must NEVER blow out pale garments into solid white Bloom blocks.
4. **REJECT — Broken Whip-Pan Motion Blur:**
   - Whip-Pan midpoint frames (`f0 + dur/2`) MUST display unmistakable directional horizontal motion smear, while stationary/settled beats before and after remain razor-sharp.
5. **REJECT — Repeated or Boxy Environments:**
   - Reject any environment reusing the old generic wooden box-room layout or missing story-specific architecture/hero props (`LocationBlueprint` check).
   - Reject empty flat sky cutouts at the end of corridors/alleys or flat decals standing vertically instead of lying flush via `createFlatDecalMesh`.

---

## 4. Strobe & Platform Safety

- Never flash full-screen faster than `2–3` strikes per second or strobe `> 1.5 s`. Keep `flicker` overlay strength `<= 0.52` and drive practical lamp/fluorescent flicker primarily through 3D `setLocalLights` + `flickerAt`.

---

## 5. Post-Render Automated QA (`extract_shots.py` + `short_qa.py`)

```bash
python3 scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json
python3 scripts/short_qa.py out/<project>/final.mp4 out/<project>/qa out/<project>/shots.json
```

- `extract_shots.py` resolves chained frame constants (`export const TOTAL = MY_FRAMES;`), `SHOTS` (with `scale` + `light`), `OVERLAYS` (`dipBlack`, `blackout`, `lightning`, `aberration`, `flicker`, `vignettePulse`), `WHIP_PANS` / inline `whipPan(...)` intervals, `POV_MOTIONS` (fast close-to-lens POV prop raises), and `KICKS`.
- `short_qa.py` MUST pass cleanly with:
  - `0` unplanned black frames (`mean < 0.035`), `0` unplanned white frames (`mean > 0.93`).
  - `0` frozen spans `>= 12f`, `0` unplanned `pops` (Whip-Pan & POV prop-raise intervals exempt automatically).
  - `DIRECTING_WARNS none` (POV-aware consecutive scale check + static-camera filter jump-cut detection `corr > 0.88`).
  - Zero dark readability warnings (`p98 >= 0.34`, `mean >= 0.065`) across all shots.
- Visually inspect `out/<project>/qa/sheet_*.jpg` via `read_file` to confirm smooth frame-to-frame motion across every Whip-Pan, light-loss blend, and location transition.
