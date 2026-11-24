---
name: horror-script-storyboard
description: Use when writing expressive multi-speaker horror scripts (2.7-3.2 words/s with [NARRATOR | mood=...], [SPEAKER: ... | fx=...], [PAUSE], [DEAD SILENCE]), running the 1-file So-VITS-SVC Expressive VC-Pack workflow, auto-aligning manifest.json to words.json via align_manifest.py, or choreographing POV/cinematic multi-angle shot plans (SHOTS, WHIP_PANS, POV_MOTIONS, CAMS, DOF, KICKS, OVERLAYS) in story.ts.
---

# Horror Scriptwriting, Expressive Voice & Cinematic Storyboarding v5.0 (`SCRIPT.md` → `manifest.json` → `story.ts`)

## 1. Expressive Voice Acting & Multi-Speaker Script Grammar v5.5 (`SCRIPT.md`)

**Never write a flat wall of monochrome narration.** Horror Engine v5.5's `gen_horror_voice.py` synthesizes **per phrase and per word** with **10 distinct acting moods**, wide cinematic tempo contrast (`0.68x .. 1.32x`), **true breathy whisper vocoder**, **6.2 Hz vocal-cord fear tremor**, **real acoustic syllable stuttering**, **curious rising pitch inflection**, and **7 organic human body cues**:

- **Speed & Mandatory Tempo Contrast:** Average **`2.7–3.2 words/s`** (~150–185 words per 60 s), but EVERY 60 s short **MUST contain at least 3 distinct pace shifts** (slow suffocating dread/whisper `0.68x–0.74x` ↔ curious probing `0.88x` ↔ breathless stuttering panic `1.24x–1.32x`)!
- **10 Acting Mood Directives (`[NARRATOR | mood=... | acting="..."]`):**
  - `calm_omen` (`0.86x`, `0.0 dB`): trầm lắng, chắc nhịp đặt điềm báo.
  - `curious` (`0.88x → 0.76x`, `-1.0 dB`): **tò mò, dò xét, nghi hoặc** — tự chèn micro-pause `0.18s` trước từ khóa + uốn giọng **vút lên `+2.25 st`** cuối câu hỏi!
  - `tense` (`1.10x → 1.22x`, `+0.5 dB`): căng thẳng, tăng tốc dần về cuối câu.
  - `whisper` (`0.74x`, `-5.2 dB`): **thì thầm hơi gió thật sát tai** (8-band Formant Whisper Vocoder chạy hậu kỳ sau So-VITS-SVC!).
  - `fear_tremble` (`0.78x` đứt quãng, `-1.5 dB`): **sợ hãi, run giọng 6.2 Hz (AM+FM tremor)** + tự chèn 1–2 nhịp khựng run giữa câu + hít hơi run!
  - `stutter_panic` (`1.26x → 1.32x`, `+3.0 dB`): **lắp bắp + hoảng loạn tột độ** — nói gấp gáp, giọng vút cao + cắt lặp âm tiết đầu thật!
  - `dread` (`0.84x → 0.68x`, `-2.0 dB`): nặng nề, rợn gáy — tự **chậm dần hẳn xuống `0.68x`** và chìm giọng ở 2–3 chữ cuối câu!
  - `panic` (`1.24x → 1.32x`, `+3.0 dB`): hối hả, kêu cứu, tăng tốc gấp gáp.
  - `cold_twist` (`0.72x`, `-1.5 dB`): lạnh ngắt, vô hồn + tiếng **nuốt nước bọt khan (`swallow`)** + đuôi vang phòng lạnh.
  - `ghost_entity` (`0.70x`, `-0.5 dB`, `-2.55 st`): giọng ma ám trầm kéo dài + tiền-vang hút ngược (`reverse-reverb pre-swell`).
- **Inline Word/Phrase Director Tags (Use Directly Inside Dialogue Lines!):**
  - **Real Acoustic Stuttering:** Write `[STUTTER] cái gì` OR natural Vietnamese onset hyphens **`K-không`**, **`C-cái gì`**, **`Đ-đừng`** (TTS reads the clean word while the Acoustic Stutter Engine slices & repeats the true 95–125 ms consonant-vowel onset with choked glottal cuts — never pronounced as "K" or "C"!).
  - **Mid-Sentence Tempo Shifts:** `[SLOW]...[/SLOW]` (`0.74×`), `[FAST]...[/FAST]` (`1.32×`).
  - **Local Tremor & Upward Inflection:** `[TREMBLE]...[/TREMBLE]` (6.2 Hz frightened voice quiver on specific phrases), `[UP]` (rising curious inflection).
  - **Organic Human Body Cues & Micro-Beats:** `[BEAT]` (`0.22s` dramatic freeze), `[GASP]`, `[TREMBLE_GASP]`, `[SWALLOW]` (tense throat gulp), `[SIGH]`, `[WHISPER_BREATH]`.
