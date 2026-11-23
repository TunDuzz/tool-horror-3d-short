import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

import { NOINK } from "../templates/engine/ink.ts";
import { LIGHTS, LOOK } from "../templates/engine/lights.ts";
import {
  DYNAMIC_LIGHTS,
  applyLightUniforms,
  setLocalLights,
  setSpotLight,
  setLightningFlash,
  stylizedShade,
} from "../templates/engine/shade.ts";
import {
  computeSmoothNormals,
  attachOutline,
  createOutlineMaterial,
} from "../templates/engine/outline3d.ts";
import { WhipMotionBlurEffect } from "../templates/engine/motionblur.ts";
import { GradeEffect, GRADES, gradeFor } from "../templates/engine/grade.ts";

test("computeSmoothNormals averages orthogonal corner normals on a non-indexed BoxGeometry", () => {
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const smoothed = computeSmoothNormals(box);
  const pos = smoothed.attributes.position;
  const sn = smoothed.attributes.aSmoothNormal;
  assert.ok(sn, "Expected aSmoothNormal attribute");

  const expected = 1 / Math.sqrt(3);
  let checked = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - 0.5) < 1e-4 && Math.abs(pos.getY(i) - 0.5) < 1e-4 && Math.abs(pos.getZ(i) - 0.5) < 1e-4) {
      assert.ok(Math.abs(sn.getX(i) - expected) < 1e-4, `nx=${sn.getX(i)}`);
      assert.ok(Math.abs(sn.getY(i) - expected) < 1e-4, `ny=${sn.getY(i)}`);
      assert.ok(Math.abs(sn.getZ(i) - expected) < 1e-4, `nz=${sn.getZ(i)}`);
      checked++;
    }
  }
  assert.ok(checked >= 3, "Expected at least 3 corner vertices checked");
});

test("attachOutline isolates actors on NOINK, creates BackSide shells, and skips userData.noOutline", () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), stylizedShade(new THREE.MeshLambertMaterial({ color: "#ccc" })));
  const faceDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial());
  faceDecal.userData.noOutline = true;
  root.add(body, faceDecal);

  const outlines = attachOutline(root, { pxWidth: 6.0, color: "#06060a" });
  assert.equal(outlines.children.length, 1);
  assert.equal(body.layers.mask, 1 << NOINK);
  assert.equal(faceDecal.layers.mask, 1 << NOINK);

  const olMesh = outlines.children[0] as THREE.Mesh;
  assert.equal(olMesh.layers.mask, 1 << NOINK);
  assert.equal((olMesh.material as THREE.ShaderMaterial).side, THREE.BackSide);
  assert.ok(createOutlineMaterial().vertexShader.includes("aSmoothNormal"));

  // Thin sub-parts (e.g. slender fingers) must receive a tightly capped uMaxWorld so distant hands never turn into black paddles
  const thinRoot = new THREE.Group();
  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.06, 4, 6), new THREE.MeshLambertMaterial());
  thinRoot.add(finger);
  const thinOutlines = attachOutline(thinRoot, { pxWidth: 6.0, maxWorld: 0.032 });
  const thinOl = thinOutlines.children[0] as THREE.Mesh;
  const thinMaxW = (thinOl.material as THREE.ShaderMaterial).uniforms.uMaxWorld.value as number;
  assert.ok(thinMaxW <= 0.005, `Expected thin finger uMaxWorld <= 0.005, got ${thinMaxW}`);
});

test("shade.ts supports 6 PointLights, 1 SpotLight, and lightning flash", () => {
  applyLightUniforms(LIGHTS.warmLamp, LOOK.warmLamp);
  setLocalLights([
    { pos: [1, 1, 1], color: [2.0, 1.2, 0.5], radius: 4.5 },
    { pos: [-1, 2, 0], color: [1.5, 1.0, 0.4], radius: 5.0 },
    { pos: [0, 1, 2], color: [1.0, 1.0, 1.4], radius: 3.5 },
    { pos: [2, 1, -1], color: [0.8, 0.9, 1.0], radius: 4.0 },
    { pos: [-2, 1, -1], color: [1.2, 0.8, 0.4], radius: 4.0 },
    { pos: [0, 2.5, -2], color: [0.9, 1.1, 1.0], radius: 6.0 },
  ]);
  assert.equal(DYNAMIC_LIGHTS.uPtPos.value.length, 6);
  assert.equal(DYNAMIC_LIGHTS.uPtRad.value[5], 6.0);

  setLocalLights([{ pos: [0, 1, 0], color: [1, 1, 1], radius: 3 }]);
  assert.equal(DYNAMIC_LIGHTS.uPtRad.value[0], 3);
  assert.equal(DYNAMIC_LIGHTS.uPtRad.value[1], 0);
  assert.equal(DYNAMIC_LIGHTS.uPtRad.value[5], 0);

  setSpotLight({ pos: [0, 1.4, 2], target: [0, 1.2, -4], color: [2.2, 2.1, 1.8], distance: 12, angleDeg: 22, penumbra: 0.45 });
  assert.equal(DYNAMIC_LIGHTS.uSpDist.value, 12);
  assert.ok(DYNAMIC_LIGHTS.uSpCosIn.value > DYNAMIC_LIGHTS.uSpCosOut.value);

  setSpotLight(null);
  assert.equal(DYNAMIC_LIGHTS.uSpDist.value, 0);

  setLightningFlash(0.8);
  assert.equal(DYNAMIC_LIGHTS.uFlashAmt.value, 0.8);
});

test("WhipMotionBlurEffect passes through below 2.5px and enables blur above threshold", () => {
  const mb = new WhipMotionBlurEffect();
  assert.equal(mb.uniforms.get("uStrength")!.value, 0);

  mb.setVelocity(0.001, 0.0005, 1.2);
  assert.equal(mb.uniforms.get("uStrength")!.value, 0);

  mb.setVelocity(0.03, -0.004, 24);
  assert.ok((mb.uniforms.get("uStrength")!.value as number) > 0.5);
  const vel = mb.uniforms.get("uVel")!.value as THREE.Vector2;
  assert.ok(Math.abs(vel.x - 0.03) < 1e-5);
});

test("grade.ts has 5 v3 presets, supports smooth blending, and removes gradeGrime scratches", () => {
  assert.deepEqual(Object.keys(GRADES).sort(), ["coldMoon", "duskFog", "flashlight", "fluorescent", "warmLamp"]);
  const src = fs.readFileSync(path.resolve("templates/engine/grade.ts"), "utf-8");
  assert.equal(src.includes("gradeGrime"), false, "gradeGrime fake film scratches must be removed in v3");

  const fx = new GradeEffect(GRADES.warmLamp);
  gradeFor(fx, "warmLamp", 30, 0, "coldMoon", 0.5);
  assert.ok((fx.uniforms.get("gradeAberration")!.value as number) <= 0.15);
});
