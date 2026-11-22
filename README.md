# Horror 3D Short & Series Skill Suite (`Uncanny Toon-Noir`, Three.js + Remotion)

Bộ kỹ năng (AI Agent Skills) toàn diện để sản xuất video hoạt hình kinh dị 3D ngắn (`~55–75 giây`, dọc `9:16` hoặc ngang `16:9`) và series kinh dị dài nhiều tập (`8–10 phút` chia thành các Part `p01..p10`) theo phong cách **"Uncanny Toon-Noir"**: nhân vật 2D viền mực đặt trong thế giới 3D có đường nét mực đen (`InkPass`), 5 chế độ ánh sáng & sương mù kinh dị (`night`, `candle`, `storm`, `eerie`, `blood`), bóng ma bán trong suốt, giọng đọc dẫn truyện trầm sâu (hỗ trợ clone giọng Nguyễn Ngọc Ngạn qua So-VITS-SVC 4.0) và hệ thống tổng hợp âm thanh/nhạc nền kinh dị thuần Python (`numpy`/`scipy`).

Đã được kiểm chứng thực tế trên sản phẩm hoàn chỉnh **"Truyện Ma Da Việt Nam"** (`MadaShort`, 74.2s / 2226 frames @ 30fps) và bộ thử nghiệm ánh sáng 5 preset (`HorrorLabVertical` / `HorrorLabWide`).

---

## Cấu trúc gói kỹ năng (`What's Inside`)

| Đường dẫn | Mô tả chi tiết |
|---|---|
| `SKILL.md` | Kỹ năng chính `horror-3d-short`: quy trình 11 bước từ kịch bản, giọng đọc, dựng cảnh 3D đến cổng kiểm duyệt Still Gate & Post-Render QA |
| `companion-skills/horror-series-pipeline/` | Kiến trúc sản xuất series dài 8–10 phút chia thành các Part ~1 phút (`p01..p10`) chống tràn context và chống lệch tọa độ 3D (`CONTINUITY.json`) |
| `companion-skills/horror-script-storyboard/` | Công thức viết kịch bản kinh dị 8 nhịp (`2.7–3.2 từ/giây`), nhịp lặng `[DEAD SILENCE]` và khóa frame `story.ts` theo `words.json` |
| `companion-skills/horror-world-lookdev/` | Thiết kế bối cảnh 3D `EraGroup`, quy tắc tách lớp sáng-tối 3 tầng (3-Layer Value Separation), ánh sáng HDR emissive và hiệu ứng 2D (`fxMist`, `fxRain`, `fxLightning`, `fxFlickerGlow`, `fxBreath`) |
| `companion-skills/horror-audio-sfx/` | Hướng dẫn phối nhạc nền & SFX kinh dị bằng Python DSP, cắt khoảng lặng Dead Silence và chuẩn hóa độ ồn `-15.0 LUFS` |
| `templates/engine/` | Tầng hạ tầng 3D & Post-processing 100% trung tính (`camera.ts`, `lights.ts`, `shade.ts`, `cardshade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`, `paint.ts`, `build.ts`, `toon.ts`, `cast.ts`, `ShortPlayer.tsx`) |
| `templates/mada/` | Toàn bộ mã nguồn dự án mẫu **"Ma Da"** (`story.ts`, `build.ts`, `toon.ts`, `cast.ts`, `world.ts`, `index.tsx`, `SCRIPT.md`, `build_audio.py`, `words.json`) |
| `templates/horror-lab/` | Rig kiểm thử 5 preset ánh sáng kinh dị trên cả hai khung hình `9:16` và `16:9` |
| `templates/audio/` | Thư viện tổng hợp âm thanh kinh dị (`dsp.py`, `horror_instruments.py` với 9 nhạc cụ/SFX thủ tục, `mix_base.py`) |
| `templates/scripts/` | Bộ script tự động hóa: `gen_horror_voice.py` (Edge-TTS + So-VITS-SVC voice clone), `render-stills.mjs`, `extract_shots.py`, `short_qa.py` (Dark-Aware QA), `stitch_parts.py`, `validate_continuity.py` |
| `templates/project/` | Cấu hình gốc của workspace (`package.json`, `tsconfig.json`, `Root.tsx`, `index.ts`, `GEMINI.md`) |
| `references/` | Toàn bộ tài liệu thông số kỹ thuật (`HORROR_STYLE_BIBLE.md`, `READABILITY_AND_QA.md`, `HORROR_FORMULAS.md`, `LIGHTING_AND_PALETTE.md`, `SOUND_CUES_COOKBOOK.md`, `SERIES_ARCHITECTURE.md`) và ảnh still/QA mẫu trong `references/stills/` |

