// HorrorLabV3: 3 completely distinct non-repeating 3D environments built strictly from neutral Engine v3 kits:
//   1. buildRuralFuneralRoom() — Vietnamese thatched A-frame funeral vigil room (mottled plaster, reed mat, coffin, altar, oil lamp, bolted double door with moonlight crack & foot shadows)
//   2. buildHospitalCorridor() — Institutional ceramic-tiled hospital corridor (recessed ward doors, gurney, IV stand, flickering fluorescent tubes)
//   3. buildFoggyVillageAlley() — Wet asphalt rural night alley (brick & painted concrete compound walls, tin eave, sodium streetlamp, overhead power wire)

import * as THREE from "three";
import {
  Batch,
  DoubleDoorCtrl,
  NOINK,
  SmokeWisps3D,
  DustMotes3D,
  Strand,
  V,
  addAFrameRoof,
  addCorridorBay,
  addDoubleDoorWithCracks,
  addDustMotes,
  addFluorescentTube3D,
  addGlassOilLamp3D,
  addIncenseBurner3D,
  addRisingSmokeWisps,
  addSimpleTable,
  addStreetLamp3D,
  addVolumetricCone,
  addWallWithOpening,
  attachOutlineRig,
  boxGeo,
  brickWallTex,
  concreteCeilingTex,
  corrugatedTinTex,
  ctex,
  darkTimberWallTex,
  hospitalTileTex,
  lam,
  mottledPlasterTex,
  packedEarthTex,
  paintedConcreteTex,
  phong,
  reedMatTex,
  rep,
  thatchRoofTex,
  vintagePatternTileTex,
  wetAsphaltTex,
} from "../engine";
import { ANCHORS } from "./story";

export type FuneralRoomSet = {
  group: THREE.Group;
  oilLamp: ReturnType<typeof addGlassOilLamp3D>;
  altarCandleMat: THREE.MeshBasicMaterial;
  doorCtrl: DoubleDoorCtrl;
  incenseSmoke: SmokeWisps3D;
  altarSmoke: SmokeWisps3D;
};

export type HospitalCorridorSet = {
  group: THREE.Group;
  tubeA: ReturnType<typeof addFluorescentTube3D>;
  tubeB: ReturnType<typeof addFluorescentTube3D>;
  dust: DustMotes3D;
};

export type VillageAlleySet = {
  group: THREE.Group;
  streetLamp: ReturnType<typeof addStreetLamp3D>;
};

/** Hand-painted monochrome vintage Vietnamese elder ancestral portrait with mourning ribbon sash. */
const portraitTex = () =>
  ctex("hlv3_portrait", 256, 320, (g) => {
    g.fillStyle = "#cfc7b6";
    g.fillRect(0, 0, 256, 320);
    const gr = g.createRadialGradient(128, 140, 18, 128, 150, 175);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(22,16,20,0.52)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 320);
    // Traditional dark áo dài shoulders & white collar
    g.fillStyle = "#1f1d24";
    g.beginPath();
    g.ellipse(128, 274, 86, 92, 0, Math.PI, Math.PI * 2);
    g.fillRect(42, 274, 172, 50);
    g.fill();
    g.fillStyle = "#b8b0a0";
    g.fillRect(108, 176, 40, 34);
    // Aged head + pale face + dark combed hair
    g.fillStyle = "#26232a";
    g.beginPath();
    g.ellipse(128, 114, 42, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#b6ae9e";
    g.beginPath();
    g.ellipse(128, 126, 34, 43, 0, 0, Math.PI * 2);
    g.fill();
    // Subtle dark eyes, brows, nose shadow & stern mouth
    g.fillStyle = "#2b272e";
    g.fillRect(107, 116, 13, 5);
    g.fillRect(136, 116, 13, 5);
    g.fillRect(111, 125, 6, 4);
    g.fillRect(139, 125, 6, 4);
    g.fillRect(126, 127, 4, 16);
    g.fillRect(118, 150, 20, 3);
    // Diagonal black mourning ribbon across top-right corner
    g.fillStyle = "#0e0c12";
    g.beginPath();
    g.moveTo(174, 0);
    g.lineTo(256, 0);
    g.lineTo(256, 86);
    g.lineTo(146, 0);
    g.closePath();
    g.fill();
  });

