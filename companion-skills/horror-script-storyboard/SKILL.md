---
name: horror-script-storyboard
description: Use when writing high-retention oral-folklore Vietnamese horror scripts (v14.0: 0.1s immediate Cold Hook, colloquial regional speech + platform-safe strong exclamations, crisp 2.55-3.05 w/s effective / 3.15-3.45 w/s spoken cadence, [BEAT Xs], [SILENCE_DROP Xs]), generating 48kHz multi-cast neural voice via VieNeu-TTS --speaker-lock, or directing cold_hook -> master -> Anchored POV storyboards verified via storyboard_proof.html.
---

# Horror Scriptwriting & High-Retention Storyboarding v14.0 (`SCRIPT.md` → `manifest.json` → `story.ts`)

## 1. Luật Viết `SCRIPT.md` Thực Chiến v14.0 (`1–5s Cold Hook + Khẩu Ngữ Truyền Miệng Việt Nam`)

1. **Nổ Thoại Ngay Ở `0.05s – 0.25s` (CẤM Khoảng Lặng Đầu Video!):**
   - **TUYỆT ĐỐI KHÔNG** đặt `[VISUAL 2.6s]` ở dòng đầu `SCRIPT.md` và **TUYỆT ĐỐI KHÔNG** mở màn bằng thời tiết, ngày tháng hay giới thiệu bản thân (*"Đêm cuối năm 2003, gió bấc rít..."*).
   - Dòng đầu tiên phải là **Đòn Cold Hook `1–5s` (`<= 24 từ`)**: một nghịch lý vật chứng đang diễn ra trước mắt, một câu quát cấm kỵ gắt của nhân vật phụ, một khoảnh khắc sinh tử tua ngược, hoặc lời thú nhận rợn gáy kiểu truyền miệng.
2. **Khẩu Ngữ Đời Thật, Phương Ngữ 3 Miền & Ngôn Từ Mạnh Hợp Lý (`platform_safe_raw`):**
   - Viết như **người thật ngồi kể chuyện ma đêm khuya**: câu ngắn, gãy gọn, sát hành động vật lý; dùng đúng xưng hô và từ vựng vùng miền (`Bắc`: *tôi/ông/bà/cơ mà/im thít/lạnh sun người*; `Trung`: *tau/mi/răng/rứa/khỉ gió*; `Nam`: *tui/mày/tụi bây/ổng/bả/thiệt tình/im re*).
   - Cho phép nhân vật buột miệng tự nhiên các thán từ cảm thán mạnh đúng tâm lý hoảng sợ/bức bối (`1–3` lần/phút): **`"Mẹ kiếp"`**, **`"Chết tiệt"`**, **`"Chó chết"`**, **`"Bỏ mẹ rồi"`**, **`"Tổ cha nó"`**, **`"Khỉ gió"`**, **`"Má ơi"`**, **`"Mặc xác nó"`** — tuyệt đối tránh văn viết sáo rỗng kiểu AI (*"một cảm giác lạnh lẽo bao trùm"*, *"bất giác tôi nhận ra"*) và tránh từ tục nhạy cảm vi phạm chính sách nền tảng.
3. **Nhịp Giọng Nhanh Gọn, Không Rề Rà (`pipeline_constitution.json` v14.0):**
   - Tốc độ mục tiêu: **`2.55–3.05 words/s` tổng (`3.15–3.45 words/s` khi nói, trần `3.65 words/s`)** — nhanh và cuốn hơn bản cũ ~`0.5–1.0s` mỗi câu!
   - Chỉ đặt `[BEAT 0.18–0.28s]` ngay trước từ khóa đắt giá nhất; đặt `[VISUAL 0.9–1.5s]` ở nhịp chuyển hành động **sau** giây thứ 5; và đặt `[SILENCE_DROP 1.1–1.4s]` ngay trước cú lật tâm lý cuối.
