# Hướng Dẫn Cài Đặt & Sử Dụng Chi Tiết — Horror 3D Short & Series (`v14.0`)

Tài liệu này hướng dẫn cài đặt trọn gói bộ kỹ năng **Horror Engine v14.0** (bao gồm `horror-3d-short` + 5 companion skills + 21 module Engine 3D + Pipeline Voice/Soundscape) và quy trình tạo một video kinh dị mới từ đầu đến file MP4 hoàn chỉnh.

---

## 1. Yêu Cầu Hệ Thống (`Prerequisites`)

- **Hệ điều hành:** Linux (Ubuntu/WSL2), macOS hoặc Windows 10/11 (PowerShell).
- **Node.js:** `>= 20.x` + `npm` (cho Three.js + Remotion render 3D).
- **Python:** `>= 3.10` + `pip`.
- **FFmpeg & FFprobe:** Đã cài trong `PATH` (`ffmpeg -version`, hỗ trợ bộ lọc `loudnorm`, `rubberband` càng tốt).
- **Tài nguyên khuyến nghị:**
  - Ổ cứng trống `>= 6–10 GB` cho model TTS/Whisper và thư mục tạm render.
  - Có GPU NVIDIA CUDA sẽ tăng tốc render Remotion (`angle-egl`) và Whisper alignment đáng kể (vẫn chạy được bằng CPU `swangle` khi không có GPU).

---

## 2. Cài Đặt Bộ Skills (`Installation`)

### Bước 1: Tải Repository Từ GitHub & Cài Vào Thư Mục Skills Của Agent

Chọn **1 trong 2 vị trí** cài đặt tùy nhu cầu dùng toàn cục (cho mọi project) hay cục bộ (chỉ 1 repo):

- **Cách A — Cài toàn cục (khuyên dùng cho Antigravity / Claude Code / Codex):**
  ```bash
  mkdir -p ~/.agents/skills
  git clone https://github.com/TunDuzz/tool-horror-3d-short.git ~/.agents/skills/horror-3d-short
  rm -rf ~/.agents/skills/horror-story ~/.agents/skills/horror-script-storyboard \
         ~/.agents/skills/horror-world-lookdev ~/.agents/skills/horror-audio-sfx \
         ~/.agents/skills/horror-series-pipeline
  cp -r ~/.agents/skills/horror-3d-short/companion-skills/* ~/.agents/skills/
  ```
- **Cách B — Cài cục bộ trong một dự án cụ thể:**
  ```bash
  mkdir -p .agents/skills
  git clone https://github.com/TunDuzz/tool-horror-3d-short.git .agents/skills/horror-3d-short
  cp -r .agents/skills/horror-3d-short/companion-skills/* .agents/skills/
  ```

> **Cập nhật bản mới nhất về sau:**
> ```bash
> cd ~/.agents/skills/horror-3d-short && git pull
> cp -r companion-skills/* ~/.agents/skills/
> ```

### Bước 2: Khởi Tạo Workspace Sản Xuất `shorts-project/`

Dùng `sync_workspace.py` để tạo (hoặc cập nhật an toàn) toàn bộ `scripts/`, `src/engine/`, `audio/`, `pipeline_constitution.json`, `GEMINI.md` và project demo `horror-lab-v3` mà **không bao giờ ghi đè** các dự án bạn đã làm:

```bash
python3 ~/.agents/skills/horror-3d-short/templates/scripts/sync_workspace.py \
  --target ./shorts-project \
  --include-demo \
  --gemini-out ./shorts-project/GEMINI.md

# Kiểm tra độ khớp 100% với templates/
python3 ~/.agents/skills/horror-3d-short/templates/scripts/sync_workspace.py \
  --target ./shorts-project --include-demo --check
```

### Bước 3: Cài Đặt Phụ Thuộc Node.js & Python

```bash
cd ./shorts-project

# 1. Node.js (Remotion, Three.js, React, Postprocessing)
npm install
npx tsc --noEmit

# 2. Python core (numpy, scipy, requests, Pillow...)
pip install -r requirements.txt

# 3. Neural Voice 48kHz offline (VieNeu-TTS) & Forced Word Alignment (faster-whisper)
pip install vieneu faster-whisper
```

### Bước 4: Khởi Tạo Ngân Hàng Cảm Xúc Thuần Việt & Thư Viện Foley CC0

Chạy **1 lần duy nhất** để dựng 8 mẫu sắc thái giọng thuần Việt (`calm`, `curious`, `uneasy`, `whisper`, `fear`, `dread`, `panic`, `cold_twist`) và tải sẵn bộ Foley sạch CC0 từ Openverse (không cần API key):

```bash
cd ./shorts-project

# 1. Xây dựng bộ emotion refs 48 kHz thuần Việt
python3 scripts/prepare_emotion_refs.py build-vn-horror-bank --out-dir audio/emotion_refs

# 2. Tải & kiểm định bộ starter CC0 Foley (48 kHz stereo, 0 clip)
python3 scripts/sfx_manager.py fetch-cc0-open --library audio/sfx_library
python3 scripts/sfx_manager.py analyze --library audio/sfx_library
python3 scripts/sfx_manager.py verify --library audio/sfx_library
```

