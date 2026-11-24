#!/usr/bin/env python3
"""Horror Engine v5.0: Expressive Multi-Speaker & So-VITS-SVC 1-File Hybrid Voice Engine.

Solves all classic AI horror voice flaws (flat monotone dump, dead silence cut mid-breath, swallowed ellipses,
robotic zero-breath delivery, misread Vietnamese clock times, and So-VITS-SVC `-a` F0 flattening):
  1. Per-line expressive prosody across 7 horror moods (`calm_omen`, `tense`, `whisper`, `dread`, `panic`,
     `cold_twist`, `ghost_entity`) with dynamic loudness contour (-4.5 dB whisper .. +2.5 dB panic).
  2. Multi-speaker dialogue tags: `[NARRATOR | mood=...]` + `[SPEAKER: NAME | voice=... | mood=... | fx=dry|room|phone|ghost]`.
  3. Vietnamese horror pronunciation normalizer (`01:06` -> "một giờ sáu phút") preserving verbatim display tokens in words.json.
  4. Procedural human vocal-tract breath injection (`--auto-breath`, default on) + true mid-sentence `...` hesitation pauses.
  5. Effortless 2-machine So-VITS-SVC 1-File Expressive VC-Pack workflow (preserves F0 intonation via `-na`!):
       Step 1 (This PC):  python3 scripts/gen_horror_voice.py --script SCRIPT.md --export-vc-pack out/<p>/vc_pack
       Step 2 (SVC PC):   Run So-VITS-SVC (`-na`) on `narrator_guide_44k.wav` -> `narrator_svc_out.wav`
       Step 3 (This PC):  python3 scripts/gen_horror_voice.py --script SCRIPT.md --vc-pack out/<p>/vc_pack \
                            --narrator-vc-wav out/<p>/vc_pack/narrator_svc_out.wav --out-dir out/<p>/voice
  6. Also supports `--export-narrator-script`, `--narrator-dir`, `--narrator-audio` (VAD/SRT), local `--vc-model` (`-na` default), and `--no-vc`.
"""

import argparse
import asyncio
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
import wave

import numpy as np
from scipy import signal

SR_VC = 44100
SR_FINAL = 48000
VC_PACK_PAD_SEC = 0.35

PAUSE_RE = re.compile(r"(\[(?:PAUSE|DEAD\s+SILENCE)\s+(\d+(?:\.\d+)?)\s*s?\])", re.IGNORECASE)
DIRECTIVE_RE = re.compile(r"^\[\s*(NARRATOR|SPEAKER(?:\s*:\s*[^|\]]+)?)(?:\s*\|\s*(.+?))?\s*\]$", re.IGNORECASE)
ELLIPSIS_SPLIT_RE = re.compile(r"(\.{3,}|…)")
CLOCK_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b")

MOOD_PROFILES = {
    "calm_omen": {
        "rate": "-4%",
        "pitch": "-4Hz",
        "pitch_semi": -0.55,
        "speed": 0.90,
        "gain_db": 0.0,
        "breath": "soft_inhale",
        "breath_db": -25.0,
        "tail_pad": 0.14,
    },
    "tense": {
        "rate": "+2%",
        "pitch": "-1Hz",
        "pitch_semi": -0.10,
        "speed": 0.96,
        "gain_db": -1.0,
        "breath": "soft_inhale",
        "breath_db": -23.0,
        "tail_pad": 0.10,
    },
    "whisper": {
        "rate": "-10%",
        "pitch": "-6Hz",
        "pitch_semi": -1.10,
        "speed": 0.84,
        "gain_db": -4.5,
        "breath": "soft_inhale",
        "breath_db": -21.0,
        "tail_pad": 0.18,
    },
    "dread": {
        "rate": "-12%",
        "pitch": "-8Hz",
        "pitch_semi": -1.45,
        "speed": 0.80,
        "gain_db": -2.0,
        "breath": "shaky_exhale",
        "breath_db": -24.0,
        "tail_pad": 0.22,
    },
    "panic": {
        "rate": "+11%",
        "pitch": "+6Hz",
        "pitch_semi": +1.25,
        "speed": 1.07,
        "gain_db": +2.5,
        "breath": "sharp_gasp",
        "breath_db": -18.5,
        "tail_pad": 0.08,
    },
    "cold_twist": {
        "rate": "-14%",
        "pitch": "-7Hz",
        "pitch_semi": -1.35,
        "speed": 0.78,
        "gain_db": -1.5,
        "breath": "none",
        "breath_db": -30.0,
        "tail_pad": 0.28,
    },
    "ghost_entity": {
        "rate": "-15%",
        "pitch": "-10Hz",
        "pitch_semi": -2.20,
        "speed": 0.76,
        "gain_db": -1.0,
        "breath": "none",
        "breath_db": -30.0,
        "tail_pad": 0.24,
    },
}

_VI_NUM_0_19 = [
    "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín",
    "mười", "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm",
    "mười sáu", "mười bảy", "mười tám", "mười chín",
]


