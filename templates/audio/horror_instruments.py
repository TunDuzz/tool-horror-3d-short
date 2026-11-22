# Procedural horror sound synthesis library (pure numpy + scipy via dsp.py):
# sub_drone, bowed_metal, scary_musicbox, riser, stinger, heartbeat, horror_strings, ambience_night, whisper_ghost.
import numpy as np
from scipy import signal
from dsp import (
    SR, TAU, ns, tt, rng, lp, hp, bp, peq, reson, resbank,
    colored, smooth_noise, ramp, fades, shape, phase, modal, pan, widen,
)


def m2f(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def _env_sr(n, att, dur_n, rel):
    e = np.ones(n, dtype=np.float64)
    a = max(1, ns(att))
    if a < n:
        e[:a] = ramp(a)
    else:
        e[:] = ramp(n)
    if dur_n < n:
        r_len = max(1, n - dur_n)
        e[dur_n:] *= ramp(r_len)[::-1]
    return e


def _norm_peak(x, target=0.9):
    pk = float(np.max(np.abs(x)))
    return x * (target / pk) if pk > 1e-12 else x


def sub_drone(f=43.65, dur=8.0, vel=0.6, r=None, beat_hz=0.18, dark=160.0, att=1.2, rel=1.5):
    """Stereo ominous sub-bass rumble: dual beating low fundamentals + dark brown-noise undertone."""
    r = r or rng(101)
    n = ns(dur + rel)
    t = np.arange(n) / SR
    env = _env_sr(n, att, ns(dur), rel)

    out = np.zeros((2, n), dtype=np.float64)
    for ch, df in enumerate((-beat_hz * 0.5, beat_hz * 0.5)):
        drift = 4.0 * smooth_noise(n, r, 0.35)
        f_inst = np.maximum(20.0, (f + df) * 2 ** (drift / 1200.0))
        ph = phase(f_inst)
        tone = 0.78 * np.sin(ph) + 0.24 * np.sin(2 * ph + 0.4) + 0.08 * np.sin(3 * ph + 1.1)
        tone = np.tanh(tone * 1.25)
        rumble = lp(colored(n, r, slope=1.9, lo=24.0), dark, order=2) * 0.16
        out[ch] = tone + rumble

    # Subtle cross-bleed so headphones still feel centered weight
    L = 0.86 * out[0] + 0.14 * out[1]
    R = 0.86 * out[1] + 0.14 * out[0]
    out = np.stack([L, R]) * env[None, :]
    return _norm_peak(out, 0.75) * vel


def bowed_metal(f=220.0, dur=3.5, vel=0.5, r=None, bend_semi=1.5, att=0.4, rel=0.8):
    """Eerie waterphone / bowed metal screech (mono, ready to pan)."""
    r = r or rng(202)
    n = ns(dur + rel)
    t = np.arange(n) / SR
    env = _env_sr(n, att, ns(dur), rel)

    bend = bend_semi * np.sin(np.pi * np.clip(t / max(dur, 0.1), 0, 1)) * (-1.0 if r.random() < 0.5 else 1.0)
    wobble = 14.0 * smooth_noise(n, r, 2.2)
    ratios = [(1.0, 0.75), (2.31, 0.55), (3.84, 0.42), (5.47, 0.26), (7.19, 0.16)]
    y = np.zeros(n, dtype=np.float64)
    for ratio, amp in ratios:
        f_inst = np.minimum(SR * 0.42, f * ratio * 2 ** ((bend * 100.0 + wobble) / 1200.0))
        ph = phase(f_inst)
        y += amp * np.sin(ph + r.uniform(0, TAU))

    # Stick-slip rosin scrape layer
    rosin = bp(colored(n, r, slope=0.6), max(80.0, f * 1.4), min(7500.0, f * 9.0), order=2)
    lfo = 0.65 + 0.35 * np.sin(TAU * r.uniform(2.8, 5.2) * t + r.uniform(0, TAU))
    y = (y * lfo + 0.22 * rosin) * env
    y = peq(y, min(3200.0, max(300.0, f * 3.0)), 3.0, q=1.5)
    return _norm_peak(fades(y, 0.01, 0.04), 0.75) * vel


def scary_musicbox(f=587.33, vel=0.55, r=None, dur=2.2, detune_cents=-18.0, wow_hz=0.7, wow_cents=14.0):
    """Detuned, slowly warbling antique music-box tine (mono)."""
    r = r or rng(303)
    t = tt(dur)
    n = len(t)
    ph0 = r.uniform(0, TAU)
    f_inst = f * 2 ** ((detune_cents + wow_cents * np.sin(TAU * wow_hz * t + ph0)) / 1200.0)
    ph = phase(f_inst)
    partials = [(1.0, 1.0, 1.35), (2.0, 0.08, 0.55), (6.27, 0.16 * vel, 0.14), (17.55, 0.06 * vel, 0.03)]
    y = np.zeros(n, dtype=np.float64)
    for ratio, amp, tau in partials:
        if f * ratio < SR * 0.44:
            y += amp * np.exp(-t / tau) * np.sin(ratio * ph + r.uniform(0, TAU))
    click = hp(r.standard_normal(n), 3800) * np.exp(-t / 0.0007) * 0.14
    return _norm_peak(fades(y + click, 0.0005, 0.05), 0.8) * vel


def riser(dur=3.0, f0=90.0, f1=950.0, vel=0.7, r=None, hard_cut=True):
    """Stereo tension riser ending either in a dead-silence snap (`hard_cut=True`) or brief fade."""
    r = r or rng(404)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    swell = (u ** 2.0) * (0.2 + 0.8 * u)

    f_sweep = f0 * (f1 / max(f0, 10.0)) ** u
    out = np.zeros((2, n), dtype=np.float64)
    cluster = [(1.0, -0.55), (1.0595, 0.0), (1.4142, 0.55)]  # root + minor 2nd + tritone
    for ratio, p in cluster:
        fi = np.minimum(SR * 0.42, f_sweep * ratio * 2 ** (8.0 * smooth_noise(n, r, 3.0) / 1200.0))
        ph = phase(fi)
        voice = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.3) + 0.18 * np.sin(3 * ph + 0.8)
        out += pan(voice, p)

    # Sweeping bandpass air rush via STFT spectral shaping
    nz = colored(n, r, slope=0.4)
    f_track = lambda T: np.interp(T, t, np.minimum(11000.0, f_sweep * 2.2))
    air = shape(nz, lambda T, F: np.exp(-0.5 * (np.log2(np.maximum(F[:, None], 25.0) / f_track(T)[None, :]) / 0.45) ** 2), 1024, 256)
    out += widen(air, r, ms=13.0, amount=0.7) * 0.9

    out *= swell[None, :]
    tail_fade = 0.004 if hard_cut else 0.08
    return _norm_peak(fades(out, 0.03, tail_fade), 0.88) * vel


