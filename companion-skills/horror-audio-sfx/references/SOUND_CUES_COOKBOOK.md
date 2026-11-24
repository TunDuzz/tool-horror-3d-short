# Horror Sound Cues & Declarative `cues.json` Cookbook v7.0

## 0. Four Golden Rules of Sparse Horror Sound Design (Enforced by `mix_cues.py --strict`)

1. **Story-Driven Setting Bed (`<= 1 Bed Only` — NEVER hardcode one bed for every video!):**
   - Pick **exactly ONE** subtle ambience matching the story's location/weather (rainy rural house → indoor rain from Openverse; empty hospital ward → sterile low room tone; midnight alley → faint wind; closed attic → near-silent dark room tone).
   - Carve the vocal band (`voice_notch_db: -4.0`, `lp_hz: 2400`) and automatically duck `-12..-16 dB` during `mood == "whisper"` acts.
2. **Cinema Horror Spotting (`8–12 Well-Spaced Hero Cues` per 45–60 s, Calibrated by Measurement):**
   - Place SFX **only** where the story or visual shot has a physical action or dread beat — never pile cues into mud, and never bury them so softly that they disappear under `-15 LUFS` narration!
   - **Measurement-Calibrated Levels (NEVER guess raw `gain_db`!):**
     - Bed: set `"target_rms_dbfs": -32.0 .. -35.0` (post-EQ, audible atmospheric mood ~16 dB under voice; ducks `-4 dB` under speech and `-9 dB` under whispers).
     - Shock / Impact SFX (`cinematic_boom`, `heavy_door_slam`, `door_bolt_latch`): `"target_peak_dbfs": -3.0 .. -4.5` so they genuinely startle!
     - Atmospheric / Foley SFX (`wooden_door_creak`, `wood_footsteps_slow`, `distant_thunder`, `cello_dread_sting`): `"target_peak_dbfs": -6.0 .. -9.0`, panned left/right (`±0.3..0.5`) to surround the narrator cleanly.
   - **Anti-Crowding:** One hero sound per moment (or at most 1 cross-band pair like low `cinematic_boom` + high `door_bolt_latch` marked `allow_layer: true`); never pile `>= 3` cues inside `1.50 s`.
   - **Silent Whisper Rule:** Keep `mood == "whisper"` acts free of distracting spot Foley (only ultra-low `< 70 Hz` `sub_drone` pressure swell or pre-silence `reverse_suck` marked `allow_in_whisper: true`).
3. **Exact `onset` / `peak` / `end` Alignment via `cues.json`:**
   - Hits / door latches / flashlight clicks → `"align": "onset"` anchored to `at_act`, `at_word`, or `at_dead_silence`.
   - Whip-pan whooshes → `"align": "peak"` on the cut midpoint.
   - Pre-silence `reverse_suck` / risers → `"align": "end"` at `at_dead_silence: 0, edge: "start"`.
4. **Measurement-First Verification & Attribution:**
   - Always run `scripts/mix_cues.py --cues cues.json --out mix.wav --strict`, confirm `PASS 6/6`, ship `credits.txt`, and hand the user the 5 headphone timestamps from `mix_report.md`.

```json
{
  "voice": "voice/voice.wav",
  "words": "voice/words.json",
  "target_lufs": -15.0,
  "ceil_db": -1.2,
  "dead_silence_floor_db": -48.0,
  "beds": [
    {"sound": "night_rain_indoor", "gain_db": -27.0, "hp_hz": 120, "lp_hz": 2400, "voice_notch_db": -4.5, "duck_db": -5.5, "whisper_duck_db": -14.0, "label": "Story-matched rainy night bed"}
  ],
  "events": [
    {"sound": "wooden_door_creak_ov", "bus": "sfx", "at_act": 2, "offset_s": -0.18, "align": "onset", "gain_db": -12.0, "pan": -0.35, "label": "Door creak in pause before Act 2"},
    {"synth": "reverse_suck", "bus": "score", "at_dead_silence": 0, "edge": "start", "align": "end", "dur_s": 0.72, "gain_db": -10.5, "label": "Vacuum pull into Dead Silence"},
    {"sound": "door_bolt_latch", "bus": "sfx", "at_dead_silence": 0, "edge": "end", "offset_s": 0.04, "align": "onset", "gain_db": -9.0, "pan": -0.25, "label": "Iron bolt sliding after Dead Silence"},
    {"sound": "heavy_door_slam", "bus": "sfx", "at_act": 5, "offset_s": -0.08, "align": "onset", "gain_db": -8.0, "pan": -0.15, "label": "Door slams open on panic act"},
    {"sound": "cello_dread_sting", "bus": "score", "at_act": 6, "offset_s": 0.35, "align": "onset", "gain_db": -15.0, "lp_hz": 1200, "reverb": 0.25, "label": "Low C2 cello swell under final twist"}
  ]
}
```

