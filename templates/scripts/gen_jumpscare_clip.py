#!/usr/bin/env python3
"""Horror Engine v15.0: Automated First-Frame-Conditioned AI Video Jumpscare Generator (GEMINI_API_KEY).

Generates seamless 2-4s AI Video Jumpscare clips (`src/<project>/assets/jumpscare_<id>.mp4`) locked 100%
to the final 3D room frame immediately preceding the scare:
  1. Captures clean pre-VHS, HUD-free 3D anchor frame (`jumpscare_anchor_frame.png`) at `anchorFrame = clip.a - 1`
     via `node scripts/render-stills.mjs <CompId> ... --raw-anchor --png`.
  2. Calls Gemini Video API using `GEMINI_API_KEY` with **First-Frame Conditioning** (`jumpscare_anchor_frame.png`)
     + optional story entity reference image (`src/<project>/assets/cast/<entity>_entity_scare.png`) and
     story-driven `transitionStyle` prompt (`first_frame_seamless`, `whip_pan_turn`, `diegetic_reveal`, `silence_hard_cut`).
     Supports both Gemini Interactions API (`gemini-omni-1.2-flash` at `/v1beta/interactions`) and Veo
     (`:predictLongRunning`), plus an automatic high-impact 2.5D local compositor fallback (`--allow-local-fallback`
     or `--fallback-local`) when offline or if video generation quota/endpoint is unavailable.
  3. Trims & normalizes output cleanly via `ffmpeg` to exact `(clip.b - clip.a) / 30` seconds, 30 fps, H.264 `yuv420p`,
     muted (`-an` so `mix_cues.py` owns mastered `-1.0 dBTP` audio), saved to `src/<project>/assets/jumpscare_<id>.mp4`.

Usage:
  python3 scripts/gen_jumpscare_clip.py src/<project>/manifest.json \
    --comp <CompositionId> --all --workspace shorts-project
"""

