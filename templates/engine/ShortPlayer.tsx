// Horror Engine v15.0: GTX 960 VRAM-Safe Unified Remotion + Three.js + 2.5D + Seamless AI Video Jumpscare Player.
// Key v15.0 Option A upgrades:
//   1. `lowVram` mode (ON by default for `psxHorror` or `lowVram: true`):
//      - Completely disables & skips allocating `OpaqueNormalPass`, `SSAOEffect`, and `LensBlur` (`pre` & `main`).
//      - Caps `BloomEffect` to <= 3 mipmap levels (or disabled via `bloom: false`) without 1080p upscaling.
//      - Renders WebGL internally at low `dpr` (`0.45` normal / `0.35` draft, ~486x864 -> 360x640 PSX grid) with crisp pixelated scaling.
//   2. Strictly ONE `<ThreeCanvas>` mounted at all times (zero dual WebGL contexts during `xfade`!).
//   3. Plays First-Frame-conditioned AI Video Jumpscare `.mp4` clips (`jumpscareClips[]`) directly through the EXACT SAME
//      `PostComposer` (`GradeEffect` -> `GrainEffect` -> `RetroPsxEffect`) strictly beneath `HorrorHUD`, ensuring 100% visual continuity!

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  getInputProps,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  EffectComposer as PostComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  SSAOEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import {
  CamVelocity,
  DofBeat,
  LightKey,
  ScreenBeat,
  ShotBase,
  aberrationAt,
  clamp01,
  evalDof,
  evalLayers,
  evalOverlays,
  lightningAt,
} from "./camera";
import { InkOptions, InkPass, NOINK, noInkFallback } from "./ink";
import { WhipMotionBlurEffect } from "./motionblur";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { DEF_PSX_OPTIONS, RetroPsxEffect, type PsxOptions } from "./retroPsx";
import { setLightningFlash, setPsxVertexSnap } from "./shade";
import { HorrorHUD, type HorrorHudConfig } from "./HorrorHUD";
import { auditSceneTargets } from "./sceneAudit";
import type { JumpscareClipSpec } from "./manifest";

export type RenderStyle = "psxHorror" | "semiReal" | "painterly" | "comic";

/** NormalPass that temporarily hides non-opaque / non-depth-writing FX so SSAO only occludes solid 3D geometry. */
class OpaqueNormalPass extends NormalPass {
  override render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget | null,
    outputBuffer: THREE.WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean,
  ) {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) return;
      const m = o as THREE.Mesh;
      if (
        (o as THREE.Sprite).isSprite ||
        (o as THREE.Points).isPoints ||
        (o as THREE.Line).isLine ||
        o.userData.noSSAO ||
        o.userData.isOutline
      ) {
        o.visible = false;
        hidden.push(o);
        return;
      }
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.some((x) => x && (x.depthWrite === false || (x.transparent && x.alphaTest <= 0)))) {
          o.visible = false;
          hidden.push(o);
        }
      }
    });
    try {
      super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    } finally {
      for (const o of hidden) o.visible = true;
    }
  }
}

