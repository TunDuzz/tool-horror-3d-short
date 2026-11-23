// Non-box Gothic Ink-Noir 3D EraGroups for "Ma Xo — Bat Sut Sau Bep Ong Tao":
//   Era 1 ("kitchen"): Old Vietnamese clay Ong Tao hearth, glowing embers, iron pot, recessed ash nook,
//                      animated 3D chipped ceramic bowl, animated 3D cold white rice bowl, barred moonlit window.
//   Era 2 ("hallway"): Main 3-bay timber hall, heavy ironwood threshold door, ancestral altar storm lantern, night window.

import * as THREE from "three";
import {
  Batch,
  NOINK,
  V,
  addDistantRidge,
  addForegroundSilhouette,
  addGnarledTree,
  addReedCluster,
  addStormLantern3D,
  addVolumetricShaft,
  beamHD,
  boxGeo,
  crackedPlasterHD,
  ctex,
  darkPlanksHD,
  lam,
  phong,
  pitchedRoofGeo,
  rep,
  taperedBoxGeo,
} from "../engine";
import { ANCHORS } from "./story";

export type KitchenEra = {
  group: THREE.Group;
  fgSilhouettes: THREE.Group;
  chippedBowl: THREE.Group;
  riceBowl: THREE.Group;
  emberMat: THREE.MeshBasicMaterial;
  tableLampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

export type HallwayEra = {
  group: THREE.Group;
  fgSilhouettes: THREE.Group;
  altarLampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

/** Hand-painted charred wood-ash & soot floor texture (zero plastic look). */
const ashCanvasTex = (key: string) =>
  ctex(key, 512, 512, (g, r) => {
    g.fillStyle = "#565a5c";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 42; i++) {
      const cx = r() * 512, cy = r() * 512, rad = 24 + r() * 88;
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, rad);
      const pale = r() < 0.46;
      gr.addColorStop(0, pale ? "rgba(182,188,184,0.44)" : "rgba(14,14,18,0.56)");
      gr.addColorStop(1, "rgba(20,20,24,0)");
      g.fillStyle = gr;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // Charcoal fleck speckles
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.6 ? "rgba(12,11,15,0.65)" : "rgba(215,220,216,0.35)";
      g.fillRect(r() * 512, r() * 512, 2 + r() * 5, 2 + r() * 4);
    }
  });

/** Hand-painted rustic Vietnamese clay hearth plaster with soot stains. */
const clayHearthTex = (key: string) =>
  ctex(key, 512, 512, (g, r) => {
    g.fillStyle = "#7a6658";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 36; i++) {
      const cx = r() * 512, cy = r() * 512, rad = 30 + r() * 95;
      const gr = g.createRadialGradient(cx, cy, 5, cx, cy, rad);
      gr.addColorStop(0, r() < 0.65 ? "rgba(18,14,14,0.52)" : "rgba(150,126,104,0.28)");
      gr.addColorStop(1, "rgba(18,14,14,0)");
      g.fillStyle = gr;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // Fine clay cracks
    g.strokeStyle = "rgba(14,10,10,0.62)";
    g.lineWidth = 2.0;
    for (let i = 0; i < 18; i++) {
      let x = r() * 512, y = r() * 512;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 38;
        y += (r() - 0.3) * 34;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });

/** Build a realistic 3D Vietnamese antique chipped ceramic bowl using LatheGeometry (origin at base y=0). */
function buildCeramicBowl3D(bowlMat: THREE.Material, interiorMat: THREE.Material, scale = 1.0): THREE.Group {
  const grp = new THREE.Group();
  // Classic flared Vietnamese eating bowl profile (outer shell)
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.068, 0.0),
    new THREE.Vector2(0.072, 0.018),
    new THREE.Vector2(0.115, 0.048),
    new THREE.Vector2(0.145, 0.095),
    new THREE.Vector2(0.156, 0.128),
    new THREE.Vector2(0.144, 0.128),
    new THREE.Vector2(0.132, 0.092),
    new THREE.Vector2(0.095, 0.046),
    new THREE.Vector2(0.055, 0.022),
    new THREE.Vector2(0.0, 0.022),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  const mesh = new THREE.Mesh(geo, bowlMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  grp.add(mesh);

  // Subtle dark glaze crack accent tucked flush on the rim (no sticking-out peg!)
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.008), interiorMat);
  crack.position.set(0.146, 0.112, 0.0);
  grp.add(crack);

  grp.scale.setScalar(scale);
  return grp;
}

