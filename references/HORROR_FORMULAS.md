# Horror Script Formulas v5.0 (3 Sub-Genres + 8–10 Part Series Arc)

All formulas below use Horror Engine v5.0's **5 physical lighting presets** (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), **expressive voice mood tags** (`[NARRATOR | mood=...]`, `[SPEAKER: ... | fx=...]`), and **TRUE `-48 dB` `[DEAD SILENCE]`** beats.

---

## Sub-Genre 1: Kinh dị Dân gian / Tâm linh (Vietnamese Folk & Spiritual)

**Core Appeal:** Forbidden rural taboos, ancestral houses, mountain passes, roadside shrines, mist-soaked rivers, karmic debt.
**Recommended Lights:** `warmLamp` (ancestral hall / oil lamp vigil) → `duskFog` (foggy alley / rural courtyard) → `coldMoon` (lamp dies / taboo broken).

### 8-Beat Blueprint (~160–175 words)
1. **Cold Hook (`calm_omen`):** *"Ở ngôi làng ven sông ấy, người ta dặn khách lạ tuyệt đối không được trả lời nếu nghe ai gọi tên mình sau nửa đêm."*
2. **Setting (`tense`, `duskFog`):** Đêm sương dày, ngõ gạch ướt đèn đường cao áp chập chờn, nhân vật cầm `Flashlight3D` tìm nhà người quen.
3. **Uncanny Cue (`whisper`):** Tiếng gọi khẽ từ sau miếu đá (`[SPEAKER: TIẾNG GỌI | fx=ghost]`); bóng rình rập ngoại vi (`addCornerLurker3D`) thoáng đứng im ngoài rìa khung hình.
4. **Escalation (`dread`):** Nhân vật bước nhanh hơn; tiếng guốc gỗ vang đều ngay phía sau; cú `whipPan` quay lại chỉ thấy làn khói hương tan vào sương (`fogOverride` ép gần).
5. **TRUE Dead Silence (`[DEAD SILENCE 0.65s]`):** Giọng kể ngắt lặng, đèn dầu tắt phụt (`warmLamp → coldMoon` + `blackout`), nhạc & ambience cắt xuống chân không `-48 dB`.
6. **Climax Reveal (`panic`):** Cánh cửa mở, `doorwayPeek → stalkLoom` + `aberration` VHS `tapeTear` lộ hình hài thực thể đúng mô tả cốt truyện (`CharacterBlueprint`).
7. **Dark Realization (`dread`):** Lời giải thích nguồn gốc kiêng kỵ (tục gọi hồn / người giữ hẹn năm xưa).
8. **Lingering Twist (`cold_twist`):** *"Sáng hôm sau, bà chủ trọ nhìn đôi dép ướt trước hiên rồi thì thầm: 'Cháu vừa đáp lời ai ngoài cổng thế?'"*

---

## Sub-Genre 2: Kinh dị Đô thị / Rules Horror / Liminal Space

**Core Appeal:** Concrete claustrophobia, fluorescent-lit apartments at 3:00 AM, elevator floor counts, explicit survival rules where one rule subtly contradicts reality.
**Recommended Lights:** `fluorescent` (hospital / apartment corridor) → `flashlight` (power outage / stairwell) → `coldMoon` (balcony / window moonlight).

### 8-Beat Blueprint (~160–175 words)
1. **Cold Hook (`calm_omen`):** *"Tờ giấy dán trong thang máy chung cư cũ chỉ có ba dòng: nếu cửa mở ở tầng 4... tuyệt đối đừng bước ra."*
2. **Setting (`tense`, `fluorescent`):** `02:40`, nhân vật tan ca muộn, hành lang đèn tuýp xanh xao nhấp nháy, tay cầm `Phone3D` hoặc `PaperProp3D`.
3. **Uncanny Cue (`whisper`):** Đèn tuýp chập chờn (`FluorescentTube3D`), thang dừng ở tầng `4` dù bảng nút không có; hành lang sạch bong nhưng hoàn toàn không có cửa căn hộ nào.
4. **Escalation (`dread`):** Cú `whipPan` nhìn lại tờ quy tắc số 2 (*"Nếu thấy một người đứng quay mặt vào tường..."*). Cửa khép chậm nhưng bàn tay lạnh giữ chặt khe cửa.
5. **TRUE Dead Silence (`[DEAD SILENCE 0.65s]`):** `flashlight_click_sputter` tắt ngấm vào chân không `-48 dB` (`blackout` 4–8f).
6. **Climax Reveal (`panic`, `flashlight`):** Ánh đèn pin bật lại rọi thẳng vào thực thể cao gầy (`stalkLoom → lungeCloseUp`, `aberration` VHS `tapeTear`).
7. **Dark Realization (`dread`):** Tờ giấy đó vốn dán **từ phía bên trong tầng 4** — để cảnh báo người bên ngoài, hay nhử người vào?
8. **Lingering Twist (`cold_twist`):** Camera đẩy cận (`POV_PROP`) vào `PaperProp3D` xuất hiện thêm dòng chữ thứ tư mới viết tay.

---

## Sub-Genre 3: Bí ẩn Lịch sử / Sự kiện Có thật Rùng rợn

**Core Appeal:** Documented dates, ship logs, abandoned expeditions, cold factual tone + optional `camcorder` VHS timestamp that makes the unexplained feel chillingly real.
**Rules:** Verify dates, locations, and primary historical records at the top of `SCRIPT.md` before drafting.
**Recommended Lights:** `duskFog` (open sea / wilderness) → `warmLamp` (archives / ship cabin) → `coldMoon` / `flashlight`.

