// Neutral Horror Engine v3 3D geometry, modular anti-repetition architectural kits, hero props, and batching utilities.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { flickerAt, type V3 } from "./camera";
import { rng } from "./paint";
import { stylizedShade } from "./shade";
import { NOINK } from "./ink";
import { attachOutlineRig } from "./outline3d";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters, liftK = 1): THREE.MeshLambertMaterial => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = stylizedShade(new THREE.MeshLambertMaterial(make()), liftK);
    mats.set(key, m);
  }
  return m;
};
export const phong = (key: string, make: () => THREE.MeshPhongMaterialParameters, liftK = 1): THREE.MeshPhongMaterial => {
  let m = mats.get(key) as THREE.MeshPhongMaterial | undefined;
  if (!m) {
    m = stylizedShade(new THREE.MeshPhongMaterial(make()), liftK);
    mats.set(key, m);
  }
  return m;
};

const lamOf = new Map<string, THREE.MeshLambertMaterial>();
const RECOLOR: Record<string, string> = {
  grass: "#354234",
  leafsDark: "#253127",
  woodBark: "#4f3c2f",
  woodInner: "#75604d",
  wood: "#5a4638",
  woodDark: "#3e3027",
  dirt: "#483c32",
  stone: "#6e6b68",
};

/** Convert standard/GLB materials to v3 stylized Lambert so the whole world shares one lighting model. */
export const toLambert = (m: THREE.Material): THREE.MeshLambertMaterial => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    const col = RECOLOR[m.name];
    l = stylizedShade(
      new THREE.MeshLambertMaterial({
        color: col ? new THREE.Color(col) : s.color?.clone() ?? new THREE.Color("#88868a"),
        map: s.map ?? null,
        side: s.side,
        alphaTest: s.alphaTest,
      }),
    );
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- geometry primitives ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};

/** Quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c. */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};

export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};

/** Axis box from min to max, texture tiled every `tile` metres (0 = one image per face). */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** Tapered & slightly crooked Gothic prism (for slanting cottages, headstones, flared posts, non-Lego masonry). */
export const taperedBoxGeo = (
  min: THREE.Vector3,
  max: THREE.Vector3,
  topScaleX = 1.0,
  topScaleZ = 1.0,
  skewX = 0.0,
  skewZ = 0.0,
  tile = 0,
  bottom = false,
) => {
  const cx = (min.x + max.x) * 0.5, cz = (min.z + max.z) * 0.5;
  const hw = (max.x - min.x) * 0.5, hd = (max.z - min.z) * 0.5;
  const y0 = min.y, y1 = max.y, h = y1 - y0, w = max.x - min.x, d = max.z - min.z;
  const t = (a: number) => (tile ? a / tile : 1);
  const b0 = V(cx - hw, y0, cz + hd), b1 = V(cx + hw, y0, cz + hd), b2 = V(cx + hw, y0, cz - hd), b3 = V(cx - hw, y0, cz - hd);
  const tw = hw * topScaleX, td = hd * topScaleZ;
  const u0 = V(cx + skewX - tw, y1, cz + skewZ + td), u1 = V(cx + skewX + tw, y1, cz + skewZ + td);
  const u2 = V(cx + skewX + tw, y1, cz + skewZ - td), u3 = V(cx + skewX - tw, y1, cz + skewZ - td);
  const faces = [
    quad(b0, b1, u1, u0, t(w), t(h)),
    quad(b2, b3, u3, u2, t(w), t(h)),
    quad(b3, b0, u0, u3, t(d), t(h)),
    quad(b1, b2, u2, u1, t(d), t(h)),
    quad(u0, u1, u2, u3, t(w), t(d)),
  ];
  if (bottom) faces.push(quad(b3, b2, b1, b0, t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** Real pitched Gothic gable roof with overhanging eaves & subtle crooked ridge (NO stacked flat roof boxes). */
export const pitchedRoofGeo = (
  cx: number,
  baseY: number,
  cz: number,
  width: number,
  depth: number,
  ridgeH: number,
  thick = 0.14,
  skewX = 0.08,
  tile = 1.6,
) => {
  const hw = width * 0.5, hd = depth * 0.5;
  const t = (a: number) => (tile ? a / tile : 1);
  const slopeL = Math.hypot(hw, ridgeH);
  const lf = V(cx - hw, baseY, cz + hd), lb = V(cx - hw, baseY, cz - hd);
  const rf = V(cx + hw, baseY, cz + hd), rb = V(cx + hw, baseY, cz - hd);
  const tf = V(cx + skewX, baseY + ridgeH, cz + hd), tb = V(cx + skewX, baseY + ridgeH, cz - hd);
  const lf2 = V(lf.x, lf.y - thick, lf.z), lb2 = V(lb.x, lb.y - thick, lb.z);
  const rf2 = V(rf.x, rf.y - thick, rf.z), rb2 = V(rb.x, rb.y - thick, rb.z);
  const tf2 = V(tf.x, tf.y - thick, tf.z), tb2 = V(tb.x, tb.y - thick, tb.z);
  return mergeGeometries(
    [
      // Upper slopes
      quad(lb, lf, tf, tb, t(depth), t(slopeL)),
      quad(rf, rb, tb, tf, t(depth), t(slopeL)),
      // Underside eaves
      quad(lf2, lb2, tb2, tf2, t(depth), t(slopeL)),
      quad(rb2, rf2, tf2, tb2, t(depth), t(slopeL)),
      // Front & back gable triangles + fascia
      tri(lf2, rf2, tf2),
      tri(rb2, lb2, tb2),
      quad(lf2, lf, tf, tf2, t(slopeL), 0.2),
      quad(tf2, tf, rf, rf2, t(slopeL), 0.2),
      quad(rb2, rb, tb, tb2, t(slopeL), 0.2),
      quad(tb2, tb, lb, lb2, t(slopeL), 0.2),
      // Side eave trim
      quad(lb2, lf2, lf, lb, t(depth), 0.2),
      quad(rf2, rb2, rb, rf, t(depth), 0.2),
    ],
    false,
  );
};

/** Collects pieces by material and merges them into one static mesh per material. */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal));
    else x.computeVertexNormals();
    x.setAttribute(
      "uv",
      src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2),
    );
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x);
    else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

// ---------------- Organic Gothic Nature & Props ----------------