/** Build the gleaming white cold rice bowl + heaped white rice mound + wooden chopsticks for Shot 10! */
function buildColdRiceBowl3D(): THREE.Group {
  const grp = new THREE.Group();
  const whiteCeramic = phong("mx_white_ceramic", () => ({ color: "#c8c4b8", specular: "#dcd8cc", shininess: 28 }));
  const blueRim = lam("mx_blue_rim", () => ({ color: "#3b526b" }));
  const riceMat = lam("mx_rice_mound", () => ({ color: "#d8d5c8" }));
  const chopstickMat = lam("mx_chopstick", () => ({ color: "#4e3926" }));

  const bowl = buildCeramicBowl3D(whiteCeramic, blueRim, 1.18);
  grp.add(bowl);

  // Decorative blue antique band around rim
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.008, 6, 20), blueRim);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.126;
  grp.add(band);

  // Heaped white cooked rice dome
  const riceGeo = new THREE.SphereGeometry(0.148, 16, 12);
  riceGeo.scale(1.0, 0.56, 1.0);
  const rice = new THREE.Mesh(riceGeo, riceMat);
  rice.position.y = 0.124;
  rice.castShadow = true;
  grp.add(rice);

  // Pair of dark bamboo chopsticks resting diagonally across the rim
  for (const off of [-0.014, 0.014]) {
    const cs = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.34, 6), chopstickMat);
    cs.rotation.z = Math.PI / 2;
    cs.rotation.y = 0.22 + off * 2.5;
    cs.position.set(0.01, 0.174, off);
    grp.add(cs);
  }
  return grp;
}

