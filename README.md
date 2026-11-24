# Horror 3D Short & Series Skill Suite v5.0 (`PSX Low-Poly VHS/CRT & Maximum Dread POV`, Three.js + Remotion)

Bộ kỹ năng (AI Agent Skills) hoàn chỉnh chuyên sản xuất video hoạt hình kinh dị 3D ngắn (`~55–75 giây`, dọc `9:16` hoặc ngang `16:9`) và series kinh dị nhiều phần bằng **Horror Engine v5.0** — kết hợp thẩm mỹ **PSX Low-Poly VHS/CRT (`1A+2A+3A`)**, **5 trụ cột Maximum Dread tùy biến theo cốt truyện**, **giọng đọc đa sắc thái & quy trình 1-file So-VITS-SVC Expressive VC-Pack (`-na`)**, và **TRUE Dead Silence `-48 dB`**:

* **Đồ họa PSX Low-Poly VHS/CRT Mặc định + 4 Chế độ Chuyển Đổi (`retroPsx.ts`, `paint.ts`, `ShortPlayer.tsx`):** Mặc định `renderStyle="psxHorror"` (hình khối góc cạnh + PS1 `vertexSnap` + **11 cặp bề mặt Albedo/BumpMap** + **SSAO** + lưới pixel 360×640 Bayer 4×4 + CRT scanline bảo toàn độ sáng + sóng băng VHS/`tapeTear` + `outlineMode: "off"`), cho phép đổi mượt sang `"semiReal"`, `"painterly"` hoặc `"comic"` tùy cốt truyện.
* **Tạo hình Nhân vật & Thực thể 100% Theo Cốt Truyện (`CharacterBlueprint` + `createCharacterFromBlueprint` + `bodyHorror.ts`):** Mọi cờ kinh dị cơ thể đều mặc định **TẮT** — chỉ kích hoạt các chi tiết thực sự có trong mô tả cốt truyện (`storyDescription` / `appearanceBrief`), từ người thường, bóng mờ im lặng cho tới thực thể dân gian dị dạng (`mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`, `jawDrop3D`, `crookedTeeth`, `clawHands`, `extraArms`). Chặn nhân bản mẫu quái vật giữa các video không liên quan bằng cổng **`ANTI_REPEAT_ENTITY_ERROR`**.
* **5 Trụ Cột Maximum Dread (Opt-In Theo Nhịp Beat):** (A) Bóng rình rập ngoài rìa `addCornerLurker3D`, (B) Ruồi nhặng `addSwarmingFlies3D` & bộ trang trí dân gian/mục nát (`addBloodHandprintDecal3D`, `addIchorPoolDecal3D`, `addTalismanPaper3D`, `addOtherworldGrimeDecal3D`, `addHauntedPortrait3D`), (C) Giải phẫu kinh dị cơ thể theo cốt truyện, (D) Leo thang hành vi 3 bước `doorwayPeek → stalkLoom → lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`, và (E) Camcorder `● REC` VHS HUD + `fogOverride` ép cận + sóng băng `RetroPsxEffect.dreadLevel`.
* **Góc nhìn Thứ nhất POV, Ánh sáng Vật lý 5 Preset & Whip-Pan Motion Blur (`povRig.ts`, `lights.ts`, `motionblur.ts`):** Nhìn xuống thấy chân/đầu gối; hai tay POV cầm `Phone3D` (màn hình khóa HDR Bloom đồng bộ giờ/tin nhắn 100% với HUD), `Flashlight3D` (`SpotLight` 3D thực), `HandheldOilLamp3D`, `PaperProp3D`; 5 preset ánh sáng (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), tối đa 6 `PointLight` + 1 `SpotLight` + Whip-Pan GPU Motion Blur 13-tap xác định.
* **Giọng Đọc Diễn Xuất v5.5 (10 Moods · Vi-Nhịp Điệu Từng Từ · So-VITS-SVC 1-File VC-Pack `gen_horror_voice.py`):** **10 hồ sơ diễn xuất** (`calm_omen`, `curious` lên giọng tò mò, `tense`, `whisper` hơi gió 8-band vocoder thật, `fear_tremble` run thanh quản 6.2 Hz, `stutter_panic` lắp bắp âm tiết thật, `dread` chậm dần cuối câu, `panic`, `cold_twist` + nuốt khan, `ghost_entity`), biên độ nhịp độ rộng **`0.68x .. 1.32x`**, thẻ đạo diễn inline (`[STUTTER]` / `K-không`, `[SLOW]`/`[FAST]`, `[TREMBLE]`, `[UP]`, `[BEAT]`, `[GASP]`, `[SWALLOW]`), backend cắm rời `--tts-engine auto|edge|gemini` (Free Tier Gemini 2.5 Flash TTS + fallback 0đ `edge-tts`), và quy trình **2 máy So-VITS-SVC chỉ chép đúng 1 file `.wav`** dùng cờ **`-na`** (True Whisper Vocoder áp hậu kỳ bước 3!).
* **TRUE Dead Silence `-48 dB` & 27 SFX Kinh Dị Thuần Python (`mix_base.py`, `horror_instruments.py`):** Cắt chân không `-48 dB` tự động trên cả nhạc nền lẫn tiếng môi trường tại mọi thẻ `[DEAD SILENCE Xs]`, kèm 4 SFX v5.0 mới (`vhs_static_burst`, `flashlight_click_sputter`, `neck_crack_wet`, `fly_buzz_loop`).
* **Khóa Kịch bản ↔ Frame 3 Lớp & Tự Động Hóa Pipeline (`align_manifest.py`, `validate_manifest.py`, `sync_workspace.py`):** Tự động khớp `manifest.json` với `words.json`, kiểm định chống lặp cả bối cảnh (`ANTI_REPEAT_ERROR`) lẫn thực thể (`ANTI_REPEAT_ENTITY_ERROR`), đồng bộ workspace bằng 1 lệnh an toàn không đụng thư mục truyện riêng.

