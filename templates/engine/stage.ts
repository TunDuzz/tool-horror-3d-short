// Horror Engine v15.0: Neutral Spatial Stage Solver & Tight Audio-RMS / Trigger-Locked Acting Driver.
// Supports BOTH v15.0 `Character25D` (`sprite2d.ts` — default) and legacy `Character3D` (`rig3d.ts`),
// drives decisive climax reactions at `actionTriggerFrame` (hold -> crisp snap -> hold, killing slow beat-long lerp),
// and modulates live speech animation (`talk`/`closed` + cadence bob) directly from 30fps vocal RMS envelope + words.json!

import * as THREE from "three";
import { clamp01, easeOut, lerp, smooth, torchMalfunction, type V3 } from "./camera";
import {
  beatAt,
  shotSpecAt,
  type CastBeatState,
  type CharacterPart,
  type FaceExpr,
  type ManifestShotSpec,
  type RawWordTiming,
  type SceneManifest,
  type ScriptBeat,
  type SpriteExpr,
} from "./manifest";
import { mouthFromWords, type Character3D, type WordTiming } from "./rig3d";
import type { MouthShape } from "./face2d";
import { mapFaceExprToSpriteExpr, type Character25D } from "./sprite2d";

export type StageActor = Character25D | Character3D;

const _tmpV = new THREE.Vector3();

export type ManifestActorOpts = {
  /** Optional words.json array (supports `{ w, s, e, speaker }` or `{ word, start, end, speaker }`) for speaker matching & visemes. */
  words?: RawWordTiming[];
  /** v15.0 30fps normalized vocal amplitude array (`words.json` `rms_envelope_30fps`) driving crisp real-audio talking state! */
  rmsEnvelope?: number[];
  /** Voiced RMS gate threshold (default `0.08`). */
  rmsThreshold?: number;
  /** Active camera world position so 2.5D characters auto-billboard cleanly along the Y axis! */
  cameraPos?: V3 | THREE.Vector3;
  /** Optional map from character ID -> words.json speaker labels (e.g. `{ C02: ["CHÚ TƯ", "CHU TU"] }`). */
  speakerMap?: Record<string, string[]>;
  /** Optional blackout windows `[a, b]` for `motionMode: "blinkStep"` discrete horror flicker advances! */
  blackouts?: Array<[number, number]>;
  fps?: number;
};

export function isCharacter25D(actor: StageActor): actor is Character25D {
  return (actor as Character25D).kind === "sprite2d";
}

function normSpeakerTag(s: string | undefined): string {
  return (s ?? "").normalize("NFC").trim().toUpperCase();
}

function normalizeWords(raw?: RawWordTiming[]): WordTiming[] {
  if (!raw || !raw.length) return [];
  return raw
    .map((x) => ({
      word: String(x.w ?? x.word ?? "").trim(),
      start: Number(x.s ?? x.start ?? 0),
      end: Number(x.e ?? x.end ?? 0),
      speaker: x.speaker,
    }))
    .filter((x) => x.word.length > 0);
}

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

