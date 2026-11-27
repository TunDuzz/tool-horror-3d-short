# Horror Sound Cues, Flexible `audioDirection` & Curated SFX Cookbook v15.5

## 0. Six Golden Rules of Story-Driven Horror Soundscape v15.5 (Enforced by `mix_cues.py --strict`)

1. **Story-Driven `audioDirection` (`requireScoreBeds: false` — NEVER Force One Template on Every Video):**
   Declare `"audioDirection"` per script inside `cues.json` so every story gets its own authentic sound world:
   - **`raw_diegetic`** *(Found-Footage / Security Camera / Raw Real-World)*: **0% musical score** — `mix_cues.py --strict` raises `RAW_DIEGETIC_SCORE_FORBIDDEN` if `scoreBeds` or `music_arc` are attached. Uses strictly real spatial beds (room-tone, fluorescent hum, wind, footsteps), tension silence, and physical diegetic impacts.
   - **`folklore_atmospheric`** *(Folklore / Rural / Supernatural)*: Authentic regional environment beds (rain, river night, crickets, wind) + optional wooden/folk motif or understated drone (score is optional, never forced).
   - **`cinematic_score`** *(Psychological / Tragedy / Urban)*: Supports optional evolving **`scoreBeds[]` / `music_arc`** (warm/quiet → uneasy dark drone → `-48 dB` hush → cold aftermath tail) with automatic **smooth vocal ducking (`-7` to `-10 dB`, default `music_duck_db: -8.5`)** so `VieNeu-TTS 1.0x` narration stays intimate and clear.
2. **Pre-Jumpscare Uncanny Hush (`[SILENCE_DROP 0.5–1.2s]` at `-48 dB`):**
   - Pulls **BOTH optional score (`music` bus) AND ambience (`sfx_bed`, `motif_bus`, `sfx_spot`) down to `-48.0 dB`** right before the climax reveal (`silence_drop_floor_db: -48.0`) to maximize dynamic contrast.
3. **7 Story-Driven Jumpscare Audio Styles (`min_jumpscares >= 1`, `-1.0 dBTP` Ceiling):**
   - **NEVER lock every story to the same violin or metal screech!** Pick the explosion style that belongs to the script's world:
     - `practical_impact`: slamming door, shattering glass, heavy physical thud (`heavy_door_slam`, `door_bang_impact`, `glass_break`).
     - `mic_emf_glitch`: electromagnetic interference, blown mic static, VHS/CCTV tear (`emf_glitch_buzz`, `vhs_static`).
     - `entity_breath_shriek`: sudden close-ear gasp/breath erupting into an entity shriek (`breathing_heavy`, `jumpscare_entity_shriek_ov`, `jumpscare_scream_ov`).
     - `cinema_stab`, `entity_shriek`, `metal_dread`, `vhs_psx_glitch`: theatrical stinger / metallic / VHS glitch hits when warranted by the genre.
   - Common rule across all 7 styles: **build contrast before impact** (`[SILENCE_DROP]` hush or false release) and master peaks cleanly to **`-1.0 dBTP`**.
4. **Curated Local Library (`audio/sfx_curated/`) + `history.jsonl` Anti-Repeat Rotation + Openverse Quality Filter:**
   - Optional folders in `audio/sfx_curated/`: `dark_drone/`, `sad_piano/`, `stinger/`, `ambience/` (store 3–5 variants per folder so videos rotate naturally).
   - `sfx_manager.py auto-fetch-for-script` checks **`audio/sfx_curated/` FIRST**, then searches Openverse CC0 using story-specific keywords, while **skipping recently used IDs in `history.jsonl` across BOTH `sfx_curated/` (`curated:<group>:<file>`) AND Openverse** so 10 videos never repeat the exact same audio clip.
   - **Openverse quality gate (`validate_sfx_audio_quality`):** Rejects files `< 0.4s` (for beds/drones/score), heavily clipped files, or near-silent files (`rms < -50 dBFS`). Procedural `synth:` stays blocked by `SYNTH_SFX_FORBIDDEN` unless `allow_synth: true` is explicitly opted in.
