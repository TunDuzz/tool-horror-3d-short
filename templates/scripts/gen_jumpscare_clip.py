#!/usr/bin/env python3
"""Horror Engine v15.4: Automated Jumpscare Video Generator (`KlingAIResearch/LivePortrait` + Gemini + Analog Horror Local).

Generates high-impact Jumpscare MP4 clips (`src/<project>/assets/jumpscare_<id>.mp4`) synchronized to
`jumpscare_anchor_frame.png` (`anchorFrame = clip.a - 1`) with 3 automatic backends (`--backend auto|liveportrait|gemini|local`)
plus direct external clip ingestion (`--import-jumpscare <file.mp4>`):
  1. `liveportrait` (DEFAULT in `auto` when `LIVEPORTRAIT_DIR` / `--liveportrait-dir` exists):
     Runs official `KlingAIResearch/LivePortrait` (`inference.py`) locally on GTX 960 6GB VRAM using
     color/lighting-matched entity portrait + `.pkl`/`.mp4` horror driving motions (`assets/liveportrait_motions/`
     with fallback to `LivePortrait/assets/examples/driving/`), strictly filters out `*_concat.mp4`, and applies
     tight 1.2-2.2s FFmpeg horror punch post-FX (transitionStyle intro + zoom-punch + decaying shake + RGB split + black cut).
  2. `gemini`: First-Frame-Conditioned Gemini Video API (`gemini-omni-1.2-flash` / `veo-*`) when `GEMINI_API_KEY` is set.
  3. `local`: Crisp 0.7-1.1s Analog Horror Hard-Cut Jumpscare (anchor frame -> 2-frame blackout flash -> hard cut to
     high-contrast close-up face with radial zoom blur, 8-12px RGB chromatic aberration, 2-frame strobe flash, and
     tight handheld shake -> immediate hard cut to black). Zero cross-dissolve ghosting!

Usage:
  python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json \
    --comp <CompositionId> --all --workspace shorts-project --backend auto --lp-fp32
"""

import argparse
import base64
import glob
import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

try:
    from gen_cast_assets import SCARE_TIER_SPECS, load_api_key
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from gen_cast_assets import SCARE_TIER_SPECS, load_api_key

VALID_TRANSITION_STYLES = {
    "first_frame_seamless",
    "whip_pan_turn",
    "diegetic_reveal",
    "silence_hard_cut",
}

VALID_BACKENDS = ("auto", "liveportrait", "gemini", "local")

TRANSITION_MOTION_PROMPTS = {
    "first_frame_seamless": (
        "Seamless continuous shot starting identically from frame 0 of the provided first-frame image with zero cut or lighting jump. "
        "For the first 0.25s the dark room holds eerily still, then the uncanny horror entity abruptly lunges straight toward the camera lens "
        "with violent micro-jitter and subtle natural handheld camera shock."
    ),
    "whip_pan_turn": (
        "Starts immediately from the provided first-frame image at the tail end of a rapid whip-pan head turn, snapping into focus on "
        "the uncanny horror apparition standing inches behind the viewer as its crooked neck twitches and jaw distorts toward the lens."
    ),
    "diegetic_reveal": (
        "Starts identically from the provided first-frame image; the room's real practical light flickers once (or door/curtain snaps open) "
        "revealing the horror entity suddenly much closer, lunging directly into foreground focus with eerie chiaroscuro shadows."
    ),
    "silence_hard_cut": (
        "Abrupt shock close-up starting from the provided first-frame composition right after dead silence: the horror entity's lifeless "
        "uncanny face snaps violently toward the camera lens with stark high-contrast shadow relief and panicked handheld shake."
    ),
}


def build_jumpscare_prompt(clip: dict, manifest: dict) -> str:
    """Build a story-specific First-Frame-conditioned AI Video Jumpscare prompt (never forces flashlight clichés!)."""
    t_style = str(clip.get("transitionStyle") or "first_frame_seamless").strip()
    if t_style not in VALID_TRANSITION_STYLES:
        raise ValueError(f"Invalid transitionStyle={t_style!r}; valid={sorted(VALID_TRANSITION_STYLES)}")

    custom_prompt = str(clip.get("prompt") or "").strip()
    ent_id = clip.get("entityId")
    bps = manifest.get("castBlueprints") or []
    ent_bp = next((b for b in bps if b.get("id") == ent_id), None) or next(
        (b for b in bps if b.get("role") in ("entity", "lurker", "silhouette")), None
    )

    ent_desc = ""
    tier_txt = ""
    if isinstance(ent_bp, dict):
        ent_desc = str(ent_bp.get("storyDescription") or "").strip()
        tier = max(4, min(7, int(ent_bp.get("scareTier") or 5)))
        tier_txt = SCARE_TIER_SPECS.get(tier, SCARE_TIER_SPECS[5])

    locs = manifest.get("locations") or []
    loc_desc = ", ".join(str(l.get("archetype", "")) for l in locs if l.get("archetype"))
    motion_base = TRANSITION_MOTION_PROMPTS[t_style]

    return (
        f"Photorealistic 35mm dark indie horror found-footage video clip. {motion_base} "
        f"{f'Setting architecture and lighting MUST match the exact first-frame room ({loc_desc}). ' if loc_desc else ''}"
        f"{f'Horror entity appearance: {ent_desc}. Uncanny Valley look: {tier_txt}. ' if ent_desc else ''}"
        f"{f'Specific beat action: {custom_prompt}. ' if custom_prompt else ''}"
        "Keep exact camera perspective, room colors, and shadows from frame 0; psychological Uncanny Valley terror, "
        "NO cartoon/anime style, NO text/watermarks, NO gratuitous gore."
    )


def build_veo_predict_payload(
    prompt: str,
    anchor_png_bytes: bytes,
    aspect_ratio: str = "9:16",
    duration_sec: int = 4,
    entity_ref_bytes: bytes | None = None,
) -> dict:
    """Build standard Veo `:predictLongRunning` First-Frame Conditioning JSON payload."""
    inst: dict = {
        "prompt": prompt,
        "image": {
            "bytesBase64Encoded": base64.b64encode(anchor_png_bytes).decode("ascii"),
            "mimeType": "image/png",
        },
    }
    if entity_ref_bytes is not None:
        inst["referenceImages"] = [
            {
                "image": {
                    "bytesBase64Encoded": base64.b64encode(entity_ref_bytes).decode("ascii"),
                    "mimeType": "image/png",
                },
                "referenceType": "asset",
            }
        ]
    return {
        "instances": [inst],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": aspect_ratio,
            "durationSeconds": max(2, min(8, int(round(duration_sec)))),
        },
    }


