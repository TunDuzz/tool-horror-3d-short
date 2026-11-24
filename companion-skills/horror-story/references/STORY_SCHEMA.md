# Horror Story Schema v2.0 (`story.json` · Engine v8.0 Spatial & Action Blocking)

Toàn bộ dữ liệu cốt truyện + mặt bằng 2D + bảng blocking hành động do Agent điền vào 1 file `story.json` (`schemaVersion: "2.0"`). Báo cáo HTML kèm **Sơ đồ Mặt bằng 2D SVG** (`story-report.html`), Markdown (`STORY_BIBLE.md`), `OUTLINE.json`, và gói đồng bộ 3 file (`SCRIPT.skeleton.md`, `manifest.draft.json`, `cues.draft.json`) đều được sinh tự động bằng `scripts/horror_story.py`.

```json
{
  "schemaVersion": "2.0",
  "title": "Tên cốt truyện",
  "lang": "vi",
  "params": {
    "mode": "standalone",
    "parts": 1,
    "secondsPerPart": 55,
    "wordsPerSecond": 2.9,
    "genre": "folklore",
    "adaptMode": "original",
    "thresholds": {
      "maxLeads": 5,
      "maxSupport": 10,
      "maxFunctional": 10,
      "maxProps": 8,
      "maxBeatGap": 1,
      "maxPrimaryScenes": 3
    }
  },
  "premise": {
    "core": "Một câu nêu xung đột trung tâm...",
    "entityRule": "Luật ngầm hoặc cách thực thể hoạt động...",
    "twistCore": "Sự thật hoặc cú lật cuối cùng...",
    "keep": [{ "what": "Chi tiết giữ lại", "why": "Lý do", "evidence": "Trích dẫn nguồn" }],
    "cut": [{ "what": "Tuyến phụ bị cắt", "why": "Lý do giữ truyện gọn" }],
    "risks": [{ "what": "Rủi ro mạch truyện", "plan": "Cách xử lý" }]
  },
  "characters": [
    {
      "id": "C01",
      "name": "Nhân vật chính",
      "tier": "lead",
      "roleType": "human",
      "role": "Người sống sót (POV)",
      "heightMeters": 1.72,
      "trait": "Cảnh giác nhưng hoảng loạn khi quy tắc bị phá vỡ",
      "appearanceBrief": "Thanh niên mặc áo khoác mỏng tối màu, cầm đèn pin nhỏ trong nhà gỗ cũ.",
      "movementRules": "Chạy qua đúng cửa thông phòng BEDROOM_DOOR để sang phòng ngủ S02",
      "arc": "Tin tưởng chốt sắt khóa cửa -> nghi ngờ tiếng cào -> hoảng loạn chạy trốn -> sụp đổ khi mối họa nằm dưới gầm giường",
      "from": ["Sáng tác mới"]
    }
  ],
  "scenes": [
    {
      "id": "S01",
      "name": "Gian nhà gỗ cũ lúc 01:06",
      "primary": true,
      "archetype": "oldRuralWoodenHouse",
      "dimensions": [6.0, 7.2, 4.0],
      "ceilingType": "aFrameThatch",
      "atmosphere": "Tối sâu, mưa bão ngoài cửa chớp vỡ, cửa gỗ 2 cánh cài chốt sắt",
      "practicalLights": ["oilLamp", "phoneScreen", "handheldFlashlight"],
      "landmarks": [
        { "id": "POV_SEAT", "kind": "stance", "pos": [0.05, 0.0, 1.95], "note": "Chiếu giữa phòng" },
        { "id": "FRONT_DOOR", "kind": "portal", "pos": [0.0, 0.0, -3.45], "note": "Cửa gỗ 2 cánh thông ra hành lang tối" },
        { "id": "BEDROOM_DOOR", "kind": "portal", "pos": [2.95, 0.0, 1.80], "connectsTo": "S02:ENTRY_DOOR", "note": "Cửa sang phòng ngủ S02" }
      ]
    }
  ],
  "beats": [
    { "id": "B01", "part": 1, "type": "hook", "weight": "minor", "setup": "Lời dặn không mở cửa sau nửa đêm", "payoff": "Khóa luật sinh tử" }
  ],
  "props": [
    {
      "id": "P01",
      "name": "Cửa gỗ 2 cánh & chốt sắt",
      "sceneId": "S01",
      "landmarkId": "FRONT_DOOR",
      "initialState": "closedBolted",
      "states": ["closedBolted", "boltSliding", "slammedOpen"],
      "function": "Ngăn cách giữa an toàn và thực thể ngoài hành lang; tự trượt chốt rồi bật tung ở cao trào",
      "beatIds": ["B01", "B02"]
    }
  ],
  "parts": [
    {
      "part": 1,
      "title": "Đừng mở cửa sau nửa đêm",
      "target_sec": 50,
      "light": "warmLamp",
      "synopsis": "Văn xuôi kể diễn biến phần này (không chứa lời thoại ngoặc kép)...",
      "hook": "Lời dặn cấm mở cửa sau 01:06 giữa đêm mưa...",
      "suspense": "Đèn pin phụt tắt và đôi mắt trắng dã lao ra từ gầm giường.",
      "sceneIds": ["S01"],
      "characterIds": ["C01"],
      "propIds": ["P01"],
      "soundCues": ["Mưa đêm", "Chốt sắt trượt", "Jumpscare"],
      "warnings": ["Cấm để cửa mở rồi tự đóng lại trước khi trượt chốt"],
      "actionBeats": [
        {
          "beatId": "AB01",
          "sceneId": "S01",
          "durationSec": 6.0,
          "mood": "calm_omen",
          "light": "warmLamp",
          "camera": { "stance": "seated", "posLandmark": "POV_SEAT", "lookLandmark": "FRONT_DOOR", "motion": "dolly" },
          "actors": [],
          "propChanges": [{ "id": "P01", "fromState": "closedBolted", "toState": "closedBolted" }],
          "actionSummary": "Mở màn đêm mưa gió rít qua khe cửa gỗ cài chốt sắt",
          "audioCue": "distant_thunder",
          "jumpscareStyle": null
        }
      ]
    }
  ]
}
```

