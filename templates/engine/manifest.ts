// Horror Engine v3: Single-source-of-truth SceneManifest / ScriptBeat[] contract.
// Drives world lighting, practical lamps, character poses, hero props, Phone3D screens, AND HorrorHUD captions
// from one declarative timeline so rendered 3D frames cannot drift from the approved script.

import type { LightKey, ShotBase, ShotScale, V3 } from "./camera";
import type { PovPropMode } from "./povRig";

export type HudCaption = {
  a: number;
  b: number;
  speaker?: string;
  speakerColor?: string;
  text: string;
  highlight?: string[];
};

export type HudNotification = {
  a: number;
  b: number;
  sender: string;
  time: string;
  body: string;
  footer?: string;
};

export type HudTimeSkip = {
  a: number;
  b: number;
  clockFrom: string;
  clockTo: string;
  label: string;
};

export type HudChoiceCard = {
  a: number;
  b: number;
  header: string;
  question: string;
  options: [string, string];
  prompt?: string;
};

export type HudCamcorderConfig = {
  enabled: boolean;
  label?: string;      // e.g. "VHS · SP" or "CAM-01"
  startClock?: string; // e.g. "01:06:00" (ticks forward deterministically by frame/30)
  dateLabel?: string;  // e.g. "22/11/1998"
};

export type HorrorHudConfig = {
  header?: { title: string; subtitle?: string; badge?: string };
  /** Clean minimal HUD by default; set "camcorder" ONLY for true found-footage stories, or "none" for zero top chrome. */
  headerStyle?: "minimal" | "camcorder" | "none";
  camcorder?: HudCamcorderConfig;
  captions?: HudCaption[];
  /** Optional toggle to disable captions cleanly while preserving manifest.beats[].spokenLine for alignment. */
  showCaptions?: boolean;
  notifications?: HudNotification[];
  timeSkips?: HudTimeSkip[];
  choiceCard?: HudChoiceCard;
};

export type CharacterRole = "human" | "entity" | "silhouette" | "lurker";

export type DialogueMode = "directSpeech" | "voiceOver" | "silent";

export type CameraMode = "master" | "pov" | "pov_turn" | "pov_walk" | "pov_interact" | "ots_same_side";
export type AxisSide = "pov_center" | "left" | "right";

export type ManifestShotSpec = {
  id: number;
  beatId?: string;
  a: number;
  b: number;
  scale: ShotScale;
  light: LightKey;
  cameraMode: CameraMode;
  axisSide: AxisSide;
  /** Exact phrase anchors in words.json so align_manifest.py locks `a` and `b` with 0-frame drift! */
  startPhrase?: string;
  endPhrase?: string;
  /** Optional visual breathing frame padding before startPhrase / after endPhrase. */
  leadFrames?: number;
  tailFrames?: number;
  /** Optional index into words.json `visual_beats[]` (`[VISUAL Xs]` directive). */
  visualBeatIndex?: number;
  povMode?: PovPropMode;
  worldTargetAnchor?: string;
  actionTriggerPhrase?: string;
  actionTriggerFrame?: number;
  note?: string;
};

export type CharacterBlueprint = {
  id: string;
  role: CharacterRole;
  /** Natural-language appearance description lifted directly from SCRIPT.md / story lore. */
  storyDescription: string;
  /** Explicit story-driven visual spec — ALL horror/gore flags default OFF unless declared here. */
  appearance: {
    height?: number;
    skinCol?: string;
    hairStyle?: string;
    hairCol?: string;
    garment?: string;
    topCol?: string;
    innerCol?: string;
    bottomCol?: string;
    shoeCol?: string;
    headbandCol?: string;
    lowPoly?: boolean;
    outlineMode?: "off" | "grittyThin" | "cleanBold";
    uncannyRealism?: boolean;
    entity?: Record<string, unknown>;
  };
  /** ONLY set when a multi-part series explicitly revisits the exact same recurring character/entity. */
  sameCharacterOf?: string;
};