const addLimbSeg = (b: Batch, mat: THREE.Material, a: THREE.Vector3, c: THREE.Vector3, r0: number, r1: number, segs = 6) => {
  const dir = new THREE.Vector3().subVectors(c, a);
  const len = dir.length();
  if (len < 1e-4) return;
  const mid = new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  const geo = new THREE.CylinderGeometry(r1, r0, len, segs, 1, false);
  b.add(geo, mat, new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
};

/** Multi-segment twisted Gothic gnarled tree with crooked limbs and claw-like silhouette twigs. */
export const addGnarledTree = (
  b: Batch,
  trunkMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  h: number,
  seed: number,
  leanX = 0,
  leanZ = 0,
) => {
  const r = rng(Math.abs(Math.floor(seed * 997)) + 13);
  const U = (a: number, c: number) => a + (c - a) * r();
  const baseR = 0.068 * h;
  // 4-segment sinuous trunk
  const pts: THREE.Vector3[] = [V(x, y - 0.12, z)];
  let cx = x, cy = y, cz = z;
  for (let i = 1; i <= 4; i++) {
    const u = i / 4;
    cx += leanX * 0.25 + U(-0.18, 0.18) * h * 0.18;
    cz += leanZ * 0.25 + U(-0.18, 0.18) * h * 0.18;
    cy = y + u * h * 0.72;
    pts.push(V(cx, cy, cz));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = baseR * (1 - i * 0.18);
    const r1 = baseR * (1 - (i + 1) * 0.18);
    addLimbSeg(b, trunkMat, pts[i], pts[i + 1], r0, r1, 7);
  }
  // Exposed gnarled roots gripping the ground
  for (let k = 0; k < 3; k++) {
    const ang = (k / 3) * Math.PI * 2 + U(-0.4, 0.4);
    const rEnd = V(x + Math.cos(ang) * baseR * 2.6, y - 0.1, z + Math.sin(ang) * baseR * 2.6);
    addLimbSeg(b, trunkMat, V(x, y + baseR * 1.1, z), rEnd, baseR * 0.45, baseR * 0.14, 5);
  }
  // 5 crooked primary limbs + recursive claw twigs
  for (let i = 0; i < 5; i++) {
    const anchor = pts[i < 2 ? 2 : i < 4 ? 3 : 4];
    const az = (i / 5) * Math.PI * 2 + U(-0.35, 0.35);
    const spread = h * U(0.24, 0.44);
    const rise = h * U(0.14, 0.34);
    const mid = V(anchor.x + Math.cos(az) * spread * 0.55, anchor.y + rise * 0.65, anchor.z + Math.sin(az) * spread * 0.55);
    const tip = V(
      anchor.x + Math.cos(az + U(-0.3, 0.3)) * spread,
      anchor.y + rise + U(-0.08, 0.12) * h,
      anchor.z + Math.sin(az + U(-0.3, 0.3)) * spread,
    );
    const br0 = baseR * U(0.36, 0.48);
    addLimbSeg(b, trunkMat, anchor, mid, br0, br0 * 0.55, 6);
    addLimbSeg(b, trunkMat, mid, tip, br0 * 0.55, br0 * 0.16, 5);
    // Secondary claw twigs
    for (const sgn of [-1, 1]) {
      const tAz = az + sgn * U(0.45, 0.85);
      const tLen = h * U(0.11, 0.21);
      const tEnd = V(mid.x + Math.cos(tAz) * tLen, mid.y + tLen * U(0.25, 0.75), mid.z + Math.sin(tAz) * tLen);
      addLimbSeg(b, trunkMat, mid, tEnd, br0 * 0.34, br0 * 0.08, 4);
    }
  }
};

/** Curved tall marsh reeds / bamboo / grass stalks for organic riverbank depth & foreground framing. */
export const addReedCluster = (
  b: Batch,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  count: number,
  height: number,
  seed: number,
  spread = 0.45,
) => {
  const r = rng(Math.abs(Math.floor(seed * 733)) + 31);
  const U = (a: number, c: number) => a + (c - a) * r();
  for (let i = 0; i < count; i++) {
    const ox = U(-spread, spread), oz = U(-spread, spread);
    const h = height * U(0.62, 1.25);
    const bend = U(0.14, 0.42) * h;
    const az = U(0, Math.PI * 2);
    const p0 = V(x + ox, y - 0.05, z + oz);
    const p1 = V(p0.x + Math.cos(az) * bend * 0.35, y + h * 0.55, p0.z + Math.sin(az) * bend * 0.35);
    const p2 = V(p0.x + Math.cos(az) * bend, y + h * 0.96, p0.z + Math.sin(az) * bend);
    const rad = U(0.014, 0.028);
    addLimbSeg(b, mat, p0, p1, rad, rad * 0.65, 5);
    addLimbSeg(b, mat, p1, p2, rad * 0.65, rad * 0.14, 4);
    // Optional drooping blade leaf
    if (r() < 0.75) {
      const laz = az + U(-1.1, 1.1);
      const lTip = V(p1.x + Math.cos(laz) * 0.28 * h, p1.y - 0.05 * h, p1.z + Math.sin(laz) * 0.28 * h);
      addLimbSeg(b, mat, p1, lTip, rad * 0.55, rad * 0.08, 4);
    }
  }
};

/** Organic floating water-hyacinth pad cluster (layered angled leaves instead of rectangular boxes). */
export const addHyacinthCluster = (
  b: Batch,
  leafMat: THREE.Material,
  x: number,
  y: number,
  z: number,
  radX: number,
  radZ: number,
  count: number,
  seed: number,
) => {
  const r = rng(Math.abs(Math.floor(seed * 521)) + 9);
  const U = (a: number, c: number) => a + (c - a) * r();
  for (let i = 0; i < count; i++) {
    const a = U(0, Math.PI * 2), d = Math.sqrt(r());
    const px = x + Math.cos(a) * radX * d;
    const pz = z + Math.sin(a) * radZ * d;
    const lr = U(0.09, 0.19);
    const h = U(0.05, 0.14);
    const geo = new THREE.ConeGeometry(lr, h, 6);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(U(-0.35, 0.35), U(0, Math.PI * 2), U(-0.35, 0.35)));
    b.add(geo, leafMat, new THREE.Matrix4().compose(V(px, y + h * 0.35, pz), q, V(1.15, 0.75, 0.85)));
  }
};

/** Undulating distant tree-line / hill ridge silhouette so the horizon is NEVER a flat straight bar. */
export const addDistantRidge = (
  b: Batch,
  mat: THREE.Material,
  zCenter: number,
  width: number,
  baseY: number,
  peakH: number,
  seed: number,
  steps = 28,
) => {
  const r = rng(Math.abs(Math.floor(seed * 419)) + 7);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = (u - 0.5) * width;
    const wave =
      0.52 +
      0.24 * Math.sin(u * Math.PI * 5.2 + seed) +
      0.16 * Math.cos(u * Math.PI * 11.7 + seed * 1.7) +
      0.14 * (r() - 0.5);
    const y = baseY + Math.max(0.25, wave) * peakH;
    pts.push([x, y]);
  }
  const thickness = 3.2;
  for (let i = 0; i < steps; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    b.add(quad(V(x0, baseY - 0.8, zCenter), V(x1, baseY - 0.8, zCenter), V(x1, y1, zCenter), V(x0, y0, zCenter)), mat);
    b.add(
      quad(
        V(x1, baseY - 0.8, zCenter - thickness),
        V(x0, baseY - 0.8, zCenter - thickness),
        V(x0, y0, zCenter - thickness),
        V(x1, y1, zCenter - thickness),
      ),
      mat,
    );
    b.add(quad(V(x0, y0, zCenter), V(x1, y1, zCenter), V(x1, y1, zCenter - thickness), V(x0, y0, zCenter - thickness)), mat);
  }
};

