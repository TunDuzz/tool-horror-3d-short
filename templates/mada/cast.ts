// Gothic Ink-Noir character acting, continuous micro-motion, and perspective-locked 2D FX for "Ma Da" v2.

import * as THREE from "three";
import {
  Action,
  CamInfo,
  Expr,
  FPS,
  FrontArm,
  LightKey,
  Place,
  Stage,
  ViewKind,
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
  fxSplash,
  fxWaterRipple,
  fxWetFootprints,
  fxWindowHand,
  lidAt,
  placePerson,
  pushAfterimage,
  pushContactShadow,
  pushFlatDecal,
  smoothstep,
  uncannyTime,
  uncannyTwitch,
  viewOf,
} from "../engine";
import { ANCHORS, evalMadaState } from "./story";
import { MA_DA_GHOST, ONG_TU, ONG_TU_SHACK, fxGothicDrownedHand } from "./toon";

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
  const flk = flickerAt(frame, 17, 0.32, 0.44);
  const isWharf = shotId <= 8;

  if (isWharf) {
    // ---------------- ERA 1: WHARF ("wharf") ----------------
    const [tuX, tuY, tuZ] = st.tuPos;
    let tuAction: Action = "idle";
    let tuPhase = 0;
    let tuPoseMix = 1;
    let tuTilt = 0;
    let tuHeadPitch = 0;
    let tuLook = 0.25;
    let tuShiver = 0.08;
    let tuWind = 0.25;
    let tuArm: FrontArm | undefined = "hold";
    let tuExpr: Expr = "wary";
    let tuViewOverride: ViewKind | undefined;
    let tuMirrorOverride: boolean | undefined;

    if (shotId === 1) {
      tuAction = "idle";
      tuExpr = "wary";
      tuWind = 0.35;
    } else if (shotId === 2) {
      // OTS from behind Ông Tư walking slowly down the misty pier
      const u = clamp01((frame - 256) / 195);
      tuAction = u < 0.94 ? "creep" : "idle";
      tuPhase = (t * 0.72) % 1;
      tuViewOverride = "back";
      tuExpr = "suspicious";
      tuWind = 0.30;
    } else if (shotId === 3) {
      // Background figure on pier peering down at river as torn nón lá hits boat
      tuAction = frame < 590 ? "idle" : "peer";
      tuPoseMix = smoothstep(590, 645, frame);
      tuHeadPitch = -0.65;
      tuExpr = frame < 620 ? "suspicious" : "uneasy";
    } else if (shotId === 4) {
      // Side profile MCU: leaning LEFT out over pier edge extending lantern down over dark water & hyacinths
      tuAction = "peer";
      tuPoseMix = smoothstep(765, 810, frame);
      tuHeadPitch = -0.85;
      tuExpr = "dread";
      tuShiver = 0.35;
      tuViewOverride = "side";
      tuMirrorOverride = true;
    } else if (shotId === 5) {
      // Steep POV looking down at rope/hand — Ông Tư is behind camera
      tuAction = "peer";
    } else if (shotId === 6) {
      // Low-angle storm reveal: Ông Tư recoils sharply as Ma Da rises out of the river
      tuAction = frame < 1148 ? "peer" : "recoil";
      tuPoseMix = smoothstep(1148, 1185, frame);
      tuExpr = frame < 1146 ? "dread" : "terrified";
      tuShiver = 0.85;
      tuWind = 0.95;
      tuLook = 0.45;
    } else if (shotId === 7) {
      // Tight Dutch-tilt climax: Ông Tư recoiling backward off-balance as Ma Da lunges at his ankle
      tuAction = "recoil";
      tuPoseMix = 1.0;
      tuExpr = "terrified";
      tuTilt = -8;
      tuShiver = 1.0;
      tuWind = 0.95;
      tuLook = 0.50;
    } else if (shotId === 8) {
      // Reverse wide shot: Ông Tư running/stumbling frantically up pier toward shack
      tuAction = "flee";
      tuPhase = (t * 1.45) % 1;
      tuExpr = "terrified";
      tuShiver = 0.9;
      tuWind = 0.85;
      tuViewOverride = "front";
    }

    if (shotId !== 5) {
      const autoView = viewOf(cam, tuX, tuZ, 0.25, -1);
      const viewTu = {
        ...autoView,
        ...(tuViewOverride ? { view: tuViewOverride, side: tuViewOverride === "side", back: tuViewOverride === "back" } : {}),
        ...(tuMirrorOverride !== undefined ? { mirror: tuMirrorOverride } : {}),
      };
      const tuPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 1, o: ONG_TU, okey: "mada_v2_ong_tu" },
        tuX,
        tuY,
        tuZ,
        viewTu,
        {
          action: tuAction,
          phase: tuPhase,
          poseMix: tuPoseMix,
          expr: tuExpr,
          frontArm: tuAction === "idle" ? tuArm : undefined,
          holdProp: true,
          look: tuLook,
          blink: lidAt(t, 1, [698 / FPS, 1145 / FPS, 1405 / FPS]),
          tilt: tuTilt,
          headPitch: tuHeadPitch,
          underLight: shotId === 4 ? 0.85 : shotId === 6 || shotId === 7 ? 0.45 : 0,
          shiver: tuShiver,
          wind: tuWind,
          time: t,
        },
      );
      out.places.push(tuPlace);
      pushContactShadow(out, sunDir, light, tuX, tuY + 0.01, tuZ, 0.95, 0.88);

      // Subliminal peripheral dread: faint asymmetric watching eyes peering from pitch-black reeds/trees in Shots 1 & 2
      if (shotId === 1) {
        const eb = lidAt(t, 9, [], FPS);
        out.fx.push({
          key: `mada_v25_lurk1_${eb > 0.5 ? 1 : 0}`,
          cw: 256,
          ch: 128,
          draw: (p) => fxLurkingEyes(p, eb, "200,228,242"),
          x: -1.85,
          y: 1.38,
          z: 1.55,
          w: 0.34,
          h: 0.17,
          soft: true,
          renderOrder: 1.6,
        });
      } else if (shotId === 2) {
        const eb = lidAt(t, 11, [], FPS);
        out.fx.push({
          key: `mada_v25_lurk2_${eb > 0.5 ? 1 : 0}`,
          cw: 256,
          ch: 128,
          draw: (p) => fxLurkingEyes(p, eb, "215,235,245"),
          x: 0.72,
          y: 0.44,
          z: -3.25,
          w: 0.28,
          h: 0.14,
          soft: true,
          renderOrder: 1.6,
        });
      }

      // Delicate curling cold breath in Shot 4 MCU side profile aligned in front of leaning mouth (over river)
      if (shotId === 4) {
        const bu = clamp01(((frame - 775) % 34) / 34);
        const dir = viewTu.mirror ? -1 : 1;
        out.fx.push({
          key: `mada_v2_breath_${dir}_${Math.round(bu * 14)}`,
          cw: 300,
          ch: 300,
          draw: (p) => fxBreath(p, bu, dir),
          x: tuX,
          y: tuY + 1.18,
          z: tuZ - 0.42,
          w: 0.56,
          h: 0.56,
          soft: true,
        });
      }
    }

    // ---------------- MA DA (STRICTLY HIDDEN UNTIL SHOT 6 STORM REVEAL!) ----------------
    const showMaDa = (shotId === 6 && frame >= 1145) || shotId === 7 || shotId === 8;
    if (showMaDa) {
      const gx = shotId === 7 ? 0.22 : shotId === 8 ? 0.14 : ANCHORS.MADA_RISE[0];
      const gy = shotId === 7 ? -0.14 : st.madaY;
      const gz = shotId === 7 ? -2.08 : shotId === 8 ? -2.05 : ANCHORS.MADA_RISE[2];
      const gExpr: Expr = shotId === 7 || (shotId === 6 && frame >= 1295) ? "unhinged" : "hollow";
      const gAction: Action = shotId === 7 ? "lunge" : "emerge";
      const gPoseMix = shotId === 7 ? smoothstep(1388, 1412, frame) : 1.0;

      // Shot 6 faces camera front-3/4 showing hollow corpse face; Shot 7 lunges sideways directly toward Ông Tư!
      const viewGh =
        shotId === 6
          ? { view: "front" as const, side: false, back: false, mirror: false, facing: 1 as const, fs: 0 }
          : shotId === 7
          ? { view: "side" as const, side: true, back: false, mirror: true, facing: 0 as const, fs: 1 }
          : viewOf(cam, gx, gz, -0.15, 1);

      // Uncanny supernatural motion mismatch: Ma Da runs at stepped 7.5 fps with sudden 2-frame violent neck snaps!
      const uTime = uncannyTime(frame, 4);
      const neckSnap = (shotId === 7 ? -26 : 22) + uncannyTwitch(frame, 7, 16, 18);
      const ghPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 2, o: MA_DA_GHOST, okey: "mada_v25_ghost" },
        gx,
        gy,
        gz,
        viewGh,
        {
          action: gAction,
          poseMix: gPoseMix,
          expr: gExpr,
          look: -0.25,
          blink: 0,
          tilt: shotId === 7 ? 8 : 0,
          headTilt: neckSnap,
          jawDrop: shotId === 7 ? 0.95 : 0.72,
          underLight: shotId === 7 ? 0.65 : 0.35,
          shiver: 0.65,
          wind: 0.9,
          time: uTime,
        },
        1.06,
      );
      out.places.push(ghPlace);

      // Hallucinatory Silent Hill / Jacob's Ladder double-exposure afterimages during emergence & lunge!
      if (shotId === 7 || (shotId === 6 && frame >= 1275)) {
        pushAfterimage(
          out,
          ghPlace,
          shotId === 7
            ? [
                [-0.14, 0.05, -0.06, 0.26],
                [0.11, -0.04, -0.10, 0.16],
              ]
            : [[-0.09, 0.03, -0.05, 0.22]],
          0.055,
        );
      }

      // Elongated distorted clawed shadow stretching independently across the pier planks toward Ông Tư!
      if (shotId === 7 || shotId === 8) {
        pushFlatDecal(
          out,
          `mada_v25_longsh_${shotId}_${Math.round(Math.sin(uTime * 3) * 4)}`,
          512,
          512,
          (p) => fxLongShadow(p, Math.sin(uTime * 3) * 0.6, "rgba(4,1,6,0.74)"),
          -0.18,
          0.77,
          -1.18,
          1.45,
          2.35,
          0.18,
          0.65,
        );
      }

      // Perspective-locked HORIZONTAL water ripples around Ma Da's emergence point (flat: true!)
      const ringU = Math.round(((t * 0.65) % 1) * 18) / 18;
      pushFlatDecal(
        out,
        `mada_v2_rip_gh_${light}_${ringU}`,
        512,
        512,
        (p) => fxWaterRipple(p, ringU, light === "blood" ? "215,95,95" : "165,205,230"),
        gx,
        0.025,
        gz,
        1.95,
        1.95,
      );
    }

    // Shot 3: Horizontal water ripples under drifting 3D conical hat (flat: true!)
    if (shotId === 3 && frame >= 525) {
      const hu = st.hatProgress;
      const hx = -0.78 + 0.62 * hu;
      const hz = -3.85 + 1.35 * hu;
      const ringU = Math.round(((t * 0.72) % 1) * 18) / 18;
      pushFlatDecal(
        out,
        `mada_v2_rip_hat_${ringU}`,
        512,
        512,
        (p) => fxWaterRipple(p, ringU, "165,205,230"),
        hx,
        0.022,
        hz,
        1.35,
        1.35,
      );
    }

    // Shot 5 ECU POV: High-craft Gothic skeletal drowned hand clutching the 3D mooring rope + flat water ripples!
    if (shotId === 5 && frame >= 980) {
      const gu = Math.round(st.handGrab * 16) / 16;
      const tb = Math.round((t * 8) % 8);
      out.fx.push({
        key: `mada_v2_hand_${gu}_${tb}`,
        cw: 440,
        ch: 520,
        draw: (p) => fxGothicDrownedHand(p, gu, t),
        x: 0.86,
        y: 0.44,
        z: -2.02,
        w: 0.56,
        h: 0.68,
        soft: true,
        renderOrder: 1.5,
      });
      const ru = Math.round(((t * 0.95) % 1) * 18) / 18;
      pushFlatDecal(
        out,
        `mada_v2_rip_hand_${ru}`,
        512,
        512,
        (p) => fxWaterRipple(p, ru, "135,215,195"),
        0.86,
        0.024,
        -2.04,
        1.45,
        1.45,
      );
    }

    // Shot 6: Crisp needle-thin Gothic storm rain positioned near focus plane + fractal sky lightning bolts
    if (shotId === 6) {
      const ru = Math.round(((frame - 1140) / 16) * 16) / 16;
      out.fx.push({
        key: `mada_v2_rain_${ru}`,
        cw: 512,
        ch: 768,
        draw: (p) => fxRain(p, ru, 0.24, "rgba(185,215,242,0.44)"),
        x: -0.10,
        y: 1.85,
        z: -2.20,
        w: 3.9,
        h: 4.8,
        soft: true,
        renderOrder: 2.5,
      });
      if ((frame >= 1145 && frame < 1153) || (frame >= 1280 && frame < 1288)) {
        const seed = frame < 1200 ? 7 : 13;
        out.fx.push({
          key: `mada_v2_bolt_${seed}`,
          cw: 400,
          ch: 800,
          draw: (p) => fxLightning(p, seed),
          x: frame < 1200 ? -1.4 : 1.5,
          y: 5.5,
          z: 14.0,
          w: 4.8,
          h: 9.6,
          soft: true,
        });
      }
    }

    // Shot 7: Translucent dark-water splash spray bursting beside pier edge
    if (shotId === 7 && frame >= 1396 && frame <= 1455) {
      const su = clamp01((frame - 1396) / 52);
      out.fx.push({
        key: `mada_v2_splash_${Math.round(su * 14)}`,
        cw: 600,
        ch: 600,
        draw: (p) => fxSplash(p, su, "#8c5c64"),
        x: 0.05,
        y: 0.42,
        z: -1.95,
        w: 1.05,
        h: 0.95,
        soft: true,
        renderOrder: 2.2,
      });
    }

    // Pier hanging lantern soft glow halo
    const glowRgb = light === "eerie" ? "115,230,185" : light === "blood" ? "255,78,68" : "255,175,90";
    out.fx.push({
      key: `mada_v2_glow_w_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, flk, glowRgb),
      x: ANCHORS.LANTERN_POST[0] + 0.40,
      y: ANCHORS.LANTERN_POST[1] + 2.04,
      z: ANCHORS.LANTERN_POST[2] - 0.04,
      w: 1.75,
      h: 1.75,
      soft: true,
    });

    // Gravity-defying floating ash / eerie embers rising UPWARD against physics in eerie & blood beats
    if (shotId === 4 || shotId === 7 || shotId === 8) {
      const au = Math.round(((t * 0.22) % 1) * 20) / 20;
      const ashCol = light === "blood" ? "rgba(255,118,96,0.48)" : "rgba(180,235,218,0.38)";
      out.fx.push({
        key: `mada_v25_ash_${light}_${au}`,
        cw: 512,
        ch: 512,
        draw: (p) => fxFloatingAsh(p, au, ashCol),
        x: 0.0,
        y: 1.55,
        z: -1.45,
        w: 4.2,
        h: 4.2,
        soft: true,
        renderOrder: 2.3,
      });
    }

    // Subtle feathered Gothic mist (low opacity so characters, boots & gnarled trees stay razor-crisp)
    if (shotId !== 5 && shotId !== 7) {
      const mistLoop = Math.round((0.5 + 0.5 * Math.sin(t * 0.42)) * 24) / 24;
      const mistCol = light === "blood" ? "rgba(175,62,72,0.12)" : "rgba(165,195,225,0.12)";
      out.fx.push({
        key: `mada_v2_mist_w_${light}_${mistLoop}`,
        cw: 600,
        ch: 300,
        draw: (p) => fxMist(p, mistLoop, mistCol),
        x: 0.0,
        y: 1.25,
        z: shotId === 2 ? -3.4 : -2.6,
        w: 7.4,
        h: 1.75,
        soft: true,
        renderOrder: 1.8,
      });
    }
  } else {
    // ---------------- ERA 2: WATCHMAN'S SHACK ("shack") ----------------
    const [tuX, tuY, tuZ] = st.tuPos;
    let tuAction: Action = "idle";
    let tuPhase = 0;
    let tuExpr: Expr = "terrified";
    let tuGlance: -1 | 0 | 1 = 0;
    let tuView: ViewKind = "side";
    let tuMirror = false;

    if (shotId === 9) {
      const bolted = frame >= 1832;
      tuAction = bolted ? "boltDoor" : "flee";
      tuPhase = (t * 1.4) % 1;
      tuExpr = "terrified";
      tuView = "side";
      tuMirror = false;
    } else {
      // Shot 10 FINALE: Ông Tư stands facing the bolted door (bodyBack!), then slowly turns his head
      // in a terrifying over-the-shoulder profile glance (glance: 1) looking back at the footprints behind his heels!
      tuAction = frame >= 2055 ? "recoil" : "idle";
      tuExpr = frame < 2045 ? "dread" : "terrified";
      tuView = "back";
      tuGlance = frame >= 1955 ? 1 : 0;
    }

    const tuPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 1, o: ONG_TU_SHACK, okey: "mada_v2_ong_tu_shack" },
      tuX,
      tuY,
      tuZ,
      { view: tuView, side: tuView === "side", back: tuView === "back", mirror: tuMirror, facing: 0, fs: 1 },
      {
        action: tuAction,
        phase: tuPhase,
        poseMix: shotId === 10 ? smoothstep(2055, 2095, frame) : 1,
        expr: tuExpr,
        glance: tuGlance,
        underLight: shotId === 10 ? 0.55 : 0.25,
        blink: lidAt(t, 1, [1850 / FPS, 2066 / FPS]),
        shiver: shotId === 10 ? smoothstep(1940, 2066, frame) : 0.7,
        wind: 0.08,
        time: t,
      },
    );
    out.places.push(tuPlace);
    pushContactShadow(out, sunDir, light, tuX, tuY + 0.01, tuZ, 0.95, 0.90);

    // Subliminal shack horror: pale clawed hand & faint peering eyes pressed outside the dark shack window!
    const winPress = shotId === 9 ? 0.48 : 0.68;
    out.fx.push({
      key: `mada_v25_winhand_${shotId}`,
      cw: 320,
      ch: 380,
      draw: (p) => fxWindowHand(p, winPress, "#a8bac0"),
      x: ANCHORS.SHACK_WINDOW[0] + 0.08,
      y: ANCHORS.SHACK_WINDOW[1] - 0.08,
      z: ANCHORS.SHACK_WINDOW[2] + 0.08,
      w: 0.46,
      h: 0.54,
      soft: true,
      renderOrder: 1.4,
    });
    if (shotId === 10) {
      out.fx.push({
        key: `mada_v25_wineyes`,
        cw: 256,
        ch: 128,
        draw: (p) => fxLurkingEyes(p, 0, "215,235,245"),
        x: ANCHORS.SHACK_WINDOW[0] + 0.16,
        y: ANCHORS.SHACK_WINDOW[1] + 0.16,
        z: ANCHORS.SHACK_WINDOW[2] + 0.09,
        w: 0.30,
        h: 0.15,
        soft: true,
        renderOrder: 1.5,
      });
    }

    // Subtle panting breath vapor in Shot 9
    if (shotId === 9 && frame >= 1845) {
      const bu = clamp01(((frame - 1845) % 28) / 28);
      out.fx.push({
        key: `mada_v2_breath_s_${Math.round(bu * 12)}`,
        cw: 300,
        ch: 300,
        draw: (p) => fxBreath(p, bu, 1),
        x: tuX + 0.22,
        y: tuY + 1.42,
        z: tuZ - 0.14,
        w: 0.52,
        h: 0.52,
        soft: true,
      });
    }

    // Table oil lamp atmospheric halo
    const glowRgb = light === "blood" ? "255,155,115" : "255,190,108";
    out.fx.push({
      key: `mada_v2_glow_s_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.25), glowRgb),
      x: ANCHORS.SHACK_TABLE[0] - 0.08,
      y: ANCHORS.SHACK_TABLE[1] + 0.98,
      z: ANCHORS.SHACK_TABLE[2] + 0.14,
      w: 2.25,
      h: 2.25,
      soft: true,
    });

    // Shot 10 FINALE: Realistic wet black-mud barefoot prints lying FLAT (`flat: true`!) on dry wooden floorboards right behind Ông Tư's heels!
    if (shotId === 10) {
      const rev = Math.max(0.15, Math.round(st.footprintReveal * 16) / 16);
      pushFlatDecal(
        out,
        `mada_v2_footprints_${rev}`,
        512,
        512,
        (p) => fxWetFootprints(p, rev, "225,168,132"),
        ANCHORS.FOOTPRINTS[0],
        ANCHORS.FOOTPRINTS[1],
        ANCHORS.FOOTPRINTS[2],
        1.08,
        1.08,
        0.18,
        0.7,
      );
      // Creeping distorted clawed shadow stretching right behind the wet footprints on the floor!
      pushFlatDecal(
        out,
        `mada_v25_shack_shadow`,
        512,
        512,
        (p) => fxLongShadow(p, 0.35, "rgba(4,1,7,0.68)"),
        ANCHORS.FOOTPRINTS[0] + 0.12,
        ANCHORS.FOOTPRINTS[1] + 0.004,
        ANCHORS.FOOTPRINTS[2] + 0.78,
        1.25,
        1.75,
        -0.12,
        0.66,
      );
    }
  }

  return out;
}