export function buildRuralFuneralRoom(): FuneralRoomSet {
  const group = new THREE.Group();
  group.name = "RuralFuneralRoom";
  const b = new Batch();

  const floorMat = lam("hlv3_fun_floor", () => ({ map: rep(packedEarthTex(), 3, 3), color: "#584f52" }));
  const wallMat = lam("hlv3_fun_wall", () => ({ map: rep(mottledPlasterTex(), 2.2, 1.5), color: "#8e827d" }));
  const trussMat = lam("hlv3_fun_truss", () => ({ map: rep(darkTimberWallTex(), 1, 2), color: "#2d2224" }));
  const thatchMat = lam("hlv3_fun_thatch", () => ({ map: rep(thatchRoofTex(), 2.8, 2.2), color: "#8e7b74", side: THREE.DoubleSide }));
  const doorFrameMat = lam("hlv3_fun_dframe", () => ({ color: "#241b1e" }));
  const doorLeafMat = lam("hlv3_fun_dleaf", () => ({ map: rep(darkTimberWallTex(), 1, 1), color: "#5c3f36" }));
  const coffinMat = phong("hlv3_fun_coffin", () => ({ color: "#5b2f3d", specular: "#9a6c72", shininess: 26 }));
  const goldTrimMat = phong("hlv3_fun_gold", () => ({ color: "#c9a054", specular: "#ffe29a", shininess: 48 }));
  const altarMat = lam("hlv3_fun_altar", () => ({ color: "#643a44" }));
  const tableMat = lam("hlv3_fun_table", () => ({ color: "#4e3336" }));
  const matTex = lam("hlv3_fun_reedmat", () => ({ map: reedMatTex(), color: "#cbbca4" }));

  // 1. Floor (6.4m x 7.6m) + walls (back wall at z=-3.65 with doorway opening at x=-1.35)
  b.add(boxGeo(V(-3.2, -0.14, -3.8), V(3.2, 0, 3.8), 2.0), floorMat);
  addWallWithOpening(b, wallMat, [-3.2, 0, -3.78], [3.2, 4.4, -3.60], { axis: "x", u0: -2.09, u1: -0.61, y0: 0, y1: 2.24 }, 2.2);
  b.add(boxGeo(V(-3.36, 0, -3.78), V(-3.18, 3.0, 3.8), 2.2), wallMat);
  b.add(boxGeo(V(3.18, 0, -3.78), V(3.36, 3.0, 3.8), 2.2), wallMat);
  b.add(boxGeo(V(-3.2, 0, 3.62), V(3.2, 4.4, 3.8), 2.2), wallMat);

  // Structural corner & mid timber columns
  for (const [px, pz] of [[-3.08, -3.52], [3.08, -3.52], [-3.08, 0.2], [3.08, 0.2], [-3.08, 3.48], [3.08, 3.48]] as const) {
    b.add(boxGeo(V(px - 0.08, 0, pz - 0.08), V(px + 0.08, 2.86, pz + 0.08), 1.5), trussMat);
  }

  // 2. Exposed Vietnamese rural A-frame thatch roof overhead (eaveY=2.28 so angled rafters & thatch crown Shot 1!)
  addAFrameRoof(b, trussMat, thatchMat, { cx: 0, cz: 0, width: 6.4, depth: 7.6, eaveY: 2.28, ridgeH: 1.55, trussCount: 5, tile: 2.0 });

  // 3. Woven reed mats (chiếu cói) on the floor for vigil sitting
  b.add(boxGeo(V(-0.92, 0, -0.52), V(0.72, 0.022, 2.38), 0), matTex);

  // 4. Low offering table holding oil lamp & incense burner visible on right side of vigil area
  const [tx, , tz] = ANCHORS.OIL_LAMP_TABLE;
  addSimpleTable(b, tableMat, trussMat, [tx, 0, tz], 0.72, 0.50, 0.56);

  // 5. HERO PROP: Lacquered wooden coffin (linh cữu) with gold trim band on trestle legs
  const [cx, , cz] = ANCHORS.COFFIN;
  // Trestle stands
  for (const sz of [-0.72, 0.72]) {
    b.add(boxGeo(V(cx - 0.42, 0, cz + sz - 0.06), V(cx - 0.30, 0.64, cz + sz + 0.06), 1.0), trussMat);
    b.add(boxGeo(V(cx + 0.30, 0, cz + sz - 0.06), V(cx + 0.42, 0.64, cz + sz + 0.06), 1.0), trussMat);
    b.add(boxGeo(V(cx - 0.48, 0.58, cz + sz - 0.07), V(cx + 0.48, 0.68, cz + sz + 0.07), 1.0), trussMat);
  }
  // Coffin main box + curved bevel lid + gold lacquer stripe
  b.add(boxGeo(V(cx - 0.46, 0.68, cz - 1.05), V(cx + 0.46, 1.18, cz + 1.05), 1.5), coffinMat);
  b.add(boxGeo(V(cx - 0.40, 1.18, cz - 1.02), V(cx + 0.40, 1.32, cz + 1.02), 1.5), coffinMat);
  b.add(boxGeo(V(cx - 0.48, 1.08, cz - 1.07), V(cx + 0.48, 1.12, cz + 1.07), 1.5), goldTrimMat);
  // Headboard crest
  b.add(boxGeo(V(cx - 0.50, 0.66, cz + 0.98), V(cx + 0.50, 1.44, cz + 1.09), 1.0), coffinMat);

  // 6. HERO PROP: Ancestral altar with framed black-and-white portrait behind vigil area
  const [ax, , az] = ANCHORS.ALTAR;
  addSimpleTable(b, altarMat, trussMat, [ax, 0, az], 1.52, 0.62, 0.98);
  b.add(boxGeo(V(ax - 0.78, 0.98, az - 0.28), V(ax + 0.78, 2.10, az - 0.20), 1.2), altarMat);
  // Portrait frame border
  b.add(boxGeo(V(ax - 0.26, 1.24, az - 0.19), V(ax + 0.26, 1.88, az - 0.13), 1.0), trussMat);

  b.build(group, true);

  // Portrait image plane inside frame
  const pPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.54),
    lam("hlv3_portrait_mat", () => ({ map: portraitTex() })),
  );
  pPlane.position.set(ax, 1.56, az - 0.125);
  pPlane.layers.set(NOINK);
  group.add(pPlane);

  // Altar tall glowing candle
  const altarCandleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 10), lam("hlv3_wax", () => ({ color: "#dfd4be" })));
  altarCandleBody.position.set(ax - 0.46, 1.09, az + 0.06);
  const altarCandleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.1, 0.72), toneMapped: false });
  const altarFlame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.068, 8), altarCandleMat);
  altarFlame.position.set(ax - 0.46, 1.24, az + 0.06);
  altarFlame.layers.set(NOINK);
  group.add(altarCandleBody, altarFlame);

  // Incense burners + glass oil lamp
  const oilLamp = addGlassOilLamp3D(group, [tx - 0.18, 0.56, tz + 0.05], 1.15);
  addIncenseBurner3D(group, [tx + 0.24, 0.56, tz + 0.04], 1.05);
  addIncenseBurner3D(group, [ax, 0.98, az + 0.08], 1.15);

  const incenseSmoke = addRisingSmokeWisps(group, [tx + 0.24, 0.92, tz + 0.04], { count: 7, height: 0.85, opacity: 0.22 });
  const altarSmoke = addRisingSmokeWisps(group, [ax, 1.35, az + 0.08], { count: 7, height: 0.95, opacity: 0.20 });

  // 7. HERO PROP: Bolted double wooden door with center/bottom moonlight cracks & foot-shadow blockers
  const doorCtrl = addDoubleDoorWithCracks(
    group,
    { frame: doorFrameMat, leaf: doorLeafMat, bolt: trussMat },
    { pos: ANCHORS.DOUBLE_DOOR, width: 1.48, height: 2.24, crackW: 0.032, bottomGap: 0.045, moonColor: "#a2b8dc" },
  );

  return { group, oilLamp, altarCandleMat, doorCtrl, incenseSmoke, altarSmoke };
}

