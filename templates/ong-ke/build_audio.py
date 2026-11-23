#!/usr/bin/env python3
"""Procedural horror sound design & music score for OngKeShort (71.17s / 2135 frames @ 30fps).

Dual acoustic spaces: echoing timber 3-bay hall (rt60=1.70s) -> claustrophobic bolted bedroom (rt60=0.58s)
with acoustic storm-rain occlusion, exact [DEAD SILENCE] gating, and -15.0 LUFS / <= -1.2 dBTP mastering.
"""

import json
import os
import sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "audio"))

from dsp import SR, ns, rng, bp, lp, fades, pan, dbg, make_ir, convolve_st, ramp
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

TOTAL_FRAMES = 2135
FPS = 30
DUR = TOTAL_FRAMES / FPS  # 71.1667s


def add_at(buf, clip, t_sec, gain=1.0, pan_pos=None):
    if clip.ndim == 1:
        clip = pan(clip, 0.0 if pan_pos is None else pan_pos)
    elif pan_pos is not None:
        clip = pan(clip.mean(0), pan_pos)
    k0 = ns(t_sec)
    if k0 >= buf.shape[1]:
        return
    src0 = max(0, -k0)
    dst0 = max(0, k0)
    m = min(clip.shape[1] - src0, buf.shape[1] - dst0)
    if m > 0:
        buf[:, dst0 : dst0 + m] += clip[:, src0 : src0 + m] * gain


