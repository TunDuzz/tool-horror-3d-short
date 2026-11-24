---
name: horror-story
description: Use when brainstorming, adapting, or structuring a Vietnamese or English horror storyline — standalone 150-300s (2.5-5 min) short, 8-15 min (480-900s) multi-part series, or quick 45-90s micro test — through a 3-round Writer's Room workflow (World Lore & Entity 4-Stage Rules, Character Psychology & Trapped Stakes, Clue/Red-Herring/Twist Economy, Multi-Act Tension Curve SVG, 2D SVG Floorplans, Action+Dialogue Blocking, 24 quality gates, and automated multi-chapter blueprint export).
---

# Horror Story Architect v3.0 (`horror-story` · Engine v9.0 Long-Form Narrative Studio)

Chuyên thiết kế **kịch bản cốt truyện kinh dị có chiều sâu văn học + đường cong căng thẳng + mặt bằng 2D + bảng blocking hành động & định hướng thoại** (`schemaVersion: "3.0"`) trước khi viết `SCRIPT.md` và dựng 3D.

> **Bắt buộc đọc trước khi sáng tác:** [STORYTELLING_CRAFT.md](./references/STORYTELLING_CRAFT.md) (công thức nhịp vàng `150–300s` & `8–15 phút`, luật `trappedReason`, 4 cấp lộ diện, kinh tế manh mối/twist, 10 lối mòn cấm dùng) và [STORY_SCHEMA.md](./references/STORY_SCHEMA.md) (đặc tả 24 cổng kiểm định).

**Ranh giới (Boundary):** Skill này khóa chặt **thế giới quan, quy tắc thực thể, tâm lý nhân vật, manh mối/twist, cấu trúc đa hồi, mặt bằng điểm neo (`landmarks`), state machine đạo cụ, và bảng `actionBeats` kèm `subtext`/`sensoryDetails`/`spokenBeat`**. Không nhồi lời thoại trong ngoặc kép vào `synopsis`, không viết code Three.js trực tiếp.

---

## Quy Trình 3 Vòng Bắt Buộc (`Lore First → Tension Curve → Action & Dialogue Blueprint`)

### Step 0 — Chốt Tham Số Định Dạng (Hỏi gọn 1 lần)
1. **Định dạng & Thời lượng (`format`):**
   - **`short` *(Mặc định phim ngắn độc lập)*:** **`150s–300s` (2.5–5 phút)** — viết thành **1 cốt truyện liền mạch 3–5 Hồi**, tự động chia **`3–5` Chương sản xuất** (`50–65s`/chương) dùng chung bối cảnh 3D `shared/` và ghép không lặp intro thành 1 video duy nhất (`9:16` mặc định, đổi `16:9` được).
   - **`series` *(Tập dài / Series)*:** **`480s–900s` (8–15 phút)** — cấu trúc **4–5 Hồi**, chia **`8–15` Chương** (`55–65s`/chương, mặc định `16:9`, hỗ trợ cắt dọc `9:16`).
   - **`micro` *(Test nhanh / Legacy)*:** `45s–90s` (`1` phần).
2. **Tiểu thể loại (`genre`):** `folklore` (ma dân gian / tâm linh vùng miền), `rules` (kinh dị quy tắc / liminal), `historical` (dị văn lịch sử), `psychological` (tâm lý / tội ác / ký ức méo mó).
3. **Góc nhìn (`pov`):** Mặc định **`first_person_survivor`** (Ngôi thứ nhất POV giàu nội tâm + chèn thoại nhân vật phụ), hỗ trợ `third_person_close`, `found_footage_tape`, `oral_folklore`.
4. **Nguồn truyện (`adaptMode`):** `original`, `folklore`, hoặc `adapt` / `reimagine` (nếu chuyển thể truyện chữ dài `.txt`, chia tập trước bằng `horror_story.py chunk`).

Khởi tạo khung `story.json` v3.0 bằng CLI:
```bash
# Phim ngắn 3.5 phút (210s = 4 chương liền mạch, 9:16)
python3 scripts/horror_story.py seed --title "Tên truyện" --format short --total-sec 210 --genre folklore --out story.json

# Series 10 phút (600s = 10 chương, 16:9)
python3 scripts/horror_story.py seed --title "Tên series" --format series --total-sec 600 --genre rules --out story.json
```

