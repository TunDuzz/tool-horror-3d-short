# Procedural horror sound synthesis library (pure numpy + scipy via dsp.py):
# Core: sub_drone, bowed_metal, scary_musicbox, riser, stinger, heartbeat, horror_strings, ambience_night, whisper_ghost.
# Foley: footsteps_wood, rope_strain, door_slam_bolt, wet_drip, nail_scrape, lantern_sputter.
# Build-up/Climax/Folk: reverse_suck, shepard_tension, tinnitus_ring, whoosh_dark, entity_rattle, lightning_close, folk_wail, woodblock_omen.
import numpy as np
from scipy import signal
from dsp import (
    SR, TAU, ns, tt, rng, lp, hp, bp, peq, reson, resbank,
    colored, smooth_noise, ramp, fades, shape, phase, modal, pan, widen, make_ir, convolve_st,
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


# ---------------- Foley Horror Sound Effects ----------------


def footsteps_wood(times, vel=0.5, r=None, frantic=False, pan_traj=None):
    """Stereo realistic footsteps on damp hollow wooden pier planks / shack floorboards."""
    r = r or rng(1001)
    if not times:
        return np.zeros((2, ns(0.1)), dtype=np.float64)
    total_dur = float(max(times)) + 0.45
    out = np.zeros((2, ns(total_dur)), dtype=np.float64)
    for idx, t0 in enumerate(times):
        step_dur = 0.22 if frantic else 0.28
        ts = tt(step_dur)
        ns_len = len(ts)
        # Heel thump (low pitch-dropping wood resonance)
        f_thump = (92.0 if frantic else 78.0) * r.uniform(0.92, 1.08)
        thump = np.sin(phase(f_thump * (1.0 + 1.4 * np.exp(-ts / 0.012)))) * np.exp(-ts / 0.042)
        # Hollow wood plank slap + modal board knock
        imp = bp(r.standard_normal(ns_len), 180.0, 2600.0, order=2) * np.exp(-ts / (0.016 if frantic else 0.022))
        plank = resbank(imp, [(165.0 * r.uniform(0.94, 1.06), 6.0, 0.9), (340.0, 8.0, 0.65), (780.0, 10.0, 0.35)])
        # Wet grit / boot sole scuff slightly delayed after heel impact
        scuff = bp(r.standard_normal(ns_len), 900.0, 4800.0, order=2) * np.exp(-np.maximum(0.0, ts - 0.025) / 0.028) * (ts >= 0.022)
        step = fades(0.75 * thump + 0.85 * plank + (0.35 if frantic else 0.22) * scuff, 0.001, 0.03)
        step = _norm_peak(step, 0.85) * r.uniform(0.82, 1.08) * (1.08 if idx % 2 == 0 else 0.92)
        p_pos = pan_traj(idx, len(times)) if callable(pan_traj) else (-0.12 if idx % 2 == 0 else 0.12)
        stereo = pan(step, p_pos)
        k = ns(t0)
        m = min(stereo.shape[1], out.shape[1] - k)
        if k >= 0 and m > 0:
            out[:, k : k + m] += stereo[:, :m]
    return _norm_peak(out, 0.82) * vel


def rope_strain(dur=2.4, vel=0.45, r=None):
    """Stereo taut hemp mooring rope groaning & twisting fibers under heavy underwater tension."""
    r = r or rng(1002)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    # Slow erratic stick-slip fiber pulse train accelerating as tension rises
    rate = 14.0 + 34.0 * (u ** 1.4) + 9.0 * smooth_noise(n, r, 2.5)
    ph = phase(np.maximum(6.0, rate))
    ticks = np.maximum(0.0, np.cos(ph)) ** 24
    # Dry fibrous twist resonance + lower wooden bollard groan
    fibers = resbank(ticks, [(240.0, 9.0, 0.85), (520.0, 11.0, 0.72), (1180.0, 14.0, 0.55), (2350.0, 16.0, 0.32)])
    scrape = bp(colored(n, r, slope=0.35), 700.0, 3600.0, order=2) * (0.35 + 0.65 * ticks) * 0.28
    env = (np.sin(np.pi * u) ** 0.45) * (0.55 + 0.45 * u)
    mono = fades((fibers + scrape) * env, 0.03, 0.06)
    return _norm_peak(widen(mono, r, ms=9.5, amount=0.6), 0.78) * vel


def door_slam_bolt(vel=0.92, r=None, bolt_delay=0.36):
    """Stereo heavy wooden shack door slam followed by heavy wooden crossbar slamming into brackets."""
    r = r or rng(1003)
    dur = bolt_delay + 1.35
    out = np.zeros((2, ns(dur)), dtype=np.float64)

    # 1. Heavy door slam (sub punch + hollow wooden door slap + rattling latch)
    t1 = tt(0.95)
    n1 = len(t1)
    sub = np.sin(phase(62.0 * (1.0 + 1.9 * np.exp(-t1 / 0.028)))) * np.exp(-t1 / 0.16)
    slap_nz = bp(r.standard_normal(n1), 140.0, 3200.0, order=2) * np.exp(-t1 / 0.032)
    wood_body = resbank(slap_nz, [(135.0, 5.0, 1.0), (290.0, 7.0, 0.75), (640.0, 9.0, 0.42), (1450.0, 11.0, 0.25)])
    rattle = bp(r.standard_normal(n1), 1200.0, 4600.0, order=2) * np.exp(-np.maximum(0.0, t1 - 0.04) / 0.08) * (0.5 + 0.5 * np.sin(TAU * 28.0 * t1)) * (t1 >= 0.035) * 0.28
    slam = fades(0.95 * sub + 1.15 * wood_body + rattle, 0.0005, 0.05)
    slam_st = pan(sub, 0.0) * 0.65 + widen(slam, r, ms=12.0, amount=0.7) * 0.75
    out[:, :n1] += slam_st

    # 2. Wooden crossbar sliding & dropping solidly into iron/wood bracket
    t2 = tt(0.75)
    n2 = len(t2)
    slide = bp(colored(n2, r, slope=0.5), 350.0, 2200.0, order=2) * np.exp(-t2 / 0.085) * 0.24
    # Two-part heavy timber clunk (bar hits left bracket -> settles right bracket)
    clunk = np.zeros(n2, dtype=np.float64)
    for dt_c, g_c, f_c in ((0.09, 1.0, 210.0), (0.165, 0.68, 245.0)):
        k0 = ns(dt_c)
        rem = n2 - k0
        if rem > 10:
            tc = np.arange(rem) / SR
            hit = modal(rem / SR, [(f_c, 0.9, 0.055), (f_c * 2.18, 0.55, 0.032), (f_c * 4.1, 0.28, 0.015), (96.0, 0.85, 0.07)], r)
            clunk[k0:] += hit[:rem] * g_c
    bolt = fades(slide + clunk, 0.001, 0.04)
    bolt_st = pan(bolt, 0.14)
    kb = ns(bolt_delay)
    mb = min(bolt_st.shape[1], out.shape[1] - kb)
    if mb > 0:
        out[:, kb : kb + mb] += bolt_st[:, :mb] * 0.92
    return _norm_peak(out, 0.94) * vel


def wet_drip(times, vel=0.38, r=None, pans=None):
    """Stereo eerie cold water/mud droplets hitting dry wooden floor (classic pitch-rising bubble plop)."""
    r = r or rng(1004)
    if not times:
        return np.zeros((2, ns(0.1)), dtype=np.float64)
    total_dur = float(max(times)) + 0.5
    out = np.zeros((2, ns(total_dur)), dtype=np.float64)
    for idx, t0 in enumerate(times):
        td = tt(0.14)
        f0 = r.uniform(680.0, 1180.0)
        # Characteristic upward liquid-cavity pitch chirp of a falling drop
        f_inst = f0 * (1.0 + 1.15 * (1.0 - np.exp(-td / 0.014)))
        plop = np.sin(phase(f_inst)) * np.exp(-td / 0.018) * (1.0 - np.exp(-td / 0.0012))
        splash = bp(r.standard_normal(len(td)), 2400.0, 7500.0, order=2) * np.exp(-td / 0.006) * 0.22
        drop = _norm_peak(fades(plop + splash, 0.0004, 0.02), 0.85) * r.uniform(0.75, 1.05)
        pn = pans[idx] if pans is not None and idx < len(pans) else r.uniform(-0.35, 0.35)
        st_drop = pan(drop, pn)
        k = ns(t0)
        m = min(st_drop.shape[1], out.shape[1] - k)
        if k >= 0 and m > 0:
            out[:, k : k + m] += st_drop[:, :m]
    return _norm_peak(out, 0.78) * vel


def nail_scrape(dur=1.45, vel=0.32, r=None, surface="glass", pan_pos=-0.55):
    """Stereo spine-chilling fingernails dragging slowly across dark glass or rough wood."""
    r = r or rng(1005)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    nz = colored(n, r, slope=0.1)
    if surface == "glass":
        f_base = 2450.0 + 380.0 * smooth_noise(n, r, 3.2) - 220.0 * u
        modes = [(1.0, 32.0, 0.85), (1.47, 26.0, 0.55), (2.11, 22.0, 0.38)]
        y = np.zeros(n, dtype=np.float64)
        for mult, q_val, g_val in modes:
            y += g_val * np.sin(phase(np.minimum(SR * 0.42, f_base * mult))) * (0.45 + 0.55 * np.abs(smooth_noise(n, r, 6.5)))
        grit = bp(nz, 1800.0, 7600.0, order=2) * 0.38
        mono = (0.62 * y + grit)
    else:
        grit = bp(nz, 650.0, 4800.0, order=2)
        mono = resbank(grit, [(920.0, 16.0, 0.8), (1850.0, 18.0, 0.65), (3200.0, 20.0, 0.45)])
    # Uneven trembling finger-drag pressure envelope
    drag = (np.sin(np.pi * u) ** 0.6) * (0.42 + 0.58 * np.maximum(0.0, smooth_noise(n, r, 4.2)))
    mono = _norm_peak(fades(mono * drag, 0.03, 0.08), 0.76) * vel
    return pan(mono, pan_pos)


def lantern_sputter(dur=1.1, vel=0.36, r=None, snuff=False, pan_pos=0.18):
    """Stereo oil-lantern flame sputter/crackle, optionally ending in a sudden flame-out puff."""
    r = r or rng(1006)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    # Soft flame flutter + micro oil crackles
    flutter = lp(colored(n, r, slope=1.1), 420.0, order=2) * (0.4 + 0.6 * np.abs(smooth_noise(n, r, 9.5)))
    pops = np.zeros(n, dtype=np.float64)
    for _ in range(int(dur * 24)):
        k = int(r.integers(0, max(1, n - 300)))
        L = min(220, n - k)
        tp = np.arange(L) / SR
        pops[k : k + L] += bp(r.standard_normal(L), 1600.0, 6500.0, order=2) * np.exp(-tp / 0.004) * r.uniform(0.4, 1.0)
    mono = 0.55 * flutter + 0.72 * pops
    if snuff:
        # Sudden air-puff flame-out near the end of clip
        k0 = max(0, n - ns(0.18))
        rem = n - k0
        ts = np.arange(rem) / SR
        puff = bp(r.standard_normal(rem), 180.0, 1400.0, order=2) * np.exp(-ts / 0.045) * 1.45
        mono[k0:] = mono[k0:] * np.linspace(1.0, 0.0, rem) + puff
    env = np.sin(np.pi * u) ** 0.35 if not snuff else ramp(min(n, ns(0.05)))[np.minimum(np.arange(n), ns(0.05) - 1)]
    return pan(_norm_peak(fades(mono * env, 0.01, 0.02), 0.76) * vel, pan_pos)


# ---------------- Build-Up, Climax & Uncanny Folk Horror Pack ----------------


def reverse_suck(dur=1.05, vel=0.68, r=None, f_base=290.0):
    """Stereo breath-stealing vacuum reverse-reverb swell cutting dead on peak (pre-scare / pre-transition)."""
    r = r or rng(1007)
    n = ns(dur)
    # Synthesize forward resonant metallic/air hit, convolve with tail, then reverse in time!
    t = np.arange(n) / SR
    hit = modal(dur, [(f_base, 0.85, 0.28), (f_base * 1.414, 0.62, 0.24), (f_base * 2.33, 0.45, 0.18), (f_base * 3.87, 0.25, 0.12)], r)
    rush = bp(colored(n, r, slope=0.45), 220.0, 5200.0, order=2) * np.exp(-t / max(0.18, dur * 0.32)) * 0.85
    ir = make_ir(rt60=max(0.9, dur * 1.1), seed=int(r.integers(10, 9999)), length=dur, pre=0.004, hf=0.9, density_lp=6000)
    wet = convolve_st(hit + rush, ir)
    # Reverse time and shape with exponential inhale curve -> razor-sharp 3ms cutoff at peak!
    rev = wet[:, ::-1]
    u = t / max(dur, 1e-4)
    rev *= (u ** 2.6)[None, :]
    return _norm_peak(fades(rev, 0.03, 0.003), 0.90) * vel


def shepard_tension(dur=7.0, vel=0.34, r=None, rate_oct_per_sec=0.095, center_hz=440.0):
    """Stereo psychoacoustic Shepard-Risset endlessly-rising tension drone (ideal under dollyZoom/investigation)."""
    r = r or rng(1008)
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n), dtype=np.float64)
    n_oct = 6
    f_min = 55.0
    for k in range(n_oct):
        # Continuous cycling phase in log-frequency space
        oct_pos = (k + rate_oct_per_sec * t) % n_oct
        f_inst = f_min * (2.0 ** oct_pos)
        # Gaussian bell in log2-freq space keeps upper/lower wrap-around completely seamless & invisible
        bell = np.exp(-0.5 * ((np.log2(f_inst / center_hz)) / 1.15) ** 2)
        ph = phase(f_inst)
        # Soft dark tone (no harsh upper harmonics colliding with voice)
        sig = (np.sin(ph) + 0.18 * np.sin(2 * ph + 0.5)) * bell
        pn = -0.45 + 0.90 * (k / max(1, n_oct - 1))
        out += pan(sig, pn)
    env = _env_sr(n, 0.65, ns(max(0.5, dur - 0.5)), 0.5)
    return _norm_peak(lp(out, 2400.0, order=2) * env[None, :], 0.68) * vel


