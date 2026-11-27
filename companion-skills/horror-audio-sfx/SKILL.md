---
name: horror-audio-sfx
description: Use when building clean 1.0x Vietnamese horror narration via free local VieNeu-TTS (--tts-engine vieneu + --ref-audio or --import-voice with ZERO tempo/pitch/F0 DSP + Whisper Forced Word Alignment <35ms + 30fps rms_envelope_30fps), choosing story-driven audioDirection (raw_diegetic 0% score, folklore_atmospheric, or cinematic_score with optional scoreBeds/music_arc and -7..-10 dB ducking), resolving curated local SFX in audio/sfx_curated/ with history.jsonl anti-repeat rotation before quality-filtered Openverse CC0 fetching, mixing -48 dB [SILENCE_DROP 0.5-1.2s], story-driven Jumpscares across 7 styles (min_jumpscares >= 1 at -1.0 dBTP), and syncing storyboard_proof.html timings.
---

# Clean 1.0x `VieNeu-TTS`, Story-Driven `audioDirection` & Curated Horror Soundscape Engine v15.5

Âm thanh kinh dị chuẩn `48 kHz` stereo WAV (`-16.0 LUFS`, **`-1.0 dBTP`**, **`min_jumpscares >= 1`**): giọng kể **`VieNeu-TTS` miễn phí ở tốc độ gốc `1.0x` sạch** (tắt mặc định mọi DSP bóp méo tiếng Việt, ưu tiên `--ref-audio` mẫu 5–8s sạch hoặc `--import-voice`), **phong cách âm thanh linh hoạt 100% theo kịch bản (`audioDirection`) — tuyệt đối KHÔNG đóng khung 1 công thức nhạc nền/stinger cho mọi video**, rút im lặng **`[SILENCE_DROP 0.5–1.2s]` xuống `-48 dB`**, **7 kiểu âm Jumpscare tùy biến theo kịch bản**, và kho tuyển chọn cục bộ **`audio/sfx_curated/`** + Openverse CC0 đều có **xoay vòng chống lặp `history.jsonl`** và bộ lọc chất lượng tối thiểu (`mix_base.py`, `dsp.py`, `sfx_manager.py`, `gen_horror_voice.py`, `mix_cues.py`).

---

## 1. Năm Nguyên Tắc Vàng Của Âm Thanh Kinh Dị Linh Hoạt v15.5

1. **`VieNeu-TTS 1.0x` Sạch Mặc Định — 0% DSP Bóp Tiếng Việt:**
   - `--tts-engine vieneu` là mặc định miễn phí chạy local `48 kHz` (không tự động gọi Gemini TTS để tránh hết hạn mức Free Tier; chỉ dùng Gemini khi truyền tường minh `--tts-engine gemini`).
   - Tắt mặc định toàn bộ `clean_tempo`, `pitch_semi`, và `_align_ref_f0_to_anchor` (`defaultDisableTempoPitchDsp: true`); giữ nguyên đoạn văn liền mạch (không dùng `[PACE=... | PITCH=...]`), chỉ giữ thẻ bản địa tự nhiên (`[thở dài]`) và khoảng nghỉ sạch.
   - **Ưu tiên `--ref-audio` sạch (5–8s giọng trầm kể chuyện ma không qua DSP):** Khi truyền `--ref-audio`, script đưa trực tiếp mẫu đó vào `VieNeu-TTS` (ưu tiên trên `audio/emotion_refs/`) để giữ đúng chất giọng kể điềm tĩnh, tự nhiên; vẫn giữ `--import-voice` khi đưa file thu âm thật/RVC.
   - Tự động xuất `rms_envelope_30fps` trong `words.json` và `words.ts` cho lip-sync khung hình thực tế.
2. **Phong Cách Âm Thanh Linh Hoạt Theo Kịch Bản (`audioDirection` — `requireScoreBeds: false`):**
   - Khai báo `"audioDirection"` riêng trong từng `cues.json` theo đúng thể loại truyện, **KHÔNG ép cứng 1 khuôn nhạc nền piano/drone cho mọi video**:
     - **`raw_diegetic`** *(Thuần thực tế / Found-Footage / Camera an ninh)*: **0% nhạc nền** — `mix_cues.py --strict` chặn cứng nếu lỡ gắn `scoreBeds`/`music_arc` (`RAW_DIEGETIC_SCORE_FORBIDDEN`). Chỉ dùng tiếng không gian thực địa (room-tone, đèn điện, gió, bước chân) + khoảng lặng + tiếng động thực.
     - **`folklore_atmospheric`** *(Dân gian / Làng quê / Tâm linh)*: Nền môi trường vùng miền (mưa, sông, côn trùng, gió...) + **tùy chọn** nhạc cụ mộc/trầm buồn hoặc tiếng động đặc thù địa phương (không bắt buộc `scoreBeds`).
     - **`cinematic_score`** *(Tâm lý / Bi kịch / Đô thị)*: Hỗ trợ lớp **nhạc nền tùy chọn (`scoreBeds[]` hoặc `music_arc`)** biến thiên theo hồi truyện (ấm/tĩnh → bất an → rút im lặng `-48 dB` → dư âm) và tự động **ducking mượt `-7` đến `-10 dB` (mặc định `-8.5 dB`)** khi có giọng `VieNeu-TTS`.
