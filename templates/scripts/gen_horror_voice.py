#!/usr/bin/env python3
"""Horror Engine v5.5: Expressive Voice Acting Engine (Word-Level Micro-Prosody, Stuttering, Vocal Tremor,
True Breathy Whisper Vocoder, Pluggable Gemini/Edge TTS & 1-File So-VITS-SVC VC-Pack).

Solves every AI horror narration flaw — including flat intra-sentence rhythm & lack of real acting emotions:
  1. 10 expressive acting moods (`calm_omen`, `curious`, `tense`, `whisper`, `fear_tremble`, `stutter_panic`,
     `dread`, `panic`, `cold_twist`, `ghost_entity`) with wide cinematic tempo contrast (0.68x .. 1.32x)
     and configurable intensity (`--acting subtle|cinematic|extreme`, default `cinematic`).
  2. Inline word/phrase director tags directly inside `SCRIPT.md`:
     - Real acoustic stuttering: `[STUTTER] cái gì` or natural `K-không... c-cái gì vậy?!`
     - Intra-sentence pace shifts: `[SLOW]...[/SLOW]`, `[FAST]...[/FAST]`
     - Local vocal tremor & curious pitch lift: `[TREMBLE]...[/TREMBLE]`, `[UP]`
     - Organic human micro-cues mid-sentence: `[BEAT]`, `[GASP]`, `[TREMBLE_GASP]`, `[SWALLOW]`, `[SIGH]`, `[WHISPER_BREATH]`
  3. 5 pure-Python/ffmpeg vocal-tract acting DSP engines (0 extra pip dependencies):
     - True 8-band Formant Breathy Whisper Vocoder (applied post-SVC so So-VITS-SVC F0 stays crystal clean!)
     - AM+FM Vocal-Cord Fear Tremor (6.2 Hz genuine frightened throat quiver)
     - WSOLA Pitch-Contour Ramp (+2.2 st curious rising inflection / -1.2 st dread fall)
     - Acoustic Syllable-Onset Stutter Engine (slices real word onset 95-125ms + choked glottal stop + repeats)
     - Word-Boundary Intra-Sentence Pacing Engine (decelerating dread tails, curious pre-keyword micro-pauses,
       fear-tremble mid-phrase halts, accelerating tense/panic bursts)
  4. Pluggable TTS backends (`--tts-engine auto|edge|gemini`):
     - `gemini`: Gemini 2.5 Flash Preview TTS via Free Tier REST API (`GEMINI_API_KEY`, pure urllib) with Vietnamese acting prompts
     - `edge`: Reliable 20-retry cached `edge-tts` + local `rubberband`/`atempo` + full micro-prosody acting DSP (0đ default)
  5. Effortless 2-machine 1-file So-VITS-SVC VC-Pack workflow (`-na` / `--no-auto-predict-f0` preserves ALL rhythm,
     stuttering, tremor, and rising/falling intonation!) + optional `--export-acting-pack` for F5-TTS/VieNeu-TTS.
"""

import argparse
import asyncio
import base64
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
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

# Inline director tags inside spoken lines
INLINE_SPLIT_RE = re.compile(
    r"(\[(?:BEAT|GASP|TREMBLE_GASP|SWALLOW|SIGH|WHISPER_BREATH)\]|\[(?:SLOW|FAST|TREMBLE)\].*?\[/(?:SLOW|FAST|TREMBLE)\])",
    re.IGNORECASE,
)
INLINE_WRAP_RE = re.compile(r"^\[(SLOW|FAST|TREMBLE)\](.*)\[/\1\]$", re.IGNORECASE | re.DOTALL)
INLINE_CUE_RE = re.compile(r"^\[(BEAT|GASP|TREMBLE_GASP|SWALLOW|SIGH|WHISPER_BREATH)\]$", re.IGNORECASE)
INLINE_UP_RE = re.compile(r"\[UP\]", re.IGNORECASE)
INLINE_STUTTER_TAG_RE = re.compile(r"\[STUTTER\]\s*", re.IGNORECASE)
HYPHEN_STUTTER_RE = re.compile(r"^((?:[A-Za-zÀ-Ỹà-ỹĐđ]{1,2}-)+)([A-Za-zÀ-Ỹà-ỹĐđ]{2,}.*)$")

ACTING_SCALES = {
    "subtle": 0.55,
    "cinematic": 1.0,
    "extreme": 1.38,
}

