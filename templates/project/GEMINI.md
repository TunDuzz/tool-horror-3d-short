# Workspace Rules: Horror Engine v2 ("Gothic Ink-Noir × Shadow-Depth")

Các quy tắc bắt buộc dưới đây áp dụng cho mọi dự án video kinh dị ngắn và series nhiều tập trong workspace này:

## 1. Tách biệt tuyệt đối Engine và Project (Strict Engine Neutrality)
- **`shorts-project/src/engine/` là tầng hạ tầng 100% trung tính.** Tuyệt đối **CẤM** thêm đạo cụ, trang phục, quái vật, công trình hay tọa độ cố định của bất kỳ kịch bản cụ thể nào vào `src/engine/`.
- **Mỗi video là một thư mục độc lập `shorts-project/src/<project>/`** gồm các file chuẩn: `story.ts`, `world.ts`, `build.ts`, `toon.ts`, `cast.ts`, `index.tsx` và đăng ký `<Composition />` trong `shorts-project/src/Root.tsx`. Tuyệt đối không import chéo giữa các dự án anh em (`src/<projectA>/` ↔ `src/<projectB>/`).
- **Mở rộng nhân vật không chạm Engine:** Mũ, tóc, trang phục, vết bẩn và đạo cụ cầm tay riêng của từng kịch bản phải viết trong `src/<project>/toon.ts` thông qua các hook trên `Outfit` (`hatBehind`, `hatOn`, `torsoDetail`, `behindBody`, `inFrontHand`).

## 2. Cô lập bối cảnh (`EraGroup`) & Thuần khiết theo frame
- Mỗi bối cảnh/thời kỳ tách biệt bắt buộc đóng gói trong một `THREE.Group` độc lập (`eraGroup1`, `eraGroup2`, ...) và bật/tắt `group.visible` theo `shotId` trong `world.update()`.
- Mỗi lần gọi `world.update()` và `world.syncLighting()` phải đồng bộ trọn vẹn môi trường lẫn thực thể động: sky/fog/lighting (`applyLightUniforms`), **nguồn sáng thực `setLocalLights(...)`**, `setLightningFlash(...)`, đạo cụ tiền cảnh, và ẩn toàn bộ `Actor` / `Fx` không dùng trong shot hiện tại.

## 3. Luật Đạo diễn Hình ảnh Bắt buộc (Non-Negotiable Directing Rules)
1. **Cấm chết dí 1 góc máy (No-Repeat-Angle Rule):** Tuyệt đối không để 2 shot liên tiếp dùng cùng một góc nhìn hoặc cùng cỡ cảnh (`scale`). Mỗi lần cắt shot phải đổi rõ rệt góc máy (`>= 30°`) hoặc đổi cỡ cảnh (`WS` → `OTS` → `LOW` → `MCU` → `ECU` → `CU` → `Reverse WS`). Cấm "jump-cut đổi filter màu" trên cùng một khung hình.
2. **Không dựng thế giới "hộp Lego" & chân trời phẳng:** Không dùng hình hộp phẳng cho mái nhà, thuyền, cây hay đèn. Bắt buộc dùng bộ hình học hữu cơ (`pitchedRoofGeo`, `taperedBoxGeo`, `addGnarledTree`, `addReedCluster`, `addDistantRidge`, `addStormLantern3D`, `addSampanHull`, `addVolumetricShaft`) và đặt **lớp tiền cảnh silhouette đen (`addForegroundSilhouette`)** ở các shot rộng để tạo chiều sâu.
3. **Diễn xuất khớp từng động từ (Action-to-Narration Binding):** Không để nhân vật đứng đơ `idle` xuyên suốt lời dẫn. Mọi động từ hành động (*bước tới, cúi soi, giật lùi, chộp lấy, chạy trốn, cài then cửa, ngoái đầu nhìn lại*) phải diễn bằng đúng `Action` (`creep`, `peer`, `recoil`, `lunge`, `flee`, `boltDoor`, `emerge`) + `bodyBack` / `glance` + `shiver` + `time`.
4. **Kỷ luật giấu quái vật (Horror Reveal Discipline):** Không bao giờ lộ rõ thực thể kinh dị ngay Shot 1 (Cold Hook). Dẫn dắt theo thang căng thẳng: dấu hiệu bất thường → bóng/chi tiết bộ phận (`ECU`) → `[DEAD SILENCE]` → lộ diện bùng nổ cùng ánh sáng thực.
5. **Ánh sáng có động cơ & Decal đúng phối cảnh:** Mọi nguồn sáng cầm tay/nội thất phải gắn `setLocalLights(...)` chiếu thực lên nhân vật và môi trường; mọi dấu chân, vòng sóng nước, vũng bùn bắt buộc dùng `pushFlatDecal` (`flat: true`), tuyệt đối không dựng dọc billboard quay về camera.

## 4. Cổng kiểm duyệt Art Director Still Gate & Post-Render QA (Hard Gates)
- **Pre-Final Still Gate:** Trước khi render video cuối, bắt buộc chạy `node scripts/render-stills.mjs <CompositionId> out/<project>/stills/s_ <frames> 0.5` phủ **100% số shot** (và thêm frame đầu/giữa/cuối cho shot dài/chớp sét) rồi **tự mở xem trực tiếp từng ảnh bằng `read_file`** theo checklist tại `READABILITY_AND_QA.md`. Từ chối và sửa ngay nếu còn bất kỳ lỗi nào về góc máy lặp, chân trời trống, nhân vật cứng đơ, sương bị cắt sàn hay FX sai phối cảnh.
- **Post-Render QA Gate & Bảo vệ ổ đĩa:**
  - Trên Windows đặt `REMOTION_TMP=D:/remotion-tmp`; trên Linux/macOS đặt `REMOTION_TMP=/tmp/remotion-tmp` (và dọn sạch bundle tạm sau khi render).
  - Chỉ dùng `--scale 1`, `--scale 1.25` hoặc `--scale 1.5` (tránh `--scale 1.3333` gây lỗi kích thước không nguyên của Remotion 4).
  - Ghép âm thanh bằng `ffmpeg -map 0:v:0 -map 1:a:0`.
  - Chạy `extract_shots.py` + `short_qa.py` xác nhận `0` frame đen/trắng bất thường, `0` frozen `>= 12f`, `0` pops, `DIRECTING_WARNS none`, và đạt chuẩn `-15.0 LUFS`.

## 5. Ngôn ngữ & Phụ đề mặc định
- Mặc định **không chèn chữ/phụ đề** lên màn hình trừ khi người dùng yêu cầu rõ.