def _vi_num(n: int) -> str:
    if 0 <= n < 20:
        return _VI_NUM_0_19[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        head = f"{_VI_NUM_0_19[tens]} mươi"
        if ones == 0:
            return head
        if ones == 1:
            return f"{head} mốt"
        if ones == 4:
            return f"{head} tư"
        if ones == 5:
            return f"{head} lăm"
        return f"{head} {_VI_NUM_0_19[ones]}"
    return str(n)


def normalize_vi_for_tts(text: str) -> str:
    """Convert Vietnamese clock times (01:06) & dates (22/11) to natural spoken Vietnamese for TTS while callers preserve original display text."""
    def _rep_clock(m):
        hh, mm = int(m.group(1)), int(m.group(2))
        if hh > 23 or mm > 59:
            return m.group(0)
        if mm == 0:
            return f"{_vi_num(hh)} giờ đúng"
        return f"{_vi_num(hh)} giờ {_vi_num(mm)} phút"

    def _rep_date(m):
        dd, mo = int(m.group(1)), int(m.group(2))
        yr = m.group(3)
        if dd > 31 or mo > 12:
            return m.group(0)
        base = f"ngày {_vi_num(dd)} tháng {_vi_num(mo)}"
        return f"{base} năm {yr}" if yr else base

    out = CLOCK_RE.sub(_rep_clock, text)
    out = DATE_RE.sub(_rep_date, out)
    out = re.sub(r"[…]+|\.{3,}", ",", out)
    return re.sub(r"\s+", " ", out).strip()


def norm_tok(tok: str) -> str:
    return re.sub(r"[^\w\u00C0-\u1EF9]", "", tok, flags=re.UNICODE).lower()


def _parse_kv(spec: str) -> dict:
    out = {}
    if not spec:
        return out
    for part in spec.split("|"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip().lower()] = v.strip()
    return out


def parse_script(path: str, default_voice: str = "vi-VN-NamMinhNeural", ellipsis_pause: float = 0.42):
    """Parse .txt/.md script into ordered items: speech (with speaker/mood/voice/pitch/speed/fx), pause, or dead_silence."""
    with open(path, encoding="utf-8") as fp:
        raw = fp.read()
    if raw.startswith("---"):
        raw = re.sub(r"^---\s*\n.*?\n---\s*\n", "", raw, count=1, flags=re.DOTALL)
    raw = re.sub(r"```.*?```", "", raw, flags=re.DOTALL)
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)

    cur = {
        "speaker": "NARRATOR",
        "is_narrator": True,
        "voice": default_voice,
        "mood": "calm_omen",
        "pitch": None,
        "rate": None,
        "speed": None,
        "fx": "dry",
    }

    items = []
    for raw_line in raw.splitlines():
        s = raw_line.strip()
        if not s:
            continue
        if s.startswith("#") or s.startswith(">") or re.fullmatch(r"[-*_]{3,}", s):
            continue
        s = re.sub(r"^[-*+]\s+", "", s)
        s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
        s = re.sub(r"`(.+?)`", r"\1", s)

        dm = DIRECTIVE_RE.match(s)
        if dm:
            head = dm.group(1).strip()
            kv = _parse_kv(dm.group(2) or "")
            if head.upper() == "NARRATOR":
                cur = {
                    "speaker": "NARRATOR",
                    "is_narrator": True,
                    "voice": kv.get("voice", default_voice),
                    "mood": kv.get("mood", "calm_omen").lower(),
                    "pitch": kv.get("pitch"),
                    "rate": kv.get("rate"),
                    "speed": float(kv["speed"]) if "speed" in kv else None,
                    "fx": kv.get("fx", "dry").lower(),
                }
            else:
                sp_name = head.split(":", 1)[1].strip() if ":" in head else "SPEAKER"
                mood = kv.get("mood", "ghost_entity" if kv.get("fx", "").lower() == "ghost" else "tense").lower()
                cur = {
                    "speaker": sp_name,
                    "is_narrator": sp_name.upper() == "NARRATOR",
                    "voice": kv.get("voice", default_voice),
                    "mood": mood,
                    "pitch": kv.get("pitch"),
                    "rate": kv.get("rate"),
                    "speed": float(kv["speed"]) if "speed" in kv else None,
                    "fx": kv.get("fx", "room").lower(),
                }
            continue

        parts = PAUSE_RE.split(s)
        i = 0
        while i < len(parts):
            txt = parts[i].strip()
            if txt:
                # Split mid-line ellipses `...` / `…` into genuine suspense hesitation pauses!
                sub_parts = ELLIPSIS_SPLIT_RE.split(txt)
                si = 0
                while si < len(sub_parts):
                    seg = sub_parts[si].strip()
                    has_ell = (si + 1 < len(sub_parts)) and bool(sub_parts[si + 1])
                    has_more = (si + 2 < len(sub_parts)) and bool(sub_parts[si + 2].strip())
                    if seg:
                        display_seg = (seg + "...") if has_ell else seg
                        items.append({
                            "kind": "speech",
                            "text": display_seg,
                            "tts_text": normalize_vi_for_tts(seg),
                            "speaker": cur["speaker"],
                            "is_narrator": cur["is_narrator"],
                            "voice": cur["voice"],
                            "mood": cur["mood"] if cur["mood"] in MOOD_PROFILES else "calm_omen",
                            "pitch": cur["pitch"],
                            "rate": cur["rate"],
                            "speed": cur["speed"],
                            "fx": cur["fx"],
                        })
                        if has_ell and has_more and ellipsis_pause > 0:
                            items.append({"kind": "pause", "dur": ellipsis_pause, "from_ellipsis": True})
                    si += 2
            if i + 2 < len(parts):
                tag = parts[i + 1].upper()
                dur = max(0.05, float(parts[i + 2]))
                kind = "dead_silence" if "DEAD" in tag else "pause"
                items.append({"kind": kind, "dur": dur})
            i += 3

    if not any(it["kind"] == "speech" for it in items):
        raise ValueError(f"No spoken lines parsed from {path}")
    return items