/** Real tapered hexagonal storm lantern 3D prop (iron cage + cap + reservoir + HDR emissive glass core). */
export const addStormLantern3D = (
  b: Batch,
  ironMat: THREE.Material,
  glassMat: THREE.MeshBasicMaterial,
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  s = 1.0,
) => {
  // Reservoir base
  b.add(new THREE.CylinderGeometry(0.10 * s, 0.125 * s, 0.08 * s, 6), ironMat, new THREE.Matrix4().makeTranslation(x, y - 0.14 * s, z));
  // Chimney hood & domed cap
  b.add(new THREE.CylinderGeometry(0.06 * s, 0.125 * s, 0.07 * s, 6), ironMat, new THREE.Matrix4().makeTranslation(x, y + 0.14 * s, z));
  b.add(new THREE.CylinderGeometry(0.03 * s, 0.065 * s, 0.05 * s, 6), ironMat, new THREE.Matrix4().makeTranslation(x, y + 0.195 * s, z));
  // 4 thin iron guard ribs around glass
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const rx = x + Math.cos(a) * 0.105 * s, rz = z + Math.sin(a) * 0.105 * s;
    b.add(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.24 * s, 4), ironMat, new THREE.Matrix4().makeTranslation(rx, y, rz));
  }
  // HDR glowing glass core
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.078 * s, 0.085 * s, 0.20 * s, 6), glassMat);
  bulb.position.set(x, y, z);
  bulb.layers.set(NOINK);
  parent.add(bulb);
  return bulb;
};

/** Real curved tapered sampan/skiff hull built from multi-station lofted ribs (NO stacked Lego boxes!). */
export const addSampanHull = (
  b: Batch,
  plankMat: THREE.Material,
  timberMat: THREE.Material,
  darkMat: THREE.Material,
) => {
  // Cross-section stations from stern (z = -1.85) to upturned pointed bow (z = +1.35)
  const stations: { z: number; bW: number; tW: number; botY: number; topY: number }[] = [
    { z: -1.85, bW: 0.04, tW: 0.07, botY: 0.14, topY: 0.38 },
    { z: -1.45, bW: 0.24, tW: 0.39, botY: -0.02, topY: 0.30 },
    { z: -0.75, bW: 0.39, tW: 0.56, botY: -0.07, topY: 0.27 },
    { z: 0.0, bW: 0.40, tW: 0.57, botY: -0.07, topY: 0.27 },
    { z: 0.72, bW: 0.26, tW: 0.42, botY: -0.02, topY: 0.32 },
    { z: 1.15, bW: 0.08, tW: 0.16, botY: 0.10, topY: 0.42 },
    { z: 1.38, bW: 0.015, tW: 0.025, botY: 0.22, topY: 0.48 },
  ];
  const wallT = 0.045;
  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i], s1 = stations[i + 1];
    const dz = s1.z - s0.z;
    // Outer left & right flared planks
    b.add(quad(V(-s0.bW, s0.botY, s0.z), V(-s1.bW, s1.botY, s1.z), V(-s1.tW, s1.topY, s1.z), V(-s0.tW, s0.topY, s0.z), dz, 0.4), timberMat);
    b.add(quad(V(s1.bW, s1.botY, s1.z), V(s0.bW, s0.botY, s0.z), V(s0.tW, s0.topY, s0.z), V(s1.tW, s1.topY, s1.z), dz, 0.4), timberMat);
    // Inner hull planks
    b.add(
      quad(
        V(-s1.bW + wallT, s1.botY + 0.03, s1.z),
        V(-s0.bW + wallT, s0.botY + 0.03, s0.z),
        V(-s0.tW + wallT, s0.topY, s0.z),
        V(-s1.tW + wallT, s1.topY, s1.z),
        dz,
        0.4,
      ),
      darkMat,
    );
    b.add(
      quad(
        V(s0.bW - wallT, s0.botY + 0.03, s0.z),
        V(s1.bW - wallT, s1.botY + 0.03, s1.z),
        V(s1.tW - wallT, s1.topY, s1.z),
        V(s0.tW - wallT, s0.topY, s0.z),
        dz,
        0.4,
      ),
      darkMat,
    );
    // Gunwale top rails
    b.add(
      quad(V(-s0.tW, s0.topY, s0.z), V(-s1.tW, s1.topY, s1.z), V(-s1.tW + wallT, s1.topY, s1.z), V(-s0.tW + wallT, s0.topY, s0.z)),
      darkMat,
    );
    b.add(
      quad(V(s1.tW, s1.topY, s1.z), V(s0.tW, s0.topY, s0.z), V(s0.tW - wallT, s0.topY, s0.z), V(s1.tW - wallT, s1.topY, s1.z)),
      darkMat,
    );
    // Bottom floor planks (inner top & outer underside)
    b.add(quad(V(-s0.bW, s0.botY + 0.03, s0.z), V(s0.bW, s0.botY + 0.03, s0.z), V(s1.bW, s1.botY + 0.03, s1.z), V(-s1.bW, s1.botY + 0.03, s1.z), 1, dz), plankMat);
    b.add(quad(V(s0.bW, s0.botY, s0.z), V(-s0.bW, s0.botY, s0.z), V(-s1.bW, s1.botY, s1.z), V(s1.bW, s1.botY, s1.z)), darkMat);
  }
  // Curved cross-thwarts (benches) & bow mooring post + resting wooden oar
  for (const [tz, tw] of [[-1.08, 0.44], [-0.36, 0.52], [0.42, 0.44]] as const) {
    b.add(boxGeo(V(-tw, 0.16, tz - 0.10), V(tw, 0.21, tz + 0.10), 0.7), plankMat);
  }
  b.add(new THREE.CylinderGeometry(0.032, 0.042, 0.22, 6), darkMat, new THREE.Matrix4().makeTranslation(0, 0.40, 1.05));
  // Oar shaft + angled paddle blade
  addLimbSeg(b, darkMat, V(0.28, 0.24, -1.45), V(0.18, 0.27, 0.65), 0.022, 0.022, 6);
  b.add(boxGeo(V(0.22, 0.22, -1.78), V(0.35, 0.25, -1.32), 0.5), timberMat);
};

