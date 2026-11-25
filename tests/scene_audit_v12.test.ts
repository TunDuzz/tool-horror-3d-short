import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { NOINK } from "../templates/engine/ink";
import { createCharacter3D } from "../templates/engine/rig3d";
import { auditSceneTargets, camOtsFrame, frameWorldPoints } from "../templates/engine/sceneAudit";

test("v12.0 frameWorldPoints keeps wide-apart subjects (oilLamp + ledgerBook) inside 9:16 Safe Frustum above subtitles", () => {
  const scene = new THREE.Scene();
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 8), new THREE.MeshBasicMaterial());
  lamp.name = "oilLamp";
  lamp.position.set(-0.56, 0.90, 0.18);

  const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.03, 0.34), new THREE.MeshBasicMaterial());
  ledger.name = "ledgerBook";
  ledger.position.set(-0.04, 0.78, 0.25);
  scene.add(lamp, ledger);

  const camState = frameWorldPoints(
    [0.04, 1.38, 0.98],
    [
      [-0.64, 0.76, 0.18],
      [-0.50, 1.04, 0.18],
      [-0.28, 0.78, 0.10],
      [0.22, 0.78, 0.40],
    ],
    9 / 16,
  );

  const cam = new THREE.PerspectiveCamera(camState.fov, 9 / 16, 0.08, 100);
  cam.position.set(...camState.pos);
  cam.lookAt(...camState.look);

  const res = auditSceneTargets(cam, scene, { oilLamp: lamp, ledgerBook: ledger });
  assert.equal(res.oilLamp.inSafeFrustum, true, `oilLamp issues: ${res.oilLamp.issues.join(",")}`);
  assert.equal(res.ledgerBook.inSafeFrustum, true, `ledgerBook issues: ${res.ledgerBook.issues.join(",")}`);
  assert.equal(res.oilLamp.issues.length, 0);
  assert.equal(res.ledgerBook.issues.length, 0);
});

test("v12.0 auditSceneTargets catches sill occlusion via 9-Ray Raycaster while passing clean window glass", () => {
  const scene = new THREE.Scene();

  // Translucent window glass (depthWrite: false, opacity: 0.14) must NOT block sightlines!
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.14, depthWrite: false }),
  );
  glass.name = "ticketGlass";
  glass.layers.set(NOINK);
  glass.position.set(0, 1.4, -2.55);
  scene.add(glass);

  // Exterior waiting bench at z = -5.4, y = 0.65
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.45), new THREE.MeshLambertMaterial());
  bench.name = "waitingBench";
  bench.position.set(0, 0.65, -5.4);
  scene.add(bench);

  // High solid wall up to y = 1.15 blocks bench from cam at y = 1.44, z = 0.40!
  const highWall = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.15, 0.18), new THREE.MeshLambertMaterial());
  highWall.name = "highCounterSill";
  highWall.position.set(0, 0.575, -2.55);
  scene.add(highWall);

  const cam = new THREE.PerspectiveCamera(50, 9 / 16, 0.08, 100);
  cam.position.set(0, 1.44, 0.40);
  cam.lookAt(0, 0.72, -5.4);

  const blockedAudit = auditSceneTargets(cam, scene, { waitingBench: bench });
  assert.ok(blockedAudit.waitingBench.visibleRayRatio < 0.34, `expected blocked bench, got ${blockedAudit.waitingBench.visibleRayRatio}`);
  assert.ok(
    blockedAudit.waitingBench.issues.some((x) => x.startsWith("OCCLUDED_BY(highCounterSill")),
    `expected OCCLUDED_BY(highCounterSill), got ${blockedAudit.waitingBench.issues.join(",")}`,
  );

  // Lowering the window sill wall to y = 0.72 opens a clear 3D sightline through the translucent glass!
  highWall.scale.y = 0.72 / 1.15;
  highWall.position.y = 0.36;
  const clearAudit = auditSceneTargets(cam, scene, { waitingBench: bench });
  assert.ok(clearAudit.waitingBench.visibleRayRatio >= 0.75, `expected clear sightline >=0.75, got ${clearAudit.waitingBench.visibleRayRatio}`);
  assert.equal(clearAudit.waitingBench.issues.length, 0);
});

test("v12.0 camOtsFrame bounds foreground shoulder silhouette cleanly and rig3d supports handoverProp + fleePanic", () => {
  const scene = new THREE.Scene();
  const fg = createCharacter3D({ id: "C01", height: 1.72 });
  const npc = createCharacter3D({ id: "C02", height: 1.66 });
  fg.group.position.set(0, 0, 1.1);
  fg.group.rotation.y = Math.PI;
  fg.setPose("standIdle", 10);

  npc.group.position.set(1.5, 0, -1.0);
  npc.setPose("handoverProp", 10);
  scene.add(fg.group, npc.group);
  scene.updateMatrixWorld(true);

  const shPos = new THREE.Vector3();
  const hdPos = new THREE.Vector3();
  const npcHead = new THREE.Vector3();
  fg.sockets.rightUpperArm.getWorldPosition(shPos);
  fg.sockets.head.getWorldPosition(hdPos);
  npc.sockets.head.getWorldPosition(npcHead);

  const ots = camOtsFrame([shPos.x, shPos.y, shPos.z], [hdPos.x, hdPos.y, hdPos.z], [npcHead.x, npcHead.y - 0.12, npcHead.z], "right");
  const cam = new THREE.PerspectiveCamera(ots.fov, 9 / 16, 0.08, 100);
  cam.position.set(...ots.pos);
  cam.lookAt(...ots.look);

  const res = auditSceneTargets(cam, scene, { C01: fg.group, "C02:head": npc.sockets.head });
  assert.ok(res.C01.areaPct <= 0.28, `expected OTS C01 area <= 0.28, got ${res.C01.areaPct}`);
  assert.equal(res["C02:head"].issues.length, 0, `expected unoccluded C02:head, got ${res["C02:head"].issues.join(",")}`);

  // Verify fleePanic leans forward dynamically and differs from calm walk
  npc.setPose("walk", 15);
  const walkSpineX = npc.sockets.spine.rotation.x;
  npc.setPose("fleePanic", 15);
  const fleeSpineX = npc.sockets.spine.rotation.x;
  assert.ok(fleeSpineX > walkSpineX + 0.18, `expected fleePanic forward lean (${fleeSpineX} vs ${walkSpineX})`);

  fg.dispose();
  npc.dispose();
});
