// Horror Engine v4.5: Deterministic PS1 / PSX Low-Poly VHS & CRT Post-Processing Effect.
// Matches Puppet Combo / Chilla's Art / Mouthwashing / low poly.webp aesthetic:
//   - Virtual low-res pixel grid (default 360x640 = 3x3 blocks at 1080x1920)
//   - Smooth deterministic VHS horizontal tracking wave + dynamic glitch surge on monster reveals
//   - RGB chromatic edge split (purple/green VHS analog fringing)
//   - 4x4 Bayer ordered dithering + PS1 hardware color-depth quantization in display space
//   - Subtle horizontal CRT scanlines + slight CRT barrel bend & dark rounded bezel corners

import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

export type PsxOptions = {
  pixelScale?: number;       // Virtual pixel block size at 1080 short edge (default 3.0 -> 360x640 in 9:16)
  colorLevels?: number;      // PS1 quantization levels per RGB channel (default 22)
  ditherStrength?: number;   // 0..1 Bayer 4x4 ordered dithering intensity (default 0.85)
  scanlineStrength?: number; // 0..0.45 CRT horizontal scanline darkness (default 0.19)
  vhsWave?: number;          // 0..1 base horizontal VHS tracking wobble (default 0.28)
  chromaPx?: number;         // 0..4.5 base RGB horizontal split in virtual pixels (default 1.65)
  crtCurvature?: number;     // 0..0.14 subtle CRT barrel curvature + rounded corners (default 0.048)
  vertexSnap?: number;       // 0 = off, 200..320 = PS1 clip-space vertex quantization (default 280)
};

export const DEF_PSX_OPTIONS: Required<PsxOptions> = {
  pixelScale: 3.0,
  colorLevels: 22,
  ditherStrength: 0.85,
  scanlineStrength: 0.19,
  vhsWave: 0.28,
  chromaPx: 1.65,
  crtCurvature: 0.048,
  vertexSnap: 280,
};