---

### Vòng 1 — Thế Giới Quan, Thực Thể, Tâm Lý Nhân Vật, Manh Mối & Mặt Bằng 2D (`--stage lore`) ⛔ Chưa viết `parts[]`!

Hoàn thiện **6 nền móng chiều sâu** theo [STORYTELLING_CRAFT.md](./references/STORYTELLING_CRAFT.md):
1. **`premise` & `worldLore`:** Khóa `core`, `entityRule`, `twistCore`, thời đại (`era`), không gian cô lập (`settingDetail`), tiến trình thời tiết (`weatherProgression`), **bi kịch gốc (`backstory`)**, và cấm kỵ dân gian (`tabooLore`).
2. **`entityProfile` (4 Cấp Lộ Diện):** Bản chất (`origin`), `>= 2` quy tắc cụ thể (`rule`, `trigger`, `consequence`, `loophole`), `>= 3` dấu hiệu 5 giác quan (`sensoryTells`), và **4 cấp lộ diện leo thang** (`escalationStages`: Ngoại vi → Rình rập/Giả giọng → Xâm phạm bảo vệ → Hiện nguyên hình).
3. **`characters[]` (Tâm lý thật & Ngoại hình `CharacterBlueprint`):**
   - Mọi nhân vật `lead` (người) **BẮT BUỘC** có `goal` (mục tiêu trước biến cố), **`trappedReason`** *(lý do không thể bỏ chạy ngay!)*, `flaw` (điểm yếu tâm lý), `voiceProfile` (tông giọng/khẩu ngữ), `carriedItems[]` (đồ mang theo), `appearanceBrief` (chuyển thẳng thành `CharacterBlueprint`), và `relationships[]` (tuyến quan hệ & mâu thuẫn).
4. **`scenes[]` (Mặt bằng 2D SVG):** Mỗi bối cảnh chính có `dimensions: [w, d, h]`, `archetype`, `practicalLights`, và `>= 3` `landmarks[]` nằm trong phòng kèm cửa nối `connectsTo: "S02:LANDMARK"`.
5. **`clues[]` (Kinh tế Manh mối & Lật kèo):** `short >= 2` manh mối, `series >= 4` manh mối + `>= 1 red_herring`. Khóa `plantedInPart <= payoffInPart` (phải gieo sớm trước chương cuối!) và `recontextualization` (ý nghĩa thật rợn gáy khi lật kèo).
6. **`acts[]` & `beats[]`:** Phân chia 3–5 Hồi phủ kín chương `1..N`, đặt `turningPoint` rõ ràng, giữ kỷ luật giấu mặt thực thể (`No early spoiler`).

Kiểm định Vòng 1 & gửi báo cáo cho người dùng duyệt:
```bash
python3 scripts/horror_story.py validate story.json --stage lore
python3 scripts/horror_story.py render story.json --html --out story-report.html
```
⛔ **Dừng lại gửi tóm tắt Thế giới – Nhân vật – Manh mối – Mặt bằng 2D SVG (`story-report.html`) để người dùng chốt Vòng 1.**

---

### Vòng 2 — Phân Chương, Đạo Cụ State Machine & Đường Cong Căng Thẳng (`--stage structure`)

Sau khi duyệt Vòng 1:
7. **`props[]` (State Machine):** Chọn đồ vật gánh cốt truyện (`<= 10` cho `short`, `<= 16` cho `series`), khóa `sceneId`, `landmarkId`, `initialState`, danh sách trạng thái có thứ tự `states[]`, `function`, `beatIds`.
8. **`parts[]` (Đường cong Răng cưa & Chống rỗng ruột):**
   - Mỗi chương `45–90s` (tổng thời lượng khớp `150–300s` cho `short` hoặc `480–900s` cho `series`), khai báo `act`, `pacingType` (`setup | slow_burn | investigation | false_relief | escalation | twist_reveal | climax_chase | aftermath`), `tensionStart/Peak/End` (`1..10`), **`newInfoRevealed`** (thông tin mới bắt buộc mỗi chương!), `hook`, `synopsis` (văn xuôi sạch không ngoặc kép), `suspense`, `transitionOut`.
   - Đảm bảo **biên độ cảm xúc thật**: phải có ít nhất 1 nhịp lắng/khoảng thở (`tension <= 5`) trước khi đẩy cao trào (`>= 8`).

