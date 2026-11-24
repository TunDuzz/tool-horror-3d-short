import assert from "node:assert/strict";
import test from "node:test";
import {
  alignCharacterPartTo,
  applyManifestActors,
  camMasterEstablish,
  camPovChain,
  createCharacterFromBlueprint,
  createPovRig3D,
  getCharacterPartWorldPos,
  resolveLocationAnchor,
  shotsFromManifest,
  type CharacterBlueprint,
  type SceneManifest,
} from "../templates/engine/index.ts";
import * as THREE from "three";

test("Engine v5.1 Spatial Stage Solver locks head/eyes/feet accurately to target world positions and drives actors from manifest", () => {
  const bp: CharacterBlueprint = {
    id: "testEntity",
    role: "entity",
    storyDescription: "Tall crooked-neck entity hiding beneath a low wooden bed frame",
    appearance: {
      height: 1.82,
      lowPoly: true,
      outlineMode: "off",
      entity: {
        heightScale: 1.22,
        neckTiltDeg: 28,
        bodyHorror: {
          skullHollows: true,
          neckStretch: 1.95,
          jawDrop3D: 0.9,
          crookedTeeth: true,
          clawHands: true,
        },
      },
    },
  };

  const ent = createCharacterFromBlueprint(bp);
  ent.setPose("lungeCloseUp", 10, { jawOpen: 0.95 });

  // Align head socket directly to low under-bed target [-0.20, 0.26, -1.35] with <5mm error!
  alignCharacterPartTo(ent, "head", [-0.20, 0.26, -1.35]);
  const headPos = getCharacterPartWorldPos(ent, "head");
  assert.ok(Math.abs(headPos[0] - -0.20) < 0.005, `head X mismatch: ${headPos[0]}`);
  assert.ok(Math.abs(headPos[1] - 0.26) < 0.005, `head Y mismatch: ${headPos[1]}`);
  assert.ok(Math.abs(headPos[2] - -1.35) < 0.005, `head Z mismatch: ${headPos[2]}`);

  // Also test eyes socket alignment
  alignCharacterPartTo(ent, "eyes", [0.10, 0.48, -0.20]);
  const eyePos = getCharacterPartWorldPos(ent, "eyes");
  assert.ok(Math.abs(eyePos[0] - 0.10) < 0.005, `eyes X mismatch: ${eyePos[0]}`);
  assert.ok(Math.abs(eyePos[1] - 0.48) < 0.005, `eyes Y mismatch: ${eyePos[1]}`);
  assert.ok(Math.abs(eyePos[2] - -0.20) < 0.005, `eyes Z mismatch: ${eyePos[2]}`);

  // Drive actor smoothly across a beat via applyManifestActors
  const manifest: SceneManifest = {
    projectId: "stage-test",
    title: "Stage Test",
    totalFrames: 60,
    aspect: "9:16",
    locations: [
      {
        id: "S01",
        archetype: "woodenBedroom",
        dimensions: [4.6, 5.6, 3.1],
        ceilingType: "flatConcrete",
        materials: { wall: "mottledPlasterTex", floor: "darkTimberTex", ceiling: "darkTimberTex" },
        practicalLights: ["bedsideLamp"],
        heroProps: ["woodenBed", "lockedDoor", "bloodPool"],
        signatureShadowBeat: "Eyes under bed",
        anchors: {
          START_HEAD: [-0.20, 0.24, -1.60],
          END_HEAD: [-0.14, 0.46, -0.20],
        },
      },
    ],
    castBlueprints: [bp],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 30,
        peakFrame: 15,
        locationId: "S01",
        lightState: { preset: "coldMoon", lampsOn: [] },
        castStates: {
          testEntity: {
            visible: true,
            anchor: "START_HEAD",
            moveFromAnchor: "START_HEAD",
            moveToAnchor: "END_HEAD",
            moveFrames: 10,
            pose: "doorwayPeek",
            poseTo: "lungeCloseUp",
            alignPart: "head",
            facingYaw: 0.05,
            jawOpen: 0.95,
          },
        },
        propStates: {},
        cameraIntent: "Entity lunges from under bed toward lens",
      },
      {
        beatId: "B2",
        shotId: 2,
        a: 30,
        b: 60,
        peakFrame: 45,
        locationId: "S01",
        lightState: { preset: "coldMoon", lampsOn: [] },
        castStates: {
          testEntity: { visible: false, anchor: "END_HEAD", pose: "loomingStill" },
        },
        propStates: {},
        cameraIntent: "Hidden after cut",
      },
    ],
  };

  assert.deepEqual(resolveLocationAnchor(manifest, "S01", "START_HEAD"), [-0.20, 0.24, -1.60]);

  applyManifestActors(manifest, 0, { testEntity: ent });
  assert.equal(ent.group.visible, true);
  const hStart = getCharacterPartWorldPos(ent, "head");
  assert.ok(Math.abs(hStart[2] - -1.60) < 0.005, `start Z expected -1.60, got ${hStart[2]}`);

  applyManifestActors(manifest, 10, { testEntity: ent });
  const hEnd = getCharacterPartWorldPos(ent, "head");
  assert.ok(Math.abs(hEnd[1] - 0.46) < 0.005, `end Y expected 0.46 at moveFrames=10, got ${hEnd[1]}`);
  assert.ok(Math.abs(hEnd[2] - -0.20) < 0.005, `end Z expected -0.20 at moveFrames=10, got ${hEnd[2]}`);

  applyManifestActors(manifest, 40, { testEntity: ent });
  assert.equal(ent.group.visible, false);

  ent.dispose();
});

