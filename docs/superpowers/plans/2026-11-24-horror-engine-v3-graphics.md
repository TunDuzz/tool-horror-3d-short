# Horror Engine v3 Graphics & Consistency Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `tool-horror-3d-short`'s graphics engine, look-dev skills, and QA scripts into **Horror Engine v3 ("3D Stylized Dark-Horror POV")** — featuring non-chibi articulated 3D dark-horror characters & 1st-person POV rigs, clean Inverted-Hull + architectural outlines, soft stylized lighting with real shadows & HDR bloom, deterministic GPU Whip-Pan motion blur, modular anti-repetition environments, opt-in POV HUD, and a 3-layer Script-to-Frame consistency lock verified visually via `HorrorLabV3`.

**Architecture:** Replace the legacy 2D Canvas billboard actor pipeline (`toon.ts`, `cast.ts`, `cardshade.ts`) in `templates/engine/` with pure-Three.js procedural 3D rigged humanoids/entities (`rig3d.ts`, `face2d.ts`, `povRig.ts`), smooth-normal Inverted-Hull outlines (`outline3d.ts`) isolated on `NOINK` from architectural `InkPass`, soft wrapped shading with 6 local PointLights + 1 SpotLight (`shade.ts`, `lights.ts`), deterministic frame-delta Whip-Pan directional motion blur (`motionblur.ts`), 15+ clean painterly textures & modular architectural builders (`paint.ts`, `build.ts`), and a single-source-of-truth `SceneManifest` (`manifest.ts`) checked by `validate_manifest.py` against `LOCATION_REGISTRY.json`.

**Tech Stack:** TypeScript 5.7, Three.js 0.170, `@react-three/fiber` 9.7, `postprocessing` 6.36, Remotion 4.0, React 19, Node.js 22 (`node --test`), Python 3 (`unittest`, `numpy`, `Pillow`, `ffmpeg`).

**Spec:** [docs/superpowers/specs/2026-11-24-horror-engine-v3-graphics-design.md](../specs/2026-11-24-horror-engine-v3-graphics-design.md)

## Global Constraints

- **Runtime & Hardware:** Node v22+, Three.js `0.170.0`, `@react-three/fiber` `^9.7`, `postprocessing` `^6.36`, Remotion `^4.0.545`, tested on Linux (GTX 960M 4GB VRAM) with cross-platform Linux/macOS/Windows WebGL (`swangle` / `angle`).
- **Resolution & Scaling:** `9:16` (`1080×1920`, primary) and `16:9` (`1920×1080`); integer-clean `--scale` (`1`, `1.25`, `1.5` — never `1.3333`); all pixel-sized post effects scale by `Math.min(width, height) / 1080`.
- **Remotion Parallel Determinism:** Every frame evaluation (poses, blinks, flicker, smoke, camera Whip-Pan velocity) MUST be a pure function of `frame` (zero `Math.random()`, zero stateful previous-frame cache).
- **Strict Engine Neutrality (`GEMINI.md`):** Zero story-specific characters, rooms, or dialogue hardcoded in `templates/engine/`.
- **Strict v3 `LightKey` Enum:** TypeScript `LightKey` is strictly `"warmLamp" | "coldMoon" | "fluorescent" | "duskFog" | "flashlight"` (no v2 `blood`/`eerie` aliases).
- **Non-Chibi Dark-Horror Aesthetic:** Adult proportions `5.5–6.0` head-heights, clean bold outlines (`5–7 px` at 1080p Inverted-Hull; `4.6 → 2.2 px` architectural `InkPass`), soft shading + HDR bloom, zero `Pen.grit` wobble, zero `cross-hatching`, zero `gradeGrime` fake scratches, zero flat 2D billboard characters.

## Review Focus

1. **Out-of-order Remotion frame determinism & cut-boundary Whip-Pan velocity:** Evaluating frame `f` after any arbitrary prior frame must yield identical camera velocity, and the first frame of any hard cut (`f === shot.a` or `k.cut === true`) MUST yield `(0, 0)` velocity so cuts never smear (pinned in Task 1 & Task 2).
2. **Smooth-normal Inverted-Hull corner integrity & `NOINK` isolation:** Characters and POV hands must live on `NOINK` (preventing double-thick outlines with `InkPass`), and `computeSmoothNormals` must average normals across coincident vertices so box/bevel corners never split open (pinned in Task 2 & Task 3).
3. **Cross-Video & Cross-Part Anti-Repetition Enforcement:** `validate_manifest.py` must reject two unrelated videos or unrelated parts (without `sameLocationOf`) sharing `(archetype + ceilingType + materials)` or `>= 60%` overlap with `ANTI_REPEAT_ERROR`, while explicitly allowing legitimate narrative revisits via `sameLocationOf` (pinned in Task 7).
4. **Single-Source Script-to-Frame Sync (`Phone3D` ↔ HUD ↔ Lights ↔ `SCRIPT.md`):** `hudFromManifest` and `isLampLit` must reflect exact beat states (`clock`, `notifSender`, `lampsOn`), and `validate_manifest.py` must reject mismatched `SCRIPT.md` lines, out-of-tolerance `words.json` timestamps (`> 0.35s`), or phone/HUD mismatches (pinned in Task 1 & Task 7).
5. **Zero false-positive `pops` on intentional Whip-Pan bursts in `short_qa.py`:** `extract_shots.py` must export `whipPan` windows into `shots.json` `planned`, so `short_qa.py` does not flag intentional 6–8f Whip-Pan motion-blur turns as unplanned pops while still catching genuine glitch spikes (pinned in Task 7).

---

## File Map

| Path | Responsibility |
|---|---|
| `templates/engine/camera.ts` | v3 `LightKey`, POV `ShotScale`, `whipPan`, `povBreath`, deterministic `evalCamVelocity`, overlays/DOF |
| `templates/engine/lights.ts` | 5 physical presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), `lerpLights`, `lerpLook`, `LocalLight`, `SpotLightCfg` |
| `templates/engine/manifest.ts` | `LocationBlueprint`, `ScriptBeat`, `SceneManifest`, `beatAt`, `isLampLit`, `propStateOf`, `hudFromManifest` |
| `templates/engine/shade.ts` | Soft stylized cel/Lambert shader (`stylizedShade`) + 6 `PointLight`s + 1 `SpotLight` + shadows + flash + `untone` |
| `templates/engine/outline3d.ts` | `computeSmoothNormals`, distance-clamped Inverted-Hull `createOutlineMaterial`, `attachOutline` |
| `templates/engine/ink.ts` | Clean architectural screen-space `InkPass` (layer 0 only) + `NOINK` + `noInkFallback` |
| `templates/engine/motionblur.ts` | Deterministic 13-tap GPU `WhipMotionBlurEffect` with zero-cost pass-through below `2.5 px` |
| `templates/engine/grade.ts` | Clean 5-preset v3 tone curve, subtle edge CA (`<= 0.12` base), soft vignette, `lerpGrade` (zero `gradeGrime`) |
| `templates/engine/lensblur.ts` | Thin-lens DOF + minimal `0.008` anti-banding `GrainEffect` |
| `templates/engine/face2d.ts` | 512×512 clean-line dark-horror animated 2D face Canvas generator & `FaceTextureCache` |
| `templates/engine/rig3d.ts` | 15-bone procedural non-chibi 3D humanoid & `EntityConfig` uncanny monster builder + pose solver |
| `templates/engine/povRig.ts` | 1st-person POV lower body + dual arms/hands + `Phone3D`, `Flashlight3D`, `HandheldOilLamp3D`, `PaperProp3D` |
| `templates/engine/fx3d.ts` | Frame-deterministic 3D incense smoke wisps, dust motes, volumetric cones, flat decals, rain |
| `templates/engine/paint.ts` | 15+ clean painterly tileable Canvas2D textures (`thatchRoofTex`, `mottledPlasterTex`, `reedMatTex`, `hospitalTileTex`, etc.) |
| `templates/engine/build.ts` | Neutral modular architectural & hero-prop builders (`addWallWithOpening`, `addAFrameRoof`, `addDoubleDoorWithCracks`, `addCorridorBay`, `addStairFlight`, `addGlassOilLamp3D`, `addIncenseBurner3D`, etc.) |
| `templates/engine/HorrorHUD.tsx` | Opt-in Remotion DOM narrative HUD (header, speaker pill + subtitles, phone popup, clock time-skip, choice card) |
| `templates/engine/ShortPlayer.tsx` | Unified v3 R3F + EffectComposer + WhipMotionBlur + Bloom + Grade + HorrorHUD player |
| `templates/engine/index.ts` | Clean v3 barrel exports (legacy `toon.ts`, `cast.ts`, `cardshade.ts` removed) |
| `templates/scripts/validate_manifest.py` | Timeline, `SCRIPT.md`/`words.json`, `Phone3D`↔HUD sync, and `LOCATION_REGISTRY.json` Anti-Repetition validator + `still_manifest.json` generator |
| `templates/scripts/extract_shots.py` | Extracts shots, overlays, kicks, and `whipPan` ranges into `shots.json` |
| `templates/scripts/short_qa.py` | POV-aware dark & directing QA (allows continuous POV turns, checks v3 readability) |
| `templates/scripts/render-stills.mjs` | Adds `--manifest <still_manifest.json>` batch peak-frame still rendering |
| `templates/scripts/horror_story.py` & `companion-skills/horror-story/scripts/horror_story.py` & `templates/scripts/validate_continuity.py` | Minimal `VALID_LIGHTS` v3 sync |
| `templates/horror-lab-v3/*` & `templates/project/Root.tsx` | 3-archetype visual proof composition + v3 Root registration |
| `SKILL.md`, `companion-skills/horror-world-lookdev/SKILL.md`, `references/HORROR_STYLE_BIBLE.md`, `references/LIGHTING_AND_PALETTE.md`, `references/READABILITY_AND_QA.md`, `templates/project/GEMINI.md`, `README.md` | Overhauled Phase-1 v3 documentation & benchmark stills |

