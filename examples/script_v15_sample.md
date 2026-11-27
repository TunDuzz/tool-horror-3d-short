# Mẫu Kịch Bản Chuẩn v15 (`~70s` · `VieNeu-TTS 1.0x` Sạch · 3-Act Score)

- **Tiêu đề:** Đôi Dép Úp Trước Bậu Cửa
- **Mô-típ luân phiên:** Mô-típ 2 *(Điều kiêng kỵ dân gian đời thường)* + Mô-típ 4 *(Người thân giả mạo — Doppelgänger)*
- **Phương ngữ & Giọng đọc:** Miền Bắc (`north`) · **`VieNeu-TTS` miễn phí tốc độ gốc `1.0x` sạch** (`--tts-engine vieneu --ref-audio <sample_5_8s.wav>`, 0% kéo tempo / bóp pitch / dịch F0, không dùng thẻ bóp tốc độ hay cao độ trong lời thoại)
- **Thời lượng mục tiêu:** `~68–74 giây` (~`168` từ nói · tốc độ tổng `~2.35 từ/s`, tốc độ khi nói `~2.75 từ/s`)
- **Thực thể chính:** Bậc 6 *(cổ vặn ngược 180°, nụ cười kéo dài bất thường, không máu me thô thiển)*

---

## BƯỚC 1: BẢN THẢO SÁNG TÁC SẠCH (0 Thẻ Kỹ Thuật)

> Hoàn thiện trọn vẹn câu chuyện đời thật giàu cảm xúc trước khi gắn bất kỳ thẻ đạo diễn nào.

Người già hay dặn: đêm về thấy đôi dép tự úp ngược trước bậu cửa, tuyệt đối đừng gọi người ở trong.

Tối thứ sáu tôi tan ca muộn, cố chạy xe dưới mưa về ăn bát canh cua bà ngoại giữ ấm từ chiều. Lần nào tôi về trễ, bà cũng bật sẵn bóng đèn vàng ngoài bếp chờ.

Đẩy cửa vào nhà, tôi thấy đôi dép nhựa xanh của bà úp ngược ngay trước bậu cửa buồng. Tôi cười thầm, chắc bà quét nhà xong quên lật lại, rồi nghe tiếng bà gọi vọng từ bếp sau:

"Vào ăn đi con, canh nguội hết bây giờ."

Nhưng bước tới cửa bếp, sống lưng tôi lạnh toát. Nồi canh trên bàn nguội ngắt từ bao giờ, chẳng còn lấy một vệt khói. Còn trong góc tối, một bóng người cao bất thường đang quay lưng lại, cứ lặp đều câu gọi ấy không lệch đi nửa nhịp.

Tiếng mưa ngoài ngõ bỗng im bặt. Cái bóng ấy từ từ vặn ngược cổ lại, nhe nụ cười kéo dài tận mang tai nhìn thẳng tôi.

Đúng lúc điện thoại trong túi rung lên tin nhắn mẹ gửi từ chiều: "Bà nhập viện cấp cứu lúc bốn giờ rồi, tối nay con đừng về nhà."

---

## BƯỚC 2: BẢN ĐẠO DIỄN `SCRIPT.md` (Sẵn Sàng Cho `VieNeu-TTS 1.0x` + `mix_cues.py`)

```markdown
[NARRATOR | mood=calm_omen]
Người già hay dặn: đêm về thấy đôi dép tự úp ngược trước bậu cửa, tuyệt đối đừng gọi người ở trong.

[BEAT 0.35s]

[NARRATOR | mood=calm_omen]
Tối thứ sáu tôi tan ca muộn, cố chạy xe dưới mưa về ăn bát canh cua bà ngoại giữ ấm từ chiều. Lần nào tôi về trễ, bà cũng bật sẵn bóng đèn vàng ngoài bếp chờ.

[VISUAL 1.00s]

[NARRATOR | mood=curious]
Đẩy cửa vào nhà, tôi thấy đôi dép nhựa xanh của bà úp ngược ngay trước bậu cửa buồng. Tôi cười thầm, chắc bà quét nhà xong quên lật lại, rồi nghe tiếng bà gọi vọng từ bếp sau:

[SPEAKER: GIỌNG TRONG BẾP | profile=elder_female_north | mood=calm_omen | fx=adjacent_muffled]
Vào ăn đi con, canh nguội hết bây giờ.

[VISUAL 0.85s]

[NARRATOR | mood=uneasy]
Nhưng bước tới cửa bếp, sống lưng tôi lạnh toát. Nồi canh trên bàn nguội ngắt từ bao giờ, chẳng còn lấy một vệt khói. Còn trong góc tối, một bóng người cao bất thường đang quay lưng lại, cứ lặp đều câu gọi ấy không lệch đi nửa nhịp.

[SILENCE_DROP 0.90s]

[NARRATOR | mood=fear | prox=close]
Tiếng mưa ngoài ngõ bỗng im bặt... [thở dài] Cái bóng ấy từ từ vặn ngược cổ lại, nhe nụ cười kéo dài tận mang tai nhìn thẳng tôi.

[VISUAL 1.40s]

[NARRATOR | mood=cold_twist | prox=close]
Đúng lúc điện thoại trong túi rung lên tin nhắn mẹ gửi từ chiều: Bà nhập viện cấp cứu lúc bốn giờ rồi, tối nay con đừng về nhà.

[VISUAL 1.80s]
```

---

## BẢN ĐỒ PHỐI ÂM 3 HỒI & JUMPSCARE 3 NHỊP (`cues.json` Gợi Ý)

- **Hồi 1 (`0–22s` · Thiết lập & Lõi cảm xúc):** `music_arc.act1` = `sad_piano_minimal` (`audio/sfx_curated/sad_piano/`, `-27.5 dBFS`) + mưa đêm nhẹ ngoài ngõ (`-35 dBFS`), tự động ducking `-8.5 dB` khi `VieNeu-TTS` đọc.
- **Hồi 2 (`22–49s` · Nghi ngờ → Xâm lấn):** Crossfade `1.6s` sang `music_arc.act2` = `dark_drone_pressure` (`audio/sfx_curated/dark_drone/`, `-24.5 dBFS`); thêm foley bát chạm bàn (`ceramic_bowl_clink`) tải tự động từ Openverse.
- **Khoảng lặng & Jumpscare 3 nhịp (`49–54s`):**
  1. Nền trầm `dark_drone_pressure` dâng nhẹ `1.35s` trước điểm rút im lặng.
  2. `[SILENCE_DROP 0.90s]` kéo sạch cả nhạc nền lẫn tiếng mưa xuống **`-48 dB`**.
  3. Đúng khung hình cổ vặn ngược (`at_silence_drop: 0, edge: "end"`): nổ stinger thu thật (`audio/sfx_curated/stinger/`, dây violin rít + `cinematic_boom`) chốt trần **`-1.0 dBTP`**.
- **Hồi kết (`56–72s` · Dư âm):** `music_arc.aftermath` = `cold_sub_drone_tail` (`-28.0 dBFS`), kèm tiếng rung tin nhắn điện thoại khô khốc ngay trước câu chốt cuối.
