// Neutral horror timeline, cinematography grammar, shot archetypes, DOF, and screen beat helpers (30 fps).
// Grammar: purposeful shot-scale & angle variety (WS/MS/OTS/POV/ECU/LOW/HIGH), continuous creep/handheld motion
// (zero frozen holds), real-time lightning flash sync for 3D shaders, and horror transitions (dipBlack/blink/vignettePulse).

export const FPS = 30;
export type V3 = [number, number, number];
export type HorrorLightKey = "night" | "candle" | "storm" | "eerie" | "blood";
export type LightKey = HorrorLightKey;
export type ShotScale = "EWS" | "WS" | "MS" | "MCU" | "CU" | "ECU" | "OTS" | "POV" | "LOW" | "HIGH";

export type ShotBase<TLight extends LightKey = LightKey> = {
  id: number;
  a: number;
  b: number;
  light: TLight;
  scale?: ShotScale;
  note?: string;
};

export type ScreenBeat =
  | { kind: "flash"; f: number; dur?: number; color?: string; peak?: number; blend?: "normal" | "screen" }
  | { kind: "lightning"; f: number; color?: string; peak?: number }
  | { kind: "blackout"; a: number; b: number; fadeIn?: number; fadeOut?: number; color?: string }
  | { kind: "dipBlack"; at: number; dur?: number; hold?: number; color?: string }
  | { kind: "flicker"; a: number; b: number; seed?: number; strength?: number; color?: string }
  | { kind: "vignettePulse"; a: number; b: number; freq?: number; strength?: number; color?: string }
  | { kind: "aberration"; a: number; b: number; strength?: number; pulse?: boolean };

export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type ShotCam = Partial<Cam> & { pos: V3; look: V3 };
export type CamKey = { f: number; dur?: number; cut?: boolean; s: (f: number) => ShotCam };
export type Kick = [number, number]; // [timeSec, gain]
export type DofBeat = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export type FgProp = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
export const smoothstep = (a: number, b: number, x: number) => smooth((x - a) / Math.max(1e-6, b - a));
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 3;
/** Symmetric smootherstep ease: attack = release. */
export const glide = (u: number) => {
  const x = clamp01(u);
  return x * x * x * (x * (6 * x - 15) + 10);
};
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const fullCam = (c: ShotCam): Cam => ({ fov: 40, roll: 0, ...c });

/** Push-in factor since f0; `punch` temporarily boosts rate (with 8 f soft edges) for n frames. */
export const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) {
    for (let i = 0; i < Math.min(x, n); i++) {
      s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
    }
  }
  return Math.exp(-s);
};

/** Dolly push: camera slides toward `look` by factor `k`. */
export const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): ShotCam => ({
  pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k],
  look,
  ...rest,
});

/** Zoom push (camera stays put): tan(fov/2) shrinks by factor `k`. */
export const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): ShotCam => ({
  pos,
  look,
  fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k),
  ...rest,
});

/** Roll-only overlay on an existing framing function. */
export const rolled = (s: (f: number) => ShotCam, roll: number) => (f: number): ShotCam => ({ ...s(f), roll });

/** Offset a named 3D anchor point in world coordinates. */
export const atAnchor = (anchor: V3, dx = 0, dy = 0, dz = 0): V3 => [anchor[0] + dx, anchor[1] + dy, anchor[2] + dz];

/** Vertigo / dolly-zoom: move camera along view axis by `k` while counter-scaling FOV so subject size stays constant. */
export const dollyZoom = (pos: V3, look: V3, baseFov: number, k: number, rest: Partial<Cam> = {}): ShotCam => {
  const safeK = Math.max(0.2, k);
  const rawFov = (360 / Math.PI) * Math.atan(Math.tan((baseFov * Math.PI) / 360) / safeK);
  return {
    pos: [look[0] + (pos[0] - look[0]) * safeK, look[1] + (pos[1] - look[1]) * safeK, look[2] + (pos[2] - look[2]) * safeK],
    look,
    fov: Math.max(14, Math.min(92, rawFov)),
    ...rest,
  };
};