export type BeatFogOverride = {
  color?: string;
  near: number;
  far: number;
};

export type CeilingType =
  | "aFrameThatch"
  | "aFrameTile"
  | "flatConcrete"
  | "dropCeiling"
  | "vaulted"
  | "openSky"
  | "vehicleCabin";

export type LocationPortal = {
  pos: V3;
  connectsTo?: string;
};

export type LocationBlueprint = {
  id: string;
  archetype: string;
  dimensions: [number, number, number]; // [width, depth, height] in metres
  ceilingType: CeilingType;
  materials: { wall: string; floor: string; ceiling: string };
  practicalLights: string[];
  heroProps: string[];
  signatureShadowBeat: string;
  /** Single-source-of-truth named 3D coordinates inside this room (exported directly from story.json landmarks). */
  anchors?: Record<string, V3>;
  /** Optional physical portals linking this room to adjacent rooms (e.g. bedroom door -> S02:ENTRY_DOOR). */
  portals?: Record<string, LocationPortal>;
  /** ONLY set when a multi-part series or scene explicitly revisits the exact same physical location. */
  sameLocationOf?: string;
};

export type PoseAction =
  | "sitCrossLegged"
  | "sitChair"
  | "sitBenchHunched"
  | "standIdle"
  | "nervousIdle"
  | "talkCalm"
  | "talkUrgent"
  | "reachInteract"
  | "glassSlam"
  | "walk"
  | "creep"
  | "turnHead"
  | "peerForward"
  | "recoil"
  | "point"
  | "holdPhone"
  | "holdLantern"
  | "lunge"
  | "loomingStill"
  | "peekAroundDoor"
  | "stalkLoom"
  | "jawUnlatch"
  | "crawler"
  | "doorwayPeek"
  | "backbendCrab"
  | "lungeCloseUp";

export type FaceExpr =
  | "calm"
  | "wary"
  | "uneasy"
  | "dread"
  | "terrified"
  | "deadStare"
  | "unsettlingSmile"
  | "hollow";

export type BeatLightState = {
  preset: LightKey;
  blendTo?: LightKey;
  blendRange?: [number, number];
  lampsOn: string[];
  doorMoonlight?: boolean;
  feetShadow?: boolean;
  fogOverride?: BeatFogOverride;
};

export type CharacterPart = "feet" | "pelvis" | "chest" | "neck" | "head" | "eyes" | "leftHand" | "rightHand";

export type CastBeatState = {
  visible: boolean;
  anchor: string;
  /** Optional start anchor for smooth intra-beat movement interpolation (`moveFromAnchor` -> `moveToAnchor`). */
  moveFromAnchor?: string;
  /** Optional destination anchor at the end of this beat (verified for continuity by validate_manifest.py). */
  moveToAnchor?: string;
  /** Optional frame duration for movement/pose transition (e.g. `8` for an explosive jumpscare lunge; defaults to full beat length). */
  moveFrames?: number;
  /** "smooth" (default continuous lerp) or "blinkStep" (freezes while lit and snaps forward only inside blackout windows!). */
  motionMode?: "smooth" | "blinkStep";
  pose: PoseAction;
  /** Optional destination pose blended smoothly across the beat via `setPoseBlend`. */
  poseTo?: PoseAction;
  /** Which anatomical part locks onto the anchor coordinate (defaults to "feet" on floor; use "head" under beds/peeks!). */
  alignPart?: CharacterPart;
  facingYaw?: number;
  jawOpen?: number;
  headTwitch?: number;
  allowTeleport?: boolean;
  expr?: FaceExpr;
  ageLines?: boolean;
  sweat?: boolean;
  /** Optional speaker tag(s) matching words.json `speaker` field for automatic Vietnamese lip-sync in stage.ts. */
  speakingAs?: string;
  /** v11.0 Explicit speech acting mode: "directSpeech" drives lip-sync; "voiceOver" & "silent" keep mouth closed! */
  dialogueMode?: DialogueMode;
  lookAt?: string | V3;
  eyeGlow?: boolean;
};

