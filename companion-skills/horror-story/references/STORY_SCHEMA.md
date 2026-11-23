# Horror Story Schema (`story.json`)

Toàn bộ dữ liệu cốt truyện do Agent điền vào 1 file `story.json`. Báo cáo HTML (`story-report.html`), Markdown (`STORY_BIBLE.md`), và `OUTLINE.json` đều được sinh tự động bằng `scripts/horror_story.py`.

```json
{
  "title": "Tên cốt truyện",
  "lang": "vi",
  "params": {
    "mode": "standalone",
    "parts": 1,
    "secondsPerPart": 70,
    "wordsPerSecond": 2.9,
    "genre": "folklore",
    "adaptMode": "folklore",
    "thresholds": {
      "maxLeads": 5,
      "maxSupport": 10,
      "maxFunctional": 10,
      "maxProps": 8,
      "maxBeatGap": 2,
      "maxPrimaryScenes": 3
    }
  },
  "premise": {
    "core": "Một câu nêu xung đột trung tâm...",
    "entityRule": "Luật ngầm hoặc cách thực thể hoạt động...",
    "twistCore": "Sự thật hoặc cú lật cuối cùng...",
    "keep": [{ "what": "Chi tiết giữ lại", "why": "Lý do", "evidence": "Trích dẫn nguồn (nếu chuyển thể)" }],
    "cut": [{ "what": "Tuyến phụ bị cắt", "why": "Lý do giữ truyện gọn" }],
    "risks": [{ "what": "Rủi ro mạch truyện", "plan": "Cách xử lý" }]
  },
  "characters": [
    {
      "id": "C01",
      "name": "Bé Minh",
      "tier": "lead",
      "role": "Nhân vật chính (người bị săn)",
      "trait": "Nhỏ nhắn, tò mò nhưng dễ hoảng loạn trong bóng tối",
      "arc": "Tin rằng chỉ cần không mở tủ thì an toàn -> bị dụ mở khe sáng -> tưởng thoát khi cài cửa -> sụp đổ khi mối họa nằm sẵn dưới gầm giường",
      "from": ["Dân gian Việt Nam"]
    }
  ],
  "scenes": [
    {
      "id": "S01",
      "name": "Gian nhà gỗ 3 gian ban đêm",
      "primary": true,
      "atmosphere": "Tối sâu, mưa bão ngoài song cửa, tủ gỗ cổ cuối phòng"
    }
  ],
  "beats": [
    {
      "id": "B01",
      "part": 1,
      "type": "hook",
      "weight": "minor",
      "setup": "Lời dặn cấm kỵ về 3 tiếng gõ trong tủ gỗ lúc nửa đêm",
      "payoff": "Thiết lập luật chơi sinh tử ngay 8 giây đầu"
    }
  ],
  "props": [
    {
      "id": "P01",
      "name": "Chiếc bao tải rách đẫm bùn",
      "function": "Dẫn chứng vật lý nối từ tủ gỗ ngoài gian nhà vào thẳng trên giường ngủ ở cú twist cuối",
      "states": ["Thò góc ướt bùn dưới chân tủ", "Thực thể vác trên lưng", "Nằm sẵn trên giường ngủ"],
      "beatIds": ["B02", "B04"]
    }
  ],
  "parts": [
    {
      "part": 1,
      "title": "Tiếng gõ lúc nửa đêm",
      "target_sec": 70,
      "light": "candle",
      "synopsis": "Văn xuôi kể diễn biến phần này (không viết ngoặc kép đối thoại)...",
      "hook": "Lời dặn lúc nửa đêm về 3 tiếng gõ trong tủ gỗ...",
      "suspense": "Bao tải nằm sẵn trên giường và đôi mắt trắng dã dưới gầm giường.",
      "sceneIds": ["S01", "S02"],
      "characterIds": ["C01", "C02"],
      "propIds": ["P01", "P02"],
      "soundCues": ["3 tiếng gõ gỗ khô khốc", "Dead silence tắt đèn dầu", "Sấm chớp nổ"],
      "warnings": ["Giấu mặt thực thể đến sau Dead Silence"]
    }
  ]
}
```

## Tóm tắt 14 Cổng Kiểm Định (`horror_story.py validate`)

1. **Tuyến & Luật thực thể (`premise-core`):** Có `core` và `entityRule`; nếu `adaptMode` là `adapt` / `reimagine` thì bắt buộc có ít nhất 1 mục `cut`.
2. **Giới hạn nhân vật theo cấp (`char-tier-caps`):** `lead` (`1..5`), `support` (`<= 10`), `functional` (`<= 10`).
3. **Cung phát triển & nguồn nhân vật (`char-arcs`):** Mọi `lead` và `support` phải có `arc` và `from` khác rỗng.
4. **Giới hạn bối cảnh chính (`scene-cap`):** Số `scenes` có `primary: true` không vượt quá `maxPrimaryScenes` (`standalone` mặc định `3`, `series` mặc định `4 + ceil(parts/10)` kẹp `[3, 12]`).
5. **Tái sử dụng bối cảnh lẻ (`scene-reuse`):** Với `series >= 2` phần, bối cảnh chỉ xuất hiện 1 lần phải khai báo `reusePlan`.
6. **Đạo cụ kể chuyện (`prop-purpose`):** Tối đa `maxProps` (`8`) món; mỗi món bắt buộc có `function` rõ ràng và trỏ tới `beatIds` hợp lệ.
7. **Nhịp cao trào chính (`beat-major`):** Có ít nhất 1 beat `weight: "major"`; nếu `parts >= 2`, `major` đầu tiên không được dồn đến phần cuối cùng.
8. **Khoảng cách cao trào (`beat-spacing`):** Không có phần nào bị rỗng hoàn toàn ở đầu/cuối và khoảng cách giữa 2 beat `<= maxBeatGap`.
9. **Kỷ luật giấu thực thể (`reveal-discipline`):** Ở câu chuyện có nhiều beat, không đặt `major reveal` trước beat `hook`/`omen` mở đầu (tránh lộ quái quá sớm).
10. **Số phần & Thời lượng (`part-duration`):** Đủ `1..N` phần, mỗi phần `target_sec` nằm trong `[45, 75]` và `light` thuộc `{night, candle, storm, eerie, blood}`.
11. **Văn xuôi cốt truyện (`prose-only`):** `synopsis`, `hook`, `suspense` không chứa lời thoại trong ngoặc kép (`"..."`, `“...”`, `「...」`, `『...』`).
12. **Móc mở & Treo cuối (`hook-suspense`):** Mọi phần phải có đủ `hook` và `suspense`.
13. **Khớp nối tham chiếu (`referential-integrity`):** Không có ID rác, không có nhân vật/bối cảnh/đạo cụ nào bị "thất nghiệp" suốt cả câu chuyện.
14. **Gợi ý âm thanh / căng thẳng (`horror-cues`):** Mỗi phần có ít nhất 1 gợi ý âm thanh/nhịp (`soundCues` hoặc `warnings`) để nối mạch sang sản xuất.