const frag = /* glsl */ `
uniform float uFrame;
uniform float uPixelScale;
uniform float uColorLevels;
uniform float uDither;
uniform float uScanline;
uniform float uVhsWave;
uniform float uChromaPx;
uniform float uCurvature;
uniform float uGlitch;
uniform float uDread;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float bayer4(ivec2 p) {
  int x = p.x & 3;
  int y = p.y & 3;
  int idx = y * 4 + x;
  if (idx == 0)  return  0.0 / 16.0;
  if (idx == 1)  return  8.0 / 16.0;
  if (idx == 2)  return  2.0 / 16.0;
  if (idx == 3)  return 10.0 / 16.0;
  if (idx == 4)  return 12.0 / 16.0;
  if (idx == 5)  return  4.0 / 16.0;
  if (idx == 6)  return 14.0 / 16.0;
  if (idx == 7)  return  6.0 / 16.0;
  if (idx == 8)  return  3.0 / 16.0;
  if (idx == 9)  return 11.0 / 16.0;
  if (idx == 10) return  1.0 / 16.0;
  if (idx == 11) return  9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return  7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

vec3 toDisplay(vec3 c) {
  c = max(c, 0.0);
  return pow(c, vec3(1.0 / 2.2));
}

vec3 toLinear(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return pow(c, vec3(2.2));
}

float roundedCornerMask(vec2 uv, float radius, float feather) {
  vec2 p = abs(uv * 2.0 - 1.0);
  vec2 q = p - (vec2(1.0) - vec2(radius));
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  return 1.0 - smoothstep(-feather, feather, d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float t = uFrame / 30.0;
  float shortEdge = max(min(resolution.x, resolution.y), 1.0);
  float resK = shortEdge / 1080.0;

  // 1. Subtle CRT barrel warp & rounded monitor bezel mask (matches low poly.webp curved TV corners!)
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p);
  vec2 crtUv = uv;
  if (uCurvature > 0.0005) {
    vec2 warped = p * (1.0 + uCurvature * r2);
    crtUv = warped * 0.5 + 0.5;
  }
  if (crtUv.x < 0.0 || crtUv.x > 1.0 || crtUv.y < 0.0 || crtUv.y > 1.0) {
    outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // 2. Virtual low-res PS1 pixel grid (e.g. 360x640 inside 1080x1920 -> crisp 3x3 pixel blocks)
  float pxStep = max(1.0, uPixelScale * resK);
  vec2 vRes = max(floor(resolution / pxStep), vec2(64.0));
  vec2 vCoord = floor(crtUv * vRes);
  vec2 qUv = (vCoord + 0.5) / vRes;

  // 3. Deterministic VHS horizontal tracking wobble + slow rolling head-switch band + intense tapeTear shear on monster scares!
  float surge = clamp(uGlitch, 0.0, 1.8);
  float waveAmt = (uVhsWave * 0.0022 + surge * 0.0065);
  float rollBand = exp(-pow(fract(qUv.y * 1.15 - t * 0.14) - 0.5, 2.0) * 90.0);
  float jitter = (
    sin(qUv.y * 28.0 + t * 2.6) * 0.55 +
    sin(qUv.y * 74.0 - t * 5.2) * 0.30 +
    sin(qUv.y * 140.0 + t * 8.5) * 0.15
  ) * waveAmt * (1.0 + rollBand * (1.2 + surge * 1.8));

  // Razor-thin authentic VHS horizontal tracking-error tear line when surge > 0.28 (never smothers entity faces in snow!)
  float tearGate = smoothstep(0.28, 0.72, surge);
  float tearCenter = 0.14 + 0.14 * sin(t * 1.45);
  float tearBand = exp(-pow((qUv.y - tearCenter) * 58.0, 2.0)) * tearGate;
  float tearLineNoise = hash12(vec2(vCoord.y, floor(uFrame * 0.5))) - 0.5;
  jitter += tearBand * tearLineNoise * 0.044;

  vec2 sampleUv = vec2(clamp(qUv.x + jitter, 0.001, 0.999), clamp(qUv.y, 0.001, 0.999));

  // 4. Analog VHS RGB chromatic split (creates iconic purple / green fringing around doors & monsters!)
  float edgeBoost = 0.55 + 0.75 * clamp(length(p) * 0.85, 0.0, 1.2);
  float chromaOff = ((uChromaPx + surge * 2.6) / vRes.x) * edgeBoost;
  vec2 uvR = vec2(clamp(sampleUv.x - chromaOff, 0.001, 0.999), sampleUv.y);
  vec2 uvB = vec2(clamp(sampleUv.x + chromaOff * 1.12, 0.001, 0.999), sampleUv.y);
  // Subtle green channel micro-bleed for authentic composite VHS color smear
  float rCh = texture2D(inputBuffer, uvR).r;
  float gCh = texture2D(inputBuffer, sampleUv).g;
  float bCh = texture2D(inputBuffer, uvB).b;
  vec3 rawLin = vec3(rCh, gCh, bCh);

  // 5. 4x4 Bayer ordered dithering + PS1 hardware color-depth quantization (in display space!)
  vec3 disp = toDisplay(rawLin);
  if (uColorLevels > 2.0) {
    float b = bayer4(ivec2(vCoord)) - 0.5;
    float stepV = 1.0 / uColorLevels;
    disp = clamp(disp + b * stepV * uDither, 0.0, 1.0);
    disp = floor(disp * uColorLevels + 0.5) / uColorLevels;
  }

  // Subtle VHS composite luma-edge grit along rolling tracking band + thin static streak inside tracking tear
  disp += (rollBand * 0.024 * (0.4 + surge)) * sin(qUv.y * 220.0 + t * 14.0);
  if (tearBand > 0.06) {
    float snow = step(0.84, hash12(vCoord + vec2(uFrame * 1.7, uFrame * 0.3)));
    disp = mix(disp, vec3(0.76, 0.80, 0.82), snow * tearBand * 0.34);
  }

  // Heartbeat claustrophobic dread vignette + peripheral desaturation (opt-in via uDread > 0)
  float dread = clamp(uDread, 0.0, 1.0);
  if (dread > 0.01) {
    float hbPhase = fract(t * 1.35);
    float lub = exp(-pow((hbPhase - 0.12) / 0.06, 2.0));
    float dub = 0.65 * exp(-pow((hbPhase - 0.28) / 0.07, 2.0));
    float hb = lub + dub;
    float edgeDist = smoothstep(0.32, 1.25, r2);
    float vigDrop = edgeDist * dread * (0.34 + 0.24 * hb);
    float luma = dot(disp, vec3(0.299, 0.587, 0.114));
    disp = mix(disp, vec3(luma), edgeDist * dread * 0.55);
    disp *= clamp(1.0 - vigDrop, 0.12, 1.0);
  }

  // 6. Luminance-preserving horizontal CRT phosphor scanlines aligned cleanly to virtual retro rows
  if (uScanline > 0.001) {
    float rowPhase = fract(crtUv.y * vRes.y);
    float scanWave = 0.5 - 0.5 * cos(rowPhase * 6.2831853);
    float scanGain = 1.0 + uScanline * (0.58 - 1.24 * scanWave);
    disp = clamp(disp * scanGain, 0.0, 1.0);
  }

  // 7. Soft rounded dark CRT screen bezel corner mask
  if (uCurvature > 0.001) {
    float bezel = roundedCornerMask(crtUv, 0.085, 0.018);
    float edgeVig = 1.0 - 0.16 * smoothstep(0.65, 1.18, r2);
    disp *= bezel * edgeVig;
  }

  outputColor = vec4(toLinear(disp), inputColor.a);
}
`;