def stinger(kind="boom", vel=0.9, r=None, dur=2.6, f0=52.0):
    """Stereo horror reveal hit: 'boom', 'braam', 'shriek', or 'cluster_stab'."""
    r = r or rng(505)
    t = tt(dur)
    n = len(t)

    if kind == "boom":
        f_drop = f0 * (1.0 + 2.4 * np.exp(-t / 0.045))
        sub = np.sin(phase(f_drop)) * np.exp(-t / 0.72)
        thump = lp(r.standard_normal(n), 280.0) * np.exp(-t / 0.025) * 0.9
        clang = modal(dur, [(275.0, 0.5, 0.45), (412.0, 0.35, 0.35), (695.0, 0.25, 0.22), (1290.0, 0.14, 0.14)], r)
        out = pan(sub + thump, 0.0) + widen(clang, r, ms=16.0, amount=0.8) * 0.65
    elif kind == "braam":
        out = np.zeros((2, n), dtype=np.float64)
        env = _env_sr(n, 0.025, ns(min(dur * 0.45, dur - 0.3)), max(0.3, dur * 0.55))
        for ratio, p in ((1.0, -0.45), (1.007, 0.45), (1.498, 0.0)):
            fi = f0 * ratio * (1.0 + 0.03 * np.exp(-t / 0.05))
            ph = phase(fi)
            sig = sum((1.0 / k) * np.sin(k * ph + r.uniform(0, TAU)) for k in range(1, 14))
            sig = np.tanh(sig * 2.2)
            out += pan(lp(sig, 1800.0) * env, p)
        grit = bp(r.standard_normal(n), 220.0, 2400.0) * np.exp(-t / 0.14) * 0.25
        out += widen(grit, r, ms=14.0, amount=0.6)
    elif kind == "shriek":
        freqs = [880.0, 932.33, 1244.51, 1318.51]
        pans = [-0.65, -0.2, 0.25, 0.65]
        out = np.zeros((2, n), dtype=np.float64)
        env = np.exp(-t / 0.65) * (1.0 - np.exp(-t / 0.008))
        for fv, p in zip(freqs, pans):
            fi = fv * (1.0 - 0.06 * np.clip(t / max(dur, 0.1), 0, 1))
            ph = phase(fi)
            s = np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
            out += pan(s * env, p)
        scrape = bp(r.standard_normal(n), 1500.0, 7500.0) * np.exp(-t / 0.09) * 0.35
        out += widen(scrape, r, ms=9.0, amount=0.6)
    elif kind == "cluster_stab":
        notes = [220.0, 233.08, 293.66, 311.13, 415.30, 466.16]
        out = np.zeros((2, n), dtype=np.float64)
        for i, fv in enumerate(notes):
            y_n = modal(dur, [(fv, 1.0, 0.55), (fv * 2.004, 0.45, 0.30), (fv * 3.01, 0.2, 0.16)], r)
            out += pan(y_n, -0.5 + i / max(1, len(notes) - 1))
        hammer = bp(r.standard_normal(n), 900.0, 5200.0) * np.exp(-t / 0.006) * 0.4
        out += widen(hammer, r, ms=7.0, amount=0.4)
    else:
        raise ValueError(f"Unknown stinger kind: {kind}")

    return _norm_peak(fades(out, 0.001, 0.08), 0.92) * vel


