// Isolated Gothic Ink-Noir 3D EraGroups for "Ma Da" v2:
// 1. WharfEra: weathered wooden pier, lofted curved sampan hull, real 3D torn conical hat (nón lá), real 3D storm lantern,
//    gnarled mangrove trees, tall riverbank reeds, undulating treeline ridges (both sides!), organic hyacinth clusters,
//    volumetric moonbeam shaft, and dark foreground silhouette branches.
// 2. ShackEra: crooked timber interior with rafters, bolted door + ANIMATED 3D wooden crossbar latch, slatted moonlight
//    window with diagonal volumetric shaft, and real 3D glass-chimney oil lamp on weathered table.

import * as THREE from "three";
import {
  Batch,
  NOINK,
  Strand,
  V,
  addDistantRidge,
  addForegroundSilhouette,
  addGnarledTree,
  addHyacinthCluster,
  addReedCluster,
  addSampanHull,
  addStormLantern3D,
  addVolumetricShaft,
  beamHD,
  boxGeo,
  darkPlanksHD,
  lam,
  mudBankHD,
  phong,
  pitchedRoofGeo,
  rep,
  roofHD,
  stoneHD,
  taperedBoxGeo,
  waterFar,
  waterNear,
} from "../engine";
import { ANCHORS } from "./story";

export type WharfEra = {
  group: THREE.Group;
  fgSilhouettes: THREE.Group;
  waterMat: THREE.ShaderMaterial;
  lanternMat: THREE.MeshBasicMaterial;
  shackWinMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
  skiff: THREE.Group;
  conicalHat: THREE.Group;
  rope: Strand;
};

