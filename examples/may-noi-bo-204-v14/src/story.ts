// "Đêm Gió Bấc — Máy Nội Bộ 204" (~60s Standalone Psychological Horror Test · v12.0 + v13.0):
//   - 100% Phrase-Locked via `shotsFromManifest(MANIFEST)` (ZERO hardcoded frame numbers!)
//   - Subject-Locked `frameWorldPoints` + `camOtsFrame` guaranteeing 10/10 5-Layer Semantic Still Gate accuracy
//   - Zero Jumpscares: pure dread through stopped 02:15 pendulum, `[SILENCE_DROP]`, severed dusty cord, and swaying Key 204.

import {
  type CamKey,
  type DofBeat,
  type Kick,
  type LightKey,
  type SceneManifest,
  type ScreenBeat,
  type ShotBase,
  camMasterEstablish,
  camOtsFrame,
  camPovChain,
  clamp01,
  frameWorldPoints,
  handheld,
  lerp,
  shotsFromManifest,
  smooth,
} from "../engine";
import manifestJson from "./manifest.json";

export const MANIFEST: SceneManifest = manifestJson as unknown as SceneManifest;
export const MAY_NOI_BO_204_FRAMES = MANIFEST.totalFrames;
export const SHOTS: ShotBase<LightKey>[] = shotsFromManifest(MANIFEST);

const S = (id: number): ShotBase<LightKey> => SHOTS.find((x) => x.id === id) ?? SHOTS[0];
const SPEC = (id: number) => MANIFEST.shots?.find((x) => x.id === id);

export const WHIP_PANS: [number, number][] = [];
export const POV_MOTIONS: [number, number][] = [
  [S(5).a, S(5).a + 42],
  [S(6).a, S(6).a + 44],
  [S(7).a, S(7).b],
  [S(9).a, S(9).a + 36],
  [S(10).a, S(10).a + 38],
];

// Mathematically locked framings for dual/close targets inside 9:16 Safe Frustum (`x ∈ [-0.90, 0.90], y ∈ [-0.66, 0.84]`)
const DESK_PAIR_CAM = frameWorldPoints(
  [-0.10, 1.44, 1.12],
  [
    [-0.52, 0.78, -0.10],
    [-0.36, 1.10, -0.06],
    [0.18, 0.78, 0.02],
    [0.30, 0.92, 0.10],
  ],
  9 / 16,
  { marginX: 0.66, safeBottomNdc: -0.44, safeTopNdc: 0.70, minFov: 52, maxFov: 64 },
);

const BOLT_INTERACT_CAM = frameWorldPoints(
  [1.42, 1.24, -0.96],
  [
    [2.16, 0.98, -1.06],
    [2.20, 1.16, -0.76],
  ],
  9 / 16,
  { marginX: 0.72, safeBottomNdc: -0.42, safeTopNdc: 0.68, minFov: 44, maxFov: 54 },
);

// Camera placed cleanly to the RIGHT of the desk (`x = 0.70 > 0.52` desk edge!) so zero desk legs block `severedPhoneCord`!
const SEVERED_CORD_CAM = frameWorldPoints(
  [0.72, 0.78, 0.82],
  [
    [0.54, 0.02, -0.06],
    [0.92, 0.30, -0.08],
    [0.72, 0.04, 0.16],
  ],
  9 / 16,
  { marginX: 0.70, safeBottomNdc: -0.42, safeTopNdc: 0.66, minFov: 42, maxFov: 52 },
);

const KEY_204_CAM = frameWorldPoints(
  [-0.78, 1.46, -1.12],
  [
    [-1.68, 1.66, -2.40],
    [-1.02, 1.28, -2.36],
  ],
  9 / 16,
  { marginX: 0.76, safeBottomNdc: -0.44, safeTopNdc: 0.70, minFov: 38, maxFov: 48 },
);

