// Reusable Remotion + Three.js + Post-processing player for Horror Engine v2 ("Gothic Ink-Noir x Shadow-Depth").
// Builds postprocessing.EffectComposer synchronously so Remotion's frameloop="never" renders frame 0 cleanly.
// Chain: RenderPass -> InkPass -> LensBlur (pre + main) -> [Bloom (HDR > 1) + NEUTRAL ToneMapping + GradeEffect + GrainEffect], MSAA 4.

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
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { DofBeat, LightKey, ScreenBeat, ShotBase, aberrationAt, evalDof, evalLayers, evalOverlays, lightningAt } from "./camera";
import { InkOptions, InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { setLightningFlash } from "./shade";

export interface ShortWorld {
  root: THREE.Object3D;
  update(shotId: number, frame: number, camera: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3;
  syncLighting?(shotId: number, frame: number): void;
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
  inkOptions?: InkOptions;
  grainAmount?: number;
  width?: number;
  height?: number;
  background?: string;
};

type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (grainAmount = 0): PostToggles => ({
  ink: true,
  lens: true,
  pre: true,
  bloom: true,
  grade: true,
  grain: grainAmount > 0,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}),
});
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

/** Bloom for HDR emissive sources only (threshold 1.0, short-edge 1080 mip base for 9:16 & 16:9 invariance). */
const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: 0.55,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.22,
    mipmapBlur: true,
    levels: 6,
    radius: 0.65,
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
  inkOptions?: InkOptions;
  grainAmount?: number;
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
  inkOptions,
  grainAmount = 0.026,
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
  const on = useMemo(() => toggles(grainOn ? 1 : 0), [grainOn]);

  const fx = useMemo(
    () => ({
      ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
      lens: new LensBlur({ maxCoC: 24, nearScale: 1.25 }),
      bloom: makeBloom(),
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      grade: new GradeEffect(GRADES.night, GRADE_STRENGTH.night),
      grain: new GrainEffect({ amount: 0.018, cellPx: 1.4 }),
    }),
    [camera, scene],
  );

  if (inkOptions) fx.ink.set(inkOptions);
  if (grainOn) fx.grain.amount = grainAmount;

  const composer = useMemo(() => {
    const c = new PostComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    c.autoRenderToScreen = true;
    c.addPass(new RenderPass(scene, camera));
    if (on.ink) c.addPass(fx.ink);
    if (on.lens && on.pre) c.addPass(new EffectPass(camera, fx.lens.pre));
    if (on.lens) c.addPass(new EffectPass(camera, fx.lens.main));
    // Pass A: HDR Bloom + Neutral ToneMapping (writes display-referred 0..1 to buffer)
    c.addPass(new EffectPass(camera, ...(on.bloom ? [fx.bloom] : []), fx.tone));
    // Pass B: GradeEffect (reads bloomed & tonemapped inputBuffer for clean RGB aberration) + GrainEffect
    const gradeTail = [
      ...(on.grade ? [fx.grade] : []),
      ...(on.grain ? [fx.grain] : []),
    ];
    if (gradeTail.length) c.addPass(new EffectPass(camera, ...gradeTail));
    const w0 = size.width || width;
    const h0 = size.height || height;
    c.setSize(w0, h0);
    appliedSize.current = { width: w0, height: h0, pixelRatio: gl.getPixelRatio() };
    return c;
  }, [gl, scene, camera, fx, on]);

  useEffect(() => {
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    gl.autoClear = false;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.autoClear = prevAutoClear;
      gl.toneMapping = prevToneMapping;
      composer.dispose();
      if (!on.ink) fx.ink.dispose();
      if (!on.lens) fx.lens.dispose();
      else if (!on.pre) fx.lens.pre.dispose();
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
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    composer.render(delta);
    gl.autoClear = prevAutoClear;
  }, 1);

  const cam = camera as THREE.PerspectiveCamera;
  cam.aspect = width / Math.max(1, height);
  setLightningFlash(lightningAt(overlays, f));
  target.copy(world.update(id, f, cam, scene));
  world.syncLighting?.(id, f);
  setLightningFlash(lightningAt(overlays, f));
  noInkFallback(world.root);

  const d = evalDof(dof, f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f));
  else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;

  const shot = shots.find((s) => s.id === id) ?? shots[0];
  const extraAb = aberrationAt(overlays, f) + lightningAt(overlays, f) * 0.65;
  gradeFor(fx.grade, shot.light, f, extraAb);
  fx.grain.seed = f;

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
  inkOptions?: InkOptions;
  grainAmount?: number;
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
  inkOptions,
  grainAmount,
}: ShotViewProps<TAssets>) {
  const dpr = dprOverride();
  return (
    <AbsoluteFill style={{ opacity: alpha }}>
      <ThreeCanvas
        width={width}
        height={height}
        {...(dpr ? { dpr } : {})}
        shadows
        gl={{
          antialias: false,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          toneMappingExposure: 1.0,
        }}
        camera={{ fov: 40, near: 0.2, far: 1500 }}
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
          inkOptions={inkOptions}
          grainAmount={grainAmount}
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
  inkOptions,
  grainAmount = 0.026,
  width,
  height,
  background = "#06080f",
}: ShortPlayerProps<TAssets>) {
  const f = useCurrentFrame();
  const vc = useVideoConfig();
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
          inkOptions={inkOptions}
          grainAmount={grainAmount}
        />
      ))}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash, mixBlendMode: "screen" }} />}
      {activeOverlays.map((ov, i) => (
        <AbsoluteFill
          key={`ov-${i}`}
          style={{
            ...(ov.radial
              ? {
                  background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 34%, ${ov.color} 100%)`,
                }
              : {
                  background: ov.color,
                }),
            opacity: ov.opacity,
            ...(ov.blend === "screen" ? { mixBlendMode: "screen" } : {}),
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