def read_wav_mono(path: str):
    with wave.open(path, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0
    elif sw == 4:
        x = np.frombuffer(raw, "<i4").astype(np.float64) / float(1 << 31)
    else:
        raise ValueError(f"Unsupported sample width {sw} in {path}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def write_wav_mono16(path: str, x: np.ndarray, sr: int):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    q = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(q.tobytes())


def load_audio_mono(path: str, target_sr: int) -> np.ndarray:
    """Load any WAV/MP3/FLAC/M4A file as mono float64 at `target_sr` (uses wave fast-path or ffmpeg)."""
    if path.lower().endswith(".wav"):
        x, sr = read_wav_mono(path)
        if sr == target_sr:
            return x
        g = math.gcd(target_sr, sr)
        return signal.resample_poly(x, target_sr // g, sr // g)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp_wav = tf.name
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", path, "-ar", str(target_sr), "-ac", "1", "-sample_fmt", "s16", tmp_wav],
            check=True,
        )
        x, _ = read_wav_mono(tmp_wav)
        return x
    finally:
        if os.path.exists(tmp_wav):
            os.remove(tmp_wav)


def _bp(x: np.ndarray, lo: float, hi: float, sr: int, order: int = 2) -> np.ndarray:
    nyq = 0.5 * sr
    sos = signal.butter(order, [max(10.0, lo) / nyq, min(nyq * 0.96, hi) / nyq], btype="bandpass", output="sos")
    return signal.sosfilt(sos, x)


def _hp(x: np.ndarray, fc: float, sr: int, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, max(10.0, fc) / (0.5 * sr), btype="highpass", output="sos")
    return signal.sosfilt(sos, x)


def _lp(x: np.ndarray, fc: float, sr: int, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, min(0.48 * sr, fc) / (0.5 * sr), btype="lowpass", output="sos")
    return signal.sosfilt(sos, x)


def _fade(x: np.ndarray, sr: int, fi: float = 0.008, fo: float = 0.012) -> np.ndarray:
    out = x.copy()
    n = len(out)
    ni = min(int(round(fi * sr)), n // 3)
    no = min(int(round(fo * sr)), n // 3)
    if ni > 1:
        out[:ni] *= np.linspace(0.0, 1.0, ni)
    if no > 1:
        out[-no:] *= np.linspace(1.0, 0.0, no)
    return out


def synth_breath(kind: str, sr: int, seed: int = 17) -> np.ndarray:
    """Synthesize subtle realistic procedural human vocal-tract breath (`soft_inhale`, `sharp_gasp`, `shaky_exhale`)."""
    if not kind or kind == "none":
        return np.zeros(0, dtype=np.float64)
    rng = np.random.default_rng(seed)
    if kind == "sharp_gasp":
        dur = 0.21
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 480.0, 3400.0, sr, 2) * 0.75 + _bp(nz, 1450.0, 4800.0, sr, 2) * 0.55
        env = ((t / dur) ** 0.55) * np.exp(-((t / dur) ** 2.6) * 2.2)
        y = air * env
    elif kind == "shaky_exhale":
        dur = 0.34
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 320.0, 2400.0, sr, 2)
        trem = 0.78 + 0.22 * np.sin(2.0 * np.pi * 11.5 * t)
        env = np.sin(np.pi * t / dur) ** 1.2
        y = air * env * trem
    else:  # soft_inhale
        dur = 0.24
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 420.0, 2900.0, sr, 2)
        env = (np.sin(np.pi * (t / dur) ** 0.85)) ** 1.35
        y = air * env
    pk = float(np.max(np.abs(y))) + 1e-9
    return _fade(y / pk, sr, 0.015, 0.025)


def normalize_rms(x: np.ndarray, target_dbfs: float = -19.0, max_peak: float = 0.88) -> np.ndarray:
    """Normalize active speech RMS to `target_dbfs` while guarding against clipping."""
    active = x[np.abs(x) > 0.008]
    rms = float(np.sqrt(np.mean(active ** 2))) if len(active) > 32 else float(np.sqrt(np.mean(x ** 2)))
    if rms < 1e-6:
        return x.copy()
    gain = (10.0 ** (target_dbfs / 20.0)) / rms
    y = x * gain
    pk = float(np.max(np.abs(y)))
    if pk > max_peak:
        y *= max_peak / pk
    return y


def apply_voice_fx(x: np.ndarray, sr: int, fx: str = "dry", mood: str = "calm_omen") -> np.ndarray:
    """Apply expressive horror mood EQ & character acoustic DSP (`dry`, `room`, `phone`, `ghost`)."""
    if len(x) < 16:
        return x.copy()
    y = _hp(x.astype(np.float64), 52.0, sr, order=2)

    # Mood-specific vocal warmth, proximity whisper breathiness & cold-twist echo
    if mood == "whisper":
        # Intimate close-mic proximity bass + soft airy sibilant breath layer
        warm = _lp(y, 240.0, sr, 2) * 0.28
        air = _bp(y, 3200.0, 7400.0, sr, 2) * 0.34
        y = np.tanh((y + warm + air) * 1.15) * 0.90
    elif mood == "panic":
        edge = _bp(y, 1800.0, 4200.0, sr, 2) * 0.25
        y = np.tanh((y + edge) * 1.25) * 0.92
    elif mood in ("calm_omen", "dread"):
        warm = _lp(y, 200.0, sr, 2) * 0.18
        y = y + warm

    # Character spatial / supernatural FX
    if fx == "phone":
        # Telephone narrow bandpass (320-3300 Hz) + soft compression + subtle line hiss
        rng = np.random.default_rng(707)
        y = _bp(y, 320.0, 3300.0, sr, order=3)
        y = np.tanh(y * 2.2) * 0.65 + _bp(rng.standard_normal(len(y)), 600.0, 3100.0, sr, 2) * 0.004
    elif fx == "room":
        # Tight haunted interior early reflections (14ms, 29ms, 47ms)
        wet = np.zeros(len(y) + int(0.08 * sr), dtype=np.float64)
        wet[: len(y)] += y
        for d_ms, amp in ((14.0, 0.24), (29.0, 0.15), (47.0, 0.09)):
            d = int(round((d_ms / 1000.0) * sr))
            wet[d : d + len(y)] += _lp(y, 2600.0, sr, 2) * amp
        y = wet[: len(y)]
    elif fx == "ghost":
        # Uncanny supernatural voice: shadowed double delay + cold dark formant + chilling reverse-reverb pre-swell!
        pad_pre = int(round(0.22 * sr))
        pad_post = int(round(0.32 * sr))
        buf = np.zeros(pad_pre + len(y) + pad_post, dtype=np.float64)
        buf[pad_pre : pad_pre + len(y)] += y * 0.86
        # Shadowed detuned-like double tap (18ms & 41ms)
        for d_ms, amp in ((18.0, 0.42), (41.0, 0.26)):
            d = int(round((d_ms / 1000.0) * sr))
            buf[pad_pre + d : pad_pre + d + len(y)] += _bp(y, 180.0, 2400.0, sr, 2) * amp
        # Reverse-reverb eerie inhale tail bleeding right before the ghost speaks!
        ir_len = int(round(0.26 * sr))
        rng = np.random.default_rng(666)
        ir = _bp(rng.standard_normal(ir_len), 320.0, 3200.0, sr, 2) * np.exp(-np.arange(ir_len) / (0.075 * sr))
        rev = signal.fftconvolve(y[::-1], ir, mode="full")[::-1]
        rev = rev[max(0, len(rev) - len(buf)) :]
        if len(rev) < len(buf):
            rev = np.pad(rev, (len(buf) - len(rev), 0))
        buf += rev[: len(buf)] * (0.28 / (np.max(np.abs(rev)) + 1e-6)) * (np.max(np.abs(y)) + 1e-6)
        y = np.tanh(buf * 1.18) * 0.92

    if mood == "cold_twist" and fx != "ghost":
        # Faint eerie cold hall tail strictly on the chilling closing twist
        tail_n = int(round(0.28 * sr))
        out = np.zeros(len(y) + tail_n, dtype=np.float64)
        out[: len(y)] += y
        for d_ms, amp in ((55.0, 0.16), (115.0, 0.10), (190.0, 0.06)):
            d = int(round((d_ms / 1000.0) * sr))
            out[d : d + len(y)] += _lp(y, 2200.0, sr, 2) * amp
        y = out

    # Gentle de-esser on harsh 6-8.5kHz sibilants
    sib = _bp(y, 6000.0, 8800.0, sr, 2)
    y = y - sib * 0.22
    return _fade(y, sr, 0.006, 0.014)


def estimate_syllable_words(display_text: str, dur_s: float, offset_s: float, speaker: str, mood: str) -> list:
    """Distribute word timestamps proportionally to Vietnamese syllable/character weight across `dur_s`."""
    toks = [t for t in display_text.split() if t.strip()]
    if not toks:
        return []
    weights = [max(1.2, len(norm_tok(t)) + (1.4 if t[-1] in ",.;:!?…" else 0.0)) for t in toks]
    total_w = sum(weights)
    usable = max(0.08, dur_s)
    cur = offset_s
    out = []
    for tok, w in zip(toks, weights):
        wd = usable * (w / total_w)
        out.append({
            "w": tok,
            "s": round(cur, 4),
            "e": round(cur + max(0.04, wd), 4),
            "speaker": speaker,
            "mood": mood,
        })
        cur += wd
    return out


def align_chunk_words(display_text: str, raw_events: list, t0: float, speed: float, dur_s: float, speaker: str, mood: str) -> list:
    """Map display tokens cleanly onto per-chunk edge-tts WordBoundary events (preserving original `01:06` tokens!)."""
    toks = [t for t in display_text.split() if t.strip()]
    if not toks:
        return []
    if not raw_events:
        return estimate_syllable_words(display_text, dur_s, 0.0, speaker, mood)

    tts_words = []
    for ev in raw_events:
        s = max(0.0, min(max(0.01, dur_s - 0.03), (ev["s"] - t0) / speed))
        e = max(s + 0.03, min(dur_s, (ev["e"] - t0) / speed))
        tts_words.append({"w": ev["w"], "s": s, "e": e})

    if len(toks) == len(tts_words):
        return [
            {"w": disp, "s": round(w["s"], 4), "e": round(w["e"], 4), "speaker": speaker, "mood": mood}
            for disp, w in zip(toks, tts_words)
        ]

    # If normalization expanded tokens (e.g. `01:06` -> 4 spoken words), map proportionally across spoken span
    span_s = tts_words[0]["s"]
    span_e = max(span_s + 0.08, tts_words[-1]["e"])
    return estimate_syllable_words(display_text, span_e - span_s, span_s, speaker, mood)


_HAS_RUBBERBAND = None


def _ffmpeg_has_rubberband() -> bool:
    global _HAS_RUBBERBAND
    if _HAS_RUBBERBAND is None:
        try:
            out = subprocess.check_output(["ffmpeg", "-hide_banner", "-filters"], text=True, stderr=subprocess.STDOUT)
            _HAS_RUBBERBAND = "rubberband" in out
        except Exception:
            _HAS_RUBBERBAND = False
    return _HAS_RUBBERBAND


def _parse_pitch_to_semi(pitch_spec, default_semi: float) -> float:
    if pitch_spec is None:
        return default_semi
    s = str(pitch_spec).strip().lower()
    m = re.match(r"^([+-]?\d+(?:\.\d+)?)\s*(st|semi|hz|%)?$", s)
    if not m:
        return default_semi
    val = float(m.group(1))
    unit = m.group(2) or "st"
    if unit in ("st", "semi"):
        return max(-6.0, min(6.0, val))
    if unit == "hz":
        return max(-6.0, min(6.0, val * 0.18))
    if unit == "%":
        return max(-6.0, min(6.0, val * 0.15))
    return default_semi


async def _synth_edge_once(text: str, voice: str, out_mp3: str, max_attempts: int = 20):
    """Synthesize clean neutral Edge-TTS audio + WordBoundary timestamps with resilient retry pool."""
    import edge_tts  # lazy import so offline VC-pack / WAV ingestion never requires edge-tts!

    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            comm = edge_tts.Communicate(text, voice, boundary="WordBoundary")
            events = []
            with open(out_mp3, "wb") as fp:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        fp.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        s = chunk["offset"] / 1e7
                        d = chunk["duration"] / 1e7
                        events.append({"w": chunk["text"], "s": s, "e": s + d})
            if not events or not os.path.isfile(out_mp3) or os.path.getsize(out_mp3) < 256:
                raise RuntimeError("No audio / WordBoundary events returned")
            return events
        except Exception as exc:
            last_err = exc
            await asyncio.sleep(min(0.85, 0.22 + 0.06 * attempt))
    raise RuntimeError(f"edge-tts failed after {max_attempts} attempts for {text!r}: {last_err}")


def probe_dur(path: str) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        text=True,
    ).strip()
    return float(out)


