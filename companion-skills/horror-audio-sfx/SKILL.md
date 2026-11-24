---
name: horror-audio-sfx
description: Use when synthesizing expressive multi-speaker horror voices (7 MOOD_PROFILES, 1-file So-VITS-SVC Expressive VC-Pack with -na F0 preservation, procedural human breaths, character FX), building procedural copyright-free horror sound design & 27 stereo SFX in Python (numpy/scipy), carving TRUE -48 dB Dead Silence vacuums via mix_base.py, and mastering -15 LUFS audio mixes aligned to words.json.
---

# Expressive Horror Voice, TRUE Dead Silence & Procedural SFX v5.0 (`shorts-project/audio/` + `scripts/gen_horror_voice.py`)

Zero-copyright, 100% deterministic horror voice & sound synthesis powered by `numpy` and `scipy` at `48 kHz` stereo, 24-bit WAV (`dsp.py`, `horror_instruments.py`, `mix_base.py`, `gen_horror_voice.py`).

---

## 1. Core Horror Sound & Voice Principles

1. **Expressive Word-Level Voice Acting v5.5 — Never Flat Monotone:**
   - Synthesize via `gen_horror_voice.py` using **10 calibrated `MOOD_PROFILES`** (`calm_omen`, `curious`, `tense`, `whisper`, `fear_tremble`, `stutter_panic`, `dread`, `panic`, `cold_twist`, `ghost_entity`) spanning a wide **`0.68x .. 1.32x` tempo arc** and **`8.2 dB` loudness range** (`-5.2 dB` whisper → `+3.0 dB` stutter_panic), tunable via `--acting subtle|cinematic|extreme`.
   - Combine 5 pure-Python/ffmpeg vocal-tract acting DSP engines: **8-band Formant True Breathy Whisper Vocoder** (deferred post-SVC so F0 stays clean), **AM+FM 6.2 Hz Vocal-Cord Fear Tremor**, **Acoustic Syllable-Onset Stuttering** (`[STUTTER]` / `K-không`), **WSOLA Curious Rising / Dread Falling Pitch Ramp**, and **Word-Boundary Intra-Sentence Pacing** (`[SLOW]`/`[FAST]`, curious pre-keyword micro-pauses, fear-tremble mid-phrase halts) + **7 organic human cues** (`soft_inhale`, `short_inhale`, `sharp_gasp`, `tremble_gasp`, `shaky_exhale`, `whisper_breath`, `swallow`).
   - Pluggable `--tts-engine auto|edge|gemini`: automatically leverages **Gemini 2.5 Flash Preview TTS** (Free Tier REST API via `GEMINI_API_KEY`) with Vietnamese acting prompts, falling back seamlessly to cached 20-retry `edge-tts` + full acting DSP.
   - Normalize Vietnamese clock & date strings (`01:06` → `"một giờ sáu phút"`) strictly for TTS while keeping verbatim display tokens in `words.json`, and route `[SPEAKER: NAME | fx=dry|room|phone|ghost]` through dedicated Character DSP.
2. **So-VITS-SVC 1-File Expressive VC-Pack (`-na` F0 Preservation):**
   - **CRITICAL:** Never pass `-a` (`--auto-predict-f0`) on horror narration — `-a` erases all emotional whisper/curious/tremor/panic pitch contours!
   - Use the effortless 3-step 2-machine VC-Pack workflow (`--export-vc-pack` → run `run_svc_win.bat`/`run_svc_unix.sh` using **`-na`** on 1 file `narrator_guide_44k.wav` carrying full tempo swings, stutters, FM tremor & curious F0 → copy back `narrator_svc_out.wav` → `--vc-pack ... --narrator-vc-wav ...`) for exact 1:1 sample re-assembly + post-SVC True Breathy Whisper Vocoder + dynamic loudness + character voices! (Also supports `--export-acting-pack` for local GPU `F5-TTS-Vietnamese` / `VieNeu-TTS`.)
3. **TRUE Psychoacoustic Dead Silence (`-48 dB` Vacuum):**
   - `[DEAD SILENCE Xs]` in `SCRIPT.md` is NO LONGER cosmetic! `words.json` exports exact `dead_silences: [{ s, e }]` spans.
   - Pass `dead_silences=load_dead_silences(words_json)` directly into `master_mix(...)` (or call `apply_dead_silences(music, sfx, dead_silences, floor_db=-48.0)`): BOTH music and ambient SFX drop cleanly (`22 ms` pre-fade, `10 ms` post-fade) into an eerie **`-48 dB` vacuum**, making the ensuing `stinger` or whisper hit with physical shock!
4. **Voice-First Sparse Scoring & Dynamic Range (`LRA ~6–10 LU`):**
   - Keep horror beds below `180 Hz` (`sub_drone`) or above `2.5 kHz` (`whisper_ghost` / sparse `bowed_metal`) so `300 Hz – 2.2 kHz` stays crystal clear.
   - Let quiet creepy ambience sit at `-28..-22 LUFS` while `stinger` impacts hit `-10..-8 LUFS` momentary, averaging `-15.0 LUFS` integrated (`<= -1.2 dBTP`, `gr.max < 3.0 dB`).
