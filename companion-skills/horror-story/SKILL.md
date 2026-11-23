---
name: horror-story
description: Use when brainstorming, adapting, or structuring a Vietnamese or English horror storyline (standalone 55-75s short or multi-part 5-12 min series) through a 2-round Skeleton-Approval workflow, entity rules, character tiers, narrative props, 14 quality gates, and an interactive HTML Story Bible report before writing SCRIPT.md.
---

# Horror Story Architect (`horror-story`)

Chuyên thiết kế **cốt truyện kinh dị** (tiếng Việt hoặc tiếng Anh) — từ ý tưởng sơ khai, truyền thuyết dân gian, hay chuyển thể truyện dài thành **kết cấu truyện chặt chẽ** trước khi viết lời thoại (`SCRIPT.md`) hoặc dựng cảnh 3D.

> *Phương pháp "khung xương 2 vòng", bảng đạo cụ gắn cao trào và hệ thống kiểm định cốt truyện bằng code được thiết kế có tham khảo từ mô hình `novel-outline` (`eternityspring/shuohao-skills`, Apache-2.0), tùy biến chuyên sâu cho dòng phim ngắn kinh dị & Horror Engine v2.*

**Ranh giới (Boundary):** Skill này chỉ làm **cốt truyện & cấu trúc kịch tính** (ý tưởng lõi, luật thực thể, nhân vật, bối cảnh, đạo cụ kể chuyện, nhịp cao trào, tóm tắt từng phần bằng văn xuôi kể chuyện). **Không** viết lời thoại hoàn chỉnh, **không** chia cỡ cảnh/góc máy (`story.ts`), **không** viết prompt AI.

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
     python scripts/horror_story.py chunk <truyen_dai.txt> <workdir> --per-volume 15
     ```

---

### Vòng 1 — Dựng Khung Xương 4 Mảng (`--stage beats`) ⛔ Chưa viết tóm tắt phần!

Chạy lệnh khởi tạo khung JSON (hoặc tự tạo theo [STORY_SCHEMA.md](./references/STORY_SCHEMA.md)):
```bash
python scripts/horror_story.py seed --title "Tên truyện" --parts 1 --genre folklore --mode original --out story.json
```

Điền đúng **4 mảng khung xương** theo trình tự 5 bước tư duy:

1. **Cắt tuyến & Khóa Luật Thực Thể (`premise`):**
   - Chốt `core` (1 câu tóm tắt xung đột trung tâm).
   - Chốt `entityRule` (quy tắc sinh tồn / cách quái vật hoạt động — *ví dụ: "Nghe 3 tiếng gõ trong tủ gỗ ban đêm, tuyệt đối không mở ra"*).
   - Chốt `twistCore` (cú lật tâm lý/sự thật cuối cùng).
   - Nếu chuyển thể từ truyện dài (`adaptMode` là `adapt` hoặc `reimagine`), bắt buộc ghi rõ giữ cái gì (`keep` kèm dẫn chứng `evidence`) và cắt bỏ nhánh thừa nào (`cut` kèm lý do `why`) để giữ gọn `1 tuyến chính + tối đa 1 tuyến phụ`.
2. **Gộp vai & Phân hạng Nhân vật (`characters`):**
   - `lead` (`1–5` người): Nhân vật chính + thực thể phản diện chính (**bắt buộc** có `arc` biến đổi tâm lý từ đầu tới cuối).
   - `support` (`<= 10` người): Người thân, nhân chứng quan trọng (**bắt buộc** có `arc`).
   - `functional` (`<= 10` người): Vai chức năng không cần tên riêng (dùng nhãn như *"Ông lái đò"*, *"Bà hàng xóm"*; không cần `arc`).
   - Nhân vật quần chúng vô danh không đưa vào bảng.
3. **Khóa Bối cảnh (`scenes`):**
   - Giới hạn số bối cảnh chính (`primary: true`) để câu chuyện cô đặc, không dàn trải.
   - Bối cảnh chỉ xuất hiện 1 lần trong series nhiều phần phải có `reusePlan` (tái sử dụng bối cảnh cũ nhưng đổi ánh sáng/thời tiết `night -> storm -> blood`).
4. **Rải Nhịp Cao trào & Tiết lộ (`beats`):**
   - Mỗi beat có `type` (`hook` / `omen` / `dread` / `scare` / `reveal` / `twist`), `weight` (`major` / `minor`), `part` (số thứ tự phần), `setup`, `payoff`.
   - **Luật giấu mặt kinh dị (`Reveal Discipline`):** Không lộ mặt thực thể hoàn chỉnh ở phần/cảnh mở đầu — dùng dấu hiệu ngoại vi trước (`omen`), tăng dần tới `major` reveal sau khoảng lặng.
   - Ở series nhiều phần: khoảng cách giữa 2 beat không quá `maxBeatGap` (mặc định `2` phần), có ít nhất 1 `major`, và `major` đầu tiên không rơi vào phần cuối cùng.

Kiểm định Vòng 1 & xuất báo cáo cho người dùng duyệt:
```bash
python scripts/horror_story.py validate story.json --stage beats
python scripts/horror_story.py render story.json --html --out story-report.html
```
⛔ **Dừng lại gửi tóm tắt khung xương + file `story-report.html` cho người dùng chốt.** Khung chưa chốt tuyệt đối không viết tiếp `parts`.

---

### Vòng 2 — Chốt Đạo cụ Kể chuyện & Phân rã Từng Phần (`--stage full`)

Sau khi người dùng duyệt khung xương:

5. **Bảng Đạo cụ Kể chuyện (`props`, tối đa `8` món):**
   - Chỉ chọn đồ vật **gánh trực tiếp cao trào/cú lật** theo phép thử: *"Món này biến mất hay hỏng thì cốt truyện có sập không?"* (ví dụ: *Tủ gỗ 2 cánh*, *Bao tải rách đẫm bùn*, *Đèn dầu*). Đồ trang trí nền không đưa vào đây.
   - Ghi rõ `function`, các trạng thái biến đổi `states` (ví dụ `["đóng kín", "hé khe", "bật tung"]`), và `beatIds` mà nó gánh.
6. **Viết từng Phần (`parts[]`):**
   - Mỗi phần `45–75s` (tốc độ đọc chuẩn `2.9 từ/giây` → khoảng `140–215 từ`).
   - Bắt buộc có `synopsis` (văn xuôi kể chuyện — **cấm viết lời thoại trong ngoặc kép**, để tách bạch khâu cốt truyện và khâu viết kịch bản), `hook` (móc câu mở phần), `suspense` (dư âm/câu hỏi treo cuối phần), ánh sáng chủ đạo `light` (`night | candle | storm | eerie | blood`), và tham chiếu đủ `sceneIds`, `characterIds`, `propIds`.

Kiểm định toàn bộ **14 Cổng Chất Lượng** & xuất báo cáo cuối:
```bash
python scripts/horror_story.py validate story.json --stage full
python scripts/horror_story.py checkup story.json
python scripts/horror_story.py render story.json --html --out story-report.html
python scripts/horror_story.py render story.json --md --out STORY_BIBLE.md
```

---

## Bàn giao sang sản xuất phim (`horror-script-storyboard` / `horror-series-pipeline`)

- **Nếu làm series nhiều tập:** Chuyển đổi thẳng sang `OUTLINE.json` chuẩn của `horror-series-pipeline`:
  ```bash
  python scripts/horror_story.py export-outline story.json --aspect 9:16 --out OUTLINE.json
  ```
- **Nếu làm short 1 phút (`/horror-3d-short`):** Dùng trực tiếp `story.json` / `STORY_BIBLE.md` làm đầu vào cho `/horror-script-storyboard` để chuyển thể thành lời dẫn `SCRIPT.md` (`2.7–3.2 từ/giây` kèm `[PAUSE]` và `[DEAD SILENCE]`).