import argparse
import base64
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
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
            # Direct base64 video payload
            mime = str(cur.get("mimeType") or cur.get("mime_type") or cur.get("type") or "").lower()
            b64 = cur.get("bytesBase64Encoded") or cur.get("data")
            if isinstance(b64, str) and len(b64) > 2000 and ("video" in mime or "mp4" in mime):
                return base64.b64decode(b64)
            # Downloadable URI
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

    # Default: Gemini Omni Flash via Interactions API (`/v1beta/interactions`)
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

    # Poll asynchronous interaction if still running
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
    """When pure video endpoint is unavailable on key, generate 2 photorealistic First-Frame-locked horror lunge climax frames
    via `gemini-2.5-flash-image` anchored directly on `jumpscare_anchor_frame.png` + entity cutout!"""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    stages = [
        (
            "Keep the EXACT SAME dark room architecture, camera lens, lighting color, and background from the first image, "
            "EXCEPT the horror entity from the second image has abruptly lurched halfway forward toward the camera in harsh "
            "chiaroscuro shadow, staring directly into the lens with unsettling uncanny realism. ZERO text, NO cartoon."
        ),
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
    return out_imgs if len(out_imgs) == 2 else None


def render_local_first_frame_jumpscare(
    anchor_png_path: str,
    out_mp4_path: str,
    duration_sec: float = 2.8,
    fps: int = 30,
    width: int = 1080,
    height: int = 1920,
    transition_style: str = "first_frame_seamless",
    entity_png_path: str | None = None,
    ai_keyframe_imgs: list[Image.Image] | None = None,
) -> str:
    """Synthesize a First-Frame-seamless 30fps Jumpscare MP4 locked to `anchor_png_path` at frame 0.
    Uses AI-generated climax keyframes (when available via Gemini Image API) or normal-lit entity cutout lunge
    so frame 0 matches the 3D scene 100% with zero cut seam and explosive kinetic impact!"""
    resample_lanczos = getattr(Image, "Resampling", Image).LANCZOS
    resample_bilinear = getattr(Image, "Resampling", Image).BILINEAR
    base_img = Image.open(anchor_png_path).convert("RGB").resize((width, height), resample_lanczos)
    ent_rgba = Image.open(entity_png_path).convert("RGBA") if (entity_png_path and os.path.isfile(entity_png_path)) else None

    kf_mid = ai_keyframe_imgs[0].resize((width, height), resample_lanczos) if (ai_keyframe_imgs and len(ai_keyframe_imgs) >= 1) else None
    kf_peak = ai_keyframe_imgs[1].resize((width, height), resample_lanczos) if (ai_keyframe_imgs and len(ai_keyframe_imgs) >= 2) else None

    # Pre-match lighting luminance/color temperature of AI keyframes to anchor frame for zero tonal jump
    base_np = np.asarray(base_img, dtype=np.float32)
    base_mean = np.maximum(12.0, base_np.mean(axis=(0, 1)))
    if kf_mid is not None:
        m_np = np.asarray(kf_mid, dtype=np.float32)
        m_mean = np.maximum(12.0, m_np.mean(axis=(0, 1)))
        kf_mid = Image.fromarray(np.clip(m_np * np.clip(base_mean / m_mean, 0.72, 1.35), 0, 255).astype(np.uint8))
    if kf_peak is not None:
        p_np = np.asarray(kf_peak, dtype=np.float32)
        p_mean = np.maximum(12.0, p_np.mean(axis=(0, 1)))
        kf_peak = Image.fromarray(np.clip(p_np * np.clip(base_mean / p_mean, 0.72, 1.35), 0, 255).astype(np.uint8))

    n_frames = max(18, int(round(duration_sec * fps)))
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
            u = i / float(max(1, n_frames - 1))
            if i == 0:
                # Frame 0 MUST match `jumpscare_anchor_frame.png` identically (First-Frame Lock!)
                frame_img = base_img.copy()
            else:
                # Nonlinear horror lunge curve: brief 3-frame tension hold -> explosive 7-frame rush -> trembling close-up hold
                if transition_style == "silence_hard_cut":
                    lunge = min(1.0, (i / 4.0) ** 0.65)
                elif transition_style == "diegetic_reveal":
                    lunge = 0.0 if i < 3 else min(1.0, ((i - 2) / 6.0) ** 0.75)
                else:
                    lunge = min(1.0, (max(0, i - 2) / 8.0) ** 0.72)

                # Choose base layer (smoothly morphing anchor -> AI mid -> AI peak when AI keyframes exist!)
                if kf_mid is not None and kf_peak is not None:
                    if lunge < 0.45:
                        k = lunge / 0.45
                        frame_img = Image.blend(base_img, kf_mid, k)
                    else:
                        k = min(1.0, (lunge - 0.45) / 0.55)
                        frame_img = Image.blend(kf_mid, kf_peak, k)
                else:
                    frame_img = base_img.copy()
                    # Composite photorealistic entity cutout lunging straight into the camera lens!
                    if ent_rgba is not None:
                        e_scale = 0.42 + 0.92 * lunge
                        eh = max(64, int(round(height * e_scale)))
                        ew = max(48, int(round(eh * (ent_rgba.width / float(max(1, ent_rgba.height))))))
                        e_res = ent_rgba.resize((ew, eh), resample_lanczos)
                        # Subtle chiaroscuro darkening matched to room ambience
                        e_rgb = ImageEnhance.Brightness(e_res.convert("RGB")).enhance(0.68 + 0.25 * lunge)
                        e_res = Image.merge("RGBA", (*e_rgb.split(), e_res.split()[3]))
                        # Center entity face toward upper-mid lens as it rushes forward
                        ex = (width - ew) // 2 + int(round(math.sin(i * 2.3) * 14 * lunge))
                        ey = int(round(height * (0.34 - 0.28 * lunge)))
                        frame_img.paste(e_res, (ex, ey), e_res)

                # Camera zoom-punch + panicked handheld shake + diegetic flicker pulse
                zoom = 1.0 + 0.24 * lunge + 0.03 * math.sin(i * 1.9) * lunge
                shake_x = int(round(rng.uniform(-22, 22) * (0.25 + 0.75 * lunge) * math.exp(-max(0, i - 6) / 28.0)))
                shake_y = int(round(rng.uniform(-26, 26) * (0.25 + 0.75 * lunge) * math.exp(-max(0, i - 6) / 28.0)))
                cw = max(64, int(round(width / zoom)))
                ch = max(64, int(round(height / zoom)))
                cx = max(0, min(width - cw, (width - cw) // 2 + shake_x))
                cy = max(0, min(height - ch, (height - ch) // 2 + shake_y))
                frame_img = frame_img.crop((cx, cy, cx + cw, cy + ch)).resize((width, height), resample_bilinear)

                if transition_style == "diegetic_reveal" and i in (2, 3):
                    frame_img = ImageEnhance.Brightness(frame_img).enhance(0.18)
                elif i in (4, 5, 6):
                    frame_img = ImageEnhance.Contrast(frame_img).enhance(1.18)
                if lunge > 0.3 and i < 12:
                    frame_img = frame_img.filter(ImageFilter.GaussianBlur(radius=0.8 * (1.0 - min(1.0, (i - 3) / 9.0))))

            proc.stdin.write(frame_img.tobytes())
    finally:
        proc.stdin.close()
        rc = proc.wait()
        if rc != 0:
            raise RuntimeError(f"ffmpeg local jumpscare encode failed with exit code {rc}")
    return out_mp4_path


def normalize_jumpscare_mp4(raw_video_path: str, out_mp4_path: str, duration_sec: float, width: int, height: int, fps: int = 30) -> str:
    """Trim & normalize AI-generated jumpscare video to exact duration, 30fps, composition aspect, muted H.264."""
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
) -> list[dict]:
    with open(manifest_path, encoding="utf-8") as fp:
        manifest = json.load(fp)

    clips = manifest.get("jumpscareClips") or []
    if not clips:
        raise ValueError(f"Manifest '{manifest_path}' has no `jumpscareClips[]` declared")

    targets = [c for c in clips if not clip_id or c.get("id") == clip_id]
    if not targets:
        raise ValueError(f"No jumpscare clip found matching --clip-id={clip_id!r}")

    aspect = str(manifest.get("aspect") or "9:16")
    width, height = (1920, 1080) if aspect == "16:9" else (1080, 1920)
    fps = 30
    project_dir = os.path.dirname(os.path.abspath(manifest_path))
    assets_dir = os.path.join(project_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    key = None if fallback_local else load_api_key(api_key)

    results = []
    for clip in targets:
        cid = str(clip.get("id") or "js1")
        a_f = int(clip["a"])
        b_f = int(clip["b"])
        dur_s = max(1.8, min(4.2, (b_f - a_f) / float(fps)))
        anchor_f = int(clip.get("anchorFrame") if clip.get("anchorFrame") is not None else max(0, a_f - 1))
        out_mp4 = os.path.join(assets_dir, f"jumpscare_{cid}.mp4")
        anchor_png = os.path.join(assets_dir, f"jumpscare_anchor_{cid}.png")

        if os.path.isfile(out_mp4) and not overwrite:
            print(f"  [CACHE] jumpscare '{cid}' already exists -> {out_mp4}")
            results.append({"id": cid, "mp4": out_mp4, "backend": "cache"})
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

        # Optional entity reference image from `src/<project>/assets/cast/`
        ent_png_path = None
        ent_bytes = None
        ent_id = clip.get("entityId")
        bps = manifest.get("castBlueprints") or []
        ent_bp = next((b for b in bps if b.get("id") == ent_id), None) or next(
            (b for b in bps if b.get("role") in ("entity", "lurker", "silhouette")), None
        )
        if isinstance(ent_bp, dict):
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
        api_err = None

        # Step 2: Generate First-Frame-Conditioned AI Video via GEMINI_API_KEY
        if not fallback_local and key:
            with tempfile.TemporaryDirectory(prefix="js_vid_") as td:
                try:
                    raw_vid_bytes, used_m = call_gemini_video_api(
                        prompt, anchor_bytes, key, model=model, aspect_ratio=aspect, duration_sec=dur_s, entity_ref_bytes=ent_bytes
                    )
                    raw_path = os.path.join(td, "raw_ai.mp4")
                    with open(raw_path, "wb") as fp_v:
                        fp_v.write(raw_vid_bytes)
                    normalize_jumpscare_mp4(raw_path, out_mp4, dur_s, width, height, fps=fps)
                    used_backend = f"gemini_video:{used_m}"
                except Exception as exc:
                    api_err = str(exc)
                    print(f"  [WARN] Gemini Video endpoint ({model}) unavailable ({api_err[:220]})")
                    if allow_local_fallback:
                        print("  [INFO] Trying Gemini Image First-Frame Keyframe Morph -> 30fps First-Frame-Locked MP4...")
                        ai_kfs = _try_gemini_keyframe_morph(prompt, anchor_bytes, ent_bytes, key, aspect_ratio=aspect)
                        render_local_first_frame_jumpscare(
                            anchor_png,
                            out_mp4,
                            duration_sec=dur_s,
                            fps=fps,
                            width=width,
                            height=height,
                            transition_style=str(clip.get("transitionStyle") or "first_frame_seamless"),
                            entity_png_path=ent_png_path,
                            ai_keyframe_imgs=ai_kfs,
                        )
                        used_backend = "gemini_image_firstframe_morph" if ai_kfs else "local_25d_firstframe_lunge"
                    else:
                        raise
        else:
            render_local_first_frame_jumpscare(
                anchor_png,
                out_mp4,
                duration_sec=dur_s,
                fps=fps,
                width=width,
                height=height,
                transition_style=str(clip.get("transitionStyle") or "first_frame_seamless"),
                entity_png_path=ent_png_path,
            )
            used_backend = "local_25d_firstframe_lunge"

        print(f"  [JUMPSCARE OK] {cid} ({dur_s:.2f}s @ {width}x{height} {fps}fps | style={clip.get('transitionStyle')} | backend={used_backend}) -> {out_mp4}")
        results.append({"id": cid, "mp4": out_mp4, "anchor": anchor_png, "dur_s": dur_s, "backend": used_backend})

    return results


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v15.0: First-Frame-Conditioned AI Video Jumpscare Generator.")
    ap.add_argument("manifest", help="Path to src/<project>/manifest.json")
    ap.add_argument("--workspace", default=None, help="Remotion workspace directory (e.g. shorts-project) for anchor capture")
    ap.add_argument("--comp", default=None, help="Remotion CompositionId for capturing jumpscare_anchor_frame.png")
    ap.add_argument("--clip-id", default=None, help="Generate only a specific jumpscare clip id")
    ap.add_argument("--all", action="store_true", help="Generate all jumpscareClips[] declared in manifest.json")
    ap.add_argument("--anchor-png", default=None, help="Optional pre-captured jumpscare_anchor_frame.png path")
    ap.add_argument("--api-key", default=None, help="Optional GEMINI_API_KEY override")
    ap.add_argument("--model", default="gemini-omni-1.2-flash", help="Video model (gemini-omni-1.2-flash or veo-*)")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--fallback-local", action="store_true", help="Skip remote video API and synthesize First-Frame 2.5D lunge MP4 locally")
    ap.add_argument("--no-local-fallback", action="store_true", help="Fail strictly if remote video API errors")
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
    )


if __name__ == "__main__":
    main()
