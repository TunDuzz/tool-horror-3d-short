---
name: horror-script-storyboard
description: Use when writing million-view Vietnamese horror scripts (v15: Two-Step Clean Writing -> Directing, 0-5s Clean Non-Spoiler Hook, Human Emotional Core, 3-Tier Escalation, calm 2.35 w/s effective / 2.25-3.25 w/s spoken cadence, ZERO [PACE|PITCH] tags, [SILENCE_DROP 0.5-1.2s]), generating free clean 1.0x 48kHz voice via VieNeu-TTS (--tts-engine vieneu + --ref-audio or --import-voice), or directing cold_hook -> master -> Anchored POV storyboards verified via storyboard_proof.html.
---

# Horror Scriptwriting & Storyboarding v15 (`SCRIPT.md` → `VieNeu-TTS 1.0x` → `manifest.json`)

## 1. Quy Trình Viết `SCRIPT.md` Tách Biệt 2 Bước (v15)

### Bước 1 — Sáng Tác Sạch (0 Thẻ Kỹ Thuật)
- Viết trọn câu chuyện đời thật giàu cảm xúc, chọn 1 trong **5 mô-típ luân phiên** trong [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) — **0 thẻ `[BEAT]`, `[PROX]`, `[VISUAL]`, `[PACE]`, `[PITCH]`**.
- Khóa đủ **4 nguyên tắc triệu view**:
  1. **Hook `0–5s` sạch & CẤM lộ bài sớm (`<= 24 từ`, nổ ở `0.05–0.25s`):** Chọn 1 trong 3 kiểu *(Vào thẳng tình huống nguy hiểm / Câu hỏi kiêng kỵ trực diện / Lời thú nhận của người sống sót)* — cấm mở bài thời tiết/ngày tháng và cấm kể trước đáp án cú lật cuối.
  2. **Lõi cảm xúc con người (`5–18s`):** Cài kín 1 chi tiết/lời hứa/vật quen gắn tình cảm thật (gia đình, bạn bè, mưu sinh).
  3. **Leo thang 3 tầng, cấm tả cảnh thừa:** Tầng 1 *(dấu hiệu mơ hồ bị cười gạt)* → Tầng 2 *(xâm lấn vùng an toàn: giả giọng người thân, tiếng động vô lý)* → Tầng 3 *(đối mặt trực diện thực thể bậc 4–7 + điểm nổ Jumpscare)*.
  4. **Cái kết dư âm ám ảnh:** Lật ngược chi tiết cài ở đầu bằng 1 câu chốt lạnh người.
- **Giọng kể điềm tĩnh, tự nhiên:** Bỏ hoàn toàn quota ép chửi thề `1–3 lần/phút`; giữ khẩu ngữ 3 miền đời thường chân thực, không văn mẫu AI.

### Bước 2 — Đạo Diễn & Đánh Dấu Cho `VieNeu-TTS 1.0x`
Chỉ sau khi chốt xong câu chuyện ở Bước 1 mới gắn thẻ đạo diễn tối giản:
1. **Nhịp kể điềm tĩnh, có độ thở tự nhiên (`pipeline_constitution.json` v15):**
   - Mục tiêu tổng: **`2.35 words/s`** (`~155–175 từ` cho video `65–75s`).
   - Tốc độ lúc đang nói: **`2.25–3.25 words/s`** (mục tiêu **`2.75 words/s`**).
2. **BỎ HOÀN TOÀN `[PACE=... | PITCH=...]`:**
   - Giữ đoạn văn tiếng Việt liền mạch để `VieNeu-TTS` đọc trôi chảy ở tốc độ gốc `1.0x` sạch (0% kéo tempo / bóp pitch / dịch F0).
   - Chỉ tận dụng **thẻ bản địa tự nhiên** khi thật sự đắt (như `[thở dài]`), dấu câu tự nhiên, khoảng nghỉ sạch (`[BEAT 0.25–0.45s]`, `[VISUAL 0.9–1.5s]` sau giây thứ 5) và **`[SILENCE_DROP 0.5–1.2s]`** ngay trước điểm nổ Jumpscare.
