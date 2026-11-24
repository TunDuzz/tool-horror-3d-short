# Multi-Part Horror Series Architecture & Schemas v5.0

Reference schemas and boilerplate for `shorts-project/src/<episode>/`.

## 1. `bible/OUTLINE.json` Schema (Exported via `horror_story.py export-outline`)

```json
{
  "title": "Ngoi Nha So 13",
  "aspect": "9:16",
  "fps": 30,
  "renderStyle": "psxHorror",
  "audio_drone_hz": 43.65,
  "reverb_seed": 77,
  "locations": [
    { "id": "S01", "name": "San truoc nha tro cu", "primary": true, "atmosphere": "Suong mu day, den duong nat chop tat" },
    { "id": "S02", "name": "Hanh lang tang 2 am thap", "primary": true, "atmosphere": "Tuong troc son, den tuyp xanh nhap nhay" }
  ],
  "castAppearanceBriefs": [
    { "id": "C01", "name": "Minh", "tier": "lead", "appearanceBrief": "Nam thanh nien 24 tuoi mac ao khoac gio xam dam, toc ngan roi, cam den pin kim loai." },
    { "id": "C02", "name": "Bong Nguoi Phong 13", "tier": "lead", "appearanceBrief": "Bong nguoi cao gay mac ao so mi cu am moc, co nghieng lech, khong lo ro mat trong bong toi." }
  ],
  "parts": [
    {
      "part": 1,
      "title": "Tieng go luc 2 gio sang",
      "locationId": "S01",
      "light": "duskFog",
      "target_sec": 60,
      "transition_out": "blackout:0.25",
      "summary": "Nhan vat den nha tro cu giua dem suong, thay bong nguoi rinh sau cua so.",
      "cliffhanger": "Canh cua tu bat mo khi den pin tat phut."
    },
    {
      "part": 2,
      "title": "Hanh lang khong co cua so",
      "locationId": "S02",
      "light": "fluorescent",
      "target_sec": 58,
      "transition_out": "fade:0.25",
      "summary": "Buoc vao hanh lang am thap voi den tuyp chop tat, dem nham so phong.",
      "cliffhanger": "Tieng buoc chan vang ngay phia sau lung."
    }
  ]
}
```
Allowed `light` keys (5 physical v5.0 presets): `warmLamp | coldMoon | fluorescent | duskFog | flashlight`.
Allowed `transition_out` prefixes: `cut`, `fade:<sec>`, `blackout:<sec>`.

## 2. `bible/CONTINUITY.json` Schema

Update strictly at the end of Part `N` before starting Part `N+1`:

```json
{
  "completed_part": 1,
  "world_state": {
    "locationId": "S01",
    "light": "duskFog",
    "doors_open": ["front_gate"],
    "lights_off": ["porch_lamp"]
  },
  "characters": {
    "protagonist": {
      "anchor": "PORCH_STEP",
      "holding": "flashlight",
      "expr": "terrified"
    },
    "entity": {
      "anchor": "WINDOW_INSIDE",
      "visible": true,
      "pose": "doorwayPeek"
    }
  },
  "revealed_facts": [
    "Nha khong co dien, chi con den duong ben ngoai",
    "Cua so tang 1 co bong nguoi dung nhin"
  ],
  "audio_bridge": {
    "drone_hz": 43.65,
    "ambience": "wind",
    "last_cue": "stinger_boom_into_blackout"
  }
}
```

## 3. `shared/locations.ts` Template (`assets.ts` Alias Supported)

Every location referenced by `parts/pNN/` MUST live here as named `V3` anchors, safe camera zones, and `LocationBlueprint[]` definitions:

```ts
import { type LocationBlueprint, type V3 } from "../../engine";

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

export const SHARED_LOCATIONS: LocationBlueprint[] = [
  // Define unique LocationBlueprints here; subsequent parts revisiting them declare sameLocationOf!
];
```

## 4. `shared/castBlueprints.ts` & Thin `parts/pNN/world.ts` Pattern

- `shared/castBlueprints.ts` defines every recurring `CharacterBlueprint` (built strictly from `castAppearanceBriefs` via `createCharacterFromBlueprint`). Subsequent Parts declare `"sameCharacterOf": "<episode>-p01:<charId>"` in their `manifest.json` so `validate_manifest.py` approves intentional series continuity.
- `shared/worldBase.ts` builds every isolated `LocationGroup`, sky dome, fog, 5-preset physical lighting, `PovRig3D`, and shared cast instances, delegating per-frame posing & `beatAt(MANIFEST, frame)` updates cleanly to each Part:

```ts
import { HorrorWorldBase } from "../../shared/worldBase";
import { CAMS, KICKS, MANIFEST, SHOTS } from "./story";

export const createPart02World = () =>
  new HorrorWorldBase({ manifest: MANIFEST, shots: SHOTS, cams: CAMS, kicks: KICKS });
```

This keeps every `parts/pNN/` directory under ~350–500 lines total—immune to context bloat even on a 10-part episode.