MOOD_PROFILES = {
    "calm_omen": {
        "rate": "-4%",
        "pitch": "-4Hz",
        "pitch_semi": -0.60,
        "speed": 0.86,
        "gain_db": 0.0,
        "breath": "soft_inhale",
        "breath_db": -25.0,
        "tail_pad": 0.16,
        "tempo_curve": "flat",
        "pitch_tail_semi": -0.4,
        "tremor": 0.0,
        "whisper_mix": 0.0,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng kể chuyện kinh dị trầm lắng, chậm rãi, bình tĩnh nhưng ẩn chứa điềm gở rờn rợn",
    },
    "curious": {
        "rate": "-2%",
        "pitch": "+2Hz",
        "pitch_semi": +0.25,
        "speed": 0.88,
        "gain_db": -1.0,
        "breath": "soft_inhale",
        "breath_db": -24.0,
        "tail_pad": 0.18,
        "tempo_curve": "curious_probe",
        "pitch_tail_semi": +2.25,
        "tremor": 0.0,
        "whisper_mix": 0.0,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng tò mò, nghi hoặc, dò xét cẩn thận, chậm nhẹ trước từ khóa và hơi lên giọng nghi vấn cuối câu",
    },
    "tense": {
        "rate": "+6%",
        "pitch": "+1Hz",
        "pitch_semi": +0.15,
        "speed": 1.10,
        "gain_db": +0.5,
        "breath": "short_inhale",
        "breath_db": -22.5,
        "tail_pad": 0.10,
        "tempo_curve": "accel",
        "pitch_tail_semi": +0.6,
        "tremor": 0.0,
        "whisper_mix": 0.0,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng căng thẳng, cảnh giác cao độ, nhịp độ dồn nhanh dần về cuối câu",
    },
    "whisper": {
        "rate": "-14%",
        "pitch": "-5Hz",
        "pitch_semi": -1.00,
        "speed": 0.74,
        "gain_db": -5.2,
        "breath": "whisper_breath",
        "breath_db": -21.0,
        "tail_pad": 0.20,
        "tempo_curve": "flat",
        "pitch_tail_semi": -0.3,
        "tremor": 0.18,
        "whisper_mix": 0.56,
        "auto_stutter": 0,
        "acting_prompt": "Nói bằng giọng thì thầm cực nhỏ sát tai, nhiều hơi gió, chậm rãi và rợn gáy như đang trốn trong bóng tối",
    },
    "fear_tremble": {
        "rate": "-10%",
        "pitch": "-4Hz",
        "pitch_semi": -0.75,
        "speed": 0.78,
        "gain_db": -1.5,
        "breath": "tremble_gasp",
        "breath_db": -19.5,
        "tail_pad": 0.18,
        "tempo_curve": "tremble_halts",
        "pitch_tail_semi": +0.8,
        "tremor": 1.0,
        "whisper_mix": 0.16,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng sợ hãi cực độ, run rẩy bần bật, nghẹn cổ, hụt hơi và đứt quãng từng nhịp vì kinh hoàng",
    },
    "stutter_panic": {
        "rate": "+16%",
        "pitch": "+8Hz",
        "pitch_semi": +1.75,
        "speed": 1.26,
        "gain_db": +3.0,
        "breath": "sharp_gasp",
        "breath_db": -17.5,
        "tail_pad": 0.07,
        "tempo_curve": "panic_burst",
        "pitch_tail_semi": +1.1,
        "tremor": 0.48,
        "whisper_mix": 0.0,
        "auto_stutter": 1,
        "acting_prompt": "Đọc cực kỳ hoảng loạn, nói nhanh gấp gáp mất bình tĩnh, giọng vút cao và lắp bắp vấp chữ vì quá sốc",
    },
    "dread": {
        "rate": "-14%",
        "pitch": "-8Hz",
        "pitch_semi": -1.45,
        "speed": 0.84,
        "gain_db": -2.0,
        "breath": "shaky_exhale",
        "breath_db": -23.0,
        "tail_pad": 0.24,
        "tempo_curve": "decel_dread",
        "pitch_tail_semi": -1.25,
        "tremor": 0.30,
        "whisper_mix": 0.08,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng nặng nề, u ám rợn gáy, chậm dần hẳn ở những từ cuối như điềm dữ đang ập xuống",
    },
    "panic": {
        "rate": "+14%",
        "pitch": "+7Hz",
        "pitch_semi": +1.50,
        "speed": 1.24,
        "gain_db": +3.0,
        "breath": "sharp_gasp",
        "breath_db": -18.0,
        "tail_pad": 0.08,
        "tempo_curve": "accel",
        "pitch_tail_semi": +0.9,
        "tremor": 0.32,
        "whisper_mix": 0.0,
        "auto_stutter": 0,
        "acting_prompt": "Đọc nhanh dồn dập, hoảng hốt, giọng cao căng thẳng như đang chạy trốn khẩn cấp",
    },
    "cold_twist": {
        "rate": "-16%",
        "pitch": "-8Hz",
        "pitch_semi": -1.60,
        "speed": 0.72,
        "gain_db": -1.5,
        "breath": "swallow",
        "breath_db": -20.5,
        "tail_pad": 0.28,
        "tempo_curve": "decel_dread",
        "pitch_tail_semi": -1.10,
        "tremor": 0.0,
        "whisper_mix": 0.0,
        "auto_stutter": 0,
        "acting_prompt": "Đọc cực kỳ chậm, lạnh lùng vô hồn, nhấn chậm từng từ cuối để chốt cú lật kinh dị lạnh sống lưng",
    },
    "ghost_entity": {
        "rate": "-18%",
        "pitch": "-12Hz",
        "pitch_semi": -2.55,
        "speed": 0.70,
        "gain_db": -0.5,
        "breath": "none",
        "breath_db": -30.0,
        "tail_pad": 0.24,
        "tempo_curve": "decel_dread",
        "pitch_tail_semi": -1.30,
        "tremor": 0.28,
        "whisper_mix": 0.22,
        "auto_stutter": 0,
        "acting_prompt": "Đọc bằng giọng thực thể ma quái trầm khàn kéo dài, lạnh lẽo và dị thường không giống người sống",
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


def _strip_accents(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def normalize_vi_for_tts(text: str) -> str:
    """Convert Vietnamese clock times (01:06) & dates (22/11) to natural spoken Vietnamese for TTS while preserving display tokens."""
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
            val = v.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            out[k.strip().lower()] = val
    return out


def extract_stutters_and_clean(seg_text: str):
    """Parse `[STUTTER] word` and natural `K-không` / `C-c-cái` tokens into clean TTS text + stutter word map.

    Returns `(display_text, clean_tts_source, stutter_map)` where `stutter_map` maps word_index -> repeat_count (1 or 2).
    """
    # Mark explicit [STUTTER] tokens via sentinel so token indices stay aligned
    marked = INLINE_STUTTER_TAG_RE.sub("__STUT__", seg_text)
    raw_toks = [t for t in marked.split() if t]
    disp_toks = []
    tts_toks = []
    stutter_map = {}

    for idx, raw_t in enumerate(raw_toks):
        explicit = False
        tok = raw_t
        if tok.startswith("__STUT__"):
            explicit = True
            tok = tok[len("__STUT__") :]
            if not tok:
                continue

        # Check natural hyphenated stutter (e.g., K-không, K-k-không, Ch-chạy, Đ-đừng)
        m = HYPHEN_STUTTER_RE.match(tok)
        if m:
            prefix_chain, root_word = m.group(1), m.group(2)
            prefixes = [p for p in prefix_chain.split("-") if p]
            root_plain = _strip_accents(root_word).lower()
            # Only treat as stutter when every short prefix matches the root word's onset letters!
            if prefixes and all(
                1 <= len(p) <= 2 and root_plain.startswith(_strip_accents(p).lower())
                for p in prefixes
            ):
                reps = min(2, max(1, len(prefixes)))
                stutter_map[len(tts_toks)] = reps
                disp_toks.append(tok)       # Preserve `K-không` verbatim for SCRIPT.md / manifest.json alignment!
                tts_toks.append(root_word)  # Send clean `"không"` to TTS so it never pronounces letter "K"!
                continue

        if explicit:
            stutter_map[len(tts_toks)] = 2
        disp_toks.append(tok)
        tts_toks.append(tok)

    return " ".join(disp_toks), " ".join(tts_toks), stutter_map


def _emit_speech_subsegments(txt: str, cur: dict, items: list, ellipsis_pause: float):
    """Split a text span on inline tags (`[SLOW]..[/SLOW]`, `[FAST]..[/FAST]`, `[TREMBLE]..[/TREMBLE]`, `[GASP]`, `[SWALLOW]`, `[BEAT]`, `...`)."""
    chunks = INLINE_SPLIT_RE.split(txt)
    for ch in chunks:
        ch = ch.strip()
        if not ch:
            continue

        cm = INLINE_CUE_RE.match(ch)
        if cm:
            cue = cm.group(1).lower()
            if cue == "beat":
                items.append({"kind": "pause", "dur": 0.22, "from_beat": True})
            else:
                items.append({"kind": "cue", "cue": cue, "mood": cur["mood"], "speaker": cur["speaker"]})
            continue

        inline_speed_mult = 1.0
        force_tremble = False
        inner = ch
        wm = INLINE_WRAP_RE.match(ch)
        if wm:
            tag = wm.group(1).upper()
            inner = wm.group(2).strip()
            if tag == "SLOW":
                inline_speed_mult = 0.74
            elif tag == "FAST":
                inline_speed_mult = 1.32
            elif tag == "TREMBLE":
                force_tremble = True

        # Split mid-line ellipses `...` / `…` into genuine suspense hesitation pauses!
        sub_parts = ELLIPSIS_SPLIT_RE.split(inner)
        si = 0
        while si < len(sub_parts):
            seg = sub_parts[si].strip()
            has_ell = (si + 1 < len(sub_parts)) and bool(sub_parts[si + 1])
            has_more = (si + 2 < len(sub_parts)) and bool(sub_parts[si + 2].strip())
            if seg:
                force_up = bool(INLINE_UP_RE.search(seg))
                seg_clean_up = INLINE_UP_RE.sub("", seg).strip()
                if seg_clean_up:
                    disp_seg, tts_src, stutter_map = extract_stutters_and_clean(seg_clean_up)
                    display_seg = (disp_seg + "...") if has_ell else disp_seg
                    mood = cur["mood"] if cur["mood"] in MOOD_PROFILES else "calm_omen"
                    prof = MOOD_PROFILES[mood]
                    if not stutter_map and prof.get("auto_stutter", 0) > 0 and len(tts_src.split()) >= 2:
                        stutter_map = {0: int(prof["auto_stutter"])}
                    if mood == "curious" and display_seg.rstrip().endswith("?"):
                        force_up = True

                    items.append({
                        "kind": "speech",
                        "text": display_seg,
                        "tts_text": normalize_vi_for_tts(tts_src),
                        "speaker": cur["speaker"],
                        "is_narrator": cur["is_narrator"],
                        "voice": cur["voice"],
                        "mood": mood,
                        "acting": cur.get("acting"),
                        "pitch": cur["pitch"],
                        "rate": cur["rate"],
                        "speed": cur["speed"],
                        "inline_speed_mult": inline_speed_mult,
                        "force_tremble": force_tremble,
                        "force_up": force_up,
                        "stutter_map": stutter_map,
                        "fx": cur["fx"],
                    })
                    if has_ell and has_more and ellipsis_pause > 0:
                        items.append({"kind": "pause", "dur": ellipsis_pause, "from_ellipsis": True})
            si += 2


def parse_script(path: str, default_voice: str = "vi-VN-NamMinhNeural", ellipsis_pause: float = 0.42):
    """Parse .txt/.md script into ordered items: speech (with mood/inline acting directives/stutters), cue, pause, or dead_silence."""
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
        "acting": None,
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
                    "acting": kv.get("acting"),
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
                    "acting": kv.get("acting"),
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
                _emit_speech_subsegments(txt, cur, items, ellipsis_pause)
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
    """Load any WAV/MP3/FLAC/M4A file as mono float64 at `target_sr`."""
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
    lo_n = max(10.0, lo) / nyq
    hi_n = min(nyq * 0.96, hi) / nyq
    if lo_n >= hi_n:
        return np.zeros_like(x, dtype=np.float64)
    sos = signal.butter(order, [lo_n, hi_n], btype="bandpass", output="sos")
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


# ---------------- v5.5 Organic Human Vocal-Tract Micro-Cues (7 Types) ----------------

def synth_human_cue(kind: str, sr: int, seed: int = 17) -> np.ndarray:
    """Synthesize subtle realistic human vocal-tract cues:
    `soft_inhale`, `short_inhale`, `sharp_gasp`, `tremble_gasp`, `shaky_exhale`, `whisper_breath`, `swallow`, `sigh`."""
    k = (kind or "none").lower()
    if k == "gasp":
        k = "sharp_gasp"
    if not k or k == "none":
        return np.zeros(0, dtype=np.float64)

    rng = np.random.default_rng(seed)
    if k == "sharp_gasp":
        dur = 0.22
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 480.0, 3600.0, sr, 2) * 0.75 + _bp(nz, 1550.0, 5200.0, sr, 2) * 0.60
        glottal = _bp(np.sin(2.0 * np.pi * (380.0 + 180.0 * t / dur) * t), 300.0, 1400.0, sr, 2) * 0.14
        env = ((t / dur) ** 0.50) * np.exp(-((t / dur) ** 2.6) * 2.2)
        y = (air + glottal) * env
    elif k == "tremble_gasp":
        # Two-stage fearful shaky intake of breath
        dur = 0.36
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 440.0, 3400.0, sr, 2) * 0.8 + _bp(nz, 1400.0, 4800.0, sr, 2) * 0.45
        double_env = np.exp(-((t - 0.09) / 0.055) ** 2) * 0.82 + np.exp(-((t - 0.23) / 0.070) ** 2) * 1.0
        trem = 0.72 + 0.28 * np.sin(2.0 * np.pi * 13.0 * t)
        y = air * double_env * trem
    elif k == "short_inhale":
        dur = 0.16
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        y = _bp(nz, 520.0, 3300.0, sr, 2) * (np.sin(np.pi * t / dur) ** 1.2)
    elif k == "whisper_breath":
        dur = 0.28
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        y = (_bp(nz, 900.0, 5200.0, sr, 2) * 0.85 + _bp(nz, 2400.0, 7400.0, sr, 2) * 0.55) * (np.sin(np.pi * (t / dur) ** 0.8) ** 1.3)
    elif k in ("shaky_exhale", "sigh"):
        dur = 0.38 if k == "sigh" else 0.34
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 300.0, 2600.0, sr, 2)
        trem = 0.80 + 0.20 * np.sin(2.0 * np.pi * (8.5 if k == "sigh" else 11.5) * t)
        env = ((t / dur) ** 0.45) * np.exp(-t / (dur * 0.42))
        y = air * env * trem
    elif k == "swallow":
        # Tense dry throat gulp: two subtle wet-cavity thumps (180Hz & 340Hz) + faint pharyngeal click
        dur = 0.24
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        g1 = np.exp(-((t - 0.065) / 0.022) ** 2) * (np.sin(2.0 * np.pi * 165.0 * t) * 0.55 + _bp(nz, 220.0, 950.0, sr, 2) * 0.65)
        g2 = np.exp(-((t - 0.145) / 0.028) ** 2) * (np.sin(2.0 * np.pi * 240.0 * t) * 0.42 + _bp(nz, 380.0, 1650.0, sr, 2) * 0.85)
        click = np.exp(-((t - 0.132) / 0.005) ** 2) * _bp(nz, 1100.0, 3800.0, sr, 2) * 0.90
        y = g1 + g2 + click
    else:  # soft_inhale
        dur = 0.24
        n = int(round(dur * sr))
        t = np.arange(n) / float(sr)
        nz = rng.standard_normal(n)
        air = _bp(nz, 420.0, 2900.0, sr, 2)
        env = (np.sin(np.pi * (t / dur) ** 0.85)) ** 1.35
        y = air * env

    pk = float(np.max(np.abs(y))) + 1e-9
    return _fade(y / pk, sr, 0.012, 0.022)


