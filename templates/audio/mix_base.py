# Project-agnostic audio mixing, voice-keyed ducking, 4x look-ahead limiting, and loudness QA helpers.
import json
import math
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import (
    SR, ns, st, dbg, pan, read_wav, write_wav, rng, smooth_noise,
    integrated, momentary, short_term, lra, true_peak, fades,
)


CURATED_SFX_CATEGORIES = ("dark_drone", "sad_piano", "stinger", "ambience")


def resolve_sfx_path(name_or_path, library_dir=None, curated_dir=None):
    """Resolve a real recorded SFX WAV, prioritizing local curated `audio/sfx_curated/` BEFORE `audio/sfx_library/`."""
    if not name_or_path:
        return None
    if os.path.isfile(name_or_path):
        return name_or_path
    base = name_or_path if str(name_or_path).lower().endswith(".wav") else f"{name_or_path}.wav"

    curated_roots = []
    if curated_dir:
        curated_roots.append(curated_dir)
    if library_dir:
        curated_roots.append(os.path.join(os.path.dirname(os.path.abspath(library_dir)), "sfx_curated"))
    default_audio = os.path.dirname(os.path.abspath(__file__))
    curated_roots.append(os.path.join(default_audio, "sfx_curated"))

    candidates = []
    seen_roots = set()
    for root in curated_roots:
        aroot = os.path.abspath(root)
        if aroot in seen_roots:
            continue
        seen_roots.add(aroot)
        candidates.append(os.path.join(aroot, base))
        for cat in CURATED_SFX_CATEGORIES:
            candidates.append(os.path.join(aroot, cat, base))

    if library_dir:
        candidates.append(os.path.join(library_dir, base))
    candidates.append(os.path.join(default_audio, "sfx_library", base))
    return next((p for p in candidates if os.path.isfile(p)), None)


