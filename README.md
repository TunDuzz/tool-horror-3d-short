# Horror 3D Short & Series Skill Suite v14.0
**(`Viral 1–5s Cold Hook · Khẩu Ngữ Truyền Miệng · Crisp Neural Voice · Psychological Soundscape · Anchored POV 3D`, Three.js + Remotion)**

Bộ **6 AI Agent Skills + Engine 3D + Automation Pipeline** hoàn chỉnh chuyên sản xuất video kinh dị 3D tiếng Việt (**Viral Short `55–90s`**, **Standalone Story `2.5–6 phút`**, và **Multi-Part Series `8–16 phút`**) chuẩn dọc `9:16` (`1080×1920`) hoặc ngang `16:9` (`1920×1080`).

Toàn bộ kiến trúc được khóa bởi **Hiến pháp Duy nhất ([templates/pipeline_constitution.json](./templates/pipeline_constitution.json) `v14.0.0`)** — bảo đảm đồng nhất 100% từ ý tưởng truyện → kịch bản thoại → giọng đọc → không gian âm thanh → diễn xuất 3D → dựng hình & QA.

---

## Điểm Nổi Bật Của Phiên Bản Mới Nhất (`v14.0`)

1. **Móc Giữ Chân `1–5s Cold Hook` & Ngôn Ngữ Truyền Miệng Đời Thật (`horror-story` v3.2 + Gate 26):**
   - **Cấm mở bài chậm / chết lặng:** Tuyệt đối bỏ màn `[VISUAL 2.6s]` im ắng hay kể lể năm tháng/thời tiết (*"Đêm cuối năm 2003..."*). Câu đầu & âm thanh môi trường vào ngay **`0.05–0.25s`** (`<= 24 từ`), đánh thẳng bằng 4 khuôn mẫu: `paradox_prop`, `blunt_taboo_dialogue`, `flash_forward_crisis`, `raw_confession`.
   - **Khẩu ngữ dân gian 3 miền & Thán từ đời thật (`platform_safe_raw`):** Tùy chọn vùng miền (`north` / `central` / `south`) và mức cảm thán mạnh an toàn nền tảng (*"Mẹ kiếp"*, *"Chó chết"*, *"Bỏ mẹ rồi"*, *"Tổ cha nó"*, *"Má ơi"*), đồng thời chặn cứng văn mẫu AI sáo rỗng (*"một cảm giác lạnh lẽo bao trùm"*) và từ tục vi phạm chính sách nền tảng qua **Gate 26**.
   - **2 Chế độ Nhịp Kể (`pacingProfile`):** Hỗ trợ cả `viral_short` (`55–90s`, mở nút thắt mỗi `8–14s`) lẫn `deep_story` (`2.5–10 phút`, nhiều hồi/tập), mặc định nhịp nhanh giữ chân cao.

2. **Giọng Đọc Sắc Gọn `3.10–3.55 từ/s` + Tự Động Phân Vai 25 Giọng (`gen_horror_voice.py` v14.0):**
   - Tối ưu nhịp `clean_tempo` (`0.76–0.89`), `tail_pad` (`0.12–0.23s`), `lead_silence` `0.05s` và cờ `--strict-hook` giúp tốc độ phát âm đạt **`3.10–3.55 từ/s`** (`2.55–3.05 từ/s` hiệu dụng) — nhanh gọn, sắc nét (~0.5–0.9s nhanh hơn bản cũ), vẫn giữ trọn dynamic 6–8 dB giữa thì thầm sát tai và thoại căng thẳng.
   - Chạy `VieNeu-TTS` ONNX 48 kHz offline + `--speaker-lock` + ngân hàng 8 sắc thái thuần Việt (`prepare_emotion_refs.py build-vn-horror-bank`) + `faster-whisper` Forced Word Alignment (`< 35ms`) + tự động chọn 25 giọng Bắc/Trung/Nam cho nhân vật phụ (`fx=adjacent_muffled` qua cửa/kính). Hỗ trợ xuất gói GPU `IndexTTS-2` / `F5-TTS` / `So-VITS-SVC`.

3. **Âm Thanh Kể Chuyện Tâm Lý & Kỷ Luật `0-Jumpscare` (`mix_cues.py` · `-16.0 LUFS`):**
   - Nỗi sợ đến từ sự việc, ngữ điệu và không gian âm thanh sống cùng truyện — **mặc định `max_jumpscares = 0`** (chỉ bật có lý do chính đáng).
   - Thiết kế **2 lớp nền tách vai** (`near` trong phòng + `far` ngoài trời tự lọc trầm `automation` khi đóng cửa), bắt buộc có âm lặp **`motifs[]`** biết đổi nhịp hoặc tắt bặt (`steady_then_stop`, `decelerate`, `approach`, `stutter_break`), 4 vùng không gian (`close_ear` binaural ITD, `room`, `adjacent_muffled`, `exterior_occluded`), và **`[SILENCE_DROP Xs]` Uncanny Hush** rút sâu nền môi trường kích thích người nghe lắng tai.
   - Tích hợp **Openverse 5.2M Audio API (`cc0`/`pdm`)** kiểm định bản quyền & xuất tự động `credits.txt` + `mix_report.md`.