export class RetroPsxEffect extends Effect {
  constructor(opts: PsxOptions = {}) {
    const o = { ...DEF_PSX_OPTIONS, ...opts };
    super("RetroPsxEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uPixelScale", new Uniform(o.pixelScale)],
        ["uColorLevels", new Uniform(o.colorLevels)],
        ["uDither", new Uniform(o.ditherStrength)],
        ["uScanline", new Uniform(o.scanlineStrength)],
        ["uVhsWave", new Uniform(o.vhsWave)],
        ["uChromaPx", new Uniform(o.chromaPx)],
        ["uCurvature", new Uniform(o.crtCurvature)],
        ["uGlitch", new Uniform(0)],
        ["uDread", new Uniform(0)],
      ]),
    });
  }

  setOptions(opts: PsxOptions): void {
    const u = this.uniforms;
    if (opts.pixelScale !== undefined) u.get("uPixelScale")!.value = opts.pixelScale;
    if (opts.colorLevels !== undefined) u.get("uColorLevels")!.value = opts.colorLevels;
    if (opts.ditherStrength !== undefined) u.get("uDither")!.value = opts.ditherStrength;
    if (opts.scanlineStrength !== undefined) u.get("uScanline")!.value = opts.scanlineStrength;
    if (opts.vhsWave !== undefined) u.get("uVhsWave")!.value = opts.vhsWave;
    if (opts.chromaPx !== undefined) u.get("uChromaPx")!.value = opts.chromaPx;
    if (opts.crtCurvature !== undefined) u.get("uCurvature")!.value = opts.crtCurvature;
  }

  set frame(v: number) {
    this.uniforms.get("uFrame")!.value = v;
  }
  get frame(): number {
    return this.uniforms.get("uFrame")!.value as number;
  }
  set glitchSurge(v: number) {
    this.uniforms.get("uGlitch")!.value = Math.max(0, v);
  }
  get glitchSurge(): number {
    return this.uniforms.get("uGlitch")!.value as number;
  }
  set dreadLevel(v: number) {
    this.uniforms.get("uDread")!.value = Math.max(0, Math.min(1, v));
  }
  get dreadLevel(): number {
    return this.uniforms.get("uDread")!.value as number;
  }
}
