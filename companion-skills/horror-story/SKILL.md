---
name: horror-story
description: Use when brainstorming, adapting, or structuring a Vietnamese or English horror storyline (standalone 55-75s short or multi-part 5-12 min series) through a 2-round Skeleton-Approval workflow, entity rules, story-driven appearanceBriefs, character tiers, narrative props, 14 quality gates, and an interactive HTML Story Bible report before writing SCRIPT.md.
---

# Horror Story Architect (`horror-story` · Engine v8.0 Spatial & Action Blocking)

Chuyên thiết kế **cốt truyện kinh dị kèm mặt bằng 2D và bảng blocking hành động tuần tự** (`schemaVersion: "2.0"`) trước khi viết lời thoại (`SCRIPT.md`) hoặc dựng cảnh 3D — triệt tiêu hoàn toàn hiện tượng Agent 3D phải tự bịa vị trí cửa/giường/hành lang hay làm nhân vật dịch chuyển vô lý!

> *Phương pháp "khung xương 2 vòng", bảng đạo cụ gắn cao trào và hệ thống kiểm định cốt truyện bằng code được thiết kế có tham khảo từ mô hình `novel-outline` (`eternityspring/shuohao-skills`, Apache-2.0), nâng cấp chuyên sâu cho Horror Engine v8.0 với **18 Cổng Kiểm Định** + **Sơ đồ Mặt bằng 2D SVG** + **Auto-Export Blueprint**.*

**Ranh giới (Boundary):** Skill này khóa chặt **cốt truyện + mặt bằng điểm neo (`landmarks`) + trạng thái đạo cụ (`states`) + bảng hành động tuần tự (`actionBeats`)**. Không viết lời thoại trong ngoặc kép ở văn xuôi `synopsis`, không viết code Three.js trực tiếp.

---

## Quy trình 2 vòng bắt buộc (`Skeleton First, Parts Second`)

### Step 0 — Thu thập tham số (Hỏi gọn 1 lần)
1. **Quy mô:** Phim ngắn độc lập (`standalone`, `1` phần `55–75s`) hay Series nhiều phần (`series`, `3–12` phần, mỗi phần `45–75s`).
2. **Tiểu thể loại (`genre`):**
   - `folklore`: Ma dân gian / Tâm linh vùng miền (Ma Da, Ông Kẹ, Ma Trành...)
   - `rules`: Kinh dị quy tắc / Liminal / Không gian lạ ("Nghe 3 tiếng gõ đừng mở...")
   - `historical`: Dị văn lịch sử / Truyền thuyết có thật
   - `psychological`: Kinh dị tâm lý / Tội ác / Ký ức méo mó
3. **Nguồn truyện (`adaptMode`):** `original` (sáng tác mới), `folklore` (dựng từ giai thoại), hoặc `adapt` / `reimagine` (chuyển thể từ truyện chữ dài).
   - Nếu là truyện dài `.txt`, chia thành từng tập bằng lệnh:
     ```bash
     python3 scripts/horror_story.py chunk <truyen_dai.txt> <workdir> --per-volume 15
     ```

---

### Vòng 1 — Dựng Khung Xương 4 Mảng (`--stage beats`) ⛔ Chưa viết tóm tắt phần!

Chạy lệnh khởi tạo khung JSON (hoặc tự tạo theo [STORY_SCHEMA.md](./references/STORY_SCHEMA.md)):
```bash
python3 scripts/horror_story.py seed --title "Tên truyện" --parts 1 --genre folklore --mode original --out story.json
```

Điền đúng **4 mảng khung xương** theo trình tự 5 bước tư duy:

1. **Cắt tuyến & Khóa Luật Thực Thể (`premise`):**
   - Chốt `core` (1 câu tóm tắt xung đột trung tâm).
   - Chốt `entityRule` (quy tắc sinh tồn / cách quái vật hoạt động — *ví dụ: "Nghe 3 tiếng gõ trong tủ gỗ ban đêm, tuyệt đối không mở ra"*).
   - Chốt `twistCore` (cú lật tâm lý/sự thật cuối cùng).
   - Nếu chuyển thể từ truyện dài (`adaptMode` là `adapt` hoặc `reimagine`), bắt buộc ghi rõ giữ cái gì (`keep` kèm dẫn chứng `evidence`) và cắt bỏ nhánh thừa nào (`cut` kèm lý do `why`) để giữ gọn `1 tuyến chính + tối đa 1 tuyến phụ`.
2. **Gộp vai, Phân hạng Nhân vật & Mô tả Ngoại hình theo Cốt truyện (`characters`):**
   - `lead` (`1–5` người): Nhân vật chính + thực thể phản diện chính (**bắt buộc** có `arc` biến đổi tâm lý từ đầu tới cuối).
   - `support` (`<= 10` người): Người thân, nhân chứng quan trọng (**bắt buộc** có `arc`).
   - `functional` (`<= 10` người): Vai chức năng không cần tên riêng (dùng nhãn như *"Ông lái đò"*, *"Bà hàng xóm"*; không cần `arc`).
   - **BẮT BUỘC điền `appearanceBrief`** cho từng nhân vật/thực thể theo đúng mô tả trong cốt truyện (độ tuổi, trang phục, dáng vẻ, đặc điểm nhận diện hoặc dị dạng siêu nhiên — ví dụ: *"bà cụ mặc áo bà ba nâu, tóc búi bạc, da nhợt"* hay *"bóng đen cao lêu nghêu không mặt chỉ có hai đốm sáng lạnh"*, KHÔNG áp đặt cứng một mẫu quái vật kinh dị cơ thể cho mọi câu chuyện!). Trường này sẽ được chuyển thẳng thành `CharacterBlueprint.storyDescription` ở bước Look-Dev v5.0.
   - Nhân vật quần chúng vô danh không đưa vào bảng.
3. **Khóa Bối cảnh & Sơ đồ Mặt bằng 2D (`scenes` + `dimensions` + `landmarks[]`):**
   - Giới hạn số bối cảnh chính (`primary: true`) để câu chuyện cô đặc, không dàn trải.
   - **BẮT BUỘC với `schemaVersion: "2.0"` (Gate 16):** Mỗi bối cảnh chính khai báo rõ `dimensions: [width, depth, height]` (mét), `archetype`, `ceilingType`, `practicalLights`, và **`>= 3` điểm neo đặt tên (`landmarks[]`)** có tọa độ `[x, y, z]` nằm trong phòng (ví dụ `POV_SEAT`, `OIL_TABLE`, `FRONT_DOOR`, `SHUTTER_WIN`, `BEDROOM_DOOR` kèm `connectsTo: "S02:ENTRY_DOOR"` nếu có cửa thông sang phòng khác!).
   - Bối cảnh chỉ xuất hiện 1 lần trong series nhiều phần phải có `reusePlan`.
4. **Rải Nhịp Cao trào & Tiết lộ (`beats`):**
   - Mỗi beat có `type` (`hook` / `omen` / `dread` / `scare` / `reveal` / `twist` / `escape` / `climax`), `weight` (`major` / `minor`), `part` (số thứ tự phần), `setup`, `payoff`.
   - **Luật giấu mặt kinh dị (`Reveal Discipline`):** Không lộ mặt thực thể hoàn chỉnh ở phần/cảnh mở đầu — dùng dấu hiệu ngoại vi/lẩn khuất trước (`omen` / peripheral lurker), tăng dần tới `major` reveal sau khoảng lặng `[DEAD SILENCE]`.
   - Ở series nhiều phần: khoảng cách giữa 2 beat không quá `maxBeatGap` (mặc định `2` phần), có ít nhất 1 `major`, và `major` đầu tiên không rơi vào phần cuối cùng.