Đã kiểm chứng thực tế trên GPU NVIDIA (Full HD `1080×1920`, `HorrorLabV3Vertical` 300 frame — `0` lỗi frame đen/trắng/đứng hình/pop, `DIRECTING_WARNS none`) cùng đầy đủ kiểm thử tự động TypeScript & Python.

---

## Cấu trúc gói kỹ năng (`What's Inside`)

| Đường dẫn | Mô tả chi tiết |
|---|---|
| `SKILL.md` | Kỹ năng chính `horror-3d-short` v5.0: quy trình 11 bước, luật chống lặp bối cảnh & thực thể, khóa `SceneManifest`, So-VITS-SVC 1-file VC-Pack, Pre-Final `--manifest` Still Gate & Post-Render QA |
| `companion-skills/horror-story/` | Thiết kế & kiểm định cốt truyện kinh dị 2 vòng (14 cổng chất lượng, `appearanceBrief` theo cốt truyện, 5 preset ánh sáng vật lý) |
| `companion-skills/horror-script-storyboard/` | Kịch bản đa sắc thái `[NARRATOR \| mood=...]` / `[SPEAKER \| fx=...]`, So-VITS-SVC VC-Pack `-na`, `align_manifest.py` & `story.ts` |
| `companion-skills/horror-world-lookdev/` | `LocationBlueprint`, `CharacterBlueprint` theo cốt truyện, `psxHorror` mặc định (`1A+2A+3A`), 5 trụ cột Maximum Dread, POV Rig & ánh sáng thực |
| `companion-skills/horror-audio-sfx/` | Giọng đọc đa sắc thái, TRUE Dead Silence `-48 dB`, 27 SFX kinh dị thuần Python DSP (`-15.0 LUFS`) |
| `companion-skills/horror-series-pipeline/` | Kiến trúc sản xuất series dài nhiều phần (`p01..p10`) chống tràn context, khóa `ANCHORS`, `sameLocationOf` & `sameCharacterOf` |
| `templates/engine/` | **Horror Engine v5.0 trung tính (20 module):** `camera.ts`, `lights.ts`, `manifest.ts`, `shade.ts`, `outline3d.ts`, `ink.ts`, `motionblur.ts`, `lensblur.ts`, `grade.ts`, `retroPsx.ts`, `paint.ts`, `build.ts`, `face2d.ts`, `bodyHorror.ts`, `rig3d.ts`, `povRig.ts`, `fx3d.ts`, `HorrorHUD.tsx`, `ShortPlayer.tsx`, `index.ts` |
| `templates/horror-lab-v3/` | Dự án kiểm chứng trực quan **3 bối cảnh & 5 trụ cột Dread v5.0** (`HorrorLabV3Vertical` `9:16` & `HorrorLabV3Wide` `16:9`) |
| `templates/scripts/` | Bộ công cụ tự động hóa & QA đa nền tảng: `sync_workspace.py`, `align_manifest.py`, `validate_manifest.py`, `gen_horror_voice.py`, `horror_story.py`, `render-stills.mjs`, `render-video.mjs`, `extract_shots.py`, `short_qa.py`, `stitch_parts.py`, `validate_continuity.py` |
| `templates/audio/` | Thư viện tổng hợp âm thanh kinh dị v5.0 (`dsp.py`, `horror_instruments.py` 27 SFX, `mix_base.py` TRUE Dead Silence) |
| `templates/project/` | Cấu hình workspace (`package.json`, `tsconfig.json`, `requirements.txt`, `Root.tsx`, `index.ts`, `GEMINI.md`) |
| `references/` | Chuẩn kỹ thuật v5.0 (`HORROR_STYLE_BIBLE.md`, `LIGHTING_AND_PALETTE.md`, `READABILITY_AND_QA.md`, `HORROR_FORMULAS.md`, `SOUND_CUES_COOKBOOK.md`, `SERIES_ARCHITECTURE.md`) |
| `tests/` | Bộ kiểm thử tự động Engine v5.0, Voice/Audio DSP, Pipeline & Hygiene (`engine_*.test.ts`, `test_scripts_v3.py`, `test_phase2_pipeline.py`) |

