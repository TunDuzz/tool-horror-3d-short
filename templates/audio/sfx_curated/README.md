# Kho SFX & Nhạc Nền Tuyển Chọn Cục Bộ (`audio/sfx_curated/`)

Thư mục này được **`sfx_manager.py auto-fetch-for-script`** và **`mix_base.py` (`load_sfx_asset`)** **ưu tiên tìm kiếm TRƯỚC** `audio/sfx_library/` và **TRƯỚC** Openverse CC0 để đảm bảo chất lượng nhạc nền & stinger luôn đồng đều, đậm chất điện ảnh.

## 4 Nhóm Thư Mục Chuẩn

| Thư mục con | Mục đích | Gợi ý nguồn sạch (CC0 / tự thu / bản quyền sở hữu) |
|---|---|---|
| `dark_drone/` | Nhạc nền Hồi 2 (áp lực tăng dần), Hồi kết dư âm lạnh, và `pre_swell_sound` trước Jumpscare | Sub-bass drone 40–90 Hz, dark ambient cello/synth pad không giai điệu rối |
| `sad_piano/` | Nhạc nền Hồi 1 (cảm xúc con người, ký ức gia đình, mở đầu điềm tĩnh) | Piano trầm chậm tối giản, ít nốt, nhiều khoảng thở để không đè giọng `VieNeu-TTS` |
| `stinger/` | Đỉnh Jumpscare thu thật (nhịp 3) | Dây violin/cello kéo rít thật, va đập kim loại lớn, sub-bass boom điện ảnh |
| `ambience/` | Không gian môi trường chất lượng cao tái sử dụng sạch | Mưa đêm êm, room-tone nhà cũ, gió đêm xa không tạp âm rè |

## Cách Sử Dụng

1. Thả file `.wav` (hoặc `.flac`/`.mp3`/`.ogg`) chất lượng cao vào đúng nhóm thư mục con tương ứng.
2. Khi chạy:
   ```bash
   python3 scripts/sfx_manager.py auto-fetch-for-script \
     --cues out/<project>/cues.json \
     --library shorts-project/audio/sfx_library \
     --curated-dir shorts-project/audio/sfx_curated
   ```
   - Mọi cue thuộc `scoreBeds`/`music_arc`, `stinger`, `beds` sẽ tự động khớp file trong `audio/sfx_curated/` trước.
   - Các tiếng foley đặc thù theo từng kịch bản (bước chân, tiếng gõ cửa, tiếng bát đũa...) không có bản khớp tên chính xác trong `sfx_curated/` sẽ tự động tìm tải trên **Openverse CC0** và đi qua bộ lọc chất lượng (`>= 0.4s` cho bed/drone/score, chặn clipping nặng, chặn file gần im lặng).