def build_omni_interaction_payload(
    prompt: str,
    anchor_png_bytes: bytes,
    model: str = "gemini-omni-1.2-flash",
    aspect_ratio: str = "9:16",
    duration_sec: float = 3.0,
    entity_ref_bytes: bytes | None = None,
) -> dict:
    """Build Gemini Omni Flash `/v1beta/interactions` First-Frame image-to-video JSON payload."""
    parts = [
        {
            "type": "image",
            "mime_type": "image/png",
            "data": base64.b64encode(anchor_png_bytes).decode("ascii"),
        }
    ]
    if entity_ref_bytes is not None:
        parts.append({
            "type": "image",
            "mime_type": "image/png",
            "data": base64.b64encode(entity_ref_bytes).decode("ascii"),
        })
    parts.append({
        "type": "text",
        "text": (
            f"Use the FIRST image as the exact locked opening frame (t=0.00s) of a {duration_sec:.1f}-second "
            f"{aspect_ratio} video clip. "
            + ("Use the SECOND image as the exact horror entity character reference. " if entity_ref_bytes else "")
            + prompt
        ),
    })
    return {
        "model": model,
        "input": parts,
        "response_modalities": ["video"],
        "generation_config": {
            "aspect_ratio": aspect_ratio,
            "duration_seconds": max(2, min(8, int(round(duration_sec)))),
        },
    }


def _extract_video_bytes_from_json(data: dict, api_key: str) -> bytes | None:
    """Recursively locate base64 video bytes or downloadable video URI in Gemini Interactions or Veo LRO response."""
    stack = [data]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            mime = str(cur.get("mimeType") or cur.get("mime_type") or cur.get("type") or "").lower()
            b64 = cur.get("bytesBase64Encoded") or cur.get("data")
            if isinstance(b64, str) and len(b64) > 2000 and ("video" in mime or "mp4" in mime):
                return base64.b64decode(b64)
            uri = cur.get("uri") or cur.get("videoUri") or cur.get("video_uri")
            if isinstance(uri, str) and uri.startswith("http"):
                req = urllib.request.Request(uri, headers={"x-goog-api-key": api_key})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    return resp.read()
            for v in cur.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(cur, list):
            for it in cur:
                if isinstance(it, (dict, list)):
                    stack.append(it)
    return None


def call_gemini_video_api(
    prompt: str,
    anchor_png_bytes: bytes,
    api_key: str,
    model: str = "gemini-omni-1.2-flash",
    aspect_ratio: str = "9:16",
    duration_sec: float = 3.0,
    entity_ref_bytes: bytes | None = None,
    poll_timeout_s: int = 240,
) -> tuple[bytes, str]:
    """Call Gemini Video API (supports both `gemini-omni-*` Interactions API and `veo-*` `:predictLongRunning`)."""
    if "veo" in model.lower():
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning"
        payload = build_veo_predict_payload(prompt, anchor_png_bytes, aspect_ratio, int(round(duration_sec)), entity_ref_bytes)
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            op = json.loads(resp.read().decode("utf-8"))
        op_name = op.get("name")
        if not op_name:
            vid = _extract_video_bytes_from_json(op, api_key)
            if vid:
                return vid, model
            raise RuntimeError(f"Veo returned no operation name: {json.dumps(op)[:300]}")
        t0 = time.time()
        while time.time() - t0 < poll_timeout_s:
            poll_url = f"https://generativelanguage.googleapis.com/v1beta/{op_name}"
            preq = urllib.request.Request(poll_url, headers={"x-goog-api-key": api_key})
            with urllib.request.urlopen(preq, timeout=45) as pr:
                st = json.loads(pr.read().decode("utf-8"))
            if st.get("done"):
                if st.get("error"):
                    raise RuntimeError(f"Veo operation failed: {st['error']}")
                vid = _extract_video_bytes_from_json(st, api_key)
                if vid:
                    return vid, model
                raise RuntimeError(f"Veo completed without video bytes: {json.dumps(st)[:300]}")
            time.sleep(5.0)
        raise TimeoutError(f"Veo operation '{op_name}' timed out after {poll_timeout_s}s")

    url = "https://generativelanguage.googleapis.com/v1beta/interactions"
    payload = build_omni_interaction_payload(prompt, anchor_png_bytes, model, aspect_ratio, duration_sec, entity_ref_bytes)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read().decode("utf-8"))

    vid = _extract_video_bytes_from_json(res, api_key)
    if vid:
        return vid, model

    inter_id = res.get("id") or res.get("name")
    if inter_id:
        t0 = time.time()
        while time.time() - t0 < poll_timeout_s:
            poll_url = (
                f"https://generativelanguage.googleapis.com/v1beta/{inter_id}"
                if "/" in str(inter_id)
                else f"https://generativelanguage.googleapis.com/v1beta/interactions/{inter_id}"
            )
            preq = urllib.request.Request(poll_url, headers={"x-goog-api-key": api_key})
            with urllib.request.urlopen(preq, timeout=45) as pr:
                st = json.loads(pr.read().decode("utf-8"))
            vid = _extract_video_bytes_from_json(st, api_key)
            if vid:
                return vid, model
            if str(st.get("status", "")).lower() in ("failed", "cancelled", "completed"):
                raise RuntimeError(f"Interaction '{inter_id}' ended with status={st.get('status')}: {json.dumps(st)[:300]}")
            time.sleep(4.0)
    raise RuntimeError(f"Gemini Omni model '{model}' returned no video payload: {json.dumps(res)[:320]}")


def _try_gemini_keyframe_morph(
    prompt: str,
    anchor_png_bytes: bytes,
    entity_ref_bytes: bytes | None,
    api_key: str,
    aspect_ratio: str = "9:16",
) -> list[Image.Image] | None:
    """When pure video endpoint is unavailable on key, generate a photorealistic First-Frame-locked horror lunge peak frame
    via `gemini-2.5-flash-image` anchored directly on `jumpscare_anchor_frame.png` + entity cutout!"""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    stages = [
        (
            "Keep the EXACT SAME dark room lighting tone and camera perspective from the first image, EXCEPT the horror entity "
            "from the second image has exploded straight into extreme close-up filling the foreground lens, crooked neck tilted, "
            "pinpoint eyes glinting in deep shadow, unnaturally elongated uncanny grimace, slight motion blur of a violent lunge. "
            "Photorealistic 35mm horror film still, ZERO gore, ZERO text."
        ),
    ]
    out_imgs = []
    for st_prompt in stages:
        parts = [
            {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(anchor_png_bytes).decode("ascii")}},
        ]
        if entity_ref_bytes is not None:
            parts.append({"inlineData": {"mimeType": "image/png", "data": base64.b64encode(entity_ref_bytes).decode("ascii")}})
        parts.append({"text": f"{st_prompt}\nScene context: {prompt}"})
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
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            found = None
            for cand in data.get("candidates") or []:
                for p in (cand.get("content") or {}).get("parts") or []:
                    inl = p.get("inlineData") or p.get("inline_data")
                    if inl and inl.get("data"):
                        found = Image.open(io.BytesIO(base64.b64decode(inl["data"]))).convert("RGB")
                        break
                if found is not None:
                    break
            if found is None:
                return None
            out_imgs.append(found)
        except Exception:
            return None
    return out_imgs if out_imgs else None