// ---------------- Shadow-Depth Volumetric Light Shafts & Foreground Silhouette Framing ----------------

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormV;
varying vec3 vViewD;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormV = normalize(normalMatrix * normal);
  vViewD = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const SHAFT_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vNormV;
varying vec3 vViewD;
void main() {
  // Soft vertical attenuation (fade cleanly at top and bottom) + soft radial Fresnel edge fade
  float vFade = smoothstep(0.0, 0.30, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
  float rim = pow(abs(dot(vNormV, vViewD)), 1.65);
  float a = vFade * rim * uOpacity;
  gl_FragColor = vec4(uCol, a);
}`;

/** Soft additive volumetric light shaft (moonbeam, window shaft, lantern beam) on NOINK layer. */
export const addVolumetricShaft = (
  parent: THREE.Object3D,
  pos: [number, number, number],
  rotEuler: [number, number, number],
  length: number,
  topR: number,
  botR: number,
  color: THREE.ColorRepresentation = "#9ec4ff",
  opacity = 0.14,
) => {
  const geo = new THREE.CylinderGeometry(topR, botR, length, 20, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rotEuler);
  mesh.layers.set(NOINK);
  mesh.renderOrder = 3;
  parent.add(mesh);
  return { mesh, mat };
};

/** Pure Shadow-Depth (Limbo / Little Nightmares) ultra-dark silhouette overhanging branch / reed cluster for foreground framing. */
export const addForegroundSilhouette = (
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1.0,
  seed = 1,
  side: -1 | 1 = -1,
) => {
  const b = new Batch();
  const silMat = new THREE.MeshBasicMaterial({ color: "#050409", fog: false });
  const r = rng(Math.abs(Math.floor(seed * 613)) + 5);
  const U = (a: number, c: number) => a + (c - a) * r();
  const root = V(x, y, z);
  const mid = V(x - side * 0.75 * scale, y - 0.18 * scale, z + U(-0.1, 0.1));
  const tip = V(x - side * 1.45 * scale, y - 0.45 * scale, z + U(-0.12, 0.12));
  addLimbSeg(b, silMat, root, mid, 0.065 * scale, 0.036 * scale, 5);
  addLimbSeg(b, silMat, mid, tip, 0.036 * scale, 0.012 * scale, 4);
  for (let i = 0; i < 6; i++) {
    const u = 0.25 + (i / 6) * 0.72;
    const bx = root.x + (tip.x - root.x) * u;
    const by = root.y + (tip.y - root.y) * u;
    const bz = root.z + (tip.z - root.z) * u;
    const twigTip = V(bx - side * U(0.15, 0.42) * scale, by - U(0.18, 0.48) * scale, bz + U(-0.08, 0.08));
    addLimbSeg(b, silMat, V(bx, by, bz), twigTip, 0.016 * scale, 0.004 * scale, 4);
  }
  const grp = new THREE.Group();
  b.build(grp, false);
  grp.traverse((o) => o.layers.set(NOINK));
  parent.add(grp);
  return grp;
};

// ---------------- strands: rope or interlocking chain links along a 3D path ----------------
const LNS = 16, LNR = 6;
type LinkT = { p: Float32Array; n: Float32Array; idx: number[]; pitch: number };
const linkTemplate = (h: number): LinkT => {
  const ow = h * 0.85, rb = ow * 0.14, ol = ow * 1.62, rc = ow / 2 - rb, hl = ol / 2 - rb - rc;
  const p = new Float32Array(LNS * LNR * 3), n = new Float32Array(LNS * LNR * 3), idx: number[] = [];
  for (let j = 0; j < LNS; j++) {
    const th = (2 * Math.PI * (j + 0.5)) / LNS, nx = Math.cos(th), ny = Math.sin(th);
    const cx = rc * nx + Math.sign(nx) * hl, cy = rc * ny;
    for (let k = 0; k < LNR; k++) {
      const ph = (2 * Math.PI * k) / LNR, cp = Math.cos(ph), sp = Math.sin(ph), o = (j * LNR + k) * 3;
      p[o] = cx + rb * cp * nx; p[o + 1] = cy + rb * cp * ny; p[o + 2] = rb * sp;
      n[o] = cp * nx; n[o + 1] = cp * ny; n[o + 2] = sp;
      const a = j * LNR + k, b = j * LNR + ((k + 1) % LNR), c = ((j + 1) % LNS) * LNR + ((k + 1) % LNR), d = ((j + 1) % LNS) * LNR + k;
      idx.push(a, d, c, a, c, b);
    }
  }
  return { p, n, idx, pitch: ol - 4 * rb };
};

export class Strand {
  mesh: THREE.Mesh;
  n: number;
  w: number;
  h: number;
  tile: number;
  private pos: Float32Array; private nor: Float32Array; private uv: Float32Array;
  private lt: LinkT | null = null; private maxLinks = 0;
  constructor(n: number, w: number, h: number, mat: THREE.Material, tile = 1, cast = true, links = false) {
    this.n = n;
    this.w = w;
    this.h = h;
    this.tile = tile;
    const g = new THREE.BufferGeometry();
    if (links) {
      const lt = (this.lt = linkTemplate(h)), nv = LNS * LNR;
      this.maxLinks = 440;
      this.pos = new Float32Array(this.maxLinks * nv * 3); this.nor = new Float32Array(this.maxLinks * nv * 3); this.uv = new Float32Array(this.maxLinks * nv * 2);
      const idx = new Uint32Array(this.maxLinks * lt.idx.length);
      for (let l = 0; l < this.maxLinks; l++) for (let i = 0; i < lt.idx.length; i++) idx[l * lt.idx.length + i] = lt.idx[i] + l * nv;
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
    } else {
      this.pos = new Float32Array(n * 12); this.nor = new Float32Array(n * 12); this.uv = new Float32Array(n * 8);
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
      const idx: number[] = [];
      for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
        idx.push(a, b, c, a, c, d);
      }
      g.setIndex(idx);
    }
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = cast; this.mesh.receiveShadow = true;
  }
  private T = new THREE.Vector3(); private S = new THREE.Vector3(); private N = new THREE.Vector3();
  private setLinks(pts: THREE.Vector3[], lt: LinkT) {
    const { T, S, N } = this, nv = LNS * LNR;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[cum.length - 1], count = Math.max(0, Math.min(this.maxLinks, Math.floor(total / lt.pitch)));
    const s0 = (total - (count - 1) * lt.pitch) / 2;
    let seg = 1;
    for (let l = 0; l < count; l++) {
      const s = s0 + l * lt.pitch;
      while (seg < pts.length - 1 && cum[seg] < s) seg++;
      const a = pts[seg - 1], b = pts[seg], u = (s - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u;
      T.subVectors(b, a).normalize();
      S.set(-T.z, 0, T.x);
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      const odd = l % 2 === 1;
      const yx = odd ? S.x : N.x, yy = odd ? S.y : N.y, yz = odd ? S.z : N.z;
      const zx = odd ? -N.x : S.x, zy = odd ? -N.y : S.y, zz = odd ? -N.z : S.z;
      const base = l * nv * 3;
      for (let v = 0; v < nv * 3; v += 3) {
        const x = lt.p[v], y = lt.p[v + 1], z = lt.p[v + 2], o = base + v;
        this.pos[o] = px + T.x * x + yx * y + zx * z;
        this.pos[o + 1] = py + T.y * x + yy * y + zy * z;
        this.pos[o + 2] = pz + T.z * x + yz * y + zz * z;
        const nx = lt.n[v], ny = lt.n[v + 1], nz = lt.n[v + 2];
        this.nor[o] = T.x * nx + yx * ny + zx * nz;
        this.nor[o + 1] = T.y * nx + yy * ny + zy * nz;
        this.nor[o + 2] = T.z * nx + yz * ny + zz * nz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, count * lt.idx.length);
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }
  set(pts: THREE.Vector3[]) {
    if (this.lt) { this.setLinks(pts, this.lt); return; }
    const { T, S, N } = this;
    let len = 0;
    for (let i = 0; i < this.n; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.subVectors(b, a).normalize();
      S.crossVectors(T, V(0, 1, 0));
      if (S.lengthSq() < 1e-6) S.set(1, 0, 0);
      S.normalize(); N.crossVectors(S, T).normalize();
      if (i) len += p.distanceTo(pts[Math.min(i - 1, pts.length - 1)]);
      for (let k = 0; k < 4; k++) {
        const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, j = (i * 4 + k) * 3;
        this.pos[j] = p.x + S.x * sx * this.w / 2 + N.x * sy * this.h / 2;
        this.pos[j + 1] = p.y + S.y * sx * this.w / 2 + N.y * sy * this.h / 2;
        this.pos[j + 2] = p.z + S.z * sx * this.w / 2 + N.z * sy * this.h / 2;
        const nx = S.x * sx + N.x * sy, ny = S.y * sx + N.y * sy, nz = S.z * sx + N.z * sy, nl = Math.hypot(nx, ny, nz);
        this.nor[j] = nx / nl; this.nor[j + 1] = ny / nl; this.nor[j + 2] = nz / nl;
        this.uv[(i * 4 + k) * 2] = k / 4; this.uv[(i * 4 + k) * 2 + 1] = len / this.tile;
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
  }
}

// ---------------- sight-line helper ----------------
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
export const inTheWay = (rays: Ray[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false): boolean => {
  for (const { o, d, len, core } of rays) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- GLB kit helpers ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0, rays: Ray[] = []) => {
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (rays.length && inTheWay(rays, x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};

export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- Horror Engine v3: Modular Anti-Repetition Architectural & Hero-Prop Builders ----------------

/** Build a clean wall slab with an exact rectangular cutout opening (doorway, window, or passage) with zero overlap. */
export function addWallWithOpening(
  b: Batch,
  mat: THREE.Material,
  wallMin: V3,
  wallMax: V3,
  opening: { axis: "x" | "z"; u0: number; u1: number; y0: number; y1: number },
  tile = 2.0,
): void {
  const [x0, yMin, z0] = wallMin;
  const [x1, yMax, z1] = wallMax;
  const oy0 = Math.max(yMin, opening.y0);
  const oy1 = Math.min(yMax, opening.y1);

  if (opening.axis === "x") {
    const ox0 = Math.max(x0, opening.u0);
    const ox1 = Math.min(x1, opening.u1);
    if (ox0 > x0 + 0.01) b.add(boxGeo(V(x0, yMin, z0), V(ox0, yMax, z1), tile), mat);
    if (x1 > ox1 + 0.01) b.add(boxGeo(V(ox1, yMin, z0), V(x1, yMax, z1), tile), mat);
    if (oy0 > yMin + 0.01 && ox1 > ox0 + 0.01) b.add(boxGeo(V(ox0, yMin, z0), V(ox1, oy0, z1), tile), mat);
    if (yMax > oy1 + 0.01 && ox1 > ox0 + 0.01) b.add(boxGeo(V(ox0, oy1, z0), V(ox1, yMax, z1), tile), mat);
  } else {
    const oz0 = Math.max(z0, opening.u0);
    const oz1 = Math.min(z1, opening.u1);
    if (oz0 > z0 + 0.01) b.add(boxGeo(V(x0, yMin, z0), V(x1, yMax, oz0), tile), mat);
    if (z1 > oz1 + 0.01) b.add(boxGeo(V(x0, yMin, oz1), V(x1, yMax, z1), tile), mat);
    if (oy0 > yMin + 0.01 && oz1 > oz0 + 0.01) b.add(boxGeo(V(x0, yMin, oz0), V(x1, oy0, oz1), tile), mat);
    if (yMax > oy1 + 0.01 && oz1 > oz0 + 0.01) b.add(boxGeo(V(x0, oy1, oz0), V(x1, yMax, oz1), tile), mat);
  }
}

/** Exposed Vietnamese rural A-frame timber roof trusses + pitched thatch/tile underside visible from inside. */
export function addAFrameRoof(
  b: Batch,
  trussMat: THREE.Material,
  roofMat: THREE.Material,
  cfg: { cx: number; cz: number; width: number; depth: number; eaveY: number; ridgeH: number; trussCount?: number; tile?: number },
): void {
  const { cx, cz, width, depth, eaveY, ridgeH } = cfg;
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const tile = cfg.tile ?? 1.8;
  const slopeLen = Math.hypot(hw, ridgeH);

  // Double-sided pitched roof shell (visible cleanly from inside looking up!)
  b.add(pitchedRoofGeo(cx, eaveY, cz, width + 0.35, depth + 0.35, ridgeH, 0.14, 0, tile), roofMat);

  // Ridge beam + longitudinal purlins along both slopes
  b.add(boxGeo(V(cx - 0.07, eaveY + ridgeH - 0.20, cz - hd), V(cx + 0.07, eaveY + ridgeH - 0.06, cz + hd), 2.0), trussMat);
  for (const frac of [0.35, 0.68]) {
    const py = eaveY + ridgeH * frac - 0.10;
    const px = hw * (1 - frac);
    b.add(boxGeo(V(cx - px - 0.05, py - 0.05, cz - hd), V(cx - px + 0.05, py + 0.05, cz + hd), 2.0), trussMat);
    b.add(boxGeo(V(cx + px - 0.05, py - 0.05, cz - hd), V(cx + px + 0.05, py + 0.05, cz + hd), 2.0), trussMat);
  }

  // Exposed A-frame triangular trusses (tie beam + left/right rafters + king post)
  const count = Math.max(2, cfg.trussCount ?? 4);
  const rafterAngle = Math.atan2(ridgeH, hw);
  for (let i = 0; i < count; i++) {
    const tz = cz - hd + 0.35 + ((depth - 0.7) * i) / (count - 1);
    // Horizontal tie beam
    b.add(boxGeo(V(cx - hw, eaveY - 0.14, tz - 0.065), V(cx + hw, eaveY, tz + 0.065), 1.5), trussMat);
    // King post
    b.add(boxGeo(V(cx - 0.055, eaveY, tz - 0.055), V(cx + 0.055, eaveY + ridgeH - 0.12, tz + 0.055), 1.5), trussMat);
    // Angled left & right rafters
    for (const side of [-1, 1] as const) {
      const m = new THREE.Matrix4().compose(
        V(cx + side * hw * 0.5, eaveY + ridgeH * 0.5 - 0.08, tz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -side * rafterAngle)),
        V(slopeLen, 0.11, 0.11),
      );
      b.add(new THREE.BoxGeometry(1, 1, 1), trussMat, m);
    }
  }
}

export type DoubleDoorCtrl = {
  group: THREE.Group;
  leftPivot: THREE.Group;
  rightPivot: THREE.Group;
  boltBar: THREE.Mesh;
  moonStrip: THREE.Mesh;
  feetBlockers: THREE.Group;
  setOpen: (rad: number) => void;
  setMoonlight: (on: boolean, feetShadow?: boolean) => void;
};

/**
 * Hinged 2-leaf wooden door with controllable vertical center crack, bottom gap, horizontal bolt bar,
 * cold moonlight floor trapezoid projection, and 2 dark silhouette foot-shadow blockers (like videomau sec_050/067/088).
 */
export function addDoubleDoorWithCracks(
  parent: THREE.Object3D,
  mats: { frame: THREE.Material; leaf: THREE.Material; bolt: THREE.Material },
  cfg: { pos: V3; yaw?: number; width?: number; height?: number; crackW?: number; bottomGap?: number; moonColor?: string },
): DoubleDoorCtrl {
  const w = cfg.width ?? 1.48;
  const h = cfg.height ?? 2.24;
  const crackW = cfg.crackW ?? 0.032;
  const bottomGap = cfg.bottomGap ?? 0.042;
  const moonCol = cfg.moonColor ?? "#9ab0d4";

  const group = new THREE.Group();
  group.name = "DoubleDoorWithCracks";
  group.position.set(...cfg.pos);
  group.rotation.y = cfg.yaw ?? 0;

  // Thick exterior frame jambs & lintel
  const fb = new Batch();
  const frameT = 0.12;
  const frameD = 0.18;
  fb.add(boxGeo(V(-w * 0.5 - frameT, 0, -frameD * 0.5), V(-w * 0.5, h + frameT, frameD * 0.5), 1.2), mats.frame);
  fb.add(boxGeo(V(w * 0.5, 0, -frameD * 0.5), V(w * 0.5 + frameT, h + frameT, frameD * 0.5), 1.2), mats.frame);
  fb.add(boxGeo(V(-w * 0.5 - frameT - 0.04, h, -frameD * 0.5 - 0.02), V(w * 0.5 + frameT + 0.04, h + frameT + 0.04, frameD * 0.5 + 0.02), 1.2), mats.frame);
  fb.build(group, true);

  // Two hinged door leaves with explicit center crack & bottom gap
  const leafW = (w - crackW) * 0.5;
  const leafH = h - bottomGap;
  const makeLeaf = (side: -1 | 1) => {
    const piv = new THREE.Group();
    piv.position.set(side * w * 0.5, bottomGap, 0);
    const lb = new Batch();
    const x0 = side < 0 ? 0 : -leafW;
    const x1 = side < 0 ? leafW : 0;
    lb.add(boxGeo(V(x0, 0, -0.028), V(x1, leafH, 0.028), 1.1), mats.leaf);
    // Horizontal cross-rails
    lb.add(boxGeo(V(x0 + 0.03, 0.18, 0.025), V(x1 - 0.03, 0.28, 0.052), 1.0), mats.frame);
    lb.add(boxGeo(V(x0 + 0.03, leafH - 0.30, 0.025), V(x1 - 0.03, leafH - 0.20, 0.052), 1.0), mats.frame);
    lb.build(piv, true);
    group.add(piv);
    return piv;
  };
  const leftPivot = makeLeaf(-1);
  const rightPivot = makeLeaf(1);

  // Horizontal wooden bolt bar across interior face (+Z)
  const boltBar = new THREE.Mesh(boxGeo(V(-w * 0.44, -0.05, -0.03), V(w * 0.44, 0.05, 0.03), 1.0), mats.bolt);
  boltBar.position.set(0, h * 0.46, 0.072);
  boltBar.castShadow = true;
  boltBar.receiveShadow = true;
  group.add(boltBar);

  // Glowing vertical & bottom crack strips (visible when moonlit from outside!)
  const crackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.45, 1.65, 2.10), toneMapped: false });
  const vCrack = new THREE.Mesh(new THREE.PlaneGeometry(crackW * 0.85, h), crackMat);
  vCrack.position.set(0, h * 0.5, -0.038);
  vCrack.layers.set(NOINK);
  const bCrack = new THREE.Mesh(new THREE.PlaneGeometry(w, bottomGap * 0.9), crackMat);
  bCrack.position.set(0, bottomGap * 0.5, -0.038);
  bCrack.layers.set(NOINK);
  group.add(vCrack, bCrack);

  // Floor moonlight trapezoid projection spilling inward (+Z)
  const moonMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(moonCol) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv;
      void main(){
        float fade = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.15);
        float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        gl_FragColor = vec4(uCol, fade * edgeX * 0.52);
      }`,
  });
  const stripLen = 1.65;
  const stripGeo = new THREE.BufferGeometry();
  const hw0 = w * 0.46, hw1 = w * 0.62;
  stripGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-hw0, 0.012, 0.04, hw0, 0.012, 0.04, hw1, 0.012, stripLen, -hw0, 0.012, 0.04, hw1, 0.012, stripLen, -hw1, 0.012, stripLen],
      3,
    ),
  );
  stripGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  const moonStrip = new THREE.Mesh(stripGeo, moonMat);
  moonStrip.layers.set(NOINK);
  moonStrip.renderOrder = 1;
  group.add(moonStrip);

  // Two dark foot-shadow streaks cutting across the floor moonlight strip (someone standing outside!)
  const feetBlockers = new THREE.Group();
  feetBlockers.name = "DoorFeetShadowBlockers";
  const shadowMat = new THREE.MeshBasicMaterial({
    color: "#090a10",
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  for (const fx of [-0.19, 0.19]) {
    const fGeo = new THREE.PlaneGeometry(0.15, stripLen * 0.96);
    fGeo.rotateX(-Math.PI * 0.5);
    const fm = new THREE.Mesh(fGeo, shadowMat);
    fm.position.set(fx, 0.016, stripLen * 0.5 + 0.02);
    fm.layers.set(NOINK);
    fm.renderOrder = 2;
    feetBlockers.add(fm);
  }
  feetBlockers.visible = false;
  group.add(feetBlockers);

  parent.add(group);

  const setOpen = (rad: number) => {
    leftPivot.rotation.y = -rad;
    rightPivot.rotation.y = rad;
    boltBar.visible = Math.abs(rad) < 0.08;
  };

  const setMoonlight = (on: boolean, feetShadow = false) => {
    vCrack.visible = on;
    bCrack.visible = on;
    moonStrip.visible = on;
    feetBlockers.visible = on && feetShadow;
  };

  return { group, leftPivot, rightPivot, boltBar, moonStrip, feetBlockers, setOpen, setMoonlight };
}

/** Modular institutional apartment / hospital corridor bay (floor, ceiling, baseboards, recessed side doors). */
export function addCorridorBay(
  b: Batch,
  mats: { wall: THREE.Material; floor: THREE.Material; ceiling: THREE.Material; trim: THREE.Material },
  cfg: { z0: number; z1: number; width: number; height: number; doorLeft?: boolean; doorRight?: boolean },
): void {
  const { z0, z1, width, height } = cfg;
  const hw = width * 0.5;
  const zMid = (z0 + z1) * 0.5;
  const wallT = 0.14;

  // Floor & flat ceiling
  b.add(boxGeo(V(-hw - wallT, -0.12, z0), V(hw + wallT, 0, z1), 1.6), mats.floor);
  b.add(boxGeo(V(-hw - wallT, height, z0), V(hw + wallT, height + 0.14, z1), 2.0), mats.ceiling);

  // Left & right walls (with optional recessed door alcoves)
  const buildSide = (side: -1 | 1, hasDoor: boolean) => {
    const x0 = side < 0 ? -hw - wallT : hw;
    const x1 = side < 0 ? -hw : hw + wallT;
    if (hasDoor) {
      addWallWithOpening(b, mats.wall, [x0, 0, z0], [x1, height, z1], { axis: "z", u0: zMid - 0.50, u1: zMid + 0.50, y0: 0, y1: 2.15 }, 2.0);
      // Recessed door panel & trim
      const dx = side < 0 ? -hw - 0.08 : hw + 0.08;
      b.add(boxGeo(V(dx - 0.03, 0, zMid - 0.48), V(dx + 0.03, 2.14, zMid + 0.48), 1.2), mats.trim);
    } else {
      b.add(boxGeo(V(x0, 0, z0), V(x1, height, z1), 2.0), mats.wall);
    }
    // Baseboard & ceiling molding trim
    const bx = side < 0 ? -hw : hw - 0.04;
    b.add(boxGeo(V(bx, 0, z0), V(bx + 0.04, 0.14, z1), 1.0), mats.trim);
    b.add(boxGeo(V(bx, height - 0.10, z0), V(bx + 0.04, height, z1), 1.0), mats.trim);
  };
  buildSide(-1, !!cfg.doorLeft);
  buildSide(1, !!cfg.doorRight);
}

/** Modular concrete or timber staircase flight with handrail. */
export function addStairFlight(
  b: Batch,
  stepMat: THREE.Material,
  railMat: THREE.Material,
  cfg: { start: V3; steps: number; width: number; stepRise: number; stepRun: number; yaw?: number },
): void {
  const { start, steps, width, stepRise, stepRun } = cfg;
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), cfg.yaw ?? 0);
  const base = V(...start);
  const hw = width * 0.5;
  for (let i = 0; i < steps; i++) {
    const local = V(0, (i + 0.5) * stepRise, -(i + 0.5) * stepRun).applyQuaternion(q).add(base);
    b.add(new THREE.BoxGeometry(width, stepRise, stepRun + 0.02), stepMat, new THREE.Matrix4().compose(local, q, V(1, 1, 1)));
  }
  // Angled side handrails
  const totalRise = steps * stepRise;
  const totalRun = steps * stepRun;
  const len = Math.hypot(totalRise, totalRun);
  const pitch = Math.atan2(totalRise, totalRun);
  for (const side of [-1, 1] as const) {
    const mid = V(side * (hw - 0.05), totalRise * 0.5 + 0.90, -totalRun * 0.5).applyQuaternion(q).add(base);
    const rq = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, 0)));
    b.add(new THREE.BoxGeometry(0.05, 0.05, len), railMat, new THREE.Matrix4().compose(mid, rq, V(1, 1, 1)));
  }
}

