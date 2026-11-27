# Thư Mục Mẫu Cử Động Kinh Dị Cho `KlingAIResearch/LivePortrait` (`assets/liveportrait_motions/`)

Đặt sẵn 3–4 file mẫu cử động dạng **`.pkl`** (ưu tiên vì chạy nhanh hơn 2–3× trên GTX 960 do bỏ qua bước tách chuyển động từ video) hoặc **`.mp4`** tại đây để `scripts/gen_jumpscare_clip.py` tự động chọn khớp với `scareTier` và `transitionStyle`:

| Tên file đề xuất | Kích hoạt tự động khi | Chuyển động khuyên quay (2–3 giây) |
|---|---|---|
| `creepy_smile.pkl` | `scareTier == 5` (hoặc mặc định) | Mặt vô cảm rồi nhếch cười kéo dài & mở to mắt |
| `neck_snap_stare.pkl` | `scareTier == 6` hoặc `whip_pan_turn` | Giữ yên thân, giật nghiêng cổ sắc sang một bên rồi nhìn chằm chằm |
| `wide_eye_lunge.pkl` | `scareTier == 7` hoặc `silence_hard_cut` | Trừng mắt cực đại, há hàm và lao mạnh sát ống kính |
| `head_tilt_stare.pkl` | `scareTier == 4` hoặc `diegetic_reveal` | Nghiêng đầu chậm rồi trừng mắt bất ngờ |

Nếu thư mục này chưa có file nào, `gen_jumpscare_clip.py` sẽ tự động dùng mẫu có sẵn trong `<LIVEPORTRAIT_DIR>/assets/examples/driving/`. Xem hướng dẫn cài đặt GTX 960 và tạo file `.pkl` tại `INSTALL_GUIDE.md` mục **2B**.
