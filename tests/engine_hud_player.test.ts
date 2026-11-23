import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { hudFromManifest, type HorrorHudConfig, type SceneManifest } from "../templates/engine/manifest.ts";
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

test("templates/engine/index.ts exports v4 modules (including bodyHorror) and does not reference removed v2 billboard modules", () => {
  const src = fs.readFileSync(path.resolve("templates/engine/index.ts"), "utf-8");
  for (const mod of ["./camera", "./lights", "./manifest", "./shade", "./outline3d", "./ink", "./motionblur", "./lensblur", "./grade", "./paint", "./build", "./face2d", "./bodyHorror", "./rig3d", "./povRig", "./fx3d", "./HorrorHUD", "./ShortPlayer"]) {
    assert.ok(src.includes(mod), `index.ts missing export for ${mod}`);
  }
  for (const oldMod of ["./toon", "./cast", "./cardshade"]) {
    assert.equal(src.includes(oldMod), false, `index.ts must not export removed v2 module ${oldMod}`);
  }
});
