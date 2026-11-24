#!/usr/bin/env python3
"""Horror Engine v7.1: Declarative `cues.json` Horror Audio Mixer + Multi-Style Jumpscare Engine + 7 Anti-Clutter QA Gates.

Combines Openverse/CC0 real Foley assets with sparse, story-driven horror mixing & psychoacoustic
3-band Jumpscare design inspired by `openverse-sfx` & `claude-add-sound-skill`, specialized for Vietnamese horror:
  1. MAX_BEDS_EXCEEDED     : Enforce <= 1 ambience bed (story-setting-driven, NEVER stack 3-4 beds!)
  2. SFX_SPARSITY_WARN     : Warn if spot SFX density exceeds calibrated horror budget (> max(12, dur/3.8))
  3. SFX_CROWDING_WARN     : Warn if >= 2 SFX land within 0.60s (unless `allow_layer: true`) or >= 3 in 1.50s
  4. WHISPER_INTRUSION_WARN: Warn if any spot SFX intrudes on a `mood == "whisper"` span (unless `allow_in_whisper: true`)
  5. JUMPSCARE_FATIGUE_WARN: Enforce <= 2 Jumpscares per 45-60s video (`max_jumpscares`) so viewers never go numb
  6. DEAD_SILENCE_VACUUM   : Carve TRUE -48 dB vacuum across every `[DEAD SILENCE]` and verify >= 38 dB drop
  7. LOUDNESS_AND_CLIPS    : Verify -15.0 LUFS, <= -1.2 dBTP, 0 clips, measure Jumpscare contrast & 1.4-6.5kHz bite, write `mix_report.md` & `credits.txt`

Usage:
  python3 scripts/mix_cues.py --cues out/<project>/cues.json --out out/<project>/mix.wav --strict
"""

import argparse
import json
import math
import os
import sys

import numpy as np
from scipy import signal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "audio"))
for p in (SCRIPT_DIR, AUDIO_DIR):
    if p not in sys.path:
        sys.path.insert(0, p)

import sfx_manager as sm  # noqa: E402
from dsp import SR, ns, st, rng, place, make_ir, convolve_st, dbg, pan, fades, write_wav  # noqa: E402
from horror_instruments import (  # noqa: E402
    sub_drone,
    reverse_suck,
    stinger,
    riser,
    tinnitus_ring,
    vhs_static_burst,
    neck_crack_wet,
    entity_rattle,
    bowed_metal,
)
from mix_base import (  # noqa: E402
    load_voice,
    load_words,
    load_dead_silences,
    load_sfx_asset,
    speech_spans,
    duck_db,
    master_mix,
    write_mix_and_stems,
    ffmpeg_ebur,
)

# Story-driven multi-style Jumpscare presets: every style layers <10ms synchronized
# Sub Chest-Punch (35-190 Hz) + High-Mid Startle Bite (1.4-6.5 kHz) with graceful fallback.
JUMPSCARE_STYLES = {
    "cinema_stab": {
        "sub_candidates": ["jumpscare_classic_sfx_ov", "cinematic_boom"],
        "bite_candidates": ["jumpscare_string_stab_ov", "jumpscare_shock_stab_ov"],
        "synth_bite": "shriek",
        "bite_hp_hz": 280.0,
        "sub_lp_hz": 185.0,
        "synth_edge_db": -5.5,
        "default_dur": 2.4,
    },
    "entity_shriek": {
        "sub_candidates": ["jumpscare_classic_sfx_ov", "cinematic_boom"],
        "bite_candidates": ["jumpscare_scream_ov", "jumpscare_entity_shriek_ov"],
        "synth_bite": "entity_shriek",
        "bite_hp_hz": 320.0,
        "sub_lp_hz": 190.0,
        "synth_edge_db": -6.5,
        "default_dur": 2.3,
    },
    "metal_dread": {
        "sub_candidates": ["cinematic_boom", "jumpscare_classic_sfx_ov"],
        "bite_candidates": ["jumpscare_metal_screech_ov", "jumpscare_shock_stab_ov"],
        "synth_bite": "braam",
        "bite_hp_hz": 300.0,
        "sub_lp_hz": 180.0,
        "synth_edge_db": -5.0,
        "default_dur": 2.5,
    },
    "vhs_psx_glitch": {
        "sub_candidates": ["jumpscare_classic_sfx_ov", "cinematic_boom"],
        "bite_candidates": ["jumpscare_scream_ov", "jumpscare_metal_screech_ov"],
        "synth_bite": "vhs_shriek",
        "bite_hp_hz": 420.0,
        "sub_lp_hz": 200.0,
        "synth_edge_db": -3.5,
        "default_dur": 1.9,
    },
}


def rms_db(arr: np.ndarray) -> float:
    return float(20.0 * np.log10(max(float(np.sqrt(np.mean(np.square(arr)) + 1e-18)), 1e-9)))


def _resolve_path(base_dir: str, p: str | None) -> str | None:
    if not p:
        return None
    if os.path.isabs(p):
        return p
    cand = os.path.abspath(os.path.join(base_dir, p))
    return cand if os.path.exists(cand) else os.path.abspath(p)