---

## 1. Legacy / Custom Python Mixing Reference (Advanced)

```python
import os, sys
import numpy as np
sys.path.insert(0, os.path.abspath("audio"))
from dsp import SR, ns, rng, pan, place, fades, lp, make_ir, convolve_st, dbg
from horror_instruments import (
    sub_drone, bowed_metal, scary_musicbox, riser,
    stinger, heartbeat, horror_strings, ambience_night, whisper_ghost, m2f,
    footsteps_wood, rope_strain, door_slam_bolt, wet_drip, nail_scrape, lantern_sputter,
    reverse_suck, shepard_tension, tinnitus_ring, whoosh_dark, entity_rattle, lightning_close,
    folk_wail, woodblock_omen,
    # v5.0 PSX / Analog VHS & Visceral Dread Pack (4 new SFX -> 27 total)
    vhs_static_burst, flashlight_click_sputter, neck_crack_wet, fly_buzz_loop,
)
from mix_base import (
    load_voice, load_words, load_dead_silences, speech_spans,
    duck_db, apply_dead_silences, master_mix, write_mix_and_stems, ffmpeg_ebur,
)
```

Create **one shared reverb IR** per setting/episode so sounds feel glued in the same haunted space:

```python
r = rng(2026)
hall_ir = make_ir(rt60=2.3, seed=77, hf=1.4, early=[(0.025, 0.28, -0.4), (0.055, 0.18, 0.45)], density_lp=4200)
```

## 2. Cue Recipes Mapped to Visual Beats

### A. Opening Cold Hook (0.0s – 4.0s)
- Place `sub_drone(f=43.65, dur=14.0, vel=0.45, r=r)` under `ambience_night(dur=14.0, kind="room_tone", vel=0.22, r=r)`.
- Drop 1 solitary detuned note at `0.15 s` to hook attention immediately without drowning voice:
  ```python
  note = pan(scary_musicbox(m2f(77), vel=0.55, r=r, dur=2.5, detune_cents=-22), -0.25)
  place(music, note + 0.35 * convolve_st(note, hall_ir), 0.15)
  ```

### B. Uncanny Discovery / Shadow Glimpse
- Sweep a spectral whisper across stereo right as the silhouette appears (`0-2 frames` before reveal):
  ```python
  w = whisper_ghost(dur=1.4, vel=0.48, r=r, pan_from=-0.75, pan_to=0.65)
  place(sfx, w + 0.45 * convolve_st(w, hall_ir), t_reveal - 0.05)
  place(music, pan(bowed_metal(246.94, dur=3.2, vel=0.38, r=r, bend_semi=1.5), 0.35), t_reveal)
  ```

### C. Tension Escalation → TRUE `-48 dB` Dead Silence → Climax Reveal
Pattern: `reverse_suck` / `riser` cutting into `[DEAD SILENCE 0.65s]` (carved automatically to `-48 dB` vacuum by `master_mix(..., dead_silences=dead_silences)`!) → `stinger("boom")` + `stinger("shriek")` synced to `KICKS` / `OVERLAYS`.

```python
# 1. Riser + vacuum suck ending right at Dead Silence start
t_ds_start = dead_silences[0]["s"]
t_ds_end = dead_silences[0]["e"]
place(sfx, riser(dur=2.6, f0=85.0, f1=980.0, vel=0.62, r=r, hard_cut=True), max(0.0, t_ds_start - 2.6))
place(sfx, reverse_suck(dur=0.95, vel=0.58, r=r, f_base=310.0), max(0.0, t_ds_start - 0.95))

# 2. Impact reveal synced right after Dead Silence vacuum ends (0-2 frames before visual KICK)
place(sfx, stinger("boom", vel=0.95, r=r, dur=2.8, f0=46.0), t_ds_end)
place(music, stinger("shriek", vel=0.42, r=r, dur=2.0), t_ds_end + 0.03)
```

