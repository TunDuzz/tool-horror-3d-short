import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { NOINK } from "../templates/engine/ink.ts";
import {
  createPovRig3D,
  createPhone3D,
  createFlashlight3D,
  createHandheldOilLamp3D,
  createPaperProp3D,
} from "../templates/engine/povRig.ts";
import {
  addRisingSmokeWisps,
  addDustMotes,
  addVolumetricCone,
  createFlatDecalMesh,
  addContactShadow,
  addLampHalo3D,
  addWetPuddleDecal,
} from "../templates/engine/fx3d.ts";
import {
  Batch,
  addFloorCornerAO,
  addExitSign3D,
  addPipeRun3D,
  addAltarOfferingPlate3D,
} from "../templates/engine/build.ts";

test("createPovRig3D isolates meshes onto NOINK, defaults to Style B (outlineMode='off'), supports outlineMode='grittyThin', and aligns deterministically to camera", () => {
  const pov = createPovRig3D({ sleeveCol: "#d8d1c2", pantsCol: "#1a1b24" });
  const cam = new THREE.PerspectiveCamera(56, 9 / 16, 0.08, 100);
  cam.position.set(0.2, 1.05, 1.8);
  cam.lookAt(0.2, 1.0, -1.0);
  cam.updateMatrixWorld(true);

  pov.update(cam, { stance: "seated", anchor: [0.2, 0, 1.8], bodyYaw: Math.PI, propMode: "phone", rightArmRaise: 1, frame: 30 });
  assert.deepEqual(pov.lowerBody.position.toArray(), [0.2, 0, 1.8]);
  assert.ok(pov.armsRoot.position.distanceTo(cam.position) < 0.05);

  let meshCount = 0;
  let outlineCount = 0;
  pov.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshCount++;
    assert.equal(m.layers.mask, 1 << NOINK);
    if (m.userData.isOutline) outlineCount++;
  });
  assert.ok(meshCount >= 10);
  assert.equal(outlineCount, 0);

  const povA = createPovRig3D({ outlineMode: "grittyThin" });
  let olA = 0;
  povA.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.isOutline) olA++;
  });
  assert.ok(olA >= 4);
});

test("diegetic 3D props (Phone3D, Flashlight3D, HandheldOilLamp3D, PaperProp3D) produce valid lights and toggle cleanly", () => {
  const pov = createPovRig3D();
  const cam = new THREE.PerspectiveCamera(56, 9 / 16, 0.08, 100);
  cam.position.set(0, 1.2, 2.0);
  cam.lookAt(0, 1.1, -1.0);
  cam.updateMatrixWorld(true);

  const phone = createPhone3D({ clock: "01:06", notifications: [{ sender: "Cô Lan", body: "Cô ốm ở nhà." }] });
  pov.rightHand.add(phone.group);
  pov.update(cam, { stance: "seated", anchor: [0, 0, 2.0], bodyYaw: Math.PI, propMode: "phone", rightArmRaise: 1, frame: 45 });
  pov.group.updateMatrixWorld(true);

  const pLight = phone.getLight(1.4);
  assert.ok(pLight.radius > 0.5);
  assert.ok(Number.isFinite(pLight.pos[0]) && Number.isFinite(pLight.pos[1]) && Number.isFinite(pLight.pos[2]));

  const torch = createFlashlight3D();
  pov.rightHand.add(torch.group);
  torch.setOn(false);
  assert.equal(torch.getSpotLight(), null);
  torch.setOn(true, 1.6);
  pov.group.updateMatrixWorld(true);
  const spot = torch.getSpotLight();
  assert.ok(spot !== null && spot.distance > 4 && spot.angleDeg > 8);

  const lamp = createHandheldOilLamp3D();
  lamp.setLit(false, 10);
  assert.equal(lamp.getLight(10), null);
  lamp.setLit(true, 10);
  assert.ok(lamp.getLight(10) !== null);

  const paper = createPaperProp3D();
  paper.setText("LỜI DẶN", ["Đừng đếm người."]);
  assert.ok(paper.group.children.length >= 1);

  phone.dispose();
  paper.dispose();
});