5. **Series Continuity (`drone_hz` Lock):**
   - For multi-part episodes (`8–10` Parts), fix one `drone_hz` (e.g. `43.65 Hz`) and one `make_ir(rt60=2.4, seed=404)` across all Parts in `OUTLINE.json` / `CONTINUITY.json`.

---

## 2. Shared Modules (`shorts-project/audio/`)

- `dsp.py`: `SR`, `ns`, `tt`, `rng`, `lp`, `hp`, `bp`, `peq`, `shelf`, `reson`, `resbank`, `colored`, `smooth_noise`, `ramp`, `fades`, `curve`, `shape`, `phase`, `modal`, `pan`, `st`, `place`, `widen`, `make_ir`, `convolve_st`.
- `horror_instruments.py` (**27 procedural stereo horror instruments & Foley SFX**):
  - **Core Score & Ambience (9):** `sub_drone`, `bowed_metal`, `scary_musicbox`, `riser`, `stinger` (`boom|braam|shriek|cluster_stab`), `heartbeat`, `horror_strings`, `ambience_night` (`wind|rain|room_tone|creak|thunder|clock`), `whisper_ghost`.
  - **Action Foley Pack (6):** `footsteps_wood`, `rope_strain`, `door_slam_bolt`, `wet_drip`, `nail_scrape`, `lantern_sputter`.
  - **Build-Up, Climax & Folk Horror Pack (8):** `reverse_suck`, `shepard_tension`, `tinnitus_ring`, `whoosh_dark`, `entity_rattle` (`drowned|shriek_gasp`), `lightning_close`, `folk_wail` (*đàn nhị*), `woodblock_omen` (*mõ gỗ*).
  - **v5.0 PSX / Analog VHS & Visceral Dread Pack (4):**
    - `vhs_static_burst(dur, vel, r)`: Analog tape head tracking snow & electrical crackle synced to `aberration` / `RetroPsxEffect.dreadLevel` tape-tear bursts.
    - `flashlight_click_sputter(dur, vel, r, kind="off"|"on")`: Tactile mechanical button click + failing bulb electrical sputter.
    - `neck_crack_wet(dur, vel, r)`: Visceral brittle bone-snap + subtle wet tissue crunch for `neckTilt` / jaw dislocation beats.
    - `fly_buzz_loop(dur, vel, r)`: Stereo erratic darting fly hum paired with `addSwarmingFlies3D` decay props.
- `mix_base.py`: `cached`, `load_voice`, `load_words`, `load_dead_silences`, `speech_spans`, `duck_db`, `apply_dead_silences`, `master_mix(..., dead_silences=..., ds_floor_db=-48.0)`, `write_mix_and_stems`, `ffmpeg_ebur`.

---

## 3. Standard Mixing Pipeline (Per Video or Per Part)

1. **Lock Voice & Picture Timing First:** Generate `voice.wav` + `words.json` (with `dead_silences`), run `align_manifest.py`, and read exact `KICKS` / `OVERLAYS` / `words.json` timestamps.
2. **Generate 3 Stems** in `out/<project>/audio/build_audio.py`:
   - `voice` (`load_voice(voice_wav, total_sec)` — gain-only; expressive mood loudness, breaths & speaker FX are already sculpted in `gen_horror_voice.py`).
   - `music` (`sub_drone` + sparse `scary_musicbox` / `horror_strings` / `folk_wail`, ducked `-3.5..-5.0 dB` under `speech_spans(words)` via `duck_db`).
   - `sfx` (`ambience_night` bed + event-timed `riser` / `reverse_suck` → TRUE Dead Silence → `stinger` / `vhs_static_burst` / `neck_crack_wet` / `flashlight_click_sputter` / `fly_buzz_loop`, routed into per-setting `make_ir()` reverb with interior `lp(420 Hz)` occlusion behind closed doors).
3. **Master with Automatic TRUE Dead Silence & Verify:**
   ```python
   dead_silences = load_dead_silences(words_json_path)
   final_mix, stems, stats = master_mix(
       voice, music, sfx,
       target_lufs=-15.0, ceil_db=-1.2,
       dead_silences=dead_silences, ds_floor_db=-48.0,
   )
   write_mix_and_stems(audio_out_dir, final_mix, stems)
   print(ffmpeg_ebur(os.path.join(audio_out_dir, "mix.wav")))
   ```
   Verify `I` near `-15.0 LUFS`, `Peak <= -1.2 dBTP`, `gr.max < 3.0 dB`, and audible `-48 dB` vacuum during every `[DEAD SILENCE]` span.
4. **Mux Video:**
   ```bash
   ffmpeg -y -i out/<project>/video.mp4 -i out/<project>/audio/mix.wav -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 out/<project>/final.mp4
   ```

## Cookbook Reference

See [SOUND_CUES_COOKBOOK.md](./references/SOUND_CUES_COOKBOOK.md) for concrete Python recipes mapped to visual horror cues, TRUE Dead Silence mixing, and multi-part audio bridging.
