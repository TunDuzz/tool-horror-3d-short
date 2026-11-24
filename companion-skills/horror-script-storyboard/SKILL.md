---
name: horror-script-storyboard
description: Use when writing expressive multi-speaker horror scripts (2.7-3.2 words/s with [NARRATOR | mood=...], [SPEAKER: ... | fx=...], [PAUSE], [DEAD SILENCE]), running the 1-file So-VITS-SVC Expressive VC-Pack workflow, auto-aligning manifest.json to words.json via align_manifest.py, or choreographing POV/cinematic multi-angle shot plans (SHOTS, WHIP_PANS, POV_MOTIONS, CAMS, DOF, KICKS, OVERLAYS) in story.ts.
---

# Horror Scriptwriting, Expressive Voice & Cinematic Storyboarding v5.0 (`SCRIPT.md` → `manifest.json` → `story.ts`)

## 1. Expressive Multi-Speaker Script Grammar (`SCRIPT.md`)

**Never write a flat wall of monochrome narration.** Horror Engine v5.0's `gen_horror_voice.py` synthesizes **per line with distinct emotional prosody, dynamic volume contours, mid-sentence `...` hesitation pauses, human vocal-tract breaths, and multi-speaker FX**:

- **Speed:** **`2.7–3.2 words/s`** (~150–185 words per 60 s). Slower, intimate, ominous delivery builds dread far better than rapid-fire narration.
- **Speaker & Mood Directives (line-level headers):**
  - `[NARRATOR | mood=calm_omen|tense|whisper|dread|panic|cold_twist|ghost_entity]`
    - `calm_omen`: trầm, chậm rãi đặt điềm báo (`0.0 dB`).
    - `tense`: nhịp dồn, cảnh giác (`-1.0 dB`).
    - `whisper`: thì thầm sát tai, chậm, cận âm (`-4.5 dB` — tạo độ tương phản rợn người trước lúc hét/giật mình!).
    - `dread`: nặng nề, rờn rợn, hụt hơi run (`-2.0 dB`).
    - `panic`: gấp gáp, cao giọng, hoảng loạn + tiếng hít gấp (`+2.5 dB`).
    - `cold_twist`: lạnh ngắt, chậm, chốt cú lật (`-1.5 dB` + đuôi vang lạnh nhẹ).
    - `ghost_entity`: giọng thực thể trầm khàn, tiền-vang ngược (`reverse-reverb pre-swell`).
  - `[SPEAKER: TÊN | voice=vi-VN-NamMinhNeural|vi-VN-HoaiMyNeural | mood=... | pitch=-12% | speed=0.88 | fx=dry|room|phone|ghost]`
    - `fx=phone`: lọc băng thông `300–3100 Hz` như cuộc gọi / loa rè.
    - `fx=room`: vang phòng kín thực tế cho NPC đứng chung không gian.
    - `fx=ghost`: giọng ma ám đa lớp kèm tiếng vang hút ngược trước khi cất lời.
- **TRUE Psychoacoustic Silence & Hesitation:**
  - Write `[PAUSE 0.35s]` for dramatic phrasing beats and `[DEAD SILENCE 0.65s]` immediately before major reveals/twists — `mix_base.py` hard-mutes BOTH music and ambient SFX to **`-48 dB` vacuum** across every `[DEAD SILENCE]` span!
  - Use `...` (`…`) naturally inside tense sentences: `gen_horror_voice.py` automatically splits on `...` into real `0.42 s` breathless pauses instead of swallowing punctuation.
  - Clock & date formats (`01:06`, `22/11`) are normalized automatically to natural spoken Vietnamese (`"một giờ sáu phút"`) while keeping original display tokens (`"01:06"`) in `words.json` for `Phone3D` / `HorrorHUD`.
- **Example `SCRIPT.md` Excerpt:**
  ```markdown
  [NARRATOR | mood=calm_omen]
  Đêm canh linh cữu lúc 01:06, bà nội dặn tuyệt đối không được trả lời tiếng gọi ngoài cửa.
  [PAUSE 0.35s]
  [NARRATOR | mood=whisper]
  Nhưng rồi... ngọn đèn dầu bỗng tắt phụt.
  [DEAD SILENCE 0.70s]
  [SPEAKER: BÓNG NGƯỜI | voice=vi-VN-NamMinhNeural | mood=ghost_entity | fx=ghost]
  Mở cửa ra... cháu ơi.
  [NARRATOR | mood=panic]
  Cánh cửa gỗ rung bần bật ngay trước mặt tôi!
  ```
- **No On-Screen Captions by Default:** Keep `HorrorHUD` captions opt-in via `hudFromManifest(MANIFEST)` unless requested (`GEMINI.md`).

---

## 2. Generating Expressive Voice (2-Machine So-VITS-SVC 1-File VC-Pack OR Offline/Edge)

### Recommended 2-Machine So-VITS-SVC Narrator Workflow (Preserves ALL Horror Mood Intonation!)
1. **This PC — Export 1 Expressive Guide WAV + Helper Scripts:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --export-vc-pack out/<project>/vc_pack
   ```
   Generates `narrator_guide_44k.wav` (all `[NARRATOR]` lines with mood F0 contours & normalized RMS), `vc_pack_manifest.json`, `run_svc_win.bat`, and `run_svc_unix.sh`.
2. **Your So-VITS-SVC Machine — Convert 1 File Using `-na` (`--no-auto-predict-f0`):**
   - Run `run_svc_win.bat` / `run_svc_unix.sh` (CRITICAL: always pass **`-na`** so So-VITS-SVC preserves the whisper/dread/panic F0 pitch curve instead of flattening it into a monotone drone!) → produces `narrator_svc_out.wav`.
3. **This PC — Exact 1:1 Re-Assembly + Multi-Speaker Dialogue + Breaths + Post-SVC Mood EQ:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
     --vc-pack out/<project>/vc_pack \
     --narrator-vc-wav out/<project>/vc_pack/narrator_svc_out.wav \
     --out-dir out/<project>/voice
   ```
   Outputs 48 kHz mono `voice.wav` + `words.json` (complete with `speaker`, `mood`, and `dead_silences` spans).
- *Quick preview / no SVC needed:* Pass `--no-vc` (uses expressive multi-mood `edge-tts` + procedural breaths + character FX). Toggle breaths off with `--no-auto-breath` if desired.
- *Pre-recorded human/external WAVs:* Also supports `--export-narrator-script`, `--narrator-dir <folder>` (`001.wav..`), and `--narrator-audio <full.wav>` (auto VAD split).

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
