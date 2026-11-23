// HorrorLabV3: Single-source-of-truth SceneManifest (imported directly from manifest.json),
// shots, cameras (with deterministic Whip-Pan), and anchors showcasing 3 radically different horror archetypes:
//   1. ruralFuneralRoom (warmLamp -> Whip-Pan Phone3D -> smooth coldMoon lights-out + POV legs + door foot-shadows + entity)
//   2. hospitalCorridor (fluorescent + handheld Flashlight3D SpotLight cone + dust motes + gaunt entity)
//   3. foggyVillageAlley (duskFog wet asphalt + weathered brick walls + warm sodium streetlamp + turning figure)

import {
  type CamKey,
  type DofBeat,
  type Kick,
  type LightKey,
  type SceneManifest,
  type ScreenBeat,
  type ShotBase,
  type V3,
  type WhipPanSpec,
  clamp01,
  dolly,
  evalCam,
  evalShotMotion,
  povBreath,
  pushK,
  whipPan,
} from "../engine";
import manifestJson from "./manifest.json";

export const FPS = 30;
export const HORROR_LAB_V3_FRAMES = 300;
export const TOTAL = HORROR_LAB_V3_FRAMES;

export const MANIFEST: SceneManifest = manifestJson as unknown as SceneManifest;

export const ANCHORS = {
  // Location 1: Rural Thatched Funeral Room
  POV_SEAT: [0.0, 0.0, 2.08] as V3,
  POV_EYE: [0.0, 1.04, 2.05] as V3,
  NPC_SEAT: [-0.22, 0.0, 0.14] as V3,
  OIL_LAMP_TABLE: [0.68, 0.0, 0.36] as V3,
  COFFIN: [1.72, 0.0, -1.65] as V3,
  ALTAR: [0.48, 0.0, -3.28] as V3,
  DOUBLE_DOOR: [-1.35, 0.0, -3.65] as V3,
  ENTITY_DOOR: [-1.32, 0.0, -2.55] as V3,

  // Location 2: Old Hospital Corridor (frames torn warning poster, broken tiles, hanging cables, looming Body Horror entity & sharp flashlight!)
  HOSP_POV_FEET: [0.0, 0.0, 0.96] as V3,
  HOSP_POV_EYE: [0.0, 1.44, 0.96] as V3,
  HOSP_ENTITY: [0.06, 0.0, -2.55] as V3,

  // Location 3: Foggy Rural Village Alley
  ALLEY_LAMP: [1.75, 0.0, -6.2] as V3,
  ALLEY_FIGURE: [-0.18, 0.0, -3.35] as V3,
};

export const WHIP_PANS: WhipPanSpec[] = [
  {
    f0: 52,
    dur: 7,
    fromLook: [0.04, 1.00, 0.14],
    toLook: [0.96, 0.88, 0.24],
    rollPeak: 0.036,
  },
];

export const SHOTS: ShotBase<LightKey>[] = [
  { id: 1, a: 0, b: 50, light: "warmLamp", scale: "POV", note: "Funeral room talk with Chu Bay + oil lamp" },
  { id: 2, a: 50, b: 95, light: "warmLamp", scale: "POV_PROP", note: "Whip-Pan to oil lamp + glowing Phone3D" },
  // Matches beats[2].lightState.preset="warmLamp" -> smooth blendTo="coldMoon" via world.getLightBlend!
  { id: 3, a: 95, b: 128, light: "warmLamp", scale: "POV_DOWN", note: "Lights out -> POV legs + door crack moonlight + foot shadows" },
  { id: 4, a: 128, b: 160, light: "coldMoon", scale: "POV_CU", note: "Tilt up to tall crooked-neck entity" },
  { id: 5, a: 160, b: 230, light: "fluorescent", scale: "POV", note: "Hospital corridor fluorescent + POV flashlight beam" },
  { id: 6, a: 230, b: TOTAL, light: "duskFog", scale: "MS", note: "Foggy wet village alley + sodium streetlamp" },
];

export const CAMS: Record<number, CamKey[]> = {
  1: [
    {
      f: 0,
      s: (f) =>
        povBreath(
          dolly(ANCHORS.POV_EYE, [0.04, 1.00, 0.14], pushK(f, 0, 0.0014), { fov: 62 }),
          f,
          0.011,
          0.14,
          3,
        ),
    },
  ],
  2: [
    {
      f: 50,
      s: (f) => {
        const base = whipPan(ANCHORS.POV_EYE, WHIP_PANS[0], f, 58);
        const ramp = clamp01((f - 59) / 6);
        return ramp > 0 ? povBreath(base, f, 0.008 * ramp, 0.14, 9) : base;
      },
    },
  ],
  3: [
    {
      f: 95,
      s: (f) =>
        povBreath(
          dolly([-0.68, 0.78, 0.42], [-1.25, 0.14, -3.20], pushK(f, 95, 0.0016), { fov: 68 }),
          f,
          0.009,
          0.16,
          17,
        ),
    },
  ],
  4: [
    {
      f: 128,
      s: (f) =>
        povBreath(
          dolly([-0.94, 1.54, -0.78], [-1.32, 1.72, -2.55], pushK(f, 128, 0.0022), { fov: 46 }),
          f,
          0.011,
          0.16,
          23,
        ),
    },
  ],
  5: [
    {
      f: 160,
      s: (f) =>
        povBreath(
          dolly(ANCHORS.HOSP_POV_EYE, [0.0, 1.34, -2.55], pushK(f, 160, 0.0014), { fov: 58 }),
          f,
          0.011,
          0.14,
          31,
        ),
    },
  ],
  6: [
    {
      f: 230,
      s: (f) =>
        povBreath(
          dolly([-0.08, 1.48, 1.35], [0.06, 1.56, -6.2], pushK(f, 230, 0.0022), { fov: 56 }),
          f,
          0.010,
          0.12,
          41,
        ),
    },
  ],
};

export const OVERLAYS: ScreenBeat[] = [
  { kind: "dipBlack", at: 160, dur: 8, hold: 1 },
  { kind: "dipBlack", at: 230, dur: 8, hold: 1 },
  { kind: "aberration", a: 128, b: 158, strength: 0.35, pulse: true },
];

export const KICKS: Kick[] = [];
// Planned foreground POV prop-raise window (Phone3D lifting smoothly into frame across f59..68)
export const POV_MOTIONS: [number, number][] = [[59, 69]];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5, focus: () => [-0.14, 0.96, 0.14] },
  { f: 50, dur: 6, cInf: 4.5, focus: () => [0.02, 1.0, 1.55] },
  { f: 95, dur: 6, cInf: 2.0 },
  { f: 128, dur: 4, cInf: 1.8, focus: () => [-1.32, 1.72, -2.55] },
  { f: 160, cInf: 1.1, focus: () => [0.04, 1.40, -2.55] },
  { f: 230, cInf: 3.0, focus: () => [-0.18, 1.45, -3.35] },
];

export { evalCam, evalShotMotion };
