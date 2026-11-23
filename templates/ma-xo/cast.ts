// Gothic Ink-Noir character acting, uncanny motion mismatch & perspective-locked 2D FX for "Ma Xo".

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
  fxLongShadow,
  fxLurkingEyes,
  fxMist,
  fxRain,
  fxWindowHand,
  lerp,
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
import { ANCHORS, evalMaXoState } from "./story";
import {
  LAN_LAMP,
  LAN_NO_LAMP,
  MA_XO_ENTITY,
  fxAshFootprintsDecal,
  fxAshScratchesDecal,
  fxMaXoAshHand,
} from "./toon";

export function stageMaXo(
  shotId: number,
  frame: number,
  light: LightKey,
  cam: CamInfo,
  sunDir: THREE.Vector3,
): Stage {
  const out: Stage = { places: [], fx: [] };
  const t = frame / FPS;
  const st = evalMaXoState(shotId, frame);
  const flk = flickerAt(frame, 31, 0.30, 0.48);
  const isKitchen = shotId <= 6 || shotId === 8 || shotId === 10;

  // ---------------- LAN (PROTAGONIST) ----------------
  const [lx, ly, lz] = st.lanPos;
  const useNoLamp = shotId >= 6;
  const lanOutfit = useNoLamp ? LAN_NO_LAMP : LAN_LAMP;
  const lanOkey = useNoLamp ? "mx_lan_nolamp" : "mx_lan_lamp";

  let lAction: Action = "idle";
  let lPhase = 0;
  let lPoseMix = 1;
  let lTilt = 0;
  let lHeadPitch = 0;
  let lLook = 0.0;
  let lGlance: -1 | 0 | 1 = 0;
  let lShiver = 0.14;
  let lWind = 0.12;
  let lArm: FrontArm | undefined = useNoLamp ? undefined : "hold";
  let lExpr: Expr = "wary";
  let lViewOverride: ViewKind | undefined;
  let lMirrorOverride: boolean | undefined;
  let lFacingOverride: -1 | 0 | 1 | undefined;

  if (shotId === 1) {
    lAction = "idle";
    lExpr = "wary";
    lLook = -0.30;
    lViewOverride = "front";
    lFacingOverride = -1;
  } else if (shotId === 2) {
    const u = clamp01((frame - 315) / 205);
    lAction = u < 0.94 ? "creep" : "idle";
    lPhase = (t * 0.78) % 1;
    lViewOverride = "back";
    lExpr = "suspicious";
    lShiver = 0.22;
  } else if (shotId === 3) {
    lAction = "peer";
    lHeadPitch = -0.45;
    lExpr = "uneasy";
    lViewOverride = "side";
    lMirrorOverride = false;
  } else if (shotId === 4) {
    lAction = "peer";
    lPoseMix = smoothstep(850, 895, frame);
    lHeadPitch = -0.36;
    lExpr = "dread";
    lShiver = 0.50;
    lViewOverride = "side";
    lMirrorOverride = false;
  } else if (shotId === 6) {
    lAction = frame < 1270 ? "peer" : "recoil";
    lPoseMix = smoothstep(1270, 1310, frame);
    lExpr = frame < 1265 ? "dread" : "terrified";
    lShiver = 0.90;
    lWind = 0.72;
    lViewOverride = "front";
    lFacingOverride = 1;
  } else if (shotId === 7) {
    lAction = "recoil";
    lPoseMix = 1.0;
    lExpr = "terrified";
    lTilt = 7;
    lShiver = 1.0;
    lWind = 0.80;
    lLook = -0.65;
    lViewOverride = "front";
    lFacingOverride = -1;
  } else if (shotId === 8) {
    // Smooth continuous pose easing (no sudden action swap at f=1648 -> zero QA pops!)
    lAction = "peer";
    lPoseMix = 1.0 - 0.62 * smoothstep(1644, 1705, frame);
    lHeadPitch = lerp(-0.32, 0.08, smoothstep(1644, 1705, frame));
    lExpr = frame < 1720 ? "terrified" : "dread";
    lShiver = frame < 1730 ? 0.85 : 0.45;
    lViewOverride = "side";
    lMirrorOverride = false; // camera on left (-X) looking toward nook (+X): mirror=false faces Lan toward nook!
  } else if (shotId === 9) {
    lAction = "idle";
    lExpr = "dread";
    lShiver = 0.34;
    lViewOverride = "back";
    lGlance = frame >= 1900 ? -1 : 0;
  } else if (shotId === 10) {
    lAction = frame < 2048 ? "peer" : "idle";
    lExpr = "dread";
    lShiver = 0.40;
    lViewOverride = "back";
    lGlance = frame >= 2025 ? 1 : 0;
  }

  // Hide Lan during unobstructed ECU Shot 5 (footprints in ash) and cleanly off-left in Shot 3
  if (shotId !== 5 && shotId !== 3) {
    const autoView = viewOf(cam, lx, lz, 0, -1);
    const viewLan = {
      ...autoView,
      ...(lViewOverride ? { view: lViewOverride, side: lViewOverride === "side", back: lViewOverride === "back" } : {}),
      ...(lMirrorOverride !== undefined ? { mirror: lMirrorOverride } : {}),
      ...(lFacingOverride !== undefined ? { facing: lFacingOverride } : {}),
    };
    const lanPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 1, o: lanOutfit, okey: lanOkey },
      lx,
      ly,
      lz,
      viewLan,
      {
        action: lAction,
        phase: lPhase,
        poseMix: lPoseMix,
        expr: lExpr,
        frontArm: lAction === "idle" ? lArm : undefined,
        holdProp: !useNoLamp,
        look: lLook,
        glance: lGlance,
        blink: lidAt(t, 2, [697 / FPS, 1174 / FPS, 1423 / FPS, 1620 / FPS, 2156 / FPS]),
        tilt: lTilt,
        headPitch: lHeadPitch,
        underLight: shotId === 4 ? 0.88 : shotId === 6 || shotId === 7 ? 0.48 : 0.16,
        shiver: lShiver,
        wind: lWind,
        time: t,
      },
      0.95,
    );
    out.places.push(lanPlace);
    pushContactShadow(out, sunDir, light, lx, ly + 0.01, lz, 0.82, 0.86);

    if (shotId === 4 && frame >= 860) {
      const bStep = Math.round((((frame - 860) % 32) / 32) * 12);
      out.fx.push({
        key: `mx_breath_${bStep}`,
        cw: 340,
        ch: 300,
        draw: (p) => fxBreath(p, bStep / 12, 1),
        x: lx + 0.24,
        y: ly + 1.24,
        z: lz - 0.16,
        w: 0.56,
        h: 0.50,
        soft: true,
      });
    }
  }

  // ---------------- KITCHEN ERA FX & MA XÓ ----------------
  if (isKitchen) {
    // Subliminal peripheral dread in Shots 1 & 2: faint unblinking pale eyes deep inside pitch-black nook (NO full monster!)
    if (shotId === 1 || shotId === 2) {
      const eb = lidAt(t, 7, [], FPS) > 0.5 ? 1 : 0;
      out.fx.push({
        key: `mx_lurk_nook_${eb}`,
        cw: 256,
        ch: 128,
        draw: (p) => fxLurkingEyes(p, eb, "228,242,236"),
        x: ANCHORS.NOOK[0] + 0.04,
        y: 0.58,
        z: ANCHORS.NOOK[2] - 0.22,
        w: 0.28,
        h: 0.14,
        soft: true,
        renderOrder: 1.6,
      });
    }

    // Shot 3: Perspective-locked claw/fingernail scratch grooves dug through the ash after bowl flips & ember dies
    if (shotId === 3 && st.scratchReveal > 0.04) {
      const sStep = Math.round(st.scratchReveal * 12);
      const sq = Math.max(0.15, sStep / 12);
      pushFlatDecal(
        out,
        `mx_ash_scratch_${sStep}`,
        512,
        512,
        (p) => fxAshScratchesDecal(p, sq),
        ANCHORS.NOOK[0] - 0.06,
        0.022,
        ANCHORS.NOOK[2] + 0.24,
        1.05,
        0.92,
        -0.12,
        0.72,
      );
    }

    // Shot 5 ECU: Razor-clear pale wood-ash patch with TWO gaunt bare footprints facing STRAIGHT INTO THE BACK WALL! (y = 0.032 cleanly above flat ash bed!)
    if (shotId === 5) {
      pushFlatDecal(
        out,
        "mx_ash_footprints_v2",
        512,
        512,
        (p) => fxAshFootprintsDecal(p, 1.0),
        ANCHORS.NOOK[0] - 0.02,
        0.032,
        ANCHORS.NOOK[2] + 0.08,
        0.96,
        0.96,
        0.0,
        0.96,
      );
    }

    // MA XÓ ENTITY (Strictly hidden until Shot 6 post-Dead-Silence crimson ember flare!)
    const showMaXoKitchen = (shotId === 6 && frame >= 1265) || (shotId === 8 && frame < 1796);
    if (showMaXoKitchen) {
      const oExpr: Expr = shotId === 6 && frame >= 1340 ? "unhinged" : "hollow";
      const oAction: Action = shotId === 6 ? "emerge" : "recoil";
      const oPoseMix = shotId === 6 ? smoothstep(1265, 1335, frame) : smoothstep(1720, 1780, frame);
      const uTime = uncannyTime(frame, 4);
      const neckSnap = (shotId === 6 ? -18 : -14) + uncannyTwitch(frame, 11, 14, 12);

      const mxPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 2, o: MA_XO_ENTITY, okey: "mx_entity_v2" },
        st.maXoX,
        0.0,
        st.maXoZ,
        { view: "front", side: false, back: false, mirror: false, facing: -1, fs: 0 },
        {
          action: oAction,
          poseMix: oPoseMix,
          expr: oExpr,
          look: -0.35,
          blink: 0,
          tilt: shotId === 6 ? -4 : 3,
          headTilt: neckSnap,
          jawDrop: shotId === 6 ? 0.88 : 0.60,
          underLight: shotId === 6 ? 0.62 : 0.32,
          shiver: 0.65,
          wind: 0.70,
          time: uTime,
        },
        shotId === 6 ? 1.14 : 1.00,
      );
      out.places.push(mxPlace);
      pushContactShadow(out, sunDir, light, st.maXoX, 0.01, st.maXoZ, 1.18, 0.88);

      if (shotId === 6 && frame >= 1315) {
        pushAfterimage(out, mxPlace, [[0.11, 0.03, -0.06, 0.24]], 0.052);
      }
      if (shotId === 6) {
        const shIdx = Math.round(Math.sin(uTime * 3) * 4);
        pushFlatDecal(
          out,
          `mx_longsh_k_${shIdx}`,
          512,
          512,
          (p) => fxLongShadow(p, (shIdx / 4) * 0.5, "rgba(5,2,7,0.72)"),
          st.maXoX - 0.30,
          0.02,
          st.maXoZ + 0.92,
          1.35,
          2.05,
          -0.25,
          0.65,
        );
      }
    }

    // Shot 10 FINALE: Soot-blackened ash-dusted skeletal hand creeping OUT from pitch-black nook to hook & drag the cold white rice bowl!
    if (shotId === 10 && st.handReach > 0.04) {
      const rStep = Math.round(st.handReach * 12);
      const tb = Math.round((t * 6) % 4);
      const rq = rStep / 12;
      const hx = lerp(0.92, 0.58, rq) + st.ricePull * 0.30;
      const hz = lerp(-2.78, -2.52, rq) - st.ricePull * 0.54;
      out.fx.push({
        key: `mx_ash_hand_${rStep}_${tb}`,
        cw: 520,
        ch: 360,
        draw: (p) => fxMaXoAshHand(p, rq, tb / 4),
        x: hx,
        y: 0.17,
        z: hz,
        w: 0.74,
        h: 0.48,
        soft: true,
        renderOrder: 1.9,
      });
    }

    // Kitchen right-table storm lantern warm halo
    const glowRgb = light === "eerie" ? "135,235,205" : light === "blood" ? "255,165,112" : "255,182,98";
    out.fx.push({
      key: `mx_kit_lamp_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.22), glowRgb),
      x: ANCHORS.KITCHEN_TABLE[0] - 0.16,
      y: ANCHORS.KITCHEN_TABLE[1] + 1.12,
      z: ANCHORS.KITCHEN_TABLE[2] + 0.06,
      w: 1.75,
      h: 1.75,
      soft: true,
    });

    // Motivated handheld oil lamp halo (Shot 2 OTS + Shot 3 LOW spill) for natural chiaroscuro highlights
    if (shotId === 2) {
      out.fx.push({
        key: `mx_lan_lamp_glow_${Math.round(flk * 10)}`,
        cw: 360,
        ch: 360,
        draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.35), "255,222,155"),
        x: lx + 0.16,
        y: ly + 0.88,
        z: lz - 0.08,
        w: 1.12,
        h: 1.12,
        soft: true,
        renderOrder: 1.9,
      });
    } else if (shotId === 3) {
      out.fx.push({
        key: `mx_s3_spill_${Math.round(flk * 10)}`,
        cw: 400,
        ch: 400,
        draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.18), "255,212,135"),
        x: 0.18,
        y: 0.56,
        z: -2.66,
        w: 1.35,
        h: 1.35,
        soft: true,
        renderOrder: 1.5,
      });
    } else if (shotId === 4) {
      // Warm-eerie lantern halo right below Lan's peering chin so Shot 4 hits crisp highlight p98 >= 0.45!
      out.fx.push({
        key: `mx_s4_lamp_halo_${Math.round(flk * 10)}`,
        cw: 360,
        ch: 360,
        draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.42), "225,248,215"),
        x: lx + 0.38,
        y: ly + 0.96,
        z: lz - 0.10,
        w: 1.15,
        h: 1.15,
        soft: true,
        renderOrder: 1.9,
      });
    }

    // Glowing hearth ember atmospheric aura when hearth is alive (S1, S2, S6, S8, S10)
    if (st.emberGlow > 0.1) {
      const eg = Math.round(Math.min(1, st.emberGlow) * 8);
      out.fx.push({
        key: `mx_ember_halo_${eg}_${Math.round(flk * 8)}`,
        cw: 360,
        ch: 360,
        draw: (p) => fxFlickerGlow(p, Math.min(1, (eg / 8) * 0.72 + flk * 0.22), "255,112,56"),
        x: ANCHORS.HEARTH[0],
        y: 0.28,
        z: ANCHORS.HEARTH[2] + 0.42,
        w: shotId === 6 ? 1.85 : 1.15,
        h: shotId === 6 ? 1.85 : 1.15,
        soft: true,
        renderOrder: 1.4,
      });
    }

    // Floating ember ash motes on eerie / reveal / finale beats
    if (shotId === 4 || shotId === 6 || shotId === 10) {
      const au = Math.round(((t * 0.22) % 1) * 20) / 20;
      const ashCol = shotId === 4 ? "rgba(188,236,218,0.34)" : "rgba(255,132,96,0.44)";
      out.fx.push({
        key: `mx_ash_motes_${shotId === 4 ? "e" : "r"}_${au}`,
        cw: 512,
        ch: 512,
        draw: (p) => fxFloatingAsh(p, au, ashCol),
        x: 0.25,
        y: 1.15,
        z: -2.25,
        w: 3.6,
        h: 3.6,
        soft: true,
        renderOrder: 2.2,
      });
    }

    // Storm rain outside kitchen window in Shot 6 (bounded modulo-16 cycle so Pool reuses 16 canvases cleanly!)
    if (shotId === 6) {
      const ru = (((frame - 1172) % 16) + 16) % 16 / 16;
      out.fx.push({
        key: `mx_rain_${Math.round(ru * 16)}`,
        cw: 512,
        ch: 768,
        draw: (p) => fxRain(p, ru, 0.22, "rgba(195,218,245,0.38)"),
        x: ANCHORS.KITCHEN_WINDOW[0],
        y: ANCHORS.KITCHEN_WINDOW[1],
        z: ANCHORS.KITCHEN_WINDOW[2] - 0.42,
        w: 2.2,
        h: 2.8,
        soft: true,
        renderOrder: 1.2,
      });
    }

    // Subtle low mist in wide/reveal beats
    if (shotId === 1 || shotId === 6) {
      const ml = Math.round((0.5 + 0.5 * Math.sin(t * 0.42)) * 24) / 24;
      out.fx.push({
        key: `mx_mist_${ml}`,
        cw: 600,
        ch: 300,
        draw: (p) => fxMist(p, ml, "rgba(175,200,225,0.12)"),
        x: 0.0,
        y: 0.82,
        z: -2.3,
        w: 6.2,
        h: 1.50,
        soft: true,
        renderOrder: 1.7,
      });
    }
  } else {
    // ---------------- ERA 2: HALLWAY ("hallway": Shot 7 climax & Shot 9 trapped indoors) ----------------
    if (shotId === 7) {
      const uTime = uncannyTime(frame, 4);
      const neckSnap = 16 + uncannyTwitch(frame, 13, 15, 10);
      const mxPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 2, o: MA_XO_ENTITY, okey: "mx_entity_v2" },
        st.maXoX,
        0.0,
        st.maXoZ,
        { view: "front", side: false, back: false, mirror: false, facing: 1, fs: 0 },
        {
          action: "lunge",
          poseMix: smoothstep(1415, 1445, frame),
          expr: "unhinged",
          look: 0.35,
          blink: 0,
          tilt: 5,
          headTilt: neckSnap,
          jawDrop: 0.94,
          underLight: 0.65,
          shiver: 0.68,
          wind: 0.78,
          time: uTime,
        },
        1.12,
      );
      out.places.push(mxPlace);
      pushContactShadow(out, sunDir, light, st.maXoX, 0.01, st.maXoZ, 1.22, 0.90);
      pushAfterimage(
        out,
        mxPlace,
        [
          [-0.14, 0.04, -0.08, 0.28],
          [0.12, -0.03, -0.10, 0.18],
        ],
        0.055,
      );
      const shIdx = Math.round(Math.sin(uTime * 3) * 4);
      pushFlatDecal(
        out,
        `mx_longsh_h_${shIdx}`,
        512,
        512,
        (p) => fxLongShadow(p, (shIdx / 4) * 0.55, "rgba(4,1,6,0.74)"),
        st.maXoX + 0.32,
        0.018,
        st.maXoZ + 1.02,
        1.45,
        2.25,
        0.24,
        0.65,
      );

      const au = Math.round(((t * 0.24) % 1) * 20) / 20;
      out.fx.push({
        key: `mx_hall_ash_${au}`,
        cw: 512,
        ch: 512,
        draw: (p) => fxFloatingAsh(p, au, "rgba(255,122,96,0.46)"),
        x: 0.0,
        y: 1.25,
        z: -2.0,
        w: 3.8,
        h: 3.8,
        soft: true,
        renderOrder: 2.2,
      });
    }

    if (shotId === 9) {
      // Subliminal soot-grey hand pressed lightly on the night window glass outside!
      out.fx.push({
        key: "mx_hall_winhand",
        cw: 320,
        ch: 380,
        draw: (p) => fxWindowHand(p, 0.54, "#a8b4b8"),
        x: ANCHORS.HALL_WINDOW[0] + 0.08,
        y: ANCHORS.HALL_WINDOW[1] - 0.05,
        z: ANCHORS.HALL_WINDOW[2] + 0.08,
        w: 0.44,
        h: 0.52,
        soft: true,
        renderOrder: 1.4,
      });
      const ml = Math.round((0.5 + 0.5 * Math.sin(t * 0.38)) * 24) / 24;
      out.fx.push({
        key: `mx_hall_mist_${ml}`,
        cw: 600,
        ch: 300,
        draw: (p) => fxMist(p, ml, "rgba(165,195,228,0.13)"),
        x: 0.0,
        y: 0.85,
        z: -2.2,
        w: 6.4,
        h: 1.55,
        soft: true,
        renderOrder: 1.7,
      });
    }

    // Ancestral altar warm lantern halo in hallway
    const hGlowRgb = light === "blood" ? "255,95,78" : "255,186,105";
    out.fx.push({
      key: `mx_hall_lamp_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.25), hGlowRgb),
      x: ANCHORS.HALL_ALTAR[0] - 0.16,
      y: ANCHORS.HALL_ALTAR[1] + 1.18,
      z: ANCHORS.HALL_ALTAR[2] + 0.06,
      w: 1.95,
      h: 1.95,
      soft: true,
    });
  }

  return out;
}
