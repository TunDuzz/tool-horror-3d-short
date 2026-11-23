// Timeline, 10-shot cinematic choreography (zero repeated angles), dynamic state, DOF, kicks, and overlays
// for "Ma Da" v2 (Gothic Ink-Noir x Shadow-Depth). Locked to out/mada/voice/words.json (74.20s / 2226 frames @ 30fps).

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
export const TOTAL = 2226;

export type MadaEra = "wharf" | "shack";

export type MadaShot = ShotBase<HorrorLightKey> & {
  era: MadaEra;
};

export const ANCHORS = {
  // Wharf era (y = 0 river surface; pier deck at y = 0.75, shore z = 2.5 out to z = -2.0)
  PIER_HEAD: [-0.15, 0.75, 1.15] as V3,
  PIER_MID: [-0.20, 0.75, -0.35] as V3,
  PIER_EDGE: [-0.24, 0.75, -1.52] as V3,
  PIER_RECOIL: [-0.40, 0.75, -1.05] as V3,
  LANTERN_POST: [-1.25, 0.75, 0.35] as V3,
  BOLLARD_R: [1.08, 0.75, -1.90] as V3,
  SKIFF: [0.85, 0.0, -2.55] as V3,
  MADA_RISE: [0.16, -0.82, -2.32] as V3,
  MADA_LUNGE: [-0.04, -0.24, -1.86] as V3,
  BANK_SHACK_EXT: [-2.4, 0.72, 5.4] as V3,

  // Shack era (y = 0 dry wooden plank floor)
  SHACK_DOOR: [0.0, 0.0, -3.10] as V3,
  SHACK_WINDOW: [-1.75, 1.52, -3.08] as V3,
  SHACK_TABLE: [1.18, 0.0, -1.75] as V3,
  ONG_TU_ENTRY: [0.15, 0.0, -0.45] as V3,
  ONG_TU_DOOR: [-0.32, 0.0, -2.18] as V3,
  FOOTPRINTS: [0.16, 0.012, -1.18] as V3,
};

