import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  ACTING_GESTURE_LIST,
  createCharacter25D,
  createCharacter25DFromBlueprint,
  createPlaceholderSpritePair,
  evalActingCues,
} from "../templates/engine/sprite2d.ts";
import {
  resolveLowVramConfig,
  evalActiveJumpscare,
} from "../templates/engine/ShortPlayer.tsx";
import {
  applyManifestActors,
  evalActionTriggerProgress,
  evalSpeechFromAudioRms,
  isCharacter25D,
} from "../templates/engine/stage.ts";
import {
  resolveCharacterMode,
  jumpscareClipsFromManifest,
  type SceneManifest,
  type ScriptBeat,
  type CastBeatState,
} from "../templates/engine/manifest.ts";

test("sprite2d creates 2.5D Y-axis billboard with Albedo + Normal Map, ground shadow, sockets & motion", () => {
  const actor = createCharacter25DFromBlueprint({
    id: "C02",
    role: "entity",
    scareTier: 6,
    scareTraits: ["elongated_neck", "pinpoint_eyes"],
    storyDescription: "Bóng ma gầy cao bám góc gương thang máy",
  });

  assert.equal(isCharacter25D(actor), true);
  assert.ok(actor.material.map, "Albedo texture must be assigned");
  assert.ok(actor.material.normalMap, "Tangent-space normal map must be assigned for 3D light shading");
  assert.ok(actor.contactShadow, "Grounded contact shadow must exist");
  assert.ok(actor.sockets.head && actor.sockets.eyes && actor.sockets.feet);

  // Y-axis billboard rotates internal billboardPivot toward camera X/Z cleanly
  actor.group.position.set(0, 0, -2);
  actor.updateBillboard([2, 1.5, 0]);
  const expectedYaw = Math.atan2(2 - 0, 0 - -2);
  const billboardPivot = actor.plane.parent!.parent!;
  assert.ok(Math.abs(billboardPivot.rotation.y - expectedYaw) < 1e-4);

  // Motion & expression switching
  actor.setPose("lungeCloseUp", 12, { isTalking: false, headTwitch: 0.85, steppedFps: 10 });
  assert.equal(actor.currentExpr, "entity_scare");
  const motionGroup = actor.plane.parent!;
  assert.notEqual(motionGroup.rotation.z, 0);

  // Placeholder generator creates valid DataTextures
  const pair = createPlaceholderSpritePair("C01", "human", 5);
  assert.ok(pair.albedo instanceof THREE.DataTexture);
  assert.ok(pair.normal instanceof THREE.DataTexture);
});

test("ShortPlayer resolveLowVramConfig disables heavy passes for GTX 960 and evalActiveJumpscare resolves clips", () => {
  const psxDefault = resolveLowVramConfig("psxHorror", {});
  assert.equal(psxDefault.lowVram, true);
  assert.equal(psxDefault.toggles.ssao, false);
  assert.equal(psxDefault.toggles.lens, false);
  assert.equal(psxDefault.toggles.pre, false);
  assert.ok(psxDefault.dpr <= 0.5);
  assert.ok(psxDefault.bloomLevels <= 3);

  const psxDraft = resolveLowVramConfig("psxHorror", { draft: true });
  assert.ok(psxDraft.dpr <= 0.36);

  const semiFull = resolveLowVramConfig("semiReal", { lowVram: false, ssao: true });
  assert.equal(semiFull.lowVram, false);
  assert.equal(semiFull.toggles.ssao, true);
  assert.equal(semiFull.toggles.lens, true);

  const clips = [
    {
      id: "js1",
      src: "assets/jumpscare_js1.mp4",
      a: 150,
      b: 225,
      anchorFrame: 149,
      transitionStyle: "first_frame_seamless" as const,
    },
  ];
  assert.equal(evalActiveJumpscare(clips, 149), null);
  const hit = evalActiveJumpscare(clips, 150);
  assert.ok(hit);
  assert.equal(hit.clip.id, "js1");
  assert.equal(hit.localFrame, 0);
  assert.equal(evalActiveJumpscare(clips, 225), null);
});

