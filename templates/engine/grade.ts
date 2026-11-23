// Dedicated Gothic Ink-Noir color grading post-processing Effect (5 calibrated horror presets).
// Runs AFTER ToneMappingEffect in display-referred sRGB space: 7-knot monotone cubic Hermite tone curve,
// 3-zone saturation, 3-way zero-luma split toning, and elliptical vignette.

import { Effect, BlendFunction } from "postprocessing";
import { Uniform, Vector3, Vector2 } from "three";
import type { LightKey } from "./camera";

const frag = /* glsl */ `
uniform float gradeKy[7];
uniform float gradeKm[7];
uniform vec3 gradeSat;
uniform vec3 gradeTintS;
uniform vec3 gradeTintM;
uniform vec3 gradeTintH;
uniform vec2 gradeVig;
uniform float gradeAmount;
uniform float gradeAberration;
uniform float gradeTime;
uniform float gradeGrime;

float gHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = gHash(i), b = gHash(i + vec2(1.0, 0.0));
  float c = gHash(i + vec2(0.0, 1.0)), d = gHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 gradeEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 gradeDecode(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
float gradeHermite(float v, float x0, float x1, float y0, float y1, float m0, float m1) {
  float h = x1 - x0, t = (v - x0) / h, t2 = t * t, t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * y0 + (t3 - 2.0 * t2 + t) * h * m0 + (-2.0 * t3 + 3.0 * t2) * y1 + (t3 - t2) * h * m1;
}
float gradeCurve(float v) {
  v = clamp(v, 0.0, 1.0);
  if (v < 0.1)  return gradeHermite(v, 0.0, 0.1, gradeKy[0], gradeKy[1], gradeKm[0], gradeKm[1]);
  if (v < 0.25) return gradeHermite(v, 0.1, 0.25, gradeKy[1], gradeKy[2], gradeKm[1], gradeKm[2]);
  if (v < 0.5)  return gradeHermite(v, 0.25, 0.5, gradeKy[2], gradeKy[3], gradeKm[2], gradeKm[3]);
  if (v < 0.75) return gradeHermite(v, 0.5, 0.75, gradeKy[3], gradeKy[4], gradeKm[3], gradeKm[4]);
  if (v < 0.9)  return gradeHermite(v, 0.75, 0.9, gradeKy[4], gradeKy[5], gradeKm[4], gradeKm[5]);
  return gradeHermite(v, 0.9, 1.0, gradeKy[5], gradeKy[6], gradeKm[5], gradeKm[6]);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p) * 0.70710678;

  // Radial RGB chromatic aberration (unsettling peripheral prism split, surging during entity/shock beats)
  vec3 rawRgb = inputColor.rgb;
  if (gradeAberration > 0.0005) {
    vec2 dir = p * (0.0022 + 0.0075 * gradeAberration) * (0.35 + r * r);
    float rCh = texture2D(inputBuffer, clamp(uv + dir, 0.001, 0.999)).r;
    float bCh = texture2D(inputBuffer, clamp(uv - dir, 0.001, 0.999)).b;
    rawRgb = vec3(rCh, rawRgb.g, bCh);
  }

  vec3 src = gradeEncode(rawRgb);
  vec3 c = vec3(gradeCurve(src.r), gradeCurve(src.g), gradeCurve(src.b));
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float y = dot(c, W);
  float wS = 1.0 - smoothstep(0.0, 0.55, y);
  float wH = smoothstep(0.45, 1.0, y);
  float wM = 1.0 - wS - wH;
  float s = gradeSat.y + (gradeSat.x - gradeSat.y) * wS + (gradeSat.z - gradeSat.y) * wH;
  c = vec3(y) + s * (c - vec3(y));
  c += wS * gradeTintS + wM * gradeTintM + wH * gradeTintH;

  // Organic smoky ink-wash vignette (irregular ragged edge instead of smooth digital oval)
  float ang = atan(p.y, p.x);
  float smokeW = gNoise(vec2(ang * 2.6 + gradeTime * 0.05, r * 3.8)) * 0.14;
  float vigMask = smoothstep(gradeVig.y - 0.08, 0.98, r + smokeW);
  c *= 1.0 - gradeVig.x * vigMask;

  // Subtle cursed-celluloid grime: fine vertical film scratches + dark ink-wash dust flecks
  if (gradeGrime > 0.001) {
    float tStep = floor(gradeTime * 12.0);
    float scX = floor(uv.x * 260.0);
    float scSeed = gHash(vec2(scX, tStep * 0.37));
    float scratch = step(0.9945, scSeed) * smoothstep(0.25, 0.85, gNoise(vec2(uv.y * 5.0, scX))) * 0.18 * gradeGrime;
    float speck = step(0.9965, gHash(floor(uv * vec2(180.0, 320.0)) + tStep * 0.7)) * 0.32 * gradeGrime;
    float blotch = (gNoise(uv * vec2(6.5, 11.0) + vec2(0.0, 0.12)) - 0.5) * 0.08 * gradeGrime * smoothstep(0.25, 0.95, r);
    c = c * (1.0 - speck + blotch) + vec3(scratch * 0.65);
  }

  c = clamp(c, 0.0, 1.0);
  outputColor = vec4(gradeDecode(mix(src, c, gradeAmount)), inputColor.a);
}`;

