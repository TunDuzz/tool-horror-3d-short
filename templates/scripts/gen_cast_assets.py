#!/usr/bin/env python3
"""Horror Engine v15.0: Automated 2.5D Photorealistic Cast & Normal Map Generator (GEMINI_API_KEY).

Reads `castBlueprints[]` from `src/<project>/manifest.json` and automatically produces:
  1. Story-driven photorealistic dark-horror / found-footage RGBA character & ghost cutouts
     (`calm`, `talk`, `fear`, `shock` for humans; `calm`, `entity_scare` for horror entities >= Tier 4),
     using `calm` as visual reference for secondary expressions so facial identity & clothing stay locked!
  2. Automatic chroma/border background removal (optional `rembg` if installed, else zero-dep `numpy+scipy`
     border flood-fill + green-spill suppression + feathered alpha edge).
  3. Automatic lightweight Tangent-Space Normal Map (`<id>_<expr>_normal.png`) combining macro silhouette dome
     curvature + Sobel luminance micro-relief so 3D room lights (`lights.ts` PointLights/SpotLight) sculpt true
     3D depth across the 2.5D billboard character!
  4. Project-isolated storage strictly inside `src/<project>/assets/cast/` + `cast_manifest.json` fingerprint
     for `ANTI_REPEAT_ENTITY_ERROR`.

Usage:
  python3 scripts/gen_cast_assets.py src/<project>/manifest.json \
    --out-dir src/<project>/assets/cast --update-manifest
"""

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import deque

import numpy as np
from PIL import Image
from scipy import ndimage

DEFAULT_IMAGE_MODELS = [
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
]

# 7-Tier Uncanny Horror Entity Escalation Scale (platform-safe, zero gratuitous gore, maximum psychological dread!)
SCARE_TIER_SPECS = {
    1: "backlit dark shadow silhouette with obscured features and eerie stillness",
    2: "familiar human figure with subtly wrong facial proportions and an unnatural 25-degree tilted neck",
    3: "pale dimly-lit human figure whose facial features are unsettlingly blank and blurred by analog VHS distortion",
    4: "gaunt pale figure clinging unnaturally to a corner or doorway edge, hunched limbs, peering silently with sunken shadowed eyes",
    5: "uncanny pale horror apparition with hollow dark eye sockets holding tiny white pinpoint glints and an unnaturally elongated motionless smile",
    6: "tall emaciated uncanny horror entity with an unnaturally stretched crooked neck twisted sideways, stiff asymmetrical joints, pale weathered skin, dark hollows around staring eyes",
    7: "frozen lifeless uncanny valley apparition staring straight into the camera lens, jaw slack and elongated in mid-distortion, stark high-contrast chiaroscuro lighting, chilling horror cinema realism",
}

EXPR_DIRECTIVES = {
    "calm": "neutral restrained expression, mouth gently closed, natural posture facing camera",
    "talk": "mid-sentence natural speaking expression, mouth slightly open forming a syllable, eyes attentive",
    "fear": "tense fearful expression, furrowed brows, wide wary eyes, shoulders slightly drawn up",
    "shock": "sudden horrified gasp expression, wide startled eyes, mouth open in silent shock, recoiling slightly",
    "entity_scare": "maximum uncanny horror manifestation matching scare tier, piercing gaze locked straight at viewer, eerie intense presence",
}


def load_api_key(explicit_key: str | None = None) -> str | None:
    """Resolve `GEMINI_API_KEY` from CLI flag, environment variable, or nearest `.env` file."""
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    env_k = os.environ.get("GEMINI_API_KEY")
    if env_k and env_k.strip():
        return env_k.strip()
    search_roots = [
        os.getcwd(),
        os.path.dirname(os.path.abspath(__file__)),
        os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")),
        os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")),
    ]
    for root in search_roots:
        env_p = os.path.join(root, ".env")
        if os.path.isfile(env_p):
            try:
                with open(env_p, encoding="utf-8") as fp:
                    for ln in fp:
                        ln = ln.strip()
                        if ln.startswith("GEMINI_API_KEY="):
                            val = ln.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return None


def safe_id(raw: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(raw).strip()).strip("_") or "char"


