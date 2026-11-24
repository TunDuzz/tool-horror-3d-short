// Horror Engine v4: Articulated 3D Semi-Realistic Dark-Horror Human & Modular Body-Horror Entity Rig.
// Adult non-chibi proportions (~5.8 head-heights), sculpted angular 3D faces with recessed eye hollows & cheekbones,
// multi-layer coarse woven clothing + bumpMaps, multi-clump fibrous 3D hair, 1024px realistic face decals,
// Style B zero-outline default (with optional Style A / comic outlineMode), and full modular BodyHorrorConfig
// (3D hollowed skull sockets, recessed wet bloodshot 3D eyeballs, articulated 3D dislocated jaw + crooked teeth,
// elongated tendon neck, protruding ribs/clavicles/spine, 3-joint spider claw hands, extra arms, crawler/stalkLoom poses).

import * as THREE from "three";
import { FPS, clamp01, jacobsLadderTwitch, lerp, uncannyTime, uncannyTwitch, type V3 } from "./camera";
import { NOINK } from "./ink";
import type { CharacterBlueprint, FaceExpr, PoseAction } from "./manifest";
import { attachOutlineRig, type OutlineMode } from "./outline3d";
import { cadaverSkinPair, hairStrandPair, humanSkinPair, tatteredGownPair, wovenFabricPair } from "./paint";
import { stylizedShade } from "./shade";
import { FaceTextureCache, type FaceSpec, type MouthShape } from "./face2d";
import {
  type BodyHorrorConfig,
  buildEmaciatedTorso3D,
  buildExtraArms3D,
  buildHorrorEyes3D,
  buildHorrorJaw3D,
  buildHorrorSkullHeadGeo,
  buildMattedLongHair3D,
  buildSpiderClawHand3D,
  buildSuturesAndWounds3D,
  buildTendonNeck3D,
} from "./bodyHorror";

export type WordTiming = { word: string; start: number; end: number; speaker?: string };

/** Deterministic natural human eye-blink curve (0 = open, 1 = shut) repeating every ~3.8-5.1s. */
export function autoBlink(frame: number, seed = 7, fps = FPS): number {
  const period = Math.round(fps * (3.8 + ((seed * 37) % 13) * 0.1));
  const phase = ((frame + seed * 19) % period + period) % period;
  if (phase === 0 || phase === 4) return 0.45;
  if (phase === 1 || phase === 3) return 0.88;
  if (phase === 2) return 1.0;
  return 0;
}

/** Deterministic Vietnamese-aware audio lip-sync viseme mapper from words.json timestamps. */
export function mouthFromWords(
  words: WordTiming[],
  frame: number,
  fps = FPS,
  restMouth: MouthShape = "closed",
): MouthShape {
  const t = frame / fps;
  for (const w of words) {
    if (t >= w.start && t <= w.end) {
      const s = w.word.toLowerCase();
      const prog = (t - w.start) / Math.max(0.04, w.end - w.start);
      if (prog < 0.08 || prog > 0.92) return "parted";
      if (/[oóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữự]/.test(s)) return "talkO";
      if (/[aáàảãạăắằẳẵặâấầẩẫậ]/.test(s)) return "talkA";
      if (/[eéèẻẽẹêếềểễệiíìỉĩịyýỳỷỹỵ]/.test(s)) return "talkE";
      return "parted";
    }
  }
  return restMouth;
}

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
  heightScale?: number; // e.g. 1.15 - 1.28 tall looming silhouette
  gauntness?: number; // 0.68 - 0.88 slender bone-thin limbs/torso
  armScale?: number; // 1.15 - 1.35 unnaturally long arms
  fingerScale?: number; // 1.25 - 1.55 spidery elongated fingers
  neckTiltDeg?: number; // +-20..65 deg broken-neck angle
  shoulderSkew?: number; // +-0.14 rad uneven shoulders
  hairCurtain?: boolean; // long dark 3D strands draping across face
  silhouetteMode?: boolean; // near-black charcoal figure for deep-shadow reveals
  eyeGlow?: boolean; // HDR emissive pinpoint eyes piercing pitch dark
  eyeGlowColor?: [number, number, number];
  breathing?: boolean; // false = uncanny dead stillness
  steppedFps?: number; // optional subtle stepped motion (e.g. 8-10 fps)
  headTwitch?: number; // 0..1 opt-in Jacob's Ladder multi-axis violent head spasm
  bodyHorror?: BodyHorrorConfig; // Horror Engine v4/v5 modular opt-in Dark / Gore / Body Horror anatomy
};

export type CharacterConfig = {
  id: string;
  height?: number; // target standing height in metres (default 1.72)
  skinCol?: string;
  hairCol?: string;
  hairStyle?: HairStyle;
  topCol?: string;
  innerCol?: string; // inner shirt tone for layered jackets/coats
  bottomCol?: string;
  shoeCol?: string;
  garment?: GarmentStyle;
  headbandCol?: string; // e.g. white funeral headband (khăn tang)
  lowPoly?: boolean; // v4.5 PSX faceted low-poly geometry + flatShading (default true!)
  uncannyRealism?: boolean; // v5.0 opt-in PS1 Silent Hill / Mouthwashing dark facial charcoal/flash shading
  outlineMode?: OutlineMode; // default "off" (Style B / PSX), or "grittyThin" (Style A) / "cleanBold"
  outlinePx?: number; // legacy explicit outline width override
  entity?: EntityConfig;
};

export type RigSockets = {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw?: THREE.Group;
  leftShoulder: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  leftHand: THREE.Group;
  rightShoulder: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  rightHand: THREE.Group;
  leftExtraArm?: THREE.Group;
  rightExtraArm?: THREE.Group;
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
  jawOpen?: number; // 0..1 explicit override for 3D articulated horror jaw
  twitch?: boolean;
  headTwitch?: number; // 0..1 per-beat override for Jacob's Ladder violent head spasm
  seed?: number;
  ageLines?: boolean;
  sweat?: boolean;
  autoBlink?: boolean;
};

export type Character3D = {
  group: THREE.Group;
  sockets: RigSockets;
  config: CharacterConfig;
  setFace: (spec: FaceSpec) => void;
  setPose: (action: PoseAction, frame: number, opts?: PoseEvalOpts) => void;
  setPoseBlend: (from: PoseAction, to: PoseAction, t: number, frame: number, opts?: PoseEvalOpts) => void;
  lookAtWorld: (target: V3, weight?: number) => void;
  dispose: () => void;
};

