// Horror Engine v4: Unified Remotion + Three.js + Post-processing + POV Narrative HUD player.
// Builds postprocessing.EffectComposer synchronously so Remotion frameloop="never" renders every frame cleanly.
// Default ("semiReal" — Style B Silent Hill / Chilla's Art indie 3D):
//   RenderPass (MSAA 4) -> OpaqueNormalPass -> SSAOEffect (crevice depth) -> LensBlur -> WhipMotionBlur -> [Bloom + NEUTRAL ToneMap] -> [Grade + Analog Grain] -> HorrorHUD.
// Optional "painterly" (Style A) / "comic" (v3) modes enable architectural InkPass cleanly.

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
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

export type RenderStyle = "psxHorror" | "semiReal" | "painterly" | "comic";

/** NormalPass that temporarily hides non-opaque / non-depth-writing FX (flashlight cones, halos, smoke, decals) so SSAO only occludes solid 3D geometry. */
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
  renderStyle?: RenderStyle;
  psxOptions?: PsxOptions;
  inkOptions?: InkOptions;
  grainAmount?: number;
  ssao?: boolean;
  draft?: boolean;
  width?: number;
  height?: number;
  background?: string;
};

type PostToggles = {
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

const toggles = (renderStyle: RenderStyle, ssaoEnabled: boolean, grainAmount = 0): PostToggles => ({
  ink: renderStyle === "painterly" || renderStyle === "comic",
  ssao: ssaoEnabled,
  psx: renderStyle === "psxHorror",
  lens: true,
  pre: true,
  motionBlur: true,
  bloom: true,
  grade: true,
  grain: grainAmount > 0,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}),
});
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

/** Lush cinema HDR Bloom on flames, lamp chimneys, Phone3D screens, and entity eye glints. */
const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.68,
    luminanceThreshold: 0.92,
    luminanceSmoothing: 0.24,
    mipmapBlur: true,
    levels: 6,
    radius: 0.72,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => {
    const s = 1080 / Math.max(Math.min(w, h), 1);
    setSize(Math.round(w * s), Math.round(h * s));
  };
  return b;
};

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

type InnerProps<TAssets> = {
  id: number;
  width: number;
  height: number;
  shots: ShotBase<LightKey>[];
  dof: DofBeat[];
  overlays: ScreenBeat[];
  assets: TAssets;
  createWorld: (assets: TAssets) => ShortWorld;
  renderStyle: RenderStyle;
  psxOptions?: PsxOptions;
  inkOptions?: InkOptions;
  grainAmount: number;
  ssao: boolean;
  draft: boolean;
};

