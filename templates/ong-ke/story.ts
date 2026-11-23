// Timeline, 10-shot cinematic choreography (zero repeated angles), dynamic state, DOF, kicks, and overlays
// for "Ong Ke" (Gothic Ink-Noir x Shadow-Depth, 9:16 vertical).
// Locked to out/ong-ke/voice/words.json (70.82s / 2135 frames @ 30fps).

import {
  CamKey,
  DofBeat,
  FPS,
  HorrorLightKey,
  Kick,
  ScreenBeat,
  ShotBase,
  V3,
  camOTS,
  clamp01,
  dollyZoom,
  glide,
  handheld,
  lerp,
  pushK,
  rolled,
  smoothstep,
  snapZoom,
} from "../engine";

export { FPS };
export const TOTAL = 2135;

export type OngKeEra = "hall" | "bedroom";

export type OngKeShot = ShotBase<HorrorLightKey> & {
  era: OngKeEra;
};

export const ANCHORS = {
  // Era 1: Old 3-bay Vietnamese wooden house hall (floor y = 0)
  WARDROBE: [0.0, 0.0, -3.55] as V3,
  HALL_WINDOW: [-2.25, 1.62, -4.12] as V3,
  ALTAR: [2.35, 0.0, -3.55] as V3,
  MINH_START: [0.65, 0.0, 0.45] as V3,
  MINH_NEAR_WARDROBE: [0.22, 0.0, -1.78] as V3,
  MINH_PEER: [0.16, 0.0, -2.02] as V3,
  MINH_RECOIL: [0.58, 0.0, -1.48] as V3,
  ONGKE_EMERGE: [-0.08, 0.0, -2.92] as V3,
  ONGKE_LUNGE: [-0.34, 0.0, -2.28] as V3,
  HALL_EXIT_DOOR: [0.0, 0.0, 4.55] as V3,

  // Era 2: Claustrophobic inner wooden bedroom (floor y = 0)
  BED_DOOR: [0.0, 0.0, -3.10] as V3,
  BED_WINDOW: [-1.68, 1.52, -3.08] as V3,
  BED: [0.32, 0.0, 0.85] as V3,
  BED_LAMP: [1.68, 0.0, 0.42] as V3,
  MINH_BED_ENTRY: [0.22, 0.0, -0.95] as V3,
  MINH_BED_DOOR: [-0.18, 0.0, -2.35] as V3,
  UNDER_BED_EYES: [0.24, 0.25, 0.52] as V3,
};

