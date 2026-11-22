// Timeline, shot list, camera choreography, DOF, impact kicks, overlays, and dynamic state for "Ma Da" (MadaShort).
// Locked to out/mada/voice/words.json (73.82s / 2226 frames @ 30 fps).

import {
  CamKey,
  DofBeat,
  FPS,
  HorrorLightKey,
  Kick,
  ScreenBeat,
  ShotBase,
  V3,
  clamp01,
  dollyZoom,
  handheld,
  pushK,
  rolled,
  snapZoom,
} from "../engine";

const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

export { FPS };
export const TOTAL = 2226;

export type MadaEra = "wharf" | "shack";

export type MadaShot = ShotBase<HorrorLightKey> & {
  era: MadaEra;
};

export const ANCHORS = {
  // Wharf era (y = 0 is river surface; pier deck is at y = 0.75, extending from shore z = +2.35 out to z = -1.95)
  PIER_WALK: [-0.16, 0.75, -0.35] as V3,
  PIER_EDGE: [-0.24, 0.75, -1.55] as V3,
  PIER_RECOIL: [-0.36, 0.75, -0.82] as V3,
  LANTERN_POST: [-1.26, 0.75, 0.25] as V3,
  BOLLARD_R: [1.02, 0.75, -1.88] as V3,
  SKIFF: [0.78, 0.0, -2.35] as V3,
  MADA_FAR: [0.28, -0.82, -3.25] as V3,
  MADA_RISE: [0.24, -0.58, -2.42] as V3,
  MADA_GRAB: [0.16, -0.38, -2.06] as V3,
  BANK_SHACK_EXT: [-3.4, 0.72, 6.0] as V3,

  // Shack era (y = 0 is dry interior wooden plank floor)
  SHACK_DOOR: [0.0, 0.0, -3.1] as V3,
  SHACK_WINDOW: [-1.65, 1.48, -3.06] as V3,
  SHACK_TABLE: [0.82, 0.0, -1.75] as V3,
  ONG_TU_DOOR: [-0.18, 0.0, -1.35] as V3,
  ONG_TU_FLOOR: [-0.42, 0.0, -0.68] as V3,
  FOOTPRINTS: [0.06, 0.14, -1.18] as V3,
};

export const SHOTS: MadaShot[] = [
  // S1 [0.00s..8.53s]: Cold Hook — River taboo at 2 AM
  { id: 1, a: 0, b: 256, era: "wharf", light: "night" },
  // S2 [8.53s..15.60s]: Setting — Ông Tư walks out onto the misty pier with storm lantern
  { id: 2, a: 256, b: 468, era: "wharf", light: "candle" },
  // S3 [15.60s..25.50s]: First Uncanny Cue — River freezes still; torn conical hat drifts upstream to boat bow
  { id: 3, a: 468, b: 765, era: "wharf", light: "night" },
  // S4 [25.50s..32.33s]: Investigation 1 — Ông Tư leans lantern over dark water & hyacinths; no reflection
  { id: 4, a: 765, b: 970, era: "wharf", light: "eerie" },
  // S5 [32.33s..38.00s]: Investigation 2 + Dead Silence — Pale drowned hand grips rope & pulls boat bow down
  { id: 5, a: 970, b: 1140, era: "wharf", light: "eerie" },
  // S6 [38.00s..46.27s]: Storm & Ma Da Emergence — Lightning cracks; soaked Ma Da rises from river beside pier
  { id: 6, a: 1140, b: 1388, era: "wharf", light: "storm" },
  // S7 [46.27s..49.93s]: Climax Ankle Grab — Ma Da lunges for Ông Tư's ankle in crimson dread
  { id: 7, a: 1388, b: 1498, era: "wharf", light: "blood" },
  // S8 [49.93s..58.63s]: Dark Folklore Realization — Ma Da haunting the river depths waiting for a replacement soul
  { id: 8, a: 1498, b: 1759, era: "wharf", light: "blood" },
  // S9 [58.63s..63.67s]: Escape into Shack — Ông Tư stumbles inside watchman's shack and bars the wooden door
  { id: 9, a: 1759, b: 1910, era: "shack", light: "candle" },
  // S10 [63.67s..74.20s]: Lingering Twist — Wet black-mud footprints already printed on dry floorboards behind him
  { id: 10, a: 1910, b: TOTAL, era: "shack", light: "blood" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  // Lantern sputter as he peers into the hyacinths
  { kind: "flicker", a: 878, b: 904, seed: 5, strength: 0.38 },
  // Lantern dies during the [DEAD SILENCE 0.65s] right before the storm strike
  { kind: "flicker", a: 1112, b: 1128, seed: 11, strength: 0.55 },
  { kind: "blackout", a: 1128, b: 1140 },
  // Lightning strikes in Shot 6 ("Chớp giật xé toạc màn đêm" & "một bóng người ướt sũng")
  { kind: "lightning", f: 1145, peak: 0.88 },
  { kind: "lightning", f: 1280, peak: 0.72 },
  // Crimson shock flash on the ankle grab in Shot 7 ("chộp cứng lấy cổ chân")
  { kind: "flash", f: 1405, dur: 9, color: "#580810", peak: 0.55 },
  // Oil lamp flicker inside shack as Shot 10 shifts to blood-moon dread
  { kind: "flicker", a: 1910, b: 1928, seed: 19, strength: 0.22 },
];

export const KICKS: Kick[] = [
  [698 / FPS, 0.55],  // conical hat bumps boat bow with splash
  [1068 / FPS, 0.85], // drowned hand yanks sampan bow down
  [1145 / FPS, 1.25], // first lightning thunder crack after Dead Silence
  [1280 / FPS, 0.95], // second lightning strike as Ma Da rises
  [1405 / FPS, 1.45], // climax ankle grab impact kick
  [2066 / FPS, 0.80], // realization of wet mud footprints behind him
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5 },
  { f: 256, cInf: 6.5 },
  { f: 468, cInf: 5.5 },
  { f: 765, cInf: 8.5 },
  { f: 970, cInf: 9.0 },
  { f: 1140, cInf: 6.0 },
  { f: 1388, cInf: 10.5 },
  { f: 1498, cInf: 5.0 },
  { f: 1759, cInf: 7.5 },
  { f: 1910, cInf: 9.5 },
];

