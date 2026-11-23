---
name: horror-audio-sfx
description: Use when creating procedural copyright-free horror sound design, music stems, Dead Silence pacing, or -15 LUFS audio mixes in Python (numpy/scipy) aligned to words.json for a horror short or multi-part horror series.
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
- `shorts-project/audio/horror_instruments.py` (23 procedural horror instruments & Foley SFX):
  - **Core Score & Ambience (9):** `sub_drone`, `bowed_metal`, `scary_musicbox`, `riser`, `stinger` (`boom|braam|shriek|cluster_stab`), `heartbeat`, `horror_strings`, `ambience_night` (`wind|rain|room_tone|creak|thunder|clock`), `whisper_ghost`.
  - **Action Foley Pack (6):** `footsteps_wood` (slow cautious or frantic fleeing pier/floorboard steps), `rope_strain` (taut hemp fiber creak), `door_slam_bolt` (heavy timber door slam + wooden crossbar drop), `wet_drip` (cold echoing liquid drops), `nail_scrape` (fingernails dragging on dark glass/wood), `lantern_sputter` (oil flame crackle & optional snuff puff).
  - **Build-Up, Climax & Folk Horror Pack (8):** `reverse_suck` (vacuum reverse-reverb pre-scare inhale), `shepard_tension` (psychoacoustic endlessly rising pitch illusion), `tinnitus_ring` (post-shock high-frequency ear ringing), `whoosh_dark` (sub-air cut transition whoosh), `entity_rattle` (`drowned` wet throat croak / `shriek_gasp` distorted lunge screech), `lightning_close` (2-stage electric arc snap -> chest-shaking sub thunder), `folk_wail` (mourning microtonal Vietnamese bowed *đàn nhị*), `woodblock_omen` (hollow dry wooden *mõ* omen knocks).
- **Dual-Space Acoustic IR & Occlusion:** Build 1 `make_ir()` per setting (`wharf_ir` wide `rt60 ~2.35s` vs. `shack_ir` tight `rt60 ~0.65s`), route wet sends per era, low-pass (`lp 380-420 Hz`) exterior storm/rain behind closed doors/walls on interior cuts, and optionally add a faint `-18 dB` pre-delayed reverb halo strictly on the chilling final twist sentence.
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