Kiểm định Vòng 1 & xuất báo cáo kèm **Sơ đồ Mặt bằng 2D (SVG)** cho người dùng duyệt:
```bash
python3 scripts/horror_story.py validate story.json --stage beats
python3 scripts/horror_story.py render story.json --html --out story-report.html
```
⛔ **Dừng lại gửi tóm tắt khung xương + file `story-report.html` (kèm Sơ đồ Mặt bằng 2D SVG) cho người dùng chốt.** Khung & mặt bằng chưa chốt tuyệt đối không viết tiếp `parts`.

---

### Vòng 2 — Chốt Máy Trạng Thái Đạo Cụ & Bảng Blocking Hành Động (`--stage full`)

Sau khi người dùng duyệt khung xương + mặt bằng 2D:

5. **Bảng Đạo cụ Kể chuyện (`props`, tối đa `8` món, kèm State Machine):**
   - Chỉ chọn đồ vật **gánh trực tiếp cao trào/cú lật** theo phép thử: *"Món này biến mất hay hỏng thì cốt truyện có sập không?"*.
   - Khai báo `sceneId`, `landmarkId`, `initialState`, danh sách trạng thái có thứ tự `states` (ví dụ `["closedBolted", "boltSliding", "doorJolt", "slammedOpen"]`), `function`, và `beatIds`.
6. **Viết từng Phần (`parts[]`) + Bảng Blocking Hành Động Tuần Tự (`actionBeats[]`):**
   - Mỗi phần `45–75s` (tốc độ đọc chuẩn `2.9 từ/giây` → khoảng `140–215 từ`), `synopsis` văn xuôi không chứa ngoặc kép đối thoại, `hook`, `suspense`, `light`, `sceneIds`, `characterIds`, `propIds`.
   - **BẮT BUỘC `actionBeats[]` (Gate 17 & Gate 18):** Liệt kê tuần tự từng nhịp hành động: `beatId`, `sceneId`, `durationSec`, `mood`, `light`, `camera` (`stance`, `posLandmark`, `lookLandmark`, `motion`), `actors[]` (`id`, `visible`, `fromLandmark`, `toLandmark`, `pose`, `alignPart`), `propChanges[]` (`id`, `fromState`, `toState`), `actionSummary`, `audioCue`, `jumpscareStyle` (tối đa **`<= 2` cú Jumpscare/phần**). Validator sẽ **chặn tức thì** mọi lỗi teleport trong cùng phòng và lỗi nhảy ngược trạng thái đạo cụ!

Kiểm định toàn bộ **18 Cổng Chất Lượng** & xuất báo cáo cuối + **Auto-Scaffold Blueprint** cho bước sản xuất:
```bash
python3 scripts/horror_story.py validate story.json --stage full
python3 scripts/horror_story.py checkup story.json
python3 scripts/horror_story.py render story.json --html --out story-report.html
python3 scripts/horror_story.py render story.json --md --out STORY_BIBLE.md
python3 scripts/horror_story.py export-blueprint story.json --out out/<project>/blueprint --part 1
```

---

## Bàn giao tự động sang sản xuất phim (`export-blueprint` / `export-outline`)

- **Phim ngắn 1 phút hoặc từng Tập (`export-blueprint`):** Tự sinh 3 file khởi tạo đã khóa sẵn 100% ID, tọa độ `locations[].anchors`, `castBlueprints[]` từ `appearanceBrief`, chuỗi hành động `beats[]` và `cues.draft.json`:
  - `SCRIPT.skeleton.md` → điền lời thoại giàu cảm xúc rồi chạy `gen_horror_voice.py` (v6.3 Single-Voice Lock)
  - `manifest.draft.json` → chạy `align_manifest.py` + `validate_manifest.py --script ... --words ... --cues ...`
  - `cues.draft.json` → tinh chỉnh âm thanh Openverse `CC0` & chạy `mix_cues.py --strict` (v7.1)
- **Nếu làm series nhiều tập:** Vẫn hỗ trợ `horror_story.py export-outline story.json --aspect 9:16 --out OUTLINE.json`.
