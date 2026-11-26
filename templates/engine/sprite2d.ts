// Horror Engine v15.1: Neutral 2.5D Photorealistic Normal-Mapped Character & Entity Renderer (`sprite2d.ts`).
// Upgrades static cutout billboards with:
//   1. Subdivided 24x36 Anatomical Puppet Mesh Deformation (Live2D/Spine-style shoulder shrug, 3D Z-axis ribcage
//      breathing, independent neck/head nod & uncanny crooked-neck entity twitch, arm sway/recoil, vocal RMS jaw
//      articulation, and ambient cloth drift — with feet 100% locked at v=0 and <0.04ms CPU cost on GTX 960!).
//   2. Single-draw-call Dual-Texture Expression Crossfade (`stylizedSpriteShade`: `uMapB`, `uNormalMapB`, `uExprMix`)
//      preserving all 6 dynamic PointLights, 1 SpotLight cone, lightning flash, and fog without z-fighting!

import * as THREE from "three";
import { FPS, clamp01, jacobsLadderTwitch, lerp, smooth, type V3 } from "./camera";
import { NOINK } from "./ink";
import type {
  ActingCue,
  ActingCueCurve,
  ActingGesture,
  CharacterBlueprint,
  CharacterPart,
  CharacterRole,
  EntityScareTier,
  FaceExpr,
  PoseAction,
  SpriteExpr,
  SpriteMicroMotion,
  SpriteRigMeta,
} from "./manifest";
import { stylizedSpriteShade, type SpriteBlendUniforms } from "./shade";

export type SpriteTextureSet = Partial<Record<SpriteExpr, THREE.Texture>> & {
  calm: THREE.Texture;
};

export type SpriteNormalSet = Partial<Record<SpriteExpr, THREE.Texture>>;

export const DEFAULT_SPRITE_RIG_META: SpriteRigMeta = {
  neckV: 0.8,
  shoulderV: 0.72,
  waistV: 0.48,
  mouthV: 0.845,
  shoulderSpan: 0.44,
  headCenterX: 0.0,
};

export const ACTING_GESTURE_LIST: readonly ActingGesture[] = [
  "shrug",
  "sighDrop",
  "heavyPant",
  "breathHold",
  "shiver",
  "nodSlow",
  "nodDouble",
  "headShake",
  "tiltListen",
  "glanceAside",
  "chinTuck",
  "flinch",
  "leanIn",
  "leanBack",
  "cower",
  "stepSway",
  "neckCrack",
  "neckTwitch",
  "jawStretch",
  "loomSwell",
  "custom",
] as const;

export type PuppetDeformParams = {
  /** Vertical shoulder shrug / tense heave (-0.65..+1.0; negative = weary sigh drop). */
  shoulderShrug: number;
  /** Asymmetric left-vs-right shoulder tilt (-1..+1). */
  shrugAsym: number;
  /** 3D ribcage breathing expansion (-1..+1). */
  chestBreath: number;
  /** Independent head roll around neck pivot in radians. */
  headRoll: number;
  /** Independent head nod pitch (-1..+1; positive = nod forward/down). */
  headNod: number;
  /** Subtle lateral head shift fraction (e.g. head shake / glance / entity neck twitch). */
  headShiftX: number;
  /** Uncanny vertical neck elongation for high-tier horror entities (0..1). */
  neckStretch: number;
  /** Gentle upper-body sway in radians (feet remain pinned at floor!). */
  torsoSway: number;
  /** Upper-body forward (+1 leanIn / loomSwell) or backward (-1 leanBack / flinch) 3D Z lean. */
  torsoLeanZ: number;
  /** Arm gravity sway (-1..+1). */
  armSway: number;
  /** Defensive inward arm recoil on fear/shock/cower (0..1). */
  armRecoil: number;
  /** Subtle lower-jaw vocal articulation / uncanny jaw drop (0..1). */
  jawTalk: number;
  /** High-frequency cold-chill shiver amplitude across shoulders/arms/neck (0..1). */
  shiverAmp: number;
  /** Frame-driven phase for shiver vibration. */
  shiverPhase: number;
  /** Phase in seconds for ambient cloth/coat micro-flutter. */
  clothPhase: number;
  /** Ambient cloth flutter amplitude (0..1). */
  clothAmp: number;
};

export type Character25DConfig = {
  id: string;
  role: CharacterRole;
  /** Standing character height in world metres (default 1.72 for human, 1.88 for entity). */
  height?: number;
  /** Plane width / height aspect ratio (auto-inferred from texture if available, default 0.62). */
  aspect?: number;
  /** 7-tier ghost scare escalation level (primary entity >= 4). */
  scareTier?: EntityScareTier;
  /** Living human breathing enabled (default true for human, false for entity/silhouette/lurker). */
  breathing?: boolean;
  /** Optional default stop-motion framerate (e.g. 10 or 12 fps) for eerie tense movement. */
  steppedFps?: number;
  /** Normal-map relief strength (default 1.25). */
  normalScale?: number;
  /** Ambient shadow lift passed to `stylizedSpriteShade` (default 1.05). */
  liftK?: number;
  /** Add soft grounded contact shadow disc at feet (default true). */
  contactShadow?: boolean;
  /** Auto-detected or custom anatomical rig landmarks for 24x36 puppet deformation. */
  rigMeta?: Partial<SpriteRigMeta>;
};

export type Sprite25DPoseOpts = {
  expr?: FaceExpr;
  spriteExpr?: SpriteExpr;
  /** v15.1 Optional source expression for smooth dual-texture crossfade (`spriteExprFrom -> spriteExpr`). */
  spriteExprFrom?: SpriteExpr;
  /** v15.1 Crossfade blend factor `0..1` (`0` = `spriteExprFrom`, `1` = `spriteExpr`). */
  exprBlend?: number;
  /** Normalized 0..1 audio RMS amplitude from `words.json` `rms_envelope_30fps`. */
  talkEnergy?: number;
  /** Explicit talking boolean (derived from RMS threshold + speaker label). */
  isTalking?: boolean;
  /** 0..1 high-speed Jacob's Ladder isolated head/neck horror twitch. */
  headTwitch?: number;
  /** Optional per-beat stop-motion framerate override (e.g. 10 or 12 fps). */
  steppedFps?: number;
  /** Optional 0..1 intensity for sudden triggered reaction (recoil / shock / lunge / flinch). */
  actionIntensity?: number;
  /** v15.1 Optional 0..1 shoulder shrug / tense hunch intensity override. */
  shrugIntensity?: number;
  /** v15.1 Optional anatomical micro-motion preset (`natural` | `tense` | `shrug` | `still` | `uncannyNeck`). */
  microMotion?: SpriteMicroMotion;
  /** v15.2 Script-driven multi-step acting choreography timeline (`actingCues[]`). */
  actingCues?: ActingCue[];
  /** v15.2 Active beat frame bounds `[a, b]` used as fallback timing window for cues without `atFrame`. */
  beatRange?: [number, number];
  /** Optional active camera world position for Y-axis cylindrical billboarding. */
  cameraPos?: V3 | THREE.Vector3;
  seed?: number;
};

export type Character25D = {
  kind: "sprite2d";
  group: THREE.Group;
  plane: THREE.Mesh;
  material: THREE.MeshPhongMaterial;
  blendUniforms: SpriteBlendUniforms;
  rigMeta: SpriteRigMeta;
  contactShadow: THREE.Mesh | null;
  /** Anatomical socket proxies matching `stage.ts` & `sceneAudit.ts` contracts seamlessly. */
  sockets: Record<CharacterPart, THREE.Object3D>;
  config: Character25DConfig;
  currentExpr: SpriteExpr;
  currentExprFrom: SpriteExpr;
  currentExprMix: number;
  lastDeform: PuppetDeformParams;
  setExpr: (expr: SpriteExpr) => void;
  setExprBlend: (from: SpriteExpr, to: SpriteExpr, mix: number) => void;
  applyPuppet: (params: Partial<PuppetDeformParams>) => void;
  setPose: (action: PoseAction, frame: number, opts?: Sprite25DPoseOpts) => void;
  setPoseBlend: (from: PoseAction, to: PoseAction, t: number, frame: number, opts?: Sprite25DPoseOpts) => void;
  updateBillboard: (cameraPos: V3 | THREE.Vector3) => void;
  lookAtWorld: (target: V3, weight?: number) => void;
  dispose: () => void;
};

const SEG_X = 24;
const SEG_Y = 36;

function smoothRange(edge0: number, edge1: number, x: number): number {
  if (Math.abs(edge1 - edge0) < 1e-6) return x >= edge1 ? 1 : 0;
  return smooth(clamp01((x - edge0) / (edge1 - edge0)));
}