/** Traditional Vietnamese glass-chimney oil lamp (đèn dầu) with rounded bulb, translucent chimney & HDR flame. */
export function addGlassOilLamp3D(
  parent: THREE.Object3D,
  pos: V3,
  scale = 1.0,
): { group: THREE.Group; flameMat: THREE.MeshBasicMaterial; setLit: (lit: boolean, frame: number) => void } {
  const group = new THREE.Group();
  group.name = "GlassOilLamp3D";
  group.position.set(...pos);
  group.scale.setScalar(scale);

  const footMat = lam("v3_oillamp_foot", () => ({ color: "#4e5662" }));
  const bulbMat = phong("v3_oillamp_bulb", () => ({ color: "#c9985a", specular: "#ffe2aa", shininess: 42 }));
  const collarMat = phong("v3_oillamp_collar", () => ({ color: "#8a6d3f", specular: "#e0c482", shininess: 48 }));
  const glassMat = new THREE.MeshBasicMaterial({
    color: "#f2ece2",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.075, 0.026, 16), footMat);
  foot.position.y = 0.013;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), bulbMat);
  bulb.scale.set(1.0, 0.78, 1.0);
  bulb.position.y = 0.078;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.040, 0.044, 14), collarMat);
  collar.position.y = 0.145;

  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 2.25, 0.78), toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.062, 8), flameMat);
  flame.position.y = 0.198;
  flame.userData.noOutline = true;

  const chimneyPts = [
    new THREE.Vector2(0.032, 0.165),
    new THREE.Vector2(0.056, 0.220),
    new THREE.Vector2(0.048, 0.275),
    new THREE.Vector2(0.025, 0.345),
    new THREE.Vector2(0.027, 0.382),
  ];
  const chimney = new THREE.Mesh(new THREE.LatheGeometry(chimneyPts, 16), glassMat);
  chimney.userData.noOutline = true;

  group.add(foot, bulb, collar, flame, chimney);
  attachOutlineRig(group, { pxWidth: 4.8, minWorld: 0.001, maxWorld: 0.012, color: "#06060a" });
  parent.add(group);

  const setLit = (lit: boolean, frame: number) => {
    flame.visible = lit;
    if (lit) {
      const flk = flickerAt(frame, 29, 0.25, 0.78);
      flame.scale.set(0.94 + 0.14 * flk, 0.86 + 0.28 * flk, 0.94 + 0.14 * flk);
      flameMat.color.setRGB(3.6 * flk, 2.25 * flk, 0.78 * flk);
    }
  };
  return { group, flameMat, setLit };
}