def apply_dead_silence_gate(buf, silences, floor_db=-50.0):
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

    # Dual acoustic spaces: echoing 3-bay timber hall vs. tight bolted inner bedroom
    hall_ir = make_ir(
        rt60=1.70,
        seed=404,
        hf=1.40,
        early=[(0.018, 0.30, -0.40), (0.042, 0.20, 0.42)],
        density_lp=3600,
    )
    bed_ir = make_ir(
        rt60=0.58,
        seed=505,
        hf=1.70,
        early=[(0.008, 0.36, -0.35), (0.014, 0.28, 0.35), (0.024, 0.16, 0.0)],
        density_lp=2500,
    )

    music_dry = np.zeros((2, n_total), dtype=np.float64)
    music_send_hall = np.zeros((2, n_total), dtype=np.float64)
    music_send_bed = np.zeros((2, n_total), dtype=np.float64)

    sfx_dry = np.zeros((2, n_total), dtype=np.float64)
    sfx_hits = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_hall = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_bed = np.zeros((2, n_total), dtype=np.float64)

    def add_m(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="hall"):
        add_at(music_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(music_send_hall if space == "hall" else music_send_bed, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    def add_s(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="hall", hit=False):
        add_at(sfx_hits if hit else sfx_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(sfx_send_hall if space == "hall" else sfx_send_bed, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    # =========================================================================
    # 1. MUSIC STEM (Sparse in narration, intense in build-up & climaxes -> healthy LRA)
    # =========================================================================
    # Root pitch locked to F1 (43.65 Hz) & D1 (36.71 Hz)
    add_m(sub_drone(f=43.65, dur=25.5, vel=0.22, r=rng(101), att=1.4, rel=1.5), 0.0)
    add_m(sub_drone(f=36.71, dur=11.0, vel=0.30, r=rng(102), att=0.8, rel=0.35), 26.5)
    add_m(sub_drone(f=32.70, dur=15.5, vel=0.44, r=rng(103), att=0.2, rel=1.4), 38.48)
    add_m(sub_drone(f=36.71, dur=15.5, vel=0.28, r=rng(104), att=0.9, rel=1.5), 54.4)

    # Vietnamese folk horror signature: haunting đàn nhị wails + childhood lullaby musicbox
    add_m(folk_wail(f0=293.66, dur=4.2, vel=0.20, r=rng(1401), bend_semi=-2.2, pan_pos=0.30), 4.2, rev=0.55, space="hall")
    add_m(folk_wail(f0=311.13, dur=3.8, vel=0.30, r=rng(1402), bend_semi=2.0, pan_pos=-0.35), 43.2, rev=0.55, space="hall")
    add_m(folk_wail(f0=277.18, dur=4.8, vel=0.28, r=rng(1403), bend_semi=-3.0, pan_pos=0.26), 65.8, rev=0.50, space="bed")

    # Eerie detuned antique music-box lullaby motif (evokes child alone in dark house)
    mb_notes = [
        (0.40, 77, 0.22, -0.24, "hall"),
        (2.15, 76, 0.18, 0.22, "hall"),
        (3.85, 81, 0.20, -0.15, "hall"),
        (9.80, 77, 0.18, -0.22, "hall"),
        (11.65, 76, 0.17, 0.24, "hall"),
        (13.50, 74, 0.19, -0.18, "hall"),
        (21.60, 77, 0.22, -0.28, "hall"),
        (23.35, 75, 0.24, 0.25, "hall"),
        # Bedroom twist
        (61.50, 77, 0.20, -0.24, "bed"),
        (63.10, 76, 0.21, 0.24, "bed"),
        (64.80, 81, 0.22, -0.18, "bed"),
        (67.20, 75, 0.24, 0.20, "bed"),
        (69.20, 74, 0.26, 0.0, "bed"),
    ]
    for idx, (t0, midi_n, vel, pn, sp) in enumerate(mb_notes):
        note = scary_musicbox(f=m2f(midi_n), vel=vel, r=rng(300 + idx), dur=2.3, detune_cents=-18.0 - (idx % 3) * 4)
        add_m(note, t0, gain=1.0, pan_pos=pn, rev=0.52 if sp == "hall" else 0.40, space=sp)

    # Bowed waterphone scrapes on uncanny beats
    add_m(bowed_metal(f=207.65, dur=3.5, vel=0.18, r=rng(210), bend_semi=1.6), 22.2, pan_pos=-0.35, rev=0.48, space="hall")
    add_m(bowed_metal(f=233.08, dur=4.0, vel=0.22, r=rng(211), bend_semi=-2.0), 32.0, pan_pos=0.32, rev=0.50, space="hall")
    add_m(bowed_metal(f=196.00, dur=4.0, vel=0.22, r=rng(212), bend_semi=-1.8), 63.8, pan_pos=0.28, rev=0.45, space="bed")

    # Shepard endlessly-rising tension under dollyZoom investigation (Shot 4-5: 26.8s..37.6s)
    add_m(shepard_tension(dur=10.8, vel=0.22, r=rng(1201), rate_oct_per_sec=0.095, center_hz=420.0), 26.8)

    # Tense dissonant strings (buildup -> ferocious climax -> twist)
    add_m(horror_strings(freqs=(146.83, 155.56, 207.65), dur=10.2, vel=0.18, r=rng(701)), 27.2, rev=0.35, space="hall")
    add_m(horror_strings(freqs=(130.81, 138.59, 185.00, 246.94), dur=12.8, vel=0.38, r=rng(702), sul_pont=0.66), 38.55, rev=0.40, space="hall")
    add_m(horror_strings(freqs=(146.83, 155.56, 220.00), dur=8.2, vel=0.26, r=rng(703), sul_pont=0.54), 62.2, rev=0.35, space="bed")

    music = music_dry + 0.58 * convolve_st(music_send_hall, hall_ir) + 0.54 * convolve_st(music_send_bed, bed_ir)
    music = apply_dead_silence_gate(music, dead_silences, floor_db=-52.0)
    spans = speech_spans(words, merge=0.30)
    duck_gain = dbg(duck_db(spans, DUR, depth=-5.4, pre=0.08, post=0.14))
    music *= duck_gain[None, :] * 0.86

    # =========================================================================
    # 2. SFX STEM (Foley + Build-Up + Dual-Space Occlusion + Climaxes)
    # =========================================================================
    # --- A. Environmental Beds with Acoustic Occlusion ---
    # Muffled rain outside wooden hall (0..37.7s), slightly louder during storm climax (38.48..54.07s),
    # then deeply low-passed behind bolted bedroom walls (54.07..71.17s)!
    rain_hall_1 = lp(ambience_night(dur=37.7, kind="rain", vel=0.16, r=rng(801)), 1250.0, order=2)
    add_s(rain_hall_1, 0.0)
    add_s(ambience_night(dur=37.7, kind="room_tone", vel=0.13, r=rng(802)), 0.0)

    rain_storm = lp(ambience_night(dur=15.8, kind="rain", vel=0.24, r=rng(803)), 2200.0, order=2)
    add_s(rain_storm, 38.48)

    rain_bed_raw = ambience_night(dur=17.2, kind="rain", vel=0.17, r=rng(804))
    rain_bed_muffled = lp(rain_bed_raw, 400.0, order=3)
    r_env = np.ones(rain_bed_muffled.shape[1], dtype=np.float64)
    k_slam = ns(54.24 - 54.07)
    f_occl = ns(0.14)
    r_env[:k_slam] = 0.72
    r_env[k_slam : k_slam + f_occl] = np.linspace(0.72, 0.30, f_occl)
    r_env[k_slam + f_occl :] = 0.30
    add_s(rain_bed_muffled * r_env[None, :], 54.07)
    add_s(ambience_night(dur=17.1, kind="room_tone", vel=0.14, r=rng(805)), 54.07)

    # --- B. Action Foley Locked Directly to Exact Word Timestamps ---
    # Shot 2: Small cautious creeping footsteps on dark wooden floorboards (9.8s..15.8s)
    add_s(
        footsteps_wood([0.1, 0.92, 1.78, 2.60, 3.45, 4.30, 5.18], vel=0.30, r=rng(1101), frantic=False),
        9.80,
        rev=0.28,
        space="hall",
    )
    # Shot 3: THREE HOLLOW DRY KNOCKS inside wooden wardrobe right at "cộc, cộc, cộc" (18.30s, 18.93s, 19.50s)!
    add_s(
        woodblock_omen([0.0, 0.63, 1.20], vel=0.66, r=rng(1102), f=430.0, pan_pos=0.06),
        18.27,
        rev=0.45,
        space="hall",
        hit=True,
    )
    # Wardrobe door slowly creaking ajar ("Cánh tủ khẽ hé" 22.56s) + wet mud drip from burlap sack (24.13s)
    add_s(ambience_night(dur=1.4, kind="creak", vel=0.36, r=rng(1103)), 22.15, rev=0.40, space="hall")
    add_s(wet_drip([0.0, 0.85, 1.75], vel=0.34, r=rng(1104), pans=[0.14, 0.08, 0.18]), 24.05, rev=0.42, space="hall")

    # Shot 4: Oil lamp uneasy flicker (29.8s..30.7s) + wardrobe creak as grey fingers pull open (32.2s..35.8s)
    add_s(lantern_sputter(dur=0.90, vel=0.32, r=rng(1105), snuff=False, pan_pos=-0.12), 29.80, rev=0.20, space="hall")
    add_s(nail_scrape(dur=1.45, vel=0.30, r=rng(1106), surface="wood", pan_pos=0.16), 32.15, rev=0.38, space="hall")
    add_s(ambience_night(dur=1.35, kind="creak", vel=0.34, r=rng(1107)), 34.45, rev=0.38, space="hall")
    # Lamp snuffs out right at "rồi ngọn đèn tắt phụt" (37.22s) -> into DEAD SILENCE!
    add_s(lantern_sputter(dur=0.54, vel=0.42, r=rng(1108), snuff=True, pan_pos=-0.08), 37.14)

    # Shot 8: Frantic fleeing steps running to inner bedroom (51.8s..54.0s)
    add_s(
        footsteps_wood([0.05, 0.34, 0.64, 0.94, 1.25, 1.56, 1.88], vel=0.46, r=rng(1109), frantic=True),
        51.80,
        rev=0.32,
        space="hall",
    )
    # Shot 9: Heavy bedroom door slam ("sập mạnh cửa" 54.24s) + wooden crossbar bolt ("cài chặt then gỗ" 55.33s)!
    add_s(door_slam_bolt(vel=0.92, r=rng(1110), bolt_delay=1.06), 54.21, rev=0.42, space="bed", hit=True)
    # Subliminal fingernail scrape outside dark bedroom window + eerie cold mud drips inside bedroom!
    add_s(nail_scrape(dur=1.35, vel=0.22, r=rng(1111), surface="glass", pan_pos=-0.68), 57.50, rev=0.45, space="bed")
    add_s(wet_drip([0.1, 1.35, 2.55, 3.85, 5.20], vel=0.34, r=rng(1112), pans=[0.20, -0.16, 0.25, -0.10, 0.16]), 62.60, rev=0.52, space="bed")

    # --- C. Dark Cut Whooshes, Spectral Whispers, Heartbeats, Risers & Reverse Sucks ---
    add_s(whoosh_dark(dur=0.50, vel=0.28, r=rng(1301), pan_from=-0.5, pan_to=0.5), 9.25)   # S1 -> S2
    add_s(whoosh_dark(dur=0.48, vel=0.32, r=rng(1302), pan_from=0.5, pan_to=-0.5), 26.45)  # S3 -> S4
    add_s(whoosh_dark(dur=0.46, vel=0.34, r=rng(1303), pan_from=-0.5, pan_to=0.5), 31.65)  # S4 -> S5
    add_s(whoosh_dark(dur=0.52, vel=0.40, r=rng(1304), pan_from=0.5, pan_to=-0.5), 51.70)  # S7 -> S8

    add_s(whisper_ghost(dur=1.5, vel=0.24, r=rng(901), pan_from=-0.65, pan_to=0.55), 6.40, rev=0.52, space="hall")
    add_s(whisper_ghost(dur=1.8, vel=0.28, r=rng(902), pan_from=0.55, pan_to=-0.55), 31.20, rev=0.52, space="hall")
    add_s(whisper_ghost(dur=2.1, vel=0.30, r=rng(903), pan_from=-0.42, pan_to=0.42), 66.85, rev=0.50, space="bed")

    add_s(heartbeat(bpm=68.0, dur=10.5, vel=0.34, r=rng(601), accel_to=130.0), 27.00, pan_pos=0.0)
    add_s(heartbeat(bpm=82.0, dur=8.8, vel=0.32, r=rng(602), accel_to=124.0), 61.60, pan_pos=0.0)

    # Tension risers + breath-stealing reverse sucks before every major turn!
    add_s(riser(dur=3.20, f0=85.0, f1=980.0, vel=0.44, r=rng(401), hard_cut=True), 34.56, hit=True)
    add_s(reverse_suck(dur=1.00, vel=0.62, r=rng(1311), f_base=310.0), 36.76, hit=True)  # cuts dead into DEAD SILENCE!
    add_s(reverse_suck(dur=0.62, vel=0.64, r=rng(1312), f_base=370.0), 48.42, hit=True)  # sucks into climax lunge!
    add_s(riser(dur=2.20, f0=95.0, f1=880.0, vel=0.36, r=rng(402), hard_cut=True), 66.05, hit=True)
    add_s(reverse_suck(dur=0.92, vel=0.58, r=rng(1313), f_base=275.0), 67.38, hit=True)  # sucks into eyes-under-bed twist!

    # Post-shock psychological tinnitus ear-ringing
    add_s(tinnitus_ring(dur=3.4, vel=0.13, f=4160.0, r=rng(1321)), 55.45)  # right after bolting bedroom door
    add_s(tinnitus_ring(dur=4.4, vel=0.16, f=4020.0, r=rng(1322)), 66.60)  # frozen dread seeing eyes under bed

    # --- D. High-Impact Climax Hits (Unducked hits bus!) ---
    # 1. f=1154 (38.47s): Post-Dead-Silence CLOSE LIGHTNING CRACK + BOOM!
    add_s(lightning_close(dur=4.1, vel=0.92, r=rng(850)), 38.46, rev=0.36, space="hall", hit=True)
    add_s(stinger(kind="boom", vel=0.78, r=rng(510), dur=2.6, f0=44.0), 38.46, rev=0.30, space="hall", hit=True)

    # 2. f=1266 (42.20s): Wardrobe doors burst open ("Cánh tủ bật tung") + 2nd lightning + drowned entity rattle!
    add_s(lightning_close(dur=3.5, vel=0.72, r=rng(851)), 42.19, rev=0.34, space="hall", hit=True)
    add_s(stinger(kind="cluster_stab", vel=0.46, r=rng(511), dur=2.2), 42.19, rev=0.40, space="hall", hit=True)
    add_s(entity_rattle(dur=2.2, vel=0.52, r=rng(1501), pan_from=-0.55, pan_to=0.55, kind="drowned"), 42.55, rev=0.48, space="hall", hit=True)

    # 3. f=1471 (49.03s): Climax lunge ("chộp thẳng về phía cậu bé") — BOOM + SHRIEK + SHRIEK-GASP!
    add_s(stinger(kind="boom", vel=0.88, r=rng(512), dur=2.6, f0=43.0), 49.03, rev=0.34, space="hall", hit=True)
    add_s(stinger(kind="shriek", vel=0.50, r=rng(513), dur=2.0), 49.04, rev=0.44, space="hall", hit=True)
    add_s(entity_rattle(dur=1.6, vel=0.54, r=rng(1502), pan_from=-0.45, pan_to=0.45, kind="shriek_gasp"), 49.06, rev=0.46, space="hall", hit=True)

    # 4. f=1928 (64.27s) & f=2049 (68.30s): Final bed burlap sack & glaring under-bed eyes reveal!
    add_s(stinger(kind="cluster_stab", vel=0.42, r=rng(514), dur=2.0), 64.26, rev=0.40, space="bed", hit=True)
    add_s(stinger(kind="braam", vel=0.78, r=rng(515), dur=3.2, f0=43.65), 68.29, rev=0.42, space="bed", hit=True)

    sfx_rev = 0.54 * convolve_st(sfx_send_hall, hall_ir) + 0.50 * convolve_st(sfx_send_bed, bed_ir)
    sfx_duck = dbg(duck_db(spans, DUR, depth=-2.5, pre=0.06, post=0.10))
    sfx = (sfx_dry * 0.70 + sfx_rev * 0.64) * sfx_duck[None, :] + sfx_hits * 0.58
    sfx = apply_dead_silence_gate(sfx, dead_silences, floor_db=-54.0)

    # =========================================================================
    # 3. VOICE ATMOSPHERIC POLISH (Dry crisp center + faint -17.5 dB halo on final twist!)
    # =========================================================================
    voice = voice_dry.copy()
    k_tw = ns(66.40)
    if k_tw < n_total:
        twist_slice = np.zeros_like(voice_dry)
        twist_slice[:, k_tw:] = voice_dry[:, k_tw:]
        twist_fade = min(ns(0.15), n_total - k_tw)
        twist_slice[:, k_tw : k_tw + twist_fade] *= ramp(twist_fade)[None, :]
        ghost_tail = convolve_st(bp(twist_slice, 260.0, 4600.0, order=2), hall_ir)
        pd = ns(0.085)
        if pd < n_total:
            voice[:, pd:] += ghost_tail[:, : n_total - pd] * dbg(-17.5)

    # =========================================================================
    # 4. MASTER MIX (-15.0 LUFS, ceil_db=-1.5 so AAC 192k stays safely <= -1.2 dBTP)
    # =========================================================================
    final_mix, stems, stats = master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.4, fade_out=0.08)
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