## Tóm tắt 18 Cổng Kiểm Định (`horror_story.py validate`)

1–14. Giữ nguyên 14 cổng cốt truyện nền (`premise-core`, `char-tier-caps`, `char-arcs`, `scene-cap`, `scene-reuse`, `prop-purpose`, `beat-major`, `beat-spacing`, `reveal-discipline`, `part-duration`, `prose-only`, `hook-suspense`, `referential-integrity`, `horror-cues`).
15. **Khóa ngoại hình nhân vật (`char-appearance-brief`):** Mọi nhân vật/thực thể phải có `appearanceBrief` chi tiết (`>= 12` ký tự) và `roleType` hợp lệ.
16. **Mặt bằng 2D & Tọa độ Điểm neo (`scene-spatial-floorplan`):** Mỗi bối cảnh chính phải khai báo `dimensions` `[w, d, h]` + `>= 3` `landmarks` nằm trong giới hạn vật lý của phòng, và mọi cửa nối `connectsTo: "S02:LANDMARK"` đều phải tồn tại.
17. **Liên tục hành động & Trạng thái đạo cụ (`action-blocking-continuity`):** Kiểm định tuần tự `actionBeats[]` — **chặn lỗi nhân vật dịch chuyển tức thời (`TELEPORT`)** trong cùng phòng và **chặn lỗi nhảy ngược/nhảy cóc trạng thái đạo cụ (`PROP_STATE_DRIFT`)**!
18. **Giới hạn Jumpscare & Đồng bộ Audio (`horror-pacing-jumpscare-cap`):** Khóa tối đa **`<= 2` Jumpscare/phần** đúng 4 phong cách v7.1 (`cinema_stab | entity_shriek | metal_dread | vhs_psx_glitch`), cấm đặt Jumpscare lạnh ở beat mở đầu Phần 1.