---

## Hướng dẫn cài đặt (`Installation`)

### 1. Cài đặt vào thư mục Skills của Agent (Antigravity / Claude Code)
```bash
git clone https://github.com/TunDuzz/tool-horror-3d-short.git .agents/skills/horror-3d-short
cp -r .agents/skills/horror-3d-short/companion-skills/* .agents/skills/
```

### 2. Khởi tạo hoặc Cập nhật Workspace `shorts-project/` bằng 1 Lệnh Duy Nhất (Linux / macOS / Windows)
```bash
python3 .agents/skills/horror-3d-short/templates/scripts/sync_workspace.py \
  --target shorts-project --include-demo --gemini-out GEMINI.md
cd shorts-project
npm install && npm run typecheck
pip install -r requirements.txt
```
*(Lệnh `sync_workspace.py` chạy được trên cả Linux, macOS và Windows PowerShell, kiểm tra trôi bằng `--check`, và **tuyệt đối không đụng vào thư mục dự án riêng `src/<truyen-cua-ban>/`**.)*

### 3. Quy trình 3 bước Giọng Dẫn Chuyện So-VITS-SVC 2 Máy (Giữ 100% Cảm Xúc!)
```bash
# Bước 1 (Máy này): Xuất 1 file dẫn giọng giàu ngữ điệu + script chạy sẵn -na
python3 shorts-project/scripts/gen_horror_voice.py \
  --script out/<du-an>/SCRIPT.md --export-vc-pack out/<du-an>/vc_pack

# Bước 2 (Máy So-VITS-SVC): Chạy run_svc_win.bat / run_svc_unix.sh (dùng cờ -na!) -> nhận 1 file narrator_svc_out.wav

# Bước 3 (Máy này): Lắp ghép chính xác từng mẫu + lồng thoại nhân vật + tiếng thở + EQ cảm xúc
python3 shorts-project/scripts/gen_horror_voice.py \
  --script out/<du-an>/SCRIPT.md \
  --vc-pack out/<du-an>/vc_pack \
  --narrator-vc-wav out/<du-an>/vc_pack/narrator_svc_out.wav \
  --out-dir out/<du-an>/voice
```

### 4. Chạy kiểm thử tự động & kiểm chứng `HorrorLabV3`
```bash
# Unit test Engine v5.0 + Voice/Audio DSP + Pipeline + Hygiene
node --import ./tests/ts-loader.mjs --test tests/*.test.ts
python3 -m unittest discover -s tests -v

# Kiểm định SceneManifest & render still chuẩn theo từng nhịp beat
python3 shorts-project/scripts/validate_manifest.py shorts-project/src/horror-lab-v3/manifest.json --still-out /tmp/v5_stills.json
cd shorts-project
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs HorrorLabV3Vertical out/horror-lab-v3/stills/b_ --manifest /tmp/v5_stills.json 1
```

---

## Lưu ý quan trọng (`Hard Rules & Disk Safety`)
1. **Không lặp bối cảnh & Không rập khuôn ngoại hình quái vật:** Mọi dự án mới phải khai báo `LocationBlueprint` + `CharacterBlueprint` (bám sát mô tả cốt truyện) và vượt qua cổng `LOCATION_REGISTRY.json` (`ANTI_REPEAT_ERROR` & `ANTI_REPEAT_ENTITY_ERROR`).
2. **Đồng nhất Kịch bản ↔ Frame:** Dùng `align_manifest.py` khóa beat vào `words.json`, điều khiển `world.ts` và `HorrorHUD` từ `MANIFEST`, và kiểm tra 100% ảnh `--manifest` bằng mắt trước khi render video cuối.
3. **Quản lý thư mục tạm & Scale hợp lệ:** Đặt `REMOTION_TMP=/tmp/remotion-tmp` (Linux/macOS) hoặc `$env:REMOTION_TMP="D:/remotion-tmp"` (Windows) và xóa thư mục tạm sau khi render. Chỉ dùng `--scale 1`, `1.25`, hoặc `1.5`.

---

## Bản quyền (`License`)
Phát hành theo giấy phép MIT (`LICENSE`).
