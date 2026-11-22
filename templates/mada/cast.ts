// Character & 2D FX staging for "Ma Da" (MadaShort) across both EraGroups ("wharf" and "shack").

import * as THREE from "three";
import {
  CamInfo,
  Expr,
  FPS,
  FrontArm,
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
  fxRing,
  fxSplash,
  lidAt,
  placePerson,
  pushContactShadow,
  viewOf,
} from "../engine";
import { ANCHORS, evalMadaState } from "./story";
import { MA_DA_GHOST, ONG_TU, ONG_TU_SHACK, fxConicalHat, fxPaleHand, fxWetFootprints } from "./toon";

export function stageMada(
  shotId: number,
  frame: number,
  light: LightKey,
  cam: CamInfo,
  sunDir: THREE.Vector3,
): Stage {
  const out: Stage = { places: [], fx: [] };
  const t = frame / FPS;
  const st = evalMadaState(shotId, frame);
  const flk = flickerAt(frame, 17, 0.32, 0.42);
  const isWharf = shotId <= 8;

  if (isWharf) {
    // ---------------- ERA 1: WHARF ("wharf") ----------------
    let tuX = ANCHORS.PIER_EDGE[0];
    const tuY = ANCHORS.PIER_EDGE[1];
    let tuZ = ANCHORS.PIER_EDGE[2];
    let tuMode: "stand" | "march" = "stand";
    let tuPhase = 0;
    let tuTilt = 0;
    let tuLook = 0.25;
    let tuArm: FrontArm | undefined = "hold";
    let tuExpr: Expr = "suspicious";

    if (shotId === 1) {
      tuX = ANCHORS.PIER_WALK[0];
      tuZ = ANCHORS.PIER_WALK[2];
      tuExpr = "suspicious";
    } else if (shotId === 2) {
      const u = clamp01((frame - 256) / 200);
      tuX = ANCHORS.PIER_WALK[0] + (ANCHORS.PIER_EDGE[0] - ANCHORS.PIER_WALK[0]) * u;
      tuZ = ANCHORS.PIER_WALK[2] + (ANCHORS.PIER_EDGE[2] - ANCHORS.PIER_WALK[2]) * u;
      tuMode = u < 0.92 ? "march" : "stand";
      tuPhase = (t * 0.85) % 1;
      tuExpr = "suspicious";
    } else if (shotId === 3) {
      tuExpr = frame < 610 ? "suspicious" : "dread";
      tuLook = 0.45;
    } else if (shotId === 4) {
      tuExpr = "dread";
      tuTilt = 5;
      tuLook = 0.35;
    } else if (shotId === 5) {
      tuExpr = frame < 1055 ? "dread" : "terrified";
      tuTilt = 4;
      tuLook = 0.55;
    } else if (shotId === 6) {
      tuX = -0.32;
      tuExpr = "terrified";
      tuTilt = -4;
      tuLook = 0.48;
    } else if (shotId === 7) {
      tuX = -0.30;
      tuZ = -1.48;
      tuExpr = "terrified";
      tuTilt = -10;
      tuArm = "raise";
      tuLook = 0.50;
    } else if (shotId === 8) {
      const u = clamp01((frame - 1498) / 230);
      tuX = ANCHORS.PIER_RECOIL[0];
      tuZ = -1.35 + 0.85 * u;
      tuMode = u < 0.88 ? "march" : "stand";
      tuPhase = (t * 1.05) % 1;
      tuExpr = "terrified";
      tuLook = 0.35;
    }

    const viewTu = viewOf(cam, tuX, tuZ, 0.25, -1);
    const tuPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 1, o: ONG_TU, okey: "mada_ong_tu" },
      tuX,
      tuY,
      tuZ,
      viewTu,
      {
        expr: tuExpr,
        mode: tuMode,
        phase: tuPhase,
        frontArm: tuArm,
        look: tuLook,
        blink: lidAt(t, 1, [698 / FPS, 1145 / FPS, 1405 / FPS]),
        tilt: tuTilt,
      },
      {
        expr: tuExpr,
        mode: tuMode,
        phase: tuPhase,
        holdProp: true,
        blink: lidAt(t, 1, [698 / FPS, 1145 / FPS, 1405 / FPS]),
      },
    );
    out.places.push(tuPlace);
    pushContactShadow(out, sunDir, light, tuX, tuY + 0.01, tuZ, 0.95, 0.85);

    // Subtle cold breath vapor aligned beside Ông Tư's mouth (y = tuY + 1.24, x = tuX + dir * 0.36)
    if (shotId === 2 || shotId === 4) {
      const bu = clamp01(((frame - 10) % 26) / 26);
      const dir = viewTu.mirror ? -1 : 1;
      out.fx.push({
        key: `mada_breath_w_${dir}_${Math.round(bu * 12)}`,
        cw: 300,
        ch: 300,
        draw: (p) => fxBreath(p, bu, dir),
        x: tuX + dir * 0.36,
        y: tuY + 1.24,
        z: tuZ - 0.14,
        w: 0.46,
        h: 0.46,
        soft: true,
      });
    }

    // Ma Da emerging waist/chest-deep out of the dark river (y = 0 water plane clips lower body, depthWrite blocks 3D pier lines!)
    const showFarGhost = shotId === 1 && frame >= 20 && frame <= 185;
    const showRiseGhost = (shotId === 6 && frame >= 1145) || shotId === 7 || shotId === 8;
    if (showFarGhost || showRiseGhost) {
      const gx = showFarGhost
        ? ANCHORS.MADA_FAR[0]
        : shotId === 7
        ? ANCHORS.MADA_GRAB[0]
        : shotId === 8
        ? 0.36
        : ANCHORS.MADA_RISE[0];
      const gy = showFarGhost ? ANCHORS.MADA_FAR[1] + 0.04 * Math.sin(t * 2.2) : st.madaY;
      const gz = showFarGhost
        ? ANCHORS.MADA_FAR[2]
        : shotId === 7
        ? ANCHORS.MADA_GRAB[2]
        : ANCHORS.MADA_RISE[2];
      const gExpr: Expr = shotId === 7 || (shotId === 6 && frame >= 1295) ? "unhinged" : "hollow";
      const gArm: FrontArm | undefined = shotId === 7 ? "raise" : undefined;

      const viewGh = viewOf(cam, gx, gz, -0.22, 1);
      const ghPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 2, o: MA_DA_GHOST, okey: "mada_ghost" },
        gx,
        gy,
        gz,
        viewGh,
        {
          expr: gExpr,
          mode: "stand",
          frontArm: gArm,
          look: -0.35,
          blink: 0,
          tilt: shotId === 7 ? 7 : 0,
        },
        {
          expr: gExpr,
          mode: "stand",
          holdProp: shotId === 7,
          blink: 0,
        },
      );
      out.places.push(ghPlace);

      // Water rings around Ma Da's emergence point at river surface
      const ringU = Math.round(((t * 0.75) % 1) * 16) / 16;
      out.fx.push({
        key: `mada_ring_gh_${ringU}`,
        cw: 400,
        ch: 240,
        draw: (p) => fxRing(p, ringU),
        x: gx,
        y: 0.14,
        z: gz - 0.16,
        w: 1.45,
        h: 0.68,
        soft: true,
      });
    }

    // Shot 3: Floating battered conical hat (nón lá) drifting upstream toward sampan bow
    if (shotId === 3 && frame >= 530) {
      const hu = st.hatProgress;
      const hx = 0.05 + 0.42 * hu;
      const hz = -3.35 + 0.98 * hu;
      const hLoop = Math.round(((t * 0.8) % 1) * 16) / 16;
      out.fx.push({
        key: `mada_hat_${hLoop}`,
        cw: 420,
        ch: 300,
        draw: (p) => fxConicalHat(p, hLoop),
        x: hx,
        y: 0.22,
        z: hz,
        w: 0.88,
        h: 0.62,
        soft: true,
      });
      if (frame >= 692 && frame <= 748) {
        const ru = clamp01((frame - 692) / 52);
        out.fx.push({
          key: `mada_hat_ring_${Math.round(ru * 14)}`,
          cw: 400,
          ch: 240,
          draw: (p) => fxRing(p, ru),
          x: 0.48,
          y: 0.14,
          z: -2.35,
          w: 1.25,
          h: 0.62,
          soft: true,
        });
      }
    }

    // Shot 5: Pale drowned hand emerging from the dark water gripping the sampan's mooring rope
    if (shotId === 5 && frame >= 980) {
      const gu = Math.round(st.handGrab * 16) / 16;
      out.fx.push({
        key: `mada_hand_${gu}`,
        cw: 360,
        ch: 440,
        draw: (p) => fxPaleHand(p, gu),
        x: 0.36,
        y: 0.38,
        z: -2.08,
        w: 0.80,
        h: 0.98,
        soft: true,
      });
      const ru = Math.round(((t * 1.1) % 1) * 16) / 16;
      out.fx.push({
        key: `mada_hand_ring_${ru}`,
        cw: 400,
        ch: 240,
        draw: (p) => fxRing(p, ru),
        x: 0.36,
        y: 0.14,
        z: -2.14,
        w: 1.25,
        h: 0.62,
        soft: true,
      });
    }

    // Shot 6: Driving storm rain + twin lightning bolts
    if (shotId === 6) {
      const ru = Math.round(((frame - 1140) / 18) * 16) / 16;
      out.fx.push({
        key: `mada_rain_${ru}`,
        cw: 400,
        ch: 600,
        draw: (p) => fxRain(p, ru),
        x: -0.05,
        y: 1.95,
        z: -3.15,
        w: 4.5,
        h: 4.8,
        soft: true,
      });
      if ((frame >= 1145 && frame < 1153) || (frame >= 1280 && frame < 1288)) {
        const seed = frame < 1200 ? 7 : 13;
        out.fx.push({
          key: `mada_bolt_${seed}`,
          cw: 400,
          ch: 800,
          draw: (p) => fxLightning(p, seed),
          x: frame < 1200 ? -1.4 : 1.2,
          y: 5.2,
          z: -15.0,
          w: 4.6,
          h: 9.2,
          soft: true,
        });
      }
    }

    // Shot 7: Water splash at the pier edge when Ma Da lunges for Ông Tư's ankle
    if (shotId === 7 && frame >= 1396 && frame <= 1445) {
      const su = clamp01((frame - 1396) / 45);
      out.fx.push({
        key: `mada_splash_${Math.round(su * 14)}`,
        cw: 400,
        ch: 400,
        draw: (p) => fxSplash(p, su),
        x: 0.02,
        y: 0.56,
        z: -1.98,
        w: 1.35,
        h: 1.35,
        soft: true,
      });
    }

    // Pier hanging lantern soft glow halo
    const glowRgb = light === "eerie" ? "130,235,190" : light === "blood" ? "255,80,70" : "255,175,90";
    out.fx.push({
      key: `mada_glow_w_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, flk, glowRgb),
      x: ANCHORS.LANTERN_POST[0] + 0.38,
      y: ANCHORS.LANTERN_POST[1] + 2.03,
      z: ANCHORS.LANTERN_POST[2] - 0.06,
      w: 1.75,
      h: 1.75,
      soft: true,
    });

    // Low drifting river mist (smooth sine oscillation so mist never jumps discontinuously)
    const mistLoop = Math.round((0.5 + 0.5 * Math.sin(t * 0.45)) * 24) / 24;
    const mistCol = light === "blood" ? "rgba(180,75,85,0.20)" : "rgba(175,205,235,0.21)";
    out.fx.push({
      key: `mada_mist_w_${light}_${mistLoop}`,
      cw: 600,
      ch: 300,
      draw: (p) => fxMist(p, mistLoop, mistCol),
      x: 0.0,
      y: 0.96,
      z: -1.8,
      w: 6.4,
      h: 1.85,
      soft: true,
    });
  } else {
    // ---------------- ERA 2: WATCHMAN'S SHACK ("shack") ----------------
    const u9 = shotId === 9 ? clamp01((frame - 1759) / 135) : 1;
    const tuX =
      shotId === 9
        ? ANCHORS.ONG_TU_DOOR[0] + (ANCHORS.ONG_TU_FLOOR[0] - ANCHORS.ONG_TU_DOOR[0]) * u9
        : ANCHORS.ONG_TU_FLOOR[0];
    const tuY = 0.0;
    const tuZ =
      shotId === 9
        ? ANCHORS.ONG_TU_DOOR[2] + (ANCHORS.ONG_TU_FLOOR[2] - ANCHORS.ONG_TU_DOOR[2]) * u9
        : ANCHORS.ONG_TU_FLOOR[2];
    const tuMode: "stand" | "march" = shotId === 9 && u9 < 0.88 ? "march" : "stand";
    const tuPhase = (t * 0.9) % 1;
    const tuExpr: Expr = shotId === 9 ? "terrified" : frame < 2055 ? "dread" : "terrified";

    const viewTu = viewOf(cam, tuX, tuZ, 0.30, -1);
    const tuPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 1, o: ONG_TU_SHACK, okey: "mada_ong_tu_shack" },
      tuX,
      tuY,
      tuZ,
      viewTu,
      {
        expr: tuExpr,
        mode: tuMode,
        phase: tuPhase,
        frontArm: shotId === 10 && frame >= 2060 ? "raise" : undefined,
        look: shotId === 10 ? 0.55 : -0.35,
        blink: lidAt(t, 1, [2066 / FPS]),
        tilt: shotId === 10 ? 4 : -3,
      },
      {
        expr: tuExpr,
        mode: tuMode,
        phase: tuPhase,
        holdProp: false,
        blink: lidAt(t, 1, [2066 / FPS]),
      },
    );
    out.places.push(tuPlace);
    pushContactShadow(out, sunDir, light, tuX, tuY + 0.01, tuZ, 0.95, 0.85);

    // Subtle cold breath vapor inside the shack in Shot 9 (aligned beside mouth at y = 1.24)
    if (shotId === 9) {
      const bu = clamp01(((frame - 1765) % 24) / 24);
      const dir = viewTu.mirror ? -1 : 1;
      out.fx.push({
        key: `mada_breath_s_${dir}_${Math.round(bu * 12)}`,
        cw: 300,
        ch: 300,
        draw: (p) => fxBreath(p, bu, dir),
        x: tuX + dir * 0.36,
        y: tuY + 1.24,
        z: tuZ + 0.14,
        w: 0.45,
        h: 0.45,
        soft: true,
      });
    }

    // Table oil lamp flicker glow halo (visible on screen right in Shots 9 & 10)
    const glowRgb = light === "blood" ? "255,175,140" : "255,195,115";
    out.fx.push({
      key: `mada_glow_s_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.35), glowRgb),
      x: ANCHORS.SHACK_TABLE[0] - 0.12,
      y: ANCHORS.SHACK_TABLE[1] + 1.02,
      z: ANCHORS.SHACK_TABLE[2] + 0.12,
      w: 2.65,
      h: 2.65,
      soft: true,
    });
    // Secondary warm bounce halo around the oil lamp & table
    out.fx.push({
      key: `mada_winglow_s_${light}_${Math.round(flk * 8)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, 0.92, glowRgb),
      x: ANCHORS.SHACK_TABLE[0] - 0.22,
      y: ANCHORS.SHACK_TABLE[1] + 0.96,
      z: ANCHORS.SHACK_TABLE[2] + 0.18,
      w: 2.1,
      h: 2.1,
      soft: true,
    });

    // Shot 10 Twist: Wet black-mud footprints printed on the dry wooden floorboards right behind Ông Tư
    if (shotId === 10) {
      const rev = Math.max(0.18, Math.round(st.footprintReveal * 16) / 16);
      out.fx.push({
        key: `mada_footprints_${rev}`,
        cw: 420,
        ch: 420,
        draw: (p) => fxWetFootprints(p, rev),
        x: ANCHORS.FOOTPRINTS[0],
        y: 0.20,
        z: ANCHORS.FOOTPRINTS[2],
        w: 1.05,
        h: 0.85,
        soft: true,
      });
    }
  }

  return out;
}
