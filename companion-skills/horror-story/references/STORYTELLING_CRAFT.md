# Cẩm Nang Biên Kịch Kinh Dị Triệu View v15 (`STORYTELLING_CRAFT.md` · Nhân Bản, 5 Mô-Típ & `VieNeu-TTS 1.0x`)

> **Nguyên Lý Cốt Lõi v15:** Người xem không ở lại vì những câu chửi thề gượng gạo hay mô-típ trực đêm lặp đi lặp lại. Họ xem đến giây cuối — và để lại bình luận — khi câu chuyện **mở thẳng bằng một điểm neo tò mò không lộ bài**, **khiến họ thật sự thương/lo cho nhân vật trong 15 giây đầu**, **leo thang mạch lạc qua 3 tầng từ đời thường đến xâm lấn vùng an toàn**, **bùng nổ đúng 1 cú Jumpscare sắc nét**, và **khép lại bằng 1 câu chốt lật ngược chi tiết ban đầu**.

---

## 1. Quy Trình Viết Tách Biệt 2 Bước (Cấm Trộn Lẫn Sáng Tác Với Thẻ Kỹ Thuật)

### Bước 1 — Sáng Tác Sạch (0 Thẻ Kỹ Thuật)
- Viết toàn bộ câu chuyện như **một người từng trải đang ngồi kể lại chuyện thật** bằng văn nói tự nhiên, điềm tĩnh, giàu cảm xúc — **tuyệt đối 0 thẻ `[BEAT]`, `[PROX]`, `[VISUAL]`, `[PACE]`, `[PITCH]`**.
- Đọc nhẩm thành tiếng từ đầu đến cuối: nếu bản chữ trơn chưa khiến chính bạn thấy thương nhân vật, thấy rợn ở câu chốt và muốn đọc lại chi tiết ở đầu, **chưa chuyển sang Bước 2**.

### Bước 2 — Đạo Diễn & Đánh Dấu
- Sau khi chốt câu chuyện hay ở Bước 1 mới chia nhịp cảnh/shot, gắn người nói (`[NARRATOR]`, `[SPEAKER: ...]`), khoảng nghỉ sạch (`[BEAT Xs]`, `[VISUAL Xs]`), thẻ bản địa tự nhiên nếu cần (`[thở dài]`), khoảng rút im lặng **`[SILENCE_DROP 0.5–1.2s]`** trước cao trào và điểm nổ **Jumpscare** khớp khung hình.
- **TUYỆT ĐỐI KHÔNG chèn `[PACE=... | PITCH=...]`** vào `SCRIPT.md`: giữ đoạn văn liền mạch để **`VieNeu-TTS 1.0x`** đọc tự nhiên, tròn dấu tiếng Việt, không bị cắt vụn hay méo tiếng.

---

## 2. Khóa 4 Nguyên Tắc Nội Dung Triệu View

### Nguyên tắc 1: Hook `0–5s` Sạch & CẤM Lộ Bài Sớm (`<= 24 từ`, nổ ở `0.05–0.25s`)
**TUYỆT ĐỐI CẤM** mở đầu bằng thời tiết / ngày tháng / giới thiệu tên (*"Đêm cuối năm..."*, *"Tháng 10 năm..."*) và **TUYỆT ĐỐI CẤM kể trước đáp án cú lật cuối ngay ở câu mở đầu**. Chọn 1 trong **3 kiểu Hook sạch**:

