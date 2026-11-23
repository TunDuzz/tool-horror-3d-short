// Gothic Ink-Noir character acting, continuous micro-motion, uncanny motion mismatch,
// and perspective-locked 2D FX for "Ong Ke" (9:16 vertical).

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
import { ANCHORS, evalOngKeState } from "./story";
import {
  BE_MINH,
  BE_MINH_NO_LAMP,
  ONG_KE_ENTITY,
  fxMudStainDecal,
  fxOngKeClawFingers,
} from "./toon";

export function stageOngKe(
  shotId: number,
  frame: number,
  light: LightKey,
  cam: CamInfo,
  sunDir: THREE.Vector3,
): Stage {
  const out: Stage = { places: [], fx: [] };
  const t = frame / FPS;
  const st = evalOngKeState(shotId, frame);
  const flk = flickerAt(frame, 23, 0.30, 0.48);
  const isHall = shotId <= 8;

  if (isHall) {
    // ---------------- ERA 1: OLD 3-BAY WOODEN HALL ("hall") ----------------
    const [mx, my, mz] = st.minhPos;
    const useNoLamp = shotId >= 6;
    const minhOutfit = useNoLamp ? BE_MINH_NO_LAMP : BE_MINH;
    const minhOkey = useNoLamp ? "ok_minh_nolamp" : "ok_minh_lamp";

    let mAction: Action = "idle";
    let mPhase = 0;
    let mPoseMix = 1;
    let mTilt = 0;
    let mHeadPitch = 0;
    let mLook = 0.0;
    let mShiver = 0.12;
    let mWind = 0.12;
    let mArm: FrontArm | undefined = useNoLamp ? undefined : "hold";
    let mExpr: Expr = "wary";
    let mViewOverride: ViewKind | undefined;
    let mMirrorOverride: boolean | undefined;
    let mFacingOverride: -1 | 0 | 1 | undefined;

    if (shotId === 1) {
      mAction = "idle";
      mExpr = "wary";
      mLook = -0.35;
      mViewOverride = "front";
      mFacingOverride = -1;
    } else if (shotId === 2) {
      const u = clamp01((frame - 285) / 190);
      mAction = u < 0.94 ? "creep" : "idle";
      mPhase = (t * 0.78) % 1;
      mViewOverride = "back";
      mExpr = "suspicious";
      mShiver = 0.22;
    } else if (shotId === 3) {
      mAction = frame < 665 ? "idle" : "peer";
      mPoseMix = smoothstep(665, 725, frame);
      mHeadPitch = -0.55;
      mExpr = frame < 555 ? "suspicious" : "uneasy";
      mShiver = 0.35;
      mViewOverride = "side";
      mMirrorOverride = false;
    } else if (shotId === 4) {
      // Side MCU facing LEFT toward the open wardrobe crack with warm lantern under-lighting
      mAction = "peer";
      mPoseMix = smoothstep(800, 845, frame);
      mHeadPitch = -0.32;
      mExpr = "dread";
      mShiver = 0.48;
      mViewOverride = "side";
      mMirrorOverride = true;
    } else if (shotId === 6) {
      mAction = frame < 1260 ? "peer" : "recoil";
      mPoseMix = smoothstep(1260, 1295, frame);
      mExpr = frame < 1255 ? "dread" : "terrified";
      mShiver = 0.88;
      mWind = 0.75;
      mViewOverride = "front";
      mFacingOverride = -1;
    } else if (shotId === 7) {
      mAction = "recoil";
      mPoseMix = 1.0;
      mExpr = "terrified";
      mTilt = 7;
      mShiver = 1.0;
      mWind = 0.85;
      mLook = -0.65;
      mViewOverride = "front";
      mFacingOverride = -1;
    } else if (shotId === 8) {
      mAction = "flee";
      mPhase = (t * 1.55) % 1;
      mExpr = "terrified";
      mShiver = 0.95;
      mWind = 0.85;
      mViewOverride = "front";
      mFacingOverride = 0;
    }

    if (shotId !== 5) {
      const autoView = viewOf(cam, mx, mz, 0, -1);
      const viewMinh = {
        ...autoView,
        ...(mViewOverride ? { view: mViewOverride, side: mViewOverride === "side", back: mViewOverride === "back" } : {}),
        ...(mMirrorOverride !== undefined ? { mirror: mMirrorOverride } : {}),
        ...(mFacingOverride !== undefined ? { facing: mFacingOverride } : {}),
      };
      const minhPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 1, o: minhOutfit, okey: minhOkey },
        mx,
        my,
        mz,
        viewMinh,
        {
          action: mAction,
          phase: mPhase,
          poseMix: mPoseMix,
          expr: mExpr,
          frontArm: mAction === "idle" ? mArm : undefined,
          holdProp: !useNoLamp,
          look: mLook,
          blink: lidAt(t, 1, [548 / FPS, 1154 / FPS, 1266 / FPS, 1471 / FPS]),
          tilt: mTilt,
          headPitch: mHeadPitch,
          underLight: shotId === 4 ? 0.88 : shotId === 6 || shotId === 7 ? 0.45 : 0.15,
          shiver: mShiver,
          wind: mWind,
          time: t,
        },
        0.92,
      );
      out.places.push(minhPlace);
      pushContactShadow(out, sunDir, light, mx, my + 0.01, mz, 0.80, 0.85);

      // Curling cold breath in Shot 4 MCU peering toward the wardrobe
      if (shotId === 4 && frame >= 812) {
        const bu = clamp01(((frame - 812) % 32) / 32);
        const dir = viewMinh.mirror ? -1 : 1;
        out.fx.push({
          key: `ok_breath_${dir}_${Math.round(bu * 12)}`,
          cw: 340,
          ch: 300,
          draw: (p) => fxBreath(p, bu, dir),
          x: mx,
          y: my + 0.96,
          z: mz - 0.34,
          w: 0.56,
          h: 0.50,
          soft: true,
        });
      }
    }

    // Subliminal peripheral dread in Shots 1 & 2: faint unblinking eyes deep inside dark wardrobe crack (NO full monster!)
    if (shotId === 1 || shotId === 2) {
      const eb = lidAt(t, 9, [], FPS);
      out.fx.push({
        key: `ok_lurk_ward_${shotId}_${eb > 0.5 ? 1 : 0}`,
        cw: 256,
        ch: 128,
        draw: (p) => fxLurkingEyes(p, eb, "222,240,236"),
        x: 0.04,
        y: 1.48,
        z: ANCHORS.WARDROBE[2] + 0.30,
        w: 0.24,
        h: 0.12,
        soft: true,
        renderOrder: 1.6,
      });
    }

    // Shot 3: Perspective-locked flat wet mud stain under protruding burlap sack corner
    if (shotId === 3 && frame >= 685) {
      const rev = Math.round(st.sackPoke * 14) / 14;
      pushFlatDecal(
        out,
        `ok_mud_ward_${rev}`,
        512,
        512,
        (p) => fxMudStainDecal(p, Math.max(0.15, rev)),
        ANCHORS.WARDROBE[0] + 0.16,
        0.015,
        ANCHORS.WARDROBE[2] + 0.58,
        1.15,
        0.92,
        0.22,
        0.65,
      );
    }

    // Shot 5 ECU: 5 pale grey skeletal fingers locked dynamically to the swinging right door edge (roots masked cleanly behind 3D door!)
    if (shotId === 5 && frame >= 955) {
      const pu = Math.round(st.fingerPull * 16) / 16;
      const tb = Math.round((t * 8) % 8);
      const edgeX = 0.74 - 0.725 * Math.cos(st.rightDoorAngle);
      const edgeZ = -3.19 + 0.725 * Math.sin(st.rightDoorAngle);
      out.fx.push({
        key: `ok_fingers_${pu}_${tb}`,
        cw: 480,
        ch: 560,
        draw: (p) => fxOngKeClawFingers(p, pu, tb / 8),
        x: edgeX - 0.08,
        y: 1.06,
        z: edgeZ - 0.26,
        w: 0.60,
        h: 0.70,
        soft: true,
        renderOrder: 1.8,
      });
    }

    // ---------------- ÔNG KẸ (STRICTLY HIDDEN UNTIL SHOT 6 POST-DEAD-SILENCE REVEAL!) ----------------
    const showOngKe = (shotId === 6 && frame >= 1262) || shotId === 7 || shotId === 8;
    if (showOngKe) {
      const ox = shotId === 7 ? ANCHORS.ONGKE_LUNGE[0] : shotId === 8 ? -0.42 : ANCHORS.ONGKE_EMERGE[0];
      const oz = st.ongKeZ;
      const oExpr: Expr = shotId === 7 || (shotId === 6 && frame >= 1360) ? "unhinged" : "hollow";
      const oAction: Action = shotId === 7 ? "lunge" : "emerge";
      const oPoseMix = shotId === 7 ? smoothstep(1445, 1475, frame) : smoothstep(1262, 1320, frame);

      // Shot 6 & Shot 7 face front-3/4 toward Minh so hollow sockets, unhinged grin & reaching claws fill frame without clipping!
      const viewOk =
        shotId === 6 || shotId === 7
          ? { view: "front" as const, side: false, back: false, mirror: false, facing: 1 as const, fs: 0 }
          : { view: "front" as const, side: false, back: false, mirror: false, facing: 0 as const, fs: 0 };

      // Uncanny supernatural motion mismatch: stepped 7.5 fps + violent 2-frame neck snap!
      const uTime = uncannyTime(frame, 4);
      const neckSnap = (shotId === 7 ? 20 : 28) + uncannyTwitch(frame, 13, 15, shotId === 7 ? 12 : 18);
      const okPlace: Place = placePerson(
        cam,
        sunDir,
        { i: 2, o: ONG_KE_ENTITY, okey: "ok_entity_v3" },
        ox,
        0.0,
        oz,
        viewOk,
        {
          action: oAction,
          poseMix: oPoseMix,
          expr: oExpr,
          look: 0.35,
          blink: 0,
          tilt: shotId === 7 ? 5 : 4,
          headTilt: neckSnap,
          jawDrop: shotId === 7 ? 0.94 : 0.78,
          underLight: shotId === 7 ? 0.65 : 0.40,
          shiver: 0.60,
          wind: 0.75,
          time: uTime,
        },
        shotId === 8 ? 1.26 : shotId === 7 ? 1.12 : 1.20,
      );
      out.places.push(okPlace);
      pushContactShadow(out, sunDir, light, ox, 0.01, oz, 1.25, 0.90);

      // Hallucinatory double-exposure afterimages during emergence & lunge
      if (shotId === 7 || (shotId === 6 && frame >= 1340)) {
        pushAfterimage(
          out,
          okPlace,
          shotId === 7
            ? [
                [-0.14, 0.04, -0.08, 0.28],
                [0.12, -0.03, -0.10, 0.18],
              ]
            : [[-0.10, 0.03, -0.06, 0.22]],
          0.055,
        );
      }

      // Elongated distorted clawed shadow stretching independently across the wooden hall floor toward Minh!
      if (shotId === 7 || shotId === 8) {
        pushFlatDecal(
          out,
          `ok_longsh_${shotId}_${Math.round(Math.sin(uTime * 3) * 4)}`,
          512,
          512,
          (p) => fxLongShadow(p, Math.sin(uTime * 3) * 0.55, "rgba(4,1,6,0.72)"),
          ox + 0.35,
          0.018,
          oz + 1.05,
          1.45,
          2.25,
          0.24,
          0.65,
        );
      }
    }

    // Shot 6: Storm rain streaks + sky lightning bolt visible outside the barred window
    if (shotId === 6) {
      const ru = Math.round(((frame - 1152) / 16) * 16) / 16;
      out.fx.push({
        key: `ok_rain_${ru}`,
        cw: 512,
        ch: 768,
        draw: (p) => fxRain(p, ru, 0.22, "rgba(185,215,245,0.38)"),
        x: ANCHORS.HALL_WINDOW[0],
        y: ANCHORS.HALL_WINDOW[1],
        z: ANCHORS.HALL_WINDOW[2] - 0.45,
        w: 2.2,
        h: 2.8,
        soft: true,
        renderOrder: 1.2,
      });
      if ((frame >= 1154 && frame < 1162) || (frame >= 1266 && frame < 1274)) {
        const seed = frame < 1200 ? 9 : 17;
        out.fx.push({
          key: `ok_bolt_${seed}`,
          cw: 400,
          ch: 800,
          draw: (p) => fxLightning(p, seed),
          x: ANCHORS.HALL_WINDOW[0] - 0.4,
          y: 3.4,
          z: -9.5,
          w: 3.6,
          h: 7.2,
          soft: true,
        });
      }
    }

    // Altar lamp soft warm atmospheric halo
    const glowRgb = light === "eerie" ? "115,230,185" : light === "blood" ? "255,88,72" : "255,175,92";
    out.fx.push({
      key: `ok_altar_glow_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.15), glowRgb),
      x: ANCHORS.ALTAR[0] - 0.18,
      y: ANCHORS.ALTAR[1] + 1.14,
      z: ANCHORS.ALTAR[2] + 0.08,
      w: 1.65,
      h: 1.65,
      soft: true,
    });

    // Motivated atmospheric lantern glow halos for Shot 2 (Minh's handheld oil lamp), Shot 3 (off-left spill), and Shot 5 (eerie door grazing sheen)
    if (shotId === 2) {
      out.fx.push({
        key: `ok_minh_lamp_glow_${Math.round(flk * 10)}`,
        cw: 360,
        ch: 360,
        draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.35), "255,222,155"),
        x: mx + 0.16,
        y: my + 0.68,
        z: mz - 0.08,
        w: 1.10,
        h: 1.10,
        soft: true,
        renderOrder: 1.9,
      });
    } else if (shotId === 3) {
      out.fx.push({
        key: `ok_s3_lantern_spill_${Math.round(flk * 10)}`,
        cw: 400,
        ch: 400,
        draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.28), "255,212,135"),
        x: -0.42,
        y: 0.72,
        z: -2.68,
        w: 1.45,
        h: 1.45,
        soft: true,
        renderOrder: 1.5,
      });
    }

    // Upward-drifting uncanny ash/dust motes in eerie & blood beats
    if (shotId === 4 || shotId === 7 || shotId === 8) {
      const au = Math.round(((t * 0.22) % 1) * 20) / 20;
      const ashCol = light === "blood" ? "rgba(255,125,100,0.45)" : "rgba(185,235,218,0.36)";
      out.fx.push({
        key: `ok_ash_${light}_${au}`,
        cw: 512,
        ch: 512,
        draw: (p) => fxFloatingAsh(p, au, ashCol),
        x: 0.0,
        y: 1.25,
        z: -2.05,
        w: 3.8,
        h: 3.8,
        soft: true,
        renderOrder: 2.2,
      });
    }

    // Subtle feathered low mist in wide/storm beats
    if (shotId === 1 || shotId === 6 || shotId === 8) {
      const mistLoop = Math.round((0.5 + 0.5 * Math.sin(t * 0.42)) * 24) / 24;
      const mistCol = light === "blood" ? "rgba(185,68,78,0.14)" : "rgba(165,195,225,0.12)";
      out.fx.push({
        key: `ok_mist_${light}_${mistLoop}`,
        cw: 600,
        ch: 300,
        draw: (p) => fxMist(p, mistLoop, mistCol),
        x: 0.0,
        y: 0.85,
        z: -2.4,
        w: 6.4,
        h: 1.55,
        soft: true,
        renderOrder: 1.8,
      });
    }
  } else {
    // ---------------- ERA 2: INNER WOODEN BEDROOM ("bedroom") ----------------
    const [mx, my, mz] = st.minhPos;
    let mAction: Action = "idle";
    let mPhase = 0;
    let mExpr: Expr = "terrified";
    let mGlance: -1 | 0 | 1 = 0;
    let mView: ViewKind = "side";
    let mMirror = false;

    if (shotId === 9) {
      if (frame < 1648) {
        mAction = "flee";
        mPhase = (t * 1.45) % 1;
      } else if (frame < 1712) {
        mAction = "boltDoor";
      } else {
        mAction = "cower";
      }
      mExpr = frame < 1750 ? "terrified" : "dread";
      mView = "side";
      mMirror = true; // camera is on left (-X) looking at door (-Z): mirror=true faces Minh toward door (-Z)!
    } else {
      // Shot 10 FINALE: Minh stands facing the bolted door (bodyBack!), then slowly turns over his shoulder (glance: 1) at f=1854 ("ngoái")!
      mAction = frame >= 1925 ? "recoil" : "idle";
      mExpr = frame < 1920 ? "dread" : "terrified";
      mView = "back";
      mGlance = frame >= 1854 ? 1 : 0;
    }

    const minhPlace: Place = placePerson(
      cam,
      sunDir,
      { i: 1, o: BE_MINH_NO_LAMP, okey: "ok_minh_bed" },
      mx,
      my,
      mz,
      { view: mView, side: mView === "side", back: mView === "back", mirror: mMirror, facing: 0, fs: 1 },
      {
        action: mAction,
        phase: mPhase,
        poseMix: shotId === 10 ? smoothstep(1925, 1965, frame) : 1,
        expr: mExpr,
        glance: mGlance,
        underLight: shotId === 10 ? 0.55 : 0.25,
        blink: lidAt(t, 1, [1659 / FPS, 1928 / FPS, 2049 / FPS]),
        shiver: shotId === 10 ? 0.85 : 0.68,
        wind: 0.06,
        time: t,
      },
      0.92,
    );
    out.places.push(minhPlace);
    pushContactShadow(out, sunDir, light, mx, my + 0.01, mz, 0.80, 0.88);

    // Subliminal window hand pressed outside dark bedroom window in Shot 9!
    if (shotId === 9) {
      out.fx.push({
        key: "ok_bed_winhand",
        cw: 320,
        ch: 380,
        draw: (p) => fxWindowHand(p, 0.58, "#a6b8be"),
        x: ANCHORS.BED_WINDOW[0] + 0.08,
        y: ANCHORS.BED_WINDOW[1] - 0.06,
        z: ANCHORS.BED_WINDOW[2] + 0.08,
        w: 0.44,
        h: 0.52,
        soft: true,
        renderOrder: 1.4,
      });
    }

    // Panting cold breath in Shot 9 after bolting the door
    if (shotId === 9 && frame >= 1705) {
      const bu = clamp01(((frame - 1705) % 28) / 28);
      out.fx.push({
        key: `ok_bed_breath_${Math.round(bu * 12)}`,
        cw: 340,
        ch: 300,
        draw: (p) => fxBreath(p, bu, -1),
        x: mx - 0.14,
        y: my + 1.02,
        z: mz - 0.14,
        w: 0.48,
        h: 0.44,
        soft: true,
      });
    }

    // Bedside oil lamp warm glow halo (generous atmospheric bleed onto right side of bed in Shot 10!)
    const glowRgb = light === "blood" ? "255,205,142" : "255,195,115";
    out.fx.push({
      key: `ok_bed_glow_${light}_${Math.round(flk * 10)}`,
      cw: 400,
      ch: 400,
      draw: (p) => fxFlickerGlow(p, Math.min(1, flk + 0.36), glowRgb),
      x: ANCHORS.BED_LAMP[0] - (shotId === 10 ? 0.28 : 0.04),
      y: ANCHORS.BED_LAMP[1] + (shotId === 10 ? 0.96 : 0.90),
      z: ANCHORS.BED_LAMP[2] - 0.04,
      w: shotId === 10 ? 2.95 : 2.15,
      h: shotId === 10 ? 2.95 : 2.15,
      soft: true,
    });

    // Shot 10 FINALE: Mud stain on bed + GLARING UNBLINKING EYES under the dark bed + creeping claw shadow on floor!
    if (shotId === 10) {
      pushFlatDecal(
        out,
        "ok_bed_mudstain",
        512,
        512,
        (p) => fxMudStainDecal(p, 0.85),
        ANCHORS.BED[0] - 0.12,
        0.658,
        ANCHORS.BED[2] - 0.06,
        0.96,
        0.74,
        -0.25,
        0.75,
      );

      // Two haunting pale eyes opening & staring straight out from pitch-black under-bed cavity (deterministic cache key!)
      const eyeOpen = smoothstep(1995, 2048, frame);
      const eyeStep = Math.round(eyeOpen * 12);
      const eyeOpenQ = eyeStep / 12;
      if (eyeOpenQ >= 0.16) {
        out.fx.push({
          key: `ok_underbed_eyes_${eyeStep}`,
          cw: 256,
          ch: 128,
          draw: (p) => fxLurkingEyes(p, 1 - eyeOpenQ, "248,255,252"),
          x: ANCHORS.UNDER_BED_EYES[0],
          y: ANCHORS.UNDER_BED_EYES[1],
          z: ANCHORS.UNDER_BED_EYES[2],
          w: 0.42,
          h: 0.21,
          soft: true,
          renderOrder: 1.9,
        });
      }

      // Creeping distorted claw shadow stretching out from under the bed across the floorboards!
      const shTwist = Math.sin(t * 2.1) * 0.35;
      pushFlatDecal(
        out,
        `ok_underbed_shadow_${Math.round(shTwist * 6)}`,
        512,
        512,
        (p) => fxLongShadow(p, shTwist, "rgba(4,1,7,0.72)"),
        ANCHORS.BED[0] - 0.04,
        0.015,
        ANCHORS.BED[2] - 1.02,
        1.25,
        1.65,
        Math.PI,
        0.68,
      );
    }
  }

  return out;
}