def _apply_dialog_safe_eq(x: np.ndarray, hp_hz: float | None = None, lp_hz: float | None = None, voice_notch_db: float = 0.0) -> np.ndarray:
    """Clean zero-distortion spectral carving so beds & SFX never fight the narrator's vocal band (450-3000 Hz)."""
    y = x.astype(np.float64, copy=True)
    nyq = 0.5 * SR
    if hp_hz and 15.0 < float(hp_hz) < nyq * 0.9:
        sos = signal.butter(2, float(hp_hz) / nyq, btype="highpass", output="sos")
        y = signal.sosfilt(sos, y, axis=-1)
    if lp_hz and 80.0 < float(lp_hz) < nyq * 0.95:
        sos = signal.butter(2, float(lp_hz) / nyq, btype="lowpass", output="sos")
        y = signal.sosfilt(sos, y, axis=-1)
    if voice_notch_db and float(voice_notch_db) < -0.5:
        # Smooth biquad peaking dip centered at 1350 Hz (Q=0.85) carving vocal presence band
        A = 10.0 ** (float(voice_notch_db) / 40.0)
        w0 = 2.0 * math.pi * 1350.0 / SR
        alpha = math.sin(w0) / (2.0 * 0.85)
        b = np.array([1.0 + alpha * A, -2.0 * math.cos(w0), 1.0 - alpha * A], dtype=np.float64)
        a = np.array([1.0 + alpha / A, -2.0 * math.cos(w0), 1.0 - alpha / A], dtype=np.float64)
        y = signal.lfilter(b, a, y, axis=-1)
    return y


def _resolve_event_anchor_time(ev: dict, wdata: dict, dur: float) -> float:
    """Resolve event anchor time from `at`, `at_act`, `at_word`, or `at_dead_silence`."""
    offset = float(ev.get("offset_s", 0.0))
    if "at" in ev and ev["at"] is not None:
        return max(0.0, min(dur, float(ev["at"]) + offset))

    if "at_dead_silence" in ev and ev["at_dead_silence"] is not None:
        ds_list = wdata.get("dead_silences") or []
        idx = int(ev["at_dead_silence"])
        if 0 <= idx < len(ds_list):
            edge = str(ev.get("edge", "end")).lower()
            base = float(ds_list[idx]["s"] if edge == "start" else ds_list[idx]["e"])
            return max(0.0, min(dur, base + offset))
        raise ValueError(f"at_dead_silence={idx} out of range (found {len(ds_list)})")

    if "at_act" in ev and ev["at_act"] is not None:
        sents = wdata.get("sentences") or []
        act_no = int(ev["at_act"])
        match = next((s for s in sents if int(s.get("sent", -1)) == act_no), None)
        if match is None and 1 <= act_no <= len(sents):
            match = sents[act_no - 1]
        if match is None:
            raise ValueError(f"at_act={act_no} not found in words.json sentences")
        edge = str(ev.get("edge", "start")).lower()
        base = float(match["e"] if edge == "end" else match["s"])
        return max(0.0, min(dur, base + offset))

    if "at_word" in ev and ev["at_word"]:
        needle = str(ev["at_word"]).strip().lower()
        words = wdata.get("words") or []
        occ = int(ev.get("occurrence", 1))
        found = 0
        for w in words:
            tok = str(w.get("w") or w.get("word") or "").strip().lower()
            if needle in tok:
                found += 1
                if found == occ:
                    edge = str(ev.get("edge", "start")).lower()
                    base = float(w.get("e" if edge == "end" else "s", 0.0))
                    return max(0.0, min(dur, base + offset))
        raise ValueError(f"at_word={needle!r} (occurrence={occ}) not found in words.json")

    raise ValueError(f"Event missing time anchor (`at`, `at_act`, `at_word`, or `at_dead_silence`): {ev}")


def _get_asset_envelope(slug_or_path: str, lib_dir: str, mf_assets: dict) -> dict:
    slug = sm.safe_slug(os.path.splitext(os.path.basename(slug_or_path))[0])
    info = mf_assets.get(slug) or {}
    if "onset_s" in info and "peak_s" in info and "tail_end_s" in info:
        return info
    cand = slug_or_path if os.path.isfile(slug_or_path) else os.path.join(lib_dir, f"{slug}.wav")
    if os.path.isfile(cand):
        return sm.analyze_sfx_envelope(cand)
    return {"onset_s": 0.0, "peak_s": 0.0, "tail_end_s": 0.5, "dur_s": 0.5}


def _resolve_whisper_spans(wdata: dict) -> list[tuple[float, float]]:
    spans = []
    for sb in wdata.get("sentences") or []:
        if str(sb.get("mood") or "").lower() == "whisper":
            spans.append((float(sb["s"]), float(sb["e"])))
    return spans


def audit_cues(cfg: dict, resolved_events: list[dict], wdata: dict, dur: float) -> list[dict]:
    """Run the 4 pre-mix Horror Anti-Clutter QA Gates (MAX_BEDS, SPARSITY, CROWDING, WHISPER_INTRUSION)."""
    warnings = []
    beds = cfg.get("beds") or []
    max_beds = int(cfg.get("max_beds", 1))
    if len(beds) > max_beds:
        warnings.append({
            "code": "MAX_BEDS_EXCEEDED",
            "severity": "ERROR",
            "detail": f"Found {len(beds)} continuous beds (max allowed: {max_beds}). Never stack multiple rain/wind/room beds simultaneously!",
        })

    sfx_only = [e for e in resolved_events if e.get("bus", "sfx") == "sfx"]
    max_sparse = max(12, int(math.ceil(dur / 3.8)))
    if len(sfx_only) > max_sparse:
        warnings.append({
            "code": "SFX_SPARSITY_WARN",
            "severity": "WARN",
            "detail": f"Found {len(sfx_only)} spot SFX in {dur:.1f}s (sparse horror budget <= {max_sparse}). Trim non-essential cues!",
        })

    ordered = sorted(resolved_events, key=lambda e: e["target_t"])
    for i in range(len(ordered)):
        a = ordered[i]
        # Pairwise crowding within 0.60s
        if i + 1 < len(ordered):
            b = ordered[i + 1]
            dt = b["target_t"] - a["target_t"]
            if dt < 0.60 and not (a.get("allow_layer") or b.get("allow_layer")):
                warnings.append({
                    "code": "SFX_CROWDING_WARN",
                    "severity": "ERROR",
                    "detail": f"'{a['label']}' ({a['target_t']:.2f}s) and '{b['label']}' ({b['target_t']:.2f}s) collide within {dt:.2f}s (< 0.60s). Set `allow_layer: true` only for intentional cross-band pairs!",
                })
        # Cluster crowding: >= 3 events in 1.50s
        cluster = [e for e in ordered if a["target_t"] <= e["target_t"] <= a["target_t"] + 1.50]
        if len(cluster) >= 3:
            warnings.append({
                "code": "SFX_CROWDING_WARN",
                "severity": "ERROR",
                "detail": f"{len(cluster)} events stacked inside 1.50s window starting at {a['target_t']:.2f}s — turns to mush!",
            })
            break

    whisper_spans = _resolve_whisper_spans(wdata)
    for ev in resolved_events:
        if ev.get("allow_in_whisper"):
            continue
        t = ev["target_t"]
        for ws, we in whisper_spans:
            if (ws - 0.05) <= t <= (we + 0.05):
                warnings.append({
                    "code": "WHISPER_INTRUSION_WARN",
                    "severity": "ERROR",
                    "detail": f"Event '{ev['label']}' at {t:.2f}s intrudes into quiet WHISPER act [{ws:.2f}s..{we:.2f}s]!",
                })

    js_events = [e for e in resolved_events if e.get("jumpscare") or e.get("is_jumpscare")]
    default_max_js = 2 if dur <= 95.0 else max(2, int(round((dur / 60.0) * 0.8)))
    max_js = int(cfg.get("max_jumpscares", default_max_js))
    if len(js_events) > max_js:
        warnings.append({
            "code": "JUMPSCARE_FATIGUE_WARN",
            "severity": "ERROR",
            "detail": f"Found {len(js_events)} jumpscares (max recommended: {max_js} for {dur:.0f}s audio). Too many jumpscares desensitize the viewer!",
        })
    return warnings