Kiểm định Vòng 2 & xuất **Biểu đồ SVG Tension Curve** để người dùng duyệt nhịp toàn phim:
```bash
python3 scripts/horror_story.py validate story.json --stage structure
python3 scripts/horror_story.py render story.json --html --out story-report.html
```
⛔ **Gửi người dùng duyệt Biểu đồ Đường cong Căng thẳng & phân chương trước khi viết chi tiết từng beat.**

---

### Vòng 3 — Bảng Blocking Hành Động, Nội Tâm & Định Hướng Thoại (`--stage full`) → Xuất Blueprint Toàn Tập

9. **Điền `actionBeats[]` cho từng chương (`Gate 17, 18, 19, 24`):**
   - Mỗi beat có `beatId`, `sceneId`, `durationSec` *(tổng mỗi chương khớp `target_sec` trong `±20%`)*, `mood`, `light`, `camera`, `actors[]`, `propChanges[]`, `actionSummary`, **`subtext`** *(nội tâm nhân vật)*, **`sensoryDetails`** (`sight`, `sound`, `atmosphere`), **`spokenBeat`** (`speaker`, `intent`, `keyPhrase`, `mood`, `wordBudget`), `audioCue`, `jumpscareStyle`.
   - Kiểm định tự động khóa **0 lỗi teleport xuyên chương**, **0 lỗi nhảy ngược đạo cụ xuyên chương**, đủ `wordBudget`, và **không vượt trần Jumpscare toàn phim**.

Chạy đủ **24 Cổng Chất Lượng**, xuất Story Bible HTML/MD và khởi tạo đồng bộ toàn bộ thư mục các chương:
```bash
python3 scripts/horror_story.py validate story.json --stage full
python3 scripts/horror_story.py checkup story.json
python3 scripts/horror_story.py render story.json --html --out story-report.html
python3 scripts/horror_story.py render story.json --md --out STORY_BIBLE.md

# Xuất 1 phát toàn bộ OUTLINE.json + CONTINUITY.init.json + p01..pNN/{SCRIPT.skeleton.md, manifest.draft.json, cues.draft.json}
python3 scripts/horror_story.py export-blueprint story.json --out out/<project>/blueprint --all-parts
```

---

## Bàn Giao Đồng Bộ Sang Sản Xuất (`export-blueprint --all-parts`)

- **`OUTLINE.json` & `CONTINUITY.init.json`:** Dùng trực tiếp cho `horror-series-pipeline` (cả phim `short` 3–5 chương lẫn `series` 8–15 chương) và `stitch_parts.py` để ghép liền thành 1 file MP4 `2.5–5 phút` hoặc `8–15 phút` với `0.000s` lệch tiếng.
- **`p01..pNN/SCRIPT.skeleton.md`:** Đã gom Hồi theo `mood`/`[DEAD SILENCE]`, nhúng sẵn `Nội tâm (subtext)`, `Cảm giác (sensoryDetails)` và `wordBudget` từng beat để viết lời thoại Việt tự nhiên cho `VieNeu-TTS` (`Thiện Minh`).
- **`p01..pNN/manifest.draft.json`:** Đã khóa sẵn `locations[].anchors`, `castBlueprints[]` (gồm cả nhân vật chính `C01` để quay Hybrid POV + OTS!), `headerStyle: "minimal"` mặc định, `recommendedMicroShots` (`ceil(durationSec / 3.5)` — tách mỗi beat lớn thành `3–5` góc máy `2.5–4.5s` ở `story.ts` để triệt tiêu góc quay chết!), và tự động gắn `sameLocationOf`/`sameCharacterOf` cho `p02..pNN`. Chạy `align_manifest.py` để tự động cắt phụ đề `captionChunks[]` (`4–8 từ`/cụm).
- **`p01..pNN/cues.draft.json`:** Đã khóa `max_jumpscares` đúng mật độ chống nhờn & đồng bộ ID với `manifest.draft.json`.
