// Horror Engine v3: Deterministic GPU Whip-Pan Directional Motion Blur Effect.
// Driven by camera angular velocity between frame `f` and `f - 1` (computed purely from timeline, zero state).
// Passes through with zero blur below 2.5px threshold so holds and gentle POV breathing stay razor-sharp.

import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform, Vector2 } from "three";

const frag = /* glsl */ `
uniform vec2 uVel;
uniform float uStrength;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uStrength < 0.001) {
    outputColor = inputColor;
    return;
  }
  vec2 delta = uVel * uStrength;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float t = float(i) / 6.0;
    float w = exp(-2.1 * t * t);
    vec2 suv = clamp(uv + delta * t, vec2(0.001), vec2(0.999));
    acc += texture2D(inputBuffer, suv).rgb * w;
    wsum += w;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}
`;

export class WhipMotionBlurEffect extends Effect {
  private readonly thresholdPx: number;
  private readonly maxUv: number;

  constructor({ thresholdPx = 2.5, maxUv = 0.055 }: { thresholdPx?: number; maxUv?: number } = {}) {
    super("WhipMotionBlurEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uVel", new Uniform(new Vector2(0, 0))],
        ["uStrength", new Uniform(0)],
      ]),
    });
    this.thresholdPx = thresholdPx;
    this.maxUv = maxUv;
  }

  /** Set deterministic per-frame screen-space velocity (normalized UV units + speed in px). */
  setVelocity(vx: number, vy: number, speedPx: number): void {
    const vel = this.uniforms.get("uVel")!.value as Vector2;
    if (speedPx < this.thresholdPx || !Number.isFinite(speedPx)) {
      vel.set(0, 0);
      this.uniforms.get("uStrength")!.value = 0;
      return;
    }
    const len = Math.hypot(vx, vy);
    const scale = len > this.maxUv ? this.maxUv / len : 1;
    vel.set(vx * scale, vy * scale);
    // Smooth ramp-in above thresholdPx (2.5px -> 10px reaches full blur strength)
    const ramp = Math.max(0, Math.min(1, (speedPx - this.thresholdPx) / 7.5));
    this.uniforms.get("uStrength")!.value = ramp;
  }
}