def _atempo_chain(factor: float) -> str:
    """Build valid chained ffmpeg atempo filter string (each stage clamped inside [0.5, 2.0])."""
    parts = []
    f = max(0.35, min(2.8, float(factor)))
    while f < 0.5:
        parts.append("atempo=0.5")
        f /= 0.5
    while f > 2.0:
        parts.append("atempo=2.0")
        f /= 2.0
    parts.append(f"atempo={f:.5f}")
    return ",".join(parts)


def synth_edge_chunk(item: dict, sr: int, tmp_dir: str, idx: int, base_speed_scale: float = 1.0, cache_dir: str | None = None):
    """Synthesize ONE expressive speech line with deterministic local pitch/tempo DSP and return (samples, rel_words)."""
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    pitch_semi = _parse_pitch_to_semi(item["pitch"], float(prof.get("pitch_semi", 0.0)))
    speed = float(item["speed"]) if item["speed"] is not None else float(prof["speed"]) * base_speed_scale
    speed = max(0.55, min(1.50, speed))

    tts_text = item.get("tts_text") or normalize_vi_for_tts(item["text"])
    key = hashlib.sha256(f"{item['voice']}|{tts_text}".encode("utf-8")).hexdigest()[:16]
    if cache_dir:
        os.makedirs(cache_dir, exist_ok=True)
        mp3 = os.path.join(cache_dir, f"{key}.mp3")
        ev_json = os.path.join(cache_dir, f"{key}.events.json")
    else:
        mp3 = os.path.join(tmp_dir, f"seg_{idx:03d}.mp3")
        ev_json = None

    if ev_json and os.path.isfile(mp3) and os.path.isfile(ev_json) and os.path.getsize(mp3) >= 256:
        with open(ev_json, encoding="utf-8") as fp:
            events = json.load(fp)
    else:
        events = asyncio.run(_synth_edge_once(tts_text, item["voice"], mp3))
        if ev_json:
            with open(ev_json, "w", encoding="utf-8") as fp:
                json.dump(events, fp, ensure_ascii=False)

    raw_dur = probe_dur(mp3)
    t0 = max(0.0, events[0]["s"] - 0.03)
    t1 = min(raw_dur, events[-1]["e"] + 0.06)
    wav = os.path.join(tmp_dir, f"seg_{idx:03d}.wav")

    pitch_ratio = 2.0 ** (pitch_semi / 12.0)
    if abs(pitch_semi) > 0.04:
        if _ffmpeg_has_rubberband():
            af = f"rubberband=pitch={pitch_ratio:.5f}:tempo={speed:.5f}:formant=preserved"
        else:
            af = f"asetrate={int(round(sr * pitch_ratio))},aresample={sr},{_atempo_chain(speed / pitch_ratio)}"
    else:
        af = _atempo_chain(speed)

    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-ss", f"{t0:.4f}", "-to", f"{t1:.4f}", "-i", mp3,
            "-af", af,
            "-ar", str(sr), "-ac", "1", "-sample_fmt", "s16",
            wav,
        ],
        check=True,
    )
    samples, _ = read_wav_mono(wav)
    dur_s = len(samples) / float(sr)
    words = align_chunk_words(item["text"], events, t0, speed, dur_s, item["speaker"], item["mood"])
    return samples, words