def tinnitus_ring(dur=4.5, vel=0.16, f=4120.0, r=None):
    """Stereo fragile post-shock psychological ear-ringing sine with slow eerie drift & gentle fade."""
    r = r or rng(1009)
    n = ns(dur)
    t = np.arange(n) / SR
    drift = 1.0 + 0.003 * smooth_noise(n, r, 0.4)
    L = np.sin(phase(f * drift))
    R = np.sin(phase((f + 2.6) * drift))
    env = _env_sr(n, 0.18, ns(dur * 0.25), dur * 0.75)
    return _norm_peak(np.stack([L, R]) * env[None, :], 0.65) * vel


def whoosh_dark(dur=0.65, vel=0.55, r=None, pan_from=-0.65, pan_to=0.65):
    """Stereo deep horror transition whoosh for dramatic scale/angle cuts."""
    r = r or rng(1010)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    env = np.sin(np.pi * u) ** 1.4
    nz = colored(n, r, slope=0.9)
    f_track = lambda T: 140.0 + 980.0 * np.sin(np.pi * np.clip(T / max(dur, 1e-4), 0.0, 1.0)) ** 1.3
    air = shape(nz, lambda T, F: np.exp(-0.5 * (np.log2(np.maximum(F[:, None], 25.0) / f_track(T)[None, :]) / 0.65) ** 2), 1024, 256)
    sub = np.sin(phase(72.0 - 28.0 * u)) * (np.sin(np.pi * u) ** 2.2) * 0.55
    mono = (air + sub) * env
    p_traj = pan_from + (pan_to - pan_from) * u
    th = (np.clip(p_traj, -1.0, 1.0) + 1.0) * np.pi * 0.25
    out = np.stack([mono * np.cos(th), mono * np.sin(th)]) * np.sqrt(2.0)
    return _norm_peak(fades(out, 0.015, 0.03), 0.85) * vel


