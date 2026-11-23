// Character & 2D FX staging for HorrorLab v2 across all 5 horror lighting presets & shot scales.

import * as THREE from "three";
import {
  Action,
  CamInfo,
  Expr,
  FPS,
  LightKey,
  Place,
  Stage,
  clamp01,
  flickerAt,
  fxBreath,
  fxFlickerGlow,
  fxFloatingAsh,
  fxLightning,
  fxLongShadow,
  fxLurkingEyes,
  fxMist,
  fxRain,
  lidAt,
  placePerson,
  pushAfterimage,
  pushContactShadow,
  pushFlatDecal,
  uncannyTime,
  uncannyTwitch,
  viewOf,
} from "../engine";
import { ANCHORS } from "./story";
import { GHOST_FIGURE, TRAVELER } from "./toon";

export function stageHorrorLab(
  shotId: number,
  frame: number,
  light: LightKey,
  cam: CamInfo,
  sunDir: THREE.Vector3,
): Stage {
  const out: Stage = { places: [], fx: [] };
  const t = frame / FPS;

  const isNear = shotId === 1 || shotId === 5;
  const trPos = isNear ? ANCHORS.TRAVELER_NEAR : ANCHORS.TRAVELER_MID;
  const trExpr: Expr =
    shotId === 1 ? "wary" : shotId === 2 ? "dread" : shotId === 3 ? (frame < 72 ? "suspicious" : "terrified") : shotId === 4 ? "dread" : "terrified";
  const trAction: Action =
    shotId === 1 ? "idle" : shotId === 2 ? "peer" : shotId === 3 ? (frame < 72 ? "idle" : "recoil") : shotId === 4 ? "idle" : "recoil";

  const viewTr =
    shotId === 2
      ? { view: "back" as const, back: true, side: false, mirror: false, facing: 0 as const, fs: 0 }
      : shotId === 1
      ? { view: "side" as const, back: false, side: true, mirror: false, facing: 0 as const, fs: 1 }
      : shotId === 4
      ? { view: "front" as const, back: false, side: false, mirror: false, facing: 1 as const, fs: 0 }
      : viewOf(cam, trPos[0], trPos[2], 0.45, 0.85);

  const trPlace: Place = placePerson(
    cam,
    sunDir,
    { i: 1, o: TRAVELER, okey: "hl_traveler_v2" },
    trPos[0],
    trPos[1],
    trPos[2],
    viewTr,
    {
      action: trAction,
      poseMix: shotId === 3 ? clamp01((frame - 70) / 8) : 0.85,
      expr: trExpr,
      frontArm: trAction === "idle" ? "hold" : undefined,
      holdProp: true,
      look: shotId === 3 ? -0.55 : 0.35,
      underLight: shotId === 4 ? 0.78 : shotId === 5 ? 0.55 : 0,
      blink: lidAt(t, 1, [72 / FPS, 120 / FPS]),
      shiver: shotId >= 4 ? 0.8 : 0.2,
      wind: shotId === 3 ? 0.9 : 0.25,
      time: t,
    },
  );
  out.places.push(trPlace);
  pushContactShadow(out, sunDir, light, trPos[0], trPos[1] + 0.01, trPos[2], 0.95, 0.88);

  // Subliminal lurking eyes in dark yard shadows during Shot 1 wide establishing
  if (shotId === 1) {
    out.fx.push({
      key: "hl_v25_lurk",
      cw: 256,
      ch: 128,
      draw: (p) => fxLurkingEyes(p, 0, "210,235,250"),
      x: 2.35,
      y: 1.05,
      z: -1.4,
      w: 0.34,
      h: 0.17,
      soft: true,
      renderOrder: 1.5,
    });
  }

  // Gaunt translucent uncanny apparition staged in doorway / midground (stepped FPS + head snap + double-vision trail!)
  const showGhost = (shotId === 3 && frame >= 72) || shotId === 4 || shotId === 5;
  if (showGhost) {
    const ghPos = shotId >= 5 ? ANCHORS.GHOST_NEAR : ANCHORS.GHOST_FAR;
    const uTime = uncannyTime(frame, 4);
    const ghHover = 0.05 * Math.sin(uTime * 2.3);
    const ghExpr: Expr = shotId >= 5 ? "unhinged" : "hollow";
    const ghAction: Action = shotId >= 5 ? "lunge" : "emerge";
    const ghOpacity = shotId === 3 ? 0.65 : shotId === 4 ? 0.72 : 0.88;
    const ghView = viewOf(cam, ghPos[0], ghPos[2], -0.25, 1);
    const ghPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 2, o: GHOST_FIGURE, okey: "hl_ghost_v25" },
      ghPos[0],
      ghPos[1] + ghHover,
      ghPos[2],
      ghView,
      {
        action: ghAction,
        poseMix: shotId === 5 ? clamp01((frame - 120) / 14) : 0.8,
        expr: ghExpr,
        headTilt: (shotId >= 5 ? 28 : 18) + uncannyTwitch(frame, 5, 14, 16),
        jawDrop: shotId >= 5 ? 0.92 : 0.72,
        underLight: shotId >= 5 ? 0.65 : 0.35,
        blink: 0,
        shiver: 0.7,
        wind: 0.8,
        time: uTime,
      },
    );
    ghPlace.opacity = ghOpacity;
    out.places.push(ghPlace);

    if (shotId >= 5) {
      pushAfterimage(
        out,
        ghPlace,
        [
          [-0.14, 0.04, -0.06, 0.28],
          [0.12, -0.04, -0.09, 0.18],
        ],
        0.06,
      );
      pushFlatDecal(
        out,
        "hl_v25_longsh",
        512,
        512,
        (p) => fxLongShadow(p, 0.45, "rgba(4,1,7,0.72)"),
        ghPos[0],
        0.02,
        ghPos[2] + 1.1,
        1.35,
        2.15,
        0.1,
        0.65,
      );
    }
  }

  // Upward-drifting eerie ash/embers in Shots 4 & 5
  if (shotId >= 4) {
    const au = Math.round(((t * 0.25) % 1) * 16) / 16;
    out.fx.push({
      key: `hl_v25_ash_${light}_${au}`,
      cw: 512,
      ch: 512,
      draw: (p) => fxFloatingAsh(p, au, light === "blood" ? "rgba(255,115,95,0.48)" : "rgba(160,240,215,0.40)"),
      x: 0.0,
      y: 1.5,
      z: -0.2,
      w: 4.5,
      h: 4.5,
      soft: true,
      renderOrder: 2.2,
    });
  }

  // Hanging lantern soft glow halo
  const flk = flickerAt(frame, 13, 0.3, 0.45);
  const glowRgb = light === "eerie" ? "120,235,190" : light === "blood" ? "255,80,70" : "255,175,90";
  out.fx.push({
    key: `hl_glow_${light}_${Math.round(flk * 10)}`,
    cw: 400,
    ch: 400,
    draw: (p) => fxFlickerGlow(p, flk, glowRgb),
    x: ANCHORS.LANTERN_POST[0] - 0.44,
    y: ANCHORS.LANTERN_POST[1] + 2.16,
    z: ANCHORS.LANTERN_POST[2] + 0.08,
    w: 1.9,
    h: 1.9,
    soft: true,
  });

  // Low drifting feathered mist (vertical mask fades cleanly to 0 at ground plane)
  const mistLoop = Math.round(((t * 0.25) % 1) * 20) / 20;
  const mistCol = light === "blood" ? "rgba(180,65,75,0.18)" : "rgba(165,195,225,0.20)";
  out.fx.push({
    key: `hl_mist_${light}_${mistLoop}`,
    cw: 600,
    ch: 300,
    draw: (p) => fxMist(p, mistLoop, mistCol),
    x: 0.1,
    y: 0.95,
    z: -0.9,
    w: 6.8,
    h: 1.9,
    soft: true,
  });

  // Cold night breath curling forward in eerie MCU side shot
  if (shotId === 4) {
    const bu = clamp01(((frame - 92) % 26) / 26);
    const dir = viewTr.mirror ? -1 : 1;
    out.fx.push({
      key: `hl_breath_${dir}_${Math.round(bu * 12)}`,
      cw: 300,
      ch: 300,
      draw: (p) => fxBreath(p, bu, dir),
      x: trPos[0] + dir * 0.24,
      y: trPos[1] + 1.48,
      z: trPos[2] + 0.12,
      w: 0.72,
      h: 0.72,
      soft: true,
    });
  }

  // Fine storm rain + fractal lightning bolt
  if (shotId === 3) {
    const ru = Math.round(((frame - 60) / 18) * 16) / 16;
    out.fx.push({
      key: `hl_rain_${ru}`,
      cw: 512,
      ch: 768,
      draw: (p) => fxRain(p, ru),
      x: -0.2,
      y: 2.0,
      z: 1.2,
      w: 5.0,
      h: 5.5,
      soft: true,
    });
    if (frame >= 72 && frame < 78) {
      out.fx.push({
        key: "hl_bolt_72",
        cw: 400,
        ch: 800,
        draw: (p) => fxLightning(p, 7),
        x: -1.8,
        y: 5.2,
        z: -14.0,
        w: 4.5,
        h: 9.0,
        soft: true,
      });
    }
  }

  return out;
}
