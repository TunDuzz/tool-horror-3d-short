// HorrorLabV3 (Engine v4 Style B — Semi-Realistic Gritty Indie 3D):
// 3 radically distinct non-repeating 3D environments with 1024px paired Albedo+BumpMap textures & Environmental Decay Kit:
//   1. buildRuralFuneralRoom() — Decaying Vietnamese thatched A-frame funeral room (peeling plaster revealing raw brick, broken shutter moonlight window, cobwebs, reed mat, coffin, altar, oil lamp, bolted double door)
//   2. buildHospitalCorridor() — Abandoned hospital corridor (broken/missing ceramic tiles exposing dark cement, "CẢNH BÁO" torn peeling poster, hanging tangled ceiling cables, rusted pipe, gurney, IV stand, floor puddle)
//   3. buildFoggyVillageAlley() — Wet pebbled rural alley (deep bumped brick wall, flaking mossy concrete, cracked curbstones, overgrown weeds along wall crevices, tangled overhead cables, scattered rubble, sodium streetlamp)

import * as THREE from "three";
import {
  Batch,
  DoubleDoorCtrl,
  DustMotes3D,
  NOINK,
  SmokeWisps3D,
  V,
  addAFrameRoof,
  addAltarOfferingPlate3D,
  addBrokenShutterWindow3D,
  addCobwebCluster3D,
  addContactShadow,
  addCorridorBay,
  addCrackedCurbstone3D,
  addDoubleDoorWithCracks,
  addDustMotes,
  addExitSign3D,
  addFloorCornerAO,
  addFluorescentTube3D,
  addGlassOilLamp3D,
  addHangingCables3D,
  addIncenseBurner3D,
  addLampHalo3D,
  addOvergrownWeeds3D,
  addPeelingPaperDecal3D,
  addPipeRun3D,
  addRisingSmokeWisps,
  addRoomBaseboard,
  addScatteredDebris3D,
  addSimpleTable,
  addStreetLamp3D,
  addVolumetricCone,
  addWallSwitch3D,
  addWallWithOpening,
  addWetPuddleDecal,
  attachOutlineRig,
  boxGeo,
  brickWallPair,
  concreteCeilingTex,
  corrugatedTinTex,
  ctex,
  darkTimberPair,
  hospitalTilePair,
  lam,
  mottledPlasterPair,
  packedEarthTex,
  paintedConcretePair,
  phong,
  reedMatTex,
  rep,
  repPair,
  thatchRoofTex,
  vintagePatternTileTex,
  wetAsphaltPair,
} from "../engine";
import { ANCHORS } from "./story";

