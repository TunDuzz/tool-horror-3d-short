# Horror Story Schema v3.2 (`story.json` · Viral 1–5s Hook & Oral Folklore Studio)

Toàn bộ thế giới quan, phương ngữ vùng miền, đòn mở màn `1–5s` (`coldHook`), không gian âm thanh sống (`soundscapeDesign`), tâm lý nhân vật, kinh tế manh mối, mặt bằng 2D và bảng blocking hành động + thoại khẩu ngữ đều gói gọn trong `story.json` (`schemaVersion: "3.2"`), kiểm định tự động qua **26 Cổng Chất Lượng** trong `scripts/horror_story.py`.

*(Tương thích ngược đầy đủ với `schemaVersion: "1.0"`, `"2.0"`, `"3.0"` và `"3.1"`.)*

## Chế Độ Nhịp (`params.pacingProfile`) & Định Dạng (`params.format`)

| `pacingProfile` | `format` | Tổng thời lượng | Số chương | Nhịp mở màn & giữ chân | Trần Jumpscare |
|---|---|---|---|---|---|
| **`viral_short`** *(Mặc định `<= 120s`)* | `micro` / `short` | **`55s–120s`** | `1–2` | Thoại nổ ngay `0.05–0.25s` (`coldHook`), mỗi beat `<= 15s`, kết gắt | **`0`** mặc định *(tối đa `<= 1` có lý do)* |
| **`deep_story`** *(Mặc định `> 120s`)* | `short` / `series` | **`150s–960s`** *(2.5–16p)* | `3–15` | Chương 1 mở bằng `coldHook` `1–5s` → Đường cong răng cưa đa hồi & manh mối | `<= 1` (`short`) · `<= 2` (`series`) |

## Cấu Trúc JSON Chuẩn (`schemaVersion: "3.2"`)

```json
{
  "schemaVersion": "3.2",
  "title": "Máy Nội Bộ 204",
  "lang": "vi",
  "params": {
    "format": "micro",
    "mode": "micro",
    "pacingProfile": "viral_short",
    "parts": 1,
    "secondsPerPart": 65,
    "targetTotalSec": 65,
    "wordsPerSecond": 2.65,
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
      "maxJumpscaresTotal": 0
    }
  },
  "narrativeStyle": {
    "pov": "first_person_survivor",
    "dialectRegion": "north",
    "gritLevel": "platform_safe_raw",
    "narratorVoice": "Giọng nam miền Bắc truyền miệng đời thật gọn sắc, vào thẳng biến cố ngay giây đầu (Thiện Minh)",
    "dialogueDensity": "balanced_dialogue",
    "toneKeywords": ["khẩu ngữ truyền miệng đời thật", "hook sốc 1-5s đầu", "văn hóa vùng miền", "0 Jumpscare rẻ tiền"],
    "forbiddenCliches": ["Dạo đầu thời tiết/ngày tháng rườm rà", "Văn viết sáo rỗng kiểu AI", "Hóa ra chỉ là giấc mơ"]
  },
  "soundscapeDesign": {
    "nearBed": { "sound": "fluorescent_buzz", "label": "Chấn lưu đèn tuýp cũ rè nhẹ trong phòng trực" },
    "farBed": {
      "sound": "wind_howl_night",
      "label": "Gió bấc ngoài hành lang tự đục trầm khi sập chốt cửa",
      "occlusionTrigger": { "atWord": "chốt", "lpHz": 520, "gainDeltaDb": -6.5 }
    },
    "motifs": [
      {
        "id": "m_clock",
        "sound": "clock_ticking",
        "intervalSec": 1.05,
        "mode": "decelerate",
        "meaning": "Đồng hồ quả lắc đếm nhịp rồi chậm dần và chết đứng lúc 02:15",
        "breakBeatId": "P1_AB4"
      }
    ]
  },
  "premise": {
    "core": "Sinh viên nhận trực đêm khu nội trú cũ nghe tiếng con gái gọi cứu từ chiếc điện thoại bàn đã cắt dây ba tháng trước",
    "entityRule": "Tuyệt đối không nhấc ống nghe máy nội bộ bàn trực sau nửa đêm",
    "twistCore": "Dây đồng dưới gầm bàn đã đứt phủ bụi trắng từ lâu, còn chìa khóa phòng 204 niêm phong trước mặt đang tự đung đưa"
  },
  "parts": [
    {
      "part": 1,
      "act": 1,
      "title": "Cuộc gọi không dây nối",
      "target_sec": 65,
      "light": "fluorescent",
      "pacingType": "escalation",
      "tensionStart": 5,
      "tensionPeak": 9,
      "tensionEnd": 9,
      "newInfoRevealed": "Chiếc máy nội bộ reo lên dù dây nối đã bị cắt đứt từ đợt niêm phong phòng 204",
      "coldHook": {
        "hookArchetype": "paradox_prop",
        "openingLine": "Mẹ kiếp... cái điện thoại bàn trước mặt tôi vừa đổ chuông, dù dây đồng dưới gầm bàn đã bị cắt đứt từ ba tháng trước.",
        "openingSoundCue": "old_phone_ring"
      },
      "hook": "Tiếng chuông điện thoại cắt dây nổ ngay giây đầu tiên",
      "synopsis": "Vừa nhận bàn giao ca trực từ bà Hạnh và sập chốt sắt cửa hành lang, Huy nghe quả lắc đồng hồ khựng đứng lúc 02:15 rồi chiếc máy bàn đã cắt dây bỗng reo lên.",
      "suspense": "Thẻ khóa đỏ phòng 204 tự đung đưa trên bảng gỗ trong căn phòng đóng kín",
      "sceneIds": ["S01"],
      "characterIds": ["C01", "C02"],
      "propIds": ["P01"],
      "soundCues": ["old_phone_ring", "clock_ticking"],
      "actionBeats": []
    }
  ]
}
```