3. **Mẫu `SCRIPT.md` Chuẩn v15:** Xem trọn bộ bản Bước 1 (sáng tác sạch) + Bước 2 (đạo diễn) tại `examples/script_v15_sample.md` (*Đôi Dép Úp Trước Bậu Cửa*, ~70s).

---

## 2. Tổng Hợp Giọng Đọc Miễn Phí `VieNeu-TTS 1.0x` Sạch (`gen_horror_voice.py`)

```bash
# 1A. Mặc định: VieNeu-TTS 48kHz miễn phí ở tốc độ gốc 1.0x sạch (0% kéo tempo / bóp pitch / dịch F0)
# Khuyên dùng kèm --ref-audio (đoạn mẫu 5-8s giọng trầm kể chuyện ma sạch, không qua DSP bóp méo):
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine vieneu --ref-audio audio/my_storyteller_6s.wav \
  --word-aligner auto --strict-hook --out-dir out/<project>/voice --no-vc

# 1B. Hoặc nhập thẳng 1 file giọng thu thật / RVC sạch (0% DSP bóp tiếng):
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --import-voice clean_take.wav --word-aligner auto --out-dir out/<project>/voice
```
- `--tts-engine vieneu` là mặc định (không tự động gọi Gemini TTS để tránh hết quota Free Tier); xuất `rms_envelope_30fps` trong `words.json` để `stage.ts` lái miệng nói (`talk`/`closed`) theo sóng âm thực và chốt `actionTriggerFrame` + `actingCues[]`.

---

## 3. Ngữ Pháp Điện Ảnh `cold_hook → master → Anchored POV`, Bắt Buộc Jumpscare & Khóa `storyboard_proof.html`

1. **Mở Cảnh Giữ Chân 5 Giây Đầu (`cameraMode: "cold_hook"` → `"master"`):**
   - **`Shot 1` (`cameraMode: "cold_hook"`, `1.0–5.5s`, `first_word <= 0.45s`):** Đập thẳng hình ảnh/vật chứng gợi tò mò khớp câu Hook sạch.
   - **`Shot 2` (`cameraMode: "master"`, `>= 60 frames`, `camMasterEstablish`):** Mở toàn cảnh không gian 3D rõ ánh sáng vật lý (`Zero Black Void`) ngay trong đoạn lõi cảm xúc con người (`5–18s`).
   - **`Shot 3..N` (`80–90%` `camPovChain` + tối đa `1–2` `ots_same_side` `<= 22%`):** Dùng `characterMode: "sprite2d"` (nhân vật 2.5D nổi khối + 20 cử chỉ `actingCues[]`), thực thể chính **Bậc 4–7**, và bắt buộc **`1–2` `jumpscareClips[]`** đồng bộ `<= 0.15s` với `cues.json`.
2. **Khóa Tự Động & Cổng Kiểm Duyệt 5 Lớp (`storyboard_proof.html`):**
   ```bash
   python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
   python3 scripts/gen_cast_assets.py src/<project>/manifest.json --update-manifest # (hoặc --import-raw-dir <dir> trên Free Tier)
   python3 scripts/validate_manifest.py src/<project>/manifest.json \
     --script out/<project>/SCRIPT.md --words out/<project>/voice/words.json \
     --cues out/<project>/cues.json --strict-cinema --strict-retention \
     --registry LOCATION_REGISTRY.json --update-registry \
     --still-out out/<project>/still_manifest.json
   python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json --comp <CompId> --workspace . --overwrite
   REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ \
     --manifest out/<project>/still_manifest.json --scale 0.75 --strict-audit
   ```
   Tạo `storyboard_proof.html` và bắt buộc `100%` keyframe + khung nối Jumpscare vượt qua kiểm định trước khi render MP4.

## 5 Mô-Típ Kịch Bản Luân Phiên & Đa Chương

Xem [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) cho đầy đủ 5 mô-típ kịch bản triệu view và cấu trúc nối tập Series.
