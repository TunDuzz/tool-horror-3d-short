// Isolated 3D EraGroups for "Ma Da" (MadaShort):
// 1. WharfEra ("wharf"): Misty Mekong/delta wooden ferry pier, animated dark river water, dynamic moored sampan + mooring rope,
//    water-hyacinth clumps, storm lantern post, and distant riverbank watchman's shack + crooked mangrove trees.
// 2. ShackEra ("shack"): Interior of the wooden watchman's shack with dry plank floorboards, bolted wooden door with crossbar latch,
//    flickering oil lamp on table, slatted night window, and open center floor for the wet footprints twist.

import * as THREE from "three";
import {
  Batch,
  NOINK,
  Strand,
  V,
  beamHD,
  boxGeo,
  grassHD,
  lam,
  phong,
  planksHD,
  rep,
  roofHD,
  stoneHD,
  waterFar,
  waterNear,
} from "../engine";
import { ANCHORS } from "./story";

export type WharfEra = {
  group: THREE.Group;
  waterMat: THREE.ShaderMaterial;
  lanternMat: THREE.MeshBasicMaterial;
  shackWinMat: THREE.MeshBasicMaterial;
  skiff: THREE.Group;
  rope: Strand;
};

export type ShackEra = {
  group: THREE.Group;
  lampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
};

const addDeadTree = (b: Batch, trunkMat: THREE.Material, x: number, y: number, z: number, h: number, seed: number) => {
  const m1 = new THREE.Matrix4().compose(
    V(x, y + h * 0.45, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(seed), seed, 0.07 * Math.cos(seed))),
    V(0.17 * h, h, 0.17 * h),
  );
  b.add(new THREE.CylinderGeometry(0.30, 0.64, 1, 7), trunkMat, m1);
  for (const [ang, tilt, bh, by] of [
    [seed + 0.5, 0.65, 0.45, 0.64],
    [seed + 2.5, -0.56, 0.42, 0.72],
    [seed + 4.3, 0.52, 0.36, 0.80],
  ] as const) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, tilt));
    const m = new THREE.Matrix4().compose(
      V(x + Math.sin(ang) * 0.15 * h, y + h * by, z + Math.cos(ang) * 0.15 * h),
      q,
      V(0.07 * h, bh * h, 0.07 * h),
    );
    b.add(new THREE.CylinderGeometry(0.16, 0.40, 1, 6), trunkMat, m);
  }
};

