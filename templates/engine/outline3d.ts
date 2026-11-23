// Horror Engine v3: Smooth-Normal Inverted-Hull 3D Outline System.
// Produces clean, bold, comic-style black outlines (~5-7px at 1080p) on 3D characters, POV hands, and hero curved props.
// All outlined actors/props are isolated onto the NOINK layer so architectural InkPass never double-outlines them.

import * as THREE from "three";
import { NOINK } from "./ink";

export type OutlineMode = "off" | "grittyThin" | "cleanBold";

export type OutlineOpts = {
  mode?: OutlineMode;
  color?: string;
  pxWidth?: number; // target outline thickness in px at 1080 short-edge resolution (default 6.0 for cleanBold, 3.0 for grittyThin)
  minWorld?: number; // minimum extrusion in metres (prevents vanishing on thin close-up fingers)
  maxWorld?: number; // maximum extrusion in metres (prevents ballooning far away)
};

const DEF_OPTS: Required<OutlineOpts> = {
  mode: "cleanBold",
  color: "#06060a",
  pxWidth: 6.0,
  minWorld: 0.0014,
  maxWorld: 0.032,
};

function resolveOutlineOpts(opts: OutlineOpts): Required<OutlineOpts> {
  const mode: OutlineMode = opts.mode ?? (opts.pxWidth === 0 ? "off" : "cleanBold");
  if (mode === "grittyThin") {
    return {
      ...DEF_OPTS,
      pxWidth: 3.0,
      minWorld: 0.0009,
      maxWorld: 0.016,
      ...opts,
      mode,
    };
  }
  return { ...DEF_OPTS, ...opts, mode };
}

/**
 * Compute angle-weighted smooth normals (Thürmer & Wüthrich) across coincident vertex positions (1e-4 quantization)
 * and store them in the `aSmoothNormal` BufferAttribute. Invariant to quad-diagonal triangulation and prevents
 * split corners/gaps when extruding boxes or beveled meshes.
 */
export function computeSmoothNormals(srcGeo: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = srcGeo.clone();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const idx = geo.index;
  const count = pos.count;

  const accum = new Map<string, [number, number, number]>();
  const keys = new Array<string>(count);
  const q = (v: number) => Math.round(v * 10000);

  for (let i = 0; i < count; i++) {
    keys[i] = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
  }

  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(count / 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();

  const addWeighted = (vi: number, faceNormal: THREE.Vector3, weight: number) => {
    if (weight <= 1e-8) return;
    const k = keys[vi];
    const entry = accum.get(k);
    if (entry) {
      entry[0] += faceNormal.x * weight;
      entry[1] += faceNormal.y * weight;
      entry[2] += faceNormal.z * weight;
    } else {
      accum.set(k, [faceNormal.x * weight, faceNormal.y * weight, faceNormal.z * weight]);
    }
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    fn.crossVectors(e1, e2);
    const area2 = fn.length();
    if (area2 < 1e-10) continue;
    fn.divideScalar(area2);

    const ang0 = e1.angleTo(e2);
    e1.subVectors(a, b);
    e2.subVectors(c, b);
    const ang1 = e1.angleTo(e2);
    const ang2 = Math.max(0, Math.PI - ang0 - ang1);

    addWeighted(i0, fn, ang0);
    addWeighted(i1, fn, ang1);
    addWeighted(i2, fn, ang2);
  }

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const entry = accum.get(keys[i]);
    if (entry) {
      const len = Math.hypot(entry[0], entry[1], entry[2]) || 1;
      out[i * 3] = entry[0] / len;
      out[i * 3 + 1] = entry[1] / len;
      out[i * 3 + 2] = entry[2] / len;
    } else {
      out[i * 3] = nrm.getX(i);
      out[i * 3 + 1] = nrm.getY(i);
      out[i * 3 + 2] = nrm.getZ(i);
    }
  }

  geo.setAttribute("aSmoothNormal", new THREE.BufferAttribute(out, 3));
  return geo;
}

const OUTLINE_VERT = /* glsl */ `
attribute vec3 aSmoothNormal;
uniform float uPxWidth;
uniform float uMinWorld;
uniform float uMaxWorld;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  float dist = max(0.08, -mvPos.z);
  float projMax = max(abs(projectionMatrix[0][0]), abs(projectionMatrix[1][1]));
  float worldPerPx = (2.0 * dist) / max(projMax * 1080.0, 1.0);
  float extrudeW = clamp(uPxWidth * worldPerPx, uMinWorld, uMaxWorld);

  vec3 viewN = normalize(normalMatrix * aSmoothNormal);
  mvPos.xyz += viewN * extrudeW;
  gl_Position = projectionMatrix * mvPos;
}
`;