- **Multi-Speaker Dialogue:** `[SPEAKER: TÊN | voice=vi-VN-NamMinhNeural|vi-VN-HoaiMyNeural | mood=... | pitch=... | speed=... | fx=dry|room|phone|ghost]`.
- **TRUE Psychoacoustic Silence & Hesitation:**
  - Write `[PAUSE 0.35s]` and `[DEAD SILENCE 0.65s]` before major reveals/twists — `mix_base.py` hard-mutes BOTH music and ambient SFX to **`-48 dB` vacuum** across every `[DEAD SILENCE]` span!
  - Use `...` (`…`) naturally inside tense sentences (auto-split into `0.42 s` pauses); clock/date formats (`01:06`, `22/11`) normalize automatically for TTS while preserving display tokens in `words.json`.
- **Example v5.5 `SCRIPT.md` Excerpt:**
  ```markdown
  [NARRATOR | mood=calm_omen]
  Đêm canh linh cữu lúc 01:06, cả ngôi nhà tối om.
  [NARRATOR | mood=curious]
  Ơ... tiếng cào gì phát ra từ trong chiếc tủ gỗ vậy?
  [NARRATOR | mood=whisper]
  Suỵt... đừng thở mạnh... hình như nó đang nghe thấy chúng ta.
  [DEAD SILENCE 0.75s]
  [NARRATOR | mood=fear_tremble]
  [GASP] Tay tôi lạnh cóng... [TREMBLE] cánh cửa tủ đang từ từ hé mở ra! [/TREMBLE]
  [NARRATOR | mood=stutter_panic]
  K-không... c-cái gì ngoài đó vậy?! [FAST] Chạy ngay đi, đừng ngoái lại! [/FAST]
  [NARRATOR | mood=cold_twist]
  [SWALLOW] [SLOW] Nhưng khi tôi quay đầu lại... [/SLOW] [BEAT] thứ đó đã đứng sẵn sau lưng tôi.
  ```
- **No On-Screen Captions by Default:** Keep `HorrorHUD` captions opt-in via `hudFromManifest(MANIFEST)` unless requested (`GEMINI.md`).

---

## 2. Generating Expressive Acting Voice (Pluggable `auto|edge|gemini` + 1-File So-VITS-SVC VC-Pack)

- **Acting Intensity & TTS Engine Flags:**
  - `--acting subtle|cinematic|extreme` (default **`cinematic`** — wide `0.68x..1.32x` tempo spread, acoustic stuttering, 6.2 Hz tremor, true breathy whisper).
  - `--tts-engine auto|edge|gemini`: automatically uses **Gemini 2.5 Flash Preview TTS** (Free Tier REST API with Vietnamese acting prompts, 0 extra pip deps) if `GEMINI_API_KEY` is set, and falls back smoothly to `edge-tts` + full Word-Level Micro-Prosody Acting DSP when offline/no key!
  - Optional `--export-acting-pack <dir>` exports `acting_pack.json` for local GPU zero-shot emotional cloning (`F5-TTS-Vietnamese` / `VieNeu-TTS`) on your So-VITS-SVC PC.

### Recommended 2-Machine So-VITS-SVC Narrator Workflow (Preserves ALL Acting Rhythm, Stuttering, Tremor & Intonation!)
1. **This PC — Export 1 Expressive Acting Guide WAV + Helper Scripts:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --acting cinematic --export-vc-pack out/<project>/vc_pack
   ```
   Generates `narrator_guide_44k.wav` (already carrying full `0.68x..1.32x` tempo swings, real acoustic stutters, FM tremor & curious rising F0 — while deferring whisper air noise to Step 3 so So-VITS-SVC tracks clean F0!), `vc_pack_manifest.json`, `run_svc_win.bat`, and `run_svc_unix.sh`.
2. **Your So-VITS-SVC Machine — Convert 1 File Using `-na` (`--no-auto-predict-f0`):**
   - Run `run_svc_win.bat` / `run_svc_unix.sh` (**CRITICAL:** always use **`-na`** so So-VITS-SVC mirrors 100% of the tempo, stutter, tremor, and F0 acting!) → produces `narrator_svc_out.wav`.
3. **This PC — Exact 1:1 Re-Assembly + True Breathy Whisper Vocoder + Multi-Speaker Dialogue + Human Cues:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
     --acting cinematic \
     --vc-pack out/<project>/vc_pack \
     --narrator-vc-wav out/<project>/vc_pack/narrator_svc_out.wav \
     --out-dir out/<project>/voice
   ```
   Outputs 48 kHz mono `voice.wav` + `words.json` (with `speaker`, `mood`, `wps`, and `dead_silences`).
- *Quick preview / no SVC needed:* Pass `--no-vc`. Toggle automatic breaths with `--no-auto-breath`.
- *External human / F5-TTS / VieNeu-TTS clips:* Also supports `--export-narrator-script`, `--export-acting-pack`, `--narrator-dir <folder>` (`N01.wav..`), and `--narrator-audio <full.wav>` (auto VAD split).

---

## 3. Auto-Locking `manifest.json` ↔ `words.json` (`align_manifest.py`)