/** Return exact world-space position of an anatomical part on either a `Character25D` or `Character3D`. */
export function getCharacterPartWorldPos(char: StageActor, part: CharacterPart): V3 {
  char.group.updateMatrixWorld(true);
  if (isCharacter25D(char)) {
    const node = char.sockets[part] ?? char.sockets.feet;
    node.getWorldPosition(_tmpV);
    return [_tmpV.x, _tmpV.y, _tmpV.z];
  }
  const s = char.sockets;
  if (part === "feet") {
    const fl = new THREE.Vector3();
    const fr = new THREE.Vector3();
    s.leftFoot.getWorldPosition(fl);
    s.rightFoot.getWorldPosition(fr);
    return [(fl.x + fr.x) * 0.5, Math.min(fl.y, fr.y), (fl.z + fr.z) * 0.5];
  }
  if (part === "eyes") {
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
 * Translate `char.group.position` cleanly so that `part` (`"feet"`, `"head"`, `"eyes"`, etc.)
 * lands at `targetPos` with sub-millimeter accuracy — works for both `Character25D` and `Character3D`.
 */
export function alignCharacterPartTo(char: StageActor, part: CharacterPart, targetPos: V3): void {
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
 * v15.0 Decisive Action-Trigger Curve (`hold -> explosive snap -> hold`).
 * Replaces slow full-beat `lerp` on climax reactions whenever `cst.actionTriggerFrame` (or shot's `actionTriggerFrame`) is set!
 */
export function evalActionTriggerProgress(
  beat: ScriptBeat,
  cst: CastBeatState,
  frame: number,
  shotSpec?: ManifestShotSpec,
  beatBlackouts: Array<[number, number]> = [],
): { t: number; triggered: boolean } {
  if (cst.motionMode === "blinkStep" && beatBlackouts.length > 0) {
    const malf = torchMalfunction(frame, beatBlackouts, 23);
    const tBlink = clamp01(malf.stage / beatBlackouts.length);
    return { t: tBlink, triggered: tBlink > 0 };
  }

  const explicitTrigger =
    typeof cst.actionTriggerFrame === "number"
      ? cst.actionTriggerFrame
      : (typeof shotSpec?.actionTriggerFrame === "number" && shotSpec.actionTriggerFrame >= beat.a && shotSpec.actionTriggerFrame < beat.b
          ? shotSpec.actionTriggerFrame
          : undefined);

  if (explicitTrigger !== undefined) {
    if (frame < explicitTrigger) {
      return { t: 0, triggered: false };
    }
    const snapFrames = Math.max(1, cst.actionSnapFrames ?? cst.moveFrames ?? 6);
    const u = clamp01((frame - explicitTrigger) / snapFrames);
    return { t: easeOut(u), triggered: true };
  }

  const beatSpan = Math.max(1, beat.b - beat.a - 1);
  const moveSpan = typeof cst.moveFrames === "number" && cst.moveFrames > 0 ? Math.min(cst.moveFrames, beatSpan) : beatSpan;
  const tSmooth = smooth(clamp01((frame - beat.a) / moveSpan));
  return { t: tSmooth, triggered: tSmooth > 0.5 };
}

/**
 * v15.0 Real Audio-RMS Speech Evaluator (`rms_envelope_30fps` + `words.json` speaker filter).
 * Opens mouth/talk expression strictly when real vocal energy exceeds `threshold` AND the active speaker matches!
 */
export function evalSpeechFromAudioRms(
  rmsEnvelope: number[] | undefined,
  matchedWords: WordTiming[],
  frame: number,
  fps = 30,
  threshold = 0.08,
): { isTalking: boolean; rms: number; mouth: MouthShape } {
  const tSec = frame / Math.max(1, fps);
  // Check whether the character owns an active word (with tiny +-0.08s padding for consonant attack/release)
  const activeWord = matchedWords.find((w) => tSec >= w.start - 0.06 && tSec <= w.end + 0.06);

  if (rmsEnvelope && rmsEnvelope.length > 0) {
    const idx = Math.max(0, Math.min(rmsEnvelope.length - 1, Math.round(frame)));
    const rawRms = clamp01(Number(rmsEnvelope[idx] ?? 0));
    const speakerOwnsFrame = matchedWords.length === 0 ? true : !!activeWord;
    if (!speakerOwnsFrame || rawRms < threshold) {
      return { isTalking: false, rms: 0, mouth: "closed" };
    }
    if (rawRms < threshold + 0.14) {
      return { isTalking: true, rms: rawRms, mouth: "parted" };
    }
    const vowelShape = activeWord ? mouthFromWords([activeWord], frame, fps, "parted") : "talkA";
    return { isTalking: true, rms: rawRms, mouth: vowelShape === "closed" ? "parted" : vowelShape };
  }

  // Fallback when no RMS envelope was supplied: word timing viseme
  if (matchedWords.length > 0) {
    const m = mouthFromWords(matchedWords, frame, fps, "closed");
    return { isTalking: m !== "closed", rms: m === "closed" ? 0 : 0.65, mouth: m };
  }
  return { isTalking: false, rms: 0, mouth: "closed" };
}

/**
 * Drive all `Character25D` and `Character3D` actors directly from `manifest.json` for `frame`:
 *  - Decisive `actionTriggerFrame` snapping (`hold -> snap -> hold`) for climax reactions/recoils/lunges
 *  - Real 30fps audio RMS lip-sync (`rms_envelope_30fps`) + `words.json` speaker filtering (never flaps on `voiceOver`!)
 *  - Automatic Y-axis billboarding (`cameraPos`) for 2.5D normal-mapped characters
 *  - Socket-accurate positioning (`alignPart`) and `blinkStep` blackout advances
 */
export function applyManifestActors(
  manifest: SceneManifest,
  frame: number,
  actors: Record<string, StageActor>,
  extraAnchors?: Record<string, V3>,
  actorOpts?: ManifestActorOpts,
): ScriptBeat {
  const beat = beatAt(manifest, frame);
  const activeShot = shotSpecAt(manifest, frame);
  const fps = actorOpts?.fps ?? 30;
  const allWords = normalizeWords(actorOpts?.words);
  const rmsEnv = actorOpts?.rmsEnvelope;
  const rmsThr = actorOpts?.rmsThreshold ?? 0.08;
  const beatBlackouts = (actorOpts?.blackouts ?? []).filter(([ba, bb]) => ba >= beat.a && bb <= beat.b);

  for (const [cid, char] of Object.entries(actors)) {
    const cst = beat.castStates[cid];
    if (!cst || !cst.visible) {
      char.group.visible = false;
      continue;
    }
    char.group.visible = true;

    const { t: tAct, triggered } = evalActionTriggerProgress(beat, cst, frame, activeShot, beatBlackouts);

    const isLivingHuman = isCharacter25D(char)
      ? char.config.role === "human" && char.config.breathing !== false
      : char.config.entity?.breathing !== false && !char.config.entity?.silhouetteMode;

    const dMode = cst.dialogueMode;
    const allowLipSync =
      dMode === "directSpeech" ||
      (dMode === undefined && (!cst.speakingAs || normSpeakerTag(cst.speakingAs) !== "NARRATOR"));

    let speechState: { isTalking: boolean; rms: number; mouth: MouthShape } = {
      isTalking: false,
      rms: 0,
      mouth: "closed",
    };
    let hasSpeechDriver = false;

    if (isLivingHuman && allowLipSync && (allWords.length > 0 || (rmsEnv && rmsEnv.length > 0))) {
      const tags = new Set<string>();
      if (cst.speakingAs) {
        const sp = normSpeakerTag(cst.speakingAs);
        if (sp && sp !== "NARRATOR") tags.add(sp);
      } else {
        for (const alias of actorOpts?.speakerMap?.[cid] ?? []) {
          const na = normSpeakerTag(alias);
          if (na && na !== "NARRATOR") tags.add(na);
        }
      }
      if (tags.size > 0) {
        const matchedWords = allWords.filter((w) => tags.has(normSpeakerTag(w.speaker)));
        if (matchedWords.length > 0 || (rmsEnv && rmsEnv.length > 0 && dMode === "directSpeech")) {
          speechState = evalSpeechFromAudioRms(rmsEnv, matchedWords, frame, fps, rmsThr);
          hasSpeechDriver = true;
        }
      }
    } else if (isLivingHuman && (dMode === "voiceOver" || dMode === "silent")) {
      speechState = { isTalking: false, rms: 0, mouth: "closed" };
      hasSpeechDriver = true;
    }

    const SPRITE_EXPRS = new Set<SpriteExpr>(["calm", "talk", "fear", "shock", "entity_scare"]);
    const rawTrig = triggered ? (cst.triggerExpr as string | undefined) : undefined;
    const spriteOverride =
      rawTrig && SPRITE_EXPRS.has(rawTrig as SpriteExpr)
        ? (rawTrig as SpriteExpr)
        : cst.spriteExpr;
    const faceFromTrig =
      rawTrig === "shock"
        ? "terrified"
        : rawTrig === "fear"
          ? "dread"
          : rawTrig === "entity_scare"
            ? "unsettlingSmile"
            : rawTrig === "talk"
              ? "wary"
              : (rawTrig as FaceExpr | undefined);
    const activeExpr = faceFromTrig ?? cst.expr ?? (isLivingHuman ? "calm" : undefined);

    if (isCharacter25D(char)) {
      const blendFrames = typeof cst.exprBlendFrames === "number" ? Math.max(0, cst.exprBlendFrames) : 6;
      const preTriggerExpr: SpriteExpr =
        cst.spriteExpr ?? mapFaceExprToSpriteExpr(cst.expr, char.config.role, speechState.isTalking, cst.pose);

      // Determine deterministic expression crossfade (`spriteExprFrom` -> `spriteExprTo`, `exprBlend`)
      let spriteExprFrom: SpriteExpr = preTriggerExpr;
      let spriteExprTo: SpriteExpr =
        spriteOverride ?? mapFaceExprToSpriteExpr(activeExpr, char.config.role, speechState.isTalking, tAct >= 0.5 ? (cst.poseTo ?? cst.pose) : cst.pose);
      let exprBlend = 1;

      const explicitTrigger =
        typeof cst.actionTriggerFrame === "number"
          ? cst.actionTriggerFrame
          : (typeof activeShot?.actionTriggerFrame === "number" && activeShot.actionTriggerFrame >= beat.a && activeShot.actionTriggerFrame < beat.b
              ? activeShot.actionTriggerFrame
              : undefined);

      if (explicitTrigger !== undefined && cst.triggerExpr) {
        const trigTarget: SpriteExpr = SPRITE_EXPRS.has(cst.triggerExpr as SpriteExpr)
          ? (cst.triggerExpr as SpriteExpr)
          : mapFaceExprToSpriteExpr(cst.triggerExpr, char.config.role, speechState.isTalking, cst.poseTo ?? cst.pose);
        if (frame < explicitTrigger) {
          if (isLivingHuman && speechState.isTalking && preTriggerExpr === "talk") {
            spriteExprFrom = "calm";
            spriteExprTo = "talk";
            exprBlend = smooth(clamp01((speechState.rms - rmsThr * 0.75) / 0.18));
          } else {
            spriteExprFrom = preTriggerExpr;
            spriteExprTo = preTriggerExpr;
            exprBlend = 0;
          }
        } else if (blendFrames <= 0) {
          spriteExprFrom = trigTarget;
          spriteExprTo = trigTarget;
          exprBlend = 1;
        } else {
          spriteExprFrom = preTriggerExpr;
          spriteExprTo = trigTarget;
          exprBlend = smooth(clamp01((frame - explicitTrigger) / blendFrames));
        }
      } else {
        // Check seamless inter-beat expression blend within the same continuous shot
        const beatIdx = manifest.beats.indexOf(beat);
        const prevBeat = beatIdx > 0 ? manifest.beats[beatIdx - 1] : undefined;
        const prevCst = prevBeat && prevBeat.shotId === beat.shotId ? prevBeat.castStates[cid] : undefined;
        if (prevCst?.visible && blendFrames > 0 && frame - beat.a < blendFrames) {
          const prevEndExpr: SpriteExpr =
            prevCst.triggerExpr && SPRITE_EXPRS.has(prevCst.triggerExpr as SpriteExpr)
              ? (prevCst.triggerExpr as SpriteExpr)
              : prevCst.spriteExpr ?? mapFaceExprToSpriteExpr(prevCst.triggerExpr ?? prevCst.expr, char.config.role, false, prevCst.poseTo ?? prevCst.pose);
          if (prevEndExpr !== spriteExprTo) {
            spriteExprFrom = prevEndExpr;
            exprBlend = smooth(clamp01((frame - beat.a) / blendFrames));
          }
        } else if (isLivingHuman && speechState.isTalking && preTriggerExpr === "talk") {
          // Soft vocal RMS crossfade between `calm` and `talk`
          spriteExprFrom = "calm";
          spriteExprTo = "talk";
          exprBlend = smooth(clamp01((speechState.rms - rmsThr * 0.75) / 0.18));
        }
      }

      const sOpts = {
        expr: activeExpr,
        spriteExprFrom,
        spriteExpr: spriteExprTo,
        exprBlend,
        talkEnergy: speechState.rms,
        isTalking: speechState.isTalking,
        actionIntensity: triggered ? tAct : 0,
        ...(typeof cst.shrugIntensity === "number" ? { shrugIntensity: cst.shrugIntensity } : {}),
        ...(cst.microMotion ? { microMotion: cst.microMotion } : {}),
        ...(Array.isArray(cst.actingCues) && cst.actingCues.length > 0
          ? { actingCues: cst.actingCues, beatRange: [beat.a, beat.b] as [number, number] }
          : {}),
        ...(typeof cst.headTwitch === "number" ? { headTwitch: cst.headTwitch } : {}),
        ...(typeof cst.steppedFps === "number" ? { steppedFps: cst.steppedFps } : {}),
        ...(actorOpts?.cameraPos ? { cameraPos: actorOpts.cameraPos } : {}),
      };
      if (cst.poseTo && cst.poseTo !== cst.pose) {
        char.setPoseBlend(cst.pose, cst.poseTo, tAct, frame, sOpts);
      } else {
        char.setPose(cst.pose, frame, sOpts);
      }
    } else {
      const opts = {
        expr: activeExpr,
        ...(hasSpeechDriver ? { mouth: speechState.mouth } : {}),
        ...(isLivingHuman ? { autoBlink: true } : {}),
        ...(typeof cst.ageLines === "boolean" ? { ageLines: cst.ageLines } : {}),
        ...(typeof cst.sweat === "boolean" ? { sweat: cst.sweat } : {}),
        ...(typeof cst.jawOpen === "number" ? { jawOpen: cst.jawOpen } : {}),
        ...(typeof cst.headTwitch === "number" ? { headTwitch: cst.headTwitch, twitch: cst.headTwitch > 0.5 } : {}),
      };
      if (cst.poseTo && cst.poseTo !== cst.pose) {
        char.setPoseBlend(cst.pose, cst.poseTo, tAct, frame, opts);
      } else {
        char.setPose(cst.pose, frame, opts);
      }
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
        lerp(pFrom[0], pTo[0], tAct),
        lerp(pFrom[1], pTo[1], tAct),
        lerp(pFrom[2], pTo[2], tAct),
      ];
      if (cst.alignPart && cst.alignPart !== "feet") {
        alignCharacterPartTo(char, cst.alignPart, targetPos);
      } else {
        char.group.position.set(targetPos[0], targetPos[1], targetPos[2]);
        char.group.updateMatrixWorld(true);
      }
    }

    if (isCharacter25D(char) && actorOpts?.cameraPos) {
      char.updateBillboard(actorOpts.cameraPos);
    } else if (cst.lookAt) {
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
