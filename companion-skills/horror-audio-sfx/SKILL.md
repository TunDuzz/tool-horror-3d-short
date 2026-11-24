---
name: horror-audio-sfx
description: Use when building studio-clean horror voice tracks (100% open-source VieNeu-TTS 48kHz CPU, IndexTTS-2 Vietnamese / F5-TTS-Vietnamese GPU packs, So-VITS-SVC 1-file VC-Pack -na), managing real CC0 & neural horror SFX assets (sfx_manager.py: Freesound CC0 Foley, TangoFlux text-to-SFX, MMAudio video-to-audio), carving TRUE -48 dB Dead Silence vacuums via mix_base.py, and mastering -15 LUFS mixes aligned to words.json.
---

# Studio-Clean Neural Horror Voice, Real Cinema SFX & TRUE Dead Silence v6.0

Zero-distortion, act-level coherent Vietnamese horror voice + **Asset-First Real Cinema SFX** + **TRUE `-48 dB` Dead Silence** mastering at `48 kHz` stereo 24-bit WAV (`mix_base.py`, `dsp.py`, `sfx_manager.py`, `gen_horror_voice.py`).

---

## 1. Golden Rules of Studio Horror Audio v6.0

1. **NEVER Fake Human Emotion With Distorting DSP:**
   - Do **NOT** apply white-noise whisper vocoders, artificial 6 Hz vibrato, or raw waveform stutter-slicing onto flat TTS — those cause radio static and unnatural glitches.
   - Do **NOT** chop a 60 s script into 15–20 tiny disconnected TTS calls. Group contiguous narrator lines into **2–4 coherent contextual Acts** (splitting ONLY on `[DEAD SILENCE Xs]`, explicit `[PAUSE Xs]`, or speaker/act changes) so the neural voice model delivers natural storytelling rhythm and smooth tonal transitions!