export function buildKitchenEra(): KitchenEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("mx_kit_floor", () => ({ map: rep(darkPlanksHD("mx_kfloor_tex", ["#4c3c31", "#403228", "#554437"]), 2.8, 2.8), color: "#766454" }));
  const wallMat = lam("mx_kit_wall", () => ({
    map: rep(crackedPlasterHD("mx_kplaster_tex", "#6f665c"), 2.4, 1.6),
    color: "#766c62",
  }));
  const darkWoodMat = lam("mx_kit_darkwood", () => ({ map: rep(beamHD(), 1.2, 2.0), color: "#3b2c22" }));
  const timberMat = lam("mx_kit_timber", () => ({ map: rep(beamHD(), 1.5, 1.5), color: "#544134" }));
  const clayMat = lam("mx_clay_hearth", () => ({ map: rep(clayHearthTex("mx_clay_tex"), 1.6, 1.4), color: "#8c7666" }));
  const sootMat = lam("mx_soot_void", () => ({ color: "#09080c" }));
  const ashMat = lam("mx_ash_mound", () => ({ map: rep(ashCanvasTex("mx_ash_tex"), 1.4, 1.4), color: "#a4aaa6" }));
  const ironMat = phong("mx_kit_iron", () => ({ color: "#20242c", specular: "#78889e", shininess: 46 }));
  const reedMat = lam("mx_kit_reed", () => ({ color: "#1c2824" }));
  const ridgeMat = lam("mx_kit_ridge", () => ({ color: "#121a28" }));

  // 1. Kitchen floor, lime-plaster walls (with window cutout left), crooked timber pillars & overhead rafters
  b.add(boxGeo(V(-4.0, -0.15, -4.4), V(4.0, 0.0, 4.8), 2.0), floorMat);
  // Back wall left/right/top/bottom around window [-2.45, 1.56, -4.12]
  b.add(boxGeo(V(-4.0, 0.0, -4.28), V(-3.10, 3.6, -4.08), 1.6), wallMat);
  b.add(boxGeo(V(-1.80, 0.0, -4.28), V(4.0, 3.6, -4.08), 2.0), wallMat);
  b.add(boxGeo(V(-3.10, 0.0, -4.28), V(-1.80, 0.92, -4.08), 1.4), wallMat);
  b.add(boxGeo(V(-3.10, 2.20, -4.28), V(-1.80, 3.6, -4.08), 1.4), wallMat);
  // Side & rear enclosing walls
  b.add(boxGeo(V(-4.08, 0.0, -4.3), V(-3.84, 3.6, 4.8), 2.0), wallMat);
  b.add(boxGeo(V(3.84, 0.0, -4.3), V(4.08, 3.6, 4.8), 2.0), wallMat);
  b.add(boxGeo(V(-4.0, 0.0, 4.6), V(4.0, 3.6, 4.85), 2.0), wallMat);

  // Structural crooked timber posts & ceiling rafters
  for (const px of [-3.72, -1.55, 1.38, 3.72]) {
    b.add(taperedBoxGeo(V(px - 0.11, 0.0, -4.06), V(px + 0.11, 3.55, -3.84), 0.88, 0.88, px < 0 ? 0.03 : -0.03, 0), darkWoodMat);
  }
  for (const rz of [-3.3, -1.7, -0.1, 1.5, 3.1]) {
    b.add(boxGeo(V(-3.95, 3.12, rz - 0.09), V(3.95, 3.34, rz + 0.09), 1.5), darkWoodMat);
  }
  b.add(pitchedRoofGeo(0.0, 3.35, 0.2, 9.0, 10.0, 1.65, 0.14, 0.05, 1.8), darkWoodMat);

  // 2. Barred kitchen night window + exterior gnarled trees & distant ridge
  const [wx, wy, wz] = ANCHORS.KITCHEN_WINDOW;
  b.add(boxGeo(V(wx - 0.68, wy - 0.68, wz - 0.04), V(wx + 0.68, wy - 0.56, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx - 0.68, wy + 0.56, wz - 0.04), V(wx + 0.68, wy + 0.68, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx - 0.68, wy - 0.68, wz - 0.04), V(wx - 0.56, wy + 0.68, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx + 0.56, wy - 0.68, wz - 0.04), V(wx + 0.68, wy + 0.68, wz + 0.12), 0), timberMat);
  for (const sx of [-0.30, 0.0, 0.30]) {
    b.add(taperedBoxGeo(V(wx + sx - 0.025, wy - 0.58, wz + 0.01), V(wx + sx + 0.025, wy + 0.58, wz + 0.07), 0.9, 0.9), darkWoodMat);
  }
  addGnarledTree(b, darkWoodMat, -2.75, -0.2, -6.2, 4.5, 3.0, 0.35, 0.1);
  addReedCluster(b, reedMat, -2.1, -0.1, -5.6, 11, 1.5, 29, 0.5);
  addDistantRidge(b, ridgeMat, -26.0, 75, -0.3, 6.8, 23);

  // 3. HERO PROP: Traditional Vietnamese Clay Ông Táo Wood-Burning Hearth (left-center)
  const [hx, hy, hz] = ANCHORS.HEARTH;
  // Left & right clay walls + top slab leaving a recessed central firebox opening facing +Z!
  b.add(taperedBoxGeo(V(hx - 0.82, hy, hz - 0.44), V(hx - 0.28, hy + 0.78, hz + 0.44), 0.96, 0.96, -0.02, 0, 1.4), clayMat);
  b.add(taperedBoxGeo(V(hx + 0.28, hy, hz - 0.44), V(hx + 0.82, hy + 0.78, hz + 0.44), 0.96, 0.96, 0.02, 0, 1.4), clayMat);
  b.add(boxGeo(V(hx - 0.86, hy + 0.50, hz - 0.46), V(hx + 0.86, hy + 0.78, hz + 0.46), 1.4), clayMat);
  b.add(boxGeo(V(hx - 0.32, hy, hz - 0.44), V(hx + 0.32, hy + 0.52, hz - 0.24), 1.0), sootMat);
  // Charred firewood sticks sticking slightly out of firebox
  for (const [fx, fy, fz, ry] of [[-0.08, 0.09, 0.18, 0.22], [0.10, 0.08, 0.20, -0.28]] as const) {
    b.add(new THREE.CylinderGeometry(0.036, 0.044, 0.52, 7), darkWoodMat, new THREE.Matrix4().compose(
      V(hx + fx, hy + fy, hz + fz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.08, ry, 0)),
      V(1, 1, 1),
    ));
  }
  // Round cast-iron Vietnamese cooking pot + domed lid resting atop the hearth
  b.add(new THREE.CylinderGeometry(0.32, 0.26, 0.24, 14), ironMat, new THREE.Matrix4().makeTranslation(hx, hy + 0.90, hz));
  const lidGeo = new THREE.SphereGeometry(0.30, 14, 8);
  lidGeo.scale(1.0, 0.28, 1.0);
  b.add(lidGeo, ironMat, new THREE.Matrix4().makeTranslation(hx, hy + 1.03, hz));
  b.add(new THREE.SphereGeometry(0.036, 8, 6), ironMat, new THREE.Matrix4().makeTranslation(hx, hy + 1.13, hz));
  // Small rustic Ông Táo wooden shelf & ceramic incense cup on back wall above hearth
  b.add(boxGeo(V(hx - 0.52, hy + 1.54, hz - 0.64), V(hx + 0.52, hy + 1.62, hz - 0.34), 1.0), darkWoodMat);
  b.add(new THREE.CylinderGeometry(0.075, 0.06, 0.13, 10), clayMat, new THREE.Matrix4().makeTranslation(hx, hy + 1.69, hz - 0.48));

  // 4. THE HAUNTED DARK NOOK (right of hearth: x = +0.28..+1.36, z = -4.06..-2.95)
  const [nx, ny, nz] = ANCHORS.NOOK;
  // Dark soot-stained shadow partition & low overhang darkening the deep recess behind the hearth
  b.add(boxGeo(V(nx - 0.50, ny, nz - 0.68), V(nx + 0.58, ny + 1.85, nz - 0.56), 0), sootMat);
  b.add(boxGeo(V(nx + 0.46, ny, nz - 0.66), V(nx + 0.62, ny + 1.85, nz + 0.24), 0), darkWoodMat);
  b.add(boxGeo(V(nx - 0.52, ny + 1.72, nz - 0.68), V(nx + 0.64, ny + 1.88, nz + 0.26), 1.0), darkWoodMat);
  // Smooth flat matte wood-ash bed carpeting the nook floor (y = 0..0.016, zero pole pinch, cleanly below footprints decal!)
  const ashGeo = new THREE.CylinderGeometry(0.46, 0.54, 0.016, 24);
  b.add(ashGeo, ashMat, new THREE.Matrix4().makeTranslation(nx, ny + 0.008, nz + 0.04));

  // 5. Rustic side table on far right holding warm 3D storm lantern
  const [tx, ty, tz] = ANCHORS.KITCHEN_TABLE;
  b.add(boxGeo(V(tx - 0.58, ty + 0.84, tz - 0.36), V(tx + 0.58, ty + 0.92, tz + 0.36), 1.0), timberMat);
  for (const [lx, lz] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]] as const) {
    b.add(taperedBoxGeo(V(tx + lx - 0.05, ty, tz + lz - 0.05), V(tx + lx + 0.05, ty + 0.84, tz + lz + 0.05), 0.84, 0.84), darkWoodMat);
  }
  const tableLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.55, 0.65), toneMapped: false });
  addStormLantern3D(b, ironMat, tableLampMat, group, tx - 0.16, ty + 1.12, tz + 0.04, 0.95);

  b.build(group, true);

  // 6. HDR glowing red-orange ember bed inside firebox opening
  const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.82, 0.24), toneMapped: false });
  const emberGeo = new THREE.SphereGeometry(0.24, 12, 8);
  emberGeo.scale(1.1, 0.34, 0.85);
  const emberMesh = new THREE.Mesh(emberGeo, emberMat);
  emberMesh.position.set(hx, hy + 0.06, hz + 0.02);
  emberMesh.layers.set(NOINK);
  group.add(emberMesh);

  // 7. Animated Hero Prop P01: 3D Chipped Ceramic Bowl (matte antique rustic stoneware glaze, flips upside-down <-> upright!)
  const chippedBowlMat = phong("mx_chipped_bowl", () => ({ color: "#807a6e", specular: "#afa898", shininess: 22 }));
  const chippedDarkMat = lam("mx_chipped_dark", () => ({ color: "#2b2a2c" }));
  const chippedBowl = buildCeramicBowl3D(chippedBowlMat, chippedDarkMat, 1.18);
  chippedBowl.position.set(nx, ny + 0.16, nz + 0.10);
  chippedBowl.rotation.x = Math.PI; // upside-down initially
  group.add(chippedBowl);

  // 8. Animated Hero Prop P04: Gleaming White Cold Rice Bowl (Shot 10 open-ending ritual!)
  const riceBowl = buildColdRiceBowl3D();
  riceBowl.position.set(0.42, 0.01, -2.55);
  riceBowl.visible = false;
  group.add(riceBowl);

  // 9. HDR moonlight window pane + diagonal light shaft
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.38, 1.78, 2.45), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 1.22), windowMat);
  winPane.position.set(wx, wy, wz - 0.03);
  winPane.layers.set(NOINK);
  group.add(winPane);
  const shaft = addVolumetricShaft(group, [wx + 0.95, wy - 0.35, wz + 1.55], [0.48, 0.22, -0.42], 5.6, 0.55, 1.55, "#94bcf6", 0.14);

  // 10. Foreground silhouette ceiling rafters (toggled ON only for Wide Shot 1)
  const fgSilhouettes = new THREE.Group();
  addForegroundSilhouette(fgSilhouettes, -2.25, 2.55, 1.05, 1.15, 11, -1);
  addForegroundSilhouette(fgSilhouettes, 2.15, 2.60, 1.95, 1.05, 27, 1);
  group.add(fgSilhouettes);

  return { group, fgSilhouettes, chippedBowl, riceBowl, emberMat, tableLampMat, windowMat, shaftMat: shaft.mat };
}