---

### Task 1: Core v3 Contracts — Camera Velocity, Physical Lighting Presets & `SceneManifest`

**Files:**
- Delete: `templates/engine/toon.ts`, `templates/engine/cast.ts`, `templates/engine/cardshade.ts`
- Modify: `templates/engine/camera.ts`, `templates/engine/lights.ts`, `.gitignore`
- Create: `templates/engine/manifest.ts`
- Test: `tests/engine_core.test.ts`

**Interfaces:**
- Produces in `camera.ts`:
  - `export type LightKey = "warmLamp" | "coldMoon" | "fluorescent" | "duskFog" | "flashlight";`
  - `export type ShotScale = "POV" | "POV_TURN" | "POV_DOWN" | "POV_PROP" | "POV_CU" | "EWS" | "WS" | "MS" | "MCU" | "CU" | "ECU" | "OTS" | "LOW" | "HIGH";`
  - `export type WhipPanSpec = { f0: number; dur?: number; fromLook: V3; toLook: V3; rollPeak?: number };`
  - `export const whipPan = (pos: V3, spec: WhipPanSpec, f: number, fov?: number): ShotCam`
  - `export const povBreath = (c: ShotCam, f: number, amp?: number, freq?: number, seed?: number): ShotCam`
  - `export type CamVelocity = { vx: number; vy: number; speedPx: number };`
  - `export const evalCamVelocity = (evalAt: (f: number) => Cam, f: number, cutStartFrame: number, aspect: number, heightPx?: number, shutterScale?: number, maxBlurPx?: number): CamVelocity`
- Produces in `lights.ts`:
  - `export type LocalLight = { pos: V3; color: [number, number, number]; radius: number };`
  - `export type SpotLightCfg = { pos: V3; target: V3; color: [number, number, number]; distance: number; angleDeg: number; penumbra: number };`
  - `export const LIGHTS: Record<LightKey, LightPreset>` and `export const LOOK: Record<LightKey, WorldLook>`
  - `export const lerpLights = (a: LightPreset, b: LightPreset, t: number): LightPreset`
  - `export const lerpLook = (a: WorldLook, b: WorldLook, t: number): WorldLook`
- Produces in `manifest.ts`:
  - `export type HudCaption = { a: number; b: number; speaker?: string; speakerColor?: string; text: string; highlight?: string[] };`
  - `export type HudNotification = { a: number; b: number; sender: string; time: string; body: string; footer?: string };`
  - `export type HudTimeSkip = { a: number; b: number; clockFrom: string; clockTo: string; label: string };`
  - `export type HudChoiceCard = { a: number; b: number; header: string; question: string; options: [string, string]; prompt?: string };`
  - `export type HorrorHudConfig = { header?: { title: string; subtitle?: string; badge?: string }; captions?: HudCaption[]; notifications?: HudNotification[]; timeSkips?: HudTimeSkip[]; choiceCard?: HudChoiceCard };`
  - `export type CeilingType = "aFrameThatch" | "aFrameTile" | "flatConcrete" | "dropCeiling" | "vaulted" | "openSky" | "vehicleCabin";`
  - `export type LocationBlueprint = { id: string; archetype: string; dimensions: [number, number, number]; ceilingType: CeilingType; materials: { wall: string; floor: string; ceiling: string }; practicalLights: string[]; heroProps: string[]; signatureShadowBeat: string; sameLocationOf?: string };`
  - `export type PoseAction = "sitCrossLegged" | "sitChair" | "standIdle" | "walk" | "creep" | "turnHead" | "peerForward" | "recoil" | "point" | "holdPhone" | "holdLantern" | "lunge" | "loomingStill" | "peekAroundDoor";`
  - `export type FaceExpr = "calm" | "wary" | "uneasy" | "dread" | "terrified" | "deadStare" | "unsettlingSmile" | "hollow";`
  - `export type BeatLightState = { preset: LightKey; blendTo?: LightKey; blendRange?: [number, number]; lampsOn: string[]; doorMoonlight?: boolean; feetShadow?: boolean };`
  - `export type CastBeatState = { visible: boolean; anchor: string; pose: PoseAction; expr?: FaceExpr; lookAt?: string | V3; eyeGlow?: boolean };`
  - `export type PropBeatState = { visible: boolean; state: string; detail?: Record<string, string | number | boolean> };`
  - `export type ScriptBeat = { beatId: string; shotId: number; a: number; b: number; peakFrame: number; locationId: string; spokenLine?: { speaker?: string; speakerColor?: string; text: string; highlight?: string[] }; lightState: BeatLightState; castStates: Record<string, CastBeatState>; propStates: Record<string, PropBeatState>; cameraIntent: string };`
  - `export type SceneManifest = { projectId: string; title: string; totalFrames: number; aspect: "9:16" | "16:9"; locations: LocationBlueprint[]; beats: ScriptBeat[]; header?: { title: string; subtitle?: string; badge?: string }; timeSkips?: HudTimeSkip[]; choiceCard?: HudChoiceCard };`
  - `export const beatAt = (m: SceneManifest, f: number): ScriptBeat`
  - `export const isLampLit = (beat: ScriptBeat, lampId: string): boolean`
  - `export const propStateOf = (beat: ScriptBeat, propId: string): PropBeatState | undefined`
  - `export const hudFromManifest = (m: SceneManifest): HorrorHudConfig`

- [ ] **Step 1: Add `shorts-project/` to `.gitignore`, bootstrap `shorts-project/` dev dependencies, and write failing unit tests in `tests/engine_core.test.ts`**

