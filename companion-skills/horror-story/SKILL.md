---
name: horror-story
description: Use when brainstorming, adapting, or structuring a high-retention Vietnamese or English horror storyline — 55-90s Viral Short (9:16 default) or 2.5-15 min Deep Story / Series — through the v14.0 Oral Folklore & 1-5s Cold Hook workflow governed by pipeline_constitution.json (4 Thumb-Stop Hook Archetypes, Regional Dialect & Platform-Safe Raw Colloquial Voice, Soundscape Motifs, 2D SVG Floorplans, storyboard_proof.html Semantic Lock, and 26 quality gates).
---

# Horror Story Architect v14.0 (`horror-story` · 1–5s Viral Hook & Khẩu Ngữ Truyền Miệng Việt Nam)

Chuyên thiết kế **kịch bản kinh dị giữ chân cao thực chiến thị trường** (`schemaVersion: "3.2"`): đập thẳng **Cold Hook trong `0.1–4.5s` đầu tiên** (cấm dạo đầu thời tiết/ngày tháng rườm rà), viết bằng **khẩu ngữ truyền miệng đời thật gắn với văn hóa 3 miền Việt Nam + ngôn từ cảm thán mạnh hợp lý (`platform_safe_raw`)**, kết hợp **không gian âm thanh sống (`soundscapeDesign`)** và **khóa khung hình ngữ nghĩa (`storyboard_proof.html`)**.

> **Bắt buộc đọc trước khi sáng tác:** [STORYTELLING_CRAFT.md](./references/STORYTELLING_CRAFT.md) (4 đòn Cold Hook 1–5s, từ điển khẩu ngữ & tâm linh Bắc–Trung–Nam, quy tắc dùng từ mạnh `platform_safe_raw`, 2 kiến trúc nhịp `viral_short` vs `deep_story`) và [STORY_SCHEMA.md](./references/STORY_SCHEMA.md) (đặc tả `v3.2` & 26 cổng kiểm định).

---

## Quy Trình Sáng Tác Thực Chiến (`Cold Hook First → Oral Escalation → Blueprint Export`)

### Step 0 — Chốt Chế Độ Nhịp & Màu Sắc Vùng Miền
1. **Chế độ nhịp (`pacingProfile` · chuẩn `pipeline_constitution.json` v14.0):**
   - **`viral_short` *(Mặc định cho video `55s–120s`)*:** Nén nhanh, **thoại + âm thanh mồi nổ ngay ở `0.05–0.25s`**, mỗi `8–14s` mở 1 tình tiết/hội thoại gắt mới, kết bằng cú lật vật chứng sắc lạnh (`0` Jumpscare mặc định).
   - **`deep_story` *(Cho Phim ngắn `2.5–6 phút` 3–5 chương & Series `8–16 phút` 8–15 chương)*:** Vẫn mở Chương 1 bằng Cold Hook `1–5s`, sau đó triển khai Đường cong Răng cưa đa hồi, `red_herring` và lật nghĩa manh mối toàn tập.
2. **Phương ngữ & Độ gắt khẩu ngữ (`dialectRegion` & `gritLevel`):**
   - `dialectRegion`: `"north"` (Bắc Bộ), `"central"` (Miền Trung), `"south"` (Nam Bộ / Miền Tây) — đồng bộ tự động từ xưng hô/thành ngữ tới dàn 25 giọng `VieNeu-TTS`.
   - `gritLevel`: Mặc định **`"platform_safe_raw"`** (cho phép buột miệng tự nhiên *"Mẹ kiếp"*, *"Chết tiệt"*, *"Chó chết"*, *"Bỏ mẹ rồi"*, *"Tổ cha nó"*, *"Khỉ gió"*, *"Má ơi"* đúng tâm lý hoảng sợ/ức chế mà vẫn an toàn 100% trên TikTok/YouTube) hoặc `"clean_folklore"`.

Khởi tạo khung `story.json` v3.2 bằng CLI:
```bash
# Viral Short 65s miền Bắc (mặc định pacingProfile=viral_short, gritLevel=platform_safe_raw)
python3 scripts/horror_story.py seed --title "Máy Nội Bộ 204" --format micro --total-sec 65 --dialect north --out story.json

# Deep Story 210s miền Tây (4 chương liền mạch, 9:16)
python3 scripts/horror_story.py seed --title "Chuyến Đò Gọi Tên" --format short --total-sec 210 --dialect south --out story.json
```

