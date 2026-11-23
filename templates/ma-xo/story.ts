// Timeline, 10-shot cinematic choreography (zero repeated consecutive scales), dynamic state,
// DOF, kicks, and overlays for "Ma Xo — Bat Sut Sau Bep Ong Tao" (9:16 vertical, 30 fps).
// Locked to out/ma-xo/voice/words.json (73.75s / 2223 frames @ 30fps).

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
export const TOTAL = 2223;

export type MaXoEra = "kitchen" | "hallway";

export type MaXoShot = ShotBase<HorrorLightKey> & {
  era: MaXoEra;
};

export const ANCHORS = {
  // Era 1: Old Vietnamese country kitchen (floor y = 0)
  HEARTH: [-0.55, 0.0, -3.35] as V3,
  NOOK: [0.78, 0.0, -3.38] as V3,
  KITCHEN_WINDOW: [-2.45, 1.56, -4.12] as V3,
  KITCHEN_TABLE: [2.35, 0.0, -3.32] as V3,
  LAN_START: [0.95, 0.0, 0.45] as V3,
  LAN_NEAR_NOOK: [0.48, 0.0, -1.78] as V3,
  LAN_PEER: [0.36, 0.0, -2.08] as V3,
  LAN_OFFER: [-0.36, 0.0, -2.05] as V3,
  MAXO_NOOK: [0.74, 0.0, -3.32] as V3,

  // Era 2: Main 3-bay timber hall toward front ironwood door (floor y = 0)
  FRONT_DOOR: [0.0, 0.0, -3.65] as V3,
  HALL_WINDOW: [-2.10, 1.58, -3.88] as V3,
  HALL_ALTAR: [2.15, 0.0, -3.15] as V3,
  MAXO_LUNGE: [-0.68, 0.0, -2.28] as V3,
  LAN_TRAPPED: [-0.18, 0.0, -1.65] as V3,
};

