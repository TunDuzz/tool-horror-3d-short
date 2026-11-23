// Isolated Gothic Ink-Noir 3D EraGroups for "Ong Ke":
// 1. HallEra: Old Vietnamese 3-bay dark timber hall, crooked antique wooden double-door wardrobe with
//    ANIMATED 3D hinged doors, animated 3D muddy burlap sack corner, rustic altar + 3D storm lantern,
//    barred rain window with exterior gnarled branches + distant ridge, volumetric moonlight shaft, and fgSilhouettes.
// 2. BedroomEra: Claustrophobic inner wooden room, heavy timber door + ANIMATED 3D wooden crossbar latch,
//    slatted night window, carved 4-post wooden bed with open pitch-black under-bed cavity + 3D muddy burlap sack
//    on the rumpled quilt, and bedside wooden stool + real 3D oil lamp.

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
  mudBankHD,
  phong,
  pitchedRoofGeo,
  rep,
  taperedBoxGeo,
} from "../engine";
import { ANCHORS } from "./story";

export type HallEra = {
  group: THREE.Group;
  fgSilhouettes: THREE.Group;
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
  sackCorner: THREE.Group;
  altarLampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

export type BedroomEra = {
  group: THREE.Group;
  doorCrossbar: THREE.Mesh;
  bedSack: THREE.Group;
  lampMat: THREE.MeshBasicMaterial;
  windowMat: THREE.MeshBasicMaterial;
  shaftMat: THREE.ShaderMaterial;
};

/** Hand-painted coarse woven jute burlap texture with dark damp mud stains & frayed patches (NO wood planks!). */
const burlapCanvasTex = (key: string) =>
  ctex(key, 512, 512, (g, r) => {
    g.fillStyle = "#8a7456";
    g.fillRect(0, 0, 512, 512);
    // Coarse cross-woven jute warp & weft threads
    for (let y = 0; y < 512; y += 6) {
      g.fillStyle = y % 12 === 0 ? "rgba(42,30,18,0.26)" : "rgba(195,172,135,0.14)";
      g.fillRect(0, y, 512, 3);
    }
    for (let x = 0; x < 512; x += 6) {
      g.fillStyle = x % 12 === 0 ? "rgba(38,26,16,0.24)" : "rgba(190,168,132,0.12)";
      g.fillRect(x, 0, 3, 512);
    }
    // Organic soaked wet mud stains & dark creases
    for (let i = 0; i < 28; i++) {
      const cx = r() * 512, cy = r() * 512, rad = 28 + r() * 78;
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, rad);
      const dark = r() < 0.78;
      gr.addColorStop(0, dark ? "rgba(18,14,12,0.62)" : "rgba(170,148,118,0.22)");
      gr.addColorStop(1, "rgba(18,14,12,0)");
      g.fillStyle = gr;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // Stitched seam & tattered snags
    g.strokeStyle = "rgba(16,12,10,0.68)";
    g.lineWidth = 2.5;
    for (let i = 0; i < 14; i++) {
      const sx = r() * 512, sy = r() * 512;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (r() - 0.5) * 44, sy + (r() - 0.5) * 44);
      g.stroke();
    }
  });

