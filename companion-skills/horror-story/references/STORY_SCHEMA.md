# Horror Story Schema v3.0 (`story.json` · Narrative Studio — Phim ngắn 150–300s & Series 8–15 phút)

Toàn bộ dữ liệu thế giới quan, quy tắc thực thể, tâm lý nhân vật, kinh tế manh mối, cấu trúc đa hồi, mặt bằng 2D và bảng blocking hành động + định hướng thoại do Agent điền vào 1 file `story.json` (`schemaVersion: "3.0"`). Báo cáo HTML (**Biểu đồ Tension Curve SVG + Sơ đồ Mặt bằng 2D SVG**), `STORY_BIBLE.md`, `OUTLINE.json`, `CONTINUITY.init.json` và gói từng chương `p01..pNN/{SCRIPT.skeleton.md, manifest.draft.json, cues.draft.json}` đều sinh tự động từ `scripts/horror_story.py`.

*(Hoàn toàn tương thích ngược với `schemaVersion: "1.0"` — 14 cổng và `"2.0"` — 18 cổng.)*

## 3 Định Dạng Chuẩn (`params.format`)

| `format` | Tổng thời lượng | Số chương sản xuất (`parts`) | Thời lượng / chương | Khung hình mặc định | Trần Jumpscare toàn phim |
|---|---|---|---|---|---|
| **`short`** *(Mặc định phim ngắn)* | **`150s–360s`** *(2.5–6 phút)* | **`3–5` chương liền mạch** | `45–105s` *(khuyến nghị `72–90s` kèm `[VISUAL Xs]`)* | `9:16` *(hỗ trợ `16:9`)* | `<= 4` *(tối đa `<= 2`/chương)* |
| **`series`** *(Tập dài / Series)* | **`480s–960s`** *(8–16 phút)* | **`8–15` chương** | `45–105s` *(khuyến nghị `65–90s`)* | `16:9` *(hỗ trợ `9:16`)* | `<= round(phút × 0.65)` *(có chương thở `0` JS)* |
| **`micro`** *(Test nhanh / 1 chương)* | `45s–105s` | `1` phần | `45–105s` | `9:16` | `<= 2` |

## Cấu Trúc JSON Đầy Đủ (`schemaVersion: "3.0"`)

