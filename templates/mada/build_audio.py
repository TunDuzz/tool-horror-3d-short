#!/usr/bin/env python3
"""Cinema-grade procedural horror sound design & music score generator for MadaShort v2.5 (74.20s / 2226 frames @ 30fps).

Features all 5 Horror Audio Cinema Pillars:
  1. Action Foley: wooden pier footsteps (slow & frantic flee), taut rope strain, door slam + crossbar bolt, wet floor drips, window nail scrapes, oil lantern sputter/snuff.
  2. Build-up & Transitions: vacuum reverse_suck, endlessly rising shepard_tension, post-shock tinnitus_ring, dark cut whooshes.
  3. High-Impact Climaxes: 2-stage close lightning crack/thunder, inhuman drowned entity_rattle, dynamic contrast (LRA ~4.5-6.5 LU).
  4. Dual Acoustic Spaces (Convolution IR + Occlusion): vast misty wharf reverb -> tight wooden shack interior with muffled low-pass exterior storm rain.
  5. Vietnamese Folk Horror Texture & Final Voice Atmosphere: mourning folk_wail (dan nhi/erhu), ominous woodblock_omen (mõ gỗ), and faint haunting voice reverb tail on the final twist sentence.
"""

import json
import os
import sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "audio"))

from dsp import SR, ns, rng, bp, lp, fades, pan, widen, dbg, make_ir, convolve_st, ramp
from horror_instruments import (
    m2f,
    sub_drone,
    bowed_metal,
    scary_musicbox,
    riser,
    stinger,
    heartbeat,
    horror_strings,
    ambience_night,
    whisper_ghost,
    footsteps_wood,
    rope_strain,
    door_slam_bolt,
    wet_drip,
    nail_scrape,
    lantern_sputter,
    reverse_suck,
    shepard_tension,
    tinnitus_ring,
    whoosh_dark,
    entity_rattle,
    lightning_close,
    folk_wail,
    woodblock_omen,
)
from mix_base import (
    load_voice,
    speech_spans,
    duck_db,
    master_mix,
    write_mix_and_stems,
    ffmpeg_ebur,
)

TOTAL_FRAMES = 2226
FPS = 30
DUR = TOTAL_FRAMES / FPS  # 74.20s


def add_at(buf, clip, t_sec, gain=1.0, pan_pos=None):
    """Mix mono or stereo `clip` into stereo `buf` at `t_sec`."""
    if clip.ndim == 1:
        clip = pan(clip, 0.0 if pan_pos is None else pan_pos)
    elif pan_pos is not None:
        clip = pan(clip.mean(0), pan_pos)
    k0 = max(0, ns(t_sec))
    if k0 >= buf.shape[1]:
        return
    m = min(clip.shape[1], buf.shape[1] - k0)
    if m > 0:
        buf[:, k0 : k0 + m] += clip[:, :m] * gain


def synth_water_slosh(dur=0.95, vel=0.45, seed=111):
    """Procedural river water slosh / splash for boat and Ma Da emergence."""
    r = rng(seed)
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.exp(-t / (dur * 0.34)) * (1.0 - np.exp(-t / 0.015))
    body = bp(r.standard_normal(n), 180.0, 1450.0, order=2) * env
    bubbles = (
        bp(r.standard_normal(n), 650.0, 3200.0, order=2)
        * np.exp(-t / (dur * 0.22))
        * (0.5 + 0.5 * np.sin(2 * np.pi * 16.0 * t))
    )
    mono = fades(lp(body + 0.55 * bubbles, 2800.0), 0.008, 0.06)
    pk = float(np.max(np.abs(mono))) or 1.0
    return widen((mono / pk) * vel, r, ms=12.0, amount=0.65)