### D. v5.0 PSX VHS Glitch, Dying Flashlight, Wet Neck Crack & Decay Flies
```python
# Analog VHS tracking tear burst synced to `aberration` / `RetroPsxEffect.dreadLevel`
place(sfx, vhs_static_burst(dur=0.48, vel=0.55, r=r), t_glitch)

# Mechanical flashlight click + failing bulb sputter right before blackout (`kind="off"` or `"on"`)
place(sfx, flashlight_click_sputter(dur=0.65, vel=0.65, r=r, kind="off"), t_flashlight_die)

# Visceral brittle bone snap + wet crunch when entity tilts neck / drops jaw
place(sfx, neck_crack_wet(dur=0.55, vel=0.72, r=r), t_neck_tilt)

# Subtle darting fly swarm synced to `addSwarmingFlies3D` decay scene
place(sfx, fly_buzz_loop(dur=5.0, vel=0.22, r=r), t_decay_scene)
```

### E. Accelerating Heartbeat + Shepard Tension During Vertigo (`dollyZoom`)
```python
place(sfx, pan(heartbeat(bpm=66.0, dur=8.0, vel=0.55, r=r, accel_to=128.0), 0.0), t_vertigo_start)
place(music, shepard_tension(dur=8.0, vel=0.24, r=r, rate_oct_per_sec=0.09), t_vertigo_start)
```

### F. Storm Lightning + Dual-Space Acoustic Occlusion + Folk Horror Signature
```python
place(sfx, lightning_close(dur=4.3, vel=0.90, r=r), t_climax)
place(sfx, entity_rattle(dur=2.1, vel=0.52, r=r, pan_from=-0.6, pan_to=0.6, kind="drowned"), t_climax + 0.35)
place(sfx, door_slam_bolt(vel=0.90, r=r, bolt_delay=0.34), t_door_slam)
rain_muffled = lp(ambience_night(dur=15.0, kind="rain", vel=0.18, r=r), 420.0, order=3)
place(sfx, rain_muffled, t_interior_start)
place(sfx, wet_drip([0.3, 1.6, 2.9, 4.1], vel=0.36, r=r), t_twist_start)
place(sfx, nail_scrape(dur=1.4, vel=0.22, r=r, surface="glass", pan_pos=-0.7), t_window_hand)
place(sfx, tinnitus_ring(dur=4.5, vel=0.16, f=4080.0, r=r), t_twist_reveal)
place(music, woodblock_omen([0.2, 2.2, 4.3], vel=0.28, r=r, f=560.0), 0.0)
place(music, folk_wail(f0=293.66, dur=4.4, vel=0.24, r=r, bend_semi=-2.4), 4.5)
```

## 3. Ducking, TRUE `-48 dB` Dead Silence & Mastering Template

```python
words = load_words(words_json_path)
dead_silences = load_dead_silences(words_json_path)
spans = speech_spans(words, merge=0.35)

duck = dbg(duck_db(spans, total_dur, depth=-4.2, pre=0.10, post=0.18, att=0.06, rel=0.55))
music *= duck[None, :]
sfx_duck = dbg(duck_db(spans, total_dur, depth=-2.0, pre=0.08, post=0.15, att=0.08, rel=0.50))
sfx_bed *= sfx_duck[None, :]

# Passing `dead_silences` automatically drops BOTH `music` and `sfx` to -48 dB vacuum during every [DEAD SILENCE]!
final_mix, stems, stats = master_mix(
    voice, music, sfx + sfx_bed,
    target_lufs=-15.0, ceil_db=-1.2, fade_out=0.08,
    dead_silences=dead_silences, ds_floor_db=-48.0,
)
write_mix_and_stems(audio_out_dir, final_mix, stems)
print(ffmpeg_ebur(os.path.join(audio_out_dir, "mix.wav")))
```

## 4. Series Continuity Rule (8–10 Part Episodes)
- Read `audio_bridge.drone_hz` and `audio_bridge.ambience` from `bible/CONTINUITY.json`.
- Keep Part `N` ending tail (`0.15 s` fade) and Part `N+1` opening tail (`0.15 s` fade) free of abrupt music transients if `OUTLINE.json` specifies `"transition_out": "fade:0.25"`, or end on a sharp `stinger`/`vhs_static_burst` + cliffhanger word if `"transition_out": "cut"` or `"blackout:0.2"`.
