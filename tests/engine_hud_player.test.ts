import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildWordCaptionsFromWords,
  hudFromManifest,
  splitCaptionTextIntoChunks,
  type HorrorHudConfig,
  type SceneManifest,
} from "../templates/engine/manifest.ts";
import { evalActiveHud, HorrorHUD } from "../templates/engine/HorrorHUD.tsx";

test("evalActiveHud resolves active caption, notification, interpolated timeSkip clock, and choiceCard", () => {
  const cfg: HorrorHudConfig = {
    header: { title: "CHỦ NHẬT · 00:52", subtitle: "Đêm canh linh cữu", badge: "PHIM NGẮN HƯ CẤU" },
    captions: [{ a: 10, b: 50, speaker: "TÙNG (TÔI)", text: "Đếm lại, vẫn ra bốn.", highlight: ["vẫn ra bốn"] }],
    notifications: [{ a: 60, b: 100, sender: "Cô Lan", time: "01:06", body: "Cô ốm ở nhà." }],
    timeSkips: [{ a: 110, b: 140, clockFrom: "00:44", clockTo: "00:57", label: "50 PHÚT SAU" }],
    choiceCard: { a: 150, b: 200, header: "PHẦN 2", question: "BẠN SẼ LÀM GÌ?", options: ["ĐẾM TIẾP", "RA KHỎI NHÀ"] },
  };

  assert.equal(evalActiveHud(cfg, 5).caption, null);
  assert.equal(evalActiveHud(cfg, 25).caption?.text, "Đếm lại, vẫn ra bốn.");
  assert.equal(evalActiveHud(cfg, 75).notification?.sender, "Cô Lan");
  assert.equal(evalActiveHud(cfg, 110).timeSkip?.clockDisplay, "00:44");
  assert.equal(evalActiveHud(cfg, 139).timeSkip?.clockDisplay, "00:57");
  assert.equal(evalActiveHud(cfg, 175).choiceCard?.options[0], "ĐẾM TIẾP");
  assert.equal(typeof HorrorHUD, "function");
});

test("hudFromManifest output integrates cleanly with evalActiveHud", () => {
  const m: SceneManifest = {
    projectId: "sync-test",
    title: "Sync Test",
    totalFrames: 90,
    aspect: "9:16",
    locations: [],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 90,
        peakFrame: 45,
        locationId: "loc",
        spokenLine: { speaker: "CHÚ BẢY", text: "Các cụ cấm đếm người đấy.", highlight: ["cấm đếm người"] },
        lightState: { preset: "warmLamp", lampsOn: ["oilLamp"] },
        castStates: {},
        propStates: {
          phone: { visible: true, state: "raised", detail: { clock: "00:58", notifSender: "Mẹ", notifBody: "Đừng đếm nữa nhé." } },
        },
        cameraIntent: "Phone alert",
      },
    ],
  };
  const hud = hudFromManifest(m);
  const active = evalActiveHud(hud, 45);
  assert.equal(active.caption?.speaker, "CHÚ BẢY");
  assert.equal(active.notification?.time, "00:58");
  assert.equal(active.notification?.sender, "Mẹ");
});

test("templates/engine/index.ts exports v4.5 modules (including bodyHorror & retroPsx) and does not reference removed v2 billboard modules", () => {
  const src = fs.readFileSync(path.resolve("templates/engine/index.ts"), "utf-8");
  for (const mod of ["./camera", "./lights", "./manifest", "./shade", "./outline3d", "./ink", "./motionblur", "./lensblur", "./grade", "./retroPsx", "./paint", "./build", "./face2d", "./bodyHorror", "./rig3d", "./povRig", "./fx3d", "./HorrorHUD", "./ShortPlayer"]) {
    assert.ok(src.includes(mod), `index.ts missing export for ${mod}`);
  }
  for (const oldMod of ["./toon", "./cast", "./cardshade"]) {
    assert.equal(src.includes(oldMod), false, `index.ts must not export removed v2 module ${oldMod}`);
  }
});

test("v10.0 word-timed subtitle chunker splits long walls of text into crisp 4-8 word phrases and respects clean minimal HUD", () => {
  const longText =
    "Tháng mười mùa nước nổi năm 1999, mưa đổ rát mái tôn trên bến phà cũ ven sông Hậu. Tôi tên Nam, nhận trực đêm đầu tiên chỉ để kiếm tiền mổ mắt cho mẹ.";
  const chunks = splitCaptionTextIntoChunks(longText, 7, 42);
  assert.ok(chunks.length >= 4, `expected >= 4 compact chunks, got ${chunks.length}`);
  for (const ch of chunks) {
    assert.ok(ch.split(" ").length <= 9, `chunk too long (${ch.split(" ").length} words): ${ch}`);
  }

  const m: SceneManifest = {
    projectId: "v10-hud-test",
    title: "V10 HUD Test",
    totalFrames: 300,
    aspect: "9:16",
    headerStyle: "minimal",
    locations: [],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 300,
        peakFrame: 150,
        locationId: "S01",
        spokenLine: { speaker: "NAM", text: longText, highlight: ["1999", "mổ mắt cho mẹ"] },
        lightState: { preset: "warmLamp", lampsOn: [] },
        castStates: {},
        propStates: {},
        cameraIntent: "Test auto-chunking fallback",
      },
    ],
  };

  // Fallback auto-chunking when captionChunks isn't pre-populated
  const hudAuto = hudFromManifest(m);
  assert.equal(hudAuto.headerStyle, "minimal");
  assert.ok((hudAuto.captions?.length ?? 0) >= 4, "long beat must auto-split into compact subtitle chunks");

  // Exact word-timed chunking from words.json
  const words = longText.split(" ").map((w, i) => ({ w, s: i * 0.25, e: i * 0.25 + 0.22, speaker: "NARRATOR" }));
  const timed = buildWordCaptionsFromWords(words, m, { fps: 30, maxWords: 7, maxChars: 42 });
  assert.ok(timed.length >= 4);
  for (let i = 1; i < timed.length; i++) {
    assert.ok(timed[i].a >= timed[i - 1].b, "word-timed caption chunks must not overlap");
  }
});
