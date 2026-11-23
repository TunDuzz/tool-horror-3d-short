// HorrorLabV3: Single-source-of-truth SceneManifest, shots, cameras (with Whip-Pan), and anchors
// showcasing 3 radically different horror archetypes:
//   1. ruralFuneralRoom (warmLamp -> Whip-Pan Phone3D -> coldMoon lights-out + door foot-shadows + entity)
//   2. hospitalCorridor (fluorescent + handheld Flashlight3D SpotLight cone + dust motes + gaunt entity)
//   3. foggyVillageAlley (duskFog wet asphalt + weathered brick walls + warm sodium streetlamp + turning figure)

import {
  type CamKey,
  type DofBeat,
  type Kick,
  type LightKey,
  type SceneManifest,
  type ScreenBeat,
  type ShotBase,
  type V3,
  type WhipPanSpec,
  dolly,
  evalCam,
  evalShotMotion,
  povBreath,
  pushK,
  whipPan,
} from "../engine";

export const FPS = 30;
export const HORROR_LAB_V3_FRAMES = 300;
export const TOTAL = HORROR_LAB_V3_FRAMES;

export const ANCHORS = {
  // Location 1: Rural Thatched Funeral Room
  POV_SEAT: [0.0, 0.0, 1.98] as V3,
  POV_EYE: [0.0, 1.05, 1.95] as V3,
  NPC_SEAT: [-0.14, 0.0, 0.14] as V3,
  OIL_LAMP_TABLE: [0.96, 0.0, 0.28] as V3,
  COFFIN: [1.72, 0.0, -1.65] as V3,
  ALTAR: [0.48, 0.0, -3.28] as V3,
  DOUBLE_DOOR: [-1.35, 0.0, -3.65] as V3,
  ENTITY_DOOR: [-1.32, 0.0, -2.55] as V3,

  // Location 2: Old Hospital Corridor
  HOSP_POV_FEET: [0.0, 0.0, 2.2] as V3,
  HOSP_POV_EYE: [0.0, 1.54, 2.2] as V3,
  HOSP_ENTITY: [0.18, 0.0, -5.2] as V3,

  // Location 3: Foggy Rural Village Alley
  ALLEY_LAMP: [1.75, 0.0, -6.2] as V3,
  ALLEY_FIGURE: [-0.18, 0.0, -3.35] as V3,
};

export const WHIP_PANS: WhipPanSpec[] = [
  {
    f0: 52,
    dur: 7,
    fromLook: [-0.08, 1.04, 0.14],
    toLook: [1.02, 0.88, 0.24],
    rollPeak: 0.036,
  },
];

