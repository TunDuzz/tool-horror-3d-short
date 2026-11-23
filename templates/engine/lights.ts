// Horror Engine v3: 5 physical story-driven lighting presets ("3D Stylized Dark-Horror POV").
// Presets: warmLamp, coldMoon, fluorescent, duskFog, flashlight — zero fake crimson blood washes.
// Supports smooth per-frame preset interpolation (e.g. warmLamp -> coldMoon when lamps die).

import { clamp01, lerp, type LightKey, type V3 } from "./camera";

export type C3 = [number, number, number];

export type LocalLight = {
  pos: V3;
  color: C3; // linear RGB (can exceed 1.0 for warm lamps / phone screen bloom)
  radius: number; // world-space attenuation radius (m)
};

export type SpotLightCfg = {
  pos: V3;
  target: V3;
  color: C3;
  distance: number;
  angleDeg: number; // outer half-cone angle in degrees
  penumbra: number; // 0..1 soft edge fraction
};

export type LightPreset = {
  az: number;
  el: number;
  lit: C3;
  shade: C3;
  lift: C3;
  lambert: number;
  sideK: number;
  wrapLo: number;
  wrapHi: number;
  rimCol: C3;
  rimStrength: number;
  top: string;
  hor: string;
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
  // Practical oil-lamp / candle interior: warm amber lit surfaces against velvet plum-indigo shadows (matches videomau Hồi 1-2)
  warmLamp: {
    az: 38,
    el: 34,
    lit: [0.68, 0.50, 0.36],
    shade: [0.068, 0.052, 0.072],
    lift: [0.018, 0.014, 0.022],
    lambert: 0.65,
    sideK: 0.78,
    wrapLo: -0.18,
    wrapHi: 0.72,
    rimCol: [0.95, 0.64, 0.34],
    rimStrength: 0.34,
    top: "#08060c",
    hor: "#241b24",
    fog: "#1d151d",
    fogNear: 7.5,
    fogFar: 44,
    sunDisc: "#000000",
    sunCol: "#ffb878",
    sunI: 1.35,
    sky: "#2c222a",
    ground: "#120d13",
    hemiI: 0.30,
    bias: -0.0005,
    normalBias: 0.024,
  },
  // Post-blackout / late-night desaturated moonlight slate-blue (matches videomau Hồi 3 lights-out)
  coldMoon: {
    az: 24,
    el: 26,
    lit: [0.46, 0.56, 0.76],
    shade: [0.044, 0.050, 0.076],
    lift: [0.014, 0.018, 0.028],
    lambert: 0.68,
    sideK: 0.74,
    wrapLo: -0.16,
    wrapHi: 0.74,
    rimCol: [0.58, 0.72, 0.96],
    rimStrength: 0.44,
    top: "#05070e",
    hor: "#1b2234",
    fog: "#161b29",
    fogNear: 6.5,
    fogFar: 46,
    sunDisc: "#d8e6ff",
    sunCol: "#8ca8dc",
    sunI: 1.45,
    sky: "#1c2436",
    ground: "#090c14",
    hemiI: 0.25,
    bias: -0.0005,
    normalBias: 0.024,
  },
  // Institutional corridor / hospital / apartment hall with cold pale green-white fluorescent glow
  fluorescent: {
    az: 14,
    el: 64,
    lit: [0.70, 0.84, 0.78],
    shade: [0.056, 0.076, 0.082],
    lift: [0.016, 0.022, 0.024],
    lambert: 0.62,
    sideK: 0.80,
    wrapLo: -0.20,
    wrapHi: 0.70,
    rimCol: [0.68, 0.92, 0.84],
    rimStrength: 0.30,
    top: "#060b0d",
    hor: "#18282a",
    fog: "#142224",
    fogNear: 6.0,
    fogFar: 38,
    sunDisc: "#000000",
    sunCol: "#c2e4d8",
    sunI: 1.4,
    sky: "#1d2f30",
    ground: "#0b1214",
    hemiI: 0.30,
    bias: -0.0004,
    normalBias: 0.022,
  },
  // Exterior foggy village alley / night road with misty twilight sky and sodium-vapor lamp pools
  duskFog: {
    az: 52,
    el: 22,
    lit: [0.56, 0.66, 0.84],
    shade: [0.055, 0.068, 0.102],
    lift: [0.018, 0.024, 0.036],
    lambert: 0.64,
    sideK: 0.78,
    wrapLo: -0.18,
    wrapHi: 0.72,
    rimCol: [0.74, 0.84, 1.0],
    rimStrength: 0.38,
    top: "#070b15",
    hor: "#243048",
    fog: "#1f2a3e",
    fogNear: 5.5,
    fogFar: 42,
    sunDisc: "#dce8ff",
    sunCol: "#9cb6de",
    sunI: 1.55,
    sky: "#223048",
    ground: "#0c101a",
    hemiI: 0.32,
    bias: -0.0005,
    normalBias: 0.026,
  },
  // Pitch-dark cavernous interior carved primarily by a handheld flashlight SpotLight cone
  flashlight: {
    az: 18,
    el: 30,
    lit: [0.22, 0.26, 0.34],
    shade: [0.026, 0.030, 0.044],
    lift: [0.010, 0.012, 0.018],
    lambert: 0.72,
    sideK: 0.70,
    wrapLo: -0.14,
    wrapHi: 0.76,
    rimCol: [0.46, 0.56, 0.74],
    rimStrength: 0.28,
    top: "#030408",
    hor: "#0e121c",
    fog: "#0c1018",
    fogNear: 5.0,
    fogFar: 32,
    sunDisc: "#000000",
    sunCol: "#6c7ea0",
    sunI: 0.65,
    sky: "#101622",
    ground: "#06080e",
    hemiI: 0.16,
    bias: -0.0004,
    normalBias: 0.020,
  },
};