# ---------------- Official KlingAIResearch/LivePortrait Local Backend (GTX 960 6GB VRAM) ----------------

def resolve_liveportrait_dir(explicit_dir: str | None = None) -> str | None:
    """Resolve official `KlingAIResearch/LivePortrait` checkout directory containing `inference.py`."""
    cand = explicit_dir or os.environ.get("LIVEPORTRAIT_DIR")
    if not cand:
        return None
    abs_c = os.path.abspath(os.path.expanduser(cand))
    if os.path.isfile(os.path.join(abs_c, "inference.py")):
        return abs_c
    return None


def resolve_liveportrait_python(explicit_python: str | None = None) -> str:
    """Resolve Python executable inside LivePortrait's dedicated CUDA 11.8 venv/conda environment."""
    cand = explicit_python or os.environ.get("LIVEPORTRAIT_PYTHON")
    if cand:
        return os.path.expanduser(cand)
    return sys.executable


def resolve_motions_dir(
    explicit_dir: str | None = None,
    project_dir: str | None = None,
    workspace_dir: str | None = None,
) -> str | None:
    """Resolve local horror driving motions directory (`assets/liveportrait_motions/`)."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        explicit_dir,
        os.path.join(workspace_dir, "assets", "liveportrait_motions") if workspace_dir else None,
        os.path.join(project_dir, "assets", "liveportrait_motions") if project_dir else None,
        os.path.abspath(os.path.join(here, "..", "assets", "liveportrait_motions")),
        os.path.abspath(os.path.join(os.getcwd(), "assets", "liveportrait_motions")),
    ]
    for c in candidates:
        if c and os.path.isdir(c):
            return os.path.abspath(c)
    return None


def select_liveportrait_driving_motion(
    scare_tier: int = 5,
    transition_style: str = "first_frame_seamless",
    motions_dir: str | None = None,
    liveportrait_dir: str | None = None,
) -> str:
    """Pick the best `.pkl` (preferred — faster on GTX 960!) or `.mp4` driving motion by scareTier & transitionStyle.
    Falls back cleanly to `LivePortrait/assets/examples/driving/` when `assets/liveportrait_motions/` is empty."""
    tier = max(4, min(7, int(scare_tier or 5)))
    style = str(transition_style or "first_frame_seamless").strip()

    if tier >= 7 or style == "silence_hard_cut":
        pref_stems = ["wide_eye_lunge", "neck_snap_stare", "creepy_smile", "head_tilt_stare"]
    elif tier == 6 or style == "whip_pan_turn":
        pref_stems = ["neck_snap_stare", "wide_eye_lunge", "creepy_smile", "head_tilt_stare"]
    elif tier == 5:
        pref_stems = ["creepy_smile", "neck_snap_stare", "wide_eye_lunge", "head_tilt_stare"]
    else:
        pref_stems = ["head_tilt_stare", "creepy_smile", "neck_snap_stare", "wide_eye_lunge"]

    search_dirs: list[str] = []
    if motions_dir and os.path.isdir(motions_dir):
        search_dirs.append(os.path.abspath(motions_dir))
    if liveportrait_dir:
        ex_drv = os.path.join(os.path.abspath(liveportrait_dir), "assets", "examples", "driving")
        if os.path.isdir(ex_drv):
            search_dirs.append(ex_drv)

    for sdir in search_dirs:
        files = sorted(f for f in os.listdir(sdir) if os.path.isfile(os.path.join(sdir, f)))
        # 1. Preferred horror motion stems (`.pkl` first, then `.mp4`)
        for ext in (".pkl", ".mp4"):
            for stem in pref_stems:
                target = f"{stem}{ext}"
                if target in files:
                    return os.path.join(sdir, target)
        # 2. Any `.pkl` motion template first, then any `.mp4`
        for ext in (".pkl", ".mp4"):
            matched = [f for f in files if f.lower().endswith(ext)]
            if matched:
                return os.path.join(sdir, matched[0])

    raise FileNotFoundError(
        f"No LivePortrait driving motion (.pkl/.mp4) found in motions_dir={motions_dir!r} "
        f"or '{liveportrait_dir}/assets/examples/driving'."
    )


def _match_rgb_lighting_to_anchor(src_np: np.ndarray, anchor_np: np.ndarray, gain_bounds=(0.62, 1.28)) -> np.ndarray:
    """Match mean RGB color temperature & ambient darkness of `src_np` to the 3D room `anchor_np`."""
    a_mean = np.maximum(16.0, anchor_np.mean(axis=(0, 1)))
    s_mean = np.maximum(16.0, src_np.mean(axis=(0, 1)))
    ratio = np.clip(a_mean / s_mean, gain_bounds[0], gain_bounds[1])
    return np.clip(src_np * ratio, 0.0, 255.0)


def _build_entity_closeup_rgb(
    anchor_img: Image.Image,
    entity_rgba: Image.Image | None,
    width: int,
    height: int,
    crop_top_ratio: float = 0.56,
    bg_darken: float = 0.42,
    contrast_boost: float = 1.18,
    vignette_strength: float = 0.55,
) -> Image.Image:
    """Composite a lighting-matched upper-portrait / close-up of the project's horror entity onto the blurred 3D room anchor."""
    resample_lanczos = getattr(Image, "Resampling", Image).LANCZOS
    anchor_fit = anchor_img.convert("RGB").resize((width, height), resample_lanczos)
    anchor_np = np.asarray(anchor_fit, dtype=np.float32)

    if entity_rgba is None:
        # Tight center close-up crop of the anchor frame itself
        cw = max(64, int(round(width * 0.62)))
        ch = max(64, int(round(height * 0.62)))
        cx = (width - cw) // 2
        cy = max(0, int(round((height - ch) * 0.36)))
        canvas = anchor_fit.crop((cx, cy, cx + cw, cy + ch)).resize((width, height), resample_lanczos)
    else:
        bg = anchor_fit.filter(ImageFilter.GaussianBlur(radius=max(3.0, min(width, height) * 0.012)))
        bg = ImageEnhance.Brightness(bg).enhance(bg_darken)

        arr_e = np.asarray(entity_rgba.convert("RGBA"))
        alpha = arr_e[..., 3]
        ys, xs = np.where(alpha > 20)
        if len(ys) > 16 and len(xs) > 16:
            y0, y1 = int(ys.min()), int(ys.max()) + 1
            x0, x1 = int(xs.min()), int(xs.max()) + 1
            subj_h = max(16, y1 - y0)
            subj_w = max(16, x1 - x0)
            # Focus tightly on head + neck + upper shoulders for face detection / extreme horror close-up
            face_y1 = min(entity_rgba.height, y0 + max(16, int(round(subj_h * crop_top_ratio))))
            pad_x = int(round(subj_w * 0.16))
            pad_y = int(round(subj_h * 0.06))
            crop_box = (
                max(0, x0 - pad_x),
                max(0, y0 - pad_y),
                min(entity_rgba.width, x1 + pad_x),
                face_y1,
            )
            head_rgba = entity_rgba.crop(crop_box)
        else:
            head_rgba = entity_rgba

        # Fit head portrait generously inside canvas (centered slightly above vertical midline)
        target_h = int(round(height * 0.88))
        scale = min((width * 0.94) / float(max(1, head_rgba.width)), target_h / float(max(1, head_rgba.height)))
        ew = max(48, int(round(head_rgba.width * scale)))
        eh = max(48, int(round(head_rgba.height * scale)))
        e_res = head_rgba.resize((ew, eh), resample_lanczos)

        e_rgb_np = np.asarray(e_res.convert("RGB"), dtype=np.float32)
        e_a = np.asarray(e_res)[..., 3]
        mask = e_a > 24
        if np.any(mask):
            matched_np = _match_rgb_lighting_to_anchor(e_rgb_np, anchor_np)
        else:
            matched_np = e_rgb_np
        e_lit = Image.fromarray(matched_np.astype(np.uint8), mode="RGB")
        e_lit = ImageEnhance.Contrast(e_lit).enhance(contrast_boost)
        e_final = Image.merge("RGBA", (*e_lit.split(), e_res.split()[3]))

        canvas = bg.copy()
        ex = (width - ew) // 2
        ey = max(0, int(round((height - eh) * 0.34)))
        canvas.paste(e_final, (ex, ey), e_final)

    if vignette_strength > 0.01:
        c_np = np.asarray(canvas, dtype=np.float32)
        yy, xx = np.ogrid[:height, :width]
        ny = (yy - height * 0.44) / max(1.0, height * 0.56)
        nx = (xx - width * 0.50) / max(1.0, width * 0.56)
        r2 = nx * nx + ny * ny
        vig = np.clip(1.0 - vignette_strength * np.maximum(0.0, r2 - 0.18), 0.12, 1.0).astype(np.float32)
        canvas = Image.fromarray(np.clip(c_np * vig[..., None], 0, 255).astype(np.uint8), mode="RGB")
    return canvas