def entity_rattle(dur=2.1, vel=0.58, r=None, pan_from=-0.6, pan_to=0.6, kind="drowned"):
    """Stereo inhuman horror vocalization: 'drowned' (wet throat rattle/gurgle) or 'shriek_gasp' (distorted screech-inhale)."""
    r = r or rng(1011)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    if kind == "drowned":
        # Irregular glottal death-rattle pulse train + wet bubbling water modulation + eerie shifted formants
        f_glot = 54.0 + 26.0 * smooth_noise(n, r, 3.2) - 14.0 * u
        glot = np.maximum(0.0, np.sin(phase(np.maximum(28.0, f_glot)))) ** 7
        wet_bub = 0.55 + 0.45 * np.sin(TAU * (18.0 + 9.0 * smooth_noise(n, r, 2.5)) * t)
        src = (glot * 0.85 + bp(colored(n, r, slope=0.3), 240.0, 3400.0, order=2) * 0.45) * wet_bub
        voiced = resbank(src, [(340.0, 7.0, 0.9), (920.0, 9.0, 0.75), (2150.0, 11.0, 0.52), (3350.0, 12.0, 0.30)])
        mono = np.tanh(voiced * 1.9) * (np.sin(np.pi * u) ** 0.65)
    else:
        # Raspy distorted screech-gasp for climax lunge (never cheesy cartoon monster roar!)
        f_scr = 480.0 * (1.35 - 0.48 * u) + 55.0 * smooth_noise(n, r, 7.5)
        carrier = np.sin(phase(f_scr)) + 0.55 * np.sin(phase(f_scr * 1.49)) + 0.35 * np.sin(phase(f_scr * 2.13))
        rasp = bp(colored(n, r, slope=0.15), 900.0, 5800.0, order=2)
        src = np.tanh((0.58 * carrier + 0.68 * rasp) * 2.4)
        voiced = resbank(src, [(740.0, 6.0, 0.8), (1680.0, 8.0, 0.95), (2950.0, 10.0, 0.72)])
        env = (1.0 - np.exp(-t / 0.025)) * np.exp(-t / max(0.35, dur * 0.42))
        mono = voiced * env
    p_traj = pan_from + (pan_to - pan_from) * u
    th = (np.clip(p_traj, -1.0, 1.0) + 1.0) * np.pi * 0.25
    out = np.stack([mono * np.cos(th), mono * np.sin(th)]) * np.sqrt(2.0)
    return _norm_peak(fades(out, 0.012, 0.06), 0.88) * vel