export type FuneralRoomSet = {
  group: THREE.Group;
  oilLamp: ReturnType<typeof addGlassOilLamp3D>;
  oilLampHalo: ReturnType<typeof addLampHalo3D>;
  altarCandleMat: THREE.MeshBasicMaterial;
  altarHalo: ReturnType<typeof addLampHalo3D>;
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
    gr.addColorStop(1, "rgba(22,16,20,0.56)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = "#1f1d24";
    g.beginPath();
    g.ellipse(128, 274, 86, 92, 0, Math.PI, Math.PI * 2);
    g.fillRect(42, 274, 172, 50);
    g.fill();
    g.fillStyle = "#b8b0a0";
    g.fillRect(108, 176, 40, 34);
    g.fillStyle = "#26232a";
    g.beginPath();
    g.ellipse(128, 114, 42, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#b6ae9e";
    g.beginPath();
    g.ellipse(128, 126, 34, 43, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2b272e";
    g.fillRect(107, 116, 13, 5);
    g.fillRect(136, 116, 13, 5);
    g.fillRect(111, 125, 6, 4);
    g.fillRect(139, 125, 6, 4);
    g.fillRect(126, 127, 4, 16);
    g.fillRect(118, 150, 20, 3);
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

  const plasterP = repPair(mottledPlasterPair(), 2.0, 1.4);
  const timberP = repPair(darkTimberPair(), 1.0, 1.8);
  const doorTimberP = repPair(darkTimberPair("v4_doorTimber"), 1.0, 1.0);
  const earthP = repPair(wetAsphaltPair("v4_earthFloor"), 3.2, 3.2);
  const brickP = repPair(brickWallPair("v4_debrisBrick"), 1.0, 1.0);

  const floorMat = lam("hlv4_fun_floor", () => ({
    map: rep(packedEarthTex(), 3, 3),
    bumpMap: earthP.bumpMap,
    bumpScale: 0.012,
    color: "#52494a",
  }));
  const wallMat = lam("hlv4_fun_wall", () => ({
    map: plasterP.map,
    bumpMap: plasterP.bumpMap,
    bumpScale: 0.026,
    color: "#968e7e",
  }));
  const trussMat = lam("hlv4_fun_truss", () => ({
    map: timberP.map,
    bumpMap: timberP.bumpMap,
    bumpScale: 0.018,
    color: "#382a26",
  }));
  const thatchMat = lam("hlv4_fun_thatch", () => ({
    map: rep(thatchRoofTex(), 2.8, 2.2),
    bumpMap: rep(thatchRoofTex(), 2.8, 2.2),
    bumpScale: 0.022,
    color: "#826e66",
    side: THREE.DoubleSide,
  }));
  const doorFrameMat = lam("hlv4_fun_dframe", () => ({
    map: timberP.map,
    bumpMap: timberP.bumpMap,
    bumpScale: 0.016,
    color: "#281e1d",
  }));
  const doorLeafMat = lam("hlv4_fun_dleaf", () => ({
    map: doorTimberP.map,
    bumpMap: doorTimberP.bumpMap,
    bumpScale: 0.020,
    color: "#563b32",
  }));
  const coffinMat = phong("hlv4_fun_coffin", () => ({
    map: doorTimberP.map,
    bumpMap: doorTimberP.bumpMap,
    bumpScale: 0.010,
    color: "#522833",
    specular: "#9a6c72",
    shininess: 32,
  }));
  const goldTrimMat = phong("hlv4_fun_gold", () => ({ color: "#c49a50", specular: "#ffe29a", shininess: 52 }), 1, 0.25);
  const altarMat = lam("hlv4_fun_altar", () => ({ map: doorTimberP.map, bumpMap: doorTimberP.bumpMap, bumpScale: 0.012, color: "#5c343b" }));
  const tableMat = lam("hlv4_fun_table", () => ({ map: doorTimberP.map, bumpMap: doorTimberP.bumpMap, bumpScale: 0.015, color: "#4d3330" }));
  const matTex = lam("hlv4_fun_reedmat", () => ({ map: reedMatTex(), bumpMap: reedMatTex(), bumpScale: 0.008, color: "#c4b49a" }));
  const debrisBrickMat = lam("hlv4_fun_dbrick", () => ({ map: brickP.map, bumpMap: brickP.bumpMap, bumpScale: 0.016, color: "#76463a" }));

  // 1. Floor (6.4m x 7.6m) + walls (back wall doorway + right wall broken shutter window cutout!)
  b.add(boxGeo(V(-3.2, -0.14, -3.8), V(3.2, 0, 3.8), 2.0), floorMat);
  addWallWithOpening(b, wallMat, [-3.2, 0, -3.78], [3.2, 4.4, -3.60], { axis: "x", u0: -2.09, u1: -0.61, y0: 0, y1: 2.24 }, 2.2);
  b.add(boxGeo(V(-3.36, 0, -3.78), V(-3.18, 3.0, 3.8), 2.2), wallMat);
  // Right wall with recessed broken shuttered moonlight window opening
  addWallWithOpening(b, wallMat, [3.18, 0, -3.78], [3.36, 3.0, 3.8], { axis: "z", u0: -1.45, u1: -0.35, y0: 1.02, y1: 2.22 }, 2.2);
  b.add(boxGeo(V(-3.2, 0, 3.62), V(3.2, 4.4, 3.8), 2.2), wallMat);

  // Structural timber columns + baseboard trim
  for (const [px, pz] of [[-3.08, -3.52], [3.08, -3.52], [-3.08, 0.2], [3.08, 0.2], [-3.08, 3.48], [3.08, 3.48]] as const) {
    b.add(boxGeo(V(px - 0.08, 0, pz - 0.08), V(px + 0.08, 2.86, pz + 0.08), 1.5), trussMat);
  }
  addRoomBaseboard(b, trussMat, -3.18, 3.18, -3.60, 3.62, 0, 0.11, 0.035);

  // 2. Exposed A-frame thatch roof overhead
  addAFrameRoof(b, trussMat, thatchMat, { cx: 0, cz: 0, width: 6.4, depth: 7.6, eaveY: 2.28, ridgeH: 1.55, trussCount: 5, tile: 2.0 });

  // 3. Woven reed mats on floor
  b.add(boxGeo(V(-0.92, 0, -0.52), V(0.72, 0.022, 2.38), 0), matTex);

  // 4. Low offering table
  const [tx, , tz] = ANCHORS.OIL_LAMP_TABLE;
  addSimpleTable(b, tableMat, trussMat, [tx, 0, tz], 0.72, 0.50, 0.56);

  // 5. HERO PROP: Lacquered wooden coffin on trestle legs
  const [cx, , cz] = ANCHORS.COFFIN;
  for (const sz of [-0.72, 0.72]) {
    b.add(boxGeo(V(cx - 0.42, 0, cz + sz - 0.06), V(cx - 0.30, 0.64, cz + sz + 0.06), 1.0), trussMat);
    b.add(boxGeo(V(cx + 0.30, 0, cz + sz - 0.06), V(cx + 0.42, 0.64, cz + sz + 0.06), 1.0), trussMat);
    b.add(boxGeo(V(cx - 0.48, 0.58, cz + sz - 0.07), V(cx + 0.48, 0.68, cz + sz + 0.07), 1.0), trussMat);
  }
  b.add(boxGeo(V(cx - 0.46, 0.68, cz - 1.05), V(cx + 0.46, 1.18, cz + 1.05), 1.5), coffinMat);
  b.add(boxGeo(V(cx - 0.40, 1.18, cz - 1.02), V(cx + 0.40, 1.32, cz + 1.02), 1.5), coffinMat);
  b.add(boxGeo(V(cx - 0.48, 1.08, cz - 1.07), V(cx + 0.48, 1.12, cz + 1.07), 1.5), goldTrimMat);
  b.add(boxGeo(V(cx - 0.50, 0.66, cz + 0.98), V(cx + 0.50, 1.44, cz + 1.09), 1.0), coffinMat);

  // 6. HERO PROP: Ancestral altar + framed portrait
  const [ax, , az] = ANCHORS.ALTAR;
  addSimpleTable(b, altarMat, trussMat, [ax, 0, az], 1.52, 0.62, 0.98);
  b.add(boxGeo(V(ax - 0.78, 0.98, az - 0.28), V(ax + 0.78, 2.10, az - 0.20), 1.2), altarMat);
  b.add(boxGeo(V(ax - 0.26, 1.24, az - 0.19), V(ax + 0.26, 1.88, az - 0.13), 1.0), trussMat);

  // Scattered plaster/brick/wood decay debris near corners
  addScatteredDebris3D(b, debrisBrickMat, trussMat, [-2.55, 0, -2.95], 0.75, 7, 13);
  addScatteredDebris3D(b, debrisBrickMat, trussMat, [2.65, 0, -0.75], 0.62, 5, 29);

  b.build(group, true);

  // Environmental Decay Props: Broken shutter window letting cold blue moonlight in + corner cobwebs + curled paper talisman
  addBrokenShutterWindow3D(group, [3.16, 1.62, -0.90], -Math.PI * 0.5, {
    width: 1.10,
    height: 1.20,
    moonGlow: true,
    frameMat: trussMat,
  });
  addCobwebCluster3D(group, [-2.76, 2.18, -3.35], [0, 0.25, 0], 0.72, 0.46);
  addCobwebCluster3D(group, [2.74, 2.18, -3.35], [0, -0.25, -Math.PI * 0.5], 0.72, 0.46);
  addCobwebCluster3D(group, [-0.52, 2.26, -3.54], [0, 0, -Math.PI * 0.5], 0.56, 0.42);
  addPeelingPaperDecal3D(group, [-2.58, 1.56, -3.58], [0, 0, 0.04], {
    width: 0.34,
    height: 0.48,
    header: "CẤM KỴ",
    subtext: "KHÔNG ĐẾM NGƯỜI",
    biohazard: false,
    seed: 19,
  });

  // Portrait image plane inside frame
  const pPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.54),
    lam("hlv3_portrait_mat", () => ({ map: portraitTex() }), 1, 0.3),
  );
  pPlane.position.set(ax, 1.56, az - 0.125);
  pPlane.layers.set(NOINK);
  group.add(pPlane);

  // Altar tall glowing candle
  const altarCandleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 10), lam("hlv3_wax", () => ({ color: "#dfd4be" }), 1, 0.2));
  altarCandleBody.position.set(ax - 0.46, 1.09, az + 0.06);
  const altarCandleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.1, 0.72), toneMapped: false });
  const altarFlame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.068, 8), altarCandleMat);
  altarFlame.position.set(ax - 0.46, 1.24, az + 0.06);
  altarFlame.layers.set(NOINK);
  altarFlame.userData.noSSAO = true;
  group.add(altarCandleBody, altarFlame);

  // Oil lamp, incense burners, offering fruit plate, atmospheric halos & Contact AO
  const oilLamp = addGlassOilLamp3D(group, [tx - 0.18, 0.56, tz + 0.05], 1.15);
  const oilLampHalo = addLampHalo3D(group, [tx - 0.18, 0.79, tz + 0.05], 0.56, "#ffb458", 0.32);
  const altarHalo = addLampHalo3D(group, [ax - 0.46, 1.25, az + 0.06], 0.36, "#ffb860", 0.24);
  addIncenseBurner3D(group, [tx + 0.24, 0.56, tz + 0.04], 1.05);
  addIncenseBurner3D(group, [ax, 0.98, az + 0.08], 1.15);
  addAltarOfferingPlate3D(group, [ax + 0.44, 0.98, az + 0.04], 0.96);
  addWallSwitch3D(group, [-0.42, 1.32, -3.58], 0);

  addFloorCornerAO(group, -3.18, 3.18, -3.60, 3.62, 0.004, 0.50, 0.52);
  addContactShadow(group, [ANCHORS.NPC_SEAT[0], 0.022, ANCHORS.NPC_SEAT[2]], 0.54, 0.44, 0.64);
  addContactShadow(group, [tx, 0.004, tz], 0.52, 0.42, 0.58);
  addContactShadow(group, [cx, 0.004, cz], 0.68, 1.22, 0.62);
  addContactShadow(group, [ax, 0.004, az], 0.88, 0.46, 0.60);

  const incenseSmoke = addRisingSmokeWisps(group, [tx + 0.24, 0.92, tz + 0.04], { count: 7, height: 0.85, opacity: 0.22 });
  const altarSmoke = addRisingSmokeWisps(group, [ax, 1.35, az + 0.08], { count: 7, height: 0.95, opacity: 0.20 });

  const doorCtrl = addDoubleDoorWithCracks(
    group,
    { frame: doorFrameMat, leaf: doorLeafMat, bolt: trussMat },
    { pos: ANCHORS.DOUBLE_DOOR, width: 1.48, height: 2.24, crackW: 0.032, bottomGap: 0.045, moonColor: "#a2b8dc" },
  );

  return { group, oilLamp, oilLampHalo, altarCandleMat, altarHalo, doorCtrl, incenseSmoke, altarSmoke };
}

