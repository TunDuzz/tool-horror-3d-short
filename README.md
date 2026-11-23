# Horror 3D Short & Series Skill Suite v2 (`Gothic Ink-Noir × Shadow-Depth`, Three.js + Remotion)

Bộ kỹ năng (AI Agent Skills) toàn diện để sản xuất video hoạt hình kinh dị 3D ngắn (`~55–75 giây`, dọc `9:16` hoặc ngang `16:9`) và series kinh dị dài nhiều tập (`8–10 phút` chia thành các Part `p01..p10`) theo phong cách **"Uncanny Gothic Ink-Noir × Shadow-Depth"** (*Junji Ito × Darkest Dungeon × Silent Hill × Mike Mignola*):

* **Nhân vật 2D Quỷ dị & Nét mực khắc gỗ (`templates/engine/toon.ts`):** Tỷ lệ người gầy xương xẩu (`~4.8` đầu), nét bút sắt run rẩy bất quy tắc (`Pen.grit`), hốc mắt đen đặc *Darkest Dungeon*, tròng mắt gân máu đồng tử đầu kim, biểu cảm thực thể mất đối xứng (`uncanny: true`), hàm trễ `jawDrop`, nụ cười rách má răng mảnh kiểu *Junji Ito*, giọt mực/nhựa đen rỉ (`Pen.drip`), **3 góc nhìn (`front` / `side` / `back` + ngoái đầu `glance`)**, ánh sáng hắt từ dưới cằm (`underLight`) và **lệch nhịp chuyển động** (người mượt `30 fps`, thực thể giật cục `uncannyTime` + bẻ cổ `uncannyTwitch` + ảnh ma chồng hình `pushAfterimage`).
* **Thế giới 3D Chiaroscuro & Chi tiết Quỷ dị Ẩn (`build.ts`, `shade.ts`, `cardshade.ts`, `grade.ts`):** Kiến trúc phi-hộp đầy vết ẩm mốc/nứt vỡ, **3 nguồn sáng `PointLight` thực** tương phản cực gắt ("đốm sáng giữa vực đen"), **sấm chớp 3D thực (`setLightningFlash`)**, **quang sai màu đỏ-xanh (`aberration`)**, xước phim cổ & tối viền dạng khói mực, cùng bộ hiệu ứng rợn ẩn (`fxLurkingEyes`, `fxWindowHand`, `fxFloatingAsh`, bóng đổ dài dị dạng `fxLongShadow`).
* **Đạo diễn điện ảnh & QA tự động (`camera.ts`, `short_qa.py`):** Cấm lặp góc máy liên tiếp, hỗ trợ `camOTS`/`camArc`/`camPOV`/`camECU`/`dollyZoom`/`dipBlack`/`vignettePulse`/`aberration`, decal khóa mặt phẳng 3D (`pushFlatDecal`), **Art Director's Still Gate** và `short_qa.py` tự bắt lỗi góc máy lặp (`DIRECTING_WARNS`).
* **Âm thanh & Giọng đọc kinh dị (`templates/audio/`, `gen_horror_voice.py`):** Giọng đọc trầm sâu (hỗ trợ `edge-tts` + clone giọng Nguyễn Ngọc Ngạn qua So-VITS-SVC 4.0) và hệ thống tổng hợp âm thanh/nhạc nền kinh dị thuần Python (`numpy`/`scipy`) đạt chuẩn `-15.0 LUFS`.

Đã được kiểm chứng thực tế trên sản phẩm mẫu **"Truyện Ma Da Việt Nam" v2** (`MadaShort`, 74.2s / 2226 frames @ 30fps, 10 cỡ cảnh/góc máy khác biệt) và bộ kiểm thử 5 preset (`HorrorLabVertical` / `HorrorLabWide`).

---

## Cấu trúc gói kỹ năng (`What's Inside`)