/** Ceramic ancestral incense burner (bát hương) with 3 incense sticks & glowing ember tips. */
export function addIncenseBurner3D(
  parent: THREE.Object3D,
  pos: V3,
  scale = 1.0,
): { group: THREE.Group; tipMat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  group.name = "IncenseBurner3D";
  group.position.set(...pos);
  group.scale.setScalar(scale);

  const bowlMat = phong("v3_incense_bowl", () => ({ color: "#c2b698", specular: "#ece4cf", shininess: 28 }));
  const stickMat = lam("v3_incense_stick", () => ({ color: "#3d2c24" }));
  const tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.75, 0.28), toneMapped: false });

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.056, 0.095, 16), bowlMat);
  bowl.position.y = 0.048;
  group.add(bowl);

  for (const [sx, sz, rz] of [[-0.022, 0.004, 0.06], [0, -0.006, 0], [0.022, 0.005, -0.06]] as const) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.24, 6), stickMat);
    st.position.set(sx, 0.18, sz);
    st.rotation.z = rz;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 6, 6), tipMat);
    tip.position.set(sx - Math.sin(rz) * 0.12, 0.30, sz);
    tip.userData.noOutline = true;
    group.add(st, tip);
  }
  attachOutlineRig(group, { pxWidth: 4.2, minWorld: 0.001, maxWorld: 0.010, color: "#06060a" });
  parent.add(group);
  return { group, tipMat };
}