2. **Real Neural Acting Sources (100% Free & Open-Source):**
   - **Local CPU 48 kHz (`--tts-engine vieneu`):** [`pnnbao97/VieNeu-TTS`](https://github.com/pnnbao97/VieNeu-TTS) (`pip install vieneu`, ONNX CPU torch-free) — native 48 kHz Vietnamese storytelling with per-mood `silence_p` (`0.05s` panic vs `0.46s` dread) + `temperature` + clean formant-preserved `rubberband` pace trim (`0.82x..1.08x`), native `[thở dài]` / `[hắng giọng]`, AND automatic **`audio/emotion_refs/` 6-clip Emotion Bank** cloning!
   - **3-Minute Permanent Emotion Bank + Single-Voice Lock (`scripts/prepare_emotion_refs.py` + `curate_emotion_candidates.py` + `--speaker-lock`):**
     - Run `python3 scripts/prepare_emotion_refs.py guide` (or curate open clean clips via `curate_emotion_candidates.py fetch` → review → `apply`) into `audio/emotion_refs/`.
     - **Single-Voice Speaker Lock (v6.3, ON by default):** Even when `audio/emotion_refs/` clips come from different actors, `gen_horror_voice.py --speaker-lock` locks `speaker_emb` to ONE narrator identity (`audio/narrator_anchor.wav` if present, else `--vieneu-voice "Thiện Minh"`) + aligns each reference clip's baseline F0 to that narrator's vocal register BEFORE extracting `ref_codes` — preventing 2–3 speaker tone drift while preserving emotion & pacing!
     - **Optional 1-Time So-VITS-SVC Bank Unification:** Run `prepare_emotion_refs.py export-vc-bank` (creates one ~33 s `emotion_bank_6in1_44k.wav`) → convert ONCE with So-VITS-SVC `-na` → `import-vc-bank` so all 6 emotion refs permanently wear your own narrator voice!
   - **Voice-to-Voice Directing (`--human-guide recording.m4a`):** Pass your own 60 s rough acting take directly into `--export-vc-pack` so So-VITS-SVC (`-na`) converts your exact human pacing & emotion into the narrator voice!
   - **Local GPU Acting Pack (`--export-gpu-voice-pack` → `--import-acts`):**
     - **[`dinhthuan/index-tts-2-vietnamese`](https://huggingface.co/dinhthuan/index-tts-2-vietnamese)** (`iamdinhthuan/index-tts-finetune-vietnamese`): Disentangles speaker timbre (`spk_audio_prompt`) from **8-D emotion vectors** (`[happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]`) — genuine neural fear, curiosity, and dread in your narrator's own voice!
     - **[`nguyenthienhy/F5-TTS-Vietnamese`](https://github.com/nguyenthienhy/F5-TTS-Vietnamese):** Flow-matching zero-shot emotional reference cloning.
   - **2-Machine So-VITS-SVC 1-File VC-Pack (`--export-vc-pack` → `-na` → `--vc-pack` + `--narrator-vc-wav`):** Exports a clean, distortion-free act-level `narrator_guide_44k.wav` (supports `--multi-style-guide` when no `emotion_refs/` exist) and always runs So-VITS-SVC with **`-na`** so natural pitch & pacing are preserved 100%.
   - **Clean Fallbacks:** `--tts-engine edge` (whole-act distortion-free `edge-tts`) or `--tts-engine gemini` (Gemini 2.5 Flash TTS Free Tier via `GEMINI_API_KEY`).
3. **Asset-First Real Cinema Foley & Story-Driven Sparse Rules (v7.0 — Openverse 5.2M API + `cues.json` + 6 Anti-Clutter QA Gates):**
   - **NEVER hardcode one ambience bed across different stories!** Pick **at most 1 setting-matched bed** per story (e.g., rainy night house → indoor rain; sterile corridor → quiet room tone; dark alley → light cold wind) with dialog-safe EQ (`lp_hz`, `voice_notch_db`) so it never fights the narrator's voice.
   - **Sparse Horror Budget (`4–6` hero SFX per 45–60s):** One hero sound per moment; **NEVER** stack `>= 2` spot SFX inside `0.60s` (anti-crowding); keep `mood == "whisper"` acts **completely free of intrusive spot SFX** and automatically duck the bed `-12..-16 dB` during whispers!
   - **Openverse Audio API (`sfx_manager.py search-openverse` / `fetch-openverse`, ZERO API key):** Searches 5.2M real Freesound/Jamendo files strictly filtered to commercial-safe licenses (`cc0,pdm` default, optional `--allow-cc-by`, **NEVER `nc`/`nd`**), measures `onset_s`/`peak_s`/`tail_end_s`, tracks `history.jsonl --fresh` to avoid repeating sounds across videos, and auto-writes verbatim attributions to `credits.txt`.
   - **Declarative `cues.json` + `scripts/mix_cues.py --strict`:** Align hits via `align: "onset"`, whooshes via `"peak"`, reverse swells via `"end"`, anchored to `at_act`, `at_word`, or `at_dead_silence`. Always verify with `mix_report.md` and hand the user **5 concrete timestamps to check with headphones** — never claim a mix "sounds good" by feel alone!
   - Restrict procedural `horror_instruments.py` strictly to clean non-intrusive sub-bass (`sub_drone < 90 Hz`) and pre-silence `reverse_suck`.
4. **TRUE Psychoacoustic Dead Silence (`-48 dB` Vacuum):**
   - Pass `dead_silences=load_dead_silences(words_json)` directly into `master_mix(..., dead_silences=..., ds_floor_db=-48.0)` so BOTH music and ambient SFX drop smoothly (`22 ms / 10 ms` cosine edges) into a **`-48 dB` vacuum** across every `[DEAD SILENCE Xs]` span.
5. **Voice-First Sparse Scoring & Dynamic Range (`-15.0 LUFS`, `LRA ~5–9 LU`, `<= -1.2 dBTP`):**
   - Keep music beds below `180 Hz` or above `2.5 kHz`, duck music `-4.5..-5.5 dB` under speech, and lock one `drone_hz` + reverb IR across multi-part series.

---

## 2. Managing Real Cinema SFX (`scripts/sfx_manager.py`)

### A. Openverse 5.2M Audio API (ZERO API Key, Commercial-Safe) + Local CC0 Library
```bash
# 1. Search real Freesound/Jamendo recordings via Openverse (CC0/PDM default; add --allow-cc-by if needed; --fresh skips recent history)
python3 scripts/sfx_manager.py search-openverse --query "wooden door creak" --fresh --library shorts-project/audio/sfx_library

# 2. Fetch chosen sound into 48 kHz stereo library + measure onset/peak/tail + auto-write credits.txt
python3 scripts/sfx_manager.py fetch-openverse --id <OPENVERSE_UUID> --name wooden_door_creak_ov --category foley --library shorts-project/audio/sfx_library

# 3. Bootstrap 25 verified strict-CC0 starter Foley clips + analyze onset/peak timings + verify 0 clipping
python3 scripts/sfx_manager.py fetch-cc0-open --library shorts-project/audio/sfx_library
python3 scripts/sfx_manager.py analyze --library shorts-project/audio/sfx_library
python3 scripts/sfx_manager.py verify --library shorts-project/audio/sfx_library
```

### B. Declarative `cues.json` Mixing With 6 Anti-Clutter Horror QA Gates (`scripts/mix_cues.py`)
```bash
# Mix voice + 1 story-matched bed + 4-6 onset/peak/end aligned SFX + TRUE -48 dB Dead Silence + mix_report.md + credits.txt
python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/mix.wav --strict
```

### B. Open-Source Local GPU Neural SFX Packs (`TangoFlux` & `MMAudio`)
```bash
# Export ready-to-run GPU scripts for declare-lab/TangoFlux (text-to-SFX 44.1kHz stereo) & hkchengrex/MMAudio (video-to-audio Foley)
python3 scripts/sfx_manager.py export-sfx-pack --out-dir out/<project>/gpu_sfx_pack --video out/<project>/video.mp4
```
- On your RTX GPU PC (`>= 6 GB VRAM`): run `run_tangoflux_sfx.py` (`tangoflux` generates 30s stereo 44.1 kHz SFX in ~3.7s/clip) or `run_mmaudio_video.py` (`MMAudio` generates frame-locked Foley straight from `video.mp4`!), then copy `generated_sfx/` back and run `sfx_manager.py import-local`.
- *Optional Cloud GitHub Skill:* [`github.com/elevenlabs/skills`](https://github.com/elevenlabs/skills) also provides official agent skills for both `sound-effects` and `text-to-speech` (Eleven v3) if desired.

---

## 3. Standard Asset-First Mixing Pipeline (`out/<project>/audio/build_audio.py`)

```python
from mix_base import (
    load_voice, load_words, load_dead_silences, load_sfx_asset,
    speech_spans, duck_db, master_mix, write_mix_and_stems, ffmpeg_ebur,
)
from horror_instruments import sub_drone, riser, stinger, reverse_suck

# Load real recorded / TangoFlux WAV assets first (returns None if missing so you can fallback cleanly)
rain = load_sfx_asset("rain_on_roof", dur_sec=total_dur, gain_db=-16.0, loop=True)
creak = load_sfx_asset("wooden_door_creak", gain_db=-6.0, pan_pos=-0.35)
# Layer clean procedural sub-bass tension + TRUE -48 dB Dead Silence!
dead_silences = load_dead_silences(words_json_path)
final_mix, stems, stats = master_mix(
    voice, music, sfx,
    target_lufs=-15.0, ceil_db=-1.2,
    dead_silences=dead_silences, ds_floor_db=-48.0,
)
write_mix_and_stems(audio_out_dir, final_mix, stems)
print(ffmpeg_ebur(os.path.join(audio_out_dir, "mix.wav")))
```

## Cookbook Reference

See [SOUND_CUES_COOKBOOK.md](./references/SOUND_CUES_COOKBOOK.md) for concrete cue timing recipes and multi-part audio bridging.
