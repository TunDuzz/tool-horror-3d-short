# Workspace Rules: Horror Engine v11.0 ("Anchored POV-First · Studio Sync · Single Constitution")

Các quy tắc bắt buộc dưới đây được khóa đồng nhất từ `pipeline_constitution.json` và áp dụng cho mọi dự án video kinh dị ngắn (`150–360s`) và series nhiều tập (`480–960s`) trong workspace này:

## 1. Tách biệt tuyệt đối Engine và Project (Strict Engine Neutrality)
- **`shorts-project/src/engine/` là tầng hạ tầng 100% trung tính (20 module v5.0).** Tuyệt đối **CẤM** thêm phòng cụ thể, nhân vật, quái vật, ảnh thờ, thoại hay tọa độ cố định của bất kỳ kịch bản nào vào `src/engine/`.
- **Mỗi video là một thư mục độc lập `shorts-project/src/<project>/`** gồm 5 file chuẩn: `manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx` và đăng ký `<Composition />` trong `shorts-project/src/Root.tsx`. Tuyệt đối không import chéo giữa các dự án anh em (`src/<projectA>/` ↔ `src/<projectB>/`).
- **Đồng bộ Workspace an toàn bằng 1 lệnh:** Dùng `python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo` (và kiểm tra trôi bằng `--check`) — không bao giờ ghi đè thư mục dự án riêng của người dùng.

## 2. CẤM Lặp Bối Cảnh & BẮT BUỘC Tạo Hình Nhân Vật Theo Đúng Cốt Truyện
- **Chống lặp bối cảnh (`LocationBlueprint` + `ANTI_REPEAT_ERROR`):** Mọi địa điểm trong kịch bản bắt buộc phải được thiết kế mới bằng một `LocationBlueprint` độc bản trong `manifest.json` (`archetype`, kích thước thực `[w, d, h]`, `ceilingType`, vật liệu Albedo+BumpMap trong `paint.ts`, nguồn sáng thực, 3–5 đạo cụ anh hùng đúng chuyện, `signatureShadowBeat`) lắp ghép từ bộ kit mô-đun trong `build.ts`. Hai video không cùng chủ đề hoặc hai phần không quay lại địa điểm cũ sẽ bị `validate_manifest.py --registry LOCATION_REGISTRY.json` chặn cứng bằng **`ANTI_REPEAT_ERROR`** trừ khi có trường `"sameLocationOf": "<projectId>:<locationId>"`.
- **Ngoại hình Nhân vật / Thực thể 100% theo Cốt truyện (`CharacterBlueprint` + `ANTI_REPEAT_ENTITY_ERROR`):** Tuyệt đối **KHÔNG** áp đặt cứng một khuôn mặt quái vật kinh dị cơ thể, máu me hay khâu vá cho mọi video! Mọi nhân vật và thực thể phải khai báo trong `castBlueprints[]` (với `storyDescription` lấy trực tiếp từ `appearanceBrief` / `SCRIPT.md`) và dựng bằng `createCharacterFromBlueprint(bp)` — mọi cờ body-horror đều mặc định **TẮT** trừ khi cốt truyện mô tả rõ. Hệ thống chặn sao chép mẫu quái vật giữa hai video không liên quan bằng **`ANTI_REPEAT_ENTITY_ERROR`** trừ khi khai báo `"sameCharacterOf": "<projectId>:<charId>"` cho thực thể tái xuất có chủ đích.

## 3. Khóa Đồng Nhất 4 Tầng (`SceneManifest` + `shotsFromManifest` + `Anchored POV-First 2A`)
- **`manifest.json` (và `MANIFEST` trong `story.ts`) là nguồn chân lý duy nhất.** Khai báo cả `beats[]` và `shots[]` (`cameraMode`, `axisSide`, `startPhrase`, `endPhrase`, `visualBeatIndex`, `actionTriggerPhrase`) ngay trong `manifest.json`; trong `story.ts` bắt buộc xuất `export const SHOTS = shotsFromManifest(MANIFEST);` (tuyệt đối CẤM gõ tay mảng số frame cắt cảnh rời rạc!).
- **Ngữ pháp Điện ảnh Anchored POV-First (`2A`):** Bắt buộc mở đầu mỗi bối cảnh bằng `cameraMode: "master"` (`>= 60 frames`, `camMasterEstablish`) sáng rõ kiến trúc phòng (`Zero Black Void`), giữ `80–90%` thời lượng neo trong chuỗi POV liên tục (`camPovChain` xoay đầu mượt + bàn tay POV 2 đốt `fingerCurl` vươn bám tọa độ đạo cụ thật `worldTarget`), tối đa `1–2` cú `ots_same_side` trên trục 180° (`<= 22%` thời lượng, CẤM lật trục 180°!). Đặt `dialogueMode: "voiceOver"` cho nhân vật chính khi đọc `[NARRATOR]` (cấm nhép môi sai!).
- Luôn chạy `python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place` trước rồi chạy `python3 scripts/validate_manifest.py --strict-cinema` để khóa cứng timeline với sai số `<= 4 frames`.