def lightning_close(dur=4.4, vel=0.95, r=None):
    """Stereo two-stage close lightning strike: razor-sharp 0-75ms electric arc tear -> chest-shaking sub thunder roll."""
    r = r or rng(1012)
    n = ns(dur)
    t = np.arange(n) / SR
    # Stage 1: Immediate blinding electric air-rip snap (0..80ms)
    arc_burst = bp(r.standard_normal(n), 850.0, 9500.0, order=2) * np.exp(-t / 0.028)
    # Jagged multi-leader crackling spikes in first 120ms
    cracks = np.zeros(n, dtype=np.float64)
    for dt_k, amp_k in ((0.0, 1.0), (0.019, 0.75), (0.044, 0.62), (0.088, 0.42)):
        k0 = ns(dt_k)
        L = min(ns(0.05), n - k0)
        if L > 4:
            tk = np.arange(L) / SR
            cracks[k0 : k0 + L] += bp(r.standard_normal(L), 450.0, 6200.0, order=2) * np.exp(-tk / 0.011) * amp_k
    snap = 0.85 * arc_burst + 1.15 * cracks

    # Stage 2: Huge rolling sub-bass thunder wave blooming right after snap
    roll_nz = lp(colored(n, r, slope=1.85, lo=22.0), 195.0, order=2)
    mid_nz = bp(colored(n, r, slope=1.2), 140.0, 950.0, order=2) * np.exp(-t / 0.65)
    sub_boom = np.sin(phase(46.0 * (1.0 + 1.2 * np.exp(-t / 0.06)))) * np.exp(-t / 0.55) * 0.65
    roll_env = (1.0 - np.exp(-t / 0.035)) * np.exp(-t / max(1.0, dur * 0.36))
    roll_mod = 0.68 + 0.32 * smooth_noise(n, r, 1.7)
    thunder_L = snap * 0.85 + (roll_nz * 1.45 + mid_nz * 0.65) * roll_env * roll_mod + sub_boom
    thunder_R = np.roll(snap, ns(0.006)) * 0.85 + (lp(colored(n, r, slope=1.85, lo=22.0), 205.0, order=2) * 1.45 + mid_nz * 0.55) * roll_env * (0.68 + 0.32 * smooth_noise(n, r, 1.9)) + sub_boom
    out = np.stack([thunder_L, thunder_R])
    return _norm_peak(fades(out, 0.0005, 0.12), 0.95) * vel