def prepare_liveportrait_source_image(
    anchor_png_path: str,
    entity_png_path: str | None,
    out_source_png: str,
    size: tuple[int, int] = (512, 640),
) -> str:
    """Prepare a lighting-matched close-up entity portrait PNG aligned to `jumpscare_anchor_frame.png` for LivePortrait."""
    os.makedirs(os.path.dirname(os.path.abspath(out_source_png)), exist_ok=True)
    anchor_img = Image.open(anchor_png_path).convert("RGB")
    ent_rgba = Image.open(entity_png_path).convert("RGBA") if (entity_png_path and os.path.isfile(entity_png_path)) else None
    w, h = size
    if ent_rgba is None:
        # Downscale anchor frame cleanly to `size` (512x640 default) to protect 4GB VRAM GPUs
        resample_lanczos = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.BICUBIC)
        anchor_img.resize((w, h), resample_lanczos).save(out_source_png)
        return out_source_png
    portrait = _build_entity_closeup_rgb(
        anchor_img,
        ent_rgba,
        width=w,
        height=h,
        crop_top_ratio=0.58,
        bg_darken=0.52,
        contrast_boost=1.12,
        vignette_strength=0.40,
    )
    portrait.save(out_source_png)
    return out_source_png


def build_liveportrait_cmd(
    lp_python: str,
    liveportrait_dir: str,
    source_png: str,
    driving_path: str,
    out_dir: str,
    lp_fp32: bool = False,
) -> list[str]:
    """Build official `KlingAIResearch/LivePortrait` `inference.py` CLI command (GTX 960 Maxwell safe!).
    - Passes `--no_flag_use_half_precision` when `lp_fp32=True` to avoid FP16 black/noisy frames on GTX 960.
    - NEVER passes `--flag_do_torch_compile` (always disabled for Maxwell / Windows stability)."""
    cmd = [
        lp_python,
        os.path.join(os.path.abspath(liveportrait_dir), "inference.py"),
        "-s",
        os.path.abspath(source_png),
        "-d",
        os.path.abspath(driving_path),
        "-o",
        os.path.abspath(out_dir),
    ]
    if lp_fp32:
        cmd.append("--no_flag_use_half_precision")
    return cmd


def select_liveportrait_output(out_dir: str) -> str:
    """Locate the primary animated MP4 generated by `KlingAIResearch/LivePortrait`, STRICTLY rejecting `*_concat.mp4`."""
    candidates: list[str] = []
    for root, _, files in os.walk(out_dir):
        for f in files:
            fl = f.lower()
            if not fl.endswith(".mp4"):
                continue
            if "_concat" in fl:
                continue
            candidates.append(os.path.join(root, f))
    if not candidates:
        raise FileNotFoundError(
            f"LivePortrait produced no primary animated .mp4 (excluding *_concat.mp4) inside '{out_dir}'"
        )
    candidates.sort(key=lambda p: (os.path.getmtime(p), os.path.getsize(p)), reverse=True)
    return candidates[0]


def _build_liveportrait_env(py_exe: str) -> dict[str, str]:
    """Ensure pip-installed `nvidia/*/lib` CUDA/cuDNN/NVRTC libraries inside a Linux venv/conda env are visible on LD_LIBRARY_PATH."""
    env = os.environ.copy()
    if os.name == "nt":
        return env
    py_dir = os.path.dirname(os.path.abspath(py_exe))
    env_root = os.path.dirname(py_dir)
    lib_dirs: list[str] = []
    for sp_cand in glob.glob(os.path.join(env_root, "lib", "python*", "site-packages", "nvidia", "*", "lib")):
        if os.path.isdir(sp_cand):
            lib_dirs.append(sp_cand)
    if lib_dirs:
        existing = env.get("LD_LIBRARY_PATH", "")
        env["LD_LIBRARY_PATH"] = ":".join(lib_dirs + ([existing] if existing else []))
    return env


def run_liveportrait_inference(
    liveportrait_dir: str,
    source_png: str,
    driving_path: str,
    out_dir: str,
    lp_python: str | None = None,
    lp_fp32: bool = False,
) -> str:
    """Execute official `KlingAIResearch/LivePortrait` via subprocess and return the primary non-concat MP4 path."""
    os.makedirs(out_dir, exist_ok=True)
    py_exe = resolve_liveportrait_python(lp_python)
    cmd = build_liveportrait_cmd(py_exe, liveportrait_dir, source_png, driving_path, out_dir, lp_fp32=lp_fp32)
    subprocess.run(cmd, cwd=os.path.abspath(liveportrait_dir), env=_build_liveportrait_env(py_exe), check=True)
    return select_liveportrait_output(out_dir)