```json
{
  "schemaVersion": "3.0",
  "title": "Tên cốt truyện",
  "lang": "vi",
  "params": {
    "format": "short",
    "mode": "short",
    "parts": 4,
    "secondsPerPart": 75,
    "targetTotalSec": 300,
    "wordsPerSecond": 2.35,
    "aspect": "9:16",
    "seamlessStitch": true,
    "genre": "folklore",
    "adaptMode": "original",
    "thresholds": {
      "maxLeads": 5,
      "maxSupport": 10,
      "maxFunctional": 10,
      "maxProps": 10,
      "maxBeatGap": 1,
      "maxPrimaryScenes": 5,
      "maxJumpscaresTotal": 4
    }
  },
  "narrativeStyle": {
    "pov": "first_person_survivor",
    "narratorVoice": "Giọng nam kể chuyện đêm khuya trầm ấm nhưng biết run rẩy khi sợ hãi (Thiện Minh)",
    "dialogueDensity": "balanced_dialogue",
    "toneKeywords": ["tâm lý âm ỉ", "dân gian thực tế", "PSX VHS chân thực"],
    "forbiddenCliches": ["Hóa ra là mơ", "Nhân vật tự lao vào chỗ chết không lý do"]
  },
  "premise": {
    "core": "Một câu nêu xung đột trung tâm...",
    "entityRule": "Luật sinh tồn / cấm kỵ cốt lõi...",
    "twistCore": "Sự thật lật ngược toàn bộ các manh mối đã gieo..."
  },
  "worldLore": {
    "era": "Miền Tây Việt Nam, tháng 11 năm 1998",
    "settingDetail": "Chi tiết không gian địa lý, hạ tầng, ánh sáng, sự cô lập...",
    "weatherProgression": ["Mưa nhỏ 22:30", "Gió giật cúp điện 00:15", "Tĩnh lặng bất thường 01:06"],
    "backstory": "Bi kịch gốc giải thích tại sao địa điểm bị ám / quy tắc tồn tại...",
    "tabooLore": "Tục kiêng kỵ dân gian địa phương gắn với câu chuyện..."
  },
  "entityProfile": {
    "name": "Danh xưng thực thể",
    "origin": "Bản chất & nguồn gốc hình thành thực thể",
    "rules": [
      {
        "rule": "Quy tắc sinh tồn số 1",
        "trigger": "Hành động/tình huống kích hoạt",
        "consequence": "Hậu quả cụ thể khi phạm luật",
        "loophole": "Cái bẫy ẩn hoặc kẽ hở mà thực thể lợi dụng"
      }
    ],
    "sensoryTells": ["Mùi bùn tanh đột ngột", "Ngọn đèn dầu thu nhỏ ngả xanh", "Nhiễu băng VHS kèm tiếng kéo lê"],
    "escalationStages": [
      "Cấp 1: Dấu hiệu ngoại vi (vật thể dịch chuyển, mùi lạ)",
      "Cấp 2: Bóng rình góc khuất & tiếng giả giọng",
      "Cấp 3: Xâm nhập vùng an toàn & phá chốt bảo vệ",
      "Cấp 4: Hiện nguyên hình toàn thân & bộc phát cao trào"
    ]
  },
  "characters": [
    {
      "id": "C01",
      "name": "Tên nhân vật",
      "age": 24,
      "tier": "lead",
      "roleType": "human",
      "role": "Nhân vật chính (POV)",
      "heightMeters": 1.72,
      "trait": "Tính cách bề mặt",
      "goal": "Mục tiêu sống còn trước khi gặp biến cố",
      "trappedReason": "Lý do vật lý/tâm lý khiến nhân vật KHÔNG THỂ bỏ chạy ngay lập tức!",
      "flaw": "Điểm yếu / vết thương quá khứ khiến nhân vật dễ sập bẫy",
      "secret": "Bí mật giấu kín liên quan tới cú twist",
      "voiceProfile": "Tông giọng, nhịp thở, khẩu ngữ địa phương, cách ngắt câu khi hoảng",
      "wardrobe": "Trang phục bất biến xuyên suốt đêm",
      "carriedItems": ["Đèn pin cầm tay", "Điện thoại pin 14%"],
      "appearanceBrief": "Mô tả ngoại hình chi tiết chuyển thẳng sang CharacterBlueprint...",
      "movementRules": "Lộ trình di chuyển hợp lý qua đúng cửa thông phòng",
      "arc": "Biến đổi tâm lý từ đầu đến cuối truyện",
      "relationships": [{ "targetId": "C02", "relation": "Loại quan hệ", "tension": "Xung đột/nghi ngờ ngầm" }],
      "from": ["Sáng tác mới"]
    }
  ],
  "scenes": [
    {
      "id": "S01",
      "name": "Tên phòng / không gian",
      "primary": true,
      "archetype": "oldRuralWoodenHouse",
      "dimensions": [6.0, 7.2, 4.0],
      "ceilingType": "aFrameThatch",
      "atmosphere": "Không khí, mùi vị, nguồn sáng vật lý",
      "practicalLights": ["oilLamp", "handheldFlashlight"],
      "landmarks": [
        { "id": "POV_START", "kind": "stance", "pos": [0.0, 0.0, 1.8], "note": "Điểm xuất phát" },
        { "id": "MAIN_DOOR", "kind": "portal", "pos": [0.0, 0.0, -3.45], "connectsTo": "S02:PORCH_ENTRY", "note": "Cửa chính nối sang S02" }
      ]
    }
  ],
  "acts": [
    {
      "act": 1,
      "name": "Hồi 1: Đời thường & Cài luật",
      "partRange": [1, 1],
      "goal": "Tạo đồng cảm nhân vật + khóa lý do mắc kẹt + gieo manh mối đầu tiên",
      "turningPoint": "Sự kiện kết thúc Hồi 1 buộc nhân vật phải đối mặt dị biến",
      "dominantEmotion": "calm_omen -> curious"
    }
  ],
  "clues": [
    {
      "id": "CL01",
      "kind": "physical_clue",
      "plantedInPart": 1,
      "plantedDetail": "Chi tiết nhỏ gieo ở Chương 1 qua hình ảnh/lời thoại",
      "payoffInPart": 4,
      "recontextualization": "Ý nghĩa rợn người hoàn toàn khác khi lật kèo ở Chương 4"
    }
  ],
  "beats": [
    { "id": "B01", "part": 1, "type": "hook", "weight": "minor", "setup": "...", "payoff": "..." }
  ],
  "props": [
    {
      "id": "P01",
      "name": "Tên đạo cụ gánh cốt truyện",
      "sceneId": "S01",
      "landmarkId": "MAIN_DOOR",
      "initialState": "closedBolted",
      "states": ["closedBolted", "boltSliding", "slammedOpen"],
      "function": "Vai trò sống còn trong cốt truyện",
      "beatIds": ["B01"]
    }
  ],
  "parts": [
    {
      "part": 1,
      "act": 1,
      "title": "Tên chương",
      "target_sec": 52,
      "light": "warmLamp",
      "pacingType": "setup",
      "tensionStart": 2,
      "tensionPeak": 5,
      "tensionEnd": 4,
      "newInfoRevealed": "Thông tin mới bắt buộc hé lộ trong chương này (cấm câu giờ rỗng ruột)",
      "cliffhangerType": "question",
      "transitionOut": "cut",
      "synopsis": "Văn xuôi kể diễn biến chương (KHÔNG chứa ngoặc kép đối thoại)...",
      "hook": "Móc mở đầu chương...",
      "suspense": "Điểm treo dẫn sang chương tiếp theo...",
      "sceneIds": ["S01"],
      "characterIds": ["C01"],
      "propIds": ["P01"],
      "soundCues": ["Mưa đêm", "Sàn gỗ kẽo kẹt"],
      "warnings": ["Chưa lộ mặt thực thể — chỉ cấp 1 ngoại vi"],
      "actionBeats": [
        {
          "beatId": "P1_AB01",
          "sceneId": "S01",
          "durationSec": 14.0,
          "mood": "calm_omen",
          "light": "warmLamp",
          "camera": { "stance": "seated", "posLandmark": "POV_START", "lookLandmark": "MAIN_DOOR", "motion": "dolly" },
          "actors": [],
          "propChanges": [{ "id": "P01", "fromState": "closedBolted", "toState": "closedBolted" }],
          "actionSummary": "Mô tả hành động 3D cụ thể...",
          "subtext": "Nội tâm nhân vật đang nghĩ / cố tự trấn an điều gì...",
          "sensoryDetails": { "sight": "Ánh đèn dầu rung", "sound": "Mưa gõ mái tôn + gió lùa", "atmosphere": "Ẩm lạnh mùi gỗ mục" },
          "spokenBeat": {
            "speaker": "NARRATOR",
            "intent": "Thiết lập thời gian, lý do mắc kẹt và lời dặn cấm kỵ",
            "keyPhrase": "Nếu nghe đủ ba tiếng gõ trên ván sàn...",
            "mood": "calm_omen",
            "wordBudget": 40
          },
          "audioCue": "distant_thunder",
          "jumpscareStyle": null
        }
      ]
    }
  ]
}
```