export type WorldLook = {
  sky: { c: string[]; e: number[] };
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;
  sat: number;
  cloud: { lit: string; mid: string; shade: string };
};

export const LOOK: Record<LightKey, WorldLook> = {
  warmLamp: {
    sky: { c: ["#241b24", "#1b141d", "#130e17", "#0c0910", "#06050a"], e: [0, 6, 16, 30, 52] },
    water: { near: "#141016", mid: "#1d161c", far: "#281e24", crest: "#725444", trough: "#0b080c", glint: "#f0c898", shade: [0.30, 0.26, 0.36] },
    cloud: { lit: "#483842", mid: "#2e232c", shade: "#161018" },
    bounce: [0.038, 0.022, 0.014],
    sat: 0.88,
  },
  coldMoon: {
    sky: { c: ["#1d2538", "#161d2e", "#101524", "#0a0e1a", "#05070e"], e: [0, 6, 16, 30, 52] },
    water: { near: "#0d1320", mid: "#131c2e", far: "#1b263d", crest: "#506484", trough: "#070b14", glint: "#c4d6f4", shade: [0.28, 0.34, 0.48] },
    cloud: { lit: "#384660", mid: "#222c40", shade: "#111624" },
    bounce: [0.012, 0.018, 0.034],
    sat: 0.72,
  },
  fluorescent: {
    sky: { c: ["#1a2b2d", "#142224", "#0e191c", "#091114", "#050a0c"], e: [0, 6, 16, 30, 52] },
    water: { near: "#0d1a1c", mid: "#132628", far: "#1a3335", crest: "#587d7a", trough: "#071012", glint: "#c2ece2", shade: [0.28, 0.38, 0.40] },
    cloud: { lit: "#3c5454", mid: "#243638", shade: "#111c1e" },
    bounce: [0.014, 0.026, 0.024],
    sat: 0.74,
  },
  duskFog: {
    sky: { c: ["#26344e", "#1d2840", "#141d31", "#0d1322", "#070b15"], e: [0, 6, 16, 30, 52] },
    water: { near: "#101928", mid: "#162336", far: "#1f3048", crest: "#5b7292", trough: "#080e18", glint: "#d2e2fc", shade: [0.30, 0.36, 0.48] },
    cloud: { lit: "#445674", mid: "#2b384e", shade: "#161e2e" },
    bounce: [0.018, 0.022, 0.036],
    sat: 0.80,
  },
  flashlight: {
    sky: { c: ["#101520", "#0c101a", "#080b13", "#05070d", "#030408"], e: [0, 6, 16, 30, 52] },
    water: { near: "#090c14", mid: "#0e131e", far: "#131928", crest: "#384660", trough: "#05070c", glint: "#a8b8d6", shade: [0.24, 0.28, 0.38] },
    cloud: { lit: "#242c3e", mid: "#161c28", shade: "#0a0e16" },
    bounce: [0.008, 0.010, 0.016],
    sat: 0.78,
  },
};