/** Deterministic handheld micro-drift (no random state): organic uneasy breathing/sway in suspense holds. */
export const handheld = (c: ShotCam, f: number, amp = 0.02, freq = 0.28, seed = 1): ShotCam => {
  const ph = seed * 1.73;
  const w = f * freq;
  const dx = amp * (Math.sin(w + ph) + 0.5 * Math.sin(w * 2.13 + ph * 1.9));
  const dy = amp * 0.7 * (Math.cos(w * 1.37 + ph * 0.7) + 0.4 * Math.sin(w * 2.71 + ph));
  const dz = amp * 0.5 * Math.sin(w * 0.91 + ph * 2.3);
  const dRoll = amp * 0.18 * Math.sin(w * 0.83 + ph * 1.4);
  return {
    ...c,
    pos: [c.pos[0] + dx, c.pos[1] + dy, c.pos[2] + dz],
    look: [c.look[0] + dx * 0.45, c.look[1] + dy * 0.45, c.look[2] + dz * 0.45],
    roll: (c.roll ?? 0) + dRoll,
  };
};

/** Fast ease-out zoom/dolly factor from `k0` to `k1` starting at frame `f0` over `dur` frames. */
export const snapZoom = (f: number, f0: number, dur: number, k0: number, k1: number) =>
  k0 + (k1 - k0) * easeOut((f - f0) / Math.max(1, dur));

// ---------------- Cinematic Horror Shot Archetypes ----------------

/** Over-The-Shoulder (OTS) framing: places camera behind & beside `subjectPos` looking past them toward `targetPos`. */
export const camOTS = (
  subjectPos: V3,
  targetPos: V3,
  side: -1 | 1 = 1,
  backDist = 1.65,
  sideOffset = 0.58,
  camHeight = 1.52,
  fov = 38,
): ShotCam => {
  const dx = targetPos[0] - subjectPos[0];
  const dz = targetPos[2] - subjectPos[2];
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len, fz = dz / len;
  const rx = -fz, rz = fx;
  const pos: V3 = [
    subjectPos[0] - fx * backDist + rx * sideOffset * side,
    subjectPos[1] + camHeight,
    subjectPos[2] - fz * backDist + rz * sideOffset * side,
  ];
  const look: V3 = [
    lerp(subjectPos[0], targetPos[0], 0.72),
    lerp(subjectPos[1] + 1.15, targetPos[1], 0.78),
    lerp(subjectPos[2], targetPos[2], 0.72),
  ];
  return { pos, look, fov };
};

/** Smooth orbital arc around `center` from azimuth `az0` to `az1` (radians), ideal for unsettling reveals. */
export const camArc = (
  center: V3,
  radius: number,
  az0: number,
  az1: number,
  y0: number,
  y1: number,
  u: number,
  lookY = 1.15,
  fov = 40,
): ShotCam => {
  const k = glide(u);
  const az = lerp(az0, az1, k);
  return {
    pos: [center[0] + Math.sin(az) * radius, center[1] + lerp(y0, y1, k), center[2] + Math.cos(az) * radius],
    look: [center[0], center[1] + lookY, center[2]],
    fov,
  };
};

/** Subjective POV framing (looking down into dark water, down a corridor, or up at a looming doorway) with breathing sway. */
export const camPOV = (eyePos: V3, lookPos: V3, f: number, swayAmp = 0.024, fov = 48): ShotCam =>
  handheld({ pos: eyePos, look: lookPos, fov }, f, swayAmp, 0.24, 31);

/** Tight dread close-up / ECU with continuous slow push-in toward `targetPos`. */
export const camECU = (targetPos: V3, offset: V3, f: number, f0: number, pushRate = 0.0022, fov = 32): ShotCam =>
  dolly([targetPos[0] + offset[0], targetPos[1] + offset[1], targetPos[2] + offset[2]], targetPos, pushK(f, f0, pushRate), { fov });

