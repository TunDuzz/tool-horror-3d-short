# Workspace Rules: Cartoon 3D Shorts Engine & Clean-Slate World Building

Các quy tắc bắt buộc dưới đây áp dụng cho mọi dự án video ngắn trong workspace này (đặc biệt khi dùng skill `cartoon-3d-short`):

## 1. Tách biệt tuyệt đối Engine và Project (Zero Legacy Leakage)
- **`shorts-project/src/engine/` là tầng hạ tầng 100% trung tính.** Tuyệt đối **CẤM** thêm tài sản, trang phục, mũ/vũ khí/đạo cụ riêng, công trình, cờ, tọa độ cố định hay timeline của bất kỳ dự án cụ thể nào vào `src/engine/`.
- **Mỗi video là một thư mục độc lập `shorts-project/src/<project>/`** gồm các file chuẩn: `story.ts`, `world.ts`, `build.ts`, `toon.ts`, `cast.ts`, `index.tsx` và đăng ký `<Composition />` trong `shorts-project/src/Root.tsx`. Tuyệt đối không import chéo giữa các dự án anh em (`src/<projectA>/` ↔ `src/<projectB>/`).
- **Mở rộng nhân vật không chạm Engine:** Mũ, trang phục, phụ kiện và đạo cụ riêng của từng kịch bản phải viết trong `src/<project>/toon.ts` thông qua các hook trên `Outfit` (`hatBehind`, `hatOn`, `torsoDetail`, `behindBody`, `inFrontHand`) truyền vào `bodyFront` / `bodySide`, không sửa `src/engine/toon.ts`.
- **Tư liệu tham khảo chỉ đọc (Read-Only):** Không sửa, xóa hoặc import code từ `.agents/skills/cartoon-3d-short/templates/` và `references/`. Không xuất bản, gửi ra ngoài hay nhắc tên kênh tham khảo trong kịch bản hoặc metadata.

## 2. Cô lập bối cảnh đa thời kỳ/địa điểm (`EraGroup`) & Thuần khiết theo frame
- Nếu kịch bản đi qua nhiều thời kỳ hoặc địa điểm tách biệt, **bắt buộc đóng gói từng bối cảnh thành một `THREE.Group` độc lập** (`eraGroup1`, `eraGroup2`, ...) và bật/tắt `group.visible` theo `shotId` trong `world.update(shotId, f, cam, scene)`.
- Mỗi lần gọi `world.update()` phải đồng bộ và reset **trọn vẹn cả môi trường lẫn thực thể động**: mặt đất/mặt nước, sky/fog/lighting (`syncLighting`), đạo cụ tiền cảnh (`FOREGROUND`), và **ẩn toàn bộ `Actor` / `Fx` / contact blobs không sử dụng** trong shot hiện tại.
- `world.update(shotId, f, cam, scene)` phải **thuần khiết (idempotent theo `shotId, f`)**, không dựa vào biến trạng thái toàn cục thay đổi giữa các instance `World`. Khi crossfade (`XFADE`) mount 2 `<ThreeCanvas>` cùng lúc, mỗi world phải giữ ánh sáng/uniform độc lập qua `syncLighting` (không để shot sau đè màu shot trước).
- Raycast kiểm tra tia nhìn (`inTheWay`) chỉ dùng để tránh camera xuyên tường/cây **ngay trong cùng một era**, tuyệt đối không dùng thay cho việc cô lập bằng `EraGroup`.

## 3. Cổng kiểm duyệt Hình ảnh & QA bắt buộc (Hard Gates)
- **Pre-Final Still Gate:** Trước khi render video cuối, bắt buộc chạy:
  ```powershell
  node scripts/render-stills.mjs <CompositionId> out/<project>/stills/s_ <frames> 0.5
  ```
  phủ **100% số shot** (tối thiểu 1 frame đại diện mỗi shot; với shot camera lướt dài phải kiểm thêm frame đầu/giữa/cuối). **Bắt buộc tự mở xem trực tiếp từng ảnh still bằng tool `read_file`** để xác nhận:
  1. Không sót bất kỳ vật thể/kiến trúc/nền đất nào lệch thời kỳ hoặc lạc từ shot khác;
  2. Viền mực 3D (`InkPass`) hiện rõ, không mất nét hay bao khung quanh billboard nhân vật;
  3. Ánh sáng & bóng đổ hai tông đúng preset, không xám bệt hay cháy tối;
  4. Nhân vật đứng chạm đất (có contact shadow), không bị cắt ngang ngực/đầu bởi lan can hay vật cản;
  5. Tiền cảnh sắc nét hợp lý, không biến thành mảng mờ vô nghĩa chắn rìa khung.
  Nếu phát hiện lỗi, phải sửa triệt để và render still kiểm tra lại đạt 100% rồi mới được render final.
- **Post-Render QA Gate & Bảo vệ ổ đĩa:**
  - Luôn đặt `REMOTION_TMP=D:/remotion-tmp` (tránh đầy ổ C khi Remotion bundle `public/`).
  - Ghép âm thanh bằng `ffmpeg -map 0:v:0 -map 1:a:0` (vì track audio của Remotion bị câm).
  - Chạy `python scripts/extract_shots.py src/<project>/story.ts out/<project>/shots.json` và `python scripts/short_qa.py <final.mp4> out/<project>/qa out/<project>/shots.json` để xác nhận 0 frame đen/trắng bất thường, 0 đoạn đóng băng ≥12f, 0 giật khung `pops`, và đạt chuẩn độ ồn.

## 4. Ngôn ngữ & Phụ đề mặc định
- Mặc định **không chèn chữ/phụ đề** lên màn hình trừ khi người dùng yêu cầu rõ.
- Ngôn ngữ kịch bản, giọng đọc và nội dung thoại tuân theo yêu cầu cụ thể của người dùng cho từng video.