def postprocess_liveportrait_jumpscare(
    raw_lp_mp4: str,
    anchor_png_path: str,
    out_mp4_path: str,
    duration_sec: float = 1.8,
    width: int = 1080,
    height: int = 1920,
    fps: int = 30,
    transition_style: str = "first_frame_seamless",
    hard_cut_black: bool = True,
) -> str:
    """Apply tight cinematic FFmpeg horror post-FX (1.2-2.2s) onto LivePortrait output:
    transitionStyle frame-0 intro + sudden zoom-punch + decaying handheld shake + subtle RGB split + optional black cut."""
    os.makedirs(os.path.dirname(os.path.abspath(out_mp4_path)), exist_ok=True)
    eff_dur = max(1.2, min(2.2, float(duration_sec)))
    intro_frames = 2 if transition_style in ("first_frame_seamless", "diegetic_reveal", "silence_hard_cut") else 3
    intro_s = intro_frames / float(fps)
    main_s = max(0.9, eff_dur - intro_s)

    # 1. Anchor transition intro (`[0:v]`) honoring `transitionStyle`
    intro_chain = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},fps={fps},setpts=PTS-STARTPTS"
    )
    if transition_style == "silence_hard_cut":
        # Frame 0 exact anchor, frames 1..intro blackout snap
        intro_chain += f",drawbox=enable='gte(n,1)':color=black:t=fill"
    elif transition_style == "diegetic_reveal":
        intro_chain += f",eq=brightness=-0.65:enable='gte(n,1)'"
    elif transition_style == "whip_pan_turn":
        intro_chain += ",boxblur=16:1:0:1"
    intro_chain += f",trim=duration={intro_s:.4f},setpts=PTS-STARTPTS,format=rgb24[v_intro]"

    # 2. LivePortrait punch body (`[1:v]`): sudden zoom-punch + decaying handheld shake + subtle RGB chromatic aberration
    over_w = int(math.ceil(width * 1.24 / 2.0) * 2)
    over_h = int(math.ceil(height * 1.24 / 2.0) * 2)
    # Dynamic oversample zoom (1.06 -> 1.22 over first 0.28s) + decaying handheld shake crop back to exact width x height
    main_chain = (
        f"[1:v]fps={fps},trim=duration={main_s:.4f},setpts=PTS-STARTPTS,"
        f"scale={over_w}:{over_h}:force_original_aspect_ratio=increase,"
        f"crop={over_w}:{over_h},"
        f"scale=w='trunc({width}*(1.06+0.16*min(1,t/0.28))/2)*2':"
        f"h='trunc({height}*(1.06+0.16*min(1,t/0.28))/2)*2':eval=frame,"
        f"crop={width}:{height}:"
        f"'max(0,min(iw-ow,(iw-ow)/2+16*exp(-t*2.6)*sin(t*54)))':"
        f"'max(0,min(ih-oh,(ih-oh)/2+18*exp(-t*2.6)*cos(t*47)))',"
        f"eq=contrast=1.14:brightness=-0.03:saturation=0.92,"
        f"format=rgba,rgbashift=rh=5:bv=-5:edge=smear,format=rgb24[v_main]"
    )

    # 3. Concat intro + LivePortrait body + optional sharp black cut on final 0.14s (4 frames)
    tail_cut = f",drawbox=enable='gte(t,{max(0.4, eff_dur - 0.14):.4f})':color=black:t=fill" if hard_cut_black else ""
    concat_chain = f"[v_intro][v_main]concat=n=2:v=1:a=0{tail_cut},fps={fps},format=yuv420p[v_out]"
    filter_complex = ";".join([intro_chain, main_chain, concat_chain])

    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-loop", "1", "-framerate", str(fps), "-t", f"{intro_s + 0.2:.3f}", "-i", anchor_png_path,
            "-stream_loop", "-1", "-i", raw_lp_mp4,
            "-filter_complex", filter_complex,
            "-map", "[v_out]",
            "-t", f"{eff_dur:.3f}",
            "-an",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "fast",
            out_mp4_path,
        ],
        check=True,
    )
    return out_mp4_path


# ---------------- Analog Horror Hard-Cut Local Fallback (0.7 - 1.1s, ZERO cross-dissolve!) ----------------

def _apply_radial_zoom_blur(frame_np: np.ndarray, strength: float) -> np.ndarray:
    """Fast vectorized multi-tap radial zoom blur emanating from center of frame."""
    if strength <= 0.01:
        return frame_np
    h, w, _ = frame_np.shape
    cy = h * 0.46
    cx = w * 0.50
    yy = np.arange(h, dtype=np.float32)[:, None] - cy
    xx = np.arange(w, dtype=np.float32)[None, :] - cx

    acc = frame_np.astype(np.float32) * 0.40
    taps = ((0.035 * strength, 0.26), (0.075 * strength, 0.20), (0.120 * strength, 0.14))
    for s_amt, weight in taps:
        inv = 1.0 / (1.0 + s_amt)
        sy = np.clip(np.rint(cy + yy * inv).astype(np.int32), 0, h - 1)
        sx = np.clip(np.rint(cx + xx * inv).astype(np.int32), 0, w - 1)
        acc += frame_np[sy, sx].astype(np.float32) * weight
    return np.clip(acc, 0.0, 255.0).astype(np.uint8)


def _apply_rgb_chromatic_split(frame_np: np.ndarray, shift_px: int) -> np.ndarray:
    """Strong horizontal RGB Chromatic Aberration (8-12px) for Analog Horror hard-cut shock."""
    s = max(0, int(shift_px))
    if s == 0:
        return frame_np
    out = frame_np.copy()
    out[..., 0] = np.roll(frame_np[..., 0], s, axis=1)
    out[..., 2] = np.roll(frame_np[..., 2], -s, axis=1)
    # Clamp wraparound edges cleanly to nearest edge pixels instead of wrapping across opposite side
    out[:, :s, 0] = frame_np[:, 0:1, 0]
    out[:, -s:, 2] = frame_np[:, -1:, 2]
    return out