Never calculate beat frames by hand! Draft `manifest.json` with each beat's `spokenLine.text`, then lock exact contiguous `[a, b)`, `peakFrame`, `blendRange`, and `totalFrames` automatically:

```bash
python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
python3 scripts/validate_manifest.py src/<project>/manifest.json \
  --script out/<project>/SCRIPT.md \
  --words out/<project>/voice/words.json \
  --registry LOCATION_REGISTRY.json \
  --update-registry \
  --still-out out/<project>/still_manifest.json
```

---

## 4. The 8-Beat Dark-Horror POV Standalone Formula (55–75 s)

1. **Cold Hook (`0–8 s`, `POV` or `WS`, `mood=calm_omen`):** Establish the chilling rule/atmosphere and unique `LocationBlueprint` — **DO NOT spoil the entity's full face here!** Optional subtle distant `addCornerLurker3D` (`breathing: false`).
2. **POV Interaction / Inciting Cue (`8–16 s`, `POV_TURN` → `POV_PROP`, `mood=tense`):** 6–8f deterministic `whipPan` toward a diegetic 3D prop (`Phone3D` lockscreen alert synced with `HorrorHUD`, `PaperProp3D`, or `HandheldOilLamp3D`).
3. **First Uncanny Anomaly (`16–25 s`, `POV_DOWN` or `LOW`, `mood=whisper`):** Look down or toward a threshold (`addDoubleDoorWithCracks` moonlight + 2 foot shadows, subtle `doorwayPeek` stage `0`, dying oil lamp `warmLamp → coldMoon` via `getLightBlend`).
4. **Investigation (`25–32 s`, `MCU` or `POV`, `mood=dread`):** `peerForward` / `dollyZoom` compression + `Flashlight3D` SpotLight sweep across grimy walls & creeping `beat.fogOverride`.
5. **Threat Tease & TRUE Dead Silence (`32–38 s`, `ECU` / `POV_CU`, `[DEAD SILENCE 0.65s]`):** Close sensory cue (claw fingers gripping doorframe, `torchMalfunction` flashlight sputter) → `{ kind: "blackout", a, b }` + `-48 dB` audio vacuum.
6. **Staged Climax Reveal (`38–46 s`, `LOW` → `CU`, `mood=panic`):** 3-stage monster escalation (`doorwayPeek` → `stalkLoom` → `lungeCloseUp`) + `{ kind: "aberration", a, b, strength }` VHS `tapeTear` surge + optional 3D `lightning` flash + protagonist `recoil`.
7. **Escape / Sanctuary Shift (`46–64 s`, `POV_TURN` Dutch tilt → `Reverse WS` → `MS`):** Dynamic confrontation / frantic `whipPan` escape → `{ kind: "dipBlack", at, dur: 10, hold: 2 }` into a second unique `LocationBlueprint` or bolted interior.
8. **Lingering Psychological Twist (`64–74 s`, `OTS` / `POV_DOWN`, `mood=cold_twist`):** False safety → slow `turnHead` + subtle `vignettePulse` revealing the unmistakable physical evidence that the entity is already inside.

---

## 5. Mandatory Cinematography & Transition Rules (`story.ts`)

1. **Zero Repeated Camera Angles:** Every shot in `SHOTS` MUST declare a valid v5.0 `ShotScale` (`POV`, `POV_PROP`, `POV_TURN`, `POV_DOWN`, `POV_CU`, `WS`, `MS`, `OTS`, `MCU`, `CU`, `ECU`, `LOW`) and valid physical `LightKey` (`warmLamp | coldMoon | fluorescent | duskFog | flashlight`). Never perform static-layout filter jump-cuts (`corr > 0.88`).
2. **Engine Camera & Motion Archetypes (`camera.ts`):** Combine `whipPan`, `povBreath`, `camOTS`, `camArc`, `camPOV`, `camECU`, `dollyZoom`, `handheld`, `snapZoom`, `pushK`, and `rolled` (`0.06–0.095` rad Dutch tilt). Declare all fast head-snaps in `WHIP_PANS` and close prop raises in `POV_MOTIONS` for `extract_shots.py`.
3. **Purposeful Transitions (`OVERLAYS`):**
   - `{ kind: "dipBlack", at, dur: 10, hold: 2 }` for location/time jumps.
   - `{ kind: "blackout", a, b }` for `[DEAD SILENCE]` vacuum beats; `{ kind: "lightning", f }` for real 3D storm flashes.
   - `{ kind: "vignettePulse", a, b, freq, strength }` for creeping dread/heartbeat tension.
   - `{ kind: "aberration", a, b, strength }` to trigger VHS `tapeTear` / `RetroPsxEffect.dreadLevel` surges on entity reveals.
4. **Action-to-Word Lock:** Land visual impacts (`KICKS`, `lightning`, `aberration`, `lungeCloseUp`, `turnHead`) **0–2 frames before** the matching trigger word in `words.json`.

## Formulas & Multi-Part Series Arc

See [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) for beat templates across all 3 sub-genres and the 8–10 Part Series structure.
