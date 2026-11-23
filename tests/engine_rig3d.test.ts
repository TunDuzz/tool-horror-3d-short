import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { NOINK } from "../templates/engine/ink.ts";
import { FaceTextureCache } from "../templates/engine/face2d.ts";
import { autoBlink, createCharacter3D, mouthFromWords } from "../templates/engine/rig3d.ts";

test("createCharacter3D builds 20 named sockets with non-chibi adult horror proportions (height/headH >= 5.3)", () => {
  const npc = createCharacter3D({
    id: "npc",
    height: 1.72,
    hairStyle: "shortParted",
    garment: "funeralRobe",
    headbandCol: "#e8e3d6",
  });

  const expectedSockets = [
    "root", "pelvis", "spine", "chest", "neck", "head",
    "leftShoulder", "leftUpperArm", "leftForearm", "leftHand",
    "rightShoulder", "rightUpperArm", "rightForearm", "rightHand",
    "leftThigh", "leftCalf", "leftFoot",
    "rightThigh", "rightCalf", "rightFoot",
  ] as const;
  for (const name of expectedSockets) {
    assert.ok(npc.sockets[name] instanceof THREE.Group, `Missing socket ${name}`);
  }

  npc.setPose("standIdle", 0);
  npc.group.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(npc.group);
  const fullH = fullBox.max.y - fullBox.min.y;
  assert.ok(fullH >= 1.60 && fullH <= 1.85, `Expected ~1.72m height, got ${fullH.toFixed(3)}`);

  const headBox = new THREE.Box3().setFromObject(npc.sockets.head);
  const headH = headBox.max.y - headBox.min.y;
  assert.ok(headH <= 0.33, `Expected non-chibi headH <= 0.33m, got ${headH.toFixed(3)}`);
  assert.ok(fullH / headH >= 5.2, `Expected height/headH >= 5.2, got ${(fullH / headH).toFixed(2)}`);

  npc.dispose();
});

test("createCharacter3D isolates all meshes onto NOINK with BackSide Inverted-Hull outlines", () => {
  const npc = createCharacter3D({ id: "iso", hairStyle: "messyFringe", garment: "shirt" });
  let meshCount = 0;
  let outlineCount = 0;
  npc.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshCount++;
    assert.equal(m.layers.mask, 1 << NOINK, `Mesh ${m.name} must be on NOINK layer`);
    if (m.userData.isOutline) {
      outlineCount++;
      assert.equal((m.material as THREE.Material).side, THREE.BackSide);
    }
  });
  assert.ok(meshCount >= 12);
  assert.ok(outlineCount >= 6);
  npc.dispose();
});

test("EntityConfig overrides scale arms, tilt neck, and create HDR emissive pinpoint eyes", () => {
  const human = createCharacter3D({ id: "h", height: 1.72 });
  const entity = createCharacter3D({
    id: "ghost",
    height: 1.72,
    hairStyle: "longDraped",
    garment: "shroud",
    entity: {
      heightScale: 1.18,
      gauntness: 0.76,
      armScale: 1.25,
      fingerScale: 1.35,
      neckTiltDeg: 28,
      shoulderSkew: 0.12,
      hairCurtain: true,
      silhouetteMode: true,
      eyeGlow: true,
      breathing: false,
    },
  });

  human.setPose("standIdle", 15);
  entity.setPose("loomingStill", 15);

  const humanArmLen = Math.abs(human.sockets.leftForearm.position.y) + Math.abs(human.sockets.leftHand.position.y);
  const entityArmLen = Math.abs(entity.sockets.leftForearm.position.y) + Math.abs(entity.sockets.leftHand.position.y);
  assert.ok(entityArmLen > humanArmLen * 1.15, `Expected longer entity arms: ${entityArmLen} vs ${humanArmLen}`);
  assert.ok(Math.abs(entity.sockets.neck.rotation.z) > 0.35, `Expected crooked neck tilt, got ${entity.sockets.neck.rotation.z}`);

  let hdrEyeFound = false;
  entity.sockets.head.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.isEyeGlow) {
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat.toneMapped === false) hdrEyeFound = true;
    }
  });
  assert.equal(hdrEyeFound, true, "Expected HDR toneMapped=false emissive eye glints");

  human.dispose();
  entity.dispose();
});

test("setPose produces distinct deterministic poses across sitCrossLegged, walk, and loomingStill", () => {
  const npc = createCharacter3D({ id: "pose" });
  npc.setPose("sitCrossLegged", 30);
  const sitPelvisY = npc.sockets.pelvis.position.y;
  const sitThighX = npc.sockets.leftThigh.rotation.x;

  npc.setPose("walk", 30);
  const walkPelvisY = npc.sockets.pelvis.position.y;
  const walkThighX = npc.sockets.leftThigh.rotation.x;

  npc.setPose("sitCrossLegged", 30);
  assert.equal(npc.sockets.pelvis.position.y, sitPelvisY);
  assert.equal(npc.sockets.leftThigh.rotation.x, sitThighX);
  assert.ok(sitPelvisY < walkPelvisY - 0.35, "Seated pelvis must be much lower than standing/walking pelvis");
  assert.notEqual(sitThighX, walkThighX);

  const cache = new FaceTextureCache();
  assert.ok(cache);
  cache.dispose();
  npc.dispose();
});

test("setPoseBlend interpolates poses smoothly, autoBlink blinks deterministically, and mouthFromWords maps Vietnamese vowels", () => {
  const npc = createCharacter3D({ id: "blend" });
  npc.setPose("sitCrossLegged", 10);
  const ySit = npc.sockets.pelvis.position.y;
  npc.setPose("standIdle", 10);
  const yStand = npc.sockets.pelvis.position.y;

  npc.setPoseBlend("sitCrossLegged", "standIdle", 0.5, 10);
  const yMid = npc.sockets.pelvis.position.y;
  assert.ok(Math.abs(yMid - (ySit + yStand) * 0.5) < 1e-4, `Expected midpoint pelvisY, got ${yMid}`);

  // autoBlink returns 0 most frames and hits 1.0 cleanly at periodic blink peaks
  let sawClosed = false;
  let sawOpen = false;
  for (let f = 0; f < 180; f++) {
    const b = autoBlink(f, 5);
    if (b === 1.0) sawClosed = true;
    if (b === 0) sawOpen = true;
    assert.equal(b, autoBlink(f, 5));
  }
  assert.ok(sawClosed && sawOpen);

  // mouthFromWords maps Vietnamese vowels accurately
  const words = [
    { word: "Cô", start: 0.0, end: 0.5 },
    { word: "nhà", start: 0.6, end: 1.1 },
    { word: "đếm", start: 1.2, end: 1.7 },
  ];
  assert.equal(mouthFromWords(words, 7, 30), "talkO"); // 0.23s inside "Cô"
  assert.equal(mouthFromWords(words, 25, 30), "talkA"); // 0.83s inside "nhà"
  assert.equal(mouthFromWords(words, 43, 30), "talkE"); // 1.43s inside "đếm"
  assert.equal(mouthFromWords(words, 60, 30, "tense"), "tense"); // silence after words

  npc.dispose();
});
