# Báo Cáo Không Gian Âm Thanh Tâm Lý (`mix_report.md` — PASS)

- **File xuất:** [mix.wav](file:///home/thanh2323/horror/tool-horror-3d-short/shorts-project/out/may-noi-bo-204/audio_v14/mix.wav) (`58.28s` · `48 kHz stereo`)
- **Kịch bản cue:** [cues_v14.json](file:///home/thanh2323/horror/tool-horror-3d-short/shorts-project/out/may-noi-bo-204/cues_v14.json)
- **Bản quyền nguồn:** [credits.txt](file:///home/thanh2323/horror/tool-horror-3d-short/shorts-project/out/may-noi-bo-204/audio_v14/credits.txt)
- **Loudness & Độ động thực đo:** `I = -16.01 LUFS` · `TP = -1.20 dBTP` · `LRA = 7.01 LU` · `clips = 0`
- **Lớp nền (Beds):** `2` · **Motif lặp:** `1` · **SFX điểm:** `7` · **Jumpscare:** `0`

## Cổng Kiểm Định Không Gian Âm Thanh & Kỷ Luật Chống Rối
- **PASS:** `0` lỗi chồng nền, `0` lỗi crowding, `0` lỗi đè hồi thì thầm, `0` lạm dụng Jumpscare, `0` clips!

## Âm Thanh Lặp & Phá Vỡ Quy Luật (`Motifs`)
- **`m_pendulum_clock` (`clock_ticking` · `decelerate`)**: `4.80s .. 35.89s` (`22` nhịp, nhịp cuối tại `34.33s`) — Đồng hồ quả lắc tường trái đếm nhịp rồi chậm dần và chết đứng đúng lúc 02:15

## Khoảng Lặng Tâm Lý (`[SILENCE_DROP]` — Uncanny Hush)
- `[40.38s .. 41.63s]`: nền môi trường hạ từ `-38.8 dBFS` xuống `-76.2 dBFS` (**giảm `37.3 dB`**).

## 5 Mốc Thời Gian Tâm Lý Đề Xuất Đeo Tai Nghe Kiểm Tra
- **`00.14s`** — `Một hồi chuông ngắn chói ngay 0.14s mở màn đánh thức sự chú ý cùng Cold Hook` (mốc `0.14s`, không gian `room`, peak `-9.0 dBFS`)
- **`15.64s`** — **Chuyển trạng thái nền:** Nền `wind_howl_night` chuyển trạng thái (`-6.5 dB`, `lp=520 Hz`)
- **`33.13s`** — **Điểm đứt nhịp Motif `m_pendulum_clock` (`decelerate`):** nhịp cuối tại `34.33s` — Đồng hồ quả lắc tường trái đếm nhịp rồi chậm dần và chết đứng đúng lúc 02:15
- **`39.98s`** — **Khoảng lặng tâm lý (`40.38s..41.63s`):** môi trường rút êm `-37.3 dB` kích thích người nghe lắng tai
- **`41.63s`** — **Thoại hạ giọng sát tai (`41.63s..45.45s`):** kiểm tra nền tự lùi sâu và độ gần của hơi thở/ngữ điệu

## Bảng Chi Tiết Toàn Bộ Cue Đã Phối
| # | Bus · Không gian | Âm thanh | Mốc đích | Điểm phát | Căn (`align`) | Gain · Pan | Mô tả |
|---|---|---|---|---|---|---|---|
| 1 | `sfx` · `room` | `old_phone_ring` | `0.14s` | `0.12s` | `onset` (-0.03s) | peak `-9.0 dBFS` · pan `0.16` | Một hồi chuông ngắn chói ngay 0.14s mở màn đánh thức sự chú ý cùng Cold Hook |
| 2 | `sfx` · `adjacent_muffled` | `wood_footsteps_slow` | `14.13s` | `14.10s` | `onset` (-0.03s) | peak `-12.0 dBFS` · pan `0.22→-0.78` | Tiếng bước chân Bà Hạnh xa dần ngoài hành lang gạch bông |
| 3 | `sfx` · `room` | `door_bolt_latch` | `16.10s` | `16.06s` | `onset` (-0.04s) | peak `-6.2 dBFS` · pan `0.34` | Tiếng chốt sắt cửa hành lang sập khóa |
| 4 | `sfx` · `adjacent_muffled` | `synth:wood_settle_subtle` | `32.66s` | `32.66s` | `onset` (-0.00s) | peak `-20.5 dBFS` · pan `0.42` | Khung gỗ hành lang kẽo kẹt khẽ ngay trước mốc 02:15 |
| 5 | `sfx` · `room` | `old_phone_ring` | `39.28s` | `39.26s` | `onset` (-0.03s) | peak `-7.5 dBFS` · pan `0.14` | Điện thoại đen cắt dây nảy lên đúng một hồi chuông cụt lủn lúc 02:15 |
| 6 | `sfx` · `close_ear` | `synth:breath_close_ear` | `40.63s` | `40.63s` | `onset` (-0.00s) | peak `-21.0 dBFS` · pan `0.56→0.78` | Hơi thở sát tai phải giữa khoảng lặng [SILENCE_DROP] |
| 7 | `score` · `otherworld` | `cello_dread_sting` | `50.13s` | `50.12s` | `onset` (-0.01s) | peak `-15.8 dBFS` · pan `0.0` | Âm trầm u tịch dưới sợi dây điện thoại cắt đứt phủ bụi và chìa khóa 204 lắc lư |