def synth_breath(kind: str, sr: int, seed: int = 17) -> np.ndarray:
    """Backward-compatible alias for `synth_human_cue`."""
    return synth_human_cue(kind, sr, seed=seed)


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


# ---------------- v5.5 True Vocal-Tract & Micro-Prosody Acting DSP ----------------

def apply_true_whisper(x: np.ndarray, sr: int, mix: float = 0.56, seed: int = 404) -> np.ndarray:
    """8-Band Formant Envelope Whisper Vocoder: turns voiced TTS into real close-mic breathy whisper
    while preserving 100% Vietnamese syllable clarity & 6-tone intelligibility."""
    if len(x) < 64 or mix <= 0.01:
        return x.copy()
    x64 = x.astype(np.float64)
    rng = np.random.default_rng(seed)
    bands = [
        (280.0, 560.0, 0.55),
        (560.0, 950.0, 0.85),
        (950.0, 1500.0, 1.05),
        (1500.0, 2300.0, 1.25),
        (2300.0, 3400.0, 1.35),
        (3400.0, 4800.0, 1.25),
        (4800.0, 6600.0, 1.00),
        (6600.0, 9200.0, 0.65),
    ]
    n = len(x64)
    # Broadband speech airflow envelope ensures deep vowels (like male Vietnamese voices) still carry rich breathy whisper air!
    broad_env = _lp(np.abs(_hp(x64, 110.0, sr, order=2)), 30.0, sr, order=2)
    whisper_air = np.zeros(n, dtype=np.float64)
    for lo, hi, w_gain in bands:
        b = _bp(x64, lo, hi, sr, order=2)
        env_local = _lp(np.abs(b), 28.0, sr, order=2)
        # Upper whisper formants (1.5-6.6 kHz) receive glottal breath coupling from broadband syllable airflow
        breath_couple = 0.42 if (1400.0 <= lo <= 5000.0) else 0.16
        env = env_local + breath_couple * broad_env
        nz = _bp(rng.standard_normal(n), lo, hi, sr, order=2)
        nz_rms = float(np.sqrt(np.mean(nz ** 2)) + 1e-9)
        whisper_air += (nz / nz_rms) * env * (2.6 * w_gain)

    # Match whisper airflow energy smoothly to original speech RMS
    src_rms = float(np.sqrt(np.mean(x64 ** 2)) + 1e-9)
    air_rms = float(np.sqrt(np.mean(whisper_air ** 2)) + 1e-9)
    whisper_air *= src_rms / air_rms

    # Thin voiced body (remove chest resonance, keep subtle tonal backbone + close-mic air)
    voiced_thin = _hp(x64, 220.0, sr, order=2)
    prox_warm = _bp(x64, 115.0, 230.0, sr, order=2) * 0.14
    m = max(0.0, min(0.82, float(mix)))
    out = (1.0 - m) * voiced_thin + m * whisper_air + prox_warm
    return np.tanh(out * 1.12) * 0.92


def apply_vocal_tremor(
    x: np.ndarray,
    sr: int,
    rate_hz: float = 6.2,
    fm_semi: float = 0.42,
    am_depth: float = 0.24,
    strength: float = 1.0,
    seed: int = 99,
) -> np.ndarray:
    """Genuine frightened vocal-cord quiver: combined organic FM pitch tremor + AM breath instability."""
    if len(x) < 128 or strength <= 0.01:
        return x.copy()
    x64 = x.astype(np.float64)
    n = len(x64)
    t = np.arange(n, dtype=np.float64) / float(sr)
    rng = np.random.default_rng(seed)

    # Irregular human muscle shake (slowly drifting frequency around 6.2 Hz so it never sounds robotic)
    slow_mod = _lp(rng.standard_normal(n), 2.2, sr, order=2)
    slow_mod = slow_mod / (float(np.max(np.abs(slow_mod))) + 1e-9)
    ph = 2.0 * np.pi * rate_hz * t + 1.35 * slow_mod

    # FM vocal pitch wobble via smooth time-varying delay interpolation
    semi = fm_semi * strength
    delay_amp = (semi / 12.0) * math.log(2.0) / max(1.0, 2.0 * math.pi * rate_hz)
    delay_samp = delay_amp * sr * (1.0 + np.sin(ph))
    idx = np.clip(np.arange(n, dtype=np.float64) - delay_samp, 0.0, n - 1.0)
    y = np.interp(idx, np.arange(n, dtype=np.float64), x64)

    # AM quiver (throat choking flutter) + faint nervous breath layer
    am = 1.0 - min(0.45, am_depth * strength) * (0.5 + 0.5 * np.sin(ph + 0.75))
    env = _lp(np.abs(y), 24.0, sr, order=2)
    nervous_air = _bp(rng.standard_normal(n), 1400.0, 4800.0, sr, order=2) * env * (0.22 * strength)
    return y * am + nervous_air