export interface ShortWorld {
  root: THREE.Object3D;
  update(shotId: number, frame: number, camera: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3;
  syncLighting?(shotId: number, frame: number): void;
  getMotionVelocity?(shotId: number, frame: number, aspect: number, heightPx: number): CamVelocity;
  getLightBlend?(shotId: number, frame: number): { from?: LightKey; to: LightKey; t: number } | null;
  /** v12.0 Optional named 3D Object3D registry for 5-Layer Semantic Still Frustum & Raycast Audit! */
  getAuditTargets?(): Record<string, THREE.Object3D | null | undefined>;
  /** v12.0 Optional active Depth-of-Field focus target override (`Object3D` or world `[x, y, z]`). */
  getFocusTarget?(shotId: number, frame: number): THREE.Object3D | [number, number, number] | null | undefined;
  dispose?(): void;
}

export type ShortPlayerProps<TAssets = undefined> = {
  shots: ShotBase<LightKey>[];
  createWorld: (assets: TAssets) => ShortWorld;
  loadAssets?: () => Promise<TAssets>;
  dof?: DofBeat[];
  xfade?: Record<number, number>;
  flashes?: number[];
  overlays?: ScreenBeat[];
  hud?: HorrorHudConfig;
  /** v15.0 Hide HUD overlay cleanly (used by `render-stills.mjs --raw-anchor` to capture clean 3D jumpscare anchor frames). */
  hideHud?: boolean;
  renderStyle?: RenderStyle;
  /** v15.0 GTX 960 VRAM-safe mode (defaults `true` when `renderStyle === "psxHorror"`). Disables SSAO/LensBlur, caps Bloom <= 3 levels, lowers WebGL dpr to ~0.45. */
  lowVram?: boolean;
  /** v15.0 Optional toggle to disable BloomEffect completely for maximum speed on low-VRAM GPUs (default `true`). */
  bloom?: boolean;
  /** v15.0 First-Frame-conditioned AI Video Jumpscare clips routed through the exact same Grade/Grain/VHS composer beneath HorrorHUD. */
  jumpscareClips?: JumpscareClipSpec[];
  psxOptions?: PsxOptions;
  inkOptions?: InkOptions;
  grainAmount?: number;
  ssao?: boolean;
  draft?: boolean;
  width?: number;
  height?: number;
  background?: string;
};

export type PostToggles = {
  ink: boolean;
  ssao: boolean;
  psx: boolean;
  lens: boolean;
  pre: boolean;
  motionBlur: boolean;
  bloom: boolean;
  grade: boolean;
  grain: boolean;
};

export type LowVramResolvedConfig = {
  lowVram: boolean;
  dpr: number;
  msaa: number;
  bloomLevels: number;
  toggles: PostToggles;
};

export type ActiveJumpscareState = {
  clip: JumpscareClipSpec;
  localFrame: number;
  durationFrames: number;
  progress: number;
  blendAlpha: number;
  glitchBoost: number;
};

/** Pure deterministic GTX 960 Low-VRAM configuration solver (directly unit-tested). */
export function resolveLowVramConfig(
  renderStyle: RenderStyle,
  opts: {
    lowVram?: boolean;
    ssao?: boolean;
    bloom?: boolean;
    grainAmount?: number;
    draft?: boolean;
    dprOverride?: number;
    postOverrides?: Partial<PostToggles>;
  } = {},
): LowVramResolvedConfig {
  const lowVram = opts.lowVram ?? (renderStyle === "psxHorror");
  const draft = !!opts.draft;
  const grainOn = (opts.grainAmount ?? 0) > 0;
  const baseToggles: PostToggles = {
    ink: renderStyle === "painterly" || renderStyle === "comic",
    ssao: lowVram ? false : ((opts.ssao ?? true) && !draft),
    psx: renderStyle === "psxHorror",
    lens: lowVram ? false : true,
    pre: lowVram ? false : true,
    motionBlur: true,
    bloom: opts.bloom ?? true,
    grade: true,
    grain: grainOn,
    ...(opts.postOverrides ?? {}),
  };
  const dpr = opts.dprOverride ?? (lowVram ? (draft ? 0.35 : 0.45) : 1);
  const msaa = draft || lowVram || baseToggles.psx ? 0 : 4;
  const bloomLevels = lowVram ? 3 : 6;
  return { lowVram, dpr, msaa, bloomLevels, toggles: baseToggles };
}

/** Pure deterministic Jumpscare clip state evaluator for frame `f` (directly unit-tested). */
export function evalActiveJumpscare(
  clips: JumpscareClipSpec[] | undefined,
  frame: number,
): ActiveJumpscareState | null {
  if (!clips || clips.length === 0) return null;
  const clip = clips.find((c) => frame >= c.a && frame < c.b);
  if (!clip) return null;
  const localFrame = frame - clip.a;
  const durationFrames = Math.max(1, clip.b - clip.a);
  const progress = clamp01(localFrame / Math.max(1, durationFrames - 1));
  const defaultBlend =
    clip.transitionStyle === "diegetic_reveal" || clip.transitionStyle === "whip_pan_turn" ? 2 : 0;
  const blendFrames = Math.max(0, clip.blendInFrames ?? defaultBlend);
  const blendAlpha = blendFrames > 0 ? clamp01((localFrame + 1) / (blendFrames + 1)) : 1;
  const baseGlitch = clip.glitchBoost ?? (clip.transitionStyle === "silence_hard_cut" ? 0.85 : 0.65);
  const glitchBoost = baseGlitch * (0.45 + 0.55 * Math.exp(-localFrame / 14));
  return { clip, localFrame, durationFrames, progress, blendAlpha, glitchBoost };
}

/** Selective cinema HDR Bloom (capped to <= 3 mipmap levels in lowVram mode without 1080p upscaling!). */
const makeBloom = (levels: number, lowVram: boolean) => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: lowVram ? 0.56 : 0.68,
    luminanceThreshold: 0.92,
    luminanceSmoothing: 0.24,
    mipmapBlur: true,
    levels: Math.max(1, Math.min(6, levels)),
    radius: lowVram ? 0.58 : 0.72,
  });
  if (!lowVram) {
    const mip = b.mipmapBlurPass;
    const setSize = mip.setSize.bind(mip);
    mip.setSize = (w: number, h: number) => {
      const s = 1080 / Math.max(Math.min(w, h), 1);
      setSize(Math.round(w * s), Math.round(h * s));
    };
  }
  return b;
};

