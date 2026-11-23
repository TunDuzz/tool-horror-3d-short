#!/usr/bin/env python3
"""Procedural horror sound design & music score for MaXoShort (74.10s / 2223 frames @ 30fps).

Dual acoustic spaces: clay-and-timber country kitchen (rt60=0.98s) <-> echoing 3-bay timber hall (rt60=1.65s)
with exact [DEAD SILENCE] gating (38.44s..39.09s), Vietnamese folk texture, and -15.0 LUFS / <= -1.2 dBTP mastering.
"""

import gc
import json
import os
import sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "audio"))

from dsp import SR, ns, rng, bp, lp, pan, dbg, make_ir, convolve_st, ramp
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

TOTAL_FRAMES = 2223
FPS = 30
DUR = TOTAL_FRAMES / FPS  # 74.1000s


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


def apply_dead_silence_gate(buf, silences, floor_db=-54.0):
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

    # Dual acoustic spaces: clay-and-timber country kitchen vs hollow main 3-bay timber hall
    kit_ir = make_ir(
        rt60=0.98,
        seed=601,
        hf=1.55,
        early=[(0.010, 0.34, -0.35), (0.024, 0.24, 0.35), (0.040, 0.14, 0.0)],
        density_lp=3000,
    )
    hall_ir = make_ir(
        rt60=1.65,
        seed=602,
        hf=1.38,
        early=[(0.018, 0.30, -0.42), (0.044, 0.20, 0.42)],
        density_lp=3600,
    )

    music_dry = np.zeros((2, n_total), dtype=np.float64)
    music_send_kit = np.zeros((2, n_total), dtype=np.float64)
    music_send_hall = np.zeros((2, n_total), dtype=np.float64)

    sfx_dry = np.zeros((2, n_total), dtype=np.float64)
    sfx_hits = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_kit = np.zeros((2, n_total), dtype=np.float64)
    sfx_send_hall = np.zeros((2, n_total), dtype=np.float64)

    def add_m(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="kit"):
        add_at(music_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(music_send_kit if space == "kit" else music_send_hall, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    def add_s(clip, t_sec, gain=1.0, pan_pos=None, rev=0.0, space="kit", hit=False):
        add_at(sfx_hits if hit else sfx_dry, clip, t_sec, gain=gain, pan_pos=pan_pos)
        if rev > 0:
            add_at(sfx_send_kit if space == "kit" else sfx_send_hall, clip, t_sec, gain=gain * rev, pan_pos=pan_pos)

    # =========================================================================
    # 1. MUSIC STEM (Sub drones + Vietnamese folk đàn nhị + detuned music box + Shepard + strings)
    # =========================================================================
    add_m(sub_drone(f=43.65, dur=26.5, vel=0.22, r=rng(201), att=1.4, rel=1.4), 0.0)
    add_m(sub_drone(f=36.71, dur=11.0, vel=0.30, r=rng(202), att=0.8, rel=0.35), 27.2)
    add_m(sub_drone(f=32.70, dur=18.2, vel=0.42, r=rng(203), att=0.2, rel=1.4), 39.12)
    add_m(sub_drone(f=36.71, dur=15.5, vel=0.28, r=rng(204), att=0.9, rel=1.5), 58.2)

    # Haunting Vietnamese đàn nhị mourning motifs
    add_m(folk_wail(f0=293.66, dur=4.4, vel=0.20, r=rng(1601), bend_semi=-2.4, pan_pos=0.32), 4.5, rev=0.52, space="kit")
    add_m(folk_wail(f0=311.13, dur=3.8, vel=0.28, r=rng(1602), bend_semi=2.2, pan_pos=-0.34), 44.0, rev=0.54, space="hall")
    add_m(folk_wail(f0=261.63, dur=5.2, vel=0.26, r=rng(1603), bend_semi=-2.8, pan_pos=0.28), 61.2, rev=0.56, space="hall")
    add_m(folk_wail(f0=277.18, dur=4.6, vel=0.28, r=rng(1604), bend_semi=-3.0, pan_pos=-0.26), 69.0, rev=0.50, space="kit")

    # Eerie antique music-box notes evoking an empty ancestral house
    mb_notes = [
        (0.45, 76, 0.20, -0.24, "kit"),
        (2.30, 74, 0.18, 0.22, "kit"),
        (4.10, 79, 0.19, -0.18, "kit"),
        (11.10, 76, 0.18, -0.22, "kit"),
        (13.05, 74, 0.17, 0.24, "kit"),
        (15.20, 72, 0.18, -0.18, "kit"),
        (61.80, 76, 0.19, -0.24, "hall"),
        (63.80, 74, 0.20, 0.24, "hall"),
        (66.90, 79, 0.22, -0.18, "kit"),
        (69.20, 73, 0.24, 0.20, "kit"),
        (71.60, 72, 0.25, 0.0, "kit"),
    ]
    for idx, (t0, midi_n, vel, pn, sp) in enumerate(mb_notes):
        note = scary_musicbox(f=m2f(midi_n), vel=vel, r=rng(400 + idx), dur=2.4, detune_cents=-19.0 - (idx % 3) * 4)
        add_m(note, t0, gain=1.0, pan_pos=pn, rev=0.46 if sp == "kit" else 0.54, space=sp)

    # Bowed waterphone scrapes on uncanny cues
    add_m(bowed_metal(f=207.65, dur=3.5, vel=0.18, r=rng(310), bend_semi=1.6), 23.4, pan_pos=-0.34, rev=0.46, space="kit")
    add_m(bowed_metal(f=233.08, dur=4.0, vel=0.22, r=rng(311), bend_semi=-2.0), 32.8, pan_pos=0.30, rev=0.48, space="kit")
    add_m(bowed_metal(f=196.00, dur=4.4, vel=0.22, r=rng(312), bend_semi=-1.8), 68.4, pan_pos=0.26, rev=0.46, space="kit")

    # Shepard endlessly-rising tension during investigation & bare footprints (28.3s..38.3s)
    add_m(shepard_tension(dur=10.0, vel=0.22, r=rng(1201), rate_oct_per_sec=0.095, center_hz=420.0), 28.3)

    # Tense dissonant strings
    add_m(horror_strings(freqs=(146.83, 155.56, 207.65), dur=9.8, vel=0.18, r=rng(701)), 28.5, rev=0.35, space="kit")
    add_m(horror_strings(freqs=(130.81, 138.59, 185.00, 246.94), dur=14.5, vel=0.36, r=rng(702), sul_pont=0.66), 39.20, rev=0.42, space="hall")
    add_m(horror_strings(freqs=(146.83, 155.56, 220.00), dur=8.2, vel=0.25, r=rng(703), sul_pont=0.52), 65.5, rev=0.36, space="kit")

    music = music_dry + 0.54 * convolve_st(music_send_kit, kit_ir) + 0.58 * convolve_st(music_send_hall, hall_ir)
    del music_dry, music_send_kit, music_send_hall
    gc.collect()
    music = apply_dead_silence_gate(music, dead_silences, floor_db=-52.0)
    spans = speech_spans(words, merge=0.30)
    duck_gain = dbg(duck_db(spans, DUR, depth=-5.4, pre=0.08, post=0.14))
    music *= duck_gain[None, :] * 0.86

    # =========================================================================
    # 2. SFX STEM (Foley Locked to Exact Word Timestamps + Climaxes)
    # =========================================================================
    # Environmental beds: hushed night country room tone + distant muffled night rain
    add_s(lp(ambience_night(dur=38.3, kind="rain", vel=0.14, r=rng(801)), 1050.0, order=2), 0.0)
    add_s(ambience_night(dur=38.3, kind="room_tone", vel=0.14, r=rng(802)), 0.0)
    add_s(lp(ambience_night(dur=20.5, kind="rain", vel=0.22, r=rng(803)), 2000.0, order=2), 39.12)
    add_s(lp(ambience_night(dur=14.4, kind="rain", vel=0.15, r=rng(804)), 950.0, order=2), 59.65)
    add_s(ambience_night(dur=14.4, kind="room_tone", vel=0.14, r=rng(805)), 59.65)

    # Shot 2: Lan's quiet footsteps stepping into cold kitchen (11.2s..17.4s)
    add_s(
        footsteps_wood([0.2, 1.05, 1.92, 2.78, 3.65, 4.55, 5.45], vel=0.28, r=rng(1101), frantic=False),
        11.20,
        rev=0.28,
        space="kit",
    )

    # Shot 3: Broom sweeping ash (18.2s) + chipped ceramic bowl flipped upright (19.85s)
    add_s(whoosh_dark(dur=0.68, vel=0.30, r=rng(1102), pan_from=-0.35, pan_to=0.35), 18.25, rev=0.25, space="kit")
    add_s(woodblock_omen([0.0, 0.24], vel=0.62, r=rng(1103), f=760.0, pan_pos=0.16), 19.86, rev=0.38, space="kit", hit=True)
    # Hearth embers snuffing cold ("Bếp than vụt tắt" 23.25s) + fingernails scratching ash ("móng tay cào tro" 26.40s)
    add_s(lantern_sputter(dur=0.78, vel=0.44, r=rng(1104), snuff=True, pan_pos=-0.22), 23.22, rev=0.30, space="kit")
    add_s(nail_scrape(dur=1.65, vel=0.36, r=rng(1105), surface="wood", pan_pos=0.22), 26.38, rev=0.40, space="kit")

    # Shot 4-5: Eerie cold drips + oil lamp sputter & snuff into DEAD SILENCE (37.40s -> 38.44s!)
    add_s(wet_drip([0.2, 1.45, 2.85], vel=0.28, r=rng(1106), pans=[0.18, -0.14, 0.22]), 29.80, rev=0.40, space="kit")
    add_s(lantern_sputter(dur=0.72, vel=0.44, r=rng(1107), snuff=True, pan_pos=0.04), 37.50)

    # Shot 8: Frantic dash back to kitchen + chipped bowl slammed back upside-down (54.00s) + ash scatter
    add_s(footsteps_wood([0.05, 0.36, 0.68, 1.02, 1.38], vel=0.40, r=rng(1108), frantic=True), 51.60, rev=0.32, space="kit")
    add_s(woodblock_omen([0.0, 0.16], vel=0.68, r=rng(1109), f=620.0, pan_pos=0.14), 53.98, rev=0.42, space="kit", hit=True)

    # Shot 10: Quiet midnight steps + white cold rice bowl gently placed down (68.15s) + eerie dry ceramic drag into nook (71.50s)
    add_s(woodblock_omen([0.0], vel=0.44, r=rng(1110), f=820.0, pan_pos=0.08), 68.14, rev=0.44, space="kit")
    add_s(nail_scrape(dur=2.15, vel=0.36, r=rng(1111), surface="wood", pan_pos=0.25), 71.45, rev=0.48, space="kit")

    # Dark transition whooshes, whispers, heartbeats, risers & reverse sucks
    add_s(whoosh_dark(dur=0.50, vel=0.28, r=rng(1301), pan_from=-0.5, pan_to=0.5), 10.25)
    add_s(whoosh_dark(dur=0.48, vel=0.30, r=rng(1302), pan_from=0.5, pan_to=-0.5), 28.10)
    add_s(whoosh_dark(dur=0.46, vel=0.32, r=rng(1303), pan_from=-0.5, pan_to=0.5), 31.65)
    add_s(whoosh_dark(dur=0.52, vel=0.34, r=rng(1304), pan_from=0.5, pan_to=-0.5), 51.30)

    add_s(whisper_ghost(dur=1.6, vel=0.24, r=rng(901), pan_from=-0.62, pan_to=0.56), 6.20, rev=0.50, space="kit")
    add_s(whisper_ghost(dur=1.8, vel=0.28, r=rng(902), pan_from=0.55, pan_to=-0.55), 32.50, rev=0.50, space="kit")
    add_s(whisper_ghost(dur=2.2, vel=0.28, r=rng(903), pan_from=-0.45, pan_to=0.45), 69.80, rev=0.52, space="kit")

    add_s(heartbeat(bpm=70.0, dur=10.0, vel=0.32, r=rng(601), accel_to=132.0), 28.20, pan_pos=0.0)
    add_s(heartbeat(bpm=78.0, dur=8.2, vel=0.30, r=rng(602), accel_to=118.0), 65.40, pan_pos=0.0)

    # Risers + breath-stealing reverse sucks before Dead Silence, climax grab & final hand drag
    add_s(riser(dur=3.20, f0=85.0, f1=980.0, vel=0.42, r=rng(401), hard_cut=True), 35.18, hit=True)
    add_s(reverse_suck(dur=1.00, vel=0.58, r=rng(1311), f_base=310.0), 37.42, hit=True)  # cuts dead into DEAD SILENCE!
    add_s(reverse_suck(dur=0.64, vel=0.60, r=rng(1312), f_base=360.0), 46.78, hit=True)  # sucks into hallway grab!
    add_s(riser(dur=2.10, f0=95.0, f1=860.0, vel=0.34, r=rng(402), hard_cut=True), 69.40, hit=True)
    add_s(reverse_suck(dur=0.90, vel=0.54, r=rng(1313), f_base=270.0), 70.65, hit=True)

    # Post-shock psychological tinnitus
    add_s(tinnitus_ring(dur=3.4, vel=0.13, f=4120.0, r=rng(1321)), 57.60)
    add_s(tinnitus_ring(dur=3.8, vel=0.14, f=3980.0, r=rng(1322)), 69.90)

    # High-impact climax hits (calibrated sfx_hits * 0.56 so GRmax < 3.0 dB!)
    # 1. Post-Dead-Silence crimson ember flare (39.12s) + Ma Xo crawl-out rattle (43.50s)
    add_s(lightning_close(dur=4.0, vel=0.86, r=rng(850)), 39.12, rev=0.36, space="kit", hit=True)
    add_s(stinger(kind="boom", vel=0.76, r=rng(510), dur=2.6, f0=44.0), 39.14, rev=0.32, space="kit", hit=True)
    add_s(stinger(kind="cluster_stab", vel=0.44, r=rng(511), dur=2.2), 40.00, rev=0.40, space="kit", hit=True)
    add_s(entity_rattle(dur=2.2, vel=0.50, r=rng(1501), pan_from=0.50, pan_to=-0.45, kind="drowned"), 43.80, rev=0.46, space="kit", hit=True)

    # 2. Hallway threshold ankle-grab climax ("níu chặt" 47.42s)
    add_s(stinger(kind="boom", vel=0.84, r=rng(512), dur=2.6, f0=43.0), 47.42, rev=0.34, space="hall", hit=True)
    add_s(stinger(kind="shriek", vel=0.48, r=rng(513), dur=2.0), 47.44, rev=0.44, space="hall", hit=True)
    add_s(entity_rattle(dur=1.6, vel=0.52, r=rng(1502), pan_from=-0.45, pan_to=0.45, kind="shriek_gasp"), 47.46, rev=0.46, space="hall", hit=True)

    # 3. Lingering open-ending chord as soot-black hand drags cold rice bowl into dark nook (71.55s)
    add_s(stinger(kind="braam", vel=0.74, r=rng(515), dur=3.0, f0=43.65), 71.55, rev=0.44, space="kit", hit=True)

    sfx_rev = 0.50 * convolve_st(sfx_send_kit, kit_ir) + 0.54 * convolve_st(sfx_send_hall, hall_ir)
    del sfx_send_kit, sfx_send_hall
    sfx_duck = dbg(duck_db(spans, DUR, depth=-2.5, pre=0.06, post=0.10))
    sfx = (sfx_dry * 0.70 + sfx_rev * 0.64) * sfx_duck[None, :] + sfx_hits * 0.56
    del sfx_dry, sfx_rev, sfx_hits, sfx_duck
    sfx = apply_dead_silence_gate(sfx, dead_silences, floor_db=-54.0)

    # =========================================================================
    # 3. VOICE ATMOSPHERIC POLISH (Dry crisp center + subtle -17.5 dB halo on final ritual sentence)
    # =========================================================================
    voice = voice_dry.copy()
    k_tw = ns(66.50)
    if k_tw < n_total:
        twist_slice = np.zeros_like(voice_dry)
        twist_slice[:, k_tw:] = voice_dry[:, k_tw:]
        twist_fade = min(ns(0.15), n_total - k_tw)
        twist_slice[:, k_tw : k_tw + twist_fade] *= ramp(twist_fade)[None, :]
        ghost_tail = convolve_st(bp(twist_slice, 260.0, 4600.0, order=2), hall_ir)
        pd = ns(0.085)
        if pd < n_total:
            voice[:, pd:] += ghost_tail[:, : n_total - pd] * dbg(-17.5)
        del twist_slice, ghost_tail
    del voice_dry, kit_ir, hall_ir
    gc.collect()

    # =========================================================================
    # 4. MASTER MIX (-15.0 LUFS, ceil_db=-1.9 so AAC 192k stays safely <= -1.3 dBFS)
    # =========================================================================
    final_mix, stems, stats = master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.9, fade_out=0.08)
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