export function buildHospitalCorridor(): HospitalCorridorSet {
  const group = new THREE.Group();
  group.name = "HospitalCorridor";
  const b = new Batch();

  const tileP = repPair(hospitalTilePair(), 2.0, 1.5);
  const floorTileP = repPair(hospitalTilePair("v4_hospFloorTile"), 2.4, 2.4);
  const concP = repPair(paintedConcretePair("v4_hospCeil", "#5d6564", "#444b4a"), 2.0, 2.0);
  const brickP = repPair(brickWallPair("v4_hospDebris"), 1.0, 1.0);

  const wallMat = phong("hlv4_hosp_wall", () => ({
    map: tileP.map,
    bumpMap: tileP.bumpMap,
    bumpScale: 0.024,
    color: "#93a69e",
    specular: "#42524c",
    shininess: 22,
  }));
  const floorMat = phong("hlv4_hosp_floor", () => ({
    map: rep(vintagePatternTileTex(), 2.2, 2.2),
    bumpMap: floorTileP.bumpMap,
    bumpScale: 0.014,
    color: "#767974",
    specular: "#4a5452",
    shininess: 26,
  }));
  const ceilMat = lam("hlv4_hosp_ceil", () => ({
    map: rep(concreteCeilingTex(), 2.0, 2.0),
    bumpMap: concP.bumpMap,
    bumpScale: 0.016,
    color: "#697170",
  }));
  const trimMat = phong("hlv4_hosp_trim", () => ({
    color: "#3c2822",
    bumpMap: concP.bumpMap,
    bumpScale: 0.012,
    specular: "#644438",
    shininess: 18,
  }));
  const steelMat = phong("hlv4_hosp_steel", () => ({
    color: "#6b747a",
    bumpMap: concP.bumpMap,
    bumpScale: 0.008,
    specular: "#c6d2dc",
    shininess: 54,
  }));
  const padMat = lam("hlv4_hosp_pad", () => ({ color: "#4e5b5a" }));
  const rubbleMat = lam("hlv4_hosp_rubble", () => ({ map: brickP.map, bumpMap: brickP.bumpMap, bumpScale: 0.015, color: "#4d5250" }));

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

  // Dramatic rusted steel doorway partition frame at z = -2.35 framing the looming Body Horror wardEntity!
  addWallWithOpening(b, wallMat, [-1.42, 0, -2.42], [1.42, 2.95, -2.26], { axis: "x", u0: -0.66, u1: 0.66, y0: 0, y1: 2.28 }, 2.0);
  // Rusted metal door frame jambs & lintel
  b.add(boxGeo(V(-0.74, 0, -2.46), V(-0.65, 2.34, -2.22), 1.0), trimMat);
  b.add(boxGeo(V(0.65, 0, -2.46), V(0.74, 2.34, -2.22), 1.0), trimMat);
  b.add(boxGeo(V(-0.76, 2.26, -2.46), V(0.76, 2.36, -2.22), 1.0), trimMat);

  // Far end wall with stairwell door
  b.add(boxGeo(V(-1.5, 0, -12.14), V(1.5, 3.05, -12.0), 2.0), wallMat);
  b.add(boxGeo(V(-0.68, 0, -12.02), V(0.68, 2.24, -11.92), 1.0), trimMat);

  // HERO PROP 1: Wheeled stainless hospital gurney parked along left wall deeper down hallway
  const gx = -0.92, gz = -5.65;
  b.add(boxGeo(V(gx - 0.36, 0.72, gz - 0.92), V(gx + 0.36, 0.80, gz + 0.92), 1.0), steelMat);
  b.add(boxGeo(V(gx - 0.34, 0.80, gz - 0.88), V(gx + 0.34, 0.90, gz + 0.88), 1.0), padMat);
  for (const [lx, lz] of [[-0.30, -0.78], [0.30, -0.78], [-0.30, 0.78], [0.30, 0.78]] as const) {
    b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), steelMat, new THREE.Matrix4().makeTranslation(gx + lx, 0.36, gz + lz));
  }
  b.add(boxGeo(V(gx + 0.34, 0.92, gz - 0.55), V(gx + 0.37, 0.96, gz + 0.55), 0), steelMat);

  // HERO PROP 2: IV drip stand + overhead corroded ceiling pipes + broken tile debris
  const ix = 1.02, iz = -4.25;
  b.add(new THREE.CylinderGeometry(0.016, 0.020, 1.85, 8), steelMat, new THREE.Matrix4().makeTranslation(ix, 0.92, iz));
  b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), steelMat, new THREE.Matrix4().makeTranslation(ix, 0.04, iz));
  b.add(boxGeo(V(ix - 0.20, 1.82, iz - 0.015), V(ix + 0.20, 1.86, iz + 0.015), 0), steelMat);
  addPipeRun3D(b, trimMat, [-1.24, 2.74, 3.4], [-1.24, 2.74, -11.9], 0.052);
  addPipeRun3D(b, steelMat, [-0.95, 2.80, 3.4], [1.15, 2.80, -2.35], 0.036);
  addScatteredDebris3D(b, rubbleMat, trimMat, [-1.05, 0, -1.95], 0.55, 7, 43);

  b.build(group, true);

  // Decay Dressing matching approved Style B hospital concept:
  // Torn peeling "CẢNH BÁO" poster right beside rusted doorway + tangled hanging ceiling cables + dark reflective floor puddle!
  addPeelingPaperDecal3D(group, [-0.88, 1.56, -2.23], [0, 0, -0.02], {
    width: 0.38,
    height: 0.52,
    header: "CẢNH BÁO",
    subtext: "KHU VỰC CÁCH LY",
    biohazard: true,
    seed: 7,
  });
  addHangingCables3D(group, [-1.26, 2.82, -2.18], [1.26, 2.66, -2.20], 5, 0.44, 31);
  addHangingCables3D(group, [-1.30, 2.86, -0.8], [-1.15, 1.85, -2.22], 3, 0.34, 17);
  addCobwebCluster3D(group, [-0.66, 2.26, -2.22], [0, 0, 0], 0.42, 0.36);

  const tubeA = addFluorescentTube3D(group, [0, 2.88, -0.4], 1.18, Math.PI * 0.5);
  const tubeB = addFluorescentTube3D(group, [0, 2.88, -6.8], 1.18, Math.PI * 0.5);
  addExitSign3D(group, [0, 2.48, -11.95], 0, "LỐI THOÁT");
  addWallSwitch3D(group, [1.38, 1.32, -0.4], -Math.PI * 0.5);
  addFloorCornerAO(group, -1.40, 1.40, -12.0, 4.0, 0.004, 0.38, 0.52);
  addContactShadow(group, [gx, 0.004, gz], 0.54, 1.08, 0.58);
  addContactShadow(group, [ix, 0.004, iz], 0.34, 0.34, 0.52);
  addContactShadow(group, [ANCHORS.HOSP_ENTITY[0], 0.004, ANCHORS.HOSP_ENTITY[2]], 0.52, 0.42, 0.68);
  addWetPuddleDecal(group, [-0.18, 0.004, -1.25], 0.68, 0.92, "#0c1415", 0.72);
  const dust = addDustMotes(group, [0, 1.45, -1.8], [2.2, 2.3, 6.5], 34, 19, "#c4ded8");

  return { group, tubeA, tubeB, dust };
}

