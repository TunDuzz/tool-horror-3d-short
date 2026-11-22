// Neutral horror look-dev courtyard built strictly in an isolated THREE.Group (`eraCourtyard`).
// Uses muted weathered stone/wood albedos and HDR emissive window/lantern materials for Bloom.

import * as THREE from "three";
import { Batch, V, beamHD, boxGeo, cobbleHD, grassHD, lam, phong, rep, roofHD, stoneHD } from "../engine";
import { ANCHORS } from "./story";

export type CourtyardEra = {
  group: THREE.Group;
  windowMat: THREE.MeshBasicMaterial;
  lanternMat: THREE.MeshBasicMaterial;
};

const addDeadTree = (b: Batch, trunkMat: THREE.Material, x: number, y: number, z: number, h: number, seed: number) => {
  const m1 = new THREE.Matrix4().compose(
    V(x, y + h * 0.45, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(seed), seed, 0.07 * Math.cos(seed))),
    V(0.18 * h, h, 0.18 * h),
  );
  b.add(new THREE.CylinderGeometry(0.32, 0.65, 1, 7), trunkMat, m1);
  for (const [ang, tilt, bh, by] of [
    [seed + 0.5, 0.65, 0.45, 0.65],
    [seed + 2.6, -0.55, 0.4, 0.72],
    [seed + 4.4, 0.5, 0.35, 0.8],
  ] as const) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, tilt));
    const m = new THREE.Matrix4().compose(V(x + Math.sin(ang) * 0.15 * h, y + h * by, z + Math.cos(ang) * 0.15 * h), q, V(0.07 * h, bh * h, 0.07 * h));
    b.add(new THREE.CylinderGeometry(0.18, 0.42, 1, 6), trunkMat, m);
  }
};

