// Dedicated Horror Engine v2 lighting & look presets ("Gothic Ink-Noir x Shadow-Depth").
// Five calibrated atmospheric presets: night, candle, storm, eerie, blood.
// Designed for 3-Layer Value Separation + local real PointLight illumination (lamps, lanterns, fires).

import type { LightKey, V3 } from "./camera";

type C3 = [number, number, number];

export type LocalLight = {
  pos: V3;
  color: C3; // linear RGB (can exceed 1.0 for dramatic warm lantern pools)
  radius: number; // world-space attenuation radius (m)
};

export type LightPreset = {
  az: number;
  el: number;
  lit: C3;
  shade: C3;
  lift: C3;
  lambert: number;
  sideK: number;
  term: number;
  charTint: C3;
  charShade: number;
  charGrad: number;
  bodyGrad: number;
  sideTint: C3;
  charGain: number;
  rimCol: C3;
  rimStrength: number;
  blob: C3;
  actorShadow: boolean;
  top: string;
  hor: string;
  skyCurve: C3;
  fog: string;
  fogNear: number;
  fogFar: number;
  sunDisc: string;
  sunCol: string;
  sunI: number;
  sky: string;
  ground: string;
  hemiI: number;
  bias: number;
  normalBias: number;
};

export const LIGHTS: Record<LightKey, LightPreset> = {
  night: {
    az: 28,
    el: 24,
    lit: [0.64, 0.86, 1.28],
    shade: [0.035, 0.052, 0.115],
    lift: [0.008, 0.015, 0.036],
    lambert: 0.46,
    sideK: 0.66,
    term: 0.18,
    charTint: [0.76, 0.87, 1.0],
    charShade: 0.62,
    charGrad: 0.18,
    bodyGrad: 0.36,
    sideTint: [0.34, 0.44, 0.74],
    charGain: 0.66,
    rimCol: [0.54, 0.76, 1.05],
    rimStrength: 0.72,
    blob: [0.10, 0.13, 0.22],
    actorShadow: false,
    top: "#03060d",
    hor: "#182b4a",
    skyCurve: [0.02, 0.48, 0.88],
    fog: "#13223c",
    fogNear: 5.5,
    fogFar: 52,
    sunDisc: "#d8e9ff",
    sunCol: "#9bc0ff",
    sunI: 2.1,
    sky: "#182844",
    ground: "#070b14",
    hemiI: 0.22,
    bias: -0.0005,
    normalBias: 0.028,
  },
  candle: {
    az: 44,
    el: 20,
    lit: [1.24, 0.64, 0.26],
    shade: [0.045, 0.032, 0.068],
    lift: [0.012, 0.008, 0.018],
    lambert: 0.48,
    sideK: 0.62,
    term: 0.19,
    charTint: [1.0, 0.76, 0.48],
    charShade: 0.60,
    charGrad: 0.19,
    bodyGrad: 0.38,
    sideTint: [0.34, 0.26, 0.50],
    charGain: 0.68,
    rimCol: [1.10, 0.58, 0.20],
    rimStrength: 0.76,
    blob: [0.12, 0.08, 0.14],
    actorShadow: false,
    top: "#050308",
    hor: "#26161c",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#180f16",
    fogNear: 5,
    fogFar: 38,
    sunDisc: "#ffb066",
    sunCol: "#ff9b4a",
    sunI: 2.5,
    sky: "#281920",
    ground: "#0c070b",
    hemiI: 0.20,
    bias: -0.0005,
    normalBias: 0.028,
  },
  storm: {
    az: 102,
    el: 32,
    lit: [0.78, 0.90, 1.08],
    shade: [0.048, 0.070, 0.112],
    lift: [0.012, 0.019, 0.030],
    lambert: 0.42,
    sideK: 0.68,
    term: 0.20,
    charTint: [0.80, 0.90, 1.0],
    charShade: 0.64,
    charGrad: 0.16,
    bodyGrad: 0.34,
    sideTint: [0.38, 0.48, 0.66],
    charGain: 0.66,
    rimCol: [0.76, 0.90, 1.08],
    rimStrength: 0.66,
    blob: [0.11, 0.14, 0.20],
    actorShadow: false,
    top: "#05090f",
    hor: "#203242",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#182736",
    fogNear: 5,
    fogFar: 44,
    sunDisc: "#000000",
    sunCol: "#b5cadb",
    sunI: 2.0,
    sky: "#243544",
    ground: "#0b1016",
    hemiI: 0.24,
    bias: -0.0004,
    normalBias: 0.024,
  },
  eerie: {
    az: 56,
    el: 44,
    lit: [0.66, 1.12, 0.92],
    shade: [0.036, 0.062, 0.095],
    lift: [0.009, 0.020, 0.024],
    lambert: 0.44,
    sideK: 0.64,
    term: 0.18,
    charTint: [0.76, 1.0, 0.88],
    charShade: 0.62,
    charGrad: 0.18,
    bodyGrad: 0.36,
    sideTint: [0.32, 0.38, 0.62],
    charGain: 0.68,
    rimCol: [0.42, 1.02, 0.80],
    rimStrength: 0.72,
    blob: [0.10, 0.15, 0.18],
    actorShadow: false,
    top: "#03080b",
    hor: "#142e2d",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#102526",
    fogNear: 5,
    fogFar: 42,
    sunDisc: "#000000",
    sunCol: "#9de4c8",
    sunI: 2.2,
    sky: "#172d2e",
    ground: "#080d11",
    hemiI: 0.22,
    bias: -0.0004,
    normalBias: 0.024,
  },
  blood: {
    az: 18,
    el: 18,
    lit: [1.46, 0.40, 0.32],
    shade: [0.045, 0.024, 0.058],
    lift: [0.020, 0.006, 0.014],
    lambert: 0.46,
    sideK: 0.62,
    term: 0.16,
    charTint: [1.04, 0.62, 0.56],
    charShade: 0.58,
    charGrad: 0.20,
    bodyGrad: 0.38,
    sideTint: [0.36, 0.18, 0.38],
    charGain: 0.70,
    rimCol: [1.18, 0.30, 0.24],
    rimStrength: 0.90,
    blob: [0.14, 0.06, 0.10],
    actorShadow: false,
    top: "#070206",
    hor: "#46111b",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#2c0a12",
    fogNear: 5,
    fogFar: 44,
    sunDisc: "#ff6654",
    sunCol: "#ff5c4c",
    sunI: 3.1,
    sky: "#2c0d16",
    ground: "#0b0408",
    hemiI: 0.21,
    bias: -0.0005,
    normalBias: 0.028,
  },
};

