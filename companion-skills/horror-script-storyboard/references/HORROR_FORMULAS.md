# 5 Công Thức Kịch Bản Kinh Dị Triệu View Luân Phiên v15 (`HORROR_FORMULAS.md`)

Mọi công thức dưới đây tuân thủ chuẩn **Engine v15 (`VieNeu-TTS 1.0x` sạch + 3-Act Score + Jumpscare đồng bộ)**:
- **Quy trình 2 bước:** Viết trọn câu chuyện sạch **0 thẻ kỹ thuật** trước → chốt truyện hay rồi mới chia shot, gắn khoảng nghỉ sạch (`[BEAT Xs]`, `[VISUAL Xs]`, `[SILENCE_DROP 0.5–1.2s]`), tuyệt đối **không dùng `[PACE=... | PITCH=...]`**.
- **Nhịp kể điềm tĩnh, có độ thở tự nhiên:** **`2.35 từ/s`** tổng (`2.25–3.25 từ/s` khi nói, mục tiêu `2.75 từ/s`) — tương đương **`155–175 từ`** cho một video `65–75s`.
- **Giọng kể chân thực, không ép chửi thề:** Bỏ quota chửi thề gượng; giữ giọng truyền miệng điềm tĩnh, đối thoại đời thường đúng 3 miền; không ép mọi truyện phải có đồng hồ đứng kim hay sập chốt cửa sắt.
- **Bắt buộc `1–2` cú Jumpscare đồng bộ AV (`min_jumpscares >= 1`):** Thực thể chính tạo hình **Bậc 4–7**, đặt ngay sau khoảng rút im lặng **`[SILENCE_DROP 0.5–1.2s]`** (`-48 dB`).

---

## Mô-Típ 1: Ký Ức / Đồng Dao / Lễ Hội Quen Thuộc Bị Bẻ Cong
**Chất liệu:** Đêm rước đèn trung thu ngõ cũ, trò trốn tìm sân đình, bài đồng dao ru ngủ quen thuộc bỗng có thêm một câu lạ, mâm cỗ rằm tháng bảy.
**Ánh sáng vật lý:** `warmLamp` (đèn lồng / bếp cũ) → `duskFog` → `coldMoon`.
**Khung `65–75s`:**
1. **`0–5s` Hook sạch (`direct_taboo_question` hoặc `survivor_confession`, không lộ bài):** Chạm ngay vào ký ức trò chơi/bài đồng dao quen thuộc mà ai cũng từng nghe hồi nhỏ.
2. **`5–18s` Lõi cảm xúc con người:** Kỷ niệm thật với đứa em nhỏ hoặc bạn thơ ấu (chiếc đèn ông sao tự dán, lời hẹn rước đèn trước khi chuyển nhà).
3. **`18–34s` Tầng 1 (Dấu hiệu mơ hồ bị cười gạt):** Trong nhóm chơi dư ra một bóng trẻ đứng cuối hàng nhưng ai cũng tưởng con nhà hàng xóm mới dọn về.
4. **`34–50s` Tầng 2 (Xâm lấn vùng an toàn):** Tiếng hát đồng dao vang đều ngay sát tai khi cả xóm đã tắt đèn; đếm lại số bóng dưới ánh đèn đường luôn thừa đúng một người không có bước chân.
5. **`50–62s` Tầng 3 + `[SILENCE_DROP 0.7–1.1s]` + Jumpscare (Bậc 4–7):** Tiếng hát tắt bặt (nhạc nền & môi trường rút về `-48 dB`) → thực thể quay đầu/bám góc mái hiên lộ diện cùng cú nổ stinger thu thật `-1.0 dBTP`.
6. **`62–72s` Câu chốt dư âm:** Lật ngược chi tiết bức ảnh hoặc món đồ kỷ niệm ở đầu bằng 1 câu lạnh người.

---