## 4. Chuẩn Mỹ Thuật v5.0 (`psxHorror` Mặc Định `1A+2A+3A` & 5 Trụ Cột Maximum Dread)
- **Đồ họa mặc định `renderStyle="psxHorror"`:** Low-poly sắc cạnh + PS1 `vertexSnap` (`280`) + PBR BumpMap (11 cặp bề mặt) + SSAO + lưới điểm ảnh 360×640 Bayer 4×4 + scanline CRT giữ độ sáng + sóng băng VHS / `tapeTear` + `outlineMode: "off"`. Hỗ trợ chuyển linh hoạt sang `"semiReal"`, `"painterly"` hoặc `"comic"` theo gu từng truyện.
- **100% Nhân vật 3D & POV thật (Tầng `NOINK`):** Dùng `createCharacterFromBlueprint` tỷ lệ người lớn (`~5.6` đầu, 20 khớp, decal mặt 512×512) và `createPovRig3D` + `Phone3D` / `Flashlight3D`. Cấm thẻ 2D billboard, cấm chibi dễ thương, cấm nét gạch chéo nhiễu bẩn.
- **5 Trụ Cột Maximum Dread (100% Opt-In theo Beat):** `addCornerLurker3D` (bóng rình rập ngoài rìa khung `9:16`), `addSwarmingFlies3D` / `addBloodHandprintDecal3D` / `addIchorPoolDecal3D` / `addTalismanPaper3D` / `addHauntedPortrait3D` (ruồi nhặng & chi tiết dân gian/mục nát), `bodyHorror` theo cốt truyện (`mattedLongHair`, `suturesAndWounds`, `uncannySkullMask`), diễn xuất leo thang 3 bước (`doorwayPeek` → `stalkLoom` → `lungeCloseUp` + `jacobsLadderTwitch` / `torchMalfunction`), và `camcorder` HUD + `fogOverride` + `RetroPsxEffect.dreadLevel`.
- **Ánh sáng thực & Motion Blur Whip-Pan:** Dùng tối đa 6 `PointLight` thực (`setLocalLights`) + 1 `SpotLight` (`setSpotLight`) + Bloom HDR (`0.92`) + `getLightBlend`. Mọi cú ngoái đầu nhanh dùng `whipPan` + khai báo `WHIP_PANS` và `POV_MOTIONS` trong `story.ts`. Mỗi `locationId` nằm trong một `THREE.Group` riêng bật/tắt theo `beat.locationId` và reset trọn vẹn mỗi frame.

## 5. Giọng Đọc Neural Sạch, Căn Từ Whisper `< 35ms` (`1B`), Nhịp Thở `[VISUAL Xs]` (`3A`) & SFX `mix_cues.py --strict`
- Viết `SCRIPT.md` ở mật độ **`2.2–2.5 từ/giây`** (`45–105s`/chương), mở đầu bằng `[VISUAL 2.6s]` cho Master Establishing và chèn `[VISUAL 1.2–2.0s]` ở các hành động đạo cụ (giữ nguyên âm thanh môi trường + Foley), kèm `[DEAD SILENCE Xs]` (`-48 dB` chân không trước cao trào).
- Sinh giọng bằng `gen_horror_voice.py --tts-engine vieneu --speaker-lock --word-aligner auto --no-vc` (tự động căn mốc từ bằng `faster-whisper` `< 35ms` hoặc sóng âm `Acoustic Pause-Island` `< 80ms`), và trộn âm thanh qua `cues.json` + `mix_cues.py --strict` với SFX CC0 từ Openverse.

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