/** World-only atmospheric look per preset (sky stops, water palette, cloud stratus palette, bounce, saturation). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;
  sat: number;
  cloud: { lit: string; mid: string; shade: string };
};

export const LOOK: Record<LightKey, WorldLook> = {
  night: {
    sky: { c: ["#233b60", "#192c4a", "#111e38", "#0a1326", "#050914"], e: [0, 5, 14, 28, 50] },
    water: { near: "#0d1c30", mid: "#132945", far: "#1b3458", crest: "#4c72a2", trough: "#07101c", glint: "#cfe2ff", shade: [0.30, 0.38, 0.58] },
    cloud: { lit: "#3b547e", mid: "#243554", shade: "#111b2e" },
    bounce: [0.012, 0.024, 0.055],
    sat: 0.74,
  },
  candle: {
    sky: { c: ["#362228", "#261720", "#190f1a", "#100a14", "#08050d"], e: [0, 5, 14, 28, 50] },
    water: { near: "#181014", mid: "#241618", far: "#301d1d", crest: "#845036", trough: "#0c070a", glint: "#ffc582", shade: [0.32, 0.26, 0.40] },
    cloud: { lit: "#5c3f38", mid: "#3a262a", shade: "#1c131c" },
    bounce: [0.045, 0.022, 0.006],
    sat: 0.82,
  },
  storm: {
    sky: { c: ["#304456", "#243544", "#192632", "#111b24", "#090f16"], e: [0, 5, 14, 28, 50] },
    water: { near: "#14202a", mid: "#1c2c38", far: "#263a4a", crest: "#627c92", trough: "#0a1218", glint: "#c8dff2", shade: [0.36, 0.42, 0.50] },
    cloud: { lit: "#566c7e", mid: "#354656", shade: "#18232e" },
    bounce: [0.012, 0.022, 0.032],
    sat: 0.64,
  },
  eerie: {
    sky: { c: ["#22413e", "#183132", "#112328", "#0b161d", "#070c12"], e: [0, 5, 14, 28, 50] },
    water: { near: "#0e2222", mid: "#142f2e", far: "#1d3f3b", crest: "#50867a", trough: "#071314", glint: "#a8f0d4", shade: [0.32, 0.42, 0.46] },
    cloud: { lit: "#446a64", mid: "#2a4544", shade: "#142228" },
    bounce: [0.006, 0.030, 0.024],
    sat: 0.72,
  },
  blood: {
    sky: { c: ["#5e1b26", "#441420", "#2d0d1a", "#1c0814", "#0d040b"], e: [0, 5, 14, 28, 50] },
    water: { near: "#220910", mid: "#340e17", far: "#501822", crest: "#9c323a", trough: "#100408", glint: "#ff8070", shade: [0.36, 0.20, 0.30] },
    cloud: { lit: "#782834", mid: "#4c1a25", shade: "#220c16" },
    bounce: [0.048, 0.010, 0.012],
    sat: 0.86,
  },
};