def folk_wail(f0=293.66, dur=4.2, vel=0.34, r=None, bend_semi=-2.5, pan_pos=0.22):
    """Stereo haunting Vietnamese bowed erhu / dan bau microtonal mourning wail."""
    r = r or rng(1013)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    # Slow sorrowful pitch slide + trembling crying vibrato (5.4 Hz)
    vib = 24.0 * np.sin(TAU * 5.4 * t) * (u ** 0.7)
    slide = bend_semi * 100.0 * (0.5 - 0.5 * np.cos(np.pi * np.clip((u - 0.25) / 0.55, 0.0, 1.0)))
    f_inst = np.maximum(60.0, f0 * (2.0 ** ((slide + vib + 7.0 * smooth_noise(n, r, 1.5)) / 1200.0)))
    ph = phase(f_inst)
    # Expressive nasal bowed string harmonics (odd-rich like erhu / dan nhi)
    y = np.zeros(n, dtype=np.float64)
    for k, amp in ((1, 1.0), (2, 0.42), (3, 0.68), (4, 0.22), (5, 0.34), (6, 0.14), (7, 0.16)):
        y += amp * np.sin(k * ph + r.uniform(0, 0.4))
    # Subtle bow rosin breath + nasal wooden soundbox formant
    rosin = bp(colored(n, r, slope=0.5), f0 * 1.8, min(6200.0, f0 * 11.0), order=2) * 0.16
    y = resbank(y + rosin, [(f0 * 1.5, 2.2, 0.65), (1150.0, 3.2, 0.85), (2450.0, 4.5, 0.45)])
    env = _env_sr(n, 0.55, ns(max(0.6, dur - 0.9)), 0.9)
    mono = _norm_peak(fades(y * env, 0.02, 0.08), 0.78) * vel
    return pan(mono, pan_pos)


