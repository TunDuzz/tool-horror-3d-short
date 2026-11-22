---
name: horror-script-storyboard
description: Write suspenseful horror narration scripts (2.7-3.2 words/s with deliberate pauses and Dead Silence beats), lock words.json timestamps, and map story.ts shot plans (SHOTS, CAMS, DOF, KICKS, OVERLAYS) for standalone 1-min horror shorts or 8-10 Part horror series. Use when scripting or storyboarding horror videos in Vietnamese or English.
---

# Horror Scriptwriting & Storyboarding (`SCRIPT.md` -> `story.ts`)

## 1. Pacing & Voice Rules (Distinct from Comedy/Explainer Shorts)

- **Speed:** **`2.7–3.2 words/s`** (~150–185 words per 60 s). Slower, intimate, ominous delivery outperforms rapid-fire narration in horror.
- **Strategic Silence:** Leave explicit `[PAUSE 0.5s]` or `[DEAD SILENCE 0.6s]` gaps in `SCRIPT.md` before twists/reveals so the listener feels tension build.
- **No On-Screen Captions by Default:** Keep 100% atmospheric visual immersion unless the user explicitly asks for captions (`GEMINI.md`).
- **Platform-Safe Dread:** Rely on psychological uncanny detail, folk rules, acoustic suspense, and eerie silhouettes—avoid gratuitous gore or self-harm themes.

## 2. The 8-Beat Standalone Horror Short Formula (55–70 s)

1. **Cold Hook (`0–4 s`):** State a chilling rule, eerie paradox, or uncanny sensory detail in sentence 1—zero preamble.
2. **Normalcy with Tension (`4–12 s`):** Time (`2:17 AM`), lonely place, mundane sensory detail (flickering hallway bulb, rain on tin roof).
3. **First Uncanny Cue (`12–22 s`):** One small rule breaks (a reflection blinks late, footsteps repeat one step too many, an old portrait looks sideways).
4. **Escalation (`22–36 s`):** 2–3 beats of the protagonist testing reality while isolation deepens.
5. **Dead Silence (`~36–37 s`):** Cut narration + music beds (`0.4–0.8 s`); camera creeps (`dollyZoom` or `pushK`).
6. **Climax / Reveal (`37–46 s`):** Trigger `lightning` / `flicker` / `blackout` + `KICKS` + visual reveal (`0–2 frames` before trigger word).
7. **Dark Realization (`46–56 s`):** Uncover the haunting truth behind what happened (folk curse logic, survival rule violated, or historical archive fact).
8. **Lingering Twist (`56–65 s`):** Final chilling line ending cleanly on a haunting visual hold.

## 3. Synthesizing Narrator Voice & Locking `words.json` -> `story.ts`

1. Write `[PAUSE Xs]` and `[DEAD SILENCE Xs]` directives directly inside `SCRIPT.md` (either on separate lines or between sentences).
2. Generate `voice.wav` + `words.json` (converted through the `ngan` So-VITS-SVC deep horror narrator model by default):
   ```powershell
   python scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
   ```
3. Verify `words`, `sentences`, and `dead_silences` timestamps in `out/<project>/voice/words.json`.
4. Map beats directly into `src/<project>/story.ts`:
   - `SHOTS`: `{ id, a, b, light: "night" | "candle" | "storm" | "eerie" | "blood", ... }`
   - `CAMS`: combine `pushK` (`0.0015–0.004`), `dollyZoom` (Vertigo compression), `handheld` (uneasy micro-drift), `snapZoom`, and `rolled` (`0.06–0.09` rad Dutch tilt). **Never leave any hold flat >= 4 frames** (prevents QA freeze alerts and keeps dread moving).
   - `OVERLAYS`: `ScreenBeat[]` (`lightning`, `flicker`, `blackout`, `flash`). Always pair `blackout` beats cleanly so `extract_shots.py` emits `planned_black`.
   - `KICKS`: `[t_sec, gain]` aligned `0–2 frames` before visual/audio impacts.
   - `DOF`: shallow depth (`cInf: 10–15`) on tense close-ups & over-the-shoulder reveals; sharp wide (`cInf: 0–4`) to emphasize lonely negative space.

## Formulas & Multi-Part Series Arc

See [HORROR_FORMULAS.md](./references/HORROR_FORMULAS.md) for beat templates across all 3 sub-genres (Vietnamese Folk/Spiritual, Urban/Rules/Liminal, True Historical Mysteries) and the 3-Act 8–10 Part Series structure.
