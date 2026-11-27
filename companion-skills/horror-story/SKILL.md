---
name: horror-story
description: Use when brainstorming, adapting, or structuring a high-retention Vietnamese or English horror storyline — 55-90s Viral Short (9:16 default) or 2.5-16 min Deep Story / Series — through the v15 Million-View Storytelling workflow governed by pipeline_constitution.json (Two-Step Clean Writing -> Directing, 5 Rotating Story Archetypes, Clean 0-5s Non-Spoiler Hook, Human Emotional Core, 3-Tier Escalation, Optional Soundscape Motifs, 7-Tier Uncanny Ghost >= Tier 4, Mandatory 1-2 Jumpscares, VieNeu-TTS 1.0x Clean Narration, 2D SVG Floorplans, and storyboard_proof.html Semantic Lock).
---

# Horror Story Architect v15 (`horror-story` · Kịch Bản Triệu View · Nhân Bản & Sắc Lạnh)

Chuyên thiết kế **kịch bản kinh dị giữ chân cao có chiều sâu con người** (`schemaVersion: "3.2"`), chạy đồng bộ với giọng đọc **`VieNeu-TTS` miễn phí ở tốc độ gốc `1.0x` sạch** (`2.35 từ/s` tổng · `2.25–3.25 từ/s` khi nói), **tách bạch 2 bước Sáng tác sạch → Đạo diễn**, luân phiên **5 mô-típ cốt truyện**, **bỏ ép buộc chửi thề gượng / đồng hồ đứng kim / chốt cửa sắt**, bắt buộc **`1–2` cú Jumpscare đồng bộ** (thực thể chính bậc 4–7) và khóa kiểm định bằng `storyboard_proof.html`.

> **Bắt buộc đọc trước khi sáng tác:** [STORYTELLING_CRAFT.md](./references/STORYTELLING_CRAFT.md) (5 mô-típ cốt truyện luân phiên, 4 nguyên tắc nội dung triệu view, quy trình 2 bước Sáng tác sạch → Đạo diễn, phương ngữ 3 miền) và [STORY_SCHEMA.md](./references/STORY_SCHEMA.md) (đặc tả `v3.2` & 26 cổng kiểm định đã gỡ trói).

---

## Quy Trình Sáng Tác Tách Biệt 2 Bước (BẮT BUỘC)

### Bước 1 — Sáng Tác Sạch (0 Thẻ Kỹ Thuật)
Trước khi chạm vào JSON, shot camera hay thẻ âm thanh, viết trọn vẹn **một câu chuyện đời thật giàu cảm xúc** (đọc thành tiếng trôi chảy, **0 thẻ `[BEAT]`, `[PROX]`, `[VISUAL]`, `[PACE]`, `[PITCH]`**):
1. **Chọn 1 trong 5 mô-típ luân phiên** (tránh lặp khuôn ca trực đêm):
   - *(1)* Ký ức / Đồng dao / Lễ hội quen thuộc bị bẻ cong
   - *(2)* Điều kiêng kỵ dân gian đời thường ai cũng từng nghe
   - *(3)* Chuyện có thật ở địa điểm bỏ hoang
   - *(4)* Người thân giả mạo (*Doppelgänger*)
   - *(5)* Bí mật gia đình / Luật sinh tồn
2. **Khóa đủ 4 nguyên tắc nội dung cốt lõi:**
   - **Hook `0–5s` sạch & CẤM lộ bài sớm:** Chọn 1 trong 3 kiểu *(Vào thẳng tình huống nguy hiểm / Câu hỏi kiêng kỵ trực diện / Lời thú nhận của người sống sót)* — chỉ gieo tò mò, tuyệt đối không kể trước đáp án cú lật cuối.
   - **Lõi cảm xúc con người (`5–18s`):** Cài kín 1 chi tiết/lời hứa/vật quen gắn với tình cảm thật (gia đình, bạn bè, mưu sinh) để khán giả thực sự lo cho nhân vật trước khi hù.
   - **Leo thang 3 tầng, cấm tả cảnh thừa:** Tầng 1 *(dấu hiệu mơ hồ bị cười gạt)* → Tầng 2 *(xâm lấn vùng an toàn: giả giọng người thân, tiếng động vô lý)* → Tầng 3 *(đối mặt trực diện thực thể ma bậc 4–7 + điểm nổ Jumpscare)*.
   - **Cái kết dư âm ám ảnh:** Lật ngược hoàn toàn chi tiết đã cài ở đầu bằng 1 câu chốt lạnh người, để mở dư âm kích thích bình luận.
