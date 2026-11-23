# Art Director's Still Gate, Readability Traps & Automated QA Reference

Verify **EVERY SINGLE ITEM** during the mandatory **Pre-Final Still Gate** (`read_file` on 100% of shots) AND **Post-Render QA Gate** (`short_qa.py`). Any single failure below is grounds to **REJECT and RE-ENGINEER** the shot before final render.

## 1. Art Director's Rejection Checklist (Must Inspect Visually on Stills!)

1. **REJECT: Static-Camera / Filter-Swap Jump-Cut:**
   - *Symptom:* Two consecutive shots sit at roughly the same camera position/angle (only tinting `night` → `eerie` → `storm` → `blood`).
   - *Fix:* Change camera vantage by `>= 30°` OR switch shot scale (`WS` → `OTS` → `LOW` → `MCU` → `ECU` → `Reverse WS`).
2. **REJECT: Empty Horizon / Box-World Lego Set:**
   - *Symptom:* Flat straight green/grey horizon bar, empty background in `9:16` narrow frame, or stacked rectangular boxes pretending to be roofs, boats, lamps, or trees.
   - *Fix:* Place `addDistantRidge`, `addGnarledTree`, `addReedCluster`, and architecture **within visible horizontal FOV**, use `pitchedRoofGeo` / `taperedBoxGeo` / `addSampanHull` / `addStormLantern3D`, and frame wide shots with `addForegroundSilhouette` + `addVolumetricShaft`.
3. **REJECT: Cartoonish / Comedy Proportions or Expressions:**
   - *Symptom:* Giant round heads, stick legs, silly round `O` scream mouths, white cartoon grin teeth, or blue anime sweatdrops.
   - *Fix:* Use Horror Engine v2 (`toon.ts`) Gothic proportions (`adult`, `elder`, `gaunt`, `kid`), recessed shadowed eye sockets, and dark ink hatching.
4. **REJECT: Statue Acting / Action-Narration Mismatch:**
   - *Symptom:* Narration describes *peering down, lunging at an ankle, fleeing, barring a door, or looking behind*, yet the character stands rigid in `idle` facing forward—or two struggling characters stand a meter apart without reaching.
   - *Fix:* Bind every verb to a matching `Action` (`peer`, `recoil`, `lunge`, `emerge`, `flee`, `boltDoor`), pass continuous `time`/`shiver`/`wind`, and use `bodyBack` + `glance: -1 | 1` for over-the-shoulder twists.
5. **REJECT: Early Monster Spoiler:**
   - *Symptom:* The main ghost/monster is plainly visible in Shot 1 (Cold Hook).
   - *Fix:* Keep Shot 1 atmospheric/mysterious; delay full entity reveal until the climax beat after `[DEAD SILENCE]`.
6. **REJECT: Unmotivated Fake Lighting / Slicing Directional Shadows:**
   - *Symptom:* A bright lantern or oil lamp sits beside a character whose face is lit from the wrong side, or a harsh black shadow line cuts vertically across a close-up face.
   - *Fix:* Sync real dynamic `setLocalLights(...)` matching every practical lamp position; keep `actorShadow: false` on close-up dark scenes so lanterns & rim lighting sculpt faces cleanly.
7. **REJECT: Perspective-Broken 2D FX / Floor-Sliced Mist:**
   - *Symptom:* Water ripples (`fxWaterRipple`) or footprints (`fxWetFootprints`) standing upright facing camera like floating stickers; round white cotton-ball `fxBreath`; or `fxMist` sliced horizontally by a deck/floor plane.
   - *Fix:* ALWAYS use `pushFlatDecal(...)` (`flat: true`) for ground/water decals; use Gothic Engine v2 feathered `fxMist` positioned cleanly above deck height; align `fxBreath` forward along character facing (`dir = view.mirror ? -1 : 1`).
8. **REJECT: Translucent Ghost Bisected by Background Ink Lines:**
   - *Fix:* Stage translucent `opacity < 1` ghosts inside open doorways, dark water, or fog voids—never straddling a high-contrast background pillar edge.

## 2. Strobe & Platform Safety

- Never flash full-screen faster than `2–3` strikes per second or strobe `> 1.5 s`. Keep `flicker` strength `<= 0.52` and rely on 3D `setLocalLights` modulation instead of harsh full-screen strobes.

## 3. Dark-Aware & Directing-Aware Automated QA (`extract_shots.py` + `short_qa.py`)

- Declare every deliberate black beat in `story.ts` via `OVERLAYS` (`blackout` or `dipBlack`) and label every shot's `scale` (`WS`, `OTS`, `LOW`, `MCU`, `ECU`, `CU`, `MS`, `POV`).
- `extract_shots.py` emits `shots` (with `scale` + `light`), `planned`, and `planned_black` into `shots.json`.
- `short_qa.py` automatically verifies:
  - `0` unplanned black frames (`mean < 0.035`), `0` unplanned white frames (`mean > 0.93`), `0` frozen spans `>= 12f`, `0` unplanned `pops`.
  - `DIRECTING_WARNS none` (automatically catches repeated consecutive `scale` AND static-camera filter jump-cuts with grayscale correlation `> 0.88` across cuts!).
  - Dark-screen readability (`p98 >= 0.38`, `mean >= 0.08`) per shot + `6x10` / `10x6` contact sheets.