export function buildHospitalCorridor(): HospitalCorridorSet {
  const group = new THREE.Group();
  group.name = "HospitalCorridor";
  const b = new Batch();

  const wallMat = lam("hlv3_hosp_wall", () => ({ map: rep(hospitalTileTex(), 2.2, 1.6), color: "#9eb2ac" }));
  const floorMat = lam("hlv3_hosp_floor", () => ({ map: rep(vintagePatternTileTex(), 2.0, 2.0), color: "#8c8b86" }));
  const ceilMat = lam("hlv3_hosp_ceil", () => ({ map: rep(concreteCeilingTex(), 2.0, 2.0), color: "#788080" }));
  const trimMat = lam("hlv3_hosp_trim", () => ({ color: "#3b4748" }));
  const steelMat = phong("hlv3_hosp_steel", () => ({ color: "#78848c", specular: "#d2dee8", shininess: 54 }));
  const padMat = lam("hlv3_hosp_pad", () => ({ color: "#586868" }));

  // 4 modular institutional corridor bays running from z = +4.0 down to z = -12.0
  for (let i = 0; i < 4; i++) {
    const z1 = 4.0 - i * 4.0;
    const z0 = z1 - 4.0;
    addCorridorBay(
      b,
      { wall: wallMat, floor: floorMat, ceiling: ceilMat, trim: trimMat },
      { z0, z1, width: 2.8, height: 2.95, doorLeft: i % 2 === 0, doorRight: i % 2 === 1 },
    );
  }
  // End wall with frosted stairwell door frame
  b.add(boxGeo(V(-1.5, 0, -12.14), V(1.5, 3.05, -12.0), 2.0), wallMat);
  b.add(boxGeo(V(-0.68, 0, -12.02), V(0.68, 2.24, -11.92), 1.0), trimMat);

  // HERO PROP 1: Wheeled stainless hospital gurney parked along left wall
  const gx = -0.92, gz = -2.35;
  b.add(boxGeo(V(gx - 0.36, 0.72, gz - 0.92), V(gx + 0.36, 0.80, gz + 0.92), 1.0), steelMat);
  b.add(boxGeo(V(gx - 0.34, 0.80, gz - 0.88), V(gx + 0.34, 0.90, gz + 0.88), 1.0), padMat);
  for (const [lx, lz] of [[-0.30, -0.78], [0.30, -0.78], [-0.30, 0.78], [0.30, 0.78]] as const) {
    b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), steelMat, new THREE.Matrix4().makeTranslation(gx + lx, 0.36, gz + lz));
  }
  // Guard rails
  b.add(boxGeo(V(gx + 0.34, 0.92, gz - 0.55), V(gx + 0.37, 0.96, gz + 0.55), 0), steelMat);

  // HERO PROP 2: Tall wheeled IV drip stand along right wall
  const ix = 1.02, iz = -3.45;
  b.add(new THREE.CylinderGeometry(0.016, 0.020, 1.85, 8), steelMat, new THREE.Matrix4().makeTranslation(ix, 0.92, iz));
  b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), steelMat, new THREE.Matrix4().makeTranslation(ix, 0.04, iz));
  b.add(boxGeo(V(ix - 0.20, 1.82, iz - 0.015), V(ix + 0.20, 1.86, iz + 0.015), 0), steelMat);

  b.build(group, true);

  // Overhead flickering fluorescent tubes
  const tubeA = addFluorescentTube3D(group, [0, 2.88, -1.6], 1.18, Math.PI * 0.5);
  const tubeB = addFluorescentTube3D(group, [0, 2.88, -6.8], 1.18, Math.PI * 0.5);
  const dust = addDustMotes(group, [0, 1.45, -2.5], [2.0, 2.2, 8.5], 32, 19, "#c4ded8");

  return { group, tubeA, tubeB, dust };
}