def compute_cast_prompt_signature(bp: dict) -> str:
    """Deterministic visual fingerprint hash for cross-video `ANTI_REPEAT_ENTITY_ERROR` validation."""
    key_obj = {
        "role": str(bp.get("role", "human")).lower(),
        "scareTier": int(bp.get("scareTier") or 0),
        "scareTraits": sorted(str(t).lower().strip() for t in (bp.get("scareTraits") or [])),
        "storyDescription": re.sub(r"\s+", " ", str(bp.get("storyDescription", "")).lower()).strip(),
        "garment": str((bp.get("appearance") or {}).get("garment", "")).lower(),
        "hairStyle": str((bp.get("appearance") or {}).get("hairStyle", "")).lower(),
    }
    raw = json.dumps(key_obj, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def build_cast_prompt(bp: dict, expr: str, setting_hint: str = "") -> str:
    """Build a strict story-driven photorealistic dark-horror studio cutout prompt (ZERO cartoon/anime!)."""
    role = str(bp.get("role", "human")).lower()
    desc = str(bp.get("storyDescription", "")).strip()
    is_entity = role in ("entity", "lurker", "silhouette")
    tier = int(bp.get("scareTier") or (5 if is_entity else 1))
    tier = max(1, min(7, tier))
    traits = ", ".join(str(t).replace("_", " ") for t in (bp.get("scareTraits") or []))
    expr_txt = EXPR_DIRECTIVES.get(expr, EXPR_DIRECTIVES["calm"])

    style_core = (
        "Photorealistic 35mm dark indie horror film still photography, realistic Vietnamese / East Asian human textures, "
        "natural film grain, subdued moody front-three-quarter soft lighting with clear skin and fabric detail, "
        "NOT cartoon, NOT anime, NOT 3D toy, NOT illustration, NOT flat vector art."
    )
    isolation = (
        "Full-body standing figure from head to shoes centered upright with clean breathing margin on all sides, "
        "isolated strictly against a completely flat uniform bright chroma-key green background (#00FF00), "
        "zero floor shadows, zero furniture, zero props blocking silhouette, zero text or watermarks."
    )
    if is_entity:
        tier_txt = SCARE_TIER_SPECS[tier]
        safety = "Psychological Uncanny Valley dread and stark lighting contrast; NO gratuitous gore or blood splatter."
        return (
            f"{style_core} Subject: supernatural horror apparition ({desc}). "
            f"Scare Tier {tier}/7 look: {tier_txt}. "
            f"{f'Distinct visual traits: {traits}. ' if traits else ''}"
            f"Expression/state ({expr}): {expr_txt}. "
            f"{f'Story atmosphere context: {setting_hint}. ' if setting_hint else ''}"
            f"{safety} {isolation}"
        )
    return (
        f"{style_core} Subject: real person ({desc}). "
        f"Expression/state ({expr}): {expr_txt}. "
        f"{f'Story atmosphere context: {setting_hint}. ' if setting_hint else ''}"
        f"{isolation}"
    )


def call_gemini_image(
    prompt: str,
    api_key: str,
    model: str = "gemini-2.5-flash-image",
    ref_png_bytes: bytes | None = None,
    aspect_ratio: str = "3:4",
    timeout: int = 90,
) -> bytes:
    """Call Gemini native image generation REST API (`:generateContent`) and return raw image bytes."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    parts = []
    if ref_png_bytes is not None:
        parts.append({
            "inlineData": {
                "mimeType": "image/png",
                "data": base64.b64encode(ref_png_bytes).decode("ascii"),
            }
        })
        parts.append({
            "text": (
                "Keep the EXACT SAME person, face, age, hair, outfit, and full-body proportions as this reference image, "
                "changing ONLY their facial expression and subtle posture as directed below:\n" + prompt
            )
        })
    else:
        parts.append({"text": prompt})

    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect_ratio},
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    for cand in data.get("candidates") or []:
        for part in (cand.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
    raise RuntimeError(f"Gemini image model '{model}' returned no image inlineData: {json.dumps(data)[:320]}")


def call_gemini_image_with_fallback(
    prompt: str,
    api_key: str,
    preferred_model: str | None = None,
    ref_png_bytes: bytes | None = None,
) -> tuple[bytes, str]:
    models = ([preferred_model] if preferred_model else []) + [m for m in DEFAULT_IMAGE_MODELS if m != preferred_model]
    last_err = None
    for m in models:
        for attempt in range(2):
            try:
                raw = call_gemini_image(prompt, api_key, model=m, ref_png_bytes=ref_png_bytes)
                return raw, m
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="replace")[:260]
                last_err = f"{m} HTTP {e.code}: {body}"
                if e.code in (429, 500, 503) and attempt == 0:
                    time.sleep(2.5)
                    continue
                break
            except Exception as e:
                last_err = f"{m}: {e}"
                break
    raise RuntimeError(f"All Gemini image models failed ({last_err})")


def remove_background_rgba(img: Image.Image) -> Image.Image:
    """Automatic background removal (uses `rembg` if installed, else clean chroma/border flood-fill + despill)."""
    try:
        import rembg  # type: ignore
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="PNG")
        cut_bytes = rembg.remove(buf.getvalue())
        cut = Image.open(io.BytesIO(cut_bytes)).convert("RGBA")
        return _crop_grounded_rgba(cut)
    except Exception:
        pass

    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape

    # Sample border pixels to estimate exact backdrop color (chroma green or studio solid)
    border = np.concatenate([rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]], axis=0)
    bg_col = np.median(border, axis=0)
    is_green_screen = (bg_col[1] > bg_col[0] + 28.0) and (bg_col[1] > bg_col[2] + 28.0)

    if is_green_screen:
        # Chroma-key dominance metric + color distance from sampled green screen
        g_excess = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        dist = np.linalg.norm(rgb - bg_col[None, None, :], axis=-1)
        bg_candidate = (g_excess > 24.0) | (dist < 62.0)
    else:
        dist = np.linalg.norm(rgb - bg_col[None, None, :], axis=-1)
        bg_candidate = dist < 44.0

    # Connected-component flood fill strictly from image border so interior eyes/clothing are never punched through!
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if bg_candidate[0, x]:
            visited[0, x] = True
            q.append((0, x))
        if bg_candidate[h - 1, x]:
            visited[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if bg_candidate[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            q.append((y, 0))
        if bg_candidate[y, w - 1] and not visited[y, w - 1]:
            visited[y, w - 1] = True
            q.append((y, w - 1))

    if is_green_screen:
        # Also seed any interior enclosed pure-chroma-green holes (e.g. gaps between arms/torso or legs)
        interior_chroma = (g_excess > 42.0) & (rgb[:, :, 1] > 95.0) & (~visited)
        ys_in, xs_in = np.nonzero(interior_chroma)
        for iy, ix in zip(ys_in.tolist(), xs_in.tolist()):
            visited[iy, ix] = True
            q.append((iy, ix))

    while q:
        cy, cx = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and bg_candidate[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    fg = ~visited
    # Clean stray 1-2px background speckles and smooth alpha edge by 1px
    fg = ndimage.binary_closing(fg, iterations=1)
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), sigma=0.75)
    alpha = np.clip((alpha - 0.12) / 0.76, 0.0, 1.0)

    out_rgb = rgb.copy()
    if is_green_screen:
        # Green-spill suppression on silhouette rim pixels (prevents bright green fringe under dark horror lighting!)
        rim = (alpha > 0.01) & (ndimage.binary_dilation(visited, iterations=3))
        max_rb = np.maximum(out_rgb[:, :, 0], out_rgb[:, :, 2])
        spill = np.maximum(0.0, out_rgb[:, :, 1] - max_rb)
        out_rgb[:, :, 1] = np.where(rim, out_rgb[:, :, 1] - spill * 0.92, out_rgb[:, :, 1] - spill * 0.25)

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return _crop_grounded_rgba(Image.fromarray(rgba, mode="RGBA"))


def _crop_grounded_rgba(img: Image.Image, target_h: int = 768) -> Image.Image:
    """Crop tightly to foreground bounding box keeping feet flush at bottom edge (`y=0`) for grounded 3D placement."""
    arr = np.asarray(img.convert("RGBA"))
    mask = arr[:, :, 3] > 28
    ys, xs = np.nonzero(mask)
    if len(ys) < 16:
        return img.convert("RGBA")
    h, w = mask.shape
    pad_x = max(8, int((xs.max() - xs.min()) * 0.08))
    pad_top = max(8, int((ys.max() - ys.min()) * 0.04))
    x0 = max(0, int(xs.min()) - pad_x)
    x1 = min(w, int(xs.max()) + pad_x)
    y0 = max(0, int(ys.min()) - pad_top)
    y1 = min(h, int(ys.max()) + 2)  # flush feet at bottom!
    cropped = img.crop((x0, y0, x1, y1))
    if cropped.height > target_h:
        new_w = max(64, int(round(cropped.width * (target_h / float(cropped.height)))))
        resample_lanczos = getattr(Image, "Resampling", Image).LANCZOS
        cropped = cropped.resize((new_w, target_h), resample_lanczos)
    return cropped


def generate_normal_map_from_rgba(
    rgba_img: Image.Image,
    volume_strength: float = 2.6,
    detail_strength: float = 1.35,
) -> Image.Image:
    """Generate a lightweight Tangent-Space RGB Normal Map from an RGBA sprite cutout.

    Combines:
      1. Macro 3D body dome curvature (`distance_transform_edt` of alpha mask) so side/floor lights wrap smoothly.
      2. Micro facial & garment relief (multi-scale luminance Sobel gradients).
    """
    arr = np.asarray(rgba_img.convert("RGBA"), dtype=np.float32) / 255.0
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    fg = alpha > 0.20

    # 1. Macro silhouette dome heightfield (smooth cylindrical/spherical body volume)
    dist = ndimage.distance_transform_edt(fg).astype(np.float32)
    max_d = max(1.0, float(dist.max()))
    dome = np.sqrt(np.clip(dist / max_d, 0.0, 1.0))
    dome = ndimage.gaussian_filter(dome, sigma=max(2.0, min(arr.shape[:2]) * 0.018))

    # 2. Micro luminance surface relief (face contours, cheekbones, clothing folds, hair)
    luma = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    luma_med = ndimage.gaussian_filter(luma, sigma=1.6)
    luma_fine = ndimage.gaussian_filter(luma, sigma=0.7)
    detail = 0.65 * luma_med + 0.35 * luma_fine

    # Gradients (+X right, +Y up in tangent space -> note image Y increases downward so invert dy!)
    dx_v = ndimage.sobel(dome, axis=1) * volume_strength
    dy_v = -ndimage.sobel(dome, axis=0) * volume_strength
    dx_d = ndimage.sobel(detail, axis=1) * detail_strength
    dy_d = -ndimage.sobel(detail, axis=0) * detail_strength

    nx = -(dx_v + dx_d)
    ny = -(dy_v + dy_d)
    nz = np.ones_like(nx, dtype=np.float32)

    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    nx = np.where(fg, nx * inv_len, 0.0)
    ny = np.where(fg, ny * inv_len, 0.0)
    nz = np.where(fg, nz * inv_len, 1.0)

    out = np.zeros((arr.shape[0], arr.shape[1], 3), dtype=np.uint8)
    out[:, :, 0] = np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    out[:, :, 1] = np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    out[:, :, 2] = np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def estimate_rig_meta_from_rgba(rgba_img: Image.Image) -> dict:
    """Auto-detect anatomical 2.5D puppet rig landmarks directly from a character cutout's alpha silhouette.

    Returns normalized coordinates (`v=0` feet -> `v=1` head top, `x in [-1..+1]`):
      - `neckV`: local silhouette pinch between shoulders and head
      - `shoulderV` & `shoulderSpan`: shoulder line height and normalized half-width
      - `waistV`: mid-torso / waist anchor
      - `mouthV`: lower-face jaw/chin zone for 30fps vocal RMS articulation
      - `headCenterX`: horizontal head center offset (accurately tracks crooked-neck horror entities!)
    """
    alpha = np.asarray(rgba_img.convert("RGBA"), dtype=np.uint8)[:, :, 3]
    h, w = alpha.shape
    fg = alpha > 75
    if h < 16 or w < 16 or not np.any(fg):
        return {
            "neckV": 0.80,
            "shoulderV": 0.72,
            "waistV": 0.48,
            "mouthV": 0.845,
            "shoulderSpan": 0.44,
            "headCenterX": 0.0,
        }

    # Horizontal span width per row (`y=0` top -> `y=h-1` bottom; `v = 1 - y/(h-1)`)
    row_has = fg.any(axis=1)
    row_w = np.zeros(h, dtype=np.float32)
    for y in range(h):
        if row_has[y]:
            xs = np.where(fg[y])[0]
            row_w[y] = float(xs[-1] - xs[0] + 1)
    smooth_w = ndimage.gaussian_filter1d(row_w, sigma=max(2.0, h * 0.014))

    def _y_for_v(v_val: float) -> int:
        return int(round((1.0 - max(0.0, min(1.0, v_val))) * (h - 1)))

    # 1. Neck pinch: narrowest width in v in [0.73..0.85] (capped at 0.84 so hooded figures never cut through face)
    y_nk_top, y_nk_bot = _y_for_v(0.85), _y_for_v(0.73)
    nk_slice = smooth_w[y_nk_top : max(y_nk_top + 2, y_nk_bot + 1)]
    valid_nk = nk_slice > 2.0
    if np.any(valid_nk):
        masked = np.where(valid_nk, nk_slice, 1e9)
        y_neck = y_nk_top + int(np.argmin(masked))
        neck_v = 1.0 - (y_neck / float(h - 1))
    else:
        neck_v = 0.80
    neck_v = max(0.73, min(0.84, neck_v))

    # 2. Shoulder line: upper-torso shoulder cap right below neck (avoiding flared elbows lower down!)
    sh_hi_v = max(0.68, neck_v - 0.035)
    sh_lo_v = max(0.65, neck_v - 0.13)
    y_sh_top, y_sh_bot = _y_for_v(sh_hi_v), _y_for_v(sh_lo_v)
    sh_slice = smooth_w[y_sh_top : max(y_sh_top + 2, y_sh_bot + 1)]
    if len(sh_slice) > 0 and float(sh_slice.max()) > 4.0:
        sh_max = float(sh_slice.max())
        # Pick the upper shoulder knee where silhouette reaches >= 88% of upper-torso width
        knee_idxs = np.where(sh_slice >= 0.88 * sh_max)[0]
        y_sh = y_sh_top + int(knee_idxs[0] if len(knee_idxs) > 0 else np.argmax(sh_slice))
        shoulder_v = 1.0 - (y_sh / float(h - 1))
        shoulder_span = sh_max / float(max(1, w))
    else:
        shoulder_v = max(0.68, neck_v - 0.075)
        shoulder_span = 0.44
    shoulder_v = max(0.66, min(neck_v - 0.035, shoulder_v))
    shoulder_span = max(0.30, min(0.84, shoulder_span))

    # 3. Waist anchor: narrowest mid-body band in v in [0.43..min(0.57, shoulder_v - 0.12)]
    wa_hi_v = max(0.46, min(0.57, shoulder_v - 0.12))
    y_wa_top, y_wa_bot = _y_for_v(wa_hi_v), _y_for_v(0.43)
    wa_slice = smooth_w[y_wa_top : max(y_wa_top + 2, y_wa_bot + 1)]
    valid_wa = wa_slice > 4.0
    if np.any(valid_wa):
        masked_wa = np.where(valid_wa, wa_slice, 1e9)
        y_wa = y_wa_top + int(np.argmin(masked_wa))
        waist_v = 1.0 - (y_wa / float(h - 1))
    else:
        waist_v = 0.48
    waist_v = max(0.43, min(shoulder_v - 0.10, waist_v))

    # 4. Head horizontal center (supports crooked-neck entities cleanly!)
    y_neck_px = _y_for_v(neck_v)
    head_fg = fg[: max(2, y_neck_px), :]
    if np.any(head_fg):
        _, h_xs = np.where(head_fg)
        head_cx = (float(np.median(h_xs)) / float(max(1, w - 1))) * 2.0 - 1.0
    else:
        head_cx = 0.0
    head_cx = max(-0.28, min(0.28, head_cx))

    # 5. Mouth / jaw center slightly above neck
    mouth_v = max(neck_v + 0.02, min(0.92, neck_v + (1.0 - neck_v) * 0.28))

    return {
        "neckV": round(float(neck_v), 4),
        "shoulderV": round(float(shoulder_v), 4),
        "waistV": round(float(waist_v), 4),
        "mouthV": round(float(mouth_v), 4),
        "shoulderSpan": round(float(shoulder_span), 4),
        "headCenterX": round(float(head_cx), 4),
    }


def _fg_metrics(rgba_img: Image.Image) -> tuple[int, int, int, float]:
    """Return `(y_top, y_bot, fg_height, head_cx_px)` of non-transparent foreground pixels."""
    a = np.asarray(rgba_img.convert("RGBA"), dtype=np.uint8)[:, :, 3]
    ys, xs = np.where(a > 60)
    if len(ys) == 0:
        return 0, rgba_img.height - 1, rgba_img.height, rgba_img.width * 0.5
    y_top, y_bot = int(ys.min()), int(ys.max())
    fg_h = max(8, y_bot - y_top + 1)
    head_cut = y_top + max(4, int(round(fg_h * 0.22)))
    h_xs = xs[ys <= head_cut]
    head_cx = float(np.median(h_xs)) if len(h_xs) > 0 else float(np.median(xs))
    return y_top, y_bot, fg_h, head_cx


def align_expr_to_base_canvas(rgba_img: Image.Image, base_img: Image.Image) -> Image.Image:
    """Align a secondary expression cutout (`fear`/`shock`/`talk`/`entity_scare`) onto the exact `(W, H)` canvas,
    grounded footline, height scale, and head horizontal centroid of `calm.png` so shader crossfades have zero ghosting!"""
    bw, bh = base_img.size
    _, b_bot, b_fgh, b_head_cx = _fg_metrics(base_img)
    _, s_bot, s_fgh, s_head_cx = _fg_metrics(rgba_img)

    scale = max(0.86, min(1.16, b_fgh / float(max(8, s_fgh))))
    new_w = max(8, int(round(rgba_img.width * scale)))
    new_h = max(8, int(round(rgba_img.height * scale)))
    resample_lanczos = getattr(Image, "Resampling", Image).LANCZOS
    scaled = rgba_img.resize((new_w, new_h), resample_lanczos)

    s_bot_scaled = int(round(s_bot * scale))
    s_head_cx_scaled = s_head_cx * scale

    dx = int(round(b_head_cx - s_head_cx_scaled))
    dy = int(round(b_bot - s_bot_scaled))

    canvas = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    canvas.paste(scaled, (dx, dy), scaled)
    return canvas


def find_raw_import_image(raw_dir: str, cid: str, slug: str, expr: str) -> str | None:
    """Locate a user- or Antigravity-generated raw image for `(cid, expr)` inside `raw_dir`."""
    if not raw_dir or not os.path.isdir(raw_dir):
        return None
    exts = (".png", ".jpg", ".jpeg", ".webp")
    prefixes = [
        f"{slug}_{expr}".lower(),
        f"{cid}_{expr}".lower(),
    ]
    exact_matches = []
    prefix_matches = []
    for fn in sorted(os.listdir(raw_dir)):
        low = fn.lower()
        stem, ext = os.path.splitext(low)
        if ext not in exts or stem.endswith("_normal"):
            continue
        if stem in prefixes:
            exact_matches.append(os.path.join(raw_dir, fn))
        elif any(stem.startswith(p + "_") or stem.startswith(p + "-") for p in prefixes):
            prefix_matches.append(os.path.join(raw_dir, fn))
    if exact_matches:
        return exact_matches[0]
    if prefix_matches:
        return prefix_matches[-1]
    return None


def generate_mock_offline_sprite(bp: dict, expr: str, size: tuple[int, int] = (384, 512)) -> Image.Image:
    """Deterministic photorealistic-toned offline cutout on #00FF00 chroma screen for unit tests & dry runs."""
    w, h = size
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:, :, 1] = 255  # pure chroma green backdrop

    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - w * 0.5) / (w * 0.5)
    ny = 1.0 - (yy / float(h - 1))  # 0 bottom -> 1 top

    is_ent = str(bp.get("role", "human")).lower() != "human"
    sig = int(compute_cast_prompt_signature(bp)[:6], 16)
    head_y = 0.82 if not is_ent else 0.84
    tilt_x = 0.09 if (is_ent and expr == "entity_scare") else 0.0
    in_head = ((nx - tilt_x) * 3.2) ** 2 + ((ny - head_y) * 7.2) ** 2 <= 1.0
    in_neck = (np.abs(nx - tilt_x * 0.5) < (0.09 if is_ent else 0.11)) & (ny >= 0.68) & (ny <= head_y)
    in_torso = (np.abs(nx) < (0.42 - np.maximum(0.0, ny - 0.62) * 0.65)) & (ny >= 0.36) & (ny <= 0.72)
    in_legs = ((np.abs(nx - 0.14) < 0.12) | (np.abs(nx + 0.14) < 0.12)) & (ny >= 0.02) & (ny < 0.38)
    body = in_head | in_neck | in_torso | in_legs

    shade = np.clip(0.55 + 0.45 * np.cos(nx * 2.2), 0.25, 1.0)
    skin = np.array([155, 152, 160] if is_ent else [176, 146, 126], dtype=np.float32)
    cloth = np.array([34 + (sig % 28), 38 + ((sig >> 4) % 24), 46 + ((sig >> 8) % 28)], dtype=np.float32)

    for c in range(3):
        col = np.where(in_head | in_neck, skin[c], cloth[c]) * shade
        img[:, :, c] = np.where(body, np.clip(col, 8, 245).astype(np.uint8), img[:, :, c])

    # Expressive face markers (eyes + mouth / scary smile)
    eye_mask = (np.abs(ny - (head_y + 0.02)) < 0.018) & (np.abs(np.abs(nx - tilt_x) - 0.095) < 0.028)
    if is_ent:
        img[eye_mask] = [12, 12, 16]
        pin = (np.abs(ny - (head_y + 0.02)) < 0.006) & (np.abs(np.abs(nx - tilt_x) - 0.095) < 0.009)
        img[pin] = [240, 245, 250]
    else:
        img[eye_mask] = [28, 24, 22]

    if expr in ("talk", "shock", "entity_scare"):
        m_w = 0.11 if expr == "entity_scare" else 0.055
        m_h = 0.025 if expr in ("shock", "entity_scare") else 0.015
        mouth = (np.abs(ny - (head_y - 0.045)) < m_h) & (np.abs(nx - tilt_x) < m_w)
        img[mouth] = [18, 10, 12]
    return Image.fromarray(img, mode="RGB")