/** Sculpted adult human head: angular jaw, subtle eye hollows, brow ridge & cheekbones (lowPoly uses faceted 12x10 PS1 topology!). */
function buildSculptedHeadGeo(rx: number, ry: number, rz: number, lowPoly = false): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, lowPoly ? 12 : 28, lowPoly ? 10 : 22);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    if (y < 0) {
      const jawT = Math.min(1, -y);
      x *= 1 - 0.35 * jawT * jawT;
      z *= 1 - 0.14 * jawT;
      if (z > 0) z += 0.095 * jawT * (1 - Math.abs(x) * 0.85); // defined adult chin
    } else {
      x *= 0.96 + 0.05 * Math.sin(y * Math.PI);
    }

    if (z > 0.25) {
      const front = Math.min(1, (z - 0.25) / 0.55);
      // Subtle sculpted eye hollows (catches real SSAO & chiaroscuro side-light without distorting face decal!)
      for (const s of [-1, 1]) {
        const ex = (x - s * 0.36) / 0.22;
        const ey = (y - 0.10) / 0.16;
        const d2 = ex * ex + ey * ey;
        if (d2 < 2.0) z -= 0.075 * Math.exp(-d2 * 1.9) * front;

        // Defined cheekbones directly below outer eye corner
        const cx = (x - s * 0.54) / 0.24;
        const cy = (y + 0.10) / 0.18;
        const cb = Math.exp(-(cx * cx + cy * cy) * 1.7) * front;
        x += s * 0.055 * cb;
        z += 0.045 * cb;

        // Subtle lower-cheek lean hollow below cheekbone
        const hx = (x - s * 0.44) / 0.24;
        const hy = (y + 0.36) / 0.24;
        const ch = Math.exp(-(hx * hx + hy * hy) * 1.6) * front;
        x -= s * 0.065 * ch;
      }

      // Defined supraorbital brow ridge overhang
      if (y > 0.18 && y < 0.44) {
        z += 0.068 * Math.sin(((y - 0.18) / 0.26) * Math.PI) * front * (1 - Math.min(1, x * x * 1.1));
      }
    }

    pos.setXYZ(i, x * rx, y * ry, z * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Curved spherical-patch decal hugging the sculpted front face (tracks jaw taper & subtle brow/cheek depth). */
function buildCurvedFacePatchGeo(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const segU = 18, segV = 16;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const azMax = 0.88;
  const elMin = -0.64;
  const elMax = 0.46;
  const pad = 1.028;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const el = elMin + (elMax - elMin) * v;
    const cosEl = Math.cos(el);
    const sinEl = Math.sin(el);
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const az = -azMax + 2 * azMax * u;
      let sx = Math.sin(az) * cosEl;
      const sy = sinEl;
      let sz = Math.cos(az) * cosEl;

      if (sy < 0) {
        const jawT = Math.min(1, -sy);
        sx *= 1 - 0.35 * jawT * jawT;
        sz *= 1 - 0.14 * jawT;
        if (sz > 0) sz += 0.095 * jawT * (1 - Math.abs(sx) * 0.85);
      } else {
        sx *= 0.96 + 0.05 * Math.sin(sy * Math.PI);
      }

      if (sz > 0.25) {
        const front = Math.min(1, (sz - 0.25) / 0.55);
        for (const s of [-1, 1]) {
          const ex = (sx - s * 0.36) / 0.22;
          const ey = (sy - 0.10) / 0.16;
          const d2 = ex * ex + ey * ey;
          if (d2 < 2.0) sz -= 0.072 * Math.exp(-d2 * 1.9) * front;

          const cx = (sx - s * 0.54) / 0.24;
          const cy = (sy + 0.10) / 0.18;
          const cb = Math.exp(-(cx * cx + cy * cy) * 1.7) * front;
          sx += s * 0.055 * cb;
          sz += 0.045 * cb;

          const hx = (sx - s * 0.44) / 0.24;
          const hy = (sy + 0.36) / 0.24;
          const ch = Math.exp(-(hx * hx + hy * hy) * 1.6) * front;
          sx -= s * 0.065 * ch;
        }
        if (sy > 0.18 && sy < 0.44) {
          sz += 0.066 * Math.sin(((sy - 0.18) / 0.26) * Math.PI) * front * (1 - Math.min(1, sx * sx * 1.1));
        }
      }

      positions.push(sx * rx * pad, sy * ry * pad, sz * rz * pad);
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

/** Tapered anatomical limb capsule (origin at top joint y = 0, extending downward to y = -len). */
function buildTaperedLimbGeo(rTop: number, rBot: number, len: number, segs = 12): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const capSteps = 4;
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len - Math.cos(a) * rBot * 0.65));
  }
  pts.push(new THREE.Vector2(rBot * 0.96, -len * 0.72));
  pts.push(new THREE.Vector2((rTop + rBot) * 0.55, -len * 0.35));
  pts.push(new THREE.Vector2(rTop, -len * 0.06));
  for (let i = 1; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, Math.sin(a) * rTop * 0.65));
  }
  return new THREE.LatheGeometry(pts, segs);
}

/** Build textured multi-clump 3D hair locks & fibrous tufts on the head socket (kills plastic helmet-sphere look!). */
function buildHairMeshes(
  parent: THREE.Group,
  style: HairStyle,
  mat: THREE.Material,
  rx: number,
  ry: number,
  rz: number,
  hairCurtain: boolean,
  disposables: Array<{ dispose(): void }>,
): THREE.Mesh[] {
  const created: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1], name = "hair") => {
    disposables.push(geo);
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

  // Base sculpted hair cap tilted BACKWARD so front hairline sits high on forehead (NEVER covers eyes!)
  const cap = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
  add(cap, [0, ry * 0.14, -rz * 0.08], [-0.46, 0, 0], [rx * 1.07, ry * 1.02, rz * 1.09], "hairCap");

  // Rear nape coverage strictly behind the ears (-Z)
  const backNape = new THREE.CylinderGeometry(rx * 0.96, rx * 0.80, ry * 0.78, 12, 1, false, Math.PI * 0.56, Math.PI * 0.88);
  add(backNape, [0, -ry * 0.14, -rz * 0.10], [0.06, 0, 0], [1.02, 1, 0.94], "hairNape");

  if (style === "shortParted" || style === "elderThin") {
    // Swept sculpted layered hair volume hugging the cranium, forehead & temples (zero spiky thorns poking out!)
    add(new THREE.SphereGeometry(1, 16, 12), [-rx * 0.22, ry * 0.78, rz * 0.22], [0.16, 0.14, 0.18], [rx * 0.76, ry * 0.30, rz * 0.56], "hairFringeL");
    add(new THREE.SphereGeometry(1, 16, 12), [rx * 0.42, ry * 0.74, rz * 0.16], [0.14, -0.18, -0.22], [rx * 0.58, ry * 0.28, rz * 0.50], "hairFringeR");
    // Overlapping swept side & crown hair layers hugging skull curvature
    const locks: Array<[V3, V3, V3]> = [
      [[-rx * 0.58, ry * 0.64, rz * 0.32], [0.95, 0.25, 0.72], [0.036, 0.095, 0.020]],
      [[rx * 0.58, ry * 0.64, rz * 0.32], [0.95, -0.25, -0.72], [0.036, 0.095, 0.020]],
      [[-rx * 0.82, ry * 0.34, rz * 0.06], [1.45, 0.18, 1.25], [0.032, 0.092, 0.022]],
      [[rx * 0.82, ry * 0.34, rz * 0.06], [1.45, -0.18, -1.25], [0.032, 0.092, 0.022]],
      [[-rx * 0.48, ry * 0.72, -rz * 0.28], [-1.05, 0.16, 0.42], [0.042, 0.105, 0.026]],
      [[rx * 0.48, ry * 0.72, -rz * 0.28], [-1.05, -0.16, -0.42], [0.042, 0.105, 0.026]],
    ];
    locks.forEach(([p, r, s], i) => add(new THREE.ConeGeometry(1, 1, 6), p, r, s, `hairLock_${i}`));
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.016, ry * 0.54, 0.030), [s * rx * 0.96, ry * 0.16, rz * 0.10], [0, 0, s * 0.08], [1, 1, 1], s < 0 ? "sideburnL" : "sideburnR");
    }
  } else if (style === "spiky") {
    const tufts: [V3, V3, V3][] = [
      [[0, ry * 1.06, 0.06], [0.32, 0, 0], [0.042, 0.098, 0.032]],
      [[-0.048, ry * 0.96, 0.04], [0.24, 0, 0.56], [0.036, 0.088, 0.028]],
      [[0.048, ry * 0.96, 0.04], [0.24, 0, -0.56], [0.036, 0.088, 0.028]],
      [[-0.078, ry * 0.74, 0.0], [0.12, 0, 1.02], [0.030, 0.082, 0.026]],
      [[0.078, ry * 0.74, 0.0], [0.12, 0, -1.02], [0.030, 0.082, 0.026]],
      [[-0.034, ry * 0.98, -0.04], [-0.55, 0, 0.28], [0.036, 0.088, 0.028]],
      [[0.034, ry * 0.98, -0.04], [-0.55, 0, -0.28], [0.036, 0.088, 0.028]],
    ];
    for (const [p, r, s] of tufts) add(new THREE.ConeGeometry(1, 1, 5), p, r, s, "hairTuft");
  } else if (style === "bun") {
    add(new THREE.SphereGeometry(rx * 0.58, 12, 10), [0, -ry * 0.06, -rz * 1.24], [0, 0, 0], [1.05, 0.92, 0.92], "hairBun");
  } else if (style === "messyFringe") {
    // Organic swept adult hair hugging skull & temples (zero boxy beret cap!)
    add(new THREE.SphereGeometry(1, 16, 12), [0, ry * 0.62, -rz * 0.04], [-0.24, 0, 0], [rx * 1.07, ry * 0.44, rz * 1.02], "hairCrown");
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.016, ry * 0.64, 0.040), [s * rx * 0.96, ry * 0.14, rz * 0.04], [0, 0, s * 0.08], [1, 1, 1], s < 0 ? "sideburnL" : "sideburnR");
    }
    for (let i = 0; i < 6; i++) {
      const u = (i - 2.5) / 2.5;
      const m = add(
        new THREE.ConeGeometry(0.024, 0.095 + (i % 2) * 0.026, 5),
        [u * rx * 0.78, ry * 0.56 - Math.abs(u) * 0.03, rz * 0.82 - Math.abs(u) * 0.10],
        [Math.PI + 0.24, 0, u * 0.30],
        [1, 1, 0.42],
        `hairBang_${i}`,
      );
      m.userData.noOutline = true;
    }
  } else if (style === "longDraped") {
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

  if (hairCurtain) {
    const strands: Array<[number, number, number, number]> = [
      [-0.88, 0.36, 0.12, 0.024],
      [-0.58, 0.30, 0.06, 0.020],
      [-0.14, 0.21, -0.04, 0.014],
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
      if (Math.abs(u) < 0.75) m.userData.noOutline = true;
    });
  }

  return created;
}