export type PropBeatState = {
  visible: boolean;
  /** Expected state entering this beat (verified by Prop State Machine Continuity Gate). */
  fromState?: string;
  state: string;
  /** Optional Vietnamese trigger word from SCRIPT.md; align_manifest.py auto-resolves `triggerFrame`. */
  triggerWord?: string;
  triggerFrame?: number;
  detail?: Record<string, string | number | boolean>;
};

export type BeatCameraSpec = {
  posAnchor: string;
  posOffset?: V3;
  lookAnchor: string;
  lookPart?: CharacterPart | "center";
  motion?: "hold" | "dolly" | "dollyZoom" | "whipPan" | "handheld" | "dropToFloor";
  fov?: number;
  fovTo?: number;
};

export type ScriptBeat = {
  beatId: string;
  shotId: number;
  a: number;
  b: number;
  peakFrame: number;
  locationId: string;
  spokenLine?: {
    speaker?: string;
    speakerColor?: string;
    text: string;
    highlight?: string[];
  };
  lightState: BeatLightState;
  castStates: Record<string, CastBeatState>;
  propStates: Record<string, PropBeatState>;
  camera?: BeatCameraSpec;
  audioCueIds?: string[];
  cameraIntent: string;
};

export type SceneManifest = {
  projectId: string;
  title: string;
  totalFrames: number;
  aspect: "9:16" | "16:9";
  locations: LocationBlueprint[];
  castBlueprints?: CharacterBlueprint[];
  beats: ScriptBeat[];
  /** v11.0 Single-source-of-truth phrase-locked shot list aligned by align_manifest.py and consumed via shotsFromManifest(). */
  shots?: ManifestShotSpec[];
  /** Word-timed 4-8 word subtitle chunks generated automatically by align_manifest.py from words.json (kills wall-of-text!). */
  captionChunks?: HudCaption[];
  header?: { title: string; subtitle?: string; badge?: string };
  headerStyle?: "minimal" | "camcorder" | "none";
  camcorder?: HudCamcorderConfig;
  timeSkips?: HudTimeSkip[];
  choiceCard?: HudChoiceCard;
};

export type RawWordTiming = {
  w?: string;
  word?: string;
  s?: number;
  start?: number;
  e?: number;
  end?: number;
  speaker?: string;
};

/** Split a long sentence/paragraph into crisp 4-8 word cinema subtitle phrases breaking cleanly at punctuation. */
export function splitCaptionTextIntoChunks(text: string, maxWords = 7, maxChars = 42): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const rawWords = clean.split(" ");
  if (rawWords.length <= maxWords + 2 && clean.length <= maxChars + 10) return [clean];

  const chunks: string[] = [];
  let cur: string[] = [];
  let curChars = 0;

  const flush = () => {
    if (cur.length) {
      chunks.push(cur.join(" "));
      cur = [];
      curChars = 0;
    }
  };

  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    const nextChars = curChars + (cur.length ? 1 : 0) + w.length;
    const hardPunct = /[.!?…]$/.test(w) || /\.\.\.$/.test(w);
    const softPunct = /[,;:—–]$/.test(w);

    if (cur.length > 0 && (cur.length >= maxWords || nextChars > maxChars)) {
      flush();
    }
    cur.push(w);
    curChars += (cur.length > 1 ? 1 : 0) + w.length;

    if (hardPunct && cur.length >= 2) {
      flush();
    } else if (softPunct && (cur.length >= 4 || curChars >= Math.round(maxChars * 0.65))) {
      flush();
    }
  }
  flush();

  // Merge tiny 1-2 word orphan trailing chunk into previous chunk if it stays compact
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (last.split(" ").length <= 2 && prev.split(" ").length + last.split(" ").length <= maxWords + 2 && prev.length + last.length + 1 <= maxChars + 12) {
      chunks[chunks.length - 2] = `${prev} ${last}`;
      chunks.pop();
    }
  }
  return chunks;
}

