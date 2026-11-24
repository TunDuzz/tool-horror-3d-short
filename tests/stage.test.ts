import assert from "node:assert/strict";
import test from "node:test";
import {
  alignCharacterPartTo,
  applyManifestActors,
  createCharacterFromBlueprint,
  getCharacterPartWorldPos,
  resolveLocationAnchor,
  type CharacterBlueprint,
  type SceneManifest,
} from "../templates/engine/index.ts";

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