5. **Optional Spatial Beds, Motifs & Occlusion (`requireAcousticMotif: false`, `requireOcclusionTrigger: false`):**
   - Use 1–2 complementary setting beds (`near` / `far`), optional `automation` (`occlusionTrigger` ONLY when a door/window actually shuts in the plot), and optional `motifs[]` ONLY when organic to the story.
6. **Measurement-First QA (`mix_report.md` & `credits.txt`):**
   - Always run `scripts/mix_cues.py --cues cues.json --out mix.wav --strict`, verify `PASS`, `audioDirection`, `-16.0 LUFS`, `-1.0 dBTP`, `0` clips, Jumpscare contrast in `mix_report.md`, and ship `credits.txt`.

### Example A — `raw_diegetic` (0% Score · Found-Footage / Real Room + `practical_impact` Jumpscare)

```json
{
  "audioDirection": "raw_diegetic",
  "voice": "voice/voice.wav",
  "words": "voice/words.json",
  "target_lufs": -16.0,
  "ceil_db": -1.0,
  "silence_drop_floor_db": -48.0,
  "min_jumpscares": 1,
  "max_jumpscares": 2,
  "beds": [
    {
      "sound": "room_tone_dark",
      "role": "near",
      "target_rms_dbfs": -35.0,
      "hp_hz": 55,
      "lp_hz": 4000,
      "label": "Tiếng phòng trọ kín và quạt thông gió xa"
    }
  ],
  "events": [
    {
      "id": "js_door_slam",
      "jumpscare": "practical_impact",
      "sound": "heavy_door_slam",
      "sub_sound": "door_bang_impact",
      "bus": "sfx",
      "at_silence_drop": 0,
      "edge": "end",
      "target_peak_dbfs": -1.0,
      "label": "Cửa phòng sập mạnh thực tế đúng khung hình lộ diện"
    }
  ]
}
```

### Example B — `cinematic_score` (Optional `music_arc` / `scoreBeds` + Smooth `-8.5 dB` Ducking)

```json
{
  "audioDirection": "cinematic_score",
  "voice": "voice/voice.wav",
  "words": "voice/words.json",
  "target_lufs": -16.0,
  "ceil_db": -1.0,
  "silence_drop_floor_db": -48.0,
  "dead_silence_floor_db": -48.0,
  "music_duck_db": -8.5,
  "min_jumpscares": 1,
  "max_jumpscares": 2,
  "beds": [
    {
      "sound": "night_rain_indoor",
      "role": "far",
      "target_rms_dbfs": -34.0,
      "hp_hz": 100,
      "lp_hz": 3200,
      "duck_db": -3.5,
      "label": "Mưa đêm nhẹ ngoài ngõ"
    }
  ],
  "music_arc": {
    "act1": { "sound": "sad_piano_minimal", "target_rms_dbfs": -27.5 },
    "act2": { "sound": "dark_drone_pressure", "target_rms_dbfs": -24.5 },
    "aftermath": { "sound": "cold_sub_drone_tail", "target_rms_dbfs": -28.0 },
    "duck_db": -8.5,
    "crossfade_s": 1.6,
    "silence_drop_floor_db": -48.0
  },
  "events": [
    {
      "id": "foley_bowl",
      "sound": "ceramic_bowl_clink",
      "bus": "sfx",
      "at_word": "bát",
      "align": "onset",
      "role": "foley",
      "pan": -0.30,
      "label": "Tiếng bát chạm bàn trong bếp tối"
    },
    {
      "id": "js_climax",
      "jumpscare": "entity_breath_shriek",
      "sound": "jumpscare_entity_shriek_ov",
      "sub_sound": "cinematic_boom",
      "pre_swell_sound": "dark_drone_pressure",
      "pre_swell_s": 1.35,
      "bus": "sfx",
      "at_silence_drop": 0,
      "edge": "end",
      "target_peak_dbfs": -1.0,
      "tinnitus": true,
      "label": "Hơi thở gắt và tiếng thét thực thể sau khoảng lặng"
    }
  ]
}
```