export function buildHallwayEra(): HallwayEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("mx_hall_floor", () => ({ map: rep(darkPlanksHD("mx_hfloor_tex"), 2.6, 2.6), color: "#786452" }));
  const wallMat = lam("mx_hall_wall", () => ({ map: rep(crackedPlasterHD("mx_hwall_tex", "#6e655c"), 2.4, 1.6), color: "#72685e" }));
  const darkWoodMat = lam("mx_hall_dark", () => ({ map: rep(beamHD(), 1.2, 2.0), color: "#3d2e24" }));
  const doorMat = lam("mx_hall_door", () => ({ map: rep(darkPlanksHD("mx_hdoor_tex"), 1.2, 1.4), color: "#68503e" }));
  const ironMat = phong("mx_hall_iron", () => ({ color: "#20242c", specular: "#7c8ca2", shininess: 44 }));
  const reedMat = lam("mx_hall_reed", () => ({ color: "#1c2824" }));
  const ridgeMat = lam("mx_hall_ridge", () => ({ color: "#121a28" }));

  // 1. Timber floor, enclosing walls with window cutout left, posts & rafters
  b.add(boxGeo(V(-3.9, -0.15, -4.1), V(3.9, 0.0, 4.4), 2.0), floorMat);
  b.add(boxGeo(V(-3.9, 0.0, -4.05), V(-2.72, 3.55, -3.85), 1.6), wallMat);
  b.add(boxGeo(V(-1.48, 0.0, -4.05), V(3.9, 3.55, -3.85), 2.0), wallMat);
  b.add(boxGeo(V(-2.72, 0.0, -4.05), V(-1.48, 0.96, -3.85), 1.4), wallMat);
  b.add(boxGeo(V(-2.72, 2.20, -4.05), V(-1.48, 3.55, -3.85), 1.4), wallMat);
  b.add(boxGeo(V(-3.95, 0.0, -4.1), V(-3.75, 3.55, 4.4), 2.0), wallMat);
  b.add(boxGeo(V(3.75, 0.0, -4.1), V(3.95, 3.55, 4.4), 2.0), wallMat);
  b.add(boxGeo(V(-3.9, 0.0, 4.2), V(3.9, 3.55, 4.45), 2.0), wallMat);

  for (const px of [-3.65, -1.30, 1.30, 3.65]) {
    b.add(taperedBoxGeo(V(px - 0.11, 0.0, -3.84), V(px + 0.11, 3.50, -3.62), 0.88, 0.88, px < 0 ? 0.025 : -0.025, 0), darkWoodMat);
  }
  for (const rz of [-3.0, -1.4, 0.2, 1.8, 3.2]) {
    b.add(boxGeo(V(-3.85, 3.08, rz - 0.09), V(3.85, 3.28, rz + 0.09), 1.5), darkWoodMat);
  }
  b.add(pitchedRoofGeo(0.0, 3.30, 0.1, 8.8, 9.6, 1.6, 0.14, 0.05, 1.8), darkWoodMat);

  // 2. Heavy ironwood double front door + raised wooden threshold beam (ngưỡng cửa gỗ lim)
  const [dx, dy, dz] = ANCHORS.FRONT_DOOR;
  b.add(boxGeo(V(dx - 0.88, dy, dz - 0.06), V(dx + 0.88, dy + 0.14, dz + 0.18), 0.8), darkWoodMat);
  b.add(boxGeo(V(dx - 0.84, dy + 0.14, dz - 0.04), V(dx - 0.02, dy + 2.34, dz + 0.05), 1.2), doorMat);
  b.add(boxGeo(V(dx + 0.02, dy + 0.14, dz - 0.04), V(dx + 0.84, dy + 2.34, dz + 0.05), 1.2), doorMat);
  b.add(boxGeo(V(dx - 0.96, dy, dz - 0.05), V(dx - 0.82, dy + 2.44, dz + 0.12), 0), darkWoodMat);
  b.add(boxGeo(V(dx + 0.82, dy, dz - 0.05), V(dx + 0.96, dy + 2.44, dz + 0.12), 0), darkWoodMat);
  b.add(boxGeo(V(dx - 1.00, dy + 2.32, dz - 0.06), V(dx + 1.00, dy + 2.48, dz + 0.14), 0), darkWoodMat);
  // Iron ring door handles
  b.add(new THREE.TorusGeometry(0.055, 0.012, 6, 12), ironMat, new THREE.Matrix4().makeTranslation(dx - 0.14, dy + 1.15, dz + 0.08));
  b.add(new THREE.TorusGeometry(0.055, 0.012, 6, 12), ironMat, new THREE.Matrix4().makeTranslation(dx + 0.14, dy + 1.15, dz + 0.08));

  // 3. Slatted night window left + exterior garden silhouette
  const [wx, wy, wz] = ANCHORS.HALL_WINDOW;
  b.add(boxGeo(V(wx - 0.62, wy - 0.62, wz - 0.04), V(wx + 0.62, wy - 0.52, wz + 0.10), 0), darkWoodMat);
  b.add(boxGeo(V(wx - 0.62, wy + 0.52, wz - 0.04), V(wx + 0.62, wy + 0.62, wz + 0.10), 0), darkWoodMat);
  b.add(boxGeo(V(wx - 0.62, wy - 0.62, wz - 0.04), V(wx - 0.52, wy + 0.62, wz + 0.10), 0), darkWoodMat);
  b.add(boxGeo(V(wx + 0.52, wy - 0.62, wz - 0.04), V(wx + 0.62, wy + 0.62, wz + 0.10), 0), darkWoodMat);
  for (const sx of [-0.26, 0.0, 0.26]) {
    b.add(taperedBoxGeo(V(wx + sx - 0.025, wy - 0.54, wz + 0.01), V(wx + sx + 0.025, wy + 0.54, wz + 0.07), 0.9, 0.9), darkWoodMat);
  }
  addGnarledTree(b, darkWoodMat, -2.4, -0.2, -5.8, 4.4, 3.0, 0.35, 0.15);
  addReedCluster(b, reedMat, -1.8, -0.1, -5.2, 10, 1.4, 33, 0.45);
  addDistantRidge(b, ridgeMat, -25.0, 72, -0.3, 6.5, 19);

  // 4. Ancestral side altar table on right holding warm 3D storm lantern
  const [ax, ay, az] = ANCHORS.HALL_ALTAR;
  b.add(boxGeo(V(ax - 0.60, ay + 0.90, az - 0.36), V(ax + 0.60, ay + 0.98, az + 0.36), 1.0), doorMat);
  for (const [lx, lz] of [[-0.50, -0.28], [0.50, -0.28], [-0.50, 0.28], [0.50, 0.28]] as const) {
    b.add(taperedBoxGeo(V(ax + lx - 0.05, ay, az + lz - 0.05), V(ax + lx + 0.05, ay + 0.90, az + lz + 0.05), 0.85, 0.85), darkWoodMat);
  }
  const altarLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.7, 1.65, 0.72), toneMapped: false });
  addStormLantern3D(b, ironMat, altarLampMat, group, ax - 0.16, ay + 1.18, az + 0.04, 0.98);

  b.build(group, true);

  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.42, 1.82, 2.48), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.12), windowMat);
  winPane.position.set(wx, wy, wz - 0.03);
  winPane.layers.set(NOINK);
  group.add(winPane);
  const shaft = addVolumetricShaft(group, [wx + 0.88, wy - 0.35, wz + 1.45], [0.46, 0.22, -0.44], 5.2, 0.50, 1.45, "#96bef6", 0.14);

  const fgSilhouettes = new THREE.Group();
  addForegroundSilhouette(fgSilhouettes, -2.35, 2.50, 0.95, 1.12, 13, -1);
  addForegroundSilhouette(fgSilhouettes, 2.05, 2.55, 1.85, 1.05, 31, 1);
  group.add(fgSilhouettes);

  return { group, fgSilhouettes, altarLampMat, windowMat, shaftMat: shaft.mat };
}