const lerpC3 = (a: C3, b: C3, t: number): C3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const lerpHex = (a: string, b: string, t: number): string => {
  const A = parseInt(a.replace("#", ""), 16);
  const B = parseInt(b.replace("#", ""), 16);
  const ch = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(lerp((A >> shift) & 255, (B >> shift) & 255, t))))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** Smoothly blend two LightPresets (e.g. warmLamp -> coldMoon when candles blow out). */
export const lerpLights = (a: LightPreset, b: LightPreset, rawT: number): LightPreset => {
  const t = clamp01(rawT);
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    az: lerp(a.az, b.az, t),
    el: lerp(a.el, b.el, t),
    lit: lerpC3(a.lit, b.lit, t),
    shade: lerpC3(a.shade, b.shade, t),
    lift: lerpC3(a.lift, b.lift, t),
    lambert: lerp(a.lambert, b.lambert, t),
    sideK: lerp(a.sideK, b.sideK, t),
    wrapLo: lerp(a.wrapLo, b.wrapLo, t),
    wrapHi: lerp(a.wrapHi, b.wrapHi, t),
    rimCol: lerpC3(a.rimCol, b.rimCol, t),
    rimStrength: lerp(a.rimStrength, b.rimStrength, t),
    top: lerpHex(a.top, b.top, t),
    hor: lerpHex(a.hor, b.hor, t),
    fog: lerpHex(a.fog, b.fog, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    sunDisc: lerpHex(a.sunDisc, b.sunDisc, t),
    sunCol: lerpHex(a.sunCol, b.sunCol, t),
    sunI: lerp(a.sunI, b.sunI, t),
    sky: lerpHex(a.sky, b.sky, t),
    ground: lerpHex(a.ground, b.ground, t),
    hemiI: lerp(a.hemiI, b.hemiI, t),
    bias: lerp(a.bias, b.bias, t),
    normalBias: lerp(a.normalBias, b.normalBias, t),
  };
};

/** Smoothly blend two WorldLook palettes. */
export const lerpLook = (a: WorldLook, b: WorldLook, rawT: number): WorldLook => {
  const t = clamp01(rawT);
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    sky: {
      c: a.sky.c.map((hex, i) => lerpHex(hex, b.sky.c[i] ?? hex, t)),
      e: a.sky.e.map((ev, i) => lerp(ev, b.sky.e[i] ?? ev, t)),
    },
    water: {
      near: lerpHex(a.water.near, b.water.near, t),
      mid: lerpHex(a.water.mid, b.water.mid, t),
      far: lerpHex(a.water.far, b.water.far, t),
      crest: lerpHex(a.water.crest, b.water.crest, t),
      trough: lerpHex(a.water.trough, b.water.trough, t),
      glint: lerpHex(a.water.glint, b.water.glint, t),
      shade: lerpC3(a.water.shade, b.water.shade, t),
    },
    bounce: lerpC3(a.bounce, b.bounce, t),
    sat: lerp(a.sat, b.sat, t),
    cloud: {
      lit: lerpHex(a.cloud.lit, b.cloud.lit, t),
      mid: lerpHex(a.cloud.mid, b.cloud.mid, t),
      shade: lerpHex(a.cloud.shade, b.cloud.shade, t),
    },
  };
};