export function buildFoggyVillageAlley(): VillageAlleySet {
  const group = new THREE.Group();
  group.name = "FoggyVillageAlley";
  const b = new Batch();

  const roadP = repPair(wetAsphaltPair(), 3.0, 11.0);
  const brickP = repPair(brickWallPair(), 4.5, 1.7);
  const concP = repPair(paintedConcretePair(), 3.6, 1.5);
  const timberP = repPair(darkTimberPair("v4_alleyGate"), 1.2, 1.2);

  const roadMat = phong("hlv4_alley_road", () => ({
    map: roadP.map,
    bumpMap: roadP.bumpMap,
    bumpScale: 0.020,
    color: "#525866",
    specular: "#58667a",
    shininess: 26,
  }));
  const brickMat = lam("hlv4_alley_brick", () => ({
    map: brickP.map,
    bumpMap: brickP.bumpMap,
    bumpScale: 0.028,
    color: "#946456",
  }));
  const concMat = lam("hlv4_alley_conc", () => ({
    map: concP.map,
    bumpMap: concP.bumpMap,
    bumpScale: 0.022,
    color: "#828886",
  }));
  const curbMat = lam("hlv4_alley_curb", () => ({
    map: concP.map,
    bumpMap: concP.bumpMap,
    bumpScale: 0.018,
    color: "#5e6262",
  }));
  const tinMat = phong("hlv4_alley_tin", () => ({
    map: rep(corrugatedTinTex(), 3, 1.5),
    bumpMap: rep(corrugatedTinTex(), 3, 1.5),
    bumpScale: 0.018,
    color: "#697078",
    specular: "#8e96a2",
    shininess: 36,
  }));
  const gateMat = lam("hlv4_alley_gate", () => ({
    map: timberP.map,
    bumpMap: timberP.bumpMap,
    bumpScale: 0.018,
    color: "#4a352c",
  }));
  const weedMat = lam("hlv4_alley_weed", () => ({ color: "#283624" }), 0.8, 0.5);

  // Wet pebbled asphalt rural lane
  b.add(boxGeo(V(-2.4, -0.15, -22), V(2.4, 0, 6), 3.0), roadMat);

  // Left weathered brick compound wall with concrete coping cap
  b.add(boxGeo(V(-2.45, 0, -22), V(-2.05, 2.25, 6), 2.2), brickMat);
  b.add(boxGeo(V(-2.52, 2.25, -22), V(-1.98, 2.40, 6), 1.5), curbMat);

  // Right aged concrete village house wall + rusted corrugated tin porch eave + far brick wall
  b.add(boxGeo(V(2.05, 0, -14), V(2.95, 3.5, 4), 2.2), concMat);
  b.add(boxGeo(V(2.05, 0, -22), V(2.48, 2.2, -14), 2.2), brickMat);
  const eaveM = new THREE.Matrix4().compose(
    V(1.62, 2.58, -5.0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.26)),
    V(1.15, 0.08, 7.6),
  );
  b.add(new THREE.BoxGeometry(1, 1, 1), tinMat, eaveM);

  // Cracked crooked concrete curbstones running along BOTH sides of the alley!
  addCrackedCurbstone3D(b, curbMat, -1.94, -17.0, 4.0, 0.24, 0.13, 5);
  addCrackedCurbstone3D(b, curbMat, 1.94, -17.0, 4.0, 0.24, 0.13, 9);

  // Dense overgrown weed tufts erupting from wall-curb cracks (destroys CG straight line seams!)
  for (const [wx, wz, sd] of [
    [-1.82, -1.6, 1], [-1.84, -4.1, 2], [-1.82, -6.9, 3], [-1.85, -9.8, 4],
    [1.82, -2.2, 5], [1.84, -4.8, 6], [1.82, -8.2, 7], [1.80, -11.4, 8],
  ] as const) {
    addOvergrownWeeds3D(b, weedMat, wx, 0.04, wz, 11, 0.42, sd, 0.24);
  }

  // Scattered fallen brick rubble along wall edge
  addScatteredDebris3D(b, brickMat, gateMat, [-1.52, 0, -2.4], 0.55, 7, 19);
  addScatteredDebris3D(b, brickMat, gateMat, [1.56, 0, -5.8], 0.48, 6, 37);

  // HERO PROP: Weathered wooden village gate inset on left brick wall
  b.add(boxGeo(V(-2.08, 0, -7.8), V(-1.96, 2.10, -6.1), 1.2), gateMat);

  // Far-alley distant silhouette compound wall & rooftop + drainpipe
  b.add(boxGeo(V(-2.4, 0, -17.8), V(2.4, 2.45, -17.2), 2.0), brickMat);
  const farRoof = new THREE.Matrix4().compose(
    V(0.2, 3.05, -18.5),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0.06, 0)),
    V(5.6, 0.9, 2.6),
  );
  b.add(new THREE.BoxGeometry(1, 1, 1), gateMat, farRoof);
  addPipeRun3D(b, tinMat, [2.01, 0.0, -3.2], [2.01, 2.75, -3.2], 0.036);

  b.build(group, true);

  // Concrete pole streetlamp + warm mist halo + volumetric cone + puddles + utility junction box + tangled overhead cables!
  const streetLamp = addStreetLamp3D(group, ANCHORS.ALLEY_LAMP, 3.9, Math.PI);
  addLampHalo3D(group, streetLamp.bulbWorldPos, 0.96, "#ffbe68", 0.36);
  addVolumetricCone(
    group,
    streetLamp.bulbWorldPos,
    [streetLamp.bulbWorldPos[0] - 0.55, 0, streetLamp.bulbWorldPos[2] + 0.3],
    0.14,
    2.25,
    "#f4be74",
    0.14,
  );
  addWallSwitch3D(group, [2.02, 1.52, -2.4], -Math.PI * 0.5);
  addPeelingPaperDecal3D(group, [-2.03, 1.38, -2.6], [0, Math.PI * 0.5, 0.03], {
    width: 0.36,
    height: 0.48,
    header: "THÔNG BÁO",
    subtext: "KHÔNG ĐI ĐÊM",
    biohazard: false,
    seed: 23,
  });

  addFloorCornerAO(group, -2.05, 2.05, -17.2, 4.0, 0.004, 0.46, 0.50);
  addContactShadow(group, [ANCHORS.ALLEY_FIGURE[0], 0.004, ANCHORS.ALLEY_FIGURE[2]], 0.42, 0.36, 0.64);
  addWetPuddleDecal(group, [0.45, 0.004, -5.2], 0.82, 1.40, "#141a26", 0.78);
  addWetPuddleDecal(group, [-0.62, 0.004, -1.9], 0.66, 0.98, "#131924", 0.72);

  // Chaotic bundled overhead Vietnamese alley power cables!
  addHangingCables3D(group, [-2.2, 3.65, -3.6], [2.2, 3.45, -4.4], 5, 0.48, 7);
  addHangingCables3D(group, [-2.2, 3.72, -6.2], [2.2, 3.60, -6.6], 4, 0.42, 19);

  return { group, streetLamp };
}

export { attachOutlineRig };
