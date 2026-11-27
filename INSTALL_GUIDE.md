# Hướng Dẫn Cài Đặt & Sử Dụng Chi Tiết — Horror 3D Short & Series (`v15.5`)

Tài liệu này hướng dẫn cài đặt trọn gói bộ kỹ năng **Horror Engine v15.5** (bao gồm `horror-3d-short` + 5 companion skills + 22 module Engine 3D/2.5D + `KlingAIResearch/LivePortrait` cục bộ tối ưu cho **GTX 960 / 960M `4–6GB VRAM`** + Pipeline `VieNeu-TTS 1.0x` & âm thanh linh hoạt theo kịch bản `audioDirection`) và quy trình tạo một video kinh dị mới từ đầu đến file MP4 hoàn chỉnh.

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

## 2B. Cài Đặt `KlingAIResearch/LivePortrait` Cho GPU GTX 960 / 960M (`4–6GB VRAM`, Windows & Linux)

Engine v15.5 tích hợp hoàn toàn tự động bản gốc chính chủ **[KlingAIResearch/LivePortrait](https://github.com/KlingAIResearch/LivePortrait)** *(tuyệt đối KHÔNG dùng nhánh `Hekenye/LivePortrait-AudioDriven`)* để biến ảnh cận mặt thực thể ma thành clip Jumpscare chuyển động tự nhiên **0đ chi phí API** ngay trên card **Maxwell GTX 960 / GTX 960M (`4–6GB VRAM`)**.

> **Tối ưu thực chiến cho card `4GB VRAM` (như GTX 960M):**
> - `gen_jumpscare_clip.py` tự động thu ảnh nguồn đầu vào về **`512×640`** (nhẹ hơn ~40% VRAM so với `720×960` mà vẫn giữ sắc nét vùng mắt/miệng).
> - Nên **thử chạy mặc định FP16 trước** để tiết kiệm VRAM tối đa; **chỉ bật thêm `--lp-fp32`** nếu card Maxwell gặp hiện tượng khung hình đen hoặc nhiễu màu.
> - **Đóng bớt trình duyệt nặng / Remotion Studio** trước khi chạy LivePortrait trên card 4GB VRAM để tránh đầy bộ nhớ GPU.

### 1. Tạo Môi Trường Python 3.10 Riêng & Cài `torch==2.3.0` CUDA 11.8 (`cu118`)
Kiến trúc Maxwell (GTX 960 / 960M) hoạt động ổn định nhất với **PyTorch `2.3.0` bản CUDA 11.8 (`cu118`)**:

- **Linux / WSL2 (Bash — dùng `venv` chuẩn hoặc Conda đều được):**
  ```bash
  git clone https://github.com/KlingAIResearch/LivePortrait.git ~/LivePortrait
  cd ~/LivePortrait

  # Cách 1 (không cần Conda — khuyên dùng trên Ubuntu Python 3.10):
  python3 -m venv .venv && source .venv/bin/activate
  # Hoặc Cách 2 (nếu dùng Conda):
  # conda create -n liveportrait python=3.10 -y && conda activate liveportrait

  # BẮT BUỘC cài đúng torch 2.3.0 + cu118 tương thích GTX 960 / 960M Maxwell
  pip install --no-cache-dir torch==2.3.0 torchvision==0.18.0 torchaudio==2.3.0 --index-url https://download.pytorch.org/whl/cu118
  pip install --no-cache-dir -r requirements.txt "huggingface_hub[cli]"

  # Lưu ý riêng cho card Maxwell Compute 5.0 (GTX 960M) trên Linux venv:
  # 1) onnxruntime-gpu 1.18 đã bỏ nhân sm_50 -> đổi riêng sang onnxruntime CPU (chỉ chạy bước tách mặt 0.1s; 100% mạng LivePortrait vẫn chạy GPU!)
  pip uninstall -y onnxruntime-gpu && pip install --no-cache-dir onnxruntime==1.18.0
  # 2) Tạo liên kết libnvrtc.so nếu máy chưa cài system CUDA 11.8 toolkit (gen_jumpscare_clip.py tự nạp LD_LIBRARY_PATH)
  ln -sf libnvrtc.so.11.2 .venv/lib/python3.10/site-packages/nvidia/cuda_nvrtc/lib/libnvrtc.so
  ```

- **Windows 10/11 (PowerShell):**
  ```powershell
  git clone https://github.com/KlingAIResearch/LivePortrait.git C:\AI\LivePortrait
  cd C:\AI\LivePortrait

  conda create -n liveportrait python=3.10 -y
  conda activate liveportrait

  pip install torch==2.3.0 torchvision==0.18.0 torchaudio==2.3.0 --index-url https://download.pytorch.org/whl/cu118
  pip install -r requirements.txt
  pip install "huggingface_hub[cli]"
  ```

### 2. Tải Trọng Số `pretrained_weights` Từ HuggingFace
```bash
# Đứng tại thư mục gốc LivePortrait
huggingface-cli download KwaiVGI/LivePortrait --local-dir pretrained_weights --exclude "*.git*" "README.md" "docs"
```
Kiểm tra tồn tại các tệp trọng số trong `pretrained_weights/liveportrait/` và `pretrained_weights/insightface/`.

### 3. Khai Báo Biến Môi Trường `LIVEPORTRAIT_DIR` & Chạy An Toàn Trên GTX 960 / 960M
- **Linux / macOS:**
  ```bash
  export LIVEPORTRAIT_DIR="$HOME/LivePortrait"
  # Trỏ vào Python trong .venv (hoặc môi trường conda) của LivePortrait:
  export LIVEPORTRAIT_PYTHON="$HOME/LivePortrait/.venv/bin/python"
  ```
- **Windows PowerShell:**
  ```powershell
  $env:LIVEPORTRAIT_DIR = "C:\AI\LivePortrait"
  $env:LIVEPORTRAIT_PYTHON = "$env:USERPROFILE\miniconda3\envs\liveportrait\python.exe"
  ```
- Chạy tạo Jumpscare hoàn toàn tự động (thử mặc định FP16 nhẹ VRAM trước; chỉ thêm `--lp-fp32` nếu thấy khung hình đen/nhiễu; hệ thống luôn tắt `--flag_do_torch_compile`, thu ảnh nguồn `512×640` và tự lọc bỏ `*_concat.mp4`):
  ```bash
  python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json \
    --comp <CompId> --all --workspace shorts-project \
    --backend auto --overwrite
  # Nếu gặp khung hình đen/nhiễu trên Maxwell, chạy lại kèm cờ FP32:
  python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json \
    --comp <CompId> --all --workspace shorts-project \
    --backend auto --lp-fp32 --overwrite
  ```
  *(Bạn cũng có thể nạp thẳng clip ngoài bằng `--import-jumpscare my_scare.mp4`, hoặc ép chạy Analog Horror Hard-Cut `0.7–1.1s` bằng `--backend local`.)*

### 4. Tạo & Lưu 3–4 File Mẫu Cử Động Kinh Dị `.pkl` Vào `assets/liveportrait_motions/`
Dùng file `.pkl` giúp bỏ qua bước trích xuất chuyển động từ video mỗi lần chạy (**nhanh hơn 2–3 lần trên GTX 960**):
1. Tự quay bằng điện thoại **3–4 đoạn video ngắn 2–3 giây** (mặt nhìn thẳng ống kính, đủ sáng):
   - `creepy_smile.mp4`: mặt vô cảm rồi nhếch nụ cười kéo dài trợn mắt *(dùng cho `scareTier 5`)*.
   - `neck_snap_stare.mp4`: mặt đứng im rồi giật nghiêng cổ gắt sang một bên *(dùng cho `scareTier 6` / `whip_pan_turn`)*.
   - `wide_eye_lunge.mp4`: mở to mắt, há hàm và lao mạnh sát ống kính *(dùng cho `scareTier 7` / `silence_hard_cut`)*.
   - `head_tilt_stare.mp4`: nghiêng đầu chậm rồi bất ngờ trừng mắt *(dùng cho `scareTier 4` / `diegetic_reveal`)*.
2. Chạy `inference.py` **1 lần duy nhất** trên từng đoạn `.mp4` — `LivePortrait` sẽ tự xuất kèm file **`.pkl`** ngay cạnh video nguồn:
   ```bash
   cd "$LIVEPORTRAIT_DIR"
   python inference.py -s assets/examples/source/s0.jpg -d /path/to/creepy_smile.mp4 --no_flag_use_half_precision
   ```
3. Copy toàn bộ file `.pkl` vừa tạo (`creepy_smile.pkl`, `neck_snap_stare.pkl`, `wide_eye_lunge.pkl`, `head_tilt_stare.pkl`) vào `shorts-project/assets/liveportrait_motions/`. Từ các video sau, `gen_jumpscare_clip.py` sẽ tự động chọn đúng file `.pkl` khớp với `scareTier` & `transitionStyle` của từng kịch bản!

---

## 3. Quy Trình Sản Xuất 1 Video Kinh Dị Mới Chuẩn `v15.5`

Bạn có thể gõ yêu cầu trực tiếp cho AI Agent hoặc tự chạy tuần tự từng bước theo pipeline chuẩn sau (không nhảy cóc):

### Bước 1 — Lên Kịch Bản & Kiểm Định Tuần Tự (`horror_story.py` v3.2)

- Chọn chế độ **`viral_short`** (`55–90s`, nhịp kể điềm tĩnh `2.35 w/s`, mở nút thắt tự nhiên) hoặc **`deep_story`** (`2.5–10 phút`, đa hồi/tập).
- Chọn giọng vùng miền (`north` | `central` | `south`) và phong cách ngôn ngữ tự nhiên (`clean_folklore` mặc định — không ép quota chửi thề, không ép motif đồng hồ/chốt cửa).

```bash
cd ./shorts-project
mkdir -p out/du-an-moi src/du-an-moi

# Tạo khung story.json v3.2 (tự gợi ý audioDirection theo thể loại)
python3 scripts/horror_story.py seed \
  --title "Tên Truyện" \
  --format micro --total-sec 68 \
  --pacing-profile viral_short \
  --dialect north \
  --grit-level clean_folklore \
  --out out/du-an-moi/story.json

# Sau khi hoàn thiện nội dung story.json: kiểm tra tuần tự toàn bộ cổng kiểm định
python3 scripts/horror_story.py validate out/du-an-moi/story.json --stage full --strict-story

# Xuất HTML Bible (Tension Curve SVG + 2D Floorplan) & khung blueprint
python3 scripts/horror_story.py html out/du-an-moi/story.json --out out/du-an-moi/story-report.html
python3 scripts/horror_story.py export-blueprint out/du-an-moi/story.json \
  --project-id du-an-moi --out out/du-an-moi/blueprint
```

### Bước 2 — Hoàn Thiện `SCRIPT.md` Hai Bước Sạch (0 Thẻ `[PACE|PITCH]`)

Tham khảo mẫu chuẩn v15 tại [examples/script_v15_sample.md](./examples/script_v15_sample.md):
- **Bước 1 (Sáng tác sạch):** Viết trọn câu chuyện đời thật, Hook `0–5s` không lộ bài, lõi cảm xúc con người, leo thang 3 tầng, câu chốt dư âm — **0 thẻ kỹ thuật**.
- **Bước 2 (Đạo diễn):** Không đặt `[VISUAL Xs]` ở đầu file; đánh thẳng câu đầu ngay `0.05–0.25s`, dùng khoảng nghỉ sạch `[BEAT 0.35s]` và `[SILENCE_DROP 0.6s..1.1s]` trước cú Jumpscare, chỉ dùng thẻ bản địa như `[thở dài]` (tuyệt đối không gắn `[PACE=... | PITCH=...]`).

### Bước 3 — Tổng Hợp Giọng Đọc `VieNeu-TTS 1.0x` Sạch & Căn Khớp Từng Từ (`< 35ms`)

```bash
python3 scripts/gen_horror_voice.py \
  --script out/du-an-moi/SCRIPT.md \
  --tts-engine vieneu \
  --ref-audio audio/my_storyteller_6s.wav \
  --word-aligner auto \
  --strict-hook \
  --out-dir out/du-an-moi/voice \
  --no-vc
```
*Kiểm tra log: `first_word <= 0.45s` (không có `[HOOK WARN]`), tốc độ gốc `1.0x` sạch (0% DSP bóp tempo/pitch), xuất `rms_envelope_30fps` trong `words.json`.*

### Bước 4 — Tự Lấy SFX Theo Kịch Bản (Ưu Tiên `sfx_curated/` + Xoay Vòng `history.jsonl`) & Mix Linh Hoạt (`mix_cues.py --strict`)

```bash
# Tự tìm SFX theo từ khóa kịch bản: ưu tiên audio/sfx_curated/ + xoay vòng history.jsonl -> Openverse CC0 có lọc chất lượng
python3 scripts/sfx_manager.py auto-fetch-for-script \
  --cues out/du-an-moi/cues.json \
  --library audio/sfx_library \
  --curated-dir audio/sfx_curated

# Mix theo audioDirection khai báo trong cues.json (raw_diegetic / folklore_atmospheric / cinematic_score), min_jumpscares >= 1, -1.0 dBTP
python3 scripts/mix_cues.py \
  --cues out/du-an-moi/cues.json \
  --out out/du-an-moi/audio/mix.wav \
  --strict
```
Kiểm tra `out/du-an-moi/audio/mix_report.md`: đúng `audioDirection`, `I = -16.0 LUFS`, `TP <= -1.0 dBTP`, `0` clips, `0` lỗi.

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
