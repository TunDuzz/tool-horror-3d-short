# Công Thức Kịch Bản Kinh Dị Giữ Chân Cao v14.0 (`HORROR_FORMULAS.md` · 1–5s Hook & Khẩu Ngữ 3 Miền)

Mọi công thức dưới đây tuân thủ chuẩn **Engine v14.0**:
- **Không dạo đầu thời tiết / không chèn `[VISUAL]` im lặng ở `0.0s`:** Thoại và tiếng động thực địa nổ ngay ở **`0.05s – 0.25s`** trên `Shot 1` (`cameraMode: "cold_hook"`), sau đó mới mở rộng sang `Shot 2` (`cameraMode: "master"`).
- **Nhịp giọng gọn sắc (`2.55–3.05 từ/s` tổng · `3.15–3.45 từ/s` khi nói):** Khẩu ngữ truyền miệng đời thật theo phương ngữ `Bắc – Trung – Nam`, dùng từ cảm thán mạnh đúng tâm lý (`platform_safe_raw`: *"Mẹ kiếp"*, *"Chết tiệt"*, *"Bỏ mẹ rồi"*, *"Má ơi"*, *"Khỉ gió"*), mặc định **`0` Jumpscare**.

---

## Công Thức 1: Tâm Linh Dân Gian Truyền Miệng (`dialectRegion: "south"` hoặc `"north"`)

**Chất liệu ăn khách:** Đò ngang mùa nước nổi, nhà ngoại dưới quê, bàn thờ Ông Thiên, tiếng gọi tên ngoài hàng rào dâm bụt sau 1 giờ khuya, lời dặn sống còn của người già.
**Ánh sáng vật lý:** `warmLamp` (đèn dầu / bàn thờ) → `duskFog` (hiên mưa) → `coldMoon` (đèn tắt / phạm kỵ).

### Khung `viral_short` `60–75s` (~165–185 từ · Mặc định `0` Jumpscare)
1. **`0.0–4.5s` Cold Hook (`cold_hook`, `mood=tense`, nổ ngay `0.1s`):**
   *"Má ơi nghĩ lại còn lạnh xương sống tụi bây ơi... Ông Tư gác bến chỉ thẳng mặt tui dặn: Sau một giờ khuya nghe ai kêu tên ngoài mé sông, có là giọng má mày cũng câm cái miệng lại, đừng có thưa!"*
2. **`4.5–13s` Snap Context (`master`, `mood=calm_omen`):**
   `1–2` câu gọn khóa lý do kẹt lại (*đường đất ngập lút đầu gối, phải ráng gác hết đêm lấy tiền viện phí*) + toàn cảnh quầy gỗ và sông nước.
3. **`13–28s` Giao Ca & Vật Chứng Lạ (`ots_same_side` → `pov_interact`, `mood=uneasy`):**
   Ông Tư dúi vội tờ giấy giao ca ướt nhẹp mùi bùn non rồi lội biến vào mưa, đánh rơi cả cái quẹt gas mà không thèm cúi nhặt.
4. **`28–45s` Cài Chốt & Âm Lặp Đếm Nhịp (`pov_interact` → `pov_turn`, `mood=curious`):**
   Nhân vật sập chốt sắt (tiếng mưa ngoài hiên lập tức đục trầm lại `lp=560 Hz`). Tiếng giọt nước dột từ mái tôn gõ đều lên mặt bàn... rồi tiến dần về phía gáy (`mode: "approach"`).
5. **`45–55s` Đứt Nhịp & Khoảng Lặng Tâm Lý (`[SILENCE_DROP 1.25s]`):**
   Giọt nước thứ ba mươi bỗng tắt phựt. Cả bến phà im re. Giữa khoảng lặng, một hơi thở lạnh buốt lướt sát vành tai phải (`close_ear`) kèm tiếng gọi khẽ bên kia tấm kính mờ.
6. **`55–68s` Cú Lật Vật Chứng Sắc Lạnh (`POV_CU`, `mood=cold_twist`, `prox=close`):**
   *"Chết tiệt... lúc tui cúi xuống nhìn tờ giấy ông Tư đưa hồi nãy, đó không phải biên nhận giao ca... mà là biên bản vớt xác dưới bến phà đêm hôm qua, dòng cuối cùng ghi đúng tên tui còn nhòe nước sông."*

---

## Công Thức 2: Kinh Dị Quy Tắc / Ca Trực Đêm Đô Thị (`dialectRegion: "north"`)

**Chất liệu ăn khách:** Khu nội trú cũ, chung cư sắp giải tỏa, nhà xác bệnh viện, bảo vệ ca đêm, điện thoại nội bộ / thang máy / phòng niêm phong.
**Ánh sáng vật lý:** `fluorescent` (đèn tuýp xanh xao + đèn bàn chụp sắt) → `coldMoon` / `flashlight`.