export function buildFoggyVillageAlley(): VillageAlleySet {
  const group = new THREE.Group();
  group.name = "FoggyVillageAlley";
  const b = new Batch();

  const roadMat = lam("hlv3_alley_road", () => ({ map: rep(wetAsphaltTex(), 3, 12), color: "#525866" }));
  const brickMat = lam("hlv3_alley_brick", () => ({ map: rep(brickWallTex(), 5, 1.8), color: "#9c6c5d" }));
  const concMat = lam("hlv3_alley_conc", () => ({ map: rep(paintedConcreteTex(), 4, 1.6), color: "#888c8c" }));
  const tinMat = lam("hlv3_alley_tin", () => ({ map: rep(corrugatedTinTex(), 3, 1.5), color: "#6d747e" }));
  const gateMat = lam("hlv3_alley_gate", () => ({ map: rep(darkTimberWallTex(), 1.2, 1.2), color: "#4e392e" }));
  const wireMat = lam("hlv3_alley_wire", () => ({ color: "#15171e" }));

  // Wet asphalt rural lane (4.2m wide x 28m long — tight cinematic 9:16 perspective framing BOTH walls!)
  b.add(boxGeo(V(-2.4, -0.15, -22), V(2.4, 0, 6), 3.0), roadMat);

  // Left weathered brick compound wall with concrete coping cap
  b.add(boxGeo(V(-2.45, 0, -22), V(-2.05, 2.25, 6), 2.2), brickMat);
  b.add(boxGeo(V(-2.52, 2.25, -22), V(-1.98, 2.40, 6), 1.5), concMat);

  // Right aged concrete village house wall + rusted corrugated tin porch eave + far brick wall
  b.add(boxGeo(V(2.05, 0, -14), V(2.95, 3.5, 4), 2.2), concMat);
  b.add(boxGeo(V(2.05, 0, -22), V(2.48, 2.2, -14), 2.2), brickMat);
  const eaveM = new THREE.Matrix4().compose(
    V(1.62, 2.58, -5.0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.26)),
    V(1.15, 0.08, 7.6),
  );
  b.add(new THREE.BoxGeometry(1, 1, 1), tinMat, eaveM);

  // HERO PROP: Weathered wooden village gate inset on left brick wall
  b.add(boxGeo(V(-2.08, 0, -7.8), V(-1.96, 2.10, -6.1), 1.2), gateMat);

  // Far-alley distant silhouette compound wall & dark rural rooftop so lane dissolves into village depth (no empty cut-out!)
  b.add(boxGeo(V(-2.4, 0, -17.8), V(2.4, 2.45, -17.2), 2.0), brickMat);
  const farRoof = new THREE.Matrix4().compose(
    V(0.2, 3.05, -18.5),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0.06, 0)),
    V(5.6, 0.9, 2.6),
  );
  b.add(new THREE.BoxGeometry(1, 1, 1), gateMat, farRoof);

  b.build(group, true);

  // HERO PROP: Concrete pole streetlamp reaching over the misty alley with warm sodium-vapor glow + cone
  const streetLamp = addStreetLamp3D(group, ANCHORS.ALLEY_LAMP, 3.9, Math.PI);
  addVolumetricCone(
    group,
    streetLamp.bulbWorldPos,
    [streetLamp.bulbWorldPos[0] - 0.55, 0, streetLamp.bulbWorldPos[2] + 0.3],
    0.14,
    2.25,
    "#f4be74",
    0.13,
  );

  // Overhead sagging power wires crossing the foggy alley
  for (const wz of [-4.2, -6.4]) {
    const wire = new Strand(12, 0.020, 0.020, wireMat, 1, false, false);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const u = i / 11;
      const x = -2.2 + u * 4.4;
      const sag = Math.sin(u * Math.PI) * 0.38;
      pts.push(V(x, 3.65 - sag, wz));
    }
    wire.set(pts);
    wire.mesh.layers.set(NOINK);
    group.add(wire.mesh);
  }

  return { group, streetLamp };
}

export { attachOutlineRig };
