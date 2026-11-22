# Horror Readability Traps & QA Gate Reference

Verify every single item during the **Pre-Final Still Gate** (`read_file` on 100% of stills) and **Post-Render QA Gate** (`short_qa.py`).

## 1. Horror-Specific Visual Traps (Caught on Still Inspection)

1. **Neon Pasted-On Character in Night Scenes:**
   - *Cause:* Custom unlit material on an ordinary character or overriding `uLightGain` back to `1.0`.
   - *Fix:* Use standard `placePerson` with `night`/`candle`/`storm`/`eerie`/`blood` (`charGain 0.62–0.68`) and keep `unlit: true` strictly for glowing eyes or light spirits.
2. **Background Pillar Ink Lines Cutting Through Translucent Ghosts:**
   - *Cause:* Translucent `ghostMat` sets `depthWrite: false`, so `InkPass` draws opaque `#030303` edges of pillars/walls behind the ghost over the rendered ghost silhouette.
   - *Fix:* Stage translucent ghosts inside open doorways, empty wall expanses, or dark recesses—avoid aligning a ghost's face with a high-contrast background edge.
3. **Floor Plane Slicing a Crisp Line Across Mist (`fxMist`):**
   - *Cause:* Placing a mist card too low (`center.y < height * 0.48`) lets the `y = 0` ground cut horizontally across the middle of the glow.
   - *Fix:* Set mist card center `y >= h * 0.48` (e.g. `y: 0.92, h: 1.9`).
4. **Cold Breath (`fxBreath`) Floating Behind Character's Head:**
   - *Cause:* Hardcoding `+x` offset while `viewOf` set `mirror: true` (character turned left).
   - *Fix:* Compute `const dir = view.mirror ? -1 : 1`, offset `x + dir * 0.24`, and call `fxBreath(p, u, dir)`.
5. **Washed-Out Grey Lightning Flash:**
   - *Cause:* Replacing `{ kind: "lightning" }` with a solid opaque white `flash`.
   - *Fix:* Always use `{ kind: "lightning", f }` (renders with `mixBlendMode: "screen"` and double-strike decay so black outlines stay sharp).
6. **Cut-Off Legs at Frame Bottom / Crushed Black Walls:**
   - *Fix:* Frame either chest-up MCU or full body with visible boots + contact shadow; verify `p98 >= 0.50` and readable facial expression on stills at 50% display brightness.

## 2. Strobe & Platform Safety

- Never trigger rapid full-screen flashes faster than `2–3` strikes per second or sustained `> 1.5 s` strobing (`flicker` overlays should stay `strength <= 0.55` for `<= 0.6 s` or use gentle 3D lamp `flickerAt` instead of full-screen blackouts).

## 3. Dark-Aware QA Gate (`extract_shots.py` + `short_qa.py`)

- Always declare deliberate black transitions in `story.ts` using `OVERLAYS` (`{ kind: "blackout", a, b }`) or `BLACKOUTS = [[a, b]]`.
- `extract_shots.py` writes those windows to `"planned_black"` in `shots.json` and suppresses boundary pop false positives.
- `short_qa.py`:
  - Auto-detects `16:9` (`320x180` analysis, `6x10` contact sheets) vs `9:16` (`180x320`, `10x6` sheets).
  - Ignores `planned_black` frames while still catching any **unplanned black**, **unplanned white**, **frozen >= 12f**, or **`[WARN: crushed darks p98<0.35]`**.