def _trim_to_onset(arr: np.ndarray, onset_s: float, pre_s: float = 0.006, max_dur_s: float | None = None) -> np.ndarray:
    """Trim leading silence right up to `onset_s` so stacked jumpscare bands strike on the exact same <10 ms transient."""
    k0 = max(0, ns(max(0.0, onset_s - pre_s)))
    out = arr[:, k0:] if k0 < arr.shape[1] - 64 else arr.copy()
    if max_dur_s is not None and out.shape[1] > ns(max_dur_s):
        out = out[:, : ns(max_dur_s)]
    return fades(out, 0.004, min(0.08, max(0.015, out.shape[1] / SR * 0.12)))


def _fit_add(dst: np.ndarray, src: np.ndarray, gain: float = 1.0) -> np.ndarray:
    s2 = st(src)
    n = min(dst.shape[1], s2.shape[1])
    dst[:, :n] += s2[:, :n] * gain
    return dst


def _build_jumpscare_composite(ev: dict, lib_dir: str, mf_assets: dict, r, record_usage_fn) -> tuple[np.ndarray, np.ndarray | None]:
    """Build a synchronized 3-band psychoacoustic Jumpscare (Sub Chest-Punch + 1.4-6.5 kHz Startle Bite + optional Aftershock)."""
    style = str(ev.get("jumpscare", "cinema_stab")).strip().lower()
    if style not in JUMPSCARE_STYLES:
        raise ValueError(f"Unknown jumpscare style {style!r}; valid: {sorted(JUMPSCARE_STYLES)}")
    spec = JUMPSCARE_STYLES[style]
    dur_s = float(ev.get("dur_s", spec["default_dur"]))
    out = np.zeros((2, ns(dur_s)), dtype=np.float64)

    def _load_trimmed_first(candidates: list[str], target_pk_db: float, hp_hz=None, lp_hz=None) -> bool:
        for slug in candidates:
            if not slug:
                continue
            raw = load_sfx_asset(slug, library_dir=lib_dir, gain_db=0.0, loop=False, fade_in=0.002, fade_out=0.04)
            if raw is None:
                continue
            env = _get_asset_envelope(slug, lib_dir, mf_assets)
            seg = _trim_to_onset(raw, float(env.get("onset_s", 0.0)), pre_s=0.006, max_dur_s=dur_s)
            seg = _apply_dialog_safe_eq(seg, hp_hz=hp_hz, lp_hz=lp_hz)
            pk = float(np.max(np.abs(seg)))
            if pk > 1e-7:
                seg = seg * (dbg(target_pk_db) / pk)
                _fit_add(out, seg, 1.0)
                record_usage_fn(slug)
                return True
        return False

    # 1. Sub Chest-Punch (35-190 Hz): exact <10ms strike
    sub_cands = [ev["sub_sound"]] + spec["sub_candidates"] if ev.get("sub_sound") else spec["sub_candidates"]
    if not _load_trimmed_first(sub_cands, target_pk_db=-2.0, lp_hz=spec["sub_lp_hz"]):
        sub_syn = _apply_dialog_safe_eq(stinger("boom", vel=0.95, r=r, dur=min(dur_s, 2.2), f0=46.0), lp_hz=spec["sub_lp_hz"])
        _fit_add(out, sub_syn, dbg(-2.0) / max(float(np.max(np.abs(sub_syn))), 1e-7))

    # 2. High-Mid Startle Bite (1.4-6.5 kHz — triggers acoustic startle reflex!)
    bite_cands = [ev["sound"]] + spec["bite_candidates"] if ev.get("sound") else spec["bite_candidates"]
    got_real_bite = _load_trimmed_first(bite_cands, target_pk_db=-1.5, hp_hz=spec["bite_hp_hz"])
    edge_db = float(ev.get("edge_db", spec["synth_edge_db"] if got_real_bite else -1.5))

    # Style-specific psychoacoustic razor edge (<10ms dissonant screech / VHS tape tear / metallic slam)
    sb = spec["synth_bite"]
    if sb == "shriek":
        edge = _apply_dialog_safe_eq(stinger("shriek", vel=0.95, r=r, dur=min(dur_s, 1.5)), hp_hz=1200.0)
    elif sb == "entity_shriek":
        edge = _apply_dialog_safe_eq(entity_rattle(dur=min(dur_s, 1.6), vel=0.92, r=r, kind="shriek_gasp"), hp_hz=550.0)
        edge = _fit_add(edge.copy(), _apply_dialog_safe_eq(stinger("shriek", vel=0.8, r=r, dur=min(dur_s, 1.2)), hp_hz=1600.0), 0.55)
    elif sb == "braam":
        edge = _apply_dialog_safe_eq(stinger("braam", vel=0.92, r=r, dur=min(dur_s, 1.8), f0=73.4), hp_hz=260.0)
        edge = _fit_add(edge.copy(), pan(bowed_metal(f=620.0, dur=min(dur_s, 1.4), vel=0.75, r=r, att=0.015), 0.2), 0.65)
    else:  # vhs_psx_glitch
        vhs = vhs_static_burst(dur=min(dur_s, 0.55), vel=0.95, r=r)
        shr = _apply_dialog_safe_eq(stinger("shriek", vel=0.9, r=r, dur=min(dur_s, 1.15)), hp_hz=1350.0)
        edge = np.zeros((2, max(vhs.shape[1], shr.shape[1])), dtype=np.float64)
        _fit_add(edge, vhs, 1.0)
        _fit_add(edge, shr, 0.72)
        edge = np.tanh(edge * 1.65)

    epk = float(np.max(np.abs(edge)))
    if epk > 1e-7:
        _fit_add(out, edge * (dbg(edge_db) / epk), 1.0)

    # Optional visceral bone/neck crack transient accent
    if ev.get("body_crack"):
        crk = neck_crack_wet(dur=0.45, vel=0.9, r=r)
        _fit_add(out, crk, dbg(-4.0) / max(float(np.max(np.abs(crk))), 1e-7))

    # Optional fragile post-shock ear-ringing aftershock
    tinn = None
    if ev.get("tinnitus"):
        t_dur = float(ev.get("tinnitus_dur_s", 2.8))
        tinn = tinnitus_ring(dur=t_dur, vel=0.8, f=float(ev.get("tinnitus_hz", 4060.0)), r=r)
        trms = float(np.sqrt(np.mean(np.square(tinn)) + 1e-18))
        if trms > 1e-7:
            tinn = tinn * (dbg(float(ev.get("tinnitus_rms_dbfs", -27.5))) / trms)

    return fades(out, 0.002, 0.08), tinn