Add `shorts-project/` to `.gitignore`. Copy `templates/project/{package.json,tsconfig.json}` into gitignored `shorts-project/` and run `npm --prefix shorts-project install` so `three`, `postprocessing`, `react`, `remotion`, and `tsc` are available for unit tests and typechecking across Tasks 1–9 (invoke Node tests with `NODE_PATH=shorts-project/node_modules node --test ...` or a tiny workspace sync). Create `tests/engine_core.test.ts` testing:
1. `LIGHTS` and `LOOK` contain exact keys `["warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"]` and exclude `"blood"`.
2. `lerpLights(LIGHTS.warmLamp, LIGHTS.coldMoon, 0.5)` interpolates `lit`, `shade`, `fogNear`, `fogFar`, and `fog` hex cleanly.
3. `whipPan` moves smoothly from `fromLook` at `f0` to `toLook` at `f0 + dur`, and `evalCamVelocity` returns **exact `{ vx: 0, vy: 0, speedPx: 0 }` when `f <= cutStartFrame`** (Review Focus #1), identical non-zero `speedPx > 8` on mid-whip frame regardless of call order, and `speedPx <= maxBlurPx`.
4. `beatAt`, `isLampLit`, `propStateOf`, and `hudFromManifest` extract synced `captions` and `notifications` directly from `ScriptBeat.spokenLine` and `propStates.phone.detail` (Review Focus #4).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_core.test.ts`
Expected: FAIL (missing `manifest.ts`, `whipPan`, `evalCamVelocity`, v3 `LightKey`).

- [ ] **Step 3: Remove legacy v2 2D billboard modules and implement `camera.ts`, `lights.ts`, and `manifest.ts`**

Remove `templates/engine/toon.ts`, `templates/engine/cast.ts`, `templates/engine/cardshade.ts`.
Update `templates/engine/camera.ts` with v3 `LightKey`, POV `ShotScale`, `whipPan`, `povBreath`, `evalCamVelocity` (computing angular delta `(Δyaw, Δpitch)` between `evalAt(f)` and `evalAt(f - 1)` in camera basis, returning zero when `f <= cutStartFrame`).
Update `templates/engine/lights.ts` with the 5 physical horror presets calibrated to `videomau` metrics (`warmLamp` amber key + velvet `#1e1722` shadow, `coldMoon` slate-blue `#191c26`, `fluorescent`, `duskFog`, `flashlight`) + `lerpLights` / `lerpLook`.
Create `templates/engine/manifest.ts` implementing the full `SceneManifest` schema and evaluators (`beatAt`, `isLampLit`, `propStateOf`, `hudFromManifest`).

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_core.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add -A .gitignore templates/engine/camera.ts templates/engine/lights.ts templates/engine/manifest.ts tests/engine_core.test.ts
git rm templates/engine/toon.ts templates/engine/cast.ts templates/engine/cardshade.ts
git commit -m "feat(engine-v3): add v3 lighting presets, deterministic whipPan velocity, and SceneManifest"
```

---

### Task 2: Soft Stylized Shading, Smooth-Normal Inverted-Hull Outlines, Clean InkPass, Whip-Pan Motion Blur & Clean Grade

**Files:**
- Modify: `templates/engine/shade.ts`, `templates/engine/ink.ts`, `templates/engine/grade.ts`, `templates/engine/lensblur.ts`
- Create: `templates/engine/outline3d.ts`, `templates/engine/motionblur.ts`
- Test: `tests/engine_shaders.test.ts`

**Interfaces:**
- Consumes: `LightKey`, `LightPreset`, `WorldLook`, `LocalLight`, `SpotLightCfg` from `lights.ts` / `camera.ts`; `NOINK` from `ink.ts`.
- Produces in `shade.ts`:
  - `export const TONE`, `export const DYNAMIC_LIGHTS` (6 PointLights `uPtPos[6]`, `uPtCol[6]`, `uPtRad[6]` + 1 SpotLight `uSpPos`, `uSpDir`, `uSpCol`, `uSpDist`, `uSpCosIn`, `uSpCosOut` + `uFlashAmt`, `uFlashCol`)
  - `export function applyLightUniforms(L: LightPreset, K?: WorldLook): void`
  - `export function setLocalLights(lights: LocalLight[]): void`
  - `export function setSpotLight(spot: SpotLightCfg | null): void`
  - `export function setLightningFlash(amount: number, color?: [number, number, number]): void`
  - `export function stylizedShade<T extends THREE.MeshLambertMaterial | THREE.MeshPhongMaterial>(m: T, liftK?: number): T` (also export alias `twoTone = stylizedShade` only if needed internally, prefer `stylizedShade`)
  - `export const untone: (target: THREE.ColorRepresentation, out?: THREE.Color) => THREE.Color`
- Produces in `outline3d.ts`:
  - `export type OutlineOpts = { color?: string; pxWidth?: number; minWorld?: number; maxWorld?: number };`
  - `export function computeSmoothNormals(geo: THREE.BufferGeometry): THREE.BufferGeometry`
  - `export function createOutlineMaterial(opts?: OutlineOpts): THREE.ShaderMaterial`
  - `export function attachOutline(target: THREE.Object3D, opts?: OutlineOpts): THREE.Group` (clones mesh geometries with smooth normals, `THREE.BackSide`, `NOINK` layer, `#06060a`, default `pxWidth = 6.0` at 1080p)
- Produces in `motionblur.ts`:
  - `export class WhipMotionBlurEffect extends Effect` with `setVelocity(vx: number, vy: number, speedPx: number): void`
- Produces in `grade.ts`:
  - `export const GRADES: Record<LightKey, GradeParams>` (5 v3 presets; zero `gradeGrime` scratch code)
  - `export function gradeFor(fx: GradeEffect, light: LightKey, frame?: number, extraAberration?: number, blendTo?: LightKey, blendT?: number): void`

- [ ] **Step 1: Write failing unit tests in `tests/engine_shaders.test.ts`**

Test:
1. `computeSmoothNormals` on a non-indexed `THREE.BoxGeometry(1, 1, 1)` averages the 3 orthogonal face normals at corner `(0.5, 0.5, 0.5)` into normalized `(+1/√3, +1/√3, +1/√3)` within `1e-4` (Review Focus #2).
2. `attachOutline` on a mesh sets `NOINK` layer on both the source mesh and its BackSide outline sibling, uses `THREE.BackSide`, and skips meshes marked `userData.noOutline = true` (Review Focus #2).
3. `setLocalLights` stores up to 6 lights cleanly and zeroes slots `>= lights.length`; `setSpotLight(null)` disables spotlight cleanly (`uSpDist = 0`); `setSpotLight(cfg)` computes `uSpCosIn > uSpCosOut`.
4. `WhipMotionBlurEffect` initializes `uVel = (0, 0)` and passes through zero velocity when `speedPx < 2.5`; clamps large velocity cleanly.
5. `GRADES` contains exact 5 v3 keys (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`) and `grade.ts` source contains zero `gradeGrime` scratch shader logic; `gradeFor` blends two presets smoothly.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_shaders.test.ts`
Expected: FAIL (`outline3d.ts` and `motionblur.ts` missing, `shade.ts` only has 3 lights, `grade.ts` has v2 keys).

- [ ] **Step 3: Implement `shade.ts`, `outline3d.ts`, `ink.ts`, `motionblur.ts`, `grade.ts`, and update `lensblur.ts`**

- `shade.ts`: Soft wrapped ramp `smoothstep(-0.18, 0.72, ndl)` + real shadow visibility `sunVis` + subtle rim + 6 local PointLights (`pow(clamp(1.0 - d/r, 0.0, 1.0), 1.85)`) + 1 SpotLight cone (`smoothstep(uSpCosOut, uSpCosIn, dot(-lDir, uSpDir))`) + lightning flash.
- `outline3d.ts`: Position-hashed smooth normal averaging (`1e-4` quantization) stored in attribute `aSmoothNormal`, extruded in vertex shader along `aSmoothNormal` with perspective-distance clamped world thickness `clamp(clipW * (pxWidth / minRes) * kFov, minWorld, maxWorld)`, fragment color `#06060a` with distance fog fade.
- `ink.ts`: Recalibrate defaults (`color: "#06060b"`, `widthNear: 4.6`, `widthFar: 2.2`, `angleLo: 42`, `angleHi: 58`, `concaveGain: 0.58`, `depthLo: 0.012`), ensure `noInkFallback` respects `NOINK` layer cleanly without overriding world layer-0 geometry.
- `motionblur.ts`: 13-tap centered Gaussian directional gather along `uVel` in `WhipMotionBlurEffect`; early-out `if (uStrength < 0.001) { outputColor = inputColor; return; }`.
- `grade.ts`: Clean 5-preset tone curves calibrated to `videomau` (`p5 ≈ 0.038`, `p95 ≈ 0.85`), subtle peripheral CA (`base <= 0.12`), soft vignette, `lerpGrade` support, zero `gradeGrime`.
- `lensblur.ts`: Change `GrainEffect` default `amount = 0.008`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_shaders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/engine/shade.ts templates/engine/outline3d.ts templates/engine/ink.ts templates/engine/motionblur.ts templates/engine/grade.ts templates/engine/lensblur.ts tests/engine_shaders.test.ts
git commit -m "feat(engine-v3): add stylizedShade, smooth Inverted-Hull outlines, WhipMotionBlurEffect, and clean grade"
```

---

### Task 3: 3D Stylized Dark-Horror Character Rig & Clean-Line Animated 2D Face System

**Files:**
- Create: `templates/engine/face2d.ts`, `templates/engine/rig3d.ts`
- Test: `tests/engine_rig3d.test.ts`

**Interfaces:**
- Consumes: `stylizedShade` from `shade.ts`; `attachOutline` from `outline3d.ts`; `NOINK` from `ink.ts`; `PoseAction`, `FaceExpr` from `manifest.ts`; `V3`, `clamp01` from `camera.ts`.
- Produces in `face2d.ts`:
  - `export type FaceSpec = { expr: FaceExpr; lid?: number; gazeX?: number; gazeY?: number; pupilScale?: number; mouth?: "closed" | "parted" | "talkA" | "talkO" | "talkE" | "tense" | "gasp" | "unsettlingSmile" | "jawSlack"; skinCol?: string; eyeHollow?: number; browCol?: string; eyeGlow?: boolean; ageLines?: boolean };`
  - `export function drawFace2D(ctx: CanvasRenderingContext2D, spec: FaceSpec): void` (512×512 clean-line dark-horror face: almond eyes, contracted pinpoint pupil support, soft gradient under-eye hollows, zero `Pen.grit`, zero solid black sunglass blocks)
  - `export class FaceTextureCache` (`get(spec: FaceSpec): THREE.CanvasTexture`, `dispose(): void`)
- Produces in `rig3d.ts`:
  - `export type HairStyle = "shortParted" | "spiky" | "elderThin" | "bun" | "longDraped" | "messyFringe" | "bald";`
  - `export type GarmentStyle = "funeralRobe" | "shirt" | "coat" | "hospitalGown" | "casualJacket" | "shroud";`
  - `export type EntityConfig = { heightScale?: number; gauntness?: number; armScale?: number; fingerScale?: number; neckTiltDeg?: number; shoulderSkew?: number; hairCurtain?: boolean; silhouetteMode?: boolean; eyeGlow?: boolean; eyeGlowColor?: [number, number, number]; breathing?: boolean; steppedFps?: number };`
  - `export type CharacterConfig = { id: string; height?: number; skinCol?: string; hairCol?: string; hairStyle?: HairStyle; topCol?: string; bottomCol?: string; shoeCol?: string; garment?: GarmentStyle; headbandCol?: string; outlinePx?: number; entity?: EntityConfig };`
  - `export type RigSockets = { root: THREE.Group; pelvis: THREE.Group; spine: THREE.Group; chest: THREE.Group; neck: THREE.Group; head: THREE.Group; leftShoulder: THREE.Group; leftUpperArm: THREE.Group; leftForearm: THREE.Group; leftHand: THREE.Group; rightShoulder: THREE.Group; rightUpperArm: THREE.Group; rightForearm: THREE.Group; rightHand: THREE.Group; leftThigh: THREE.Group; leftCalf: THREE.Group; leftFoot: THREE.Group; rightThigh: THREE.Group; rightCalf: THREE.Group; rightFoot: THREE.Group };`
  - `export type Character3D = { group: THREE.Group; sockets: RigSockets; config: CharacterConfig; setFace: (spec: FaceSpec) => void; setPose: (action: PoseAction, frame: number, opts?: PoseEvalOpts) => void; lookAtWorld: (target: V3, weight?: number) => void; dispose: () => void };`
  - `export function createCharacter3D(cfg: CharacterConfig): Character3D`

- [ ] **Step 1: Write failing unit tests in `tests/engine_rig3d.test.ts`**

Test:
1. `createCharacter3D({ id: "npc", height: 1.72 })` builds all 20 named sockets in `RigSockets`, has bounding-box height `1.65–1.80m` and head height `<= 0.31m` (`height / headH >= 5.3` — strictly non-chibi!).
2. Every mesh inside `char.group` has `NOINK` layer enabled (Review Focus #2) and outline meshes use `THREE.BackSide`.
3. `EntityConfig` overrides (`heightScale: 1.18`, `armScale: 1.25`, `neckTiltDeg: 28`, `silhouetteMode: true`, `eyeGlow: true`) scale arm length, tilt `sockets.neck.rotation.z`, and create HDR emissive eyes (`toneMapped: false`).
4. `setPose("sitCrossLegged", 30)` vs `setPose("walk", 30)` vs `setPose("loomingStill", 30)` produce distinct deterministic bone rotations; identical calls at frame `42` produce byte-identical transforms regardless of prior frames.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_rig3d.test.ts`
Expected: FAIL (`face2d.ts` and `rig3d.ts` do not exist).

- [ ] **Step 3: Implement `templates/engine/face2d.ts` and `templates/engine/rig3d.ts`**

- `face2d.ts`: Clean 512×512 Canvas2D renderer with graceful handling for headless Node tests (creates offscreen canvas or skips canvas creation cleanly if `document` is undefined). Almond eye geometry, crisp dark iris + variable `pupilScale`, subtle eye-white shading, soft radial under-eye hollow gradient (`rgba(26,18,34,0.34)`), expressive brow curves, and clean mouth paths.
- `rig3d.ts`: Sculpted `LatheGeometry` head with angular jaw & cheekbones, protruding sculpted 3D nose bridge, ear shells, 3D hair meshes (`hairStyle` + long hanging curtain strands for `hairCurtain`), smooth tapered limb capsules/lathes, 5-part hand geometry, clean garment shells (`funeralRobe`, `shirt`, `coat`, `hospitalGown`, `casualJacket`, `shroud`) with subtle UV fabric fold texture, smooth-normal Inverted-Hull outlines via `attachOutline`, and deterministic pose solver for all 14 `PoseAction`s (living breathing chest motion vs eerie stillness when `entity.breathing === false`, plus `uncannyTwitch` micro head-snaps).

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_rig3d.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/engine/face2d.ts templates/engine/rig3d.ts tests/engine_rig3d.test.ts
git commit -m "feat(engine-v3): add non-chibi 3D dark-horror character rig and clean-line face2d system"
```

---

### Task 4: 1st-Person POV Rig, Diegetic 3D Props & 3D Atmospheric FX

**Files:**
- Create: `templates/engine/povRig.ts`, `templates/engine/fx3d.ts`
- Test: `tests/engine_pov_fx.test.ts`

**Interfaces:**
- Consumes: `stylizedShade` from `shade.ts`; `attachOutline` from `outline3d.ts`; `NOINK` from `ink.ts`; `LocalLight`, `SpotLightCfg` from `lights.ts`; `V3`, `flickerAt` from `camera.ts`.
- Produces in `povRig.ts`:
  - `export type PhoneScreenState = { clock: string; date?: string; carrier?: string; battery?: number; notifications?: Array<{ sender: string; time?: string; body: string }> };`
  - `export type Phone3D = { group: THREE.Group; setScreen: (state: PhoneScreenState) => void; getLight: (intensity?: number) => LocalLight; dispose: () => void };`
  - `export type Flashlight3D = { group: THREE.Group; setOn: (on: boolean, intensity?: number) => void; getSpotLight: () => SpotLightCfg | null };`
  - `export type HandheldOilLamp3D = { group: THREE.Group; setLit: (lit: boolean, frame: number) => void; getLight: (frame: number) => LocalLight | null };`
  - `export type PaperProp3D = { group: THREE.Group; setText: (title: string, lines: string[]) => void; dispose: () => void };`
  - `export type PovPose = { stance: "seated" | "standing"; anchor: V3; bodyYaw: number; leftArmRaise?: number; rightArmRaise?: number; propMode?: "none" | "phone" | "flashlight" | "lamp" | "paper"; frame: number };`
  - `export type PovRig3D = { group: THREE.Group; lowerBody: THREE.Group; armsRoot: THREE.Group; leftHand: THREE.Group; rightHand: THREE.Group; update: (cam: THREE.PerspectiveCamera, pose: PovPose) => void };`
  - `export function createPhone3D(initial?: PhoneScreenState): Phone3D`
  - `export function createFlashlight3D(): Flashlight3D`
  - `export function createHandheldOilLamp3D(): HandheldOilLamp3D`
  - `export function createPaperProp3D(): PaperProp3D`
  - `export function createPovRig3D(opts?: { skinCol?: string; sleeveCol?: string; pantsCol?: string; shoeCol?: string; outlinePx?: number }): PovRig3D`
- Produces in `fx3d.ts`:
  - `export type SmokeWisps3D = { group: THREE.Group; update: (frame: number, active?: boolean) => void };`
  - `export type DustMotes3D = { group: THREE.Group; update: (frame: number) => void };`
  - `export function addRisingSmokeWisps(parent: THREE.Object3D, origin: V3, opts?: { count?: number; height?: number; color?: string; opacity?: number }): SmokeWisps3D`
  - `export function addDustMotes(parent: THREE.Object3D, center: V3, bounds: V3, count?: number, seed?: number): DustMotes3D`
  - `export function addVolumetricCone(parent: THREE.Object3D, origin: V3, target: V3, rTop: number, rBot: number, color?: string, opacity?: number): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }`
  - `export function createFlatDecalMesh(tex: THREE.Texture, w: number, h: number, opacity?: number): THREE.Mesh`

- [ ] **Step 1: Write failing unit tests in `tests/engine_pov_fx.test.ts`**

Test:
1. `createPovRig3D()` creates `lowerBody`, `armsRoot`, `leftHand`, `rightHand` on `NOINK` layer with smooth Inverted-Hull outlines, and `update(cam, pose)` positions `lowerBody` at `pose.anchor` and aligns `armsRoot` to camera yaw/pitch deterministically.
2. `createPhone3D({ clock: "01:06" })` returns a valid `LocalLight` in world space when parented under `pov.rightHand`; `createFlashlight3D().getSpotLight()` returns `null` when turned off (`setOn(false)`) and a valid `SpotLightCfg` when turned on.
3. `addRisingSmokeWisps` and `addDustMotes` place all meshes on `NOINK` and produce deterministic positions for the same `frame` regardless of call order.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_pov_fx.test.ts`
Expected: FAIL (`povRig.ts` and `fx3d.ts` missing).

- [ ] **Step 3: Implement `templates/engine/povRig.ts` and `templates/engine/fx3d.ts`**

- `povRig.ts`: Slender horror-proportioned POV arms, palms, articulated thumb + 4 curled fingers gripping held props; `Phone3D` with Canvas2D lockscreen renderer (Viettel/signal/battery, bold digital clock, rounded white message cards, HDR emissive brightness `1.45` for bloom halo on fingers); `Flashlight3D` with emissive lens + directional `SpotLightCfg` + subtle cone; `HandheldOilLamp3D` with curved oil bulb + translucent glass chimney + flickering HDR flame; `PaperProp3D` with handwritten note texture.
- `fx3d.ts`: Smooth feathered ShaderMaterial rising smoke wisps (for incense/extinguished candles), floating dust motes in light beams, feathered volumetric cone, and perspective-locked flat decals on `NOINK`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_pov_fx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/engine/povRig.ts templates/engine/fx3d.ts tests/engine_pov_fx.test.ts
git commit -m "feat(engine-v3): add 1st-person POV rig, diegetic 3D props, and deterministic 3D FX"
```

---

### Task 5: Expanded Clean Painterly Texture Library & Modular Anti-Repetition Architectural Builders

**Files:**
- Modify: `templates/engine/paint.ts`, `templates/engine/build.ts`
- Test: `tests/engine_world_kits.test.ts`

**Interfaces:**
- Consumes: `stylizedShade` from `shade.ts`; `NOINK` from `ink.ts`; `attachOutline` from `outline3d.ts`.
- Produces in `paint.ts`:
  - Core helpers: `rng`, `ctex`, `rep`, `jit`, `waterNear`, `waterFar`, `horrorCloudHD`
  - 16 clean painterly texture factories: `thatchRoofTex`, `tileRoofTex`, `concreteCeilingTex`, `corrugatedTinTex`, `mottledPlasterTex`, `brickWallTex`, `hospitalTileTex`, `paintedConcreteTex`, `darkTimberWallTex`, `terracottaFloorTex`, `vintagePatternTileTex`, `reedMatTex`, `wetAsphaltTex`, `packedEarthTex`, `woodenFloorTex`, `garmentFoldTex`
- Produces in `build.ts`:
  - Core: `Batch`, `V`, `lam`, `phong`, `quad`, `tri`, `boxGeo`, `taperedBoxGeo`, `pitchedRoofGeo`, `Strand` (with `lam`/`phong` wired to `stylizedShade`!)
  - Modular anti-repetition architectural & hero-prop builders:
    - `export function addWallWithOpening(b: Batch, mat: THREE.Material, wallMin: V3, wallMax: V3, opening: { axis: "x" | "z"; u0: number; u1: number; y0: number; y1: number }, tile?: number): void`
    - `export function addAFrameRoof(b: Batch, trussMat: THREE.Material, roofMat: THREE.Material, cfg: { cx: number; cz: number; width: number; depth: number; eaveY: number; ridgeH: number; trussCount?: number; tile?: number }): void`
    - `export type DoubleDoorCtrl = { group: THREE.Group; leftPivot: THREE.Group; rightPivot: THREE.Group; boltBar: THREE.Mesh; moonStrip: THREE.Mesh; feetBlockers: THREE.Group; setOpen: (rad: number) => void; setMoonlight: (on: boolean, feetShadow?: boolean) => void };`
    - `export function addDoubleDoorWithCracks(parent: THREE.Object3D, mats: { frame: THREE.Material; leaf: THREE.Material; bolt: THREE.Material }, cfg: { pos: V3; yaw?: number; width?: number; height?: number; crackW?: number; bottomGap?: number; moonColor?: string }): DoubleDoorCtrl`
    - `export function addCorridorBay(b: Batch, mats: { wall: THREE.Material; floor: THREE.Material; ceiling: THREE.Material; trim: THREE.Material }, cfg: { z0: number; z1: number; width: number; height: number; doorLeft?: boolean; doorRight?: boolean }): void`
    - `export function addStairFlight(b: Batch, stepMat: THREE.Material, railMat: THREE.Material, cfg: { start: V3; steps: number; width: number; stepRise: number; stepRun: number; yaw?: number }): void`
    - `export function addGlassOilLamp3D(parent: THREE.Object3D, pos: V3, scale?: number): { group: THREE.Group; flameMat: THREE.MeshBasicMaterial; setLit: (lit: boolean, frame: number) => void }`
    - `export function addIncenseBurner3D(parent: THREE.Object3D, pos: V3, scale?: number): { group: THREE.Group; tipMat: THREE.MeshBasicMaterial }`
    - `export function addFluorescentTube3D(parent: THREE.Object3D, pos: V3, length?: number, yaw?: number): { group: THREE.Group; tubeMat: THREE.MeshBasicMaterial; setIntensity: (k: number) => void }`
    - `export function addStreetLamp3D(parent: THREE.Object3D, pos: V3, height?: number, armYaw?: number): { group: THREE.Group; bulbMat: THREE.MeshBasicMaterial; bulbWorldPos: V3 }`
    - `export function addSimpleTable(b: Batch, topMat: THREE.Material, legMat: THREE.Material, center: V3, w: number, d: number, h: number): void`
    - `export function addWoodenBedFrame(b: Batch, frameMat: THREE.Material, mattressMat: THREE.Material, center: V3, w: number, d: number, h?: number): void`
  - Optional exterior helpers preserved: `addGnarledTree`, `addReedCluster`, `addDistantRidge`, `addSampanHull`, `addVolumetricShaft`.

- [ ] **Step 1: Write failing unit tests in `tests/engine_world_kits.test.ts`**

Test:
1. All 16 new painterly texture exports exist in `paint.ts` and are callable functions.
2. `addWallWithOpening` produces non-empty geometry segments leaving the opening bounding area clear (no vertices inside `(u0 + 0.05..u1 - 0.05, y0 + 0.05..y1 - 0.05)`).
3. `addDoubleDoorWithCracks` toggles `moonStrip.visible` and `feetBlockers.visible` cleanly via `setMoonlight(true, true)` / `setMoonlight(false, false)` and rotates `leftPivot`/`rightPivot` via `setOpen(0.8)`.
4. `addAFrameRoof`, `addCorridorBay`, `addStairFlight`, `addGlassOilLamp3D`, `addIncenseBurner3D`, `addFluorescentTube3D`, and `addStreetLamp3D` each build valid non-empty Three.js geometry without throwing.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_world_kits.test.ts`
Expected: FAIL (new texture and architectural builders not yet exported).

- [ ] **Step 3: Implement expanded `templates/engine/paint.ts` and modular `templates/engine/build.ts`**

- Implement all 16 clean painterly procedural textures in `paint.ts` (including layered brown-plum thatch strips `thatchRoofTex`, soft damp mottled plaster `mottledPlasterTex` matching `videomau`, fine-ribbed red-trimmed `reedMatTex`, clean hospital ceramic tiles `hospitalTileTex`, colonial `vintagePatternTileTex`, wet asphalt, peeling corridor concrete, subtle garment seams).
- Upgrade `build.ts` to use `stylizedShade`, add all modular architectural/prop builders listed above (ensuring `addGlassOilLamp3D` has a rounded reservoir + translucent glass chimney on `NOINK` + glowing flame core; `addDoubleDoorWithCracks` includes the vertical center crack, bottom moonlight strip trapezoid on floor, and 2 movable dark foot-shadow blockers!).

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_world_kits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/engine/paint.ts templates/engine/build.ts tests/engine_world_kits.test.ts
git commit -m "feat(engine-v3): add 16 painterly textures and modular anti-repetition architectural kits"
```

---

### Task 6: Opt-In Modular POV Narrative HUD & Unified `ShortPlayer` v3

**Files:**
- Create: `templates/engine/HorrorHUD.tsx`
- Modify: `templates/engine/ShortPlayer.tsx`, `templates/engine/index.ts`
- Test: `tests/engine_hud_player.test.ts`

**Interfaces:**
- Consumes: `camera.ts`, `lights.ts`, `manifest.ts`, `shade.ts`, `ink.ts`, `motionblur.ts`, `lensblur.ts`, `grade.ts`.
- Produces in `HorrorHUD.tsx`:
  - Re-exports `HudCaption`, `HudNotification`, `HudTimeSkip`, `HudChoiceCard`, `HorrorHudConfig` from `./manifest`
  - `export const HorrorHUD: React.FC<{ config: HorrorHudConfig; frame: number; width: number; height: number }>`
  - `export const evalActiveHud = (config: HorrorHudConfig, frame: number)` (pure evaluator for testing active caption/notification/timeSkip/choice at any frame)
- Produces in `ShortPlayer.tsx`:
  - `export interface ShortWorld` with optional `getMotionVelocity?(shotId: number, frame: number, aspect: number, heightPx: number): CamVelocity` and `getLightBlend?(shotId: number, frame: number): { to: LightKey; t: number } | null`
  - `ShortPlayerProps` adds `hud?: HorrorHudConfig` and `grainAmount?: number` (default `0.008`)
  - Composer order: `RenderPass (MSAA 4)` → `InkPass` → `LensBlur` → `WhipMotionBlurEffect` → `[BloomEffect (thr 0.92, int 0.68, rad 0.72, levels 6), ToneMapping (NEUTRAL)]` → `[GradeEffect, GrainEffect]` → `<HorrorHUD />` above `<ThreeCanvas>`.
- Produces in `index.ts`: Clean barrel exporting all 17 v3 modules (no v2 billboard exports).

- [ ] **Step 1: Write failing unit tests in `tests/engine_hud_player.test.ts`**

Test:
1. `evalActiveHud(config, frame)` returns exact active caption, notification, interpolated digital clock on `timeSkips` (e.g., `00:44 → 00:57`), and `choiceCard` at matching frame windows, and `null` outside them.
2. `hudFromManifest(manifest)` (from `manifest.ts`) produces a valid `HorrorHudConfig` accepted by `evalActiveHud`.
3. `templates/engine/index.ts` exports v3 symbols (`createCharacter3D`, `createPovRig3D`, `attachOutline`, `WhipMotionBlurEffect`, `stylizedShade`, `beatAt`, `HorrorHUD`, `ShortPlayer`) and does NOT reference removed v2 files (`toon`, `cast`, `cardshade`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/engine_hud_player.test.ts`
Expected: FAIL (`HorrorHUD.tsx` missing, `index.ts` still exports removed v2 files).

- [ ] **Step 3: Implement `HorrorHUD.tsx`, upgrade `ShortPlayer.tsx`, and update `index.ts`**

- `HorrorHUD.tsx`: Clean typography scaled proportionally to `min(width, height) / 1080`: top-left timestamp/subtitle, top-right rounded `PHIM NGẮN HƯ CẤU` badge, bottom-center colored speaker pill + bold crisp white text with thick black outline + yellow keyword highlights, upper-third white rounded phone notification card with red timestamp/footer, dark centered ticking clock time-skip card, and interactive ending 2-button choice card.
- `ShortPlayer.tsx`: Wire `WhipMotionBlurEffect` (fed from `world.getMotionVelocity`), enhanced HDR `BloomEffect` (`luminanceThreshold: 0.92`, `intensity: 0.68`, `radius: 0.72`, `levels: 6`), `lightBlend` grading interpolation, default `grainAmount = 0.008`, and optional `<HorrorHUD />` overlay layer.
- `index.ts`: Clean v3 barrel exports.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/engine_hud_player.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add templates/engine/HorrorHUD.tsx templates/engine/ShortPlayer.tsx templates/engine/index.ts tests/engine_hud_player.test.ts
git commit -m "feat(engine-v3): add HorrorHUD overlay and upgrade ShortPlayer v3 composer pipeline"
```

---

### Task 7: Script-to-Frame Consistency Validator, Anti-Repetition Registry & POV-Aware QA Scripts

**Files:**
- Create: `templates/scripts/validate_manifest.py`
- Modify: `templates/scripts/extract_shots.py`, `templates/scripts/short_qa.py`, `templates/scripts/render-stills.mjs`, `templates/scripts/horror_story.py`, `companion-skills/horror-story/scripts/horror_story.py`, `templates/scripts/validate_continuity.py`
- Test: `tests/test_scripts_v3.py`

**Interfaces:**
- Consumes: `SceneManifest` JSON schema (`manifest.json`), `SCRIPT.md`, `words.json`, `LOCATION_REGISTRY.json`.
- Produces:
  - `python3 scripts/validate_manifest.py <manifest.json> [--script SCRIPT.md] [--words words.json] [--registry LOCATION_REGISTRY.json] [--update-registry] [--still-out still_manifest.json]`
    - Checks: timeline contiguity `0..totalFrames`; `LocationBlueprint` completeness (`>= 3` heroProps, valid `ceilingType`, `materials`); `lightState.preset` in v3 `VALID_LIGHTS`; `spokenLine.text` presence in `SCRIPT.md` + `words.json` alignment (`±0.35s`); `Phone3D` detail (`clock`, `notifSender`) ↔ HUD notification consistency; **Cross-Video & Cross-Part Anti-Repetition Check** (`ANTI_REPEAT_ERROR` when unrelated locations without `sameLocationOf` share `(archetype, ceilingType, materials)` OR overlap `>= 60%` across `(archetype, materials, heroProps)`).
    - Emits `still_manifest.json` (`[{ beatId, peakFrame, locationId, cameraIntent, spokenLine, lightState, castStates, propStates }]`).
  - `extract_shots.py`: parses `whipPan` / `WHIP_PANS` windows into `planned` (so `short_qa.py` reports 0 false pops on Whip-Pans).
  - `short_qa.py`: allows consecutive POV scales (`POV`, `POV_TURN`, `POV_DOWN`, `POV_PROP`, `POV_CU`) across Whip-Pan / pitch changes while still flagging static-angle filter jump-cuts (`corr > 0.88` on hard cuts); dark readability floor `p98 >= 0.34`, `mean >= 0.065`.
  - `render-stills.mjs`: supports `node scripts/render-stills.mjs <CompId> <outPrefix> --manifest <still_manifest.json> [scale]`.
  - `horror_story.py` (both copies) & `validate_continuity.py`: `VALID_LIGHTS = {"warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"}` with default `"warmLamp"` / `"coldMoon"`.

- [ ] **Step 1: Write failing Python unit tests in `tests/test_scripts_v3.py`**

Test:
1. `validate_manifest.py` PASSES on a valid 3-location manifest and writes `still_manifest.json` covering 100% of beats + registers entries into `LOCATION_REGISTRY.json` when `--update-registry` is set.
2. **Review Focus #3 (Anti-Repetition):** `validate_manifest.py` FAILS with `ANTI_REPEAT_ERROR` when a second unrelated project (or an unrelated location within the same project) shares `(archetype, ceilingType, wall/floor materials)` or `>= 60%` overlap without `sameLocationOf`; PASSES when `sameLocationOf` explicitly links to the same narrative location.
3. **Review Focus #4 (Script↔Frame Sync):** `validate_manifest.py` FAILS on timeline gaps, on `spokenLine.text` missing from `SCRIPT.md`, on `words.json` drift `> 0.35s`, on v2 `blood` light key, and on `Phone3D` clock contradicting its beat notification time.
4. **Review Focus #5 (Whip-Pan Pops):** `extract_shots.py` parses `whipPan` ranges from a mock `story.ts` into `shots.json["planned"]` so `short_qa.py` does not flag planned Whip-Pan frames as unplanned `pops`.
5. `horror_story.py` and `validate_continuity.py` accept all 5 v3 `VALID_LIGHTS` and reject `"blood"`.

- [ ] **Step 2: Run tests to verify failure**

Run: `python3 -m unittest tests/test_scripts_v3.py -v`
Expected: FAIL (`validate_manifest.py` missing, v2 `VALID_LIGHTS`, no `whipPan` extraction).

- [ ] **Step 3: Implement `validate_manifest.py` and update `extract_shots.py`, `short_qa.py`, `render-stills.mjs`, `horror_story.py` (both copies), and `validate_continuity.py`**

Implement all checks and CLI flags cleanly with pure Python stdlib (`json`, `os`, `re`, `argparse`, `difflib`). Sync both `templates/scripts/horror_story.py` and `companion-skills/horror-story/scripts/horror_story.py` identically.

- [ ] **Step 4: Run tests to verify pass**

Run: `python3 -m unittest tests/test_scripts_v3.py -v`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add templates/scripts/validate_manifest.py templates/scripts/extract_shots.py templates/scripts/short_qa.py templates/scripts/render-stills.mjs templates/scripts/horror_story.py companion-skills/horror-story/scripts/horror_story.py templates/scripts/validate_continuity.py tests/test_scripts_v3.py
git commit -m "feat(scripts-v3): add manifest/anti-repetition validator, whipPan QA support, and v3 light sync"
```

---

### Task 8: `HorrorLabV3` Multi-Archetype Visual Proof & Live Rendered Still + Whip-Pan Verification

**Files:**
- Create: `templates/horror-lab-v3/story.ts`, `templates/horror-lab-v3/build.ts`, `templates/horror-lab-v3/world.ts`, `templates/horror-lab-v3/index.tsx`, `templates/horror-lab-v3/manifest.json`
- Modify: `templates/project/Root.tsx`

**Interfaces:**
- Consumes: Full `templates/engine/` v3 barrel (`ShortPlayer`, `createCharacter3D`, `createPovRig3D`, `createPhone3D`, `createFlashlight3D`, `addAFrameRoof`, `addDoubleDoorWithCracks`, `addCorridorBay`, `addGlassOilLamp3D`, `addIncenseBurner3D`, `addFluorescentTube3D`, `addStreetLamp3D`, `addRisingSmokeWisps`, `addDustMotes`, `SceneManifest`, `hudFromManifest`, `whipPan`, `evalCamVelocity`).
- Produces:
  - `HorrorLabV3Vertical` (`1080×1920`, 30fps, `300` frames / 10s) and `HorrorLabV3Wide` (`1920×1080`, 30fps, `300` frames) in `templates/project/Root.tsx` showcasing **3 radically different horror archetypes**:
    - **Location 1 (`ruralFuneralRoom`, f `0..159`):** Exposed A-frame thatch roof, mottled damp plaster walls, reed mat, painted coffin + ancestral portrait altar + incense smoke, glass oil lamp with HDR bloom.
      - Beat 1 (`f 0..49`, `warmLamp`, `POV`): Non-chibi 3D dark-horror NPC sitting across from POV protagonist (`calm`/`uneasy`, speaker pill + subtitle).
      - Beat 2 (`f 50..94`, `warmLamp`, `POV_TURN` → `POV_PROP`): 7-frame **Whip-Pan with GPU Motion Blur** (`f 52..59`) turning toward POV hands raising glowing `Phone3D` (`01:06`) + synced upper-third notification card.
      - Beat 3 (`f 95..159`, `warmLamp → coldMoon`, `POV_DOWN` → `POV_CU`): Oil lamp dies out (`lampsOn: []`), room shifts smoothly into cold moonlight revealing bolted double door with moonlight floor strip blocked by **2 dark foot-shadows**, then tilts up to tall crooked-neck uncanny entity looming at the door with faint pinpoint eye glow.
    - **Location 2 (`hospitalCorridor`, f `160..229`, `fluorescent` + `flashlight`):** Grimy ceramic hospital tile walls, modular corridor bays, flickering overhead fluorescent tube, POV right hand aiming `Flashlight3D` real SpotLight beam + dust motes down the hallway onto a gaunt long-armed entity standing motionless in the distance.
    - **Location 3 (`foggyVillageAlley`, f `230..299`, `duskFog`):** Wet asphalt road, weathered brick/concrete village walls, warm sodium `addStreetLamp3D` pool cutting through night mist, non-chibi 3D dark-horror figure turning in mid-shot.

- [ ] **Step 1: Author `templates/horror-lab-v3/{story.ts,build.ts,world.ts,index.tsx,manifest.json}` and update `templates/project/Root.tsx`**

Ensure `world.ts` reads `beatAt(MANIFEST, frame)` directly for `locationId`, `lightState` (`lampsOn`, `doorMoonlight`, `feetShadow`), `castStates`, and `propStates` (`Phone3D` clock/notification synced to `hudFromManifest(MANIFEST)`). Register `HorrorLabV3Vertical` and `HorrorLabV3Wide` in `templates/project/Root.tsx`.

- [ ] **Step 2: Validate manifest & assemble gitignored `shorts-project/` test workspace**

```bash
python3 templates/scripts/validate_manifest.py templates/horror-lab-v3/manifest.json --still-out /tmp/horror_v3_still_manifest.json
```
Expected: `PASS` with 0 errors and `still_manifest.json` generated for all beats.
Copy `templates/{project,engine,horror-lab-v3,scripts}` into `shorts-project/`, run `cd shorts-project && npm install && npm run typecheck`.
Expected: `tsc --noEmit` exits 0 with zero errors.

- [ ] **Step 3: Render 100% of beat stills (`--manifest`) + Whip-Pan burst stills at scale 1 and visually inspect EVERY image with `read_file`**

```bash
cd shorts-project
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs HorrorLabV3Vertical out/horror-lab-v3/stills/b_ --manifest /tmp/horror_v3_still_manifest.json 1
REMOTION_TMP=/tmp/remotion-tmp node scripts/render-stills.mjs HorrorLabV3Vertical out/horror-lab-v3/stills/whip_ 53,55,57 1
```
Inspect EVERY rendered `.jpg` directly using `read_file` against the **Beat-by-Beat Script↔Frame Audit** & Look-Dev targets:
- Characters look non-chibi dark-horror (NOT cute round balls, NOT v2 scratchy cards)?
- Clean bold Inverted-Hull outlines (`~5–7 px`), zero double-outline artifacts, zero split corners?
- Soft shading + real PointLight/SpotLight warmth + crisp HDR Bloom on oil lamp & `Phone3D` fingers?
- Frame `55` shows genuine horizontal directional Whip-Pan Motion Blur while frames `25` and `78` are razor-sharp?
- All 3 locations look unmistakably distinct (zero box-room repetition)?
- Lights-out transition shows dark room + door-crack moonlight + 2 foot-shadows + eerie entity?
Fix and re-render any visual flaw directly in `templates/engine/` or `templates/horror-lab-v3/` until every still passes cleanly!

- [ ] **Step 4: Render 10-second `HorrorLabV3Vertical` MP4 and run `extract_shots.py` + `short_qa.py`**

```bash
cd shorts-project
REMOTION_TMP=/tmp/remotion-tmp npx remotion render src/index.ts HorrorLabV3Vertical out/horror-lab-v3/video.mp4 --codec h264 --crf 18 --scale 1 --concurrency 2 --timeout 180000
python3 scripts/extract_shots.py src/horror-lab-v3/story.ts out/horror-lab-v3/shots.json
python3 scripts/short_qa.py out/horror-lab-v3/video.mp4 out/horror-lab-v3/qa out/horror-lab-v3/shots.json
```
Expected: `0` unplanned black/white frames, `0` frozen spans `>= 12f`, `0` unplanned `pops` (including across the Whip-Pan!), `DIRECTING_WARNS none`, zero dark readability warnings. Copy key verified stills to `references/stills/v3_*.jpg` and clean `/tmp/remotion-tmp`.

- [ ] **Step 5: Commit**

```bash
git add templates/horror-lab-v3 templates/project/Root.tsx references/stills/v3_*.jpg
git commit -m "feat(horror-lab-v3): add 3-archetype visual proof and verified v3 benchmark stills"
```

---

### Task 9: Overhaul Phase-1 Graphics Skills, Style Bible, QA Docs & README

**Files:**
- Modify: `SKILL.md`, `companion-skills/horror-world-lookdev/SKILL.md`, `references/HORROR_STYLE_BIBLE.md`, `references/LIGHTING_AND_PALETTE.md`, `references/READABILITY_AND_QA.md`, `templates/project/GEMINI.md`, `README.md`

**Interfaces:**
- Documents the exact v3 APIs, file names, `SceneManifest` 3-layer Script↔Frame Lock, `LocationBlueprint` + `LOCATION_REGISTRY.json` Anti-Repetition Gate, `HorrorLabV3` benchmark stills, and verified QA commands from Tasks 1–8.

- [ ] **Step 1: Update `references/HORROR_STYLE_BIBLE.md`, `references/LIGHTING_AND_PALETTE.md`, and `references/READABILITY_AND_QA.md`**

- `HORROR_STYLE_BIBLE.md`: Replace v2 "Gothic Ink-Noir 2D billboard" identity with **v3 "3D Stylized Dark-Horror POV"** (non-chibi `5.6`-head 3D rig, clean bold Inverted-Hull + architectural `InkPass`, soft shading + HDR Bloom, Whip-Pan directional motion blur, story-driven lighting shifts, zero `Pen.grit`/`cross-hatching`/`gradeGrime`/`blood` washes).
- `LIGHTING_AND_PALETTE.md`: Document the 5 physical v3 presets (`warmLamp`, `coldMoon`, `fluorescent`, `duskFog`, `flashlight`), 6 PointLights + 1 SpotLight recipes, HDR emissives, and `lerpLights` light-loss transitions.
- `READABILITY_AND_QA.md`: Document the **Beat-by-Beat Script↔Frame Fidelity Audit** (`validate_manifest.py` + `render-stills.mjs --manifest` + mandatory per-beat table) and **Anti-Repetition Rejection Gate** (`ANTI_REPEAT_ERROR` + `LOCATION_REGISTRY.json`).

- [ ] **Step 2: Update `SKILL.md`, `companion-skills/horror-world-lookdev/SKILL.md`, `templates/project/GEMINI.md`, and `README.md`**

- Retire the v2 "6 forced props" rule completely.
- Add mandatory `LocationBlueprint` + `SceneManifest` single-source-of-truth workflow and Cross-Video / Cross-Part Anti-Repetition prohibition (`sameLocationOf` required for any narrative revisit; zero reuse across unrelated videos/parts).
- Update setup commands in `README.md` and `GEMINI.md` to match the v3 `templates/engine/` + `templates/horror-lab-v3/` structure.

- [ ] **Step 3: Run full verification suite across all JS + Python tests and `tsc --noEmit`**

```bash
node --test tests/*.test.ts
python3 -m unittest discover -s tests -v
cd shorts-project && npm run typecheck
```
Expected: 100% tests pass, zero TypeScript errors, clean `git status` (no untracked temp files or `shorts-project/` tracked).

- [ ] **Step 4: Commit**

```bash
git add SKILL.md companion-skills/horror-world-lookdev/SKILL.md references/HORROR_STYLE_BIBLE.md references/LIGHTING_AND_PALETTE.md references/READABILITY_AND_QA.md templates/project/GEMINI.md README.md
git commit -m "docs(skills-v3): overhaul Phase-1 graphics skills, style bible, and anti-repetition QA docs"
```