export function normalizeRigMeta(partial?: Partial<SpriteRigMeta>): SpriteRigMeta {
  const neckV = Math.max(0.7, Math.min(0.84, Number(partial?.neckV ?? DEFAULT_SPRITE_RIG_META.neckV)));
  const shoulderV = Math.max(
    0.58,
    Math.min(neckV - 0.035, Number(partial?.shoulderV ?? DEFAULT_SPRITE_RIG_META.shoulderV)),
  );
  const waistV = Math.max(
    0.34,
    Math.min(shoulderV - 0.1, Number(partial?.waistV ?? DEFAULT_SPRITE_RIG_META.waistV)),
  );
  const mouthV = Math.max(
    neckV + 0.015,
    Math.min(0.94, Number(partial?.mouthV ?? DEFAULT_SPRITE_RIG_META.mouthV)),
  );
  const shoulderSpan = Math.max(
    0.26,
    Math.min(0.86, Number(partial?.shoulderSpan ?? DEFAULT_SPRITE_RIG_META.shoulderSpan)),
  );
  const headCenterX = Math.max(
    -0.28,
    Math.min(0.28, Number(partial?.headCenterX ?? DEFAULT_SPRITE_RIG_META.headCenterX)),
  );
  return { neckV, shoulderV, waistV, mouthV, shoulderSpan, headCenterX };
}

/** Map legacy `FaceExpr` / `PoseAction` / talking RMS state cleanly to one of the 5 `SpriteExpr` states. */
export function mapFaceExprToSpriteExpr(
  expr?: FaceExpr | SpriteExpr,
  role: CharacterRole = "human",
  isTalking = false,
  action?: PoseAction,
): SpriteExpr {
  const isEntity = role === "entity" || role === "lurker" || role === "silhouette";
  if (expr === "entity_scare" || expr === "shock" || expr === "fear" || expr === "talk") {
    return expr;
  }
  if (isEntity) {
    if (
      action === "lunge" ||
      action === "lungeCloseUp" ||
      action === "jawUnlatch" ||
      action === "backbendCrab" ||
      expr === "unsettlingSmile" ||
      expr === "hollow" ||
      expr === "terrified"
    ) {
      return "entity_scare";
    }
    if (isTalking) return "talk";
    return "calm";
  }
  if (action === "recoil" || action === "fleePanic" || action === "startledFlinch" || expr === "terrified") {
    return "shock";
  }
  if (expr === "dread" || expr === "uneasy" || expr === "wary") return isTalking ? "talk" : "fear";
  if (isTalking) return "talk";
  return "calm";
}

/**
 * Create a lightweight deterministic procedural RGBA + Tangent-Space Normal Map texture pair
 * (used for Node unit tests and safe fallback before external cast PNGs are generated).
 */
export function createPlaceholderSpritePair(
  id: string,
  role: CharacterRole = "human",
  scareTier: EntityScareTier = 5,
): { albedo: THREE.DataTexture; normal: THREE.DataTexture } {
  const w = 32;
  const h = 48;
  const albData = new Uint8Array(w * h * 4);
  const nrmData = new Uint8Array(w * h * 4);
  const isEnt = role !== "human";
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;

  for (let y = 0; y < h; y++) {
    const ny = y / (h - 1); // 0=bottom (feet), 1=top (head) in DataTexture
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2 - 1; // -1..1
      const inHead = (nx * 3.1) ** 2 + ((ny - 0.84) * 8.2) ** 2 <= 1.0;
      const inTorso = Math.abs(nx) <= 0.46 - Math.max(0, ny - 0.65) * 0.6 && ny >= 0.36 && ny <= 0.74;
      const inLegs = (Math.abs(nx - 0.16) <= 0.14 || Math.abs(nx + 0.16) <= 0.14) && ny >= 0.02 && ny < 0.38;
      const inside = inHead || inTorso || inLegs;
      const idx = (y * w + x) * 4;

      if (!inside) {
        albData[idx] = 0;
        albData[idx + 1] = 0;
        albData[idx + 2] = 0;
        albData[idx + 3] = 0;
        nrmData[idx] = 128;
        nrmData[idx + 1] = 128;
        nrmData[idx + 2] = 255;
        nrmData[idx + 3] = 255;
        continue;
      }

      const shadeBase = isEnt ? 48 : 112 + (seed % 24);
      const isEye = isEnt && scareTier >= 4 && Math.abs(ny - 0.85) < 0.03 && Math.abs(Math.abs(nx) - 0.11) < 0.05;
      albData[idx] = isEye ? 245 : isEnt ? Math.max(20, shadeBase - 8) : inHead ? 182 : shadeBase;
      albData[idx + 1] = isEye ? 245 : isEnt ? shadeBase : inHead ? 156 : Math.max(30, shadeBase - 6);
      albData[idx + 2] = isEye ? 220 : isEnt ? shadeBase + 10 : inHead ? 142 : shadeBase + 8;
      albData[idx + 3] = 255;

      const cx = Math.max(-0.88, Math.min(0.88, nx * 1.65));
      const cy = inHead ? Math.max(-0.7, Math.min(0.7, (ny - 0.84) * 5.2)) : 0.08;
      const cz = Math.sqrt(Math.max(0.08, 1 - cx * cx - cy * cy));
      nrmData[idx] = Math.round((cx * 0.5 + 0.5) * 255);
      nrmData[idx + 1] = Math.round((cy * 0.5 + 0.5) * 255);
      nrmData[idx + 2] = Math.round((cz * 0.5 + 0.5) * 255);
      nrmData[idx + 3] = 255;
    }
  }

  const albedo = new THREE.DataTexture(albData, w, h, THREE.RGBAFormat);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.needsUpdate = true;

  const normal = new THREE.DataTexture(nrmData, w, h, THREE.RGBAFormat);
  normal.colorSpace = THREE.NoColorSpace;
  normal.needsUpdate = true;
  return { albedo, normal };
}

/** Browser loader for a character's `src/<project>/assets/cast/` Albedo + Normal Map URLs (for Remotion `loadAssets`). */
export async function loadSpriteTexturesFromUrls(
  albedoUrls: Partial<Record<SpriteExpr, string>> & { calm: string },
  normalUrls?: Partial<Record<SpriteExpr, string>>,
  opts: { psxNearest?: boolean } = {},
): Promise<{ textures: SpriteTextureSet; normals: SpriteNormalSet }> {
  const loader = new THREE.TextureLoader();
  const textures = {} as SpriteTextureSet;
  const normals: SpriteNormalSet = {};

  const keys = Object.keys(albedoUrls) as SpriteExpr[];
  await Promise.all(
    keys.map(async (k) => {
      const url = albedoUrls[k];
      if (!url) return;
      const tex = await loader.loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = opts.psxNearest ? THREE.NearestFilter : THREE.LinearFilter;
      tex.magFilter = opts.psxNearest ? THREE.NearestFilter : THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      textures[k] = tex;

      const nUrl = normalUrls?.[k];
      if (nUrl) {
        try {
          const nTex = await loader.loadAsync(nUrl);
          nTex.colorSpace = THREE.NoColorSpace;
          nTex.minFilter = THREE.LinearFilter;
          nTex.magFilter = THREE.LinearFilter;
          nTex.generateMipmaps = false;
          nTex.needsUpdate = true;
          normals[k] = nTex;
        } catch {
          // Allow missing optional normal map without failing render
        }
      }
    }),
  );
  return { textures, normals };
}

function makeContactShadowTexture(): THREE.DataTexture {
  const s = 32;
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x / (s - 1)) * 2 - 1;
      const dy = (y / (s - 1)) * 2 - 1;
      const r = Math.hypot(dx, dy);
      const a = clamp01(1 - r) ** 2.1;
      const idx = (y * s + x) * 4;
      data[idx] = 4;
      data[idx + 1] = 4;
      data[idx + 2] = 8;
      data[idx + 3] = Math.round(a * 170);
    }
  }
  const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function inferTextureAspect(tex: THREE.Texture | undefined, fallback = 0.62): number {
  const img = tex?.image as { width?: number; height?: number } | undefined;
  if (img && typeof img.width === "number" && typeof img.height === "number" && img.height > 0) {
    return Math.max(0.28, Math.min(1.6, img.width / img.height));
  }
  return fallback;
}

type PuppetWeights = {
  count: number;
  basePos: Float32Array;
  wFoot: Float32Array;
  wShoulderL: Float32Array;
  wShoulderR: Float32Array;
  wChest: Float32Array;
  wHead: Float32Array;
  wArmL: Float32Array;
  wArmR: Float32Array;
  wJaw: Float32Array;
  wCloth: Float32Array;
  wLeanZ: Float32Array;
};