## Mô-Típ 2: Điều Kiêng Kỵ Dân Gian Đời Thường Ai Cũng Từng Nghe
**Chất liệu:** Úp ngược dép trước bậu cửa, gõ đũa vào miệng bát, không trả lời khi nghe gọi tên ban đêm, không nhặt tiền lẻ ở ngã ba, không quay đầu khi ai vỗ vai trong ngõ tối.
**Ánh sáng vật lý:** `warmLamp` (hiên nhà / đèn bàn thờ) → `coldMoon` (tắt đèn / phạm kỵ).
**Khung `65–75s`:**
1. **`0–5s` Hook sạch (`direct_taboo_question`):** Hỏi thẳng về điều kiêng kỵ quen thuộc mà người lớn trong nhà hay nhắc nhưng giới trẻ thường cười bỏ qua.
2. **`5–18s` Lõi cảm xúc con người:** Nhân vật vội về nhà muộn vì một lời hứa đời thường (mang thuốc về cho mẹ, ăn bữa cơm bà ngoại để phần).
3. **`18–34s` Tầng 1:** Bắt gặp dấu hiệu kiêng kỵ (đôi dép tự úp ngược, bát cơm có sẵn đôi đũa cắm thẳng) nhưng tự trấn an do gió hoặc vô ý.
4. **`34–50s` Tầng 2:** Vùng an toàn bị bẻ gãy — tiếng gọi từ phòng bên lặp lại đúng một câu với nhịp đều vô cảm, hoặc bóng người phản chiếu trên cửa kính không chuyển động khớp với người thật.
5. **`50–62s` Tầng 3 + `[SILENCE_DROP]` + Jumpscare:** Toàn bộ không gian rơi vào im lặng `-48 dB` → chạm mặt trực diện thực thể bậc 4–7 trong khung cửa tối.
6. **`62–72s` Câu chốt dư âm:** Một chi tiết xác thực ngắn gọn (tin nhắn/cuộc gọi/vật chứng) phủ định hoàn toàn điều nhân vật tin ở đầu truyện. *(Xem mẫu đầy đủ tại `examples/script_v15_sample.md`.)*

---

## Mô-Típ 3: Chuyện Có Thật Ở Địa Điểm Bỏ Hoang
**Chất liệu:** Trường cấp hai giải tỏa, phòng chiếu bóng cũ, khu tập thể mất điện, trạm y tế cũ ven đèo, nhà kho bến tàu.
**Ánh sáng vật lý:** `duskFog` → `flashlight` (chỉ dùng khi truyện có đèn pin) hoặc `fluorescent` → `coldMoon`.
**Khung `65–75s`:**
1. **`0–5s` Hook sạch (`survivor_confession` hoặc `immediate_danger`):** Mở thẳng tại khoảnh khắc nhân vật đứng bên trong địa điểm bỏ hoang và phát hiện một dấu vết còn rất mới (vết phấn ướt trên bảng, ghế xoay còn đung đưa).
2. **`5–18s` Lõi cảm xúc con người:** Lý do thực tế và nhân bản buộc phải quay lại nơi đó (tìm kỷ vật của bạn cũ, lấy lại đồ nghề mưu sinh, giao nốt chuyến hàng bị nhầm địa chỉ).
3. **`18–34s` Tầng 1:** Một âm thanh hoặc dòng chữ đời thường còn sót lại khiến nhân vật tưởng vẫn có bảo vệ hoặc người qua đường.
4. **`34–50s` Tầng 2:** Phát hiện lối ra vừa đi qua đã đổi khác, hoặc thấy dấu tay/vết bước dừng ngay sau lưng mình trong khoảng hành lang không còn lối thoát.
5. **`50–62s` Tầng 3 + `[SILENCE_DROP]` + Jumpscare:** Không gian tắt lịm `-48 dB` → thực thể bám góc trần hoặc khe cửa (Bậc 4–7) áp sát khung hình.
6. **`62–72s` Câu chốt dư âm:** Thông tin thực địa sáng hôm sau hé lộ nơi đó đã đóng cửa từ nhiều năm trước và món đồ nhân vật cầm về thuộc về ai.

---

