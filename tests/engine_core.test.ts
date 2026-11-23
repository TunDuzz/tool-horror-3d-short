import test from "node:test";
import assert from "node:assert/strict";

import {
  whipPan,
  povBreath,
  evalCamVelocity,
  type Cam,
  type LightKey,
} from "../templates/engine/camera.ts";
import {
  LIGHTS,
  LOOK,
  lerpLights,
  lerpLook,
} from "../templates/engine/lights.ts";
import {
  beatAt,
  isLampLit,
  propStateOf,
  hudFromManifest,
  type SceneManifest,
} from "../templates/engine/manifest.ts";

test("LIGHTS and LOOK expose strictly the 5 v3 physical horror presets and exclude blood", () => {
  const expected: LightKey[] = ["warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"];
  assert.deepEqual(Object.keys(LIGHTS).sort(), [...expected].sort());
  assert.deepEqual(Object.keys(LOOK).sort(), [...expected].sort());
  assert.equal("blood" in LIGHTS, false);
  assert.equal("eerie" in LIGHTS, false);
});

test("lerpLights and lerpLook interpolate presets smoothly between warmLamp and coldMoon", () => {
  const mid = lerpLights(LIGHTS.warmLamp, LIGHTS.coldMoon, 0.5);
  assert.ok(Math.abs(mid.lit[0] - (LIGHTS.warmLamp.lit[0] + LIGHTS.coldMoon.lit[0]) / 2) < 1e-4);
  assert.ok(Math.abs(mid.fogFar - (LIGHTS.warmLamp.fogFar + LIGHTS.coldMoon.fogFar) / 2) < 1e-4);
  assert.match(mid.fog, /^#[0-9a-f]{6}$/i);

  const midLook = lerpLook(LOOK.warmLamp, LOOK.coldMoon, 0.5);
  assert.equal(midLook.sky.c.length, LOOK.warmLamp.sky.c.length);
  assert.ok(Math.abs(midLook.sat - (LOOK.warmLamp.sat + LOOK.coldMoon.sat) / 2) < 1e-4);
});

test("whipPan transitions cleanly and evalCamVelocity is deterministic with zero velocity at cutStartFrame", () => {
  const pos: [number, number, number] = [0, 1.15, 2.2];
  const spec = {
    f0: 50,
    dur: 7,
    fromLook: [-2.0, 1.1, 0.0] as [number, number, number],
    toLook: [2.0, 1.1, 0.0] as [number, number, number],
    rollPeak: 0.04,
  };
  const evalAt = (f: number): Cam => ({ fov: 56, roll: 0, ...whipPan(pos, spec, f, 56) });

  // Start and end anchors
  assert.deepEqual(evalAt(50).look, spec.fromLook);
  assert.deepEqual(evalAt(57).look, spec.toLook);

  // Review Focus #1: First frame of a hard cut MUST yield exact zero velocity
  const atCut = evalCamVelocity(evalAt, 53, 53, 9 / 16, 1920);
  assert.deepEqual(atCut, { vx: 0, vy: 0, speedPx: 0 });

  // Mid-whip velocity must be strong, horizontal, clamped, and order-independent
  const vMid1 = evalCamVelocity(evalAt, 54, 0, 9 / 16, 1920, 0.65, 42);
  const vIdle = evalCamVelocity(evalAt, 10, 0, 9 / 16, 1920, 0.65, 42);
  const vMid2 = evalCamVelocity(evalAt, 54, 0, 9 / 16, 1920, 0.65, 42);
  assert.equal(vIdle.speedPx, 0);
  assert.ok(vMid1.speedPx > 8, `Expected strong whip-pan speedPx > 8, got ${vMid1.speedPx}`);
  assert.ok(vMid1.speedPx <= 42, `Expected clamped speedPx <= 42, got ${vMid1.speedPx}`);
  assert.deepEqual(vMid1, vMid2);

  // povBreath returns subtle deterministic sway without modifying base object
  const b1 = povBreath({ pos, look: spec.fromLook, fov: 56 }, 15);
  const b2 = povBreath({ pos, look: spec.fromLook, fov: 56 }, 15);
  assert.deepEqual(b1, b2);
  assert.notDeepEqual(b1.pos, pos);
});

test("SceneManifest evaluators and hudFromManifest keep captions, lamps, and Phone3D notifications synced", () => {
  const manifest: SceneManifest = {
    projectId: "test-pov",
    title: "Test POV",
    totalFrames: 120,
    aspect: "9:16",
    header: { title: "CHỦ NHẬT · 01:06", subtitle: "Đêm canh linh cữu", badge: "PHIM NGẮN HƯ CẤU" },
    locations: [
      {
        id: "funeralRoom",
        archetype: "ruralThatchedHouse",
        dimensions: [6.4, 7.6, 4.2],
        ceilingType: "aFrameThatch",
        materials: { wall: "mottledPlasterTex", floor: "packedEarthTex", ceiling: "thatchRoofTex" },
        practicalLights: ["oilLamp", "altarCandle"],
        heroProps: ["coffin", "ancestralAltar", "glassOilLamp"],
        signatureShadowBeat: "Feet shadow blocking door-crack moonlight",
      },
    ],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 60,
        peakFrame: 30,
        locationId: "funeralRoom",
        spokenLine: { speaker: "TÙNG (TÔI)", speakerColor: "#ffffff", text: "Đếm lại, vẫn ra bốn.", highlight: ["vẫn ra bốn"] },
        lightState: { preset: "warmLamp", lampsOn: ["oilLamp", "altarCandle"], doorMoonlight: true, feetShadow: false },
        castStates: { chuBay: { visible: true, anchor: "SEAT_FRONT", pose: "sitCrossLegged", expr: "uneasy" } },
        propStates: {
          phone: {
            visible: true,
            state: "raised",
            detail: { clock: "01:06", notifSender: "Cô Lan", notifBody: "Cô ốm ở nhà.", notifFooter: "Gửi lúc 22:10" },
          },
        },
        cameraIntent: "POV holding glowing smartphone showing 01:06 message from Co Lan",
      },
      {
        beatId: "B2",
        shotId: 2,
        a: 60,
        b: 120,
        peakFrame: 95,
        locationId: "funeralRoom",
        lightState: { preset: "coldMoon", lampsOn: [], doorMoonlight: true, feetShadow: true },
        castStates: { entity: { visible: true, anchor: "DOOR", pose: "loomingStill", eyeGlow: true } },
        propStates: { phone: { visible: false, state: "hidden" } },
        cameraIntent: "Lights out, cold moonlight crack under door blocked by two dark foot shadows",
      },
    ],
  };

  const b1 = beatAt(manifest, 30);
  const b2 = beatAt(manifest, 95);
  assert.equal(b1.beatId, "B1");
  assert.equal(b2.beatId, "B2");
  assert.equal(isLampLit(b1, "oilLamp"), true);
  assert.equal(isLampLit(b2, "oilLamp"), false);
  assert.equal(propStateOf(b1, "phone")?.detail?.clock, "01:06");

  const hud = hudFromManifest(manifest);
  assert.equal(hud.header?.badge, "PHIM NGẮN HƯ CẤU");
  assert.equal(hud.captions?.length, 1);
  assert.equal(hud.captions?.[0].text, "Đếm lại, vẫn ra bốn.");
  assert.equal(hud.notifications?.length, 1);
  assert.equal(hud.notifications?.[0].sender, "Cô Lan");
  assert.equal(hud.notifications?.[0].time, "01:06");
  assert.equal(hud.notifications?.[0].body, "Cô ốm ở nhà.");
});
