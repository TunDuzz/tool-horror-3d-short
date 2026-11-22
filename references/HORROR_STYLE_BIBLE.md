# Horror Style Bible ("Uncanny Toon-Noir")

Reference standard calibrated from the `HorrorLab` look-dev benchmark (`shorts-project/src/horror-lab/`).

## 1. Visual Identity & Contrast Targets

- **Aesthetic:** Flat bean-head 2D characters with `#241726` plum ink outlines standing inside dark hand-textured 3D environments with `#030303` `InkPass` geometry lines, moody fog gradients, and selective HDR emissive pools (`Bloom`).
- **Dark-Screen Readability (Phone @ 50% Brightness):**
  - Target median shot luma: **`0.15 – 0.30`** (never `< 0.10` across whole shots).
  - Target `p2`: **`0.015 – 0.04`** (rich shadows without total `#000` crush).
  - Target `p98`: **`>= 0.50`** (`short_qa.py` flags `[WARN: crushed darks p98<0.35]`—caused by missing lit planes, fog, or emissives).
- **Subtle Film Grain:** Unlike bright comedy shorts (`grain OFF`), horror shorts use subtle `grainAmount={0.015}` (`1.5%` deterministic PCG grain) to band-smooth dark fog gradients without turning YouTube compression to mush.

## 2. Orientation & Framing Grammar

- **Vertical `9:16` (`1080x1920`, 2K `1440x2560`):**
  - Excels at claustrophobia: narrow hallways, towering doorframes, looming ceilings, sudden behind-the-shoulder vertical reveals.
  - Keep camera far enough (`~4.0–4.8 m` on full-body shots) so boots + contact shadow stay inside bottom margin.
- **Horizontal `16:9` (`1920x1080`, 2K `2560x1440`):**
  - Excels at dread through **negative space**: stage protagonist off-center (left third) while an ominous glowing window, open doorway, or translucent ghost occupies the opposite side.
  - Both orientations share identical ink width and DOF blur scale via `Math.min(width, height) / 1080`.

## 3. Horror Motion & Overlay Grammar

- **Creep Holds (Zero Flat Holds):** Every still tension shot keeps a slow `pushK(..., 0.0018..0.0035)` or subtle `handheld(..., amp=0.015)` sway—never freeze camera completely for `>= 4` frames.
- **Dread Compression (`dollyZoom`):** Combine `dollyZoom(pos, look, 38, 1.0 - 0.22 * u)` over `24–40 f` when realization dawns.
- **Shock Punctuation:** Pair `KICKS` (`gain 1.0–1.5`) with `{ kind: "lightning", f }` (screen-blended, preserves ink lines) or a sharp `3–6 f` `{ kind: "blackout", a, b }` right before a `blood` Dutch tilt (`roll: 0.06–0.09` rad).
- **Acting & Blinks:** Use `lidAt(t, id, swaps)` around sudden shocks, except on `"hollow"` entities (`blink: 0` for unblinking dead-socket stares).