export const MANIFEST: SceneManifest = {
  projectId: "horror-lab-v3",
  title: "HorrorLabV3 — 3-Archetype Dark-Horror POV Proof",
  totalFrames: TOTAL,
  aspect: "9:16",
  header: {
    title: "CHỦ NHẬT · 01:06",
    subtitle: "Horror Engine v3 Look-Dev",
    badge: "PHIM NGẮN HƯ CẤU",
  },
  locations: [
    {
      id: "ruralFuneralRoom",
      archetype: "ruralThatchedHouse",
      dimensions: [6.4, 7.6, 4.3],
      ceilingType: "aFrameThatch",
      materials: { wall: "mottledPlasterTex", floor: "packedEarthTex", ceiling: "thatchRoofTex" },
      practicalLights: ["oilLamp", "altarCandle", "phoneScreen"],
      heroProps: ["lacqueredCoffin", "ancestralPortraitAltar", "glassOilLamp", "boltedDoubleDoor"],
      signatureShadowBeat: "Cold moonlight strip under bolted double door blocked by two dark foot shadows",
    },
    {
      id: "hospitalCorridor",
      archetype: "hospitalMorgueWing",
      dimensions: [2.8, 16.0, 2.95],
      ceilingType: "flatConcrete",
      materials: { wall: "hospitalTileTex", floor: "vintagePatternTileTex", ceiling: "concreteCeilingTex" },
      practicalLights: ["fluorescentTubeA", "fluorescentTubeB", "handheldFlashlight"],
      heroProps: ["steelGurney", "ivDripStand", "recessedWardDoors"],
      signatureShadowBeat: "Flickering fluorescent tube and flashlight SpotLight cone revealing gaunt figure down hallway",
    },
    {
      id: "foggyVillageAlley",
      archetype: "foggyVillageAlley",
      dimensions: [5.8, 26.0, 9.0],
      ceilingType: "openSky",
      materials: { wall: "brickWallTex", floor: "wetAsphaltTex", ceiling: "openSky" },
      practicalLights: ["sodiumStreetLamp"],
      heroProps: ["concretePowerPole", "rustedTinEave", "woodenAlleyGate"],
      signatureShadowBeat: "Warm sodium streetlamp cone carving misty alley around turning silhouette",
    },
  ],
  beats: [
    {
      beatId: "B1_FUNERAL_TALK",
      shotId: 1,
      a: 0,
      b: 50,
      peakFrame: 25,
      locationId: "ruralFuneralRoom",
      spokenLine: {
        speaker: "CHÚ BẢY",
        speakerColor: "#bfe0ff",
        text: "Các cụ cấm đếm người đấy.",
        highlight: ["cấm đếm người"],
      },
      lightState: { preset: "warmLamp", lampsOn: ["oilLamp", "altarCandle"], doorMoonlight: true, feetShadow: false },
      castStates: {
        chuBay: { visible: true, anchor: "NPC_SEAT", pose: "sitCrossLegged", expr: "uneasy", lookAt: "POV_EYE" },
        doorEntity: { visible: false, anchor: "ENTITY_DOOR", pose: "loomingStill" },
      },
      propStates: {
        phone: { visible: false, state: "hidden" },
        door: { visible: true, state: "closedBolted" },
      },
      cameraIntent: "POV seated facing non-chibi dark-horror Chu Bay with A-frame thatch roof, coffin, altar, and glowing oil lamp",
    },
    {
      beatId: "B2_WHIP_PHONE",
      shotId: 2,
      a: 50,
      b: 95,
      peakFrame: 78,
      locationId: "ruralFuneralRoom",
      spokenLine: {
        speaker: "TÙNG (TÔI)",
        speakerColor: "#f6f4ee",
        text: "Mười giờ mười... cô ngồi cạnh cháu mà?",
        highlight: ["ngồi cạnh cháu"],
      },
      lightState: { preset: "warmLamp", lampsOn: ["oilLamp", "altarCandle", "phoneScreen"], doorMoonlight: true, feetShadow: false },
      castStates: {
        chuBay: { visible: true, anchor: "NPC_SEAT", pose: "sitCrossLegged", expr: "wary", lookAt: "POV_EYE" },
        doorEntity: { visible: false, anchor: "ENTITY_DOOR", pose: "loomingStill" },
      },
      propStates: {
        phone: {
          visible: true,
          state: "raised",
          detail: {
            clock: "01:06",
            notifTime: "01:06",
            notifSender: "Cô Lan",
            notifBody: "Cô ốm, hai tối nay cô ở nhà. Cô có nhắn cháu đâu?",
            notifFooter: "Gửi lúc 22:10 · 3 tiếng trước",
          },
        },
        door: { visible: true, state: "closedBolted" },
      },
      cameraIntent: "7-frame Whip-Pan with motion blur turning to glowing Phone3D (01:06) in POV hands synced with notification card",
    },
    {
      beatId: "B3_DOOR_SHADOW",
      shotId: 3,
      a: 95,
      b: 128,
      peakFrame: 114,
      locationId: "ruralFuneralRoom",
      spokenLine: {
        speaker: "TÙNG (TÔI)",
        speakerColor: "#f6f4ee",
        text: "Ai... đứng ngoài cửa kia?",
        highlight: ["ngoài cửa"],
      },
      lightState: {
        preset: "warmLamp",
        blendTo: "coldMoon",
        blendRange: [95, 108],
        lampsOn: [],
        doorMoonlight: true,
        feetShadow: true,
      },
      castStates: {
        chuBay: { visible: false, anchor: "NPC_SEAT", pose: "sitCrossLegged" },
        doorEntity: { visible: false, anchor: "ENTITY_DOOR", pose: "loomingStill", eyeGlow: true },
      },
      propStates: {
        phone: { visible: false, state: "hidden" },
        door: { visible: true, state: "closedBolted" },
      },
      cameraIntent: "Lights out cold moonlight shift looking down at POV legs and bolted double door crack blocked by 2 dark foot shadows",
    },
    {
      beatId: "B4_ENTITY_LOOM",
      shotId: 4,
      a: 128,
      b: 160,
      peakFrame: 148,
      locationId: "ruralFuneralRoom",
      spokenLine: {
        speaker: "BÓNG NGƯỜI",
        speakerColor: "#f2b8c6",
        text: "Đếm tiếp đi cháu... còn thiếu một.",
        highlight: ["còn thiếu một"],
      },
      lightState: { preset: "coldMoon", lampsOn: [], doorMoonlight: true, feetShadow: true },
      castStates: {
        chuBay: { visible: false, anchor: "NPC_SEAT", pose: "sitCrossLegged" },
        doorEntity: { visible: true, anchor: "ENTITY_DOOR", pose: "loomingStill", expr: "hollow", eyeGlow: true },
      },
      propStates: {
        phone: { visible: false, state: "hidden" },
        door: { visible: true, state: "closedBolted" },
      },
      cameraIntent: "Cold moonlight tilt up onto tall gaunt crooked-neck silhouette entity with faint glowing eyes by doorway",
    },
    {
      beatId: "B5_HOSPITAL_CORRIDOR",
      shotId: 5,
      a: 160,
      b: 230,
      peakFrame: 198,
      locationId: "hospitalCorridor",
      spokenLine: {
        speaker: "TÙNG (TÔI)",
        speakerColor: "#f6f4ee",
        text: "Hành lang khoa cũ... đèn lại chớp rồi.",
        highlight: ["đèn lại chớp"],
      },
      lightState: { preset: "fluorescent", lampsOn: ["fluorescentTubeA", "handheldFlashlight"] },
      castStates: {
        wardEntity: { visible: true, anchor: "HOSP_ENTITY", pose: "loomingStill", expr: "deadStare", eyeGlow: false },
      },
      propStates: {
        flashlight: { visible: true, state: "aimed" },
      },
      cameraIntent: "Hospital ceramic-tile corridor with flickering overhead fluorescent tube and POV flashlight beam illuminating gaunt entity",
    },
    {
      beatId: "B6_VILLAGE_ALLEY",
      shotId: 6,
      a: 230,
      b: TOTAL,
      peakFrame: 268,
      locationId: "foggyVillageAlley",
      spokenLine: {
        speaker: "TÙNG (TÔI)",
        speakerColor: "#f6f4ee",
        text: "Cuối con ngõ... có ai vừa ngoái lại.",
        highlight: ["vừa ngoái lại"],
      },
      lightState: { preset: "duskFog", lampsOn: ["sodiumStreetLamp"] },
      castStates: {
        alleyFigure: { visible: true, anchor: "ALLEY_FIGURE", pose: "turnHead", expr: "dread", lookAt: [0, 1.48, 1.35] },
      },
      propStates: {},
      cameraIntent: "Wet asphalt rural night alley flanked by brick walls under warm sodium streetlamp pool with turning dark-horror figure",
    },
  ],
};