/** Build a soft, slumped, woven 3D burlap sack tied with hemp rope & ruffled closed cloth knot (zero flat cylinder cap!). */
function buildBurlapSack3D(sackMat: THREE.Material, ropeMat: THREE.Material): THREE.Group {
  const grp = new THREE.Group();
  const b = new Batch();
  // Smooth organic slumped stuffed cloth body (asymmetric sag + soft creases)
  const bodyGeo = new THREE.SphereGeometry(0.32, 18, 14);
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * 1.38;
    let y = pos.getY(i) * 0.74;
    let z = pos.getZ(i) * 0.92;
    if (y < -0.12) y = -0.14 + (y + 0.12) * 0.22; // flat slumped underside
    // Asymmetric bulge toward heavy bottom-right corner + cloth folds
    const lump = 1 + 0.12 * Math.sin(x * 7.5 + z * 5.2) + 0.06 * Math.cos(y * 10.0 - x * 6.5);
    const taper = x < -0.12 ? 1.0 - Math.min(0.45, (-0.12 - x) * 1.15) : 1.0;
    pos.setXYZ(i, x * lump, y * taper + 0.16, z * lump * taper);
  }
  bodyGeo.computeVertexNormals();
  b.add(bodyGeo, sackMat);

  // Tightly cinched hemp rope collar around the gathered neck
  const ropeM = new THREE.Matrix4().compose(
    V(-0.38, 0.18, 0.01),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.08, 1.42)),
    V(1, 1, 1),
  );
  b.add(new THREE.TorusGeometry(0.072, 0.018, 6, 12), ropeMat, ropeM);

  // Closed ruffled cloth ears/frill tied beyond the rope (3 organic folded lobes — no flat circular cap!)
  for (const [ox, oy, oz, rx, ry, rz, sx, sy, sz] of [
    [-0.47, 0.22, 0.03, 0.25, 0.2, 0.4, 0.11, 0.06, 0.08],
    [-0.48, 0.16, -0.04, -0.30, -0.15, -0.25, 0.11, 0.055, 0.085],
    [-0.46, 0.19, 0.01, 0.10, 0.45, 0.15, 0.095, 0.07, 0.07],
  ] as const) {
    const m = new THREE.Matrix4().compose(
      V(ox, oy, oz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      V(sx, sy, sz),
    );
    b.add(new THREE.SphereGeometry(1.0, 10, 8), sackMat, m);
  }

  b.build(grp, true);
  return grp;
}