def heartbeat(bpm=72.0, dur=6.0, vel=0.7, r=None, accel_to=None):
    """Visceral lub-dub heartbeat (mono), optionally accelerating from `bpm` to `accel_to`."""
    r = r or rng(606)
    n = ns(dur)
    out = np.zeros(n, dtype=np.float64)

    def _thump(f_hi, f_lo, len_s=0.14):
        tt_b = tt(len_s)
        fi = f_lo + (f_hi - f_lo) * np.exp(-tt_b / 0.022)
        env = np.exp(-tt_b / 0.042) * (1.0 - np.exp(-tt_b / 0.004))
        body = np.sin(phase(fi)) * env
        air = lp(r.standard_normal(len(tt_b)), 160.0) * np.exp(-tt_b / 0.018) * 0.45
        return fades(body + air, 0.002, 0.02)

    lub = _thump(86.0, 42.0, 0.15)
    dub = _thump(96.0, 48.0, 0.12) * 0.72

    t = 0.05
    while t < dur - 0.35:
        u = np.clip(t / max(dur, 1e-4), 0.0, 1.0)
        cur_bpm = bpm + (accel_to - bpm) * u if accel_to is not None else bpm
        period = 60.0 / max(25.0, cur_bpm)
        for seg, dt in ((lub, 0.0), (dub, 0.24 * period)):
            k = ns(t + dt)
            m = min(len(seg), n - k)
            if k >= 0 and m > 0:
                out[k: k + m] += seg[:m]
        t += period

    return _norm_peak(fades(out, 0.005, 0.05), 0.85) * vel


