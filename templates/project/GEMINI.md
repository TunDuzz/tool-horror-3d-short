# Workspace Rules: Horror Engine v5.0 ("PSX Low-Poly VHS/CRT & Maximum Dread POV")

Các quy tắc bắt buộc dưới đây áp dụng cho mọi dự án video kinh dị ngắn và series nhiều tập trong workspace này:

## 1. Tách biệt tuyệt đối Engine và Project (Strict Engine Neutrality)
- **`shorts-project/src/engine/` là tầng hạ tầng 100% trung tính (20 module v5.0).** Tuyệt đối **CẤM** thêm phòng cụ thể, nhân vật, quái vật, ảnh thờ, thoại hay tọa độ cố định của bất kỳ kịch bản nào vào `src/engine/`.
- **Mỗi video là một thư mục độc lập `shorts-project/src/<project>/`** gồm 5 file chuẩn: `manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx` và đăng ký `<Composition />` trong `shorts-project/src/Root.tsx`. Tuyệt đối không import chéo giữa các dự án anh em (`src/<projectA>/` ↔ `src/<projectB>/`).
- **Đồng bộ Workspace an toàn bằng 1 lệnh:** Dùng `python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo` (và kiểm tra trôi bằng `--check`) — không bao giờ ghi đè thư mục dự án riêng của người dùng.

## 2. CẤM Lặp Bối Cảnh & BẮT BUỘC Tạo Hình Nhân Vật Theo Đúng Cốt Truyện
- **Chống lặp bối cảnh (`LocationBlueprint` + `ANTI_REPEAT_ERROR`):** Mọi địa điểm trong kịch bản bắt buộc phải được thiết kế mới bằng một `LocationBlueprint` độc bản trong `manifest.json` (`archetype`, kích thước thực `[w, d, h]`, `ceilingType`, vật liệu Albedo+BumpMap trong `paint.ts`, nguồn sáng thực, 3–5 đạo cụ anh hùng đúng chuyện, `signatureShadowBeat`) lắp ghép từ bộ kit mô-đun trong `build.ts`. Hai video không cùng chủ đề hoặc hai phần không quay lại địa điểm cũ sẽ bị `validate_manifest.py --registry LOCATION_REGISTRY.json` chặn cứng bằng **`ANTI_REPEAT_ERROR`** trừ khi có trường `"sameLocationOf": "<projectId>:<locationId>"`.
- **Ngoại hình Nhân vật / Thực thể 100% theo Cốt truyện (`CharacterBlueprint` + `ANTI_REPEAT_ENTITY_ERROR`):** Tuyệt đối **KHÔNG** áp đặt cứng một khuôn mặt quái vật kinh dị cơ thể, máu me hay khâu vá cho mọi video! Mọi nhân vật và thực thể phải khai báo trong `castBlueprints[]` (với `storyDescription` lấy trực tiếp từ `appearanceBrief` / `SCRIPT.md`) và dựng bằng `createCharacterFromBlueprint(bp)` — mọi cờ body-horror đều mặc định **TẮT** trừ khi cốt truyện mô tả rõ. Hệ thống chặn sao chép mẫu quái vật giữa hai video không liên quan bằng **`ANTI_REPEAT_ENTITY_ERROR`** trừ khi khai báo `"sameCharacterOf": "<projectId>:<charId>"` cho thực thể tái xuất có chủ đích.

