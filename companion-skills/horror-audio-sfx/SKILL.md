---
name: horror-audio-sfx
description: Use when building clean 1.0x studio horror voice tracks (Gemini TTS whole-act or --import-voice with ZERO tempo/pitch/F0 DSP + faster-whisper Forced Word Alignment <35ms + 30fps rms_envelope_30fps), auto-fetching real recorded CC0 SFX from Openverse via sfx_manager.py auto-fetch-for-script, mixing Real-SFX-first soundscapes with mandatory min_jumpscares >= 1, [SILENCE_DROP Xs] Uncanny Hush, dual occluded beds, rhythmic motifs, and mastering -16.0 LUFS / -1.0 dBTP mixes locked to words.json.
---

# Clean 1.0x Studio Horror Voice, Automated Real CC0 SFX & Mandatory Jumpscare Soundscape Engine v15.0

Studio-clean Vietnamese horror audio at `48 kHz` stereo WAV (`-16.0 LUFS`, **`-1.0 dBTP`**, **`min_jumpscares >= 1` mandatory**): zero artificial tempo-stretch/pitch-shift DSP distortion (`1.0x` natural human cadence via whole-act **Gemini TTS** or `--import-voice` real/RVC recording), `<35ms` Whisper forced word alignment + `rms_envelope_30fps` for frame-accurate mouth animation, automated real CC0 SFX downloading (`sfx_manager.py auto-fetch-for-script`), Real-SFX-first mixing (`SYNTH_SFX_FORBIDDEN` unless opted in), dual-layer occluded beds, recurring `motifs[]`, `[SILENCE_DROP Xs]` uncanny hush, and synchronized real-asset Jumpscare impact (`mix_base.py`, `dsp.py`, `sfx_manager.py`, `gen_horror_voice.py`, `mix_cues.py`).

---

## 1. Golden Rules of Clean Studio Horror Audio v15.0

1. **ZERO Tempo / Pitch / F0 Distortion DSP by Default:**
   - `gen_horror_voice.py` disables `clean_tempo` stretching (`0.76x–0.85x`), `pitch_semi` shifting, and `_align_ref_f0_to_anchor` by default — keeping exact `1.0x` natural speech speed and formants (retaining ONLY clean `45 Hz HPF` + light RMS balancing + peak guard).
   - **Never fragment sentences on inline `[PACE]`/`[PITCH]` tags:** Whole paragraphs stay contiguous for natural whole-act neural delivery via **Gemini TTS** (`GEMINI_API_KEY`, preferred in `--tts-engine auto`), or direct single-file ingestion via **`--import-voice recording.wav`** (real voice or clean RVC) aligned automatically via Whisper!
   - **30fps Vocal RMS Envelope (`rms_envelope_30fps`):** Every run exports a per-frame `[0..1]` vocal amplitude envelope in `words.json` (and `RMS_ENVELOPE` in `words.ts`) so `stage.ts` drives `Character25D` & `Character3D` talking states directly from real sound energy.
2. **Real-SFX-First & 100% Automated Openverse CC0 Fetching (`sfx_manager.py auto-fetch-for-script`):**
   - Never rely on fake synthetic SFX (`synth:` is blocked by `mix_cues.py --strict` via `SYNTH_SFX_FORBIDDEN` unless `allow_synth: true` is explicitly set).
   - Run `python3 scripts/sfx_manager.py auto-fetch-for-script --cues out/<project>/cues.json --library audio/sfx_library` so every missing bed, motif, foley, and jumpscare WAV referenced in `cues.json` is automatically searched on Openverse CC0/PDM (excluding `history.jsonl` for anti-repetition), downloaded, normalized to `48 kHz` stereo, envelope-analyzed (`onset_s`, `peak_s`, `tail_end_s`), and credited in `credits.txt`!
3. **Mandatory High-Impact Jumpscare (`min_jumpscares >= 1`, `-1.0 dBTP`):**
   - The legacy `max_jumpscares = 0` default is REMOVED. Every `55–90s` short MUST include **1–2 synchronized Jumpscare events** (and `>= 1` per chapter on long-form series), enforced by `MISSING_JUMPSCARE_ERROR` in both `mix_cues.py --strict` and `validate_manifest.py --cues`.
   - `_build_jumpscare_composite` prioritizes **100% real recorded CC0 WAVs** (`sub_candidates` + `bite_candidates`) without layering artificial procedural `stinger("shriek")` when a real bite WAV is loaded, mastering to **`-1.0 dBTP`** so the Jumpscare hits hard with 0 clipping.
4. **Uncanny Hush `[SILENCE_DROP Xs]`, Dual Beds, Motifs & `storyboard_proof.html` Sync:**
   - Keep `near` + `far` (occluded) beds, `>= 1` rhythmic `motifs[]`, `[SILENCE_DROP 0.6–1.2s]` right before the Jumpscare, and `< 35ms` Whisper word timings feeding `align_manifest.py` + `stillKeyframes` (`storyboard_proof.html`).

---

## 2. Standard v15.0 Voice & SFX Commands

```bash
# 1A. Whole-act clean 1.0x Gemini TTS (auto-loads GEMINI_API_KEY) + Whisper forced alignment + rms_envelope_30fps
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine auto --word-aligner auto --strict-hook \
  --out-dir out/<project>/voice --no-vc

# 1B. Or import a clean single-take human / RVC WAV with 0% tempo/pitch DSP
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --import-voice my_clean_take.wav --word-aligner auto \
  --out-dir out/<project>/voice

# 2. Auto-fetch every missing real CC0 SFX referenced in cues.json from Openverse
python3 scripts/sfx_manager.py auto-fetch-for-script --cues out/<project>/cues.json --library shorts-project/audio/sfx_library

# 3. Mix & master (-16.0 LUFS, -1.0 dBTP, mandatory >= 1 real-SFX jumpscare) + mix_report.md + credits.txt
python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/audio/mix.wav --strict
```

## Cookbook Reference

See [SOUND_CUES_COOKBOOK.md](./references/SOUND_CUES_COOKBOOK.md) for concrete cue timing recipes and multi-part audio bridging.
