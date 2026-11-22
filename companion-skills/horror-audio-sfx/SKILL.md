---
name: horror-audio-sfx
description: Synthesize copyright-free procedural horror sound design and music scores in Python (sub-bass drones, bowed waterphone metal, detuned music box, risers, stingers, heartbeats, tremolo strings, night ambience, and spectral whispers), aligned to words.json with Dead Silence pacing and -15 LUFS mastering. Use when creating audio stems or mixes for a horror short or multi-part horror series.
---

# Procedural Horror Audio & SFX (`shorts-project/audio/`)

Zero-copyright, 100% deterministic sound synthesis powered by `numpy` and `scipy` at `48 kHz` stereo, 24-bit WAV (`dsp.py`, `horror_instruments.py`, `mix_base.py`).

## Core Horror Sound Principles

1. **Silence Is the Loudest Scare:** Never fill every second with continuous music. Drop ambient beds and drones to near-zero (`-18 dB` or mute) for **`0.35–0.85 s` (Dead Silence)** immediately before a reveal or stinger.
2. **Voice-First Sparse Scoring:** Keep narration crystal clear. Horror beds belong below `180 Hz` (`sub_drone`) or above `2.5 kHz` (`whisper_ghost` / sparse `bowed_metal` harmonics) so the `300 Hz – 2.2 kHz` voice clarity band stays uncluttered.
3. **Preserve Dynamic Range (`LRA ~6–10 LU`):** Unlike upbeat comedy shorts (`LRA ~2–3 LU`), allow quiet creepy ambience to sit around `-28..-22 LUFS` while `stinger` impacts hit `-10..-8 LUFS` momentary, averaging `-15 LUFS` integrated (`<= -1.2 dBTP`).
4. **Series Continuity (`drone_hz` Lock):** For multi-part episodes (`8–10` Parts), fix one fundamental root pitch (e.g., `drone_hz = 43.65` Hz = F1) and one reverb impulse response (`make_ir(rt60=2.4, seed=404)`) in `OUTLINE.json` / `CONTINUITY.json` so all Parts glue smoothly during `stitch_parts.py`.

## Shared Modules

- `shorts-project/audio/dsp.py`: `SR`, `ns`, `tt`, `rng`, `lp`, `hp`, `bp`, `peq`, `shelf`, `reson`, `resbank`, `colored`, `smooth_noise`, `ramp`, `fades`, `curve`, `shape`, `phase`, `modal`, `pan`, `st`, `place`, `widen`, `make_ir`, `convolve_st`.
- `shorts-project/audio/horror_instruments.py`:
  - `sub_drone(f, dur, vel, r, beat_hz, dark, att, rel)` -> stereo ominous sub rumble
  - `bowed_metal(f, dur, vel, r, bend_semi, att, rel)` -> mono waterphone / bowed metal screech
  - `scary_musicbox(f, vel, r, dur, detune_cents, wow_hz, wow_cents)` -> mono detuned warbling tine
  - `riser(dur, f0, f1, vel, r, hard_cut)` -> stereo tension riser (with optional sharp dead-silence cutoff)
  - `stinger(kind, vel, r, dur, f0)` -> `"boom" | "braam" | "shriek" | "cluster_stab"`
  - `heartbeat(bpm, dur, vel, r, accel_to)` -> mono accelerating lub-dub thump
  - `horror_strings(freqs, dur, vel, r, att, rel, trem_hz, sul_pont)` -> stereo dissonant tremolo bed
  - `ambience_night(dur, kind, vel, r)` -> `"wind" | "rain" | "room_tone" | "creak" | "thunder" | "clock"`
  - `whisper_ghost(dur, vel, r, pan_from, pan_to)` -> stereo sweeping breathy phantom whisper
- `shorts-project/audio/mix_base.py`: `cached`, `load_voice`, `load_words`, `speech_spans`, `duck_db`, `master_mix`, `write_mix_and_stems`, `ffmpeg_ebur`.

## Standard Mixing Pipeline (Per Video or Per Part)

1. **Lock Picture Timing First:** Read exact shot/overlay timestamps (`KICKS`, `OVERLAYS`, `words.json`) before synthesizing final stems.
2. **Generate 3 Stems** in `out/<project>/audio/build_audio.py`:
   - `voice` (`load_voice(voice_wav, total_sec)` — gain-only, no destructive EQ/compression).
   - `music` (`sub_drone` + sparse `scary_musicbox` / `horror_strings` + `bowed_metal`, dipped during `dead_silences` read from `words.json`, ducked `-3.5` to `-5.0 dB` under `speech_spans(words)` via `duck_db`).
   - `sfx` (`ambience_night` bed + event-timed `riser` -> Dead Silence -> `stinger` / `thunder` / `creak` / `heartbeat` / `whisper_ghost`, panned via `pan()` and placed in shared `make_ir()` reverb space).
3. **Master & Verify:**
   - Call `master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2)`.
   - Write `mix.wav` + `stem_voice.wav`, `stem_music.wav`, `stem_sfx.wav` using `write_mix_and_stems`.
   - Print `ffmpeg_ebur(mix_wav)` and verify `I` near `-15.0 LUFS`, `Peak <= -1.2 dBTP`, and `gr.max < 3.0 dB` (no audible limiter pumping).
4. **Mux Video:**
   ```powershell
   ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 out/<project>/final.mp4
   ```

## Cookbook Reference

See [SOUND_CUES_COOKBOOK.md](./references/SOUND_CUES_COOKBOOK.md) for concrete Python recipes mapped to visual horror cues and multi-part audio bridging.