---

## 3. Quy Trình Sản Xuất 1 Video Kinh Dị Mới Chuẩn `v14.0`

Bạn có thể gõ yêu cầu trực tiếp cho AI Agent (ví dụ: *"Làm video kinh dị ngắn 60s giọng Bắc về chiếc máy bàn cắt dây vẫn đổ chuông"*), hoặc tự chạy từng bước theo pipeline chuẩn sau:

### Bước 1 — Lên Kịch Bản & Kiểm Định 26 Cổng (`horror_story.py` v3.2)

- Chọn chế độ **`viral_short`** (`55–90s`, nhịp dồn dập, mở nút thắt mỗi `8–14s`) hoặc **`deep_story`** (`2.5–10 phút`, đa hồi/tập).
- Chọn giọng vùng miền (`north` | `central` | `south`) và độ thật ngôn ngữ (`platform_safe_raw` cho phép *"Mẹ kiếp"*, *"Chó chết"*, *"Bỏ mẹ rồi"*... đúng chuẩn kiểm duyệt nền tảng).

```bash
cd ./shorts-project
mkdir -p out/du-an-moi src/du-an-moi

# Tạo khung story.json v3.2
python3 scripts/horror_story.py seed \
  --title "Tên Truyện" \
  --format micro --total-sec 65 \
  --pacing-profile viral_short \
  --dialect north \
  --grit-level platform_safe_raw \
  --out out/du-an-moi/story.json

# Sau khi hoàn thiện nội dung story.json: kiểm tra 26/26 cổng (bao gồm Gate 26 Hook 1-5s & Khẩu ngữ)
python3 scripts/horror_story.py validate out/du-an-moi/story.json --stage full --strict-story

# Xuất HTML Bible (Tension Curve SVG + 2D Floorplan) & khung blueprint
python3 scripts/horror_story.py html out/du-an-moi/story.json --out out/du-an-moi/story-report.html
python3 scripts/horror_story.py export-blueprint out/du-an-moi/story.json \
  --project-id du-an-moi --out out/du-an-moi/blueprint
```

### Bước 2 — Hoàn Thiện `SCRIPT.md` Chuẩn Cold Hook `0.05s`

Tham khảo mẫu chuẩn tại [examples/may-noi-bo-204-v14/SCRIPT_v14.md](./examples/may-noi-bo-204-v14/SCRIPT_v14.md):
- **Không** đặt `[VISUAL 2.60s]` hay kể năm tháng/thời tiết ở đầu file.
- Đánh thẳng vào biến cố bằng câu đầu `<= 24 từ` ngay `0.05–0.25s`.
- Dùng `[BEAT 0.20s..0.35s]` để ngắt nhịp đắt giá và `[SILENCE_DROP 1.10s..1.40s]` trước thoại thì thầm sát tai `[PROX=close]`.
- Nhân vật phụ dùng `[SPEAKER: TÊN | profile=elder_female_north | mood=tense | fx=room|phone|adjacent_muffled]`.

### Bước 3 — Tổng Hợp Giọng Đọc & Căn Khớp Từng Từ (`< 35ms`)

```bash
python3 scripts/gen_horror_voice.py \
  --script out/du-an-moi/SCRIPT.md \
  --tts-engine vieneu \
  --speaker-lock \
  --word-aligner auto \
  --strict-hook \
  --out-dir out/du-an-moi/voice \
  --no-vc
```
*Kiểm tra log: `first_word <= 0.45s` (không có `[HOOK WARN]`), tốc độ nói `3.10–3.55 w/s` (`<= 3.65 w/s`), tốc độ hiệu dụng `2.55–3.05 w/s`.*

### Bước 4 — Tìm Thêm Foley CC0 (Nếu Cần) & Mix Âm Thanh `-16.0 LUFS` (`mix_cues.py --strict`)

```bash
# Tìm & tải thêm SFX thực tế từ Openverse CC0
python3 scripts/sfx_manager.py search-openverse --query "old telephone ring" --fresh --library audio/sfx_library
python3 scripts/sfx_manager.py fetch-openverse --id <UUID> --name old_phone_ring --category tension --library audio/sfx_library

# Mix giọng + 2 lớp nền (near/far có automation lọc trầm) + motif lặp + [SILENCE_DROP] (0 Jumpscare mặc định)
python3 scripts/mix_cues.py \
  --cues out/du-an-moi/cues.json \
  --out out/du-an-moi/audio/mix.wav \
  --strict
```
Kiểm tra `out/du-an-moi/audio/mix_report.md`: `I = -16.0 LUFS`, `LRA >= 6.5 LU`, `TP <= -1.2 dBTP`, `0` clips, `0` warnings.

### Bước 5 — Khóa Khung Hình `SceneManifest`, Dựng Cảnh 3D & Kiểm Duyệt 5 Tầng