test("stage.ts actionTriggerFrame snaps crisply (no slow smear) and RMS envelope drives Character25D talk state", () => {
  const beat: ScriptBeat = {
    beatId: "B1",
    shotId: 1,
    a: 0,
    b: 100,
    peakFrame: 50,
    locationId: "S01",
    spokenLine: { text: "Đừng quay lại!" },
    lightState: { preset: "fluorescent", lampsOn: [] },
    castStates: {},
    propStates: {},
    cameraIntent: "Snap test",
  };
  const cst: CastBeatState = {
    visible: true,
    pose: "standIdle",
    poseTo: "recoil",
    actionTriggerFrame: 50,
    actionSnapFrames: 4,
    triggerExpr: "shock",
  };

  // Hold at 0 before trigger, snap rapidly in 4 frames, hold at 1 after
  assert.deepEqual(evalActionTriggerProgress(beat, cst, 10), { t: 0, triggered: false });
  assert.deepEqual(evalActionTriggerProgress(beat, cst, 49), { t: 0, triggered: false });
  const mid = evalActionTriggerProgress(beat, cst, 52);
  assert.equal(mid.triggered, true);
  assert.ok(mid.t > 0.4 && mid.t < 1.0);
  assert.deepEqual(evalActionTriggerProgress(beat, cst, 54), { t: 1, triggered: true });
  assert.deepEqual(evalActionTriggerProgress(beat, cst, 99), { t: 1, triggered: true });

  // RMS speech evaluator honors silence vs voiced energy + speaker ownership
  const rms = [0.01, 0.02, 0.65, 0.80, 0.02];
  const matched = [{ word: "Nhìn", start: 0.06, end: 0.14 }];
  const quiet = evalSpeechFromAudioRms(rms, matched, 0, 30, 0.08);
  assert.equal(quiet.isTalking, false);
  const active = evalSpeechFromAudioRms(rms, matched, 3, 30, 0.08);
  assert.equal(active.isTalking, true);
  assert.ok(active.rms >= 0.75);
  const outsideWord = evalSpeechFromAudioRms([0.8, 0.8, 0.8, 0.8, 0.8], matched, 0, 30, 0.08);
  assert.equal(outsideWord.isTalking, true); // within 0.06s padding of 0.06s start
  const farOutside = evalSpeechFromAudioRms(Array(30).fill(0.8), matched, 20, 30, 0.08);
  assert.equal(farOutside.isTalking, false);

  // End-to-end applyManifestActors drives Character25D with actionTriggerFrame + RMS
  const human25 = createCharacter25D({ id: "C01", role: "human", height: 1.7 });
  const manifest: SceneManifest = {
    projectId: "stage-25d-test",
    title: "Stage 2.5D Test",
    totalFrames: 120,
    locations: [{ id: "S01", archetype: "testHall", dimensions: [4, 4, 3], ceilingType: "flatConcrete", materials: { wall: "w", floor: "f", ceiling: "c" }, practicalLights: [], heroProps: [], signatureShadowBeat: "s", anchors: { SPOT: [0, 0, -2] } }],
    castBlueprints: [{ id: "C01", role: "human", storyDescription: "Guard" }],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 120,
        peakFrame: 60,
        locationId: "S01",
        spokenLine: { text: "Đừng quay lại!" },
        lightState: { preset: "fluorescent", lampsOn: [] },
        castStates: {
          C01: {
            visible: true,
            anchor: "SPOT",
            pose: "standIdle",
            poseTo: "recoil",
            actionTriggerFrame: 40,
            actionSnapFrames: 4,
            triggerExpr: "shock",
            speakingAs: "NPC_1",
            dialogueMode: "directSpeech",
          },
        },
        propStates: {},
        cameraIntent: "Test snap",
      },
    ],
    jumpscareClips: [
      { id: "js1", src: "assets/jumpscare_js1.mp4", a: 90, b: 120, anchorFrame: 89, transitionStyle: "silence_hard_cut" },
    ],
  };

  assert.equal(resolveCharacterMode(manifest), "sprite2d");
  assert.equal(jumpscareClipsFromManifest(manifest).length, 1);

  const rmsLong = Array.from({ length: 120 }, (_, i) => (i >= 10 && i <= 25 ? 0.75 : 0.01));
  const wordsLong = [{ w: "Đừng", s: 0.3, e: 0.9, speaker: "NPC_1" }];

  // Before actionTriggerFrame during speech -> talk expression
  applyManifestActors(manifest, 15, { C01: human25 }, undefined, { words: wordsLong, rmsEnvelope: rmsLong, cameraPos: [0, 1.5, 2] });
  assert.equal(human25.currentExpr, "talk");

  // After actionTriggerFrame -> crisp shock expression!
  applyManifestActors(manifest, 45, { C01: human25 }, undefined, { words: wordsLong, rmsEnvelope: rmsLong, cameraPos: [0, 1.5, 2] });
  assert.equal(human25.currentExpr, "shock");
});

