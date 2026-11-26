# Script↔Frame Single-Source Lock, Anchored POV Cinema Gates & QA Reference v11.0

Every Horror Engine v11.0 video MUST pass **three hard verification gates** governed by `templates/pipeline_constitution.json` before delivery:
1. **Pre-Render Single-Lock Alignment, Cinema Grammar & Dual Anti-Repetition Gate** (`align_manifest.py` + `validate_manifest.py --strict-cinema`)
2. **Mandatory Shot-by-Shot Pre-Final Still Gate** (`render-stills.mjs --manifest` + direct `read_file` visual inspection of 100% of shots)
3. **Post-Render Video, Directing, Zero-Black-Void & TRUE Dead Silence Audio QA Gate** (`extract_shots.py` + `short_qa.py` + `mix_cues.py --strict`)

Any single gate failure requires fixing the source (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `build_audio.py`, or `engine/`) and re-verifying before proceeding.

---

## 1. Layer 1 & 2: Single-Source-of-Truth `SceneManifest`, Auto-Align & Validation

Never hardcode conflicting captions, light toggles, prop states, or timestamps across `SCRIPT.md`, `story.ts`, `world.ts`, and `HorrorHUD`.

1. Author `src/<project>/manifest.json` (and export matching `MANIFEST: SceneManifest` in `story.ts`) defining:
   - `locations[]`: Complete `LocationBlueprint`s (`id`, `archetype`, `dimensions [w, d, h]`, `ceilingType`, `materials { wall, floor, ceiling }`, `practicalLights`, `heroProps`, `signatureShadowBeat`, optional `sameLocationOf`).
   - `castBlueprints[]`: Story-driven `CharacterBlueprint`s (`id`, `role`, `storyDescription`, `appearance`, optional `sameCharacterOf`) for every human, entity, silhouette, and lurker appearing in the video.
   - `beats[]`: Contiguous timeline `[0..totalFrames)` with `beatId`, `shotId`, `a`, `b`, `peakFrame`, `locationId`, `spokenLine`, `lightState`, optional `fogOverride`, `castStates`, `propStates`, and `cameraIntent`.
2. Lock beat frames automatically to `words.json` (zero manual frame math!):
   ```bash
   python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
   ```
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
   - Missing `LocationBlueprint` fields, undeclared `locationId`, or undeclared `castStates` keys missing from `castBlueprints`.
   - Non-physical/banned lighting presets (ONLY `warmLamp | coldMoon | fluorescent | duskFog | flashlight` allowed).
   - `spokenLine.text` drift from `SCRIPT.md` or `words.json` timing drift `> ±0.35 s`.
   - `Phone3D` lockscreen clock contradicting HUD notification timestamp (`detail.clock !== detail.notifTime`).
   - **`ANTI_REPEAT_ERROR`** (location collision) or **`ANTI_REPEAT_ENTITY_ERROR`** (entity appearance cloning).
   - **v11.0 Cinema & Consistency Gates (`--strict-cinema` / `manifest.shots[]`):**
     - `MASTER_ESTABLISHING_ERROR`: First shot of each location must be `cameraMode: "master"` (`>= 60 frames`).
     - `AXIS_180_VIOLATION_ERROR`: Forbids flipping `axisSide` directly `"left" ↔ "right"` without re-orienting via `"master"` / `"pov_center"`.
     - `POV_PINGPONG_ERROR`: Enforces `80–90%` anchored POV (`ots_same_side <= 22%` of frames, `<= 4` switches/min).
     - `SHOT_WORD_SYNC_ERROR`: Verifies every `shots[].startPhrase` matches `words.json` within `<= 4 frames`.
     - `VOICEOVER_LIPSYNC_ERROR`: Blocks `speakingAs: "NARRATOR"` paired with `dialogueMode: "directSpeech"`.
     - `WALL_OF_TEXT_ERROR`: Rejects any `captionChunks[]` entry exceeding `12` words (`4–8` words standard).

---

## 2. Dual Anti-Repetition Gate (`LOCATION_REGISTRY.json`)

**Hard Policy:** Unrelated horror videos — and unrelated Parts of a series — MUST NEVER repeat the same environment layout OR clone the same monster/entity visual template.

- **Location Gate (`ANTI_REPEAT_ERROR`):** Colliding `(archetype, ceilingType, wall+floor materials, similar dimensions)` exits non-zero unless an explicit narrative revisit declares `"sameLocationOf": "<previousProjectId>:<previousLocationId>"`.
- **Entity Gate (`ANTI_REPEAT_ENTITY_ERROR` & `ENTITY_SCARE_TIER_ERROR` — v15.0):**
  - Every `castBlueprints[]` actor in `sprite2d` mode MUST store its generated PNGs + Normal Maps strictly inside `src/<project>/assets/cast/`. Reusing another project's sprite path or cloning an unrelated entity's `promptSignature`/description/tier+traits fails with **`ANTI_REPEAT_ENTITY_ERROR`** unless `"sameCharacterOf": "<previousProjectId>:<previousCharId>"` is declared for a recurring series character.
  - Primary horror entities MUST declare `scareTier >= 4` (Uncanny Valley tiers 4–7); mild Tier 1–3 entities fail with **`ENTITY_SCARE_TIER_ERROR`**.
- **Mandatory Jumpscare Visual+Audio Sync Gate (`MISSING_JUMPSCARE_ERROR` & `JUMPSCARE_AV_SYNC_ERROR`):**
  - `validate_manifest.py --cues cues.json` (or `--strict-jumpscare`) requires `>= 1` synchronized Jumpscare clip (`jumpscareClips[]`) paired within `<= 0.15s` with a `jumpscare` event in `cues.json` (`min_jumpscares >= 1`).