def horror_strings(freqs=(146.83, 155.56, 207.65), dur=6.0, vel=0.5, r=None, att=0.8, rel=1.0, trem_hz=9.5, sul_pont=0.45):
    """Stereo tense tremolo / sul-ponticello dissonant string cluster."""
    r = r or rng(707)
    n = ns(dur + rel)
    t = np.arange(n) / SR
    env = _env_sr(n, att, ns(dur), rel)

    out = np.zeros((2, n), dtype=np.float64)
    count = max(1, len(freqs))
    for idx, f in enumerate(freqs):
        pn = -0.65 + 1.3 * (idx / max(1, count - 1)) if count > 1 else 0.0
        for det in (-9.0, 0.0, 9.0):
            drift = det + 5.0 * smooth_noise(n, r, 1.8)
            ph = phase(f * 2 ** (drift / 1200.0))
            K = max(1, int(min(26, 5500.0 / max(f, 40.0))))
            y = np.zeros(n, dtype=np.float64)
            for k in range(1, K + 1):
                rolloff = 1.0 / (k ** (1.15 - 0.55 * sul_pont))
                y += rolloff * np.sin(k * ph + r.uniform(0, TAU))
            trem = 1.0 - 0.32 * sul_pont * (0.5 + 0.5 * np.sin(TAU * trem_hz * t + r.uniform(0, TAU)))
            out += pan(y * trem, np.clip(pn + r.uniform(-0.15, 0.15), -0.9, 0.9))

    out = peq(out, 2800.0, 3.5 * sul_pont, q=1.2)
    out *= env[None, :]
    return _norm_peak(out, 0.72) * vel