def required_exprs_for_blueprint(bp: dict) -> list[str]:
    role = str(bp.get("role", "human")).lower()
    if role in ("entity", "lurker", "silhouette"):
        return ["calm", "entity_scare"]
    return ["calm", "talk", "fear", "shock"]


def generate_cast_for_manifest(
    manifest_path: str,
    out_dir: str,
    api_key: str | None = None,
    model: str | None = None,
    overwrite: bool = False,
    update_manifest: bool = False,
    mock_offline: bool = False,
    only_ids: set[str] | None = None,
    import_raw_dir: str | None = None,
) -> dict:
    with open(manifest_path, encoding="utf-8") as fp:
        manifest = json.load(fp)

    blueprints = manifest.get("castBlueprints") or []
    if not blueprints:
        raise ValueError(f"Manifest '{manifest_path}' declares no castBlueprints[]")

    offline_mode = mock_offline or bool(import_raw_dir)
    key = None if offline_mode else load_api_key(api_key)
    if not offline_mode and not key:
        raise RuntimeError("GEMINI_API_KEY not found (pass --api-key, set GEMINI_API_KEY env, add to .env, or use --import-raw-dir)")

    os.makedirs(out_dir, exist_ok=True)
    locs = manifest.get("locations") or []
    setting_hint = ", ".join(str(l.get("archetype", "")) for l in locs if l.get("archetype"))
    project_dir = os.path.dirname(os.path.abspath(manifest_path))
    rel_out_dir = os.path.relpath(os.path.abspath(out_dir), project_dir).replace("\\", "/")

    summary = {
        "projectId": manifest.get("projectId"),
        "version": "15.1.0",
        "outDir": rel_out_dir,
        "characters": {},
    }

    for bp in blueprints:
        cid = str(bp.get("id", "")).strip()
        if not cid or (only_ids and cid not in only_ids):
            continue
        if bp.get("characterMode") == "rig3d":
            print(f"  [SKIP] {cid}: characterMode='rig3d'")
            continue

        slug = safe_id(cid)
        exprs = required_exprs_for_blueprint(bp)
        prompt_sig = compute_cast_prompt_signature(bp)
        existing_assets = bp.get("spriteAssets") if isinstance(bp.get("spriteAssets"), dict) else {}
        sprite_assets = {
            "dir": rel_out_dir,
            "normalSuffix": "_normal.png",
            "promptSignature": existing_assets.get("promptSignature") or prompt_sig,
        }
        ref_png_bytes: bytes | None = None
        base_calm_img: Image.Image | None = None
        char_files = {}

        for expr in exprs:
            alb_name = f"{slug}_{expr}.png"
            nrm_name = f"{slug}_{expr}_normal.png"
            alb_path = os.path.join(out_dir, alb_name)
            nrm_path = os.path.join(out_dir, nrm_name)
            rel_alb = f"{rel_out_dir}/{alb_name}"

            raw_import_path = find_raw_import_image(import_raw_dir, cid, slug, expr) if import_raw_dir else None

            if os.path.isfile(alb_path) and os.path.isfile(nrm_path) and not overwrite and not raw_import_path:
                print(f"  [CACHE] {cid}.{expr} -> {alb_name} + {nrm_name}")
                if expr == "calm":
                    with open(alb_path, "rb") as f_ref:
                        ref_png_bytes = f_ref.read()
                    base_calm_img = Image.open(alb_path).convert("RGBA")
                sprite_assets[expr] = rel_alb
                char_files[expr] = {"albedo": alb_name, "normal": nrm_name}
                continue

            if import_raw_dir and not raw_import_path:
                if os.path.isfile(alb_path):
                    # Preserve already-processed expression when importing only newly added variants
                    if not os.path.isfile(nrm_path):
                        existing_rgba = Image.open(alb_path).convert("RGBA")
                        generate_normal_map_from_rgba(existing_rgba).save(nrm_path, format="PNG")
                    if expr == "calm":
                        base_calm_img = Image.open(alb_path).convert("RGBA")
                    sprite_assets[expr] = rel_alb
                    char_files[expr] = {"albedo": alb_name, "normal": nrm_name, "model": "existing_preserved"}
                    print(f"  [KEEP] {cid}.{expr} -> {alb_name} + {nrm_name}")
                else:
                    print(f"  [MISS] {cid}.{expr}: no raw image in '{import_raw_dir}' (skipped)")
                continue

            prompt = build_cast_prompt(bp, expr, setting_hint=setting_hint)
            if raw_import_path:
                raw_img = Image.open(raw_import_path)
                used_model = f"import_raw:{os.path.basename(raw_import_path)}"
            elif mock_offline:
                raw_img = generate_mock_offline_sprite(bp, expr)
                used_model = "mock_offline"
            else:
                raw_bytes, used_model = call_gemini_image_with_fallback(
                    prompt, key, preferred_model=model, ref_png_bytes=ref_png_bytes
                )
                raw_img = Image.open(io.BytesIO(raw_bytes))

            rgba_img = remove_background_rgba(raw_img)
            if expr != "calm" and base_calm_img is not None:
                # Lock secondary expression to identical canvas, footline, height & head center for ghost-free crossfade!
                rgba_img = align_expr_to_base_canvas(rgba_img, base_calm_img)

            nrm_img = generate_normal_map_from_rgba(rgba_img)
            rgba_img.save(alb_path, format="PNG")
            nrm_img.save(nrm_path, format="PNG")

            if expr == "calm":
                base_calm_img = rgba_img.copy()
                buf = io.BytesIO()
                rgba_img.save(buf, format="PNG")
                ref_png_bytes = buf.getvalue()

            sprite_assets[expr] = rel_alb
            char_files[expr] = {
                "albedo": alb_name,
                "normal": nrm_name,
                "size": [rgba_img.width, rgba_img.height],
                "model": used_model,
            }
            print(f"  [GEN OK] {cid}.{expr} ({rgba_img.width}x{rgba_img.height}, model={used_model}) -> {alb_name} + {nrm_name}")

        # Auto-measure anatomical 2.5D puppet landmarks (`rigMeta`) from calm cutout (or first available)
        rig_source = base_calm_img
        if rig_source is None:
            calm_cand = os.path.join(out_dir, f"{slug}_calm.png")
            if os.path.isfile(calm_cand):
                rig_source = Image.open(calm_cand).convert("RGBA")
        rig_meta = estimate_rig_meta_from_rgba(rig_source) if rig_source is not None else estimate_rig_meta_from_rgba(Image.new("RGBA", (32, 32)))
        sprite_assets["rigMeta"] = rig_meta

        bp["characterMode"] = bp.get("characterMode") or "sprite2d"
        bp["spriteAssets"] = sprite_assets
        summary["characters"][cid] = {
            "role": bp.get("role"),
            "scareTier": bp.get("scareTier"),
            "promptSignature": sprite_assets["promptSignature"],
            "rigMeta": rig_meta,
            "files": char_files,
        }

    cast_mf_path = os.path.join(out_dir, "cast_manifest.json")
    with open(cast_mf_path, "w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)
        fp.write("\n")

    if update_manifest:
        manifest["characterMode"] = manifest.get("characterMode") or "sprite2d"
        with open(manifest_path, "w", encoding="utf-8") as fp:
            json.dump(manifest, fp, ensure_ascii=False, indent=2)
            fp.write("\n")
        print(f"UPDATED MANIFEST -> {manifest_path}")

    print(f"CAST ASSETS READY -> {out_dir} ({len(summary['characters'])} characters)")
    return summary


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v15.1: Automated 2.5D Photorealistic Cast + Normal Map + RigMeta Generator.")
    ap.add_argument("manifest", help="Path to src/<project>/manifest.json")
    ap.add_argument("--out-dir", default=None, help="Output directory (defaults to <manifest_dir>/assets/cast)")
    ap.add_argument("--api-key", default=None, help="Optional GEMINI_API_KEY override")
    ap.add_argument("--model", default="gemini-2.5-flash-image", help="Preferred Gemini Image model")
    ap.add_argument("--only", default=None, help="Comma-separated cast IDs to generate (e.g. C01,C02)")
    ap.add_argument("--import-raw-dir", default=None, help="Free-Tier/Antigravity folder of raw chroma-key images (<ID>_<expr>.jpg/png) to cut out, align, Normal-Map, and auto-rig without API calls")
    ap.add_argument("--overwrite", action="store_true", help="Regenerate existing sprite PNGs")
    ap.add_argument("--update-manifest", action="store_true", help="Write spriteAssets paths, rigMeta & promptSignature back into manifest.json")
    ap.add_argument("--mock-offline", action="store_true", help="Generate deterministic offline cutouts + normal maps (for unit tests)")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    out_dir = args.out_dir or os.path.join(os.path.dirname(os.path.abspath(args.manifest)), "assets", "cast")
    only_ids = {s.strip() for s in args.only.split(",") if s.strip()} if args.only else None
    generate_cast_for_manifest(
        args.manifest,
        out_dir=out_dir,
        api_key=args.api_key,
        model=args.model,
        overwrite=args.overwrite,
        update_manifest=args.update_manifest,
        mock_offline=args.mock_offline,
        only_ids=only_ids,
        import_raw_dir=args.import_raw_dir,
    )


if __name__ == "__main__":
    main()
