# Multi-Part Horror Series Architecture & Schemas

Reference schemas and boilerplate for `shorts-project/src/<episode>/`.

## 1. `bible/OUTLINE.json` Schema

```json
{
  "title": "Ngoi Nha So 13",
  "aspect": "16:9",
  "fps": 30,
  "audio_drone_hz": 43.65,
  "reverb_seed": 77,
  "parts": [
    {
      "part": 1,
      "title": "Tieng go luc 2 gio sang",
      "era": "courtyard",
      "light": "night",
      "target_sec": 60,
      "transition_out": "blackout:0.25",
      "summary": "Nhan vat den nha tro cu giua dem mua, thay bong nguoi sau cua so.",
      "cliffhanger": "Canh cua tu bat mo khi den pin tat phut."
    },
    {
      "part": 2,
      "title": "Hanh lang khong co cua so",
      "era": "hallway",
      "light": "candle",
      "target_sec": 58,
      "transition_out": "fade:0.25",
      "summary": "Buoc vao hanh lang am thap voi den dau, dem nham so phong.",
      "cliffhanger": "Tieng buoc chan vang ngay phia sau lung."
    }
  ]
}
```
Allowed `light` keys: `day | golden | night | candle | storm | eerie | blood`.
Allowed `transition_out` prefixes: `cut`, `fade:<sec>`, `blackout:<sec>`.

## 2. `bible/CONTINUITY.json` Schema

Update strictly at the end of Part `N` before starting Part `N+1`:

```json
{
  "completed_part": 1,
  "world_state": {
    "era": "courtyard",
    "light": "night",
    "doors_open": ["front_gate"],
    "lights_off": ["porch_lamp"]
  },
  "characters": {
    "protagonist": {
      "anchor": "PORCH_STEP",
      "holding": "lantern",
      "expr": "terrified"
    },
    "entity": {
      "anchor": "WINDOW_INSIDE",
      "visible": true,
      "opacity": 0.48
    }
  },
  "revealed_facts": [
    "Nha khong co dien, chi co den dau",
    "Cua so tang 1 co bong nguoi dung nhin"
  ],
  "audio_bridge": {
    "drone_hz": 43.65,
    "ambience": "wind",
    "last_cue": "stinger_boom_into_blackout"
  }
}
```

## 3. `shared/assets.ts` Template

Every location referenced by `parts/pNN/` MUST live here as a named `V3` anchor or safe camera point:

```ts
import { V3 } from "../../engine";

export const FLOOR_Y = {
  YARD: 0,
  PORCH: 0.16,
  HALLWAY: 0.16,
} as const;

export const ANCHORS = {
  GATE_FRONT: [0, FLOOR_Y.YARD, 6.2] as V3,
  PORCH_STEP: [-0.4, FLOOR_Y.PORCH, -1.8] as V3,
  WINDOW_INSIDE: [-2.1, FLOOR_Y.PORCH, -2.8] as V3,
  HALL_ENTRY: [0, FLOOR_Y.HALLWAY, 4.5] as V3,
  HALL_END: [0, FLOOR_Y.HALLWAY, -6.5] as V3,
} as const;

export const CAM_ZONES = {
  YARD_WIDE: [0.3, 1.55, 8.8] as V3,
  PORCH_MCU: [-1.1, 1.48, 2.2] as V3,
  HALL_LONG: [0.0, 1.45, 5.6] as V3,
} as const;
```

## 4. Thin `parts/pNN/world.ts` Pattern

`shared/worldBase.ts` builds every `EraGroup`, sky dome, fog, directional/hemi light, and `CastStage`, delegating per-frame character staging to a callback `(shotId, frame, light, camInfo, sunDir) => Stage`. Each Part only passes its `SHOTS`, `CAMS`, `KICKS`, and `stagePartN`:

```ts
import { HorrorWorldBase } from "../../shared/worldBase";
import { CAMS, KICKS, SHOTS } from "./story";
import { stagePart02 } from "./cast";

export const createPart02World = () =>
  new HorrorWorldBase({ shots: SHOTS, cams: CAMS, kicks: KICKS, stage: stagePart02 });
```

This keeps every `parts/pNN/` directory under ~350–500 lines total—immune to context bloat even on a 10-part episode.