| Đường dẫn | Mô tả chi tiết |
|---|---|
| `SKILL.md` | Kỹ năng chính `horror-3d-short`: quy trình 11 bước + luật đạo diễn No-Repeat-Angle, Action-to-Narration, Art Director Still Gate & Post-Render QA |
| `companion-skills/horror-story/` | Thiết kế & kiểm định cốt truyện kinh dị 2 vòng (khung xương 4 mảng + 14 cổng kiểm định logic + bảng đạo cụ kể chuyện + báo cáo Story Bible HTML/Markdown) trước khi viết `SCRIPT.md` |
| `companion-skills/horror-series-pipeline/` | Kiến trúc sản xuất series dài 8–10 phút chia thành các Part ~1 phút (`p01..p10`) chống tràn context và chống lệch tọa độ 3D (`CONTINUITY.json`) |
| `companion-skills/horror-script-storyboard/` | Công thức kịch bản kinh dị 8 nhịp (`2.7–3.2 từ/giây`), nhịp lặng `[DEAD SILENCE]`, phân bổ cỡ cảnh (`WS/OTS/LOW/MCU/ECU/CU`) và chuyển cảnh `dipBlack`/`vignettePulse` |
| `companion-skills/horror-world-lookdev/` | Dựng bối cảnh 3D Gothic phi-hộp, nguồn sáng `PointLight` thực, ánh sáng thể tích, tiền cảnh silhouette, nhân vật 3 góc nhìn (`front/side/back`) và decal `pushFlatDecal` |
| `companion-skills/horror-audio-sfx/` | Tổng hợp nhạc nền & SFX kinh dị bằng Python DSP, cắt khoảng lặng Dead Silence và chuẩn hóa `-15.0 LUFS` |
| `templates/engine/` | Horror Engine v2 trung tính (`camera.ts`, `lights.ts`, `shade.ts`, `cardshade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`, `paint.ts`, `build.ts`, `toon.ts`, `cast.ts`, `ShortPlayer.tsx`) |
| `templates/mada/` | Dự án mẫu **"Ma Da" v2** (`story.ts`, `build.ts`, `toon.ts`, `cast.ts`, `world.ts`, `index.tsx`, `SCRIPT.md`, `build_audio.py`, `words.json`) |
| `templates/horror-lab/` | Rig kiểm thử 5 preset ánh sáng kinh dị v2 trên cả hai khung hình `9:16` và `16:9` |
| `templates/audio/` | Thư viện tổng hợp âm thanh kinh dị (`dsp.py`, `horror_instruments.py` với 23 nhạc cụ/Foley/SFX thủ tục + Dual-Space Convolution IR, `mix_base.py`) |
| `templates/scripts/` | Bộ script đa nền tảng (Linux/macOS/Windows): `horror_story.py`, `gen_horror_voice.py`, `render-stills.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py` |
| `templates/project/` | Cấu hình gốc workspace (`package.json`, `tsconfig.json`, `requirements.txt`, `Root.tsx`, `index.ts`, `GEMINI.md`) |
| `references/` | Tài liệu chuẩn kỹ thuật v2 (`HORROR_STYLE_BIBLE.md`, `READABILITY_AND_QA.md`, `HORROR_FORMULAS.md`, `LIGHTING_AND_PALETTE.md`, `SOUND_CUES_COOKBOOK.md`, `SERIES_ARCHITECTURE.md`) và ảnh still chuẩn trong `references/stills/` |

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
mkdir -p shorts-project/src/{engine,horror-lab,mada} shorts-project/{audio,scripts}
cp .agents/skills/horror-3d-short/templates/project/GEMINI.md ./GEMINI.md
cp .agents/skills/horror-3d-short/templates/project/{package.json,tsconfig.json,requirements.txt} shorts-project/
cp .agents/skills/horror-3d-short/templates/project/{index.ts,Root.tsx} shorts-project/src/
cp .agents/skills/horror-3d-short/templates/engine/* shorts-project/src/engine/
cp .agents/skills/horror-3d-short/templates/horror-lab/* shorts-project/src/horror-lab/
cp .agents/skills/horror-3d-short/templates/mada/*.ts .agents/skills/horror-3d-short/templates/mada/*.tsx shorts-project/src/mada/
cp .agents/skills/horror-3d-short/templates/audio/* shorts-project/audio/
cp .agents/skills/horror-3d-short/templates/scripts/* shorts-project/scripts/
cd shorts-project
npm install && npm run typecheck
pip install -r requirements.txt
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force shorts-project/src/engine, shorts-project/src/horror-lab, shorts-project/src/mada, shorts-project/audio, shorts-project/scripts
Copy-Item .agents/skills/horror-3d-short/templates/project/GEMINI.md ./GEMINI.md
Copy-Item .agents/skills/horror-3d-short/templates/project/package.json, .agents/skills/horror-3d-short/templates/project/tsconfig.json, .agents/skills/horror-3d-short/templates/project/requirements.txt shorts-project/
Copy-Item .agents/skills/horror-3d-short/templates/project/index.ts, .agents/skills/horror-3d-short/templates/project/Root.tsx shorts-project/src/
Copy-Item .agents/skills/horror-3d-short/templates/engine/* shorts-project/src/engine/
Copy-Item .agents/skills/horror-3d-short/templates/horror-lab/* shorts-project/src/horror-lab/
Copy-Item .agents/skills/horror-3d-short/templates/mada/*.ts, .agents/skills/horror-3d-short/templates/mada/*.tsx shorts-project/src/mada/
Copy-Item .agents/skills/horror-3d-short/templates/audio/* shorts-project/audio/
Copy-Item .agents/skills/horror-3d-short/templates/scripts/* shorts-project/scripts/
cd shorts-project
npm install
npm run typecheck
pip install -r requirements.txt
```

---

## Cách sử dụng (`Usage`)
- **Xây dựng & duyệt cốt truyện kinh dị trước khi làm phim (standalone hoặc nhiều tập):**
  `/horror-story lập khung cốt truyện kinh dị dân gian 1 tập (hoặc series 6 tập) về...`
- **Làm video kinh dị ngắn độc lập (~1 phút):**
  `/horror-3d-short làm cho tôi 1 sản phẩm truyện ma da Việt Nam`
- **Làm series kinh dị dài nhiều tập (8–10 phút chia thành các Part 1 phút):**
  `/horror-series-pipeline lập kế hoạch và sản xuất series kinh dị 8 tập về ngôi làng cổ`

---

## Lưu ý quan trọng (`Hard Rules & Disk Safety`)
1. **Quản lý thư mục tạm & Scale hợp lệ:** Đặt `REMOTION_TMP=/tmp/remotion-tmp` (Linux/macOS) hoặc `$env:REMOTION_TMP="D:/remotion-tmp"` (Windows) và xóa thư mục tạm sau khi render. Chỉ dùng `--scale 1`, `1.25`, hoặc `1.5` (tránh `1.3333`).
2. **Tách biệt tuyệt đối Engine và Project:** Không thêm đạo cụ, trang phục hay tọa độ riêng của từng kịch bản vào `src/engine/`.
3. **Art Director's Still Gate & Dark/Directing-Aware QA:** Bắt buộc render still phủ 100% số shot và kiểm tra trực tiếp bằng mắt trước khi xuất video cuối, sau đó chạy `extract_shots.py` + `short_qa.py` xác nhận `0` lỗi khung hình, `DIRECTING_WARNS none`, và `-15.0 LUFS`.

---

## Bản quyền (`License`)
Phát hành theo giấy phép MIT (`LICENSE`).
