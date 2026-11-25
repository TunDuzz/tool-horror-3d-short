---
name: horror-script-storyboard
description: Use when writing coherent act-level horror narration scripts (2.2-2.5 words/s effective with [VISUAL Xs] breathing frames, [NARRATOR | mood=...], [SPEAKER: ... | fx=...], [PAUSE], [DEAD SILENCE]), generating studio-clean neural voices via VieNeu-TTS 48kHz --speaker-lock + Whisper Forced Word Alignment (<35ms), auto-locking beats & shots[] via align_manifest.py, or directing Anchored POV-First (2A) camera plans in story.ts.
---

# Horror Scriptwriting, Forced Word Alignment & Anchored POV Storyboarding v11.0 (`SCRIPT.md` → `manifest.json` → `story.ts`)

## 1. Act-Level Coherent Horror Script & `[VISUAL Xs]` Breathing Grammar (`SCRIPT.md`)

**NEVER fragment a script into 15–20 tiny 2-word TTS snippets and NEVER cram 3.5+ words/s nonstop without visual breathing room.** Write **2–4 continuous, emotionally coherent Acts** separated by **`[VISUAL Xs]`** (spatial/action breathing frames where ambient rain, wind, and Foley keep playing!), **`[DEAD SILENCE Xs]`** (`-48 dB` psychoacoustic vacuum before reveals), or speaker changes.

- **Speed & Visual Frame Budget (`3A` · `pipeline_constitution.json`):** Target **`2.2–2.5 words/s`** effective (`max 2.75 w/s`), allocating **20–35% of chapter frames** (`45–105 s` per chapter, recommended `72–95 s`) to `[VISUAL Xs]` beats (`[VISUAL 2.6s]` Master Establishing opener + `[VISUAL 1.2–2.0s]` around physical prop actions like bolting doors, receiving keys, opening ledgers).
- **Act-Level Mood Directives (`[NARRATOR | mood=...]`):**
  - `calm_omen`: trầm lắng, chắc nhịp đặt bối cảnh & điềm báo (`0.0 dB`).
  - `curious`: tò mò, dò xét, nghi hoặc (`-0.5 dB`; IndexTTS-2 vector `surprised+calm`).
  - `tense`: căng thẳng, cảnh giác (`+0.5 dB`).
  - `whisper`: thì thầm, gần gũi, nhỏ giọng (`-3.5 dB`; pair with `refs/whisper.wav` on VieNeu/F5-TTS or `afraid+calm` on IndexTTS-2 — **zero white-noise distortion!**).
  - `fear`: sợ hãi, hoảng hốt, nghẹn giọng (`-0.5 dB`; IndexTTS-2 vector `afraid: 0.85`).
  - `dread`: nặng nề, rờn rợn (`-1.5 dB`; IndexTTS-2 vector `melancholic+afraid`).
  - `panic`: gấp gáp, kêu cứu, cao trào (`+2.0 dB`; IndexTTS-2 vector `afraid: 0.95, angry: 0.30`).
  - `cold_twist`: lạnh gáy, chậm rãi chốt cú lật (`-1.0 dB`).
  - `ghost_entity`: thực thể siêu nhiên (`fx=ghost` reverse-reverb pre-swell on `[SPEAKER: ...]`).
- **Native Neural Non-Verbal Tags (Supported directly by `VieNeu-TTS v3 Turbo`):**
  - You may place natural Vietnamese cues **`[thở dài]`** (sigh) and **`[hắng giọng]`** (throat clear) directly in text when using `VieNeu-TTS` (automatically stripped cleanly for non-VieNeu backends).
  - Use natural punctuation (`...`, `,`, `?`, `!`) inside continuous paragraphs — `gen_horror_voice.py` v6.0 keeps the paragraph intact so the neural model handles ellipses and question inflections organically!
  - Clock & date strings (`01:06`, `22/11`) normalize automatically for TTS while preserving verbatim display tokens (`01:06`) in `words.json`.
- **TRUE Psychoacoustic Silence:**
  - Place `[DEAD SILENCE 0.70s]` immediately before major reveals/twists — `mix_base.py` hard-cuts BOTH music and ambient SFX to **`-48 dB` vacuum** across every `[DEAD SILENCE]` window!
