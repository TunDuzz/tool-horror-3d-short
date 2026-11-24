# Script↔Frame Fidelity Lock, Anti-Repetition Gates & QA Reference v5.0

Every Horror Engine v5.0 video MUST pass **three hard verification gates** before delivery:
1. **Pre-Render Manifest Alignment & Dual Anti-Repetition Gate** (`align_manifest.py` + `validate_manifest.py`)
2. **Mandatory Beat-by-Beat Pre-Final Still Gate** (`render-stills.mjs --manifest` + direct `read_file` visual inspection)
3. **Post-Render Video, Directing & TRUE Dead Silence Audio QA Gate** (`extract_shots.py` + `short_qa.py` + `ffmpeg_ebur`)

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

---

## 2. Dual Anti-Repetition Gate (`LOCATION_REGISTRY.json`)

**Hard Policy:** Unrelated horror videos — and unrelated Parts of a series — MUST NEVER repeat the same environment layout OR clone the same monster/entity visual template.

- **Location Gate (`ANTI_REPEAT_ERROR`):** Colliding `(archetype, ceilingType, wall+floor materials, similar dimensions)` exits non-zero unless an explicit narrative revisit declares `"sameLocationOf": "<previousProjectId>:<previousLocationId>"`.
- **Entity Gate (`ANTI_REPEAT_ENTITY_ERROR`):** Every non-human `CharacterBlueprint` (`entity`, `silhouette`, `lurker`) is fingerprinted by its visual appearance (`garment`, `hairStyle`, `bodyHorror` flags, `eyeHorror`, `silhouetteMode`, `heightScale`) and stored in `LOCATION_REGISTRY.json` (`"entryType": "entity"`). Colliding with an unrelated video's monster exits non-zero unless an explicit recurring villain declares `"sameCharacterOf": "<previousProjectId>:<previousCharId>"`.

---

## 3. Layer 3: Mandatory Beat-by-Beat Pre-Final Still Gate (`read_file`)

Before rendering the final MP4, render **100% of manifest beat peak frames at scale `1`** plus Whip-Pan burst midpoint frames:

```bash
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/whip_ <f_whip_mid,...> 1
```

Open and visually inspect **EVERY rendered `.jpg` directly using `read_file`** and verify this Beat-by-Beat Audit Checklist:

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