const E_CB: [number, number, number] = [0.0, -0.18733, 1.8556];
const E_CR: [number, number, number] = [1.5748, -0.46813, 0.0];
export const tintRGB = (cb: number, cr: number) =>
  new Vector3(cb * E_CB[0] + cr * E_CR[0], cb * E_CB[1] + cr * E_CR[1], cb * E_CB[2] + cr * E_CR[2]);

export const KX = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
export function monoTangents(ky: number[]): number[] {
  const n = KX.length, h: number[] = [], d: number[] = [], m = new Array(n).fill(0);
  for (let k = 0; k < n - 1; k++) {
    h.push(KX[k + 1] - KX[k]);
    d.push((ky[k + 1] - ky[k]) / h[k]);
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) {
      m[k] = 0;
      continue;
    }
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

export type GradeParams = {
  ky: number[];
  sat: [number, number, number];
  tintS: [number, number];
  tintM: [number, number];
  tintH: [number, number];
  vig: [number, number];
};

export const GRADE_NIGHT: GradeParams = {
  ky: [0.006, 0.070, 0.225, 0.51, 0.81, 0.95, 1],
  sat: [0.76, 0.84, 0.94],
  tintS: [0.022, -0.004],
  tintM: [0.009, -0.002],
  tintH: [0.006, 0.0],
  vig: [0.56, 0.26],
};

export const GRADE_CANDLE: GradeParams = {
  ky: [0.006, 0.068, 0.220, 0.52, 0.83, 0.96, 1],
  sat: [0.74, 1.00, 1.12],
  tintS: [0.016, 0.004],
  tintM: [-0.008, 0.010],
  tintH: [-0.014, 0.010],
  vig: [0.62, 0.22],
};

export const GRADE_STORM: GradeParams = {
  ky: [0.008, 0.078, 0.240, 0.53, 0.82, 0.95, 1],
  sat: [0.64, 0.74, 0.86],
  tintS: [0.014, -0.005],
  tintM: [0.008, -0.004],
  tintH: [0.004, 0.0],
  vig: [0.56, 0.24],
};

export const GRADE_EERIE: GradeParams = {
  ky: [0.006, 0.074, 0.235, 0.53, 0.82, 0.95, 1],
  sat: [0.72, 0.84, 0.94],
  tintS: [0.020, 0.002],
  tintM: [-0.006, -0.012],
  tintH: [-0.008, -0.008],
  vig: [0.60, 0.24],
};

export const GRADE_BLOOD: GradeParams = {
  ky: [0.006, 0.068, 0.220, 0.52, 0.83, 0.96, 1],
  sat: [0.74, 1.04, 1.14],
  tintS: [0.010, 0.010],
  tintM: [-0.006, 0.014],
  tintH: [-0.008, 0.012],
  vig: [0.66, 0.20],
};

const BASE_ABERRATION: Record<LightKey, number> = {
  night: 0.14,
  candle: 0.16,
  storm: 0.24,
  eerie: 0.34,
  blood: 0.44,
};

export const GRADES: Record<LightKey, GradeParams> = {
  night: GRADE_NIGHT,
  candle: GRADE_CANDLE,
  storm: GRADE_STORM,
  eerie: GRADE_EERIE,
  blood: GRADE_BLOOD,
};

export const GRADE_STRENGTH: Record<LightKey, number> = {
  night: 1,
  candle: 1,
  storm: 1,
  eerie: 1,
  blood: 1,
};

export class GradeEffect extends Effect {
  constructor(p: GradeParams, amount = 1) {
    super("GradeEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["gradeKy", new Uniform(p.ky.slice())],
        ["gradeKm", new Uniform(monoTangents(p.ky))],
        ["gradeSat", new Uniform(new Vector3(...p.sat))],
        ["gradeTintS", new Uniform(tintRGB(...p.tintS))],
        ["gradeTintM", new Uniform(tintRGB(...p.tintM))],
        ["gradeTintH", new Uniform(tintRGB(...p.tintH))],
        ["gradeVig", new Uniform(new Vector2(...p.vig))],
        ["gradeAmount", new Uniform(amount)],
        ["gradeAberration", new Uniform(0.18)],
        ["gradeTime", new Uniform(0)],
        ["gradeGrime", new Uniform(0.85)],
      ]),
    });
  }
  set(p: GradeParams, q?: GradeParams, t = 0) {
    const L = (a: number, b: number) => a + (b - a) * t;
    const r: GradeParams = q
      ? {
          ky: p.ky.map((v, i) => L(v, q.ky[i])),
          sat: [L(p.sat[0], q.sat[0]), L(p.sat[1], q.sat[1]), L(p.sat[2], q.sat[2])],
          tintS: [L(p.tintS[0], q.tintS[0]), L(p.tintS[1], q.tintS[1])],
          tintM: [L(p.tintM[0], q.tintM[0]), L(p.tintM[1], q.tintM[1])],
          tintH: [L(p.tintH[0], q.tintH[0]), L(p.tintH[1], q.tintH[1])],
          vig: [L(p.vig[0], q.vig[0]), L(p.vig[1], q.vig[1])],
        }
      : p;
    const u = this.uniforms;
    u.get("gradeKy")!.value = r.ky.slice();
    u.get("gradeKm")!.value = monoTangents(r.ky);
    (u.get("gradeSat")!.value as Vector3).set(...r.sat);
    u.get("gradeTintS")!.value = tintRGB(...r.tintS);
    u.get("gradeTintM")!.value = tintRGB(...r.tintM);
    u.get("gradeTintH")!.value = tintRGB(...r.tintH);
    (u.get("gradeVig")!.value as Vector2).set(...r.vig);
  }
  get amount() {
    return this.uniforms.get("gradeAmount")!.value as number;
  }
  set amount(v: number) {
    this.uniforms.get("gradeAmount")!.value = v;
  }
  set time(v: number) {
    this.uniforms.get("gradeTime")!.value = v;
  }
  set aberration(v: number) {
    this.uniforms.get("gradeAberration")!.value = v;
  }
  set grime(v: number) {
    this.uniforms.get("gradeGrime")!.value = v;
  }
}

export function gradeFor(fx: GradeEffect, light: LightKey, frame = 0, extraAberration = 0, grime = 0.85) {
  const tag = fx as unknown as { _light?: string };
  if (tag._light !== light) {
    fx.set(GRADES[light]);
    tag._light = light;
  }
  fx.amount = GRADE_STRENGTH[light];
  fx.time = frame / 30;
  fx.aberration = BASE_ABERRATION[light] + Math.max(0, extraAberration);
  fx.grime = grime;
}