const VIDEO_QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const VIDEO_QUAD_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTexAspect;
uniform float uViewAspect;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float ratio = uTexAspect / max(uViewAspect, 0.001);
  if (ratio > 1.0) {
    uv.x = (uv.x - 0.5) / ratio + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * ratio + 0.5;
  }
  vec4 tex = texture2D(uMap, clamp(uv, 0.001, 0.999));
  gl_FragColor = vec4(tex.rgb, uOpacity);
}
`;

const XFADE_BLEND_FRAG = /* glsl */ `
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 a = texture2D(uFrom, vUv);
  vec4 b = texture2D(uTo, vUv);
  gl_FragColor = mix(a, b, clamp(uAlpha, 0.0, 1.0));
}
`;

const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

function useLoadedAssets<TAssets>(loadAssets?: () => Promise<TAssets>) {
  const loadRef = useRef(loadAssets);
  const [assets, setAssets] = useState<TAssets | undefined>(undefined);
  const [ready, setReady] = useState(() => !loadAssets);
  const [handle] = useState(() => (loadAssets ? delayRender("short assets") : null));

  useEffect(() => {
    const fn = loadRef.current;
    if (!fn) return;
    let cancelled = false;
    fn()
      .then((res) => {
        if (!cancelled) {
          setAssets(res);
          setReady(true);
        }
      })
      .finally(() => {
        if (handle !== null) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return { ready, assets };
}

function getSourceDimensions(source: CanvasImageSource | null): { w: number; h: number } {
  if (!source) return { w: 1080, h: 1920 };
  const anyS = source as unknown as {
    videoWidth?: number;
    videoHeight?: number;
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  };
  const w = anyS.videoWidth || anyS.naturalWidth || (typeof anyS.width === "number" ? anyS.width : 1080) || 1080;
  const h = anyS.videoHeight || anyS.naturalHeight || (typeof anyS.height === "number" ? anyS.height : 1920) || 1920;
  return { w, h };
}

type InnerProps<TAssets> = {
  layers: { id: number; alpha: number }[];
  width: number;
  height: number;
  shots: ShotBase<LightKey>[];
  dof: DofBeat[];
  overlays: ScreenBeat[];
  assets: TAssets;
  createWorld: (assets: TAssets) => ShortWorld;
  renderStyle: RenderStyle;
  vramCfg: LowVramResolvedConfig;
  psxOptions?: PsxOptions;
  inkOptions?: InkOptions;
  grainAmount: number;
  activeJs: ActiveJumpscareState | null;
  videoSourceRef: React.MutableRefObject<CanvasImageSource | null>;
  videoReadyRef: React.MutableRefObject<boolean>;
  rerenderNowRef: React.MutableRefObject<(() => void) | null>;
};

function Inner<TAssets>({
  layers,
  width,
  height,
  shots,
  dof,
  overlays,
  assets,
  createWorld,
  renderStyle,
  vramCfg,
  psxOptions,
  inkOptions,
  grainAmount,
  activeJs,
  videoSourceRef,
  videoReadyRef,
  rerenderNowRef,
}: InnerProps<TAssets>) {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const createRef = useRef(createWorld);
  createRef.current = createWorld;

  const world = useMemo(() => createRef.current(assets), [assets]);
  useEffect(() => () => world.dispose?.(), [world]);

  const primaryLayer = layers[layers.length - 1] ?? { id: shots[0]?.id ?? 1, alpha: 1 };
  const id = primaryLayer.id;

  const frameRef = useRef(f);
  frameRef.current = f;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const activeJsRef = useRef(activeJs);
  activeJsRef.current = activeJs;
  const idRef = useRef(id);
  idRef.current = id;

  const target = useMemo(() => new THREE.Vector3(), []);
  const glSize = useMemo(() => new THREE.Vector2(), []);
  const appliedSize = useRef({ width: -1, height: -1, pixelRatio: -1 });
  const lastAuditedFrame = useRef<number>(-999999);
  const curFocusRef = useRef<number>(1.0);
  const auditStills = !!(getInputProps() as { auditStills?: boolean })?.auditStills;
  const on = vramCfg.toggles;
  const vertexSnap = on.psx ? (psxOptions?.vertexSnap ?? DEF_PSX_OPTIONS.vertexSnap) : 0;

  // Fullscreen orthographic video quad (reused across all Jumpscare clips, zero extra WebGL context!)
  const videoRig = useMemo(() => {
    const tex = new THREE.Texture();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uTexAspect: { value: 9 / 16 },
        uViewAspect: { value: 9 / 16 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: VIDEO_QUAD_VERT,
      fragmentShader: VIDEO_QUAD_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geo, mat);
    quad.frustumCulled = false;
    const vScene = new THREE.Scene();
    vScene.add(quad);
    const vCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { tex, mat, geo, quad, vScene, vCam };
  }, []);

  // Single-context low-res crossfade rig (only allocates RenderTargets lazily if an xfade frame actually occurs!)
  const xfadeRig = useRef<{
    rtA: THREE.WebGLRenderTarget;
    rtB: THREE.WebGLRenderTarget;
    mat: THREE.ShaderMaterial;
    geo: THREE.PlaneGeometry;
    xScene: THREE.Scene;
    xCam: THREE.OrthographicCamera;
  } | null>(null);

  useEffect(() => {
    return () => {
      videoRig.tex.dispose();
      videoRig.mat.dispose();
      videoRig.geo.dispose();
      if (xfadeRig.current) {
        xfadeRig.current.rtA.dispose();
        xfadeRig.current.rtB.dispose();
        xfadeRig.current.mat.dispose();
        xfadeRig.current.geo.dispose();
        xfadeRig.current = null;
      }
    };
  }, [videoRig]);

  // Lazily instantiate ONLY enabled post-processing passes (avoids wasting VRAM on SSAO/LensBlur in lowVram mode!)
  const fx = useMemo(() => {
    const normalPass = on.ssao ? new OpaqueNormalPass(scene, camera, { resolutionScale: 0.75 }) : null;
    const ssaoFx =
      on.ssao && normalPass
        ? new SSAOEffect(camera, normalPass.texture, {
            blendFunction: BlendFunction.MULTIPLY,
            samples: 16,
            rings: 7,
            radius: 0.088,
            intensity: renderStyle === "semiReal" || renderStyle === "psxHorror" ? 2.45 : 1.85,
            luminanceInfluence: 0.42,
            bias: 0.024,
            fade: 0.015,
            color: new THREE.Color("#040308"),
            worldDistanceThreshold: 26,
            worldDistanceFalloff: 8,
            worldProximityThreshold: 1.5,
            worldProximityFalloff: 0.65,
            resolutionScale: 0.75,
          })
        : null;
    const ink = on.ink
      ? new InkPass(
          scene,
          camera as THREE.PerspectiveCamera,
          renderStyle === "painterly"
            ? { widthNear: 2.8, widthFar: 1.2, strength: 0.74, creaseScale: 0.68 }
            : undefined,
        )
      : null;
    const lens = on.lens ? new LensBlur({ maxCoC: 20, nearScale: 1.2 }) : null;
    const motionBlur = on.motionBlur ? new WhipMotionBlurEffect({ thresholdPx: 2.5, maxUv: 0.055 }) : null;
    const bloom = on.bloom ? makeBloom(vramCfg.bloomLevels, vramCfg.lowVram) : null;
    return {
      normalPass,
      ssao: ssaoFx,
      ink,
      lens,
      motionBlur,
      bloom,
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.warmLamp, GRADE_STRENGTH.warmLamp),
      grain: on.grain ? new GrainEffect({ amount: grainAmount, cellPx: renderStyle === "semiReal" ? 1.55 : 1.4 }) : null,
      psx: on.psx ? new RetroPsxEffect(psxOptions) : null,
    };
  }, [camera, scene, renderStyle, grainAmount, on.ssao, on.ink, on.lens, on.motionBlur, on.bloom, on.grain, on.psx, vramCfg.bloomLevels, vramCfg.lowVram]);

  if (inkOptions && fx.ink) fx.ink.set(inkOptions);
  if (psxOptions && fx.psx) fx.psx.setOptions(psxOptions);
  if (fx.grain && on.grain) fx.grain.amount = grainAmount;

  const composerBundle = useMemo(() => {
    const c = new PostComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: vramCfg.msaa });
    c.autoRenderToScreen = true;

    const render3dPass = new RenderPass(scene, camera);
    c.addPass(render3dPass);

    let ssaoEffectPass: EffectPass | null = null;
    if (on.ssao && fx.normalPass && fx.ssao) {
      c.addPass(fx.normalPass);
      ssaoEffectPass = new EffectPass(camera, fx.ssao);
      c.addPass(ssaoEffectPass);
    }
    if (on.ink && fx.ink) c.addPass(fx.ink);

    let lensPrePass: EffectPass | null = null;
    let lensMainPass: EffectPass | null = null;
    if (on.lens && fx.lens) {
      if (on.pre) {
        lensPrePass = new EffectPass(camera, fx.lens.pre);
        c.addPass(lensPrePass);
      }
      lensMainPass = new EffectPass(camera, fx.lens.main);
      c.addPass(lensMainPass);
    }

    let motionBlurPass: EffectPass | null = null;
    if (on.motionBlur && fx.motionBlur) {
      motionBlurPass = new EffectPass(camera, fx.motionBlur);
      c.addPass(motionBlurPass);
    }

    const bloomTonePass = new EffectPass(camera, ...(on.bloom && fx.bloom ? [fx.bloom] : []), fx.tone);
    c.addPass(bloomTonePass);

    // Unified AI Video Jumpscare pass placed AFTER 3D ToneMapping and BEFORE Grade + Grain + RetroPsx!
    // Guarantees 0 double-tonemapping and 100% identical color grade, film grain, Bayer dither, scanlines & VHS wave!
    const videoPass = new RenderPass(videoRig.vScene, videoRig.vCam);
    videoPass.enabled = false;
    videoPass.clear = true;
    c.addPass(videoPass);

    const gradeTail = [...(on.grade ? [fx.grade] : []), ...(on.grain && fx.grain ? [fx.grain] : [])];
    if (gradeTail.length) c.addPass(new EffectPass(camera, ...gradeTail));
    if (on.psx && fx.psx) c.addPass(new EffectPass(camera, fx.psx));

    const w0 = size.width || width;
    const h0 = size.height || height;
    c.setSize(w0, h0);
    appliedSize.current = { width: w0, height: h0, pixelRatio: gl.getPixelRatio() };
    return {
      composer: c,
      render3dPass,
      ssaoEffectPass,
      lensPrePass,
      lensMainPass,
      motionBlurPass,
      bloomTonePass,
      videoPass,
    };
  }, [gl, scene, camera, fx, on, vramCfg.msaa, videoRig]);

  const { composer } = composerBundle;

  useEffect(() => {
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    gl.autoClear = false;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.autoClear = prevAutoClear;
      gl.toneMapping = prevToneMapping;
      composer.dispose();
      if (!on.ssao) {
        fx.normalPass?.dispose();
        fx.ssao?.dispose();
      }
      if (!on.ink) fx.ink?.dispose();
      if (!on.psx) fx.psx?.dispose();
      if (!on.lens) fx.lens?.dispose();
      else if (!on.pre) fx.lens?.pre.dispose();
      if (!on.motionBlur) fx.motionBlur?.dispose();
      if (!on.bloom) fx.bloom?.dispose();
      if (!on.grade) fx.grade.dispose();
      if (!on.grain) fx.grain?.dispose();
    };
  }, [gl, composer, fx, on]);

  const renderCompositeFrame = useCallback(
    (delta: number) => {
      gl.getSize(glSize);
      const pr = gl.getPixelRatio();
      const cur = appliedSize.current;
      if (glSize.width !== cur.width || glSize.height !== cur.height || pr !== cur.pixelRatio) {
        composer.setSize(glSize.width, glSize.height);
        cur.width = glSize.width;
        cur.height = glSize.height;
        cur.pixelRatio = pr;
      }

      const jsNow = activeJsRef.current;
      const hasVideo = !!(jsNow && videoReadyRef.current && videoSourceRef.current);
      const opaqueVideoOnly = hasVideo && jsNow.blendAlpha >= 0.999;

      if (hasVideo && videoSourceRef.current) {
        const dims = getSourceDimensions(videoSourceRef.current);
        videoRig.tex.image = videoSourceRef.current as unknown as TexImageSource;
        videoRig.tex.needsUpdate = true;
        videoRig.mat.uniforms.uTexAspect.value = dims.w / Math.max(1, dims.h);
        videoRig.mat.uniforms.uViewAspect.value = width / Math.max(1, height);
        videoRig.mat.uniforms.uOpacity.value = jsNow.blendAlpha;
      }

      // Toggle 3D passes OFF during opaque Jumpscare video frames (saves 100% 3D GPU cost on video frames!)
      composerBundle.render3dPass.enabled = !opaqueVideoOnly;
      if (fx.normalPass) fx.normalPass.enabled = !opaqueVideoOnly;
      if (composerBundle.ssaoEffectPass) composerBundle.ssaoEffectPass.enabled = !opaqueVideoOnly;
      if (fx.ink) fx.ink.enabled = !opaqueVideoOnly;
      if (composerBundle.lensPrePass) composerBundle.lensPrePass.enabled = !opaqueVideoOnly;
      if (composerBundle.lensMainPass) composerBundle.lensMainPass.enabled = !opaqueVideoOnly;
      if (composerBundle.motionBlurPass) composerBundle.motionBlurPass.enabled = !opaqueVideoOnly;
      composerBundle.bloomTonePass.enabled = !opaqueVideoOnly;

      composerBundle.videoPass.enabled = hasVideo;
      composerBundle.videoPass.clear = opaqueVideoOnly;

      // Always ensure the LAST ENABLED pass in EffectComposer renders to screen (critical for --raw-anchor when tail passes are disabled!)
      const passes = composer.passes;
      let lastEnabledIdx = -1;
      for (let pi = 0; pi < passes.length; pi++) {
        passes[pi].renderToScreen = false;
        if (passes[pi].enabled) lastEnabledIdx = pi;
      }
      if (lastEnabledIdx >= 0) {
        passes[lastEnabledIdx].renderToScreen = true;
      }

      const curLayers = layersRef.current;
      const prevAutoClear = gl.autoClear;
      gl.autoClear = true;

      if (!opaqueVideoOnly && curLayers.length === 2 && !hasVideo) {
        // Single-context low-res xfade blend without EVER mounting a second <ThreeCanvas>!
        const bw = Math.max(1, Math.round(glSize.width * pr));
        const bh = Math.max(1, Math.round(glSize.height * pr));
        if (!xfadeRig.current) {
          const rtOpts: THREE.RenderTargetOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            type: THREE.HalfFloatType,
          };
          const rtA = new THREE.WebGLRenderTarget(bw, bh, rtOpts);
          const rtB = new THREE.WebGLRenderTarget(bw, bh, rtOpts);
          const mat = new THREE.ShaderMaterial({
            uniforms: {
              uFrom: { value: rtA.texture },
              uTo: { value: rtB.texture },
              uAlpha: { value: 0.5 },
            },
            vertexShader: VIDEO_QUAD_VERT,
            fragmentShader: XFADE_BLEND_FRAG,
            depthTest: false,
            depthWrite: false,
          });
          const geo = new THREE.PlaneGeometry(2, 2);
          const xScene = new THREE.Scene();
          xScene.add(new THREE.Mesh(geo, mat));
          const xCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          xfadeRig.current = { rtA, rtB, mat, geo, xScene, xCam };
        }
        const xr = xfadeRig.current;
        if (xr.rtA.width !== bw || xr.rtA.height !== bh) {
          xr.rtA.setSize(bw, bh);
          xr.rtB.setSize(bw, bh);
        }
        const cam = camera as THREE.PerspectiveCamera;
        const [fromL, toL] = curLayers;
        // 1. Render outgoing shot into rtA
        world.update(fromL.id, frameRef.current, cam, scene);
        world.syncLighting?.(fromL.id, frameRef.current);
        gl.setRenderTarget(xr.rtA);
        gl.clear();
        gl.render(scene, cam);
        // 2. Render incoming shot into rtB
        world.update(toL.id, frameRef.current, cam, scene);
        world.syncLighting?.(toL.id, frameRef.current);
        gl.setRenderTarget(xr.rtB);
        gl.clear();
        gl.render(scene, cam);
        gl.setRenderTarget(null);

        // 3. Feed blended quad into composer's render3dPass temporarily
        xr.mat.uniforms.uAlpha.value = toL.alpha;
        const origScene = composerBundle.render3dPass.mainScene;
        const origCam = composerBundle.render3dPass.mainCamera;
        composerBundle.render3dPass.mainScene = xr.xScene;
        composerBundle.render3dPass.mainCamera = xr.xCam;
        composer.render(delta);
        composerBundle.render3dPass.mainScene = origScene;
        composerBundle.render3dPass.mainCamera = origCam;
      } else {
        if (!opaqueVideoOnly) {
          world.syncLighting?.(idRef.current, frameRef.current);
        }
        setLightningFlash(lightningAt(overlaysRef.current, frameRef.current));
        setPsxVertexSnap(vertexSnap);
        composer.render(delta);
      }

      gl.autoClear = prevAutoClear;

      if (auditStills && !opaqueVideoOnly && lastAuditedFrame.current !== frameRef.current && world.getAuditTargets) {
        lastAuditedFrame.current = frameRef.current;
        const targets = auditSceneTargets(camera as THREE.PerspectiveCamera, world.root, world.getAuditTargets());
        const payload = {
          frame: frameRef.current,
          shotId: idRef.current,
          focusDist: Number(curFocusRef.current.toFixed(3)),
          targets,
        };
        if (typeof window !== "undefined") {
          (window as unknown as { __HORROR_STILL_AUDIT__?: unknown }).__HORROR_STILL_AUDIT__ = payload;
        }
        console.info("__HORROR_AUDIT__" + JSON.stringify(payload));
      }
    },
    [gl, glSize, composer, composerBundle, fx, camera, scene, world, vertexSnap, auditStills, videoRig, videoReadyRef, videoSourceRef, width, height],
  );

  useEffect(() => {
    rerenderNowRef.current = () => renderCompositeFrame(0);
    return () => {
      rerenderNowRef.current = null;
    };
  }, [renderCompositeFrame, rerenderNowRef]);

  useFrame((_, delta) => {
    renderCompositeFrame(delta);
  }, 1);

  const cam = camera as THREE.PerspectiveCamera;
  cam.aspect = width / Math.max(1, height);
  cam.layers.enable(NOINK);
  setLightningFlash(lightningAt(overlays, f));
  setPsxVertexSnap(vertexSnap);

  const skip3dUpdate = !!(activeJs && activeJs.blendAlpha >= 0.999 && videoReadyRef.current);
  if (!skip3dUpdate) {
    target.copy(world.update(id, f, cam, scene));
    noInkFallback(world.root);
  }

  if (fx.lens) {
    const d = evalDof(dof, f);
    cam.getWorldDirection(fwd);
    const subjFocus = world.getFocusTarget?.(id, f);
    if (subjFocus) {
      if (Array.isArray(subjFocus)) {
        fpt.set(subjFocus[0], subjFocus[1], subjFocus[2]);
      } else {
        subjFocus.updateMatrixWorld(true);
        subjFocus.getWorldPosition(fpt);
      }
    } else if (d.focus) {
      fpt.set(...d.focus(f));
    } else {
      fpt.copy(target);
    }
    const focusVal = Math.max(0.18, fpt.sub(cam.position).dot(fwd));
    curFocusRef.current = focusVal;
    fx.lens.focus = focusVal;
    fx.lens.cInf = on.psx ? d.cInf * 0.22 : d.cInf;
  }

  if (fx.motionBlur) {
    const vel = skip3dUpdate
      ? { vx: 0, vy: 0, speedPx: 0 }
      : (world.getMotionVelocity?.(id, f, cam.aspect, height) ?? { vx: 0, vy: 0, speedPx: 0 });
    fx.motionBlur.setVelocity(vel.vx, vel.vy, vel.speedPx);
  }

  const shot = shots.find((s) => s.id === id) ?? shots[0];
  const blend = skip3dUpdate ? null : world.getLightBlend?.(id, f);
  const activeLight: LightKey = activeJs?.clip.light ?? blend?.from ?? shot.light;
  const extraAb = aberrationAt(overlays, f) + lightningAt(overlays, f) * 0.45 + (activeJs ? activeJs.glitchBoost * 0.45 : 0);
  gradeFor(fx.grade, activeLight, f, on.psx ? extraAb * 0.25 : extraAb, activeJs ? undefined : blend?.to, activeJs ? 0 : (blend?.t ?? 0));
  if (fx.grain) fx.grain.seed = f;
  if (fx.psx) {
    fx.psx.frame = f;
    const glitchNow = aberrationAt(overlays, f) + lightningAt(overlays, f) * 0.65 + (activeJs?.glitchBoost ?? 0);
    fx.psx.glitchSurge = glitchNow;
    fx.psx.dreadLevel = Math.min(1, glitchNow * 1.15);
  }

  return <primitive object={world.root} dispose={null} />;
}

export function ShortPlayer<TAssets = undefined>({
  shots,
  createWorld,
  loadAssets,
  dof = [],
  xfade = {},
  flashes = [],
  overlays = [],
  hud,
  hideHud,
  renderStyle = "psxHorror",
  lowVram,
  bloom = true,
  jumpscareClips,
  psxOptions,
  inkOptions,
  grainAmount,
  ssao = true,
  draft,
  width,
  height,
  background = "#06060b",
}: ShortPlayerProps<TAssets>) {
  const f = useCurrentFrame();
  const vc = useVideoConfig();
  const inputProps = getInputProps() as {
    draft?: boolean;
    lowVram?: boolean;
    hideHud?: boolean;
    post?: Partial<PostToggles> & { dpr?: number };
  };
  const isDraft = draft ?? !!inputProps?.draft;
  const isHideHud = hideHud ?? !!inputProps?.hideHud;
  const resolvedGrain = grainAmount ?? (renderStyle === "psxHorror" ? 0.014 : renderStyle === "semiReal" ? 0.018 : 0.008);
  const w = width ?? vc.width;
  const h = height ?? vc.height;
  const { ready, assets } = useLoadedAssets(loadAssets);

  const vramCfg = useMemo(
    () =>
      resolveLowVramConfig(renderStyle, {
        lowVram: lowVram ?? inputProps?.lowVram,
        ssao,
        bloom,
        grainAmount: resolvedGrain,
        draft: isDraft,
        dprOverride: inputProps?.post?.dpr,
        postOverrides: inputProps?.post,
      }),
    [renderStyle, lowVram, inputProps?.lowVram, ssao, bloom, resolvedGrain, isDraft, inputProps?.post],
  );

  const videoSourceRef = useRef<CanvasImageSource | null>(null);
  const videoReadyRef = useRef<boolean>(false);
  const rerenderNowRef = useRef<(() => void) | null>(null);

  const activeJs = useMemo(() => evalActiveJumpscare(jumpscareClips, f), [jumpscareClips, f]);
  if (!activeJs) {
    videoReadyRef.current = false;
    videoSourceRef.current = null;
  }

  const handleVideoFrame = useCallback((source: CanvasImageSource) => {
    videoSourceRef.current = source;
    videoReadyRef.current = true;
    rerenderNowRef.current?.();
  }, []);

  if (!ready) return null;

  let flash = 0;
  for (const fa of flashes) {
    if (f >= fa && f < fa + 4) flash = Math.max(flash, [0.7, 0.45, 0.25, 0.1][f - fa]);
  }
  const activeOverlays = evalOverlays(overlays, f);
  const layers = evalLayers(shots, xfade, f);

  return (
    <AbsoluteFill style={{ background }}>
      {/* Hidden frame-locked OffthreadVideo feeder(s) for Jumpscare AI Video clips routed through the single WebGL PostComposer! */}
      {(jumpscareClips ?? []).map((clip) => (
        <Sequence key={clip.id} from={clip.a} durationInFrames={Math.max(1, clip.b - clip.a)} layout="none">
          <OffthreadVideo
            src={clip.src}
            muted
            playbackRate={clip.playbackRate ?? 1}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            onVideoFrame={handleVideoFrame}
          />
        </Sequence>
      ))}

      {/* Strictly ONE persistent <ThreeCanvas> context across the entire timeline (zero dual-context VRAM spikes!) */}
      <AbsoluteFill style={renderStyle === "psxHorror" ? { imageRendering: "pixelated" } : undefined}>
        <ThreeCanvas
          key="primary"
          width={w}
          height={h}
          dpr={vramCfg.dpr}
          shadows={vramCfg.lowVram || isDraft ? true : "soft"}
          gl={{
            antialias: false,
            stencil: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            toneMappingExposure: 1.0,
          }}
          camera={{ fov: 56, near: 0.08, far: 1500 }}
        >
          <Inner
            layers={layers}
            width={w}
            height={h}
            shots={shots}
            dof={dof}
            overlays={overlays}
            assets={assets as TAssets}
            createWorld={createWorld}
            renderStyle={renderStyle}
            vramCfg={vramCfg}
            psxOptions={psxOptions}
            inkOptions={inkOptions}
            grainAmount={resolvedGrain}
            activeJs={activeJs}
            videoSourceRef={videoSourceRef}
            videoReadyRef={videoReadyRef}
            rerenderNowRef={rerenderNowRef}
          />
        </ThreeCanvas>
      </AbsoluteFill>

      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash, mixBlendMode: "screen" }} />}
      {activeOverlays.map((ov, i) => (
        <AbsoluteFill
          key={`ov-${i}`}
          style={{
            ...(ov.radial
              ? { background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 34%, ${ov.color} 100%)` }
              : { background: ov.color }),
            opacity: ov.opacity,
            ...(ov.blend === "screen" ? { mixBlendMode: "screen" } : {}),
          }}
        />
      ))}
      {hud && !isHideHud && <HorrorHUD config={hud} frame={f} width={w} height={h} />}
    </AbsoluteFill>
  );
}