## 3. Khóa Đồng Nhất Kịch Bản ↔ Frame Render 3 Lớp (`SceneManifest` + `align_manifest.py`)
- **`manifest.json` (và `MANIFEST` trong `story.ts`) là nguồn chân lý duy nhất.** Mọi thay đổi địa điểm (`locationId`), sương mù ép cận (`fogOverride`), đèn bật/tắt (`lampsOn`), ánh trăng khe cửa/bóng chân, trạng thái nhân vật (`castStates`), điện thoại `Phone3D` (`clock`/tin nhắn) và lớp HUD (`hudFromManifest(MANIFEST)`, kể cả `camcorder`) trong `world.ts` bắt buộc đọc trực tiếp từ `beatAt(MANIFEST, frame)`.
- Luôn chạy `python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place` trước rồi chạy `python3 scripts/validate_manifest.py` để khóa cứng timeline, khớp thoại `SCRIPT.md` + `words.json` (`±0.35s`), đồng bộ giờ `Phone3D` ↔ HUD, và kiểm tra chỉ dùng đúng **5 preset ánh sáng vật lý** (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`).

## 4. Chuẩn Mỹ Thuật v5.0 (`psxHorror` Mặc Định `1A+2A+3A` & 5 Trụ Cột Maximum Dread)
- **Đồ họa mặc định `renderStyle="psxHorror"`:** Low-poly sắc cạnh + PS1 `vertexSnap` (`280`) + PBR BumpMap (11 cặp bề mặt) + SSAO + lưới điểm ảnh 360×640 Bayer 4×4 + scanline CRT giữ độ sáng + sóng băng VHS / `tapeTear` + `outlineMode: "off"`. Hỗ trợ chuyển linh hoạt sang `"semiReal"`, `"painterly"` hoặc `"comic"` theo gu từng truyện.
- **100% Nhân vật 3D & POV thật (Tầng `NOINK`):** Dùng `createCharacterFromBlueprint` tỷ lệ người lớn (`~5.6` đầu, 20 khớp, decal mặt 512×512) và `createPovRig3D` + `Phone3D` / `Flashlight3D`. Cấm thẻ 2D billboard, cấm chibi dễ thương, cấm nét gạch chéo nhiễu bẩn.
- **5 Trụ Cột Maximum Dread (100% Opt-In theo Beat):** `addCornerLurker3D` (bóng rình rập ngoài rìa khung `9:16`), `addSwarmingFlies3D` / `addBloodHandprintDecal3D` / `addIchorPoolDecal3D` / `addTalismanPaper3D` / `addHauntedPortrait3D` (ruồi nhặng & chi tiết dân gian/mục nát), `bodyHorror` theo cốt truyện (`mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`), diễn xuất leo thang 3 bước (`doorwayPeek` → `stalkLoom` → `lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`), và `camcorder` HUD + `fogOverride` + `RetroPsxEffect.dreadLevel`.
- **Ánh sáng thực & Motion Blur Whip-Pan:** Dùng tối đa 6 `PointLight` thực (`setLocalLights`) + 1 `SpotLight` (`setSpotLight`) + Bloom HDR (`0.92`) + `getLightBlend`. Mọi cú ngoái đầu nhanh dùng `whipPan` + khai báo `WHIP_PANS` và `POV_MOTIONS` trong `story.ts`. Mỗi `locationId` nằm trong một `THREE.Group` riêng bật/tắt theo `beat.locationId` và reset trọn vẹn mỗi frame.

## 5. Giọng Đọc Neural Sạch v6.0 (`VieNeu-TTS` 48kHz / `IndexTTS-2` GPU / So-VITS-SVC `-na`), SFX Thật & TRUE Dead Silence `-48 dB`
- Viết `SCRIPT.md` **liền mạch theo 2–4 hồi/đoạn** (`[NARRATOR | mood=calm_omen|curious|tense|whisper|fear|dread|panic|cold_twist]`, `[SPEAKER: ... | fx=dry|room|phone|ghost]`, `[PAUSE Xs]`, `[DEAD SILENCE Xs]`). **CẤM chẻ vụn kịch bản thành hàng chục đoạn rời rạc và CẤM dùng DSP nhiễu/rung giả cảm xúc gây rè!**
- Nguồn giọng 100% Free & Open-Source: chạy ngay **`VieNeu-TTS v3 Turbo`** 48 kHz ONNX CPU (`--tts-engine vieneu`, hỗ trợ clone 3–8s `--ref-audio` / `--emotion-refs` và thẻ `[thở dài]`/`[hắng giọng]`), hoặc xuất gói máy GPU (`--export-gpu-voice-pack` cho **`dinhthuan/index-tts-2-vietnamese`** / `F5-TTS-Vietnamese` → `--import-acts`), hoặc quy trình 1-file So-VITS-SVC (`-na`).
- Ưu tiên **SFX thu âm thật CC0 / Neural SFX** quản lý bằng `sfx_manager.py` (`Freesound CC0`, `declare-lab/TangoFlux`, `hkchengrex/MMAudio`) nạp qua `mix_base.load_sfx_asset(...)`, kết hợp nền trầm sạch (`sub_drone`/`riser`/`stinger`) và bắt buộc truyền `dead_silences=load_dead_silences(words_json)` vào `master_mix(...)` cho TRUE `-48 dB` Dead Silence!

## 6. Cổng Kiểm Duyệt Pre-Final Still Gate & Post-Render QA (Hard Gates)
- **Beat-by-Beat Pre-Final Still Gate:** Chạy:
  ```bash
  REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompositionId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
  ```
  rồi **tự mở xem trực tiếp 100% ảnh bằng `read_file`** để đối chiếu kịch bản ↔ frame (đúng bối cảnh, đúng đèn tắt/bật, ngoại hình nhân vật đúng mô tả truyện, không lộ quái sớm, không kẹt tay/tóc che màn hình `Phone3D`, Whip-Pan có blur ngang rõ rệt, không cháy sáng).
- **Post-Render QA Gate & Tăng tốc GPU / Bảo vệ ổ đĩa:**
  - Dùng `node scripts/render-video.mjs <CompId> out/<project>/video.mp4 --scale 1` (tự dò GPU NVIDIA `angle-egl`, fallback `swangle`, tự dọn bundle tạm; hỗ trợ `--draft`).
  - Đặt `REMOTION_TMP=/tmp/remotion-tmp` (Linux/macOS) hoặc `$env:REMOTION_TMP="D:/remotion-tmp"` (Windows). Chỉ dùng `--scale 0.5`, `1`, `1.25` hoặc `1.5` (tuyệt đối không dùng `--scale 1.3333`).
  - Ghép âm thanh bằng `ffmpeg -map 0:v:0 -map 1:a:0`.
  - Chạy `extract_shots.py` + `short_qa.py` xác nhận `0` frame đen/trắng ngoài kế hoạch, `0` frozen `>= 12f`, `0` unplanned `pops`, `DIRECTING_WARNS none`, không cảnh báo quá tối (`p98 >= 0.34, mean >= 0.065`), và xem trực tiếp `sheet_*.jpg`.
