# Horror Script Formulas (3 Sub-Genres + 8–10 Part Series Arc)

---

## Sub-Genre 1: Kinh dị Dân gian / Tâm linh (Vietnamese Folk & Spiritual)

**Core Appeal:** Forbidden rural taboos, ancestral houses, mountain passes, roadside shrines, mist-soaked rivers, karmic debt.
**Recommended Lights:** `candle` (ancestral hall / oil lamp) -> `night` (bamboo grove / courtyard) -> `blood` (taboo broken).

### 8-Beat Blueprint (~160–175 words)
1. **Cold Hook:** *"Ở ngôi làng ven sông ấy, người ta dặn khách lạ tuyệt đối không được trả lời nếu nghe ai gọi tên mình sau nửa đêm."*
2. **Setting:** Đêm mưa phùn, ngõ nhỏ không đèn đường, nhân vật (tên cụ thể) mang đèn pin tìm nhà người quen.
3. **Uncanny Cue:** Tiếng gọi khẽ từ sau miếu đá; bóng dưới ánh đèn dầu chỉ có một cái dù hai người đang đứng.
4. **Escalation:** Nhân vật bước nhanh hơn; tiếng guốc gỗ / chuông đồng vang đều ngay phía sau; quay lại chỉ thấy làn khói hương tan vào sương (`fxMist`).
5. **Dead Silence:** Giọng kể ngắt `0.6 s`, ánh đèn chập chờn (`flicker`), camera đẩy chậm (`dollyZoom`).
6. **Climax Reveal:** Cánh cửa mở, ánh sáng hắt lộ bóng áo dài mờ (`opacity: 0.5`, `expr: "hollow"`) đứng quay lưng ngay ngưỡng cửa.
7. **Dark Realization:** Lời giải thích nguồn gốc kiêng kỵ (tục gọi hồn / người giữ hẹn năm xưa).
8. **Lingering Twist:** *"Sáng hôm sau, bà chủ trọ nhìn đôi dép ướt trước hiên rồi thì thầm: 'Cháu vừa đáp lời ai ngoài cổng thế?'"*

---

## Sub-Genre 2: Kinh dị Đô thị / Rules Horror / Liminal Space

**Core Appeal:** Concrete claustrophobia, fluorescent-lit apartments at 3:00 AM, elevator floor counts, explicit survival rules where one rule subtly contradicts reality.
**Recommended Lights:** `eerie` (fluorescent corridor) -> `storm` / `night` (balcony/street) -> `blood` (rule violated).

### 8-Beat Blueprint (~160–175 words)
1. **Cold Hook:** *"Tờ giấy dán trong thang máy chung cư cũ chỉ có ba dòng: nếu cửa mở ở tầng 4... tuyệt đối đừng bước ra."*
2. **Setting:** `2:40 AM`, nhân vật tan ca muộn, hành lang đèn tuýp xanh xao (`eerie`), thang máy chỉ có bảng nút 1–3–5.
3. **Uncanny Cue:** Bảng LED nhấp nháy (`flickerAt`), thang dừng ở số `4` dù nút không tồn tại; ngoài hành lang sạch bong nhưng không có cửa căn hộ nào.
4. **Escalation:** Kiểm tra lại quy tắc số 2 (*"Nếu thấy một người mặc áo mưa đứng quay mặt vào tường..."*). Cửa khép chậm nhưng tay nắm giữ lại.
5. **Dead Silence:** `0.5 s` im bặt, tiếng đèn tuýp tắt ngấm (`blackout` 4f).
6. **Climax Reveal:** Ánh sáng bật lại (`eerie` -> `blood`), nhân vật đứng đối diện bóng mờ cười rợn (`expr: "unhinged"`, `opacity: 0.65`).
7. **Dark Realization:** Tờ giấy đó vốn dán **từ phía bên trong tầng 4** — để cảnh báo người bên ngoài, hay nhử người vào?
8. **Lingering Twist:** Camera zoom chậm vào tờ quy tắc xuất hiện thêm dòng chữ thứ tư mới viết tay.

---

## Sub-Genre 3: Bí ẩn Lịch sử / Sự kiện Có thật Rùng rợn

**Core Appeal:** Documented dates, ship logs, abandoned expeditions, cold factual tone that makes the unexplained feel real.
**Rules:** Verify dates, locations, and primary historical records at the top of `SCRIPT.md` before drafting.
**Recommended Lights:** `storm` (open sea / wilderness) -> `candle` (archives / ship cabin) -> `night`.