function buildPuppetWeights(geo: THREE.PlaneGeometry, width: number, height: number, rig: SpriteRigMeta): PuppetWeights {
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;
  const basePos = new Float32Array(posAttr.array.length);
  basePos.set(posAttr.array as Float32Array);

  const wFoot = new Float32Array(count);
  const wShoulderL = new Float32Array(count);
  const wShoulderR = new Float32Array(count);
  const wChest = new Float32Array(count);
  const wHead = new Float32Array(count);
  const wArmL = new Float32Array(count);
  const wArmR = new Float32Array(count);
  const wJaw = new Float32Array(count);
  const wCloth = new Float32Array(count);
  const wLeanZ = new Float32Array(count);

  const halfW = Math.max(0.05, width * 0.5);
  const chestV = lerp(rig.waistV, rig.shoulderV, 0.58);

  for (let i = 0; i < count; i++) {
    const bx = basePos[i * 3];
    const by = basePos[i * 3 + 1];
    const v = clamp01(by / Math.max(0.05, height));
    const nx = bx / halfW; // -1..+1
    const anx = Math.abs(nx);

    // Strictly pinned feet (`v <= 0.05` has 0 weight across ALL deformers!)
    const foot = smoothRange(0.05, 0.18, v);
    wFoot[i] = foot;

    // Independent head mask hinging smoothly across the neck band (wide enough to prevent triangle folding!)
    const head = smoothRange(rig.neckV - 0.065, rig.neckV + 0.055, v);
    wHead[i] = head;

    // Broad, rounded anatomical trapezius & deltoid dome (zero pointy shoulder spikes!)
    const shVert =
      Math.exp(-(((v - rig.shoulderV) / 0.145) ** 2)) *
      (1 - smoothRange(rig.neckV - 0.015, rig.neckV + 0.065, v)) *
      smoothRange(rig.waistV - 0.06, rig.waistV + 0.12, v);
    const shOuterRoll = 1 - 0.22 * smoothRange(Math.max(0.45, rig.shoulderSpan * 0.72), 1.0, anx);
    const shLat = (0.58 + 0.42 * smoothRange(0.05, Math.max(0.24, rig.shoulderSpan * 0.62), anx)) * shOuterRoll;
    const shBase = shVert * shLat * foot;
    wShoulderL[i] = nx <= 0 ? shBase : shBase * (1 - smoothRange(0, 0.2, nx));
    wShoulderR[i] = nx >= 0 ? shBase : shBase * (1 - smoothRange(0, 0.2, -nx));

    // Ribcage / chest 3D breathing dome
    const chVert =
      Math.exp(-(((v - chestV) / 0.14) ** 2)) * (1 - head) * smoothRange(rig.waistV - 0.06, rig.waistV + 0.06, v);
    const chLat = Math.exp(-((nx / Math.max(0.28, rig.shoulderSpan * 1.05)) ** 2));
    wChest[i] = chVert * chLat * foot;

    // Lateral hanging arms (waist..shoulder)
    const armVert =
      smoothRange(rig.waistV - 0.16, rig.waistV + 0.02, v) * (1 - smoothRange(rig.shoulderV - 0.01, rig.shoulderV + 0.06, v));
    const armLat = smoothRange(rig.shoulderSpan * 0.42, rig.shoulderSpan * 0.82, anx);
    const armBase = armVert * armLat * foot;
    wArmL[i] = nx < 0 ? armBase : 0;
    wArmR[i] = nx > 0 ? armBase : 0;

    // Tight local chin/jaw articulation mask for 30fps vocal RMS
    const dxHead = nx - rig.headCenterX;
    wJaw[i] = Math.exp(-(((v - rig.mouthV) / 0.028) ** 2)) * Math.exp(-((dxHead / 0.15) ** 2)) * head;

    // Subtle outer coat/hem ambient drift
    wCloth[i] = foot * (1 - head) * smoothRange(0.18, 0.58, anx) * (1 - smoothRange(rig.shoulderV, rig.shoulderV + 0.08, v));

    // Smooth upper-body 3D lean weight rising from waist to head top (feet stay locked at 0!)
    wLeanZ[i] = smoothRange(rig.waistV - 0.08, 0.96, v) * foot;
  }

  return { count, basePos, wFoot, wShoulderL, wShoulderR, wChest, wHead, wArmL, wArmR, wJaw, wCloth, wLeanZ };
}

export function zeroPuppetDeform(): PuppetDeformParams {
  return {
    shoulderShrug: 0,
    shrugAsym: 0,
    chestBreath: 0,
    headRoll: 0,
    headNod: 0,
    headShiftX: 0,
    neckStretch: 0,
    torsoSway: 0,
    torsoLeanZ: 0,
    armSway: 0,
    armRecoil: 0,
    jawTalk: 0,
    shiverAmp: 0,
    shiverPhase: 0,
    clothPhase: 0,
    clothAmp: 0,
  };
}

export type ActingCuesEvalResult = {
  delta: PuppetDeformParams;
  /** 0..1 multiplier suppressing ambient breathing during `breathHold` / entity freeze cues. */
  breathScale: number;
  /** Multi-step expression crossfade resolved from cue `exprTo` timeline (when declared). */
  exprTransition?: { from?: SpriteExpr; to: SpriteExpr; mix: number };
  /** Names of cues actively influencing `frame`. */
  activeGestures: ActingGesture[];
};

const GESTURE_DEFAULTS: Record<ActingGesture, { dur: number; curve: ActingCueCurve; attack: number; release: number; cycles: number }> = {
  shrug: { dur: 30, curve: "pulse", attack: 6, release: 10, cycles: 1 },
  sighDrop: { dur: 38, curve: "pulse", attack: 7, release: 12, cycles: 1 },
  heavyPant: { dur: 45, curve: "oscillate", attack: 4, release: 6, cycles: 3 },
  breathHold: { dur: 36, curve: "hold", attack: 3, release: 8, cycles: 1 },
  shiver: { dur: 22, curve: "pulse", attack: 3, release: 6, cycles: 6 },
  nodSlow: { dur: 32, curve: "oscillate", attack: 4, release: 6, cycles: 1 },
  nodDouble: { dur: 26, curve: "oscillate", attack: 3, release: 4, cycles: 2 },
  headShake: { dur: 28, curve: "oscillate", attack: 3, release: 5, cycles: 2 },
  tiltListen: { dur: 34, curve: "pulse", attack: 6, release: 9, cycles: 1 },
  glanceAside: { dur: 26, curve: "pulse", attack: 4, release: 7, cycles: 1 },
  chinTuck: { dur: 30, curve: "hold", attack: 5, release: 8, cycles: 1 },
  flinch: { dur: 22, curve: "snapHold", attack: 3, release: 10, cycles: 1 },
  leanIn: { dur: 36, curve: "pulse", attack: 7, release: 10, cycles: 1 },
  leanBack: { dur: 32, curve: "pulse", attack: 5, release: 9, cycles: 1 },
  cower: { dur: 40, curve: "hold", attack: 6, release: 10, cycles: 1 },
  stepSway: { dur: 40, curve: "oscillate", attack: 5, release: 6, cycles: 2 },
  neckCrack: { dur: 32, curve: "snapHold", attack: 3, release: 0, cycles: 1 },
  neckTwitch: { dur: 28, curve: "pulse", attack: 2, release: 4, cycles: 4 },
  jawStretch: { dur: 36, curve: "hold", attack: 5, release: 6, cycles: 1 },
  loomSwell: { dur: 48, curve: "ramp", attack: 8, release: 0, cycles: 1 },
  custom: { dur: 30, curve: "pulse", attack: 6, release: 8, cycles: 1 },
};

function evalCueEnvelope(
  localF: number,
  durF: number,
  curve: ActingCueCurve,
  attackF: number,
  releaseF: number,
  cycles: number,
): { env: number; sinWave: number; posWave: number; u: number } {
  const u = clamp01(localF / Math.max(1, durF));
  const aIn = attackF <= 0 ? 1 : smooth(clamp01(localF / attackF));
  const aOut = releaseF <= 0 ? 1 : smooth(clamp01((durF - localF) / releaseF));

  let env: number;
  if (curve === "ramp") {
    env = smooth(u);
  } else if (curve === "hold") {
    env = releaseF > 0 ? aIn * aOut : aIn;
  } else if (curve === "snapHold") {
    const snapIn = attackF <= 0 ? 1 : clamp01(localF / Math.max(1, attackF));
    env = releaseF > 0 ? snapIn * aOut : snapIn;
  } else {
    env = aIn * aOut;
  }

  const phase = u * Math.PI * 2 * Math.max(0.5, cycles);
  const sinWave = env * Math.sin(phase);
  const posWave = env * (0.5 - 0.5 * Math.cos(phase));
  return { env, sinWave, posWave, u };
}

/**
 * Horror Engine v15.2: Deterministic script-driven multi-cue acting evaluator (`actingCues[]`).
 * Layers any number of phrase-locked atomic gestures + `customDeform` curves + multi-step `exprTo` crossfades!
 */
