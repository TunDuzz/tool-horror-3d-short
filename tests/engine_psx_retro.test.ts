import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { DEF_PSX_OPTIONS, RetroPsxEffect } from "../templates/engine/retroPsx.ts";
import { PSX_UNIFORMS, setPsxVertexSnap } from "../templates/engine/shade.ts";
import { applyPsxTextureFilter, mottledPlasterPair } from "../templates/engine/paint.ts";
import { createCharacter3D } from "../templates/engine/rig3d.ts";

test("RetroPsxEffect initializes 1A+2A+3A defaults and updates frame/glitchSurge/options deterministically", () => {
  const fx = new RetroPsxEffect();
  assert.equal(fx.uniforms.get("uPixelScale")!.value, DEF_PSX_OPTIONS.pixelScale);
  assert.equal(fx.uniforms.get("uColorLevels")!.value, DEF_PSX_OPTIONS.colorLevels);
  assert.equal(fx.uniforms.get("uScanline")!.value, DEF_PSX_OPTIONS.scanlineStrength);
  assert.equal(fx.uniforms.get("uVhsWave")!.value, DEF_PSX_OPTIONS.vhsWave);
  assert.equal(fx.uniforms.get("uChromaPx")!.value, DEF_PSX_OPTIONS.chromaPx);
  assert.equal(fx.uniforms.get("uCurvature")!.value, DEF_PSX_OPTIONS.crtCurvature);

  fx.frame = 148;
  fx.glitchSurge = 0.62;
  assert.equal(fx.frame, 148);
  assert.equal(fx.glitchSurge, 0.62);

  fx.glitchSurge = -0.5;
  assert.equal(fx.glitchSurge, 0);

  fx.setOptions({ pixelScale: 4.0, scanlineStrength: 0.30 });
  assert.equal(fx.uniforms.get("uPixelScale")!.value, 4.0);
  assert.equal(fx.uniforms.get("uScanline")!.value, 0.30);
});

test("setPsxVertexSnap controls global uPsxSnap uniform and clamps negatives to 0", () => {
  setPsxVertexSnap(280);
  assert.equal(PSX_UNIFORMS.uPsxSnap.value, 280);
  setPsxVertexSnap(-50);
  assert.equal(PSX_UNIFORMS.uPsxSnap.value, 0);
});

test("applyPsxTextureFilter switches world textures to NearestFilter while skipping phoneScreen", () => {
  const root = new THREE.Group();
  const wallPair = mottledPlasterPair("psx_test_wall");
  const wallMat = new THREE.MeshLambertMaterial({ map: wallPair.map });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat);
  wall.name = "wallMesh";

  const phoneTex = new THREE.Texture();
  phoneTex.minFilter = THREE.LinearMipmapLinearFilter;
  phoneTex.magFilter = THREE.LinearFilter;
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), new THREE.MeshBasicMaterial({ map: phoneTex }));
  phoneScreen.name = "phoneScreen";

  root.add(wall, phoneScreen);
  const count = applyPsxTextureFilter(root, true);
  assert.equal(count, 1);
  assert.equal(wallPair.map.minFilter, THREE.NearestFilter);
  assert.equal(wallPair.map.magFilter, THREE.NearestFilter);
  assert.equal(wallPair.map.generateMipmaps, false);
  // phoneScreen MUST remain linear & legible!
  assert.equal(phoneTex.magFilter, THREE.LinearFilter);

  // Restore cleanly
  applyPsxTextureFilter(root, false);
  assert.equal(wallPair.map.magFilter, THREE.LinearFilter);
});

test("createCharacter3D defaults to PSX lowPoly faceted flatShading and respects lowPoly: false", () => {
  const lpChar = createCharacter3D({ id: "lp_human", garment: "casualJacket" });
  let sawFlat = false;
  lpChar.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.name === "headMesh") {
      const mat = m.material as THREE.MeshPhongMaterial;
      if (mat.flatShading === true) sawFlat = true;
    }
  });
  assert.equal(sawFlat, true, "Expected flatShading: true in default PSX lowPoly mode");
  lpChar.dispose();

  const smoothChar = createCharacter3D({ id: "smooth_human", garment: "casualJacket", lowPoly: false });
  let sawSmooth = false;
  smoothChar.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.name === "headMesh") {
      const mat = m.material as THREE.MeshPhongMaterial;
      if (mat.flatShading === false) sawSmooth = true;
    }
  });
  assert.equal(sawSmooth, true, "Expected flatShading: false when lowPoly: false");
  smoothChar.dispose();
});