/** Build crisp word-timed 4-8 word HudCaption[] directly from words.json timestamps and SceneManifest beats. */
export function buildWordCaptionsFromWords(
  words: RawWordTiming[],
  manifest: SceneManifest,
  opts: { fps?: number; maxWords?: number; maxChars?: number } = {},
): HudCaption[] {
  const fps = opts.fps ?? 30;
  const maxWords = opts.maxWords ?? 7;
  const maxChars = opts.maxChars ?? 42;
  const out: HudCaption[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();

  const wList = words
    .map((x) => ({
      raw: String(x.w ?? x.word ?? "").trim(),
      norm: norm(String(x.w ?? x.word ?? "")),
      s: Number(x.s ?? x.start ?? 0),
      e: Number(x.e ?? x.end ?? 0),
    }))
    .filter((x) => x.raw.length > 0);

  let cursor = 0;
  for (const b of manifest.beats) {
    const sl = b.spokenLine;
    if (!sl || !sl.text.trim()) continue;
    const phrases = splitCaptionTextIntoChunks(sl.text, maxWords, maxChars);
    const beatHl = sl.highlight ?? [];

    for (const ph of phrases) {
      const toks = ph.split(/\s+/).map(norm).filter(Boolean);
      let hitIdx = -1;
      if (toks.length && wList.length) {
        for (let idx = cursor; idx <= wList.length - toks.length; idx++) {
          let ok = true;
          for (let k = 0; k < toks.length; k++) {
            if (wList[idx + k].norm !== toks[k]) {
              ok = false;
              break;
            }
          }
          if (ok) {
            hitIdx = idx;
            break;
          }
        }
      }
      if (hitIdx >= 0) {
        const a = Math.max(b.a, Math.floor(wList[hitIdx].s * fps));
        const endW = wList[hitIdx + toks.length - 1];
        const bb = Math.min(b.b, Math.max(a + 8, Math.ceil((endW.e + 0.12) * fps)));
        cursor = hitIdx + toks.length;
        const phLower = ph.toLowerCase();
        const hl = beatHl.filter((h) => h && phLower.includes(h.toLowerCase()));
        out.push({
          a,
          b: bb,
          speaker: sl.speaker,
          speakerColor: sl.speakerColor,
          text: ph,
          ...(hl.length ? { highlight: hl } : {}),
        });
      }
    }
  }

  // Eliminate tiny overlaps between consecutive chunks
  for (let i = 1; i < out.length; i++) {
    if (out[i].a < out[i - 1].b) {
      out[i - 1].b = Math.max(out[i - 1].a + 4, out[i].a);
    }
  }
  return out;
}

/** Return the active ScriptBeat covering `frame` (clamps cleanly to first/last beat). */
export const beatAt = (manifest: SceneManifest, frame: number): ScriptBeat => {
  for (const b of manifest.beats) {
    if (frame >= b.a && frame < b.b) return b;
  }
  return frame < (manifest.beats[0]?.a ?? 0)
    ? manifest.beats[0]
    : manifest.beats[manifest.beats.length - 1];
};

/** Derive `ShotBase<LightKey>[]` directly from `manifest.shots` (falling back to `manifest.beats`) — ZERO hardcoded frame numbers in story.ts! */
export const shotsFromManifest = (manifest: SceneManifest): ShotBase<LightKey>[] => {
  if (manifest.shots && manifest.shots.length > 0) {
    return manifest.shots.map((s) => ({
      id: s.id,
      a: s.a,
      b: s.b,
      scale: s.scale,
      light: s.light,
      note: s.note,
    }));
  }
  return manifest.beats.map((b, idx) => ({
    id: b.shotId ?? idx + 1,
    a: b.a,
    b: b.b,
    scale: "POV",
    light: b.lightState.preset,
    note: b.cameraIntent,
  }));
};

/** Return the active `ManifestShotSpec` covering `frame` when `manifest.shots` is present. */
export const shotSpecAt = (manifest: SceneManifest, frame: number): ManifestShotSpec | undefined => {
  const list = manifest.shots;
  if (!list || list.length === 0) return undefined;
  for (const s of list) {
    if (frame >= s.a && frame < s.b) return s;
  }
  return frame < list[0].a ? list[0] : list[list.length - 1];
};

/** Check whether a named practical light source is ON in the given ScriptBeat. */
export const isLampLit = (beat: ScriptBeat, lampId: string): boolean =>
  beat.lightState.lampsOn.includes(lampId);

/** Read a declared prop state for the given ScriptBeat. */
export const propStateOf = (beat: ScriptBeat, propId: string): PropBeatState | undefined =>
  beat.propStates[propId];

/**
 * Derive HorrorHUD configuration directly from SceneManifest so captions and Phone3D notification cards
 * are guaranteed 100% synchronized with the 3D scene and approved script.
 * v10.0: Prefers word-timed `manifest.captionChunks` (4-8 words / 1-2 short lines) and automatically
 * chunks overly long legacy `spokenLine.text` blocks so a wall of text can NEVER bury the 3D frame!
 */
export const hudFromManifest = (
  manifest: SceneManifest,
  opts: { showCaptions?: boolean; maxWordsPerChunk?: number; maxCharsPerChunk?: number } = {},
): HorrorHudConfig => {
  const showCaptions = opts.showCaptions ?? true;
  const maxWords = opts.maxWordsPerChunk ?? 7;
  const maxChars = opts.maxCharsPerChunk ?? 42;
  const captions: HudCaption[] = [];
  const notifications: HudNotification[] = [];

  if (showCaptions && manifest.captionChunks && manifest.captionChunks.length > 0) {
    captions.push(...manifest.captionChunks);
  }

  for (const b of manifest.beats) {
    if (showCaptions && (!manifest.captionChunks || manifest.captionChunks.length === 0) && b.spokenLine && b.spokenLine.text.trim()) {
      const phrases = splitCaptionTextIntoChunks(b.spokenLine.text, maxWords, maxChars);
      if (phrases.length <= 1) {
        captions.push({
          a: b.a,
          b: b.b,
          speaker: b.spokenLine.speaker,
          speakerColor: b.spokenLine.speakerColor,
          text: b.spokenLine.text,
          highlight: b.spokenLine.highlight,
        });
      } else {
        const totalChars = Math.max(1, phrases.reduce((acc, s) => acc + s.length, 0));
        const span = Math.max(1, b.b - b.a);
        let curA = b.a;
        phrases.forEach((ph, idx) => {
          const nextB = idx === phrases.length - 1 ? b.b : Math.min(b.b, curA + Math.max(12, Math.round((ph.length / totalChars) * span)));
          const phLower = ph.toLowerCase();
          const hl = (b.spokenLine?.highlight ?? []).filter((h) => h && phLower.includes(h.toLowerCase()));
          captions.push({
            a: curA,
            b: Math.max(curA + 1, nextB),
            speaker: b.spokenLine?.speaker,
            speakerColor: b.spokenLine?.speakerColor,
            text: ph,
            ...(hl.length ? { highlight: hl } : {}),
          });
          curA = nextB;
        });
      }
    }
    const phone = b.propStates.phone;
    if (phone && phone.visible && phone.detail && typeof phone.detail.notifBody === "string" && phone.detail.notifBody.trim()) {
      notifications.push({
        a: b.a,
        b: b.b,
        sender: String(phone.detail.notifSender ?? "Tin nhắn"),
        time: String(phone.detail.notifTime ?? phone.detail.clock ?? ""),
        body: String(phone.detail.notifBody),
        footer: typeof phone.detail.notifFooter === "string" ? phone.detail.notifFooter : undefined,
      });
    }
  }

  return {
    header: manifest.header,
    headerStyle: manifest.headerStyle ?? (manifest.camcorder?.enabled ? "camcorder" : "minimal"),
    camcorder: manifest.camcorder,
    captions,
    showCaptions,
    notifications,
    timeSkips: manifest.timeSkips ?? [],
    choiceCard: manifest.choiceCard,
  };
};