const hash01 = (n: number, seed = 1) => {
  const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Deterministic intensity multiplier in [minVal, 1] for flickering lamps, candles, or faulty fluorescents. */
export const flickerAt = (f: number, seed = 1, rate = 0.35, minVal = 0.18): number => {
  const h = hash01(Math.floor(f), seed);
  if (h < rate) {
    const dip = hash01(Math.floor(f) * 3 + 7, seed + 19);
    return minVal + (1 - minVal) * (1 - dip * 0.85);
  }
  return 0.92 + 0.08 * hash01(Math.floor(f) + 11, seed + 5);
};

/** Stepped stop-motion time (6–8 fps) for supernatural entities while humans move smoothly at 30 fps (uncanny motion mismatch). */
export const uncannyTime = (f: number, stepFrames = 4, fps = FPS): number =>
  (Math.floor(f / Math.max(1, stepFrames)) * Math.max(1, stepFrames)) / fps;

/** Sudden asymmetric 2-frame head/limb twitch burst (Silent Hill / Jacob's Ladder style): 0 most frames, violent snap on rare beats. */
export const uncannyTwitch = (f: number, seed = 1, period = 22, amp = 1): number => {
  const bucket = Math.floor(f / Math.max(6, period));
  const triggerOff = Math.floor(hash01(bucket, seed + 13) * Math.max(1, period - 3));
  const dt = f - (bucket * Math.max(6, period) + triggerOff);
  if (dt === 0 || dt === 1) {
    const sign = hash01(bucket, seed + 41) < 0.5 ? -1 : 1;
    const mag = 0.65 + 0.35 * hash01(bucket, seed + 79);
    return sign * mag * amp * (dt === 0 ? 1 : 0.72);
  }
  return 0;
};

/** Evaluate camera key list at frame `f`. */
export const evalCamKeys = (keys: CamKey[], f: number): Cam => {
  let cur = fullCam(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? fullCam(k.s(f)) : mixCam(cur, fullCam(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};

/** 7-frame impact kick scalar alternating sign every frame. */
export const kickAt = (kicks: Kick[], t: number, fps = FPS): number => {
  let a = 0;
  for (const [t0, g] of kicks) {
    const n = Math.floor((t - t0) * fps + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};

/** Apply an impact kick scalar to a camera pose (~3 px per unit at 720p + 0.23 deg roll). */
export const applyKick = (c: Cam, a: number): Cam => {
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return {
    ...c,
    look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m],
    roll: c.roll + a * 0.004,
  };
};

/** Evaluate camera for shot `id` at frame `f` including optional impact kicks. */
export const evalCam = (cams: Record<number, CamKey[]>, id: number, f: number, kicks: Kick[] = [], fps = FPS): Cam => {
  const keys = cams[id];
  if (!keys || keys.length === 0) throw new Error(`camera.ts: missing camera keys for shot ${id}`);
  const c = evalCamKeys(keys, f);
  const a = kicks.length ? kickAt(kicks, f / fps, fps) : 0;
  return a ? applyKick(c, a) : c;
};

/** Frame at which the current camera key's glide has settled (useful for picking stable billboard views). */
export const keyEnd = (keys: CamKey[], f: number) => {
  let e = 0;
  for (const k of keys) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

/** Active shot at frame `f`. */
export const shotAt = <T extends ShotBase<LightKey>>(shots: T[], f: number): T =>
  shots.find((s) => f >= s.a && f < s.b) ?? shots[shots.length - 1];

/** Active layers at frame `f`: base shot, plus incoming shot during an XFADE window. */
export const evalLayers = (shots: ShotBase<LightKey>[], xfade: Record<number, number>, f: number): { id: number; alpha: number }[] => {
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const x = xfade[s.id];
    if (x && i > 0 && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [
        { id: shots[i - 1].id, alpha: 1 },
        { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) },
      ];
    }
  }
  return [{ id: shotAt(shots, f).id, alpha: 1 }];
};

const LIGHTNING_CURVE = [1.0, 0.34, 0.12, 0.78, 0.30, 0.12, 0.04];

/** Evaluate 3D-lighting lightning intensity scalar in [0, 1] at frame `f` (drives real 3D shader illumination). */
export const lightningAt = (overlays: ScreenBeat[], f: number): number => {
  let peak = 0;
  for (const ov of overlays) {
    if (ov.kind !== "lightning") continue;
    const dt = f - ov.f;
    if (dt >= 0 && dt < LIGHTNING_CURVE.length) {
      peak = Math.max(peak, clamp01((ov.peak ?? 0.85) * LIGHTNING_CURVE[dt]));
    }
  }
  return peak;
};

/** Evaluate chromatic aberration intensity scalar (0..1.5) at frame `f` for uncanny entity proximity & shocks. */
export const aberrationAt = (overlays: ScreenBeat[], f: number): number => {
  let peak = 0;
  for (const ov of overlays) {
    if (ov.kind !== "aberration") continue;
    if (f >= ov.a && f < ov.b) {
      const env = Math.sin(clamp01((f - ov.a) / Math.max(1, ov.b - ov.a)) * Math.PI);
      const base = (ov.strength ?? 0.75) * Math.min(1, env * 3.0);
      const mod = ov.pulse ? 0.55 + 0.45 * Math.abs(Math.sin(f * 0.45)) : 1;
      peak = Math.max(peak, base * mod);
    }
  }
  return peak;
};

export type EvaluatedOverlay = {
  color: string;
  opacity: number;
  blend?: "normal" | "screen";
  radial?: boolean;
};

/** Evaluate deterministic full-screen visual beats (flash, lightning, blackout, dipBlack, flicker, vignettePulse). */
export const evalOverlays = (overlays: ScreenBeat[], f: number): EvaluatedOverlay[] => {
  const out: EvaluatedOverlay[] = [];
  for (const ov of overlays) {
    if (ov.kind === "flash") {
      const dur = Math.max(1, ov.dur ?? 4);
      const dt = f - ov.f;
      if (dt >= 0 && dt < dur) {
        const opacity = clamp01((ov.peak ?? 0.55) * (1 - dt / dur) ** 1.5);
        if (opacity > 0.005) out.push({ color: ov.color ?? "#ffffff", opacity, blend: ov.blend ?? "screen" });
      }
    } else if (ov.kind === "lightning") {
      // Subtle screen-blended sky sheen ONLY (bulk of lightning punch comes from real 3D shader uFlashAmt!)
      const dt = f - ov.f;
      if (dt >= 0 && dt < LIGHTNING_CURVE.length) {
        const opacity = clamp01((ov.peak ?? 0.85) * LIGHTNING_CURVE[dt] * 0.28);
        if (opacity > 0.005) out.push({ color: ov.color ?? "#b8d8ff", opacity, blend: "screen" });
      }
    } else if (ov.kind === "blackout") {
      if (f >= ov.a && f < ov.b) {
        const fi = Math.max(0, ov.fadeIn ?? 0);
        const fo = Math.max(0, ov.fadeOut ?? 0);
        let alpha = 1;
        if (fi > 0 && f - ov.a < fi) alpha = Math.min(alpha, (f - ov.a + 1) / (fi + 1));
        if (fo > 0 && ov.b - f <= fo) alpha = Math.min(alpha, (ov.b - f) / (fo + 1));
        alpha = clamp01(alpha);
        if (alpha > 0.005) out.push({ color: ov.color ?? "#040308", opacity: alpha, blend: "normal" });
      }
    } else if (ov.kind === "dipBlack") {
      const dur = Math.max(2, ov.dur ?? 10);
      const hold = Math.max(0, ov.hold ?? 2);
      const half = dur / 2;
      const a = ov.at - half - hold / 2;
      const b = ov.at + half + hold / 2;
      if (f >= a && f <= b) {
        let alpha = 1;
        if (f < ov.at - hold / 2) alpha = smooth((f - a) / half);
        else if (f > ov.at + hold / 2) alpha = smooth((b - f) / half);
        if (alpha > 0.005) out.push({ color: ov.color ?? "#040308", opacity: clamp01(alpha), blend: "normal" });
      }
    } else if (ov.kind === "flicker") {
      if (f >= ov.a && f < ov.b) {
        const h = hash01(Math.floor(f), ov.seed ?? 1);
        if (h < 0.35) {
          const opacity = clamp01((ov.strength ?? 0.5) * (1 - h / 0.35));
          if (opacity > 0.005) out.push({ color: ov.color ?? "#040308", opacity, blend: "normal" });
        }
      }
    } else if (ov.kind === "vignettePulse") {
      if (f >= ov.a && f < ov.b) {
        const freq = ov.freq ?? 1.4;
        const pulse = 0.5 + 0.5 * Math.sin(((f - ov.a) / FPS) * Math.PI * 2 * freq);
        const env = Math.sin(clamp01((f - ov.a) / Math.max(1, ov.b - ov.a)) * Math.PI);
        const opacity = clamp01((ov.strength ?? 0.42) * pulse * Math.min(1, env * 2.5));
        if (opacity > 0.005) out.push({ color: ov.color ?? "#040208", opacity, blend: "normal", radial: true });
      }
    }
  }
  return out;
};

/** Thin-lens DOF parameters at frame `f`. */
export const evalDof = (dof: DofBeat[], f: number): { cInf: number; focus?: (f: number) => V3 } => {
  if (!dof.length) return { cInf: 0 };
  let i = 0;
  while (i + 1 < dof.length && f >= dof[i + 1].f) i++;
  const d = dof[i], p = dof[Math.max(0, i - 1)];
  const k = d.dur ? clamp01((f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

/** Lens focus point at frame `f`: DOF focus override if present, else camera look point. */
export const evalFocus = (dof: DofBeat[], cam: Cam, f: number): V3 => {
  const d = evalDof(dof, f);
  return d.focus ? d.focus(f) : cam.look;
};
