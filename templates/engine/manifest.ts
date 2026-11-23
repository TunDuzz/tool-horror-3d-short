// Horror Engine v3: Single-source-of-truth SceneManifest / ScriptBeat[] contract.
// Drives world lighting, practical lamps, character poses, hero props, Phone3D screens, AND HorrorHUD captions
// from one declarative timeline so rendered 3D frames cannot drift from the approved script.

import type { LightKey, V3 } from "./camera";

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

export type HorrorHudConfig = {
  header?: { title: string; subtitle?: string; badge?: string };
  captions?: HudCaption[];
  notifications?: HudNotification[];
  timeSkips?: HudTimeSkip[];
  choiceCard?: HudChoiceCard;
};

export type CeilingType =
  | "aFrameThatch"
  | "aFrameTile"
  | "flatConcrete"
  | "dropCeiling"
  | "vaulted"
  | "openSky"
  | "vehicleCabin";

export type LocationBlueprint = {
  id: string;
  archetype: string;
  dimensions: [number, number, number]; // [width, depth, height] in metres
  ceilingType: CeilingType;
  materials: { wall: string; floor: string; ceiling: string };
  practicalLights: string[];
  heroProps: string[];
  signatureShadowBeat: string;
  /** ONLY set when a multi-part series or scene explicitly revisits the exact same physical location. */
  sameLocationOf?: string;
};

export type PoseAction =
  | "sitCrossLegged"
  | "sitChair"
  | "standIdle"
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
  | "crawler";

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
};

export type CastBeatState = {
  visible: boolean;
  anchor: string;
  pose: PoseAction;
  expr?: FaceExpr;
  lookAt?: string | V3;
  eyeGlow?: boolean;
};

export type PropBeatState = {
  visible: boolean;
  state: string;
  detail?: Record<string, string | number | boolean>;
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
  cameraIntent: string;
};

export type SceneManifest = {
  projectId: string;
  title: string;
  totalFrames: number;
  aspect: "9:16" | "16:9";
  locations: LocationBlueprint[];
  beats: ScriptBeat[];
  header?: { title: string; subtitle?: string; badge?: string };
  timeSkips?: HudTimeSkip[];
  choiceCard?: HudChoiceCard;
};

/** Return the active ScriptBeat covering `frame` (clamps cleanly to first/last beat). */
export const beatAt = (manifest: SceneManifest, frame: number): ScriptBeat => {
  for (const b of manifest.beats) {
    if (frame >= b.a && frame < b.b) return b;
  }
  return frame < (manifest.beats[0]?.a ?? 0)
    ? manifest.beats[0]
    : manifest.beats[manifest.beats.length - 1];
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
 */
export const hudFromManifest = (manifest: SceneManifest): HorrorHudConfig => {
  const captions: HudCaption[] = [];
  const notifications: HudNotification[] = [];

  for (const b of manifest.beats) {
    if (b.spokenLine && b.spokenLine.text.trim()) {
      captions.push({
        a: b.a,
        b: b.b,
        speaker: b.spokenLine.speaker,
        speakerColor: b.spokenLine.speakerColor,
        text: b.spokenLine.text,
        highlight: b.spokenLine.highlight,
      });
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
    captions,
    notifications,
    timeSkips: manifest.timeSkips ?? [],
    choiceCard: manifest.choiceCard,
  };
};
