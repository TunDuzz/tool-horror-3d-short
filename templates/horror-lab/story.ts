// Horror Engine v2 Look-Dev Rig: Gothic Ink-Noir x Shadow-Depth across all 5 horror lighting presets.
// Tests distinct shot scales (WS / OTS / LOW / MCU / Dutch CU), foreground silhouettes, real PointLights, and 3D lightning.

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
  camOTS,
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
  WINDOW: [-2.1, 1.62, -2.1] as V3,
  TRAVELER_NEAR: [-0.62, 0, 1.55] as V3,
  TRAVELER_MID: [-0.55, 0, 0.45] as V3,
  GHOST_FAR: [0.35, 0, -2.05] as V3,
  GHOST_NEAR: [0.32, 0, -0.55] as V3,
  LANTERN_POST: [1.65, 0, 0.25] as V3,
};

export type HorrorShot = ShotBase<HorrorLightKey>;

export const SHOTS: HorrorShot[] = [
  { id: 1, a: 0, b: 30, light: "night", scale: "WS", note: "Moonlit wide establishing through foreground gnarled branches" },
  { id: 2, a: 30, b: 60, light: "candle", scale: "OTS", note: "Over-the-shoulder candle lantern glow toward dark porch" },
  { id: 3, a: 60, b: 90, light: "storm", scale: "LOW", note: "Low-angle storm reveal with real 3D lightning flash" },
  { id: 4, a: 90, b: 120, light: "eerie", scale: "MCU", note: "Side profile vertigo dolly-zoom under eerie jade glow" },
  { id: 5, a: 120, b: TOTAL, light: "blood", scale: "CU", note: "Tight Dutch-tilt blood climax with lunging specter" },
];

export const XFADE: Record<number, number> = {};

export const OVERLAYS: ScreenBeat[] = [
  { kind: "lightning", f: 72, peak: 0.90 },
  { kind: "flicker", a: 94, b: 108, seed: 7, strength: 0.42 },
  { kind: "blackout", a: 116, b: 120 },
  { kind: "vignettePulse", a: 120, b: TOTAL, freq: 2.2, strength: 0.42 },
  { kind: "aberration", a: 72, b: TOTAL, strength: 0.85, pulse: true },
];

export const KICKS: Kick[] = [
  [72 / FPS, 1.1],
  [121 / FPS, 1.4],
];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5 },
  { f: 30, cInf: 7.5 },
  { f: 60, cInf: 5.0 },
  { f: 90, cInf: 8.5 },
  { f: 120, cInf: 10.5 },
];

export const CAMS: Record<number, CamKey[]> = {
  1: [
    {
      f: 0,
      s: (f) => ({
        pos: atAnchor(ANCHORS.TRAVELER_NEAR, 0.35, 1.52, 5.2 * pushK(f, 0, 0.0028)),
        look: atAnchor(ANCHORS.DOOR, 0.1, 1.25, 0.4),
        fov: 40,
      }),
    },
  ],
  2: [
    {
      f: 30,
      s: (f) => {
        const u = clamp01((f - 30) / 30);
        return handheld(
          camOTS(ANCHORS.TRAVELER_MID, [0, 1.25, -2.0], 1, 2.55 - 0.15 * u, 0.62, 1.62, 42),
          f,
          0.014,
          0.32,
          2,
        );
      },
    },
  ],
  3: [
    {
      f: 60,
      s: (f) =>
        handheld(
          {
            pos: atAnchor(ANCHORS.TRAVELER_MID, -1.65, 0.78, 3.85 * snapZoom(f, 72, 10, 1.0, 0.88)),
            look: atAnchor(ANCHORS.GHOST_FAR, -0.15, 1.32, 0.6),
            fov: 42,
          },
          f,
          0.022,
          0.44,
          3,
        ),
    },
  ],
  4: [
    {
      f: 90,
      s: (f) => {
        const u = clamp01((f - 90) / 30);
        return handheld(
          dollyZoom(atAnchor(ANCHORS.TRAVELER_MID, 2.35, 1.42, 2.65), atAnchor(ANCHORS.TRAVELER_MID, 0.0, 1.35, -0.15), 37, 1.0 - 0.18 * u),
          f,
          0.016,
          0.34,
          4,
        );
      },
    },
  ],
  5: [
    {
      f: 120,
      s: rolled(
        (f) =>
          handheld(
            {
              pos: atAnchor(ANCHORS.GHOST_NEAR, -0.55, 1.38, 3.35 * pushK(f, 120, 0.0022)),
              look: atAnchor(ANCHORS.GHOST_NEAR, -0.25, 1.24, 0.25),
              fov: 40,
            },
            f,
            0.026,
            0.50,
            5,
          ),
        0.085,
      ),
    },
  ],
};
