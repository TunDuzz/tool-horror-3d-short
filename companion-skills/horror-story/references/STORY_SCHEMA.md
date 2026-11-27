# Horror Story Schema v3.2 (`story.json` · Chuẩn Kịch Bản Triệu View v15 & `VieNeu-TTS 1.0x`)

Toàn bộ thế giới quan, phương ngữ vùng miền, đòn mở màn `0–5s` không lộ bài (`coldHook`), lõi cảm xúc con người, lớp âm thanh tự nhiên (`soundscapeDesign` + `scoreArc`), mặt bằng 2D và bảng blocking hành động đều gói gọn trong `story.json` (`schemaVersion: "3.2"`), kiểm định tự động qua **26 Cổng Chất Lượng** trong `scripts/horror_story.py`.

*(Tương thích ngược đầy đủ với `schemaVersion: "1.0"`, `"2.0"`, `"3.0"` và `"3.1"`.)*

## Chế Độ Nhịp (`params.pacingProfile`) & Định Dạng (`params.format`)

| `pacingProfile` | `format` | Tổng thời lượng | Số chương | Nhịp kể (`VieNeu-TTS 1.0x`) | Jumpscare bắt buộc |
|---|---|---|---|---|---|
| **`viral_short`** *(Mặc định `<= 120s`)* | `micro` / `short` | **`55s–120s`** | `1–2` | Thoại nổ ngay `0.05–0.25s` (`coldHook`), `2.35 w/s` tổng (`2.25–3.25 w/s` khi nói), mỗi beat `<= 15s` | **`1–2`** cú đồng bộ AV (thực thể bậc 4–7) |
| **`deep_story`** *(Mặc định `> 120s`)* | `short` / `series` | **`150s–960s`** *(2.5–16p)* | `3–15` | Chương 1 mở bằng `coldHook` `0–5s` → Đường cong răng cưa đa hồi & lật kèo manh mối | **`>= 1`** cú / chương (`<= 2` / chương) |

## Cấu Trúc JSON Chuẩn (`schemaVersion: "3.2"` — Đồng Bộ v15)

```json
{
  "schemaVersion": "3.2",
  "title": "Đôi Dép Úp Trước Bậu Cửa",
  "lang": "vi",
  "params": {
    "format": "micro",
    "mode": "standalone",
    "pacingProfile": "viral_short",
    "parts": 1,
    "secondsPerPart": 70,
    "targetTotalSec": 70,
    "wordsPerSecond": 2.35,
    "aspect": "9:16",
    "seamlessStitch": false,
    "genre": "folklore",
    "adaptMode": "original",
    "thresholds": {
      "maxLeads": 5,
      "maxSupport": 10,
      "maxFunctional": 10,
      "maxProps": 8,
      "maxBeatGap": 1,
      "maxPrimaryScenes": 3,
      "minJumpscaresTotal": 1,
      "maxJumpscaresTotal": 2
    }
  },
  "narrativeStyle": {
    "pov": "first_person_survivor",
    "dialectRegion": "north",
    "gritLevel": "clean_folklore",
    "narratorVoice": "Giọng kể truyền miệng điềm tĩnh, chân thực, giàu cảm xúc con người (VieNeu-TTS 1.0x sạch)",
    "dialogueDensity": "balanced_dialogue",
    "toneKeywords": ["giọng kể điềm tĩnh đời thật", "hook sạch 0-5s không lộ bài", "lõi cảm xúc con người", "leo thang 3 tầng", "kết lật dư âm ám ảnh"],
    "forbiddenCliches": ["Dạo đầu thời tiết/ngày tháng rườm rà", "Lộ đáp án cú lật sớm", "Chửi thề gượng gạo", "Văn mẫu AI sáo rỗng", "Hóa ra chỉ là giấc mơ"]
  },
  "soundscapeDesign": {
    "nearBed": { "sound": "room_tone_dark", "label": "Tiếng phòng nhà ống ẩm thấp đêm mưa" },
    "farBed": { "sound": "night_rain_indoor", "label": "Mưa rả rích ngoài ngõ hẹp (không ép occlusionTrigger nếu truyện không đóng chốt cửa)" },
    "scoreArc": {
      "act1": "sad_piano_minimal",
      "act2": "dark_drone_pressure",
      "aftermath": "cold_sub_drone_tail"
    },
    "motifs": []
  },
  "premise": {
    "core": "Người cháu ghé nhà bà ngoại ăn cơm tối muộn phát hiện đôi dép nhựa của bà bị úp ngược trước cửa buồng, trong khi tiếng bà vẫn gọi ra ăn từ trong bếp",
    "entityRule": "Dép trong nhà tự úp ngược trước ngưỡng cửa nghĩa là người trong buồng không còn là người nhà nữa",
    "twistCore": "Mẹ gọi báo bà đã nhập viện cấp cứu từ bốn giờ chiều — vậy thứ vừa bới cơm và gọi cháu trong bếp suốt nãy giờ là ai"
  },
  "parts": [
    {
      "part": 1,
      "act": 1,
      "title": "Bữa cơm giữ ấm",
      "target_sec": 70,
      "light": "warmLamp",
      "pacingType": "escalation",
      "tensionStart": 4,
      "tensionPeak": 10,
      "tensionEnd": 9,
      "newInfoRevealed": "Tiếng gọi quen thuộc trong bếp không khớp với đôi dép úp ngược và tin nhắn cấp cứu của mẹ",
      "coldHook": {
        "hookArchetype": "direct_taboo_question",
        "openingLine": "Người già hay dặn: về nhà đêm mà thấy đôi dép trong buồng tự úp ngược trước bậu cửa, đừng bao giờ gọi tên người ở trong.",
        "openingSoundCue": "rain_on_roof"
      },
      "hook": "Lời kiêng kỵ dân gian về đôi dép úp ngược trước bậu cửa",
      "synopsis": "Minh chạy xe về ăn bữa cơm bà ngoại để phần sau ca làm thêm. Ban đầu cậu cười gạt chi tiết đôi dép úp ngược, cho đến khi tiếng bà trong bếp lặp lại cùng một câu y hệt máy ghi âm và bóng lưng cao bất thường đứng sát góc tường.",
      "suspense": "Tin nhắn của mẹ báo bà nhập viện từ bốn giờ chiều, còn tiếng muỗng chạm bát trong bếp vừa dừng bặt.",
      "sceneIds": ["S01"],
      "characterIds": ["C01", "C02"],
      "propIds": ["P01"],
      "soundCues": ["rain_on_roof", "bowl_clink_kitchen"],
      "actionBeats": []
    }
  ]
}
```