/** Overhead institutional fluorescent tube light fixture (hospital / apartment / classroom). */
export function addFluorescentTube3D(
  parent: THREE.Object3D,
  pos: V3,
  length = 1.18,
  yaw = 0,
): { group: THREE.Group; tubeMat: THREE.MeshBasicMaterial; setIntensity: (k: number) => void } {
  const group = new THREE.Group();
  group.name = "FluorescentTube3D";
  group.position.set(...pos);
  group.rotation.y = yaw;

  const housingMat = lam("v3_fluor_housing", () => ({ color: "#424a4c" }));
  const housing = new THREE.Mesh(new THREE.BoxGeometry(length + 0.08, 0.05, 0.12), housingMat);
  housing.position.y = 0.025;
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.35, 2.15), toneMapped: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, length, 10).rotateZ(Math.PI * 0.5), tubeMat);
  tube.position.y = -0.022;
  tube.layers.set(NOINK);
  group.add(housing, tube);
  parent.add(group);

  const setIntensity = (k: number) => {
    tubeMat.color.setRGB(1.9 * k, 2.35 * k, 2.15 * k);
  };
  return { group, tubeMat, setIntensity };
}

/** Exterior rural/alley concrete or metal pole streetlamp with warm sodium-vapor bulb. */
export function addStreetLamp3D(
  parent: THREE.Object3D,
  pos: V3,
  height = 4.6,
  armYaw = 0,
): { group: THREE.Group; bulbMat: THREE.MeshBasicMaterial; bulbWorldPos: V3 } {
  const group = new THREE.Group();
  group.name = "StreetLamp3D";
  group.position.set(...pos);
  group.rotation.y = armYaw;

  const poleMat = lam("v3_street_pole", () => ({ color: "#3d424a" }));
  const hoodMat = lam("v3_street_hood", () => ({ color: "#272b32" }));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.10, height, 8), poleMat);
  pole.position.y = height * 0.5;
  pole.castShadow = true;

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.05, 8).rotateZ(Math.PI * 0.5 - 0.18), poleMat);
  arm.position.set(0.46, height - 0.12, 0);

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 10), hoodMat);
  hood.position.set(0.94, height - 0.02, 0);

  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.9, 1.85, 0.72), toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bulbMat);
  bulb.position.set(0.94, height - 0.11, 0);
  bulb.layers.set(NOINK);

  group.add(pole, arm, hood, bulb);
  parent.add(group);
  group.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  bulb.getWorldPosition(wp);
  return { group, bulbMat, bulbWorldPos: [wp.x, wp.y, wp.z] };
}

