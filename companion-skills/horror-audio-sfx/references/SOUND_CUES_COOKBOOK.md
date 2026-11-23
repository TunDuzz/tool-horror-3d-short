# Horror Sound Cues Cookbook

Recipes below assume `sys.path.insert(0, os.path.abspath("audio"))` inside `shorts-project/`.

## 1. Standard Imports & Shared Space Setup

```python
import os, sys
import numpy as np
sys.path.insert(0, os.path.abspath("audio"))
from dsp import SR, ns, rng, pan, place, fades, make_ir, convolve_st, dbg
from horror_instruments import (
    sub_drone, bowed_metal, scary_musicbox, riser,
    stinger, heartbeat, horror_strings, ambience_night, whisper_ghost, m2f,
    footsteps_wood, rope_strain, door_slam_bolt, wet_drip, nail_scrape, lantern_sputter,
    reverse_suck, shepard_tension, tinnitus_ring, whoosh_dark, entity_rattle, lightning_close,
    folk_wail, woodblock_omen,
)
from mix_base import load_voice, load_words, speech_spans, duck_db, master_mix, write_mix_and_stems, ffmpeg_ebur
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

### C. Tension Escalation -> Dead Silence -> Climax Reveal
Pattern: `3.0 s riser` -> **`0.55 s` Dead Silence** -> `stinger("boom")` + `stinger("shriek")` synced to `KICKS` / `OVERLAYS`.

```python
t_rise_start = t_climax - 3.55
t_silence_start = t_climax - 0.55

# 1. Riser cutting abruptly at t_silence_start
place(sfx, riser(dur=3.0, f0=85.0, f1=980.0, vel=0.65, r=r, hard_cut=True), t_rise_start)

# 2. Carve Dead Silence across music + ambience beds right before climax
s0, s1 = ns(t_silence_start), ns(t_climax)
fade_dn = np.linspace(1.0, 0.03, max(1, ns(0.06)))
music[:, s0 - len(fade_dn):s0] *= fade_dn
music[:, s0:s1] *= 0.03
sfx[:, s0 - len(fade_dn):s0] *= fade_dn
sfx[:, s0:s1] *= 0.03

# 3. Impact reveal synced 1 frame before visual KICK
place(sfx, stinger("boom", vel=0.95, r=r, dur=2.8, f0=46.0), t_climax)
place(music, stinger("shriek", vel=0.42, r=r, dur=2.0), t_climax + 0.03)
```

### D. Storm Lightning + Rain Scene
```python
place(sfx, ambience_night(dur=shot_dur, kind="rain", vel=0.28, r=r), t_shot_start)
# Sync thunder crack 1 frame after lightning overlay f0
place(sfx, ambience_night(dur=4.5, kind="thunder", vel=0.85, r=r), t_lightning)
```

### E. Accelerating Heartbeat + Shepard Tension During Vertigo (`dollyZoom`)
```python
place(sfx, pan(heartbeat(bpm=66.0, dur=8.0, vel=0.55, r=r, accel_to=128.0), 0.0), t_vertigo_start)
place(music, shepard_tension(dur=8.0, vel=0.24, r=r, rate_oct_per_sec=0.09), t_vertigo_start)
```

### F. Vacuum Reverse Suck -> Dead Silence -> Close Lightning + Entity Rattle Climax
```python
# Breath-stealing reverse reverb cutting dead right into Dead Silence
place(sfx, reverse_suck(dur=1.05, vel=0.60, r=r, f_base=310.0), t_silence_start - 1.05)
# Two-stage close lightning + sub boom + wet inhuman entity vocalization
place(sfx, lightning_close(dur=4.3, vel=0.90, r=r), t_climax)
place(sfx, stinger("boom", vel=0.75, r=r, dur=2.6, f0=45.0), t_climax)
place(sfx, entity_rattle(dur=2.1, vel=0.52, r=r, pan_from=-0.6, pan_to=0.6, kind="drowned"), t_climax + 0.35)
```

### G. Dual-Space Acoustic Occlusion (Exterior Storm -> Bolted Interior Shack)
```python
# Slam heavy door + wooden crossbar bolt, then low-pass outside rain behind wooden walls!
place(sfx, door_slam_bolt(vel=0.90, r=r, bolt_delay=0.34), t_door_slam)
rain_muffled = lp(ambience_night(dur=15.0, kind="rain", vel=0.18, r=r), 420.0, order=3)
place(sfx, rain_muffled, t_interior_start)
place(sfx, wet_drip([0.3, 1.6, 2.9, 4.1], vel=0.36, r=r), t_twist_start)
place(sfx, nail_scrape(dur=1.4, vel=0.22, r=r, surface="glass", pan_pos=-0.7), t_window_hand)
place(sfx, tinnitus_ring(dur=4.5, vel=0.16, f=4080.0, r=r), t_twist_reveal)
```

### H. Vietnamese Folk Horror Signature (Mõ gỗ + Đàn nhị + Final Voice Halo)
```python
place(music, woodblock_omen([0.2, 2.2, 4.3], vel=0.28, r=r, f=560.0), 0.0)
place(music, folk_wail(f0=293.66, dur=4.4, vel=0.24, r=r, bend_semi=-2.4), 4.5)
```

## 3. Ducking & Mastering Template

```python
words = load_words(words_json_path)
spans = speech_spans(words, merge=0.35)
duck = dbg(duck_db(spans, total_dur, depth=-4.2, pre=0.10, post=0.18, att=0.06, rel=0.55))
music *= duck[None, :]
# Gentle -2 dB ambient bed duck during speech
sfx_duck = dbg(duck_db(spans, total_dur, depth=-2.0, pre=0.08, post=0.15, att=0.08, rel=0.50))
sfx_bed *= sfx_duck[None, :]

final_mix, stems, stats = master_mix(voice, music, sfx + sfx_bed, target_lufs=-15.0, ceil_db=-1.2, fade_out=0.08)
write_mix_and_stems(audio_out_dir, final_mix, stems)
print(ffmpeg_ebur(os.path.join(audio_out_dir, "mix.wav")))
```

## 4. Series Continuity Rule (8–10 Part Episodes)
- Read `audio_bridge.drone_hz` and `audio_bridge.ambience` from `bible/CONTINUITY.json`.
- Keep Part `N` ending tail (`0.15 s` fade) and Part `N+1` opening tail (`0.15 s` fade) free of abrupt music transients if `OUTLINE.json` specifies `"transition_out": "fade:0.25"`, or end on a sharp `stinger`/`clock` + cliffhanger word if `"transition_out": "cut"` or `"blackout:0.2"`.