## Tóm Tắt 26 Cổng Kiểm Định (`horror_story.py validate`)

- **Cổng 1–14 (Cốt truyện nền):** `premise-core`, `char-tier-caps`, `char-arcs`, `scene-cap`, `scene-reuse`, `prop-purpose`, `beat-major`, `beat-spacing`, `reveal-discipline`, `part-duration`, `prose-only`, `hook-suspense`, `referential-integrity`, `horror-cues`.
- **Cổng 15–18 (Mặt bằng 2D & Blocking 3D):** `char-appearance-brief`, `scene-spatial-floorplan`, `action-blocking-continuity`, `horror-pacing-jumpscare-cap` (`minJumpscaresTotal >= 1`).
- **Cổng 19–24 (Chiều sâu Tâm lý, Manh mối & Xuyên chương):** `format-duration-budget`, `world-lore-and-entity-rules`, `character-depth-and-stakes` (`trappedReason`), `clue-twist-economy`, `multi-act-tension-curve`, `cross-part-continuity-and-dialogue-briefs`.
- **Cổng 25 (`v3.1+` · Đã gỡ trói trong v15 — `psychological-soundscape-and-subtext`):** Cấm văn kể hộ cảm xúc (`Anti-Exposition`), tôn trọng `"requireAcousticMotif": false` (tự do để `motifs: []` và không ép `occlusionTrigger`; chỉ kiểm cấu trúc motif nếu tác giả chủ động khai báo), và yêu cầu giải trình `jumpscareReason` rõ ràng cho cú Jumpscare.
- **Cổng 26 (`v3.2+` — `viral-hook-and-oral-authenticity`):**
  1. **Cấm dạo đầu thời tiết / ngày tháng / tên tuổi** ở `P1.hook`, `P1.coldHook.openingLine` và `P1_AB1.spokenBeat.keyPhrase`.
  2. **Cấm khoảng lặng đầu video (`visualBeforeSec < 0.45s` ở `P1_AB1`)** và bắt buộc câu mở màn gọn sắc (`<= 26 từ`) theo 1 trong 3 kiểu Hook sạch không lộ bài (`immediate_danger` | `direct_taboo_question` | `survivor_confession`, tương thích ngược các mã cũ).
  3. **Chặn văn mẫu sáo rỗng kiểu AI** (*"một cảm giác lạnh lẽo bao trùm"*, *"bất giác tôi nhận ra"*, *"tựa hồ như"*), mặc định giọng kể điềm tĩnh tự nhiên (`clean_folklore` — không ép quota chửi thề).
  4. **Luật giữ chân 15s (`viral_short`):** Mọi `actionBeat` trong chế độ `viral_short` phải `<= 15.5s` để nhịp chuyện đi đều, không tả cảnh thừa.