function Inner<TAssets>({
  id,
  width,
  height,
  shots,
  dof,
  overlays,
  assets,
  createWorld,
  renderStyle,
  psxOptions,
  inkOptions,
  grainAmount,
  ssao,
  draft,
}: InnerProps<TAssets>) {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const createRef = useRef(createWorld);
  createRef.current = createWorld;

  const world = useMemo(() => createRef.current(assets), [assets]);
  useEffect(() => () => world.dispose?.(), [world]);

  const frameRef = useRef(f);
  frameRef.current = f;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const target = useMemo(() => new THREE.Vector3(), []);
  const glSize = useMemo(() => new THREE.Vector2(), []);
  const appliedSize = useRef({ width: -1, height: -1, pixelRatio: -1 });
  const grainOn = grainAmount > 0;
  const ssaoOn = ssao && !draft;
  const on = useMemo(() => toggles(renderStyle, ssaoOn, grainOn ? 1 : 0), [renderStyle, ssaoOn, grainOn]);
  const vertexSnap = on.psx ? (psxOptions?.vertexSnap ?? DEF_PSX_OPTIONS.vertexSnap) : 0;

  const fx = useMemo(() => {
    const normalPass = new OpaqueNormalPass(scene, camera, { resolutionScale: 0.75 });
    const ssaoFx = new SSAOEffect(camera, normalPass.texture, {
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
    });
    const ink = new InkPass(
      scene,
      camera as THREE.PerspectiveCamera,
      renderStyle === "painterly"
        ? { widthNear: 2.8, widthFar: 1.2, strength: 0.74, creaseScale: 0.68 }
        : undefined,
    );
    return {
      normalPass,
      ssao: ssaoFx,
      ink,
      lens: new LensBlur({ maxCoC: 20, nearScale: 1.2 }),
      motionBlur: new WhipMotionBlurEffect({ thresholdPx: 2.5, maxUv: 0.055 }),
      bloom: makeBloom(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.warmLamp, GRADE_STRENGTH.warmLamp),
      grain: new GrainEffect({ amount: grainAmount, cellPx: renderStyle === "semiReal" ? 1.55 : 1.4 }),
      psx: new RetroPsxEffect(psxOptions),
    };
  }, [camera, scene, renderStyle, grainAmount]);

  if (inkOptions) fx.ink.set(inkOptions);
  if (psxOptions) fx.psx.setOptions(psxOptions);
  if (grainOn) fx.grain.amount = grainAmount;

  const composer = useMemo(() => {
    // PSX retro mode intentionally disables MSAA so low-poly pixel silhouettes remain sharp & fast!
    const msaa = draft || on.psx ? 0 : 4;
    const c = new PostComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: msaa });
    c.autoRenderToScreen = true;
    c.addPass(new RenderPass(scene, camera));
    if (on.ssao) {
      c.addPass(fx.normalPass);
      c.addPass(new EffectPass(camera, fx.ssao));
    }
    if (on.ink) c.addPass(fx.ink);
    if (on.lens && on.pre) c.addPass(new EffectPass(camera, fx.lens.pre));
    if (on.lens) c.addPass(new EffectPass(camera, fx.lens.main));
    if (on.motionBlur) c.addPass(new EffectPass(camera, fx.motionBlur));
    c.addPass(new EffectPass(camera, ...(on.bloom ? [fx.bloom] : []), fx.tone));
    const gradeTail = [...(on.grade ? [fx.grade] : []), ...(on.grain ? [fx.grain] : [])];
    if (gradeTail.length) c.addPass(new EffectPass(camera, ...gradeTail));
    if (on.psx) c.addPass(new EffectPass(camera, fx.psx));
    const w0 = size.width || width;
    const h0 = size.height || height;
    c.setSize(w0, h0);
    appliedSize.current = { width: w0, height: h0, pixelRatio: gl.getPixelRatio() };
    return c;
  }, [gl, scene, camera, fx, on, draft]);

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
        fx.normalPass.dispose();
        fx.ssao.dispose();
      }
      if (!on.ink) fx.ink.dispose();
      if (!on.psx) fx.psx.dispose();
      if (!on.lens) fx.lens.dispose();
      else if (!on.pre) fx.lens.pre.dispose();
      if (!on.motionBlur) fx.motionBlur.dispose();
      if (!on.bloom) fx.bloom.dispose();
      if (!on.grade) fx.grade.dispose();
      if (!on.grain) fx.grain.dispose();
    };
  }, [gl, composer, fx, on]);

  useFrame((_, delta) => {
    gl.getSize(glSize);
    const pr = gl.getPixelRatio();
    const cur = appliedSize.current;
    if (glSize.width !== cur.width || glSize.height !== cur.height || pr !== cur.pixelRatio) {
      composer.setSize(glSize.width, glSize.height);
      cur.width = glSize.width;
      cur.height = glSize.height;
      cur.pixelRatio = pr;
    }
    world.syncLighting?.(id, frameRef.current);
    setLightningFlash(lightningAt(overlaysRef.current, frameRef.current));
    setPsxVertexSnap(vertexSnap);
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    composer.render(delta);
    gl.autoClear = prevAutoClear;
  }, 1);

  const cam = camera as THREE.PerspectiveCamera;
  cam.aspect = width / Math.max(1, height);
  cam.layers.enable(NOINK);
  setLightningFlash(lightningAt(overlays, f));
  setPsxVertexSnap(vertexSnap);
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);

  const d = evalDof(dof, f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f));
  else fpt.copy(target);
  fx.lens.focus = Math.max(0.18, fpt.sub(cam.position).dot(fwd));
  // Keep PSX low-res pixels crisp & readable by dampening heavy cinematic bokeh blur
  fx.lens.cInf = on.psx ? d.cInf * 0.22 : d.cInf;

  // Deterministic per-frame Whip-Pan motion blur velocity
  const vel = world.getMotionVelocity?.(id, f, cam.aspect, height) ?? { vx: 0, vy: 0, speedPx: 0 };
  fx.motionBlur.setVelocity(vel.vx, vel.vy, vel.speedPx);

  const shot = shots.find((s) => s.id === id) ?? shots[0];
  const blend = world.getLightBlend?.(id, f);
  const extraAb = aberrationAt(overlays, f) + lightningAt(overlays, f) * 0.45;
  gradeFor(fx.grade, blend?.from ?? shot.light, f, on.psx ? extraAb * 0.25 : extraAb, blend?.to, blend?.t ?? 0);
  fx.grain.seed = f;
  fx.psx.frame = f;
  fx.psx.glitchSurge = aberrationAt(overlays, f) + lightningAt(overlays, f) * 0.65;

  return <primitive object={world.root} dispose={null} />;
}

