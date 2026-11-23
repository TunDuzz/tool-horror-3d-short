// Gothic Ink-Noir HorrorLab look-dev courtyard built with non-box pitched roof, gnarled trees,
// distant treeline ridge, volumetric moonbeam shaft, foreground shadow silhouettes, and real 3D lantern.

import * as THREE from "three";
import {
  Batch,
  V,
  addDistantRidge,
  addForegroundSilhouette,
  addGnarledTree,
  addReedCluster,
  addStormLantern3D,
  addVolumetricShaft,
  beamHD,
  boxGeo,
  cobbleHD,
  crackedPlasterHD,
  darkPlanksHD,
  lam,
  mudBankHD,
  phong,
  pitchedRoofGeo,
  rep,
  roofHD,
  stoneHD,
  taperedBoxGeo,
} from "../engine";
import { ANCHORS } from "./story";

export type CourtyardEra = {
  group: THREE.Group;
  windowMat: THREE.MeshBasicMaterial;
  lanternMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

export function buildCourtyardEra(): CourtyardEra {
  const group = new THREE.Group();
  const b = new Batch();

  const groundMat = lam("hl_cobble", () => ({ map: rep(cobbleHD(), 10, 10), color: "#68666a" }));
  const earthMat = lam("hl_mud", () => ({ map: rep(mudBankHD(), 18, 18), color: "#424842" }));
  const wallMat = lam("hl_wall", () => ({ map: rep(crackedPlasterHD("hl_plaster", "#6e6966"), 2.2, 1.6) }));
  const woodMat = lam("hl_wood", () => ({ map: rep(darkPlanksHD("hl_planks"), 2, 1), color: "#6e5c50" }));
  const roofMat = lam("hl_roof", () => ({ map: rep(roofHD("#3d4252", true), 3, 2) }));
  const ironMat = phong("hl_iron", () => ({ color: "#222630", specular: "#6e7c92", shininess: 40 }));
  const stonePostMat = lam("hl_post", () => ({ map: stoneHD("hl_post_tex", ["#6d6b70", "#5f5d64", "#79767d", "#525058"], "#2c2a30") }));
  const barkMat = lam("hl_bark", () => ({ map: rep(beamHD(), 1, 2), color: "#3d332d" }));
  const reedMat = lam("hl_reed", () => ({ color: "#2b362e" }));
  const ridgeMat = lam("hl_ridge", () => ({ color: "#1d2633" }));

  // Surrounding mud terrain & courtyard cobbles
  b.add(boxGeo(V(-50, -0.25, -50), V(50, -0.02, 50), 0), earthMat);
  b.add(boxGeo(V(-5.5, -0.08, -4.5), V(5.5, 0.0, 7.5), 0), groundMat);

  // Undulating distant treeline ridge so horizon is never a flat bar
  addDistantRidge(b, ridgeMat, -32, 95, -0.2, 7.2, 11);

  // Crooked Gothic stone cottage / shrine at ANCHORS.PORCH
  const [px, py, pz] = ANCHORS.PORCH;
  b.add(taperedBoxGeo(V(px - 3.6, py, pz - 4.4), V(px + 3.6, py + 3.35, pz - 0.2), 1.04, 1.02, 0.10, 0, 2.2), wallMat);
  // Real pitched overhanging Gothic gable roof
  b.add(pitchedRoofGeo(px + 0.05, py + 3.32, pz - 2.3, 8.2, 5.2, 2.1, 0.16, 0.14, 1.8), roofMat);
  // Dark porch steps, arched lintel & slightly canted columns
  b.add(taperedBoxGeo(V(px - 1.45, py, pz - 0.2), V(px + 1.45, py + 0.18, pz + 0.85), 0.96, 0.96, 0, 0, 1.2), stonePostMat);
  b.add(boxGeo(V(px - 0.68, py + 0.18, pz - 0.24), V(px + 0.68, py + 2.42, pz - 0.10), 1.2), woodMat);
  b.add(taperedBoxGeo(V(px - 1.18, py + 0.18, pz + 0.50), V(px - 0.94, py + 2.60, pz + 0.74), 0.86, 0.86, -0.06, 0), woodMat);
  b.add(taperedBoxGeo(V(px + 0.94, py + 0.18, pz + 0.50), V(px + 1.18, py + 2.60, pz + 0.74), 0.86, 0.86, 0.06, 0), woodMat);
  b.add(boxGeo(V(px - 1.40, py + 2.52, pz + 0.42), V(px + 1.40, py + 2.86, pz + 0.86), 1.5), woodMat);

  // Window frame (left side of porch)
  const [wx, wy, wz] = ANCHORS.WINDOW;
  b.add(boxGeo(V(wx - 0.62, wy - 0.64, wz - 0.14), V(wx + 0.62, wy + 0.64, wz - 0.04), 0), woodMat);
  b.add(boxGeo(V(wx - 0.04, wy - 0.56, wz - 0.02), V(wx + 0.04, wy + 0.56, wz + 0.04), 0), woodMat);
  b.add(boxGeo(V(wx - 0.56, wy - 0.04, wz - 0.02), V(wx + 0.56, wy + 0.04, wz + 0.04), 0), woodMat);

  // Iron lantern post + real hexagonal 3D lantern
  const [lx, ly, lz] = ANCHORS.LANTERN_POST;
  b.add(taperedBoxGeo(V(lx - 0.16, ly, lz - 0.16), V(lx + 0.16, ly + 0.36, lz + 0.16), 0.75, 0.75), stonePostMat);
  b.add(taperedBoxGeo(V(lx - 0.048, ly + 0.36, lz - 0.048), V(lx + 0.048, ly + 2.48, lz + 0.048), 0.72, 0.72), ironMat);
  b.add(boxGeo(V(lx - 0.54, ly + 2.38, lz - 0.04), V(lx + 0.06, ly + 2.46, lz + 0.04), 0), ironMat);

  const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.65, 0.68), toneMapped: false });
  addStormLantern3D(b, ironMat, lanternMat, group, lx - 0.44, ly + 2.16, lz, 1.05);

  // Tilted Gothic stone markers & fence rails
  for (const [fx, fz, fh, sk] of [
    [-3.6, 0.6, 0.98, -0.07],
    [-4.2, -1.8, 1.18, 0.09],
    [3.5, -0.8, 1.05, 0.06],
    [4.1, -3.2, 1.28, -0.08],
  ] as const) {
    b.add(taperedBoxGeo(V(fx - 0.24, 0, fz - 0.12), V(fx + 0.24, fh, fz + 0.12), 0.82, 0.9, sk, 0), stonePostMat);
  }

  // Multi-branching gnarled trees & marsh reeds framing midground
  addGnarledTree(b, barkMat, -3.8, 0, -4.6, 5.6, 1.1, 0.5, 0.2);
  addGnarledTree(b, barkMat, 3.6, 0, -4.8, 6.0, 2.4, -0.5, 0.2);
  addGnarledTree(b, barkMat, -5.6, 0, 1.4, 5.0, 3.7, 0.4, -0.2);
  addGnarledTree(b, barkMat, 5.4, 0, 1.2, 5.2, 4.9, -0.4, -0.2);
  addReedCluster(b, reedMat, -2.5, 0, 2.4, 14, 1.25, 17, 0.6);
  addReedCluster(b, reedMat, 2.4, 0, 2.2, 14, 1.15, 29, 0.6);

  b.build(group, true);

  // HDR emissive window pane
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.6), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.10), windowMat);
  winPane.position.set(wx, wy, wz - 0.03);
  group.add(winPane);

  // Volumetric moonlight shaft cutting diagonally into the courtyard
  const shaft = addVolumetricShaft(group, [-0.5, 4.2, -0.8], [0.22, 0, 0.34], 10.5, 0.85, 2.4, "#9ec4ff", 0.13);

  // Shadow-Depth dark overhanging branch framing top-left corner of wide establishing shot
  addForegroundSilhouette(group, -2.2, 3.4, 4.8, 1.3, 9, -1);

  return { group, windowMat, lanternMat, shaftMat: shaft.mat };
}