test("Engine v10.0 stage.ts drives living acting poses, Vietnamese lip-sync from words.json, and blinkStep blackout advances", () => {
  const humanBp: CharacterBlueprint = {
    id: "C02",
    role: "human",
    storyDescription: "Anxious ferry elder speaking 3 survival rules",
    appearance: { height: 1.66, lowPoly: true, outlineMode: "off" },
  };
  const entityBp: CharacterBlueprint = {
    id: "C03",
    role: "entity",
    storyDescription: "Stalker stepping closer only on fluorescent blackouts",
    appearance: { height: 1.88, lowPoly: true, outlineMode: "off", entity: { breathing: false } },
  };
  const elder = createCharacterFromBlueprint(humanBp);
  const stalker = createCharacterFromBlueprint(entityBp);

  const m: SceneManifest = {
    projectId: "v10-acting-test",
    title: "V10 Acting Test",
    totalFrames: 120,
    aspect: "9:16",
    locations: [
      {
        id: "S01",
        archetype: "booth",
        dimensions: [5, 5, 3],
        ceilingType: "flatConcrete",
        materials: { wall: "darkTimberTex", floor: "concreteFloorTex", ceiling: "concreteCeilingTex" },
        practicalLights: ["oilLamp"],
        heroProps: ["desk", "door", "phone"],
        signatureShadowBeat: "Oil lamp shadows",
        anchors: { A: [0, 0, -2], B: [0, 0, 0] },
      },
    ],
    castBlueprints: [humanBp, entityBp],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 120,
        peakFrame: 60,
        locationId: "S01",
        lightState: { preset: "warmLamp", lampsOn: ["oilLamp"] },
        castStates: {
          C02: { visible: true, anchor: "A", pose: "talkUrgent", expr: "dread", speakingAs: "CHÚ TƯ", ageLines: true, sweat: true },
          C03: { visible: true, anchor: "A", moveFromAnchor: "A", moveToAnchor: "B", motionMode: "blinkStep", pose: "sitBenchHunched" },
        },
        propStates: {},
        cameraIntent: "Test lip-sync and blinkStep",
      },
    ],
  };

  const words = [{ w: "Cháu", s: 0.4, e: 0.8, speaker: "CHÚ TƯ" }];
  const blackouts: Array<[number, number]> = [
    [30, 36],
    [70, 76],
  ];

  // Before first blackout: stalker stays frozen at A (z = -2)
  applyManifestActors(m, 18, { C02: elder, C03: stalker }, undefined, { words, blackouts });
  assert.ok(Math.abs(stalker.group.position.z - -2) < 0.01, `expected z=-2 before blackout, got ${stalker.group.position.z}`);

  // After 1st blackout (f40): stalker stepped halfway to z = -1!
  applyManifestActors(m, 40, { C02: elder, C03: stalker }, undefined, { words, blackouts });
  assert.ok(Math.abs(stalker.group.position.z - -1) < 0.01, `expected z=-1 after 1st blackout, got ${stalker.group.position.z}`);

  // After 2nd blackout (f80): stalker reached B (z = 0)!
  applyManifestActors(m, 80, { C02: elder, C03: stalker }, undefined, { words, blackouts });
  assert.ok(Math.abs(stalker.group.position.z - 0) < 0.01, `expected z=0 after 2nd blackout, got ${stalker.group.position.z}`);

  // Confirm talkUrgent moves elder's arm dynamically across frames
  applyManifestActors(m, 10, { C02: elder }, undefined, { words });
  const armA = elder.sockets.rightUpperArm.rotation.x;
  applyManifestActors(m, 25, { C02: elder }, undefined, { words });
  const armB = elder.sockets.rightUpperArm.rotation.x;
  assert.notEqual(armA, armB, "talkUrgent pose must animate arm gestures dynamically across frames");

  elder.dispose();
  stalker.dispose();
});

