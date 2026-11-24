// Horror Engine v5.1: Neutral Spatial Stage Solver & Declarative Manifest Actor/Camera Driver.
// Eliminates manual `y = -1.56` height guesswork and hardcoded `if (frame >= ...)` coordinate drift
// by querying actual Three.js rig socket world positions (`head`, `eyes`, `feet`, etc.) and driving
// actors directly from `manifest.json` locations[].anchors + castStates[].

import * as THREE from "three";
import { clamp01, lerp, smooth, type V3 } from "./camera";
import { beatAt, type CharacterPart, type SceneManifest, type ScriptBeat } from "./manifest";
import type { Character3D } from "./rig3d";

const _tmpV = new THREE.Vector3();

/** Lookup a named 3D anchor coordinate from `manifest.locations[].anchors` (with optional extraAnchors fallback). */
export function resolveLocationAnchor(
  manifest: SceneManifest,
  locationId: string,
  anchorName: string,
  extraAnchors?: Record<string, V3>,
): V3 | null {
  const loc = manifest.locations.find((l) => l.id === locationId);
  if (loc?.anchors && anchorName in loc.anchors) {
    const p = loc.anchors[anchorName];
    return [p[0], p[1], p[2]];
  }
  if (extraAnchors && anchorName in extraAnchors) {
    const p = extraAnchors[anchorName];
    return [p[0], p[1], p[2]];
  }
  return null;
}

/** Return exact world-space position of an anatomical part on a posed `Character3D`. */
export function getCharacterPartWorldPos(char: Character3D, part: CharacterPart): V3 {
  char.group.updateMatrixWorld(true);
  const s = char.sockets;
  if (part === "feet") {
    const fl = new THREE.Vector3();
    const fr = new THREE.Vector3();
    s.leftFoot.getWorldPosition(fl);
    s.rightFoot.getWorldPosition(fr);
    return [(fl.x + fr.x) * 0.5, Math.min(fl.y, fr.y), (fl.z + fr.z) * 0.5];
  }
  if (part === "eyes") {
    s.head.getWorldPosition(_tmpV);
    // Approximate eye line slightly forward/upward from head pivot in head-local frame
    const localEye = new THREE.Vector3(0, 0.04, 0.08);
    s.head.localToWorld(localEye);
    return [localEye.x, localEye.y, localEye.z];
  }
  const map: Record<Exclude<CharacterPart, "feet" | "eyes">, THREE.Object3D> = {
    pelvis: s.pelvis,
    chest: s.chest,
    neck: s.neck,
    head: s.head,
    leftHand: s.leftHand,
    rightHand: s.rightHand,
  };
  map[part].getWorldPosition(_tmpV);
  return [_tmpV.x, _tmpV.y, _tmpV.z];
}

/**
 * Translate `char.group.position` cleanly so that `part` (e.g. `"head"` under a bed frame,
 * or `"feet"` flush on `y = 0`) lands at `targetPos` with sub-millimeter accuracy — ZERO manual offset math!
 */
export function alignCharacterPartTo(char: Character3D, part: CharacterPart, targetPos: V3): void {
  const cur = getCharacterPartWorldPos(char, part);
  char.group.position.x += targetPos[0] - cur[0];
  char.group.position.y += targetPos[1] - cur[1];
  char.group.position.z += targetPos[2] - cur[2];
  char.group.updateMatrixWorld(true);
}

/** Smooth 0..1 progress across a `ScriptBeat`'s active frame range `[a, b)`. */
export function evalBeatProgress(beat: ScriptBeat, frame: number): number {
  const span = Math.max(1, beat.b - beat.a - 1);
  return clamp01((frame - beat.a) / span);
}

/**
 * Drive all characters directly from `manifest.json` for `frame`:
 *  - sets visibility, poses (`setPose` or smooth `setPoseBlend(pose -> poseTo)`), `jawOpen`, `headTwitch`
 *  - interpolates smoothly between `moveFromAnchor` -> `moveToAnchor` using `location.anchors`
 *  - aligns `alignPart` ("feet" by default, or "head"/"eyes" for low peeks/jumpscare lunges!)
 *  - optionally rotates toward `facingYaw` or calls `lookAtWorld(...)`
 */
export function applyManifestActors(
  manifest: SceneManifest,
  frame: number,
  actors: Record<string, Character3D>,
  extraAnchors?: Record<string, V3>,
): ScriptBeat {
  const beat = beatAt(manifest, frame);

  for (const [cid, char] of Object.entries(actors)) {
    const cst = beat.castStates[cid];
    if (!cst || !cst.visible) {
      char.group.visible = false;
      continue;
    }
    char.group.visible = true;
    const beatSpan = Math.max(1, beat.b - beat.a - 1);
    const moveSpan = typeof cst.moveFrames === "number" && cst.moveFrames > 0 ? Math.min(cst.moveFrames, beatSpan) : beatSpan;
    const tSmooth = smooth(clamp01((frame - beat.a) / moveSpan));

    const opts = {
      expr: cst.expr,
      ...(typeof cst.jawOpen === "number" ? { jawOpen: cst.jawOpen } : {}),
      ...(typeof cst.headTwitch === "number" ? { headTwitch: cst.headTwitch, twitch: cst.headTwitch > 0.5 } : {}),
    };
    if (cst.poseTo && cst.poseTo !== cst.pose) {
      char.setPoseBlend(cst.pose, cst.poseTo, tSmooth, frame, opts);
    } else {
      char.setPose(cst.pose, frame, opts);
    }

    if (typeof cst.facingYaw === "number") {
      char.group.rotation.set(0, cst.facingYaw, 0);
    }

    const fromName = cst.moveFromAnchor ?? cst.anchor;
    const toName = cst.moveToAnchor ?? fromName;
    const pFrom = resolveLocationAnchor(manifest, beat.locationId, fromName, extraAnchors);
    const pTo = resolveLocationAnchor(manifest, beat.locationId, toName, extraAnchors) ?? pFrom;

    if (pFrom && pTo) {
      const targetPos: V3 = [
        lerp(pFrom[0], pTo[0], tSmooth),
        lerp(pFrom[1], pTo[1], tSmooth),
        lerp(pFrom[2], pTo[2], tSmooth),
      ];
      if (cst.alignPart && cst.alignPart !== "feet") {
        alignCharacterPartTo(char, cst.alignPart, targetPos);
      } else {
        char.group.position.set(targetPos[0], targetPos[1], targetPos[2]);
        char.group.updateMatrixWorld(true);
      }
    }

    if (cst.lookAt) {
      if (Array.isArray(cst.lookAt)) {
        char.lookAtWorld(cst.lookAt, 0.85);
      } else {
        const lk = resolveLocationAnchor(manifest, beat.locationId, cst.lookAt, extraAnchors);
        if (lk) char.lookAtWorld(lk, 0.85);
      }
    }
  }
  return beat;
}