```bash
# 1. Tự động khóa frame bắn cảnh + phụ đề 4-8 từ vào voice/words.json
python3 scripts/align_manifest.py src/du-an-moi/manifest.json --words out/du-an-moi/voice/words.json --in-place

# 2. Kiểm tra chặt cinema (cold_hook -> master, trục 180°, không lặp bối cảnh/quái vật) & retention
python3 scripts/validate_manifest.py src/du-an-moi/manifest.json \
  --script out/du-an-moi/SCRIPT.md \
  --words out/du-an-moi/voice/words.json \
  --cues out/du-an-moi/cues.json \
  --strict-cinema --strict-retention \
  --registry out/du-an-moi/LOCATION_REGISTRY.json \
  --update-registry \
  --still-out out/du-an-moi/still_manifest.json

# 3. Kiểm tra TypeScript sau khi viết build.ts / story.ts / world.ts / index.tsx & đăng ký Root.tsx
npx tsc --noEmit

# 4. BẮT BUỘC: Chụp & kiểm định 5 lớp tất cả keyframe 3D trước khi render video!
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs DuAnMoi out/du-an-moi/stills/s_ \
  --manifest out/du-an-moi/still_manifest.json --scale 0.75 --strict-audit
```
Mở `out/du-an-moi/stills/storyboard_proof.html` (và từng ảnh `.jpg`) kiểm tra 100% vật thể `mustShow` rõ nét, đúng lời thoại, không bị che khuất hay lóa sáng.

### Bước 6 — Render Video MP4, Ghép Audio & QA Tự Động

```bash
# 1. Render hình 3D Full HD (chỉ dùng --scale 1, 1.25 hoặc 1.5; đặt REMOTION_TMP để tránh đầy đĩa)
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-video.mjs DuAnMoi out/du-an-moi/video.mp4 --scale 1

# 2. Ghép âm thanh chuẩn 48kHz AAC
ffmpeg -y -i out/du-an-moi/video.mp4 -i out/du-an-moi/audio/mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest \
  out/du-an-moi/final.mp4

# 3. Trích bảng cảnh & chạy kiểm định QA hậu kỳ
python3 scripts/extract_shots.py src/du-an-moi/story.ts out/du-an-moi/shots.json
python3 scripts/short_qa.py out/du-an-moi/final.mp4 out/du-an-moi/qa --shots out/du-an-moi/shots.json

# 4. Dọn file tạm Remotion nếu còn sót
rm -rf /tmp/remotion-tmp
```

---

## 4. Chạy Bộ Kiểm Thử Toàn Hệ Thống (`Automated Test Suite`)

Tại thư mục gốc của repository (`tool-horror-3d-short/`):

```bash
# Kiểm thử Python (Constitution v14, Gate 26, Cold Hook, Voice tempo, Soundscape DSP, Pipeline Sync)
python3 -m unittest discover -s tests -v

# Kiểm thử TypeScript Engine 3D (Camera, Lights, POV Rig, Stage Solver, SceneAudit)
node --import ./tests/ts-loader.mjs --test tests/*.test.ts

# Kiểm tra type workspace
(cd shorts-project && npx tsc --noEmit)
```

---

## 5. Xử Lý Các Lỗi Thường Gặp (`Troubleshooting`)

| Lỗi gặp phải | Nguyên nhân & Cách khắc phục |
|---|---|
| `RETENTION_DEAD_AIR_ERROR` / `[HOOK WARN]` | Có `[VISUAL Xs]` ở đầu `SCRIPT.md` hoặc chữ đầu bắt đầu sau `0.45s`. Xóa `[VISUAL]` mở đầu để vào Hook ngay `0.05–0.25s`. |
| `MASTER_ESTABLISHING_ERROR` | Shot #1 đang đặt `cold_hook` nhưng Shot #2 không phải `master` (`>= 60f`). Đảm bảo Shot #1 = `cold_hook` (`<= 180f`) nối ngay Shot #2 = `master`. |
| `ANTI_REPEAT_ERROR` / `ANTI_REPEAT_ENTITY_ERROR` | Đang dùng trùng bối cảnh hoặc tạo hình thực thể với dự án trước đó trong `LOCATION_REGISTRY.json`. Thiết kế kiến trúc/đạo cụ mới hoặc khai báo `"sameLocationOf"` / `"sameCharacterOf"` nếu quay lại bối cảnh cũ có chủ đích. |
| `Dimension Error` khi render `9:16` | Chỉ dùng `--scale 0.5`, `1`, `1.25`, hoặc `1.5` (tuyệt đối không dùng `--scale 1.3333` gây kích thước lẻ cho H.264). |
| Lỗi `extract_shots.py` khi parse `story.ts` | Không dùng toán tử JS `?.` hoặc `??` trong biểu thức số học của `OVERLAYS` / `SHOTS`; tách biến tường minh trước. |
| Đĩa `/` bị đầy sau khi render nhiều | Xóa `/tmp/remotion-tmp` và các file `video.mp4` trung gian sau khi đã mux `final.mp4`. |