export const SHOTS: ShotBase<LightKey>[] = [
  { id: 1, a: 0, b: 50, light: "warmLamp", scale: "POV", note: "Funeral room talk with Chu Bay" },
  { id: 2, a: 50, b: 95, light: "warmLamp", scale: "POV_PROP", note: "Whip-Pan to oil lamp + glowing Phone3D" },
  { id: 3, a: 95, b: 128, light: "coldMoon", scale: "POV_DOWN", note: "Lights out -> door crack moonlight + foot shadows" },
  { id: 4, a: 128, b: 160, light: "coldMoon", scale: "POV_CU", note: "Tilt up to tall crooked-neck entity" },
  { id: 5, a: 160, b: 230, light: "fluorescent", scale: "POV", note: "Hospital corridor fluorescent + flashlight beam" },
  { id: 6, a: 230, b: TOTAL, light: "duskFog", scale: "MS", note: "Foggy wet village alley + streetlamp" },
];

export const CAMS: Record<number, CamKey[]> = {
  1: [
    {
      f: 0,
      s: (f) =>
        povBreath(
          dolly(ANCHORS.POV_EYE, [-0.02, 1.04, 0.14], pushK(f, 0, 0.0014), { fov: 60 }),
          f,
          0.011,
          0.14,
          3,
        ),
    },
  ],
  2: [
    {
      f: 50,
      s: (f) => {
        const base = whipPan(ANCHORS.POV_EYE, WHIP_PANS[0], f, 58);
        return f >= 60 ? povBreath(base, f, 0.008, 0.14, 9) : base;
      },
    },
  ],
  3: [
    {
      f: 95,
      s: (f) =>
        povBreath(
          dolly([-0.68, 1.08, 0.35], [-1.35, 0.34, -3.25], pushK(f, 95, 0.0018), { fov: 60 }),
          f,
          0.010,
          0.16,
          17,
        ),
    },
  ],
  4: [
    {
      f: 128,
      s: (f) =>
        povBreath(
          dolly([-0.75, 1.14, 0.15], [-1.32, 1.48, -2.55], pushK(f, 128, 0.0024), { fov: 52 }),
          f,
          0.012,
          0.18,
          23,
        ),
    },
  ],
  5: [
    {
      f: 160,
      s: (f) =>
        povBreath(
          dolly(ANCHORS.HOSP_POV_EYE, [0.10, 1.38, -5.2], pushK(f, 160, 0.0022), { fov: 54 }),
          f,
          0.014,
          0.16,
          31,
        ),
    },
  ],
  6: [
    {
      f: 230,
      s: (f) =>
        povBreath(
          dolly([-0.08, 1.48, 1.35], [0.06, 1.56, -6.2], pushK(f, 230, 0.0022), { fov: 56 }),
          f,
          0.010,
          0.12,
          41,
        ),
    },
  ],
};

export const OVERLAYS: ScreenBeat[] = [
  { kind: "dipBlack", at: 160, dur: 8, hold: 1 },
  { kind: "dipBlack", at: 230, dur: 8, hold: 1 },
  { kind: "aberration", a: 128, b: 158, strength: 0.35, pulse: true },
];

export const KICKS: Kick[] = [];
// Planned foreground POV prop-raise window (Phone3D lifting smoothly into frame across f59..68)
export const POV_MOTIONS: [number, number][] = [[59, 69]];

export const DOF: DofBeat[] = [
  { f: 0, cInf: 3.5, focus: () => [-0.08, 0.96, 0.12] },
  { f: 50, dur: 6, cInf: 4.5, focus: () => [0.02, 1.0, 1.48] },
  { f: 95, dur: 6, cInf: 2.0 },
  { f: 160, cInf: 2.5, focus: () => [0.18, 1.45, -5.2] },
  { f: 230, cInf: 3.0, focus: () => [0.35, 1.45, -3.4] },
];

export { evalCam, evalShotMotion };