/** Build an articulated 3D dark-horror humanoid or visceral body-horror entity. */
export function createCharacter3D(cfg: CharacterConfig): Character3D {
  const ent = cfg.entity;
  const bh = ent?.bodyHorror;
  const lowPoly = cfg.lowPoly ?? true;
  const limbSegs = lowPoly ? 7 : 12;
  const hScale = ((cfg.height ?? 1.72) / 1.72) * (ent?.heightScale ?? 1.0);
  const gaunt = ent?.gauntness ?? 1.0;
  const armS = ent?.armScale ?? 1.0;
  const fingerS = ent?.fingerScale ?? 1.0;
  const isSil = !!ent?.silhouetteMode && !bh?.cadaverSkin;
  const bloodLevel = bh?.bloodStainLevel ?? 0;

  const skinHex = isSil ? "#11121a" : (cfg.skinCol ?? (bh?.cadaverSkin ? "#9b9ba4" : "#c4aa90"));
  const hairHex = isSil ? "#090a10" : (cfg.hairCol ?? "#171419");
  const topHex = isSil ? "#0e0f17" : (cfg.topCol ?? "#d8d1c2");
  const innerHex = cfg.innerCol ?? new THREE.Color(topHex).multiplyScalar(0.55).getStyle();
  const botHex = isSil ? "#0b0c12" : (cfg.bottomCol ?? "#1d1e28");
  const shoeHex = isSil ? "#09090e" : (cfg.shoeCol ?? "#16141a");
  const garment: GarmentStyle = cfg.garment ?? "shirt";

  const disposables: Array<{ dispose(): void }> = [];
  const faceCache = new FaceTextureCache();

  // Tactile Bump-Mapped Materials (flatShading: true in PSX lowPoly mode creates razor-sharp angular facets!)
  let skinMat: THREE.Material;
  if (isSil) {
    skinMat = stylizedShade(new THREE.MeshLambertMaterial({ color: skinHex, flatShading: lowPoly }), 0.6, 0.3);
  } else if (bh?.cadaverSkin) {
    const cp = cadaverSkinPair(`v4_cad_${cfg.id}`, skinHex, bloodLevel);
    skinMat = stylizedShade(
      new THREE.MeshPhongMaterial({
        map: cp.map,
        bumpMap: cp.bumpMap,
        bumpScale: 0.015,
        flatShading: lowPoly,
        specular: "#4a424c",
        shininess: 22,
      }),
      0.72,
      0.52,
    );
  } else {
    const hp = humanSkinPair(`v4_skin_${cfg.id}`, skinHex);
    skinMat = stylizedShade(
      new THREE.MeshPhongMaterial({
        map: hp.map,
        bumpMap: hp.bumpMap,
        bumpScale: 0.0032,
        flatShading: lowPoly,
        specular: "#46352b",
        shininess: 14,
      }),
      1.0,
      0.22,
    );
  }

  let topMat: THREE.Material;
  if (isSil) {
    topMat = stylizedShade(new THREE.MeshLambertMaterial({ color: topHex, flatShading: lowPoly }), 0.6, 0.4);
  } else if (bh?.tatteredCloth || (bh && (garment === "hospitalGown" || garment === "shroud"))) {
    const gp = tatteredGownPair(`v4_gown_${cfg.id}`, topHex, bloodLevel);
    topMat = stylizedShade(
      new THREE.MeshLambertMaterial({
        map: gp.map,
        bumpMap: gp.bumpMap,
        bumpScale: 0.012,
        flatShading: lowPoly,
        side: THREE.DoubleSide,
      }),
      0.85,
      0.52,
    );
  } else {
    const fp = wovenFabricPair(`v4_top_${cfg.id}`, topHex);
    topMat = stylizedShade(
      new THREE.MeshLambertMaterial({ map: fp.map, bumpMap: fp.bumpMap, bumpScale: 0.009, flatShading: lowPoly }),
      1.0,
      0.38,
    );
  }

  const hairP = hairStrandPair(`v4_hair_${cfg.id}`, hairHex);
  const hairMat = stylizedShade(
    new THREE.MeshPhongMaterial({
      ...(isSil ? { color: hairHex } : { map: hairP.map, bumpMap: hairP.bumpMap, bumpScale: 0.006, color: "#ffffff" }),
      flatShading: lowPoly,
      specular: "#4a4240",
      shininess: 20,
    }),
    0.85,
    0.2,
  );
  const botP = wovenFabricPair(`v4_bot_${cfg.id}`, botHex);
  const botMat = stylizedShade(
    new THREE.MeshLambertMaterial({
      ...(isSil ? { color: botHex } : { map: botP.map, bumpMap: botP.bumpMap, bumpScale: 0.008, color: "#ffffff" }),
      flatShading: lowPoly,
    }),
    0.9,
    0.42,
  );
  const shoeMat = stylizedShade(
    new THREE.MeshPhongMaterial({ color: shoeHex, flatShading: lowPoly, specular: "#3a3840", shininess: 22 }),
    0.85,
    0.4,
  );
  disposables.push(skinMat, hairMat, topMat, botMat, shoeMat);

  // Core adult measurements (non-chibi: height/headH ~5.8-6.4)
  const thighLen = 0.42 * hScale;
  const calfLen = 0.42 * hScale;
  const footH = 0.06 * hScale;
  const hipY = thighLen + calfLen + footH;
  const spineLen = 0.24 * hScale;
  const chestLen = 0.24 * hScale;
  const neckStretch = clamp01(((bh?.neckStretch ?? 1.0) - 1.0) / 1.5) * 1.5 + 1.0;
  const neckLen = 0.08 * hScale * neckStretch;
  const headRx = 0.092 * hScale * (0.88 + 0.12 * gaunt);
  const headRy = 0.122 * hScale * (bh?.skullHollows ? 1.08 : 1.0);
  const headRz = 0.104 * hScale;
  const shoulderW = 0.156 * hScale * gaunt;
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
  head.position.set(0, neckLen + headRy * 0.70, 0);
  neck.add(head);

  // Pelvis / hips geometry
  const pelvisGeo = new THREE.SphereGeometry(0.132 * hScale * gaunt, 12, 10);
  pelvisGeo.scale(1.12, 0.78, 0.78);
  pelvis.add(mkMesh(pelvisGeo, botMat, "pelvisMesh"));

  // Sculpted torso (skipped when bodyHorror.tatteredCloth builds the continuous seamless V-neck robe + sculpted ribcage!)
  const usesContinuousHorrorRobe = !!(bh?.tatteredCloth);
  if (!usesContinuousHorrorRobe) {
    const ribPinch = bh?.exposedRibs ? 0.80 : 1.0;
    const torsoPts = [
      new THREE.Vector2(0.01, -0.02 * hScale),
      new THREE.Vector2(0.132 * hScale * gaunt * ribPinch, 0.0),
      new THREE.Vector2(0.118 * hScale * gaunt * ribPinch, 0.14 * hScale),
      new THREE.Vector2(0.172 * hScale * gaunt, 0.34 * hScale),
      new THREE.Vector2(0.162 * hScale * gaunt, 0.42 * hScale),
      new THREE.Vector2(0.118 * hScale * gaunt, 0.468 * hScale),
      new THREE.Vector2(0.062 * hScale * gaunt, 0.492 * hScale),
      new THREE.Vector2(0.01, 0.50 * hScale),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPts, lowPoly ? 10 : 18);
    torsoGeo.scale(1.12, 1, 0.65);
    spine.add(mkMesh(torsoGeo, topMat, "torsoMesh"));
  }

  // Tailored organic 3D collar & waist belt for human characters (zero floating cardboard boxes!)
  if (!isSil && !bh) {
    const collarCol = new THREE.Color(topHex).multiplyScalar(0.76);
    const collarMat = stylizedShade(new THREE.MeshLambertMaterial({ color: collarCol }), 1.0, 0.35);
    disposables.push(collarMat);

    // Sculpted turned-down V-collar wrapping cleanly around the base of the neck
    const collarGeo = new THREE.TorusGeometry(0.080 * hScale * gaunt, 0.022 * hScale, 8, 18);
    collarGeo.rotateX(Math.PI * 0.5 + 0.16);
    collarGeo.scale(1.06, 0.94, 1.0);
    const collar = mkMesh(collarGeo, collarMat, "garmentCollar");
    collar.position.set(0, 0.470 * hScale, 0.008 * hScale);
    spine.add(collar);

    // Subtle inner shirt collar triangle tucked flush inside the turned-down collar
    if (garment === "casualJacket" || garment === "coat" || garment === "shirt") {
      const innerP = wovenFabricPair(`v4_in_${cfg.id}`, innerHex);
      const innerMat = stylizedShade(
        new THREE.MeshLambertMaterial({ map: innerP.map, bumpMap: innerP.bumpMap, bumpScale: 0.006 }),
        1.0,
        0.30,
      );
      disposables.push(innerMat);
      const vNeckGeo = new THREE.CylinderGeometry(0.064 * hScale * gaunt, 0.076 * hScale * gaunt, 0.064 * hScale, 14);
      vNeckGeo.scale(1.02, 1.0, 0.92);
      const vNeck = mkMesh(vNeckGeo, innerMat, "innerShirtCollar");
      vNeck.position.set(0, 0.486 * hScale, 0.002 * hScale);
      spine.add(vNeck);
    }

    if (garment === "funeralRobe" || garment === "coat" || garment === "shirt" || garment === "casualJacket") {
      const beltGeo = new THREE.CylinderGeometry(0.134 * hScale * gaunt, 0.138 * hScale * gaunt, 0.036 * hScale, 16);
      beltGeo.scale(1.12, 1, 0.67);
      const belt = mkMesh(beltGeo, botMat, "waistBelt");
      belt.position.set(0, 0.04 * hScale, 0);
      spine.add(belt);
      const buckleMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#686258", specular: "#c8bea8", shininess: 56 }), 1, 0.2);
      disposables.push(buckleMat);
      const buckle = mkMesh(new THREE.BoxGeometry(0.040 * hScale, 0.032 * hScale, 0.014 * hScale), buckleMat, "beltBuckle");
      buckle.position.set(0, 0.04 * hScale, 0.094 * hScale * gaunt);
      spine.add(buckle);
    }
  }

  // Long robe/coat/gown/shroud lower skirt flare (skipped when continuous tatteredCloth gown already spans shoulders-to-knees!)
  if (!usesContinuousHorrorRobe && (garment === "funeralRobe" || garment === "coat" || garment === "hospitalGown" || garment === "shroud")) {
    const hemLen = garment === "shroud" || garment === "hospitalGown" ? 0.50 * hScale : 0.34 * hScale;
    const skirtGeo = new THREE.CylinderGeometry(0.142 * hScale * gaunt, 0.198 * hScale * gaunt, hemLen, 16, 1, false);
    skirtGeo.scale(1.06, 1, 0.72);
    const skirt = mkMesh(skirtGeo, topMat, "garmentSkirt");
    skirt.position.set(0, -hemLen * 0.42, 0);
    pelvis.add(skirt);
  }

  // Body Horror emaciated ribs, clavicles, dorsal spine & tattered hem strips
  if (bh && (bh.exposedRibs || bh.protrudingSpine || bh.tatteredCloth)) {
    buildEmaciatedTorso3D(spine, pelvis, hScale, gaunt, skinMat, topMat, bh, disposables);
  }

  // Neck: either sculpted tendon-ridged elongated body-horror neck OR normal adult neck
  if (bh && (neckStretch > 1.12 || bh.skullHollows)) {
    buildTendonNeck3D(neck, neckLen, hScale, gaunt, skinMat, disposables);
  } else {
    const neckGeo = new THREE.CylinderGeometry(0.044 * hScale * gaunt, 0.052 * hScale * gaunt, neckLen * 1.45, 12);
    const neckMesh = mkMesh(neckGeo, skinMat, "neckMesh");
    neckMesh.position.set(0, neckLen * 0.48, 0);
    neck.add(neckMesh);
  }

  // Head & Face: Body-Horror 3D Skull + 3D Recessed Eyeballs + 3D Articulated Jaw/Teeth vs Sculpted Human Head + 1024px Decal
  const uses3DHorrorSkull = !!bh?.skullHollows;
  let jawSocket: THREE.Group | undefined;

  if (uses3DHorrorSkull) {
    const hasJaw = (bh?.jawDrop3D ?? 0) > 0 || !!bh?.crookedTeeth;
    const skullGeo = buildHorrorSkullHeadGeo(headRx, headRy, headRz, hasJaw, lowPoly);
    head.add(mkMesh(skullGeo, skinMat, "horrorSkullMesh"));
    buildHorrorEyes3D(head, bh!, headRx, headRy, headRz, hScale, disposables);
    if (hasJaw) {
      jawSocket = buildHorrorJaw3D(head, bh!, headRx, headRy, headRz, hScale, skinMat, disposables);
    }
  } else {
    const headGeo = buildSculptedHeadGeo(headRx, headRy, headRz, lowPoly);
    head.add(mkMesh(headGeo, skinMat, "headMesh"));

    // Sculpted 3D nose bridge + subtle nostril tip
    const noseGeo = new THREE.ConeGeometry(0.015 * hScale, 0.054 * hScale, 5);
    noseGeo.rotateY(Math.PI * 0.2);
    noseGeo.scale(0.76, 1.0, 1.06);
    const noseMesh = mkMesh(noseGeo, skinMat, "noseMesh");
    noseMesh.position.set(0, 0.002 * hScale, headRz * 0.96);
    noseMesh.rotation.x = 0.24;
    head.add(noseMesh);

    if (bh && ((bh.jawDrop3D ?? 0) > 0 || bh.crookedTeeth)) {
      jawSocket = buildHorrorJaw3D(head, bh, headRx, headRy, headRz, hScale, skinMat, disposables);
    }
  }

  // Ears
  for (const side of [-1, 1] as const) {
    const earGeo = new THREE.SphereGeometry(0.022 * hScale, 8, 8);
    earGeo.scale(0.42, 1.25, 0.72);
    const ear = mkMesh(earGeo, skinMat, side < 0 ? "earL" : "earR");
    ear.position.set(side * headRx * 0.95, -0.006 * hScale, -0.008 * hScale);
    head.add(ear);
  }

  // Curved 1024px 2D face decal (used on humans and non-skull entities; hidden on 3D sculpted horror skulls!)
  const faceGeo = buildCurvedFacePatchGeo(headRx, headRy, headRz);
  const faceMat = stylizedShade(
    new THREE.MeshLambertMaterial({
      map: faceCache.get({ expr: "calm", skinCol: skinHex, eyeHorror: bh?.eyeHorror, cheekSplitGrin: bh?.cheekSplitGrin }),
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    1.0,
    0.15,
  );
  disposables.push(faceGeo, faceMat);
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.name = "faceDecal";
  faceMesh.userData.noOutline = true;
  faceMesh.userData.noSSAO = true;
  faceMesh.layers.set(NOINK);
  faceMesh.visible = !isSil && !uses3DHorrorSkull;
  head.add(faceMesh);

  // Optional HDR glowing pinpoint eyes for silhouette entities
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
      em.userData.noSSAO = true;
      em.userData.isEyeGlow = true;
      em.position.set(s * headRx * 0.36, 0.015 * hScale, headRz * 1.01);
      em.layers.set(NOINK);
      eyeGlowGroup.add(em);
    }
  }
  head.add(eyeGlowGroup);

  // 3D layered hair + optional East-Asian matted horror hair curtain + optional surgical wounds/sutures + optional funeral headband
  if (bh?.mattedLongHair) {
    buildMattedLongHair3D(head, headRx, headRy, headRz, hScale, lowPoly, disposables);
  } else {
    buildHairMeshes(head, cfg.hairStyle ?? "shortParted", hairMat, headRx, headRy, headRz, !!ent?.hairCurtain, disposables);
  }
  if (bh?.suturesAndWounds) {
    buildSuturesAndWounds3D(head, spine, headRx, headRy, headRz, hScale, disposables);
  }
  if (cfg.headbandCol && !isSil) {
    const bandP = wovenFabricPair(`v4_band_${cfg.id}`, cfg.headbandCol);
    const bandMat = stylizedShade(new THREE.MeshLambertMaterial({ map: bandP.map, bumpMap: bandP.bumpMap, bumpScale: 0.005 }), 1, 0.25);
    disposables.push(bandMat);
    const bandGeo = new THREE.TorusGeometry(headRx * 1.05, 0.015 * hScale, 8, 22);
    bandGeo.rotateX(Math.PI * 0.5);
    bandGeo.scale(1.0, 1.25, headRz / headRx);
    const band = mkMesh(bandGeo, bandMat, "headband");
    band.position.set(0, headRy * 0.54, -headRz * 0.04);
    band.rotation.x = -0.18;
    head.add(band);
  }

  // Arms & hands (standard human vs 3-joint skeletal spider claws for Body Horror!)
  const buildArm = (side: -1 | 1) => {
    const pfx = side < 0 ? "left" : "right";
    const shoulder = mkGroup(`${pfx}Shoulder`);
    const skewY = (ent?.shoulderSkew ?? 0) * side * 0.06;
    shoulder.position.set(side * shoulderW, chestLen * 0.64 + skewY, 0);
    chest.add(shoulder);

    const upperArm = mkGroup(`${pfx}UpperArm`);
    shoulder.add(upperArm);
    const shCapGeo = new THREE.SphereGeometry(0.034 * hScale * gaunt, 10, 8);
    shCapGeo.scale(1.0, 0.80, 0.92);
    const shBall = mkMesh(shCapGeo, topMat, `${pfx}ShoulderCap`);
    shBall.position.set(-side * 0.012 * hScale, -0.010 * hScale, 0);
    upperArm.add(shBall);

    const shortSleeve = garment === "shirt" || garment === "hospitalGown" || !!bh?.exposedRibs;
    const upperRTop = 0.039 * hScale * gaunt;
    const upperRBot = (shortSleeve ? 0.034 : 0.032) * hScale * gaunt;
    if (shortSleeve && bh) {
      // Torn short hospital sleeve exposing emaciated upper arm skin midway
      const sleeveLen = upperArmLen * 0.48;
      upperArm.add(mkMesh(buildTaperedLimbGeo(upperRTop, upperRTop * 0.96, sleeveLen, limbSegs), topMat, `${pfx}SleeveMesh`));
      const bareUpper = mkMesh(buildTaperedLimbGeo(upperRBot * 0.82, upperRBot * 0.72, upperArmLen * 0.56, limbSegs), skinMat, `${pfx}UpperArmMesh`);
      bareUpper.position.y = -sleeveLen * 0.92;
      upperArm.add(bareUpper);
    } else {
      upperArm.add(mkMesh(buildTaperedLimbGeo(upperRTop, upperRBot, upperArmLen, limbSegs), topMat, `${pfx}UpperArmMesh`));
      if (shortSleeve && !isSil) {
        const cuffMat = stylizedShade(new THREE.MeshLambertMaterial({ color: new THREE.Color(topHex).multiplyScalar(0.80), flatShading: lowPoly }), 1, 0.35);
        disposables.push(cuffMat);
        const cuff = mkMesh(new THREE.CylinderGeometry(0.038 * hScale * gaunt, 0.039 * hScale * gaunt, 0.024 * hScale, limbSegs), cuffMat, `${pfx}SleeveCuff`);
        cuff.position.set(0, -upperArmLen + 0.012 * hScale, 0);
        upperArm.add(cuff);
      }
    }

    const forearm = mkGroup(`${pfx}Forearm`);
    forearm.position.set(0, -upperArmLen, 0);
    upperArm.add(forearm);
    const sleeveMat = shortSleeve ? skinMat : topMat;
    const fTop = (shortSleeve ? 0.027 : 0.033) * hScale * gaunt;
    const fBot = (shortSleeve ? 0.022 : 0.027) * hScale * gaunt;
    // Rounded anatomical elbow joint cap so sharply bent elbows never kink!
    forearm.add(mkMesh(new THREE.SphereGeometry(fTop * 1.04, limbSegs, 6), sleeveMat, `${pfx}ElbowJoint`));
    forearm.add(mkMesh(buildTaperedLimbGeo(fTop, fBot, forearmLen, limbSegs), sleeveMat, `${pfx}ForearmMesh`));

    const hand = mkGroup(`${pfx}Hand`);
    hand.position.set(0, -forearmLen, 0);
    forearm.add(hand);

    if (bh?.clawHands) {
      buildSpiderClawHand3D(hand, side, hScale, gaunt, fingerS, skinMat, bloodLevel, disposables, pfx);
    } else {
      // Sculpted rounded palm + gently curled slender fingers (never a stiff wooden rake!)
      const palmGeo = new THREE.SphereGeometry(0.026 * hScale * gaunt, 10, 8);
      palmGeo.scale(0.86, 1.35 * fingerS, 0.50);
      const palm = mkMesh(palmGeo, skinMat, `${pfx}Palm`);
      palm.position.set(0, -0.030 * hScale * fingerS, 0);
      hand.add(palm);

      const fLen = 0.048 * hScale * fingerS;
      for (let fi = 0; fi < 4; fi++) {
        const fGeo = new THREE.CapsuleGeometry(0.0056 * hScale * gaunt, fLen, 4, 6);
        const fm = mkMesh(fGeo, skinMat, `${pfx}Finger_${fi}`);
        fm.position.set((fi - 1.5) * 0.0095 * hScale * gaunt, -0.056 * hScale * fingerS - fLen * 0.36, 0.008 * hScale);
        fm.rotation.set(0.36, 0, (fi - 1.5) * -0.04);
        hand.add(fm);
      }
      const thumbGeo = new THREE.CapsuleGeometry(0.0068 * hScale * gaunt, fLen * 0.62, 4, 6);
      const thumb = mkMesh(thumbGeo, skinMat, `${pfx}Thumb`);
      thumb.position.set(-side * 0.022 * hScale * gaunt, -0.038 * hScale * fingerS, 0.014 * hScale);
      thumb.rotation.set(0.34, 0, -side * 0.38);
      hand.add(thumb);
    }

    return { shoulder, upperArm, forearm, hand };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Optional 2 extra gaunt shadowy arms emerging from behind the entity's back!
  let extraArms: { leftExtraArm: THREE.Group; rightExtraArm: THREE.Group } | undefined;
  if ((bh?.extraArms ?? 0) >= 2) {
    extraArms = buildExtraArms3D(chest, hScale, gaunt, armS, skinMat, !!bh?.clawHands, bloodLevel, disposables);
  }

  // Legs & bare feet / shoes
  const bareLegs = !!bh && (garment === "hospitalGown" || garment === "shroud");
  const legMat = bareLegs ? skinMat : botMat;
  const footMat = bareLegs ? skinMat : shoeMat;
  const buildLeg = (side: -1 | 1) => {
    const pfx = side < 0 ? "left" : "right";
    const thigh = mkGroup(`${pfx}Thigh`);
    thigh.position.set(side * 0.095 * hScale * gaunt, -0.02 * hScale, 0);
    pelvis.add(thigh);
    thigh.add(mkMesh(buildTaperedLimbGeo(0.066 * hScale * gaunt, 0.044 * hScale * gaunt, thighLen, limbSegs), legMat, `${pfx}ThighMesh`));

    const calf = mkGroup(`${pfx}Calf`);
    calf.position.set(0, -thighLen, 0);
    thigh.add(calf);
    calf.add(mkMesh(buildTaperedLimbGeo(0.044 * hScale * gaunt, 0.030 * hScale * gaunt, calfLen, limbSegs), legMat, `${pfx}CalfMesh`));

    const foot = mkGroup(`${pfx}Foot`);
    foot.position.set(0, -calfLen, 0);
    calf.add(foot);
    const shoeGeo = new THREE.CapsuleGeometry(0.034 * hScale * (bareLegs ? gaunt : 1), 0.12 * hScale, 5, 8);
    shoeGeo.rotateX(Math.PI * 0.5);
    shoeGeo.scale(0.95, 0.62, 1.0);
    const shoe = mkMesh(shoeGeo, footMat, `${pfx}ShoeMesh`);
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
    ...(jawSocket ? { jaw: jawSocket } : {}),
    leftShoulder: leftArm.shoulder,
    leftUpperArm: leftArm.upperArm,
    leftForearm: leftArm.forearm,
    leftHand: leftArm.hand,
    rightShoulder: rightArm.shoulder,
    rightUpperArm: rightArm.upperArm,
    rightForearm: rightArm.forearm,
    rightHand: rightArm.hand,
    ...(extraArms ? { leftExtraArm: extraArms.leftExtraArm, rightExtraArm: extraArms.rightExtraArm } : {}),
    leftThigh: leftLeg.thigh,
    leftCalf: leftLeg.calf,
    leftFoot: leftLeg.foot,
    rightThigh: rightLeg.thigh,
    rightCalf: rightLeg.calf,
    rightFoot: rightLeg.foot,
  };

  // Isolate entire rig onto NOINK; only create cartoon BackSide outlines when explicitly requested (Style B default = "off"!)
  const resolvedOutlineMode: OutlineMode =
    cfg.outlineMode ?? (cfg.outlinePx !== undefined && cfg.outlinePx > 0 ? "cleanBold" : "off");
  const outlineMeshes = attachOutlineRig(root, {
    mode: resolvedOutlineMode,
    pxWidth: cfg.outlinePx ?? 5.8,
    color: "#06060a",
  });
  for (const ol of outlineMeshes) disposables.push(ol.geometry);

  const setFace = (spec: FaceSpec) => {
    if (isSil || uses3DHorrorSkull) return;
    const tex = faceCache.get({
      skinCol: skinHex,
      realisticStyle: resolvedOutlineMode === "off",
      pixelFace: lowPoly,
      uncannyRealism: cfg.uncannyRealism ?? false,
      eyeHorror: bh?.eyeHorror,
      cheekSplitGrin: bh?.cheekSplitGrin,
      ...spec,
    });
    if (faceMat.map !== tex) {
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    }
  };

  const baseJawDrop = clamp01(bh?.jawDrop3D ?? 0);

  const resetPose = () => {
    pelvis.position.set(0, hipY, 0);
    pelvis.rotation.set(0, 0, 0);
    spine.rotation.set(0, 0, 0);
    chest.rotation.set(0, 0, 0);
    neck.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    if (jawSocket) {
      jawSocket.rotation.set(baseJawDrop * 0.78, 0, 0);
      jawSocket.position.y = -headRy * 0.24 - baseJawDrop * 0.022 * hScale;
    }
    leftArm.shoulder.rotation.set(0, 0, 0);
    rightArm.shoulder.rotation.set(0, 0, 0);
    leftArm.upperArm.rotation.set(0, 0, -0.09);
    rightArm.upperArm.rotation.set(0, 0, 0.09);
    leftArm.forearm.rotation.set(-0.14, 0, 0);
    rightArm.forearm.rotation.set(-0.14, 0, 0);
    leftArm.hand.rotation.set(0, 0, 0);
    rightArm.hand.rotation.set(0, 0, 0);
    if (extraArms) {
      extraArms.leftExtraArm.rotation.set(0.16, 0.18, -0.42);
      extraArms.rightExtraArm.rotation.set(0.16, -0.18, 0.42);
    }
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

    chest.rotation.x = aliveBreath;
    if (ent?.neckTiltDeg) {
      neck.rotation.z = THREE.MathUtils.degToRad(ent.neckTiltDeg);
    }

    if (action === "sitCrossLegged") {
      pelvis.position.y = 0.14 * hScale;
      spine.rotation.x = 0.08 + aliveBreath * 0.6;
      leftLeg.thigh.rotation.set(-1.38, 0.42, -0.14);
      rightLeg.thigh.rotation.set(-1.38, -0.42, 0.14);
      leftLeg.calf.rotation.set(1.52, 0.62, -0.78);
      rightLeg.calf.rotation.set(1.52, -0.62, 0.78);
      // Hands rest naturally inward on knees/lap instead of hanging straight down stiffly!
      leftArm.upperArm.rotation.set(-0.46, 0.14, -0.14);
      rightArm.upperArm.rotation.set(-0.46, -0.14, 0.14);
      leftArm.forearm.rotation.set(-1.08, 0.24, 0.34);
      rightArm.forearm.rotation.set(-1.08, -0.24, -0.34);
      leftArm.hand.rotation.set(0.24, 0, 0.18);
      rightArm.hand.rotation.set(0.24, 0, -0.18);
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
    } else if (action === "stalkLoom") {
      // Hunched gaunt predator framing a doorway: splayed spider arms clutching outward, snapped broken neck, extra arms clearly jutting from behind!
      spine.rotation.x = 0.16;
      chest.rotation.x = 0.08;
      leftArm.upperArm.rotation.set(-0.22, 0.10, -0.46);
      rightArm.upperArm.rotation.set(-0.24, -0.10, 0.46);
      leftArm.forearm.rotation.set(-0.32, 0, 0.12);
      rightArm.forearm.rotation.set(-0.34, 0, -0.12);
      leftArm.hand.rotation.set(-0.38, 0, -0.32);
      rightArm.hand.rotation.set(-0.40, 0, 0.32);
      if (extraArms) {
        const sway = Math.sin(t * 1.4 + seed) * 0.07;
        extraArms.leftExtraArm.rotation.set(0.04, 0.14, -0.92 + sway);
        extraArms.rightExtraArm.rotation.set(0.04, -0.14, 0.92 - sway);
      }
    } else if (action === "jawUnlatch") {
      // Uncanny craning tilt while the articulated 3D lower jaw dislocates progressively wider!
      spine.rotation.x = 0.22;
      neck.rotation.x = -0.16;
      head.rotation.x = -0.12;
      leftArm.upperArm.rotation.set(-0.46, 0.16, -0.36);
      rightArm.upperArm.rotation.set(-0.42, -0.16, 0.38);
      leftArm.forearm.rotation.set(-0.56, 0, 0.22);
      rightArm.forearm.rotation.set(-0.52, 0, -0.22);
      if (jawSocket) {
        const dynDrop = clamp01(Math.max(baseJawDrop, 0.65 + 0.30 * Math.sin(t * 2.2)));
        jawSocket.rotation.x = dynDrop * 0.88;
        jawSocket.position.y = -headRy * 0.24 - dynDrop * 0.028 * hScale;
      }
    } else if (action === "crawler") {
      // Spider-like quadrupedal body-horror crawl with head twisted grotesquely 180° upside-down!
      pelvis.position.y = 0.44 * hScale;
      pelvis.rotation.x = 1.24;
      spine.rotation.x = 0.16;
      neck.rotation.x = -1.18;
      head.rotation.z = Math.PI;
      leftLeg.thigh.rotation.set(-1.35, 0.36, -0.42);
      rightLeg.thigh.rotation.set(-1.35, -0.36, 0.42);
      leftLeg.calf.rotation.set(1.65, 0, 0);
      rightLeg.calf.rotation.set(1.65, 0, 0);
      leftArm.upperArm.rotation.set(-1.35, 0.18, -0.34);
      rightArm.upperArm.rotation.set(-1.35, -0.18, 0.34);
      leftArm.forearm.rotation.set(-0.42, 0, 0);
      rightArm.forearm.rotation.set(-0.42, 0, 0);
    } else if (action === "doorwayPeek") {
      // Psychological dread pose: torso stays concealed behind right doorframe while elongated neck cranes LEFTWARD (+Z rot)
      // into the open doorway and the left spider-clawed hand reaches out to grip the jamb!
      spine.rotation.set(0.08, -0.22, 0.34);
      chest.rotation.set(0.06, -0.14, 0.20);
      neck.rotation.z = 0.42;
      head.rotation.set(0.06, -0.26, 0.14);
      // Left spider arm reaches forward-left to clutch doorframe edge visibly
      leftArm.upperArm.rotation.set(-0.96, 0.18, -0.34);
      leftArm.forearm.rotation.set(-0.54, 0, 0.22);
      leftArm.hand.rotation.set(-0.42, 0.20, -0.28);
      // Right arm tucked behind the wall in darkness
      rightArm.upperArm.rotation.set(0.16, -0.22, 0.14);
      rightArm.forearm.rotation.set(-0.34, 0, 0);
      if (extraArms) {
        extraArms.leftExtraArm.rotation.set(0.10, 0.24, -0.78);
        extraArms.rightExtraArm.rotation.set(0.28, -0.25, 0.22);
      }
    } else if (action === "backbendCrab") {
      // Grotesque Exorcist / Grudge reverse backbend contortion with head hanging upside-down staring straight at camera!
      pelvis.position.y = 0.52 * hScale;
      pelvis.rotation.x = -1.28;
      spine.rotation.x = -0.58;
      chest.rotation.x = -0.34;
      neck.rotation.x = -0.45;
      head.rotation.z = Math.PI;
      leftLeg.thigh.rotation.set(0.95, 0.34, -0.36);
      rightLeg.thigh.rotation.set(0.95, -0.34, 0.36);
      leftLeg.calf.rotation.set(1.42, 0, 0);
      rightLeg.calf.rotation.set(1.42, 0, 0);
      leftArm.upperArm.rotation.set(-2.35, 0.22, -0.42);
      rightArm.upperArm.rotation.set(-2.35, -0.22, 0.42);
      leftArm.forearm.rotation.set(-0.28, 0, 0);
      rightArm.forearm.rotation.set(-0.28, 0, 0);
    } else if (action === "lungeCloseUp") {
      // Violent close-quarters lunge: crooked neck thrust forward, jaw maximally unhinged, claws spreading toward frame edges!
      pelvis.position.y = hipY - 0.06 * hScale;
      spine.rotation.x = 0.30;
      chest.rotation.x = 0.14;
      neck.rotation.x = -0.28;
      head.rotation.x = -0.14;
      leftArm.upperArm.rotation.set(-1.18, 0.28, -0.62);
      rightArm.upperArm.rotation.set(-1.22, -0.28, 0.62);
      leftArm.forearm.rotation.set(-0.32, 0, 0.26);
      rightArm.forearm.rotation.set(-0.32, 0, -0.26);
      leftArm.hand.rotation.set(-0.48, 0, -0.24);
      rightArm.hand.rotation.set(-0.48, 0, 0.24);
      if (extraArms) {
        extraArms.leftExtraArm.rotation.set(-0.48, 0.24, -1.16);
        extraArms.rightExtraArm.rotation.set(-0.48, -0.24, 1.16);
      }
      if (jawSocket) {
        jawSocket.rotation.x = 0.94;
        jawSocket.position.y = -headRy * 0.24 - 0.030 * hScale;
      }
    }

    // Twisted unnatural elbow/wrist offsets when bodyHorror.twistedJoints is enabled
    if (bh?.twistedJoints) {
      leftArm.forearm.rotation.z += 0.24;
      rightArm.forearm.rotation.z -= 0.22;
      leftArm.hand.rotation.z -= 0.28;
      rightArm.hand.rotation.z += 0.26;
    }

    // Explicit per-beat jaw override (0..1)
    if (jawSocket && opts.jawOpen !== undefined) {
      const k = clamp01(opts.jawOpen);
      jawSocket.rotation.x = k * 0.86;
      jawSocket.position.y = -headRy * 0.24 - k * 0.026 * hScale;
    }

    if (opts.twitch || ent?.neckTiltDeg) {
      const tw = uncannyTwitch(frame, seed, 28, 0.26);
      if (opts.twitch) neck.rotation.z += tw;
    }
    const jtAmt = opts.headTwitch ?? ent?.headTwitch ?? 0;
    if (jtAmt > 0.001) {
      const jt = jacobsLadderTwitch(frame, seed + 5, jtAmt);
      neck.rotation.z += jt.rz * 0.65;
      head.rotation.x += jt.rx;
      head.rotation.y += jt.ry;
      head.rotation.z += jt.rz * 0.55;
    }

    if (opts.headYaw !== undefined) head.rotation.y += opts.headYaw;
    if (opts.headPitch !== undefined) head.rotation.x += opts.headPitch;
    if (opts.headRoll !== undefined) head.rotation.z += opts.headRoll;

    const wantsFace =
      opts.expr !== undefined ||
      opts.mouth !== undefined ||
      opts.lid !== undefined ||
      opts.gazeX !== undefined ||
      opts.gazeY !== undefined ||
      opts.pupilScale !== undefined ||
      opts.ageLines !== undefined ||
      opts.sweat !== undefined ||
      opts.autoBlink !== undefined;
    if (wantsFace) {
      const blinkVal = opts.autoBlink && ent?.breathing !== false ? autoBlink(frame, seed) : 0;
      setFace({
        expr: opts.expr ?? "calm",
        mouth: opts.mouth,
        lid: opts.lid !== undefined ? Math.max(opts.lid, blinkVal) : blinkVal,
        gazeX: opts.gazeX,
        gazeY: opts.gazeY,
        pupilScale: opts.pupilScale,
        ageLines: opts.ageLines,
        sweat: opts.sweat,
        eyeGlow: ent?.eyeGlow,
      });
    }
  };

  const boneList: THREE.Group[] = [
    pelvis, spine, chest, neck, head,
    ...(jawSocket ? [jawSocket] : []),
    leftArm.shoulder, leftArm.upperArm, leftArm.forearm, leftArm.hand,
    rightArm.shoulder, rightArm.upperArm, rightArm.forearm, rightArm.hand,
    ...(extraArms ? [extraArms.leftExtraArm, extraArms.rightExtraArm] : []),
    leftLeg.thigh, leftLeg.calf, leftLeg.foot,
    rightLeg.thigh, rightLeg.calf, rightLeg.foot,
  ];

  const setPoseBlend = (from: PoseAction, to: PoseAction, tRaw: number, frame: number, opts: PoseEvalOpts = {}) => {
    const k = clamp01(tRaw);
    if (k <= 0.0001) {
      setPose(from, frame, opts);
      return;
    }
    if (k >= 0.9999) {
      setPose(to, frame, opts);
      return;
    }
    setPose(from, frame, opts);
    const pA = pelvis.position.clone();
    const rA = boneList.map((b) => [b.rotation.x, b.rotation.y, b.rotation.z] as [number, number, number]);

    setPose(to, frame, opts);
    const pB = pelvis.position.clone();
    pelvis.position.set(lerp(pA.x, pB.x, k), lerp(pA.y, pB.y, k), lerp(pA.z, pB.z, k));
    for (let i = 0; i < boneList.length; i++) {
      const b = boneList[i];
      b.rotation.set(lerp(rA[i][0], b.rotation.x, k), lerp(rA[i][1], b.rotation.y, k), lerp(rA[i][2], b.rotation.z, k));
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

  return { group: root, sockets, config: cfg, setFace, setPose, setPoseBlend, lookAtWorld, dispose };
}

/**
 * Horror Engine v5.0: Story-Driven Character Factory.
 * Builds a Character3D strictly from a `CharacterBlueprint` declared in SceneManifest so every character & entity's
 * appearance is tailored to its story description — zero hardcoded cookie-cutter monsters across unrelated videos!
 */
export function createCharacterFromBlueprint(
  bp: CharacterBlueprint,
  overrides: Partial<CharacterConfig> = {},
): Character3D {
  const ap = bp.appearance ?? {};
  const entRaw = ap.entity as EntityConfig | undefined;
  const resolvedEntity: EntityConfig | undefined =
    bp.role === "silhouette"
      ? { silhouetteMode: true, breathing: false, ...(entRaw ?? {}) }
      : entRaw;

  return createCharacter3D({
    id: bp.id,
    height: ap.height,
    skinCol: ap.skinCol,
    hairStyle: ap.hairStyle as HairStyle | undefined,
    hairCol: ap.hairCol,
    garment: ap.garment as GarmentStyle | undefined,
    topCol: ap.topCol,
    innerCol: ap.innerCol,
    bottomCol: ap.bottomCol,
    shoeCol: ap.shoeCol,
    headbandCol: ap.headbandCol,
    lowPoly: ap.lowPoly ?? true,
    uncannyRealism: ap.uncannyRealism ?? false,
    outlineMode: ap.outlineMode ?? "off",
    entity: resolvedEntity,
    ...overrides,
  });
}