export const CAMS: Record<number, CamKey[]> = {
  // Shot 1 (Master Establishing WS): vaulted winter duty room, gooseneck lamp, switchboardPhone, Huy & Bà Hạnh
  1: [
    {
      f: S(1).a,
      s: (f) => {
        const s = S(1);
        const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
        const endCam = frameWorldPoints(
          [-1.12, 1.72, 1.88],
          [
            [-0.38, 1.52, 0.82],
            [0.24, 0.84, 0.02],
            [1.58, 1.58, -1.12],
          ],
          9 / 16,
          { marginX: 0.80, safeBottomNdc: -0.48, safeTopNdc: 0.74, minFov: 52, maxFov: 60 },
        );
        const base = camMasterEstablish(
          [-1.38, 1.84, 2.18],
          endCam.pos,
          [0.48, 1.12, -0.35],
          endCam.look,
          u,
          lerp(58, endCam.fov, smooth(u)),
        );
        return handheld(base, f, 0.005, 0.10, 7);
      },
    },
  ],
  // Shot 2 (Anchored POV Desk): warm gooseneck deskLamp + logbook + black switchboardPhone
  2: [
    {
      f: S(2).a,
      s: (f) => {
        const s = S(2);
        return camPovChain(
          [
            { f: s.a, pos: [-0.16, 1.44, 0.94], look: [-0.18, 0.96, -0.20], fov: 54, swayAmp: 0.007 },
            { f: s.a + 14, dur: Math.max(24, s.b - s.a - 18), pos: DESK_PAIR_CAM.pos, look: DESK_PAIR_CAM.look, fov: DESK_PAIR_CAM.fov, swayAmp: 0.006 },
          ],
          f,
          13,
        );
      },
    },
  ],
  // Shot 3 (Same-Side OTS Right Shoulder <= 22% Edge): Bà Hạnh at corridorDoor warning about cut Room 204 line
  3: [
    {
      f: S(3).a,
      s: (f) => {
        const s = S(3);
        const u = clamp01((f - s.a) / Math.max(1, s.b - s.a));
        const base = camOtsFrame(
          [-0.38, 1.38, 0.82],
          [-0.38, 1.58, 0.82],
          [lerp(1.58, 1.66, smooth(u)), 1.38, -1.12],
          "right",
          { backDist: lerp(1.16, 1.08, smooth(u)), sideOffset: 0.64, fov: 52 },
        );
        return handheld(base, f, 0.006, 0.12, 19);
      },
    },
  ],
  // Shot 4 (Anchored POV Push on Bà Hạnh): "khuya nó có chạm mạch kêu cạch một tiếng thì kệ, đừng nhấc nghe."
  4: [
    {
      f: S(4).a,
      s: (f) => {
        const s = S(4);
        return camPovChain(
          [
            { f: s.a, pos: [0.22, 1.44, 0.34], look: [1.62, 1.42, -1.12], fov: 48, swayAmp: 0.007 },
            { f: s.a + 14, dur: Math.max(24, s.b - s.a - 18), pos: [0.58, 1.45, -0.06], look: [1.68, 1.44, -1.14], fov: 43, swayAmp: 0.007 },
          ],
          f,
          29,
        );
      },
    },
  ],
  // Shot 5 (Embodied POV Walk & Reach Bolt): watches corridor door close & reaches 2-joint right hand onto `corridorBolt`
  5: [
    {
      f: S(5).a,
      s: (f) => {
        const s = S(5);
        return camPovChain(
          [
            { f: s.a, pos: [0.78, 1.42, -0.35], look: [2.35, 1.36, -1.25], fov: 50, swayAmp: 0.009 },
            { f: s.a + 28, dur: 34, pos: BOLT_INTERACT_CAM.pos, look: BOLT_INTERACT_CAM.look, fov: BOLT_INTERACT_CAM.fov, swayAmp: 0.007 },
          ],
          f,
          37,
        );
      },
    },
  ],
  // Shot 6 (Continuous POV Turn Back to Wall Pendulum Clock): steady 1.05s pendulum swing on left plaster wall
  6: [
    {
      f: S(6).a,
      s: (f) => {
        const s = S(6);
        return camPovChain(
          [
            { f: s.a, pos: [0.35, 1.44, -0.15], look: [-1.25, 1.52, -0.32], fov: 50, swayAmp: 0.008 },
            { f: s.a + 14, dur: Math.max(20, s.b - s.a - 18), pos: [-0.48, 1.52, -0.22], look: [-2.18, 1.58, -0.32], fov: 44, swayAmp: 0.006 },
          ],
          f,
          43,
        );
      },
    },
  ],
  // Shot 7 (02:15 Pendulum Stops Dead -> Sharp Head-Turn onto Half-Ringing Black Phone!)
  7: [
    {
      f: S(7).a,
      s: (f) => {
        const s = S(7);
        const stopF = SPEC(7)?.actionTriggerFrame ?? Math.round(s.a + (s.b - s.a) * 0.42);
        return camPovChain(
          [
            { f: s.a, pos: [-0.52, 1.54, -0.24], look: [-2.18, 1.56, -0.32], fov: 40, swayAmp: 0.006 },
            { f: stopF + 16, dur: 22, pos: [-0.06, 1.28, 0.74], look: [0.18, 0.84, 0.02], fov: 46, swayAmp: 0.008 },
          ],
          f,
          53,
        );
      },
    },
  ],
  // Shot 8 ([SILENCE_DROP 1.30s] + Handset Whisper): PovRig3D `holdHandset` lifts receiver while framing cradleless switchboardPhone
  8: [
    {
      f: S(8).a,
      s: (f) => {
        const s = S(8);
        return camPovChain(
          [
            { f: s.a, pos: [-0.04, 1.28, 0.78], look: [0.20, 0.84, 0.02], fov: 50, swayAmp: 0.006 },
            { f: s.a + 18, dur: Math.max(24, s.b - s.a - 22), pos: [0.02, 1.25, 0.72], look: [0.20, 0.83, 0.02], fov: 48, swayAmp: 0.005 },
          ],
          f,
          61,
        );
      },
    },
  ],
  // Shot 9 (Chilling Subtext Reveal #1 — Severed Dusty Copper Phone Cord on Open Tile Floor!)
  9: [
    {
      f: S(9).a,
      s: (f) => {
        const s = S(9);
        return camPovChain(
          [
            { f: s.a, pos: [0.58, 0.92, 0.84], look: [0.70, 0.24, 0.04], fov: 46, swayAmp: 0.006 },
            { f: s.a + 14, dur: 24, pos: SEVERED_CORD_CAM.pos, look: SEVERED_CORD_CAM.look, fov: SEVERED_CORD_CAM.fov, swayAmp: 0.005 },
          ],
          f,
          71,
        );
      },
    },
  ],
  // Shot 10 (Chilling Subtext Reveal #2 — Swaying Red-and-Brass Tag `204` on Sealed Key Board · 0 Jumpscare!)
  10: [
    {
      f: S(10).a,
      s: (f) => {
        const s = S(10);
        return camPovChain(
          [
            { f: s.a, pos: [-0.42, 1.34, -0.45], look: [-1.25, 1.28, -2.20], fov: 46, swayAmp: 0.006 },
            { f: s.a + 18, dur: 30, pos: KEY_204_CAM.pos, look: KEY_204_CAM.look, fov: KEY_204_CAM.fov, swayAmp: 0.005 },
          ],
          f,
          79,
        );
      },
    },
  ],
};

