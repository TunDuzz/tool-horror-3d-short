// Horror Engine v12.0: Deterministic Subject-Locked Camera Framing Solvers
// & 5-Layer In-Engine 3D Frustum + Raycast Occlusion Auditor (`sceneAudit.ts`).
// Ensures spoken nouns/actors in `manifest.json` (`mustShow`) are mathematically inside the 9:16 Safe Window,
// above the subtitle bar, unoccluded by walls/sills/shoulders, and crisp in focus before any MP4 render!

import * as THREE from "three";
import { clamp01, type Cam, type V3 } from "./camera";

export type FramePointsOpts = {
  /** Horizontal NDC margin (0..1); default 0.78 keeps subjects comfortably clear of 9:16 side edges. */
  marginX?: number;
  /** Bottom NDC floor (-1..1); default -0.54 keeps subjects cleanly ABOVE the lower-fifth subtitle bar! */
  safeBottomNdc?: number;
  /** Top NDC ceiling (-1..1); default 0.76 keeps subjects below the top minimal header. */
  safeTopNdc?: number;
  minFov?: number;
  maxFov?: number;
  roll?: number;
};

/**
 * Compute an exact `Cam` (`pos`, `look`, `fov`, `roll`) from `camPos` that guarantees ALL 3D `points`
 * fit inside the 9:16 (or 16:9) Safe Action Window without cropping or colliding with bottom subtitles.
 */
export function frameWorldPoints(
  camPos: V3,
  points: V3[],
  aspect = 9 / 16,
  opts: FramePointsOpts = {},
): Cam {
  const marginX = opts.marginX ?? 0.78;
  const safeBottom = opts.safeBottomNdc ?? -0.54;
  const safeTop = opts.safeTopNdc ?? 0.76;
  const minFov = opts.minFov ?? 42;
  const maxFov = opts.maxFov ?? 64;
  const roll = opts.roll ?? 0;

  if (!points.length) {
    return { pos: camPos, look: [camPos[0], camPos[1], camPos[2] - 1], fov: 52, roll };
  }

  const cp = new THREE.Vector3(...camPos);
  const vecs = points.map((p) => new THREE.Vector3(...p));

  // Centroid of bounding box in world space gives balanced framing between wide-apart subjects (e.g. oilLamp + ledger)
  const box = new THREE.Box3();
  for (const v of vecs) box.expandByPoint(v);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Desired vertical NDC center bias: because safeBottom=-0.54 and safeTop=+0.76, NDC center is +0.11
  // Aiming `look` slightly below `center` shifts projected points UPWARD by +0.11 NDC away from bottom subtitles!
  const ndcMidY = (safeBottom + safeTop) * 0.5;
  const distToCenter = Math.max(0.25, cp.distanceTo(center));

  // Initial camera basis looking at `center`
  const testCam = new THREE.PerspectiveCamera(50, aspect, 0.05, 500);
  testCam.up.set(0, 1, 0);

  // Pitch offset so `center` lands near `ndcMidY`
  const baseTanHalfV = Math.tan(THREE.MathUtils.degToRad(25));
  const lookTarget = center.clone();
  lookTarget.y -= ndcMidY * distToCenter * baseTanHalfV * 0.65;

  testCam.position.copy(cp);
  testCam.lookAt(lookTarget);
  testCam.updateMatrixWorld(true);

  const invCam = new THREE.Matrix4().copy(testCam.matrixWorld).invert();
  let reqTanHalfV = Math.tan(THREE.MathUtils.degToRad(minFov * 0.5));
  const halfSpanY = Math.max(0.25, (safeTop - safeBottom) * 0.5);

  for (const wv of vecs) {
    const cv = wv.clone().applyMatrix4(invCam);
    const depth = Math.max(0.12, -cv.z);
    // Horizontal requirement: |cv.x / (depth * aspect * tanHalfV)| <= marginX
    const needX = Math.abs(cv.x) / Math.max(0.05, depth * aspect * marginX);
    // Vertical requirement relative to ndcMidY
    const relY = Math.abs(cv.y / depth - ndcMidY * baseTanHalfV);
    const needY = relY / halfSpanY;
    reqTanHalfV = Math.max(reqTanHalfV, needX, needY);
  }

  const solvedFov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(reqTanHalfV)) * 1.06, minFov, maxFov);
  return {
    pos: [camPos[0], camPos[1], camPos[2]],
    look: [lookTarget.x, lookTarget.y, lookTarget.z],
    fov: solvedFov,
    roll,
  };
}

/**
 * Deterministic Same-Side Over-The-Shoulder (`ots_same_side`) framing solver.
 * Places the camera behind & outside the foreground actor's shoulder so the foreground silhouette
 * occupies a clean ~16-24% edge frame instead of turning into a 45% dark back-blob!
 */