export type MadaDynamicState = {
  /** Boat vertical heave offset (m) */
  skiffY: number;
  /** Boat pitch (rad, negative = bow pulled down into water) */
  skiffPitch: number;
  /** Boat roll (rad) */
  skiffRoll: number;
  /** Conical hat progress 0..1 drifting upstream toward boat bow in Shot 3 */
  hatProgress: number;
  /** Pale hand grip progress 0..1 on mooring rope in Shot 5 */
  handGrab: number;
  /** Ma Da vertical emergence y (m) in Shots 6..8 (submerged in y=0 river) */
  madaY: number;
  /** Wet footprints reveal alpha 0..1 in Shot 10 */
  footprintReveal: number;
};

export function evalMadaState(shotId: number, f: number): MadaDynamicState {
  const t = f / FPS;
  const calmK = shotId === 3 ? 0.25 : 1.0;
  let skiffY = 0.025 * Math.sin(t * 1.9) * calmK;
  let skiffPitch = 0.02 * Math.sin(t * 1.4 + 0.6) * calmK;
  let skiffRoll = 0.03 * Math.cos(t * 1.7) * calmK;

  let handGrab = 0;
  if (shotId === 5) {
    handGrab = smoothstep(984, 1025, f);
    const yank = smoothstep(1055, 1088, f);
    const tremor = yank * 0.018 * Math.sin(t * 22);
    skiffY -= 0.12 * yank;
    skiffPitch -= (0.21 + tremor) * yank;
    skiffRoll += 0.08 * yank;
  } else if (shotId === 6 || shotId === 7) {
    skiffY = 0.055 * Math.sin(t * 3.8);
    skiffPitch = -0.06 + 0.05 * Math.sin(t * 3.1);
    skiffRoll = 0.07 * Math.cos(t * 3.5);
  }

  const hatProgress = shotId === 3 ? smoothstep(555, 705, f) : 0;

  // Ma Da is waist/chest-deep in the river (y=0 water surface hides her lower legs, upper body rises to pier deck y=0.75)
  let madaY = -1.15;
  if (shotId === 6) {
    madaY = -1.05 + 0.52 * smoothstep(1180, 1355, f) + 0.03 * Math.sin(t * 2.5);
  } else if (shotId === 7) {
    madaY = -0.38 + 0.04 * Math.sin(t * 4.0);
  } else if (shotId === 8) {
    madaY = -0.56 + 0.04 * Math.sin(t * 2.1);
  }

  const footprintReveal = shotId === 10 ? smoothstep(1920, 2060, f) : 0;

  return {
    skiffY,
    skiffPitch,
    skiffRoll,
    hatProgress,
    handGrab,
    madaY,
    footprintReveal,
  };
}

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1: Wide night river glide toward the misty pier, moored sampan, and Ông Tư on the deck
  1: [
    {
      f: 0,
      s: (f) => {
        const u = clamp01((f - 0) / 256);
        return {
          pos: [-0.85 + 0.35 * u, 2.32 - 0.14 * u, -6.95 + 0.75 * u],
          look: [0.04, 1.38, -1.75],
          fov: 43,
        };
      },
    },
  ],

  // Shot 2: Medium tracking shot from river side as Ông Tư walks out along the wooden pier with his storm lantern
  2: [
    {
      f: 256,
      s: (f) => {
        const u = clamp01((f - 256) / 212);
        return handheld(
          {
            pos: [-0.88 + 0.25 * u, 1.98 - 0.06 * u, -5.95 * pushK(f, 256, 0.0004)],
            look: [-0.16, 1.56, -0.95 - 0.50 * u],
            fov: 42,
          },
          f,
          0.012,
          0.25,
          2,
        );
      },
    },
  ],

  // Shot 3: River-level view of the dead-still dark water, sampan bow, and Ông Tư as the battered conical hat drifts upstream
  3: [
    {
      f: 468,
      s: (f) => {
        const u = clamp01((f - 468) / 297);
        return {
          pos: [-0.55 + 0.25 * u, 1.95 - 0.10 * u, -6.15 + 0.45 * u],
          look: [0.16, 1.18, -2.05],
          fov: 42,
        };
      },
    },
  ],

  // Shot 4: Eerie dolly-zoom on Ông Tư leaning over the pier edge with his storm lantern over the water-hyacinths
  4: [
    {
      f: 765,
      s: (f) => {
        const u = clamp01((f - 765) / 205);
        return handheld(
          dollyZoom(
            [-0.58, 1.92, -5.75],
            [-0.18, 1.54, -1.55],
            41,
            1.0 - 0.15 * u,
          ),
          f,
          0.014,
          0.28,
          4,
        );
      },
    },
  ],

  // Shot 5: Framing the sampan bow, taut mooring rope, pale drowned hand, and Ông Tư on the pier
  5: [
    {
      f: 970,
      s: (f) => {
        const u = clamp01((f - 970) / 170);
        return handheld(
          {
            pos: [0.05 + 0.12 * u, 1.78 - 0.08 * u, -5.65 + 0.35 * u],
            look: [0.12, 1.15 - 0.06 * u, -1.95],
            fov: 42,
          },
          f,
          0.016,
          0.32,
          5,
        );
      },
    },
  ],

  // Shot 6: Storm reveal — lightning cracks across the river as Ma Da rises waist-deep out of the water beside the pier
  6: [
    {
      f: 1140,
      s: (f) =>
        handheld(
          {
            pos: [
              -0.68,
              1.94,
              -6.15 * snapZoom(f, 1145, 14, 1.0, 0.92) * pushK(f, 1140, 0.0004),
            ],
            look: [-0.02, 1.42, -1.95],
            fov: 43,
          },
          f,
          0.022,
          0.42,
          6,
        ),
    },
  ],

  // Shot 7: Crimson Dutch-angle climax as Ma Da lunges for Ông Tư's ankle at the pier edge
  7: [
    {
      f: 1388,
      s: rolled(
        (f) =>
          handheld(
            {
              pos: [-0.52, 1.84, -5.55 * pushK(f, 1388, 0.0010)],
              look: [-0.06, 1.44, -1.78],
              fov: 43,
            },
            f,
            0.024,
            0.46,
            7,
          ),
        0.075,
      ),
    },
  ],

  // Shot 8: Blood-moon folklore realization — low river glide separating Ma Da (screen left) & Ông Tư retreating up the pier (screen right)
  8: [
    {
      f: 1498,
      s: (f) => {
        const u = clamp01((f - 1498) / 261);
        return {
          pos: [-0.35 + 0.55 * u, 1.98 + 0.08 * u, -6.25 + 0.40 * u],
          look: [0.0, 1.42, -1.85],
          fov: 43,
        };
      },
    },
  ],

  // Shot 9: Inside watchman's shack (candle) — Ông Tư stumbles back from the bolted wooden door beside the glowing oil lamp
  9: [
    {
      f: 1759,
      s: (f) => {
        const u = clamp01((f - 1759) / 151);
        return handheld(
          {
            pos: [0.32 - 0.16 * u, 1.48, 3.25 - 0.32 * u],
            look: [-0.04, 0.96, -1.45],
            fov: 42,
          },
          f,
          0.016,
          0.32,
          9,
        );
      },
    },
  ],

  // Shot 10: Lingering Twist inside shack (blood) — push-in revealing wet black-mud footprints on dry floorboards behind Ông Tư
  10: [
    {
      f: 1910,
      s: rolled(
        (f) => {
          const u = clamp01((f - 1910) / (TOTAL - 1910));
          return handheld(
            {
              pos: [0.22 - 0.10 * u, 1.56 - 0.12 * u, 3.35 - 0.45 * u],
              look: [-0.02 + 0.05 * u, 0.88 - 0.08 * u, -1.25],
              fov: 42,
            },
            f,
            0.012,
            0.25,
            10,
          );
        },
        -0.045,
      ),
    },
  ],
};