3. **Jumpscare Linh Hoạt 7 Kiểu Theo Ngữ Cảnh (`min_jumpscares >= 1`, `-1.0 dBTP`):**
   - **KHÔNG cố định 1 kiểu violin hay kim loại cho mọi video!** Chọn đúng kiểu hợp cốt truyện:
     - `practical_impact`: va đập cửa, kính vỡ, đồ vật rơi thực tế *(hợp `raw_diegetic` / nhà trọ / đời thường)*.
     - `mic_emf_glitch`: nhiễu sóng điện từ, rè micro, rách băng camera *(hợp camera an ninh / thang máy / thiết bị điện)*.
     - `entity_breath_shriek`: hơi thở gắt sát tai / tiếng thét thực thể *(hợp bóng ma áp sát / hầm tối)*.
     - `cinema_stab`, `entity_shriek`, `metal_dread`, `vhs_psx_glitch`: stinger điện ảnh / kim loại / băng VHS khi hợp mạch truyện.
   - Nguyên tắc chung duy nhất: **tạo tương phản trước điểm nổ** (rút nền `[SILENCE_DROP 0.5–1.2s]` xuống `-48 dB` hoặc cảm giác an toàn giả) và kiểm soát trần **`-1.0 dBTP`**.
4. **Kho Tuyển Chọn `audio/sfx_curated/` + Xoay Vòng Chống Lặp `history.jsonl` + Bộ Lọc Openverse CC0:**
   - Tổ chức sẵn các thư mục tùy chọn trong `audio/sfx_curated/` (`dark_drone/`, `sad_piano/`, `stinger/`, `ambience/` — khuyến khích bỏ 3–5 biến thể mỗi nhóm).
   - `sfx_manager.py auto-fetch-for-script` kiểm tra `audio/sfx_curated/` trước rồi mới tìm Openverse CC0 theo từ khóa thực tế rút từ kịch bản. **Cả `sfx_curated/` lẫn Openverse đều tự động đối chiếu `history.jsonl` để bỏ qua file vừa dùng ở các video trước**, tránh 10 video lặp đúng 1 tiếng động.
   - **Bộ lọc chất lượng tối thiểu cho Openverse (`validate_sfx_audio_quality`):** Tự động loại file quá ngắn (`< 0.4s` cho bed/drone/score), loại file clipping nặng, và loại file gần như im lặng (`rms < -50 dBFS` hoặc `peak < -32 dBFS`). Cấm `synth:` trừ khi có `allow_synth: true`.
5. **Bỏ Ép Buộc Motif & Occlusion + Đồng Bộ Chặt `storyboard_proof.html`:**
   - `requireAcousticMotif: false`, `requireOcclusionTrigger: false`, `requireScoreBeds: false`.
   - Khớp `jumpscareClips[]` trong `manifest.json` (`<= 0.15s` lệch) và kiểm tra 5 mốc nghe tai nghe trong `mix_report.md` cùng keyframe trên `storyboard_proof.html`.

---

## 2. Lệnh Chuẩn Sản Xuất Âm Thanh v15.5

```bash
# 1A. Giọng VieNeu-TTS 1.0x sạch miễn phí (kèm mẫu 5-8s giọng trầm kể chuyện ma) + Whisper + rms_envelope_30fps
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine vieneu --ref-audio audio/my_storyteller_6s.wav \
  --word-aligner auto --strict-hook --out-dir out/<project>/voice --no-vc

# 1B. Hoặc nhập 1 file giọng thu thật / RVC sạch (0% DSP bóp tốc độ/cao độ)
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --import-voice my_clean_take.wav --word-aligner auto --out-dir out/<project>/voice

# 2. Lấy SFX theo từ khóa kịch bản (ưu tiên audio/sfx_curated/ + xoay vòng history.jsonl -> Openverse CC0 có lọc chất lượng)
python3 scripts/sfx_manager.py auto-fetch-for-script \
  --cues out/<project>/cues.json --library shorts-project/audio/sfx_library \
  --curated-dir shorts-project/audio/sfx_curated

# 3. Phối âm linh hoạt theo audioDirection (-16.0 LUFS, -1.0 dBTP) -> mix_report.md + credits.txt
python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/audio/mix.wav --strict
```

## Tham Khảo Công Thức Phối Âm

Xem [SOUND_CUES_COOKBOOK.md](./references/SOUND_CUES_COOKBOOK.md) cho cấu trúc JSON của 3 phong cách `audioDirection` (`raw_diegetic`, `folklore_atmospheric`, `cinematic_score`), 7 kiểu Jumpscare, xoay vòng `audio/sfx_curated/` và nối âm thanh đa tập.