def _apply_micro_vacuums(buffers: list[np.ndarray], vacuums: list[tuple[float, float]], floor_db: float = -36.0):
    """Carve brief pre-jumpscare micro-silence drops on ambience/score so ears dilate right before impact."""
    if not vacuums:
        return
    n = buffers[0].shape[1]
    env = np.ones(n, dtype=np.float64)
    floor_lin = dbg(floor_db)
    for t_start, t_end in vacuums:
        a = max(0, min(n, ns(t_start)))
        b = max(a, min(n, ns(t_end)))
        if b - a < 32:
            continue
        fa = min(ns(0.020), max(1, (b - a) // 4))
        fb = min(ns(0.004), max(1, (b - a) // 8))
        env[a : a + fa] = np.minimum(env[a : a + fa], floor_lin + (1.0 - floor_lin) * 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fa))))
        if b - fb > a + fa:
            env[a + fa : b - fb] = np.minimum(env[a + fa : b - fb], floor_lin)
        env[b - fb : b] = np.minimum(env[b - fb : b], floor_lin + (1.0 - floor_lin) * 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, fb))))
    for buf in buffers:
        buf *= env[None, : buf.shape[1]]


def render_cues_mix(cues_path: str, out_wav: str, library_dir: str | None = None, strict: bool = False) -> dict:
    """Validate, render, master, verify, and report a declarative `cues.json` horror soundtrack."""
    cues_abs = os.path.abspath(cues_path)
    base_dir = os.path.dirname(cues_abs)
    with open(cues_abs, encoding="utf-8") as fp:
        cfg = json.load(fp)

    voice_path = _resolve_path(base_dir, cfg.get("voice"))
    words_path = _resolve_path(base_dir, cfg.get("words"))
    if not voice_path or not os.path.isfile(voice_path):
        raise FileNotFoundError(f"Voice WAV not found: {voice_path}")
    if not words_path or not os.path.isfile(words_path):
        raise FileNotFoundError(f"words.json not found: {words_path}")

    lib_dir = library_dir or _resolve_path(base_dir, cfg.get("library_dir")) or os.path.join(AUDIO_DIR, "sfx_library")
    mf = sm.load_manifest(lib_dir) if os.path.isdir(lib_dir) else {"assets": {}}
    mf_assets = mf.get("assets") or {}

    with open(words_path, encoding="utf-8") as fp:
        wdata = json.load(fp)
    dur = float(cfg.get("duration") or (float(wdata.get("dur", 10.0)) + float(cfg.get("tail_pad_s", 0.9))))
    words = load_words(words_path)
    dead_silences = load_dead_silences(words_path)
    whisper_spans = _resolve_whisper_spans(wdata)

    # Resolve all events and their onset/peak/end alignment BEFORE mixing
    resolved_events = []
    for idx, ev in enumerate(cfg.get("events") or []):
        target_t = _resolve_event_anchor_time(ev, wdata, dur)
        align = str(ev.get("align", "onset")).lower()
        js_style = ev.get("jumpscare")
        synth_kind = ev.get("synth")
        if js_style:
            # Jumpscare composites trim internal layers to <10ms onset, so place right at target_t
            align = "onset"
            align_off = 0.004
        elif synth_kind:
            ev_dur = float(ev.get("dur_s", 0.80))
            align_off = ev_dur if align == "end" else (0.5 * ev_dur if align == "peak" else 0.0)
        else:
            env = _get_asset_envelope(ev["sound"], lib_dir, mf_assets)
            if align == "onset":
                align_off = float(env.get("onset_s", 0.0))
            elif align == "peak":
                align_off = float(env.get("peak_s", 0.0))
            elif align == "end":
                align_off = float(env.get("tail_end_s", env.get("dur_s", 0.0)))
            else:
                align_off = 0.0
        place_t = max(0.0, target_t - align_off)
        resolved_events.append({
            **ev,
            "idx": idx + 1,
            "target_t": round(target_t, 4),
            "place_t": round(place_t, 4),
            "align": align,
            "align_off": round(align_off, 4),
            "label": ev.get("label") or (f"jumpscare:{js_style}" if js_style else None) or ev.get("sound") or ev.get("synth") or f"cue_{idx+1}",
        })

    # Run pre-mix Anti-Clutter QA Gates
    qa_warnings = audit_cues(cfg, resolved_events, wdata, dur)
    if strict and any(w["severity"] == "ERROR" for w in qa_warnings):
        msg = "\n".join(f"  [{w['code']}] {w['detail']}" for w in qa_warnings)
        raise RuntimeError(f"STRICT ANTI-CLUTTER QA GATE FAILED:\n{msg}")

    voice = load_voice(voice_path, dur)
    music = np.zeros((2, ns(dur)), dtype=np.float64)
    sfx_spot = np.zeros((2, ns(dur)), dtype=np.float64)
    sfx_bed = np.zeros((2, ns(dur)), dtype=np.float64)
    r = rng(int(cfg.get("seed", 7070)))
    room_ir = make_ir(rt60=float(cfg.get("room_rt60", 1.5)), seed=70, hf=1.3, early=[(0.020, 0.22, -0.35), (0.045, 0.14, 0.40)], density_lp=3800)

    used_credit_entries = []
    used_history_ids = []

    def _record_usage(sound_name: str):
        slug = sm.safe_slug(os.path.splitext(os.path.basename(sound_name))[0])
        info = mf_assets.get(slug)
        if info:
            used_credit_entries.append({"slug": slug, **info})
            used_history_ids.append(info.get("openverse_id") or slug)

    # 1. Story-driven ambience bed (<= 1 bed!) with dialog-safe EQ + whisper quiet automation
    spans = speech_spans(words, merge=0.28)
    for b in cfg.get("beds") or []:
        if b.get("synth") == "sub_drone":
            arr = sub_drone(f=float(b.get("freq_hz", 43.65)), dur=dur, vel=float(b.get("vel", 0.20)), r=r)
            if b.get("gain_db"):
                arr = arr * dbg(float(b["gain_db"]))
        else:
            arr = load_sfx_asset(
                b["sound"],
                library_dir=lib_dir,
                dur_sec=dur,
                gain_db=float(b.get("gain_db", -26.0)),
                loop=bool(b.get("loop", True)),
                fade_in=float(b.get("fade_in", 0.35)),
                fade_out=float(b.get("fade_out", 0.50)),
            )
            if arr is None:
                raise FileNotFoundError(f"Bed SFX asset not found in {lib_dir}: {b['sound']}")
            _record_usage(b["sound"])
        arr = _apply_dialog_safe_eq(arr, hp_hz=b.get("hp_hz"), lp_hz=b.get("lp_hz"), voice_notch_db=float(b.get("voice_notch_db", 0.0)))
        # Measurement-calibrated bed loudness (post-EQ) so every Openverse/CC0 bed sits at exact audible horror floor!
        if b.get("target_rms_dbfs") is not None:
            cur_rms = float(np.sqrt(np.mean(np.square(arr)) + 1e-18))
            if cur_rms > 1e-7:
                arr = arr * (dbg(float(b["target_rms_dbfs"])) / cur_rms)
                pk_b = float(np.max(np.abs(arr)))
                if pk_b > dbg(-6.0):
                    arr *= dbg(-6.0) / pk_b
        bed_duck = float(b.get("duck_db", -4.5))
        if bed_duck < -0.1:
            arr *= dbg(duck_db(spans, dur, depth=bed_duck, pre=0.08, post=0.14, att=0.06, rel=0.45))[None, :]
        # Extra silence carving on whisper acts so whispered speech stays razor-clear!
        wh_duck = float(b.get("whisper_duck_db", -9.0))
        if whisper_spans and wh_duck < -0.1:
            arr *= dbg(duck_db(whisper_spans, dur, depth=wh_duck, pre=0.15, post=0.18, att=0.12, rel=0.45))[None, :]
        place(sfx_bed, arr, 0.0)

    # 2. Surgical story-driven spot cues + Multi-Style Jumpscare Composites
    micro_vacuums = []
    jumpscare_items = []
    for ev in resolved_events:
        tinn_arr = None
        if ev.get("jumpscare"):
            arr, tinn_arr = _build_jumpscare_composite(ev, lib_dir, mf_assets, r, _record_usage)
            ev.setdefault("target_peak_dbfs", -1.5)
            ev.setdefault("reverb", 0.22)
            ms_s = float(ev.get("micro_silence_s", 0.0))
            if ms_s > 0.02:
                micro_vacuums.append((max(0.0, ev["target_t"] - ms_s), ev["target_t"]))
            jumpscare_items.append(ev)
        elif ev.get("synth") == "reverse_suck":
            arr = reverse_suck(dur=float(ev.get("dur_s", 0.78)), vel=float(ev.get("vel", 0.55)), r=r, f_base=float(ev.get("f_base", 280.0)))
            if ev.get("gain_db"):
                arr = arr * dbg(float(ev["gain_db"]))
            if ev.get("fade_in") or ev.get("fade_out"):
                arr = fades(arr, float(ev.get("fade_in", 0.02)), float(ev.get("fade_out", 0.02)))
        elif ev.get("synth") == "sub_drone":
            arr = sub_drone(f=float(ev.get("freq_hz", 43.65)), dur=float(ev.get("dur_s", 5.0)), vel=float(ev.get("vel", 0.35)), r=r)
            if ev.get("gain_db"):
                arr = arr * dbg(float(ev["gain_db"]))
            arr = fades(arr, float(ev.get("fade_in", 0.35)), float(ev.get("fade_out", 0.12)))
        elif ev.get("synth") == "stinger":
            arr = stinger(kind=str(ev.get("kind", "shriek")), vel=float(ev.get("vel", 0.85)), r=r, dur=float(ev.get("dur_s", 1.8)), f0=float(ev.get("freq_hz", 52.0)))
        elif ev.get("synth") == "riser":
            arr = riser(dur=float(ev.get("dur_s", 2.4)), f0=float(ev.get("f0", 90.0)), f1=float(ev.get("f1", 950.0)), vel=float(ev.get("vel", 0.7)), r=r, hard_cut=bool(ev.get("hard_cut", True)))
        elif ev.get("synth") == "vhs_static_burst":
            arr = vhs_static_burst(dur=float(ev.get("dur_s", 0.45)), vel=float(ev.get("vel", 0.75)), r=r)
        elif ev.get("synth") == "neck_crack_wet":
            arr = neck_crack_wet(dur=float(ev.get("dur_s", 0.55)), vel=float(ev.get("vel", 0.8)), r=r)
        elif ev.get("synth") == "tinnitus_ring":
            arr = tinnitus_ring(dur=float(ev.get("dur_s", 3.5)), vel=float(ev.get("vel", 0.4)), f=float(ev.get("freq_hz", 4080.0)), r=r)
        elif ev.get("synth") == "entity_rattle":
            arr = entity_rattle(dur=float(ev.get("dur_s", 1.8)), vel=float(ev.get("vel", 0.75)), r=r, kind=str(ev.get("kind", "shriek_gasp")))
        else:
            raw_gain = 0.0 if (ev.get("target_peak_dbfs") is not None or ev.get("target_rms_dbfs") is not None) else float(ev.get("gain_db", -10.0))
            arr = load_sfx_asset(
                ev["sound"],
                library_dir=lib_dir,
                dur_sec=ev.get("dur_s"),
                gain_db=raw_gain,
                pan_pos=ev.get("pan"),
                loop=bool(ev.get("loop", False)),
                fade_in=float(ev.get("fade_in", 0.012)),
                fade_out=float(ev.get("fade_out", 0.06)),
            )
            if arr is None:
                raise FileNotFoundError(f"Event SFX asset not found in {lib_dir}: {ev['sound']}")
            _record_usage(ev["sound"])

        arr = _apply_dialog_safe_eq(arr, hp_hz=ev.get("hp_hz"), lp_hz=ev.get("lp_hz"), voice_notch_db=float(ev.get("voice_notch_db", 0.0)))
        reverb_wet = float(ev.get("reverb", 0.0))
        if reverb_wet > 0.01:
            arr = arr + reverb_wet * convolve_st(arr, room_ir)

        # Measurement-calibrated event leveling (post-EQ & reverb) so SFX & Jumpscares hit with unmistakable cinema presence!
        if ev.get("target_rms_dbfs") is not None:
            cur_rms = float(np.sqrt(np.mean(np.square(arr)) + 1e-18))
            if cur_rms > 1e-7:
                arr = arr * (dbg(float(ev["target_rms_dbfs"])) / cur_rms)
        if ev.get("target_peak_dbfs") is not None:
            cur_pk = float(np.max(np.abs(arr)))
            if cur_pk > 1e-7:
                arr = arr * (dbg(float(ev["target_peak_dbfs"])) / cur_pk)
        ev["measured_peak_dbfs"] = round(20.0 * math.log10(max(float(np.max(np.abs(arr))), 1e-9)), 1)

        bus = str(ev.get("bus", "sfx")).lower()
        target_buf = music if bus in ("score", "music") else sfx_spot
        place(target_buf, arr, ev["place_t"])
        if tinn_arr is not None:
            place(music, tinn_arr, min(dur - 0.1, ev["target_t"] + 0.12))

    # Apply pre-jumpscare micro-vacuums to ambience & score (never clipping voice or the strike itself!)
    if micro_vacuums:
        _apply_micro_vacuums([sfx_bed, music], micro_vacuums, floor_db=-36.0)

    # Gentle music bus ducking under speech
    music *= dbg(duck_db(spans, dur, depth=float(cfg.get("music_duck_db", -4.5)), pre=0.08, post=0.14, att=0.06, rel=0.45))[None, :]

    # Master mix with TRUE -48 dB Dead Silence vacuum
    final_mix, stems, stats = master_mix(
        voice,
        music,
        sfx_spot + sfx_bed,
        target_lufs=float(cfg.get("target_lufs", -15.0)),
        ceil_db=float(cfg.get("ceil_db", -1.2)),
        fade_out=float(cfg.get("fade_out", 0.12)),
        dead_silences=dead_silences,
        ds_floor_db=float(cfg.get("dead_silence_floor_db", -48.0)),
    )

    out_abs = os.path.abspath(out_wav)
    out_dir = os.path.dirname(out_abs)
    os.makedirs(out_dir, exist_ok=True)
    write_mix_and_stems(os.path.join(out_dir, "audio"), final_mix, stems)
    write_wav(out_abs, final_mix)

    # Post-mix measurement verification (TRUE Dead Silence drop + clipping + whisper floor!)
    clips = int(np.sum(np.abs(final_mix) >= 0.999))
    ds_reports = []
    bed_total = stems["music"] + stems["sfx"]
    for ds in dead_silences:
        in_db = rms_db(bed_total[:, ns(ds["s"] + 0.05) : ns(ds["e"] - 0.04)])
        out_db = rms_db(bed_total[:, ns(0.4) : ns(min(2.2, max(0.8, ds["s"] - 0.2)))])
        drop = out_db - in_db
        ds_reports.append({"s": ds["s"], "e": ds["e"], "inside_dbfs": round(in_db, 2), "outside_dbfs": round(out_db, 2), "drop_db": round(drop, 2)})
        if drop < 38.0 and out_db > -50.0:
            qa_warnings.append({"code": "DEAD_SILENCE_VACUUM_FAIL", "severity": "ERROR", "detail": f"Dead silence [{ds['s']:.2f}..{ds['e']:.2f}s] drop was only {drop:.1f} dB (< 38 dB)"})

    if clips > 0:
        qa_warnings.append({"code": "CLIPPING_FAIL", "severity": "ERROR", "detail": f"Detected {clips} clipped samples in final mix!"})

    # Post-mix Jumpscare startle contrast (measured on post-limiter final_mix peak) & 1.4-6.5 kHz bite measurement
    js_reports = []
    sos_bite = signal.butter(2, [1400.0 / (0.5 * SR), 6500.0 / (0.5 * SR)], btype="bandpass", output="sos")
    for jev in jumpscare_items:
        t0 = float(jev["target_t"])
        pre_sl = bed_total[:, max(0, ns(t0 - 0.35)) : max(1, ns(t0 - 0.02))]
        hit_mix_sl = final_mix[:, max(0, ns(t0)) : min(final_mix.shape[1], ns(t0 + 0.32))]
        hit_bed_sl = bed_total[:, max(0, ns(t0)) : min(bed_total.shape[1], ns(t0 + 0.32))]
        pre_rms = rms_db(pre_sl) if pre_sl.shape[1] > 8 else -90.0
        hit_pk = float(20.0 * np.log10(max(float(np.max(np.abs(hit_mix_sl))), 1e-9))) if hit_mix_sl.shape[1] > 8 else -90.0
        bite_rms = rms_db(signal.sosfilt(sos_bite, hit_bed_sl, axis=-1)) if hit_bed_sl.shape[1] > 32 else -90.0
        js_reports.append({
            "t": round(t0, 2),
            "style": str(jev["jumpscare"]),
            "label": jev["label"],
            "pre_rms_dbfs": round(pre_rms, 1),
            "hit_peak_dbfs": round(hit_pk, 1),
            "jump_contrast_db": round(hit_pk - pre_rms, 1),
            "bite_1400_6500_dbfs": round(bite_rms, 1),
        })

    # Write per-project credits.txt & history.jsonl
    credits_path = os.path.join(out_dir, "credits.txt")
    sm.write_credits_file(credits_path, used_credit_entries)
    if os.path.isdir(lib_dir) and used_history_ids and not cfg.get("skip_history"):
        sm.append_history(lib_dir, os.path.basename(out_dir), used_history_ids)

    # Write measurement-first `mix_report.md` with 5 headphone verification timestamps
    verdict = "PASS" if not any(w["severity"] == "ERROR" for w in qa_warnings) else "NEEDS FIX"
    ebur_txt = ffmpeg_ebur(out_abs)
    report_lines = [
        f"# Báo Cáo Phối Âm & Kiểm Định Chống Rối (`mix_report.md` — {verdict})",
        "",
        f"- **File xuất:** [{os.path.basename(out_abs)}](file://{out_abs}) (`{dur:.2f}s` · `48 kHz stereo`)",
        f"- **Kịch bản cue:** [{os.path.basename(cues_abs)}](file://{cues_abs})",
        f"- **Bản quyền nguồn:** [credits.txt](file://{credits_path})",
        f"- **Loudness thực đo:** `I = {stats['I']:.2f} LUFS` · `TP = {stats['TP']:.2f} dBTP` · `LRA = {stats['LRA']:.2f} LU` · `clips = {clips}`",
        f"- **Lớp nền (Beds):** `{len(cfg.get('beds') or [])}` *(quy chuẩn <= 1)* · **SFX điểm:** `{len(resolved_events)}` · **Jumpscare:** `{len(jumpscare_items)}` *(quy chuẩn <= {int(cfg.get('max_jumpscares', 2 if dur <= 95.0 else max(2, int(round((dur / 60.0) * 0.8)))))})*",
        "",
        "## Cổng Kiểm Định Chống Rối & Jumpscare (7 QA Gates)",
    ]
    if not qa_warnings:
        report_lines.append("- **PASS 7/7:** `0` lỗi chồng nền, `0` lỗi crowding, `0` lỗi đè hồi thì thầm, `0` lạm dụng Jumpscare, `0` clips!")
    else:
        for w in qa_warnings:
            report_lines.append(f"- **[{w['severity']}] `{w['code']}`:** {w['detail']}")

    if ds_reports:
        report_lines.append("")
        report_lines.append("## TRUE Dead Silence Thực Đo")
        for d in ds_reports:
            report_lines.append(f"- `[{d['s']:.2f}s .. {d['e']:.2f}s]`: trong khoảng lặng `{d['inside_dbfs']:.2f} dBFS` vs bên ngoài `{d['outside_dbfs']:.2f} dBFS` (**giảm `{d['drop_db']:.2f} dB`**).")

    if js_reports:
        report_lines.append("")
        report_lines.append("## Kiểm Định Jumpscare Thực Đo (Tương Phản Giật Mình + Dải Chói 1.4–6.5 kHz)")
        for j in js_reports:
            report_lines.append(
                f"- **`{j['t']:05.2f}s` (`{j['style']}`)** — Trước đòn `{j['pre_rms_dbfs']:.1f} dBFS` → Đỉnh nổ `{j['hit_peak_dbfs']:.1f} dBFS` "
                f"(**bật tăng `+{j['jump_contrast_db']:.1f} dB`** · dải chói 1.4–6.5 kHz `{j['bite_1400_6500_dbfs']:.1f} dBFS`) — {j['label']}"
            )

    report_lines.extend([
        "",
        "## 5 Mốc Thời Gian Đề Xuất Đeo Tai Nghe Kiểm Tra",
    ])
    check_pts = []
    # Always prioritize every Jumpscare checkpoint first!
    for j in js_reports:
        check_pts.append((max(0.0, j["t"] - 0.5), f"**JUMPSCARE `{j['style']}`** tại `{j['t']:.2f}s` (bật `+{j['jump_contrast_db']:.1f} dB`, dải chói `{j['bite_1400_6500_dbfs']:.1f} dBFS`) — {j['label']}"))
    if whisper_spans:
        ws, we = whisper_spans[0]
        check_pts.append((ws, f"Hồi thì thầm (`{ws:.2f}s..{we:.2f}s`) — kiểm tra nền tự hạ tĩnh và giọng thì thầm rõ nét"))
    for d in ds_reports[:1]:
        if not any(abs(d["s"] - t0) < 1.5 for t0, _ in check_pts):
            check_pts.append((max(0.0, d["s"] - 0.8), f"Khoảng lặng chết (`{d['s']:.2f}s..{d['e']:.2f}s`) — kiểm tra sườn hút ngược → chân không `-48 dB` → cú nổ sau im lặng"))
    if resolved_events:
        first_ev = min(resolved_events, key=lambda e: e["target_t"])
        if not any(abs(first_ev["target_t"] - t0) < 1.5 for t0, _ in check_pts):
            check_pts.append((first_ev["target_t"], f"`{first_ev['label']}` (mốc `{first_ev['target_t']:.2f}s`, căn `{first_ev['align']}`, peak `{first_ev.get('measured_peak_dbfs', 0.0):.1f} dBFS`)"))
    hero_cands = [e for e in resolved_events if e["target_t"] > 0.45 * dur and not any(abs(e["target_t"] - t0) < 2.0 for t0, _ in check_pts)]
    if hero_cands:
        loudest = max(hero_cands, key=lambda e: e.get("measured_peak_dbfs", -99.0))
        check_pts.append((loudest["target_t"], f"`{loudest['label']}` (mốc `{loudest['target_t']:.2f}s`, căn `{loudest['align']}`, peak `{loudest.get('measured_peak_dbfs', 0.0):.1f} dBFS`)"))
    for ev in resolved_events:
        if len(check_pts) >= 5:
            break
        if not any(abs(ev["target_t"] - t0) < 2.0 for t0, _ in check_pts):
            check_pts.append((ev["target_t"], f"`{ev['label']}` (mốc `{ev['target_t']:.2f}s`, căn `{ev['align']}`, peak `{ev.get('measured_peak_dbfs', 0.0):.1f} dBFS`)"))
    for t_chk, desc in sorted(check_pts, key=lambda x: x[0])[:5]:
        report_lines.append(f"- **`{t_chk:05.2f}s`** — {desc}")

    report_lines.extend([
        "",
        "## Bảng Chi Tiết Toàn Bộ Cue Đã Phối",
        "| # | Bus | Âm thanh | Mốc đích | Điểm phát | Căn (`align`) | Gain · Pan | Mô tả |",
        "|---|---|---|---|---|---|---|---|",
    ])
    for ev in resolved_events:
        src_lbl = f"jumpscare:{ev['jumpscare']}" if ev.get("jumpscare") else (ev.get("sound") or f"synth:{ev.get('synth')}")
        report_lines.append(
            f"| {ev['idx']} | `{ev.get('bus', 'sfx')}` | `{src_lbl}` | `{ev['target_t']:.2f}s` | `{ev['place_t']:.2f}s` | "
            f"`{ev['align']}` (-{ev['align_off']:.2f}s) | peak `{ev.get('measured_peak_dbfs', 0.0):.1f} dBFS` · pan `{ev.get('pan', 0.0)}` | {ev['label']} |"
        )

    report_path = os.path.join(out_dir, "mix_report.md")
    with open(report_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(report_lines) + "\n")

    print(f"MIX CUES {verdict} -> {out_abs} ({dur:.2f}s | I={stats['I']:.2f} LUFS | TP={stats['TP']:.2f} dBTP | clips={clips} | warnings={len(qa_warnings)})")
    print(f"  Report : {report_path}")
    print(f"  Credits: {credits_path}")
    for d in ds_reports:
        print(f"  DEAD_SILENCE [{d['s']:.2f}..{d['e']:.2f}s]: drop={d['drop_db']:.2f} dB (inside={d['inside_dbfs']:.2f} dBFS)")
    for j in js_reports:
        print(f"  JUMPSCARE [{j['t']:.2f}s · {j['style']}]: +{j['jump_contrast_db']:.1f} dB jump (peak={j['hit_peak_dbfs']:.1f} dBFS | bite={j['bite_1400_6500_dbfs']:.1f} dBFS)")
    return {"verdict": verdict, "out_wav": out_abs, "report": report_path, "credits": credits_path, "warnings": qa_warnings, "stats": stats, "clips": clips, "dead_silences": ds_reports, "jumpscares": js_reports}


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v7.0 Declarative `cues.json` Mixer with 6 Anti-Clutter Horror QA Gates.")
    ap.add_argument("--cues", required=True, help="Path to declarative cues.json")
    ap.add_argument("--out", required=True, help="Output mastered 48kHz stereo WAV path")
    ap.add_argument("--library", default=None, help="Optional SFX library directory (auto-detects audio/sfx_library)")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if any Anti-Clutter QA Gate reports ERROR")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    res = render_cues_mix(args.cues, args.out, library_dir=args.library, strict=args.strict)
    if args.strict and res["verdict"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