export function buildHallEra(): HallEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("ok_hall_floor", () => ({ map: rep(darkPlanksHD("ok_floor_tex"), 2.8, 2.8), color: "#766250" }));
  const wallMat = lam("ok_hall_wall", () => ({
    map: rep(crackedPlasterHD("ok_plaster_tex", "#6d655d"), 2.6, 1.6),
    color: "#72685f",
  }));
  const timberMat = lam("ok_hall_timber", () => ({ map: rep(beamHD(), 1.5, 1.5), color: "#544134" }));
  const darkWoodMat = lam("ok_hall_darkwood", () => ({ map: rep(beamHD(), 1, 2), color: "#3b2c23" }));
  const wardMat = lam("ok_wardrobe_wood", () => ({
    map: rep(darkPlanksHD("ok_ward_tex", ["#4f3a2c", "#423024", "#5a4333"]), 1.4, 1.6),
    color: "#6a5242",
  }));
  const ironMat = phong("ok_hall_iron", () => ({ color: "#222630", specular: "#7c8ca4", shininess: 46 }));
  const sackMat = lam("ok_burlap_weave", () => ({
    map: rep(burlapCanvasTex("ok_burlap_weave_tex"), 2, 2),
    color: "#988264",
  }));
  const ropeMat = lam("ok_rope", () => ({ color: "#58442c" }));
  const ridgeMat = lam("ok_ridge", () => ({ color: "#1a2535" }));
  const reedMat = lam("ok_reed", () => ({ color: "#222e25" }));

  // 1. Timber plank floor & enclosing walls of old 3-bay house (y = 0)
  b.add(boxGeo(V(-4.4, -0.18, -4.4), V(4.4, 0.0, 5.0), 2.0), floorMat);
  // Back wall (with cutout space behind slatted window)
  b.add(boxGeo(V(-4.4, 0.0, -4.32), V(-2.90, 3.6, -4.08), 2.0), wallMat);
  b.add(boxGeo(V(-1.60, 0.0, -4.32), V(4.4, 3.6, -4.08), 2.0), wallMat);
  b.add(boxGeo(V(-2.90, 0.0, -4.32), V(-1.60, 0.96, -4.08), 1.6), wallMat);
  b.add(boxGeo(V(-2.90, 2.26, -4.32), V(-1.60, 3.6, -4.08), 1.6), wallMat);
  // Left, right & rear corridor walls
  b.add(boxGeo(V(-4.15, 0.0, -4.32), V(-3.88, 3.6, 5.0), 2.0), wallMat);
  b.add(boxGeo(V(3.88, 0.0, -4.32), V(4.15, 3.6, 5.0), 2.0), wallMat);
  b.add(boxGeo(V(-4.4, 0.0, 4.68), V(-0.78, 3.6, 4.95), 2.0), wallMat);
  b.add(boxGeo(V(0.78, 0.0, 4.68), V(4.4, 3.6, 4.95), 2.0), wallMat);
  b.add(boxGeo(V(-0.78, 2.28, 4.68), V(0.78, 3.6, 4.95), 1.6), wallMat);

  // Dark timber structural pillars (tapered, slightly crooked) + wainscoting + overhead trusses/rafters
  for (const px of [-3.72, -1.45, 1.45, 3.72]) {
    b.add(taperedBoxGeo(V(px - 0.11, 0.0, -4.08), V(px + 0.11, 3.55, -3.86), 0.88, 0.88, px < 0 ? 0.03 : -0.03, 0), darkWoodMat);
  }
  for (const rz of [-3.4, -1.8, -0.2, 1.4, 3.0]) {
    b.add(boxGeo(V(-4.0, 3.12, rz - 0.09), V(4.0, 3.34, rz + 0.09), 1.5), darkWoodMat);
  }
  // Pitched overhead timber roof shell
  b.add(pitchedRoofGeo(0.0, 3.35, 0.3, 9.2, 10.0, 1.65, 0.14, 0.05, 1.8), darkWoodMat);

  // 2. Barred storm window on back-left wall + exterior gnarled trees & distant treeline ridge visible outside!
  const [wx, wy, wz] = ANCHORS.HALL_WINDOW;
  b.add(boxGeo(V(wx - 0.68, wy - 0.68, wz - 0.04), V(wx + 0.68, wy - 0.56, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx - 0.68, wy + 0.56, wz - 0.04), V(wx + 0.68, wy + 0.68, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx - 0.68, wy - 0.68, wz - 0.04), V(wx - 0.56, wy + 0.68, wz + 0.12), 0), timberMat);
  b.add(boxGeo(V(wx + 0.56, wy - 0.68, wz - 0.04), V(wx + 0.68, wy + 0.68, wz + 0.12), 0), timberMat);
  for (const sx of [-0.30, 0.0, 0.30]) {
    b.add(taperedBoxGeo(V(wx + sx - 0.026, wy - 0.58, wz + 0.01), V(wx + sx + 0.026, wy + 0.58, wz + 0.07), 0.9, 0.9), darkWoodMat);
  }
  // Exterior night garden & ridge seen through the window
  addGnarledTree(b, darkWoodMat, -2.55, -0.2, -6.2, 4.6, 3.1, 0.35, 0.1);
  addReedCluster(b, reedMat, -1.9, -0.1, -5.6, 12, 1.5, 19, 0.5);
  addDistantRidge(b, ridgeMat, -26.0, 75, -0.3, 6.8, 17);

  // 3. HERO PROP: Tall crooked antique wooden wardrobe (carcass + dark interior cavity + gable pediment crest!)
  const [kx, ky, kz] = ANCHORS.WARDROBE;
  const wW = 1.62, wH = 2.48, wD = 0.72;
  // Back panel, left & right sides, top & bottom plinth (leaving front open for animated 3D hinged doors!)
  b.add(boxGeo(V(kx - wW / 2, ky + 0.10, kz - wD / 2), V(kx + wW / 2, ky + wH, kz - wD / 2 + 0.06), 1.4), darkWoodMat);
  b.add(taperedBoxGeo(V(kx - wW / 2, ky + 0.10, kz - wD / 2), V(kx - wW / 2 + 0.08, ky + wH, kz + wD / 2), 1.0, 1.0, -0.04, 0, 1.4), wardMat);
  b.add(taperedBoxGeo(V(kx + wW / 2 - 0.08, ky + 0.10, kz - wD / 2), V(kx + wW / 2, ky + wH, kz + wD / 2), 1.0, 1.0, 0.04, 0, 1.4), wardMat);
  b.add(boxGeo(V(kx - wW / 2 - 0.04, ky, kz - wD / 2 - 0.02), V(kx + wW / 2 + 0.04, ky + 0.14, kz + wD / 2 + 0.03), 1.2), darkWoodMat);
  b.add(boxGeo(V(kx - wW / 2 - 0.08, ky + wH - 0.10, kz - wD / 2 - 0.04), V(kx + wW / 2 + 0.08, ky + wH + 0.04, kz + wD / 2 + 0.06), 1.4), darkWoodMat);
  // Pitched Gothic crown pediment atop the wardrobe
  b.add(pitchedRoofGeo(kx, ky + wH + 0.04, kz, wW + 0.22, wD + 0.16, 0.34, 0.06, -0.03, 1.2), darkWoodMat);
  // Hanging rail inside dark wardrobe cavity
  b.add(new THREE.CylinderGeometry(0.018, 0.018, wW - 0.22, 6), ironMat, new THREE.Matrix4().compose(
    V(kx, ky + 2.08, kz),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
    V(1, 1, 1),
  ));

  // 4. Rustic side altar / table on right wall with real 3D storm lantern beacon
  const [ax, ay, az] = ANCHORS.ALTAR;
  b.add(boxGeo(V(ax - 0.62, ay + 0.88, az - 0.36), V(ax + 0.62, ay + 0.96, az + 0.36), 1.0), wardMat);
  for (const [lx, lz] of [[-0.52, -0.28], [0.52, -0.28], [-0.52, 0.28], [0.52, 0.28]] as const) {
    b.add(taperedBoxGeo(V(ax + lx - 0.05, ay, az + lz - 0.05), V(ax + lx + 0.05, ay + 0.88, az + lz + 0.05), 0.84, 0.84), darkWoodMat);
  }
  const altarLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.55, 0.62), toneMapped: false });
  addStormLantern3D(b, ironMat, altarLampMat, group, ax - 0.18, ay + 1.14, az + 0.04, 0.96);

  // 5. Rear bedroom exit doorframe (visible in Reverse Shot 8)
  const [ex, ey, ez] = ANCHORS.HALL_EXIT_DOOR;
  b.add(boxGeo(V(ex - 0.82, ey, ez - 0.08), V(ex - 0.68, ey + 2.32, ez + 0.14), 0), darkWoodMat);
  b.add(boxGeo(V(ex + 0.68, ey, ez - 0.08), V(ex + 0.82, ey + 2.32, ez + 0.14), 0), darkWoodMat);
  b.add(boxGeo(V(ex - 0.86, ey + 2.24, ez - 0.08), V(ex + 0.86, ey + 2.40, ez + 0.16), 0), darkWoodMat);

  b.build(group, true);

  // 6. ANIMATED 3D HINGED WARDROBE DOORS (pivot at outer left/right edges so they swing wide cleanly!)
  const doorH = wH - 0.24;
  const doorW = wW * 0.5 - 0.085;
  const makeDoorPanel = (side: -1 | 1) => {
    const piv = new THREE.Group();
    piv.position.set(kx + side * (wW * 0.5 - 0.07), ky + 0.14, kz + wD * 0.5);
    const db = new Batch();
    const x0 = side < 0 ? 0 : -doorW;
    const x1 = side < 0 ? doorW : 0;
    db.add(boxGeo(V(x0, 0, -0.03), V(x1, doorH, 0.03), 1.2), wardMat);
    // Raised Gothic inset trim rails + iron knob
    db.add(boxGeo(V(x0 + 0.06, 0.14, 0.02), V(x1 - 0.06, 0.22, 0.055), 0), darkWoodMat);
    db.add(boxGeo(V(x0 + 0.06, doorH - 0.22, 0.02), V(x1 - 0.06, doorH - 0.14, 0.055), 0), darkWoodMat);
    db.add(boxGeo(V(x0 + 0.06, doorH * 0.48, 0.02), V(x1 - 0.06, doorH * 0.52, 0.055), 0), darkWoodMat);
    const knobX = side < 0 ? doorW - 0.09 : -doorW + 0.09;
    db.add(new THREE.SphereGeometry(0.034, 8, 6), ironMat, new THREE.Matrix4().makeTranslation(knobX, 1.06, 0.06));
    db.build(piv, true);
    group.add(piv);
    return piv;
  };
  const leftDoorPivot = makeDoorPanel(-1);
  const rightDoorPivot = makeDoorPanel(1);

  // 7. Animated 3D muddy burlap sack corner poking out bottom of wardrobe in Shot 3
  const sackCorner = buildBurlapSack3D(sackMat, ropeMat);
  sackCorner.scale.setScalar(0.84);
  sackCorner.position.set(kx + 0.14, 0.02, kz + 0.24);
  sackCorner.rotation.y = 0.55;
  group.add(sackCorner);

  // 8. HDR glowing night/storm window pane + diagonal volumetric moonlight shaft
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.75, 2.45), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 1.22), windowMat);
  winPane.position.set(wx, wy, wz - 0.03);
  winPane.layers.set(NOINK);
  group.add(winPane);

  const shaft = addVolumetricShaft(group, [wx + 0.95, wy - 0.35, wz + 1.55], [0.48, 0.22, -0.42], 5.6, 0.55, 1.55, "#94bcf6", 0.14);

  // 9. Shadow-Depth foreground silhouette beams/branches framing ONLY Wide Shots 1 & 8
  const fgSilhouettes = new THREE.Group();
  addForegroundSilhouette(fgSilhouettes, -2.55, 2.55, 1.15, 1.15, 7, -1);
  addForegroundSilhouette(fgSilhouettes, 1.95, 2.65, 2.35, 1.05, 19, 1);
  group.add(fgSilhouettes);

  return { group, fgSilhouettes, leftDoorPivot, rightDoorPivot, sackCorner, altarLampMat, windowMat, shaftMat: shaft.mat };
}