- **Multi-Speaker Dialogue:** `[SPEAKER: TÊN | voice=... | mood=... | fx=dry|room|phone|ghost]`.
- **Example v6.0 Act-Level `SCRIPT.md`:**
  ```markdown
  [NARRATOR | mood=calm_omen]
  Đêm canh nhà lúc 01:06, ngoài sân gió rít qua từng khe gỗ. Bà nội dặn tôi tuyệt đối không được mở chiếc tủ cổ cuối gian nhà nếu nghe thấy tiếng động.
  [PAUSE 0.35s]
  [NARRATOR | mood=curious]
  Nhưng rồi, một tiếng cào rất khẽ vang lên từ bên trong. Ai lại ở trong tủ gỗ giờ này? [thở dài] Tôi nín thở bước lại gần.
  [DEAD SILENCE 0.75s]
  [SPEAKER: BÓNG NGƯỜI | mood=ghost_entity | fx=ghost]
  Mở cửa ra... cháu ơi.
  [NARRATOR | mood=panic]
  Cánh cửa gỗ rung bần bật ngay trước mặt! Tôi vùng chạy ra cửa chính, nhưng chốt gỗ đã bị khóa chặt từ bên ngoài!
  [PAUSE 0.40s]
  [NARRATOR | mood=cold_twist]
  Và khi tôi từ từ quay đầu lại, thứ đó đã đứng sẵn sau lưng tôi từ lúc nào.
  ```
- **Default 4–8 Word Subtitles (`captionChunks[]`):** Subtitles are **ON by default** (`enabledByDefault: true`, `headerStyle: "minimal"` in `pipeline_constitution.json`), auto-split by `align_manifest.py` into crisp `4–8 word` (`1–2 line`) phrases locked to acoustic word timestamps (`showCaptions: false` only if explicitly requested by the user).

---

## 2. Generating Studio-Clean Neural Voice (100% Free & Open-Source)

### Option A — Local CPU 48 kHz (`VieNeu-TTS v3 Turbo` + Reusable 6-Clip Emotion Bank!)
```bash
# Optional one-time 3-minute setup: build permanent 6-emotion refs (calm, curious, whisper, fear, panic, dread)
python3 scripts/prepare_emotion_refs.py guide
python3 scripts/prepare_emotion_refs.py split-auto --src emotions_take.m4a --out-dir audio/emotion_refs
python3 scripts/prepare_emotion_refs.py check --dir audio/emotion_refs

# Generate clean 48 kHz voice (auto-detects audio/emotion_refs/ if present, or uses built-in per-mood silence_p/temp + clean tempo!)
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine vieneu --out-dir out/<project>/voice --no-vc

# Or export 1-file So-VITS-SVC guide (unifies all 6 emotion refs into your 1 narrator voice via -na!)
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine vieneu --export-vc-pack out/<project>/vc_pack
```
*(Also supports direct Voice-to-Voice Directing via `--human-guide my_rough_take.m4a --export-vc-pack ...`!)*

### Option B — Local GPU Acting Pack (`IndexTTS-2 Vietnamese` / `F5-TTS-Vietnamese`) + Optional So-VITS-SVC (`-na`)
1. **This PC — Export Act-Level GPU Pack (`acts.json` with 8-D emotion vectors + ready scripts):**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --export-gpu-voice-pack out/<project>/gpu_voice_pack
   ```
2. **Your GPU PC — Run `run_indextts2_vi.py` (or `run_f5tts_vi.py`):** Renders studio-clean `act_01.wav`, `act_02.wav`... with real neural fear/curiosity/dread in your cloned voice!
3. **This PC — Re-Assemble Around Exact `[DEAD SILENCE]` Windows:**
   ```bash
   python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
     --import-acts out/<project>/gpu_voice_pack/rendered_acts \
     --out-dir out/<project>/voice
   ```
- *Using your So-VITS-SVC model directly?* The 1-file VC-Pack workflow (`--export-vc-pack` → run `run_svc_win.bat` using **`-na`** on clean act-level `narrator_guide_44k.wav` → `--vc-pack ... --narrator-vc-wav ...`) remains 100% supported with **zero DSP distortion**!

---

## 3. Auto-Locking `manifest.json` ↔ `words.json` ↔ `cues.json` (`align_manifest.py` + Spatial Gates v8.0)

Start from the synchronized `manifest.draft.json`, `SCRIPT.skeleton.md`, and `cues.draft.json` exported by `horror_story.py export-blueprint` so room `anchors`, `castStates`, and `propStates` stay 100% locked to the approved 2D floorplan!

```bash
python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
python3 scripts/validate_manifest.py src/<project>/manifest.json \
  --script out/<project>/SCRIPT.md \
  --words out/<project>/voice/words.json \
  --cues out/<project>/cues.json \
  --registry LOCATION_REGISTRY.json \
  --update-registry \
  --still-out out/<project>/still_manifest.json