def apply_pitch_ramp(x: np.ndarray, sr: int, tail_sec: float = 0.44, end_semi: float = 2.2) -> np.ndarray:
    """WSOLA-aligned Hann-window pitch contour ramp over the last `tail_sec` of an utterance.
    Creates genuine curious rising inflection (+2.2 st) or dread downward drop (-1.2 st) keeping exact length!"""
    n = len(x)
    if n < int(0.18 * sr) or abs(end_semi) < 0.15:
        return x.copy()
    x64 = x.astype(np.float64)
    tail_n = min(int(round(tail_sec * sr)), int(n * 0.46))
    start_tail = n - tail_n

    win_n = int(round(0.028 * sr))
    if win_n % 2 == 1:
        win_n += 1
    hop = win_n // 4
    win = np.hanning(win_n)
    search_rad = max(8, int(round(0.004 * sr)))

    out = x64.copy()
    acc = np.zeros(tail_n + win_n, dtype=np.float64)
    wsum = np.zeros(tail_n + win_n, dtype=np.float64)

    prev_tail_end = None
    pos = 0
    while pos < tail_n:
        u = min(1.0, max(0.0, pos / float(max(1, tail_n - hop))))
        # Smooth S-curve ramping pitch mainly on the final syllable
        curve = u * u * (3.0 - 2.0 * u)
        ratio = 2.0 ** ((end_semi * curve) / 12.0)

        src_center = start_tail + pos + win_n // 2
        half_span = 0.5 * win_n * ratio
        # WSOLA local correlation search around src_center to prevent phase cancellation
        best_c = src_center
        if prev_tail_end is not None and len(prev_tail_end) >= hop:
            best_score = -1e18
            for delta in range(-search_rad, search_rad + 1, 4):
                cand = src_center + delta
                s0 = int(round(cand - half_span))
                if s0 < 0 or s0 + hop >= n:
                    continue
                score = float(np.dot(prev_tail_end, x64[s0 : s0 + hop]))
                if score > best_score:
                    best_score = score
                    best_c = cand

        grid = np.linspace(best_c - half_span, best_c + half_span, win_n, endpoint=False)
        grid = np.clip(grid, 0.0, n - 1.0)
        grain = np.interp(grid, np.arange(n, dtype=np.float64), x64)
        acc[pos : pos + win_n] += grain * win
        wsum[pos : pos + win_n] += win
        prev_tail_end = grain[hop : 2 * hop]
        pos += hop

    valid = wsum[:tail_n] > 1e-6
    warped = np.where(valid, acc[:tail_n] / np.maximum(wsum[:tail_n], 1e-6), x64[start_tail:])
    # Smooth 25ms crossfade into warped tail
    xf = min(int(round(0.025 * sr)), tail_n // 4)
    if xf > 1:
        blend = np.linspace(0.0, 1.0, xf)
        warped[:xf] = x64[start_tail : start_tail + xf] * (1.0 - blend) + warped[:xf] * blend
    out[start_tail:] = warped
    return out


def time_stretch_array(x: np.ndarray, sr: int, speed: float, pitch_semi: float = 0.0, tmp_dir: str | None = None) -> np.ndarray:
    """Stretch mono float64 array cleanly using `ffmpeg rubberband` (or `atempo`) with offline WSOLA fallback."""
    if len(x) < 128 or (abs(speed - 1.0) < 0.015 and abs(pitch_semi) < 0.04):
        return x.copy()
    spd = max(0.55, min(1.55, float(speed)))
    if tmp_dir and shutil.which("ffmpeg"):
        in_w = os.path.join(tmp_dir, f"ts_in_{int(time.time() * 1e6) % 10000000}.wav")
        out_w = in_w.replace("_in_", "_out_")
        try:
            write_wav_mono16(in_w, x, sr)
            pitch_ratio = 2.0 ** (pitch_semi / 12.0)
            if abs(pitch_semi) > 0.04:
                if _ffmpeg_has_rubberband():
                    af = f"rubberband=pitch={pitch_ratio:.5f}:tempo={spd:.5f}:formant=preserved"
                else:
                    af = f"asetrate={int(round(sr * pitch_ratio))},aresample={sr},{_atempo_chain(spd / pitch_ratio)}"
            else:
                if _ffmpeg_has_rubberband():
                    af = f"rubberband=tempo={spd:.5f}:formant=preserved"
                else:
                    af = _atempo_chain(spd)
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-i", in_w, "-af", af, "-ar", str(sr), "-ac", "1", "-sample_fmt", "s16", out_w],
                check=True,
            )
            y, _ = read_wav_mono(out_w)
            return y
        finally:
            for fp_p in (in_w, out_w):
                if os.path.exists(fp_p):
                    os.remove(fp_p)

    # Pure numpy fallback (WSOLA time-scale) when ffmpeg is unavailable
    n_out = max(64, int(round(len(x) / spd)))
    win_n = int(round(0.028 * sr))
    hop_out = win_n // 4
    win = np.hanning(win_n)
    acc = np.zeros(n_out + win_n, dtype=np.float64)
    wsum = np.zeros(n_out + win_n, dtype=np.float64)
    for out_p in range(0, n_out, hop_out):
        in_p = int(round(out_p * spd))
        if in_p + win_n >= len(x):
            in_p = max(0, len(x) - win_n)
        acc[out_p : out_p + win_n] += x[in_p : in_p + win_n] * win
        wsum[out_p : out_p + win_n] += win
    return acc[:n_out] / np.maximum(wsum[:n_out], 1e-6)


def apply_syllable_stutter(
    seg: np.ndarray,
    rel_words: list,
    stutter_map: dict,
    sr: int,
    acting_scale: float = 1.0,
    seed: int = 33,
):
    """Real Acoustic Syllable-Onset Stutter Engine:
    Slices 95-125ms onset of target word(s) with choked glottal stop + breathless gap and repeats 1-2x before the full word.
    Shifts all downstream word timestamps accurately!"""
    if not stutter_map or not rel_words or len(seg) < int(0.15 * sr):
        return seg, rel_words

    rng = np.random.default_rng(seed)
    words = [dict(w) for w in rel_words]
    out_seg = seg.astype(np.float64).copy()

    # Apply from left to right tracking cumulative sample offset
    cum_offset_s = 0.0
    for w_idx in sorted(stutter_map.keys()):
        if w_idx < 0 or w_idx >= len(words):
            continue
        reps = max(1, min(2, int(stutter_map[w_idx])))
        ws = words[w_idx]["s"] + cum_offset_s
        we = words[w_idx]["e"] + cum_offset_s
        s_idx = max(0, int(round(ws * sr)))
        e_idx = min(len(out_seg), int(round(we * sr)))
        if e_idx - s_idx < int(0.08 * sr):
            continue

        # Locate exact active speech onset inside word window so we never stutter silence
        search_end = min(e_idx, s_idx + int(0.12 * sr))
        local = out_seg[s_idx:search_end]
        pk_local = float(np.max(np.abs(local))) + 1e-9
        active_rel = np.flatnonzero(np.abs(local) > pk_local * 0.14)
        onset_i = s_idx + (int(active_rel[0]) if len(active_rel) else 0)

        base_onset_s = min(0.125, max(0.082, (we - ws) * 0.44))
        stut_pieces = []
        for r_i in range(reps):
            # Vary each stammer slightly in duration & strained pitch so it sounds authentically human
            dur_k = base_onset_s * (0.86 if r_i == 0 and reps == 2 else 1.04)
            n_on = min(len(out_seg) - onset_i, int(round(dur_k * sr)))
            if n_on < int(0.04 * sr):
                continue
            raw_on = out_seg[onset_i : onset_i + n_on].copy()
            # Subtle strained upward pitch tension (+0.45 st) on first choked syllable
            strain = 1.0 + (0.025 if r_i == 0 else 0.012) * acting_scale
            grid = np.arange(0, len(raw_on) - 1, strain)
            strained = np.interp(grid, np.arange(len(raw_on)), raw_on)
            # Crisp glottal-stop choke cut
            strained = _fade(strained, sr, 0.005, 0.018) * (0.86 if r_i == 0 else 0.94)
            stut_pieces.append(strained)

            # Choked breathless gap (75-95ms) with ultra-subtle glottal air hiss
            gap_s = (0.082 + 0.015 * r_i) * (0.9 + 0.15 * acting_scale)
            n_gap = int(round(gap_s * sr))
            air = _bp(rng.standard_normal(n_gap), 900.0, 3800.0, sr, 2) * (0.004 * acting_scale) * np.sin(np.pi * np.linspace(0, 1, n_gap))
            stut_pieces.append(air)

        if not stut_pieces:
            continue
        inserted = np.concatenate(stut_pieces)
        ins_s = len(inserted) / float(sr)

        # Splice smoothly before `onset_i`
        xf = min(int(0.005 * sr), onset_i, len(out_seg) - onset_i)
        prefix = out_seg[:onset_i].copy()
        suffix = out_seg[onset_i:].copy()
        if xf > 1:
            prefix[-xf:] *= np.linspace(1.0, 0.0, xf)
            suffix[:xf] *= np.linspace(0.0, 1.0, xf)
        out_seg = np.concatenate([prefix, inserted, suffix])

        # Shift timestamps: stuttered word extends from original start through inserted stutter + full word; later words shift +ins_s
        words[w_idx]["e"] = round(words[w_idx]["e"] + ins_s, 4)
        for j in range(w_idx + 1, len(words)):
            words[j]["s"] = round(words[j]["s"] + ins_s, 4)
            words[j]["e"] = round(words[j]["e"] + ins_s, 4)
        cum_offset_s += ins_s

    return out_seg, words