export function buildWharfEra(): WharfEra {
  const group = new THREE.Group();
  const b = new Batch();

  const deckMat = lam("mada_deck", () => ({
    map: rep(planksHD(), 2, 2),
    color: "#876e57",
  }));
  const timberMat = lam("mada_timber", () => ({
    map: rep(beamHD(), 2, 1),
    color: "#675140",
  }));
  const darkWoodMat = lam("mada_darkwood", () => ({
    map: rep(beamHD(), 1, 1),
    color: "#4e3c2f",
  }));
  const bankMat = lam("mada_bank", () => ({
    map: rep(grassHD(), 20, 20),
    color: "#3f493e",
  }));
  const seawallMat = lam("mada_seawall", () => ({
    map: rep(stoneHD("mada_stone", ["#746f6a", "#66615d", "#7f7973", "#5a5552"], "#383432"), 3, 1.5),
  }));
  const roofMat = lam("mada_roof", () => ({
    map: rep(roofHD("#444854", true), 3, 2),
  }));
  const hyacinthMat = lam("mada_hyacinth", () => ({
    color: "#324c38",
  }));
  const ironMat = phong("mada_iron", () => ({
    color: "#262b34",
    specular: "#687588",
    shininess: 35,
  }));
  const ropeMat = lam("mada_rope", () => ({
    color: "#8e7350",
  }));

  // 1. Riverbank shore (z >= 2.2) & far opposite bank silhouette (z <= -95)
  b.add(boxGeo(V(-60, -0.5, 2.2), V(60, 0.72, 55), 0), bankMat);
  b.add(boxGeo(V(-22, -1.2, 2.0), V(22, 0.76, 2.35), 2.5), seawallMat);
  b.add(boxGeo(V(-140, -0.5, -125), V(140, 2.6, -96), 0), bankMat);

  // 2. Wooden ferry pier (cầu đò gỗ): deck at y = 0.75, extending from shore z = 2.35 out to z = -1.95
  b.add(boxGeo(V(-1.36, 0.63, -1.95), V(1.36, 0.75, 2.35), 1.8), deckMat);
  // Side stringer beams & front crossbar
  b.add(boxGeo(V(-1.42, 0.50, -1.98), V(-1.26, 0.76, 2.35), 1.5), timberMat);
  b.add(boxGeo(V(1.26, 0.50, -1.98), V(1.42, 0.76, 2.35), 1.5), timberMat);
  b.add(boxGeo(V(-1.42, 0.52, -1.98), V(1.42, 0.75, -1.84), 1.5), timberMat);

  // Transverse beams & under-deck wooden pilings (kept below deck y=0.75 except low mooring bollards)
  for (const pz of [1.45, -0.15, -1.82]) {
    b.add(boxGeo(V(-1.38, 0.44, pz - 0.10), V(1.38, 0.63, pz + 0.10), 1.2), darkWoodMat);
    for (const px of [-1.22, 1.22]) {
      const topY = pz < -1.5 && px > 0 ? 1.08 : 0.64; // front-right piling rises 0.33m as mooring bollard
      const h = topY - -1.35;
      const m = new THREE.Matrix4().compose(V(px, -1.35 + h * 0.5, pz), new THREE.Quaternion(), V(0.13, h, 0.13));
      b.add(new THREE.CylinderGeometry(1, 0.92, 1, 8), darkWoodMat, m);
    }
  }
  // Wooden steps leading from riverbank (y=0.72) onto pier
  b.add(boxGeo(V(-1.1, 0.68, 2.35), V(1.1, 0.75, 2.85), 1.2), deckMat);

  // 3. Storm-lantern post on the left edge of the pier (ANCHORS.LANTERN_POST = [-1.26, 0.75, 0.25])
  const [lx, ly, lz] = ANCHORS.LANTERN_POST;
  b.add(boxGeo(V(lx - 0.09, ly, lz - 0.09), V(lx + 0.09, ly + 2.32, lz + 0.09), 0), darkWoodMat);
  b.add(boxGeo(V(lx - 0.05, ly + 2.22, lz - 0.05), V(lx + 0.46, ly + 2.32, lz + 0.05), 0), timberMat);
  b.add(boxGeo(V(lx + 0.28, ly + 1.88, lz - 0.11), V(lx + 0.48, ly + 2.18, lz + 0.11), 0), ironMat);

  // 4. Floating water-hyacinth clumps (đám lục bình) tucked beside the pier & bank
  for (const [hx, hz, rx, rz] of [
    [-1.85, -1.35, 0.55, 0.42],
    [-1.55, -0.55, 0.48, 0.38],
    [-2.35, -0.85, 0.62, 0.45],
    [1.82, -1.45, 0.52, 0.40],
    [2.25, -2.15, 0.58, 0.44],
    [1.55, -0.65, 0.45, 0.35],
  ] as const) {
    b.add(boxGeo(V(hx - rx, -0.02, hz - rz), V(hx + rx, 0.06, hz + rz), 0), hyacinthMat);
    b.add(boxGeo(V(hx - rx * 0.65, 0.06, hz - rz * 0.65), V(hx + rx * 0.65, 0.12, hz + rz * 0.65), 0), hyacinthMat);
  }

  // 5. Distant watchman's shack exterior & crooked mangrove trees on the riverbank (z >= 4.2)
  const [sx, sy, sz] = ANCHORS.BANK_SHACK_EXT;
  b.add(boxGeo(V(sx - 2.2, sy, sz - 0.2), V(sx + 2.2, sy + 2.45, sz + 3.2), 1.8), timberMat);
  b.add(boxGeo(V(sx - 2.5, sy + 2.45, sz - 0.45), V(sx + 2.5, sy + 3.05, sz + 3.45), 1.8), roofMat);
  b.add(boxGeo(V(sx - 1.8, sy + 3.05, sz - 0.1), V(sx + 1.8, sy + 3.55, sz + 3.1), 1.8), roofMat);

  addDeadTree(b, darkWoodMat, -6.2, 0.72, 4.2, 5.2, 1.3);
  addDeadTree(b, darkWoodMat, 4.9, 0.72, 4.5, 5.6, 2.7);
  addDeadTree(b, darkWoodMat, 7.2, 0.72, 7.8, 6.0, 3.9);
  addDeadTree(b, darkWoodMat, -7.8, 0.72, 8.4, 5.4, 5.1);

  b.build(group, true);

  // 6. Dynamic moored wooden sampan (xuồng gỗ ba lá) at ANCHORS.SKIFF
  const skiff = new THREE.Group();
  const sb = new Batch();
  // Flat hull bottom + flared side planks + bow/stern blocks (local bow at z = +0.95 towards pier, stern at z = -1.75)
  sb.add(boxGeo(V(-0.42, -0.06, -1.55), V(0.42, 0.04, 0.78), 1.2), deckMat);
  sb.add(boxGeo(V(-0.50, 0.02, -1.45), V(-0.38, 0.28, 0.72), 1.2), timberMat);
  sb.add(boxGeo(V(0.38, 0.02, -1.45), V(0.50, 0.28, 0.72), 1.2), timberMat);
  // Tapered bow (front, z = 0.70..1.02) and stern (back, z = -1.82..-1.45)
  sb.add(boxGeo(V(-0.32, 0.02, 0.68), V(0.32, 0.30, 0.96), 1.0), darkWoodMat);
  sb.add(boxGeo(V(-0.20, 0.06, 0.92), V(0.20, 0.34, 1.12), 1.0), darkWoodMat);
  sb.add(boxGeo(V(-0.32, 0.02, -1.75), V(0.32, 0.30, -1.42), 1.0), darkWoodMat);
  // Cross-benches (thwarts) & bow mooring post
  for (const tz of [-1.05, -0.35, 0.35]) {
    sb.add(boxGeo(V(-0.44, 0.18, tz - 0.11), V(0.44, 0.24, tz + 0.11), 0.8), deckMat);
  }
  sb.add(boxGeo(V(-0.05, 0.28, 0.88), V(0.05, 0.44, 0.98), 0), darkWoodMat);
  // Wooden oar resting along the right gunwale
  sb.add(boxGeo(V(0.24, 0.25, -1.35), V(0.31, 0.30, 0.45), 0.8), darkWoodMat);
  sb.build(skiff, true);
  skiff.position.set(...ANCHORS.SKIFF);
  skiff.rotation.y = -0.18;
  group.add(skiff);

  // 7. Dynamic mooring rope connecting pier bollard to sampan bow post
  const rope = new Strand(10, 0.035, 0.035, ropeMat, 0.5, true, false);
  group.add(rope.mesh);

  // 8. HDR emissive storm lantern bulb & distant shack window
  const lanternMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.6, 0.65), toneMapped: false });
  const lanternBulb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.14), lanternMat);
  lanternBulb.position.set(lx + 0.38, ly + 2.03, lz);
  group.add(lanternBulb);

  const shackWinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.15, 0.48), toneMapped: false });
  const shackWin = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), shackWinMat);
  shackWin.position.set(sx + 0.75, sy + 1.35, sz - 0.22);
  shackWin.rotation.y = Math.PI;
  group.add(shackWin);

  // 9. Animated painted dark river water shader on NOINK layer
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
      fogRange: { value: new THREE.Vector2(12, 125) },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uBoxes: { value: Array.from({ length: 20 }, () => new THREE.Vector4()) },
      uNBox: { value: 0 },
    },
    vertexShader: `varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform sampler2D tNear, tFar;
      uniform float uTime;
      uniform vec3 cNear, cMid, cFar, cCrest, cTrough, cGlint, cShade, cFog, uSun;
      uniform vec2 fogRange;
      uniform vec4 uBoxes[20];
      uniform int uNBox;
      varying vec3 vW;
      void main(){
        float d = length(vW.xz - cameraPosition.xz);
        vec3 col = mix(cNear, cMid, smoothstep(4.0, 22.0, d));
        col = mix(col, cFar, smoothstep(22.0, 95.0, d));
        float fFar = smoothstep(8.0, 32.0, d);
        vec2 flow = vec2(uTime * 0.018, uTime * 0.006);
        vec3 mN = texture2D(tNear, vW.xz / 8.0 + flow).rgb;
        vec3 mF = texture2D(tFar, vW.xz / 34.0 + flow * 0.5).rgb;
        vec3 m = mix(mN * (1.0 - fFar * 0.5), mF, fFar * 0.85) * (1.0 - smoothstep(65.0, 140.0, d));
        col = mix(col, cTrough, clamp(m.g * 0.85, 0.0, 1.0));
        col = mix(col, cCrest, clamp(m.r * 0.85, 0.0, 1.0));
        float sh = 0.0;
        for (int i = 0; i < 20; i++) {
          if (i >= uNBox) break;
          vec4 b = uBoxes[i];
          vec2 d2 = max(abs(vW.xz - b.xy) - b.zw, 0.0);
          sh = max(sh, 1.0 - smoothstep(0.0, 0.75, length(d2)));
        }
        col = mix(col, cShade, sh * 0.85);
        col = mix(col, cGlint, clamp(m.b * (1.0 - sh), 0.0, 1.0));
        col = mix(col, cFog, smoothstep(fogRange.x, fogRange.y, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
    fog: false,
  });

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 260, 1, 1).rotateX(-Math.PI / 2),
    waterMat,
  );
  water.position.set(0, 0, -90);
  water.layers.set(NOINK);
  group.add(water);

  return {
    group,
    waterMat,
    lanternMat,
    shackWinMat,
    skiff,
    rope,
  };
}

export function buildShackEra(): ShackEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("mada_shack_floor", () => ({
    map: rep(planksHD(), 2.5, 2.5),
    color: "#7e6752",
  }));
  const wallMat = lam("mada_shack_wall", () => ({
    map: rep(beamHD(), 2, 2),
    color: "#5e493a",
  }));
  const postMat = lam("mada_shack_post", () => ({
    map: rep(beamHD(), 1, 1),
    color: "#463529",
  }));
  const doorMat = lam("mada_shack_door", () => ({
    map: rep(planksHD(), 1, 1),
    color: "#6b5341",
  }));
  const ironMat = phong("mada_shack_iron", () => ({
    color: "#252a32",
    specular: "#687488",
    shininess: 35,
  }));

  // 1. Dry wooden plank floor (y = 0)
  b.add(boxGeo(V(-3.8, -0.15, -3.4), V(3.8, 0.0, 3.8), 1.8), floorMat);

  // 2. Back timber wall (z = -3.15) & side walls (x = -3.6, +3.6)
  b.add(boxGeo(V(-3.8, 0.0, -3.32), V(3.8, 3.35, -3.12), 2.0), wallMat);
  b.add(boxGeo(V(-3.8, 0.0, -3.32), V(-3.55, 3.35, 3.5), 2.0), wallMat);
  b.add(boxGeo(V(3.55, 0.0, -3.32), V(3.8, 3.35, 3.5), 2.0), wallMat);

  // Wall structural timber posts & ceiling rafters
  for (const px of [-3.48, -1.10, 1.10, 3.48]) {
    b.add(boxGeo(V(px - 0.09, 0.0, -3.14), V(px + 0.09, 3.35, -2.98), 0), postMat);
  }
  b.add(boxGeo(V(-3.75, 2.95, -3.14), V(3.75, 3.15, -2.96), 1.5), postMat);

  // 3. Closed wooden door at ANCHORS.SHACK_DOOR ([0, 0, -3.1]) with heavy wooden crossbar latch (then cửa gỗ)
  const [dx, dy, dz] = ANCHORS.SHACK_DOOR;
  b.add(boxGeo(V(dx - 0.62, dy, dz - 0.03), V(dx + 0.62, dy + 2.25, dz + 0.06), 1.2), doorMat);
  b.add(boxGeo(V(dx - 0.72, dy, dz - 0.04), V(dx - 0.58, dy + 2.34, dz + 0.10), 0), postMat);
  b.add(boxGeo(V(dx + 0.58, dy, dz - 0.04), V(dx + 0.72, dy + 2.34, dz + 0.10), 0), postMat);
  b.add(boxGeo(V(dx - 0.76, dy + 2.24, dz - 0.04), V(dx + 0.76, dy + 2.38, dz + 0.11), 0), postMat);
  // Heavy wooden crossbar latch bolted across the door
  b.add(boxGeo(V(dx - 0.74, dy + 1.08, dz + 0.06), V(dx + 0.74, dy + 1.20, dz + 0.15), 0.8), postMat);
  b.add(boxGeo(V(dx - 0.68, dy + 1.04, dz + 0.05), V(dx - 0.56, dy + 1.24, dz + 0.17), 0), ironMat);
  b.add(boxGeo(V(dx + 0.56, dy + 1.04, dz + 0.05), V(dx + 0.68, dy + 1.24, dz + 0.17), 0), ironMat);

  // 4. Slatted night window on the back-left wall (ANCHORS.SHACK_WINDOW = [-1.75, 1.48, -3.1])
  const [wx, wy, wz] = ANCHORS.SHACK_WINDOW;
  b.add(boxGeo(V(wx - 0.54, wy - 0.54, wz - 0.03), V(wx + 0.54, wy + 0.54, wz + 0.07), 0), postMat);
  for (const sx of [-0.24, 0.0, 0.24]) {
    b.add(boxGeo(V(wx + sx - 0.025, wy - 0.48, wz + 0.03), V(wx + sx + 0.025, wy + 0.48, wz + 0.09), 0), postMat);
  }

  // 5. Wooden table on the right (ANCHORS.SHACK_TABLE = [1.45, 0, -1.35]) holding the oil lamp
  const [tx, ty, tz] = ANCHORS.SHACK_TABLE;
  b.add(boxGeo(V(tx - 0.48, ty + 0.72, tz - 0.38), V(tx + 0.48, ty + 0.79, tz + 0.38), 0.8), doorMat);
  for (const [lx, lz] of [
    [-0.40, -0.30],
    [0.40, -0.30],
    [-0.40, 0.30],
    [0.40, 0.30],
  ] as const) {
    b.add(boxGeo(V(tx + lx - 0.045, ty, tz + lz - 0.045), V(tx + lx + 0.045, ty + 0.72, tz + lz + 0.045), 0), postMat);
  }
  // Oil lamp base & cap on the table
  b.add(boxGeo(V(tx - 0.11, ty + 0.79, tz - 0.11), V(tx + 0.11, ty + 0.88, tz + 0.11), 0), ironMat);
  b.add(boxGeo(V(tx - 0.08, ty + 1.09, tz - 0.08), V(tx + 0.08, ty + 1.14, tz + 0.08), 0), ironMat);

  // 6. Low wooden cot on the far left (x = -3.35..-1.85), leaving the center floor wide open
  b.add(boxGeo(V(-3.45, 0.36, -2.25), V(-1.85, 0.45, -0.35), 1.2), doorMat);
  for (const [cx, cz] of [
    [-3.35, -2.15],
    [-1.95, -2.15],
    [-3.35, -0.45],
    [-1.95, -0.45],
  ] as const) {
    b.add(boxGeo(V(cx - 0.05, 0.0, cz - 0.05), V(cx + 0.05, 0.36, cz + 0.05), 0), postMat);
  }

  b.build(group, true);

  // 7. HDR emissive oil lamp core & slatted window moonlight/blood-moon pane
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.6), toneMapped: false });
  const lampBulb = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.19, 0.11), lampMat);
  lampBulb.position.set(tx, ty + 0.98, tz);
  group.add(lampBulb);

  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.25, 1.85), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), windowMat);
  winPane.position.set(wx, wy, wz + 0.04);
  group.add(winPane);

  return {
    group,
    lampMat,
    windowMat,
  };
}