export function buildBedroomEra(): BedroomEra {
  const group = new THREE.Group();
  const b = new Batch();

  const floorMat = lam("ok_bed_floor", () => ({ map: rep(darkPlanksHD("ok_bfloor_tex"), 2.4, 2.4), color: "#786250" }));
  const wallMat = lam("ok_bed_wall", () => ({
    map: rep(darkPlanksHD("ok_bwall_tex", ["#544438", "#483a30", "#5d4c3f"]), 2.0, 2.0),
    color: "#6e5a4c",
  }));
  const postMat = lam("ok_bed_post", () => ({ map: rep(beamHD(), 1, 1), color: "#3f3026" }));
  const doorMat = lam("ok_bed_door", () => ({ map: rep(darkPlanksHD("ok_bdoor_tex"), 1, 1), color: "#685240" }));
  const quiltMat = lam("ok_quilt", () => ({
    map: rep(crackedPlasterHD("ok_quilt_tex", "#7f766c"), 2, 2),
    color: "#887e74",
  }));
  const ironMat = phong("ok_bed_iron", () => ({ color: "#20242d", specular: "#728298", shininess: 42 }));
  const sackMat = lam("ok_burlap_bed_weave", () => ({
    map: rep(burlapCanvasTex("ok_burlap_bed_weave_tex"), 2, 2),
    color: "#9e8868",
  }));
  const voidMat = lam("ok_underbed_void", () => ({ color: "#060408" }));
  const ropeMat = lam("ok_rope_bed", () => ({ color: "#58442c" }));

  // 1. Timber floor, enclosing walls & ceiling rafters (y = 0)
  b.add(boxGeo(V(-3.4, -0.15, -3.4), V(3.4, 0.0, 3.6), 1.8), floorMat);
  b.add(boxGeo(V(-3.4, 0.0, -3.32), V(3.4, 3.35, -3.12), 2.0), wallMat);
  b.add(boxGeo(V(-3.4, 0.0, 3.12), V(3.4, 3.35, 3.34), 2.0), wallMat);
  b.add(boxGeo(V(-3.4, 0.0, -3.32), V(-3.16, 3.35, 3.34), 2.0), wallMat);
  b.add(boxGeo(V(3.16, 0.0, -3.32), V(3.4, 3.35, 3.34), 2.0), wallMat);
  for (const px of [-3.08, -1.02, 1.02, 3.08]) {
    b.add(boxGeo(V(px - 0.08, 0.0, -3.14), V(px + 0.08, 3.35, -2.98), 0), postMat);
  }
  for (const rz of [-2.2, -0.6, 1.0, 2.4]) {
    b.add(boxGeo(V(-3.3, 2.86, rz - 0.08), V(3.3, 3.04, rz + 0.08), 1.5), postMat);
  }

  // 2. Heavy timber bedroom door at ANCHORS.BED_DOOR + iron crossbar brackets
  const [dx, dy, dz] = ANCHORS.BED_DOOR;
  b.add(boxGeo(V(dx - 0.64, dy, dz - 0.03), V(dx + 0.64, dy + 2.26, dz + 0.06), 1.2), doorMat);
  b.add(boxGeo(V(dx - 0.74, dy, dz - 0.04), V(dx - 0.60, dy + 2.36, dz + 0.11), 0), postMat);
  b.add(boxGeo(V(dx + 0.60, dy, dz - 0.04), V(dx + 0.74, dy + 2.36, dz + 0.11), 0), postMat);
  b.add(boxGeo(V(dx - 0.78, dy + 2.24, dz - 0.04), V(dx + 0.78, dy + 2.40, dz + 0.12), 0), postMat);
  b.add(boxGeo(V(dx - 0.70, dy + 0.96, dz + 0.05), V(dx - 0.56, dy + 1.16, dz + 0.18), 0), ironMat);
  b.add(boxGeo(V(dx + 0.56, dy + 0.96, dz + 0.05), V(dx + 0.70, dy + 1.16, dz + 0.18), 0), ironMat);

  // 3. Slatted night window on back-left wall
  const [wx, wy, wz] = ANCHORS.BED_WINDOW;
  b.add(boxGeo(V(wx - 0.54, wy - 0.54, wz - 0.03), V(wx + 0.54, wy + 0.54, wz + 0.08), 0), postMat);
  for (const sx of [-0.25, 0.0, 0.25]) {
    b.add(boxGeo(V(wx + sx - 0.026, wy - 0.48, wz + 0.03), V(wx + sx + 0.026, wy + 0.48, wz + 0.09), 0), postMat);
  }

  // 4. Traditional Vietnamese 4-post wooden bed at ANCHORS.BED with HIGH OPEN UNDER-BED GAP (y = 0..0.46 m!)
  const [bx, by, bz] = ANCHORS.BED;
  const bw = 1.96, bd = 1.48;
  // 4 tapered wooden bedposts
  for (const [lx, lz, h] of [
    [-bw / 2 + 0.08, -bd / 2 + 0.08, 0.98],
    [bw / 2 - 0.08, -bd / 2 + 0.08, 0.98],
    [-bw / 2 + 0.08, bd / 2 - 0.08, 1.38],
    [bw / 2 - 0.08, bd / 2 - 0.08, 1.38],
  ] as const) {
    b.add(taperedBoxGeo(V(bx + lx - 0.055, by, bz + lz - 0.055), V(bx + lx + 0.055, by + h, bz + lz + 0.055), 0.85, 0.85), postMat);
  }
  // Wooden bed rails (high enough at y = 0.46..0.58 so under-bed space is cleanly visible in Shot 10!)
  b.add(boxGeo(V(bx - bw / 2, by + 0.46, bz - bd / 2), V(bx + bw / 2, by + 0.58, bz - bd / 2 + 0.08), 1.2), doorMat);
  b.add(boxGeo(V(bx - bw / 2, by + 0.46, bz + bd / 2 - 0.08), V(bx + bw / 2, by + 0.58, bz + bd / 2), 1.2), doorMat);
  b.add(boxGeo(V(bx - bw / 2, by + 0.46, bz - bd / 2), V(bx - bw / 2 + 0.08, by + 0.58, bz + bd / 2), 1.2), doorMat);
  b.add(boxGeo(V(bx + bw / 2 - 0.08, by + 0.46, bz - bd / 2), V(bx + bw / 2, by + 0.58, bz + bd / 2), 1.2), doorMat);
  // Headboard slats along back edge (+z)
  b.add(boxGeo(V(bx - bw / 2 + 0.06, by + 0.58, bz + bd / 2 - 0.08), V(bx + bw / 2 - 0.06, by + 1.28, bz + bd / 2), 1.2), doorMat);
  // Straw mat & folded rumpled quilt atop the bedframe
  b.add(boxGeo(V(bx - bw / 2 + 0.08, by + 0.56, bz - bd / 2 + 0.08), V(bx + bw / 2 - 0.08, by + 0.65, bz + bd / 2 - 0.08), 1.4), quiltMat);
  // Pillow on right
  b.add(taperedBoxGeo(V(bx + 0.25, by + 0.65, bz + 0.25), V(bx + 0.82, by + 0.82, bz + 0.56), 0.84, 0.84), quiltMat);
  // Pitch-dark shadow recess & shadowed floor strip inside under-bed cavity so glaring eyes loom deep inside!
  b.add(boxGeo(V(bx - bw / 2 + 0.10, by + 0.01, bz + 0.08), V(bx + bw / 2 - 0.10, by + 0.45, bz + bd / 2 - 0.10), 0), voidMat);
  b.add(boxGeo(V(bx - bw / 2 + 0.10, by + 0.004, bz - bd / 2 + 0.12), V(bx + bw / 2 - 0.10, by + 0.016, bz + 0.10), 0), voidMat);

  // 5. Bedside wooden stool holding real 3D warm oil lamp illuminating bed, sack & floor!
  const [tx, ty, tz] = ANCHORS.BED_LAMP;
  b.add(boxGeo(V(tx - 0.34, ty + 0.68, tz - 0.30), V(tx + 0.34, ty + 0.74, tz + 0.30), 0.8), doorMat);
  for (const [lx, lz] of [[-0.28, -0.24], [0.28, -0.24], [-0.28, 0.24], [0.28, 0.24]] as const) {
    b.add(taperedBoxGeo(V(tx + lx - 0.04, ty, tz + lz - 0.04), V(tx + lx + 0.04, ty + 0.68, tz + lz + 0.04), 0.85, 0.85), postMat);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.9, 1.85, 0.82), toneMapped: false });
  addStormLantern3D(b, ironMat, lampMat, group, tx - 0.04, ty + 0.90, tz, 0.94);

  b.build(group, true);

  // 6. Animated 3D heavy wooden crossbar on bedroom door
  const doorCrossbar = new THREE.Mesh(boxGeo(V(-0.76, -0.055, -0.045), V(0.76, 0.055, 0.045), 0.8), postMat);
  doorCrossbar.position.set(dx, dy + 1.06, dz + 0.12);
  doorCrossbar.castShadow = true;
  doorCrossbar.receiveShadow = true;
  group.add(doorCrossbar);

  // 7. Hero Finale Prop: Mud-stained 3D burlap sack already resting right on top of the bed!
  const bedSack = buildBurlapSack3D(sackMat, ropeMat);
  bedSack.scale.setScalar(0.80);
  bedSack.position.set(bx - 0.08, by + 0.64, bz - 0.04);
  bedSack.rotation.y = 0.28;
  group.add(bedSack);

  // 8. HDR moonlight window pane + diagonal shaft
  const windowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.75, 2.4), toneMapped: false });
  const winPane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), windowMat);
  winPane.position.set(wx, wy, wz + 0.04);
  winPane.layers.set(NOINK);
  group.add(winPane);

  const shaft = addVolumetricShaft(group, [wx + 0.72, wy - 0.55, wz + 1.15], [0.58, 0.28, -0.48], 3.8, 0.45, 1.05, "#8cb8f0", 0.14);

  return { group, doorCrossbar, bedSack, lampMat, windowMat, shaftMat: shaft.mat };
}