def apply_intra_sentence_pacing(
    seg: np.ndarray,
    rel_words: list,
    mood: str,
    sr: int,
    acting_scale: float = 1.0,
    tmp_dir: str | None = None,
    seed: int = 55,
):
    """Dynamic Intra-Sentence Rhythm & Micro-Pause Engine driven by WordBoundary splits:
      - `decel_dread`: slows final 2-3 chilling words dramatically (0.76x + 0.14s dread hold + -0.8st drop)
      - `curious_probe`: inserts a 0.18s lean-in curiosity pause before final 2-3 mystery words
      - `tremble_halts`: injects 1-2 fearful trembling micro-halts (0.14s with shaky breath) mid-sentence
      - `accel` / `panic_burst`: accelerates second half (+12%) for visceral rising urgency!
    Updates all word timestamps accurately!"""
    prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
    curve = prof.get("tempo_curve", "flat")
    if curve == "flat" or acting_scale < 0.25 or len(rel_words) < 4 or len(seg) < int(0.70 * sr):
        return seg, rel_words

    words = [dict(w) for w in rel_words]
    n = len(seg)

    if curve == "decel_dread":
        split_w = max(2, len(words) - (3 if len(words) >= 6 else 2))
        cut_s = words[split_w]["s"]
        cut_i = max(int(0.15 * sr), min(n - int(0.20 * sr), int(round(cut_s * sr))))
        head = _fade(seg[:cut_i], sr, 0.004, 0.012)
        tail = _fade(seg[cut_i:], sr, 0.008, 0.012)
        hold_s = 0.14 * acting_scale
        hold = np.zeros(int(round(hold_s * sr)), dtype=np.float64)
        tail_speed = max(0.70, 1.0 - 0.20 * acting_scale)
        tail_semi = -0.85 * acting_scale
        tail_slow = time_stretch_array(tail, sr, speed=tail_speed, pitch_semi=tail_semi, tmp_dir=tmp_dir)
        scale_t = (len(tail_slow) / float(sr)) / max(1e-4, len(tail) / float(sr))
        out = np.concatenate([head, hold, tail_slow])
        head_end = len(head) / float(sr)
        for j in range(split_w, len(words)):
            words[j]["s"] = round(head_end + hold_s + max(0.0, (words[j]["s"] - cut_s) * scale_t), 4)
            words[j]["e"] = round(head_end + hold_s + max(0.04, (words[j]["e"] - cut_s) * scale_t), 4)
        return out, words

    if curve == "curious_probe":
        split_w = max(1, len(words) - (3 if len(words) >= 6 else 2))
        cut_s = words[split_w]["s"]
        cut_i = max(int(0.12 * sr), min(n - int(0.18 * sr), int(round(cut_s * sr))))
        head = _fade(seg[:cut_i], sr, 0.004, 0.012)
        tail = _fade(seg[cut_i:], sr, 0.008, 0.012)
        hold_s = 0.18 * acting_scale
        hold = np.zeros(int(round(hold_s * sr)), dtype=np.float64)
        tail_speed = max(0.80, 1.0 - 0.12 * acting_scale)
        tail_slow = time_stretch_array(tail, sr, speed=tail_speed, pitch_semi=0.0, tmp_dir=tmp_dir)
        scale_t = (len(tail_slow) / float(sr)) / max(1e-4, len(tail) / float(sr))
        out = np.concatenate([head, hold, tail_slow])
        head_end = len(head) / float(sr)
        for j in range(split_w, len(words)):
            words[j]["s"] = round(head_end + hold_s + max(0.0, (words[j]["s"] - cut_s) * scale_t), 4)
            words[j]["e"] = round(head_end + hold_s + max(0.04, (words[j]["e"] - cut_s) * scale_t), 4)
        return out, words

    if curve == "tremble_halts":
        # Inject 1-2 trembling fearful halts with micro shaky-breath between clauses
        if len(words) >= 7:
            cuts = [len(words) // 3, (2 * len(words)) // 3]
        else:
            cuts = [len(words) // 2]
        out_parts = []
        prev_i = 0
        cum_add = 0.0
        for ci_k, w_idx in enumerate(cuts):
            cut_s = words[w_idx]["s"]
            cut_i = max(prev_i + int(0.12 * sr), min(n - int(0.15 * sr), int(round(cut_s * sr))))
            if cut_i <= prev_i + int(0.08 * sr):
                continue
            out_parts.append(_fade(seg[prev_i:cut_i], sr, 0.006, 0.012))
            halt_s = (0.14 + 0.03 * ci_k) * acting_scale
            n_halt = int(round(halt_s * sr))
            br = synth_human_cue("short_inhale", sr, seed=seed + ci_k * 13)
            halt_buf = np.zeros(n_halt, dtype=np.float64)
            m_b = min(len(br), n_halt)
            halt_buf[:m_b] = br[:m_b] * (0.045 * acting_scale)
            out_parts.append(halt_buf)
            for j in range(w_idx, len(words)):
                words[j]["s"] = round(words[j]["s"] + halt_s, 4)
                words[j]["e"] = round(words[j]["e"] + halt_s, 4)
            cum_add += halt_s
            prev_i = cut_i
        out_parts.append(_fade(seg[prev_i:], sr, 0.008, 0.010))
        return np.concatenate(out_parts), words

    if curve in ("accel", "panic_burst"):
        split_w = max(2, len(words) // 2)
        cut_s = words[split_w]["s"]
        cut_i = max(int(0.15 * sr), min(n - int(0.20 * sr), int(round(cut_s * sr))))
        head = _fade(seg[:cut_i], sr, 0.004, 0.008)
        tail = _fade(seg[cut_i:], sr, 0.006, 0.008)
        tail_speed = min(1.22, 1.0 + (0.12 if curve == "accel" else 0.15) * acting_scale)
        tail_fast = time_stretch_array(tail, sr, speed=tail_speed, pitch_semi=0.35 * acting_scale, tmp_dir=tmp_dir)
        scale_t = (len(tail_fast) / float(sr)) / max(1e-4, len(tail) / float(sr))
        out = np.concatenate([head, tail_fast])
        head_end = len(head) / float(sr)
        for j in range(split_w, len(words)):
            words[j]["s"] = round(head_end + max(0.0, (words[j]["s"] - cut_s) * scale_t), 4)
            words[j]["e"] = round(head_end + max(0.03, (words[j]["e"] - cut_s) * scale_t), 4)
        return out, words

    return seg, rel_words


def apply_voice_fx(
    x: np.ndarray,
    sr: int,
    fx: str = "dry",
    mood: str = "calm_omen",
    acting_scale: float = 1.0,
    force_tremble: bool = False,
    for_vc_guide: bool = False,
) -> np.ndarray:
    """Apply expressive horror mood vocal-tract DSP (True Whisper Vocoder, Vocal Tremor, Warmth/Tension) + Character FX (`dry`, `room`, `phone`, `ghost`)."""
    if len(x) < 16:
        return x.copy()
    y = _hp(x.astype(np.float64), 52.0, sr, order=2)
    prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])

    # 1. Vocal-cord fear tremor (safe BEFORE and AFTER So-VITS-SVC; applied on guide OR directly in post)
    trem_amt = max(float(prof.get("tremor", 0.0)), 1.0 if force_tremble else 0.0)
    if trem_amt > 0.05 and not for_vc_guide:
        # In assembly (post-SVC or direct), apply full frightened vocal tremor
        y = apply_vocal_tremor(y, sr, rate_hz=6.2, fm_semi=0.44, am_depth=0.24, strength=trem_amt * acting_scale)
    elif trem_amt > 0.05 and for_vc_guide:
        # In VC guide WAV, embed clean FM tremor so So-VITS-SVC (-na) mirrors the trembling pitch!
        y = apply_vocal_tremor(y, sr, rate_hz=6.2, fm_semi=0.48, am_depth=0.10, strength=trem_amt * acting_scale)

    # 2. True 8-band Formant Breathy Whisper Vocoder (deferred to post-SVC assembly so SVC F0 stays clean!)
    w_mix = float(prof.get("whisper_mix", 0.0))
    if w_mix > 0.05 and not for_vc_guide:
        y = apply_true_whisper(y, sr, mix=min(0.75, w_mix * acting_scale))

    # 3. Mood tonal shaping
    if mood == "whisper" and not for_vc_guide:
        air = _bp(y, 2800.0, 7400.0, sr, 2) * 0.22
        y = np.tanh((y + air) * 1.12) * 0.90
    elif mood in ("panic", "stutter_panic", "tense"):
        edge = _bp(y, 1900.0, 4600.0, sr, 2) * (0.28 if mood != "tense" else 0.16)
        y = np.tanh((y + edge) * 1.24) * 0.92
    elif mood in ("calm_omen", "dread"):
        warm = _lp(y, 200.0, sr, 2) * 0.18
        y = y + warm
    elif mood == "curious":
        bright = _bp(y, 2200.0, 5200.0, sr, 2) * 0.14
        y = y + bright

    if for_vc_guide:
        return _fade(y, sr, 0.006, 0.012)

    # 4. Character spatial / supernatural FX
    if fx == "phone":
        rng = np.random.default_rng(707)
        y = _bp(y, 320.0, 3300.0, sr, order=3)
        y = np.tanh(y * 2.2) * 0.65 + _bp(rng.standard_normal(len(y)), 600.0, 3100.0, sr, 2) * 0.004
    elif fx == "room":
        wet = np.zeros(len(y) + int(0.08 * sr), dtype=np.float64)
        wet[: len(y)] += y
        for d_ms, amp in ((14.0, 0.24), (29.0, 0.15), (47.0, 0.09)):
            d = int(round((d_ms / 1000.0) * sr))
            wet[d : d + len(y)] += _lp(y, 2600.0, sr, 2) * amp
        y = wet[: len(y)]
    elif fx == "ghost":
        pad_pre = int(round(0.22 * sr))
        pad_post = int(round(0.32 * sr))
        buf = np.zeros(pad_pre + len(y) + pad_post, dtype=np.float64)
        buf[pad_pre : pad_pre + len(y)] += y * 0.86
        for d_ms, amp in ((18.0, 0.42), (41.0, 0.26)):
            d = int(round((d_ms / 1000.0) * sr))
            buf[pad_pre + d : pad_pre + d + len(y)] += _bp(y, 180.0, 2400.0, sr, 2) * amp
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
        tail_n = int(round(0.28 * sr))
        out = np.zeros(len(y) + tail_n, dtype=np.float64)
        out[: len(y)] += y
        for d_ms, amp in ((55.0, 0.16), (115.0, 0.10), (190.0, 0.06)):
            d = int(round((d_ms / 1000.0) * sr))
            out[d : d + len(y)] += _lp(y, 2200.0, sr, 2) * amp
        y = out

    # Gentle de-esser on harsh 6-8.5kHz sibilants (lighter for whisper so breathy air shines)
    sib = _bp(y, 6200.0, 8800.0, sr, 2)
    y = y - sib * (0.12 if mood == "whisper" else 0.22)
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
    """Map display tokens cleanly onto per-chunk edge-tts WordBoundary events (preserving `01:06` & `K-không`!)."""
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

    span_s = tts_words[0]["s"]
    span_e = max(span_s + 0.08, tts_words[-1]["e"])
    return estimate_syllable_words(display_text, span_e - span_s, span_s, speaker, mood)


# ---------------- Pluggable TTS Synthesis Backends (`edge` + `gemini`) ----------------

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


def _atempo_chain(factor: float) -> str:
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


async def _synth_edge_once(text: str, voice: str, out_mp3: str, max_attempts: int = 20):
    """Synthesize clean neutral Edge-TTS audio + WordBoundary timestamps with resilient retry pool."""
    import edge_tts

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


def _compute_effective_speed(item: dict, base_speed_scale: float, acting_scale: float) -> float:
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    if item["speed"] is not None:
        spd = float(item["speed"])
    else:
        # Scale deviation from 1.0 by acting intensity (`subtle` narrows contrast, `extreme` widens contrast)
        raw_spd = float(prof["speed"])
        spd = 1.0 + (raw_spd - 1.0) * acting_scale
        spd *= float(base_speed_scale)
    spd *= float(item.get("inline_speed_mult", 1.0))
    return max(0.62, min(1.42, spd))


def apply_acting_micro_prosody(
    samples: np.ndarray,
    rel_words: list,
    item: dict,
    sr: int,
    acting_scale: float = 1.0,
    tmp_dir: str | None = None,
    idx: int = 0,
):
    """Apply word-level horror acting transformations (intra-sentence pacing, acoustic stuttering, pitch contour ramp)."""
    mood = item["mood"]
    prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])

    seg, words = apply_intra_sentence_pacing(
        samples, rel_words, mood, sr, acting_scale=acting_scale, tmp_dir=tmp_dir, seed=70 + idx * 11
    )

    stutter_map = item.get("stutter_map") or {}
    if stutter_map:
        seg, words = apply_syllable_stutter(seg, words, stutter_map, sr, acting_scale=acting_scale, seed=31 + idx * 19)

    tail_semi = float(prof.get("pitch_tail_semi", 0.0)) * acting_scale
    if item.get("force_up"):
        tail_semi = max(tail_semi, 2.35 * acting_scale)
    if abs(tail_semi) >= 0.35:
        seg = apply_pitch_ramp(seg, sr, tail_sec=0.44, end_semi=tail_semi)

    return seg, words


