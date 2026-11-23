---
name: horror-script-storyboard
description: Use when writing suspenseful horror narration scripts (2.7-3.2 words/s with [PAUSE]/[DEAD SILENCE] beats), locking words.json timestamps, or choreographing cinematic multi-angle shot plans (SHOTS, CAMS, DOF, KICKS, OVERLAYS) in story.ts.
---

# Horror Scriptwriting & Cinematic Storyboarding (`SCRIPT.md` -> `story.ts`)

## 1. Pacing & Voice Rules

- **Speed:** **`2.7–3.2 words/s`** (~150–185 words per 60 s). Slower, intimate, ominous delivery builds dread far better than rapid-fire narration.
- **Strategic Silence:** Write explicit `[PAUSE 0.35s]` and `[DEAD SILENCE 0.65s]` tags directly in `SCRIPT.md` before twists and climax reveals.
- **No On-Screen Captions by Default:** Preserve 100% atmospheric visual immersion unless explicitly requested (`GEMINI.md`).
- **Platform-Safe Psychological Dread:** Focus on uncanny rules, atmospheric folklore, silhouettes, and psychological twists — avoid gratuitous gore.

## 2. The 8-Beat Standalone Horror Short Formula (55–75 s)

1. **Cold Hook (`0–8 s`, `WS`):** Chilling rule or paradox — **DO NOT spoil the monster here!** Establish lonely atmosphere through dark foreground silhouettes.
2. **Approach / Setting (`8–16 s`, `OTS`):** Track behind the protagonist (`bodyBack` + `camOTS`) entering the haunted space with a real `PointLight` lantern/flashlight.
3. **First Uncanny Cue (`16–25 s`, `LOW` or `CU`):** Low-angle or close prop shot showing one eerie anomaly breaking reality (drifting nón lá, blinking reflection, extra elevator floor).
4. **Investigation (`25–32 s`, `MCU`):** Side/3-4 medium close-up with `action: "peer"` + `dollyZoom` compression + lantern under-lighting.
5. **Threat Tease & Dead Silence (`32–38 s`, `ECU` / `POV`):** Steep POV/ECU on a partial horror cue (clawed hand on rope, shadow under door) → lantern `flicker` → `blackout` across `[DEAD SILENCE]`.
6. **Climax Reveal (`38–46 s`, `LOW`):** Dramatic upward reveal with real 3D `lightning` flash + entity `emerge`, protagonist `recoil`.
7. **Struggle & Escape (`46–64 s`, `CU` Dutch tilt → `Reverse WS` → `MS`):** Tight dynamic lunge/recoil confrontation → reverse wide shot of protagonist `flee`ing while entity looms behind → `dipBlack` transition into sanctuary (`boltDoor`).
8. **Lingering Twist (`64–74 s`, `OTS` → Floor/Prop Reveal):** Protagonist faces safety (`bodyBack`), slowly turns in an over-the-shoulder **`glance: 1`** as camera tilts down to the chilling final evidence (`vignettePulse`).

## 3. Mandatory Cinematography & Transition Rules (`story.ts`)

1. **Zero Repeated Camera Angles:** Every shot in `SHOTS` MUST declare `scale: "WS" | "OTS" | "LOW" | "MCU" | "ECU" | "CU" | "MS" | "POV"`. Consecutive shots MUST NOT reuse the same camera vantage or `scale` (`short_qa.py` flags repeated scales & static-layout jump-cuts with `corr > 0.88`).
2. **Use Engine Camera Archetypes (`camera.ts`):** Combine `camOTS`, `camArc`, `camPOV`, `camECU`, `dollyZoom`, `handheld`, `snapZoom`, `pushK`, and `rolled` (`0.06–0.095` rad Dutch tilt). Keep subtle motion on every shot (zero dead holds `>= 4f`).
3. **Purposeful Transitions (`OVERLAYS`):**
   - Use `{ kind: "dipBlack", at, dur: 12, hold: 2 }` when changing major locations/eras (`wharf` → `shack`).
   - Use `{ kind: "blackout", a, b }` for `[DEAD SILENCE]` beats and `{ kind: "lightning", f }` for real 3D storm flashes.
   - Use `{ kind: "vignettePulse", a, b, freq, strength }` for creeping dread/heartbeat tension.
4. **Action-to-Word Lock:** Land visual impacts (`KICKS`, `lightning`, `doorBolt`, `lunge`, `glance`) **0–2 frames before** the matching trigger word in `words.json`.

## 4. Generating Narrator Voice (`words.json`)

```bash
python3 scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
```
*(Pass `--no-vc` to use plain `edge-tts` if no local So-VITS-SVC checkpoint is configured.)*

## Formulas & Multi-Part Series Arc

See [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) for beat templates across all 3 sub-genres and the 8–10 Part Series structure.