4. **Engine 3D Trung Tính `21 Module` · `cold_hook → master` · Kiểm Định Ảnh 5 Tầng (`storyboard_proof.html`):**
   - Đồ họa mặc định `psxHorror` (PS1 `vertexSnap` + PBR BumpMap 11 cặp bề mặt + SSAO + Bayer 4×4 CRT/VHS) và chuyển mượt sang `semiReal`, `painterly`, `comic`.
   - Ngữ pháp điện ảnh `cold_hook` (Shot #1 `<= 180f`) nối ngay `master` (`>= 60f`, Zero Black Void) → `80–90%` chuỗi POV liên tục (`camPovChain`, bàn tay POV 2 đốt `fingerCurl` + `worldTarget`) + trục 180°.
   - **Cổng Kiểm Duyệt 5 Lớp Trước Render (`render-stills.mjs --strict-audit`):** Chiếu tia 3D 9-Ray Occlusion, vùng an toàn `9:16`, giới hạn che khuất foreground, khóa nét DOF và độ sáng từng vật thể 3D → xuất **`storyboard_proof.html`**.
   - **Chống lặp tuyệt đối (`LOCATION_REGISTRY.json`):** Chặn trùng kiến trúc & tạo hình quái vật rập khuôn (`ANTI_REPEAT_ERROR`, `ANTI_REPEAT_ENTITY_ERROR`).

---

## Cấu Trúc Gói Kỹ Năng (`Package Structure`)

| Thành phần | Chức năng chính |
|---|---|
| [SKILL.md](./SKILL.md) | Kỹ năng điều phối chính `horror-3d-short` v14.0 (quy trình 11 bước end-to-end) |
| [INSTALL_GUIDE.md](./INSTALL_GUIDE.md) | **Hướng dẫn cài đặt & sử dụng chi tiết từ A–Z** (Linux / macOS / Windows, GPU/CPU, quy trình chạy & xử lý lỗi) |
| [companion-skills/](./companion-skills/) | 5 kỹ năng chuyên sâu: `horror-story` (26 cổng Gate), `horror-script-storyboard`, `horror-world-lookdev`, `horror-audio-sfx`, `horror-series-pipeline` |
| [templates/pipeline_constitution.json](./templates/pipeline_constitution.json) | Hiến pháp kỹ thuật duy nhất (`v14.0.0`) kiểm soát toàn bộ Python, TypeScript & Skills |
| [templates/engine/](./templates/engine/) | **21 module Three.js + Remotion trung tính** (`camera.ts`, `lights.ts`, `manifest.ts`, `sceneAudit.ts`, `stage.ts`, `povRig.ts`, `rig3d.ts`, `bodyHorror.ts`, `retroPsx.ts`, `ShortPlayer.tsx`, `HorrorHUD.tsx`, ...) |
| [templates/scripts/](./templates/scripts/) | Toàn bộ CLI tự động hóa: `sync_workspace.py`, `horror_story.py` v3.2, `gen_horror_voice.py` v14.0, `align_manifest.py`, `validate_manifest.py`, `sfx_manager.py`, `mix_cues.py`, `render-stills.mjs`, `audit_storyboard.py`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py` |
| [templates/audio/](./templates/audio/) | Thư viện tổng hợp & xử lý DSP 48 kHz (`dsp.py`, `horror_instruments.py`, `mix_base.py`) |
| [templates/horror-lab-v3/](./templates/horror-lab-v3/) | Project chuẩn tham chiếu cho Engine 3D |
| [examples/may-noi-bo-204-v14/](./examples/may-noi-bo-204-v14/) | Kịch bản v14.0 (`SCRIPT_v14.md`), `cues_v14.json`, `mix_report_v14.md` và mã nguồn 3D mẫu từ case test *"Máy Nội Bộ 204"* |
| [references/](./references/) | Bộ chuẩn kỹ thuật (`HORROR_FORMULAS.md`, `HORROR_STYLE_BIBLE.md`, `LIGHTING_AND_PALETTE.md`, `READABILITY_AND_QA.md`, `SOUND_CUES_COOKBOOK.md`, `SERIES_ARCHITECTURE.md`) |
| [tests/](./tests/) | Bộ test tự động Python (`unittest`) + TypeScript (`node --test`) |

---

## Cài Đặt Nhanh (`Quickstart`)

Xem hướng dẫn đầy đủ tại **[INSTALL_GUIDE.md](./INSTALL_GUIDE.md)**:

```bash
# 1. Cài đặt skill chính & 5 companion skills vào workspace hoặc ~/.agents/skills/
git clone https://github.com/TunDuzz/tool-horror-3d-short.git ~/.agents/skills/horror-3d-short
cp -r ~/.agents/skills/horror-3d-short/companion-skills/* ~/.agents/skills/

# 2. Tạo/đồng bộ workspace sản xuất `shorts-project/`
python3 ~/.agents/skills/horror-3d-short/templates/scripts/sync_workspace.py \
  --target shorts-project --include-demo --gemini-out shorts-project/GEMINI.md

# 3. Cài thư viện Node.js & Python
cd shorts-project
npm install && npx tsc --noEmit
pip install -r requirements.txt
pip install vieneu faster-whisper
```

---

## Bản Quyền (`License`)
Phát hành theo giấy phép MIT ([LICENSE](./LICENSE)).