def render_local_first_frame_jumpscare(
    anchor_png_path: str,
    out_mp4_path: str,
    duration_sec: float = 0.90,
    fps: int = 30,
    width: int = 1080,
    height: int = 1920,
    transition_style: str = "first_frame_seamless",
    entity_png_path: str | None = None,
    ai_keyframe_imgs: list[Image.Image] | None = None,
) -> str:
    """Synthesize a crisp Analog Horror Hard-Cut Jumpscare MP4 (0.7 - 1.1s, ZERO cross-dissolve ghosting!).

    Choreography:
      1. Frame 0: Exact `jumpscare_anchor_frame.png` (First-Frame Lock).
      2. Frames 1-2: 2-frame pitch-black Blackout Flash.
      3. Frames 3..(N-4): Hard Cut straight into high-contrast close-up horror face (`kf_peak` or tight face crop)
         with Radial Zoom Blur, strong 8-12px RGB Chromatic Aberration, 2-frame strobe flash, and tight violent shake.
      4. Final 4 frames: Immediate Hard Cut to Black so the brain never has time to inspect a still image.
    """
    resample_lanczos = getattr(Image, "Resampling", Image).LANCZOS
    resample_bilinear = getattr(Image, "Resampling", Image).BILINEAR

    eff_dur = max(0.70, min(1.10, float(duration_sec)))
    n_frames = max(21, min(33, int(round(eff_dur * fps))))

    base_img = Image.open(anchor_png_path).convert("RGB").resize((width, height), resample_lanczos)
    base_np = np.asarray(base_img, dtype=np.float32)

    if ai_keyframe_imgs and len(ai_keyframe_imgs) >= 1:
        kf_peak = ai_keyframe_imgs[-1].convert("RGB").resize((width, height), resample_lanczos)
        p_np = _match_rgb_lighting_to_anchor(np.asarray(kf_peak, dtype=np.float32), base_np, gain_bounds=(0.70, 1.35))
        peak_img = ImageEnhance.Contrast(Image.fromarray(p_np.astype(np.uint8), mode="RGB")).enhance(1.32)
    else:
        ent_rgba = Image.open(entity_png_path).convert("RGBA") if (entity_png_path and os.path.isfile(entity_png_path)) else None
        peak_img = _build_entity_closeup_rgb(
            base_img,
            ent_rgba,
            width=width,
            height=height,
            crop_top_ratio=0.48,
            bg_darken=0.22,
            contrast_boost=1.45,
            vignette_strength=0.72,
        )

    black_bytes = np.zeros((height, width, 3), dtype=np.uint8).tobytes()
    black_tail_frames = 4
    peak_end_idx = max(8, n_frames - black_tail_frames)

    os.makedirs(os.path.dirname(os.path.abspath(out_mp4_path)), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{width}x{height}", "-r", str(fps), "-i", "-",
        "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "fast",
        out_mp4_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    rng = np.random.default_rng(66615)

    try:
        for i in range(n_frames):
            if i == 0:
                proc.stdin.write(base_img.tobytes())
                continue
            if i in (1, 2):
                # 2-frame Blackout Flash before hard cut
                proc.stdin.write(black_bytes)
                continue
            if i >= peak_end_idx:
                # Immediate Hard Cut to Black right after peak impact
                proc.stdin.write(black_bytes)
                continue

            # Hard Cut into high-contrast close-up with rapid zoom punch + tight violent shake
            j = i - 3
            peak_span = max(1, peak_end_idx - 3)
            u = j / float(peak_span)
            zoom = 1.05 + 0.14 * min(1.0, (j + 1) / 5.0) + 0.025 * math.sin(j * 2.7)
            decay = math.exp(-j / 9.5)
            max_jit = max(6, int(round(min(width, height) * 0.032)))
            shake_x = int(round(rng.uniform(-max_jit, max_jit) * (0.35 + 0.65 * decay)))
            shake_y = int(round(rng.uniform(-max_jit, max_jit) * (0.35 + 0.65 * decay)))

            cw = max(64, int(round(width / zoom)))
            ch = max(64, int(round(height / zoom)))
            cx = max(0, min(width - cw, (width - cw) // 2 + shake_x))
            cy = max(0, min(height - ch, (height - ch) // 2 + shake_y))
            cut_img = peak_img.crop((cx, cy, cx + cw, cy + ch)).resize((width, height), resample_bilinear)

            frame_np = np.asarray(cut_img, dtype=np.uint8)

            # Radial Zoom Blur (intense punch on impact frames, lingering edge smear after)
            blur_strength = 1.0 if j < 4 else max(0.35, 0.95 - 0.55 * u)
            frame_np = _apply_radial_zoom_blur(frame_np, blur_strength)

            # Strong RGB Chromatic Aberration (8-12px)
            shift_px = int(round(12.0 - 4.0 * u))
            frame_np = _apply_rgb_chromatic_split(frame_np, shift_px)

            # 2-Frame Strobe Flash right on the Hard Cut impact (frames 3 & 4)
            if i == 3:
                f_flt = frame_np.astype(np.float32) * 1.55 + 18.0
                frame_np = np.clip(f_flt, 0.0, 255.0).astype(np.uint8)
            elif i == 4:
                f_flt = frame_np.astype(np.float32) * 1.32 + 10.0
                frame_np = np.clip(f_flt, 0.0, 255.0).astype(np.uint8)

            proc.stdin.write(frame_np.tobytes())
    finally:
        proc.stdin.close()
        rc = proc.wait()
        if rc != 0:
            raise RuntimeError(f"ffmpeg local jumpscare encode failed with exit code {rc}")
    return out_mp4_path


def normalize_jumpscare_mp4(raw_video_path: str, out_mp4_path: str, duration_sec: float, width: int, height: int, fps: int = 30) -> str:
    """Trim & normalize AI-generated or imported jumpscare video to exact duration, 30fps, composition aspect, muted H.264."""
    os.makedirs(os.path.dirname(os.path.abspath(out_mp4_path)), exist_ok=True)
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},fps={fps},format=yuv420p"
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-i", raw_video_path,
            "-t", f"{duration_sec:.3f}",
            "-vf", vf,
            "-an",
            "-c:v", "libx264", "-crf", "16", "-preset", "fast",
            out_mp4_path,
        ],
        check=True,
    )
    return out_mp4_path


def capture_anchor_frame(workspace_dir: str, comp_id: str, anchor_frame: int, out_png_path: str) -> str:
    """Invoke `scripts/render-stills.mjs --raw-anchor --png` to capture the clean pre-VHS 3D anchor frame."""
    stills_js = os.path.join(workspace_dir, "scripts", "render-stills.mjs")
    if not os.path.isfile(stills_js):
        raise FileNotFoundError(f"render-stills.mjs not found in workspace: {stills_js}")
    os.makedirs(os.path.dirname(os.path.abspath(out_png_path)), exist_ok=True)
    prefix = os.path.join(os.path.dirname(os.path.abspath(out_png_path)), "_anchor_")
    cmd = ["node", stills_js, comp_id, prefix, str(int(anchor_frame)), "1", "--raw-anchor", "--png"]
    env = os.environ.copy()
    env.setdefault("REMOTION_TMP", "/tmp/remotion-tmp")
    subprocess.run(cmd, cwd=workspace_dir, env=env, check=True)
    produced = f"{prefix}{int(anchor_frame)}.png"
    if not os.path.isfile(produced):
        raise FileNotFoundError(f"Expected anchor still not produced: {produced}")
    shutil.move(produced, out_png_path)
    return out_png_path


def generate_jumpscare_clips(
    manifest_path: str,
    workspace_dir: str | None = None,
    comp_id: str | None = None,
    clip_id: str | None = None,
    api_key: str | None = None,
    model: str = "gemini-omni-1.2-flash",
    overwrite: bool = False,
    fallback_local: bool = False,
    allow_local_fallback: bool = True,
    anchor_override: str | None = None,
    backend: str = "auto",
    liveportrait_dir: str | None = None,
    liveportrait_python: str | None = None,
    motions_dir: str | None = None,
    lp_fp32: bool = False,
    import_jumpscare: str | None = None,
    hard_cut_black: bool = True,
) -> list[dict]:
    with open(manifest_path, encoding="utf-8") as fp:
        manifest = json.load(fp)

    clips = manifest.get("jumpscareClips") or []
    if not clips:
        raise ValueError(f"Manifest '{manifest_path}' has no `jumpscareClips[]` declared")

    targets = [c for c in clips if not clip_id or c.get("id") == clip_id]
    if not targets:
        raise ValueError(f"No jumpscare clip found matching --clip-id={clip_id!r}")

    eff_backend = "local" if fallback_local else str(backend or "auto").strip().lower()
    if eff_backend not in VALID_BACKENDS:
        raise ValueError(f"Invalid backend={eff_backend!r}; valid={VALID_BACKENDS}")

    aspect = str(manifest.get("aspect") or "9:16")
    width, height = (1920, 1080) if aspect == "16:9" else (1080, 1920)
    fps = 30
    project_dir = os.path.dirname(os.path.abspath(manifest_path))
    assets_dir = os.path.join(project_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    resolved_lp_dir = resolve_liveportrait_dir(liveportrait_dir)
    resolved_motions = resolve_motions_dir(motions_dir, project_dir=project_dir, workspace_dir=workspace_dir)
    key = None if eff_backend in ("local", "liveportrait") else load_api_key(api_key)

    results = []
    for clip in targets:
        cid = str(clip.get("id") or "js1")
        a_f = int(clip["a"])
        b_f = int(clip["b"])
        raw_dur_s = max(0.7, (b_f - a_f) / float(fps))
        anchor_f = int(clip.get("anchorFrame") if clip.get("anchorFrame") is not None else max(0, a_f - 1))
        t_style = str(clip.get("transitionStyle") or "first_frame_seamless")
        out_mp4 = os.path.join(assets_dir, f"jumpscare_{cid}.mp4")
        anchor_png = os.path.join(assets_dir, f"jumpscare_anchor_{cid}.png")

        if os.path.isfile(out_mp4) and not overwrite:
            print(f"  [CACHE] jumpscare '{cid}' already exists -> {out_mp4}")
            results.append({"id": cid, "mp4": out_mp4, "backend": "cache"})
            continue

        # Direct external Jumpscare clip import (`--import-jumpscare <file.mp4>`)
        if import_jumpscare:
            imp_abs = os.path.abspath(os.path.expanduser(import_jumpscare))
            if not os.path.isfile(imp_abs):
                raise FileNotFoundError(f"Imported jumpscare clip not found: {imp_abs}")
            imp_dur = max(0.7, min(4.2, raw_dur_s))
            normalize_jumpscare_mp4(imp_abs, out_mp4, imp_dur, width, height, fps=fps)
            print(f"  [JUMPSCARE IMPORT OK] {cid} ({imp_dur:.2f}s @ {width}x{height} {fps}fps) <- {imp_abs}")
            results.append({"id": cid, "mp4": out_mp4, "dur_s": imp_dur, "backend": "imported_jumpscare"})
            continue

        # Step 1: Obtain exact First-Frame Anchor PNG (`jumpscare_anchor_frame.png`)
        if anchor_override and os.path.isfile(anchor_override):
            shutil.copy2(anchor_override, anchor_png)
        elif comp_id and workspace_dir:
            capture_anchor_frame(workspace_dir, comp_id, anchor_f, anchor_png)
        elif not os.path.isfile(anchor_png):
            raise FileNotFoundError(
                f"Anchor frame PNG missing ({anchor_png}). Pass --comp <CompId> --workspace <dir> or --anchor-png <file.png>."
            )

        with open(anchor_png, "rb") as fp_a:
            anchor_bytes = fp_a.read()

        # Optional entity reference image & scareTier from `src/<project>/assets/cast/`
        ent_png_path = None
        ent_bytes = None
        ent_tier = 5
        ent_id = clip.get("entityId")
        bps = manifest.get("castBlueprints") or []
        ent_bp = next((b for b in bps if b.get("id") == ent_id), None) or next(
            (b for b in bps if b.get("role") in ("entity", "lurker", "silhouette")), None
        )
        if isinstance(ent_bp, dict):
            ent_tier = max(4, min(7, int(ent_bp.get("scareTier") or 5)))
            sa = ent_bp.get("spriteAssets") or {}
            cand_rel = sa.get("entity_scare") or sa.get("calm")
            if cand_rel:
                cand_abs = os.path.join(project_dir, cand_rel)
                if os.path.isfile(cand_abs):
                    ent_png_path = cand_abs
                    with open(cand_abs, "rb") as fp_e:
                        ent_bytes = fp_e.read()

        prompt = build_jumpscare_prompt(clip, manifest)
        used_backend = None
        final_dur_s = raw_dur_s

        # Backend 1 (Primary in `auto` when configured): Official `KlingAIResearch/LivePortrait` local GTX 960
        try_lp = eff_backend == "liveportrait" or (eff_backend == "auto" and resolved_lp_dir is not None)
        if try_lp:
            if not resolved_lp_dir:
                raise FileNotFoundError(
                    "LivePortrait directory not found (set --liveportrait-dir or LIVEPORTRAIT_DIR pointing to KlingAIResearch/LivePortrait)."
                )
            try:
                lp_dur = max(1.2, min(2.2, raw_dur_s))
                with tempfile.TemporaryDirectory(prefix="lp_js_") as td:
                    src_png = prepare_liveportrait_source_image(anchor_png, ent_png_path, os.path.join(td, "lp_source.png"))
                    drv_path = select_liveportrait_driving_motion(
                        scare_tier=ent_tier,
                        transition_style=t_style,
                        motions_dir=resolved_motions,
                        liveportrait_dir=resolved_lp_dir,
                    )
                    lp_out_dir = os.path.join(td, "lp_out")
                    raw_lp_mp4 = run_liveportrait_inference(
                        liveportrait_dir=resolved_lp_dir,
                        source_png=src_png,
                        driving_path=drv_path,
                        out_dir=lp_out_dir,
                        lp_python=liveportrait_python,
                        lp_fp32=lp_fp32,
                    )
                    postprocess_liveportrait_jumpscare(
                        raw_lp_mp4=raw_lp_mp4,
                        anchor_png_path=anchor_png,
                        out_mp4_path=out_mp4,
                        duration_sec=lp_dur,
                        width=width,
                        height=height,
                        fps=fps,
                        transition_style=t_style,
                        hard_cut_black=hard_cut_black,
                    )
                used_backend = f"liveportrait:{os.path.basename(drv_path)}"
                final_dur_s = lp_dur
            except Exception as exc:
                if eff_backend == "liveportrait" and not allow_local_fallback:
                    raise
                print(f"  [WARN] LivePortrait backend failed ({str(exc)[:220]}); falling back...")

        # Backend 2: Gemini Video API (only if LivePortrait didn't run/succeed and backend is `gemini` or `auto`)
        if used_backend is None and eff_backend in ("auto", "gemini") and key:
            gem_dur = max(1.8, min(4.2, raw_dur_s))
            with tempfile.TemporaryDirectory(prefix="js_vid_") as td:
                try:
                    raw_vid_bytes, used_m = call_gemini_video_api(
                        prompt, anchor_bytes, key, model=model, aspect_ratio=aspect, duration_sec=gem_dur, entity_ref_bytes=ent_bytes
                    )
                    raw_path = os.path.join(td, "raw_ai.mp4")
                    with open(raw_path, "wb") as fp_v:
                        fp_v.write(raw_vid_bytes)
                    normalize_jumpscare_mp4(raw_path, out_mp4, gem_dur, width, height, fps=fps)
                    used_backend = f"gemini_video:{used_m}"
                    final_dur_s = gem_dur
                except Exception as exc:
                    print(f"  [WARN] Gemini Video endpoint ({model}) unavailable ({str(exc)[:220]})")
                    if allow_local_fallback:
                        ai_kfs = _try_gemini_keyframe_morph(prompt, anchor_bytes, ent_bytes, key, aspect_ratio=aspect)
                        loc_dur = max(0.7, min(1.1, raw_dur_s))
                        render_local_first_frame_jumpscare(
                            anchor_png,
                            out_mp4,
                            duration_sec=loc_dur,
                            fps=fps,
                            width=width,
                            height=height,
                            transition_style=t_style,
                            entity_png_path=ent_png_path,
                            ai_keyframe_imgs=ai_kfs,
                        )
                        used_backend = "gemini_image_analog_hardcut" if ai_kfs else "local_analog_hardcut"
                        final_dur_s = loc_dur
                    else:
                        raise

        # Backend 3: Crisp 0.7-1.1s Analog Horror Hard-Cut Local Fallback
        if used_backend is None:
            if eff_backend == "gemini" and not allow_local_fallback:
                raise RuntimeError("GEMINI_API_KEY is not set for --backend gemini and --no-local-fallback was specified.")
            loc_dur = max(0.7, min(1.1, raw_dur_s))
            render_local_first_frame_jumpscare(
                anchor_png,
                out_mp4,
                duration_sec=loc_dur,
                fps=fps,
                width=width,
                height=height,
                transition_style=t_style,
                entity_png_path=ent_png_path,
            )
            used_backend = "local_analog_hardcut"
            final_dur_s = loc_dur

        print(f"  [JUMPSCARE OK] {cid} ({final_dur_s:.2f}s @ {width}x{height} {fps}fps | style={t_style} | backend={used_backend}) -> {out_mp4}")
        results.append({"id": cid, "mp4": out_mp4, "anchor": anchor_png, "dur_s": final_dur_s, "backend": used_backend})

    return results


def build_parser():
    ap = argparse.ArgumentParser(
        description="Horror Engine v15.4: Automated Jumpscare Generator (`KlingAIResearch/LivePortrait` + Gemini + Analog Horror Local)."
    )
    ap.add_argument("manifest", help="Path to src/<project>/manifest.json")
    ap.add_argument("--workspace", default=None, help="Remotion workspace directory (e.g. shorts-project) for anchor capture")
    ap.add_argument("--comp", default=None, help="Remotion CompositionId for capturing jumpscare_anchor_frame.png")
    ap.add_argument("--clip-id", default=None, help="Generate only a specific jumpscare clip id")
    ap.add_argument("--all", action="store_true", help="Generate all jumpscareClips[] declared in manifest.json")
    ap.add_argument("--anchor-png", default=None, help="Optional pre-captured jumpscare_anchor_frame.png path")
    ap.add_argument(
        "--backend",
        default="auto",
        choices=list(VALID_BACKENDS),
        help="Jumpscare video backend (default: auto -> liveportrait if LIVEPORTRAIT_DIR set -> gemini -> local Analog Horror)",
    )
    ap.add_argument("--liveportrait-dir", default=None, help="Path to official KlingAIResearch/LivePortrait checkout (default: env LIVEPORTRAIT_DIR)")
    ap.add_argument("--liveportrait-python", default=None, help="Python executable inside LivePortrait's CUDA 11.8 venv/conda env (default: env LIVEPORTRAIT_PYTHON)")
    ap.add_argument("--motions-dir", default=None, help="Folder of horror driving motions (.pkl/.mp4), default: assets/liveportrait_motions/")
    ap.add_argument("--lp-fp32", action="store_true", help="Pass --no_flag_use_half_precision to LivePortrait for Maxwell GTX 960 FP32 safety")
    ap.add_argument("--import-jumpscare", default=None, help="Directly import & normalize an external Jumpscare .mp4 clip")
    ap.add_argument("--no-hard-cut-black", action="store_true", help="Disable final 0.14s hard cut to black on LivePortrait post-FX")
    ap.add_argument("--api-key", default=None, help="Optional GEMINI_API_KEY override")
    ap.add_argument("--model", default="gemini-omni-1.2-flash", help="Gemini video model (gemini-omni-1.2-flash or veo-*)")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--fallback-local", action="store_true", help="Alias for --backend local (0.7-1.1s Analog Horror Hard-Cut)")
    ap.add_argument("--no-local-fallback", action="store_true", help="Fail strictly if primary backend errors")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    generate_jumpscare_clips(
        args.manifest,
        workspace_dir=args.workspace,
        comp_id=args.comp,
        clip_id=None if args.all else args.clip_id,
        api_key=args.api_key,
        model=args.model,
        overwrite=args.overwrite,
        fallback_local=args.fallback_local,
        allow_local_fallback=not args.no_local_fallback,
        anchor_override=args.anchor_png,
        backend=args.backend,
        liveportrait_dir=args.liveportrait_dir,
        liveportrait_python=args.liveportrait_python,
        motions_dir=args.motions_dir,
        lp_fp32=args.lp_fp32,
        import_jumpscare=args.import_jumpscare,
        hard_cut_black=not args.no_hard_cut_black,
    )


if __name__ == "__main__":
    main()