---

### Vòng 1 — Chốt Đòn Cold Hook 1–5s, Thế Giới Quan, Lý Do Mắc Kẹt & Mặt Bằng 2D (`--stage lore`)

1. **`parts[0].coldHook` *(Ưu tiên số 1 — Linh hồn giữ chân khán giả)*:**
   - Chọn `hookArchetype` (`paradox_prop` | `blunt_taboo_dialogue` | `flash_forward_crisis` | `raw_confession`), viết luôn câu `openingLine` (`<= 24 từ`, nổ ngay ở `0.1s`, **CẤM** mở bằng ngày tháng/thời tiết/giới thiệu tên!) và `openingSoundCue` thực địa.
2. **`premise`, `worldLore` & `entityProfile`:** Khóa luật cấm kỵ đời thường, bi kịch gốc (`backstory`), dấu hiệu 5 giác quan và 4 cấp lộ diện leo thang.
3. **`characters[]`:** Nhân vật `lead` bắt buộc có **`trappedReason`** *(lý do thực tế khiến không thể bỏ về ngay)*, `flaw`, `voiceProfile` đúng phương ngữ vùng miền, và `appearanceBrief` cho `CharacterBlueprint`.
4. **`scenes[]` & `clues[]`:** Thiết kế mặt bằng `dimensions` + `landmarks[]` (0% trùng lặp bối cảnh cũ) và ít nhất `2` manh mối (`plantedInPart <= payoffInPart`, có `recontextualization`).

```bash
python3 scripts/horror_story.py validate story.json --stage lore
python3 scripts/horror_story.py render story.json --html --out story-report.html
```

---

### Vòng 2 — Đường Cong Căng Thẳng & Nhịp Mở Vòng Lặp (`--stage structure`)

5. **`props[]` (State Machine):** Các vật chứng thực tế đổi trạng thái theo cốt truyện (`<= 8–10` đạo cụ).
6. **`parts[]`:** Khai báo `tensionStart/Peak/End`, `newInfoRevealed`, `hook` sắc gọn không văn mẫu, và `suspense` bỏ lửng cuối chương.

```bash
python3 scripts/horror_story.py validate story.json --stage structure
```

---

### Vòng 3 — Blocking Hành Động, Soundscape Sống & Khẩu Ngữ Truyền Miệng (`--stage full`)

7. **`soundscapeDesign` + `actionBeats[]` (Vượt đủ 26 Cổng Kiểm Định):**
   - Khóa `nearBed` + `farBed` (có `occlusionTrigger` khi đóng cửa) + `>= 1` `motifs[]` đứt nhịp tại `breakBeatId`.
   - Trong `viral_short`, mỗi `actionBeat` dài `<= 15s` (tốc độ chuẩn **`2.65 từ/s`** tổng, **`3.15–3.45 từ/s`** khi nói), không đặt `visualBeforeSec >= 0.45s` ở `P1_AB1`!
   - **Cổng #25 & #26:** Chặn triệt để văn kể hộ cảm xúc (*"tôi vô cùng kinh hãi"*), văn mẫu AI (*"một cảm giác lạnh lẽo bao trùm"*), và mở bài thời tiết nhàm chán; khóa mọi đạo cụ nhắc trong lời thoại vào `mustShow` để kiểm định trên `storyboard_proof.html`.

```bash
python3 scripts/horror_story.py validate story.json --stage full
python3 scripts/horror_story.py checkup story.json
python3 scripts/horror_story.py export-blueprint story.json --out out/<project>/blueprint --all-parts
```

---

## Bàn Giao Đồng Bộ Sang Sản Xuất (`export-blueprint`)

- **`SCRIPT.skeleton.md`:** Vào thẳng câu `coldHook.openingLine` ngay dòng đầu (không còn `[VISUAL 2.60s]` làm chết 3 giây đầu!), nhúng sẵn `subtext`, `sensoryDetails`, giọng vùng miền tự động và `[SILENCE_DROP]` ở cao trào.
- **`manifest.draft.json`:** Khởi tạo `Shot 1` (`cameraMode: "cold_hook"`) nối sang `Shot 2` (`cameraMode: "master"`) → chuỗi `Anchored POV` + `captionChunks[]` `4–8 từ` đồng bộ khung hình.
- **`cues.draft.json`:** Phối sẵn 2 lớp nền + `motifs[]` + `max_jumpscares = 0` chuẩn `-16.0 LUFS`.