| Mã `hookArchetype` | Kiểu Hook `0–5s` | Mục tiêu tâm lý | Ví dụ chuẩn (điềm tĩnh, không lộ bài) |
|---|---|---|---|
| **`immediate_danger`** *(Vào thẳng tình huống nguy hiểm)* | Đưa thẳng người xem vào khoảnh khắc nhân vật đang đối diện một dấu hiệu bất thường ngay trước mắt | Kéo nhịp tim lên ngay giây đầu mà vẫn giấu nguyên nhân | *"Cánh cửa buồng khép hờ, còn tiếng bà ngoại từ trong bếp vẫn đều đều gọi tôi ra ăn cơm cho nóng."* |
| **`direct_taboo_question`** *(Câu hỏi / lời kiêng kỵ trực diện)* | Chạm ngay vào một điều kiêng kỵ dân gian hoặc thói quen quen thuộc ai cũng từng nghe | Kích hoạt trí nhớ cá nhân của người xem trong 3 giây | *"Ở quê bạn có từng nghe người lớn dặn: đêm về thấy đôi dép trong nhà tự úp ngược trước bậu cửa, tuyệt đối đừng gọi tên người ở trong chưa?"* |
| **`survivor_confession`** *(Lời thú nhận của người sống sót)* | Giọng kể trầm tĩnh của người đã bước qua biến cố, thừa nhận một thói quen vĩnh viễn thay đổi | Tạo cảm giác chuyện có thật 100%, gợi tò mò "đã xảy ra chuyện gì?" | *"Từ sau lần về quê giỗ ông năm hai mươi tuổi, đến tận bây giờ tôi không bao giờ dám trả lời khi nghe tiếng người nhà gọi mình từ phòng tối nữa."* |

### Nguyên tắc 2: Lõi Cảm Xúc Con Người (`5–18s`)
- Trước khi hù, phải cho người xem **một lý do để lo cho nhân vật** bằng 1 chi tiết thật gắn với gia đình, bạn bè hoặc mưu sinh: *nồi canh bà ngoại giữ ấm cho cháu về khuya*, *cuốn vở cũ của đứa em gái*, *chuyến xe cuối tháng gom tiền gửi về quê*, *bức ảnh chụp chung mùa trung thu năm nhỏ*.
- Chính chi tiết ấm áp này sẽ trở thành **mỏ neo để cú lật cuối cùng bẻ ngược** và gây ám ảnh gấp đôi.

### Nguyên tắc 3: Leo Thang 3 Tầng, Cấm Tả Cảnh Thừa
Mỗi câu đều phải đẩy cốt truyện tiến thêm một bước (không dừng lại tả gió rít hay bóng đêm rườm rà):
1. **Tầng 1 — Dấu hiệu mơ hồ bị cười gạt (`18–34s`):** Chi tiết nhỏ hơi lệch bình thường (đôi dép úp ngược, lời bài đồng dao thiếu một chữ, tiếng dép lê ngoài hiên) mà nhân vật tự giải thích hợp lý hóa như người thật.
2. **Tầng 2 — Xâm lấn vùng an toàn (`34–50s`):** Thứ bất thường vượt qua ranh giới quen thuộc: giả giọng người thân nhưng lặp lại nguyên văn một câu vô cảm, tiếng động phát ra ở nơi không thể có người, vật chứng bắt đầu phản bác trí nhớ của nhân vật.
3. **Tầng 3 — Đối mặt trực diện thực thể bậc 4–7 + Điểm nổ Jumpscare (`50–62s`):** Rút im lặng **`[SILENCE_DROP 0.5–1.2s]`** (kéo sạch cả nhạc nền lẫn môi trường xuống `-48 dB`) → lộ diện thực thể ma bậc 4–7 không nhạt nhòa kết hợp cú nổ Jumpscare đồng bộ hình–tiếng.

### Nguyên tắc 4: Cái Kết Dư Âm Ám Ảnh (`62–75s`)
- Không giảng giải dài dòng sau cao trào. Dùng đúng **1 câu chốt lạnh người** lật ngược hoàn toàn chi tiết đã cài ở `5–18s` (ví dụ: cuộc gọi/tin nhắn chứng minh người thân không hề ở nhà, tấm ảnh cũ hé lộ người đứng cạnh mình vốn không tồn tại), để lại khoảng dư âm kích thích người xem bình luận và xem lại từ giây đầu.

---

## 3. Mở Rộng 5 Mô-Típ Cốt Truyện Luân Phiên (Không Đóng Khung 1 Khuôn)

Luân phiên đều giữa **5 mô-típ** sau giữa các video (tuyệt đối không quay vòng mỗi mô-típ *"ca trực đêm + người đi trước dặn"*):

