# Horror 3D Short & Series Skill Suite v3 (`3D Stylized Dark-Horror POV`, Three.js + Remotion)

Bộ kỹ năng (AI Agent Skills) chuyên sản xuất video hoạt hình kinh dị 3D ngắn (`~55–75 giây`, dọc `9:16` hoặc ngang `16:9`) và series kinh dị nhiều phần theo phong cách **"3D Stylized Dark-Horror POV"** — 100% thế giới & nhân vật 3D tạo hình rùng rợn phi-chibi, đường viền Inverted-Hull sạch sắc nét, góc nhìn thứ nhất POV tương tác đạo cụ 3D thực, Whip-Pan GPU Motion Blur, không lặp lại bối cảnh và khóa đồng nhất Kịch bản ↔ Frame 3 lớp:

* **Nhân vật 3D Kinh dị Phi-Chibi & Thực thể Quỷ dị (`rig3d.ts`, `face2d.ts`, `outline3d.ts`):** Tỷ lệ người lớn gầy sắc (`~5.6` đầu, 20 khớp xương, hàm/mũi/tai/cổ áo 3D, nếp gấp vải sạch), mặt decal cong 512×512 (mắt hạnh nhân, đồng tử đầu kim, quầng mắt sâu mượt, 8 biểu cảm kinh dị + 9 khẩu hình), `EntityConfig` cho thực thể siêu nhiên (cao gầy dị thường, tay/ngón kéo dài, cổ gãy nghiêng, tóc phủ hữu cơ, bất động chết chóc, mắt phát sáng HDR) và **viền Inverted-Hull pháp tuyến mượt (~5–7 px) tách lớp `NOINK`** không bao giờ bị viền kép hay nứt góc.
* **Góc nhìn Thứ nhất POV & Đạo cụ 3D Tương tác (`povRig.ts`):** Nhìn xuống thấy chân/đầu gối nhân vật ngồi hoặc đứng; hai tay POV cầm **`Phone3D`** (màn hình khóa Canvas2D phát sáng HDR Bloom + đèn chiếu sáng ngón tay, đồng bộ giờ/tin nhắn 100% với HUD), **`Flashlight3D`** (chùm `SpotLight` 3D thực + luồng sáng thể tích), **`HandheldOilLamp3D`** và **`PaperProp3D`**.
* **Ánh sáng Vật lý 5 Preset + Whip-Pan Motion Blur (`lights.ts`, `shade.ts`, `motionblur.ts`, `ShortPlayer.tsx`):** 5 preset ánh sáng kinh dị tự nhiên (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight` — bỏ hẳn lớp rửa màu `blood` giả và vết xước `gradeGrime`), chuyển sáng mất đèn mượt (`lerpLights`), **6 `PointLight` thực + 1 `SpotLight` + bóng đổ mềm + HDR Bloom (`0.92`)**, và hiệu ứng **Whip-Pan GPU Motion Blur 13-tap xác định** theo vận tốc góc quay camera.
* **Chống Lặp Bối Cảnh Tuyệt đối (`LocationBlueprint` + `LOCATION_REGISTRY.json` + `paint.ts` + `build.ts`):** Thay thế hoàn toàn mẫu phòng gỗ hộp cũ bằng bộ kiến trúc mô-đun trung tính (`addWallWithOpening`, `addAFrameRoof`, `addDoubleDoorWithCracks`, `addCorridorBay`, `addStairFlight`, đèn dầu thủy tinh, bát hương khói, đèn tuýp chớp, đèn đường cao áp) + **16 bộ texture vẽ tay sạch** và cổng **`ANTI_REPEAT_ERROR`** chặn tái sử dụng bối cảnh giữa các video hoặc các phần không liên quan.
* **Khóa Đồng Nhất Kịch bản ↔ Frame 3 Lớp (`manifest.ts`, `validate_manifest.py`, `render-stills.mjs --manifest`, `HorrorHUD.tsx`):** `SceneManifest` là nguồn chân lý duy nhất điều khiển cả 3D World lẫn HUD, tự kiểm định đồng bộ `SCRIPT.md` / `words.json` / đồng hồ `Phone3D`, và xuất danh sách frame kiểm duyệt bắt buộc từng nhịp beat.

Đã kiểm chứng trực tiếp bằng render Full HD `1080×1920` trên **`HorrorLabV3Vertical`** (3 bối cảnh khác biệt hoàn toàn: nhà tranh canh linh cữu → hành lang bệnh viện đèn chớp → ngõ làng sương mù đèn đường cao áp; `0` lỗi frame, `0` pops, `DIRECTING_WARNS none`; 7 ảnh benchmark chuẩn tại `references/stills/v3_*.jpg`).

> **Trạng thái đại tu:** Giai đoạn 1 (**Đồ họa, Engine v3, Chống lặp bối cảnh & Khóa Kịch bản ↔ Frame**) đã hoàn tất và kiểm định thực tế. Giai đoạn 2 (đại tu kỹ năng kể chuyện, kịch bản đối thoại POV và âm thanh đa giọng) sẽ triển khai tiếp theo sau khi duyệt chất lượng đồ họa Giai đoạn 1.

---

## Cấu trúc gói kỹ năng (`What's Inside`)

| Đường dẫn | Mô tả chi tiết |
|---|---|
| `SKILL.md` | Kỹ năng chính `horror-3d-short` v3: quy trình 11 bước, luật chống lặp bối cảnh, khóa `SceneManifest` 3 lớp, Pre-Final `--manifest` Still Gate & Post-Render QA |
| `companion-skills/horror-world-lookdev/` | Thiết kế `LocationBlueprint` độc bản, lắp ghép kiến trúc mô-đun, nhân vật 3D phi-chibi, thực thể `EntityConfig`, POV Rig + `Phone3D`/`Flashlight3D` & ánh sáng thực |
| `companion-skills/horror-story/` | Thiết kế & kiểm định cốt truyện kinh dị 2 vòng (đã đồng bộ 5 preset ánh sáng v3) |
| `companion-skills/horror-series-pipeline/` | Kiến trúc sản xuất series dài nhiều phần (`p01..p10`) chống tràn context và giữ nhất quán tọa độ |
| `companion-skills/horror-script-storyboard/` | Công thức kịch bản kinh dị, nhịp `[DEAD SILENCE]`, phân bổ cỡ cảnh & `story.ts` |
| `companion-skills/horror-audio-sfx/` | Tổng hợp nhạc nền & SFX kinh dị thuần Python DSP (`-15.0 LUFS`) |
| `templates/engine/` | **Horror Engine v3 trung tính (18 module):** `camera.ts`, `lights.ts`, `manifest.ts`, `shade.ts`, `outline3d.ts`, `ink.ts`, `motionblur.ts`, `lensblur.ts`, `grade.ts`, `paint.ts`, `build.ts`, `face2d.ts`, `rig3d.ts`, `povRig.ts`, `fx3d.ts`, `HorrorHUD.tsx`, `ShortPlayer.tsx`, `index.ts` |
| `templates/horror-lab-v3/` | Dự án kiểm chứng trực quan **3 bối cảnh v3** (`story.ts`, `build.ts`, `world.ts`, `index.tsx`, `manifest.json`) đăng ký `HorrorLabV3Vertical` (`9:16`) & `HorrorLabV3Wide` (`16:9`) |
| `templates/scripts/` | Bộ công cụ kiểm định & render đa nền tảng: `validate_manifest.py`, `render-stills.mjs` (`--manifest`), `extract_shots.py` (`WHIP_PANS` + `POV_MOTIONS`), `short_qa.py`, `horror_story.py`, `gen_horror_voice.py`, `stitch_parts.py`, `validate_continuity.py` |
| `templates/audio/` | Thư viện tổng hợp âm thanh kinh dị (`dsp.py`, `horror_instruments.py`, `mix_base.py`) |
| `templates/project/` | Cấu hình workspace (`package.json`, `tsconfig.json`, `requirements.txt`, `Root.tsx`, `index.ts`, `GEMINI.md`) |
| `references/` | Chuẩn kỹ thuật v3 (`HORROR_STYLE_BIBLE.md`, `LIGHTING_AND_PALETTE.md`, `READABILITY_AND_QA.md`, `HORROR_FORMULAS.md`, `SOUND_CUES_COOKBOOK.md`, `SERIES_ARCHITECTURE.md`) & 7 ảnh chuẩn `references/stills/v3_*.jpg` |
| `tests/` | Bộ kiểm thử tự động Engine v3 & Python scripts (`engine_*.test.ts`, `test_scripts_v3.py`, `ts-loader.mjs`) |

---

## Hướng dẫn cài đặt (`Installation`)

### 1. Cài đặt vào thư mục Skills của Agent (Antigravity / Claude Code)
```bash
git clone https://github.com/TunDuzz/tool-horror-3d-short.git .agents/skills/horror-3d-short
cp -r .agents/skills/horror-3d-short/companion-skills/* .agents/skills/
```

### 2. Khởi tạo Workspace `shorts-project/` từ `templates/`
**Linux / macOS:**
```bash
mkdir -p shorts-project/src/{engine,horror-lab-v3} shorts-project/{audio,scripts}
cp .agents/skills/horror-3d-short/templates/project/GEMINI.md ./GEMINI.md
cp .agents/skills/horror-3d-short/templates/project/{package.json,tsconfig.json,requirements.txt} shorts-project/
cp .agents/skills/horror-3d-short/templates/project/{index.ts,Root.tsx} shorts-project/src/
cp .agents/skills/horror-3d-short/templates/engine/* shorts-project/src/engine/
cp .agents/skills/horror-3d-short/templates/horror-lab-v3/* shorts-project/src/horror-lab-v3/
cp .agents/skills/horror-3d-short/templates/audio/* shorts-project/audio/
cp .agents/skills/horror-3d-short/templates/scripts/*.py .agents/skills/horror-3d-short/templates/scripts/*.mjs shorts-project/scripts/
cd shorts-project
npm install && npm run typecheck
pip install -r requirements.txt
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force shorts-project/src/engine, shorts-project/src/horror-lab-v3, shorts-project/audio, shorts-project/scripts
Copy-Item .agents/skills/horror-3d-short/templates/project/GEMINI.md ./GEMINI.md
Copy-Item .agents/skills/horror-3d-short/templates/project/package.json, .agents/skills/horror-3d-short/templates/project/tsconfig.json, .agents/skills/horror-3d-short/templates/project/requirements.txt shorts-project/
Copy-Item .agents/skills/horror-3d-short/templates/project/index.ts, .agents/skills/horror-3d-short/templates/project/Root.tsx shorts-project/src/
Copy-Item .agents/skills/horror-3d-short/templates/engine/* shorts-project/src/engine/
Copy-Item .agents/skills/horror-3d-short/templates/horror-lab-v3/* shorts-project/src/horror-lab-v3/
Copy-Item .agents/skills/horror-3d-short/templates/audio/* shorts-project/audio/
Copy-Item .agents/skills/horror-3d-short/templates/scripts/*.py, .agents/skills/horror-3d-short/templates/scripts/*.mjs shorts-project/scripts/
cd shorts-project
npm install
npm run typecheck
pip install -r requirements.txt
```

### 3. Chạy kiểm thử tự động & kiểm chứng `HorrorLabV3`
```bash
# Unit test Engine v3 & Python validator/QA scripts
node --import ./tests/ts-loader.mjs --test tests/*.test.ts
python3 -m unittest discover -s tests -v

# Kiểm định SceneManifest & render still chuẩn theo từng nhịp beat
python3 shorts-project/scripts/validate_manifest.py shorts-project/src/horror-lab-v3/manifest.json --still-out /tmp/v3_stills.json
cd shorts-project
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs HorrorLabV3Vertical out/horror-lab-v3/stills/b_ --manifest /tmp/v3_stills.json 1
```

---

## Lưu ý quan trọng (`Hard Rules & Disk Safety`)
1. **Không lặp bối cảnh:** Mỗi video mới hoặc phần không liên quan phải khai báo `LocationBlueprint` độc bản và vượt qua cổng `LOCATION_REGISTRY.json` (`validate_manifest.py`).
2. **Đồng nhất Kịch bản ↔ Frame:** Luôn điều khiển `world.ts` và `HorrorHUD` từ `MANIFEST`, kiểm tra 100% ảnh `--manifest` bằng mắt trước khi render video cuối.
3. **Quản lý thư mục tạm & Scale hợp lệ:** Đặt `REMOTION_TMP=/tmp/remotion-tmp` (Linux/macOS) hoặc `$env:REMOTION_TMP="D:/remotion-tmp"` (Windows) và xóa thư mục tạm sau khi render. Chỉ dùng `--scale 1`, `1.25`, hoặc `1.5`.

---

## Bản quyền (`License`)
Phát hành theo giấy phép MIT (`LICENSE`).