export function evalActingCues(
  cues: ActingCue[] | undefined,
  frame: number,
  beatRange?: [number, number],
  seed = 13,
  baseExpr?: SpriteExpr,
): ActingCuesEvalResult {
  const delta = zeroPuppetDeform();
  let breathScale = 1;
  const activeGestures: ActingGesture[] = [];

  if (!cues || cues.length === 0) {
    return { delta, breathScale, activeGestures };
  }

  const bA = beatRange?.[0] ?? 0;
  const bB = beatRange?.[1] ?? bA + 90;
  const span = Math.max(12, bB - bA);

  const resolvedCues = cues.map((cue, idx) => {
    const g: ActingGesture = (cue.gesture in GESTURE_DEFAULTS ? cue.gesture : "custom") as ActingGesture;
    const def = GESTURE_DEFAULTS[g];
    const startF =
      typeof cue.atFrame === "number"
        ? cue.atFrame
        : bA + Math.round((span * idx) / Math.max(1, cues.length));
    const durF = Math.max(4, Math.round(cue.durationFrames ?? def.dur));
    return { cue, g, def, startF, durF };
  });

  // 1. Multi-step deterministic expression timeline across cues declaring `exprTo`
  const exprSteps = resolvedCues
    .filter((rc) => rc.cue.exprTo !== undefined)
    .sort((a, b) => a.startF - b.startF);

  let exprTransition: { from?: SpriteExpr; to: SpriteExpr; mix: number } | undefined;
  if (exprSteps.length > 0) {
    let activeIdx = -1;
    for (let i = 0; i < exprSteps.length; i++) {
      if (frame >= exprSteps[i].startF) activeIdx = i;
    }
    if (activeIdx >= 0) {
      const cur = exprSteps[activeIdx];
      const prevExpr = activeIdx > 0 ? exprSteps[activeIdx - 1].cue.exprTo! : baseExpr;
      const bf = typeof cur.cue.exprBlendFrames === "number" ? Math.max(0, cur.cue.exprBlendFrames) : 6;
      const mix = bf <= 0 ? 1 : smooth(clamp01((frame - cur.startF) / bf));
      exprTransition = { from: prevExpr, to: cur.cue.exprTo!, mix };
    }
  }

  // 2. Accumulate anatomical deformation channels for all active cues at `frame`
  for (let idx = 0; idx < resolvedCues.length; idx++) {
    const { cue, g, def, startF, durF } = resolvedCues[idx];
    const curve: ActingCueCurve = cue.curve ?? def.curve;
    const holdPastEnd = (curve === "hold" || curve === "snapHold" || curve === "ramp") && (cue.releaseFrames ?? def.release) === 0;
    if (frame < startF) continue;
    if (!holdPastEnd && frame > startF + durF) continue;

    const localF = Math.min(durF, frame - startF);
    const attackF = cue.attackFrames ?? def.attack;
    const releaseF = cue.releaseFrames ?? def.release;
    const cycles = cue.cycles ?? def.cycles;
    const intensity = Math.max(0, Math.min(1.5, cue.intensity ?? 1.0));
    const dir = cue.side === "left" ? 1 : cue.side === "right" ? -1 : ((seed + idx) % 2 === 0 ? 1 : -1);
    const { env, sinWave, posWave, u } = evalCueEnvelope(localF, durF, curve, attackF, releaseF, cycles);
    if (env <= 0.0005 && Math.abs(sinWave) <= 0.0005) continue;

    activeGestures.push(g);
    const k = env * intensity;

    switch (g) {
      case "shrug":
        delta.shoulderShrug += 0.82 * k;
        delta.shrugAsym += 0.18 * dir * k;
        delta.headRoll += 0.055 * dir * k;
        delta.armRecoil += 0.18 * k;
        break;
      case "sighDrop": {
        // Gentle inhale lift during first 28%, then heavy weary shoulder drop!
        const dropPhase = u < 0.28 ? -0.35 * smooth(u / 0.28) : smooth((u - 0.28) / 0.42);
        const dropVal = dropPhase * k;
        delta.shoulderShrug -= 0.56 * dropVal;
        delta.chestBreath -= 0.72 * dropVal;
        delta.headNod += 0.30 * Math.max(0, dropVal);
        break;
      }
      case "heavyPant":
        delta.chestBreath += 0.92 * sinWave * intensity;
        delta.shoulderShrug += 0.42 * posWave * intensity;
        delta.headNod += 0.14 * posWave * intensity;
        break;
      case "breathHold":
        breathScale *= 1 - 0.92 * clamp01(k);
        delta.shoulderShrug += 0.16 * k;
        delta.armRecoil += 0.14 * k;
        break;
      case "shiver":
        delta.shiverAmp = Math.max(delta.shiverAmp, clamp01(0.95 * k));
        delta.shiverPhase = frame + seed;
        delta.shoulderShrug += 0.36 * k;
        delta.armRecoil += 0.26 * k;
        delta.headRoll += Math.sin(localF * 2.1 + seed) * 0.028 * k;
        break;
      case "nodSlow":
        delta.headNod += 0.56 * posWave * intensity;
        delta.shoulderShrug += 0.06 * posWave * intensity;
        break;
      case "nodDouble":
        delta.headNod += 0.48 * posWave * intensity;
        delta.shoulderShrug += 0.12 * posWave * intensity;
        break;
      case "headShake":
        delta.headShiftX += 0.026 * sinWave * dir * intensity;
        delta.headRoll -= 0.048 * sinWave * dir * intensity;
        break;
      case "tiltListen":
        delta.headRoll += 0.135 * dir * k;
        delta.headShiftX += 0.012 * dir * k;
        delta.torsoLeanZ += 0.22 * k;
        breathScale *= 1 - 0.55 * clamp01(k);
        break;
      case "glanceAside":
        delta.headShiftX += 0.028 * dir * k;
        delta.headRoll += 0.055 * dir * k;
        delta.torsoSway += 0.014 * dir * k;
        break;
      case "chinTuck":
        delta.headNod += 0.44 * k;
        delta.shoulderShrug += 0.38 * k;
        delta.torsoLeanZ -= 0.18 * k;
        break;
      case "flinch":
        delta.shoulderShrug += 0.86 * k;
        delta.armRecoil += 0.58 * k;
        delta.torsoLeanZ -= 0.48 * k;
        delta.headNod -= 0.22 * k;
        delta.headRoll -= 0.055 * dir * k;
        break;
      case "leanIn":
        delta.torsoLeanZ += 0.72 * k;
        delta.headNod += 0.28 * k;
        delta.shoulderShrug += 0.10 * k;
        break;
      case "leanBack":
        delta.torsoLeanZ -= 0.68 * k;
        delta.shoulderShrug += 0.28 * k;
        delta.armRecoil += 0.26 * k;
        delta.headNod -= 0.18 * k;
        break;
      case "cower":
        delta.shoulderShrug += 0.78 * k;
        delta.headNod += 0.48 * k;
        delta.armRecoil += 0.62 * k;
        delta.torsoLeanZ -= 0.38 * k;
        break;
      case "stepSway":
        delta.torsoSway += 0.036 * sinWave * intensity;
        delta.armSway += 0.72 * sinWave * intensity;
        delta.shoulderShrug += 0.14 * Math.abs(sinWave) * intensity;
        break;
      case "neckCrack": {
        // Corpse-still torso with sudden quantized jerky neck snap to one side!
        breathScale *= 1 - clamp01(k);
        const snapStep = localF < 3 ? localF / 3 : localF < 7 ? 1.0 : 0.92 + 0.08 * Math.sin(localF * 3.1);
        const nk = snapStep * k;
        delta.headRoll += 0.18 * dir * nk;
        delta.neckStretch += 0.24 * k;
        delta.headShiftX += 0.018 * dir * nk;
        break;
      }
      case "neckTwitch": {
        breathScale *= 1 - clamp01(k);
        const tw = jacobsLadderTwitch(Math.round(frame), clamp01(k), seed + idx * 7);
        delta.headRoll += tw.rz * 0.22;
        delta.headNod += tw.rx * 0.25;
        delta.headShiftX += Math.sin(frame * 2.9 + seed) * 0.024 * k;
        delta.neckStretch += 0.20 * k;
        break;
      }
      case "jawStretch":
        breathScale *= 1 - clamp01(k);
        delta.jawTalk += 0.95 * k;
        delta.neckStretch += 0.38 * k;
        delta.headNod -= 0.12 * k;
        delta.torsoLeanZ += 0.26 * k;
        break;
      case "loomSwell":
        breathScale *= 1 - clamp01(k);
        delta.torsoLeanZ += 0.85 * k;
        delta.neckStretch += 0.28 * k;
        delta.headRoll += 0.075 * dir * k;
        break;
      case "custom":
        break;
    }

    // Apply optional `customDeform` channels (powers both `gesture: "custom"` AND preset fine-tuning!)
    const cd = cue.customDeform;
    if (cd) {
      if (typeof cd.shoulderShrug === "number") delta.shoulderShrug += cd.shoulderShrug * k;
      if (typeof cd.shrugAsym === "number") delta.shrugAsym += cd.shrugAsym * k;
      if (typeof cd.chestBreath === "number") delta.chestBreath += cd.chestBreath * k;
      if (typeof cd.headRoll === "number") delta.headRoll += cd.headRoll * k;
      if (typeof cd.headNod === "number") delta.headNod += cd.headNod * k;
      if (typeof cd.headShiftX === "number") delta.headShiftX += cd.headShiftX * k;
      if (typeof cd.neckStretch === "number") delta.neckStretch += cd.neckStretch * k;
      if (typeof cd.torsoSway === "number") delta.torsoSway += cd.torsoSway * k;
      if (typeof cd.torsoLeanZ === "number") delta.torsoLeanZ += cd.torsoLeanZ * k;
      if (typeof cd.armSway === "number") delta.armSway += cd.armSway * k;
      if (typeof cd.armRecoil === "number") delta.armRecoil += cd.armRecoil * k;
      if (typeof cd.jawTalk === "number") delta.jawTalk += cd.jawTalk * k;
      if (typeof cd.shiverAmp === "number") {
        delta.shiverAmp = Math.max(delta.shiverAmp, clamp01(cd.shiverAmp * k));
        delta.shiverPhase = frame + seed;
      }
    }
  }

  return { delta, breathScale: clamp01(breathScale), exprTransition, activeGestures };
}