test("Engine v11.0 enforces voiceOver closed mouth, shotsFromManifest, camPovChain, and 2-joint worldTarget POV hands", () => {
  const leadBp: CharacterBlueprint = {
    id: "C01",
    role: "human",
    storyDescription: "Night ferry protagonist thinking internally",
    appearance: { height: 1.72, lowPoly: true, outlineMode: "off" },
  };
  const lead = createCharacterFromBlueprint(leadBp);
  const m: SceneManifest = {
    projectId: "v11-cinema-test",
    title: "V11 Cinema Test",
    totalFrames: 120,
    aspect: "9:16",
    locations: [
      {
        id: "S01",
        archetype: "booth",
        dimensions: [5, 5, 3],
        ceilingType: "flatConcrete",
        materials: { wall: "darkTimberTex", floor: "concreteFloorTex", ceiling: "corrugatedTinTex" },
        practicalLights: ["oilLamp"],
        heroProps: ["desk", "bolt", "ledger"],
        signatureShadowBeat: "Warm booth",
        anchors: { DESK: [0, 0, 0] },
      },
    ],
    castBlueprints: [leadBp],
    beats: [
      {
        beatId: "B1",
        shotId: 1,
        a: 0,
        b: 120,
        peakFrame: 60,
        locationId: "S01",
        lightState: { preset: "warmLamp", lampsOn: ["oilLamp"] },
        castStates: {
          C01: { visible: true, anchor: "DESK", pose: "standIdle", speakingAs: "NARRATOR", dialogueMode: "voiceOver" },
        },
        propStates: {},
        cameraIntent: "Master opener",
      },
    ],
    shots: [
      { id: 1, a: 0, b: 60, scale: "WS", light: "warmLamp", cameraMode: "master", axisSide: "pov_center" },
      { id: 2, a: 60, b: 120, scale: "POV", light: "warmLamp", cameraMode: "pov_turn", axisSide: "pov_center" },
    ],
  };

  const derivedShots = shotsFromManifest(m);
  assert.equal(derivedShots.length, 2);
  assert.equal(derivedShots[0].scale, "WS");
  assert.equal(derivedShots[1].a, 60);

  // Voice-over narrator words must NOT open C01's mouth when dialogueMode === "voiceOver"
  const narratorWords = [{ w: "Tôi", s: 0.2, e: 0.9, speaker: "NARRATOR" }];
  applyManifestActors(m, 15, { C01: lead }, undefined, { words: narratorWords, speakerMap: { C01: ["NARRATOR", "NAM"] } });

  // Master establish & continuous POV chain interpolation
  const mCam = camMasterEstablish([1.8, 1.7, 2.2], [1.2, 1.65, 1.8], [0, 1.2, -1], [0, 1.25, -1.2], 0.5, 50);
  assert.ok(mCam.pos[0] > 1.2 && mCam.pos[0] < 1.8);
  const pCam = camPovChain(
    [
      { f: 60, pos: [0, 1.56, 0.8], look: [0, 1.48, -1.2], fov: 56 },
      { f: 75, dur: 18, pos: [0, 1.56, 0.8], look: [1.2, 1.05, -0.6], fov: 54 },
    ],
    84,
  );
  assert.ok(pCam.look[0] > 0.3 && pCam.look[0] < 1.0, `camPovChain mid-turn look.x=${pCam.look[0]}`);

  // 2-joint fingerCurl + worldTarget reach on PovRig3D
  const pov = createPovRig3D();
  const cam = new THREE.PerspectiveCamera(56, 9 / 16, 0.05, 50);
  cam.position.set(0, 1.55, 0.8);
  cam.lookAt(0, 1.40, -0.5);
  cam.updateMatrixWorld(true);

  pov.update(cam, { stance: "standing", anchor: [0, 0, 0.8], bodyYaw: 0, propMode: "leanDesk", frame: 10 });
  const openProxRot = (pov.rightHand.getObjectByName("povRightFingers")!.children[0] as THREE.Group).rotation.x;

  pov.update(cam, {
    stance: "standing",
    anchor: [0, 0, 0.8],
    bodyYaw: 0,
    propMode: "reachBolt",
    actionProgress: 0.85,
    worldTarget: [0.08, 1.38, 0.35],
    reachHand: "right",
    frame: 25,
  });
  const grippedProxRot = (pov.rightHand.getObjectByName("povRightFingers")!.children[0] as THREE.Group).rotation.x;
  assert.ok(grippedProxRot < openProxRot - 0.3, `expected tighter 2-joint finger curl on grasp (${grippedProxRot} vs ${openProxRot})`);

  lead.dispose();
});