export const SHOTS: MaXoShot[] = [
  // S1 [0.00s..10.50s]: Wide diagonal kitchen through dark ceiling rafters — NO full monster spoiler!
  { id: 1, a: 0, b: 315, era: "kitchen", light: "night", scale: "WS", note: "Wide diagonal country kitchen; clay Ong Tao hearth, dark ash nook & subliminal eyes" },
  // S2 [10.50s..17.83s]: OTS behind Lan (bodyBack) stepping into cold dark kitchen with brass oil lamp
  { id: 2, a: 315, b: 535, era: "kitchen", light: "candle", scale: "OTS", note: "Over-the-shoulder behind Lan carrying oil lamp toward clay Ong Tao hearth" },
  // S3 [17.83s..28.33s]: Floor-skimming low angle on ash nook — chipped bowl flips upright, embers snuff, scratch cues
  { id: 3, a: 535, b: 850, era: "kitchen", light: "candle", scale: "LOW", note: "Low floor angle on ash nook: bowl flips upright, hearth embers die, nail scratches" },
  // S4 [28.33s..31.83s]: Side profile MCU with Vertigo dollyZoom lowering oil lamp into dark nook
  { id: 4, a: 850, b: 955, era: "kitchen", light: "eerie", scale: "MCU", note: "Side profile MCU lowering oil lamp with underLight + Vertigo compression" },
  // S5 [31.83s..39.07s]: Steep top-down ECU on bare footprints facing plaster wall in ash + Dead Silence blackout
  { id: 5, a: 955, b: 1172, era: "kitchen", light: "eerie", scale: "ECU", note: "Top-down ECU on gaunt bare footprints in swept ash facing wall + lamp blackout" },
  // S6 [39.07s..47.17s]: Dramatic low-angle crimson ember flare reveal as Ma Xo unfolds out of ash nook
  { id: 6, a: 1172, b: 1415, era: "kitchen", light: "storm", scale: "LOW", note: "Low upward reveal with ember flare as soot-covered Ma Xo crawls out behind Lan" },
  // S7 [47.17s..51.50s]: Tight Dutch-tilt blood climax at hallway threshold framing Ma Xo grabbing toward Lan
  { id: 7, a: 1415, b: 1545, era: "hallway", light: "blood", scale: "CU", note: "Tight Dutch-angle blood climax near ironwood door framing lunging Ma Xo & recoiling Lan" },
  // S8 [51.50s..59.93s]: Medium side tracking in kitchen — Lan hurriedly flips chipped bowl back upright->down & Ma Xo retreats
  { id: 8, a: 1545, b: 1798, era: "kitchen", light: "candle", scale: "MS", note: "Medium kitchen shot: Lan returns chipped bowl & warm ash, Ma Xo retreats into shadow" },
  // S9 [59.93s..66.47s]: Wide poignant hallway shot — Lan trapped indoors staring at night garden & glancing back
  { id: 9, a: 1798, b: 1994, era: "hallway", light: "night", scale: "WS", note: "Wide hallway shot through rafters: Lan trapped indoors after dusk glancing back" },
  // S10 [66.47s..74.10s]: Open-ending OTS -> floor glide on white cold rice bowl dragged into nook by ash-covered hand!
  { id: 10, a: 1994, b: TOTAL, era: "kitchen", light: "blood", scale: "OTS", note: "OTS ritual offering gliding down to cold rice bowl dragged into pitch-black nook by ash hand" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  // Hearth ember dies abruptly at f=698 ("vụt tắt")
  { kind: "flicker", a: 690, b: 718, seed: 7, strength: 0.34 },
  // Oil lamp shivers & snuffs out into [DEAD SILENCE 0.65s] (38.44s..39.09s = f1153..1172)
  { kind: "flicker", a: 1122, b: 1151, seed: 13, strength: 0.46 },
  { kind: "blackout", a: 1153, b: 1172 },
  // Post-Dead-Silence crimson ember burst & storm surge ("Tàn than chợt bùng sáng đỏ quạch!" f=1174..1208)
  { kind: "lightning", f: 1174, peak: 0.92 },
  { kind: "flash", f: 1198, dur: 8, color: "#c2241e", peak: 0.44, blend: "screen" },
  { kind: "lightning", f: 1280, peak: 0.78 },
  // Crimson shock sheen at hallway ankle-grab climax ("níu chặt" f=1424)
  { kind: "flash", f: 1423, dur: 6, color: "#98161e", peak: 0.38, blend: "screen" },
  // Clean dipBlack era transitions (S7->S8 kitchen, S8->S9 hallway, S9->S10 midnight kitchen ritual)
  { kind: "dipBlack", at: 1545, dur: 10, hold: 2 },
  { kind: "dipBlack", at: 1798, dur: 10, hold: 2 },
  { kind: "dipBlack", at: 1994, dur: 10, hold: 2 },
  // Subtle eerie pulse on final lingering open ending (keeps dark-screen readability!)
  { kind: "vignettePulse", a: 2085, b: TOTAL, freq: 1.35, strength: 0.14 },
  // Radial RGB chromatic aberration surges on ash footprints, Ma Xo emergence/climax, and ash hand pull
  { kind: "aberration", a: 995, b: 1150, strength: 0.44, pulse: true },
  { kind: "aberration", a: 1174, b: 1544, strength: 0.76, pulse: true },
  { kind: "aberration", a: 2110, b: TOTAL, strength: 0.54, pulse: true },
];

export const KICKS: Kick[] = [
  [596 / FPS, 0.62],  // bowl flipped upright ("lật ngửa")
  [697 / FPS, 0.70],  // hearth ember snuffs cold ("vụt tắt")
  [792 / FPS, 0.55],  // fingernails scratch ash ("móng tay cào")
  [1008 / FPS, 0.60], // ash footprints spotted ("hai dấu chân")
  [1174 / FPS, 1.30], // post-Dead-Silence ember flare ("Tàn than")
  [1200 / FPS, 1.15], // red flare peak ("bùng sáng")
  [1423 / FPS, 1.40], // Ma Xo ankle lunge ("níu chặt")
  [1620 / FPS, 0.78], // chipped bowl slammed back upside-down ("úp trả lại")
  [2045 / FPS, 0.55], // cold rice bowl placed down ("đặt bát cơm")
  [2156 / FPS, 0.85], // ash hand reaches & drags bowl ("thò ra kéo")
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.8 },
  { f: 315, cInf: 5.5 },
  { f: 535, cInf: 8.5, focus: () => [0.68, 0.18, -3.12] },
  { f: 850, cInf: 8.0, focus: () => [0.36, 1.25, -2.08] },
  { f: 955, cInf: 9.0, focus: () => [0.76, 0.04, -3.30] },
  { f: 1172, cInf: 4.8 },
  { f: 1415, cInf: 7.5 },
  { f: 1545, cInf: 6.0 },
  { f: 1798, cInf: 4.2 },
  { f: 1994, cInf: 7.8, focus: (f) => (f < 2055 ? [-0.36, 1.10, -2.05] : [0.64, 0.16, -2.98]) },
];

