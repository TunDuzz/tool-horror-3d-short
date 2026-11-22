// Timeline, camera choreography, DOF, impact kicks, and full-screen overlays for HorrorLab look-dev rig.
// Covers all 5 horror lighting presets (night, candle, storm, eerie, blood) across 150 frames @ 30 fps (5 s).

import {
  CamKey,
  DofBeat,
  FPS,
  HorrorLightKey,
  Kick,
  ScreenBeat,
  ShotBase,
  V3,
  atAnchor,
  clamp01,
  dollyZoom,
  handheld,
  pushK,
  rolled,
  snapZoom,
} from "../engine";

export { FPS };
export const TOTAL = 150;

export const ANCHORS = {
  PORCH: [0, 0, -2.6] as V3,
  DOOR: [0, 0, -2.0] as V3,
  WINDOW: [-2.1, 1.55, -2.1] as V3,
  TRAVELER_NEAR: [-0.65, 0, 1.4] as V3,
  TRAVELER_MID: [-0.58, 0, 0.45] as V3,
  GHOST_FAR: [0.32, 0, -2.15] as V3,
  GHOST_NEAR: [0.35, 0, -0.75] as V3,
  LANTERN_POST: [1.75, 0, 0.2] as V3,
};

export type HorrorShot = ShotBase<HorrorLightKey>;

export const SHOTS: HorrorShot[] = [
  { id: 1, a: 0, b: 30, light: "night" },
  { id: 2, a: 30, b: 60, light: "candle" },
  { id: 3, a: 60, b: 90, light: "storm" },
  { id: 4, a: 90, b: 120, light: "eerie" },
  { id: 5, a: 120, b: TOTAL, light: "blood" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  { kind: "lightning", f: 72, peak: 0.85 },
  { kind: "flicker", a: 94, b: 108, seed: 7, strength: 0.45 },
  { kind: "blackout", a: 116, b: 120 },
];

export const KICKS: Kick[] = [
  [72 / FPS, 1.1],   // lightning thunder strike in storm shot
  [121 / FPS, 1.4],  // blood reveal impact kick
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 4 },
  { f: 30, cInf: 9 },
  { f: 60, cInf: 5 },
  { f: 90, cInf: 8 },
  { f: 120, cInf: 11 },
];

const LOOK_TRV: V3 = atAnchor(ANCHORS.TRAVELER_NEAR, 0.42, 1.15, -0.6);
const LOOK_MID: V3 = atAnchor(ANCHORS.TRAVELER_MID, 0.48, 1.12, -0.55);

export const CAMS: Record<number, CamKey[]> = {
  1: [
    {
      f: 0,
      s: (f) => ({
        pos: atAnchor(ANCHORS.TRAVELER_NEAR, 0.2, 1.55, 4.9 * pushK(f, 0, 0.0025)),
        look: atAnchor(ANCHORS.DOOR, 0.15, 1.25, 0.4),
        fov: 40,
      }),
    },
  ],
  2: [
    {
      f: 30,
      s: (f) =>
        handheld(
          {
            pos: atAnchor(ANCHORS.TRAVELER_MID, -0.75, 1.48, 4.3 * pushK(f, 30, 0.003)),
            look: atAnchor(ANCHORS.TRAVELER_MID, 0.15, 1.15, -0.4),
            fov: 40,
          },
          f,
          0.015,
          0.3,
          3,
        ),
    },
  ],
  3: [
    {
      f: 60,
      s: (f) =>
        handheld(
          {
            pos: atAnchor(ANCHORS.TRAVELER_MID, 0.55, 1.50, 4.7 * snapZoom(f, 72, 10, 1.0, 0.90)),
            look: LOOK_MID,
            fov: 41,
          },
          f,
          0.02,
          0.38,
          9,
        ),
    },
  ],
  4: [
    {
      f: 90,
      s: (f) => {
        const u = clamp01((f - 90) / 26);
        return dollyZoom(atAnchor(ANCHORS.TRAVELER_MID, 0.32, 1.48, 4.45), LOOK_MID, 39, 1.0 - 0.22 * u);
      },
    },
  ],
  5: [
    {
      f: 120,
      s: rolled(
        (f) => ({
          pos: atAnchor(ANCHORS.TRAVELER_NEAR, -0.25, 1.38, 4.25 * pushK(f, 120, 0.005, 0.012, 18)),
          look: atAnchor(LOOK_TRV, 0.12, -0.05, -0.35),
          fov: 42,
        }),
        0.075,
      ),
    },
  ],
};