4. **Mẫu `SCRIPT.md` Chuẩn v14.0 (`~60s` Viral Short — Vào Thẳng Biến Cố Ngay Giây `0.05`):**
   ```markdown
   [NARRATOR | mood=tense]
   Mẹ kiếp... [BEAT 0.22s] cái điện thoại bàn trước mặt tôi vừa đổ chuông, dù sợi dây đồng dưới gầm bàn đã bị cắt đứt từ ba tháng trước.

   [NARRATOR | mood=calm_omen]
   Tối nay tôi nhận trực thế ở khu nội trú B2 sắp đập bỏ để lấy ba trăm nghìn tiền ca đêm. Lúc bàn giao chìa khóa ở cửa hành lang, bà Hạnh quản lý đã chỉ thẳng tay vào cái máy bàn cảnh báo:

   [SPEAKER: BÀ HẠNH | profile=elder_female_north | mood=tense | fx=room]
   Này, khóa chết cái chốt sắt vào! Máy bàn cắt dây từ hôm niêm phong phòng hai lẻ bốn rồi... [BEAT 0.24s] đêm nó có chập mạch kêu cạch cái nào thì mặc xác nó, cấm được nhấc!

   [VISUAL 1.10s]

   [NARRATOR | mood=uneasy]
   Bà Hạnh vừa khuất cuối hành lang là tôi sập chốt đồng lại ngay. Cơ mà đúng 02:15... tiếng quả lắc đồng hồ trên tường tự dưng khựng chết đứng. Cái máy bàn đen xì trước mặt nảy lên đúng một hồi chuông cụt lủn.

   [SILENCE_DROP 1.20s]

   [SPEAKER: TIẾNG TRONG MÁY | profile=young_female_north | mood=whisper | fx=phone | prox=close]
   Phòng hai lẻ bốn... đứa nào khóa ngoài rồi anh ơi...

   [NARRATOR | mood=cold_twist | prox=close]
   Bỏ mẹ rồi... [BEAT 0.25s] tay tôi run bần bật áp ống nghe, mắt nhìn xuống chân tường mới điếng người: đầu dây đồng đứt lìa đóng trắng xóa bụi mốc... [BEAT 0.25s] [PACE=slow | PITCH=-0.9] còn trên bảng gỗ trước mặt, riêng chiếc thẻ khóa phòng hai lẻ bốn... vẫn đang tự đung đưa.

   [VISUAL 2.00s]
   ```

---

## 2. Tổng Hợp Giọng Đọc Đa Nhân Vật `48 kHz` (`gen_horror_voice.py` v14.0)

```bash
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md \
  --tts-engine vieneu --speaker-lock --word-aligner auto --strict-hook \
  --out-dir out/<project>/voice --no-vc
```
- Tự động phân vai riêng biệt cho mọi `[SPEAKER: ...]` trên 25 giọng Bắc – Trung – Nam của `VieNeu-TTS`, giữ nguyên độ động thật giữa giọng quát căng (`tense` `-17 dBFS`) và giọng thì thầm sát tai (`whisper` `-24 dBFS`), đồng thời cảnh báo `[HOOK WARN]` nếu từ đầu tiên trễ quá `0.45s`.

---

## 3. Ngữ Pháp Điện Ảnh `cold_hook → master → Anchored POV` & Khóa Khung Hình 5 Lớp

1. **Mở Cảnh Giữ Chân 5 Giây Đầu (`cameraMode: "cold_hook"` → `"master"`):**
   - **`Shot 1` (`cameraMode: "cold_hook"`, `1.0–5.5s`, `POV_CU` / `POV_PROP` / `POV`):** Đập thẳng vật chứng hoặc hành động gây tò mò vào khung hình ngay giây `0.0` khớp với câu Hook!
   - **`Shot 2` (`cameraMode: "master"`, `>= 60 frames`, `camMasterEstablish`):** Mở rộng ra toàn cảnh căn phòng với tường/đèn rõ nét (`Zero Black Void`) để khán giả nắm bố cục không gian ngay trong câu Snap Context.
   - **`Shot 3..N` (`80–90%` `camPovChain` + tối đa `1–2` `ots_same_side` `<= 22%` thời lượng):** Giữ liền mạch trong đôi mắt nhân vật chính với bàn tay 2 khớp `PovRig3D` (`worldTarget`), tuân thủ nghiêm trục 180° và `dialogueMode: "voiceOver"` cho lời kể nội tâm.
2. **Khóa Tự Động & Kiểm Định Cổng 5 Lớp (`storyboard_proof.html`):**
   ```bash
   python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
   python3 scripts/validate_manifest.py src/<project>/manifest.json \
     --script out/<project>/SCRIPT.md \
     --words out/<project>/voice/words.json \
     --cues out/<project>/cues.json \
     --strict-cinema --strict-retention \
     --registry LOCATION_REGISTRY.json --update-registry \
     --still-out out/<project>/still_manifest.json
   REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs <CompId> out/<project>/stills/s_ \
     --manifest out/<project>/still_manifest.json --scale 0.75 --strict-audit
   ```
   Tạo `storyboard_proof.html` và bắt buộc `100%` keyframe vượt qua kiểm định 5 lớp trước khi xuất MP4.

## Công Thức Theo Thể Loại & Đa Tập

Xem [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) cho bộ khung kịch bản thực chiến của cả 3 dòng truyện chủ lực và cấu trúc nối tập Series.