export const SHOTS: OngKeShot[] = [
  // S1 [0.00s..9.50s]: Wide establishing through dark foreground timber rafters — NO monster spoiler!
  { id: 1, a: 0, b: 285, era: "hall", light: "night", scale: "WS", note: "Wide diagonal wooden hall through dark rafters; closed wardrobe & subliminal eyes" },
  // S2 [9.50s..16.33s]: OTS behind bé Minh (bodyBack) creeping toward old wooden wardrobe with oil lamp
  { id: 2, a: 285, b: 490, era: "hall", light: "candle", scale: "OTS", note: "Over-the-shoulder behind small kid creeping past tall dark wardrobe" },
  // S3 [16.33s..26.67s]: Low floor-skimming shot — 3 dry knocks, door creaks slightly ajar revealing muddy burlap sack
  { id: 3, a: 490, b: 800, era: "hall", light: "candle", scale: "LOW", note: "Low floor angle on wardrobe crack & protruding muddy burlap sack corner" },
  // S4 [26.67s..31.83s]: Side-3/4 MCU with Vertigo dollyZoom & lantern under-lighting peering into crack
  { id: 4, a: 800, b: 955, era: "hall", light: "eerie", scale: "MCU", note: "Side profile MCU peering into wardrobe crack with lantern underLight + Vertigo" },
  // S5 [31.83s..38.40s]: Unobstructed ECU on 5 elongated grey fingers gripping wooden door edge + Dead Silence blackout
  { id: 5, a: 955, b: 1152, era: "hall", light: "eerie", scale: "ECU", note: "ECU on five elongated pale grey fingers pulling wardrobe door + blackout" },
  // S6 [38.40s..48.17s]: Dramatic low-angle storm reveal with real 3D lightning as Ong Ke towers out of wardrobe
  { id: 6, a: 1152, b: 1445, era: "hall", light: "storm", scale: "LOW", note: "Low-angle upward reveal with 3D lightning as Ong Ke unfolds with burlap sack" },
  // S7 [48.17s..51.93s]: Tight Dutch-tilt blood climax framing BOTH lunging Ong Ke & recoiling Minh
  { id: 7, a: 1445, b: 1558, era: "hall", light: "blood", scale: "CU", note: "Tight Dutch-angle climax lunge with afterimages & long claw shadow" },
  // S8 [51.93s..54.07s]: Wide reverse corridor shot of Minh fleeing toward bedroom while Ong Ke looms behind
  { id: 8, a: 1558, b: 1622, era: "hall", light: "blood", scale: "WS", note: "Wide reverse corridor shot of Minh sprinting away while Ong Ke looms" },
  // S9 [54.07s..61.07s]: Interior bedroom side tracking slamming door & dropping heavy 3D wooden crossbar
  { id: 9, a: 1622, b: 1832, era: "bedroom", light: "candle", scale: "MS", note: "Interior bedroom MS slamming door, bolting crossbar & catching breath" },
  // S10 [61.07s..71.17s]: OTS behind Minh glancing back -> tilts to muddy burlap sack on bed & glaring eyes under bed!
  { id: 10, a: 1832, b: TOTAL, era: "bedroom", light: "blood", scale: "OTS", note: "OTS glance back revealing muddy sack on bed & unblinking eyes under bed" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  // Oil lamp uneasy flicker as Minh peers into dark wardrobe crack
  { kind: "flicker", a: 895, b: 922, seed: 5, strength: 0.30 },
  // Lamp sputters & snuffs out into [DEAD SILENCE 0.65s] (37.79s..38.44s = f1134..1153)
  { kind: "flicker", a: 1110, b: 1132, seed: 11, strength: 0.48 },
  { kind: "blackout", a: 1133, b: 1153 },
  // Real 3D lightning strikes in Shot 6 (f=1154 "Chớp", f=1266 "tung")
  { kind: "lightning", f: 1154, peak: 0.95 },
  { kind: "lightning", f: 1266, peak: 0.85 },
  // Brief crimson impact sheen on lunge ("chộp" f=1473)
  { kind: "flash", f: 1471, dur: 6, color: "#88141c", peak: 0.36, blend: "screen" },
  // Clean cinematic dip-to-black transitioning Hall Era (S8) -> Bedroom Era (S9)
  { kind: "dipBlack", at: 1622, dur: 10, hold: 2 },
  // Subtle bedside oil lamp shiver on Shot 10 + controlled tunnel vignette pulse (preserves dark-screen readability!)
  { kind: "flicker", a: 1832, b: 1846, seed: 19, strength: 0.20 },
  { kind: "vignettePulse", a: 1935, b: TOTAL, freq: 1.45, strength: 0.15 },
  // Radial RGB chromatic aberration surges on claw grip, Ong Ke emergence/lunge, and final twist
  { kind: "aberration", a: 965, b: 1132, strength: 0.45, pulse: true },
  { kind: "aberration", a: 1154, b: 1558, strength: 0.78, pulse: true },
  { kind: "aberration", a: 1928, b: TOTAL, strength: 0.56, pulse: true },
];

export const KICKS: Kick[] = [
  [548 / FPS, 0.55],  // knock 1 "cộc"
  [567 / FPS, 0.60],  // knock 2 "cộc"
  [584 / FPS, 0.70],  // knock 3 "cộc"
  [1154 / FPS, 1.25], // post-Dead-Silence lightning crack "Chớp"
  [1266 / FPS, 1.15], // wardrobe doors burst open "tung"
  [1471 / FPS, 1.45], // Ong Ke climax lunge "chộp"
  [1626 / FPS, 0.75], // bedroom door slams shut "sập"
  [1659 / FPS, 0.70], // heavy crossbar bolts down "cài"
  [1928 / FPS, 0.65], // reveal burlap sack on bed "bao"
  [2049 / FPS, 0.85], // final shock eyes under bed "mắt"
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5 },
  { f: 285, cInf: 5.5 },
  { f: 490, cInf: 8.5, focus: () => [0.16, 0.36, -3.12] },
  { f: 800, cInf: 8.0, focus: () => [0.16, 1.02, -2.02] },
  { f: 955, cInf: 9.0, focus: () => [0.16, 1.05, -2.96] },
  { f: 1152, cInf: 4.8 },
  { f: 1445, cInf: 7.5 },
  { f: 1558, cInf: 4.5 },
  { f: 1622, cInf: 6.0 },
  { f: 1832, cInf: 7.5, focus: (f) => (f < 1925 ? [-0.18, 0.98, -2.35] : [0.24, 0.44, 0.78]) },
];