type ShotViewProps<TAssets> = {
  id: number;
  alpha: number;
  width: number;
  height: number;
  shots: ShotBase<LightKey>[];
  dof: DofBeat[];
  overlays: ScreenBeat[];
  assets: TAssets;
  createWorld: (assets: TAssets) => ShortWorld;
  renderStyle: RenderStyle;
  psxOptions?: PsxOptions;
  inkOptions?: InkOptions;
  grainAmount: number;
  ssao: boolean;
  draft: boolean;
};

function ShotView<TAssets>({
  id,
  alpha,
  width,
  height,
  shots,
  dof,
  overlays,
  assets,
  createWorld,
  renderStyle,
  psxOptions,
  inkOptions,
  grainAmount,
  ssao,
  draft,
}: ShotViewProps<TAssets>) {
  const dpr = dprOverride();
  return (
    <AbsoluteFill style={{ opacity: alpha }}>
      <ThreeCanvas
        width={width}
        height={height}
        {...(dpr ? { dpr } : {})}
        shadows={draft ? true : "soft"}
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
          id={id}
          width={width}
          height={height}
          shots={shots}
          dof={dof}
          overlays={overlays}
          assets={assets}
          createWorld={createWorld}
          renderStyle={renderStyle}
          psxOptions={psxOptions}
          inkOptions={inkOptions}
          grainAmount={grainAmount}
          ssao={ssao}
          draft={draft}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
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
  renderStyle = "psxHorror",
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
  const isDraft = draft ?? !!(getInputProps() as { draft?: boolean })?.draft;
  const resolvedGrain = grainAmount ?? (renderStyle === "psxHorror" ? 0.014 : renderStyle === "semiReal" ? 0.018 : 0.008);
  const w = width ?? vc.width;
  const h = height ?? vc.height;
  const { ready, assets } = useLoadedAssets(loadAssets);
  if (!ready) return null;

  let flash = 0;
  for (const fa of flashes) {
    if (f >= fa && f < fa + 4) flash = Math.max(flash, [0.7, 0.45, 0.25, 0.1][f - fa]);
  }
  const activeOverlays = evalOverlays(overlays, f);

  return (
    <AbsoluteFill style={{ background }}>
      {evalLayers(shots, xfade, f).map((l, i) => (
        <ShotView
          key={i ? "over" : "base"}
          id={l.id}
          alpha={l.alpha}
          width={w}
          height={h}
          shots={shots}
          dof={dof}
          overlays={overlays}
          assets={assets as TAssets}
          createWorld={createWorld}
          renderStyle={renderStyle}
          psxOptions={psxOptions}
          inkOptions={inkOptions}
          grainAmount={resolvedGrain}
          ssao={ssao}
          draft={isDraft}
        />
      ))}
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
      {hud && <HorrorHUD config={hud} frame={f} width={w} height={h} />}
    </AbsoluteFill>
  );
}