3. **Giọng kể điềm tĩnh, tự nhiên (`gritLevel: "clean_folklore"` mặc định):** Bỏ hoàn toàn quota ép chửi thề `1–3 lần/phút`; dùng khẩu ngữ 3 miền đời thường chân thực (`north` | `central` | `south`).

### Bước 2 — Đạo Diễn, Khóa `story.json` & Đánh Dấu Kỹ Thuật
Chỉ sau khi chốt xong câu chuyện hay ở Bước 1 mới cấu trúc `story.json` (`v3.2`), chia shot/cảnh, gắn khoảng nghỉ sạch (`[BEAT Xs]`, `[VISUAL Xs]`, `[SILENCE_DROP 0.5–1.2s]`), chọn nhạc nền 3 hồi (`scoreArc`) và chốt điểm nổ Jumpscare:

```bash
# Khởi tạo khung story.json v3.2 (mặc định wordsPerSecond=2.35, gritLevel=clean_folklore, motifs=[])
python3 scripts/horror_story.py seed --title "Đôi Dép Úp Trước Bậu Cửa" --format micro --total-sec 70 --dialect north --out story.json

# Deep Story 210s miền Nam (3–4 chương liền mạch, 9:16)
python3 scripts/horror_story.py seed --title "Chuyến Đò Gọi Tên" --format short --total-sec 210 --dialect south --out story.json
```

---

## Kiểm Định 3 Vòng (`--stage lore` → `structure` → `full`)

1. **Vòng 1 (`--stage lore`):** Khóa `parts[0].coldHook` (`<= 24 từ`, nổ ngay `0.05–0.25s`, không lộ bài sớm), `premise`, `worldLore`, `entityProfile` (thực thể chính `scareTier >= 4`), `characters[]` (`trappedReason`, `appearanceBrief`), `scenes[]` (0% trùng bối cảnh cũ) và `clues[]` (`>= 2` manh mối gieo–gặt).
2. **Vòng 2 (`--stage structure`):** Khóa `props[]`, đường cong `tensionStart/Peak/End`, `newInfoRevealed`, `hook` và `suspense`.
3. **Vòng 3 (`--stage full`):**
   - `soundscapeDesign`: chọn `nearBed` / `farBed` và `scoreArc` (`act1`, `act2`, `aftermath`) đúng chất truyện. **`motifs[]` và `occlusionTrigger` là TÙY CHỌN** (`requireAcousticMotif: false` — chỉ dùng khi thực sự hợp cốt truyện, không ép đồng hồ đứng kim hay đóng chốt sắt).
   - Nhịp kể điềm tĩnh chuẩn `VieNeu-TTS 1.0x`: **`2.35 từ/s`** tổng (`2.25–3.25 từ/s` khi nói); mỗi `actionBeat` trong `viral_short` `<= 15s`, không đặt `visualBeforeSec >= 0.45s` ở `P1_AB1`.
   - Khóa vật chứng nhắc trong thoại vào `mustShow` để kiểm định trên `storyboard_proof.html`.

```bash
python3 scripts/horror_story.py validate story.json --stage full
python3 scripts/horror_story.py checkup story.json
python3 scripts/horror_story.py export-blueprint story.json --out out/<project>/blueprint --all-parts
```

---

## Bàn Giao Đồng Bộ Sang Sản Xuất (`export-blueprint`)

- **`SCRIPT.skeleton.md`:** Đoạn văn liền mạch sạch **0 thẻ `[PACE=...|PITCH=...]`**, sẵn sàng đưa vào `VieNeu-TTS 1.0x` (chỉ dùng thẻ tự nhiên như `[thở dài]` cùng `[BEAT Xs]`, `[VISUAL Xs]`, `[SILENCE_DROP 0.5–1.2s]`).
- **`manifest.draft.json`:** Khởi tạo `characterMode: "sprite2d"`, thực thể chính `scareTier >= 4`, `Shot 1` (`cold_hook`) → `Shot 2` (`master`) → chuỗi `Anchored POV`, tự suy diễn `actingCues[]`, kèm `jumpscareClips[]` và `captionChunks[]` `4–8 từ`.
- **`cues.draft.json`:** Phối sẵn lớp nền môi trường + **`music_arc` 3 hồi** (`duck_db: -8.5`, `silence_drop_floor_db: -48.0`) + **`min_jumpscares = 1`** (Real-SFX-first, `-16.0 LUFS` / `-1.0 dBTP`).
