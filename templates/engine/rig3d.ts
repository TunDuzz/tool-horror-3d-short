// Horror Engine v3: Articulated 3D Stylized Dark-Horror Character & Uncanny Entity Rig.
// Non-chibi adult proportions (~5.6 head-heights), sculpted angular jaw/cheekbones, 3D nose bridge,
// layered 3D hair, 20 named bone sockets, clean UV garment folds, smooth Inverted-Hull outlines on NOINK,
// animated clean-line 2D curved face decal, and uncanny supernatural EntityConfig modifiers.

import * as THREE from "three";
import { FPS, uncannyTime, uncannyTwitch, type V3 } from "./camera";
import { NOINK } from "./ink";
import type { FaceExpr, PoseAction } from "./manifest";
import { attachOutlineRig } from "./outline3d";
import { stylizedShade } from "./shade";
import { FaceTextureCache, type FaceSpec, type MouthShape } from "./face2d";

export type HairStyle =
  | "shortParted"
  | "spiky"
  | "elderThin"
  | "bun"
  | "longDraped"
  | "messyFringe"
  | "bald";

export type GarmentStyle =
  | "funeralRobe"
  | "shirt"
  | "coat"
  | "hospitalGown"
  | "casualJacket"
  | "shroud";

export type EntityConfig = {
  heightScale?: number; // e.g. 1.15 - 1.25 tall looming silhouette
  gauntness?: number; // 0.70 - 0.88 slender bone-thin limbs/torso
  armScale?: number; // 1.15 - 1.32 unnaturally long arms
  fingerScale?: number; // 1.25 - 1.45 spidery elongated fingers
  neckTiltDeg?: number; // +-20..38 deg broken-neck angle
  shoulderSkew?: number; // +-0.12 rad uneven shoulders
  hairCurtain?: boolean; // long dark 3D strands draping across face
  silhouetteMode?: boolean; // near-black charcoal figure for deep-shadow reveals
  eyeGlow?: boolean; // HDR emissive pinpoint eyes piercing pitch dark
  eyeGlowColor?: [number, number, number];
  breathing?: boolean; // false = uncanny dead stillness
  steppedFps?: number; // optional subtle stepped motion (e.g. 8-10 fps)
};

export type CharacterConfig = {
  id: string;
  height?: number; // target standing height in metres (default 1.72)
  skinCol?: string;
  hairCol?: string;
  hairStyle?: HairStyle;
  topCol?: string;
  bottomCol?: string;
  shoeCol?: string;
  garment?: GarmentStyle;
  headbandCol?: string; // e.g. white funeral headband (khăn tang)
  outlinePx?: number; // default 5.8
  entity?: EntityConfig;
};

export type RigSockets = {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightShoulder: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftThigh: THREE.Group;
  leftCalf: THREE.Group;
  leftFoot: THREE.Group;
  rightThigh: THREE.Group;
  rightCalf: THREE.Group;
  rightFoot: THREE.Group;
};

export type PoseEvalOpts = {
  expr?: FaceExpr;
  mouth?: MouthShape;
  gazeX?: number;
  gazeY?: number;
  lid?: number;
  pupilScale?: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  twitch?: boolean;
  seed?: number;
};

export type Character3D = {
  group: THREE.Group;
  sockets: RigSockets;
  config: CharacterConfig;
  setFace: (spec: FaceSpec) => void;
  setPose: (action: PoseAction, frame: number, opts?: PoseEvalOpts) => void;
  lookAtWorld: (target: V3, weight?: number) => void;
  dispose: () => void;
};