def apply_dead_silence_gate(buf, silences, floor_db=-48.0):
    """Carve music/sfx to near-silence during [DEAD SILENCE] windows with crisp pre-cut and post-recovery."""
    n = buf.shape[1]
    env = np.ones(n, dtype=np.float64)
    floor_lin = dbg(floor_db)
    fade_n = ns(0.016)
    for ds in silences:
        s0 = max(0, ns(float(ds["s"])))
        e0 = min(n, ns(float(ds["e"])))
        if e0 <= s0:
            continue
        env[s0:e0] = floor_lin
        f_in = min(fade_n, e0 - s0)
        if f_in > 1:
            env[s0 : s0 + f_in] = np.linspace(1.0, floor_lin, f_in)
            env[e0 - f_in : e0] = np.linspace(floor_lin, 1.0, f_in)
    return buf * env[None, :]


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    voice_dir = os.path.abspath(os.path.join(out_dir, "..", "voice"))
    voice_wav = os.path.join(voice_dir, "voice.wav")
    words_json = os.path.join(voice_dir, "words.json")

    with open(words_json, encoding="utf-8") as fp:
        meta = json.load(fp)
    words = meta["words"]
    dead_silences = meta.get("dead_silences", [])

    voice_dry = load_voice(voice_wav, DUR)
    n_total = voice_dry.shape[1]

    # Dual acoustic spaces: vast misty river wharf vs. claustrophobic bolted wooden watchman's shack
    wharf_ir = make_ir(
        rt60=2.35,
        seed=77,
        hf=1.35,
        early=[(0.028, 0.25, -0.45), (0.062, 0.16, 0.50)],
        density_lp=3800,
    )
    shack_ir = make_ir(
        rt60=0.65,
        seed=88,
        hf=1.65,
        early=[(0.008, 0.36, -0.35), (0.015, 0.28, 0.35), (0.026, 0.18, 0.0)],
        density_lp=2600,
    )

    music_dry = np.zeros((2, n_total), dtype=np.float64)
    music_send_wharf = np.zeros((2, n_total), dtype=np.float64)
    music_send_shack = np.zeros((2, n_total), dtype=np.float64)

    sfx_dry = np.zeros((2, n_total), dtype=np.float64)
    sfx_hits = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_wharf = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_shack = np.zeros((2, n_total), dtype=np.float64)

    def add_m(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="wharf"):
        add_at(music_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(music_send_wharf if space == "wharf" else music_send_shack, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    def add_s(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="wharf", hit=False):
        add_at(sfx_hits if hit else sfx_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(sfx_send_wharf if space == "wharf" else sfx_send_shack, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    # =========================================================================
    # 1. MUSIC STEM (Sparse in narration, intense in build-up & climaxes -> wider LRA!)
    # =========================================================================
    # Sub-bass drones across 3 acts (lighter in Act 1 so Act 2/3 hits feel massive)
    add_m(sub_drone(f=41.20, dur=24.2, vel=0.26, r=rng(101), att=1.5, rel=1.6), 0.0)
    add_m(sub_drone(f=36.71, dur=12.0, vel=0.34, r=rng(102), att=0.9, rel=0.35), 25.2)
    add_m(sub_drone(f=32.70, dur=20.0, vel=0.46, r=rng(103), att=0.2, rel=1.6), 38.15)
    add_m(sub_drone(f=36.71, dur=15.0, vel=0.30, r=rng(104), att=0.9, rel=1.5), 58.6)

    # Vietnamese Folk Horror texture: ominous wooden 'mõ gỗ' knocks + mourning erhu/dan-nhi wails
    add_m(woodblock_omen([0.25, 2.35, 4.55], vel=0.28, r=rng(1401), f=560.0, pan_pos=-0.35), 0.0, rev=0.52, space="wharf")
    add_m(folk_wail(f0=293.66, dur=4.4, vel=0.22, r=rng(1402), bend_semi=-2.2, pan_pos=0.32), 4.6, rev=0.60, space="wharf")
    # Haunting shrieking folk wail under Ma Da emergence & final footprint twist!
    add_m(folk_wail(f0=311.13, dur=3.8, vel=0.30, r=rng(1403), bend_semi=1.8, pan_pos=-0.38), 42.9, rev=0.58, space="wharf")
    add_m(folk_wail(f0=277.18, dur=4.8, vel=0.28, r=rng(1404), bend_semi=-3.0, pan_pos=0.28), 69.0, rev=0.55, space="shack")
    add_m(woodblock_omen([0.1, 1.55], vel=0.30, r=rng(1405), f=520.0, pan_pos=-0.22), 71.1, rev=0.55, space="shack")

    # Detuned antique music-box motif bathed in space reverb
    mb_notes = [
        (0.55, 76, 0.20, -0.25, "wharf"),
        (2.40, 77, 0.17, 0.25, "wharf"),
        (4.25, 81, 0.19, -0.15, "wharf"),
        (9.30, 79, 0.16, -0.20, "wharf"),
        (16.20, 76, 0.22, -0.32, "wharf"),
        (18.00, 77, 0.20, 0.30, "wharf"),
        (19.80, 81, 0.22, -0.20, "wharf"),
        (21.65, 75, 0.24, 0.22, "wharf"),
        # Act 3 lingering twist in shack
        (64.40, 76, 0.20, -0.24, "shack"),
        (66.20, 77, 0.19, 0.24, "shack"),
        (67.95, 81, 0.21, -0.15, "shack"),
        (70.50, 75, 0.24, 0.20, "shack"),
        (72.30, 76, 0.26, 0.0, "shack"),
    ]
    for idx, (t0, midi_n, vel, pn, sp) in enumerate(mb_notes):
        note = scary_musicbox(f=m2f(midi_n), vel=vel, r=rng(300 + idx), dur=2.4, detune_cents=-18.0 - (idx % 3) * 4)
        add_m(note, t0, gain=1.0, pan_pos=pn, rev=0.58 if sp == "wharf" else 0.42, space=sp)

    # Eerie bowed waterphone scrapes on uncanny cues
    add_m(bowed_metal(f=196.0, dur=3.8, vel=0.19, r=rng(210), bend_semi=1.8), 18.8, pan_pos=-0.35, rev=0.52, space="wharf")
    add_m(bowed_metal(f=233.08, dur=4.2, vel=0.22, r=rng(211), bend_semi=-2.1), 29.0, pan_pos=0.35, rev=0.52, space="wharf")
    add_m(bowed_metal(f=185.0, dur=4.5, vel=0.26, r=rng(212), bend_semi=2.4), 51.0, pan_pos=-0.25, rev=0.55, space="wharf")
    add_m(bowed_metal(f=207.65, dur=4.0, vel=0.22, r=rng(213), bend_semi=-1.9), 66.2, pan_pos=0.25, rev=0.45, space="shack")

    # Endlessly rising Shepard tension during Vertigo dollyZoom investigation (Shot 4-5: 25.6s..36.8s)
    add_m(shepard_tension(dur=11.0, vel=0.22, r=rng(1201), rate_oct_per_sec=0.09, center_hz=410.0), 25.8)

    # Tense dissonant tremolo strings (lean in buildup, ferocious in climax!)
    add_m(horror_strings(freqs=(146.83, 155.56, 207.65), dur=10.5, vel=0.20, r=rng(701)), 26.2, rev=0.35, space="wharf")
    add_m(horror_strings(freqs=(130.81, 138.59, 185.00, 246.94), dur=11.2, vel=0.38, r=rng(702), sul_pont=0.64), 38.22, rev=0.40, space="wharf")
    add_m(horror_strings(freqs=(146.83, 155.56, 220.00), dur=8.2, vel=0.26, r=rng(703), sul_pont=0.54), 65.2, rev=0.35, space="shack")

    music = music_dry + 0.62 * convolve_st(music_send_wharf, wharf_ir) + 0.58 * convolve_st(music_send_shack, shack_ir)
    music = apply_dead_silence_gate(music, dead_silences, floor_db=-48.0)
    spans = speech_spans(words, merge=0.30)
    duck_gain = dbg(duck_db(spans, DUR, depth=-5.2, pre=0.08, post=0.14))
    music *= duck_gain[None, :] * 0.88

    # =========================================================================
    # 2. SFX STEM (Foley + Build-up/Transitions + Acoustic Occlusion + Climax)
    # =========================================================================
    # --- A. Environmental Beds with Uncanny Stillness & Shack Acoustic Occlusion ---
    # River wind (0..37.3s), dipping eerily silent when narration says "bỗng đứng lặng như tờ" (15.7s..22.5s)!
    wind_bed = ambience_night(dur=37.3, kind="wind", vel=0.14, r=rng(801))
    w_len = wind_bed.shape[1]
    w_env = np.ones(w_len, dtype=np.float64)
    s_still, e_still = ns(15.7), ns(22.6)
    f_dip = ns(0.6)
    w_env[s_still:e_still] = 0.18
    w_env[s_still - f_dip : s_still] = np.linspace(1.0, 0.18, f_dip)
    w_env[e_still : e_still + f_dip] = np.linspace(0.18, 1.0, f_dip)
    add_s(wind_bed * w_env[None, :], 0.0)

    # Storm rain (38.15..74.2s): wide open outside (38.15..58.63s), then muffled through shack walls (58.63..74.2s),
    # dropping even further behind closed bolted door at 61.67s!
    rain_ext = ambience_night(dur=20.6, kind="rain", vel=0.22, r=rng(802))
    add_s(rain_ext, 38.15)

    rain_shack_raw = ambience_night(dur=15.6, kind="rain", vel=0.18, r=rng(804))
    rain_muffled = lp(rain_shack_raw, 420.0, order=3)
    r_env = np.ones(rain_muffled.shape[1], dtype=np.float64)
    k_slam = ns(61.67 - 58.63)  # door slams shut inside shack -> outside storm drops deeper!
    f_occl = ns(0.12)
    r_env[k_slam : k_slam + f_occl] = np.linspace(0.75, 0.32, f_occl)
    r_env[k_slam + f_occl :] = 0.32
    r_env[:k_slam] = 0.75
    add_s(rain_muffled * r_env[None, :], 58.63)

    # Claustrophobic dark shack room tone (58.63..74.2s)
    add_s(ambience_night(dur=15.5, kind="room_tone", vel=0.15, r=rng(803)), 58.63)

    # --- B. Action Foley Synced Directly to Visuals ---
    # Shot 2 (OTS walking slowly onto creaking wooden pier: 8.7s..14.8s)
    add_s(
        footsteps_wood([0.1, 0.85, 1.62, 2.38, 3.15, 3.92, 4.72, 5.55], vel=0.34, r=rng(1101), frantic=False),
        8.75,
        rev=0.25,
        space="wharf",
    )
    # Shot 4 lantern flicker sputter (f=878..904 = 29.27s..30.13s)
    add_s(lantern_sputter(dur=0.95, vel=0.34, r=rng(1102), snuff=False, pan_pos=0.15), 29.22, rev=0.2, space="wharf")
    # Shot 5 taut hemp mooring rope groaning under pale drowned hand (33.0s..36.2s)
    add_s(rope_strain(dur=2.9, vel=0.44, r=rng(1103)), 33.05, pan_pos=0.22, rev=0.30, space="wharf")
    # Shot 5 lantern sputters & snuffs out right into [DEAD SILENCE] (f=1112..1128 = 37.07s..37.60s)
    add_s(lantern_sputter(dur=0.56, vel=0.38, r=rng(1104), snuff=True, pan_pos=0.10), 36.82)
    # Shot 8 frantic sprinting wooden pier footsteps fleeing Ma Da (50.2s..58.2s)
    flee_steps = [0.15 + i * 0.31 + (0.04 if i % 2 else 0.0) for i in range(24)]
    add_s(
        footsteps_wood(flee_steps, vel=0.46, r=rng(1105), frantic=True, pan_traj=lambda i, n: -0.25 + 0.50 * (i / max(1, n - 1))),
        50.15,
        rev=0.28,
        space="wharf",
    )
    # Shot 9 frantic indoor steps rushing to door (58.9s..61.1s) + HEAVY DOOR SLAM & WOODEN CROSSBAR BOLT at f=1850 (61.67s)!
    add_s(footsteps_wood([0.05, 0.34, 0.65, 0.98, 1.32, 1.66], vel=0.44, r=rng(1106), frantic=True), 58.95, rev=0.35, space="shack")
    add_s(door_slam_bolt(vel=0.90, r=rng(1107), bolt_delay=0.34), 61.33, rev=0.42, space="shack", hit=True)
    # Shot 9 & 10 subliminal fingernails scraping outside dark shack window (matches fxWindowHand!)
    add_s(nail_scrape(dur=1.25, vel=0.20, r=rng(1108), surface="glass", pan_pos=-0.68), 62.65, rev=0.45, space="shack")
    add_s(nail_scrape(dur=1.55, vel=0.22, r=rng(1109), surface="glass", pan_pos=-0.72), 65.60, rev=0.45, space="shack")
    # Shot 10 chilling cold water/mud drips echoing inside silent shack right before footprint reveal!
    add_s(wet_drip([0.2, 1.45, 2.65, 3.70, 5.85, 7.60], vel=0.36, r=rng(1110), pans=[0.18, -0.15, 0.24, -0.10, 0.14, -0.18]), 64.20, rev=0.55, space="shack")

    # Wooden pier & boat creaks
    for idx, (tc, vel) in enumerate([(11.2, 0.22), (13.6, 0.20), (26.4, 0.22), (35.3, 0.30)]):
        add_s(ambience_night(dur=1.3, kind="creak", vel=vel, r=rng(820 + idx)), tc, rev=0.35, space="wharf")

    # Water sloshes tied to visual beats
    add_s(synth_water_slosh(dur=0.90, vel=0.38, seed=501), 23.15, rev=0.35, space="wharf")  # hat bumps bow (f=698)
    add_s(synth_water_slosh(dur=1.10, vel=0.50, seed=502), 35.45, rev=0.38, space="wharf")  # hand yanks bow (f=1068)
    add_s(synth_water_slosh(dur=1.35, vel=0.46, seed=503), 42.40, rev=0.40, space="wharf")  # Ma Da rises
    add_s(synth_water_slosh(dur=1.25, vel=0.58, seed=504), 46.80, rev=0.42, space="wharf")  # climax lunge splash

    # --- C. Build-up, Dark Cut Whooshes, Reverse Vacuum Sucks & Tinnitus ---
    # Subtle cinematic dark cut whooshes on major camera-scale pivots
    add_s(whoosh_dark(dur=0.55, vel=0.30, r=rng(1301), pan_from=-0.5, pan_to=0.5), 8.32)   # S1 WS -> S2 OTS
    add_s(whoosh_dark(dur=0.52, vel=0.32, r=rng(1302), pan_from=0.5, pan_to=-0.5), 25.28)  # S3 LOW -> S4 MCU
    add_s(whoosh_dark(dur=0.48, vel=0.36, r=rng(1303), pan_from=-0.6, pan_to=0.6), 32.12)  # S4 MCU -> S5 ECU POV
    add_s(whoosh_dark(dur=0.58, vel=0.42, r=rng(1304), pan_from=0.6, pan_to=-0.6), 49.70)  # S7 CU -> S8 Reverse WS

    # Spectral whispers panned across stereo with haunting river/shack reverb
    add_s(whisper_ghost(dur=1.6, vel=0.24, r=rng(901), pan_from=-0.68, pan_to=0.58), 3.55, rev=0.55, space="wharf")
    add_s(whisper_ghost(dur=1.8, vel=0.26, r=rng(902), pan_from=0.62, pan_to=-0.62), 17.50, rev=0.55, space="wharf")
    add_s(whisper_ghost(dur=1.7, vel=0.28, r=rng(903), pan_from=-0.52, pan_to=0.68), 32.80, rev=0.55, space="wharf")
    add_s(whisper_ghost(dur=2.1, vel=0.30, r=rng(904), pan_from=-0.45, pan_to=0.45), 68.85, rev=0.50, space="shack")

    # Accelerating heartbeats
    add_s(heartbeat(bpm=66.0, dur=11.0, vel=0.34, r=rng(601), accel_to=128.0), 26.25, pan_pos=0.0)
    add_s(heartbeat(bpm=118.0, dur=8.4, vel=0.36, r=rng(603), accel_to=138.0), 50.10, pan_pos=0.0)
    add_s(heartbeat(bpm=78.0, dur=8.8, vel=0.32, r=rng(602), accel_to=116.0), 64.60, pan_pos=0.0)

    # Tension risers + breath-stealing REVERSE SUCKS before every major horror turn!
    add_s(riser(dur=3.35, f0=85.0, f1=980.0, vel=0.46, r=rng(401), hard_cut=True), 33.98, hit=True)
    add_s(reverse_suck(dur=1.05, vel=0.62, r=rng(1311), f_base=310.0), 36.28, hit=True)  # cuts dead right into DEAD SILENCE!
    add_s(reverse_suck(dur=0.62, vel=0.66, r=rng(1312), f_base=380.0), 46.20, hit=True)  # sucks right into climax ankle lunge!
    add_s(reverse_suck(dur=0.82, vel=0.46, r=rng(1313), f_base=240.0), 57.82, hit=True)  # pulls across dipBlack into shack!
    add_s(riser(dur=2.25, f0=95.0, f1=880.0, vel=0.38, r=rng(402), hard_cut=True), 66.58, hit=True)
    add_s(reverse_suck(dur=0.95, vel=0.60, r=rng(1314), f_base=275.0), 67.90, hit=True)  # sucks right into footprint twist!

    # Post-adrenaline / dread tinnitus ear-ringing
    add_s(tinnitus_ring(dur=3.8, vel=0.14, f=4180.0, r=rng(1321)), 61.72)  # right after slamming shack door
    add_s(tinnitus_ring(dur=4.8, vel=0.17, f=4040.0, r=rng(1322)), 68.92)  # frozen dread staring at wet footprints

    # --- D. High-Impact Climax Hits & Uncanny Entity Vocalizations (UNDUCKED hits bus for true cinema shock!) ---
    # 1. f=1145 (38.16s): Post-Dead-Silence CLOSE LIGHTNING CRACK + BOOM + DROWNED ENTITY RATTLE!
    add_s(lightning_close(dur=4.3, vel=0.92, r=rng(850)), 38.15, rev=0.38, space="wharf", hit=True)
    add_s(stinger(kind="boom", vel=0.78, r=rng(510), dur=2.6, f0=46.0), 38.15, rev=0.32, space="wharf", hit=True)
    add_s(entity_rattle(dur=2.3, vel=0.52, r=rng(1501), pan_from=-0.65, pan_to=0.55, kind="drowned"), 38.55, rev=0.52, space="wharf", hit=True)

    # 2. f=1280 (42.67s): Second close lightning + cluster stab + drowned rattle
    add_s(lightning_close(dur=3.6, vel=0.72, r=rng(851)), 42.66, rev=0.34, space="wharf", hit=True)
    add_s(stinger(kind="cluster_stab", vel=0.48, r=rng(511), dur=2.2), 42.66, rev=0.42, space="wharf", hit=True)
    add_s(entity_rattle(dur=1.9, vel=0.48, r=rng(1502), pan_from=0.55, pan_to=-0.50, kind="drowned"), 43.10, rev=0.50, space="wharf", hit=True)

    # 3. f=1405 (46.83s): PEAK CLIMAX ANKLE GRAB ("chộp cứng lấy cổ chân") — BOOM + SHRIEK + ENTITY SHRIEK-GASP!
    add_s(stinger(kind="boom", vel=0.88, r=rng(512), dur=2.8, f0=43.0), 46.83, rev=0.34, space="wharf", hit=True)
    add_s(stinger(kind="shriek", vel=0.52, r=rng(513), dur=2.1), 46.84, rev=0.45, space="wharf", hit=True)
    add_s(entity_rattle(dur=1.7, vel=0.56, r=rng(1503), pan_from=-0.45, pan_to=0.45, kind="shriek_gasp"), 46.86, rev=0.48, space="wharf", hit=True)

    # Trailing haunting drowned rattle echoing behind Ông Tư as he flees up the pier (Shot 8)
    add_s(entity_rattle(dur=2.2, vel=0.36, r=rng(1504), pan_from=0.45, pan_to=-0.45, kind="drowned"), 53.40, rev=0.65, space="wharf")

    # 4. f=2066 (68.87s): FINAL TWIST REVEAL ("Ngay sau lưng ông, hai dấu chân ướt sũng bùn đen")
    add_s(stinger(kind="braam", vel=0.74, r=rng(514), dur=3.4, f0=41.20), 68.86, rev=0.42, space="shack", hit=True)

    sfx_rev = 0.56 * convolve_st(sfx_send_wharf, wharf_ir) + 0.52 * convolve_st(sfx_send_shack, shack_ir)
    # Duck ambient/foley beds & reverb gently under voice, while climax hits & risers punch through unducked!
    sfx_duck = dbg(duck_db(spans, DUR, depth=-2.4, pre=0.06, post=0.10))
    sfx = (sfx_dry * 0.72 + sfx_rev * 0.68) * sfx_duck[None, :] + sfx_hits * 0.86
    sfx = apply_dead_silence_gate(sfx, dead_silences, floor_db=-52.0)

    # =========================================================================
    # 3. VOICE ATMOSPHERIC POLISH (Dry crystal-clear center + faint haunting tail on final twist!)
    # =========================================================================
    voice = voice_dry.copy()
    # Add a delicate -18 dB ghostly reverb halo strictly on the chilling final sentence (68.5s..74.0s)
    k_tw = ns(68.50)
    if k_tw < n_total:
        twist_slice = np.zeros_like(voice_dry)
        twist_slice[:, k_tw:] = voice_dry[:, k_tw:]
        twist_fade = min(ns(0.15), n_total - k_tw)
        twist_slice[:, k_tw : k_tw + twist_fade] *= ramp(twist_fade)[None, :]
        ghost_tail = convolve_st(bp(twist_slice, 260.0, 4600.0, order=2), wharf_ir)
        # Subtle 85ms pre-delay so dry voice stays 100% crisp while ghostly shadow lingers wide behind it
        pd = ns(0.085)
        if pd < n_total:
            voice[:, pd:] += ghost_tail[:, : n_total - pd] * dbg(-17.5)

    # =========================================================================
    # 4. MASTER MIX (-15.0 LUFS, <= -1.2 dBTP, Cinematic Horror LRA)
    # =========================================================================
    final_mix, stems, stats = master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2)
    write_mix_and_stems(out_dir, final_mix, stems)

    with open(os.path.join(out_dir, "mix_stats.json"), "w", encoding="utf-8") as fp:
        json.dump(stats, fp, indent=2)

    print(
        f"MIX OK -> {os.path.join(out_dir, 'mix.wav')} | "
        f"I={stats['I']:.2f} LUFS | TP={stats['TP']:.2f} dBTP | LRA={stats['LRA']:.2f} LU | "
        f"Mmax={stats['Mmax']:.2f} | GRmax={stats['gr']['max']:.2f} dB | "
        f"voice={stats['voice_I']:.1f} | music={stats['music_I']:.1f} | sfx={stats['sfx_I']:.1f}"
    )
    print(ffmpeg_ebur(os.path.join(out_dir, "mix.wav")))


if __name__ == "__main__":
    main()