*(You can also declare custom score windows explicitly using `"scoreBeds": [{"act": "act1", "sound": "...", "start": 0.0, "end": 22.0, "target_rms_dbfs": -27.5}, ...]` under `folklore_atmospheric` or `cinematic_score`.)*

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
    vhs_static_burst, flashlight_click_sputter, neck_crack_wet, fly_buzz_loop,
)
from mix_base import (
    load_sfx_asset, load_voice, load_words, load_dead_silences, speech_spans,
    duck_db, apply_dead_silences, master_mix, write_mix_and_stems, ffmpeg_ebur,
)
```

Create **one shared reverb IR** per setting/episode so sounds feel glued in the same haunted space:

```python
r = rng(2026)
hall_ir = make_ir(rt60=2.3, seed=77, hf=1.4, early=[(0.025, 0.28, -0.4), (0.055, 0.18, 0.45)], density_lp=4200)
```

## 2. Cue Recipes Mapped to Visual Beats

### A. Act 1 Setup & Human Emotion (0.0s – 18.0s)
- Load a warm minimal pad or sad piano WAV from `audio/sfx_curated/sad_piano/` (`load_sfx_asset("sad_piano_minimal", library_dir="audio/sfx_library", dur_sec=20.0, loop=True)`), ducked `-8.5 dB` under `VieNeu-TTS` narration.

### B. Act 2 Intrusion & Dark Drone Crossfade
- Cosine-crossfade (`1.6s`) from Act 1 piano into `audio/sfx_curated/dark_drone/` so low-end pressure rises imperceptibly while dialogue reveals the anomaly.

### C. Pre-Jumpscare `-48 dB` `[SILENCE_DROP]` → 3-Beat Jumpscare Reveal
1. Pre-swell: fade up real low sub/drone `1.35s` ending cleanly right before `[SILENCE_DROP]`.
2. Uncanny Hush / False Release: `[SILENCE_DROP 0.5–1.2s]` drops BOTH `music` and `sfx` to **`-48.0 dB`**.
3. Impact Hit at `t_drop_end`: real recorded stinger WAV (`audio/sfx_curated/stinger/`) + real sub-bass boom mastered to **`-1.0 dBTP`**.

### D. Aftermath Cold Drone Tail
- Fade in a cold lingering low drone (`-28 dBFS`) `~1.8s` after the climax hit, ducking `-8.5 dB` under the final twist sentence and holding `1.0–1.5s` of eerie resonance at the end.

## 3. Ducking, TRUE `-48 dB` Silence Drop & Mastering Template

```python
words = load_words(words_json_path)
dead_silences = load_dead_silences(words_json_path)
spans = speech_spans(words, merge=0.28)

# Smooth -8.5 dB ducking (-7..-10 dB) keeps VieNeu-TTS 1.0x narration intimate & clear
duck = dbg(duck_db(spans, total_dur, depth=-8.5, pre=0.08, post=0.16, att=0.07, rel=0.48))
music *= duck[None, :]
sfx_duck = dbg(duck_db(spans, total_dur, depth=-3.5, pre=0.08, post=0.14, att=0.06, rel=0.45))
sfx_bed *= sfx_duck[None, :]

final_mix, stems, stats = master_mix(
    voice, music, sfx + sfx_bed,
    target_lufs=-16.0, ceil_db=-1.0, fade_out=0.12,
    dead_silences=dead_silences, ds_floor_db=-48.0,
)
write_mix_and_stems(audio_out_dir, final_mix, stems)
print(ffmpeg_ebur(os.path.join(audio_out_dir, "mix.wav")))
```

## 4. Series Continuity Rule (8–15 Part Episodes)
- Read `audio_bridge.drone_hz` and `audio_bridge.ambience` from `bible/CONTINUITY.json`.
- Keep Part `N` ending tail (`0.15 s` fade) and Part `N+1` opening tail (`0.15 s` fade) free of abrupt music transients if `OUTLINE.json` specifies `"transition_out": "fade:0.25"`, or end on a sharp stinger + cliffhanger word if `"transition_out": "cut"` or `"blackout:0.2"`.
