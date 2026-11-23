import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import * as Paint from "../templates/engine/paint.ts";
import {
  Batch,
  addWallWithOpening,
  addAFrameRoof,
  addDoubleDoorWithCracks,
  addCorridorBay,
  addStairFlight,
  addGlassOilLamp3D,
  addIncenseBurner3D,
  addFluorescentTube3D,
  addStreetLamp3D,
  addSimpleTable,
  addWoodenBedFrame,
} from "../templates/engine/build.ts";

test("paint.ts exports all 16 clean painterly v3 textures as callable functions", () => {
  const names = [
    "thatchRoofTex", "tileRoofTex", "concreteCeilingTex", "corrugatedTinTex",
    "mottledPlasterTex", "brickWallTex", "hospitalTileTex", "paintedConcreteTex",
    "darkTimberWallTex", "terracottaFloorTex", "vintagePatternTileTex", "reedMatTex",
    "wetAsphaltTex", "packedEarthTex", "woodenFloorTex", "garmentFoldTex",
  ] as const;

  for (const n of names) {
    const fn = (Paint as Record<string, unknown>)[n];
    assert.equal(typeof fn, "function", `Missing texture factory ${n}`);
    const tex = (fn as () => THREE.Texture)();
    assert.ok(tex instanceof THREE.Texture, `${n} did not return a THREE.Texture`);
  }
});

test("addWallWithOpening leaves clean cutout clearance without overlapping geometry inside opening", () => {
  const b = new Batch();
  const mat = new THREE.MeshLambertMaterial({ color: "#888" });
  addWallWithOpening(b, mat, [-3, 0, -4.1], [3, 3.2, -3.9], { axis: "x", u0: -0.7, u1: 0.7, y0: 0, y1: 2.2 }, 2.0);
  const g = new THREE.Group();
  b.build(g, true);
  assert.ok(g.children.length >= 1);

  const mesh = g.children[0] as THREE.Mesh;
  const pos = mesh.geometry.attributes.position;
  assert.ok(pos.count > 0);
  // No triangle centroid should fall strictly inside the doorway opening (-0.65..0.65, 0.05..2.15)
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    const insideOpening = cx > -0.65 && cx < 0.65 && cy > 0.05 && cy < 2.15;
    assert.equal(insideOpening, false, `Found wall triangle inside opening at (${cx.toFixed(2)}, ${cy.toFixed(2)})`);
  }
});

test("addDoubleDoorWithCracks toggles moonlight strip, feet shadow blockers, and hinged door rotation", () => {
  const parent = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: "#44332a" });
  const ctrl = addDoubleDoorWithCracks(parent, { frame: m, leaf: m, bolt: m }, { pos: [0, 0, -3.5], width: 1.4, height: 2.2 });

  ctrl.setMoonlight(true, true);
  assert.equal(ctrl.moonStrip.visible, true);
  assert.equal(ctrl.feetBlockers.visible, true);

  ctrl.setMoonlight(true, false);
  assert.equal(ctrl.moonStrip.visible, true);
  assert.equal(ctrl.feetBlockers.visible, false);

  ctrl.setMoonlight(false, false);
  assert.equal(ctrl.moonStrip.visible, false);

  ctrl.setOpen(0.8);
  assert.ok(Math.abs(ctrl.leftPivot.rotation.y) > 0.5);
  assert.ok(Math.abs(ctrl.rightPivot.rotation.y) > 0.5);
});

test("all modular architectural and hero-prop builders produce valid non-empty 3D geometry", () => {
  const b = new Batch();
  const m1 = new THREE.MeshLambertMaterial({ color: "#55443a" });
  const m2 = new THREE.MeshLambertMaterial({ color: "#77665c" });
  addAFrameRoof(b, m1, m2, { cx: 0, cz: 0, width: 6.4, depth: 7.6, eaveY: 2.8, ridgeH: 1.5, trussCount: 4 });
  addCorridorBay(b, { wall: m2, floor: m1, ceiling: m2, trim: m1 }, { z0: 0, z1: 4, width: 2.6, height: 2.9, doorLeft: true, doorRight: true });
  addStairFlight(b, m2, m1, { start: [0, 0, 0], steps: 6, width: 1.3, stepRise: 0.18, stepRun: 0.28 });
  addSimpleTable(b, m2, m1, [0, 0, 0], 1.1, 0.7, 0.78);
  addWoodenBedFrame(b, m1, m2, [0, 0, 2], 1.9, 1.3);

  const root = new THREE.Group();
  b.build(root, true);
  assert.ok(root.children.length >= 2);

  const lamp = addGlassOilLamp3D(root, [0, 0.78, 0]);
  lamp.setLit(true, 10);
  lamp.setLit(false, 10);
  const incense = addIncenseBurner3D(root, [0.3, 0.78, 0]);
  const tube = addFluorescentTube3D(root, [0, 2.8, -1]);
  tube.setIntensity(0.4);
  const street = addStreetLamp3D(root, [2.2, 0, -4]);

  assert.ok(lamp.group.children.length >= 4);
  assert.ok(incense.group.children.length >= 3);
  assert.ok(tube.group.children.length >= 2);
  assert.ok(street.bulbWorldPos[1] > 3.0);
});