def load_sfx_asset(
    name_or_path,
    library_dir=None,
    dur_sec=None,
    gain_db=0.0,
    pan_pos=None,
    loop=False,
    fade_in=0.015,
    fade_out=0.04,
    organic_drift=False,
    curated_dir=None,
):
    """Horror Engine v15.3: Load a real recorded Curated / CC0 SFX WAV asset as 48 kHz stereo float64.

    Searches direct path first, then `audio/sfx_curated/` (root + `dark_drone/`, `sad_piano/`, `stinger/`, `ambience/`),
    then `library_dir/<name>.wav` (defaulting to `<audio_dir>/sfx_library/`).
    Supports clean looping with cosine crossfade, trimming to `dur_sec`, gain scaling, and optional stereo pan.
    Returns `None` if not found so callers can choose an explicit fallback.
    """
    resolved = resolve_sfx_path(name_or_path, library_dir=library_dir, curated_dir=curated_dir)
    if resolved is None:
        return None

    try:
        x, sr = read_wav(resolved)
    except Exception:
        # Handle 24-bit WAVE_FORMAT_EXTENSIBLE / float WAVs transparently via scipy.io.wavfile
        from scipy.io import wavfile
        sr, raw = wavfile.read(resolved)
        if raw.dtype == np.int16:
            xf = raw.astype(np.float64) / 32768.0
        elif raw.dtype == np.int32:
            xf = raw.astype(np.float64) / float(1 << 31)
        elif raw.dtype == np.uint8:
            xf = (raw.astype(np.float64) - 128.0) / 128.0
        else:
            xf = raw.astype(np.float64)
        x = xf.T if xf.ndim == 2 else xf[None, :]
    if x.ndim == 1:
        x = st(x)
    elif x.shape[0] == 1:
        x = st(x[0])
    elif x.shape[0] > 2:
        x = x[:2]

    if sr != SR:
        g = math.gcd(SR, sr)
        x = np.stack([signal.resample_poly(x[0], SR // g, sr // g), signal.resample_poly(x[1], SR // g, sr // g)])

    if dur_sec is not None:
        target_n = ns(dur_sec)
        if x.shape[1] >= target_n:
            x = x[:, :target_n]
        elif loop and x.shape[1] > 64:
            xf = min(ns(0.08), x.shape[1] // 4)
            step = max(1, x.shape[1] - xf)
            out = np.zeros((2, target_n), dtype=np.float64)
            pos = 0
            while pos < target_n:
                seg = x.copy()
                if pos > 0 and xf > 1:
                    ramp_in = np.linspace(0.0, 1.0, xf)
                    seg[:, :xf] *= ramp_in[None, :]
                rem = target_n - pos
                take = min(seg.shape[1], rem)
                if pos > 0 and xf > 1:
                    ramp_out = np.linspace(1.0, 0.0, xf)
                    out[:, pos : pos + min(xf, rem)] *= ramp_out[: min(xf, rem)][None, :]
                out[:, pos : pos + take] += seg[:, :take]
                pos += step
            x = out
        else:
            pad = np.zeros((2, target_n), dtype=np.float64)
            pad[:, : x.shape[1]] = x
            x = pad

    if organic_drift and x.shape[1] > SR * 2:
        r_d = rng(713)
        n_s = x.shape[1]
        mod_L = dbg(1.35 * smooth_noise(n_s, r_d, 0.14))
        mod_R = dbg(1.35 * smooth_noise(n_s, r_d, 0.16))
        x = np.stack([x[0] * mod_L, x[1] * mod_R])
    if pan_pos is not None:
        x = pan(x.mean(0), float(pan_pos))
    if gain_db != 0.0:
        x = x * dbg(gain_db)
    return fades(x, fade_in, fade_out)


def load_sfx_or_fallback(
    name_or_path,
    fallback_fn=None,
    library_dir=None,
    dur_sec=None,
    gain_db=0.0,
    pan_pos=None,
    loop=False,
    fade_in=0.015,
    fade_out=0.04,
    verbose=False,
):
    """Asset-First v6.4 helper: load a real CC0/Neural SFX asset first; fall back cleanly to `fallback_fn()` if absent."""
    real = load_sfx_asset(
        name_or_path,
        library_dir=library_dir,
        dur_sec=dur_sec,
        gain_db=gain_db,
        pan_pos=pan_pos,
        loop=loop,
        fade_in=fade_in,
        fade_out=fade_out,
    )
    if real is not None:
        if verbose:
            print(f"  [SFX REAL ] {name_or_path} ({real.shape[1] / float(SR):.2f}s, gain={gain_db:+.1f} dB)")
        return real
    if fallback_fn is not None:
        syn = fallback_fn()
        if verbose:
            print(f"  [SFX SYNTH] {name_or_path} (fallback procedural)")
        return syn
    return np.zeros((2, ns(dur_sec or 0.1)), dtype=np.float64)


def cached(cache_dir, name, fn):
    os.makedirs(cache_dir, exist_ok=True)
    p = os.path.join(cache_dir, name + ".npy")
    if os.path.exists(p):
        return np.load(p).astype(np.float64)
    x = fn()
    np.save(p, np.asarray(x, np.float32))
    return x


def load_voice(wav_path, dur_sec):
    """Load voice WAV as 48 kHz stereo of exact length `dur_sec` (resampling if needed)."""
    x, sr = read_wav(wav_path)
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    if sr != SR:
        g = math.gcd(SR, sr)
        v = signal.resample_poly(v, SR // g, sr // g)
    n = ns(dur_sec)
    out = np.zeros(n, dtype=np.float64)
    out[: min(n, len(v))] = v[:n]
    return st(out)


def load_words(words_json_path):
    with open(words_json_path, encoding="utf-8") as fp:
        data = json.load(fp)
    return data["words"] if isinstance(data, dict) and "words" in data else data


def load_dead_silences(words_json_path):
    """Load declared `[DEAD SILENCE]` spans `[{'s': float, 'e': float}, ...]` from words.json."""
    with open(words_json_path, encoding="utf-8") as fp:
        data = json.load(fp)
    if isinstance(data, dict) and isinstance(data.get("dead_silences"), list):
        return [
            {"s": float(d["s"]), "e": float(d["e"])}
            for d in data["dead_silences"]
            if isinstance(d, dict) and "s" in d and "e" in d and float(d["e"]) > float(d["s"])
        ]
    return []


def load_silence_drops(words_json_path):
    """Load v13.0 `[SILENCE_DROP Xs]` uncanny environmental hush spans `[{'s': float, 'e': float}, ...]`."""
    with open(words_json_path, encoding="utf-8") as fp:
        data = json.load(fp)
    if isinstance(data, dict) and isinstance(data.get("silence_drops"), list):
        return [
            {"s": float(d["s"]), "e": float(d["e"])}
            for d in data["silence_drops"]
            if isinstance(d, dict) and "s" in d and "e" in d and float(d["e"]) > float(d["s"])
        ]
    return []


def apply_uncanny_hush(buffers, silence_drops, sr=SR, pre_fade=0.30, post_fade=0.24, floor_db=-42.0):
    """Smoothly drop ambient beds & motifs into an eerie -42 dB hush across `[SILENCE_DROP Xs]` windows
    without harsh mechanical clicks or cliché reverse-suck risers."""
    if not silence_drops or not buffers:
        return
    n = max(b.shape[1] for b in buffers)
    floor_lin = dbg(floor_db) if floor_db > -120.0 else 0.0
    env = np.ones(n, dtype=np.float64)
    f_pre = max(1, int(round(pre_fade * sr)))
    f_post = max(1, int(round(post_fade * sr)))
    for sd in silence_drops:
        a = max(0, int(round(float(sd["s"]) * sr)))
        b = min(n, int(round(float(sd["e"]) * sr)))
        if b <= a + 8:
            continue
        fa = min(f_pre, max(1, (b - a) // 3))
        fb = min(f_post, max(1, (b - a) // 3))
        fade_out = floor_lin + (1.0 - floor_lin) * (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fa))))
        fade_in = floor_lin + (1.0 - floor_lin) * (0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, fb))))
        env[a : a + fa] = np.minimum(env[a : a + fa], fade_out)
        if b - fb > a + fa:
            env[a + fa : b - fb] = np.minimum(env[a + fa : b - fb], floor_lin)
        env[b - fb : b] = np.minimum(env[b - fb : b], fade_in)
    for buf in buffers:
        buf *= env[None, : buf.shape[1]]


def apply_dead_silences(music, sfx, dead_silences, sr=SR, pre_fade=0.022, post_fade=0.010, floor_db=-48.0):
    """
    Horror Engine v5.0: TRUE Psychoacoustic Dead Silence vacuum gate.
    Hard-cuts BOTH music and ambient SFX beds to `floor_db` (-48 dB near-vacuum) across every
    declared `[DEAD SILENCE]` window with crisp cosine edges so the post-silence shock hits out of total void.
    """
    m = st(music).copy()
    s = st(sfx).copy()
    if not dead_silences:
        return m, s
    n = max(m.shape[1], s.shape[1])
    floor_lin = dbg(floor_db) if floor_db > -120.0 else 0.0
    env = np.ones(n, dtype=np.float64)
    f_pre = max(1, int(round(pre_fade * sr)))
    f_post = max(1, int(round(post_fade * sr)))
    for ds in dead_silences:
        a = max(0, int(round(float(ds["s"]) * sr)))
        b = min(n, int(round(float(ds["e"]) * sr)))
        if b <= a:
            continue
        fa = min(f_pre, max(1, (b - a) // 4))
        fb = min(f_post, max(1, (b - a) // 4))
        fade_out = floor_lin + (1.0 - floor_lin) * (0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, fa))))
        fade_in = floor_lin + (1.0 - floor_lin) * (0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, fb))))
        env[a : a + fa] = np.minimum(env[a : a + fa], fade_out)
        if b - fb > a + fa:
            env[a + fa : b - fb] = np.minimum(env[a + fa : b - fb], floor_lin)
        env[b - fb : b] = np.minimum(env[b - fb : b], fade_in)
    m *= env[None, : m.shape[1]]
    s *= env[None, : s.shape[1]]
    return m, s


def speech_spans(words, merge=0.3):
    sp = []
    for w in words:
        s = float(w.get("s", w.get("start", 0.0)))
        e = float(w.get("e", w.get("end", s)))
        if sp and s - sp[-1][1] < merge:
            sp[-1][1] = max(sp[-1][1], e)
        else:
            sp.append([s, e])
    return sp


def duck_db(spans, dur_sec, depth=-3.0, pre=0.08, post=0.12, att=0.07, rel=0.45):
    """Compute per-sample gain envelope (dB) that ducks music while voice is speaking."""
    ctrl = 1000
    n = ns(dur_sec)
    nc = int(dur_sec * ctrl) + 2
    va = np.zeros(nc)
    for s, e in spans:
        va[max(0, int((s - pre) * ctrl)): min(nc, int((e + post) * ctrl))] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env = np.zeros(nc)
    e = 0.0
    for i in range(nc):
        tgt = va[i]
        e += (tgt - e) * (ka if tgt > e else kr)
        env[i] = e
    return np.interp(np.arange(n) / SR, np.arange(nc) / ctrl, depth * env)


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    """4x-oversampled peak detection, look-ahead min filter, one-pole release, centred smoothing."""
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    la = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * la + 1, mode="nearest")
    g2 = g1.copy()
    idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR))
        gap = ns(rel * 8)
        brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]])
        ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap)
            seg = g1[a:e]
            out = np.empty(len(seg))
            g = 1.0
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                out[k] = g
            g2[a:e] = out
    g3 = ndimage.uniform_filter1d(g2, 2 * la + 1, mode="nearest")
    g3 = np.minimum(g3, 1.0)
    return x * g3[None, :], g3


