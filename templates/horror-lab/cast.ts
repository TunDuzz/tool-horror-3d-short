// Character & 2D FX staging for HorrorLab across all 5 horror lighting presets.

import * as THREE from "three";
import {
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
  fxLightning,
  fxMist,
  fxRain,
  lidAt,
  placePerson,
  pushContactShadow,
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
    shotId === 1
      ? "suspicious"
      : shotId === 2
      ? "dread"
      : shotId === 3
      ? frame < 72
        ? "suspicious"
        : "terrified"
      : shotId === 4
      ? "dread"
      : "terrified";

  const viewTr = viewOf(cam, trPos[0], trPos[2], 0.25, -1);
  const trPlace: Place = placePerson(
    cam,
    sunDir,
    { i: 1, o: TRAVELER, okey: "hl_traveler" },
    trPos[0],
    trPos[1],
    trPos[2],
    viewTr,
    {
      expr: trExpr,
      mode: "stand",
      frontArm: "hold",
      look: shotId === 3 ? -0.6 : 0.4,
      blink: lidAt(t, 1, [72 / FPS, 120 / FPS]),
      tilt: shotId === 5 ? -4 : 0,
    },
    {
      expr: trExpr,
      mode: "stand",
      holdProp: true,
      blink: lidAt(t, 1, [72 / FPS, 120 / FPS]),
    },
  );
  out.places.push(trPlace);
  pushContactShadow(out, sunDir, light, trPos[0], trPos[1] + 0.01, trPos[2], 0.95, 0.85);

  // Translucent apparition staged in shots 1, 3 (post-lightning), 4, 5
  const showGhost = shotId === 1 || (shotId === 3 && frame >= 72) || shotId === 4 || shotId === 5;
  if (showGhost) {
    const ghPos = shotId >= 4 ? ANCHORS.GHOST_NEAR : ANCHORS.GHOST_FAR;
    const ghHover = 0.06 * Math.sin(t * 2.4);
    const ghExpr: Expr = shotId >= 4 ? "unhinged" : "hollow";
    const ghOpacity = shotId === 1 ? 0.46 : shotId === 3 ? 0.56 : shotId === 4 ? 0.62 : 0.74;
    const ghView = viewOf(cam, ghPos[0], ghPos[2], -0.2, 1);
    const ghPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 2, o: GHOST_FIGURE, okey: "hl_ghost" },
      ghPos[0],
      ghPos[1] + ghHover,
      ghPos[2],
      ghView,
      {
        expr: ghExpr,
        mode: "stand",
        blink: 0,
      },
      {
        expr: ghExpr,
        mode: "stand",
        blink: 0,
      },
    );
    ghPlace.opacity = ghOpacity;
    out.places.push(ghPlace);
  }

  // Hanging lantern soft glow halo
  const flk = flickerAt(frame, 13, 0.3, 0.45);
  const glowRgb = light === "eerie" ? "130,235,190" : light === "blood" ? "255,80,70" : "255,175,90";
  out.fx.push({
    key: `hl_glow_${light}_${Math.round(flk * 10)}`,
    cw: 400,
    ch: 400,
    draw: (p) => fxFlickerGlow(p, flk, glowRgb),
    x: ANCHORS.LANTERN_POST[0] - 0.43,
    y: ANCHORS.LANTERN_POST[1] + 2.17,
    z: ANCHORS.LANTERN_POST[2] + 0.08,
    w: 1.9,
    h: 1.9,
    soft: true,
  });

  // Low drifting mist in courtyard (y >= h/2 so ground plane at y=0 never slices a crisp bottom line)
  const mistLoop = Math.round(((t * 0.25) % 1) * 20) / 20;
  const mistCol = light === "blood" ? "rgba(180,75,85,0.20)" : "rgba(180,205,235,0.22)";
  out.fx.push({
    key: `hl_mist_${light}_${mistLoop}`,
    cw: 600,
    ch: 300,
    draw: (p) => fxMist(p, mistLoop, mistCol),
    x: 0.1,
    y: 0.92,
    z: -0.9,
    w: 6.2,
    h: 1.9,
    soft: true,
  });

  // Cold night breath vapor in candle shot (aligned to character's facing side)
  if (shotId === 2) {
    const bu = clamp01(((frame - 34) % 24) / 24);
    const dir = viewTr.mirror ? -1 : 1;
    out.fx.push({
      key: `hl_breath_${dir}_${Math.round(bu * 12)}`,
      cw: 300,
      ch: 300,
      draw: (p) => fxBreath(p, bu, dir),
      x: trPos[0] + dir * 0.24,
      y: trPos[1] + 1.46,
      z: trPos[2] + 0.14,
      w: 0.72,
      h: 0.72,
      soft: true,
    });
  }

  // Rain + lightning bolt in storm shot
  if (shotId === 3) {
    const ru = Math.round(((frame - 60) / 20) * 16) / 16;
    out.fx.push({
      key: `hl_rain_${ru}`,
      cw: 400,
      ch: 600,
      draw: (p) => fxRain(p, ru),
      x: 0.0,
      y: 2.0,
      z: 1.4,
      w: 4.2,
      h: 5.0,
      soft: true,
    });
    if (frame >= 72 && frame < 78) {
      out.fx.push({
        key: "hl_bolt_72",
        cw: 400,
        ch: 800,
        draw: (p) => fxLightning(p, 7),
        x: -2.2,
        y: 5.5,
        z: -14.0,
        w: 4.5,
        h: 9.0,
        soft: true,
      });
    }
  }

  return out;
}