def split_audio_vad(samples: np.ndarray, sr: int, target_count: int) -> list:
    """Split a single external narrator WAV into `target_count` speech segments using energy-envelope silence detection."""
    if target_count <= 1 or len(samples) == 0:
        return [samples]
    win = max(1, int(0.025 * sr))
    env = np.sqrt(np.convolve(samples ** 2, np.ones(win) / win, mode="same"))
    thr = max(0.008, float(np.percentile(env, 85)) * 0.09)
    silent = env < thr

    # Find contiguous silent gaps >= 120ms inside the waveform
    min_gap = int(0.12 * sr)
    gaps = []
    i = 0
    n = len(samples)
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            if (j - i) >= min_gap and i > int(0.08 * sr) and j < n - int(0.08 * sr):
                gaps.append((j - i, (i + j) // 2))
            i = j
        else:
            i += 1

    need = target_count - 1
    if len(gaps) >= need:
        chosen = sorted(mid for _, mid in sorted(gaps, key=lambda g: g[0], reverse=True)[:need])
        cuts = [0] + chosen + [n]
    else:
        cuts = [int(round(k * n / target_count)) for k in range(target_count + 1)]
    return [samples[cuts[k] : cuts[k + 1]] for k in range(target_count)]


def trim_silence(x: np.ndarray, sr: int, pad_s: float = 0.03) -> np.ndarray:
    if len(x) == 0:
        return x
    idx = np.flatnonzero(np.abs(x) > 0.006)
    if len(idx) == 0:
        return x
    pad = int(round(pad_s * sr))
    a = max(0, int(idx[0]) - pad)
    b = min(len(x), int(idx[-1]) + pad)
    return x[a:b]


def find_narrator_clip(narrator_dir: str, n_idx: int) -> str:
    """Resolve `N01.wav`, `01.wav`, `1.wav`, `N01.mp3`, etc. inside `narrator_dir`."""
    exts = (".wav", ".mp3", ".flac", ".m4a", ".ogg")
    stems = (f"N{n_idx:02d}", f"n{n_idx:02d}", f"{n_idx:02d}", f"S{n_idx:02d}", str(n_idx))
    for st_name in stems:
        for ext in exts:
            p = os.path.join(narrator_dir, st_name + ext)
            if os.path.isfile(p):
                return p
    # Fallback: sorted audio files matching prefix
    files = sorted(f for f in os.listdir(narrator_dir) if f.lower().endswith(exts))
    if 1 <= n_idx <= len(files):
        return os.path.join(narrator_dir, files[n_idx - 1])
    raise FileNotFoundError(f"Narrator clip #{n_idx} not found in {narrator_dir} (expected N{n_idx:02d}.wav or {n_idx:02d}.wav)")


def export_narrator_script(items: list, out_path: str):
    """Export emotion-annotated narrator cue sheet (`N01 [mood]: ...`) for external TTS or human recording."""
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    lines = ["# NARRATOR VOICE CUE SHEET (Horror Engine v5.0)", "# Xuất các file N01.wav, N02.wav... theo đúng thứ tự bên dưới:", ""]
    n_idx = 0
    for it in items:
        if it["kind"] == "speech" and it["is_narrator"]:
            n_idx += 1
            lines.append(f"N{n_idx:02d} [{it['mood']}] | {it['text']}")
        elif it["kind"] == "dead_silence":
            lines.append(f"--- [DEAD SILENCE {it['dur']:.2f}s] ---")
    with open(out_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    print(f"EXPORTED NARRATOR CUES ({n_idx} lines) -> {out_path}")


def export_vc_pack(items: list, out_dir: str, tmp_dir: str, args, synth_fn=None):
    """
    Build 1-File Expressive So-VITS-SVC Pack (`narrator_guide_44k.wav` + `vc_pack_manifest.json` + helper scripts).
    Preserves all 7 horror mood pitch/rate/ellipsis dynamics so So-VITS-SVC (`-na`) keeps full emotion!
    """
    os.makedirs(out_dir, exist_ok=True)
    pad_samples = int(round(VC_PACK_PAD_SEC * SR_VC))
    guide_parts = []
    manifest_segs = []
    cursor = 0
    n_idx = 0

    for idx, it in enumerate(items):
        if it["kind"] != "speech" or not it["is_narrator"]:
            continue
        n_idx += 1
        if synth_fn is not None:
            seg, rel_words = synth_fn(it, SR_VC, idx)
        else:
            cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(out_dir)), ".tts_cache")
            seg, rel_words = synth_edge_chunk(it, SR_VC, tmp_dir, idx, args.speed_scale, cache_dir=cache_dir)
        seg = normalize_rms(seg, target_dbfs=-19.0)
        start_s = cursor
        end_s = cursor + len(seg)
        guide_parts.append(seg)
        guide_parts.append(np.zeros(pad_samples, dtype=np.float64))
        cursor = end_s + pad_samples
        manifest_segs.append({
            "narrator_idx": n_idx,
            "item_idx": idx,
            "start_sample": start_s,
            "end_sample": end_s,
            "sr": SR_VC,
            "mood": it["mood"],
            "fx": it["fx"],
            "text": it["text"],
            "words": rel_words,
        })

    if not guide_parts:
        raise ValueError("No [NARRATOR] lines found in script to export VC pack")

    guide = np.concatenate(guide_parts)
    guide_wav = os.path.join(out_dir, "narrator_guide_44k.wav")
    write_wav_mono16(guide_wav, guide, SR_VC)

    mf = {
        "version": "v5.0-vc-pack",
        "sr": SR_VC,
        "total_samples": len(guide),
        "pad_sec": VC_PACK_PAD_SEC,
        "segments": manifest_segs,
    }
    mf_path = os.path.join(out_dir, "vc_pack_manifest.json")
    with open(mf_path, "w", encoding="utf-8") as fp:
        json.dump(mf, fp, ensure_ascii=False, indent=2)

    # Ready-to-run helper scripts using `-na` (--no-auto-predict-f0) so So-VITS-SVC NEVER flattens emotional F0 pitch!
    bat = (
        "@echo off\r\n"
        "REM Chay tren may So-VITS-SVC: Giu nguyen ngu dieu cam xuc bang co -na (--no-auto-predict-f0)!\r\n"
        f'"{os.path.join(args.vc_venv, "Scripts", "svc.exe")}" infer narrator_guide_44k.wav -o narrator_svc_out.wav '
        f'-s {args.speaker} -m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\r\n"
    )
    sh = (
        "#!/usr/bin/env bash\n"
        "# Run on your So-VITS-SVC machine: uses -na (--no-auto-predict-f0) to PRESERVE horror mood pitch contour!\n"
        f'svc infer narrator_guide_44k.wav -o narrator_svc_out.wav -s "{args.speaker}" '
        f'-m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\n"
    )
    with open(os.path.join(out_dir, "run_svc_win.bat"), "w", encoding="utf-8") as fp:
        fp.write(bat)
    with open(os.path.join(out_dir, "run_svc_unix.sh"), "w", encoding="utf-8") as fp:
        fp.write(sh)

    print(f"VC PACK READY -> {guide_wav} ({len(guide) / SR_VC:.2f}s, {n_idx} narrator lines)")
    print(f"  1) Copy narrator_guide_44k.wav -> So-VITS-SVC PC & run with -na (see run_svc_win.bat / run_svc_unix.sh)")
    print(f"  2) Copy narrator_svc_out.wav back -> run with --vc-pack {out_dir} --narrator-vc-wav narrator_svc_out.wav")
    return guide_wav, mf_path


def run_local_svc(in_wav: str, out_wav: str, args):
    svc_bin = os.path.join(args.vc_venv, "Scripts", "svc.exe") if os.name == "nt" else os.path.join(args.vc_venv, "bin", "svc")
    if not os.path.isfile(svc_bin):
        raise FileNotFoundError(f"svc executable not found at {svc_bin} (pass --no-vc or --narrator-vc-wav)")
    if not os.path.isfile(args.vc_model) or not os.path.isfile(args.vc_config):
        raise FileNotFoundError(f"Missing VC model/config: {args.vc_model} / {args.vc_config}")

    vc_env = os.environ.copy()
    cache_tmp = os.path.join(args.vc_cache_root, "tmp")
    vc_env["HF_HOME"] = os.path.join(args.vc_cache_root, "cache", "hf")
    vc_env["TORCH_HOME"] = os.path.join(args.vc_cache_root, "cache", "torch")
    vc_env["XDG_CACHE_HOME"] = os.path.join(args.vc_cache_root, "cache", "xdg")
    vc_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    if os.path.isdir(cache_tmp):
        vc_env["TEMP"] = vc_env["TMP"] = cache_tmp

    cmd = [
        svc_bin, "infer", in_wav,
        "-o", out_wav,
        "-s", args.speaker,
        "-m", args.vc_model,
        "-c", args.vc_config,
        "-fm", args.f0_method,
        "-n", str(args.noise_scale),
        "-p", str(args.pad_seconds),
        "-mc", str(args.max_chunk_seconds),
    ]
    if args.auto_predict_f0:
        cmd.append("-a")
    else:
        cmd.extend(["-na", "-t", str(args.transpose)])

    t0 = time.time()
    subprocess.run(cmd, env=vc_env, check=True)
    print(f"So-VITS-SVC conversion done in {time.time() - t0:.1f}s")


def assemble_voice(items: list, args, tmp_dir: str, synth_fn=None):
    """Assemble final 48 kHz mono `voice.wav` + `words.json` combining external/SVC narrator + multi-speaker dialogue."""
    narrator_items = [i for i, it in enumerate(items) if it["kind"] == "speech" and it["is_narrator"]]
    narrator_clips = {}  # item_idx -> (samples_44k, rel_words)

    if args.vc_pack and args.narrator_vc_wav:
        mf_path = os.path.join(args.vc_pack, "vc_pack_manifest.json")
        with open(mf_path, encoding="utf-8") as fp:
            mf = json.load(fp)
        vc_full = load_audio_mono(args.narrator_vc_wav, SR_VC)
        n_target = int(mf["total_samples"])
        if len(vc_full) > n_target:
            vc_full = vc_full[:n_target]
        elif len(vc_full) < n_target:
            vc_full = np.pad(vc_full, (0, n_target - len(vc_full)))
        for seg in mf["segments"]:
            clip = vc_full[int(seg["start_sample"]) : int(seg["end_sample"])].copy()
            narrator_clips[int(seg["item_idx"])] = (clip, seg.get("words") or [])
    elif args.narrator_dir:
        for n_idx, item_idx in enumerate(narrator_items, 1):
            it = items[item_idx]
            p = find_narrator_clip(args.narrator_dir, n_idx)
            clip = trim_silence(load_audio_mono(p, SR_VC), SR_VC, pad_s=0.025)
            rel_w = estimate_syllable_words(it["text"], len(clip) / float(SR_VC), 0.0, it["speaker"], it["mood"])
            narrator_clips[item_idx] = (clip, rel_w)
    elif args.narrator_audio:
        raw_full = load_audio_mono(args.narrator_audio, SR_VC)
        chunks = split_audio_vad(raw_full, SR_VC, len(narrator_items))
        for item_idx, clip in zip(narrator_items, chunks):
            it = items[item_idx]
            clip = trim_silence(clip, SR_VC, pad_s=0.025)
            rel_w = estimate_syllable_words(it["text"], len(clip) / float(SR_VC), 0.0, it["speaker"], it["mood"])
            narrator_clips[item_idx] = (clip, rel_w)

    # Local So-VITS-SVC fallback if explicitly enabled (and no external narrator supplied)
    use_local_vc = (not narrator_clips) and (not args.no_vc) and os.path.isfile(args.vc_model)
    if use_local_vc and narrator_items:
        vc_tmp_dir = os.path.join(tmp_dir, "local_vc_pack")
        guide_wav, mf_path = export_vc_pack(items, vc_tmp_dir, tmp_dir, args, synth_fn=synth_fn)
        vc_out_wav = os.path.join(vc_tmp_dir, "narrator_svc_out.wav")
        run_local_svc(guide_wav, vc_out_wav, args)
        with open(mf_path, encoding="utf-8") as fp:
            mf = json.load(fp)
        vc_full = load_audio_mono(vc_out_wav, SR_VC)
        n_target = int(mf["total_samples"])
        vc_full = vc_full[:n_target] if len(vc_full) >= n_target else np.pad(vc_full, (0, n_target - len(vc_full)))
        for seg in mf["segments"]:
            narrator_clips[int(seg["item_idx"])] = (vc_full[int(seg["start_sample"]) : int(seg["end_sample"])].copy(), seg.get("words") or [])

    timeline = []
    all_words = []
    sentences = []
    dead_silences = []
    cur_sec = 0.0

    if args.lead_silence > 0:
        n_lead = int(round(args.lead_silence * SR_VC))
        timeline.append(np.zeros(n_lead, dtype=np.float64))
        cur_sec += n_lead / float(SR_VC)

    just_after_dead = False
    sent_num = 0

    for idx, it in enumerate(items):
        if it["kind"] in ("pause", "dead_silence"):
            n_sil = int(round(it["dur"] * SR_VC))
            sil_s = cur_sec
            sil_e = cur_sec + n_sil / float(SR_VC)
            timeline.append(np.zeros(n_sil, dtype=np.float64))
            if it["kind"] == "dead_silence":
                dead_silences.append({"s": round(sil_s, 4), "e": round(sil_e, 4)})
                just_after_dead = True
            cur_sec = sil_e
            continue

        mood = it["mood"]
        prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
        if idx in narrator_clips:
            raw_seg, rel_words = narrator_clips[idx]
        elif synth_fn is not None:
            raw_seg, rel_words = synth_fn(it, SR_VC, idx)
        else:
            cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(args.out_dir)), ".tts_cache")
            raw_seg, rel_words = synth_edge_chunk(it, SR_VC, tmp_dir, idx, args.speed_scale, cache_dir=cache_dir)

        # Normalize RMS cleanly then apply mood-driven dynamic loudness contour + Character FX DSP!
        seg = normalize_rms(raw_seg, target_dbfs=-19.0)
        seg = apply_voice_fx(seg, SR_VC, fx=it["fx"], mood=mood)
        seg = seg * (10.0 ** (float(prof["gain_db"]) / 20.0))

        # Natural procedural human breath cue before tense/whisper/panic or post-DEAD SILENCE lines
        breath_offset = 0.0
        if args.auto_breath and it["fx"] not in ("phone", "ghost"):
            b_kind = "sharp_gasp" if (just_after_dead and mood in ("panic", "tense", "dread")) else prof["breath"]
            if b_kind and b_kind != "none":
                b_arr = synth_breath(b_kind, SR_VC, seed=100 + idx * 17)
                b_gain = 10.0 ** (float(prof["breath_db"]) / 20.0)
                timeline.append(b_arr * b_gain)
                breath_offset = len(b_arr) / float(SR_VC)
                cur_sec += breath_offset
        just_after_dead = False

        # Ghost reverse-reverb pre-padding offset (`0.22s`) shifts spoken start accurately
        fx_pre_s = 0.22 if it["fx"] == "ghost" else 0.0
        seg_start = cur_sec
        timeline.append(seg)
        cur_sec += len(seg) / float(SR_VC)

        if not rel_words:
            rel_words = estimate_syllable_words(it["text"], len(raw_seg) / float(SR_VC), 0.0, it["speaker"], mood)

        sent_words = []
        for rw in rel_words:
            w_obj = {
                "w": rw["w"],
                "s": round(seg_start + fx_pre_s + float(rw["s"]), 4),
                "e": round(seg_start + fx_pre_s + float(rw["e"]), 4),
                "speaker": it["speaker"],
                "mood": mood,
            }
            all_words.append(w_obj)
            sent_words.append(w_obj)

        sent_num += 1
        if sent_words:
            sentences.append({
                "sent": sent_num,
                "speaker": it["speaker"],
                "mood": mood,
                "fx": it["fx"],
                "s": sent_words[0]["s"],
                "e": sent_words[-1]["e"],
                "text": it["text"],
            })

        # Natural breathing gap between adjacent speech lines (unless next item is an explicit pause/dead silence)
        next_it = items[idx + 1] if idx + 1 < len(items) else None
        if next_it and next_it["kind"] == "speech":
            gap_s = float(prof["tail_pad"]) + (0.10 if next_it["speaker"] != it["speaker"] else 0.0)
            n_gap = int(round(gap_s * SR_VC))
            timeline.append(np.zeros(n_gap, dtype=np.float64))
            cur_sec += n_gap / float(SR_VC)

    if args.tail_silence > 0:
        n_tail = int(round(args.tail_silence * SR_VC))
        timeline.append(np.zeros(n_tail, dtype=np.float64))
        cur_sec += n_tail / float(SR_VC)

    full_44k = np.concatenate(timeline) if timeline else np.zeros(SR_VC, dtype=np.float64)
    # Resample to 48 kHz mono 16-bit with clean 45 Hz sub-rumble filter
    g = math.gcd(SR_FINAL, SR_VC)
    full_48k = signal.resample_poly(full_44k, SR_FINAL // g, SR_VC // g)
    full_48k = _hp(full_48k, 45.0, SR_FINAL, order=2)
    pk = float(np.max(np.abs(full_48k)))
    if pk > 0.94:
        full_48k *= 0.94 / pk

    os.makedirs(args.out_dir, exist_ok=True)
    final_wav = os.path.join(args.out_dir, args.out_wav)
    write_wav_mono16(final_wav, full_48k, SR_FINAL)

    final_dur = len(full_48k) / float(SR_FINAL)
    total_frames = int(math.ceil((final_dur + 0.35) * args.fps))
    ds_total = sum(d["e"] - d["s"] for d in dead_silences)
    wps = round(len(all_words) / max(0.1, final_dur - ds_total), 2)

    payload = {
        "engine": "horror-voice-v5",
        "voice": args.base_voice,
        "narrator_source": (
            "vc_pack_external" if (args.vc_pack and args.narrator_vc_wav)
            else "narrator_dir" if args.narrator_dir
            else "narrator_audio" if args.narrator_audio
            else ("local_svc" if use_local_vc else "edge_tts_expressive")
        ),
        "dur": round(final_dur, 4),
        "fps": args.fps,
        "total_frames": total_frames,
        "words_per_sec": wps,
        "words": all_words,
        "sentences": sentences,
        "dead_silences": dead_silences,
    }
    words_json = os.path.join(args.out_dir, "words.json")
    with open(words_json, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)

    if args.words_ts:
        os.makedirs(os.path.dirname(os.path.abspath(args.words_ts)), exist_ok=True)
        with open(args.words_ts, "w", encoding="utf-8") as fp:
            fp.write("// Auto-generated by scripts/gen_horror_voice.py (v5.0 Expressive Hybrid Voice)\n")
            fp.write(f"export const VOICE_DUR = {round(final_dur, 4)};\n")
            fp.write(f"export const TOTAL_FRAMES = {total_frames};\n")
            fp.write("export type WordTiming = { w: string; s: number; e: number; speaker?: string; mood?: string };\n")
            fp.write("export const WORDS: WordTiming[] = " + json.dumps(all_words, ensure_ascii=False) + ";\n")

    print(f"VOICE OK -> {final_wav} ({final_dur:.3f}s, {total_frames}f @ {args.fps}fps, {len(all_words)} words, {wps:.2f} w/s)")
    for sb in sentences:
        print(f"  S{sb['sent']:02d} [{sb['speaker']} · {sb['mood']}/{sb['fx']}] [{sb['s']:6.2f}s..{sb['e']:6.2f}s] {sb['text'][:58]}")
    for ds in dead_silences:
        print(f"  DEAD_SILENCE [{ds['s']:6.2f}s..{ds['e']:6.2f}s]")
    return final_wav, words_json, payload


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v5.0 Expressive Multi-Speaker & So-VITS-SVC Hybrid Voice Generator.")
    ap.add_argument("--script", required=True, help="Path to horror SCRIPT.md / .txt")
    ap.add_argument("--out-dir", default="out/voice", help="Output directory for voice.wav and words.json")
    ap.add_argument("--base-voice", default="vi-VN-NamMinhNeural", help="Default edge-tts voice")
    ap.add_argument("--speed-scale", type=float, default=1.0, help="Global multiplier on mood speeds (default 1.0)")
    ap.add_argument("--ellipsis-pause", type=float, default=0.42, help="Real pause duration injected on mid-sentence `...` (s)")
    ap.add_argument("--lead-silence", type=float, default=0.08, help="Lead silence before first line (s)")
    ap.add_argument("--tail-silence", type=float, default=0.35, help="Trailing silence after last line (s)")
    ap.add_argument("--fps", type=int, default=30, help="Timeline FPS for total_frames")
    ap.add_argument("--out-wav", default="voice.wav", help="Output WAV filename inside --out-dir")
    ap.add_argument("--auto-breath", action=argparse.BooleanOptionalAction, default=True, help="Inject subtle human breath cues (default ON)")
    ap.add_argument("--tts-cache", default=None, help="Optional disk cache directory for edge-tts chunks")
    ap.add_argument("--words-ts", default=None, help="Optional TypeScript words.ts export path")

    # 2-Machine So-VITS-SVC Expressive VC-Pack & External Narrator options
    ap.add_argument("--export-vc-pack", default=None, help="Step 1: Export 1-file expressive narrator_guide_44k.wav + manifest for So-VITS-SVC PC")
    ap.add_argument("--vc-pack", default=None, help="Step 3: VC pack folder produced by --export-vc-pack")
    ap.add_argument("--narrator-vc-wav", default=None, help="Step 3: Converted narrator_svc_out.wav returned from So-VITS-SVC PC")
    ap.add_argument("--export-narrator-script", default=None, help="Export numbered narrator emotion cue sheet (.txt) for external TTS/recording")
    ap.add_argument("--narrator-dir", default=None, help="Folder of individual external narrator clips (N01.wav, N02.wav...)")
    ap.add_argument("--narrator-audio", default=None, help="Single combined external narrator WAV/MP3 (auto-split via VAD)")

    # Local So-VITS-SVC options (note: --no-auto-predict-f0 is NOW THE DEFAULT to preserve horror pitch contour!)
    ap.add_argument("--vc-venv", default="D:/voice-engine/venv", help="Path to So-VITS-SVC venv root")
    ap.add_argument("--vc-model", default="D:/voice-engine/models/ngan/G_1001.pth", help="So-VITS-SVC generator checkpoint")
    ap.add_argument("--vc-config", default="D:/voice-engine/models/ngan/config.json", help="So-VITS-SVC config.json")
    ap.add_argument("--vc-cache-root", default="D:/voice-engine", help="So-VITS-SVC cache root")
    ap.add_argument("--speaker", default="ngan", help="Target speaker key in config.json")
    ap.add_argument("--f0-method", default="parselmouth", choices=["crepe", "crepe-tiny", "parselmouth", "dio", "harvest", "rmvpe"])
    ap.add_argument("--transpose", type=int, default=-5, help="Semitone transpose with -na (default -5)")
    ap.add_argument("--auto-predict-f0", action=argparse.BooleanOptionalAction, default=False, help="OFF by default (-na) so So-VITS-SVC preserves expressive mood pitch!")
    ap.add_argument("--noise-scale", type=float, default=0.30)
    ap.add_argument("--pad-seconds", type=float, default=0.25)
    ap.add_argument("--max-chunk-seconds", type=float, default=20.0)
    ap.add_argument("--no-vc", action="store_true", help="Skip local So-VITS-SVC conversion")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    items = parse_script(args.script, default_voice=args.base_voice, ellipsis_pause=args.ellipsis_pause)

    if args.export_narrator_script:
        export_narrator_script(items, args.export_narrator_script)
        return

    tmp_dir = tempfile.mkdtemp(prefix="hvoice5_")
    try:
        if args.export_vc_pack:
            export_vc_pack(items, args.export_vc_pack, tmp_dir, args)
            return
        assemble_voice(items, args, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