def woodblock_omen(times, vel=0.42, r=None, f=580.0, pan_pos=-0.28):
    """Stereo hollow dry wooden village/temple omen knocks ('mõ gỗ')."""
    r = r or rng(1014)
    if not times:
        return np.zeros((2, ns(0.1)), dtype=np.float64)
    total_dur = float(max(times)) + 0.55
    out = np.zeros((2, ns(total_dur)), dtype=np.float64)
    for idx, t0 in enumerate(times):
        fk = f * r.uniform(0.97, 1.03)
        hit = modal(0.32, [(fk, 1.0, 0.052), (fk * 1.58, 0.62, 0.036), (fk * 2.74, 0.34, 0.018), (fk * 4.2, 0.16, 0.009)], r)
        click = bp(r.standard_normal(len(hit)), 1600.0, 5200.0, order=2) * np.exp(-tt(0.32) / 0.0025) * 0.35
        knock = _norm_peak(fades(hit + click, 0.0003, 0.03), 0.85) * r.uniform(0.85, 1.05)
        st_k = pan(knock, pan_pos + (0.08 if idx % 2 else -0.08))
        k = ns(t0)
        m = min(st_k.shape[1], out.shape[1] - k)
        if k >= 0 and m > 0:
            out[:, k : k + m] += st_k[:, :m]
    return _norm_peak(out, 0.82) * vel


# ---------------- Horror Engine v5.0: PSX VHS & Body-Horror SFX Pack ----------------

def vhs_static_burst(dur=0.45, vel=0.55, r=None):
    """Stereo sharp VHS magnetic tape-tear & tracking snow burst synced to RetroPsxEffect tapeTear/aberration."""
    r = r or rng(1015)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    # 60 Hz head-switch hum + granular analog snow burst + sharp horizontal tear crackle
    hum = (np.sin(TAU * 60.0 * t) * 0.35 + np.sin(TAU * 180.0 * t) * 0.22) * (0.6 + 0.4 * smooth_noise(n, r, 24.0))
    snow_L = bp(r.standard_normal(n), 900.0, 8800.0, order=2)
    snow_R = bp(r.standard_normal(n), 950.0, 9000.0, order=2)
    gate = (smooth_noise(n, r, 42.0) > -0.15).astype(np.float64)
    crackle = bp(r.standard_normal(n) * (r.random(n) > 0.985), 1400.0, 9500.0, order=2) * 2.2
    env = (np.sin(np.pi * u) ** 0.55) * (0.45 + 0.55 * gate)
    L = (hum + snow_L * 0.72 + crackle) * env
    R = (hum + snow_R * 0.72 + np.roll(crackle, ns(0.002))) * env
    return _norm_peak(fades(np.stack([L, R]), 0.006, 0.018), 0.86) * vel


