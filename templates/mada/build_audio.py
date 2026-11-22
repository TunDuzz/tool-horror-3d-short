#!/usr/bin/env python3
"""Procedural horror sound design & music score generator for MadaShort (74.20s / 2226 frames @ 30fps)."""

import json
import os
import sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "audio"))

from dsp import SR, ns, rng, bp, lp, fades, pan, widen, dbg
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
    bubbles = bp(r.standard_normal(n), 650.0, 3200.0, order=2) * np.exp(-t / (dur * 0.22)) * (0.5 + 0.5 * np.sin(2 * np.pi * 16.0 * t))
    mono = fades(lp(body + 0.55 * bubbles, 2800.0), 0.008, 0.06)
    pk = float(np.max(np.abs(mono))) or 1.0
    return widen((mono / pk) * vel, r, ms=12.0, amount=0.65)


def apply_dead_silence_gate(buf, silences, floor_db=-44.0):
    """Carve music/sfx to near-silence during [DEAD SILENCE] windows with crisp pre-cut and post-recovery."""
    n = buf.shape[1]
    env = np.ones(n, dtype=np.float64)
    floor_lin = dbg(floor_db)
    fade_n = ns(0.018)
    for ds in silences:
        s0 = max(0, ns(float(ds["s"])))
        e0 = min(n, ns(float(ds["e"])))
        if e0 <= s0:
            continue
        env[s0:e0] = floor_lin
        # Smooth 18ms entry/exit transitions to avoid DC clicks
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

    voice = load_voice(voice_wav, DUR)
    n_total = voice.shape[1]
    music = np.zeros((2, n_total), dtype=np.float64)
    sfx = np.zeros((2, n_total), dtype=np.float64)

    # ---------------- 1. MUSIC STEM ----------------
    # Sub-bass drones across the 3 narrative acts
    add_at(music, sub_drone(f=41.20, dur=24.5, vel=0.34, r=rng(101), att=1.5, rel=1.8), 0.0)
    add_at(music, sub_drone(f=36.71, dur=12.0, vel=0.38, r=rng(102), att=1.0, rel=0.4), 25.2)
    add_at(music, sub_drone(f=32.70, dur=20.0, vel=0.42, r=rng(103), att=0.3, rel=1.8), 38.15)
    add_at(music, sub_drone(f=36.71, dur=14.8, vel=0.38, r=rng(104), att=1.0, rel=1.5), 58.6)

    # Detuned antique music-box motif (E minor / Phrygian pentatonic: E5, F5, A5, B5, C6, B5, F5, E5)
    mb_notes = [
        # Act 1 cold hook & setting
        (0.4, 76, 0.24, -0.25),
        (2.1, 77, 0.20, 0.25),
        (4.0, 81, 0.22, -0.15),
        (6.2, 76, 0.18, 0.20),
        (9.2, 79, 0.20, -0.20),
        (12.4, 76, 0.18, 0.15),
        # Shot 3 uncanny conical hat drifting upstream
        (16.2, 76, 0.24, -0.30),
        (18.0, 77, 0.22, 0.30),
        (19.8, 81, 0.24, -0.20),
        (21.6, 75, 0.25, 0.20),
        # Act 3 lingering twist in shack (footprints on dry floor)
        (64.2, 76, 0.24, -0.25),
        (66.0, 77, 0.22, 0.25),
        (67.8, 81, 0.24, -0.15),
        (70.2, 75, 0.26, 0.20),
        (72.0, 76, 0.28, 0.0),
    ]
    for idx, (t0, midi_n, vel, pn) in enumerate(mb_notes):
        note = scary_musicbox(f=m2f(midi_n), vel=vel, r=rng(300 + idx), dur=2.4, detune_cents=-16.0 - (idx % 3) * 4)
        add_at(music, note, t0, gain=1.0, pan_pos=pn)

    # Eerie bowed waterphone scrapes on uncanny cues
    add_at(music, bowed_metal(f=196.0, dur=3.8, vel=0.22, r=rng(210), bend_semi=1.8), 18.8, pan_pos=-0.35)
    add_at(music, bowed_metal(f=233.08, dur=4.2, vel=0.24, r=rng(211), bend_semi=-2.1), 29.0, pan_pos=0.35)
    add_at(music, bowed_metal(f=185.0, dur=4.5, vel=0.25, r=rng(212), bend_semi=2.4), 51.0, pan_pos=-0.25)
    add_at(music, bowed_metal(f=207.65, dur=4.0, vel=0.24, r=rng(213), bend_semi=-1.9), 66.2, pan_pos=0.25)

    # Tense dissonant tremolo strings on Investigation, Climax, and Twist
    add_at(music, horror_strings(freqs=(146.83, 155.56, 207.65), dur=10.5, vel=0.26, r=rng(701)), 26.2)
    add_at(music, horror_strings(freqs=(130.81, 138.59, 185.00, 246.94), dur=11.0, vel=0.34, r=rng(702), sul_pont=0.58), 38.25)
    add_at(music, horror_strings(freqs=(146.83, 155.56, 220.00), dur=8.2, vel=0.30, r=rng(703), sul_pont=0.50), 65.0)

    # Carve music during [DEAD SILENCE] and apply voice-keyed ducking
    music = apply_dead_silence_gate(music, dead_silences, floor_db=-45.0)
    spans = speech_spans(words, merge=0.32)
    duck_gain = dbg(duck_db(spans, DUR, depth=-4.2, pre=0.08, post=0.14))
    music *= duck_gain[None, :]

    # ---------------- 2. SFX STEM ----------------
    # Environmental beds: river wind (0..37.3s), storm rain (38.15..58.6s), shack interior tone (58.6..74.2s)
    add_at(sfx, ambience_night(dur=37.3, kind="wind", vel=0.16, r=rng(801)), 0.0)
    add_at(sfx, ambience_night(dur=20.4, kind="rain", vel=0.22, r=rng(802)), 38.15)
    add_at(sfx, ambience_night(dur=15.5, kind="room_tone", vel=0.17, r=rng(803)), 58.6)

    # Spectral whispers from the river & shack shadows
    add_at(sfx, whisper_ghost(dur=1.6, vel=0.24, r=rng(901), pan_from=-0.65, pan_to=0.55), 3.55)
    add_at(sfx, whisper_ghost(dur=1.8, vel=0.26, r=rng(902), pan_from=0.60, pan_to=-0.60), 17.50)
    add_at(sfx, whisper_ghost(dur=1.7, vel=0.28, r=rng(903), pan_from=-0.50, pan_to=0.65), 32.80)
    add_at(sfx, whisper_ghost(dur=2.0, vel=0.30, r=rng(904), pan_from=-0.40, pan_to=0.40), 68.90)

    # Wooden pier & boat creaks + shack door bolt latch
    for idx, (tc, vel) in enumerate([(11.2, 0.24), (13.6, 0.22), (26.4, 0.22), (35.3, 0.30), (62.1, 0.32), (65.2, 0.22)]):
        add_at(sfx, ambience_night(dur=1.3, kind="creak", vel=vel, r=rng(820 + idx)), tc)

    # Procedural water sloshes & splashes tied to story.ts visual beats
    add_at(sfx, synth_water_slosh(dur=0.90, vel=0.35, seed=501), 23.15)  # conical hat bumps boat bow ("bì bõm")
    add_at(sfx, synth_water_slosh(dur=1.10, vel=0.45, seed=502), 35.45)  # drowned hand yanks sampan bow down
    add_at(sfx, synth_water_slosh(dur=1.35, vel=0.42, seed=503), 42.40)  # Ma Da rises from river beside pier
    add_at(sfx, synth_water_slosh(dur=1.20, vel=0.52, seed=504), 46.80)  # climax ankle grab splash

    # Accelerating heartbeat leading up to Dead Silence (26.2s .. 37.25s) and inside Shack (64.5s .. 73.5s)
    add_at(sfx, heartbeat(bpm=68.0, dur=11.0, vel=0.34, r=rng(601), accel_to=124.0), 26.25, pan_pos=0.0)
    add_at(sfx, heartbeat(bpm=82.0, dur=8.8, vel=0.30, r=rng(602), accel_to=112.0), 64.60, pan_pos=0.0)

    # Tension riser snapping hard into [DEAD SILENCE 0.65s] at 37.337s
    add_at(sfx, riser(dur=3.40, f0=85.0, f1=960.0, vel=0.40, r=rng(401), hard_cut=True), 33.93)
    # Second riser into the wet footprints reveal at 68.85s
    add_at(sfx, riser(dur=2.30, f0=95.0, f1=880.0, vel=0.34, r=rng(402), hard_cut=False), 66.55)

    # Thunder & horror stingers synced to KICKS and OVERLAYS in story.ts
    # 1. f=1145 (38.16s): Post-Dead-Silence lightning strike & thunder crack
    add_at(sfx, ambience_night(dur=4.2, kind="thunder", vel=0.52, r=rng(850)), 38.15)
    add_at(sfx, stinger(kind="boom", vel=0.52, r=rng(510), dur=2.6, f0=48.0), 38.15)
    # 2. f=1280 (42.67s): Second lightning bolt as Ma Da rises out of the river
    add_at(sfx, ambience_night(dur=3.4, kind="thunder", vel=0.40, r=rng(851)), 42.66)
    add_at(sfx, stinger(kind="cluster_stab", vel=0.34, r=rng(511), dur=2.2), 42.66)
    # 3. f=1405 (46.83s): Climax ankle grab ("chộp cứng lấy cổ chân")
    add_at(sfx, stinger(kind="boom", vel=0.58, r=rng(512), dur=2.8, f0=45.0), 46.83)
    add_at(sfx, stinger(kind="shriek", vel=0.36, r=rng(513), dur=2.0), 46.85)
    # 4. f=2066 (68.87s): Final twist reveal ("Ngay sau lưng ông, hai dấu chân ướt sũng bùn đen")
    add_at(sfx, stinger(kind="braam", vel=0.46, r=rng(514), dur=3.2, f0=43.65), 68.86)

    # Gate SFX during [DEAD SILENCE]
    sfx = apply_dead_silence_gate(sfx, dead_silences, floor_db=-48.0)

    # ---------------- 3. MASTER MIX (-15.0 LUFS, <= -1.2 dBTP) ----------------
    final_mix, stems, stats = master_mix(voice, music, sfx, target_lufs=-15.0, ceil_db=-1.2)
    write_mix_and_stems(out_dir, final_mix, stems)

    with open(os.path.join(out_dir, "mix_stats.json"), "w", encoding="utf-8") as fp:
        json.dump(stats, fp, indent=2)

    print(
        f"MIX OK -> {os.path.join(out_dir, 'mix.wav')} | "
        f"I={stats['I']:.2f} LUFS | TP={stats['TP']:.2f} dBTP | LRA={stats['LRA']:.2f} LU | "
        f"voice={stats['voice_I']:.1f} | music={stats['music_I']:.1f} | sfx={stats['sfx_I']:.1f}"
    )
    print(ffmpeg_ebur(os.path.join(out_dir, "mix.wav")))


if __name__ == "__main__":
    main()
