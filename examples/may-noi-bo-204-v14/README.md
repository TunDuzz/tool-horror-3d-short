# Ví Dụ Mẫu v14.0: *Máy Nội Bộ 204* (`Viral Cold Hook · Oral Folklore`)

Thư mục này lưu giữ bản thiết kế nhẹ (không kèm file nhị phân `.mp4`/`.wav` dung lượng lớn) của ca dựng thử nghiệm **v14.0**:

- [SCRIPT_v14.md](./SCRIPT_v14.md) — Kịch bản khẩu ngữ miền Bắc vào thẳng Cold Hook lúc `0.05s` (`Mẹ kiếp... cái máy bàn cắt đứt dây từ năm ngoái, sao nửa đêm lại đổ chuông?`), không mở đầu thời tiết/năm tháng, nhịp giữ chân chặt (`57.83s` voice).
- [cues_v14.json](./cues_v14.json) — Kịch bản âm thanh tâm lý (`2` lớp nền `near` + `far` tự lọc trầm `520 Hz` khi đóng chốt, đồng hồ quả lắc `decelerate` đứt nhịp tại `02:15`, chuông mở màn `0.14s`, khoảng lặng `[SILENCE_DROP]` + hơi thở `close_ear`, `0` Jumpscare).
- [mix_report_v14.md](./mix_report_v14.md) — Báo cáo thực đo (`58.28s`, `I = -16.01 LUFS`, `LRA = 7.01 LU`, `TP = -1.20 dBTP`, `0` clips, `0` warnings).
- [src/](./src/) — Bộ mã nguồn 3D hoàn chỉnh (`manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx`) để copy vào `shorts-project/src/may-noi-bo-204/` khi muốn render lại video.
