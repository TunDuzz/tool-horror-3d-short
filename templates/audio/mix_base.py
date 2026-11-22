# Project-agnostic audio mixing, voice-keyed ducking, 4x look-ahead limiting, and loudness QA helpers.
import json
import math
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import (
    SR, ns, st, dbg, read_wav, write_wav,
    integrated, momentary, short_term, lra, true_peak, fades,
)


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


def master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2, fade_out=0.03):
    """Sum voice/music/sfx stems, master to `target_lufs` via 4x limiter, return (final_mix, stems_dict, stats_dict)."""
    v, m, s = st(voice), st(music), st(sfx)
    n = max(v.shape[1], m.shape[1], s.shape[1])

    def fit(arr):
        if arr.shape[1] == n:
            return arr
        out = np.zeros((2, n), dtype=np.float64)
        out[:, : arr.shape[1]] = arr
        return out

    v, m, s = fit(v), fit(m), fit(s)
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