const OUTLINE_FRAG = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
}
`;

/** Create a BackSide inverted-hull outline ShaderMaterial with screen-space distance-clamped thickness. */
export function createOutlineMaterial(opts: OutlineOpts = {}): THREE.ShaderMaterial {
  const o = { ...DEF_OPTS, ...opts };
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
    fog: false,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uPxWidth: { value: o.pxWidth },
      uMinWorld: { value: o.minWorld },
      uMaxWorld: { value: o.maxWorld },
    },
  });
}

/** Compute thin-part-safe maxWorld cap so distant slender fingers/ankles never extrude into thick black paddles. */
function maxWorldForGeometry(geo: THREE.BufferGeometry, baseMax: number, override?: number): number {
  if (typeof override === "number" && override > 0) return Math.min(baseMax, override);
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return baseMax;
  const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b);
  const crossRadius = dims[1] * 0.5;
  if (crossRadius <= 0) return baseMax;
  return Math.min(baseMax, Math.max(0.0022, crossRadius * 0.34));
}

/**
 * Attach smooth-normal Inverted-Hull outline shells for every eligible Mesh inside `target`,
 * and move all meshes in `target` (plus the generated outlines) onto the `NOINK` layer so `InkPass`
 * never double-outlines them.
 *
 * Returns a `THREE.Group` containing generated outline meshes for flat/static props; for nested bone rigs,
 * use `attachOutlineRig` so each outline mesh is parented directly to its own moving bone mesh.
 */
export function attachOutline(target: THREE.Object3D, opts: OutlineOpts = {}): THREE.Group {
  const o = resolveOutlineOpts(opts);
  const outlines = new THREE.Group();
  outlines.name = "InvertedHullOutlines";
  outlines.layers.set(NOINK);

  const meshes: THREE.Mesh[] = [];
  target.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    m.layers.set(NOINK);
    if (m.userData.noOutline || m.userData.isOutline) return;
    meshes.push(m);
  });

  if (o.mode === "off" || o.pxWidth <= 0) {
    return outlines;
  }

  const matCache = new Map<string, THREE.ShaderMaterial>();
  const getMat = (maxW: number, pxW: number) => {
    const key = `${pxW.toFixed(2)}:${maxW.toFixed(4)}`;
    let m = matCache.get(key);
    if (!m) {
      m = createOutlineMaterial({ ...o, pxWidth: pxW, maxWorld: maxW, minWorld: Math.min(o.minWorld, maxW) });
      matCache.set(key, m);
    }
    return m;
  };

  target.updateMatrixWorld(true);
  const invTarget = new THREE.Matrix4().copy(target.matrixWorld).invert();
  const relMat = new THREE.Matrix4();

  for (const m of meshes) {
    const smoothGeo = computeSmoothNormals(m.geometry);
    const capMax = maxWorldForGeometry(m.geometry, o.maxWorld, m.userData.outlineMaxWorld);
    const pxW = typeof m.userData.outlinePx === "number" ? m.userData.outlinePx : o.pxWidth;
    const ol = new THREE.Mesh(smoothGeo, getMat(capMax, pxW));
    ol.userData.isOutline = true;
    ol.castShadow = false;
    ol.receiveShadow = false;
    ol.layers.set(NOINK);
    relMat.multiplyMatrices(invTarget, m.matrixWorld);
    relMat.decompose(ol.position, ol.quaternion, ol.scale);
    outlines.add(ol);
  }

  target.add(outlines);
  return outlines;
}

/**
 * Attach smooth-normal Inverted-Hull outlines directly as children of every animated bone Mesh in `root`.
 * Moves automatically with every hierarchical bone rotation without needing manual matrix sync.
 * Automatically scales maxWorld down on thin sub-parts (e.g. fingers, ankles) to prevent distant paddle blowout.
 * When `opts.mode === "off"` (Horror Engine v4 Style B semi-realistic default), meshes are still isolated onto
 * `NOINK` cleanly without generating cartoon BackSide outline shells.
 */
export function attachOutlineRig(root: THREE.Object3D, opts: OutlineOpts = {}): THREE.Mesh[] {
  const o = resolveOutlineOpts(opts);
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    m.layers.set(NOINK);
    if (m.userData.noOutline || m.userData.isOutline) return;
    meshes.push(m);
  });

  if (o.mode === "off" || o.pxWidth <= 0) {
    return [];
  }

  const matCache = new Map<string, THREE.ShaderMaterial>();
  const getMat = (maxW: number, pxW: number) => {
    const key = `${pxW.toFixed(2)}:${maxW.toFixed(4)}`;
    let m = matCache.get(key);
    if (!m) {
      m = createOutlineMaterial({ ...o, pxWidth: pxW, maxWorld: maxW, minWorld: Math.min(o.minWorld, maxW) });
      matCache.set(key, m);
    }
    return m;
  };

  const created: THREE.Mesh[] = [];
  for (const m of meshes) {
    const capMax = maxWorldForGeometry(m.geometry, o.maxWorld, m.userData.outlineMaxWorld);
    const pxW = typeof m.userData.outlinePx === "number" ? m.userData.outlinePx : o.pxWidth;
    const ol = new THREE.Mesh(computeSmoothNormals(m.geometry), getMat(capMax, pxW));
    ol.name = `${m.name || "mesh"}_outline`;
    ol.userData.isOutline = true;
    ol.castShadow = false;
    ol.receiveShadow = false;
    ol.layers.set(NOINK);
    m.add(ol);
    created.push(ol);
  }
  return created;
}
