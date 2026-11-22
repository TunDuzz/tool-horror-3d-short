// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
import type { LightKey } from "./camera";

type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  charGain?: number; rimCol?: C3; rimStrength?: number;                              // optional card brightness / rim overrides
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export const LIGHTS: Record<LightKey, LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 0.68, 0.24], shade: [0.15, 0.15, 0.3], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  night: {
    az: 22, el: 24,
    lit: [0.68, 0.86, 1.25], shade: [0.09, 0.12, 0.22], lift: [0.022, 0.032, 0.065], lambert: 0.38, sideK: 0.80, term: 0.14,
    charTint: [0.76, 0.86, 1.0], charShade: 0.68, charGrad: 0.12, bodyGrad: 0.28, sideTint: [0.55, 0.65, 0.92],
    charGain: 0.64, rimCol: [0.42, 0.62, 0.96], rimStrength: 0.45,
    blob: [0.22, 0.25, 0.36], actorShadow: true,
    top: "#070c18", hor: "#1d3152", skyCurve: [0.02, 0.5, 0.9], fog: "#1a2b48", fogNear: 12, fogFar: 125, sunDisc: "#c8dcff",
    sunCol: "#9bc0ff", sunI: 2.0, sky: "#223456", ground: "#0c1220", hemiI: 0.32,
    bias: -0.0004, normalBias: 0.022,
  },
  candle: {
    az: 48, el: 18,
    lit: [1.32, 0.66, 0.26], shade: [0.12, 0.085, 0.15], lift: [0.032, 0.022, 0.036], lambert: 0.42, sideK: 0.76, term: 0.16,
    charTint: [1.0, 0.72, 0.46], charShade: 0.64, charGrad: 0.14, bodyGrad: 0.30, sideTint: [0.58, 0.48, 0.72],
    charGain: 0.68, rimCol: [0.95, 0.46, 0.14], rimStrength: 0.50,
    blob: [0.24, 0.18, 0.24], actorShadow: true,
    top: "#0b0812", hor: "#2d1d22", skyCurve: [0.05, 0.5, 0.9], fog: "#1d141a", fogNear: 8, fogFar: 65, sunDisc: "#ffb066",
    sunCol: "#ff9b4a", sunI: 2.6, sky: "#34222a", ground: "#140e12", hemiI: 0.28,
    bias: -0.00045, normalBias: 0.022,
  },
  storm: {
    az: 105, el: 34,
    lit: [0.80, 0.90, 1.02], shade: [0.11, 0.15, 0.20], lift: [0.026, 0.036, 0.046], lambert: 0.35, sideK: 0.82, term: 0.22,
    charTint: [0.82, 0.90, 0.96], charShade: 0.72, charGrad: 0.11, bodyGrad: 0.25, sideTint: [0.60, 0.70, 0.82],
    charGain: 0.66, rimCol: [0.62, 0.76, 0.92], rimStrength: 0.32,
    blob: [0.24, 0.28, 0.34], actorShadow: false,
    top: "#0d141c", hor: "#283846", skyCurve: [0.04, 0.5, 0.9], fog: "#233340", fogNear: 10, fogFar: 95, sunDisc: "#000000",
    sunCol: "#adc2d4", sunI: 1.9, sky: "#334656", ground: "#151d24", hemiI: 0.38,
    bias: -0.00035, normalBias: 0.02,
  },
  eerie: {
    az: 60, el: 52,
    lit: [0.76, 1.08, 0.92], shade: [0.10, 0.12, 0.19], lift: [0.020, 0.034, 0.038], lambert: 0.36, sideK: 0.80, term: 0.18,
    charTint: [0.80, 0.98, 0.88], charShade: 0.70, charGrad: 0.12, bodyGrad: 0.26, sideTint: [0.58, 0.54, 0.82],
    charGain: 0.68, rimCol: [0.36, 0.84, 0.66], rimStrength: 0.38,
    blob: [0.22, 0.26, 0.32], actorShadow: true,
    top: "#0a1116", hor: "#1d3533", skyCurve: [0.04, 0.5, 0.9], fog: "#162a2a", fogNear: 9, fogFar: 85, sunDisc: "#000000",
    sunCol: "#9de0c4", sunI: 2.1, sky: "#223b3b", ground: "#11161c", hemiI: 0.34,
    bias: -0.00035, normalBias: 0.02,
  },
  blood: {
    az: 12, el: 14,
    lit: [1.35, 0.32, 0.26], shade: [0.09, 0.06, 0.11], lift: [0.036, 0.012, 0.024], lambert: 0.40, sideK: 0.78, term: 0.10,
    charTint: [1.0, 0.56, 0.52], charShade: 0.60, charGrad: 0.15, bodyGrad: 0.30, sideTint: [0.55, 0.32, 0.58],
    charGain: 0.62, rimCol: [0.96, 0.20, 0.18], rimStrength: 0.65,
    blob: [0.26, 0.14, 0.20], actorShadow: true,
    top: "#10060c", hor: "#4a141c", skyCurve: [0.04, 0.5, 0.9], fog: "#330e15", fogNear: 10, fogFar: 90, sunDisc: "#ff5c4a",
    sunCol: "#ff4e42", sunI: 3.2, sky: "#3b1420", ground: "#14080e", hemiI: 0.30,
    bias: -0.0005, normalBias: 0.025,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<LightKey, WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  night: {
    sky: { c: ["#1e3354", "#172744", "#101c34", "#0a1224", "#060a14"], e: [0, 5, 14, 28, 50] },
    water: { near: "#102138", mid: "#142946", far: "#1a3052", crest: "#3f5f88", trough: "#081220", glint: "#b8d2ff", shade: [0.35, 0.42, 0.64] },
    cloud: { lit: "#344b72", mid: "#223252", shade: "#121c30" },
    bounce: [0.01, 0.02, 0.05],
    sat: 0.78,
  },
  candle: {
    sky: { c: ["#322024", "#24161e", "#180f18", "#100a14", "#09060e"], e: [0, 5, 14, 28, 50] },
    water: { near: "#1c1214", mid: "#281818", far: "#331e1c", crest: "#7c4c34", trough: "#0e080a", glint: "#ffbe7a", shade: [0.36, 0.30, 0.44] },
    cloud: { lit: "#5a3d36", mid: "#3c282b", shade: "#1f151e" },
    bounce: [0.04, 0.02, 0.005],
    sat: 0.85,
  },
  storm: {
    sky: { c: ["#2b3d4c", "#22313e", "#192530", "#121b24", "#0b1118"], e: [0, 5, 14, 28, 50] },
    water: { near: "#18242e", mid: "#1e2e3a", far: "#253846", crest: "#566e80", trough: "#0d151c", glint: "#b8cee0", shade: [0.40, 0.46, 0.54] },
    cloud: { lit: "#4d6172", mid: "#334352", shade: "#1a2530" },
    bounce: [0.01, 0.02, 0.03],
    sat: 0.68,
  },
  eerie: {
    sky: { c: ["#1e3836", "#162b2c", "#112025", "#0c151c", "#080d14"], e: [0, 5, 14, 28, 50] },
    water: { near: "#102424", mid: "#152f2e", far: "#1b3a36", crest: "#46766c", trough: "#091516", glint: "#9de6ca", shade: [0.36, 0.46, 0.50] },
    cloud: { lit: "#3f625c", mid: "#284241", shade: "#16232a" },
    bounce: [0.005, 0.025, 0.02],
    sat: 0.74,
  },
  blood: {
    sky: { c: ["#541820", "#3d121c", "#290c18", "#1a0814", "#0e050c"], e: [0, 5, 14, 28, 50] },
    water: { near: "#240a10", mid: "#340e16", far: "#4b161e", crest: "#8c2c32", trough: "#120408", glint: "#ff7262", shade: [0.40, 0.24, 0.34] },
    cloud: { lit: "#70242e", mid: "#471822", shade: "#220c16" },
    bounce: [0.04, 0.008, 0.01],
    sat: 0.88,
  },
};
