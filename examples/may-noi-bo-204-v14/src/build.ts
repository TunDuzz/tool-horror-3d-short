// 3D Set Builder for "Đêm Gió Bấc — Máy Nội Bộ 204" (`dormNightDutyRoom` · Hanoi Winter 2003).
// Zero architectural/material overlap with `tram-pha-dem-cuoi`:
//   - Vaulted mottled-plaster ceiling (`vaulted` + `mottledPlasterTex`)
//   - Two-tone green/ochre peeling Hanoi dormitory wall (`paintedConcreteTex`)
//   - Vintage patterned cement floor tiles (`vintagePatternTileTex`)
//   - Dynamic props: swinging-then-frozen 02:15 pendulum clock, bolted transom corridor door,
//     black bakelite switchboard phone + dusty severed floor cord (`severedPhoneCord`),
//     and wooden room-key board `[201..204]` with swaying brass key & tag `204` (`keyTag204`).

import * as THREE from "three";
import {
  Batch,
  type DustMotes3D,
  NOINK,
  V,
  addCobwebCluster3D,
  addContactShadow,
  addDustMotes,
  addFloorCornerAO,
  addFluorescentTube3D,
  addLampHalo3D,
  addPeelingPaperDecal3D,
  addRoomBaseboard,
  addSimpleTable,
  addWallSwitch3D,
  addWallWithOpening,
  boxGeo,
  darkTimberPair,
  lam,
  mottledPlasterPair,
  paintedConcretePair,
  phong,
  rep,
  repPair,
  vintagePatternTileTex,
} from "../engine";

export const MNB_ANCHORS = {
  DUTY_DESK: [0.0, 0.0, 0.55] as [number, number, number],
  HUY_DESK_SIDE: [-0.38, 0.0, 0.82] as [number, number, number],
  HUY_SEAT: [-0.08, 0.0, 1.02] as [number, number, number],
  HUY_BOLT_STAND: [1.18, 0.0, -0.96] as [number, number, number],
  BA_HANH_DOOR: [1.72, 0.0, -1.18] as [number, number, number],
  CORRIDOR_WALK_MID: [3.10, 0.0, -1.35] as [number, number, number],
  CORRIDOR_WALK_FAR: [3.35, 0.0, -3.85] as [number, number, number],
  CORRIDOR_DOOR: [2.22, 0.0, -1.20] as [number, number, number],
  PENDULUM_CLOCK: [-2.20, 1.62, -0.32] as [number, number, number],
  KEY_BOARD: [-1.52, 1.48, -2.44] as [number, number, number],
  SEVERED_CORD: [0.68, 0.12, 0.06] as [number, number, number],
};

export type DormDutyRoomSet = {
  group: THREE.Group;
  roomTube: ReturnType<typeof addFluorescentTube3D>;
  corridorTube: ReturnType<typeof addFluorescentTube3D>;
  deskLampGroup: THREE.Group;
  deskLampHalo: ReturnType<typeof addLampHalo3D>;
  switchboardPhone: THREE.Group;
  handsetOnCradle: THREE.Group;
  phoneBellPivot: THREE.Group;
  severedPhoneCord: THREE.Group;
  wallPendulumClock: THREE.Group;
  pendulumPivot: THREE.Group;
  keyBoardGroup: THREE.Group;
  keyTag204: THREE.Group;
  corridorDoor: THREE.Group;
  corridorBolt: THREE.Mesh;
  dust: DustMotes3D;
};

function makeClockDialTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  // Aged matte parchment tone (keeps luminance well below HDR bloom threshold so 02:15 hands read razor-sharp!)
  g.fillStyle = "#9c9178";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#1c140e";
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 114, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
    g.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108);
    g.stroke();
  }
  g.fillStyle = "#18110c";
  g.font = "bold 24px monospace";
  g.textAlign = "center";
  g.fillText("12", 128, 56);
  g.fillText("3", 204, 136);
  g.fillText("6", 128, 214);
  g.fillText("9", 52, 136);

  // Bold dark hands locked at 02:15
  g.strokeStyle = "#120c08";
  g.lineCap = "round";
  const hAng = ((2.25 / 12) * Math.PI * 2) - Math.PI / 2;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(128 + Math.cos(hAng) * 56, 128 + Math.sin(hAng) * 56);
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(128 + 82, 128);
  g.stroke();
  g.fillStyle = "#4a1412";
  g.beginPath();
  g.arc(128, 128, 9, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeKeyTagTexture(numStr: string, highlightRed = false): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.fillStyle = highlightRed ? "#8c221c" : "#3d463e";
  g.fillRect(0, 0, 128, 256);
  g.strokeStyle = "#d8c27a";
  g.lineWidth = 8;
  g.strokeRect(8, 8, 112, 240);
  g.fillStyle = "#f2ead4";
  g.font = "bold 44px monospace";
  g.textAlign = "center";
  g.fillText(numStr, 64, 138);
  g.font = "bold 20px monospace";
  g.fillStyle = "#e2cf92";
  g.fillText("PHÒNG", 64, 82);
  if (highlightRed) {
    g.fillStyle = "#ffd6c8";
    g.font = "bold 17px monospace";
    g.fillText("NIÊM PHONG", 64, 198);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBoardHeaderTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#2b2019";
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#b89c58";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  g.fillStyle = "#ede2c4";
  g.font = "bold 28px monospace";
  g.textAlign = "center";
  g.fillText("BẢNG KHÓA KHU NỘI TRÚ B2", 256, 52);
  g.font = "22px monospace";
  g.fillStyle = "#d4be84";
  g.fillText("201      202      203      204", 256, 98);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeJackWarningTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#cfc8b4";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#6e221c";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = "#7a1814";
  g.font = "bold 24px monospace";
  g.textAlign = "center";
  g.fillText("MÁY NỘI BỘ 204", 128, 52);
  g.fillStyle = "#221e1b";
  g.font = "bold 22px monospace";
  g.fillText("ĐÃ CẮT DÂY", 128, 94);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildDormDutyRoom(): DormDutyRoomSet {
  const group = new THREE.Group();
  group.name = "DormNightDutyRoom_S01";
  const b = new Batch();

  const wallP = repPair(paintedConcretePair("mnb_wall_pair", "#928c74", "#364c44"), 2.0, 1.2);
  const vaultP = repPair(mottledPlasterPair("mnb_vault_pair", "#767066"), 2.2, 2.2);
  const woodP = repPair(darkTimberPair("mnb_wood_pair", ["#4e382b", "#422f24", "#5a4233", "#38271e"]), 1.6, 1.6);

  const wallMat = lam("mnb_wall", () => ({ map: wallP.map, bumpMap: wallP.bumpMap, bumpScale: 0.022, color: "#908c7a" }));
  const vaultMat = lam("mnb_vault", () => ({ map: vaultP.map, bumpMap: vaultP.bumpMap, bumpScale: 0.020, color: "#747068", side: THREE.DoubleSide }));
  const floorMat = phong("mnb_tile_floor", () => ({
    map: rep(vintagePatternTileTex("mnb_tile"), 4.2, 4.6),
    color: "#888478",
    specular: "#3b4244",
    shininess: 28,
  }));
  const woodMat = lam("mnb_wood", () => ({ map: woodP.map, bumpMap: woodP.bumpMap, bumpScale: 0.018, color: "#584030" }));
  const trimMat = lam("mnb_trim", () => ({ map: woodP.map, bumpMap: woodP.bumpMap, bumpScale: 0.015, color: "#2e2018" }));
  const ironMat = phong("mnb_iron", () => ({ color: "#444c52", specular: "#b8ccd8", shininess: 64 }));
  const brassMat = phong("mnb_brass", () => ({ color: "#cfa84a", specular: "#fff0b8", shininess: 88 }));
  const bakeliteMat = phong("mnb_bakelite", () => ({ color: "#18191d", specular: "#68707c", shininess: 76 }));

  // 1. Main Room Floor (4.6m x 5.2m) + Exterior Corridor Floor (x = 2.25..5.0, z = -4.6..1.5)
  b.add(boxGeo(V(-2.32, -0.14, -4.6), V(5.05, 0, 2.65), 1.8), floorMat);

  // Segmental Vaulted Ceiling (`vaulted`: 5 angled plaster vault ribs/panels spanning x = -2.3..2.3 up to y = 3.40m)
  const vaultSteps = [
    [-2.32, -1.35, 3.04],
    [-1.35, -0.45, 3.28],
    [-0.45, 0.45, 3.40],
    [0.45, 1.35, 3.28],
    [1.35, 2.32, 3.04],
  ] as const;
  for (const [vx0, vx1, vy] of vaultSteps) {
    b.add(boxGeo(V(vx0, vy, -2.62), V(vx1, vy + 0.12, 2.62), 1.8, true), vaultMat);
  }
  // Transverse vault masonry arches at z = -1.2 and z = 1.2 for authentic colonial-era Hanoi dormitory look
  for (const az of [-1.25, 1.15]) {
    b.add(boxGeo(V(-2.30, 2.92, az - 0.08), V(2.30, 3.06, az + 0.08), 1.2, true), trimMat);
  }

  // Front wall (z = -2.52): louvered winter window on right half (x = -0.35..1.55, y = 0.92..2.22), solid left half for Key Board!
  addWallWithOpening(b, wallMat, [-2.32, 0, -2.60], [2.30, 3.15, -2.44], { axis: "x", u0: -0.35, u1: 1.55, y0: 0.92, y1: 2.22 }, 2.0);
  b.add(boxGeo(V(-0.42, 0.86, -2.64), V(1.62, 0.93, -2.38), 0.8), trimMat);
  b.add(boxGeo(V(-0.42, 2.20, -2.64), V(1.62, 2.28, -2.38), 0.8), trimMat);
  for (const wx of [-0.36, 0.60, 1.54]) {
    b.add(boxGeo(V(wx - 0.03, 0.92, -2.60), V(wx + 0.03, 2.22, -2.44), 0.8), trimMat);
  }

  // Left wall (x = -2.28) + Back wall (z = 2.56)
  b.add(boxGeo(V(-2.38, 0, -2.60), V(-2.22, 3.15, 2.64), 2.0), wallMat);
  b.add(boxGeo(V(-2.32, 0, 2.52), V(2.32, 3.15, 2.68), 2.0), wallMat);

  // Right wall (x = 2.22) with CORRIDOR_DOOR opening (z = -1.68..-0.72, y = 0..2.18) + transom window above door!
  addWallWithOpening(b, wallMat, [2.18, 0, -2.60], [2.34, 3.15, 2.64], { axis: "z", u0: -1.68, u1: -0.72, y0: 0, y1: 2.48 }, 2.0);
  b.add(boxGeo(V(2.14, 0, -1.75), V(2.38, 2.52, -1.66), 0.8), trimMat);
  b.add(boxGeo(V(2.14, 0, -0.74), V(2.38, 2.52, -0.65), 0.8), trimMat);
  b.add(boxGeo(V(2.14, 2.12, -1.74), V(2.38, 2.20, -0.66), 0.8), trimMat);
  b.add(boxGeo(V(2.14, 2.46, -1.75), V(2.38, 2.55, -0.65), 0.8), trimMat);

  // Enclosed Exterior Dormitory Corridor (`x = 2.34..5.05`, `z = -4.6..1.5`) visible through door glass & front window
  b.add(boxGeo(V(4.88, 0, -4.60), V(5.06, 3.25, 1.50), 2.0), wallMat);
  b.add(boxGeo(V(-2.32, 0, -4.60), V(5.06, 3.25, -4.42), 2.0), wallMat);
  b.add(boxGeo(V(2.34, 0, 1.36), V(5.06, 3.25, 1.52), 2.0), wallMat);
  b.add(boxGeo(V(-2.32, 3.12, -4.60), V(5.06, 3.28, -2.52), 2.0), vaultMat);
  b.add(boxGeo(V(2.34, 3.12, -2.52), V(5.06, 3.28, 1.52), 2.0), vaultMat);

  addRoomBaseboard(b, trimMat, -2.22, 2.18, -2.44, 2.52, 0, 0.11, 0.032);

  // 2. Duty Desk (`x ∈ [-0.74, 0.52]`, `z ∈ [-0.32, 0.42]` -> right side `x > 0.52` is 100% open floor for `severedPhoneCord`!)
  addSimpleTable(b, trimMat, woodMat, [-0.11, 0, 0.05], 1.26, 0.74, 0.76);
  // Duty wooden chair behind desk (`z = 0.88..1.26`)
  b.add(boxGeo(V(-0.32, 0.45, 0.86), V(0.14, 0.50, 1.28), 0.6), woodMat);
  b.add(boxGeo(V(-0.32, 0.50, 1.23), V(0.14, 0.92, 1.29), 0.6), trimMat);
  for (const [cx, cz] of [[-0.28, 0.90], [0.10, 0.90], [-0.28, 1.24], [0.10, 1.24]] as const) {
    b.add(boxGeo(V(cx - 0.025, 0, cz - 0.025), V(cx + 0.025, 0.45, cz + 0.025), 0.5), trimMat);
  }
  // Archival patient/student logbook binder on left-center of desk (matte aged tone so zero HDR bloom washout)
  b.add(boxGeo(V(-0.28, 0.76, -0.02), V(0.02, 0.80, 0.26), 0.5), lam("mnb_binder", () => ({ color: "#443025" })));
  b.add(boxGeo(V(-0.26, 0.801, 0.0), V(0.0, 0.808, 0.24), 0.5), lam("mnb_page", () => ({ color: "#8c826c" })));
  // Filing shelf against back-left wall for silhouette richness
  b.add(boxGeo(V(-2.20, 0, 1.15), V(-1.68, 1.85, 2.15), 1.2), trimMat);

  b.build(group, true);

  // Translucent glass panes for front window & corridor door transom (`depthWrite: false` + `NOINK` for clean Raycaster sightlines)
  const glassMat = new THREE.MeshBasicMaterial({ color: "#9ab4b8", transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide });
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.26), glassMat);
  frontGlass.position.set(0.60, 1.56, -2.52);
  frontGlass.layers.set(NOINK);
  const transomGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.28), glassMat);
  transomGlass.position.set(2.24, 2.33, -1.20);
  transomGlass.rotation.y = Math.PI * 0.5;
  transomGlass.layers.set(NOINK);
  group.add(frontGlass, transomGlass);

  // 3. Overhead Room Fluorescent + Exterior Corridor Fluorescent + Gooseneck Desk Lamp
  const roomTube = addFluorescentTube3D(group, [0.0, 3.24, 0.10], 1.20, 0);
  const corridorTube = addFluorescentTube3D(group, [3.55, 3.06, -2.10], 1.20, Math.PI * 0.5);

  const deskLampGroup = new THREE.Group();
  deskLampGroup.name = "deskLamp";
  deskLampGroup.position.set(-0.42, 0.76, -0.10);
  const shadeMat = phong("mnb_lamp_green", () => ({ color: "#234a3a", specular: "#88bca4", shininess: 72, side: THREE.DoubleSide }));
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.75, 1.38, 0.82), toneMapped: false });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.098, 0.032, 12), ironMat);
  lampBase.position.y = 0.016;
  const lampNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.34, 8), brassMat);
  lampNeck.position.set(0.02, 0.18, 0.02);
  lampNeck.rotation.z = -0.22;
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.14, 12, 1, true), shadeMat);
  lampShade.position.set(0.09, 0.33, 0.04);
  lampShade.rotation.z = -0.42;
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), bulbMat);
  lampBulb.position.set(0.09, 0.29, 0.04);
  lampBulb.layers.set(NOINK);
  lampBulb.userData.noSSAO = true;
  deskLampGroup.add(lampBase, lampNeck, lampShade, lampBulb);
  group.add(deskLampGroup);
  const deskLampHalo = addLampHalo3D(group, [-0.33, 1.04, -0.06], 0.46, "#ffd28a", 0.30);

  // 4. Black Bakelite Switchboard Phone (`switchboardPhone`) on right side of desk (`[0.18, 0.76, 0.02]`)
  const switchboardPhone = new THREE.Group();
  switchboardPhone.name = "switchboardPhone";
  switchboardPhone.position.set(0.18, 0.76, 0.02);
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.11, 0.21), bakeliteMat);
  pBody.position.y = 0.055;
  pBody.castShadow = true;
  const pDial = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.018, 14), lam("mnb_dial", () => ({ color: "#888070" })));
  pDial.position.set(0, 0.112, 0.045);
  pDial.rotation.x = 0.36;
  const pDialCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 12), bakeliteMat);
  pDialCenter.position.set(0, 0.116, 0.046);
  pDialCenter.rotation.x = 0.36;
  const phoneBellPivot = new THREE.Group();
  phoneBellPivot.position.set(0, 0.115, -0.055);
  for (const bx of [-0.048, 0.048]) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), brassMat);
    bell.position.set(bx, 0, 0);
    phoneBellPivot.add(bell);
  }
  const handsetOnCradle = new THREE.Group();
  handsetOnCradle.position.set(0, 0.138, -0.02);
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.036), bakeliteMat);
  const hCupL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.030, 0.042, 10), bakeliteMat);
  hCupL.position.set(-0.105, -0.018, 0);
  const hCupR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.030, 0.042, 10), bakeliteMat);
  hCupR.position.set(0.105, -0.018, 0);
  handsetOnCradle.add(hBar, hCupL, hCupR);
  switchboardPhone.add(pBody, pDial, pDialCenter, phoneBellPivot, handsetOnCradle);
  group.add(switchboardPhone);

  // 5. Severed Dusty Phone Cord (`severedPhoneCord`) in 100% open floor space right of desk (`x = 0.72, z = 0.06`)!
  const severedPhoneCord = new THREE.Group();
  severedPhoneCord.name = "severedPhoneCord";
  severedPhoneCord.position.set(0.72, 0.0, 0.06);
  const dustMat = lam("mnb_dust_pile", () => ({ color: "#78736a" }));
  const cordMat = phong("mnb_cord_black", () => ({ color: "#1c1e22", specular: "#555a64", shininess: 32 }));
  const copperMat = phong("mnb_copper_raw", () => ({ color: "#d47a42", specular: "#ffd0a8", shininess: 90 }));
  // Dust patch on tile floor under the severed wire
  const dustPatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.012, 14), dustMat);
  dustPatch.position.set(0.02, 0.006, 0.02);
  // Low telephone terminal box & warning tag facing cleanly up-forward toward Shot 9 camera
  const jackPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.16), lam("mnb_jack_box", () => ({ color: "#686358" })));
  jackPedestal.position.set(0.04, 0.11, -0.08);
  const jackSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.12),
    lam("mnb_jack_sign", () => ({ map: makeJackWarningTexture(), color: "#bdb6a4" })),
  );
  jackSign.position.set(0.04, 0.23, 0.0);
  jackSign.rotation.x = -0.52;
  // Upper cord dangling down from right edge of desk and ending mid-air / on dust patch cleanly severed!
  const danglingCord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), cordMat);
  danglingCord.position.set(-0.18, 0.42, -0.02);
  danglingCord.rotation.z = 0.34;
  const severedStubFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8), cordMat);
  severedStubFloor.position.set(-0.04, 0.022, 0.05);
  severedStubFloor.rotation.z = Math.PI * 0.48;
  severedStubFloor.rotation.y = 0.25;
  const severedStubBox = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), cordMat);
  severedStubBox.position.set(0.08, 0.06, 0.03);
  severedStubBox.rotation.z = -1.15;
  // Splayed bare copper strands + thick white dust coating on cut ends
  for (const [ox, oy, oz, rz] of [
    [0.06, 0.028, 0.07, 1.3],
    [0.07, 0.038, 0.05, 1.0],
    [0.02, 0.032, 0.04, -1.2],
  ] as const) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.055, 6), copperMat);
    wire.position.set(ox, oy, oz);
    wire.rotation.z = rz;
    severedPhoneCord.add(wire);
  }
  severedPhoneCord.add(dustPatch, jackPedestal, jackSign, danglingCord, severedStubFloor, severedStubBox);
  group.add(severedPhoneCord);

  // 6. Brass Wall Pendulum Clock (`wallPendulumClock`) on left wall (`[-2.18, 1.62, -0.32]`, facing `+X`)
  const wallPendulumClock = new THREE.Group();
  wallPendulumClock.name = "wallPendulumClock";
  wallPendulumClock.position.set(-2.20, 1.62, -0.32);
  wallPendulumClock.rotation.y = Math.PI * 0.5;
  const clockCase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.14), trimMat);
  clockCase.castShadow = true;
  const clockDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.155, 24),
    lam("mnb_clock_dial", () => ({ map: makeClockDialTexture(), color: "#ffffff" })),
  );
  clockDial.position.set(0, 0.16, 0.074);
  const lowerRecess = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.04), lam("mnb_clock_well", () => ({ color: "#14100d" })));
  lowerRecess.position.set(0, -0.16, 0.055);
  const pendulumPivot = new THREE.Group();
  pendulumPivot.position.set(0, 0.02, 0.082);
  const pRod = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.26, 0.008), brassMat);
  pRod.position.y = -0.13;
  const pBob = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.018, 16).rotateX(Math.PI * 0.5), brassMat);
  pBob.position.y = -0.26;
  pendulumPivot.add(pRod, pBob);
  wallPendulumClock.add(clockCase, clockDial, lowerRecess, pendulumPivot);
  group.add(wallPendulumClock);

  // 7. Wooden Room-Key Cabinet Board (`keyBoardGroup` + swaying `keyTag204`) on front wall left (`[-1.38, 1.48, -2.42]`)
  const keyBoardGroup = new THREE.Group();
  keyBoardGroup.name = "keyBoardGroup";
  keyBoardGroup.position.set(-1.38, 1.48, -2.42);
  const kbBack = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.05), trimMat);
  const kbHeader = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.18),
    lam("mnb_kb_hdr", () => ({ map: makeBoardHeaderTexture(), color: "#ffffff" })),
  );
  kbHeader.position.set(0, 0.15, 0.028);
  keyBoardGroup.add(kbBack, kbHeader);

  const hookXs = [-0.27, -0.09, 0.09, 0.27];
  hookXs.forEach((hx, idx) => {
    const hookPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateX(Math.PI * 0.5), brassMat);
    hookPin.position.set(hx, 0.01, 0.045);
    keyBoardGroup.add(hookPin);
    if (idx < 2) {
      // Static green tags on 201 & 202 (203 empty, 204 is animated `keyTag204`!)
      const stTag = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.19, 0.014),
        lam(`mnb_tag_${idx}`, () => ({ map: makeKeyTagTexture(`20${idx + 1}`, false), color: "#ffffff" })),
      );
      stTag.position.set(hx, -0.10, 0.055);
      keyBoardGroup.add(stTag);
    }
  });

  const keyTag204 = new THREE.Group();
  keyTag204.name = "keyTag204";
  keyTag204.position.set(0.27, 0.01, 0.058);
  const ring204 = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 12), brassMat);
  ring204.position.y = -0.022;
  const tagMesh204 = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.22, 0.016),
    lam("mnb_tag_204", () => ({ map: makeKeyTagTexture("204", true), color: "#ffffff" })),
  );
  tagMesh204.position.set(0, -0.145, 0);
  const brassKey204 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.11, 0.008), brassMat);
  brassKey204.position.set(0.072, -0.095, 0.004);
  keyTag204.add(ring204, tagMesh204, brassKey204);
  keyBoardGroup.add(keyTag204);
  group.add(keyBoardGroup);

  // 8. Hinged Corridor Transom Door (`corridorDoor`) + Heavy Iron Slide Bolt (`corridorBolt`) on right wall (`x=2.22, z=-1.68`)
  const corridorDoor = new THREE.Group();
  corridorDoor.name = "corridorDoor";
  corridorDoor.position.set(2.24, 0, -1.68);
  // Lower solid wood panel + upper frosted window stile so Bà Hạnh is visible walking down corridor!
  const dLow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.18, 0.94), woodMat);
  dLow.position.set(0, 0.59, 0.47);
  const dStileL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.94, 0.14), trimMat);
  dStileL.position.set(0, 1.65, 0.07);
  const dStileR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.94, 0.14), trimMat);
  dStileR.position.set(0, 1.65, 0.87);
  const dRailTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.94), trimMat);
  dRailTop.position.set(0, 2.05, 0.47);
  const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.80), glassMat);
  dGlass.position.set(0, 1.58, 0.47);
  dGlass.rotation.y = Math.PI * 0.5;
  dGlass.layers.set(NOINK);
  const boltHousing = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.38), ironMat);
  boltHousing.position.set(-0.045, 1.06, 0.74);
  const corridorBolt = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.052, 0.34), brassMat);
  corridorBolt.name = "corridorBolt";
  corridorBolt.position.set(-0.052, 1.06, 0.62); // slides from 0.62 (open) -> 0.86 (locked into jamb!)
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 8), brassMat);
  boltKnob.position.set(-0.032, 0, -0.08);
  corridorBolt.add(boltKnob);
  corridorDoor.add(dLow, dStileL, dStileR, dRailTop, dGlass, boltHousing, corridorBolt);
  group.add(corridorDoor);

  // Jamb receiver bracket on stationary right wall (`z = -0.70`)
  const jambKeeper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.09), ironMat);
  jambKeeper.position.set(2.19, 1.06, -0.70);
  group.add(jambKeeper);

  // Subtle lived-in decay details & AO grounding
  addWallSwitch3D(group, [2.17, 1.32, -0.45], -Math.PI * 0.5);
  addPeelingPaperDecal3D(group, [-0.55, 1.68, -2.42], [0, 0, 0.02], {
    width: 0.40,
    height: 0.54,
    header: "NỘI QUY KHU B2",
    subtext: "NIÊM PHONG P.204",
    biohazard: false,
    seed: 17,
  });
  addCobwebCluster3D(group, [-2.18, 2.95, -2.38], [0, 0.25, 0], 0.62, 0.45);
  addFloorCornerAO(group, -2.22, 2.18, -2.44, 2.52, 0.004, 0.42, 0.50);
  addContactShadow(group, [-0.11, 0.004, 0.05], 1.45, 0.92, 0.65);

  const dust = addDustMotes(group, [0, 1.5, 0], [4.0, 2.4, 4.4], 32, 41, "#d8dec8");

  return {
    group,
    roomTube,
    corridorTube,
    deskLampGroup,
    deskLampHalo,
    switchboardPhone,
    handsetOnCradle,
    phoneBellPivot,
    severedPhoneCord,
    wallPendulumClock,
    pendulumPivot,
    keyBoardGroup,
    keyTag204,
    corridorDoor,
    corridorBolt,
    dust,
  };
}
