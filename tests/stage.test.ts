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