def lufs(x):
    v = integrated(x)
    return float(v) if np.isfinite(v) else -99.0


def master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2, fade_out=0.03, dead_silences=None, ds_floor_db=-48.0):
    """Sum voice/music/sfx stems (applying optional TRUE Dead Silence vacuum cut on music+sfx), master to `target_lufs` via 4x limiter."""
    v, m, s = st(voice), st(music), st(sfx)
    n = max(v.shape[1], m.shape[1], s.shape[1])

    def fit(arr):
        if arr.shape[1] == n:
            return arr
        out = np.zeros((2, n), dtype=np.float64)
        out[:, : arr.shape[1]] = arr
        return out

    v, m, s = fit(v), fit(m), fit(s)
    if dead_silences:
        m, s = apply_dead_silences(m, s, dead_silences, sr=SR, floor_db=ds_floor_db)
    mix0 = v + m + s
    gain_db = target_lufs - lufs(mix0)
    y = mix0 * dbg(gain_db)
    g3 = np.ones(n, dtype=np.float64)
    for _ in range(5):
        y, g3 = limiter(mix0 * dbg(gain_db), ceil_db=ceil_db)
        cur = lufs(y)
        if abs(cur - target_lufs) < 0.02:
            break
        gain_db += target_lufs - cur

    if fade_out > 0:
        y = fades(y, 0.0, fade_out)

    gain_lin = dbg(gain_db)
    gv, gm, gs = v * gain_lin, m * gain_lin, s * gain_lin
    stems = {"voice": gv, "music": gm, "sfx": gs}
    grdb = -20 * np.log10(np.maximum(g3, 1e-12))
    stats = {
        "I": lufs(y),
        "TP": float(true_peak(y)),
        "LRA": float(lra(y)),
        "Mmax": float(np.max(momentary(y))),
        "Smax": float(np.max(short_term(y))),
        "gain_db": float(gain_db),
        "gr": {
            "max": float(grdb.max()),
            "pct_over_0_5": float((grdb > 0.5).mean() * 100),
            "pct_over_0_1": float((grdb > 0.1).mean() * 100),
        },
        "peaks": {k: float(20 * np.log10(np.abs(arr).max() + 1e-12)) for k, arr in stems.items()},
        "voice_I": lufs(gv),
        "music_I": lufs(gm),
        "sfx_I": lufs(gs),
    }
    return y, stems, stats


def ffmpeg_ebur(wav_path):
    try:
        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", "-i", wav_path, "-af", "ebur128=peak=true", "-f", "null", "-"],
            capture_output=True, text=True, timeout=300,
        )
        txt = r.stderr
        i = txt.rfind("Summary:")
        if i < 0:
            return txt[-1500:]
        out = []
        for line in txt[i:].splitlines():
            out.append(line.rstrip())
            if line.strip().startswith("Peak:"):
                break
        return "\n".join(l for l in out if l)
    except Exception as exc:
        return f"ffmpeg check failed: {exc}"


def write_mix_and_stems(out_dir, final_mix, stems):
    os.makedirs(out_dir, exist_ok=True)
    write_wav(os.path.join(out_dir, "mix.wav"), final_mix)
    for name, arr in stems.items():
        write_wav(os.path.join(out_dir, f"stem_{name}.wav"), arr)