### 8-Beat Blueprint (~165–180 words)
1. **Cold Hook (`calm_omen`):** *"Tháng 2 năm 1948, tàu cứu hộ nhận được bức điện cầu cứu ngắn ngủi..."* `[SPEAKER: ĐIỆN BÁO | fx=phone]` *"Thuyền trưởng và toàn bộ thủy thủ đã chết... tôi cũng đang chết."*
2. **Setting (`tense`, `duskFog`):** Eo biển sương mù dày đặc, con tàu trôi dạt không một vết hư hại giữa biển lặng.
3. **Uncanny Cue (`whisper`):** Đội cứu hộ trèo lên boong: đèn hành hải vẫn sáng, không một vết máu, nhưng mọi chiếc đồng hồ đều dừng đúng một giờ.
4. **Escalation (`dread`, `flashlight`):** Xuống khoang dưới bằng `Flashlight3D`: không dấu vết xô xát; toàn bộ thủy thủ ngồi bất động nhìn cùng một hướng về phía mũi tàu.
5. **TRUE Dead Silence (`[DEAD SILENCE 0.60s]`):** Câm lặng tuyệt đối khi mở cánh cửa phòng điện báo.
6. **Climax Reveal (`panic`, `coldMoon`):** Tia chớp (`lightning`) rọi vào điện báo viên tay vẫn đặt trên phím Morse, gương mặt đông cứng (`terrified`).
7. **Dark Realization (`dread`):** Trước khi kịp kéo tàu về cảng, khói trắng bốc lên từ khoang hàng không rõ nguyên nhân — con tàu chìm vĩnh viễn cùng toàn bộ bằng chứng.
8. **Lingering Twist (`cold_twist`):** *"Đến tận hôm nay, bức điện cuối cùng ấy vẫn không có lời giải: thứ gì đã khiến cả đoàn thủy thủ nhìn về một phía trước khi tắt thở?"*

---

## Series Arc Formula: Phim Ngắn `2.5–5 Phút` (`3–5` Chương) & Tập Dài `8–15 Phút` (`8–15` Chương)

Xem chi tiết **Công thức Nhịp vàng 2.5–5 phút** và **Đường cong Răng cưa 8–15 phút (Sawtooth Dread Curve)** trong `companion-skills/horror-story/references/STORYTELLING_CRAFT.md`.
- Với **Phim ngắn liền mạch (`short`, `150–300s`, `3–5` chương, `seamlessStitch: true`)**: KHÔNG lặp câu mở đầu/recap ở đầu P02..P05; mỗi chương nối thẳng nhịp hành động & trạng thái đạo cụ sang chương sau để ghép thành 1 phim liên tục bằng `stitch_parts.py`.
- Với **Series dài (`series`, `8–15 phút`, `8–15` chương)**: Hỗ trợ cả chế độ ghép liền YouTube `16:9` lẫn xuất từng chương `~60s` độc lập:

| Part | Vai trò trong Tập | Mục tiêu & Mini-Cliffhanger cuối phút |
|---|---|---|
| **P01** | Cold Open & Cài luật | Hook mạnh nhất toàn tập + giới thiệu `LocationBlueprint` & quy tắc cấm kỵ + dấu hiệu lạ đầu tiên. |
| **P02** | Xâm nhập không gian | Bước vào bối cảnh chính thứ hai, nhân vật thử kiểm chứng tin đồn, phát hiện bằng chứng người trước để lại. |
| **P03** | Sự kiện kỳ quái 1 | Một quy tắc bị phá vô tình (hoặc do người đi cùng). Cú giật nhẹ đầu tiên + tiếng động lạ cuối Part. |
| **P04** | Truy vết quá khứ | Chuyển cảnh/hồi tưởng ngắn (`warmLamp`), hé lộ bi kịch gốc đằng sau địa điểm. |
| **P05** | Bước ngoặt Giữa tập (Midpoint) | Tưởng đã an toàn hoặc tìm được lối ra → phát hiện lối ra đã biến mất / bị khóa ngược từ ngoài. |
| **P06** | Chia cắt & Hoang mang | Không gian ngột ngạt (`fluorescent` / `fogOverride`), ánh sáng hỏng (`flicker`), nhân vật đối mặt nỗi sợ tâm lý. |
| **P07** | Bẫy sập / Lật mặt | Manh mối tưởng là cứu cánh hóa ra chính là cái bẫy; hé lộ sự thật tàn khốc về đồng hành hoặc nhân vật. |
| **P08** | Cao trào Đỉnh điểm | TRUE Dead Silence `-48 dB` → Sấm chớp / Hiện hình trọn vẹn (`coldMoon` / `flashlight`, `lungeCloseUp`), cuộc đối đầu hoặc chạy trốn nghẹt thở. |
| **P09** | Giải mã & Kết cục | Hậu quả cuối cùng; giải thích mảnh ghép còn thiếu khiến mọi chi tiết từ P01 trở nên rợn người. |
| **P10** | Dư âm & Cú Twist cuối *(nếu 10p)* | Sáng hôm sau tưởng kết thúc yên bình → 1 chi tiết nhỏ chứng tỏ thứ đó đã theo về. Kết đột ngột! |

**Quy tắc nối Part:**
- Mỗi Part có `150–185 từ`, **tự mở bằng micro-hook `3–5 từ`** (nối tiếp câu cuối Part trước nhưng người xem mới vẫn hiểu ngữ cảnh) và **kết thúc trên một câu hỏi/âm thanh/hình ảnh bỏ lửng**.