---

## Hướng dẫn cài đặt (`Installation`)

### 1. Cài đặt vào thư mục Skills của Agent (Antigravity / Claude Code)
Clone trực tiếp repository này vào `.agents/skills/horror-3d-short` (hoặc `~/.claude/skills/horror-3d-short`):

```powershell
git clone https://github.com/TunDuzz/tool-horror-3d-short.git .agents/skills/horror-3d-short
```

Nếu muốn kích hoạt đầy đủ cả 5 kỹ năng độc lập trong `.agents/skills/`, copy thêm 4 kỹ năng đồng hành từ `companion-skills/`:

```powershell
Copy-Item -Recurse .agents/skills/horror-3d-short/companion-skills/* .agents/skills/
```

### 2. Khởi tạo Workspace `shorts-project/` từ `templates/` (nếu tạo mới từ đầu)
```powershell
New-Item -ItemType Directory -Force shorts-project/src/engine, shorts-project/src/horror-lab, shorts-project/src/mada, shorts-project/audio, shorts-project/scripts
Copy-Item .agents/skills/horror-3d-short/templates/project/GEMINI.md ./GEMINI.md
Copy-Item .agents/skills/horror-3d-short/templates/project/package.json, .agents/skills/horror-3d-short/templates/project/tsconfig.json shorts-project/
Copy-Item .agents/skills/horror-3d-short/templates/project/index.ts, .agents/skills/horror-3d-short/templates/project/Root.tsx shorts-project/src/
Copy-Item .agents/skills/horror-3d-short/templates/engine/* shorts-project/src/engine/
Copy-Item .agents/skills/horror-3d-short/templates/horror-lab/* shorts-project/src/horror-lab/
Copy-Item .agents/skills/horror-3d-short/templates/mada/*.ts, .agents/skills/horror-3d-short/templates/mada/*.tsx shorts-project/src/mada/
Copy-Item .agents/skills/horror-3d-short/templates/audio/* shorts-project/audio/
Copy-Item .agents/skills/horror-3d-short/templates/scripts/* shorts-project/scripts/
cd shorts-project
npm install
npm run typecheck
```

---

## Cách sử dụng (`Usage`)

Gọi trực tiếp slash command hoặc yêu cầu Agent:
- **Làm video kinh dị ngắn độc lập (~1 phút):**
  `/horror-3d-short làm cho tôi 1 sản phẩm truyện ma da Việt Nam`
- **Làm series kinh dị dài nhiều tập (8–10 phút chia thành các Part 1 phút):**
  `/horror-series-pipeline lập kế hoạch và sản xuất series kinh dị 8 tập về ngôi làng cổ`

---

## Lưu ý quan trọng (`Hard Rules & Disk Safety`)
1. **Bảo vệ dung lượng ổ `C:`:** Luôn đặt `$env:TEMP="D:/remotion-tmp"; $env:TMP="D:/remotion-tmp"; $env:REMOTION_TMP="D:/remotion-tmp"` trước khi chạy `render-stills.mjs` hoặc `npx remotion render`, và xóa các thư mục tạm `remotion-webpack-bundle-*` sau khi render xong.
2. **Tách biệt tuyệt đối Engine và Project:** Không bao giờ thêm đạo cụ, trang phục hay tọa độ riêng của từng kịch bản vào `src/engine/`. Mọi mở rộng nhân vật viết trong `src/<project>/toon.ts` qua các hook trên `Outfit`.
3. **Pre-Final Still Gate & Post-Render Dark-Aware QA:** Bắt buộc render still phủ 100% số shot và kiểm tra trực tiếp trước khi xuất video cuối, sau đó chạy `extract_shots.py` + `short_qa.py` để đảm bảo `0` frame đen/trắng ngoài ý muốn, `0` đoạn đứng hình, `0` frame giật (`pops`) và đạt chuẩn `-15.0 LUFS`.

---

## Bản quyền (`License`)
Phát hành theo giấy phép MIT (`LICENSE`).