### Khung `viral_short` `60–70s` (~160–180 từ · Mặc định `0` Jumpscare)
1. **`0.0–4.5s` Cold Hook (`cold_hook`, `mood=tense`, kèm tiếng chuông cụt `0.1s`):**
   *"Mẹ kiếp... cái điện thoại bàn trước mặt tôi vừa đổ chuông, dù sợi dây đồng dưới gầm bàn đã bị cắt đứt từ ba tháng trước."*
2. **`4.5–13s` Snap Context (`master`, `mood=calm_omen`):**
   Nhận trực thế ca đêm lấy ba trăm nghìn ở khu nội trú B2 sắp đập bỏ, ngoài hành lang gió mùa rít lạnh buốt.
3. **`13–28s` Lời Dặn Gắt Của Người Đi Trước (`ots_same_side` → `pov`, `SPEAKER: BÀ HẠNH`):**
   *"Này, khóa chết cái chốt sắt vào! Máy bàn cắt dây từ đợt niêm phong phòng hai lẻ bốn rồi, khuya nó có chập mạch kêu cạch cái nào thì mặc xác nó, cấm được nhấc!"*
4. **`28–44s` Khóa Cửa & Đồng Hồ Đứng Kim (`pov_interact` → `pov_turn`, `mood=uneasy`):**
   Kéo chốt đồng (tiếng gió đục đi ngay lập tức). Tiếng đồng hồ quả lắc trên tường vôi tích tắc chậm dần... rồi khựng chết đứng đúng `02:15`. Máy bàn nảy lên một hồi chuông cụt lủn.
5. **`44–54s` `[SILENCE_DROP 1.25s]` & Tiếng Thì Thầm Trong Ống Nghe (`fx=phone | prox=close`):**
   Theo phản xạ nhấc ống nghe áp lên tai giữa khoảng lặng đặc quánh: *"Phòng hai lẻ bốn... đứa nào khóa ngoài rồi anh ơi..."*
6. **`54–66s` Cú Lật Kép Dưới Sàn & Trên Bảng Khóa (`POV_CU`, `mood=cold_twist`):**
   *"Bỏ mẹ rồi... tôi nhìn xuống chân tường thì đầu dây đồng đứt lìa đóng dày bụi trắng... còn ngước lên bảng gỗ trước mặt, riêng chiếc thẻ đỏ phòng hai lẻ bốn vẫn đang tự đung đưa."*

---

## Công Thức 3: Chuyện Có Thật / Dị Văn Đường Đèo & Biển Đêm (`dialectRegion: "central"`)

**Chất liệu ăn khách:** Xe tải đường dài qua đèo khuya, trạm kiểm lâm, tàu cá trôi dạt, nhật ký ca trực có mốc giờ cụ thể.
**Ánh sáng vật lý:** `duskFog` → `flashlight` → `coldMoon`.

### Khung `viral_short` `60–75s` (~165–185 từ)
1. **`0.0–4.5s` Cold Hook (`cold_hook`, `raw_confession`):**
   *"Khỉ gió thiệt chớ, tau chạy xe tải Bắc Nam mười hai năm trời, chưa bao giờ gặp cảnh mô lạnh gáy như chuyến qua đèo Hải Vân lúc hai giờ sáng hôm nớ..."*
2. **`4.5–15s` Snap Context (`master`):** Xe hỏng phanh hơi ngay khúc cua miếu hoang giữa sương mù đặc quánh, sóng điện thoại mất sạch.
3. **`15–45s` Leo Thang 3 Nhịp (`10s / nhịp`):** Đèn pha quét trúng bóng người vẫy xe không áo mưa → tiếng gõ đều đặn dưới gầm thùng xe (`motifs[]`) → gõ tới nhịp thứ tư bỗng dừng hẳn ngay dưới ghế phụ.
4. **`45–68s` `[SILENCE_DROP]` & Cú Lật Vật Chứng:** Sáng ra thợ máy chui xuống gầm xe tái mặt đưa lên mảnh vải áo bà ba kẹt cứng trong trục láp — trùng khít tấm ảnh trên bia đá cái miếu đổ nát cách đó hai cây số.

---

## Công Thức Đa Chương `deep_story` (`2.5–6 Phút` Short & `8–15 Phút` Series)

Xem chi tiết **Đường cong Răng cưa (Sawtooth Dread Curve)** trong `companion-skills/horror-story/references/STORYTELLING_CRAFT.md`:
- **Chương 1 (`P01`):** Bắt buộc mở bằng **Cold Hook `0.1–5.0s`** (`flash_forward_crisis` hoặc `raw_confession`), sau đó mới lùi lại cài `trappedReason` và manh mối `CL01`.
- **Chương `P02..PNN`:** Nếu `seamlessStitch: true` (ghép thành 1 phim dài), nối thẳng hành động không lặp lại intro; nếu đăng tách tập TikTok/Reels, mở đầu mỗi tập bằng **Micro-Hook `3 giây`** (*"Ngay giây phút tôi vừa lật tấm ván sàn lên, thứ nằm bên dưới làm tôi cứng đờ..."*) và kết tập ngay trên câu hỏi bỏ lửng!