1. **Ký ức / Đồng dao / Lễ hội quen thuộc bị bẻ cong:** Đêm rước đèn trung thu, trò trốn tìm sân đình, câu đồng dao ru ngủ hay mâm cỗ cúng giao thừa bị thiếu đi một mảnh ghép quen thuộc.
2. **Điều kiêng kỵ dân gian đời thường ai cũng từng nghe:** Úp ngược dép trong nhà, gõ đũa lên miệng bát, gọi tên thật ban đêm, soi gương lúc 12 giờ khuya, nhặt tiền lẻ ngã ba.
3. **Chuyện có thật ở địa điểm bỏ hoang:** Trường cấp hai cũ giải tỏa, khu tập thể cũ mất điện, rạp chiếu bóng bỏ không, nhà kho bến tàu, trạm xá cũ cuối xã.
4. **Người thân giả mạo (*Doppelgänger*):** Giọng mẹ/bà gọi ra ăn cơm từ bếp tối, người anh đứng quay lưng ngoài ban công không bao giờ ngoái mặt, đứa em đứng chờ đầu ngõ dù đang ngủ trên gác.
5. **Bí mật gia đình / Luật sinh tồn:** Căn phòng luôn khóa của ông nội, cuốn sổ tay ghi quy tắc nhà mới thuê, tục lệ ăn cơm để thêm một đôi đũa mỗi dịp rằm tháng bảy.

---

## 4. Giọng Kể Điềm Tĩnh, Tự Nhiên & Phương Ngữ 3 Miền (`VieNeu-TTS 1.0x`)

- **Bỏ hoàn toàn quota ép chửi thề `1–3 lần/phút`:** Không nhồi nhét *"Mẹ kiếp"*, *"Bỏ mẹ rồi"* vào đầu/cuối mọi video. Giữ mặc định **`gritLevel: "clean_folklore"`** — giọng kể điềm tĩnh, chân thực, đối thoại đời thường đúng tính cách từng nhân vật.
- **Cấm văn mẫu AI:** Loại bỏ triệt để *"một cảm giác lạnh lẽo bao trùm"*, *"bất giác tôi nhận ra"*, *"không gian đặc quánh"*, *"tựa hồ như"*, *"tôi cảm thấy vô cùng kinh hãi"*. Tả nỗi sợ bằng phản ứng cơ thể thật (*cổ họng khô rát*, *tay cầm chìa khóa khựng lại*, *sống lưng lạnh dọc xuống*).
- **Đồng bộ phương ngữ 3 miền với giọng `VieNeu-TTS 1.0x`:**
  - **Miền Bắc (`north`):** *tôi – ông/bà/cô/chú; im thít, tối om, lạnh dọc sống lưng, khựng lại* (`Thiện Minh`, `Ngọc Linh`, `Thiền Tâm Đức`, `Trúc Ly`).
  - **Miền Trung (`central`):** *tui/tau – mệ/ôn/chú; răng, rứa, mô, tê, im bặt, lạnh thấu xương* (`Quang Sơn`, `Ngọc Trân`).
  - **Miền Nam / Miền Tây (`south`):** *tui – má/ngoại/chú Tư/dì Bảy; hồi nãy, thiệt tình, im re, tối thui, nổi da gà* (`Thái Sơn`, `Đức Trí`, `Thục Đoan`, `Mỹ Duyên`).
- **Nhịp nói điềm tĩnh, có độ thở tự nhiên (`pipeline_constitution.json` v15):**
  - Tốc độ tổng mục tiêu: **`2.35 từ/s`** (`~155–175 từ` cho video `65–75s`).
  - Tốc độ lúc đang nói: **`2.25 – 3.25 từ/s`** (mục tiêu **`2.75 từ/s`**).
  - Không ép mọi truyện phải có đồng hồ đứng kim, giọt nước nhỏ hay cảnh sập chốt cửa sắt (`requireAcousticMotif: false`, `requireOcclusionTrigger: false`) — chỉ dùng khi thực sự phục vụ cốt truyện.
- **Khóa Ngữ Nghĩa Hình – Lời (`storyboard_proof.html`):** Mọi vật chứng then chốt của Hook và Cú lật cuối phải có mặt trong `mustShow` và vượt qua kiểm định 5 lớp trước khi xuất video.