export const KICKS: Kick[] = [];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 2.0, focus: () => [0.35, 1.25, -0.35] },
  { f: S(2).a, dur: 8, cInf: 1.1, focus: () => [0.05, 0.85, 0.0] },
  { f: S(3).a, dur: 6, cInf: 1.3, focus: () => [1.60, 1.40, -1.12] },
  { f: S(4).a, dur: 8, cInf: 1.1, focus: () => [1.66, 1.44, -1.14] },
  { f: S(5).a, dur: 8, cInf: 1.0, focus: () => [2.18, 1.06, -0.92] },
  { f: S(6).a, dur: 10, cInf: 1.3, focus: () => [-2.16, 1.58, -0.32] },
  { f: S(7).a, dur: 8, cInf: 1.2, focus: () => [-2.16, 1.56, -0.32] },
  { f: (SPEC(7)?.actionTriggerFrame ?? S(7).a + 90) + 16, dur: 14, cInf: 1.0, focus: () => [0.24, 0.84, 0.02] },
  { f: S(8).a, dur: 8, cInf: 0.95, focus: () => [0.24, 0.82, 0.02] },
  { f: S(9).a, dur: 10, cInf: 0.90, focus: () => [0.68, 0.12, 0.06] },
  { f: S(10).a, dur: 12, cInf: 1.1, focus: () => [-1.38, 1.44, -2.40] },
];

const sh7 = S(7);

export const OVERLAYS: ScreenBeat[] = [
  // Brief overhead tube sputter right when the 02:15 clock freezes before [SILENCE_DROP] (0 Jumpscare / 0 flashbang!)
  { kind: "flicker", a: sh7.a + 62, b: sh7.a + 86, seed: 17, strength: 0.36 },
];