def flashlight_click_sputter(dur=0.60, vel=0.65, r=None, kind="off"):
    """Stereo tactile metal flashlight switch click + dying electrical sputter synced to torchMalfunction blackouts."""
    r = r or rng(1016)
    n = ns(dur)
    t = np.arange(n) / SR
    # Crisp 2-stage mechanical spring click (housing transient + spring snap 14ms later)
    click1 = modal(min(0.08, dur), [(1850.0, 1.0, 0.004), (3920.0, 0.75, 0.0025), (6100.0, 0.45, 0.0018)], r)
    click2 = modal(min(0.08, dur), [(2350.0, 0.9, 0.0035), (4850.0, 0.68, 0.0020)], r)
    mono = np.zeros(n, dtype=np.float64)
    c1_pos = ns(0.01) if kind == "on" else ns(max(0.02, dur * 0.55))
    c2_pos = c1_pos + ns(0.014)
    for pos, seg, amp in ((c1_pos, click1, 1.0), (c2_pos, click2, 0.72)):
        m = min(len(seg), n - pos)
        if pos >= 0 and m > 0:
            mono[pos : pos + m] += seg[:m] * amp
    # Faulty contact electrical sputter arcs before failing or right after snapping back on
    sp_start = 0 if kind == "off" else ns(0.025)
    sp_len = min(n - sp_start, ns(dur * 0.50))
    if sp_len > 16:
        ts = np.arange(sp_len) / SR
        pulses = (smooth_noise(sp_len, r, 38.0) > 0.25).astype(np.float64)
        buzz = (np.sin(TAU * 120.0 * ts) * 0.35 + bp(r.standard_normal(sp_len), 1800.0, 7600.0, order=2) * 0.75) * pulses
        mono[sp_start : sp_start + sp_len] += buzz * 0.42 * np.exp(-ts / max(0.08, dur * 0.32))
    return _norm_peak(pan(fades(mono, 0.002, 0.015), 0.18), 0.88) * vel


def neck_crack_wet(dur=0.55, vel=0.72, r=None):
    """Stereo unsettling bone-pop + wet sinew twist synced to Jacob's Ladder head-twitch / broken-neck snaps."""
    r = r or rng(1017)
    n = ns(dur)
    t = np.arange(n) / SR
    mono = np.zeros(n, dtype=np.float64)
    # 3 staggered bone/cartilage snaps
    for dt_k, f_base, amp in ((0.015, 640.0, 1.0), (0.068, 920.0, 0.76), (0.142, 510.0, 0.85)):
        k0 = ns(dt_k)
        L = min(ns(0.09), n - k0)
        if L > 8:
            tk = np.arange(L) / SR
            snap = modal(L / SR, [(f_base, 1.0, 0.006), (f_base * 2.18, 0.78, 0.0035), (f_base * 4.1, 0.45, 0.002)], r)[:L]
            crunch = bp(r.standard_normal(L), 900.0, 4800.0, order=2) * np.exp(-tk / 0.009) * 0.55
            mono[k0 : k0 + L] += (snap + crunch) * amp
    # Low wet sinew stretch under-layer
    wet = bp(colored(n, r, slope=0.4), 220.0, 1650.0, order=2) * (0.5 + 0.5 * np.sin(TAU * 24.0 * t)) * np.exp(-t / 0.22) * 0.28
    mono = np.tanh((mono + wet) * 1.45)
    return _norm_peak(pan(fades(mono, 0.001, 0.04), -0.10), 0.90) * vel


def fly_buzz_loop(dur=3.5, vel=0.22, r=None):
    """Stereo erratic buzzing dark flies panning uneasily across ears (synced to SwarmingFlies3D)."""
    r = r or rng(1018)
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n), dtype=np.float64)
    for fi, f_wing in enumerate((192.0, 224.0, 248.0)):
        f_mod = f_wing * (1.0 + 0.09 * smooth_noise(n, r, 4.2 + fi * 1.3))
        ph = phase(f_mod)
        # Buzzy sawtooth-like insect wing harmonic stack
        wing = np.zeros(n, dtype=np.float64)
        for h in range(1, 7):
            wing += (1.0 / (h ** 0.72)) * np.sin(h * ph + fi * 0.7)
        wing = bp(wing, 180.0, 3200.0, order=2)
        prox = np.clip(0.35 + 0.65 * smooth_noise(n, r, 1.8 + fi * 0.6), 0.08, 1.0) ** 1.6
        p_traj = np.clip(smooth_noise(n, r, 1.1 + fi * 0.5) * 1.15, -0.92, 0.92)
        th = (p_traj + 1.0) * np.pi * 0.25
        out[0] += wing * prox * np.cos(th)
        out[1] += wing * prox * np.sin(th)
    return _norm_peak(fades(out, 0.15, 0.20), 0.72) * vel