export type MaXoDynamicState = {
  bowlFlip: number;       // 0 = upside-down in nook, 1 = flipped upright & slid aside
  emberGlow: number;      // 0..1 hearth ember intensity
  scratchReveal: number;  // 0..1 ash scratches appearing in Shot 3
  maXoZ: number;
  maXoX: number;
  lanPos: V3;
  handReach: number;      // 0..1 ash hand emerging in Shot 10
  ricePull: number;       // 0..1 cold rice bowl dragged into pitch-black nook
};

export function evalMaXoState(shotId: number, f: number): MaXoDynamicState {
  // Chipped bowl state: upside-down (S1..S2) -> flipped upright (S3..S7) -> returned upside-down (S8..S10)
  let bowlFlip = 0;
  if (shotId === 3) {
    bowlFlip = smoothstep(555, 622, f);
  } else if (shotId >= 4 && shotId <= 7) {
    bowlFlip = 1;
  } else if (shotId === 8) {
    bowlFlip = 1 - smoothstep(1612, 1648, f);
  } else if (shotId === 10) {
    bowlFlip = 0;
  }

  // Hearth ember intensity: warm glow S1..S3 -> snuffs dead at f=698 -> flares bright crimson at S6!
  let emberGlow = 0.72;
  if (shotId === 3) {
    emberGlow = 0.78 * (1 - smoothstep(690, 706, f));
  } else if (shotId === 4 || shotId === 5) {
    emberGlow = 0.0;
  } else if (shotId === 6) {
    emberGlow = 0.95 + 0.85 * Math.exp(-Math.pow((f - 1200) / 14, 2));
  } else if (shotId === 8) {
    emberGlow = 0.55;
  } else if (shotId === 10) {
    emberGlow = 0.30;
  }

  const scratchReveal = shotId === 3 ? smoothstep(775, 835, f) : shotId >= 4 && shotId <= 6 ? 1 : 0;

  let maXoX = ANCHORS.MAXO_NOOK[0];
  let maXoZ = ANCHORS.MAXO_NOOK[2];
  if (shotId === 6) {
    const u = smoothstep(1265, 1385, f);
    maXoX = lerp(0.76, 0.54, u);
    maXoZ = lerp(-3.26, -2.42, u);
  } else if (shotId === 7) {
    const u = smoothstep(1418, 1475, f);
    maXoX = ANCHORS.MAXO_LUNGE[0];
    maXoZ = lerp(-2.45, -2.14, u);
  } else if (shotId === 8) {
    const u = smoothstep(1725, 1794, f);
    maXoX = lerp(0.72, 0.96, u);
    maXoZ = lerp(-2.82, -3.72, u);
  }

  let lanPos: V3 = [...ANCHORS.LAN_START];
  if (shotId === 1) {
    lanPos = [...ANCHORS.LAN_START];
  } else if (shotId === 2) {
    const u = glide(clamp01((f - 315) / 205));
    lanPos = [lerp(ANCHORS.LAN_START[0], ANCHORS.LAN_NEAR_NOOK[0], u), 0.0, lerp(ANCHORS.LAN_START[2], ANCHORS.LAN_NEAR_NOOK[2], u)];
  } else if (shotId === 3) {
    // Positioned cleanly off-left in tight low-angle Shot 3 so her oil lamp illuminates the ash nook with zero clipping
    lanPos = [-0.95, 0.0, -2.05];
  } else if (shotId === 4) {
    lanPos = [...ANCHORS.LAN_PEER];
  } else if (shotId === 6) {
    const u = smoothstep(1275, 1365, f);
    lanPos = [lerp(-0.28, -0.46, u), 0.0, lerp(-1.74, -1.42, u)];
  } else if (shotId === 7) {
    const u = smoothstep(1424, 1485, f);
    lanPos = [lerp(0.50, 0.58, u), 0.0, lerp(-1.32, -1.14, u)];
  } else if (shotId === 8) {
    const u = smoothstep(1555, 1620, f);
    lanPos = [lerp(-0.22, 0.14, u), 0.0, lerp(-1.85, -2.26, u)];
  } else if (shotId === 9) {
    lanPos = [...ANCHORS.LAN_TRAPPED];
  } else if (shotId === 10) {
    lanPos = [...ANCHORS.LAN_OFFER];
  }

  const handReach = shotId === 10 ? smoothstep(2108, 2158, f) : 0;
  const ricePull = shotId === 10 ? smoothstep(2154, 2218, f) : 0;

  return { bowlFlip, emberGlow, scratchReveal, maXoZ, maXoX, lanPos, handReach, ricePull };
}

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1 (WS): Wide diagonal establishing of old country kitchen through foreground ceiling rafters
  1: [
    {
      f: 0,
      s: (f) => {
        const u = clamp01(f / 315);
        return {
          pos: [lerp(1.92, 1.28, u), lerp(1.66, 1.48, u), lerp(2.48, 1.58, u)],
          look: [lerp(0.08, 0.12, u), 1.02, lerp(-3.18, -3.38, u)],
          fov: 45,
        };
      },
    },
  ],

  // Shot 2 (OTS): Over-the-shoulder behind Lan carrying her warm brass oil lamp into the cold kitchen
  2: [
    {
      f: 315,
      s: (f) => {
        const st = evalMaXoState(2, f);
        return handheld(
          camOTS(st.lanPos, [0.42, 0.92, -3.35], 1, 2.34, 0.54, 1.38, 44),
          f,
          0.013,
          0.26,
          2,
        );
      },
    },
  ],

  // Shot 3 (LOW): Unobstructed floor-skimming angle on ash nook — chipped bowl flips upright & embers die
  3: [
    {
      f: 535,
      s: (f) => {
        const u = clamp01((f - 535) / 315);
        return handheld(
          {
            pos: [lerp(0.08, 0.24, u), lerp(0.56, 0.44, u), lerp(-1.12, -1.50, u)],
            look: [lerp(0.68, 0.62, u), lerp(0.32, 0.22, u), -3.16],
            fov: 43,
          },
          f,
          0.010,
          0.22,
          3,
        );
      },
    },
  ],

  // Shot 4 (MCU): Side profile Medium Close-Up with Vertigo dollyZoom + warm-eerie oil-lamp underLight (centered on leaning peer face!)
  4: [
    {
      f: 850,
      s: (f) => {
        const u = clamp01((f - 850) / 105);
        return handheld(
          dollyZoom([-1.95, 1.30, -1.78], [0.36, 1.22, -1.72], 42, 1.0 - 0.14 * u),
          f,
          0.014,
          0.30,
          4,
        );
      },
    },
  ],

  // Shot 5 (ECU): Steep unobstructed top-down ECU on gaunt bare footprints in swept ash facing back wall
  5: [
    {
      f: 955,
      s: (f) => {
        const u = clamp01((f - 955) / 217);
        return handheld(
          {
            pos: [lerp(0.62, 0.74, u), lerp(1.50, 1.24, u), lerp(-2.36, -2.60, u)],
            look: [0.76, 0.04, -3.32],
            fov: 38,
          },
          f,
          0.015,
          0.34,
          5,
        );
      },
    },
  ],

  // Shot 6 (LOW): Dramatic upward reveal with crimson ember burst framing BOTH recoiling Lan (lower-left) & emerging Ma Xo (upper-right)!
  6: [
    {
      f: 1172,
      s: (f) =>
        handheld(
          {
            pos: [
              -1.14,
              0.84,
              0.44 - 0.28 * (1 - snapZoom(f, 1276, 14, 1.0, 0.88)) * 3.5 + (1 - pushK(f, 1172, 0.0007)) * -0.35,
            ],
            look: [0.16, 1.18, -2.48],
            fov: 46,
          },
          f,
          0.022,
          0.42,
          6,
        ),
    },
  ],

  // Shot 7 (CU): Depth-layered Dutch-tilt crimson climax at hallway threshold framing Ma Xo (upper-left) & Lan (lower-right)
  7: [
    {
      f: 1415,
      s: rolled(
        (f) =>
          handheld(
            {
              pos: [0.92, 1.16, 0.62 * pushK(f, 1415, 0.0022)],
              look: [-0.04, 1.15, -2.05],
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

  // Shot 8 (MS): Medium side tracking in kitchen — Lan flips chipped bowl back upside-down & Ma Xo retreats cleanly in frame
  8: [
    {
      f: 1545,
      s: (f) => {
        const u = clamp01((f - 1545) / 253);
        return handheld(
          {
            pos: [lerp(-1.62, -1.32, u), 1.24, lerp(-0.32, -0.76, u)],
            look: [lerp(0.42, 0.56, u), 1.02, -3.05],
            fov: 45,
          },
          f,
          0.016,
          0.32,
          8,
        );
      },
    },
  ],

  // Shot 9 (WS): Wide poignant hallway shot through rafters — Lan trapped indoors staring out at night & glancing back
  9: [
    {
      f: 1798,
      s: (f) => {
        const u = clamp01((f - 1798) / 196);
        return {
          pos: [lerp(-1.42, -0.92, u), lerp(1.56, 1.42, u), lerp(2.22, 1.48, u)],
          look: [lerp(0.10, 0.06, u), 1.16, -3.22],
          fov: 44,
        };
      },
    },
  ],

  // Shot 10 (OTS -> Low Floor Glide): Starts behind Lan (full head in frame!) placing the cold white rice bowl, glides down low as ash hand drags bowl into nook!
  10: [
    {
      f: 1994,
      s: rolled(
        (f) => {
          const rev = smoothstep(2046, 2124, f);
          const creep = glide(clamp01((f - 2124) / (TOTAL - 2124)));
          return handheld(
            {
              pos: [
                lerp(-0.88, lerp(0.18, 0.26, creep), rev),
                lerp(1.26, lerp(0.46, 0.38, creep), rev),
                lerp(-0.14, lerp(-1.38, -1.62, creep), rev),
              ],
              look: [
                lerp(0.10, lerp(0.68, 0.78, creep), rev),
                lerp(0.96, lerp(0.18, 0.16, creep), rev),
                lerp(-2.45, lerp(-2.96, -3.14, creep), rev),
              ],
              fov: lerp(45, lerp(42, 40, creep), rev),
            },
            f,
            0.013,
            0.22,
            10,
          );
        },
        -0.028,
      ),
    },
  ],
};