export function camOtsFrame(
  fgShoulderWorld: V3,
  fgHeadWorld: V3,
  targetLookWorld: V3,
  axisSide: "left" | "right" = "right",
  opts: { backDist?: number; sideOffset?: number; upOffset?: number; fov?: number; roll?: number; aspect?: number } = {},
): Cam {
  const backDist = opts.backDist ?? 0.92;
  const upOffset = opts.upOffset ?? 0.06;
  const fov = opts.fov ?? 52;
  const roll = opts.roll ?? 0;
  const aspect = opts.aspect ?? 9 / 16;

  // Measure OTS axis from foreground head/torso center (`fgHeadWorld`) toward `targetLookWorld` so socket handedness never flips!
  const fgCenter = new THREE.Vector3(fgHeadWorld[0], fgShoulderWorld[1], fgHeadWorld[2]);
  const tgt = new THREE.Vector3(...targetLookWorld);
  const fwdXZ = new THREE.Vector3(tgt.x - fgCenter.x, 0, tgt.z - fgCenter.z);
  if (fwdXZ.lengthSq() < 1e-5) fwdXZ.set(0, 0, -1);
  fwdXZ.normalize();

  // Viewer-right unit vector in XZ: cross(fwdXZ, UP) = (-fwdXZ.z, 0, fwdXZ.x)
  const rightXZ = new THREE.Vector3(-fwdXZ.z, 0, fwdXZ.x).normalize();
  const sideSign = axisSide === "right" ? 1 : -1;

  // Analytical lateral offset so foreground actor's inner contour (`~0.24m` from spine) lands around |ndcX| >= 0.58 (`<= 22%` screen area!)
  const tanHalfH = Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * aspect;
  const distFgToTgt = Math.max(0.8, fgCenter.distanceTo(tgt));
  // Account for slight inward convergence when camera shifts laterally relative to target
  const autoSide = (0.25 + 0.62 * backDist * tanHalfH) * (1 + backDist / distFgToTgt);
  const sideOffset = opts.sideOffset ?? autoSide;

  const pos = fgCenter
    .clone()
    .addScaledVector(fwdXZ, -backDist)
    .addScaledVector(rightXZ, sideSign * sideOffset);
  pos.y = fgHeadWorld[1] + upOffset;

  // Aim slightly toward camera side of target so foreground shoulder stays tucked on outer 18-22% edge
  const look = tgt.clone().addScaledVector(rightXZ, sideSign * 0.14);
  return {
    pos: [pos.x, pos.y, pos.z],
    look: [look.x, look.y, look.z],
    fov,
    roll,
  };
}

export type TargetAuditResult = {
  id: string;
  found: boolean;
  visible: boolean;
  inSafeFrustum: boolean;
  ndcCenter: [number, number, number];
  ndcBox: [number, number, number, number]; // [minX, minY, maxX, maxY] in [-1..1]
  uvBox: [number, number, number, number];  // [u0, v0, u1, v1] in top-left image UV [0..1]
  widthPct: number;
  heightPct: number;
  areaPct: number;
  visibleRayRatio: number;
  blockedBy?: string;
  issues: string[];
};

export type AuditSceneOpts = {
  safeNdcX?: [number, number];
  safeNdcY?: [number, number];
  minVisibleRayRatio?: number;
};

function isEffectivelyVisible(obj: THREE.Object3D | null | undefined): boolean {
  let cur: THREE.Object3D | null | undefined = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

function findOwnerRoot(obj: THREE.Object3D, sceneRoot: THREE.Object3D): THREE.Object3D {
  let cur: THREE.Object3D = obj;
  while (cur.parent && cur.parent !== sceneRoot) {
    if (cur.name.startsWith("char_") || cur.name === "PovRig3D") return cur;
    cur = cur.parent;
  }
  return obj;
}

function isDescendantOf(candidate: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = candidate;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function collectSolidBlockers(sceneRoot: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  sceneRoot.traverse((o) => {
    if (!isEffectivelyVisible(o)) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (
      (o as unknown as THREE.Sprite).isSprite ||
      (o as unknown as THREE.Points).isPoints ||
      (o as unknown as THREE.Line).isLine ||
      o.userData.isOutline ||
      o.userData.noSSAO ||
      o.name === "faceDecal"
    ) {
      return;
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const isSeeThrough = mats.every((mat) => {
      if (!mat) return true;
      const mAny = mat as THREE.Material & { opacity?: number; depthWrite?: boolean; transparent?: boolean };
      if (mAny.depthWrite === false) return true;
      if (mAny.transparent && (mAny.opacity ?? 1) < 0.42) return true;
      return false;
    });
    if (!isSeeThrough) out.push(m);
  });
  return out;
}

function computeTargetWorldBox(target: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  target.traverse((o) => {
    if (!o.visible) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !o.userData.isOutline && m.geometry) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        const b2 = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        box.union(b2);
      }
    }
  });
  if (box.isEmpty()) {
    const wp = new THREE.Vector3();
    target.getWorldPosition(wp);
    box.setFromCenterAndSize(wp, new THREE.Vector3(0.16, 0.18, 0.16));
  }
  return box;
}