test("sprite2d 24x36 puppet mesh locks feet at v=0, lifts shoulders on shrug, isolates uncannyNeck, and crossfades expressions smoothly", () => {
  const calmPair = createPlaceholderSpritePair("C01_calm", "human", 1);
  const fearPair = createPlaceholderSpritePair("C01_fear", "human", 1);
  const shockPair = createPlaceholderSpritePair("C01_shock", "human", 1);

  const actor = createCharacter25D(
    {
      id: "C01",
      role: "human",
      height: 1.72,
      rigMeta: { neckV: 0.80, shoulderV: 0.72, waistV: 0.48, mouthV: 0.845, shoulderSpan: 0.46, headCenterX: 0.0 },
    },
    { calm: calmPair.albedo, fear: fearPair.albedo, shock: shockPair.albedo },
    { calm: calmPair.normal, fear: fearPair.normal, shock: shockPair.normal },
  );

  const posAttr = actor.plane.geometry.attributes.position as THREE.BufferAttribute;
  assert.ok(posAttr.count >= 900, `Expected 24x36 subdivided puppet mesh (>=900 verts), got ${posAttr.count}`);
  const restPos = new Float32Array(posAttr.array as Float32Array);

  // 1. Apply full shoulder shrug -> feet stay 100% locked while shoulders lift clearly!
  actor.applyPuppet({ shoulderShrug: 1.0, chestBreath: 0.8, headRoll: 0.0 });
  let maxFootDelta = 0;
  let maxShoulderLift = 0;
  let maxChestZ = 0;
  for (let i = 0; i < posAttr.count; i++) {
    const ry = restPos[i * 3 + 1];
    const rx = restPos[i * 3];
    const dy = posAttr.getY(i) - ry;
    const dz = posAttr.getZ(i) - restPos[i * 3 + 2];
    const v = ry / 1.72;
    if (v <= 0.04) {
      maxFootDelta = Math.max(maxFootDelta, Math.abs(dy), Math.abs(posAttr.getX(i) - rx), Math.abs(dz));
    }
    if (v >= 0.68 && v <= 0.76 && Math.abs(rx) > 0.14) {
      maxShoulderLift = Math.max(maxShoulderLift, dy);
    }
    if (v >= 0.56 && v <= 0.66 && Math.abs(rx) < 0.12) {
      maxChestZ = Math.max(maxChestZ, dz);
    }
  }
  assert.ok(maxFootDelta < 1e-6, `Feet must remain pinned at floor, got delta=${maxFootDelta}`);
  assert.ok(maxShoulderLift > 0.02, `Shoulders must visibly rise during shrug (>2cm), got ${maxShoulderLift}`);
  assert.ok(maxChestZ > 0.012, `Chest must bulge subtly along +Z during breathing, got ${maxChestZ}`);

  // 2. Uncanny entity neck twist rotates ONLY head vertices while shoulders stay corpse-still!
  actor.applyPuppet({ headRoll: 0.22, shoulderShrug: 0, chestBreath: 0, torsoSway: 0 });
  let maxShoulderMove = 0;
  let maxHeadShiftX = 0;
  for (let i = 0; i < posAttr.count; i++) {
    const ry = restPos[i * 3 + 1];
    const v = ry / 1.72;
    const dx = Math.abs(posAttr.getX(i) - restPos[i * 3]);
    const dy = Math.abs(posAttr.getY(i) - ry);
    if (v >= 0.63 && v <= 0.71) maxShoulderMove = Math.max(maxShoulderMove, dx, dy);
    if (v >= 0.90) maxHeadShiftX = Math.max(maxHeadShiftX, dx);
  }
  assert.ok(maxShoulderMove < 0.002, `Shoulders must stay corpse-still on isolated headRoll, got ${maxShoulderMove}`);
  assert.ok(maxHeadShiftX > 0.022, `Head top must rotate decisively around neck pivot, got ${maxHeadShiftX}`);

  // 3. Smooth dual-texture crossfade updates uMapB, uNormalMapB, uExprMix deterministically on 1 draw call!
  actor.setExprBlend("calm", "shock", 0.5);
  assert.equal(actor.material.map, calmPair.albedo);
  assert.equal(actor.blendUniforms.uMapB.value, shockPair.albedo);
  assert.equal(actor.blendUniforms.uNormalMapB.value, shockPair.normal);
  assert.ok(Math.abs(actor.blendUniforms.uExprMix.value - 0.5) < 1e-5);
  assert.equal(actor.blendUniforms.uHasNormalB.value, 1);

  // 4. stage.ts ramps exprBlend smoothly across `actionTriggerFrame .. actionTriggerFrame + exprBlendFrames`
  const mf: SceneManifest = {
    projectId: "crossfade-stage-test",
    title: "Crossfade Stage",
    totalFrames: 90,
    locations: [{ id: "S01", archetype: "testElev", dimensions: [3, 3, 3], ceilingType: "flatConcrete", materials: { wall: "w", floor: "f", ceiling: "c" }, practicalLights: [], heroProps: [], signatureShadowBeat: "s", anchors: { SPOT: [0, 0, -1] } }],
    castBlueprints: [{ id: "C01", role: "human", storyDescription: "Worker" }],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 90,
        peakFrame: 45,
        locationId: "S01",
        lightState: { preset: "fluorescent", lampsOn: [] },
        castStates: {
          C01: {
            visible: true,
            anchor: "SPOT",
            pose: "standIdle",
            poseTo: "shrug",
            spriteExpr: "calm",
            triggerExpr: "fear",
            actionTriggerFrame: 30,
            exprBlendFrames: 8,
            shrugIntensity: 0.9,
            microMotion: "shrug",
          },
        },
        propStates: {},
        cameraIntent: "Shrug and fear crossfade",
      },
    ],
  };

  applyManifestActors(mf, 25, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.currentExpr, "calm");
  assert.equal(actor.blendUniforms.uExprMix.value, 0);

  applyManifestActors(mf, 34, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.blendUniforms.uMapB.value, fearPair.albedo);
  assert.ok(actor.blendUniforms.uExprMix.value > 0.35 && actor.blendUniforms.uExprMix.value < 0.65, `Expected smooth mid-crossfade, got ${actor.blendUniforms.uExprMix.value}`);
  assert.ok(actor.lastDeform.shoulderShrug > 0.25, "Expected active shoulder shrug deformation");

  applyManifestActors(mf, 42, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.currentExpr, "fear");
  assert.equal(actor.material.map, fearPair.albedo);
  assert.equal(actor.blendUniforms.uExprMix.value, 0);

  actor.dispose();
  calmPair.albedo.dispose();
  calmPair.normal.dispose();
  fearPair.albedo.dispose();
  fearPair.normal.dispose();
  shockPair.albedo.dispose();
  shockPair.normal.dispose();
});