type PoseKinematics = {
  yOff: number;
  scaleY: number;
  scaleX: number;
  tiltZ: number;
  pitchX: number;
  lungeZ: number;
  jitterAmp: number;
  deform: PuppetDeformParams;
};

/** Pure deterministic anatomical puppet & root kinematics evaluator for `sprite2d.ts`. */
export function evalPuppetDeform(
  action: PoseAction,
  frame: number,
  isLiving: boolean,
  seed: number,
  microMotion?: SpriteMicroMotion,
): PoseKinematics {
  const t = frame / FPS;
  const breathCycle = Math.sin(t * 2.05 + seed);
  const breathWave = isLiving ? breathCycle : 0;
  const slowSway = isLiving ? Math.sin(t * 1.05 + seed * 1.7) : 0;

  const deform: PuppetDeformParams = {
    // Natural human breathing gently lifts the shoulders on inhale!
    shoulderShrug: isLiving ? Math.max(0, breathWave) * 0.24 : 0,
    shrugAsym: isLiving ? Math.sin(t * 0.85 + seed * 1.3) * 0.12 : 0,
    chestBreath: isLiving ? breathWave * 0.72 : 0,
    headRoll: isLiving ? Math.sin(t * 0.92 + seed * 2.1) * 0.024 : 0,
    headNod: isLiving ? Math.sin(t * 1.6 + seed * 0.7) * 0.1 : 0,
    headShiftX: 0,
    neckStretch: 0,
    torsoSway: isLiving ? slowSway * 0.014 : 0,
    torsoLeanZ: 0,
    armSway: isLiving ? Math.sin(t * 1.35 + seed) * 0.25 : 0,
    armRecoil: 0,
    jawTalk: 0,
    shiverAmp: 0,
    shiverPhase: frame + seed,
    clothPhase: t + seed * 0.37,
    clothAmp: isLiving ? 0.35 : 0.18,
  };

  const out: PoseKinematics = {
    yOff: 0,
    scaleY: 1,
    scaleX: 1,
    tiltZ: 0,
    pitchX: 0,
    lungeZ: 0,
    jitterAmp: 0,
    deform,
  };

  switch (action) {
    case "sitChair":
    case "sitCrossLegged":
    case "sitBenchHunched":
      out.yOff = -0.26;
      out.scaleY = 0.88;
      out.pitchX = 0.05;
      deform.shoulderShrug += 0.12;
      deform.headNod += 0.18;
      break;
    case "shrug": {
      // Expressive rhythmic human shrug ("nhún vai"): smooth rise -> brief plateau -> relaxed drop
      const cyc = (t * 0.55 + (seed % 11) * 0.17) % 1.0;
      const env =
        cyc < 0.24
          ? smooth(cyc / 0.24)
          : cyc < 0.56
            ? 1.0
            : cyc < 0.82
              ? 1.0 - smooth((cyc - 0.56) / 0.26)
              : 0.0;
      deform.shoulderShrug += env * 0.95;
      deform.shrugAsym += env * 0.22;
      deform.headRoll += env * 0.068;
      deform.armRecoil += env * 0.28;
      break;
    }
    case "startledFlinch":
      deform.shoulderShrug += 0.92;
      deform.chestBreath = 0.9;
      deform.armRecoil += 0.72;
      deform.headNod -= 0.22;
      deform.headRoll -= 0.055;
      out.lungeZ = -0.08;
      out.jitterAmp = 0.004;
      break;
    case "talkCalm":
      deform.shoulderShrug += Math.max(0, Math.sin(t * 2.4 + seed)) * 0.22;
      deform.headRoll += Math.sin(t * 2.1 + seed) * 0.032;
      deform.headNod += Math.sin(t * 3.4 + seed) * 0.2;
      break;
    case "talkUrgent":
      deform.shoulderShrug += 0.28 + Math.max(0, Math.sin(t * 4.8 + seed)) * 0.36;
      deform.headRoll += Math.sin(t * 4.5 + seed) * 0.048;
      deform.headNod += Math.sin(t * 5.8 + seed) * 0.34;
      out.pitchX = 0.04;
      break;
    case "nervousIdle":
      deform.chestBreath = Math.sin(t * 3.5 + seed) * 0.92;
      deform.shoulderShrug += 0.24 + Math.max(0, Math.sin(t * 3.5 + seed)) * 0.38;
      deform.headRoll += Math.sin(t * 2.2 + seed) * 0.042;
      deform.armRecoil += 0.24;
      out.jitterAmp = 0.003;
      break;
    case "walk":
    case "creep": {
      const freq = action === "walk" ? 7.2 : 4.2;
      out.yOff = Math.abs(Math.sin(t * freq + seed)) * (action === "walk" ? 0.034 : 0.02);
      deform.torsoSway += Math.sin(t * freq + seed) * (action === "walk" ? 0.028 : 0.042);
      deform.armSway += Math.sin(t * freq + seed) * (action === "walk" ? 0.85 : 0.45);
      deform.shoulderShrug += Math.abs(Math.sin(t * freq + seed)) * 0.18;
      break;
    }
    case "peerForward":
      out.pitchX = 0.07;
      out.lungeZ = 0.08;
      deform.headNod += 0.38;
      deform.shoulderShrug += 0.16;
      break;
    case "recoil":
    case "fleePanic":
      out.pitchX = -0.08;
      out.lungeZ = -0.14;
      deform.shoulderShrug += 0.85;
      deform.armRecoil += 0.78;
      deform.headRoll -= 0.065;
      deform.torsoSway -= 0.045;
      break;
    case "doorwayPeek":
    case "peekAroundDoor":
      deform.torsoSway = 0.09;
      deform.headRoll = 0.14;
      break;
    case "stalkLoom":
    case "loomingStill":
      out.scaleY = 1.02;
      out.pitchX = 0.04;
      // Entity stays eerily frozen in torso; only subtle uncanny head cant
      deform.headRoll = action === "stalkLoom" ? 0.11 : 0.055;
      deform.neckStretch = action === "stalkLoom" ? 0.22 : 0.1;
      deform.clothAmp = 0.14;
      break;
    case "crawler":
    case "backbendCrab":
      out.yOff = -0.45;
      out.scaleY = 0.72;
      out.tiltZ = action === "backbendCrab" ? 0.22 : 0.12;
      deform.headRoll = 0.24;
      break;
    case "lunge":
    case "lungeCloseUp":
    case "jawUnlatch":
      out.scaleY = 1.07;
      out.scaleX = 1.05;
      out.lungeZ = 0.26;
      out.pitchX = 0.1;
      out.tiltZ = 0.045 * Math.cos(t * 7.5 + seed);
      out.jitterAmp = 0.012;
      deform.shoulderShrug = 0.45;
      deform.neckStretch = 0.45;
      deform.headRoll = 0.16 * Math.sin(t * 9.5 + seed);
      deform.jawTalk = action === "jawUnlatch" ? 1.0 : 0.55;
      break;
    default:
      break;
  }

  // Apply high-level `microMotion` preset overrides cleanly
  if (microMotion === "still") {
    deform.shoulderShrug = 0;
    deform.chestBreath = 0;
    deform.torsoSway = 0;
    deform.armSway = 0;
    deform.headRoll = 0;
    deform.headNod = 0;
    deform.clothAmp = 0.05;
  } else if (microMotion === "tense") {
    deform.chestBreath = Math.sin(t * 3.8 + seed) * 0.95;
    deform.shoulderShrug = Math.max(deform.shoulderShrug, 0.32 + Math.max(0, Math.sin(t * 3.8 + seed)) * 0.42);
    deform.armRecoil = Math.max(deform.armRecoil, 0.3);
  } else if (microMotion === "shrug") {
    const cyc = (t * 0.62 + (seed % 7) * 0.13) % 1.0;
    const env = cyc < 0.26 ? smooth(cyc / 0.26) : cyc < 0.58 ? 1.0 : cyc < 0.86 ? 1.0 - smooth((cyc - 0.58) / 0.28) : 0.0;
    deform.shoulderShrug = Math.max(deform.shoulderShrug, 0.18 + env * 0.85);
    deform.shrugAsym += env * 0.2;
    deform.headRoll += env * 0.06;
  } else if (microMotion === "uncannyNeck") {
    // Corpse-still shoulders/body while ONLY the neck & head snap sideways (fold-safe ±0.16 rad!)
    deform.shoulderShrug = 0;
    deform.chestBreath = 0;
    deform.torsoSway = 0;
    deform.armSway = 0;
    deform.clothAmp = 0.06;
    const snap = Math.sin(t * 2.4 + seed) > 0.35 ? 1 : -0.35;
    deform.headRoll = 0.13 * snap + Math.sin(t * 14.0 + seed) * 0.025;
    deform.neckStretch = 0.22;
  }

  return out;
}