export type ShackEra = {
  group: THREE.Group;
  doorCrossbar: THREE.Mesh;
  lampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

export function buildWharfEra(): WharfEra {
  const group = new THREE.Group();
  const b = new Batch();

  const deckMat = lam("mada_v2_deck", () => ({ map: rep(darkPlanksHD("mada_deck_tex"), 2, 2), color: "#786454" }));
  const timberMat = lam("mada_v2_timber", () => ({ map: rep(beamHD(), 2, 1), color: "#58463a" }));
  const darkWoodMat = lam("mada_v2_darkwood", () => ({ map: rep(beamHD(), 1, 2), color: "#3b2f28" }));
  const bankMat = lam("mada_v2_mudbank", () => ({ map: rep(mudBankHD(), 16, 16), color: "#3d443d" }));
  const seawallMat = lam("mada_v2_seawall", () => ({
    map: rep(stoneHD("mada_v2_stone", ["#64605c", "#565250", "#706b66", "#4c4846"], "#2a2726"), 3, 1.5),
  }));
  const roofMat = lam("mada_v2_roof", () => ({ map: rep(roofHD("#3a3e4c", true), 3, 2) }));
  const hyacinthMat = lam("mada_v2_hyacinth", () => ({ color: "#2d4834" }));
  const reedMat = lam("mada_v2_reed", () => ({ color: "#243228" }));
  const ridgeMat = lam("mada_v2_ridge", () => ({ color: "#192330" }));
  const ironMat = phong("mada_v2_iron", () => ({ color: "#20242d", specular: "#687890", shininess: 42 }));
  const ropeMat = lam("mada_v2_rope", () => ({ color: "#8c7250" }));
  const hatMat = lam("mada_v2_nonla", () => ({ map: rep(darkPlanksHD("mada_hat_tex", ["#a89066", "#8c744e", "#76603e"]), 2, 2), color: "#b49c74" }));

  // 1. Dark muddy riverbank shore + stone embankment + undulating treeline ridges in BOTH directions!
  b.add(boxGeo(V(-65, -0.5, 2.3), V(65, 0.72, 48), 0), bankMat);
  b.add(boxGeo(V(-24, -1.2, 2.1), V(24, 0.76, 2.45), 2.5), seawallMat);
  addDistantRidge(b, ridgeMat, 22.0, 96, 0.4, 7.6, 19); // behind riverbank (visible in Shots 1, 3, 6, 7)
  addDistantRidge(b, ridgeMat, -52.0, 140, -0.2, 8.8, 37); // across opposite bank (visible in OTS Shot 2 & Reverse Shot 8)

  // 2. Weathered wooden ferry pier (cầu đò gỗ) with individual uneven planks & leaning pilings
  b.add(boxGeo(V(-1.35, 0.63, -1.98), V(1.35, 0.75, 2.42), 1.8), deckMat);
  b.add(boxGeo(V(-1.44, 0.50, -2.02), V(-1.26, 0.77, 2.42), 1.5), timberMat);
  b.add(boxGeo(V(1.26, 0.50, -2.02), V(1.44, 0.77, 2.42), 1.5), timberMat);
  b.add(boxGeo(V(-1.44, 0.52, -2.02), V(1.44, 0.76, -1.86), 1.5), timberMat);

  for (const pz of [1.55, 0.05, -1.85]) {
    b.add(boxGeo(V(-1.40, 0.44, pz - 0.10), V(1.40, 0.63, pz + 0.10), 1.2), darkWoodMat);
    for (const px of [-1.24, 1.24]) {
      const isBollard = pz < -1.5 && px > 0;
      const topY = isBollard ? 1.12 : pz > 1.0 ? 1.05 : 0.64;
      const h = topY + 1.35;
      const lean = px < 0 ? -0.04 : 0.03;
      const m = new THREE.Matrix4().compose(
        V(px, -1.35 + h * 0.5, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0, lean)),
        V(0.11, h, 0.11),
      );
      b.add(new THREE.CylinderGeometry(0.9, 1.05, 1, 7), darkWoodMat, m);
    }
  }
  b.add(boxGeo(V(-1.15, 0.68, 2.42), V(1.15, 0.75, 2.95), 1.2), deckMat);

  // 3. Crooked lantern post + real 3D hexagonal storm lantern
  const [lx, ly, lz] = ANCHORS.LANTERN_POST;
  b.add(taperedBoxGeo(V(lx - 0.085, ly, lz - 0.085), V(lx + 0.085, ly + 2.38, lz + 0.085), 0.76, 0.76, 0.06, -0.02), darkWoodMat);
  b.add(boxGeo(V(lx - 0.04, ly + 2.26, lz - 0.05), V(lx + 0.48, ly + 2.36, lz + 0.05), 0), timberMat);
  const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.65, 0.65), toneMapped: false });
  addStormLantern3D(b, ironMat, lanternMat, group, lx + 0.40, ly + 2.04, lz, 1.02);

  // 4. Organic water-hyacinth clusters right beside pier & sampan (visible in Shots 3, 4, 5, 6!)
  addHyacinthCluster(b, hyacinthMat, 0.25, 0.0, -2.28, 0.52, 0.42, 16, 1);
  addHyacinthCluster(b, hyacinthMat, 1.48, 0.0, -1.78, 0.55, 0.44, 15, 2);
  addHyacinthCluster(b, hyacinthMat, -0.82, 0.0, -2.35, 0.58, 0.48, 16, 3);
  addHyacinthCluster(b, hyacinthMat, -1.55, 0.0, -1.10, 0.55, 0.45, 14, 4);
  addHyacinthCluster(b, hyacinthMat, 0.95, 0.0, -3.75, 0.65, 0.48, 14, 5);

  // 5. Crooked riverbank watchman's shack exterior (pitched Gothic gable roof!) + gnarled mangroves + reeds framing the horizon!
  const [sx, sy, sz] = ANCHORS.BANK_SHACK_EXT;
  b.add(taperedBoxGeo(V(sx - 2.1, sy, sz - 0.2), V(sx + 2.1, sy + 2.35, sz + 3.0), 1.04, 1.02, -0.09, 0, 1.8), timberMat);
  b.add(pitchedRoofGeo(sx - 0.05, sy + 2.32, sz + 1.4, 5.2, 4.0, 1.65, 0.14, -0.10, 1.6), roofMat);

  // Multi-branching gnarled mangrove trees IN FRAME behind pier!
  addGnarledTree(b, darkWoodMat, -2.9, 0.72, 3.6, 5.4, 1.3, 0.55, -0.2);
  addGnarledTree(b, darkWoodMat, 2.7, 0.72, 3.4, 5.8, 2.7, -0.60, -0.25);
  addGnarledTree(b, darkWoodMat, 5.4, 0.72, 6.2, 6.2, 3.9, -0.35, 0.15);
  addGnarledTree(b, darkWoodMat, -5.8, 0.72, 6.8, 5.8, 5.1, 0.40, 0.15);
  addGnarledTree(b, darkWoodMat, 0.6, 0.72, 8.8, 6.6, 7.3, -0.25, 0.0);

  // Tall curved river reeds along the shore edge & pier flanks
  addReedCluster(b, reedMat, -1.85, 0.45, 2.15, 16, 1.55, 11, 0.55);
  addReedCluster(b, reedMat, 1.95, 0.45, 2.10, 18, 1.65, 23, 0.58);
  addReedCluster(b, reedMat, 3.35, 0.40, 1.55, 14, 1.45, 31, 0.50);
  addReedCluster(b, reedMat, -3.20, 0.40, 1.65, 14, 1.50, 41, 0.50);

  b.build(group, true);

  // 6. Real curved lofted wooden sampan hull (xuồng ba lá — NO Lego rectangles!)
  const skiff = new THREE.Group();
  const sb = new Batch();
  addSampanHull(sb, deckMat, timberMat, darkWoodMat);
  sb.build(skiff, true);
  skiff.position.set(...ANCHORS.SKIFF);
  skiff.rotation.y = -0.22;
  group.add(skiff);

  // 7. Real 3D torn conical hat (nón lá) floating upstream in Shot 3 (NO flat 2D sticker!)
  const conicalHat = new THREE.Group();
  const coneGeo = new THREE.ConeGeometry(0.32, 0.21, 14, 1, true);
  const coneMesh = new THREE.Mesh(coneGeo, hatMat);
  coneMesh.position.y = 0.09;
  coneMesh.castShadow = true;
  coneMesh.receiveShadow = true;
  const brimRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.012, 5, 16), darkWoodMat);
  brimRim.rotation.x = Math.PI / 2;
  conicalHat.add(coneMesh, brimRim);
  conicalHat.visible = false;
  group.add(conicalHat);

  // 8. Dynamic 3D mooring rope connecting pier bollard to sampan bow post
  const rope = new Strand(12, 0.032, 0.032, ropeMat, 0.5, true, false);
  group.add(rope.mesh);

  // 9. Distant warm shack window pane
  const shackWinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.25, 0.50), toneMapped: false });
  const shackWin = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.78), shackWinMat);
  shackWin.position.set(sx + 0.65, sy + 1.32, sz - 0.23);
  shackWin.rotation.y = Math.PI;
  group.add(shackWin);

  // 10. Volumetric moonlight shaft slicing diagonally onto the misty pier & river
  const shaft = addVolumetricShaft(group, [0.25, 4.4, -1.6], [0.18, 0, -0.32], 11.0, 0.9, 2.8, "#9ac4ff", 0.12);

  // 11. Shadow-Depth foreground silhouette reeds & overhanging branch (toggled only in Wide Shots 1 & 8 so close-ups stay crystal clear!)
  const fgSilhouettes = new THREE.Group();
  addForegroundSilhouette(fgSilhouettes, -3.2, 2.95, -5.6, 1.35, 17, -1);
  addForegroundSilhouette(fgSilhouettes, -0.6, 2.85, 3.1, 1.05, 29, 1);
  group.add(fgSilhouettes);

  // 12. Animated painted dark river water shader on NOINK layer
  const tNear = waterNear(), tFar = waterFar();
  tNear.colorSpace = THREE.NoColorSpace;
  tFar.colorSpace = THREE.NoColorSpace;
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      tNear: { value: tNear },
      tFar: { value: tFar },
      uTime: { value: 0 },
      cNear: { value: new THREE.Color() },
      cMid: { value: new THREE.Color() },
      cFar: { value: new THREE.Color() },
      cCrest: { value: new THREE.Color() },
      cTrough: { value: new THREE.Color() },
      cGlint: { value: new THREE.Color() },
      cShade: { value: new THREE.Color() },
      cFog: { value: new THREE.Color() },
      fogRange: { value: new THREE.Vector2(7, 68) },
      uFlashAmt: { value: 0 },
      uLampPos: { value: new THREE.Vector3() },
      uLampCol: { value: new THREE.Vector3() },
    },
    vertexShader: `varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform sampler2D tNear, tFar;
      uniform float uTime, uFlashAmt;
      uniform vec3 cNear, cMid, cFar, cCrest, cTrough, cGlint, cShade, cFog, uLampPos, uLampCol;
      uniform vec2 fogRange;
      varying vec3 vW;
      void main(){
        float d = length(vW.xz - cameraPosition.xz);
        vec3 col = mix(cNear, cMid, smoothstep(4.0, 20.0, d));
        col = mix(col, cFar, smoothstep(20.0, 70.0, d));
        float fFar = smoothstep(8.0, 30.0, d);
        vec2 flow = vec2(uTime * 0.016, uTime * 0.005);
        vec3 mN = texture2D(tNear, vW.xz / 7.5 + flow).rgb;
        vec3 mF = texture2D(tFar, vW.xz / 32.0 + flow * 0.5).rgb;
        vec3 m = mix(mN * (1.0 - fFar * 0.5), mF, fFar * 0.85) * (1.0 - smoothstep(55.0, 120.0, d));
        col = mix(col, cTrough, clamp(m.g * 0.85, 0.0, 1.0));
        col = mix(col, cCrest, clamp(m.r * 0.78, 0.0, 1.0));
        col = mix(col, cGlint, clamp(m.b * 0.85, 0.0, 1.0));
        // Real warm lantern reflection shimmering across wave crests & glints (keeps dark water abyssal black!)
        float ld = length(vW.xz - uLampPos.xz);
        float latt = pow(clamp(1.0 - ld / 5.4, 0.0, 1.0), 2.1);
        col += uLampCol * latt * (0.04 + 0.42 * m.r + 0.88 * m.b);
        // Real lightning flash illuminating water surface
        col += vec3(0.45, 0.58, 0.76) * uFlashAmt * (0.45 + 0.55 * m.r);
        col = mix(col, cFog, smoothstep(fogRange.x, fogRange.y, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
    fog: false,
  });

  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 260, 1, 1).rotateX(-Math.PI / 2), waterMat);
  water.position.set(0, 0, -90);
  water.layers.set(NOINK);
  group.add(water);

  return { group, fgSilhouettes, waterMat, lanternMat, shackWinMat, shaftMat: shaft.mat, skiff, conicalHat, rope };
}

export function buildShackEra(): ShackEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("mada_v2_shack_floor", () => ({ map: rep(darkPlanksHD("mada_sh_floor"), 2.5, 2.5), color: "#76604e" }));
  const wallMat = lam("mada_v2_shack_wall", () => ({ map: rep(darkPlanksHD("mada_sh_wall", ["#4e3f35", "#43362d", "#57473c"]), 2, 2), color: "#685548" }));
  const postMat = lam("mada_v2_shack_post", () => ({ map: rep(beamHD(), 1, 1), color: "#3d2f26" }));
  const doorMat = lam("mada_v2_shack_door", () => ({ map: rep(darkPlanksHD("mada_sh_door"), 1, 1), color: "#644f3e" }));
  const ironMat = phong("mada_v2_shack_iron", () => ({ color: "#1e222b", specular: "#6c7c92", shininess: 40 }));

  // 1. Dry wooden plank floor (y = 0)
  b.add(boxGeo(V(-3.8, -0.15, -3.4), V(3.8, 0.0, 3.8), 1.8), floorMat);

  // 2. Back timber wall, side walls, structural posts & overhead rafters
  b.add(boxGeo(V(-3.8, 0.0, -3.32), V(3.8, 3.45, -3.12), 2.0), wallMat);
  b.add(boxGeo(V(-3.8, 0.0, -3.32), V(-3.55, 3.45, 3.5), 2.0), wallMat);
  b.add(boxGeo(V(3.55, 0.0, -3.32), V(3.8, 3.45, 3.5), 2.0), wallMat);
  for (const px of [-3.48, -1.08, 1.08, 3.48]) {
    b.add(boxGeo(V(px - 0.09, 0.0, -3.14), V(px + 0.09, 3.45, -2.98), 0), postMat);
  }
  for (const rz of [-2.4, -1.0, 0.4]) {
    b.add(boxGeo(V(-3.75, 2.88, rz - 0.08), V(3.75, 3.08, rz + 0.08), 1.5), postMat);
  }

  // 3. Heavy timber door at ANCHORS.SHACK_DOOR + iron brackets (animated wooden crossbar is separate Mesh!)
  const [dx, dy, dz] = ANCHORS.SHACK_DOOR;
  b.add(boxGeo(V(dx - 0.64, dy, dz - 0.03), V(dx + 0.64, dy + 2.28, dz + 0.06), 1.2), doorMat);
  b.add(boxGeo(V(dx - 0.74, dy, dz - 0.04), V(dx - 0.60, dy + 2.38, dz + 0.11), 0), postMat);
  b.add(boxGeo(V(dx + 0.60, dy, dz - 0.04), V(dx + 0.74, dy + 2.38, dz + 0.11), 0), postMat);
  b.add(boxGeo(V(dx - 0.78, dy + 2.26, dz - 0.04), V(dx + 0.78, dy + 2.42, dz + 0.12), 0), postMat);
  // Iron latch brackets waiting for crossbar
  b.add(boxGeo(V(dx - 0.70, dy + 1.04, dz + 0.05), V(dx - 0.56, dy + 1.24, dz + 0.18), 0), ironMat);
  b.add(boxGeo(V(dx + 0.56, dy + 1.04, dz + 0.05), V(dx + 0.70, dy + 1.24, dz + 0.18), 0), ironMat);

  // 4. Slatted night window on back-left wall
  const [wx, wy, wz] = ANCHORS.SHACK_WINDOW;
  b.add(boxGeo(V(wx - 0.56, wy - 0.56, wz - 0.03), V(wx + 0.56, wy + 0.56, wz + 0.08), 0), postMat);
  for (const sx of [-0.26, 0.0, 0.26]) {
    b.add(boxGeo(V(wx + sx - 0.028, wy - 0.50, wz + 0.03), V(wx + sx + 0.028, wy + 0.50, wz + 0.09), 0), postMat);
  }

  // 5. Weathered wooden table holding REAL 3D tapered glass-chimney oil lamp!
  const [tx, ty, tz] = ANCHORS.SHACK_TABLE;
  b.add(boxGeo(V(tx - 0.48, ty + 0.72, tz - 0.38), V(tx + 0.48, ty + 0.79, tz + 0.38), 0.8), doorMat);
  for (const [lx, lz] of [[-0.40, -0.30], [0.40, -0.30], [-0.40, 0.30], [0.40, 0.30]] as const) {
    b.add(taperedBoxGeo(V(tx + lx - 0.045, ty, tz + lz - 0.045), V(tx + lx + 0.045, ty + 0.72, tz + lz + 0.045), 0.85, 0.85), postMat);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.9, 0.85), toneMapped: false });
  addStormLantern3D(b, ironMat, lampMat, group, tx - 0.08, ty + 0.96, tz + 0.06, 0.96);

  // 6. Low wooden cot on far left
  b.add(boxGeo(V(-3.45, 0.36, -2.25), V(-1.85, 0.45, -0.35), 1.2), doorMat);
  for (const [cx, cz] of [[-3.35, -2.15], [-1.95, -2.15], [-3.35, -0.45], [-1.95, -0.45]] as const) {
    b.add(boxGeo(V(cx - 0.05, 0.0, cz - 0.05), V(cx + 0.05, 0.36, cz + 0.05), 0), postMat);
  }

  b.build(group, true);

  // Animated 3D heavy wooden door crossbar (drops down into brackets as Ông Tư bolts door in Shot 9!)
  const doorCrossbar = new THREE.Mesh(boxGeo(V(-0.76, -0.06, -0.045), V(0.76, 0.06, 0.045), 0.8), postMat);
  doorCrossbar.position.set(dx, dy + 1.14, dz + 0.12);
  doorCrossbar.castShadow = true;
  doorCrossbar.receiveShadow = true;
  group.add(doorCrossbar);

  // HDR emissive slatted moonlight window pane + diagonal volumetric moonlight shaft entering shack!
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.75, 2.4), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), windowMat);
  winPane.position.set(wx, wy, wz + 0.04);
  group.add(winPane);

  const shaft = addVolumetricShaft(group, [wx + 0.72, wy - 0.55, wz + 1.15], [0.58, 0.28, -0.48], 3.8, 0.45, 1.05, "#8cb8f0", 0.14);

  return { group, doorCrossbar, lampMat, windowMat, shaftMat: shaft.mat };
}