## Tóm Tắt 24 Cổng Kiểm Định (`horror_story.py validate`)

- **Cổng 1–14 (Cốt truyện nền):** `premise-core`, `char-tier-caps`, `char-arcs`, `scene-cap`, `scene-reuse`, `prop-purpose`, `beat-major`, `beat-spacing`, `reveal-discipline`, `part-duration` *(45–90s/chương)*, `prose-only`, `hook-suspense`, `referential-integrity`, `horror-cues`.
- **Cổng 15–18 (Không gian 2D & Blocking 3D — v2.0+):** `char-appearance-brief`, `scene-spatial-floorplan`, `action-blocking-continuity`, `horror-pacing-jumpscare-cap`.
- **Cổng 19–24 (Chiều sâu Biên kịch & Phim dài — v3.0 / `--strict-story`):**
  19. **`format-duration-budget`:** Tổng thời lượng khớp đúng khung `short` (`150–300s`), `series` (`480–900s`) hoặc `micro` (`45–90s`), và tổng `actionBeats.durationSec` từng chương khớp `target_sec` trong `±20%`.
  20. **`world-lore-and-entity-rules`:** Khóa đủ `worldLore` (`era`, `settingDetail`, `backstory`, `weatherProgression >= 2`) và `entityProfile` (`origin`, `>= 2` quy tắc đủ `rule/trigger/consequence`, `>= 3` dấu hiệu 5 giác quan, `>= 3` cấp độ lộ diện leo thang).
  21. **`character-depth-and-stakes`:** Mọi nhân vật `lead` (người) bắt buộc có `goal`, `trappedReason` (`>= 10` ký tự), `flaw`, `voiceProfile`; truyện `>= 2` nhân vật phải có `relationships[]` hợp lệ.
  22. **`clue-twist-economy`:** Đủ manh mối (`short >= 2`, `series >= 4` có `>= 1 red_herring`), gieo trước khi lật (`plantedInPart <= payoffInPart`, ít nhất 1 manh mối gieo trước chương cuối), có `recontextualization` rõ ràng.
  23. **`multi-act-tension-curve`:** `acts[]` phủ kín liên tục `1..parts` có `turningPoint`; mọi chương có `pacingType`, `tensionStart/Peak/End` (`1..10`), `newInfoRevealed`, và **phải có khoảng thở (`min <= 5`) xen kẽ đỉnh cao trào (`max >= 8`)**.
  24. **`cross-part-continuity-and-dialogue-briefs`:** Kiểm định liên tục vị trí nhân vật & trạng thái đạo cụ **xuyên ranh giới chương**, yêu cầu mọi `actionBeat` có `subtext` + `sensoryDetails` + `spokenBeat` (`wordBudget` khớp thời lượng chương), và khóa trần Jumpscare toàn phim chống nhờn (`short <= 4`, `series <= max(5, round(phút × 0.65))` kèm `>= 1` chương thở `0` Jumpscare).
