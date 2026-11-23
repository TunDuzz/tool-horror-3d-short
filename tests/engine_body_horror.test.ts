import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { NOINK } from "../templates/engine/ink.ts";
import { createCharacter3D } from "../templates/engine/rig3d.ts";
import { buildHorrorSkullHeadGeo, type EyeHorrorMode } from "../templates/engine/bodyHorror.ts";
import {
  brickWallPair,
  cadaverSkinPair,
  darkTimberPair,
  hairStrandPair,
  hospitalTilePair,
  humanSkinPair,
  mottledPlasterPair,
  paintedConcretePair,
  repPair,
  tatteredGownPair,
  wetAsphaltPair,
  wovenFabricPair,
} from "../templates/engine/paint.ts";
import {
  Batch,
  addBrokenShutterWindow3D,
  addCobwebCluster3D,
  addCrackedCurbstone3D,
  addHangingCables3D,
  addOvergrownWeeds3D,
  addPeelingPaperDecal3D,
  addScatteredDebris3D,
} from "../templates/engine/build.ts";

test("Engine v4 paired Albedo+BumpMap texture library returns linear NoColorSpace bumpMaps and SRGB color maps", () => {
  const pairs = [
    mottledPlasterPair(),
    hospitalTilePair(),
    paintedConcretePair(),
    brickWallPair(),
    wetAsphaltPair(),
    darkTimberPair(),
    wovenFabricPair(),
    hairStrandPair(),
    humanSkinPair(),
    cadaverSkinPair("test_cad", "#9b9ba4", 0.6),
    tatteredGownPair("test_gown", "#888880", 0.5),
  ];

  for (const p of pairs) {
    assert.ok(p.map instanceof THREE.Texture);
    assert.ok(p.bumpMap instanceof THREE.Texture);
    assert.equal(p.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(p.bumpMap.colorSpace, THREE.NoColorSpace);
  }

  const repeated = repPair(pairs[0], 3, 2);
  assert.equal(repeated.map.repeat.x, 3);
  assert.equal(repeated.bumpMap.repeat.y, 2);
});

test("Engine v4 Environmental Decay & Clutter Kit creates valid 3D decay props cleanly", () => {
  const root = new THREE.Group();
  const b = new Batch();
  const mat = new THREE.MeshLambertMaterial({ color: "#555" });

  const win = addBrokenShutterWindow3D(root, [2, 1.5, 0], -Math.PI * 0.5);
  const cables = addHangingCables3D(root, [-2, 3, -1], [2, 2.8, -1], 4, 0.4, 7);
  const cobweb = addCobwebCluster3D(root, [-1, 2.2, -2], [0, 0, 0], 0.6);
  const poster = addPeelingPaperDecal3D(root, [-1, 1.5, -2], [0, 0, 0], { header: "CẢNH BÁO" });

  addOvergrownWeeds3D(b, mat, -1.8, 0, -3, 8, 0.35, 3);
  addCrackedCurbstone3D(b, mat, -1.9, -8, 2, 0.22, 0.13, 5);
  addScatteredDebris3D(b, mat, mat, [0, 0, -2], 0.6, 6, 11);
  b.build(root, true);

  assert.ok(win.children.length >= 3);
  assert.equal(cables.children.length, 4);
  assert.equal(cobweb.layers.mask, 1 << NOINK);
  assert.equal(cobweb.userData.noSSAO, true);
  assert.equal(poster.userData.noSSAO, true);
  assert.ok(root.children.length >= 5);
});

test("BodyHorrorConfig constructs sculpted 3D skull, articulated jaw + 18 crooked teeth, ribs, spine, spider claws, extraArms, and all 3 body-horror poses", () => {
  const skullGeo = buildHorrorSkullHeadGeo(0.10, 0.13, 0.11, true);
  assert.ok(skullGeo.attributes.position.count > 600);
  skullGeo.dispose();

  const monster = createCharacter3D({
    id: "bh_test",
    height: 1.76,
    hairStyle: "bald",
    garment: "hospitalGown",
    entity: {
      heightScale: 1.16,
      gauntness: 0.72,
      armScale: 1.26,
      fingerScale: 1.45,
      neckTiltDeg: -48,
      breathing: false,
      bodyHorror: {
        skullHollows: true,
        jawDrop3D: 0.9,
        crookedTeeth: true,
        neckStretch: 2.0,
        exposedRibs: true,
        protrudingSpine: true,
        clawHands: true,
        twistedJoints: true,
        extraArms: 2,
        cadaverSkin: true,
        bloodStainLevel: 0.65,
        eyeHorror: "weepingIchor",
        cheekSplitGrin: true,
        tatteredCloth: true,
      },
    },
  });

  // Verify articulated jaw & 2 extra arms sockets exist
  assert.ok(monster.sockets.jaw instanceof THREE.Group, "Missing sockets.jaw");
  assert.ok(monster.sockets.leftExtraArm instanceof THREE.Group, "Missing sockets.leftExtraArm");
  assert.ok(monster.sockets.rightExtraArm instanceof THREE.Group, "Missing sockets.rightExtraArm");

  // Verify named 3D horror meshes & NOINK isolation
  const names = new Set<string>();
  monster.group.traverse((o) => {
    if (o.name) names.add(o.name);
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      assert.equal(m.layers.mask, 1 << NOINK, `Horror mesh ${m.name} must stay on NOINK`);
    }
  });
  assert.ok(names.has("horrorSkullMesh"));
  assert.ok(names.has("upperTooth_0") && names.has("lowerTooth_8"));
  assert.ok(names.has("exposedRib_0") && names.has("spineVertebra_6"));
  assert.ok(names.has("clothTatter_0"));
  assert.ok(names.has("leftspiderClaw_0") || [...names].some((n) => n.includes("spiderClaw")));

  // Verify cadaverSkin material uses MeshPhongMaterial with bumpMap
  let sawCadaverBump = false;
  monster.sockets.head.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.name === "horrorSkullMesh") {
      const mat = m.material as THREE.MeshPhongMaterial;
      if (mat instanceof THREE.MeshPhongMaterial && mat.bumpMap) sawCadaverBump = true;
    }
  });
  assert.equal(sawCadaverBump, true, "Expected cadaverSkin MeshPhongMaterial with bumpMap");

  // Verify all 3 new body-horror poses
  monster.setPose("stalkLoom", 15);
  assert.ok(Math.abs(monster.sockets.neck.rotation.z) > 0.7);
  monster.setPose("jawUnlatch", 20);
  assert.ok(monster.sockets.jaw!.rotation.x > 0.45, "jawUnlatch must rotate articulated jaw open");
  monster.setPose("crawler", 25);
  assert.ok(Math.abs(monster.sockets.head.rotation.z - Math.PI) < 0.01, "crawler pose must invert head 180°");

  monster.dispose();

  // Verify all 5 EyeHorrorModes build without throwing
  const modes: EyeHorrorMode[] = ["sanpaku", "voidSockets", "weepingIchor", "stitched", "multiEye"];
  for (const mode of modes) {
    const e = createCharacter3D({
      id: `eye_${mode}`,
      hairStyle: "bald",
      entity: { bodyHorror: { skullHollows: true, eyeHorror: mode } },
    });
    e.dispose();
  }
});