```
*(Enforces `ANCHOR_UNDECLARED_ERROR`, `OUT_OF_BOUNDS_ERROR`, `SPATIAL_TELEPORT_ERROR`, `PROP_STATE_REGRESSION_ERROR`, and `--cues` audio-visual timing sync alongside Anti-Repetition Gates!)*

---

## 4. Narrative Pacing Blueprints (`150–300s` Short & `8–15 Min` Series, plus Legacy `45–90s` Micro)

- **Default Standalone Short (`150–300s` = 2.5–5 min, `3–5` seamless Chapters × `50–65s`)** and **Full Series (`8–15 min`, `8–15` Chapters):** Follow `horror-story` v3.0's `STORYTELLING_CRAFT.md` and exported `p01..pNN/SCRIPT.skeleton.md` (with `subtext`, `sensoryDetails`, `wordBudget`, and zero repeated intro recaps when `seamlessStitch: true`).
- **Legacy Micro Test (`55–75s`, 1 Chapter) — 8-Beat Dark-Horror POV Formula:**

1. **Cold Hook (`0–8 s`, `POV` or `WS`, `mood=calm_omen`):** Establish the chilling rule/atmosphere and unique `LocationBlueprint` — **DO NOT spoil the entity's full face here!** Optional subtle distant `addCornerLurker3D` (`breathing: false`).
2. **POV Interaction / Inciting Cue (`8–16 s`, `POV_TURN` → `POV_PROP`, `mood=curious`):** 6–8f deterministic `whipPan` toward a diegetic 3D prop (`Phone3D` lockscreen alert synced with `HorrorHUD`, `PaperProp3D`, or `HandheldOilLamp3D`).
3. **First Uncanny Anomaly (`16–25 s`, `POV_DOWN` or `LOW`, `mood=whisper`):** Look down or toward a threshold (`addDoubleDoorWithCracks` moonlight + 2 foot shadows, subtle `doorwayPeek` stage `0`, dying oil lamp `warmLamp → coldMoon` via `getLightBlend`).
4. **Investigation (`25–32 s`, `MCU` or `POV`, `mood=dread`):** `peerForward` / `dollyZoom` compression + `Flashlight3D` SpotLight sweep across grimy walls & creeping `beat.fogOverride`.
5. **Threat Tease & TRUE Dead Silence (`32–38 s`, `ECU` / `POV_CU`, `[DEAD SILENCE 0.70s]`):** Close sensory cue (claw fingers gripping doorframe, `torchMalfunction` flashlight sputter) → `{ kind: "blackout", a, b }` + `-48 dB` audio vacuum.
6. **Staged Climax Reveal (`38–46 s`, `LOW` → `CU`, `mood=panic`):** 3-stage monster escalation (`doorwayPeek` → `stalkLoom` → `lungeCloseUp`) + `{ kind: "aberration", a, b, strength }` VHS `tapeTear` surge + optional 3D `lightning` flash + protagonist `recoil`.
7. **Escape / Sanctuary Shift (`46–64 s`, `POV_TURN` Dutch tilt → `Reverse WS` → `MS`):** Dynamic confrontation / frantic `whipPan` escape → `{ kind: "dipBlack", at, dur: 10, hold: 2 }` into a second unique `LocationBlueprint` or bolted interior.
8. **Lingering Psychological Twist (`64–74 s`, `OTS` / `POV_DOWN`, `mood=cold_twist`):** False safety → slow `turnHead` + subtle `vignettePulse` revealing the unmistakable physical evidence that the entity is already inside.

---

## 5. Mandatory Anchored POV-First Cinematography (`2A`) & Single-Lock `shotsFromManifest` (v11.0 `story.ts`)

1. **Single-Source Phrase-Locked Shots (`1B` — ZERO Hardcoded Shot Frames in `story.ts`!):**
   - Declare `shots[]` inside `manifest.json` (`cameraMode`, `axisSide`, `startPhrase`, `endPhrase`, `visualBeatIndex`, `leadFrames`, `tailFrames`, `actionTriggerPhrase`).
   - Run `align_manifest.py --words ... --in-place` to lock `beats[]`, `shots[]`, `propStates.*.triggerFrame`, and `captionChunks[]` (`4–8 words`) simultaneously with **0-frame drift**, and export `export const SHOTS = shotsFromManifest(MANIFEST);` in `story.ts`.
2. **Anchored POV-First Cinema Grammar (`2A`, Enforced by `validate_manifest.py --strict-cinema`):**
   - **Rule 1 — Mandatory Master Establishing Shot (`MASTER_ESTABLISHING_ERROR`):** Every location MUST open with `cameraMode: "master"` (`>= 60 frames`, `camMasterEstablish`) showing the whole room, practical light sources, hero props, and character positions with readable walls (`Zero Black Void`).
   - **Rule 2 — 80–90% Continuous POV Chain (`camPovChain`):** Keep the viewer anchored inside the protagonist's eyes! When looking from an NPC to a ledger, stove, door bolt, or window, use **`camPovChain(waypoints, frame)`** smooth head-turns with visible `PovRig3D` hands (`2-joint fingerCurl` + `worldTarget` prop coordinates) — NEVER chop into disorienting black-void prop cutaways!
   - **Rule 3 — Strict 180° Axis & OTS Cap (`AXIS_180_VIOLATION_ERROR`, `POV_PINGPONG_ERROR`):** Never flip 180° across the axis into the protagonist's front face during a POV sequence, never switch `left ↔ right` without re-establishing via `master`/`pov_center`, and cap `ots_same_side` to `<= 22%` of frames (`<= 4` switches/min).
   - **Rule 4 — `dialogueMode` Discipline (`VOICEOVER_LIPSYNC_ERROR`):** Always set `dialogueMode: "voiceOver"` on `C01` during `[NARRATOR]` internal thoughts and `"directSpeech"` on speaking characters.
2. **Zero Repeated Camera Angles:** Every shot in `SHOTS` MUST declare a valid `ShotScale` (`POV`, `POV_PROP`, `POV_TURN`, `POV_DOWN`, `POV_CU`, `WS`, `MS`, `OTS`, `MCU`, `CU`, `ECU`, `LOW`) and valid physical `LightKey` (`warmLamp | coldMoon | fluorescent | duskFog | flashlight`). Never perform static-layout filter jump-cuts (`corr > 0.88`) or hold low-motion shots `> 7.5 s` (`short_qa.py` `DEAD_CAMERA_WARNS`).
3. **Engine Camera & Motion Archetypes (`camera.ts`):** Combine `whipPan`, `povBreath`, `camOTS`, `camArc`, `camPOV`, `camECU`, `dollyZoom`, `handheld`, `snapZoom`, `pushK`, and `rolled` (`0.06–0.095` rad Dutch tilt). Declare all fast head-snaps in `WHIP_PANS` and close prop raises in `POV_MOTIONS` for `extract_shots.py`.
4. **Purposeful Transitions (`OVERLAYS`):**
   - `{ kind: "dipBlack", at, dur: 10, hold: 2 }` for location/time jumps.
   - `{ kind: "blackout", a, b }` for `[DEAD SILENCE]` vacuum beats; `{ kind: "lightning", f }` for real 3D storm flashes.
   - `{ kind: "vignettePulse", a, b, freq, strength }` for creeping dread/heartbeat tension.
   - `{ kind: "aberration", a, b, strength }` to trigger VHS `tapeTear` / `RetroPsxEffect.dreadLevel` surges on entity reveals.
- **Action-to-Word & Phrase-Anchored Still Lock (v12.0 `sceneAudit.ts` + `storyboard_proof.html`):**
  - Declare `mustShow: string[]` and `stillKeyframes[]` (`onPhrase`, `expectedVisual`, `maxScreenBlockPct`) on `manifest.shots[]` for every spoken noun/action (`oilLamp`, `waitingBench`, `coalStove`, `C02:head`, `boothDoorBolt`).
  - Use **`frameWorldPoints(camPos, subjectPoints, aspect)`** and **`camOtsFrame(...)`** in `story.ts` instead of blind coordinate guessing so multi-object beats (e.g. sputtering oil lamp + open ledger) stay 100% inside the 9:16 Safe Window above subtitles!
  - Run `render-stills.mjs --manifest still_manifest.json --strict-audit` to generate `storyboard_proof.html` and pass all 5 semantic layers before rendering video.

## Formulas & Multi-Part Series Arc

See [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) for beat templates across all 3 sub-genres and the 8–10 Part Series structure.
