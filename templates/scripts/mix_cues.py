#!/usr/bin/env python3
"""Horror Engine v8.0 / v13.0: Narrative Soundscape, Rhythmic Motif & Multi-Zone Spatial Horror Mixer.

Transforms horror audio from flat 1-bed event-spotting into a living storytelling soundscape:
  1. DUAL LIVING BEDS + OCCLUSION AUTOMATION (`beds[]`): Up to 2 distinct-role beds (`near` interior + `far` exterior)
     with organic anti-loop drift and time-varying `gain_db` / `lp_hz` automation (e.g., rain muffles when door bolts!).
  2. RHYTHMIC MOTIF & PATTERN-BREAK ENGINE (`motifs[]`): Recurring diegetic sounds (`steady_then_stop`, `accelerate`,
     `decelerate`, `approach`, `stutter_break`) that hypnotize the listener before breaking pattern.
  3. 4-ZONE ACOUSTIC SPACE & BINAURAL TRAJECTORIES (`space` + `pan_from`->`pan_to`): `close_ear` (0% reverb + binaural ITD),
     `room`, `adjacent_muffled` (behind walls/doors), `exterior_occluded`, and `otherworld`.
  4. PSYCHOLOGICAL UNCANNY HUSH (`[SILENCE_DROP Xs]` + `survive_hush`): Ambient world drops naturally to -42 dB without
     cliché trailer risers, optionally leaving one tiny close-ear breath or floorboard tick audible in the void.
  5. JUMPSCARE DEMOTION & WIDE DYNAMIC RANGE (`-16.0 LUFS`, `default max_jumpscares = 0`): Jumpscares are 0 by default
     on v13 soundscapes and strictly capped when explicitly requested.

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
from dsp import (  # noqa: E402
    SR,
    ns,
    st,
    rng,
    place,
    make_ir,
    build_space_irs,
    convolve_st,
    dbg,
    pan,
    pan_trajectory,
    time_varying_lp,
    curve,
    lp as dsp_lp,
    hp as dsp_hp,
    fades,
    write_wav,
)
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
    clock_tick_irregular,
    wood_settle_subtle,
    breath_close_ear,
    wet_drip,
    woodblock_omen,
    heartbeat,
    shepard_tension,
    folk_wail,
)
from mix_base import (  # noqa: E402
    load_voice,
    load_words,
    load_dead_silences,
    load_silence_drops,
    load_sfx_asset,
    speech_spans,
    duck_db,
    apply_uncanny_hush,
    master_mix,
    write_mix_and_stems,
    ffmpeg_ebur,
)

ROLE_DEFAULT_PEAK_DBFS = {
    "subliminal": -20.5,
    "motif": -16.0,
    "foley": -11.5,
    "tension": -6.8,
    "impact": -3.2,
}

VALID_SPACES = {"close_ear", "room", "adjacent_muffled", "exterior_occluded", "otherworld"}
VALID_MOTIF_MODES = {"steady_then_stop", "accelerate", "decelerate", "approach", "stutter_break"}

# Optional multi-style Jumpscare presets (strictly opt-in; 0 by default on v13 soundscapes)
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


def _is_v13_soundscape(cfg: dict, wdata: dict) -> bool:
    return (
        str(cfg.get("soundscape_mode", "")).lower() == "psychological"
        or bool(cfg.get("motifs"))
        or bool(wdata.get("silence_drops"))
        or any(isinstance(b, dict) and b.get("role") in ("near", "far") for b in (cfg.get("beds") or []))
    )


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
        A = 10.0 ** (float(voice_notch_db) / 40.0)
        w0 = 2.0 * math.pi * 1350.0 / SR
        alpha = math.sin(w0) / (2.0 * 0.85)
        b = np.array([1.0 + alpha * A, -2.0 * math.cos(w0), 1.0 - alpha * A], dtype=np.float64)
        a = np.array([1.0 + alpha / A, -2.0 * math.cos(w0), 1.0 - alpha / A], dtype=np.float64)
        y = signal.lfilter(b, a, y, axis=-1)
    return y


def _resolve_event_anchor_time(ev: dict | float | int, wdata: dict, dur: float) -> float:
    """Resolve event anchor time from `at`, `at_act`, `at_word`, `at_dead_silence`, or `at_silence_drop`."""
    if isinstance(ev, (int, float)):
        return max(0.0, min(dur, float(ev)))
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

    if "at_silence_drop" in ev and ev["at_silence_drop"] is not None:
        sd_list = wdata.get("silence_drops") or []
        idx = int(ev["at_silence_drop"])
        if 0 <= idx < len(sd_list):
            edge = str(ev.get("edge", "start")).lower()
            base = float(sd_list[idx]["s"] if edge == "start" else sd_list[idx]["e"])
            return max(0.0, min(dur, base + offset))
        raise ValueError(f"at_silence_drop={idx} out of range (found {len(sd_list)})")

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

    raise ValueError(f"Event missing time anchor (`at`, `at_act`, `at_word`, `at_dead_silence`, or `at_silence_drop`): {ev}")


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
    """Run Horror Anti-Clutter & Psychological Discipline QA Gates."""
    warnings = []
    beds = cfg.get("beds") or []
    roles = [str(b.get("role") or "").strip().lower() for b in beds if isinstance(b, dict)]
    has_distinct_near_far = len(beds) == 2 and set(roles) == {"near", "far"}
    default_max_beds = 2 if has_distinct_near_far else 1
    max_beds = int(cfg.get("max_beds", default_max_beds))
    if len(beds) > max_beds:
        warnings.append({
            "code": "MAX_BEDS_EXCEEDED",
            "severity": "ERROR",
            "detail": (
                f"Found {len(beds)} beds (allowed: <= 1 single bed, OR 2 distinct-role `near` + `far` spatial beds). "
                "Never stack untagged/same-role ambience beds!"
            ),
        })

    for mf in cfg.get("motifs") or []:
        mmode = str(mf.get("mode", "steady_then_stop")).strip().lower()
        if mmode not in VALID_MOTIF_MODES:
            warnings.append({
                "code": "INVALID_MOTIF_MODE",
                "severity": "ERROR",
                "detail": f"Motif '{mf.get('id', 'motif')}' has invalid mode={mmode!r}; valid={sorted(VALID_MOTIF_MODES)}",
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
        if i + 1 < len(ordered):
            b = ordered[i + 1]
            dt = b["target_t"] - a["target_t"]
            if dt < 0.60 and not (a.get("allow_layer") or b.get("allow_layer")):
                warnings.append({
                    "code": "SFX_CROWDING_WARN",
                    "severity": "ERROR",
                    "detail": f"'{a['label']}' ({a['target_t']:.2f}s) and '{b['label']}' ({b['target_t']:.2f}s) collide within {dt:.2f}s (< 0.60s). Set `allow_layer: true` only for intentional cross-band pairs!",
                })
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
        if ev.get("allow_in_whisper") or ev.get("role") == "subliminal":
            continue
        t = ev["target_t"]
        for ws, we in whisper_spans:
            if (ws - 0.05) <= t <= (we + 0.05):
                warnings.append({
                    "code": "WHISPER_INTRUSION_WARN",
                    "severity": "ERROR",
                    "detail": f"Event '{ev['label']}' at {t:.2f}s intrudes into quiet WHISPER act [{ws:.2f}s..{we:.2f}s]!",
                })

    rev_sucks = [e for e in resolved_events if e.get("synth") == "reverse_suck"]
    if len(rev_sucks) >= 2:
        warnings.append({
            "code": "REVERSE_SUCK_CLICHE_WARN",
            "severity": "WARN",
            "detail": f"Found {len(rev_sucks)} `reverse_suck` trailer risers — prefer `[SILENCE_DROP Xs]` natural uncanny hush!",
        })

    js_events = [e for e in resolved_events if e.get("jumpscare") or e.get("is_jumpscare")]
    v13_mode = _is_v13_soundscape(cfg, wdata)
    default_max_js = 0 if v13_mode else (2 if dur <= 95.0 else max(2, int(round((dur / 60.0) * 0.8))))
    max_js = int(cfg.get("max_jumpscares", default_max_js))
    if len(js_events) > max_js:
        warnings.append({
            "code": "JUMPSCARE_FATIGUE_WARN",
            "severity": "ERROR",
            "detail": (
                f"Found {len(js_events)} jumpscares > max_jumpscares={max_js} "
                f"({'v13 psychological mode defaults to 0 jumpscares' if v13_mode else f'recommended <= {max_js}'}). "
                "Rely on dialogue, motifs & uncanny silence unless explicitly justified!"
            ),
        })
    return warnings


def _trim_to_onset(arr: np.ndarray, onset_s: float, pre_s: float = 0.006, max_dur_s: float | None = None) -> np.ndarray:
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
    """Build a synchronized 3-band psychoacoustic Jumpscare (when explicitly enabled via max_jumpscares >= 1)."""
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

    sub_cands = [ev["sub_sound"]] + spec["sub_candidates"] if ev.get("sub_sound") else spec["sub_candidates"]
    if not _load_trimmed_first(sub_cands, target_pk_db=-2.0, lp_hz=spec["sub_lp_hz"]):
        sub_syn = _apply_dialog_safe_eq(stinger("boom", vel=0.95, r=r, dur=min(dur_s, 2.2), f0=46.0), lp_hz=spec["sub_lp_hz"])
        _fit_add(out, sub_syn, dbg(-2.0) / max(float(np.max(np.abs(sub_syn))), 1e-7))

    bite_cands = [ev["sound"]] + spec["bite_candidates"] if ev.get("sound") else spec["bite_candidates"]
    got_real_bite = _load_trimmed_first(bite_cands, target_pk_db=-1.5, hp_hz=spec["bite_hp_hz"])
    edge_db = float(ev.get("edge_db", spec["synth_edge_db"] if got_real_bite else -1.5))

    sb = spec["synth_bite"]
    if sb == "shriek":
        edge = _apply_dialog_safe_eq(stinger("shriek", vel=0.95, r=r, dur=min(dur_s, 1.5)), hp_hz=1200.0)
    elif sb == "entity_shriek":
        edge = _apply_dialog_safe_eq(entity_rattle(dur=min(dur_s, 1.6), vel=0.92, r=r, kind="shriek_gasp"), hp_hz=550.0)
        edge = _fit_add(edge.copy(), _apply_dialog_safe_eq(stinger("shriek", vel=0.8, r=r, dur=min(dur_s, 1.2)), hp_hz=1600.0), 0.55)
    elif sb == "braam":
        edge = _apply_dialog_safe_eq(stinger("braam", vel=0.92, r=r, dur=min(dur_s, 1.8), f0=73.4), hp_hz=260.0)
        edge = _fit_add(edge.copy(), pan(bowed_metal(f=620.0, dur=min(dur_s, 1.4), vel=0.75, r=r, att=0.015), 0.2), 0.65)
    else:
        vhs = vhs_static_burst(dur=min(dur_s, 0.55), vel=0.95, r=r)
        shr = _apply_dialog_safe_eq(stinger("shriek", vel=0.9, r=r, dur=min(dur_s, 1.15)), hp_hz=1350.0)
        edge = np.zeros((2, max(vhs.shape[1], shr.shape[1])), dtype=np.float64)
        _fit_add(edge, vhs, 1.0)
        _fit_add(edge, shr, 0.72)
        edge = np.tanh(edge * 1.65)

    epk = float(np.max(np.abs(edge)))
    if epk > 1e-7:
        _fit_add(out, edge * (dbg(edge_db) / epk), 1.0)

    if ev.get("body_crack"):
        crk = neck_crack_wet(dur=0.45, vel=0.9, r=r)
        _fit_add(out, crk, dbg(-4.0) / max(float(np.max(np.abs(crk))), 1e-7))

    tinn = None
    if ev.get("tinnitus"):
        t_dur = float(ev.get("tinnitus_dur_s", 2.8))
        tinn = tinnitus_ring(dur=t_dur, vel=0.8, f=float(ev.get("tinnitus_hz", 4060.0)), r=r)
        trms = float(np.sqrt(np.mean(np.square(tinn)) + 1e-18))
        if trms > 1e-7:
            tinn = tinn * (dbg(float(ev.get("tinnitus_rms_dbfs", -27.5))) / trms)

    return fades(out, 0.002, 0.08), tinn


def _apply_micro_vacuums(buffers: list[np.ndarray], vacuums: list[tuple[float, float]], floor_db: float = -36.0):
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


def _apply_space_and_pan(arr: np.ndarray, ev: dict, space_irs: dict) -> np.ndarray:
    """Apply moving stereo trajectory (`pan_from`->`pan_to`), binaural close-ear ITD, and 4-zone acoustic space."""
    space = str(ev.get("space") or "").strip().lower()
    dur_ev = max(0.02, arr.shape[-1] / float(SR))
    if ev.get("pan_from") is not None or ev.get("pan_to") is not None:
        p0 = float(ev.get("pan_from", ev.get("pan", 0.0)))
        p1 = float(ev.get("pan_to", p0))
        y = pan_trajectory(arr, [(0.0, p0), (dur_ev, p1)], itd_binaural=(space == "close_ear" or abs(p1 - p0) > 0.15))
    elif ev.get("pan") is not None and space == "close_ear":
        p0 = float(ev["pan"])
        y = pan_trajectory(arr, [(0.0, p0), (dur_ev, p0)], itd_binaural=True)
    elif ev.get("pan") is not None:
        m = arr if arr.ndim == 1 else arr.mean(axis=0)
        y = pan(m, float(ev["pan"]))
    else:
        y = st(arr)

    default_wet = {
        "close_ear": 0.0,
        "room": 0.18,
        "adjacent_muffled": 0.32,
        "exterior_occluded": 0.44,
        "otherworld": 0.52,
    }.get(space, 0.0)

    if space == "adjacent_muffled":
        y = _apply_dialog_safe_eq(y, lp_hz=float(ev.get("lp_hz") or 920.0))
    elif space == "exterior_occluded":
        y = _apply_dialog_safe_eq(y, hp_hz=float(ev.get("hp_hz") or 130.0), lp_hz=float(ev.get("lp_hz") or 1850.0))

    reverb_wet = float(ev.get("reverb", default_wet))
    if reverb_wet > 0.01 and space != "close_ear":
        ir_key = space if space in space_irs else "room"
        y = y + reverb_wet * convolve_st(y, space_irs[ir_key])
    return y


def _render_motif_track(
    mf: dict,
    dur: float,
    wdata: dict,
    lib_dir: str,
    mf_assets: dict,
    space_irs: dict,
    r,
    record_usage_fn,
) -> tuple[np.ndarray, dict]:
    """Synthesize a narrative recurring sound motif (`steady_then_stop`, `accelerate`, `decelerate`, `approach`, `stutter_break`)."""
    t_start = _resolve_event_anchor_time(mf.get("start", {"at": 1.0}), wdata, dur)
    t_end = _resolve_event_anchor_time(mf.get("end", {"at": max(t_start + 1.0, dur - 1.0)}), wdata, dur)
    if t_end <= t_start + 0.15:
        t_end = min(dur, t_start + 2.0)

    mode = str(mf.get("mode", "steady_then_stop")).strip().lower()
    base_iv = max(0.28, float(mf.get("interval_s", 2.4)))
    space = str(mf.get("space", "room")).strip().lower()
    target_pk_db = float(mf.get("target_peak_dbfs", ROLE_DEFAULT_PEAK_DBFS["motif"]))
    p_from = float(mf.get("pan_from", mf.get("pan", -0.30)))
    p_to = float(mf.get("pan_to", p_from))

    # Build hit timestamps according to psychological pattern mode
    hit_times = []
    t_cur = t_start
    span = max(0.2, t_end - t_start)
    while t_cur < t_end - 0.08:
        u = min(1.0, max(0.0, (t_cur - t_start) / span))
        hit_times.append((t_cur, u))
        if mode == "accelerate":
            dt = base_iv * (1.0 - 0.62 * (u ** 1.25))
        elif mode == "decelerate":
            dt = base_iv * (1.0 + 1.35 * (u ** 1.4))
        elif mode == "approach":
            dt = base_iv * (1.0 - 0.18 * u)
        else:
            dt = base_iv
        jitter = float(r.uniform(-0.014, 0.014))
        t_cur += max(0.22, dt + jitter)

    if mode == "stutter_break" and hit_times:
        last_t, _ = hit_times[-1]
        extra_t = min(dur - 0.12, last_t + min(0.32, base_iv * 0.28))
        if extra_t > last_t + 0.08:
            hit_times.append((extra_t, 1.0))

    # Load single-hit motif source (CC0 library asset or procedural fallback)
    base_hit = None
    if mf.get("sound"):
        raw = load_sfx_asset(mf["sound"], library_dir=lib_dir, dur_sec=mf.get("hit_dur_s", min(1.6, base_iv * 0.85)), gain_db=0.0, loop=False)
        if raw is not None:
            env_i = _get_asset_envelope(mf["sound"], lib_dir, mf_assets)
            base_hit = _trim_to_onset(raw, float(env_i.get("onset_s", 0.0)), pre_s=0.005, max_dur_s=min(1.6, base_iv * 0.9))
            record_usage_fn(mf["sound"])
    if base_hit is None:
        sk = str(mf.get("synth") or mf.get("sound") or "wet_drip").lower()
        if "clock" in sk:
            base_hit = clock_tick_irregular(dur=0.22, bpm=60.0, vel=0.7, r=r, mode="steady")
        elif "wood" in sk or "knock" in sk:
            base_hit = woodblock_omen([0.02], vel=0.7, r=r)
        elif "heart" in sk:
            base_hit = st(heartbeat(bpm=60.0, dur=0.55, vel=0.7, r=r))
        else:
            base_hit = wet_drip([0.02], vel=0.7, r=r)

    buf = np.zeros((2, ns(dur)), dtype=np.float64)
    mono_hit = base_hit.mean(axis=0) if base_hit.ndim == 2 else base_hit

    for idx_h, (th, u) in enumerate(hit_times):
        cur_pan = p_from + (p_to - p_from) * u
        if mode == "approach":
            # Progressively open low-pass filter, reduce room wet, and step gain closer to ear!
            lp_u = 850.0 * ((5800.0 / 850.0) ** u)
            hit_m = dsp_lp(mono_hit, lp_u, order=2)
            pk_db_u = (target_pk_db - 9.0) + 9.0 * u
            sp_u = "close_ear" if u > 0.78 else space
            wet_u = 0.36 * (1.0 - u)
            seg_st = _apply_space_and_pan(hit_m, {"pan": cur_pan, "space": sp_u, "reverb": wet_u}, space_irs)
        else:
            pk_db_u = target_pk_db + float(r.uniform(-0.8, 0.8))
            seg_st = _apply_space_and_pan(mono_hit, {"pan": cur_pan, "space": space}, space_irs)

        pk = float(np.max(np.abs(seg_st)))
        if pk > 1e-8:
            seg_st = seg_st * (dbg(pk_db_u) / pk)
        place(buf, seg_st, th)

    summary = {
        "id": mf.get("id") or "motif",
        "sound": mf.get("sound") or mf.get("synth") or "wet_drip",
        "mode": mode,
        "start_s": round(t_start, 2),
        "end_s": round(t_end, 2),
        "hits": len(hit_times),
        "last_hit_s": round(hit_times[-1][0], 2) if hit_times else round(t_start, 2),
        "label": mf.get("label") or f"Motif {mode} ({len(hit_times)} nhịp)",
    }
    return buf, summary


def _synth_spot_instrument(ev: dict, r) -> np.ndarray:
    sk = str(ev.get("synth") or "").strip().lower()
    dur_s = float(ev.get("dur_s", 1.2))
    vel = float(ev.get("vel", 0.65))
    if sk == "reverse_suck":
        arr = reverse_suck(dur=float(ev.get("dur_s", 0.78)), vel=float(ev.get("vel", 0.55)), r=r, f_base=float(ev.get("f_base", 280.0)))
        if ev.get("gain_db"):
            arr = arr * dbg(float(ev["gain_db"]))
        return fades(arr, float(ev.get("fade_in", 0.02)), float(ev.get("fade_out", 0.02)))
    if sk == "sub_drone":
        arr = sub_drone(f=float(ev.get("freq_hz", 43.65)), dur=float(ev.get("dur_s", 5.0)), vel=float(ev.get("vel", 0.35)), r=r)
        if ev.get("gain_db"):
            arr = arr * dbg(float(ev["gain_db"]))
        return fades(arr, float(ev.get("fade_in", 0.35)), float(ev.get("fade_out", 0.12)))
    if sk == "stinger":
        return stinger(kind=str(ev.get("kind", "shriek")), vel=vel, r=r, dur=dur_s, f0=float(ev.get("freq_hz", 52.0)))
    if sk == "riser":
        return riser(dur=float(ev.get("dur_s", 2.4)), f0=float(ev.get("f0", 90.0)), f1=float(ev.get("f1", 950.0)), vel=vel, r=r, hard_cut=bool(ev.get("hard_cut", True)))
    if sk == "vhs_static_burst":
        return vhs_static_burst(dur=float(ev.get("dur_s", 0.45)), vel=vel, r=r)
    if sk == "neck_crack_wet":
        return neck_crack_wet(dur=float(ev.get("dur_s", 0.55)), vel=vel, r=r)
    if sk == "tinnitus_ring":
        return tinnitus_ring(dur=float(ev.get("dur_s", 3.5)), vel=float(ev.get("vel", 0.4)), f=float(ev.get("freq_hz", 4080.0)), r=r)
    if sk == "entity_rattle":
        return entity_rattle(dur=float(ev.get("dur_s", 1.8)), vel=vel, r=r, kind=str(ev.get("kind", "shriek_gasp")))
    if sk == "breath_close_ear":
        return breath_close_ear(dur=float(ev.get("dur_s", 1.0)), vel=float(ev.get("vel", 0.4)), r=r, kind=str(ev.get("kind", "held_exhale")), pan_pos=float(ev.get("pan", 0.65)))
    if sk == "wood_settle_subtle":
        return wood_settle_subtle(dur=float(ev.get("dur_s", 1.5)), vel=float(ev.get("vel", 0.32)), r=r, pan_pos=float(ev.get("pan", -0.35)))
    if sk == "clock_tick_irregular":
        return clock_tick_irregular(dur=float(ev.get("dur_s", 5.0)), bpm=float(ev.get("bpm", 60.0)), vel=vel, r=r, mode=str(ev.get("mode", "steady_then_stop")), pan_pos=float(ev.get("pan", 0.18)))
    if sk == "shepard_tension":
        return shepard_tension(dur=float(ev.get("dur_s", 6.0)), vel=float(ev.get("vel", 0.28)), r=r)
    if sk == "folk_wail":
        return folk_wail(f0=float(ev.get("freq_hz", 293.66)), dur=float(ev.get("dur_s", 4.0)), vel=float(ev.get("vel", 0.30)), r=r, pan_pos=float(ev.get("pan", 0.22)))
    raise ValueError(f"Unknown synth instrument: {sk!r}")


def render_cues_mix(cues_path: str, out_wav: str, library_dir: str | None = None, strict: bool = False) -> dict:
    """Validate, render, master, verify, and report a declarative `cues.json` horror soundscape."""
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
    silence_drops = load_silence_drops(words_path)
    whisper_spans = _resolve_whisper_spans(wdata)
    v13_mode = _is_v13_soundscape(cfg, wdata)

    resolved_events = []
    for idx, ev in enumerate(cfg.get("events") or []):
        target_t = _resolve_event_anchor_time(ev, wdata, dur)
        align = str(ev.get("align", "onset")).lower()
        js_style = ev.get("jumpscare")
        synth_kind = ev.get("synth")
        if js_style:
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

    qa_warnings = audit_cues(cfg, resolved_events, wdata, dur)
    if strict and any(w["severity"] == "ERROR" for w in qa_warnings):
        msg = "\n".join(f"  [{w['code']}] {w['detail']}" for w in qa_warnings)
        raise RuntimeError(f"STRICT ANTI-CLUTTER QA GATE FAILED:\n{msg}")

    voice = load_voice(voice_path, dur)
    music = np.zeros((2, ns(dur)), dtype=np.float64)
    sfx_spot = np.zeros((2, ns(dur)), dtype=np.float64)
    sfx_survive_hush = np.zeros((2, ns(dur)), dtype=np.float64)
    sfx_bed = np.zeros((2, ns(dur)), dtype=np.float64)
    motif_bus = np.zeros((2, ns(dur)), dtype=np.float64)
    r = rng(int(cfg.get("seed", 7070)))
    space_irs = build_space_irs(seed=70, room_rt60=float(cfg.get("room_rt60", 1.15)))

    used_credit_entries = []
    used_history_ids = []

    def _record_usage(sound_name: str):
        slug = sm.safe_slug(os.path.splitext(os.path.basename(sound_name))[0])
        info = mf_assets.get(slug)
        if info:
            used_credit_entries.append({"slug": slug, **info})
            used_history_ids.append(info.get("openverse_id") or slug)

    # 1. Story-driven Dual-Layer Living Beds (`near` + `far`) with Occlusion Automation!
    spans = speech_spans(words, merge=0.28)
    bed_automation_notes = []
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
                organic_drift=True,
            )
            if arr is None:
                raise FileNotFoundError(f"Bed SFX asset not found in {lib_dir}: {b['sound']}")
            _record_usage(b["sound"])

        base_lp = float(b.get("lp_hz") or 3600.0)
        arr = _apply_dialog_safe_eq(arr, hp_hz=b.get("hp_hz"), lp_hz=base_lp, voice_notch_db=float(b.get("voice_notch_db", 0.0)))
        if b.get("target_rms_dbfs") is not None:
            cur_rms = float(np.sqrt(np.mean(np.square(arr)) + 1e-18))
            if cur_rms > 1e-7:
                arr = arr * (dbg(float(b["target_rms_dbfs"])) / cur_rms)
                pk_b = float(np.max(np.abs(arr)))
                if pk_b > dbg(-6.0):
                    arr *= dbg(-6.0) / pk_b

        # Apply story-state bed automation (e.g. door bolting muffles exterior rain!)
        autos = b.get("automation") or []
        if autos:
            g_pts = [(0.0, 0.0)]
            lp_pts = [(0.0, base_lp)]
            cur_g = 0.0
            cur_lp = base_lp
            for au in autos:
                t_au = _resolve_event_anchor_time(au, wdata, dur)
                tr_s = max(0.05, float(au.get("transition_s", 0.65)))
                t_pre = max(0.0, t_au - 0.02)
                t_post = min(dur, t_au + tr_s)
                g_pts.append((t_pre, cur_g))
                lp_pts.append((t_pre, cur_lp))
                if au.get("gain_delta_db") is not None:
                    cur_g = float(au["gain_delta_db"])
                elif au.get("gain_db") is not None and b.get("target_rms_dbfs") is not None:
                    cur_g = float(au["gain_db"]) - float(b["target_rms_dbfs"])
                if au.get("lp_hz") is not None:
                    cur_lp = float(au["lp_hz"])
                g_pts.append((t_post, cur_g))
                lp_pts.append((t_post, cur_lp))
                bed_automation_notes.append((round(t_au, 2), f"Nền `{b.get('sound')}` chuyển trạng thái (`{cur_g:+.1f} dB`, `lp={cur_lp:.0f} Hz`)"))
            g_pts.append((dur, cur_g))
            lp_pts.append((dur, cur_lp))
            if any(abs(v - base_lp) > 25.0 for _, v in lp_pts):
                arr = time_varying_lp(arr, lp_pts, order=2)
            if any(abs(v) > 0.1 for _, v in g_pts):
                arr = arr * dbg(curve(arr.shape[1], g_pts))[None, :]

        bed_duck = float(b.get("duck_db", -3.8 if v13_mode else -4.5))
        if bed_duck < -0.1:
            arr *= dbg(duck_db(spans, dur, depth=bed_duck, pre=0.08, post=0.14, att=0.06, rel=0.45))[None, :]
        wh_duck = float(b.get("whisper_duck_db", -9.0))
        if whisper_spans and wh_duck < -0.1:
            arr *= dbg(duck_db(whisper_spans, dur, depth=wh_duck, pre=0.15, post=0.18, att=0.12, rel=0.45))[None, :]
        place(sfx_bed, arr, 0.0)

    # 2. Narrative Recurring Motifs (`motifs[]`)
    motif_reports = []
    for mf_spec in cfg.get("motifs") or []:
        m_arr, m_rep = _render_motif_track(mf_spec, dur, wdata, lib_dir, mf_assets, space_irs, r, _record_usage)
        # Subtle ducking under speech so motif stays present without masking words
        m_duck = float(mf_spec.get("duck_db", -2.5))
        if m_duck < -0.1:
            m_arr *= dbg(duck_db(spans, dur, depth=m_duck, pre=0.05, post=0.10, att=0.05, rel=0.35))[None, :]
        place(motif_bus, m_arr, 0.0)
        motif_reports.append(m_rep)

    # 3. Surgical story-driven spot cues + Multi-Zone Space + Optional Jumpscares
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
            arr = _apply_space_and_pan(arr, ev, space_irs)
        elif ev.get("synth"):
            arr = _synth_spot_instrument(ev, r)
            arr = _apply_dialog_safe_eq(arr, hp_hz=ev.get("hp_hz"), lp_hz=ev.get("lp_hz"), voice_notch_db=float(ev.get("voice_notch_db", 0.0)))
            arr = _apply_space_and_pan(arr, ev, space_irs)
        else:
            has_auto_level = ev.get("target_peak_dbfs") is not None or ev.get("target_rms_dbfs") is not None or ev.get("role") in ROLE_DEFAULT_PEAK_DBFS
            raw_gain = 0.0 if has_auto_level else float(ev.get("gain_db", -10.0))
            arr = load_sfx_asset(
                ev["sound"],
                library_dir=lib_dir,
                dur_sec=ev.get("dur_s"),
                gain_db=raw_gain,
                pan_pos=None,
                loop=bool(ev.get("loop", False)),
                fade_in=float(ev.get("fade_in", 0.012)),
                fade_out=float(ev.get("fade_out", 0.06)),
            )
            if arr is None:
                raise FileNotFoundError(f"Event SFX asset not found in {lib_dir}: {ev['sound']}")
            _record_usage(ev["sound"])
            arr = _apply_dialog_safe_eq(arr, hp_hz=ev.get("hp_hz"), lp_hz=ev.get("lp_hz"), voice_notch_db=float(ev.get("voice_notch_db", 0.0)))
            arr = _apply_space_and_pan(arr, ev, space_irs)

        eff_target_pk = ev.get("target_peak_dbfs")
        if eff_target_pk is None and ev.get("target_rms_dbfs") is None and ev.get("role") in ROLE_DEFAULT_PEAK_DBFS:
            eff_target_pk = ROLE_DEFAULT_PEAK_DBFS[str(ev["role"])]

        if ev.get("target_rms_dbfs") is not None:
            cur_rms = float(np.sqrt(np.mean(np.square(arr)) + 1e-18))
            if cur_rms > 1e-7:
                arr = arr * (dbg(float(ev["target_rms_dbfs"])) / cur_rms)
        if eff_target_pk is not None:
            cur_pk = float(np.max(np.abs(arr)))
            if cur_pk > 1e-7:
                arr = arr * (dbg(float(eff_target_pk)) / cur_pk)
        ev["measured_peak_dbfs"] = round(20.0 * math.log10(max(float(np.max(np.abs(arr))), 1e-9)), 1)

        bus = str(ev.get("bus", "sfx")).lower()
        if ev.get("survive_hush"):
            place(sfx_survive_hush, arr, ev["place_t"])
        elif bus in ("score", "music"):
            place(music, arr, ev["place_t"])
        else:
            place(sfx_spot, arr, ev["place_t"])
        if tinn_arr is not None:
            place(music, tinn_arr, min(dur - 0.1, ev["target_t"] + 0.12))

    # Measure pre-hush ambient reference before carving silence_drops
    pre_hush_bed_ref = (sfx_bed + motif_bus).copy()
    if silence_drops:
        apply_uncanny_hush(
            [sfx_bed, motif_bus, music, sfx_spot],
            silence_drops,
            floor_db=float(cfg.get("silence_drop_floor_db", -42.0)),
        )

    if micro_vacuums:
        _apply_micro_vacuums([sfx_bed, motif_bus, music], micro_vacuums, floor_db=-36.0)

    music *= dbg(duck_db(spans, dur, depth=float(cfg.get("music_duck_db", -4.5)), pre=0.08, post=0.14, att=0.06, rel=0.45))[None, :]

    default_lufs = -16.0 if v13_mode else -15.0
    target_lufs = float(cfg.get("target_lufs", default_lufs))
    sfx_combined = sfx_spot + sfx_bed + motif_bus + sfx_survive_hush

    final_mix, stems, stats = master_mix(
        voice,
        music,
        sfx_combined,
        target_lufs=target_lufs,
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

    sd_reports = []
    post_hush_env = sfx_bed + motif_bus
    for sd in silence_drops:
        s_in = ns(sd["s"] + min(0.32, (sd["e"] - sd["s"]) * 0.35))
        e_in = ns(sd["e"] - min(0.25, (sd["e"] - sd["s"]) * 0.25))
        if e_in <= s_in + 8:
            s_in, e_in = ns(sd["s"]), ns(sd["e"])
        in_db = rms_db(post_hush_env[:, s_in:e_in])
        out_db = rms_db(pre_hush_bed_ref[:, max(0, ns(sd["s"] - 1.5)) : max(16, ns(sd["s"] - 0.1))])
        drop = out_db - in_db
        sd_reports.append({"s": sd["s"], "e": sd["e"], "inside_bed_dbfs": round(in_db, 2), "outside_bed_dbfs": round(out_db, 2), "bed_drop_db": round(drop, 2)})

    if clips > 0:
        qa_warnings.append({"code": "CLIPPING_FAIL", "severity": "ERROR", "detail": f"Detected {clips} clipped samples in final mix!"})

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

    credits_path = os.path.join(out_dir, "credits.txt")
    sm.write_credits_file(credits_path, used_credit_entries)
    if os.path.isdir(lib_dir) and used_history_ids and not cfg.get("skip_history"):
        sm.append_history(lib_dir, os.path.basename(out_dir), used_history_ids)

    verdict = "PASS" if not any(w["severity"] == "ERROR" for w in qa_warnings) else "NEEDS FIX"
    _ = ffmpeg_ebur(out_abs)
    report_lines = [
        f"# Báo Cáo Không Gian Âm Thanh Tâm Lý (`mix_report.md` — {verdict})",
        "",
        f"- **File xuất:** [{os.path.basename(out_abs)}](file://{out_abs}) (`{dur:.2f}s` · `48 kHz stereo`)",
        f"- **Kịch bản cue:** [{os.path.basename(cues_abs)}](file://{cues_abs})",
        f"- **Bản quyền nguồn:** [credits.txt](file://{credits_path})",
        f"- **Loudness & Độ động thực đo:** `I = {stats['I']:.2f} LUFS` · `TP = {stats['TP']:.2f} dBTP` · `LRA = {stats['LRA']:.2f} LU` · `clips = {clips}`",
        f"- **Lớp nền (Beds):** `{len(cfg.get('beds') or [])}` · **Motif lặp:** `{len(motif_reports)}` · **SFX điểm:** `{len(resolved_events)}` · **Jumpscare:** `{len(jumpscare_items)}`",
        "",
        "## Cổng Kiểm Định Không Gian Âm Thanh & Kỷ Luật Chống Rối",
    ]
    if not qa_warnings:
        report_lines.append("- **PASS:** `0` lỗi chồng nền, `0` lỗi crowding, `0` lỗi đè hồi thì thầm, `0` lạm dụng Jumpscare, `0` clips!")
    else:
        for w in qa_warnings:
            report_lines.append(f"- **[{w['severity']}] `{w['code']}`:** {w['detail']}")

    if motif_reports:
        report_lines.append("")
        report_lines.append("## Âm Thanh Lặp & Phá Vỡ Quy Luật (`Motifs`)")
        for mr in motif_reports:
            report_lines.append(
                f"- **`{mr['id']}` (`{mr['sound']}` · `{mr['mode']}`)**: `{mr['start_s']:.2f}s .. {mr['end_s']:.2f}s` "
                f"(`{mr['hits']}` nhịp, nhịp cuối tại `{mr['last_hit_s']:.2f}s`) — {mr['label']}"
            )

    if sd_reports:
        report_lines.append("")
        report_lines.append("## Khoảng Lặng Tâm Lý (`[SILENCE_DROP]` — Uncanny Hush)")
        for sdr in sd_reports:
            report_lines.append(
                f"- `[{sdr['s']:.2f}s .. {sdr['e']:.2f}s]`: nền môi trường hạ từ `{sdr['outside_bed_dbfs']:.1f} dBFS` xuống `{sdr['inside_bed_dbfs']:.1f} dBFS` (**giảm `{sdr['bed_drop_db']:.1f} dB`**)."
            )

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

    report_lines.extend(["", "## 5 Mốc Thời Gian Tâm Lý Đề Xuất Đeo Tai Nghe Kiểm Tra"])
    check_pts = []
    for t_au, note_au in bed_automation_notes[:1]:
        check_pts.append((max(0.0, t_au - 0.5), f"**Chuyển trạng thái nền:** {note_au}"))
    for mr in motif_reports[:1]:
        check_pts.append((max(0.0, mr["last_hit_s"] - 1.2), f"**Điểm đứt nhịp Motif `{mr['id']}` (`{mr['mode']}`):** nhịp cuối tại `{mr['last_hit_s']:.2f}s` — {mr['label']}"))
    for sdr in sd_reports[:1]:
        check_pts.append((max(0.0, sdr["s"] - 0.4), f"**Khoảng lặng tâm lý (`{sdr['s']:.2f}s..{sdr['e']:.2f}s`):** môi trường rút êm `-{sdr['bed_drop_db']:.1f} dB` kích thích người nghe lắng tai"))
    if whisper_spans:
        ws, we = whisper_spans[0]
        check_pts.append((ws, f"**Thoại hạ giọng sát tai (`{ws:.2f}s..{we:.2f}s`):** kiểm tra nền tự lùi sâu và độ gần của hơi thở/ngữ điệu"))
    for d in ds_reports[:1]:
        if not any(abs(d["s"] - t0) < 1.5 for t0, _ in check_pts):
            check_pts.append((max(0.0, d["s"] - 0.6), f"**Khoảng lặng chân không (`{d['s']:.2f}s..{d['e']:.2f}s`):** giảm `{d['drop_db']:.1f} dB`"))
    for j in js_reports:
        if len(check_pts) < 5:
            check_pts.append((max(0.0, j["t"] - 0.5), f"**Jumpscare `{j['style']}`** tại `{j['t']:.2f}s` (`+{j['jump_contrast_db']:.1f} dB`) — {j['label']}"))
    for ev in resolved_events:
        if len(check_pts) >= 5:
            break
        if not any(abs(ev["target_t"] - t0) < 1.8 for t0, _ in check_pts):
            sp_lbl = ev.get("space", "room")
            check_pts.append((ev["target_t"], f"`{ev['label']}` (mốc `{ev['target_t']:.2f}s`, không gian `{sp_lbl}`, peak `{ev.get('measured_peak_dbfs', 0.0):.1f} dBFS`)"))
    for t_chk, desc in sorted(check_pts, key=lambda x: x[0])[:5]:
        report_lines.append(f"- **`{t_chk:05.2f}s`** — {desc}")

    report_lines.extend([
        "",
        "## Bảng Chi Tiết Toàn Bộ Cue Đã Phối",
        "| # | Bus · Không gian | Âm thanh | Mốc đích | Điểm phát | Căn (`align`) | Gain · Pan | Mô tả |",
        "|---|---|---|---|---|---|---|---|",
    ])
    for ev in resolved_events:
        src_lbl = f"jumpscare:{ev['jumpscare']}" if ev.get("jumpscare") else (ev.get("sound") or f"synth:{ev.get('synth')}")
        sp_tag = ev.get("space") or "room"
        pan_txt = f"{ev['pan_from']}→{ev['pan_to']}" if (ev.get("pan_from") is not None or ev.get("pan_to") is not None) else str(ev.get("pan", 0.0))
        report_lines.append(
            f"| {ev['idx']} | `{ev.get('bus', 'sfx')}` · `{sp_tag}` | `{src_lbl}` | `{ev['target_t']:.2f}s` | `{ev['place_t']:.2f}s` | "
            f"`{ev['align']}` (-{ev['align_off']:.2f}s) | peak `{ev.get('measured_peak_dbfs', 0.0):.1f} dBFS` · pan `{pan_txt}` | {ev['label']} |"
        )

    report_path = os.path.join(out_dir, "mix_report.md")
    with open(report_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(report_lines) + "\n")

    print(f"MIX CUES {verdict} -> {out_abs} ({dur:.2f}s | I={stats['I']:.2f} LUFS | LRA={stats['LRA']:.2f} LU | TP={stats['TP']:.2f} dBTP | clips={clips} | warnings={len(qa_warnings)})")
    print(f"  Report : {report_path}")
    print(f"  Credits: {credits_path}")
    return {
        "verdict": verdict,
        "out_wav": out_abs,
        "report": report_path,
        "credits": credits_path,
        "warnings": qa_warnings,
        "stats": stats,
        "clips": clips,
        "motifs": motif_reports,
        "silence_drops": sd_reports,
        "dead_silences": ds_reports,
        "jumpscares": js_reports,
    }


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v8.0 Narrative Soundscape & Motif Mixer.")
    ap.add_argument("--cues", required=True, help="Path to declarative cues.json")
    ap.add_argument("--out", required=True, help="Output mastered 48kHz stereo WAV path")
    ap.add_argument("--library", default=None, help="Optional SFX library directory (auto-detects audio/sfx_library)")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if any QA Gate reports ERROR")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    res = render_cues_mix(args.cues, args.out, library_dir=args.library, strict=args.strict)
    if args.strict and res["verdict"] != "PASS":
        sys.exit(1)


if __name__ == "__main__":
    main()