export function buildCourtyardEra(): CourtyardEra {
  const group = new THREE.Group();
  const b = new Batch();

  const groundMat = lam("hl_cobble", () => ({
    map: rep(cobbleHD(), 10, 10),
    color: "#7b7876",
  }));
  const earthMat = lam("hl_grass", () => ({
    map: rep(grassHD(), 24, 24),
    color: "#4d524c",
  }));
  const wallMat = lam("hl_wall", () => ({
    map: rep(stoneHD("hl_stone", ["#857f7a", "#78726d", "#908982", "#6c6662"], "#423d3a"), 2.4, 1.8),
  }));
  const woodMat = lam("hl_wood", () => ({
    map: rep(beamHD(), 2, 1),
    color: "#695548",
  }));
  const roofMat = lam("hl_roof", () => ({
    map: rep(roofHD("#4a4f5e", true), 3, 2),
  }));
  const ironMat = phong("hl_iron", () => ({
    color: "#2b303a",
    specular: "#6b7788",
    shininess: 35,
  }));
  const stonePostMat = lam("hl_post", () => ({
    map: stoneHD("hl_post_tex", ["#747274", "#68666a", "#807e82", "#5c5a5f"], "#363438"),
  }));

  // Surrounding dark ground & courtyard cobbles
  b.add(boxGeo(V(-45, -0.25, -45), V(45, -0.02, 45), 0), earthMat);
  b.add(boxGeo(V(-5.5, -0.08, -4.5), V(5.5, 0.0, 7.5), 0), groundMat);

  // Old haunted stone cabin / shrine at ANCHORS.PORCH
  const [px, py, pz] = ANCHORS.PORCH;
  b.add(boxGeo(V(px - 3.6, py, pz - 4.4), V(px + 3.6, py + 3.4, pz - 0.2), 2.2), wallMat);
  // Roof
  b.add(boxGeo(V(px - 3.9, py + 3.4, pz - 4.7), V(px + 3.9, py + 4.2, pz + 0.1), 2.0), roofMat);
  b.add(boxGeo(V(px - 3.1, py + 4.2, pz - 4.2), V(px + 3.1, py + 4.95, pz - 0.4), 2.0), roofMat);
  // Dark porch steps & doorway frame
  b.add(boxGeo(V(px - 1.4, py, pz - 0.2), V(px + 1.4, py + 0.16, pz + 0.8), 0), stonePostMat);
  b.add(boxGeo(V(px - 0.65, py + 0.16, pz - 0.24), V(px + 0.65, py + 2.35, pz - 0.12), 0), woodMat);
  // Porch columns & lintel
  b.add(boxGeo(V(px - 1.15, py + 0.16, pz + 0.52), V(px - 0.92, py + 2.55, pz + 0.75), 0), woodMat);
  b.add(boxGeo(V(px + 0.92, py + 0.16, pz + 0.52), V(px + 1.15, py + 2.55, pz + 0.75), 0), woodMat);
  b.add(boxGeo(V(px - 1.35, py + 2.5, pz + 0.44), V(px + 1.35, py + 2.82, pz + 0.85), 0), woodMat);

  // Window frame (left side of porch)
  const [wx, wy, wz] = ANCHORS.WINDOW;
  b.add(boxGeo(V(wx - 0.62, wy - 0.62, wz - 0.14), V(wx + 0.62, wy + 0.62, wz - 0.04), 0), woodMat);
  b.add(boxGeo(V(wx - 0.04, wy - 0.54, wz - 0.02), V(wx + 0.04, wy + 0.54, wz + 0.03), 0), woodMat);
  b.add(boxGeo(V(wx - 0.54, wy - 0.04, wz - 0.02), V(wx + 0.54, wy + 0.04, wz + 0.03), 0), woodMat);

  // Iron lantern post at ANCHORS.LANTERN_POST
  const [lx, ly, lz] = ANCHORS.LANTERN_POST;
  b.add(boxGeo(V(lx - 0.14, ly, lz - 0.14), V(lx + 0.14, ly + 0.35, lz + 0.14), 0), stonePostMat);
  b.add(boxGeo(V(lx - 0.045, ly + 0.35, lz - 0.045), V(lx + 0.045, ly + 2.45, lz + 0.045), 0), ironMat);
  b.add(boxGeo(V(lx - 0.52, ly + 2.38, lz - 0.04), V(lx + 0.05, ly + 2.45, lz + 0.04), 0), ironMat);
  b.add(boxGeo(V(lx - 0.54, ly + 2.02, lz - 0.12), V(lx - 0.32, ly + 2.32, lz + 0.12), 0), ironMat);

  // Stone low fence & grave/pillar silhouettes in midground/background (clear of camera)
  for (const [fx, fz, fh] of [
    [-3.8, 0.8, 0.95],
    [-4.6, -1.6, 1.15],
    [3.8, -0.8, 1.0],
    [4.4, -3.2, 1.25],
    [2.5, -5.8, 1.1],
    [-4.2, -5.5, 1.2],
  ] as const) {
    b.add(boxGeo(V(fx - 0.24, 0, fz - 0.14), V(fx + 0.24, fh, fz + 0.14), 0), stonePostMat);
  }
  b.add(boxGeo(V(-5.2, 0.42, 0.72), V(-3.2, 0.54, 0.86), 0), woodMat);
  b.add(boxGeo(V(3.2, 0.42, -0.86), V(5.0, 0.54, -0.72), 0), woodMat);

  // Dead crooked trees flanking the yard
  addDeadTree(b, woodMat, -5.4, 0, -4.0, 5.4, 1.1);
  addDeadTree(b, woodMat, 5.2, 0, -4.6, 5.8, 2.4);
  addDeadTree(b, woodMat, -6.8, 0, 2.0, 4.9, 3.7);
  addDeadTree(b, woodMat, 6.4, 0, 1.4, 5.2, 4.9);

  b.build(group, true);

  // HDR emissive meshes (window glass + lantern core) kept separate so world.ts modulates glow by preset
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.6), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.06), windowMat);
  winPane.position.set(wx, wy, wz - 0.03);
  group.add(winPane);

  const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.65, 0.65), toneMapped: false });
  const lanternBulb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), lanternMat);
  lanternBulb.position.set(lx - 0.43, ly + 2.17, lz);
  group.add(lanternBulb);

  return { group, windowMat, lanternMat };
}