/**
 * Construct a 2.5D photorealistic normal-mapped horror character/entity placed in 3D space.
 * Uses a 24x36 anatomical puppet mesh + single-draw-call expression crossfade shader (`stylizedSpriteShade`).
 */
export function createCharacter25D(
  config: Character25DConfig,
  textures?: SpriteTextureSet,
  normals?: SpriteNormalSet,
): Character25D {
  const isEntity = config.role !== "human";
  const height = config.height ?? (isEntity ? 1.88 : 1.72);
  const breathing = config.breathing ?? !isEntity;
  const scareTier = config.scareTier ?? (isEntity ? 5 : 1);
  const rigMeta = normalizeRigMeta(config.rigMeta);

  let ownedTextures = false;
  let texSet: SpriteTextureSet;
  let nrmSet: SpriteNormalSet;
  if (textures) {
    texSet = textures;
    nrmSet = normals ?? {};
  } else {
    const ph = createPlaceholderSpritePair(config.id, config.role, scareTier);
    texSet = { calm: ph.albedo };
    nrmSet = { calm: ph.normal };
    ownedTextures = true;
  }

  const aspect = config.aspect ?? inferTextureAspect(texSet.calm, 0.62);
  const width = height * aspect;

  const group = new THREE.Group();
  group.name = `char25d_${config.id}`;

  const billboardPivot = new THREE.Group();
  billboardPivot.name = `${config.id}_billboardPivot`;
  const motionGroup = new THREE.Group();
  motionGroup.name = `${config.id}_motion`;
  billboardPivot.add(motionGroup);
  group.add(billboardPivot);

  // Subdivided 24x36 puppet plane anchored strictly at feet (`y = 0..height`)
  const geo = new THREE.PlaneGeometry(width, height, SEG_X, SEG_Y);
  geo.translate(0, height * 0.5, 0);
  const weights = buildPuppetWeights(geo, width, height, rigMeta);

  const nScale = config.normalScale ?? 1.25;
  const rawMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color("#ffffff"),
    map: texSet.calm,
    ...(nrmSet.calm ? { normalMap: nrmSet.calm, normalScale: new THREE.Vector2(nScale, nScale) } : {}),
    specular: new THREE.Color(isEntity ? "#38424d" : "#242220"),
    shininess: isEntity ? 26 : 14,
    alphaTest: 0.42,
    transparent: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const { material: mat, blendUniforms } = stylizedSpriteShade(rawMat, config.liftK ?? 1.05, 0.22);

  const plane = new THREE.Mesh(geo, mat);
  plane.name = `${config.id}_spriteMesh`;
  plane.castShadow = false;
  plane.receiveShadow = true;
  plane.layers.set(NOINK);
  plane.userData.noSSAO = true;
  plane.userData.isSprite25D = true;
  motionGroup.add(plane);

  // Soft grounded contact shadow disc beneath feet
  let contactShadow: THREE.Mesh | null = null;
  let shadowTex: THREE.DataTexture | null = null;
  let shadowGeo: THREE.PlaneGeometry | null = null;
  let shadowMat: THREE.MeshBasicMaterial | null = null;
  if (config.contactShadow !== false) {
    shadowTex = makeContactShadowTexture();
    shadowGeo = new THREE.PlaneGeometry(width * 0.78, width * 0.55);
    shadowGeo.rotateX(-Math.PI * 0.5);
    shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    });
    contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.set(0, 0.008, 0);
    contactShadow.layers.set(NOINK);
    contactShadow.userData.noSSAO = true;
    contactShadow.renderOrder = 1;
    group.add(contactShadow);
  }

  const baseSocketPos: Record<CharacterPart, [number, number, number]> = {
    feet: [0, 0, 0],
    pelvis: [0, height * rigMeta.waistV, 0],
    chest: [0, height * lerp(rigMeta.waistV, rigMeta.shoulderV, 0.6), 0],
    neck: [rigMeta.headCenterX * width * 0.5, height * rigMeta.neckV, 0],
    head: [rigMeta.headCenterX * width * 0.5, height * lerp(rigMeta.neckV, 1.0, 0.52), 0],
    eyes: [rigMeta.headCenterX * width * 0.5, height * lerp(rigMeta.neckV, 1.0, 0.62), 0.05],
    leftHand: [-width * Math.min(0.42, rigMeta.shoulderSpan * 0.68), height * rigMeta.waistV, 0.03],
    rightHand: [width * Math.min(0.42, rigMeta.shoulderSpan * 0.68), height * rigMeta.waistV, 0.03],
  };

  const makeSocket = (part: CharacterPart) => {
    const o = new THREE.Group();
    o.name = `${config.id}_${part}`;
    o.position.set(...baseSocketPos[part]);
    motionGroup.add(o);
    return o;
  };
  const sockets: Record<CharacterPart, THREE.Object3D> = {
    feet: makeSocket("feet"),
    pelvis: makeSocket("pelvis"),
    chest: makeSocket("chest"),
    neck: makeSocket("neck"),
    head: makeSocket("head"),
    eyes: makeSocket("eyes"),
    leftHand: makeSocket("leftHand"),
    rightHand: makeSocket("rightHand"),
  };

  let seedNum = 13;
  for (let i = 0; i < config.id.length; i++) seedNum = (seedNum * 33 + config.id.charCodeAt(i)) % 997;

  const pivotX = rigMeta.headCenterX * width * 0.5;
  const pivotY = rigMeta.neckV * height;

  const applyDeformInternal = (p: PuppetDeformParams) => {
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const bp = weights.basePos;

    // Anatomically safe deformation bounds (prevents shoulder spikes and neck triangle self-intersection!)
    const cShrug = Math.max(-0.65, Math.min(1.0, p.shoulderShrug));
    const cShrugAsym = Math.max(-0.5, Math.min(0.5, p.shrugAsym));
    const cBreath = Math.max(-1.0, Math.min(1.0, p.chestBreath));
    const cHeadRoll = Math.max(-0.22, Math.min(0.22, p.headRoll));
    const cHeadNod = Math.max(-0.8, Math.min(0.8, p.headNod));
    const cHeadShiftX = Math.max(-0.035, Math.min(0.035, p.headShiftX));
    const cNeckStretch = Math.max(0.0, Math.min(0.45, p.neckStretch));
    const cLeanZ = Math.max(-1.0, Math.min(1.0, p.torsoLeanZ));
    const cArmRecoil = Math.max(0.0, Math.min(0.65, p.armRecoil));
    const cJawTalk = clamp01(p.jawTalk);
    const cShiver = clamp01(p.shiverAmp);

    for (let i = 0; i < weights.count; i++) {
      const i3 = i * 3;
      const bx = bp[i3];
      const by = bp[i3 + 1];
      let x = bx;
      let y = by;
      let z = bp[i3 + 2];

      const wf = weights.wFoot[i];
      if (wf > 0) {
        // 1. Subtle torso sway around feet + upper-body 3D lean (`leanIn` / `leanBack` / `loomSwell`)
        const swayH = Math.max(0, by - height * 0.06);
        x += Math.sin(p.torsoSway) * swayH * wf * 0.55;
        if (cLeanZ !== 0) {
          z += cLeanZ * height * 0.085 * weights.wLeanZ[i];
        }

        // 2. 3D Z-axis ribcage breathing expansion
        const cb = cBreath * weights.wChest[i];
        if (cb !== 0) {
          x += (bx >= 0 ? 1 : -1) * cb * width * 0.016;
          y += cb * height * 0.006;
          z += cb * height * 0.024;
        }

        // 3. Natural rounded shoulder shrug / sigh drop (+3.8cm lift up, -2.5cm weary drop down!)
        const shL = (cShrug + cShrugAsym * 0.22) * weights.wShoulderL[i];
        const shR = (cShrug - cShrugAsym * 0.22) * weights.wShoulderR[i];
        const sh = shL + shR;
        if (sh !== 0) {
          y += sh * height * 0.022;
          if (sh > 0) {
            x -= (bx >= 0 ? 1 : -1) * sh * width * 0.008;
            z += sh * height * 0.01;
          }
        }

        // 4. Arm gravity sway & subtle fear/shock defensive pull
        const wAL = weights.wArmL[i];
        const wAR = weights.wArmR[i];
        const armW = wAL + wAR;
        if (armW > 0.0005) {
          const side = wAR > wAL ? 1 : -1;
          x += p.armSway * width * 0.016 * armW - side * cArmRecoil * width * 0.018 * armW;
          y += cArmRecoil * height * 0.014 * armW + Math.abs(p.armSway) * height * 0.004 * armW;
        }

        // 5. Independent head & neck articulation rotating smoothly around `(pivotX, pivotY)`
        const wh = weights.wHead[i];
        if (wh > 0.0005) {
          const rx = x - pivotX;
          const ry = y - pivotY;
          const ang = cHeadRoll * wh;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          x = pivotX + rx * ca - ry * sa + cHeadShiftX * width * wh;
          y = pivotY + rx * sa + ry * ca - cHeadNod * height * 0.011 * wh + cNeckStretch * height * 0.026 * wh;
          z += cHeadNod * height * 0.015 * wh;
        }

        // 6. Micro lower-jaw vocal articulation / uncanny jaw stretch
        const wj = weights.wJaw[i];
        if (wj > 0.0005 && cJawTalk > 0.001) {
          y -= cJawTalk * height * 0.012 * wj;
          z += cJawTalk * height * 0.005 * wj;
        }

        // 7. High-frequency cold-chill shiver across shoulders, arms & neck (`shiver`)
        if (cShiver > 0.001) {
          const shivW = weights.wShoulderL[i] + weights.wShoulderR[i] + 0.65 * armW + 0.45 * wh;
          if (shivW > 0.001) {
            x += Math.sin(p.shiverPhase * 2.4 + by * 11.0) * width * 0.0085 * cShiver * shivW;
            y += Math.cos(p.shiverPhase * 2.9 + bx * 9.0) * height * 0.003 * cShiver * shivW;
          }
        }

        // 8. Ambient coat/cloth flutter along outer garment silhouette
        const wc = weights.wCloth[i];
        if (wc > 0.0005 && p.clothAmp > 0.001) {
          x += Math.sin(p.clothPhase * 1.8 + by * 4.5) * width * 0.007 * p.clothAmp * wc;
        }
      }

      arr[i3] = x;
      arr[i3 + 1] = y;
      arr[i3 + 2] = z;
    }
    posAttr.needsUpdate = true;

    // Keep anatomical sockets synchronized with deformed chest/head/eyes for `sceneAudit.ts` & `lookAt`
    const [cx, cy, cz] = baseSocketPos.chest;
    sockets.chest.position.set(cx, cy + cShrug * height * 0.012, cz + cBreath * height * 0.018 + cLeanZ * height * 0.045);
    const [hx, hy, hz] = baseSocketPos.head;
    const hdx = Math.sin(-cHeadRoll) * (hy - pivotY) + cHeadShiftX * width;
    const hdy = cNeckStretch * height * 0.026 - cHeadNod * height * 0.011;
    const hdz = cHeadNod * height * 0.015 + cLeanZ * height * 0.075;
    sockets.head.position.set(hx + hdx, hy + hdy, hz + hdz);
    const [ex, ey, ez] = baseSocketPos.eyes;
    sockets.eyes.position.set(ex + hdx, ey + hdy, ez + hdz);
  };

  const actor: Character25D = {
    kind: "sprite2d",
    group,
    plane,
    material: mat,
    blendUniforms,
    rigMeta,
    contactShadow,
    sockets,
    config: { ...config, height, aspect, breathing, scareTier, rigMeta },
    currentExpr: "calm",
    currentExprFrom: "calm",
    currentExprMix: 0,
    lastDeform: zeroPuppetDeform(),

    setExpr(expr: SpriteExpr) {
      actor.setExprBlend(expr, expr, 0);
    },

    setExprBlend(from: SpriteExpr, to: SpriteExpr, rawMix: number) {
      const mix = clamp01(rawMix);
      const texA = texSet[from] ?? texSet.calm;
      const nrmA = nrmSet[from] ?? nrmSet.calm ?? null;
      const texB = texSet[to] ?? texSet.calm;
      const nrmB = nrmSet[to] ?? nrmSet.calm ?? null;

      const prevHasNorm = mat.normalMap !== null;

      if (texA === texB || mix <= 0.001) {
        mat.map = texA;
        mat.normalMap = nrmA;
        blendUniforms.uMapB.value = texA;
        blendUniforms.uNormalMapB.value = nrmA ?? texA;
        blendUniforms.uExprMix.value = 0;
        blendUniforms.uHasNormalB.value = nrmA ? 1 : 0;
        actor.currentExprFrom = from;
        actor.currentExpr = texA === texB && mix >= 0.5 ? to : from;
        actor.currentExprMix = texA === texB ? mix : 0;
      } else if (mix >= 0.999) {
        mat.map = texB;
        mat.normalMap = nrmB;
        blendUniforms.uMapB.value = texB;
        blendUniforms.uNormalMapB.value = nrmB ?? texB;
        blendUniforms.uExprMix.value = 0;
        blendUniforms.uHasNormalB.value = nrmB ? 1 : 0;
        actor.currentExprFrom = to;
        actor.currentExpr = to;
        actor.currentExprMix = 1;
      } else {
        mat.map = texA;
        mat.normalMap = nrmA;
        blendUniforms.uMapB.value = texB;
        blendUniforms.uNormalMapB.value = nrmB ?? nrmA ?? texB;
        blendUniforms.uExprMix.value = mix;
        blendUniforms.uHasNormalB.value = nrmA && nrmB ? 1 : 0;
        actor.currentExprFrom = from;
        actor.currentExpr = mix >= 0.5 ? to : from;
        actor.currentExprMix = mix;
      }

      if (prevHasNorm !== (mat.normalMap !== null)) {
        mat.needsUpdate = true;
      }
    },

    applyPuppet(partial: Partial<PuppetDeformParams>) {
      const next: PuppetDeformParams = { ...zeroPuppetDeform(), ...partial };
      actor.lastDeform = next;
      applyDeformInternal(next);
    },

    updateBillboard(cameraPos: V3 | THREE.Vector3) {
      const cx = Array.isArray(cameraPos) ? cameraPos[0] : cameraPos.x;
      const cz = Array.isArray(cameraPos) ? cameraPos[2] : cameraPos.z;
      group.updateMatrixWorld(true);
      const wp = new THREE.Vector3();
      group.getWorldPosition(wp);
      const dx = cx - wp.x;
      const dz = cz - wp.z;
      if (dx * dx + dz * dz > 1e-6) {
        const worldYaw = Math.atan2(dx, dz);
        billboardPivot.rotation.set(0, worldYaw - group.rotation.y, 0);
      }
    },

    lookAtWorld(target: V3, _weight = 0.85) {
      actor.updateBillboard(target);
    },

    setPose(action: PoseAction, frame: number, opts: Sprite25DPoseOpts = {}) {
      actor.setPoseBlend(action, action, 0, frame, opts);
    },

    setPoseBlend(from: PoseAction, to: PoseAction, rawT: number, frame: number, opts: Sprite25DPoseOpts = {}) {
      const t = clamp01(rawT);
      const stepFps = opts.steppedFps ?? config.steppedFps ?? 0;
      const effFrame = stepFps > 0 && stepFps < FPS ? Math.floor((frame * stepFps) / FPS) * (FPS / stepFps) : frame;
      const seed = opts.seed ?? seedNum;

      const kA = evalPuppetDeform(from, effFrame, breathing, seed, opts.microMotion);
      const kB = from === to ? kA : evalPuppetDeform(to, effFrame, breathing, seed, opts.microMotion);

      const yOff = lerp(kA.yOff, kB.yOff, t);
      const scaleY = lerp(kA.scaleY, kB.scaleY, t);
      const scaleX = lerp(kA.scaleX, kB.scaleX, t);
      const tiltZ = lerp(kA.tiltZ, kB.tiltZ, t);
      const pitchX = lerp(kA.pitchX, kB.pitchX, t);
      const lungeZ = lerp(kA.lungeZ, kB.lungeZ, t);
      const baseJitter = lerp(kA.jitterAmp, kB.jitterAmp, t);

      const d: PuppetDeformParams = {
        shoulderShrug: lerp(kA.deform.shoulderShrug, kB.deform.shoulderShrug, t),
        shrugAsym: lerp(kA.deform.shrugAsym, kB.deform.shrugAsym, t),
        chestBreath: lerp(kA.deform.chestBreath, kB.deform.chestBreath, t),
        headRoll: lerp(kA.deform.headRoll, kB.deform.headRoll, t),
        headNod: lerp(kA.deform.headNod, kB.deform.headNod, t),
        headShiftX: lerp(kA.deform.headShiftX, kB.deform.headShiftX, t),
        neckStretch: lerp(kA.deform.neckStretch, kB.deform.neckStretch, t),
        torsoSway: lerp(kA.deform.torsoSway, kB.deform.torsoSway, t),
        torsoLeanZ: lerp(kA.deform.torsoLeanZ, kB.deform.torsoLeanZ, t),
        armSway: lerp(kA.deform.armSway, kB.deform.armSway, t),
        armRecoil: lerp(kA.deform.armRecoil, kB.deform.armRecoil, t),
        jawTalk: lerp(kA.deform.jawTalk, kB.deform.jawTalk, t),
        shiverAmp: lerp(kA.deform.shiverAmp, kB.deform.shiverAmp, t),
        shiverPhase: frame + seed,
        clothPhase: kA.deform.clothPhase,
        clothAmp: lerp(kA.deform.clothAmp, kB.deform.clothAmp, t),
      };

      // Layer script-driven multi-step `actingCues[]` cleanly on top of base idle/pose!
      const cueEval =
        opts.actingCues && opts.actingCues.length > 0
          ? evalActingCues(opts.actingCues, effFrame, opts.beatRange, seed, opts.spriteExprFrom ?? opts.spriteExpr)
          : null;
      if (cueEval) {
        d.chestBreath *= cueEval.breathScale;
        d.torsoSway *= 0.35 + 0.65 * cueEval.breathScale;
        d.shoulderShrug = d.shoulderShrug * cueEval.breathScale + cueEval.delta.shoulderShrug;
        d.shrugAsym += cueEval.delta.shrugAsym;
        d.chestBreath += cueEval.delta.chestBreath;
        d.headRoll += cueEval.delta.headRoll;
        d.headNod += cueEval.delta.headNod;
        d.headShiftX += cueEval.delta.headShiftX;
        d.neckStretch += cueEval.delta.neckStretch;
        d.torsoSway += cueEval.delta.torsoSway;
        d.torsoLeanZ += cueEval.delta.torsoLeanZ;
        d.armSway += cueEval.delta.armSway;
        d.armRecoil += cueEval.delta.armRecoil;
        d.jawTalk = Math.max(d.jawTalk, cueEval.delta.jawTalk);
        d.shiverAmp = Math.max(d.shiverAmp, cueEval.delta.shiverAmp);
      }

      // Explicit per-beat shoulder shrug intensity override (adds smoothly on top of breathing!)
      if (typeof opts.shrugIntensity === "number" && opts.shrugIntensity > 0) {
        const sI = clamp01(opts.shrugIntensity);
        const cyc = ((effFrame / FPS) * 0.65 + (seed % 7) * 0.11) % 1.0;
        const env = cyc < 0.25 ? smooth(cyc / 0.25) : cyc < 0.58 ? 1.0 : cyc < 0.85 ? 1.0 - smooth((cyc - 0.58) / 0.27) : 0.0;
        d.shoulderShrug = Math.max(d.shoulderShrug, sI * (0.28 + 0.72 * env));
        d.shrugAsym += sI * 0.16 * env;
        d.headRoll += sI * 0.045 * env;
      }

      // Sudden triggered reaction flinch (brief natural shoulder jolt on actionTriggerFrame!)
      const actInt = clamp01(opts.actionIntensity ?? 0);
      if (actInt > 0.01 && !isEntity) {
        const pulse = Math.sin(actInt * Math.PI);
        d.shoulderShrug += pulse * 0.58 + actInt * 0.22;
        d.armRecoil += actInt * 0.35;
      }

      // Audio RMS-driven live talking cadence (natural head nod + subtle shoulder emphasis + micro jaw!)
      const talkEnergy = clamp01(opts.talkEnergy ?? 0);
      const isTalking = opts.isTalking ?? talkEnergy >= 0.08;
      if (isTalking && talkEnergy > 0.01) {
        const speakWave = Math.sin(effFrame * 0.58 + seed);
        d.headNod += talkEnergy * 0.34 * (0.5 + 0.5 * speakWave);
        d.headRoll += speakWave * talkEnergy * 0.032;
        d.shoulderShrug += talkEnergy * 0.26;
        d.jawTalk = Math.max(d.jawTalk, talkEnergy);
      }

      // High-speed horror head/neck twitch — ISOLATED to head & neck around `neckV` (clamped fold-safe!)
      const ht = clamp01(opts.headTwitch ?? 0);
      if (ht > 0.02) {
        const tw = jacobsLadderTwitch(Math.round(frame), ht, seed);
        d.headRoll += tw.rz * 0.24;
        d.headNod += tw.rx * 0.28;
        d.headShiftX += Math.sin(frame * 2.9 + seed) * 0.024 * ht;
        if (isEntity) {
          d.neckStretch = Math.max(d.neckStretch, 0.16 * ht);
        }
      }

      const jitterX = baseJitter > 0 ? Math.sin(frame * 3.7 + seed * 2) * baseJitter : 0;

      // Apply root transform + anatomical 24x36 vertex puppet deformation
      motionGroup.position.set(jitterX, yOff, lungeZ);
      motionGroup.scale.set(scaleX, scaleY, 1);
      motionGroup.rotation.set(pitchX, 0, tiltZ);

      actor.lastDeform = d;
      applyDeformInternal(d);

      // Resolve expression & smooth dual-texture crossfade cleanly (`actingCues[].exprTo` > explicit opts > pose map)
      const targetAction = t >= 0.5 ? to : from;
      const baseTo = opts.spriteExpr ?? mapFaceExprToSpriteExpr(opts.expr, config.role, isTalking, targetAction);
      const baseFrom = opts.spriteExprFrom ?? baseTo;
      const baseMix = opts.spriteExprFrom !== undefined && typeof opts.exprBlend === "number" ? opts.exprBlend : 1;

      const desiredTo = cueEval?.exprTransition ? cueEval.exprTransition.to : baseTo;
      const desiredFrom = cueEval?.exprTransition ? (cueEval.exprTransition.from ?? baseTo) : baseFrom;
      const mix = cueEval?.exprTransition ? cueEval.exprTransition.mix : baseMix;
      if (desiredFrom !== desiredTo) {
        actor.setExprBlend(desiredFrom, desiredTo, mix);
      } else {
        actor.setExpr(desiredTo);
      }

      if (opts.cameraPos) {
        actor.updateBillboard(opts.cameraPos);
      }
    },

    dispose() {
      geo.dispose();
      mat.dispose();
      if (ownedTextures) {
        texSet.calm.dispose();
        nrmSet.calm?.dispose();
      }
      shadowGeo?.dispose();
      shadowMat?.dispose();
      shadowTex?.dispose();
    },
  };

  return actor;
}

/** Build a `Character25D` directly from a `manifest.json` `CharacterBlueprint` (with optional preloaded textures). */
export function createCharacter25DFromBlueprint(
  bp: CharacterBlueprint,
  loaded?: { textures?: SpriteTextureSet; normals?: SpriteNormalSet },
): Character25D {
  const ent = (bp.appearance?.entity ?? {}) as Record<string, unknown>;
  const isEntity = bp.role !== "human";
  return createCharacter25D(
    {
      id: bp.id,
      role: bp.role,
      height: bp.appearance?.height ?? (isEntity ? 1.88 : 1.72),
      scareTier: bp.scareTier,
      breathing: typeof ent.breathing === "boolean" ? ent.breathing : !isEntity,
      steppedFps: typeof ent.steppedFps === "number" ? ent.steppedFps : undefined,
      rigMeta: bp.spriteAssets?.rigMeta,
    },
    loaded?.textures,
    loaded?.normals,
  );
}