export const SHOTS: MadaShot[] = [
  // S1 [0.00s..8.53s]: Wide atmospheric establishing through foreground reeds — NO monster spoiler!
  { id: 1, a: 0, b: 256, era: "wharf", light: "night", scale: "WS", note: "Wide diagonal river establishing through dark foreground reeds" },
  // S2 [8.53s..15.60s]: OTS behind Ông Tư (bodyBack) walking out along lantern-lit pier
  { id: 2, a: 256, b: 468, era: "wharf", light: "candle", scale: "OTS", note: "Over-the-shoulder tracking behind Ông Tư walking onto pier" },
  // S3 [15.60s..25.50s]: Low water-skimming shot of 3D torn conical hat drifting upstream to sampan bow
  { id: 3, a: 468, b: 765, era: "wharf", light: "night", scale: "LOW", note: "River-level low angle on 3D conical hat hitting sampan bow" },
  // S4 [25.50s..32.33s]: Side-3/4 MCU with lantern under-lighting as Ông Tư hunches forward peering down + dollyZoom
  { id: 4, a: 765, b: 970, era: "wharf", light: "eerie", scale: "MCU", note: "Side profile peering down with lantern under-lighting + Vertigo" },
  // S5 [32.33s..38.00s]: High-angle POV ECU down taut rope onto Gothic pale clawed hand + Dead Silence blackout
  { id: 5, a: 970, b: 1140, era: "wharf", light: "eerie", scale: "ECU", note: "Steep POV close-up on mooring rope & drowned hand + blackout" },
  // S6 [38.00s..46.27s]: Low-angle storm reveal with real 3D lightning as Ma Da rises out of the river
  { id: 6, a: 1140, b: 1388, era: "wharf", light: "storm", scale: "LOW", note: "Low-angle storm emergence with real 3D lightning flash" },
  // S7 [46.27s..49.93s]: Tight Dutch-tilt side-front struggle as Ma Da lunges directly at Ông Tư's ankle
  { id: 7, a: 1388, b: 1498, era: "wharf", light: "blood", scale: "CU", note: "Tight Dutch-angle lunge & recoil struggle at pier edge" },
  // S8 [49.93s..58.63s]: Wide reverse angle from riverbank as Ông Tư flees up pier while Ma Da looms behind
  { id: 8, a: 1498, b: 1759, era: "wharf", light: "blood", scale: "WS", note: "Wide reverse riverbank shot of Ông Tư fleeing, Ma Da looming" },
  // S9 [58.63s..63.67s]: Interior shack side-diagonal tracking: rushing in & dropping heavy 3D wooden crossbar
  { id: 9, a: 1759, b: 1910, era: "shack", light: "candle", scale: "MS", note: "Interior shack side tracking slamming door & dropping crossbar" },
  // S10 [63.67s..74.20s]: OTS from behind Ông Tư glancing back over shoulder at wet mud footprints behind his heels
  { id: 10, a: 1910, b: TOTAL, era: "shack", light: "blood", scale: "OTS", note: "OTS back glance revealing flat wet mud footprints behind heels" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  // Lantern sputter as Ông Tư peers over dark hyacinths
  { kind: "flicker", a: 878, b: 904, seed: 5, strength: 0.36 },
  // Lantern dies during [DEAD SILENCE 0.65s] before storm reveal
  { kind: "flicker", a: 1112, b: 1128, seed: 11, strength: 0.52 },
  { kind: "blackout", a: 1128, b: 1140 },
  // Real 3D lightning strikes in Shot 6 (drives both 3D shader uFlashAmt and subtle sky sheen)
  { kind: "lightning", f: 1145, peak: 0.95 },
  { kind: "lightning", f: 1280, peak: 0.80 },
  // Brief blood screen-blend flash on ankle grab impact
  { kind: "flash", f: 1405, dur: 7, color: "#781018", peak: 0.42, blend: "screen" },
  // Clean cinematic dip-to-black transitioning from Wharf Era (Shot 8) into Shack Era (Shot 9)
  { kind: "dipBlack", at: 1759, dur: 12, hold: 2 },
  // Subtle oil lamp flicker at Shot 10 shift + heartbeat tunnel-vision vignette pulse
  { kind: "flicker", a: 1910, b: 1924, seed: 19, strength: 0.24 },
  { kind: "vignettePulse", a: 1995, b: TOTAL, freq: 1.5, strength: 0.48 },
  // Uncanny radial chromatic aberration surges on drowned hand grab, Ma Da emergence/lunge, and final twist
  { kind: "aberration", a: 990, b: 1138, strength: 0.55, pulse: true },
  { kind: "aberration", a: 1142, b: 1498, strength: 0.92, pulse: true },
  { kind: "aberration", a: 1995, b: TOTAL, strength: 0.68, pulse: true },
];

export const KICKS: Kick[] = [
  [698 / FPS, 0.55],  // conical hat bumps sampan bow
  [1068 / FPS, 0.90], // drowned hand yanks sampan bow down
  [1145 / FPS, 1.30], // post-Dead-Silence thunder strike
  [1280 / FPS, 1.00], // second lightning strike as Ma Da emerges
  [1405 / FPS, 1.50], // climax ankle lunge impact
  [1850 / FPS, 0.70], // heavy wooden crossbar slams down on shack door
  [2066 / FPS, 0.85], // chilling twist reveal of footprints right behind heels
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5 },
  { f: 256, cInf: 5.5 },
  { f: 468, cInf: 9.0, focus: () => [0.55, 0.22, -2.35] },
  { f: 765, cInf: 9.5, focus: () => [-0.24, 1.85, -1.52] },
  { f: 970, cInf: 10.0, focus: () => [0.55, 0.28, -2.25] },
  { f: 1140, cInf: 5.5 },
  { f: 1388, cInf: 9.0 },
  { f: 1498, cInf: 4.5 },
  { f: 1759, cInf: 6.5 },
  { f: 1910, cInf: 8.5, focus: (f) => (f < 2010 ? [-0.28, 1.48, -2.15] : [0.16, 0.08, -1.18]) },
];

export type MadaDynamicState = {
  skiffY: number;
  skiffPitch: number;
  skiffRoll: number;
  hatProgress: number;
  handGrab: number;
  madaY: number;
  doorBolt: number; // 0 = lifted open, 1 = slammed down locked
  footprintReveal: number;
  tuPos: V3;
};