## Mô-Típ 4: Người Thân Giả Mạo (*Doppelgänger*)
**Chất liệu:** Tiếng mẹ gọi từ bếp trong khi mẹ đang ở viện, bóng anh trai ngồi quay lưng ngoài ban công, giọng bạn cùng phòng hỏi mượn chìa khóa từ bên ngoài dù người thật đang ngủ trên giường.
**Ánh sáng vật lý:** `warmLamp` (phòng ngủ / bếp ấm) → `fluorescent` (hành lang lạnh) → `coldMoon`.
**Khung `65–75s`:**
1. **`0–5s` Hook sạch (`immediate_danger`):** Đặt ngay vào khoảnh khắc nhân vật vừa nghe tiếng người thân gọi quen thuộc… thì điện thoại trên tay lại đổ chuông đúng tên người đó.
2. **`5–18s` Lõi cảm xúc con người:** Nết sinh hoạt rất riêng của hai người thân (câu nhắc mặc áo khoác, thói quen pha trà, giọng gọi tên ở nhà) khiến người xem tin ngay mối gắn kết ấm áp.
3. **`18–34s` Tầng 1:** Một cử chỉ nhỏ lệch nếp quen (gọi bằng tên đầy đủ thay vì tên ở nhà, quên mất thói quen cũ) bị nhân vật bỏ qua vì tưởng người kia mệt.
4. **`34–50s` Tầng 2:** Người giả cố kéo nhân vật ra khỏi phòng hoặc mở cửa; từng câu đáp lại bắt đầu lặp nguyên văn như học thuộc lòng, khuôn mặt luôn khuất sáng.
5. **`50–62s` Tầng 3 + `[SILENCE_DROP]` + Jumpscare:** Khoảnh khắc buộc phải nhìn thẳng mặt qua khe cửa / gương sau `[SILENCE_DROP]` → nụ cười kéo dài bất thường hoặc cổ nghiêng gãy (Bậc 5–6).
6. **`62–72s` Câu chốt dư âm:** Người thân thật trả lời trên điện thoại câu hỏi ở giây cuối — đẩy người xem rợn gáy nhớ lại hành động mình vừa làm ở đầu truyện.

---

## Mô-Típ 5: Bí Mật Gia Đình / Luật Sinh Tồn
**Chất liệu:** Căn phòng luôn khóa của ông nội, tờ giấy quy tắc nhà mới thuê, quy ước đặt thêm một bát đũa mỗi đêm rằm, điều kiện kỳ lạ khi giữ nhà giúp họ hàng.
**Ánh sáng vật lý:** `warmLamp` → `fluorescent` → `coldMoon`.
**Khung `65–75s`:**
1. **`0–5s` Hook sạch (`immediate_danger` hoặc `direct_taboo_question`):** Đọc thẳng 1 điều luật ngắn, lạ lùng nhưng rất cụ thể mà không tiết lộ vì sao phải tuân theo.
2. **`5–18s` Lõi cảm xúc con người:** Nhân vật chấp nhận quy tắc đó vì hoàn cảnh thật (tiền thuê rẻ để xoay xở học phí, giữ nhà cho cô ruột nằm viện).
3. **`18–34s` Tầng 1:** Mọi thứ diễn ra êm ả cho đến khi một tình huống nhỏ khiến nhân vật vô tình lệch khỏi quy tắc vài phút.
4. **`34–50s` Tầng 2:** Dấu hiệu "người đặt luật" không phải để dọa mà để tự vệ — thứ bên kia bắt đầu thử từng kẽ hở trong căn nhà.
5. **`50–62s` Tầng 3 + `[SILENCE_DROP]` + Jumpscare:** Vào đúng khoảnh khắc nhân vật tưởng đã kịp sửa sai → `[SILENCE_DROP]` → thực thể bậc 4–7 xuất hiện ngay bên trong vùng từng tưởng là an toàn.
6. **`62–72s` Câu chốt dư âm:** Lật mặt sau tờ giấy quy tắc hoặc mở bức ảnh gia đình cũ, hé lộ lý do thật sự đằng sau điều luật đầu tiên.

---

## Công Thức Đa Chương `deep_story` (`2.5–6 Phút` Short & `8–16 Phút` Series)

Xem chi tiết kiến trúc đa hồi trong `companion-skills/horror-story/references/STORYTELLING_CRAFT.md`:
- **Chương 1 (`P01`):** Mở bằng **Hook sạch `0–5s`** (không lộ bài) + **Lõi cảm xúc con người** → cài `trappedReason`, manh mối `CL01` và kết bằng dị biến tầng 2 + 1 cú Jumpscare mở màn.
- **Chương `P02..PNN`:** Triển khai Đường cong Răng cưa (có khoảng thở giả *False Relief* để khán giả tưởng an toàn trước khi bẻ ngược), mỗi chương tối thiểu `1` cú Jumpscare đồng bộ AV (`min_jumpscares >= 1`). Nếu đăng tách tập, mở đầu bằng Micro-Hook `3 giây` nối thẳng tình huống trước; nếu `seamlessStitch: true`, ghép mượt không lặp intro.