def ambience_night(dur=10.0, kind="wind", vel=0.35, r=None):
    """Stereo procedural horror ambience: 'wind', 'rain', 'room_tone', 'creak', 'thunder', or 'clock'."""
    r = r or rng(808)
    n = ns(dur)
    t = np.arange(n) / SR

    if kind == "wind":
        out = np.zeros((2, n), dtype=np.float64)
        for ch in range(2):
            base = bp(colored(n, r, slope=1.2), 90.0, 1400.0, order=2)
            gust = 0.35 + 0.65 * (0.5 + 0.5 * smooth_noise(n, r, 0.25))
            howl = reson(colored(n, r, slope=0.5), 360.0 + 45.0 * ch, 12.0) * 0.22 * gust
            out[ch] = base * gust + howl
    elif kind == "rain":
        out = np.zeros((2, n), dtype=np.float64)
        for ch in range(2):
            bed = lp(bp(colored(n, r, slope=0.7), 220.0, 8500.0, order=2), 5200.0)
            drops = np.zeros(n, dtype=np.float64)
            num_drops = int(dur * 28)
            for _ in range(num_drops):
                k = int(r.integers(0, max(1, n - 400)))
                dl = min(350, n - k)
                td = np.arange(dl) / SR
                df = r.uniform(1400.0, 3400.0)
                drops[k: k + dl] += np.exp(-td / 0.008) * np.sin(TAU * df * td) * 0.08
            out[ch] = bed + drops
    elif kind == "room_tone":
        out = np.zeros((2, n), dtype=np.float64)
        for ch in range(2):
            dark = lp(colored(n, r, slope=1.8), 260.0, order=2)
            hum = 0.06 * np.sin(TAU * 50.0 * t + r.uniform(0, TAU)) + 0.025 * np.sin(TAU * 100.0 * t)
            mod = 0.78 + 0.22 * smooth_noise(n, r, 0.18)
            out[ch] = (dark + hum) * mod
    elif kind == "creak":
        c_dur = min(dur, 1.4)
        nc = ns(c_dur)
        tc = np.arange(nc) / SR
        u = tc / max(c_dur, 1e-4)
        rate = 26.0 + 38.0 * np.sin(np.pi * u) + 12.0 * np.sin(TAU * 3.1 * tc)
        ph = phase(rate)
        imp = np.maximum(0.0, np.cos(ph)) ** 18
        body = resbank(imp, [(195.0, 7.0, 0.9), (460.0, 9.0, 0.75), (980.0, 12.0, 0.45), (1750.0, 14.0, 0.25)])
        body = fades(body * np.sin(np.pi * u) ** 0.5, 0.02, 0.06)
        mono = np.zeros(n, dtype=np.float64)
        k0 = max(0, (n - nc) // 4)
        mono[k0: k0 + nc] = body
        out = widen(mono, r, ms=10.0, amount=0.55)
    elif kind == "thunder":
        crack_n = min(n, ns(0.6))
        crack = bp(r.standard_normal(n), 320.0, 2800.0) * np.exp(-t / 0.12) * 0.75
        rumble = lp(colored(n, r, slope=1.7), 220.0, order=2)
        env = np.exp(-t / max(0.8, dur * 0.35)) * (1.0 - np.exp(-t / 0.02))
        env *= 0.7 + 0.3 * np.sin(TAU * 1.9 * t + r.uniform(0, TAU))
        mono = crack + rumble * env * 1.4
        if crack_n < n:
            mono[:crack_n] *= 1.0
        out = widen(mono, r, ms=18.0, amount=0.8)
    elif kind == "clock":
        mono = np.zeros(n, dtype=np.float64)
        tick_hi = fades(modal(0.08, [(1950.0, 0.9, 0.008), (3420.0, 0.5, 0.004)], r), 0.0002, 0.01)
        tick_lo = fades(modal(0.08, [(1520.0, 0.8, 0.009), (2680.0, 0.45, 0.005)], r), 0.0002, 0.01)
        step, idx, t_cur = 0.85, 0, 0.1
        while t_cur < dur - 0.1:
            seg = tick_hi if idx % 2 == 0 else tick_lo
            k = ns(t_cur)
            m = min(len(seg), n - k)
            if m > 0:
                mono[k: k + m] += seg[:m]
            t_cur += step
            idx += 1
        out = pan(mono, 0.12)
    else:
        raise ValueError(f"Unknown ambience kind: {kind}")

    return _norm_peak(fades(out, 0.04, 0.06), 0.65) * vel


def whisper_ghost(dur=1.4, vel=0.4, r=None, pan_from=-0.7, pan_to=0.7):
    """Stereo sweeping breathy spectral whisper (unintelligible eerie sibilance)."""
    r = r or rng(909)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)

    nz = colored(n, r, slope=0.15)
    f_form = lambda T: 650.0 + 180.0 * np.sin(TAU * 1.8 * T)
    f_sib = lambda T: 2900.0 + 500.0 * np.cos(TAU * 2.3 * T)

    def _spec(T, F):
        b1 = np.exp(-0.5 * ((F[:, None] - f_form(T)[None, :]) / 240.0) ** 2)
        b2 = np.exp(-0.5 * ((F[:, None] - 1550.0) / 350.0) ** 2) * 0.7
        b3 = np.exp(-0.5 * ((F[:, None] - f_sib(T)[None, :]) / 520.0) ** 2) * 0.85
        return b1 + b2 + b3

    breath = shape(nz, _spec, 1024, 256)
    syllables = 0.45 + 0.55 * np.abs(np.sin(np.pi * 3.5 * u + 0.3 * np.sin(TAU * 1.2 * t)))
    env = np.sin(np.pi * u) ** 0.8 * syllables
    mono = breath * env

    p_traj = pan_from + (pan_to - pan_from) * u
    th = (np.clip(p_traj, -1.0, 1.0) + 1.0) * np.pi * 0.25
    out = np.stack([mono * np.cos(th), mono * np.sin(th)]) * np.sqrt(2.0)
    return _norm_peak(fades(out, 0.02, 0.04), 0.75) * vel