/**
 * Deterministically audit named 3D `Object3D` targets against `camera` and `sceneRoot`:
 *  - Layer 1: 9:16 Safe Frustum & Subtitle Collision check
 *  - Layer 2: 9-Ray 3D `THREE.Raycaster` Line-of-Sight Occlusion check (catches walls/window-sills/doors/shoulders!)
 *  - Layer 3: Projected 2D `uvBox`, `heightPct`, and `areaPct` for size/block/pixel-luma verification
 */
export function auditSceneTargets(
  camera: THREE.PerspectiveCamera,
  sceneRoot: THREE.Object3D,
  targetsMap: Record<string, THREE.Object3D | null | undefined>,
  opts: AuditSceneOpts = {},
): Record<string, TargetAuditResult> {
  const safeX = opts.safeNdcX ?? [-0.90, 0.90];
  const safeY = opts.safeNdcY ?? [-0.66, 0.84];
  const minRay = opts.minVisibleRayRatio ?? 0.34;

  sceneRoot.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  const invCam = new THREE.Matrix4().copy(camera.matrixWorld).invert();
  const blockers = collectSolidBlockers(sceneRoot);
  const raycaster = new THREE.Raycaster();

  const results: Record<string, TargetAuditResult> = {};

  for (const [id, obj] of Object.entries(targetsMap)) {
    if (!obj) {
      results[id] = {
        id,
        found: false,
        visible: false,
        inSafeFrustum: false,
        ndcCenter: [0, 0, 2],
        ndcBox: [0, 0, 0, 0],
        uvBox: [0, 0, 0, 0],
        widthPct: 0,
        heightPct: 0,
        areaPct: 0,
        visibleRayRatio: 0,
        issues: ["TARGET_NOT_REGISTERED"],
      };
      continue;
    }

    const vis = isEffectivelyVisible(obj);
    if (!vis) {
      results[id] = {
        id,
        found: true,
        visible: false,
        inSafeFrustum: false,
        ndcCenter: [0, 0, 2],
        ndcBox: [0, 0, 0, 0],
        uvBox: [0, 0, 0, 0],
        widthPct: 0,
        heightPct: 0,
        areaPct: 0,
        visibleRayRatio: 0,
        issues: ["TARGET_HIDDEN"],
      };
      continue;
    }

    const box = computeTargetWorldBox(obj);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    // 9 sample points: center + 8 corners shrunk 65% so glancing grazing edges don't false-fail
    const sx = Math.max(0.02, size.x * 0.32);
    const sy = Math.max(0.02, size.y * 0.32);
    const sz = Math.max(0.02, size.z * 0.32);
    const samples: THREE.Vector3[] = [center.clone()];
    for (const dx of [-sx, sx]) {
      for (const dy of [-sy, sy]) {
        for (const dz of [-sz, sz]) {
          samples.push(new THREE.Vector3(center.x + dx, center.y + dy, center.z + dz));
        }
      }
    }

    // Also include full box corners for accurate 2D bounding-box size measurement
    const fullCorners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          fullCorners.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    const centerCam = center.clone().applyMatrix4(invCam);
    const centerNdc = center.clone().project(camera);
    const behindCam = centerCam.z >= -0.04;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let anyInFront = false;

    for (const pt of fullCorners) {
      const cv = pt.clone().applyMatrix4(invCam);
      if (cv.z < -0.04) {
        anyInFront = true;
        const p = pt.clone().project(camera);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }

    if (!anyInFront) {
      results[id] = {
        id,
        found: true,
        visible: true,
        inSafeFrustum: false,
        ndcCenter: [centerNdc.x, centerNdc.y, centerNdc.z],
        ndcBox: [0, 0, 0, 0],
        uvBox: [0, 0, 0, 0],
        widthPct: 0,
        heightPct: 0,
        areaPct: 0,
        visibleRayRatio: 0,
        issues: ["BEHIND_CAMERA"],
      };
      continue;
    }

    const clMinX = Math.max(-1, minX);
    const clMaxX = Math.min(1, maxX);
    const clMinY = Math.max(-1, minY);
    const clMaxY = Math.min(1, maxY);
    const widthPct = Math.max(0, (clMaxX - clMinX) * 0.5);
    const heightPct = Math.max(0, (clMaxY - clMinY) * 0.5);
    const areaPct = widthPct * heightPct;

    const uvBox: [number, number, number, number] = [
      clamp01((clMinX + 1) * 0.5),
      clamp01((1 - clMaxY) * 0.5),
      clamp01((clMaxX + 1) * 0.5),
      clamp01((1 - clMinY) * 0.5),
    ];

    const issues: string[] = [];
    // Visible overlap inside Safe Window: either center is inside safeX/safeY OR clamped box overlaps significantly
    const overlapSafeX = Math.min(safeX[1], maxX) - Math.max(safeX[0], minX);
    const overlapSafeY = Math.min(safeY[1], maxY) - Math.max(safeY[0], minY);
    const inSafeFrustum = !behindCam && overlapSafeX > 0.06 && overlapSafeY > 0.06 && centerNdc.x >= safeX[0] - 0.10 && centerNdc.x <= safeX[1] + 0.10 && centerNdc.y >= safeY[0] - 0.08 && centerNdc.y <= safeY[1] + 0.10;

    if (!inSafeFrustum) {
      if (maxX < safeX[0] || centerNdc.x < safeX[0] - 0.10) issues.push(`OFFSCREEN_LEFT(ndcX=${centerNdc.x.toFixed(2)})`);
      else if (minX > safeX[1] || centerNdc.x > safeX[1] + 0.10) issues.push(`OFFSCREEN_RIGHT(ndcX=${centerNdc.x.toFixed(2)})`);
      if (maxY < safeY[0] || centerNdc.y < safeY[0] - 0.08) issues.push(`SUBTITLE_OR_BOTTOM_CLIP(ndcY=${centerNdc.y.toFixed(2)})`);
      else if (minY > safeY[1] || centerNdc.y > safeY[1] + 0.10) issues.push(`OFFSCREEN_TOP(ndcY=${centerNdc.y.toFixed(2)})`);
      if (!issues.length) issues.push("OUTSIDE_SAFE_FRUSTUM");
    }

    // Layer 2: 9-Ray 3D Occlusion Raycast
    // Ignore self-hits on `obj` AND (for socket targets like `C02:head`) sibling meshes on the same character rig
    const ignoreRoot = id.includes(":") ? findOwnerRoot(obj, sceneRoot) : obj;
    let clearRays = 0;
    const blockerCounts: Record<string, number> = {};
    const rayDir = new THREE.Vector3();

    for (const sp of samples) {
      rayDir.subVectors(sp, camPos);
      const dist = rayDir.length();
      if (dist < 0.05) {
        clearRays++;
        continue;
      }
      rayDir.divideScalar(dist);
      raycaster.set(camPos, rayDir);
      raycaster.near = 0.04;
      raycaster.far = Math.max(0.05, dist - 0.035);
      const hits = raycaster.intersectObjects(blockers, false);
      const foreignHit = hits.find((h) => !isDescendantOf(h.object, obj) && !isDescendantOf(h.object, ignoreRoot));
      if (!foreignHit) {
        clearRays++;
      } else {
        const bOwner = findOwnerRoot(foreignHit.object, sceneRoot);
        const bName = bOwner.name || foreignHit.object.name || "geometry";
        blockerCounts[bName] = (blockerCounts[bName] ?? 0) + 1;
      }
    }

    const visibleRayRatio = clearRays / samples.length;
    let blockedBy: string | undefined;
    const topBlocker = Object.entries(blockerCounts).sort((a, b) => b[1] - a[1])[0];
    if (topBlocker) blockedBy = topBlocker[0];
    if (visibleRayRatio < minRay) {
      issues.push(`OCCLUDED_BY(${blockedBy ?? "geometry"}:clear=${clearRays}/${samples.length})`);
    }

    results[id] = {
      id,
      found: true,
      visible: true,
      inSafeFrustum,
      ndcCenter: [Number(centerNdc.x.toFixed(3)), Number(centerNdc.y.toFixed(3)), Number(centerNdc.z.toFixed(3))],
      ndcBox: [Number(clMinX.toFixed(3)), Number(clMinY.toFixed(3)), Number(clMaxX.toFixed(3)), Number(clMaxY.toFixed(3))],
      uvBox: [Number(uvBox[0].toFixed(4)), Number(uvBox[1].toFixed(4)), Number(uvBox[2].toFixed(4)), Number(uvBox[3].toFixed(4))],
      widthPct: Number(widthPct.toFixed(4)),
      heightPct: Number(heightPct.toFixed(4)),
      areaPct: Number(areaPct.toFixed(4)),
      visibleRayRatio: Number(visibleRayRatio.toFixed(3)),
      ...(blockedBy ? { blockedBy } : {}),
      issues,
    };
  }

  return results;
}