### 8-Beat Blueprint (~165–180 words)
1. **Cold Hook:** *"Tháng 2 năm 1948, tàu cứu hộ nhận được bức điện cầu cứu ngắn ngủi: 'Thuyền trưởng và toàn bộ thủy thủ đã chết... tôi cũng đang chết.'"*
2. **Setting:** Eo biển đầy sương mù, con tàu trôi dạt không một vết hư hại giữa biển lặng.
3. **Uncanny Cue:** Đội cứu hộ trèo lên boong: đèn hành hải vẫn sáng, không một vết máu, nhưng mọi chiếc đồng hồ đều dừng đúng một giờ.
4. **Escalation:** Xuống khoang dưới: không có dấu vết xô xát; toàn bộ thủy thủ ngồi cứng nhìn cùng một hướng về phía mũi tàu.
5. **Dead Silence:** `0.6 s` câm lặng khi mở cửa phòng điện báo.
6. **Climax Reveal:** Chớp sét (`lightning`) rọi vào xác điện báo viên tay vẫn đặt trên phím Morse, gương mặt đông cứng (`terrified`).
7. **Dark Realization:** Trước khi kịp kéo tàu về cảng, khói trắng bốc lên từ khoang hàng mà không rõ nguyên nhân — con tàu chìm vĩnh viễn cùng toàn bộ bằng chứng.
8. **Lingering Twist:** *"Đến tận hôm nay, bức điện cuối cùng ấy vẫn không có lời giải: thứ gì đã khiến cả đoàn thủy thủ nhìn về một phía trước khi tắt thở?"*

---

## Series Arc Formula: Tập Dài 8–10 Phút (Chia 8–10 Part × ~1 Phút)

Đừng viết lan man—mỗi Part `~60 s` phải hoạt động được cả khi xem **riêng lẻ trên Shorts** lẫn khi **nối liền trên YouTube**:

| Part | Vai trò trong Tập | Mục tiêu & Mini-Cliffhanger cuối phút |
|---|---|---|
| **P01** | Cold Open & Cài luật | Hook mạnh nhất toàn tập + giới thiệu địa điểm & quy tắc cấm kỵ + dấu hiệu lạ đầu tiên. |
| **P02** | Xâm nhập không gian | Bước vào bối cảnh chính (`Era 2`), nhân vật thử kiểm chứng tin đồn, phát hiện bằng chứng người trước để lại. |
| **P03** | Sự kiện kỳ quái 1 | Một quy tắc bị phá vô tình (hoặc do người đi cùng). Cú giật nhẹ đầu tiên + tiếng động lạ cuối Part. |
| **P04** | Truy vết quá khứ | Chuyển cảnh/hồi tưởng ngắn (`candle` / `Era 3`), hé lộ bi kịch gốc đằng sau địa điểm. |
| **P05** | Bước ngoặt Giữa tập (Midpoint) | Tưởng đã an toàn hoặc tìm được lối ra -> phát hiện lối ra đã biến mất / bị khóa ngược từ ngoài. |
| **P06** | Chia cắt & Hoang mang | Không gian biến dạng (`eerie`), ánh sáng hỏng (`flicker`), nhân vật đối mặt nỗi sợ tâm lý. |
| **P07** | Bẫy sập / Lật mặt | Manh mối tưởng là cứu cánh hóa ra chính là cái bẫy; hé lộ sự thật tàn khốc về đồng hành hoặc nhân vật. |
| **P08** | Cao trào Đỉnh điểm | Dead Silence -> Sấm chớp / Hiện hình trọn vẹn (`blood`), cuộc đối đầu hoặc chạy trốn nghẹt thở. |
| **P09** | Giải mã & Kết cục | Hậu quả cuối cùng; giải thích mảnh ghép còn thiếu khiến mọi chi tiết từ P01 trở nên rợn người. |
| **P10** | Dư âm & Cú Twist cuối *(nếu 10p)* | Sáng hôm sau tưởng kết thúc yên bình -> 1 chi tiết nhỏ chứng tỏ thứ đó đã theo về. Kết đột ngột! |

**Quy tắc nối Part:**
- Mỗi Part có `150–185 từ`, **tự mở bằng micro-hook `3–5 từ`** (nối tiếp câu cuối Part trước nhưng người xem mới vẫn hiểu ngữ cảnh) và **kết thúc trên một câu hỏi/âm thanh/hình ảnh bỏ lửng**.