test("fx3d helpers stay on NOINK and update deterministically regardless of frame order", () => {
  const parent = new THREE.Group();
  const smoke = addRisingSmokeWisps(parent, [0, 1.1, -2], { count: 6, height: 0.9 });
  const dust = addDustMotes(parent, [0, 1.4, -1], [2, 1.5, 2], 18, 7);
  const cone = addVolumetricCone(parent, [0, 2.8, -1], [0, 0, -2.5], 0.25, 1.1);
  const decal = createFlatDecalMesh(new THREE.Texture(), 1.2, 1.2);
  parent.add(decal);

  smoke.update(45, true);
  dust.update(45);
  const sPos45 = smoke.group.children[0].position.toArray();
  const dPos45 = dust.group.children[0].position.toArray();

  smoke.update(120, true);
  dust.update(120);
  smoke.update(45, true);
  dust.update(45);
  assert.deepEqual(smoke.group.children[0].position.toArray(), sPos45);
  assert.deepEqual(dust.group.children[0].position.toArray(), dPos45);

  parent.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) assert.equal(m.layers.mask, 1 << NOINK);
  });
  assert.equal(cone.mesh.layers.mask, 1 << NOINK);
});

test("v3.5 atmospheric grounding & dressing helpers (ContactShadow, LampHalo, WetPuddle, FloorCornerAO, ExitSign, PipeRun, AltarPlate)", () => {
  const parent = new THREE.Group();
  const cs = addContactShadow(parent, [0, 0, 0], 0.5, 0.4);
  const halo = addLampHalo3D(parent, [1, 1, 0], 0.6);
  const puddle = addWetPuddleDecal(parent, [0, 0, -2], 0.8, 1.1);
  const cornerAo = addFloorCornerAO(parent, -2, 2, -3, 3);
  const exitSign = addExitSign3D(parent, [0, 2.5, -3], 0, "LỐI THOÁT");
  const altarPlate = addAltarOfferingPlate3D(parent, [0, 1, -2]);

  assert.equal(cs.layers.mask, 1 << NOINK);
  assert.equal(puddle.layers.mask, 1 << NOINK);
  assert.ok(puddle.material instanceof THREE.MeshPhongMaterial);
  halo.setIntensity(0);
  assert.equal(halo.sprite.visible, false);
  halo.setIntensity(0.8);
  assert.equal(halo.sprite.visible, true);
  assert.equal(cornerAo.children.length, 4);
  assert.ok(exitSign.children.length >= 2);
  assert.ok(altarPlate.children.length >= 8);

  const b = new Batch();
  addPipeRun3D(b, new THREE.MeshLambertMaterial(), [-1, 2, 0], [-1, 2, -6], 0.03);
  const pipeGroup = new THREE.Group();
  b.build(pipeGroup, false);
  assert.ok(pipeGroup.children.length >= 1);
});

test("Engine v10.0 PovRig3D renders visible embodied interactive hands in idle, leanDesk, reachBolt, holdPaper, holdHandset, and shieldFace modes", () => {
  const pov = createPovRig3D({ sleeveCol: "#2b3842", pantsCol: "#16181e" });
  const cam = new THREE.PerspectiveCamera(56, 9 / 16, 0.08, 100);
  cam.position.set(0, 1.4, 1.0);
  cam.lookAt(0, 1.2, -1.0);
  cam.updateMatrixWorld(true);

  for (const mode of ["idle", "leanDesk", "reachBolt", "holdPaper", "holdHandset", "shieldFace"] as const) {
    pov.update(cam, { stance: "standing", anchor: [0, 0, 1.0], bodyYaw: 0, propMode: mode, actionProgress: 0.75, walkBob: 0.4, frame: 45 });
    const leftArm = pov.armsRoot.getObjectByName("povLeftArm");
    const rightArm = pov.armsRoot.getObjectByName("povRightArm");
    assert.ok(leftArm?.visible, `povLeftArm must be visible in mode '${mode}'`);
    assert.ok(rightArm?.visible, `povRightArm must be visible in mode '${mode}'`);
  }
});