# ---------------- Horror Engine v13.0: Subtle Psychological & Intimate Soundscape Pack ----------------

def clock_tick_irregular(dur=6.0, bpm=60.0, vel=0.34, r=None, mode="steady_then_stop", pan_pos=0.18):
    """Tactile mechanical clock escapement tick-tock supporting psychological pattern breaks."""
    r = r or rng(1301)
    n = ns(dur)
    mono = np.zeros(n, dtype=np.float64)
    tick_a = fades(modal(0.065, [(1880.0, 0.9, 0.007), (3340.0, 0.48, 0.0038), (620.0, 0.25, 0.012)], r), 0.0002, 0.01)
    tick_b = fades(modal(0.065, [(1490.0, 0.82, 0.008), (2620.0, 0.42, 0.0042), (540.0, 0.22, 0.014)], r), 0.0002, 0.01)
    base_dt = 60.0 / max(20.0, float(bpm))
    limit_t = dur * 0.72 if mode == "steady_then_stop" else dur - 0.08
    t_cur = 0.06
    idx = 0
    while t_cur < limit_t:
        u = np.clip(t_cur / max(0.1, limit_t), 0.0, 1.0)
        seg = tick_a if idx % 2 == 0 else tick_b
        k = ns(t_cur)
        m = min(len(seg), n - k)
        if m > 0:
            mono[k : k + m] += seg[:m] * r.uniform(0.88, 1.05)
        if mode == "accelerate":
            dt = base_dt * (1.0 - 0.58 * (u ** 1.3))
        elif mode == "decelerate":
            dt = base_dt * (1.0 + 1.35 * (u ** 1.5))
        elif mode == "stutter_break" and u > 0.72 and idx % 3 == 2:
            dt = base_dt * 0.34
        else:
            dt = base_dt
        t_cur += max(0.14, dt + r.uniform(-0.006, 0.006))
        idx += 1
    return _norm_peak(pan(mono, pan_pos), 0.78) * vel


def wood_settle_subtle(dur=1.6, vel=0.28, r=None, pan_pos=-0.35):
    """Quiet nighttime old-house timber contraction micro-creaks (subtle room presence, never cartoon squeaks)."""
    r = r or rng(1302)
    n = ns(dur)
    mono = np.zeros(n, dtype=np.float64)
    n_knots = max(2, int(round(dur * 2.5)))
    for i in range(n_knots):
        t0 = (i + r.uniform(0.15, 0.85)) * (dur / n_knots) * 0.88
        k0 = ns(t0)
        rem = min(ns(0.16), n - k0)
        if rem > 16:
            f0 = r.uniform(145.0, 390.0)
            pop = modal(rem / SR, [(f0, 0.9, 0.022), (f0 * 1.92, 0.52, 0.012), (f0 * 3.4, 0.22, 0.006)], r)[:rem]
            mono[k0 : k0 + rem] += fades(pop, 0.001, 0.02) * r.uniform(0.45, 1.0)
    return _norm_peak(pan(mono, pan_pos), 0.72) * vel


def breath_close_ear(dur=1.1, vel=0.32, r=None, kind="held_exhale", pan_pos=0.68):
    """Intimate, zero-static human breath right beside one ear for uncanny hush moments."""
    r = r or rng(1303)
    n = ns(dur)
    t = np.arange(n) / SR
    u = t / max(dur, 1e-4)
    nz = colored(n, r, slope=0.55)
    if kind == "shiver_inhale":
        env = (u ** 0.55) * np.exp(-np.maximum(0.0, u - 0.72) * 9.0) * (0.82 + 0.18 * np.sin(TAU * 7.5 * t))
        tract = resbank(nz, [(480.0, 3.8, 0.85), (1380.0, 4.5, 0.65), (2650.0, 5.5, 0.38)])
    else:
        env = np.sin(np.pi * u) ** 0.75 * np.exp(-u * 0.9)
        tract = resbank(nz, [(390.0, 3.2, 0.95), (1120.0, 4.0, 0.62), (2280.0, 5.0, 0.28)])
    air = lp(hp(tract, 130.0, order=2), 4800.0, order=2) * env
    return _norm_peak(pan(fades(air, 0.03, 0.06), pan_pos), 0.74) * vel