def synth_gemini_chunk(
    item: dict,
    sr: int,
    tmp_dir: str,
    idx: int,
    api_key: str,
    model: str = "gemini-2.5-flash-preview-tts",
    voice_name: str = "Charon",
    acting_scale: float = 1.0,
    cache_dir: str | None = None,
):
    """Synthesize ONE expressive acting line via Gemini 2.5 Flash Preview TTS REST API (pure urllib, 0 extra deps)."""
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    style = item.get("acting") or prof.get("acting_prompt", "Đọc truyền cảm theo ngữ cảnh kinh dị")
    tts_text = item.get("tts_text") or normalize_vi_for_tts(item["text"])
    prompt = f"{style}:\n{tts_text}"

    key = hashlib.sha256(f"gemini|{model}|{voice_name}|{prompt}".encode("utf-8")).hexdigest()[:16]
    wav_cache = os.path.join(cache_dir, f"gem_{key}.wav") if cache_dir else None

    if wav_cache and os.path.isfile(wav_cache) and os.path.getsize(wav_cache) >= 512:
        raw_x = load_audio_mono(wav_cache, sr)
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice_name}
                    }
                },
            },
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        audio_bytes = None
        mime = "audio/L16;rate=24000"
        for cand in data.get("candidates") or []:
            for part in (cand.get("content") or {}).get("parts") or []:
                inline = part.get("inlineData") or part.get("inline_data")
                if inline and inline.get("data"):
                    audio_bytes = base64.b64decode(inline["data"])
                    mime = str(inline.get("mimeType") or inline.get("mime_type") or mime)
                    break
            if audio_bytes:
                break
        if not audio_bytes:
            raise RuntimeError("Gemini TTS returned no inline audio data")

        if "l16" in mime.lower() or "pcm" in mime.lower():
            m_sr = re.search(r"rate=(\d+)", mime)
            in_sr = int(m_sr.group(1)) if m_sr else 24000
            raw_pcm = np.frombuffer(audio_bytes, "<i2").astype(np.float64) / 32768.0
            g = math.gcd(sr, in_sr)
            raw_x = signal.resample_poly(raw_pcm, sr // g, in_sr // g)
        else:
            ext = ".mp3" if "mpeg" in mime.lower() or "mp3" in mime.lower() else ".wav"
            tmp_a = os.path.join(tmp_dir, f"gem_{idx:03d}{ext}")
            with open(tmp_a, "wb") as fp:
                fp.write(audio_bytes)
            raw_x = load_audio_mono(tmp_a, sr)

        raw_x = trim_silence(raw_x, sr, pad_s=0.03)
        if wav_cache:
            os.makedirs(cache_dir, exist_ok=True)
            write_wav_mono16(wav_cache, raw_x, sr)

    # Respect explicit inline [SLOW]/[FAST] multipliers even on Gemini acting clips
    inl_mult = float(item.get("inline_speed_mult", 1.0))
    if abs(inl_mult - 1.0) > 0.04:
        raw_x = time_stretch_array(raw_x, sr, speed=inl_mult, pitch_semi=0.0, tmp_dir=tmp_dir)

    words = estimate_syllable_words(item["text"], len(raw_x) / float(sr), 0.0, item["speaker"], item["mood"])
    # Apply explicit `[STUTTER]` / `K-không` acoustic stutter if tagged (since cloud TTS smooths stutters!)
    stutter_map = item.get("stutter_map") or {}
    if stutter_map:
        raw_x, words = apply_syllable_stutter(raw_x, words, stutter_map, sr, acting_scale=acting_scale, seed=31 + idx * 19)
    return raw_x, words


def synth_edge_chunk(
    item: dict,
    sr: int,
    tmp_dir: str,
    idx: int,
    base_speed_scale: float = 1.0,
    cache_dir: str | None = None,
    acting_scale: float = 1.0,
):
    """Synthesize ONE expressive speech line via Edge-TTS + studio pitch/tempo + Word-Level Micro-Prosody Acting DSP."""
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    pitch_semi = _parse_pitch_to_semi(item["pitch"], float(prof.get("pitch_semi", 0.0)) * acting_scale)
    speed = _compute_effective_speed(item, base_speed_scale, acting_scale)

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
        if _ffmpeg_has_rubberband():
            af = f"rubberband=tempo={speed:.5f}:formant=preserved"
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
    return apply_acting_micro_prosody(samples, words, item, sr, acting_scale=acting_scale, tmp_dir=tmp_dir, idx=idx)


def synth_line_auto(item: dict, sr: int, tmp_dir: str, idx: int, args, cache_dir: str | None = None, synth_fn=None):
    """Dispatch speech chunk synthesis across `synth_fn`, `gemini` (with automatic edge fallback), or `edge`."""
    acting_scale = ACTING_SCALES.get(getattr(args, "acting", "cinematic"), 1.0)
    if synth_fn is not None:
        raw_seg, rel_words = synth_fn(item, sr, idx)
        # Apply speed scaling & micro-prosody acting even on offline mock synth_fn so unit tests verify real timing/stutters!
        spd = _compute_effective_speed(item, getattr(args, "speed_scale", 1.0), acting_scale)
        if abs(spd - 1.0) > 0.03:
            old_dur = max(1e-4, len(raw_seg) / float(sr))
            raw_seg = time_stretch_array(raw_seg, sr, speed=spd, pitch_semi=0.0, tmp_dir=None)
            ratio = (len(raw_seg) / float(sr)) / old_dur
            rel_words = [
                {**w, "s": round(w["s"] * ratio, 4), "e": round(w["e"] * ratio, 4)}
                for w in rel_words
            ]
        return apply_acting_micro_prosody(raw_seg, rel_words, item, sr, acting_scale=acting_scale, tmp_dir=None, idx=idx)

    engine = getattr(args, "tts_engine", "auto")
    api_key = getattr(args, "gemini_api_key", None) or os.environ.get("GEMINI_API_KEY")
    if engine == "gemini" or (engine == "auto" and api_key):
        if api_key:
            try:
                return synth_gemini_chunk(
                    item, sr, tmp_dir, idx,
                    api_key=api_key,
                    model=getattr(args, "gemini_model", "gemini-2.5-flash-preview-tts"),
                    voice_name=getattr(args, "gemini_voice", "Charon"),
                    acting_scale=acting_scale,
                    cache_dir=cache_dir,
                )
            except Exception as exc:
                print(f"  [WARN] Gemini TTS fallback -> edge+acting DSP on line #{idx}: {exc}")
        elif engine == "gemini":
            print("  [WARN] --tts-engine gemini requested but GEMINI_API_KEY not set; falling back to edge+acting DSP.")

    return synth_edge_chunk(
        item, sr, tmp_dir, idx,
        base_speed_scale=getattr(args, "speed_scale", 1.0),
        cache_dir=cache_dir,
        acting_scale=acting_scale,
    )


# ---------------- External Audio Ingestion & Pack Exporters ----------------

def split_audio_vad(samples: np.ndarray, sr: int, target_count: int) -> list:
    """Split a single external narrator WAV into `target_count` speech segments using energy-envelope silence detection."""
    if target_count <= 1 or len(samples) == 0:
        return [samples]
    win = max(1, int(0.025 * sr))
    env = np.sqrt(np.convolve(samples ** 2, np.ones(win) / win, mode="same"))
    thr = max(0.008, float(np.percentile(env, 85)) * 0.09)
    silent = env < thr

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
    exts = (".wav", ".mp3", ".flac", ".m4a", ".ogg")
    stems = (f"N{n_idx:02d}", f"n{n_idx:02d}", f"{n_idx:02d}", f"S{n_idx:02d}", str(n_idx))
    for st_name in stems:
        for ext in exts:
            p = os.path.join(narrator_dir, st_name + ext)
            if os.path.isfile(p):
                return p
    files = sorted(f for f in os.listdir(narrator_dir) if f.lower().endswith(exts))
    if 1 <= n_idx <= len(files):
        return os.path.join(narrator_dir, files[n_idx - 1])
    raise FileNotFoundError(f"Narrator clip #{n_idx} not found in {narrator_dir} (expected N{n_idx:02d}.wav or {n_idx:02d}.wav)")


def export_narrator_script(items: list, out_path: str):
    """Export emotion-annotated narrator cue sheet (`N01 [mood]: ...`) for external TTS or human recording."""
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    lines = ["# NARRATOR VOICE CUE SHEET (Horror Engine v5.5)", "# Xuất các file N01.wav, N02.wav... theo đúng thứ tự bên dưới:", ""]
    n_idx = 0
    for it in items:
        if it["kind"] == "speech" and it["is_narrator"]:
            n_idx += 1
            prompt = it.get("acting") or MOOD_PROFILES.get(it["mood"], {}).get("acting_prompt", "")
            lines.append(f"N{n_idx:02d} [{it['mood']}] | {it['text']}  # {prompt}")
        elif it["kind"] == "dead_silence":
            lines.append(f"--- [DEAD SILENCE {it['dur']:.2f}s] ---")
    with open(out_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    print(f"EXPORTED NARRATOR CUES ({n_idx} lines) -> {out_path}")


def export_acting_pack(items: list, out_dir: str):
    """Export emotional acting prompt pack (`acting_pack.json`) for local GPU zero-shot TTS (F5-TTS-Vietnamese / VieNeu-TTS)."""
    os.makedirs(out_dir, exist_ok=True)
    entries = []
    n_idx = 0
    for idx, it in enumerate(items):
        if it["kind"] != "speech" or not it["is_narrator"]:
            continue
        n_idx += 1
        mood = it["mood"]
        prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
        entries.append({
            "clip_file": f"N{n_idx:02d}.wav",
            "item_idx": idx,
            "mood": mood,
            "ref_emotion_clip": f"refs/ref_{mood}.wav",
            "acting_prompt": it.get("acting") or prof.get("acting_prompt", ""),
            "target_speed": prof["speed"],
            "text": it["text"],
            "tts_text": it["tts_text"],
            "stutter_map": it.get("stutter_map") or {},
        })
    out_json = os.path.join(out_dir, "acting_pack.json")
    with open(out_json, "w", encoding="utf-8") as fp:
        json.dump({"version": "v5.5-acting-pack", "lines": entries}, fp, ensure_ascii=False, indent=2)
    print(f"ACTING PACK READY -> {out_json} ({n_idx} lines for F5-TTS-Vietnamese / VieNeu-TTS -> import back via --narrator-dir)")
    return out_json


def export_vc_pack(items: list, out_dir: str, tmp_dir: str, args, synth_fn=None):
    """Build 1-File Expressive So-VITS-SVC Pack (`narrator_guide_44k.wav` + `vc_pack_manifest.json` + `-na` helper scripts).
    Embeds ALL tempo swings (0.68x..1.32x), real acoustic stutters, FM fear tremor & curious rising pitch!
    Defers True Breathy Whisper Vocoder noise to Step 3 (`assemble_voice`) so So-VITS-SVC F0 tracking stays 100% crisp."""
    os.makedirs(out_dir, exist_ok=True)
    pad_samples = int(round(VC_PACK_PAD_SEC * SR_VC))
    acting_scale = ACTING_SCALES.get(getattr(args, "acting", "cinematic"), 1.0)
    cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(out_dir)), ".tts_cache")

    guide_parts = []
    manifest_segs = []
    cursor = 0
    n_idx = 0

    for idx, it in enumerate(items):
        if it["kind"] != "speech" or not it["is_narrator"]:
            continue
        n_idx += 1
        seg, rel_words = synth_line_auto(it, SR_VC, tmp_dir, idx, args, cache_dir=cache_dir, synth_fn=synth_fn)
        # Apply F0-clean vocal tremor (deferring whisper breath noise until post-SVC assembly!)
        seg = apply_voice_fx(
            seg, SR_VC, fx="dry", mood=it["mood"],
            acting_scale=acting_scale, force_tremble=bool(it.get("force_tremble")),
            for_vc_guide=True,
        )
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
            "force_tremble": bool(it.get("force_tremble")),
            "text": it["text"],
            "words": rel_words,
        })

    if not guide_parts:
        raise ValueError("No [NARRATOR] lines found in script to export VC pack")

    guide = np.concatenate(guide_parts)
    guide_wav = os.path.join(out_dir, "narrator_guide_44k.wav")
    write_wav_mono16(guide_wav, guide, SR_VC)

    mf = {
        "version": "v5.5-vc-pack",
        "sr": SR_VC,
        "acting": getattr(args, "acting", "cinematic"),
        "total_samples": len(guide),
        "pad_sec": VC_PACK_PAD_SEC,
        "segments": manifest_segs,
    }
    mf_path = os.path.join(out_dir, "vc_pack_manifest.json")
    with open(mf_path, "w", encoding="utf-8") as fp:
        json.dump(mf, fp, ensure_ascii=False, indent=2)

    bat = (
        "@echo off\r\n"
        "REM Chay tren may So-VITS-SVC: Giu nguyen nhip do, lap bap, run giong & ngu dieu bang co -na (--no-auto-predict-f0)!\r\n"
        f'"{os.path.join(args.vc_venv, "Scripts", "svc.exe")}" infer narrator_guide_44k.wav -o narrator_svc_out.wav '
        f'-s {args.speaker} -m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\r\n"
    )
    sh = (
        "#!/usr/bin/env bash\n"
        "# Run on your So-VITS-SVC machine: uses -na (--no-auto-predict-f0) to PRESERVE all acting rhythm, stutter, tremor & F0!\n"
        f'svc infer narrator_guide_44k.wav -o narrator_svc_out.wav -s "{args.speaker}" '
        f'-m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\n"
    )
    with open(os.path.join(out_dir, "run_svc_win.bat"), "w", encoding="utf-8") as fp:
        fp.write(bat)
    with open(os.path.join(out_dir, "run_svc_unix.sh"), "w", encoding="utf-8") as fp:
        fp.write(sh)

    print(f"VC PACK READY -> {guide_wav} ({len(guide) / SR_VC:.2f}s, {n_idx} narrator lines, acting={mf['acting']})")
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
    """Assemble final 48 kHz mono `voice.wav` + `words.json` combining external/SVC narrator + multi-speaker acting + cues."""
    acting_scale = ACTING_SCALES.get(getattr(args, "acting", "cinematic"), 1.0)
    cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(args.out_dir)), ".tts_cache")

    narrator_items = [i for i, it in enumerate(items) if it["kind"] == "speech" and it["is_narrator"]]
    narrator_clips = {}

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
    just_emitted_cue = False
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

        if it["kind"] == "cue":
            c_arr = synth_human_cue(it["cue"], SR_VC, seed=211 + idx * 23)
            if len(c_arr) > 0:
                c_db = -17.5 if it["cue"] in ("gasp", "sharp_gasp", "tremble_gasp") else (-19.5 if it["cue"] == "swallow" else -21.0)
                timeline.append(c_arr * (10.0 ** (c_db / 20.0)))
                cur_sec += len(c_arr) / float(SR_VC)
                just_emitted_cue = True
            continue

        mood = it["mood"]
        prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
        if idx in narrator_clips:
            raw_seg, rel_words = narrator_clips[idx]
        else:
            raw_seg, rel_words = synth_line_auto(it, SR_VC, tmp_dir, idx, args, cache_dir=cache_dir, synth_fn=synth_fn)

        seg = normalize_rms(raw_seg, target_dbfs=-19.0)
        seg = apply_voice_fx(
            seg, SR_VC, fx=it["fx"], mood=mood,
            acting_scale=acting_scale, force_tremble=bool(it.get("force_tremble")),
            for_vc_guide=False,
        )
        gain_db = float(prof["gain_db"]) * (0.75 + 0.25 * acting_scale)
        seg = seg * (10.0 ** (gain_db / 20.0))

        # Organic human vocal-tract breath/swallow cue before expressive lines (skip if an inline cue just played)
        if args.auto_breath and (not just_emitted_cue) and it["fx"] not in ("phone", "ghost"):
            b_kind = "sharp_gasp" if (just_after_dead and mood in ("panic", "stutter_panic", "tense", "fear_tremble", "dread")) else prof["breath"]
            if b_kind and b_kind != "none":
                b_arr = synth_human_cue(b_kind, SR_VC, seed=100 + idx * 17)
                b_gain = 10.0 ** (float(prof["breath_db"]) / 20.0)
                timeline.append(b_arr * b_gain)
                cur_sec += len(b_arr) / float(SR_VC)
        just_after_dead = False
        just_emitted_cue = False

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
            s_dur = max(0.05, sent_words[-1]["e"] - sent_words[0]["s"])
            sentences.append({
                "sent": sent_num,
                "speaker": it["speaker"],
                "mood": mood,
                "fx": it["fx"],
                "s": sent_words[0]["s"],
                "e": sent_words[-1]["e"],
                "wps": round(len(sent_words) / s_dur, 2),
                "text": it["text"],
            })

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

    api_key_present = bool(getattr(args, "gemini_api_key", None) or os.environ.get("GEMINI_API_KEY"))
    tts_used = "gemini_acting" if (getattr(args, "tts_engine", "auto") in ("gemini", "auto") and api_key_present and synth_fn is None) else "edge_tts_acting_v55"

    payload = {
        "engine": "horror-voice-v5.5",
        "acting": getattr(args, "acting", "cinematic"),
        "voice": args.base_voice,
        "narrator_source": (
            "vc_pack_external" if (args.vc_pack and args.narrator_vc_wav)
            else "narrator_dir" if args.narrator_dir
            else "narrator_audio" if args.narrator_audio
            else ("local_svc" if use_local_vc else tts_used)
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
            fp.write("// Auto-generated by scripts/gen_horror_voice.py (v5.5 Expressive Voice Acting Engine)\n")
            fp.write(f"export const VOICE_DUR = {round(final_dur, 4)};\n")
            fp.write(f"export const TOTAL_FRAMES = {total_frames};\n")
            fp.write("export type WordTiming = { w: string; s: number; e: number; speaker?: string; mood?: string };\n")
            fp.write("export const WORDS: WordTiming[] = " + json.dumps(all_words, ensure_ascii=False) + ";\n")

    print(f"VOICE OK -> {final_wav} ({final_dur:.3f}s, {total_frames}f @ {args.fps}fps, {len(all_words)} words, {wps:.2f} w/s, acting={payload['acting']})")
    for sb in sentences:
        print(f"  S{sb['sent']:02d} [{sb['speaker']} · {sb['mood']}/{sb['fx']} · {sb['wps']:4.2f}w/s] [{sb['s']:6.2f}s..{sb['e']:6.2f}s] {sb['text'][:56]}")
    for ds in dead_silences:
        print(f"  DEAD_SILENCE [{ds['s']:6.2f}s..{ds['e']:6.2f}s]")
    return final_wav, words_json, payload


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v5.5 Expressive Voice Acting & So-VITS-SVC Hybrid Generator.")
    ap.add_argument("--script", required=True, help="Path to horror SCRIPT.md / .txt")
    ap.add_argument("--out-dir", default="out/voice", help="Output directory for voice.wav and words.json")
    ap.add_argument("--base-voice", default="vi-VN-NamMinhNeural", help="Default edge-tts voice")
    ap.add_argument("--acting", default="cinematic", choices=["subtle", "cinematic", "extreme"], help="Acting intensity (default: cinematic)")
    ap.add_argument("--tts-engine", default="auto", choices=["auto", "edge", "gemini"], help="TTS backend: auto (Gemini if GEMINI_API_KEY else edge), edge, or gemini")
    ap.add_argument("--gemini-model", default="gemini-2.5-flash-preview-tts", help="Gemini TTS model name")
    ap.add_argument("--gemini-voice", default="Charon", help="Gemini prebuilt voice name (Charon, Kore, Puck, Zephyr...)")
    ap.add_argument("--gemini-api-key", default=None, help="Optional Gemini API key (defaults to GEMINI_API_KEY env var)")
    ap.add_argument("--speed-scale", type=float, default=1.0, help="Global multiplier on mood speeds (default 1.0)")
    ap.add_argument("--ellipsis-pause", type=float, default=0.42, help="Real pause duration injected on mid-sentence `...` (s)")
    ap.add_argument("--lead-silence", type=float, default=0.08, help="Lead silence before first line (s)")
    ap.add_argument("--tail-silence", type=float, default=0.35, help="Trailing silence after last line (s)")
    ap.add_argument("--fps", type=int, default=30, help="Timeline FPS for total_frames")
    ap.add_argument("--out-wav", default="voice.wav", help="Output WAV filename inside --out-dir")
    ap.add_argument("--auto-breath", action=argparse.BooleanOptionalAction, default=True, help="Inject organic human breath/swallow cues (default ON)")
    ap.add_argument("--tts-cache", default=None, help="Optional disk cache directory for TTS chunks")
    ap.add_argument("--words-ts", default=None, help="Optional TypeScript words.ts export path")

    # 2-Machine So-VITS-SVC Expressive VC-Pack & External Narrator options
    ap.add_argument("--export-vc-pack", default=None, help="Step 1: Export 1-file expressive narrator_guide_44k.wav + manifest for So-VITS-SVC PC")
    ap.add_argument("--vc-pack", default=None, help="Step 3: VC pack folder produced by --export-vc-pack")
    ap.add_argument("--narrator-vc-wav", default=None, help="Step 3: Converted narrator_svc_out.wav returned from So-VITS-SVC PC")
    ap.add_argument("--export-acting-pack", default=None, help="Export emotional acting prompt JSON for local GPU F5-TTS-Vietnamese / VieNeu-TTS")
    ap.add_argument("--export-narrator-script", default=None, help="Export numbered narrator emotion cue sheet (.txt) for external TTS/recording")
    ap.add_argument("--narrator-dir", default=None, help="Folder of individual external narrator clips (N01.wav, N02.wav...)")
    ap.add_argument("--narrator-audio", default=None, help="Single combined external narrator WAV/MP3 (auto-split via VAD)")

    # Local So-VITS-SVC options (`-na` / --no-auto-predict-f0 is default!)
    ap.add_argument("--vc-venv", default="D:/voice-engine/venv", help="Path to So-VITS-SVC venv root")
    ap.add_argument("--vc-model", default="D:/voice-engine/models/ngan/G_1001.pth", help="So-VITS-SVC generator checkpoint")
    ap.add_argument("--vc-config", default="D:/voice-engine/models/ngan/config.json", help="So-VITS-SVC config.json")
    ap.add_argument("--vc-cache-root", default="D:/voice-engine", help="So-VITS-SVC cache root")
    ap.add_argument("--speaker", default="ngan", help="Target speaker key in config.json")
    ap.add_argument("--f0-method", default="parselmouth", choices=["crepe", "crepe-tiny", "parselmouth", "dio", "harvest", "rmvpe"])
    ap.add_argument("--transpose", type=int, default=-5, help="Semitone transpose with -na (default -5)")
    ap.add_argument("--auto-predict-f0", action=argparse.BooleanOptionalAction, default=False, help="OFF by default (-na) so So-VITS-SVC preserves acting rhythm & pitch!")
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
    if args.export_acting_pack:
        export_acting_pack(items, args.export_acting_pack)
        return

    tmp_dir = tempfile.mkdtemp(prefix="hvoice55_")
    try:
        if args.export_vc_pack:
            export_vc_pack(items, args.export_vc_pack, tmp_dir, args)
            return
        assemble_voice(items, args, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