/** Generate clean hand-painted garment fold & collar/cuff seam UV texture (zero messy hatching). */
function makeGarmentTex(baseHex: string, garment: GarmentStyle): THREE.CanvasTexture | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext("2d");
  if (!g) return null;

  g.fillStyle = baseHex;
  g.fillRect(0, 0, 512, 512);

  // Soft vertical cloth shading folds
  for (let i = 0; i < 6; i++) {
    const x = 42 + i * 86;
    const gr = g.createLinearGradient(x - 24, 0, x + 24, 0);
    gr.addColorStop(0, "rgba(18,14,24,0)");
    gr.addColorStop(0.5, "rgba(18,14,24,0.11)");
    gr.addColorStop(1, "rgba(18,14,24,0)");
    g.fillStyle = gr;
    g.fillRect(x - 24, 0, 48, 512);
  }

  // Clean front seam / diagonal Vietnamese funeral lapel / button placket
  g.strokeStyle = "rgba(14,10,18,0.52)";
  g.lineWidth = 4;
  g.lineCap = "round";
  if (garment === "funeralRobe" || garment === "shroud") {
    // Diagonal front lapel seam + subtle raw-hem stitch marks at bottom
    g.beginPath();
    g.moveTo(256, 36);
    g.quadraticCurveTo(232, 130, 174, 210);
    g.lineTo(174, 490);
    g.stroke();
    g.strokeStyle = "rgba(14,10,18,0.34)";
    g.lineWidth = 2.5;
    for (let x = 14; x < 500; x += 16) {
      g.beginPath();
      g.moveTo(x, 476);
      g.lineTo(x + (x % 32 === 0 ? 3 : -2), 506);
      g.stroke();
    }
  } else if (garment === "shirt" || garment === "coat" || garment === "casualJacket") {
    g.beginPath();
    g.moveTo(256, 20);
    g.lineTo(256, 500);
    g.stroke();
    g.fillStyle = "rgba(14,10,18,0.55)";
    for (let y = 90; y < 440; y += 78) {
      g.beginPath();
      g.arc(244, y, 5, 0, Math.PI * 2);
      g.fill();
    }
  } else if (garment === "hospitalGown") {
    g.strokeStyle = "rgba(40,68,74,0.22)";
    g.lineWidth = 3;
    for (let y = 40; y < 512; y += 44) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Sculpted non-chibi adult head geometry: angular tapered jaw, subtle cheekbones, distinct cranium. */
function buildSculptedHeadGeo(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 20, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Taper lower jaw & chin cleanly (non-chibi adult silhouette)
    if (y < 0) {
      const jawT = Math.min(1, -y);
      x *= 1 - 0.34 * jawT * jawT;
      z *= 1 - 0.14 * jawT;
      if (z > 0) z += 0.08 * jawT * (1 - Math.abs(x)); // defined chin point
    } else {
      // Slightly fuller cranium & subtle temple flattening
      x *= 0.96 + 0.05 * Math.sin(y * Math.PI);
    }
    // Slight brow ridge overhang on upper front
    if (y > 0.18 && y < 0.42 && z > 0.4) {
      z += 0.045 * Math.sin(((y - 0.18) / 0.24) * Math.PI);
    }
    pos.setXYZ(i, x * rx, y * ry, z * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Curved spherical-patch decal hugging the sculpted front face (prevents flat-plane cheek clipping). */
function buildCurvedFacePatchGeo(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const segU = 14, segV = 12;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const azMax = 0.88; // ~50 deg left/right so almond eyes & brows fill the sculpted face naturally
  const elMin = -0.64; // chin/mouth
  const elMax = 0.46; // forehead below hairline
  const pad = 1.024;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 bottom, 1 top
    const el = elMin + (elMax - elMin) * v;
    const cosEl = Math.cos(el);
    const sinEl = Math.sin(el);
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU; // 0 left, 1 right
      const az = -azMax + 2 * azMax * u;
      let sx = Math.sin(az) * cosEl;
      const sy = sinEl;
      let sz = Math.cos(az) * cosEl;

      // Match the exact jaw taper of buildSculptedHeadGeo
      if (sy < 0) {
        const jawT = Math.min(1, -sy);
        sx *= 1 - 0.34 * jawT * jawT;
        sz *= 1 - 0.14 * jawT;
        if (sz > 0) sz += 0.08 * jawT * (1 - Math.abs(sx));
      } else {
        sx *= 0.96 + 0.05 * Math.sin(sy * Math.PI);
      }

      const px = sx * rx * pad;
      const py = sy * ry * pad;
      const pz = sz * rz * pad;
      positions.push(px, py, pz);
      const len = Math.hypot(sx, sy, sz) || 1;
      normals.push(sx / len, sy / len, sz / len);
      uvs.push(u, v);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** Tapered stylized limb capsule (origin at top joint y = 0, extending downward to y = -len). */
function buildTaperedLimbGeo(rTop: number, rBot: number, len: number, segs = 10): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const capSteps = 4;
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len - Math.cos(a) * rBot * 0.65));
  }
  pts.push(new THREE.Vector2(rBot * 0.96, -len * 0.72));
  pts.push(new THREE.Vector2((rTop + rBot) * 0.54, -len * 0.35));
  pts.push(new THREE.Vector2(rTop, -len * 0.06));
  for (let i = 1; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, Math.sin(a) * rTop * 0.65));
  }
  return new THREE.LatheGeometry(pts, segs);
}

