# Workspace Rules: Horror Engine v3 ("3D Stylized Dark-Horror POV")

Các quy tắc bắt buộc dưới đây áp dụng cho mọi dự án video kinh dị ngắn và series nhiều tập trong workspace này:

## 1. Tách biệt tuyệt đối Engine và Project (Strict Engine Neutrality)
- **`shorts-project/src/engine/` là tầng hạ tầng 100% trung tính (18 module v3).** Tuyệt đối **CẤM** thêm phòng cụ thể, nhân vật, quái vật, ảnh thờ, thoại hay tọa độ cố định của bất kỳ kịch bản nào vào `src/engine/`.
- **Mỗi video là một thư mục độc lập `shorts-project/src/<project>/`** gồm 5 file chuẩn: `manifest.json`, `story.ts`, `build.ts`, `world.ts`, `index.tsx` và đăng ký `<Composition />` trong `shorts-project/src/Root.tsx`. Tuyệt đối không import chéo giữa các dự án anh em (`src/<projectA>/` ↔ `src/<projectB>/`).

## 2. CẤM Lặp Lại Bối Cảnh Giữa Các Video / Phần Không Liên Quan (Anti-Repetition Gate)
- **Xóa bỏ hoàn toàn mẫu phòng gỗ hộp cũ & 6 đạo cụ ép buộc của v2.**
- Mọi địa điểm trong kịch bản bắt buộc phải được thiết kế mới bằng một **`LocationBlueprint`** riêng trong `manifest.json` (`archetype`, kích thước thực `[w, d, h]`, `ceilingType`, bộ 3 vật liệu từ 16 texture sạch trong `paint.ts`, nguồn sáng thực, 3–5 đạo cụ anh hùng đúng chuyện, `signatureShadowBeat`) và lắp ghép từ bộ kit mô-đun trong `build.ts`.
- **Không được lặp lại bối cảnh** giữa hai video không cùng chủ đề hoặc giữa hai phần (Part) không quay lại cùng một địa điểm. Mọi dự án phải chạy qua `validate_manifest.py --registry LOCATION_REGISTRY.json` — hệ thống sẽ chặn cứng bằng lỗi **`ANTI_REPEAT_ERROR`** nếu trùng kiến trúc/vật liệu mà không có trường tường minh `"sameLocationOf": "<projectId>:<locationId>"` (chỉ được phép khi kịch bản thật sự quay lại đúng không gian cũ).

## 3. Khóa Đồng Nhất Kịch Bản ↔ Frame Render 3 Lớp (`SceneManifest`)
- **`manifest.json` (và `MANIFEST` trong `story.ts`) là nguồn chân lý duy nhất.** Mọi thay đổi địa điểm (`locationId`), đèn bật/tắt (`lampsOn`), ánh trăng khe cửa/bóng chân (`doorMoonlight`/`feetShadow`), trạng thái nhân vật (`castStates`), điện thoại `Phone3D` (`clock`/tin nhắn) và lớp HUD (`hudFromManifest(MANIFEST)`) trong `world.ts` bắt buộc phải đọc trực tiếp từ `beatAt(MANIFEST, frame)`.
- Bắt buộc chạy `python3 scripts/validate_manifest.py` trước khi render để khóa cứng dòng thời gian, khớp thoại `SCRIPT.md` + `words.json` (`±0.35s`), đồng bộ giờ `Phone3D` ↔ HUD, và kiểm tra chỉ dùng đúng **5 preset ánh sáng vật lý v3** (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight` — cấm tuyệt đối `blood`).

## 4. Chuẩn Mỹ Thuật 3D Dark-Horror POV (Phi-Chibi, Nét Viền Sạch, Whip-Pan Blur)
- **100% Nhân vật 3D & POV thật:** Dùng `createCharacter3D` tỷ lệ người lớn gầy rợn (`~5.6` đầu, hàm/mũi 3D, decal mặt 512×512 mắt hạnh nhân đồng tử thu nhỏ, `EntityConfig` bẻ cổ/tay dài/tóc phủ/mắt phát sáng HDR) và `createPovRig3D` + `Phone3D` / `Flashlight3D`. Cấm quay lại thẻ 2D billboard (`toon.ts`/`cast.ts`), cấm tỷ lệ chibi dễ thương, cấm `Pen.grit`, `cross-hatching` và `gradeGrime`.
- **Tách lớp viền tuyệt đối (`NOINK`):** Toàn bộ nhân vật, thực thể và đạo cụ POV phải nằm trên layer `NOINK` (layer 3) dùng viền Inverted-Hull pháp tuyến mượt `~5–7 px`; kiến trúc nằm trên layer 0 dùng `InkPass` sạch — tuyệt đối không để viền kép hoặc bể góc.
- **Ánh sáng thực & Motion Blur Whip-Pan:** Dùng tối đa 6 `PointLight` thực (`setLocalLights`) + 1 `SpotLight` (`setSpotLight`) + Bloom HDR (`0.92`) + chuyển cảnh mất đèn mượt (`getLightBlend`). Mọi cú ngoái đầu nhanh dùng `whipPan` + khai báo `WHIP_PANS` (và `POV_MOTIONS` cho động tác giơ đạo cụ gần ống kính) trong `story.ts`.
- **Cô lập `LocationGroup` & Thuần khiết theo frame:** Mỗi `locationId` nằm trong một `THREE.Group` riêng bật/tắt theo `beat.locationId`; mỗi frame reset trọn vẹn sky, fog, lights, `setSpotLight`, và đạo cụ.

## 5. Cổng Kiểm Duyệt Pre-Final Still Gate & Post-Render QA (Hard Gates)
- **Beat-by-Beat Pre-Final Still Gate:** Chạy:
  ```bash
  REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompositionId> out/<project>/stills/b_ --manifest out/<project>/still_manifest.json 1
  ```
  (và render thêm frame giữa các cú `whipPan`) rồi **tự mở xem trực tiếp 100% ảnh bằng `read_file`** để đối chiếu kịch bản ↔ frame (đúng bối cảnh, đúng đèn tắt/bật, không lộ quái sớm, không kẹt tóc/tay che màn hình `Phone3D`, Whip-Pan có blur ngang rõ rệt, không cháy sáng áo trắng).
- **Post-Render QA Gate & Bảo vệ ổ đĩa:**
  - Đặt `REMOTION_TMP=/tmp/remotion-tmp` (Linux/macOS) hoặc `$env:REMOTION_TMP="D:/remotion-tmp"` (Windows) và xóa sạch bundle tạm sau khi render.
  - Chỉ dùng `--scale 1`, `--scale 1.25` hoặc `--scale 1.5` (tuyệt đối không dùng `--scale 1.3333`).
  - Ghép âm thanh bằng `ffmpeg -map 0:v:0 -map 1:a:0`.
  - Chạy `extract_shots.py` + `short_qa.py` xác nhận `0` frame đen/trắng ngoài kế hoạch, `0` frozen `>= 12f`, `0` unplanned `pops`, `DIRECTING_WARNS none`, không cảnh báo quá tối (`p98 >= 0.34, mean >= 0.065`), và xem trực tiếp `sheet_*.jpg`.

## 6. Lớp HUD Kể Chuyện Mặc Định
- `HorrorHUD` (header đồng hồ/ngày, thẻ thông báo đồng bộ `Phone3D`, phụ đề speaker pill, time-skip, thẻ chọn) là **tùy chọn (opt-in)** thông qua `hudFromManifest(MANIFEST)` — chỉ bật khi kịch bản/người dùng yêu cầu.