## Tóm Tắt 26 Cổng Kiểm Định (`horror_story.py validate`)

- **Cổng 1–14 (Cốt truyện nền):** `premise-core`, `char-tier-caps`, `char-arcs`, `scene-cap`, `scene-reuse`, `prop-purpose`, `beat-major`, `beat-spacing`, `reveal-discipline`, `part-duration`, `prose-only`, `hook-suspense`, `referential-integrity`, `horror-cues`.
- **Cổng 15–18 (Mặt bằng 2D & Blocking 3D):** `char-appearance-brief`, `scene-spatial-floorplan`, `action-blocking-continuity`, `horror-pacing-jumpscare-cap`.
- **Cổng 19–24 (Chiều sâu Tâm lý, Manh mối & Xuyên chương):** `format-duration-budget`, `world-lore-and-entity-rules`, `character-depth-and-stakes` (`trappedReason`), `clue-twist-economy`, `multi-act-tension-curve`, `cross-part-continuity-and-dialogue-briefs`.
- **Cổng 25 (`v3.1+` — `psychological-soundscape-and-subtext`):** Cấm văn kể hộ cảm xúc (`Anti-Exposition`), bắt buộc có `soundscapeDesign.motifs[]` gắn `breakBeatId`, và bắt buộc giải trình `jumpscareReason` nếu dùng Jumpscare.
- **Cổng 26 (`v3.2+` — `viral-hook-and-oral-authenticity`):**
  1. **Cấm dạo đầu thời tiết / ngày tháng / tên tuổi** ở `P1.hook`, `P1.coldHook.openingLine` và `P1_AB1.spokenBeat.keyPhrase`.
  2. **Cấm khoảng lặng đầu video (`visualBeforeSec < 0.45s` ở `P1_AB1`)** và bắt buộc câu mở màn gọn sắc (`<= 26 từ`) kèm `openingSoundCue` thực địa.
  3. **Chặn văn mẫu sáo rỗng kiểu AI** (*"một cảm giác lạnh lẽo bao trùm"*, *"bất giác tôi nhận ra"*, *"tựa hồ như"*) và giữ từ cảm thán mạnh nằm trong ngưỡng an toàn nền tảng (`platform_safe_raw`).
  4. **Luật giữ chân 15s (`viral_short`):** Mọi `actionBeat` trong chế độ `viral_short` phải `<= 15.5s` để câu chuyện liên tục đẩy tình tiết mới.