/** Simple neutral wooden/metal table (for altars, desks, bedside tables, dining tables). */
export function addSimpleTable(
  b: Batch,
  topMat: THREE.Material,
  legMat: THREE.Material,
  center: V3,
  w: number,
  d: number,
  h: number,
): void {
  const [cx, cy, cz] = center;
  b.add(boxGeo(V(cx - w * 0.5, cy + h - 0.06, cz - d * 0.5), V(cx + w * 0.5, cy + h, cz + d * 0.5), 1.0), topMat);
  const ix = w * 0.5 - 0.06, iz = d * 0.5 - 0.06;
  for (const [lx, lz] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]] as const) {
    b.add(boxGeo(V(cx + lx - 0.038, cy, cz + lz - 0.038), V(cx + lx + 0.038, cy + h - 0.06, cz + lz + 0.038), 1.0), legMat);
  }
}

/** Simple neutral wooden bed frame with open under-bed space and mattress slab. */
export function addWoodenBedFrame(
  b: Batch,
  frameMat: THREE.Material,
  mattressMat: THREE.Material,
  center: V3,
  w: number,
  d: number,
  h = 0.52,
): void {
  const [cx, cy, cz] = center;
  const hw = w * 0.5, hd = d * 0.5;
  for (const [lx, lz, ph] of [
    [-hw + 0.05, -hd + 0.05, h + 0.45],
    [hw - 0.05, -hd + 0.05, h + 0.45],
    [-hw + 0.05, hd - 0.05, h + 0.14],
    [hw - 0.05, hd - 0.05, h + 0.14],
  ] as const) {
    b.add(boxGeo(V(cx + lx - 0.04, cy, cz + lz - 0.04), V(cx + lx + 0.04, cy + ph, cz + lz + 0.04), 1.0), frameMat);
  }
  b.add(boxGeo(V(cx - hw, cy + h - 0.10, cz - hd), V(cx + hw, cy + h, cz + hd), 1.2), frameMat);
  b.add(boxGeo(V(cx - hw + 0.06, cy + h, cz - hd + 0.06), V(cx + hw - 0.06, cy + h + 0.14, cz + hd - 0.06), 1.2), mattressMat);
}