export type OngKeDynamicState = {
  leftDoorAngle: number;  // radians opening outward (+Y rotation, negative opens left door outward)
  rightDoorAngle: number; // radians opening outward (positive opens right door outward)
  knockRattle: number;
  sackPoke: number;       // 0..1 muddy burlap sack protruding from wardrobe base
  fingerPull: number;     // 0..1 elongated grey fingers gripping door crack
  ongKeZ: number;
  doorBolt: number;       // 0 = lifted open, 1 = bolted closed
  minhPos: V3;
};

export function evalOngKeState(shotId: number, f: number): OngKeDynamicState {
  const t = f / FPS;

  // Brief shudder on each of the 3 dry wooden knocks (f=548, 567, 584)
  let knockRattle = 0;
  for (const kf of [548, 567, 584]) {
    const dt = f - kf;
    if (dt >= 0 && dt < 9) knockRattle += Math.sin(dt * 2.2) * (1 - dt / 9) * 0.045;
  }

  let leftDoorAngle = 0;
  let rightDoorAngle = 0;
  if (shotId === 1 || shotId === 2) {
    rightDoorAngle = 0.04; // hairline dark crack for subliminal eyes
  } else if (shotId === 3) {
    rightDoorAngle = 0.04 + knockRattle + 0.54 * smoothstep(665, 745, f);
    leftDoorAngle = -0.02 - knockRattle * 0.5;
  } else if (shotId === 4) {
    rightDoorAngle = 0.58 + 0.03 * Math.sin(t * 2.4);
    leftDoorAngle = -0.03;
  } else if (shotId === 5) {
    rightDoorAngle = 0.64 + 0.22 * smoothstep(965, 1105, f);
    leftDoorAngle = -0.04 - 0.05 * smoothstep(1010, 1105, f);
  } else if (shotId === 6) {
    const burst = smoothstep(1258, 1286, f);
    rightDoorAngle = lerp(0.86, 1.52, burst);
    leftDoorAngle = lerp(-0.09, -1.42, burst);
  } else if (shotId === 7 || shotId === 8) {
    rightDoorAngle = 1.52;
    leftDoorAngle = -1.42;
  }

  const sackPoke = shotId === 3 ? smoothstep(690, 770, f) : shotId === 4 || shotId === 5 ? 1 : 0;
  const fingerPull = shotId === 5 ? smoothstep(955, 1005, f) : 0;

  let ongKeZ = -3.28;
  if (shotId === 6) {
    ongKeZ = lerp(-3.28, -2.55, smoothstep(1265, 1410, f));
  } else if (shotId === 7) {
    ongKeZ = lerp(-2.45, -2.12, smoothstep(1455, 1495, f));
  } else if (shotId === 8) {
    ongKeZ = lerp(-2.25, -1.65, clamp01((f - 1558) / 64));
  }

  const doorBolt = shotId === 9 ? smoothstep(1648, 1668, f) : shotId === 10 ? 1 : 0;

  let minhPos: V3 = [...ANCHORS.MINH_START];
  if (shotId === 1) {
    minhPos = [...ANCHORS.MINH_START];
  } else if (shotId === 2) {
    const u = glide(clamp01((f - 285) / 190));
    minhPos = [lerp(ANCHORS.MINH_START[0], ANCHORS.MINH_NEAR_WARDROBE[0], u), 0.0, lerp(ANCHORS.MINH_START[2], ANCHORS.MINH_NEAR_WARDROBE[2], u)];
  } else if (shotId === 3) {
    // Positioned cleanly off-left in tight low-angle Shot 3 so his handheld oil lamp rakes across wardrobe crack & burlap sack with zero lens clipping
    minhPos = [-1.12, 0.0, -2.15];
  } else if (shotId === 4) {
    minhPos = [...ANCHORS.MINH_PEER];
  } else if (shotId === 6) {
    const u = smoothstep(1262, 1340, f);
    minhPos = [lerp(0.32, 0.56, u), 0.0, lerp(-1.82, -1.35, u)];
  } else if (shotId === 7) {
    const u = smoothstep(1460, 1515, f);
    minhPos = [lerp(0.42, 0.54, u), 0.0, lerp(-1.32, -1.16, u)];
  } else if (shotId === 8) {
    const u = clamp01((f - 1558) / 62);
    minhPos = [lerp(0.28, 0.14, u), 0.0, lerp(-0.95, 2.25, u)];
  } else if (shotId === 9) {
    const u = smoothstep(1622, 1656, f);
    minhPos = [lerp(ANCHORS.MINH_BED_ENTRY[0], ANCHORS.MINH_BED_DOOR[0], u), 0.0, lerp(ANCHORS.MINH_BED_ENTRY[2], ANCHORS.MINH_BED_DOOR[2], u)];
  } else if (shotId === 10) {
    minhPos = [...ANCHORS.MINH_BED_DOOR];
  }

  return { leftDoorAngle, rightDoorAngle, knockRattle, sackPoke, fingerPull, ongKeZ, doorBolt, minhPos };
}

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1 (WS): Wide diagonal establishing of dark 3-bay wooden hall through foreground ceiling rafters
  1: [
    {
      f: 0,
      s: (f) => {
        const u = clamp01(f / 285);
        return {
          pos: [lerp(-2.05, -1.35, u), lerp(1.68, 1.52, u), lerp(2.85, 1.95, u)],
          look: [lerp(0.10, 0.02, u), 1.24, lerp(-3.15, -3.35, u)],
          fov: 44,
        };
      },
    },
  ],

  // Shot 2 (OTS): Over-the-shoulder behind small Bé Minh walking past the looming dark wardrobe
  2: [
    {
      f: 285,
      s: (f) => {
        const st = evalOngKeState(2, f);
        return handheld(
          camOTS(st.minhPos, [0.0, 1.25, -3.55], 1, 2.28, 0.56, 1.26, 44),
          f,
          0.013,
          0.26,
          2,
        );
      },
    },
  ],

  // Shot 3 (LOW): Unobstructed floor-skimming low angle on wardrobe crack & protruding woven muddy burlap sack
  3: [
    {
      f: 490,
      s: (f) => {
        const u = clamp01((f - 490) / 310);
        return handheld(
          {
            pos: [lerp(-0.46, -0.22, u), lerp(0.56, 0.42, u), lerp(-0.85, -1.32, u)],
            look: [lerp(0.10, 0.14, u), lerp(0.56, 0.36, u), -3.12],
            fov: 43,
          },
          f,
          0.010,
          0.24,
          3,
        );
      },
    },
  ],

  // Shot 4 (MCU): Side profile Medium Close-Up with Vertigo dollyZoom + warm oil-lamp under-lighting
  4: [
    {
      f: 800,
      s: (f) => {
        const u = clamp01((f - 800) / 155);
        return handheld(
          dollyZoom([-2.15, 1.16, -2.06], [0.16, 1.02, -2.18], 40, 1.0 - 0.16 * u),
          f,
          0.014,
          0.30,
          4,
        );
      },
    },
  ],

  // Shot 5 (ECU): Unobstructed tight ECU tracking the moving wardrobe door edge & 5 elongated grey gripping fingers
  5: [
    {
      f: 955,
      s: (f) => {
        const u = clamp01((f - 955) / 197);
        const st = evalOngKeState(5, f);
        const edgeX = 0.74 - 0.725 * Math.cos(st.rightDoorAngle);
        const edgeZ = -3.19 + 0.725 * Math.sin(st.rightDoorAngle);
        return handheld(
          {
            pos: [lerp(-0.56, -0.36, u), lerp(1.18, 1.10, u), lerp(-1.54, -1.86, u)],
            look: [edgeX - 0.06, 1.05, edgeZ - 0.14],
            fov: 38,
          },
          f,
          0.016,
          0.36,
          5,
        );
      },
    },
  ],

  // Shot 6 (LOW): Dramatic low-angle upward storm reveal as towering Ông Kẹ unfolds out of wardrobe
  6: [
    {
      f: 1152,
      s: (f) =>
        handheld(
          {
            pos: [
              1.08,
              0.66,
              -0.15 - 0.42 * (1 - snapZoom(f, 1266, 14, 1.0, 0.85)) * 4.0 + (1 - pushK(f, 1152, 0.0007)) * -0.45,
            ],
            look: [-0.04, 1.38, -2.85],
            fov: 46,
          },
          f,
          0.022,
          0.42,
          6,
        ),
    },
  ],

  // Shot 7 (CU): Depth-layered Dutch-tilt climax framing BOTH looming lunging Ông Kẹ (upper-left) AND recoiling Bé Minh (lower-right)!
  7: [
    {
      f: 1445,
      s: rolled(
        (f) =>
          handheld(
            {
              pos: [0.92, 1.14, 0.62 * pushK(f, 1445, 0.0022)],
              look: [-0.04, 1.14, -2.05],
              fov: 46,
            },
            f,
            0.022,
            0.44,
            7,
          ),
        0.075,
      ),
    },
  ],

  // Shot 8 (WS): Reverse wide corridor shot from bedroom doorway looking back — Minh fleeing forward, Ông Kẹ looming
  8: [
    {
      f: 1558,
      s: (f) => {
        const u = clamp01((f - 1558) / 64);
        return {
          pos: [lerp(0.95, 0.72, u), lerp(1.78, 1.62, u), lerp(3.45, 3.85, u)],
          look: [lerp(0.05, 0.0, u), 1.12, lerp(-1.55, -1.95, u)],
          fov: 44,
        };
      },
    },
  ],

  // Shot 9 (MS): Interior bedroom side-diagonal tracking — Minh slams door, drops 3D crossbar & pants in fear
  9: [
    {
      f: 1622,
      s: (f) => {
        const u = clamp01((f - 1622) / 210);
        return handheld(
          {
            pos: [lerp(-1.92, -1.48, u), 1.16, lerp(-0.35, -0.92, u)],
            look: [lerp(-0.04, -0.10, u), 1.02, -2.72],
            fov: 43,
          },
          f,
          0.018,
          0.34,
          9,
        );
      },
    },
  ],

  // Shot 10 (OTS -> 160° Pan -> Bed & Under-Bed Twist):
  // f=1832..1895 frames Minh's bodyBack facing bolted door as he slowly glances over his shoulder (glance: 1),
  // f=1895..1968 sweeps smoothly right across the bedside lamp onto the wooden bed,
  // f=1968..2135 slowly creeps lower & closer to the muddy burlap sack on the bed & glaring eyes deep under the bed!
  10: [
    {
      f: 1832,
      s: rolled(
        (f) => {
          const rev = smoothstep(1895, 1968, f);
          const creep = glide(clamp01((f - 1968) / (TOTAL - 1968)));
          const arcX = 1.85 * Math.sin(rev * Math.PI);
          return handheld(
            {
              pos: [
                lerp(-0.58, lerp(-0.42, -0.26, creep), rev),
                lerp(1.06, lerp(0.78, 0.66, creep), rev),
                lerp(-0.78, lerp(-2.02, -1.62, creep), rev),
              ],
              look: [
                lerp(-0.16, lerp(0.32, 0.28, creep), rev) + arcX,
                lerp(0.98, lerp(0.48, 0.44, creep), rev),
                lerp(-2.35, lerp(0.85, 0.80, creep), rev),
              ],
              fov: lerp(43, lerp(46, 44, creep), rev),
            },
            f,
            0.013,
            0.22,
            10,
          );
        },
        -0.032,
      ),
    },
  ],
};