test("v15.2 actingCues[] supports all 20 composable gestures, freeform customDeform, breathHold suppression, and multi-step exprTo crossfades", () => {
  assert.equal(ACTING_GESTURE_LIST.length, 21, "Must expose 20 atomic gestures + custom");

  const calmPair = createPlaceholderSpritePair("C01_c", "human", 1);
  const fearPair = createPlaceholderSpritePair("C01_f", "human", 1);
  const shockPair = createPlaceholderSpritePair("C01_s", "human", 1);
  const actor = createCharacter25D(
    { id: "C01", role: "human", height: 1.72 },
    { calm: calmPair.albedo, fear: fearPair.albedo, shock: shockPair.albedo },
    { calm: calmPair.normal, fear: fearPair.normal, shock: shockPair.normal },
  );
  const posAttr = actor.plane.geometry.attributes.position as THREE.BufferAttribute;
  const restPos = new Float32Array(posAttr.array as Float32Array);

  // 1. Verify every single one of the 20 gestures executes cleanly, keeps feet locked at v<=0.04, and produces distinct deformation!
  for (const g of ACTING_GESTURE_LIST) {
    const cue =
      g === "custom"
        ? { gesture: g, atFrame: 10, durationFrames: 24, customDeform: { shoulderShrug: 0.7, torsoLeanZ: 0.5, headRoll: -0.1 } }
        : { gesture: g, atFrame: 10, durationFrames: 28, side: "left" as const, intensity: 1.0 };
    actor.setPose("standIdle", 20, { actingCues: [cue], beatRange: [0, 90] });
    let maxFootDelta = 0;
    let maxUpperDelta = 0;
    for (let i = 0; i < posAttr.count; i++) {
      const ry = restPos[i * 3 + 1];
      const v = ry / 1.72;
      const d = Math.hypot(
        posAttr.getX(i) - restPos[i * 3],
        posAttr.getY(i) - ry,
        posAttr.getZ(i) - restPos[i * 3 + 2],
      );
      if (v <= 0.04) maxFootDelta = Math.max(maxFootDelta, d);
      if (v >= 0.50) maxUpperDelta = Math.max(maxUpperDelta, d);
    }
    assert.ok(maxFootDelta < 1e-6, `Gesture '${g}' must keep feet locked at floor, got ${maxFootDelta}`);
    assert.ok(maxUpperDelta > 0.001, `Gesture '${g}' must deform upper body visibly, got ${maxUpperDelta}`);
  }

  // 2. Verify anatomical directional accuracy: sighDrop drops shoulders negative, tiltListen tilts left/right, breathHold freezes breathing, leanIn pushes +Z
  const sigh = evalActingCues([{ gesture: "sighDrop", atFrame: 0, durationFrames: 40 }], 26, [0, 60]);
  assert.ok(sigh.delta.shoulderShrug < -0.25, `sighDrop must drop shoulders negatively, got ${sigh.delta.shoulderShrug}`);

  const listenL = evalActingCues([{ gesture: "tiltListen", atFrame: 0, durationFrames: 30, side: "left" }], 15, [0, 60]);
  const listenR = evalActingCues([{ gesture: "tiltListen", atFrame: 0, durationFrames: 30, side: "right" }], 15, [0, 60]);
  assert.ok(listenL.delta.headRoll > 0.08 && listenR.delta.headRoll < -0.08, "tiltListen must honor left/right side");

  const holdB = evalActingCues([{ gesture: "breathHold", atFrame: 0, durationFrames: 30 }], 12, [0, 60]);
  assert.ok(holdB.breathScale < 0.15, `breathHold must suppress ambient breathing, got ${holdB.breathScale}`);

  const lean = evalActingCues([{ gesture: "leanIn", atFrame: 0, durationFrames: 30 }], 15, [0, 60]);
  assert.ok(lean.delta.torsoLeanZ > 0.5, `leanIn must push torso forward +Z, got ${lean.delta.torsoLeanZ}`);

  const shiv = evalActingCues([{ gesture: "shiver", atFrame: 0, durationFrames: 24 }], 10, [0, 60]);
  assert.ok(shiv.delta.shiverAmp > 0.7, `shiver must raise shiverAmp, got ${shiv.delta.shiverAmp}`);

  // 3. Multi-step expression crossfade timeline inside ONE single beat (`calm` -> `fear` -> `shock`)!
  const mf: SceneManifest = {
    projectId: "multi-cue-test",
    title: "Multi Cue Test",
    totalFrames: 120,
    locations: [{ id: "S01", archetype: "testHall", dimensions: [3, 3, 3], ceilingType: "flatConcrete", materials: { wall: "w", floor: "f", ceiling: "c" }, practicalLights: [], heroProps: [], signatureShadowBeat: "s", anchors: { SPOT: [0, 0, -1] } }],
    castBlueprints: [{ id: "C01", role: "human", storyDescription: "Worker" }],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 120,
        peakFrame: 60,
        locationId: "S01",
        lightState: { preset: "fluorescent", lampsOn: [] },
        castStates: {
          C01: {
            visible: true,
            anchor: "SPOT",
            pose: "standIdle",
            spriteExpr: "calm",
            actingCues: [
              { gesture: "tiltListen", atFrame: 10, durationFrames: 24, side: "left" },
              { gesture: "shiver", atFrame: 35, durationFrames: 22, exprTo: "fear", exprBlendFrames: 8 },
              { gesture: "flinch", atFrame: 70, durationFrames: 24, exprTo: "shock", exprBlendFrames: 6 },
            ],
          },
        },
        propStates: {},
        cameraIntent: "3-stage acting cue choreography",
      },
    ],
  };

  // Before cue 2 -> calm
  applyManifestActors(mf, 20, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.currentExpr, "calm");
  assert.ok(actor.lastDeform.headRoll > 0.08, "tiltListen active at f20");

  // Mid cue 2 (`calm` -> `fear`)
  applyManifestActors(mf, 39, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.material.map, calmPair.albedo);
  assert.equal(actor.blendUniforms.uMapB.value, fearPair.albedo);
  assert.ok(actor.blendUniforms.uExprMix.value > 0.35 && actor.blendUniforms.uExprMix.value < 0.65);

  // Mid cue 3 (`fear` -> `shock`)
  applyManifestActors(mf, 73, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.material.map, fearPair.albedo);
  assert.equal(actor.blendUniforms.uMapB.value, shockPair.albedo);
  assert.ok(actor.blendUniforms.uExprMix.value > 0.35 && actor.blendUniforms.uExprMix.value < 0.65);

  // After cue 3 settled -> shock
  applyManifestActors(mf, 82, { C01: actor }, undefined, { cameraPos: [0, 1.5, 2] });
  assert.equal(actor.currentExpr, "shock");
  assert.equal(actor.material.map, shockPair.albedo);

  actor.dispose();
  calmPair.albedo.dispose();
  calmPair.normal.dispose();
  fearPair.albedo.dispose();
  fearPair.normal.dispose();
  shockPair.albedo.dispose();
  shockPair.normal.dispose();
});