/** Build anatomical 3D hair meshes on the head socket. */
function buildHairMeshes(
  parent: THREE.Group,
  style: HairStyle,
  mat: THREE.Material,
  rx: number,
  ry: number,
  rz: number,
  hairCurtain: boolean,
): THREE.Mesh[] {
  const created: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1], name = "hair") => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.scale.set(...scl);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    created.push(m);
    return m;
  };

  if (style === "bald" && !hairCurtain) return created;

  // Base sculpted hair cap tilted BACKWARD so front hairline sits high on forehead (NEVER covering eyes!)
  // while the back rim drops down cleanly over the occiput.
  const cap = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
  add(cap, [0, ry * 0.14, -rz * 0.08], [-0.46, 0, 0], [rx * 1.07, ry * 1.02, rz * 1.09], "hairCap");

  // Clean rear nape coverage strictly behind the ears (Three.js theta=PI is -Z back, theta=0 is +Z front!)
  const backNape = new THREE.CylinderGeometry(rx * 0.96, rx * 0.80, ry * 0.78, 12, 1, false, Math.PI * 0.56, Math.PI * 0.88);
  add(backNape, [0, -ry * 0.14, -rz * 0.10], [0.06, 0, 0], [1.02, 1, 0.94], "hairNape");

  if (style === "shortParted") {
    // Clean adult side-parted hair volume perched strictly above forehead hairline + subtle sideburns
    add(new THREE.SphereGeometry(1, 12, 10), [-rx * 0.24, ry * 0.84, rz * 0.24], [0.12, 0.14, 0.20], [rx * 0.72, ry * 0.28, rz * 0.54], "hairFringeL");
    add(new THREE.SphereGeometry(1, 12, 10), [rx * 0.44, ry * 0.80, rz * 0.18], [0.10, -0.18, -0.24], [rx * 0.54, ry * 0.26, rz * 0.48], "hairFringeR");
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.014, ry * 0.52, 0.026), [s * rx * 0.96, ry * 0.18, rz * 0.12], [0, 0, s * 0.06], [1, 1, 1], s < 0 ? "sideburnL" : "sideburnR");
    }
  } else if (style === "spiky") {
    const tufts: [V3, V3, V3][] = [
      [[0, ry * 1.10, 0.0], [-0.15, 0, 0], [0.042, 0.11, 0.042]],
      [[-0.048, ry * 1.02, 0.0], [-0.10, 0, 0.38], [0.036, 0.095, 0.036]],
      [[0.048, ry * 1.02, 0.0], [-0.08, 0, -0.38], [0.036, 0.095, 0.036]],
      [[-0.03, ry * 1.04, -0.04], [-0.36, 0, 0.22], [0.034, 0.09, 0.034]],
      [[0.03, ry * 1.04, -0.04], [-0.36, 0, -0.22], [0.034, 0.09, 0.034]],
    ];
    for (const [p, r, s] of tufts) add(new THREE.ConeGeometry(1, 1, 6), p, r, s, "hairTuft");
  } else if (style === "bun") {
    add(new THREE.SphereGeometry(rx * 0.58, 12, 10), [0, -ry * 0.06, -rz * 1.24], [0, 0, 0], [1.05, 0.92, 0.92], "hairBun");
  } else if (style === "messyFringe") {
    add(new THREE.SphereGeometry(1, 14, 10), [0, ry * 0.76, rz * 0.04], [-0.14, 0, 0], [rx * 1.10, ry * 0.44, rz * 0.96], "hairCrown");
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.018, ry * 0.68, 0.044), [s * rx * 0.98, ry * 0.14, rz * 0.04], [0, 0, s * 0.08], [1, 1, 1], s < 0 ? "sideburnL" : "sideburnR");
    }
    for (let i = 0; i < 5; i++) {
      const u = (i - 2) / 2;
      const m = add(
        new THREE.ConeGeometry(0.026, 0.095 + (i % 2) * 0.028, 5),
        [u * rx * 0.74, ry * 0.56 - Math.abs(u) * 0.02, rz * 0.82 - Math.abs(u) * 0.06],
        [Math.PI + 0.18, 0, u * 0.26],
        [1, 1, 0.45],
        `hairBang_${i}`,
      );
      m.userData.noOutline = true;
    }
  } else if (style === "longDraped") {
    // Flowing rear hair sheet strictly behind head (-Z) + tapered side locks draping past jaw/shoulders
    add(
      new THREE.CylinderGeometry(rx * 1.06, rx * 1.28, 0.46, 14, 1, false, Math.PI * 0.54, Math.PI * 0.92),
      [0, -0.18, -rz * 0.14],
      [0.08, 0, 0],
      [1.04, 1, 0.92],
      "hairBackCurtain",
    );
    for (const s of [-1, 1]) {
      add(
        new THREE.ConeGeometry(0.036, 0.42, 7),
        [s * rx * 0.98, -0.14, rz * 0.16],
        [Math.PI + 0.04, 0, s * -0.12],
        [0.72, 1, 1.15],
        s < 0 ? "hairSideL" : "hairSideR",
      );
    }
  }

  // Uncanny entity hanging hair curtain: organic parted curved locks (noOutline on inner wisps -> no comb/piano-key bars!)
  if (hairCurtain) {
    const strands: Array<[number, number, number, number]> = [
      [-0.88, 0.36, 0.12, 0.024],
      [-0.58, 0.30, 0.06, 0.020],
      [-0.14, 0.21, -0.04, 0.015], // thin center wisp between eyes
      [0.56, 0.32, -0.07, 0.021],
      [0.86, 0.38, -0.13, 0.024],
    ];
    strands.forEach(([u, len, tiltZ, rad], i) => {
      const m = add(
        new THREE.ConeGeometry(rad, len, 6),
        [u * rx * 0.88, ry * 0.52 - len * 0.46, rz * 0.86 - Math.abs(u) * 0.14],
        [Math.PI + 0.06, 0, tiltZ],
        [1, 1, 0.38],
        `hairCurtain_${i}`,
      );
      // Inner face-framing wisps skip BackSide hull so they read as sharp dark hair locks rather than thick blocks
      if (Math.abs(u) < 0.75) m.userData.noOutline = true;
    });
  }

  return created;
}

