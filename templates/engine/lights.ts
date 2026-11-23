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
    lit: [0.74, 0.96, 1.38],
    shade: [0.058, 0.080, 0.165],
    lift: [0.016, 0.026, 0.052],
    lambert: 0.44,
    sideK: 0.72,
    term: 0.18,
    charTint: [0.80, 0.90, 1.0],
    charShade: 0.72,
    charGrad: 0.16,
    bodyGrad: 0.32,
    sideTint: [0.40, 0.50, 0.78],
    charGain: 0.74,
    rimCol: [0.62, 0.82, 1.10],
    rimStrength: 0.74,
    blob: [0.14, 0.17, 0.26],
    actorShadow: false,
    top: "#040812",
    hor: "#1f3458",
    skyCurve: [0.02, 0.48, 0.88],
    fog: "#182a48",
    fogNear: 6.5,
    fogFar: 62,
    sunDisc: "#d8e9ff",
    sunCol: "#9bc0ff",
    sunI: 2.2,
    sky: "#1c2f50",
    ground: "#090f1b",
    hemiI: 0.28,
    bias: -0.0005,
    normalBias: 0.028,
  },
  candle: {
    az: 44,
    el: 22,
    lit: [1.34, 0.72, 0.32],
    shade: [0.072, 0.052, 0.098],
    lift: [0.022, 0.014, 0.028],
    lambert: 0.46,
    sideK: 0.68,
    term: 0.19,
    charTint: [1.0, 0.78, 0.52],
    charShade: 0.70,
    charGrad: 0.17,
    bodyGrad: 0.34,
    sideTint: [0.40, 0.32, 0.56],
    charGain: 0.76,
    rimCol: [1.14, 0.62, 0.24],
    rimStrength: 0.76,
    blob: [0.16, 0.11, 0.18],
    actorShadow: false,
    top: "#07040b",
    hor: "#2e1a22",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#1f141c",
    fogNear: 6,
    fogFar: 46,
    sunDisc: "#ffb066",
    sunCol: "#ff9b4a",
    sunI: 2.6,
    sky: "#301d26",
    ground: "#10090f",
    hemiI: 0.26,
    bias: -0.0005,
    normalBias: 0.028,
  },
  storm: {
    az: 102,
    el: 32,
    lit: [0.86, 0.98, 1.16],
    shade: [0.070, 0.096, 0.148],
    lift: [0.020, 0.028, 0.044],
    lambert: 0.40,
    sideK: 0.74,
    term: 0.20,
    charTint: [0.84, 0.92, 1.0],
    charShade: 0.72,
    charGrad: 0.15,
    bodyGrad: 0.30,
    sideTint: [0.44, 0.54, 0.72],
    charGain: 0.74,
    rimCol: [0.80, 0.94, 1.12],
    rimStrength: 0.68,
    blob: [0.15, 0.18, 0.25],
    actorShadow: false,
    top: "#060b12",
    hor: "#24384a",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#1c2d3e",
    fogNear: 6,
    fogFar: 52,
    sunDisc: "#000000",
    sunCol: "#b5cadb",
    sunI: 2.2,
    sky: "#283b4c",
    ground: "#0e141c",
    hemiI: 0.28,
    bias: -0.0004,
    normalBias: 0.024,
  },
  eerie: {
    az: 56,
    el: 44,
    lit: [0.76, 1.24, 1.02],
    shade: [0.056, 0.092, 0.130],
    lift: [0.016, 0.030, 0.036],
    lambert: 0.42,
    sideK: 0.70,
    term: 0.18,
    charTint: [0.80, 1.0, 0.90],
    charShade: 0.70,
    charGrad: 0.16,
    bodyGrad: 0.32,
    sideTint: [0.38, 0.45, 0.68],
    charGain: 0.75,
    rimCol: [0.48, 1.08, 0.86],
    rimStrength: 0.74,
    blob: [0.14, 0.19, 0.22],
    actorShadow: false,
    top: "#040a0e",
    hor: "#183836",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#142e2f",
    fogNear: 6,
    fogFar: 50,
    sunDisc: "#000000",
    sunCol: "#9de4c8",
    sunI: 2.3,
    sky: "#1b3436",
    ground: "#0a1015",
    hemiI: 0.27,
    bias: -0.0004,
    normalBias: 0.024,
  },
  blood: {
    az: 18,
    el: 18,
    lit: [1.56, 0.48, 0.38],
    shade: [0.075, 0.040, 0.088],
    lift: [0.032, 0.012, 0.024],
    lambert: 0.44,
    sideK: 0.68,
    term: 0.16,
    charTint: [1.06, 0.68, 0.62],
    charShade: 0.68,
    charGrad: 0.18,
    bodyGrad: 0.34,
    sideTint: [0.42, 0.24, 0.44],
    charGain: 0.76,
    rimCol: [1.22, 0.36, 0.30],
    rimStrength: 0.88,
    blob: [0.18, 0.09, 0.14],
    actorShadow: false,
    top: "#0a0309",
    hor: "#521622",
    skyCurve: [0.04, 0.48, 0.88],
    fog: "#360e18",
    fogNear: 6,
    fogFar: 50,
    sunDisc: "#ff6654",
    sunCol: "#ff5c4c",
    sunI: 3.2,
    sky: "#34101c",
    ground: "#10060c",
    hemiI: 0.27,
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