export function evalMadaState(shotId: number, f: number): MadaDynamicState {
  const t = f / FPS;
  const calmK = shotId === 3 ? 0.22 : 1.0;
  let skiffY = 0.025 * Math.sin(t * 1.9) * calmK;
  let skiffPitch = 0.02 * Math.sin(t * 1.4 + 0.6) * calmK;
  let skiffRoll = 0.03 * Math.cos(t * 1.7) * calmK;

  let handGrab = 0;
  if (shotId === 5) {
    handGrab = smoothstep(986, 1030, f);
    const yank = smoothstep(1055, 1090, f);
    const tremor = yank * 0.02 * Math.sin(t * 24);
    skiffY -= 0.14 * yank;
    skiffPitch -= (0.24 + tremor) * yank;
    skiffRoll += 0.09 * yank;
  } else if (shotId === 6 || shotId === 7) {
    skiffY = 0.06 * Math.sin(t * 3.8);
    skiffPitch = -0.07 + 0.05 * Math.sin(t * 3.1);
    skiffRoll = 0.08 * Math.cos(t * 3.5);
  }

  const hatProgress = shotId === 3 ? smoothstep(525, 705, f) : 0;

  let madaY = -1.25;
  if (shotId === 6) {
    madaY = -1.18 + 0.66 * smoothstep(1150, 1345, f) + 0.03 * Math.sin(t * 2.5);
  } else if (shotId === 7) {
    madaY = -0.26 + 0.05 * Math.sin(t * 4.5);
  } else if (shotId === 8) {
    madaY = -0.34 + 0.04 * Math.sin(t * 2.2);
  }

  const doorBolt = shotId === 9 ? smoothstep(1838, 1858, f) : shotId === 10 ? 1 : 0;
  const footprintReveal = shotId === 10 ? smoothstep(1930, 2065, f) : 0;

  // Compute Ông Tư world position cleanly so both world lights and cast stay 100% locked
  let tuPos: V3 = [...ANCHORS.PIER_EDGE];
  if (shotId === 1) {
    tuPos = [...ANCHORS.PIER_HEAD];
  } else if (shotId === 2) {
    const u = glide(clamp01((f - 256) / 195));
    tuPos = [lerp(ANCHORS.PIER_HEAD[0], ANCHORS.PIER_EDGE[0], u), 0.75, lerp(ANCHORS.PIER_HEAD[2], ANCHORS.PIER_EDGE[2], u)];
  } else if (shotId === 6) {
    const u = smoothstep(1148, 1215, f);
    tuPos = [lerp(-0.24, -0.36, u), 0.75, lerp(-1.52, -1.18, u)];
  } else if (shotId === 7) {
    const u = smoothstep(1395, 1440, f);
    tuPos = [lerp(-0.26, -0.44, u), 0.75, lerp(-1.44, -1.12, u)];
  } else if (shotId === 8) {
    const u = clamp01((f - 1498) / 245);
    tuPos = [lerp(-0.34, -0.18, u), 0.75, lerp(-0.95, 2.15, u)];
  } else if (shotId === 9) {
    const u = smoothstep(1762, 1835, f);
    tuPos = [lerp(ANCHORS.ONG_TU_ENTRY[0], ANCHORS.ONG_TU_DOOR[0], u), 0.0, lerp(ANCHORS.ONG_TU_ENTRY[2], ANCHORS.ONG_TU_DOOR[2], u)];
  } else if (shotId === 10) {
    tuPos = [...ANCHORS.ONG_TU_DOOR];
  }

  return { skiffY, skiffPitch, skiffRoll, hatProgress, handGrab, madaY, doorBolt, footprintReveal, tuPos };
}

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1 (WS): Wide diagonal establishing shot from across dark river through silhouetted foreground reeds
  1: [
    {
      f: 0,
      s: (f) => {
        const u = clamp01(f / 256);
        return {
          pos: [lerp(-2.85, -2.05, u), lerp(1.72, 1.56, u), lerp(-7.85, -6.75, u)],
          look: [lerp(-0.1, -0.05, u), 1.48, lerp(0.45, 0.05, u)],
          fov: 42,
        };
      },
    },
  ],

  // Shot 2 (OTS): Dramatic 160-deg reverse Over-The-Shoulder behind Ông Tư walking out onto misty pier
  2: [
    {
      f: 256,
      s: (f) => {
        const st = evalMadaState(2, f);
        return handheld(
          camOTS(st.tuPos, [0.35, 0.58, -3.4], 1, 2.62, 0.68, 1.68, 43),
          f,
          0.014,
          0.26,
          2,
        );
      },
    },
  ],

  // Shot 3 (LOW): Unobstructed river-surface low angle on 3D torn conical hat drifting toward curved sampan bow
  3: [
    {
      f: 468,
      s: (f) => {
        const u = clamp01((f - 468) / 297);
        return {
          pos: [lerp(-1.25, -0.72, u), lerp(1.18, 0.98, u), lerp(-4.95, -4.25, u)],
          look: [lerp(-0.42, -0.15, u), 0.14, lerp(-3.18, -2.58, u)],
          fov: 42,
        };
      },
    },
  ],

  // Shot 4 (MCU): Side profile Medium Close-Up — Ông Tư leaning LEFT out over the misty river with lantern under-lighting + Vertigo dollyZoom
  4: [
    {
      f: 765,
      s: (f) => {
        const u = clamp01((f - 765) / 205);
        return handheld(
          dollyZoom([-3.35, 1.88, -1.78], [-0.24, 1.64, -1.76], 42, 1.0 - 0.14 * u),
          f,
          0.015,
          0.28,
          4,
        );
      },
    },
  ],

  // Shot 5 (ECU / POV): Steep high-angle look-down directly onto taut 3D mooring rope & clutching skeletal hand
  5: [
    {
      f: 970,
      s: (f) => {
        const u = clamp01((f - 970) / 170);
        return handheld(
          {
            pos: [lerp(0.18, 0.28, u), lerp(1.98, 1.72, u), lerp(-1.28, -1.48, u)],
            look: [0.84, lerp(0.42, 0.28, u), -2.06],
            fov: 38,
          },
          f,
          0.018,
          0.36,
          5,
        );
      },
    },
  ],

  // Shot 6 (LOW): Dramatic low water-level reveal angled upward through rain & real 3D lightning as Ma Da rises
  6: [
    {
      f: 1140,
      s: (f) =>
        handheld(
          {
            pos: [-1.42, 0.78, -4.65 * snapZoom(f, 1145, 14, 1.0, 0.90) * pushK(f, 1140, 0.0005)],
            look: [-0.04, 1.48, -1.85],
            fov: 44,
          },
          f,
          0.024,
          0.44,
          6,
        ),
    },
  ],

  // Shot 7 (CU): Tight Dutch-tilt struggle framing BOTH full terrified Ông Tư AND lunging clawed Ma Da!
  7: [
    {
      f: 1388,
      s: rolled(
        (f) =>
          handheld(
            {
              pos: [1.88, 1.62, -3.95 * pushK(f, 1388, 0.0012)],
              look: [-0.14, 1.50, -1.68],
              fov: 44,
            },
            f,
            0.026,
            0.50,
            7,
          ),
        0.085,
      ),
    },
  ],

  // Shot 8 (WS): Wide reverse riverbank shot looking back down the pier — Ông Tư fleeing forward, Ma Da looming in mist behind
  8: [
    {
      f: 1498,
      s: (f) => {
        const u = clamp01((f - 1498) / 261);
        return {
          pos: [lerp(-1.65, -1.15, u), lerp(2.25, 2.05, u), lerp(4.15, 4.75, u)],
          look: [lerp(-0.10, -0.05, u), 1.38, lerp(-1.45, -1.85, u)],
          fov: 42,
        };
      },
    },
  ],

  // Shot 9 (MS): Interior watchman's shack side-diagonal tracking — Ông Tư runs in & slams down the 3D wooden crossbar
  9: [
    {
      f: 1759,
      s: (f) => {
        const u = clamp01((f - 1759) / 151);
        return handheld(
          {
            pos: [lerp(-1.85, -1.35, u), 1.36, lerp(0.85, 0.15, u)],
            look: [lerp(0.05, 0.15, u), 1.15, -2.45],
            fov: 42,
          },
          f,
          0.020,
          0.38,
          9,
        );
      },
    },
  ],

  // Shot 10 (OTS -> Floor Twist): Starts behind Ông Tư at bolted door, arcs down as he glances over his shoulder at wet mud footprints!
  10: [
    {
      f: 1910,
      s: rolled(
        (f) => {
          const u = glide(clamp01((f - 1910) / (TOTAL - 1910)));
          const tiltDown = smoothstep(1990, 2110, f);
          return handheld(
            {
              pos: [lerp(0.68, 0.36, u), lerp(1.56, 1.38, tiltDown), lerp(0.95, 0.22, u)],
              look: [lerp(-0.22, 0.06, tiltDown), lerp(1.24, 0.38, tiltDown), lerp(-2.10, -1.22, tiltDown)],
              fov: 41,
            },
            f,
            0.014,
            0.25,
            10,
          );
        },
        -0.04,
      ),
    },
  ],
};
