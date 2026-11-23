// Horror Engine v3: Clean cinematic horror color grading post-processing Effect (5 physical presets).
// Calibrated to videomau luma/color hierarchy: velvet darks (p5 ~0.038), punchy HDR bloom highlights,
// very subtle peripheral chromatic aberration (<= 0.12 base), soft organic vignette, ZERO fake film scratches.

import { Effect, BlendFunction } from "postprocessing";
import { Uniform, Vector3, Vector2 } from "three";
import { clamp01, type LightKey } from "./camera";

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

  // Subtle peripheral chromatic aberration (clean optical edge split, zero center smear)
  vec3 rawRgb = inputColor.rgb;
  if (gradeAberration > 0.0005) {
    vec2 dir = p * (0.0014 + 0.0045 * gradeAberration) * (r * r);
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

  // Smooth soft lens vignette framing the center POV sightline
  float vigMask = smoothstep(gradeVig.y, 1.02, r);
  c *= 1.0 - gradeVig.x * vigMask;

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

export const GRADES: Record<LightKey, GradeParams> = {
  warmLamp: {
    ky: [0.014, 0.105, 0.278, 0.56, 0.84, 0.96, 1],
    sat: [0.80, 0.96, 1.06],
    tintS: [0.010, 0.004],
    tintM: [-0.005, 0.008],
    tintH: [-0.010, 0.008],
    vig: [0.38, 0.34],
  },
  coldMoon: {
    ky: [0.014, 0.100, 0.268, 0.54, 0.82, 0.95, 1],
    sat: [0.70, 0.80, 0.90],
    tintS: [0.014, -0.003],
    tintM: [0.008, -0.002],
    tintH: [0.005, 0.0],
    vig: [0.42, 0.32],
  },
  fluorescent: {
    ky: [0.014, 0.102, 0.274, 0.55, 0.83, 0.96, 1],
    sat: [0.72, 0.82, 0.92],
    tintS: [0.008, -0.008],
    tintM: [-0.002, -0.008],
    tintH: [-0.004, -0.005],
    vig: [0.40, 0.32],
  },
  duskFog: {
    ky: [0.016, 0.106, 0.280, 0.56, 0.84, 0.96, 1],
    sat: [0.76, 0.88, 0.98],
    tintS: [0.014, -0.002],
    tintM: [0.006, 0.0],
    tintH: [-0.004, 0.004],
    vig: [0.36, 0.36],
  },
  flashlight: {
    ky: [0.010, 0.092, 0.262, 0.55, 0.85, 0.97, 1],
    sat: [0.72, 0.86, 0.98],
    tintS: [0.012, -0.002],
    tintM: [0.002, 0.0],
    tintH: [-0.004, 0.004],
    vig: [0.50, 0.26],
  },
};

const BASE_ABERRATION: Record<LightKey, number> = {
  warmLamp: 0.08,
  coldMoon: 0.10,
  fluorescent: 0.10,
  duskFog: 0.08,
  flashlight: 0.12,
};

export const GRADE_STRENGTH: Record<LightKey, number> = {
  warmLamp: 1,
  coldMoon: 1,
  fluorescent: 1,
  duskFog: 1,
  flashlight: 1,
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
        ["gradeAberration", new Uniform(0.08)],
      ]),
    });
  }

  set(p: GradeParams, q?: GradeParams, t = 0) {
    const k = clamp01(t);
    const L = (a: number, b: number) => a + (b - a) * k;
    const r: GradeParams = q && k > 0
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
  set aberration(v: number) {
    this.uniforms.get("gradeAberration")!.value = v;
  }
}

export function gradeFor(
  fx: GradeEffect,
  light: LightKey,
  _frame = 0,
  extraAberration = 0,
  blendTo?: LightKey,
  blendT = 0,
): void {
  const k = blendTo ? clamp01(blendT) : 0;
  if (blendTo && k > 0.001) {
    fx.set(GRADES[light], GRADES[blendTo], k);
  } else {
    fx.set(GRADES[light]);
  }
  fx.amount = GRADE_STRENGTH[light];
  const baseAb = blendTo && k > 0.001
    ? BASE_ABERRATION[light] * (1 - k) + BASE_ABERRATION[blendTo] * k
    : BASE_ABERRATION[light];
  fx.aberration = baseAb + Math.max(0, extraAberration);
}