/** Build an articulated 3D stylized dark-horror humanoid or supernatural entity. */
export function createCharacter3D(cfg: CharacterConfig): Character3D {
  const ent = cfg.entity;
  const hScale = (cfg.height ?? 1.72) / 1.72 * (ent?.heightScale ?? 1.0);
  const gaunt = ent?.gauntness ?? 1.0;
  const armS = ent?.armScale ?? 1.0;
  const fingerS = ent?.fingerScale ?? 1.0;
  const isSil = !!ent?.silhouetteMode;

  const skinHex = isSil ? "#11121a" : (cfg.skinCol ?? "#cbb6a0");
  const hairHex = isSil ? "#090a10" : (cfg.hairCol ?? "#16141b");
  const topHex = isSil ? "#0e0f17" : (cfg.topCol ?? "#d8d1c2");
  const botHex = isSil ? "#0b0c12" : (cfg.bottomCol ?? "#1d1e28");
  const shoeHex = isSil ? "#09090e" : (cfg.shoeCol ?? "#16141a");
  const garment: GarmentStyle = cfg.garment ?? "shirt";

  const disposables: Array<{ dispose(): void }> = [];
  const faceCache = new FaceTextureCache();
  const garmentTex = isSil ? null : makeGarmentTex(topHex, garment);
  if (garmentTex) disposables.push(garmentTex);

  const skinMat = stylizedShade(new THREE.MeshLambertMaterial({ color: skinHex }));
  const hairMat = stylizedShade(new THREE.MeshLambertMaterial({ color: hairHex }));
  const topMat = stylizedShade(new THREE.MeshLambertMaterial({ color: garmentTex ? "#ffffff" : topHex, map: garmentTex }));
  const botMat = stylizedShade(new THREE.MeshLambertMaterial({ color: botHex }));
  const shoeMat = stylizedShade(new THREE.MeshLambertMaterial({ color: shoeHex }));
  disposables.push(skinMat, hairMat, topMat, botMat, shoeMat);

  // Core 1.72m adult measurements (non-chibi: head height 0.245m -> height/headH ~5.8-6.4)
  const thighLen = 0.42 * hScale;
  const calfLen = 0.42 * hScale;
  const footH = 0.06 * hScale;
  const hipY = thighLen + calfLen + footH; // ~0.90m standing pelvis height
  const spineLen = 0.24 * hScale;
  const chestLen = 0.24 * hScale;
  const neckLen = 0.08 * hScale;
  const headRx = 0.092 * hScale * (0.9 + 0.1 * gaunt);
  const headRy = 0.122 * hScale; // total head height = 0.244m
  const headRz = 0.104 * hScale;
  const shoulderW = 0.164 * hScale * gaunt;
  const upperArmLen = 0.285 * hScale * armS;
  const forearmLen = 0.265 * hScale * armS;

  const mkGroup = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    return g;
  };
  const mkMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const root = mkGroup(`char_${cfg.id}`);
  const pelvis = mkGroup("pelvis");
  pelvis.position.set(0, hipY, 0);
  root.add(pelvis);

  const spine = mkGroup("spine");
  spine.position.set(0, 0.06 * hScale, 0);
  pelvis.add(spine);

  const chest = mkGroup("chest");
  chest.position.set(0, spineLen, 0);
  spine.add(chest);

  const neck = mkGroup("neck");
  neck.position.set(0, chestLen, 0);
  chest.add(neck);

  const head = mkGroup("head");
  head.position.set(0, neckLen + headRy * 0.72, 0);
  neck.add(head);

  // Pelvis / hips geometry
  const pelvisGeo = new THREE.SphereGeometry(0.132 * hScale * gaunt, 12, 10);
  pelvisGeo.scale(1.12, 0.78, 0.78);
  pelvis.add(mkMesh(pelvisGeo, botMat, "pelvisMesh"));

  // Sculpted torso with natural sloping shoulder yoke & trapezius (blends cleanly into arms!)
  const torsoPts = [
    new THREE.Vector2(0.01, -0.02 * hScale),
    new THREE.Vector2(0.132 * hScale * gaunt, 0.0),
    new THREE.Vector2(0.122 * hScale * gaunt, 0.13 * hScale),
    new THREE.Vector2(0.172 * hScale * gaunt, 0.34 * hScale),
    new THREE.Vector2(0.162 * hScale * gaunt, 0.42 * hScale),
    new THREE.Vector2(0.118 * hScale * gaunt, 0.468 * hScale),
    new THREE.Vector2(0.062 * hScale * gaunt, 0.492 * hScale),
    new THREE.Vector2(0.01, 0.50 * hScale),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 16);
  torsoGeo.scale(1.12, 1, 0.65);
  const torsoMesh = mkMesh(torsoGeo, topMat, "torsoMesh");
  spine.add(torsoMesh);

  // Tailored 3D garment collar ring + waist belt/sash for clear silhouette separation from neck/skin
  if (!isSil) {
    const collarCol = new THREE.Color(topHex).multiplyScalar(0.76);
    const collarMat = stylizedShade(new THREE.MeshLambertMaterial({ color: collarCol }));
    disposables.push(collarMat);
    const collarGeo = new THREE.CylinderGeometry(0.068 * hScale * gaunt, 0.088 * hScale * gaunt, 0.048 * hScale, 14);
    collarGeo.scale(1.06, 1, 0.92);
    const collar = mkMesh(collarGeo, collarMat, "garmentCollar");
    collar.position.set(0, 0.478 * hScale, 0.004 * hScale);
    spine.add(collar);

    if (garment === "funeralRobe" || garment === "coat" || garment === "shirt") {
      const beltGeo = new THREE.CylinderGeometry(0.132 * hScale * gaunt, 0.136 * hScale * gaunt, 0.036 * hScale, 14);
      beltGeo.scale(1.12, 1, 0.68);
      const belt = mkMesh(beltGeo, botMat, "waistBelt");
      belt.position.set(0, 0.04 * hScale, 0);
      spine.add(belt);
    }
  }

  // Long robe/coat/shroud lower skirt flare attached to pelvis
  if (garment === "funeralRobe" || garment === "coat" || garment === "hospitalGown" || garment === "shroud") {
    const hemLen = garment === "shroud" ? 0.52 * hScale : 0.34 * hScale;
    const skirtGeo = new THREE.CylinderGeometry(0.145 * hScale * gaunt, 0.195 * hScale * gaunt, hemLen, 14, 1, false);
    skirtGeo.scale(1.05, 1, 0.72);
    const skirt = mkMesh(skirtGeo, topMat, "garmentSkirt");
    skirt.position.set(0, -hemLen * 0.42, 0);
    pelvis.add(skirt);
  }

  // Slender neck
  const neckGeo = new THREE.CylinderGeometry(0.044 * hScale * gaunt, 0.052 * hScale * gaunt, neckLen * 1.45, 10);
  const neckMesh = mkMesh(neckGeo, skinMat, "neckMesh");
  neckMesh.position.set(0, neckLen * 0.48, 0);
  neck.add(neckMesh);

  // Sculpted head + protruding 3D nose bridge + thin 3D ears
  const headGeo = buildSculptedHeadGeo(headRx, headRy, headRz);
  head.add(mkMesh(headGeo, skinMat, "headMesh"));

  // Narrow tapered 3D nose bridge (NOT a chibi round sphere!)
  const noseGeo = new THREE.ConeGeometry(0.016 * hScale, 0.056 * hScale, 4);
  noseGeo.rotateY(Math.PI * 0.25);
  noseGeo.scale(0.75, 1.0, 1.05);
  const noseMesh = mkMesh(noseGeo, skinMat, "noseMesh");
  noseMesh.position.set(0, -0.008 * hScale, headRz * 0.96);
  noseMesh.rotation.x = 0.24;
  head.add(noseMesh);

  // Ears
  for (const side of [-1, 1] as const) {
    const earGeo = new THREE.SphereGeometry(0.022 * hScale, 8, 8);
    earGeo.scale(0.42, 1.25, 0.72);
    const ear = mkMesh(earGeo, skinMat, side < 0 ? "earL" : "earR");
    ear.position.set(side * headRx * 0.96, -0.006 * hScale, -0.008 * hScale);
    head.add(ear);
  }

  // Curved 2D face decal hugging sculpted head (excluded from outline, receives scene light!)
  const faceGeo = buildCurvedFacePatchGeo(headRx, headRy, headRz);
  const faceMat = stylizedShade(
    new THREE.MeshLambertMaterial({
      map: faceCache.get({ expr: "calm", skinCol: skinHex }),
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  disposables.push(faceGeo, faceMat);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.name = "faceDecal";
  faceMesh.userData.noOutline = true;
  faceMesh.layers.set(NOINK);
  faceMesh.visible = !isSil;
  head.add(faceMesh);

  // Optional HDR glowing pinpoint eyes for uncanny silhouette entities
  const eyeGlowGroup = mkGroup("eyeGlowGroup");
  if (ent?.eyeGlow) {
    const [er, eg, eb] = ent.eyeGlowColor ?? [2.3, 2.45, 2.8];
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(er, eg, eb), toneMapped: false });
    disposables.push(glowMat);
    for (const s of [-1, 1]) {
      const egGeo = new THREE.SphereGeometry(0.011 * hScale, 8, 6);
      egGeo.scale(1.35, 0.58, 0.45);
      disposables.push(egGeo);
      const em = new THREE.Mesh(egGeo, glowMat);
      em.name = s < 0 ? "eyeGlowL" : "eyeGlowR";
      em.userData.noOutline = true;
      em.userData.isEyeGlow = true;
      em.position.set(s * headRx * 0.36, 0.015 * hScale, headRz * 1.01);
      em.layers.set(NOINK);
      eyeGlowGroup.add(em);
    }
  }
  head.add(eyeGlowGroup);

  // 3D layered hair + optional funeral headband (khăn tang)
  buildHairMeshes(head, cfg.hairStyle ?? "shortParted", hairMat, headRx, headRy, headRz, !!ent?.hairCurtain);
  if (cfg.headbandCol && !isSil) {
    const bandMat = stylizedShade(new THREE.MeshLambertMaterial({ color: cfg.headbandCol }));
    disposables.push(bandMat);
    const bandGeo = new THREE.TorusGeometry(headRx * 1.05, 0.015 * hScale, 8, 22);
    bandGeo.rotateX(Math.PI * 0.5);
    bandGeo.scale(1.0, 1.25, headRz / headRx);
    const band = mkMesh(bandGeo, bandMat, "headband");
    band.position.set(0, headRy * 0.54, -headRz * 0.04);
    band.rotation.x = -0.18;
    head.add(band);
  }

  // Arms & hands (15-bone upper body — seated smoothly inside shoulder slope, never popped-out balloons!)
  const buildArm = (side: -1 | 1) => {
    const pfx = side < 0 ? "left" : "right";
    const shoulder = mkGroup(`${pfx}Shoulder`);
    const skewY = (ent?.shoulderSkew ?? 0) * side * 0.06;
    shoulder.position.set(side * shoulderW, chestLen * 0.72 + skewY, 0);
    chest.add(shoulder);

    const upperArm = mkGroup(`${pfx}UpperArm`);
    shoulder.add(upperArm);
    const shCapGeo = new THREE.SphereGeometry(0.040 * hScale * gaunt, 10, 8);
    shCapGeo.scale(1.05, 0.85, 0.95);
    const shBall = mkMesh(shCapGeo, topMat, `${pfx}ShoulderCap`);
    shBall.position.set(-side * 0.008 * hScale, -0.008 * hScale, 0);
    upperArm.add(shBall);
    upperArm.add(mkMesh(buildTaperedLimbGeo(0.040 * hScale * gaunt, 0.032 * hScale * gaunt, upperArmLen), topMat, `${pfx}UpperArmMesh`));

    const forearm = mkGroup(`${pfx}Forearm`);
    forearm.position.set(0, -upperArmLen, 0);
    upperArm.add(forearm);
    const sleeveMat = garment === "shirt" || garment === "hospitalGown" ? skinMat : topMat;
    forearm.add(mkMesh(buildTaperedLimbGeo(0.036 * hScale * gaunt, 0.028 * hScale * gaunt, forearmLen), sleeveMat, `${pfx}ForearmMesh`));

    const hand = mkGroup(`${pfx}Hand`);
    hand.position.set(0, -forearmLen, 0);
    forearm.add(hand);

    // Slender horror palm + thumb + 4 tapered fingers
    const palmGeo = new THREE.BoxGeometry(0.042 * hScale * gaunt, 0.068 * hScale * fingerS, 0.022 * hScale);
    const palm = mkMesh(palmGeo, skinMat, `${pfx}Palm`);
    palm.position.set(0, -0.034 * hScale * fingerS, 0);
    hand.add(palm);

    const fLen = 0.062 * hScale * fingerS;
    for (let fi = 0; fi < 4; fi++) {
      const fGeo = new THREE.CapsuleGeometry(0.0065 * hScale * gaunt, fLen, 4, 6);
      const fm = mkMesh(fGeo, skinMat, `${pfx}Finger_${fi}`);
      fm.position.set((fi - 1.5) * 0.011 * hScale * gaunt, -0.068 * hScale * fingerS - fLen * 0.42, 0.004 * hScale);
      fm.rotation.x = 0.16;
      hand.add(fm);
    }
    const thumbGeo = new THREE.CapsuleGeometry(0.0075 * hScale * gaunt, fLen * 0.65, 4, 6);
    const thumb = mkMesh(thumbGeo, skinMat, `${pfx}Thumb`);
    thumb.position.set(-side * 0.026 * hScale * gaunt, -0.046 * hScale * fingerS, 0.014 * hScale);
    thumb.rotation.set(0.28, 0, -side * 0.42);
    hand.add(thumb);

    return { shoulder, upperArm, forearm, hand };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs & shoes
  const buildLeg = (side: -1 | 1) => {
    const pfx = side < 0 ? "left" : "right";
    const thigh = mkGroup(`${pfx}Thigh`);
    thigh.position.set(side * 0.095 * hScale * gaunt, -0.02 * hScale, 0);
    pelvis.add(thigh);
    thigh.add(mkMesh(buildTaperedLimbGeo(0.068 * hScale * gaunt, 0.048 * hScale * gaunt, thighLen), botMat, `${pfx}ThighMesh`));

    const calf = mkGroup(`${pfx}Calf`);
    calf.position.set(0, -thighLen, 0);
    thigh.add(calf);
    calf.add(mkMesh(buildTaperedLimbGeo(0.048 * hScale * gaunt, 0.034 * hScale * gaunt, calfLen), botMat, `${pfx}CalfMesh`));

    const foot = mkGroup(`${pfx}Foot`);
    foot.position.set(0, -calfLen, 0);
    calf.add(foot);
    const shoeGeo = new THREE.CapsuleGeometry(0.036 * hScale, 0.12 * hScale, 5, 8);
    shoeGeo.rotateX(Math.PI * 0.5);
    shoeGeo.scale(0.95, 0.68, 1.0);
    const shoe = mkMesh(shoeGeo, shoeMat, `${pfx}ShoeMesh`);
    shoe.position.set(0, -footH * 0.45, 0.045 * hScale);
    foot.add(shoe);

    return { thigh, calf, foot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  const sockets: RigSockets = {
    root,
    pelvis,
    spine,
    chest,
    neck,
    head,
    leftShoulder: leftArm.shoulder,
    leftUpperArm: leftArm.upperArm,
    leftForearm: leftArm.forearm,
    leftHand: leftArm.hand,
    rightShoulder: rightArm.shoulder,
    rightUpperArm: rightArm.upperArm,
    rightForearm: rightArm.forearm,
    rightHand: rightArm.hand,
    leftThigh: leftLeg.thigh,
    leftCalf: leftLeg.calf,
    leftFoot: leftLeg.foot,
    rightThigh: rightLeg.thigh,
    rightCalf: rightLeg.calf,
    rightFoot: rightLeg.foot,
  };

  // Attach smooth-normal Inverted-Hull outlines to every bone mesh and enforce NOINK layer across entire rig
  const outlineMeshes = attachOutlineRig(root, { pxWidth: cfg.outlinePx ?? 5.8, color: "#06060a" });
  for (const ol of outlineMeshes) disposables.push(ol.geometry);

  const setFace = (spec: FaceSpec) => {
    if (isSil) return;
    const tex = faceCache.get({ skinCol: skinHex, ...spec });
    if (faceMat.map !== tex) {
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    }
  };

  const resetPose = () => {
    pelvis.position.set(0, hipY, 0);
    pelvis.rotation.set(0, 0, 0);
    spine.rotation.set(0, 0, 0);
    chest.rotation.set(0, 0, 0);
    neck.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(0, 0, 0);
    rightArm.shoulder.rotation.set(0, 0, 0);
    // Note: Rz(a) maps hanging arm (0,-1,0) -> (+sin(a), -cos(a), 0): left (-X) flares outward with rotZ < 0, right (+X) with rotZ > 0!
    leftArm.upperArm.rotation.set(0, 0, -0.09);
    rightArm.upperArm.rotation.set(0, 0, 0.09);
    leftArm.forearm.rotation.set(-0.14, 0, 0);
    rightArm.forearm.rotation.set(-0.14, 0, 0);
    leftArm.hand.rotation.set(0, 0, 0);
    rightArm.hand.rotation.set(0, 0, 0);
    leftLeg.thigh.rotation.set(0, 0, 0);
    rightLeg.thigh.rotation.set(0, 0, 0);
    leftLeg.calf.rotation.set(0, 0, 0);
    rightLeg.calf.rotation.set(0, 0, 0);
    leftLeg.foot.rotation.set(0, 0, 0);
    rightLeg.foot.rotation.set(0, 0, 0);
  };

  const setPose = (action: PoseAction, frame: number, opts: PoseEvalOpts = {}) => {
    resetPose();
    const seed = opts.seed ?? (cfg.id.charCodeAt(0) + cfg.id.length * 7);
    const t = ent?.steppedFps ? uncannyTime(frame, Math.max(1, Math.round(FPS / ent.steppedFps)), FPS) : frame / FPS;
    const aliveBreath = ent?.breathing === false ? 0 : Math.sin(t * 2.1 + seed) * 0.022;

    // Default breathing & subtle entity neck distortion
    chest.rotation.x = aliveBreath;
    if (ent?.neckTiltDeg) {
      neck.rotation.z = THREE.MathUtils.degToRad(ent.neckTiltDeg);
    }

    if (action === "sitCrossLegged") {
      // Cross-legged seated posture on floor/mat (elbows naturally flared slightly outward, forearms resting on knees)
      pelvis.position.y = 0.14 * hScale;
      spine.rotation.x = 0.09 + aliveBreath * 0.6;
      leftLeg.thigh.rotation.set(-1.42, 0.58, -0.25);
      rightLeg.thigh.rotation.set(-1.42, -0.58, 0.25);
      leftLeg.calf.rotation.set(2.05, 0, -0.28);
      rightLeg.calf.rotation.set(2.05, 0, 0.28);
      leftArm.upperArm.rotation.set(-0.24, 0, -0.22);
      rightArm.upperArm.rotation.set(-0.24, 0, 0.22);
      leftArm.forearm.rotation.set(-0.76, 0, 0.26);
      rightArm.forearm.rotation.set(-0.76, 0, -0.26);
    } else if (action === "sitChair") {
      pelvis.position.y = 0.46 * hScale;
      spine.rotation.x = 0.05 + aliveBreath;
      leftLeg.thigh.rotation.set(-1.48, 0.08, 0);
      rightLeg.thigh.rotation.set(-1.48, -0.08, 0);
      leftLeg.calf.rotation.set(1.48, 0, 0);
      rightLeg.calf.rotation.set(1.48, 0, 0);
      leftArm.upperArm.rotation.set(-0.20, 0, -0.14);
      rightArm.upperArm.rotation.set(-0.20, 0, 0.14);
      leftArm.forearm.rotation.set(-0.92, 0, 0.16);
      rightArm.forearm.rotation.set(-0.92, 0, -0.16);
    } else if (action === "walk" || action === "creep") {
      const freq = action === "creep" ? 3.2 : 5.2;
      const amp = action === "creep" ? 0.34 : 0.52;
      const ph = t * freq;
      const s = Math.sin(ph);
      pelvis.position.y = hipY + Math.abs(Math.cos(ph)) * 0.032 * hScale - (action === "creep" ? 0.06 * hScale : 0);
      spine.rotation.x = action === "creep" ? 0.22 : 0.06;
      leftLeg.thigh.rotation.x = s * amp;
      rightLeg.thigh.rotation.x = -s * amp;
      leftLeg.calf.rotation.x = Math.max(0, -s * amp * 1.15) + (action === "creep" ? 0.25 : 0.08);
      rightLeg.calf.rotation.x = Math.max(0, s * amp * 1.15) + (action === "creep" ? 0.25 : 0.08);
      leftArm.upperArm.rotation.x = -s * amp * 0.72;
      rightArm.upperArm.rotation.x = s * amp * 0.72;
      leftArm.forearm.rotation.x = -0.26 - Math.max(0, -s * 0.28);
      rightArm.forearm.rotation.x = -0.26 - Math.max(0, s * 0.28);
    } else if (action === "peerForward") {
      spine.rotation.x = 0.24 + aliveBreath;
      neck.rotation.x = -0.14;
      leftArm.upperArm.rotation.set(-0.35, 0, -0.12);
      rightArm.upperArm.rotation.set(-0.62, 0, 0.10);
      rightArm.forearm.rotation.set(-0.78, 0, 0);
    } else if (action === "recoil") {
      pelvis.position.y = hipY - 0.04 * hScale;
      spine.rotation.x = -0.18;
      leftArm.upperArm.rotation.set(-0.95, 0.22, -0.30);
      rightArm.upperArm.rotation.set(-1.05, -0.22, 0.30);
      leftArm.forearm.rotation.set(-1.15, 0, 0);
      rightArm.forearm.rotation.set(-1.15, 0, 0);
    } else if (action === "holdPhone") {
      rightArm.upperArm.rotation.set(-0.72, -0.18, 0.12);
      rightArm.forearm.rotation.set(-1.12, 0.22, 0);
      leftArm.upperArm.rotation.set(-0.24, 0, -0.08);
      head.rotation.x = 0.28;
    } else if (action === "holdLantern") {
      rightArm.upperArm.rotation.set(-0.68, 0, 0.12);
      rightArm.forearm.rotation.set(-0.85, 0, 0);
      leftArm.upperArm.rotation.set(-0.12, 0, -0.08);
    } else if (action === "point") {
      rightArm.upperArm.rotation.set(-1.35, -0.12, 0.08);
      rightArm.forearm.rotation.set(-0.12, 0, 0);
    } else if (action === "lunge") {
      pelvis.position.y = hipY - 0.08 * hScale;
      spine.rotation.x = 0.34;
      leftArm.upperArm.rotation.set(-1.42, 0.14, -0.18);
      rightArm.upperArm.rotation.set(-1.52, -0.14, 0.18);
      leftArm.forearm.rotation.set(-0.22, 0, 0);
      rightArm.forearm.rotation.set(-0.22, 0, 0);
    } else if (action === "loomingStill") {
      // Uncanny hunched stillness: subtle asymmetric shoulder roll, long gaunt arms hanging eerily off-plumb
      spine.rotation.x = 0.14;
      leftArm.upperArm.rotation.set(-0.08, 0, -0.14);
      rightArm.upperArm.rotation.set(0.04, 0, 0.16);
      leftArm.forearm.rotation.set(-0.22, 0, 0.06);
      rightArm.forearm.rotation.set(-0.16, 0, -0.08);
      leftArm.hand.rotation.set(0.18, 0, -0.12);
      rightArm.hand.rotation.set(0.24, 0, 0.14);
    } else if (action === "peekAroundDoor") {
      spine.rotation.z = -0.26;
      neck.rotation.z = (ent?.neckTiltDeg ? THREE.MathUtils.degToRad(ent.neckTiltDeg) : 0) - 0.18;
      leftArm.upperArm.rotation.set(-0.85, 0, -0.28);
      leftArm.forearm.rotation.set(-0.65, 0, 0);
    } else if (action === "turnHead") {
      spine.rotation.y = 0.30;
      head.rotation.y = 0.68;
      leftArm.upperArm.rotation.set(-0.06, 0, -0.12);
      rightArm.upperArm.rotation.set(0.08, 0, 0.14);
    }

    // Optional violent 2-frame uncanny neck twitch
    if (opts.twitch || ent?.neckTiltDeg) {
      const tw = uncannyTwitch(frame, seed, 28, 0.26);
      if (opts.twitch) neck.rotation.z += tw;
    }

    if (opts.headYaw !== undefined) head.rotation.y += opts.headYaw;
    if (opts.headPitch !== undefined) head.rotation.x += opts.headPitch;
    if (opts.headRoll !== undefined) head.rotation.z += opts.headRoll;

    if (opts.expr !== undefined || opts.mouth !== undefined || opts.lid !== undefined || opts.gazeX !== undefined) {
      setFace({
        expr: opts.expr ?? "calm",
        mouth: opts.mouth,
        lid: opts.lid,
        gazeX: opts.gazeX,
        gazeY: opts.gazeY,
        pupilScale: opts.pupilScale,
      });
    }
  };

  const lookAtWorld = (target: V3, weight = 0.85) => {
    root.updateMatrixWorld(true);
    const wp = new THREE.Vector3();
    head.getWorldPosition(wp);
    const invParent = new THREE.Matrix4().copy(neck.matrixWorld).invert();
    const localTarget = new THREE.Vector3(...target).applyMatrix4(invParent);
    const yaw = Math.max(-1.05, Math.min(1.05, Math.atan2(localTarget.x, Math.max(0.05, localTarget.z))));
    const pitch = Math.max(-0.55, Math.min(0.55, -Math.atan2(localTarget.y - head.position.y, Math.hypot(localTarget.x, localTarget.z) || 0.1)));
    head.rotation.y = yaw * weight;
    head.rotation.x = pitch * weight;
  };

  const dispose = () => {
    faceCache.dispose();
    for (const d of disposables) d.dispose();
  };

  return { group: root, sockets, config: cfg, setFace, setPose, lookAtWorld, dispose };
}