---

## 3. Layer 3: Mandatory 5-Layer Semantic Still Gate (`render-stills.mjs --strict-audit` → `storyboard_proof.html`)

Before rendering ANY final MP4, generate phrase-anchored `still_manifest.json` (`stillKeyframes[]` + `mustShow[]`) and run the automated **5-Layer 3D Frustum + Raycast + Pixel Auditor** (plus inspect Jumpscare seam stills `anchorFrame`, `clip.a`, `clip.a + 8`!):

```bash
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ \
  --manifest out/<project>/still_manifest.json --scale 0.75 --strict-audit
```

`render-stills.mjs --strict-audit` + `audit_storyboard.py` automatically fail (`exit 1`) on:
1. **`OFFSCREEN_*` / `SUBTITLE_OR_BOTTOM_CLIP`:** Any `mustShow` 3D object cropped outside `safeNdcX [-0.90, 0.90]` × `safeNdcY [-0.66, 0.84]`.
2. **`OCCLUDED_BY(blocker)`:** Fewer than `34%` of 9 sightline rays from `camera.position` reach the `mustShow` object (catches window sills blocking exterior benches, held receipts blocking NPCs, or walls blocking props!).
3. **`TOO_SMALL` / `FOREGROUND_BLOB`:** Primary subject smaller than `5.5%` screen height or foreground silhouette exceeding `maxScreenBlockPct` (`<= 28%` OTS shoulder, `<= 38%` held paper).
4. **Subject-Locked DOF Drift:** `ShortWorld.getFocusTarget()` locks `LensBlur` onto the active spoken subject.
5. **`DARK_UNREADABLE` / `OVEREXPOSED_WASHOUT`:** Measured directly on the rendered `.jpg` inside each target's projected 2D `uvBox` (`mean >= 0.048` and no flat washed-out white `mean > 0.88, std < 0.045`).

Then open **`storyboard_proof.html`** and visually inspect **EVERY rendered `.jpg` directly using `read_file`** against this Audit Checklist:

1. **REJECT — Script↔Frame Contradiction:**
   - Does the visible location match `beat.locationId` and `fogOverride`?
   - Are practical lamps visibly lit/extinguished matching `beat.lightState.lampsOn`?
   - Are the right characters visible/hidden in the exact posed action (`doorwayPeek`, `stalkLoom`, `lungeCloseUp`, `sitCrossLegged`, `turnHead`) with NO early monster spoilers?
   - Does `Phone3D` lockscreen clock/message text match the HUD notification card verbatim?
2. **REJECT — Story-Appearance Mismatch / Chibi Breakdown:**
   - Do every character and entity match their `storyDescription` (`CharacterBlueprint`)? Reject generic horror gore pasted onto stories that don't call for it, cute round chibi heads, or 2D billboard cards.
   - Verify peripheral lurkers (`addCornerLurker3D`) sit cleanly inside `9:16` portrait FOV and `doorwayPeek` leans into the open doorway (never clipping into a solid wall).
3. **REJECT — Visual / Clipping / Overlay Defects:**
   - POV hands/wrists/sleeves must NEVER clip through the front of `Phone3D` or block lockscreen text.
   - `mattedLongHair` must frame the face organically (exposing at least 1 staring eye/jaw cleanly), and VHS `tapeTear` bands (`aberration` / `dreadLevel`) must stay razor-thin near frame edges without covering monster faces.
   - Spotlights/practical lights must NEVER blow out pale garments into solid white Bloom blocks.
4. **REJECT — Broken Whip-Pan Motion Blur:**
   - Whip-Pan midpoint frames (`f0 + dur/2`) MUST display unmistakable directional horizontal motion smear, while settled beats before and after remain razor-sharp.
5. **REJECT — Repeated or Floating Environments:**
   - Reject missing story-specific hero props, empty flat sky cutouts at corridor/alley ends, or floor decals standing vertically instead of lying flush via `createFlatDecalMesh`.

---

## 4. Strobe & Platform Safety

- Never flash full-screen faster than `2–3` strikes per second or strobe `> 1.5 s`. Keep `flicker` overlay strength `<= 0.52` and drive practical lamp/fluorescent flicker primarily through 3D `setLocalLights` + `flickerAt`.

---

## 5. Post-Render Video & Audio QA (`extract_shots.py` + `short_qa.py`)

```bash
python3 scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json
python3 scripts/short_qa.py out/<project>/final.mp4 out/<project>/qa out/<project>/shots.json
```

- `short_qa.py` MUST pass cleanly with:
  - `0` unplanned black frames (`mean < 0.035`), `0` unplanned white frames (`mean > 0.93`).
  - `0` frozen spans `>= 12f`, `0` unplanned `pops` (`WHIP_PANS` & `POV_MOTIONS` exempt automatically).
  - `DIRECTING_WARNS none` and zero dark readability warnings (`p98 >= 0.34`, `mean >= 0.065`).
- **Audio QA (`mix_base.py` / `ffmpeg_ebur`):** Confirm integrated loudness `I ~ -15.0 LUFS`, True Peak `<= -1.2 dBTP`, limiter `gr.max < 3.0 dB`, distinct dynamic loudness contrast between `whisper` and `panic` lines, and music+SFX RMS inside every `[DEAD SILENCE]` span `<= -40 dBFS`.
- Visually inspect `out/<project>/qa/sheet_*.jpg` via `read_file` before delivery.
