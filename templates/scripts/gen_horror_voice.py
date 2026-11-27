#!/usr/bin/env python3
"""Horror Engine v6.0: Studio-Clean Neural Voice Engine (100% Free & Open-Source, Act-Level Coherent, Zero Distortion).

Replaces fragmented TTS + artificial DSP emotion hacks with clean, whole-act neural synthesis:
  1. Act-Level Coherent Grouping: keeps continuous narrator paragraphs intact (splitting ONLY on
     `[DEAD SILENCE Xs]`, `[PAUSE Xs]`, or speaker/mood switches) so neural TTS speaks with natural
     Vietnamese storytelling rhythm and smooth tonal transitions — ZERO patchwork fragmentation!
  2. Zero Distorting DSP: NO fake white-noise whisper vocoders, NO robotic 6 Hz vibrato, NO raw waveform stutter-slicing.
     Only transparent studio hygiene (45 Hz HPF, clean RMS balancing, optional speaker spatial FX `phone|room|ghost`).
  3. 100% Free & Open-Source Local Neural Engines:
     - `--tts-engine vieneu` (DEFAULT when installed): `pnnbao97/VieNeu-TTS` v3 Turbo (48 kHz ONNX CPU, torch-free!),
       supporting built-in North/Central/South voices, native `[thở dài]`/`[hắng giọng]`, AND 3-8s instant
       emotional voice cloning via `--ref-audio` or per-mood `--emotion-refs <dir>` (`fear.wav`, `whisper.wav`, `curious.wav`...).
     - `--export-gpu-voice-pack <dir>` + `--import-acts <dir>`: 1-command portable acting pack for your GPU PC
       running `dinhthuan/index-tts-2-vietnamese` (8-D emotion vectors `[happy, angry, sad, afraid, disgusted, melancholic,
       surprised, calm]` decoupled from speaker voice!) OR `nguyenthienhy/F5-TTS-Vietnamese`!
     - 1-File So-VITS-SVC VC-Pack (`--export-vc-pack` -> `-na` -> `--vc-pack` + `--narrator-vc-wav`): crystal-clean
       act-level guide audio with `-na` (`--no-auto-predict-f0`) preserving 100% of original acting cadence & pitch.
     - Clean fallbacks: `--tts-engine edge` (whole-act clean `edge-tts`) & `--tts-engine gemini` (`GEMINI_API_KEY`).
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
import urllib.request
import wave

import numpy as np
from scipy import signal

SR_VC = 44100
SR_FINAL = 48000
VC_PACK_PAD_SEC = 0.35


def _load_dotenv_key(name: str = "GEMINI_API_KEY") -> str | None:
    """Auto-load API key from environment or nearest `.env` file without extra dependencies."""
    val = os.environ.get(name)
    if val:
        return val.strip()
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(here, "..", ".env"),
        os.path.join(here, "..", "..", ".env"),
        os.path.join(here, "..", "..", "..", ".env"),
    ]
    for p in candidates:
        ap = os.path.abspath(p)
        if not os.path.isfile(ap):
            continue
        try:
            with open(ap, encoding="utf-8") as fp:
                for raw in fp:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    if k.strip() == name:
                        v = v.strip().strip('"').strip("'")
                        if v:
                            return v
        except Exception:
            pass
    return None


def resolve_gemini_voice(
    speaker_name: str,
    profile: str = "",
    is_narrator: bool = True,
    default_narrator_voice: str = "Charon",
) -> str:
    """Map narrator & NPCs onto distinct natural Gemini prebuilt voices."""
    if is_narrator or str(speaker_name).strip().upper() == "NARRATOR":
        return default_narrator_voice or "Charon"
    blob = f"{speaker_name} {profile}".lower()
    is_female = any(k in blob for k in ("female", "woman", "girl", "nữ", "bà", "cô", "chị", "mẹ", "má", "dì", "bé gái"))
    is_elder = any(k in blob for k in ("elder", "old", "già", "lão", "ông", "bà", "chú", "bác", "cụ"))
    if is_female:
        return "Aoede" if is_elder else "Kore"
    if is_elder:
        return "Orus" if default_narrator_voice != "Orus" else "Fenrir"
    return "Fenrir" if default_narrator_voice != "Fenrir" else "Puck"


def extract_rms_envelope_30fps(samples: np.ndarray, sr: int, fps: int = 30) -> list[float]:
    """Compute normalized [0..1] per-frame vocal RMS envelope at `fps` (30fps default) for lip-sync & cadence."""
    x = np.asarray(samples, dtype=np.float64).reshape(-1)
    if len(x) == 0 or sr <= 0 or fps <= 0:
        return []
    spf = float(sr) / float(fps)
    n_frames = max(1, int(math.ceil(len(x) / spf)))
    raw = np.zeros(n_frames, dtype=np.float64)
    for fi in range(n_frames):
        s0 = int(round(fi * spf))
        s1 = min(len(x), max(s0 + 1, int(round((fi + 1) * spf))))
        seg = x[s0:s1]
        if len(seg) > 0:
            raw[fi] = math.sqrt(float(np.mean(seg * seg)) + 1e-18)
    nz = raw[raw > 1e-4]
    ref = float(np.percentile(nz, 92)) if len(nz) >= 4 else float(np.max(raw))
    if ref < 1e-6:
        return [0.0] * n_frames
    norm = np.clip(raw / ref, 0.0, 1.0)
    return [round(float(v), 4) for v in norm]

PAUSE_RE = re.compile(
    r"(\[(?:PAUSE|BEAT|KHỰNG|VISUAL|SILENCE_DROP|DEAD\s+SILENCE)\s+(\d+(?:\.\d+)?)\s*s?\])",
    re.IGNORECASE,
)
CLAUSE_MOD_RE = re.compile(
    r"(\[\s*(?:(?:PACE|PITCH|PROX)\s*=[^\[\]]+?)\])",
    re.IGNORECASE,
)
DIRECTIVE_RE = re.compile(r"^\[\s*(NARRATOR|SPEAKER(?:\s*:\s*[^|\]]+)?)(?:\s*\|\s*(.+?))?\s*\]$", re.IGNORECASE)
VIENEU_TAG_RE = re.compile(r"\[(?:thở\s+dài|hắng\s+giọng|cười)\]", re.IGNORECASE)
CLOCK_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b")

PACE_NAMED = {
    "very_slow": 0.82,
    "slow": 0.88,
    "hesitant": 0.91,
    "normal": 1.00,
    "urgent": 1.06,
    "fast": 1.10,
}

# Clean high-retention oral-horror mood profiles (v15.0):
#   - `speed` & `clean_tempo` = 1.00, `pitch_semi` = 0.0 by default (ZERO tempo/pitch DSP distortion!)
#   - `target_rms_dbfs`: preserves true 6-8 dB vocal dynamic range (whispers & dread stay genuinely intimate)
MOOD_PROFILES = {
    "calm_omen": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.24,
        "vn_temp": 0.70,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiền Tâm Đức",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -18.8,
        "gain_db": 0.0,
        "tail_pad": 0.18,
        "ref_key": "calm",
        "indextts2_emo": [0.0, 0.0, 0.15, 0.15, 0.0, 0.35, 0.0, 0.65],
        "acting_prompt": "Kể chuyện kinh dị truyền miệng tiếng Việt gọn sắc, đời thường, tự nhiên và cuốn hút ngay từ đầu",
    },
    "curious": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.22,
        "vn_temp": 0.84,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiện Minh",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -19.2,
        "gain_db": 0.0,
        "tail_pad": 0.18,
        "ref_key": "curious",
        "indextts2_emo": [0.0, 0.0, 0.0, 0.20, 0.0, 0.10, 0.55, 0.45],
        "acting_prompt": "Đọc tiếng Việt tự nhiên với sắc thái tò mò, gạn hỏi, nghi hoặc sắc gọn",
    },
    "uneasy": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.26,
        "vn_temp": 0.76,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiện Minh",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -19.8,
        "gain_db": 0.0,
        "tail_pad": 0.20,
        "ref_key": "uneasy",
        "indextts2_emo": [0.0, 0.0, 0.15, 0.45, 0.0, 0.30, 0.20, 0.25],
        "acting_prompt": "Đọc tiếng Việt dè chừng, căng nhẹ như vừa phát hiện chuyện bất thường trước mắt",
    },
    "tense": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.14,
        "vn_temp": 0.86,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Hải Đăng",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -17.0,
        "gain_db": 0.0,
        "tail_pad": 0.16,
        "ref_key": "tense",
        "indextts2_emo": [0.0, 0.10, 0.0, 0.55, 0.0, 0.15, 0.30, 0.10],
        "acting_prompt": "Đọc tiếng Việt gắt gọn, nghiêm nghị, cảnh báo dứt khoát",
    },
    "whisper": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.34,
        "vn_temp": 0.72,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiền Tâm Đức",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -24.0,
        "gain_db": 0.0,
        "tail_pad": 0.22,
        "ref_key": "whisper",
        "indextts2_emo": [0.0, 0.0, 0.15, 0.60, 0.0, 0.25, 0.10, 0.35],
        "acting_prompt": "Nói nhỏ nhẹ, hạ giọng sát tai khẩn trương như sợ thứ bên ngoài nghe thấy",
    },
    "fear": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.16,
        "vn_temp": 0.88,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiện Minh",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -18.0,
        "gain_db": 0.0,
        "tail_pad": 0.16,
        "ref_key": "fear",
        "indextts2_emo": [0.0, 0.0, 0.20, 0.85, 0.0, 0.20, 0.35, 0.0],
        "acting_prompt": "Đọc tiếng Việt gấp hơn, bàng hoàng và hụt hơi thật khi đụng chuyện tà ma",
    },
    "dread": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.36,
        "vn_temp": 0.68,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiền Tâm Đức",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -20.6,
        "gain_db": 0.0,
        "tail_pad": 0.22,
        "ref_key": "dread",
        "indextts2_emo": [0.0, 0.0, 0.35, 0.65, 0.10, 0.65, 0.0, 0.10],
        "acting_prompt": "Đọc tiếng Việt trầm đục, gai người nhưng giữ nhịp gọn chắc không rề rà",
    },
    "panic": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.06,
        "vn_temp": 0.92,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Hải Đăng",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -16.2,
        "gain_db": 0.0,
        "tail_pad": 0.12,
        "ref_key": "panic",
        "indextts2_emo": [0.0, 0.30, 0.0, 0.95, 0.0, 0.0, 0.45, 0.0],
        "acting_prompt": "Đọc tiếng Việt dồn dập, hoảng loạn và khẩn cấp thực sự",
    },
    "cold_twist": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.38,
        "vn_temp": 0.64,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiền Tâm Đức",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -21.2,
        "gain_db": 0.0,
        "tail_pad": 0.23,
        "ref_key": "cold_twist",
        "indextts2_emo": [0.0, 0.0, 0.25, 0.25, 0.0, 0.55, 0.0, 0.60],
        "acting_prompt": "Đọc tiếng Việt lạnh, sắc gọn, dứt khoát chốt sự thật rợn tóc gáy",
    },
    "ghost_entity": {
        "speed": 1.00,
        "clean_tempo": 1.00,
        "vn_silence_p": 0.36,
        "vn_temp": 0.66,
        "f0_offset_st": 0.0,
        "multi_style_voice": "Thiền Tâm Đức",
        "pitch_semi": 0.0,
        "target_rms_dbfs": -20.2,
        "gain_db": 0.0,
        "tail_pad": 0.22,
        "ref_key": "dread",
        "indextts2_emo": [0.0, 0.0, 0.30, 0.45, 0.10, 0.70, 0.0, 0.20],
        "acting_prompt": "Đọc tiếng Việt trầm lạnh và xa xăm",
    },
}
# Backward-compatible mood aliases
MOOD_ALIASES = {
    "fear_tremble": "fear",
    "stutter_panic": "panic",
    "eerie": "uneasy",
}


def resolve_character_voice(
    speaker_name: str,
    profile: str = "",
    explicit_voice: str | None = None,
    narrator_voice: str = "Thiện Minh",
) -> tuple[str, float]:
    """Deterministically map an NPC speaker + optional profile tag onto VieNeu's 25 built-in regional/gender voices."""
    if explicit_voice and not explicit_voice.lower().startswith("vi-vn-"):
        return explicit_voice.strip(), 0.0
    blob = f"{speaker_name} {profile}".lower()
    is_female = any(k in blob for k in ("female", "woman", "girl", "nữ", "bà", "cô", "chị", "mẹ", "má", "dì", "bé gái"))
    is_elder = any(k in blob for k in ("elder", "old", "già", "lão", "ông", "bà", "chú", "bác", "cụ"))
    is_south = any(k in blob for k in ("south", "miền nam", "miền tây", "nam bộ", "chú tư", "má", "tía"))
    is_central = any(k in blob for k in ("central", "miền trung", "huế"))

    pitch_st = -1.1 if (is_elder and not is_female) else (-0.7 if is_elder else 0.0)
    if is_female:
        if is_south:
            v = "Thục Đoan" if is_elder else "Mỹ Duyên"
        elif is_central:
            v = "Ngọc Trân"
        else:
            v = "Ngọc Linh" if is_elder else "Trúc Ly"
    else:
        if is_south:
            v = "Thái Sơn" if is_elder else "Đức Trí"
        elif is_central:
            v = "Quang Sơn"
        elif is_elder:
            v = "Thiền Tâm Đức"
        else:
            v = "Thanh Bình" if narrator_voice == "Thiện Minh" else "Thiện Minh"
    if v == narrator_voice:
        v = "Thái Sơn" if narrator_voice != "Thái Sơn" else "Thiền Tâm Đức"
    return v, pitch_st

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


def normalize_vi_for_tts(text: str, keep_vieneu_tags: bool = False) -> str:
    """Convert Vietnamese clock times (01:06) & dates (22/11) to natural spoken Vietnamese while keeping natural punctuation intact."""
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
    if not keep_vieneu_tags:
        out = VIENEU_TAG_RE.sub(" ", out)
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


def _resolve_mood(raw_mood: str) -> str:
    m = (raw_mood or "calm_omen").strip().lower()
    m = MOOD_ALIASES.get(m, m)
    return m if m in MOOD_PROFILES else "calm_omen"


def _parse_pace_val(raw_p: str | None) -> float | None:
    if not raw_p:
        return None
    s = str(raw_p).strip().lower().rstrip("x")
    if s in PACE_NAMED:
        return PACE_NAMED[s]
    try:
        return max(0.70, min(1.18, float(s)))
    except ValueError:
        return None


def _parse_pitch_val(raw_st: str | None) -> float | None:
    if raw_st is None or str(raw_st).strip() == "":
        return None
    s = re.sub(r"(?:st|semi|semitones?)$", "", str(raw_st).strip().lower()).strip()
    try:
        return max(-4.0, min(4.0, float(s)))
    except ValueError:
        return None


def parse_script(
    path: str,
    default_voice: str = "vi-VN-NamMinhNeural",
    narrator_vieneu: str = "Thiện Minh",
    enable_clause_dsp_split: bool = False,
):
    """Parse SCRIPT.md into coherent whole-act speech items, pauses, visual_beats, silence_drops & dead_silences.

    v15.0 Clean Voice Delivery:
      - Does NOT fragment sentences on inline `[PACE=...]` / `[PITCH=...]` tags by default (`enable_clause_dsp_split=False`),
        keeping contiguous paragraphs intact for natural whole-act Gemini TTS or `--import-voice` delivery.
      - Preserves `[BEAT Xs]`, `[SILENCE_DROP Xs]`, `[DEAD SILENCE Xs]`, `[VISUAL Xs]`, and clean `[PROX=close]` mic-proximity EQ.
    """
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
        "vieneu_voice": narrator_vieneu,
        "profile": "",
        "cast_pitch_st": 0.0,
        "mood": "calm_omen",
        "acting": None,
        "ref_audio": None,
        "speed": None,
        "pitch": None,
        "fx": "dry",
        "prox": "normal",
        "clause_pace": None,
        "clause_pitch_st": None,
    }

    items = []

    def append_speech(line_txt: str):
        clean_disp = VIENEU_TAG_RE.sub("", line_txt)
        clean_disp = re.sub(r"\s+", " ", clean_disp).strip()
        if not clean_disp:
            return
        if (
            items
            and items[-1]["kind"] == "speech"
            and items[-1]["speaker"] == cur["speaker"]
            and items[-1]["mood"] == cur["mood"]
            and items[-1]["fx"] == cur["fx"]
            and items[-1]["voice"] == cur["voice"]
            and items[-1].get("vieneu_voice") == cur["vieneu_voice"]
            and items[-1]["ref_audio"] == cur["ref_audio"]
            and items[-1].get("prox") == cur["prox"]
            and items[-1].get("clause_pace") == cur["clause_pace"]
            and items[-1].get("clause_pitch_st") == cur["clause_pitch_st"]
        ):
            items[-1]["text"] = (items[-1]["text"] + " " + clean_disp).strip()
            items[-1]["raw_text"] = (items[-1]["raw_text"] + " " + line_txt).strip()
            items[-1]["tts_text"] = normalize_vi_for_tts(items[-1]["raw_text"], keep_vieneu_tags=False)
            items[-1]["vieneu_text"] = normalize_vi_for_tts(items[-1]["raw_text"], keep_vieneu_tags=True)
            return

        items.append({
            "kind": "speech",
            "text": clean_disp,
            "raw_text": line_txt,
            "tts_text": normalize_vi_for_tts(line_txt, keep_vieneu_tags=False),
            "vieneu_text": normalize_vi_for_tts(line_txt, keep_vieneu_tags=True),
            "speaker": cur["speaker"],
            "is_narrator": cur["is_narrator"],
            "voice": cur["voice"],
            "vieneu_voice": cur["vieneu_voice"],
            "profile": cur.get("profile", ""),
            "cast_pitch_st": cur["cast_pitch_st"],
            "mood": cur["mood"],
            "acting": cur["acting"],
            "ref_audio": cur["ref_audio"],
            "speed": cur["speed"],
            "pitch": cur["pitch"],
            "fx": cur["fx"],
            "prox": cur["prox"],
            "clause_pace": cur["clause_pace"],
            "clause_pitch_st": cur["clause_pitch_st"],
        })

    def emit_text_with_clause_mods(chunk_txt: str):
        sub_parts = CLAUSE_MOD_RE.split(chunk_txt)
        j = 0
        while j < len(sub_parts):
            seg_t = sub_parts[j].strip()
            if seg_t:
                append_speech(seg_t)
            if j + 1 < len(sub_parts):
                mod_raw = sub_parts[j + 1].strip()[1:-1]
                mkv = _parse_kv(mod_raw)
                if enable_clause_dsp_split:
                    if "pace" in mkv:
                        p_raw = str(mkv["pace"]).strip().lower()
                        cur["clause_pace"] = None if p_raw in ("normal", "reset", "default") else _parse_pace_val(mkv["pace"])
                    if "pitch" in mkv:
                        p_st_raw = str(mkv["pitch"]).strip().lower()
                        cur["clause_pitch_st"] = None if p_st_raw in ("0", "normal", "reset", "default") else _parse_pitch_val(mkv["pitch"])
                if "prox" in mkv:
                    cur["prox"] = mkv["prox"].strip().lower()
            j += 2

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
                resolved_m = _resolve_mood(kv.get("mood", "calm_omen"))
                default_prox = "close" if resolved_m == "whisper" else "normal"
                cur = {
                    "speaker": "NARRATOR",
                    "is_narrator": True,
                    "voice": kv.get("voice", default_voice),
                    "vieneu_voice": kv.get("vieneu_voice") or (kv["voice"] if "voice" in kv and not kv["voice"].lower().startswith("vi-vn-") else narrator_vieneu),
                    "profile": kv.get("profile", ""),
                    "cast_pitch_st": 0.0,
                    "mood": resolved_m,
                    "acting": kv.get("acting"),
                    "ref_audio": kv.get("ref") or kv.get("ref_audio"),
                    "speed": _parse_pace_val(kv.get("speed") or kv.get("pace")) if enable_clause_dsp_split else None,
                    "pitch": kv.get("pitch") if enable_clause_dsp_split else None,
                    "fx": kv.get("fx", "dry").lower(),
                    "prox": kv.get("prox", default_prox).lower(),
                    "clause_pace": _parse_pace_val(kv.get("pace")) if enable_clause_dsp_split else None,
                    "clause_pitch_st": _parse_pitch_val(kv.get("pitch")) if enable_clause_dsp_split else None,
                }
            else:
                sp_name = head.split(":", 1)[1].strip() if ":" in head else "SPEAKER"
                is_nar = sp_name.upper() == "NARRATOR"
                raw_m = kv.get("mood", "ghost_entity" if kv.get("fx", "").lower() == "ghost" else "tense")
                cast_v, cast_st = (
                    (narrator_vieneu, 0.0)
                    if is_nar
                    else resolve_character_voice(sp_name, kv.get("profile", ""), kv.get("voice"), narrator_voice=narrator_vieneu)
                )
                cur = {
                    "speaker": sp_name,
                    "is_narrator": is_nar,
                    "voice": kv.get("voice", default_voice),
                    "vieneu_voice": cast_v,
                    "profile": kv.get("profile", ""),
                    "cast_pitch_st": cast_st if enable_clause_dsp_split else 0.0,
                    "mood": _resolve_mood(raw_m),
                    "acting": kv.get("acting"),
                    "ref_audio": kv.get("ref") or kv.get("ref_audio"),
                    "speed": _parse_pace_val(kv.get("speed") or kv.get("pace")) if enable_clause_dsp_split else None,
                    "pitch": kv.get("pitch") if enable_clause_dsp_split else None,
                    "fx": kv.get("fx", "room").lower(),
                    "prox": kv.get("prox", "normal").lower(),
                    "clause_pace": _parse_pace_val(kv.get("pace")) if enable_clause_dsp_split else None,
                    "clause_pitch_st": _parse_pitch_val(kv.get("pitch")) if enable_clause_dsp_split else None,
                }
            continue

        parts = PAUSE_RE.split(s)
        i = 0
        while i < len(parts):
            txt = parts[i].strip()
            if txt:
                emit_text_with_clause_mods(txt)
            if i + 2 < len(parts):
                tag = parts[i + 1].upper()
                dur = max(0.05, float(parts[i + 2]))
                if "DEAD" in tag:
                    kind = "dead_silence"
                elif "SILENCE_DROP" in tag:
                    kind = "silence_drop"
                elif "VISUAL" in tag:
                    kind = "visual"
                elif "BEAT" in tag or "KHỰNG" in tag:
                    kind = "beat_pause"
                else:
                    kind = "pause"
                items.append({"kind": kind, "dur": dur})
            i += 3

    if not any(it["kind"] == "speech" for it in items):
        raise ValueError(f"No spoken lines parsed from {path}")
    return items


# ---------------- Clean Audio I/O & Transparent Studio Hygiene ----------------

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


def resample_mono(x: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    if src_sr == dst_sr or len(x) == 0:
        return x.astype(np.float64)
    g = math.gcd(dst_sr, src_sr)
    return signal.resample_poly(x.astype(np.float64), dst_sr // g, src_sr // g)


def load_audio_mono(path: str, target_sr: int) -> np.ndarray:
    """Load any WAV/MP3/FLAC/M4A file as mono float64 at `target_sr`."""
    if path.lower().endswith(".wav"):
        x, sr = read_wav_mono(path)
        return resample_mono(x, sr, target_sr)
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


def _fade(x: np.ndarray, sr: int, fi: float = 0.008, fo: float = 0.014) -> np.ndarray:
    out = x.copy()
    n = len(out)
    ni = min(int(round(fi * sr)), n // 3)
    no = min(int(round(fo * sr)), n // 3)
    if ni > 1:
        out[:ni] *= np.linspace(0.0, 1.0, ni)
    if no > 1:
        out[-no:] *= np.linspace(1.0, 0.0, no)
    return out


def trim_silence(x: np.ndarray, sr: int, pad_s: float = 0.03) -> np.ndarray:
    if len(x) == 0:
        return x
    idx = np.flatnonzero(np.abs(x) > 0.006)
    if len(idx) == 0:
        return x
    pad = int(round(pad_s * sr))
    return x[max(0, int(idx[0]) - pad) : min(len(x), int(idx[-1]) + pad)]


def normalize_rms(x: np.ndarray, target_dbfs: float = -19.0, max_peak: float = 0.88) -> np.ndarray:
    """Transparent active-speech RMS normalization with clip guard (zero nonlinear distortion)."""
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


def _shelf(x: np.ndarray, f0: float, gain_db: float, sr: int, kind: str = "low") -> np.ndarray:
    A = 10.0 ** (gain_db / 40.0)
    w = 2.0 * math.pi * f0 / sr
    cw, sw = math.cos(w), math.sin(w)
    al = sw / (2.0 * 0.707)
    sa = 2.0 * math.sqrt(A) * al
    if kind == "low":
        b = np.array([A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)])
        a = np.array([(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa])
    else:
        b = np.array([A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)])
        a = np.array([(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa])
    return signal.lfilter(b / a[0], a / a[0], x)


def apply_voice_fx(x: np.ndarray, sr: int, fx: str = "dry", mood: str = "calm_omen", prox: str = "normal") -> np.ndarray:
    """Studio-clean voice hygiene + physical proximity & multi-zone character FX (`dry`, `close_ear`, `room`, `adjacent_muffled`, `outside_rain`, `phone`, `ghost`).
    NEVER applies artificial noise vocoders, vibrato tremor, or harsh overdrive onto narration!"""
    if len(x) < 16:
        return x.copy()
    y = _hp(x.astype(np.float64), 45.0, sr, order=2)

    is_close = prox in ("close", "close_ear") or fx == "close_ear"
    if is_close and fx not in ("phone", "adjacent_muffled", "outside_rain"):
        # Studio cardioid close-mic proximity warmth + delicate breath air, 0% room echo
        y = _shelf(y, 155.0, +2.2, sr, kind="low")
        y = _shelf(y, 6200.0, +1.5, sr, kind="high")
    elif prox == "distant" and fx == "dry":
        y = _hp(_lp(y, 3400.0, sr, order=2), 130.0, sr, order=2)

    if fx == "phone":
        y = _bp(y, 320.0, 3200.0, sr, order=3)
    elif fx in ("adjacent_muffled", "outside_rain"):
        # Physical occlusion through wooden door / rain-streaked glass + tight damp wall reflections
        occ = _lp(y, 1180.0 if fx == "adjacent_muffled" else 1550.0, sr, order=3)
        wet = np.zeros(len(occ) + int(0.05 * sr), dtype=np.float64)
        wet[: len(occ)] += occ * 0.85
        for d_ms, amp in ((11.0, 0.22), (24.0, 0.14)):
            d = int(round((d_ms / 1000.0) * sr))
            wet[d : d + len(occ)] += _lp(occ, 900.0, sr, 2) * amp
        y = wet[: len(occ)]
    elif fx == "room" and not is_close:
        # Subtle interior room early reflections (14ms, 28ms, 45ms)
        wet = np.zeros(len(y) + int(0.06 * sr), dtype=np.float64)
        wet[: len(y)] += y
        for d_ms, amp in ((14.0, 0.18), (28.0, 0.11), (45.0, 0.06)):
            d = int(round((d_ms / 1000.0) * sr))
            wet[d : d + len(y)] += _lp(y, 2800.0, sr, 2) * amp
        y = wet[: len(y)]
    elif fx == "ghost":
        # Clean supernatural entity FX: subtle shadowed reflections + dark reverse-reverb pre-swell
        pad_pre = int(round(0.22 * sr))
        pad_post = int(round(0.30 * sr))
        buf = np.zeros(pad_pre + len(y) + pad_post, dtype=np.float64)
        buf[pad_pre : pad_pre + len(y)] += y * 0.88
        for d_ms, amp in ((18.0, 0.32), (42.0, 0.20)):
            d = int(round((d_ms / 1000.0) * sr))
            buf[pad_pre + d : pad_pre + d + len(y)] += _bp(y, 180.0, 2600.0, sr, 2) * amp
        ir_len = int(round(0.24 * sr))
        rng = np.random.default_rng(666)
        ir = _bp(rng.standard_normal(ir_len), 320.0, 3000.0, sr, 2) * np.exp(-np.arange(ir_len) / (0.075 * sr))
        rev = signal.fftconvolve(y[::-1], ir, mode="full")[::-1]
        rev = rev[max(0, len(rev) - len(buf)) :]
        if len(rev) < len(buf):
            rev = np.pad(rev, (len(buf) - len(rev), 0))
        buf += rev[: len(buf)] * (0.22 / (np.max(np.abs(rev)) + 1e-6)) * (np.max(np.abs(y)) + 1e-6)
        y = buf

    # Transparent peak guard
    pk = float(np.max(np.abs(y)))
    if pk > 0.90:
        y *= 0.90 / pk
    return _fade(y, sr, 0.008, 0.014)


def _tok_syllable_weight(tok: str) -> float:
    norm = norm_tok(tok)
    if norm.isdigit():
        expanded = normalize_vi_for_tts(norm)
        return max(1.4, sum(max(1.1, float(len(norm_tok(x)))) for x in expanded.split()))
    return max(1.15, float(len(norm)))


def _punct_break_strength(tok: str) -> float:
    if tok.endswith(("...", "…")):
        return 3.4
    if tok.endswith((".", "!", "?")):
        return 2.8
    if tok.endswith((";", ":", "—", "–")):
        return 1.9
    if tok.endswith(","):
        return 1.3
    return 0.0


def estimate_syllable_words(display_text: str, dur_s: float, offset_s: float, speaker: str, mood: str) -> list:
    """Distribute word timestamps proportionally to Vietnamese syllable + punctuation pause weight across `dur_s`."""
    toks = [t for t in display_text.split() if t.strip()]
    if not toks:
        return []
    weights = [_tok_syllable_weight(t) + _punct_break_strength(t) for t in toks]
    total_w = sum(weights)
    usable = max(0.06, dur_s)
    cur = offset_s
    out = []
    for tok, w in zip(toks, weights):
        wd = usable * (w / total_w)
        speech_w = usable * (_tok_syllable_weight(tok) / total_w)
        out.append({
            "w": tok,
            "s": round(cur, 4),
            "e": round(cur + max(0.035, min(wd, speech_w * 1.15)), 4),
            "speaker": speaker,
            "mood": mood,
        })
        cur += wd
    return out


def _detect_voiced_islands(samples: np.ndarray, sr: int, min_pause_s: float = 0.13) -> list[tuple[float, float]]:
    """Detect real voiced waveform islands `[(start_s, end_s), ...]`, leaving pauses >= `min_pause_s` completely empty."""
    dur_s = len(samples) / float(max(1, sr))
    if len(samples) < max(32, int(0.08 * sr)):
        return [(0.0, max(0.04, dur_s))]
    hop = max(1, int(round(0.010 * sr)))  # 10 ms frame step
    win = max(hop, int(round(0.025 * sr)))
    n_frames = max(1, (len(samples) - win) // hop + 1)
    sq = np.asarray(samples, dtype=np.float64) ** 2
    csum = np.concatenate([[0.0], np.cumsum(sq)])
    starts = np.arange(n_frames) * hop
    ends = np.minimum(len(samples), starts + win)
    rms = np.sqrt(np.maximum(1e-12, (csum[ends] - csum[starts]) / np.maximum(1, ends - starts)))
    db = 20.0 * np.log10(rms)
    peak_db = float(np.percentile(db, 95))
    thr_db = max(-45.0, peak_db - 26.5)
    voiced = db >= thr_db
    if not np.any(voiced):
        return [(0.0, max(0.04, dur_s))]

    # Bridge brief consonant closures (< 60 ms = 6 frames)
    bridge_f = 6
    idx_v = np.flatnonzero(voiced)
    for a_i, b_i in zip(idx_v[:-1], idx_v[1:]):
        if 1 < (b_i - a_i) <= bridge_f:
            voiced[a_i:b_i] = True

    # Extract raw voiced runs and merge runs separated by less than min_pause_s
    min_pause_f = max(7, int(round(min_pause_s / 0.010)))
    islands_f: list[list[int]] = []
    i = 0
    while i < n_frames:
        if not voiced[i]:
            i += 1
            continue
        j = i + 1
        while j < n_frames and voiced[j]:
            j += 1
        if j - i >= 3:
            if islands_f and (i - islands_f[-1][1]) < min_pause_f:
                islands_f[-1][1] = j
            else:
                islands_f.append([i, j])
        i = j

    if not islands_f:
        return [(max(0.0, idx_v[0] * 0.010), min(dur_s, (idx_v[-1] + 2) * 0.010))]

    out = []
    for fi, fj in islands_f:
        s0 = max(0.0, fi * 0.010 - 0.012)
        e0 = min(dur_s, fj * 0.010 + 0.018)
        if e0 > s0 + 0.03:
            out.append((s0, e0))
    return out or [(0.0, max(0.04, dur_s))]


def align_words_acoustic_islands(
    display_text: str,
    samples: np.ndarray,
    sr: int,
    offset_s: float,
    speaker: str,
    mood: str,
) -> list:
    """Tier-2 Acoustic Pause-Island Aligner (< 80 ms): maps punctuation clauses onto real voiced waveform islands so words NEVER land inside silent pauses."""
    toks = [t for t in display_text.split() if t.strip()]
    dur_s = len(samples) / float(max(1, sr))
    if not toks:
        return []
    islands = _detect_voiced_islands(samples, sr)
    if len(islands) == 1:
        is_s, is_e = islands[0]
        return estimate_syllable_words(display_text, max(0.05, is_e - is_s), offset_s + is_s, speaker, mood)

    # Candidate break indices after token k (0 <= k < len(toks) - 1)
    n_splits = min(len(islands) - 1, len(toks) - 1)
    if n_splits <= 0:
        is_s, is_e = islands[0][0], islands[-1][1]
        return estimate_syllable_words(display_text, max(0.05, is_e - is_s), offset_s + is_s, speaker, mood)

    # Pick top n_splits largest acoustic gaps so minor breaths merge cleanly when there are more islands than clauses
    if len(islands) - 1 > n_splits:
        gaps = [(islands[g + 1][0] - islands[g][1], g) for g in range(len(islands) - 1)]
        keep_gaps = set(g for _, g in sorted(gaps, reverse=True)[:n_splits])
        merged = [list(islands[0])]
        for g in range(len(islands) - 1):
            if g in keep_gaps:
                merged.append(list(islands[g + 1]))
            else:
                merged[-1][1] = islands[g + 1][1]
        islands = [(m[0], m[1]) for m in merged]

    # Dynamic programming: match `len(islands)` token groups to `islands` proportional to voiced duration + punctuation bonus!
    island_durs = [max(0.04, b - a) for a, b in islands]
    tot_voiced = sum(island_durs)
    cum_voiced = np.cumsum(island_durs) / tot_voiced

    tok_w = np.array([_tok_syllable_weight(t) for t in toks], dtype=np.float64)
    cum_w = np.cumsum(tok_w) / max(1e-6, float(np.sum(tok_w)))
    punct_b = np.array([_punct_break_strength(t) for t in toks], dtype=np.float64)

    M = len(islands)
    N = len(toks)
    INF = 1e18
    dp = np.full((M - 1, N - 1), INF, dtype=np.float64)
    parent = np.full((M - 1, N - 1), -1, dtype=np.int32)

    for k in range(0, N - M + 1):
        ratio_err = abs(cum_w[k] - cum_voiced[0])
        dp[0, k] = ratio_err * 6.0 - punct_b[k] * 0.42

    for m in range(1, M - 1):
        for k in range(m, N - (M - m) + 1):
            best_c = INF
            best_p = -1
            base_cost = abs(cum_w[k] - cum_voiced[m]) * 6.0 - punct_b[k] * 0.42
            for p in range(m - 1, k):
                c = dp[m - 1, p] + base_cost
                if c < best_c:
                    best_c = c
                    best_p = p
            dp[m, k] = best_c
            parent[m, k] = best_p

    last_m = M - 2
    best_k = int(np.argmin(dp[last_m]))
    splits = [0] * (M - 1)
    cur_k = best_k
    for m in range(M - 2, -1, -1):
        splits[m] = cur_k
        cur_k = int(parent[m, cur_k])

    out = []
    start_tok = 0
    for idx_is, (is_s, is_e) in enumerate(islands):
        end_tok = (splits[idx_is] + 1) if idx_is < M - 1 else N
        sub_txt = " ".join(toks[start_tok:end_tok])
        out.extend(estimate_syllable_words(sub_txt, max(0.04, is_e - is_s), offset_s + is_s, speaker, mood))
        start_tok = end_tok
    return out


_WHISPER_MODEL_CACHE = {}


def _get_whisper_model(model_size: str = "base"):
    if model_size not in _WHISPER_MODEL_CACHE:
        from faster_whisper import WhisperModel
        _WHISPER_MODEL_CACHE[model_size] = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _WHISPER_MODEL_CACHE[model_size]


def _tok_sim(a: str, b: str) -> float:
    if not a or not b:
        return -0.5
    if a == b:
        return 3.2
    if a in b or b in a:
        return 1.8
    # Strip diacritics / compare first+last char for slight ASR homophones
    if a[0] == b[0] and len(a) >= 2 and len(b) >= 2:
        return 0.9
    return -1.1


def align_words_whisper_forced(
    display_text: str,
    samples: np.ndarray,
    sr: int,
    offset_s: float,
    speaker: str,
    mood: str,
    model_size: str = "base",
) -> tuple[list, str]:
    """Tier-1 Studio Forced Word Aligner (< 35 ms): faster-whisper word_timestamps + Needleman-Wunsch alignment onto exact SCRIPT.md tokens, with Tier-2 Acoustic Pause-Island fallback."""
    toks = [t for t in display_text.split() if t.strip()]
    if not toks:
        return [], "empty"
    dur_s = len(samples) / float(max(1, sr))
    if dur_s < 0.15:
        return align_words_acoustic_islands(display_text, samples, sr, offset_s, speaker, mood), "acoustic_island"

    try:
        model = _get_whisper_model(model_size)
        wav_16k = resample_mono(samples, sr, 16000).astype(np.float32)
        tts_prompt = normalize_vi_for_tts(display_text, keep_vieneu_tags=False)
        segments, _ = model.transcribe(
            wav_16k,
            language="vi",
            word_timestamps=True,
            vad_filter=False,
            condition_on_previous_text=False,
            initial_prompt=tts_prompt[:220],
            beam_size=2,
        )
        obs = []
        for seg in segments:
            for w in (seg.words or []):
                wt = norm_tok(w.word)
                if wt:
                    s0 = max(0.0, min(dur_s - 0.02, float(w.start)))
                    e0 = max(s0 + 0.025, min(dur_s, float(w.end)))
                    obs.append((wt, s0, e0))
    except Exception:
        return align_words_acoustic_islands(display_text, samples, sr, offset_s, speaker, mood), "acoustic_island"

    if len(obs) < max(1, int(len(toks) * 0.45)):
        return align_words_acoustic_islands(display_text, samples, sr, offset_s, speaker, mood), "acoustic_island"

    # Expand display tokens into spoken phonetic syllables (e.g. "13," -> [(idx, "mười"), (idx, "ba")])
    sub_exp = []
    for d_idx, dt in enumerate(toks):
        spoken = normalize_vi_for_tts(dt, keep_vieneu_tags=False)
        stoks = [norm_tok(x) for x in spoken.split() if norm_tok(x)]
        if not stoks:
            stoks = [norm_tok(dt) or "a"]
        for st in stoks:
            sub_exp.append((d_idx, st))

    N = len(sub_exp)
    M = len(obs)
    GAP = -1.25
    dp = np.zeros((N + 1, M + 1), dtype=np.float64)
    bt = np.zeros((N + 1, M + 1), dtype=np.int8)  # 1=diag, 2=up(skip sub), 3=left(skip obs)
    for i in range(1, N + 1):
        dp[i, 0] = i * GAP
        bt[i, 0] = 2
    for j in range(1, M + 1):
        dp[0, j] = j * GAP
        bt[0, j] = 3

    for i in range(1, N + 1):
        sa = sub_exp[i - 1][1]
        for j in range(1, M + 1):
            c_diag = dp[i - 1, j - 1] + _tok_sim(sa, obs[j - 1][0])
            c_up = dp[i - 1, j] + GAP
            c_left = dp[i, j - 1] + GAP
            if c_diag >= c_up and c_diag >= c_left:
                dp[i, j] = c_diag
                bt[i, j] = 1
            elif c_up >= c_left:
                dp[i, j] = c_up
                bt[i, j] = 2
            else:
                dp[i, j] = c_left
                bt[i, j] = 3

    sub_times: list[tuple[float, float] | None] = [None] * N
    i, j = N, M
    while i > 0 or j > 0:
        move = int(bt[i, j])
        if i > 0 and j > 0 and move == 1:
            if _tok_sim(sub_exp[i - 1][1], obs[j - 1][0]) > -0.6:
                sub_times[i - 1] = (obs[j - 1][1], obs[j - 1][2])
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or move == 2):
            i -= 1
        else:
            j -= 1

    # Interpolate any unmatched sub-tokens strictly inside the surrounding matched anchor window using voiced islands
    islands = _detect_voiced_islands(samples, sr)
    audio_s0 = islands[0][0]
    audio_e0 = islands[-1][1]
    k = 0
    while k < N:
        if sub_times[k] is not None:
            k += 1
            continue
        r = k
        while r < N and sub_times[r] is None:
            r += 1
        win_s = sub_times[k - 1][1] if k > 0 and sub_times[k - 1] is not None else audio_s0
        win_e = sub_times[r][0] if r < N and sub_times[r] is not None else audio_e0
        if win_e <= win_s + 0.03 * (r - k):
            win_e = min(dur_s, win_s + 0.08 * (r - k))
        # Clamp interpolation window to first/last voiced sample inside [win_s, win_e]
        s_idx = max(0, min(len(samples) - 1, int(round(win_s * sr))))
        e_idx = max(s_idx + 1, min(len(samples), int(round(win_e * sr))))
        sub_seg = samples[s_idx:e_idx]
        sub_is = _detect_voiced_islands(sub_seg, sr)
        eff_s = win_s + sub_is[0][0]
        eff_e = max(eff_s + 0.03 * (r - k), win_s + sub_is[-1][1])
        span = eff_e - eff_s
        ws = [max(1.1, float(len(sub_exp[m][1]))) for m in range(k, r)]
        tw = sum(ws)
        cur_t = eff_s
        for m, w_val in zip(range(k, r), ws):
            dt_m = span * (w_val / tw)
            sub_times[m] = (cur_t, max(cur_t + 0.025, cur_t + dt_m))
            cur_t += dt_m
        k = r

    # Collapse phonetic sub-tokens back to exact display tokens
    disp_spans: list[list[float]] = [[dur_s, 0.0] for _ in range(len(toks))]
    for m, (d_idx, _) in enumerate(sub_exp):
        st_m, en_m = sub_times[m] or (0.0, 0.05)
        disp_spans[d_idx][0] = min(disp_spans[d_idx][0], st_m)
        disp_spans[d_idx][1] = max(disp_spans[d_idx][1], en_m)

    out = []
    prev_e = 0.0
    for dt, (s0, e0) in zip(toks, disp_spans):
        s_clean = max(prev_e, s0)
        e_clean = max(s_clean + 0.03, e0)
        prev_e = e_clean
        out.append({
            "w": dt,
            "s": round(offset_s + s_clean, 4),
            "e": round(offset_s + e_clean, 4),
            "speaker": speaker,
            "mood": mood,
        })
    return out, "whisper_forced"


def align_audio_words_v11(
    display_text: str,
    samples: np.ndarray,
    sr: int,
    offset_s: float,
    speaker: str,
    mood: str,
    aligner_mode: str = "auto",
    whisper_model: str = "base",
    cache_path: str | None = None,
) -> tuple[list, str]:
    """Unified v11.0 Acoustic Word Aligner (`auto` | `whisper` | `acoustic` | `proportional`)."""
    mode = (aligner_mode or "auto").lower()
    if mode == "proportional":
        return estimate_syllable_words(display_text, len(samples) / float(max(1, sr)), offset_s, speaker, mood), "proportional"
    if mode == "acoustic":
        return align_words_acoustic_islands(display_text, samples, sr, offset_s, speaker, mood), "acoustic_island"

    if cache_path and os.path.isfile(cache_path):
        try:
            cached = json.load(open(cache_path, encoding="utf-8"))
            if cached.get("text") == display_text and isinstance(cached.get("words"), list) and cached["words"]:
                shifted = [
                    {**w, "s": round(offset_s + float(w["s"]), 4), "e": round(offset_s + float(w["e"]), 4), "speaker": speaker, "mood": mood}
                    for w in cached["words"]
                ]
                return shifted, str(cached.get("mode", "whisper_forced"))
        except Exception:
            pass

    words_zero, used_mode = align_words_whisper_forced(display_text, samples, sr, 0.0, speaker, mood, model_size=whisper_model)
    if cache_path and words_zero and used_mode == "whisper_forced":
        try:
            os.makedirs(os.path.dirname(os.path.abspath(cache_path)), exist_ok=True)
            with open(cache_path, "w", encoding="utf-8") as fp:
                json.dump({"text": display_text, "mode": used_mode, "words": words_zero}, fp, ensure_ascii=False)
        except Exception:
            pass

    if abs(offset_s) > 1e-6:
        words_zero = [
            {**w, "s": round(offset_s + float(w["s"]), 4), "e": round(offset_s + float(w["e"]), 4)}
            for w in words_zero
        ]
    return words_zero, used_mode


def align_chunk_words(display_text: str, raw_events: list, t0: float, speed: float, dur_s: float, speaker: str, mood: str) -> list:
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


# ---------------- Clean Pluggable Neural TTS Backends (`vieneu`, `edge`, `gemini`) ----------------

_VIENEU_INSTANCE = None
_VIENEU_MODE_LOADED = None
_HAS_RUBBERBAND = None
_F0_CACHE: dict[str, float] = {}
_ANCHOR_CACHE: dict[str, dict] = {}
_PRESET_DEFAULT_F0 = {
    "Thiện Minh": 107.4,
    "Thiền Tâm Đức": 104.0,
    "Hải Đăng": 124.0,
    "Thái Sơn": 112.0,
    "Thanh Bình": 115.0,
}


def _discover_narrator_anchor_wav(args) -> str | None:
    """Resolve explicit `--narrator-anchor` or auto-discover `audio/narrator_anchor.wav` if present."""
    explicit = getattr(args, "narrator_anchor", None)
    if explicit and os.path.isfile(explicit):
        return os.path.abspath(explicit)
    here = os.path.dirname(os.path.abspath(__file__))
    for cand in (
        os.path.abspath(os.path.join(here, "..", "audio", "narrator_anchor.wav")),
        os.path.abspath(os.path.join(os.getcwd(), "audio", "narrator_anchor.wav")),
        os.path.abspath(os.path.join(os.getcwd(), "shorts-project", "audio", "narrator_anchor.wav")),
    ):
        if os.path.isfile(cand):
            return cand
    return None


def measure_median_f0(audio_or_path, sr: int = SR_FINAL) -> float:
    """Measure vocal median F0 (Hz) via `librosa.pyin`; returns 0.0 for unvoiced whispers or if librosa unavailable."""
    cache_key = None
    if isinstance(audio_or_path, str):
        ap = os.path.abspath(audio_or_path)
        cache_key = f"{ap}:{os.path.getmtime(ap):.0f}"
        if cache_key in _F0_CACHE:
            return _F0_CACHE[cache_key]
    try:
        import librosa
        if isinstance(audio_or_path, str):
            x = load_audio_mono(audio_or_path, 24000).astype(np.float32)
            eff_sr = 24000
        else:
            x = np.asarray(audio_or_path, dtype=np.float32).reshape(-1)
            eff_sr = sr
        if len(x) < int(0.15 * eff_sr):
            return 0.0
        f0, _, _ = librosa.pyin(x, fmin=65.0, fmax=380.0, sr=eff_sr)
        voiced = f0[~np.isnan(f0)]
        val = float(np.median(voiced)) if len(voiced) >= max(4, int(0.08 * len(f0))) else 0.0
    except Exception:
        val = 0.0
    if cache_key:
        _F0_CACHE[cache_key] = val
    return val


def _slice_expressive_codes(codes: np.ndarray | None, max_frames: int) -> np.ndarray | None:
    """Trim `ref_codes` to a centered expressive core window so emotion transfers without overriding locked speaker_emb."""
    if codes is None or max_frames <= 0:
        return codes
    arr = np.asarray(codes, dtype=np.int64)
    if arr.ndim < 2 or arr.shape[0] <= max_frames:
        return arr
    # Skip leading fade-in frames and keep a centered core window
    start = max(0, (arr.shape[0] - max_frames) // 2)
    return arr[start : start + max_frames]


def _align_ref_f0_to_anchor(
    ref_path: str,
    target_f0: float,
    mood_offset_st: float | None,
    tmp_dir: str | None,
    enabled: bool = False,
) -> tuple[str, float, bool]:
    """v15.0: Disabled by default (`enabled=False`) to preserve 100% natural vocal formants without pitch-DSP artifacts.
    Only shifts reference clip F0 when explicitly opted in via `--enable-legacy-tempo-dsp`."""
    if not enabled or mood_offset_st is None or target_f0 <= 0.0 or not shutil.which("ffmpeg"):
        return ref_path, 0.0, False
    ref_f0 = measure_median_f0(ref_path)
    if ref_f0 <= 0.0:
        return ref_path, 0.0, False
    desired_f0 = target_f0 * (2.0 ** (float(mood_offset_st) / 12.0))
    delta_st = 12.0 * math.log2(max(55.0, desired_f0) / max(55.0, ref_f0))
    if abs(delta_st) < 1.2:
        return ref_path, 0.0, False
    delta_st = max(-4.8, min(4.8, delta_st))
    ratio = 2.0 ** (delta_st / 12.0)
    out_w = os.path.join(tmp_dir or tempfile.gettempdir(), f"ref_f0_{os.getpid()}_{abs(hash((ref_path, round(delta_st, 2))))%1000000}.wav")
    af = f"rubberband=pitch={ratio:.5f}:formant=preserved" if _ffmpeg_has_rubberband() else f"asetrate=48000*{ratio:.5f},aresample=48000,atempo={1.0/ratio:.5f}"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", ref_path, "-af", af, "-ar", str(SR_FINAL), "-ac", "1", "-c:a", "pcm_s16le", out_w],
        check=True,
    )
    return out_w, round(delta_st, 2), True


def _resolve_narrator_anchor(tts, args) -> dict | None:
    """Resolve the single locked narrator identity (`speaker_emb` + `target_f0`) used across all [NARRATOR] acts."""
    src_mode = getattr(args, "speaker_lock_source", "auto") or "auto"
    anchor_wav = _discover_narrator_anchor_wav(args)
    preset_name = getattr(args, "vieneu_voice", None) or "Thiện Minh"

    if src_mode in ("auto", "anchor") and anchor_wav:
        ck = f"wav:{anchor_wav}:{os.path.getmtime(anchor_wav):.0f}"
        if ck not in _ANCHOR_CACHE:
            emb, _ = tts.encode_reference(anchor_wav, denoise=True)
            _ANCHOR_CACHE[ck] = {
                "label": os.path.basename(anchor_wav),
                "speaker_emb": np.asarray(emb, dtype=np.float32),
                "target_f0": measure_median_f0(anchor_wav) or 115.0,
            }
        return _ANCHOR_CACHE[ck]

    if src_mode == "calm":
        emo_dir = _discover_emotion_refs_dir(args)
        if emo_dir:
            calm_p = os.path.join(emo_dir, "calm.wav")
            if os.path.isfile(calm_p):
                ck = f"calm:{calm_p}:{os.path.getmtime(calm_p):.0f}"
                if ck not in _ANCHOR_CACHE:
                    emb, _ = tts.encode_reference(calm_p, denoise=True)
                    _ANCHOR_CACHE[ck] = {
                        "label": "calm.wav",
                        "speaker_emb": np.asarray(emb, dtype=np.float32),
                        "target_f0": measure_median_f0(calm_p) or 135.0,
                    }
                return _ANCHOR_CACHE[ck]

    # Default ("auto" without custom anchor wav, or "preset"): lock to built-in VieNeu preset (e.g. "Thiện Minh")
    if hasattr(tts, "get_preset_voice"):
        ck = f"preset:{preset_name}"
        if ck not in _ANCHOR_CACHE:
            pv = tts.get_preset_voice(preset_name)
            _ANCHOR_CACHE[ck] = {
                "label": preset_name,
                "speaker_emb": np.asarray(pv["speaker_emb"], dtype=np.float32),
                "target_f0": float(_PRESET_DEFAULT_F0.get(preset_name, 112.0)),
            }
        return _ANCHOR_CACHE[ck]
    return None


def _has_vieneu() -> bool:
    try:
        import vieneu  # noqa: F401
        return True
    except Exception:
        return False


def _get_vieneu(mode: str = "v3turbo"):
    global _VIENEU_INSTANCE, _VIENEU_MODE_LOADED
    if _VIENEU_INSTANCE is None or _VIENEU_MODE_LOADED != mode:
        from vieneu import Vieneu
        _VIENEU_INSTANCE = Vieneu(mode=mode, device="cpu")
        _VIENEU_MODE_LOADED = mode
    return _VIENEU_INSTANCE


def _discover_emotion_refs_dir(args) -> str | None:
    """Resolve explicit `--emotion-refs` or auto-discover populated `audio/emotion_refs/` in workspace."""
    explicit = getattr(args, "emotion_refs", None)
    if explicit and os.path.isdir(explicit):
        return explicit
    # Auto-detect workspace emotion bank only when explicit dir wasn't given (and not disabled)
    if getattr(args, "no_auto_refs", False):
        return None
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "audio", "emotion_refs")),
        os.path.abspath(os.path.join(os.getcwd(), "audio", "emotion_refs")),
        os.path.abspath(os.path.join(os.getcwd(), "shorts-project", "audio", "emotion_refs")),
    ]
    for cand in candidates:
        if os.path.isdir(cand) and any(f.lower().endswith((".wav", ".mp3", ".flac")) for f in os.listdir(cand)):
            return cand
    return None


def resolve_emotion_ref(item: dict, args) -> str | None:
    """Resolve optional 5-8s clean reference audio clip for zero-shot voice cloning (`VieNeu-TTS`, 1.0x clean).
    v15.3: Explicit `--ref-audio` (clean storyteller clip, zero distorting DSP) takes priority over auto-discovered `audio/emotion_refs/`.
    Non-narrator NPCs keep their distinct cast `vieneu_voice` unless an explicit `ref_audio` was set on that speaker."""
    if item.get("ref_audio") and os.path.isfile(item["ref_audio"]):
        return item["ref_audio"]
    if not item.get("is_narrator", True):
        return None
    global_ref = getattr(args, "ref_audio", None)
    if global_ref and os.path.isfile(global_ref):
        return global_ref
    emo_dir = _discover_emotion_refs_dir(args)
    if emo_dir:
        mood = item["mood"]
        ref_key = MOOD_PROFILES.get(mood, {}).get("ref_key", mood)
        for stem in (mood, ref_key, "calm", "narrator", "default"):
            for ext in (".wav", ".mp3", ".flac"):
                cand = os.path.join(emo_dir, stem + ext)
                if os.path.isfile(cand):
                    return cand
    return None


def apply_clean_tempo(
    samples: np.ndarray,
    sr: int,
    tempo: float,
    tmp_dir: str | None = None,
    pitch_st: float = 0.0,
) -> np.ndarray:
    """Transparent studio-grade formant-preserved tempo & pitch shaping via `ffmpeg rubberband` (0% noise/distortion)."""
    t = max(0.68, min(1.16, float(tempo)))
    pst = max(-4.0, min(4.0, float(pitch_st)))
    if len(samples) < 256 or (abs(t - 1.0) < 0.015 and abs(pst) < 0.08) or not shutil.which("ffmpeg"):
        return samples
    in_w = os.path.join(tmp_dir or tempfile.gettempdir(), f"ct_in_{os.getpid()}_{int(time.time()*1e6)%1000000}.wav")
    out_w = in_w.replace("_in_", "_out_")
    try:
        write_wav_mono16(in_w, samples, sr)
        p_ratio = 2.0 ** (pst / 12.0)
        if _ffmpeg_has_rubberband():
            if abs(pst) >= 0.08:
                af = f"rubberband=tempo={t:.5f}:pitch={p_ratio:.5f}:formant=preserved"
            else:
                af = f"rubberband=tempo={t:.5f}:formant=preserved"
        else:
            if abs(pst) >= 0.08:
                af = f"asetrate={sr}*{p_ratio:.5f},aresample={sr},{_atempo_chain(t / p_ratio)}"
            else:
                af = _atempo_chain(t)
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", in_w, "-af", af, "-ar", str(sr), "-ac", "1", "-c:a", "pcm_s16le", out_w],
            check=True,
        )
        y, _ = read_wav_mono(out_w)
        return y
    finally:
        for p in (in_w, out_w):
            if os.path.exists(p):
                os.remove(p)


def synth_vieneu_chunk(item: dict, sr: int, args, cache_dir: str | None = None, tmp_dir: str | None = None):
    """Synthesize ONE coherent act/clause via `pnnbao97/VieNeu-TTS` (48 kHz native Vietnamese ONNX CPU!).
    Uses per-mood native `silence_p`, `temperature`, 84-frame pure-Vietnamese `emotion_refs` prosody with Speaker-Locked
    Disentanglement for narrator, distinct 25-voice casting for NPCs, and clause-level tempo/pitch shaping."""
    mode = getattr(args, "vieneu_mode", "v3turbo")
    mood = item["mood"]
    prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
    use_multi = bool(getattr(args, "multi_style_guide", False))
    is_nar = bool(item.get("is_narrator", True))
    voice_name = (
        (prof.get("multi_style_voice") if (use_multi and is_nar) else None)
        or item.get("vieneu_voice")
        or getattr(args, "vieneu_voice", None)
        or "Thiện Minh"
    )
    ref_audio = resolve_emotion_ref(item, args)
    silence_p = float(prof.get("vn_silence_p", 0.26))
    temp = float(prof.get("vn_temp", 0.76))
    text = item.get("vieneu_text") or normalize_vi_for_tts(item["text"], keep_vieneu_tags=True)

    explicit_ref = bool(
        (item.get("ref_audio") and os.path.isfile(str(item.get("ref_audio"))))
        or (getattr(args, "ref_audio", None) and os.path.isfile(str(getattr(args, "ref_audio"))))
    )
    has_explicit_anchor = bool(getattr(args, "narrator_anchor", None) and os.path.isfile(str(getattr(args, "narrator_anchor"))))
    # When user passes a clean 5-8s `--ref-audio` storyteller clip directly (without explicit `--narrator-anchor`),
    # pass it straight to VieNeu-TTS at 1.0x with zero F0/speaker-lock DSP override so the natural storytelling timbre stays intact.
    use_speaker_lock = (
        bool(getattr(args, "speaker_lock", True))
        and is_nar
        and bool(ref_audio)
        and (not use_multi)
        and (not explicit_ref or has_explicit_anchor)
    )
    base_max_frames = int(getattr(args, "ref_codes_max_frames", 84))
    eff_max_frames = max(base_max_frames, 48) if (mood == "whisper" and base_max_frames > 0) else base_max_frames
    lock_src = getattr(args, "speaker_lock_source", "auto") or "auto"
    anchor_wav_sig = _discover_narrator_anchor_wav(args) or f"preset:{voice_name}"

    ref_sig = f"{os.path.abspath(ref_audio)}:{os.path.getmtime(ref_audio):.0f}" if ref_audio else f"preset:{voice_name}"
    lock_sig = f"lock={lock_src}:{anchor_wav_sig}:mf={eff_max_frames}" if use_speaker_lock else f"cast={voice_name}"
    key = hashlib.sha256(f"vieneu130|{mode}|{ref_sig}|{lock_sig}|sp={silence_p:.2f}|t={temp:.2f}|{text}".encode("utf-8")).hexdigest()[:16]
    wav_cache = os.path.join(cache_dir, f"vn_{key}.wav") if cache_dir else None

    if wav_cache and os.path.isfile(wav_cache) and os.path.getsize(wav_cache) >= 512:
        samples = load_audio_mono(wav_cache, sr)
    else:
        tts = _get_vieneu(mode=mode)
        infer_kw = {
            "text": text,
            "denoise": True,
            "apply_watermark": False,
            "silence_p": silence_p,
            "temperature": temp,
        }
        tmp_shifted = None
        try:
            if ref_audio and use_speaker_lock and hasattr(tts, "encode_reference"):
                anchor = _resolve_narrator_anchor(tts, args)
                if anchor is not None:
                    f0_off = prof.get("f0_offset_st", 0.0)
                    aligned_ref, shift_st, is_tmp = _align_ref_f0_to_anchor(
                        ref_audio,
                        anchor["target_f0"],
                        f0_off,
                        tmp_dir,
                        enabled=bool(getattr(args, "enable_legacy_tempo_dsp", False)),
                    )
                    if is_tmp:
                        tmp_shifted = aligned_ref
                    _, emo_codes = tts.encode_reference(aligned_ref, denoise=True)
                    emo_codes = _slice_expressive_codes(emo_codes, eff_max_frames)
                    infer_kw["voice"] = {"speaker_emb": anchor["speaker_emb"], "codes": emo_codes}
                    n_cf = 0 if emo_codes is None else int(np.asarray(emo_codes).shape[0])
                    print(
                        f"  [VieNeu-TTS] mood={mood} speaker_lock={anchor['label']} + emotion_ref={os.path.basename(ref_audio)} "
                        f"(f0_shift={shift_st:+.1f}st, codes={n_cf}f, silence_p={silence_p}, temp={temp})"
                    )
                else:
                    infer_kw["ref_audio"] = ref_audio
            elif ref_audio:
                infer_kw["ref_audio"] = ref_audio
            else:
                infer_kw["voice"] = voice_name
                print(f"  [VieNeu-TTS] speaker={item['speaker']} cast_voice={voice_name} mood={mood} (silence_p={silence_p}, temp={temp})")
            raw = tts.infer(**infer_kw)
        finally:
            if tmp_shifted and os.path.exists(tmp_shifted):
                os.remove(tmp_shifted)
        raw = np.asarray(raw, dtype=np.float64).reshape(-1)
        in_sr = int(getattr(tts, "sample_rate", 48000 if mode == "v3turbo" else 24000))
        raw = trim_silence(raw, in_sr, pad_s=0.03)
        samples = resample_mono(raw, in_sr, sr)
        if wav_cache:
            os.makedirs(cache_dir, exist_ok=True)
            write_wav_mono16(wav_cache, samples, sr)

    eff_tempo = 1.0
    pitch_st = 0.0
    # v15.0: Tempo/pitch DSP is OFF by default (`--enable-legacy-tempo-dsp` required to opt in)
    if bool(getattr(args, "enable_legacy_tempo_dsp", False)) and not getattr(args, "no_tempo_trim", False):
        base_tempo = float(item["speed"]) if item.get("speed") is not None else float(prof.get("clean_tempo", 1.0)) * float(getattr(args, "speed_scale", 1.0))
        if item.get("clause_pace") is not None:
            cp = float(item["clause_pace"])
            base_tempo = (min(base_tempo, cp * 0.94) if cp < 1.0 else base_tempo * cp) * float(getattr(args, "speed_scale", 1.0))
        eff_tempo = max(0.68, min(1.16, base_tempo))
        pitch_st = float(item.get("cast_pitch_st") or 0.0) + float(item.get("clause_pitch_st") or 0.0)
        if abs(eff_tempo - 1.0) >= 0.02 or abs(pitch_st) >= 0.08:
            samples = apply_clean_tempo(samples, sr, eff_tempo, tmp_dir=tmp_dir, pitch_st=pitch_st)
            item["_clause_shaped_in_synth"] = True

    aligner_mode = getattr(args, "word_aligner", "auto")
    whisper_model = getattr(args, "whisper_model", "base")
    shape_sig = f"tm={eff_tempo:.3f}:{pitch_st:.2f}"
    w_cache = (wav_cache + f".{hashlib.md5(shape_sig.encode()).hexdigest()[:6]}.{whisper_model}.words_v13.json") if wav_cache else None
    words, _ = align_audio_words_v11(
        item["text"], samples, sr, 0.0, item["speaker"], item["mood"],
        aligner_mode=aligner_mode, whisper_model=whisper_model, cache_path=w_cache,
    )
    return samples, words


def _ffmpeg_has_rubberband() -> bool:
    global _HAS_RUBBERBAND
    if _HAS_RUBBERBAND is None:
        try:
            out = subprocess.check_output(["ffmpeg", "-hide_banner", "-filters"], text=True, stderr=subprocess.STDOUT)
            _HAS_RUBBERBAND = "rubberband" in out
        except Exception:
            _HAS_RUBBERBAND = False
    return _HAS_RUBBERBAND


def _atempo_chain(factor: float) -> str:
    parts = []
    f = max(0.5, min(2.0, float(factor)))
    parts.append(f"atempo={f:.5f}")
    return ",".join(parts)


async def _synth_edge_once(text: str, voice: str, out_mp3: str, max_attempts: int = 20):
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
    raise RuntimeError(f"edge-tts failed after {max_attempts} attempts: {last_err}")


def probe_dur(path: str) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        text=True,
    ).strip()
    return float(out)


def synth_edge_chunk(
    item: dict,
    sr: int,
    tmp_dir: str,
    idx: int,
    base_speed_scale: float = 1.0,
    cache_dir: str | None = None,
    enable_legacy_tempo_dsp: bool = False,
):
    """Clean, distortion-free whole-act `edge-tts` fallback (v15.0: exact 1.0x tempo, 0.0 pitch DSP by default)."""
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    if enable_legacy_tempo_dsp:
        speed = float(item["speed"]) if item["speed"] is not None else float(prof["speed"]) * base_speed_scale
        speed = max(0.75, min(1.25, speed))
        pitch_semi = float(prof.get("pitch_semi", 0.0))
    else:
        speed = 1.0
        pitch_semi = 0.0

    tts_text = item.get("tts_text") or normalize_vi_for_tts(item["text"])
    key = hashlib.sha256(f"edge6|{item['voice']}|{tts_text}".encode("utf-8")).hexdigest()[:16]
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

    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{t0:.4f}", "-to", f"{t1:.4f}", "-i", mp3]
    if enable_legacy_tempo_dsp and (abs(speed - 1.0) >= 0.015 or abs(pitch_semi) > 0.05):
        pitch_ratio = 2.0 ** (pitch_semi / 12.0)
        if abs(pitch_semi) > 0.05 and _ffmpeg_has_rubberband():
            af = f"rubberband=pitch={pitch_ratio:.5f}:tempo={speed:.5f}:formant=preserved"
        elif _ffmpeg_has_rubberband():
            af = f"rubberband=tempo={speed:.5f}:formant=preserved"
        else:
            af = _atempo_chain(speed)
        cmd.extend(["-af", af])
    cmd.extend(["-ar", str(sr), "-ac", "1", "-sample_fmt", "s16", wav])
    subprocess.run(cmd, check=True)
    samples, _ = read_wav_mono(wav)
    words = align_chunk_words(item["text"], events, t0, speed, len(samples) / float(sr), item["speaker"], item["mood"])
    return samples, words


def synth_gemini_chunk(
    item: dict,
    sr: int,
    tmp_dir: str,
    idx: int,
    api_key: str,
    model: str,
    voice_name: str,
    cache_dir: str | None = None,
    aligner_mode: str = "auto",
    whisper_model: str = "base",
):
    """Synthesize ONE coherent act paragraph via Gemini Preview TTS REST API (pure urllib, 1.0x zero DSP)."""
    prof = MOOD_PROFILES.get(item["mood"], MOOD_PROFILES["calm_omen"])
    style = item.get("acting") or prof.get("acting_prompt", "Đọc truyền cảm tự nhiên")
    tts_text = item.get("tts_text") or normalize_vi_for_tts(item["text"])
    eff_voice = resolve_gemini_voice(
        item.get("speaker", "NARRATOR"),
        item.get("profile", ""),
        bool(item.get("is_narrator", True)),
        default_narrator_voice=voice_name,
    )
    prompt = f"Read aloud in Vietnamese with the following vocal tone ({style}). Output speech audio only:\n{tts_text}"

    key = hashlib.sha256(f"gem15|{model}|{eff_voice}|{prompt}".encode("utf-8")).hexdigest()[:16]
    wav_cache = os.path.join(cache_dir, f"gem_{key}.wav") if cache_dir else None

    if wav_cache and os.path.isfile(wav_cache) and os.path.getsize(wav_cache) >= 512:
        raw_x = load_audio_mono(wav_cache, sr)
    else:
        model_chain = []
        for m in (model, "gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"):
            if m and m not in model_chain:
                model_chain.append(m)
        last_exc = None
        audio_bytes = None
        mime = "audio/L16;rate=24000"
        for m_try in model_chain:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_try}:generateContent?key={api_key}"
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": eff_voice}}},
                    },
                }
                req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                for cand in data.get("candidates") or []:
                    for part in (cand.get("content") or {}).get("parts") or []:
                        inline = part.get("inlineData") or part.get("inline_data")
                        if inline and inline.get("data"):
                            audio_bytes = base64.b64decode(inline["data"])
                            mime = str(inline.get("mimeType") or inline.get("mime_type") or mime)
                            break
                    if audio_bytes:
                        break
                if audio_bytes:
                    print(f"  [Gemini-TTS] model={m_try} voice={eff_voice} mood={item['mood']} ({len(tts_text.split())}w)")
                    break
            except Exception as exc:
                last_exc = exc
        if not audio_bytes:
            raise RuntimeError(f"Gemini TTS failed across {model_chain}: {last_exc}")

        if "l16" in mime.lower() or "pcm" in mime.lower():
            m_sr = re.search(r"rate=(\d+)", mime)
            in_sr = int(m_sr.group(1)) if m_sr else 24000
            raw_pcm = np.frombuffer(audio_bytes, "<i2").astype(np.float64) / 32768.0
            raw_x = resample_mono(raw_pcm, in_sr, sr)
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

    w_cache = (wav_cache + f".{whisper_model}.words_v15.json") if wav_cache else None
    words, _ = align_audio_words_v11(
        item["text"], raw_x, sr, 0.0, item["speaker"], item["mood"],
        aligner_mode=aligner_mode, whisper_model=whisper_model, cache_path=w_cache,
    )
    return raw_x, words


def synth_line_auto(item: dict, sr: int, tmp_dir: str, idx: int, args, cache_dir: str | None = None, synth_fn=None):
    """v15.3 whole-act dispatcher: `synth_fn` -> `vieneu` (DEFAULT 1.0x clean free local) -> `edge` fallback (`gemini` ONLY when explicitly requested)."""
    if synth_fn is not None:
        return synth_fn(item, sr, idx)

    engine = str(getattr(args, "tts_engine", "vieneu") or "vieneu").strip().lower()
    api_key = getattr(args, "gemini_api_key", None) or _load_dotenv_key("GEMINI_API_KEY")
    aligner_mode = getattr(args, "word_aligner", "auto")
    whisper_model = getattr(args, "whisper_model", "base")

    if engine == "gemini":
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set for --tts-engine gemini (set env var, .env, or --gemini-api-key)")
        return synth_gemini_chunk(
            item, sr, tmp_dir, idx, api_key=api_key,
            model=getattr(args, "gemini_model", "gemini-2.5-flash-preview-tts"),
            voice_name=getattr(args, "gemini_voice", "Charon"),
            cache_dir=cache_dir,
            aligner_mode=aligner_mode,
            whisper_model=whisper_model,
        )

    if engine == "vieneu" or (engine == "auto" and _has_vieneu()):
        if engine == "vieneu" and not _has_vieneu():
            raise RuntimeError(
                "VieNeu-TTS is not installed for default --tts-engine vieneu. "
                "Install `vieneu` (free 48kHz local ONNX), or run with `--tts-engine edge` or `--import-voice <clean.wav>`."
            )
        try:
            return synth_vieneu_chunk(item, sr, args, cache_dir=cache_dir, tmp_dir=tmp_dir)
        except Exception as exc:
            if engine == "vieneu":
                raise
            print(f"  [WARN] VieNeu-TTS fallback -> edge on act #{idx}: {exc}")

    return synth_edge_chunk(
        item, sr, tmp_dir, idx,
        base_speed_scale=getattr(args, "speed_scale", 1.0),
        cache_dir=cache_dir,
        enable_legacy_tempo_dsp=bool(getattr(args, "enable_legacy_tempo_dsp", False)),
    )


# ---------------- External Audio Ingestion, GPU Voice Pack & 1-File So-VITS-SVC VC-Pack ----------------

def split_audio_vad(samples: np.ndarray, sr: int, target_count: int) -> list:
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


def find_act_clip(folder: str, idx_1based: int) -> str:
    exts = (".wav", ".mp3", ".flac", ".m4a", ".ogg")
    stems = (
        f"act_{idx_1based:02d}",
        f"N{idx_1based:02d}",
        f"n{idx_1based:02d}",
        f"{idx_1based:02d}",
        f"S{idx_1based:02d}",
        str(idx_1based),
    )
    for st_name in stems:
        for ext in exts:
            p = os.path.join(folder, st_name + ext)
            if os.path.isfile(p):
                return p
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(exts))
    if 1 <= idx_1based <= len(files):
        return os.path.join(folder, files[idx_1based - 1])
    raise FileNotFoundError(f"Clip #{idx_1based} not found in {folder} (expected act_{idx_1based:02d}.wav or N{idx_1based:02d}.wav)")


def export_narrator_script(items: list, out_path: str):
    """Export coherent Act-level cue sheet (`N01 [mood]: ...`) for external recording or GPU TTS."""
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    lines = ["# NARRATOR ACT CUE SHEET (Horror Engine v6.0 — Act-Level Coherent)", "# Xuất act_01.wav / N01.wav theo từng hồi dưới đây:", ""]
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
    print(f"EXPORTED NARRATOR CUES ({n_idx} acts) -> {out_path}")


def export_gpu_voice_pack(items: list, out_dir: str, args):
    """Export 1-command GPU Open-Source Acting Pack (`IndexTTS-2 Vietnamese` 8-D emotions + `F5-TTS-Vietnamese` + optional So-VITS-SVC)."""
    os.makedirs(out_dir, exist_ok=True)
    acts = []
    a_idx = 0
    for idx, it in enumerate(items):
        if it["kind"] != "speech":
            continue
        a_idx += 1
        mood = it["mood"]
        prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
        acts.append({
            "act_idx": a_idx,
            "item_idx": idx,
            "file": f"act_{a_idx:02d}.wav",
            "speaker": it["speaker"],
            "is_narrator": it["is_narrator"],
            "mood": mood,
            "fx": it["fx"],
            "indextts2_emo_vector": prof["indextts2_emo"],
            "emo_ref_clip": f"refs/{prof['ref_key']}.wav",
            "acting_prompt": it.get("acting") or prof["acting_prompt"],
            "text": it["text"],
            "tts_text": it["tts_text"],
        })

    acts_json = os.path.join(out_dir, "acts.json")
    with open(acts_json, "w", encoding="utf-8") as fp:
        json.dump(
            {
                "version": "v6.0-gpu-voice-pack",
                "emo_vector_labels": ["happy", "angry", "sad", "afraid", "disgusted", "melancholic", "surprised", "calm"],
                "acts": acts,
            },
            fp,
            ensure_ascii=False,
            indent=2,
        )

    # 1. IndexTTS-2 Vietnamese runner (`dinhthuan/index-tts-2-vietnamese`)
    idx2_py = '''#!/usr/bin/env python3
"""Run on your GPU PC with `dinhthuan/index-tts-2-vietnamese` (`iamdinhthuan/index-tts-finetune-vietnamese`):
  1. Place a clean 6-12s narrator voice sample at `narrator_voice.wav` (and optional `refs/*.wav` emotional clips).
  2. Run: python3 run_indextts2_vi.py --checkpoints /path/to/index-tts-2-vietnamese --speaker narrator_voice.wav
  3. Copy `rendered_acts/` back -> `python3 scripts/gen_horror_voice.py --script SCRIPT.md --import-acts rendered_acts --out-dir out/<p>/voice`
"""
import argparse, json, os

ap = argparse.ArgumentParser()
ap.add_argument("--checkpoints", required=True, help="Directory containing config.yaml and dinhthuan/index-tts-2-vietnamese checkpoints")
ap.add_argument("--speaker", required=True, help="Clean 6-12s narrator voice WAV (timbre reference)")
ap.add_argument("--emo-alpha", type=float, default=0.78, help="Emotion vector intensity (0.0..1.0)")
ap.add_argument("--out-dir", default="rendered_acts")
args = ap.parse_args()

from indextts.infer_indextts2 import IndexTTS2

HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(args.out_dir, exist_ok=True)
with open(os.path.join(HERE, "acts.json"), encoding="utf-8") as fp:
    acts = json.load(fp)["acts"]

tts = IndexTTS2(
    cfg_path=os.path.join(args.checkpoints, "config.yaml"),
    model_dir=args.checkpoints,
    is_fp16=True,
    use_cuda_kernel=False,
)

for act in acts:
    out_wav = os.path.join(args.out_dir, act["file"])
    emo_ref = os.path.join(HERE, act["emo_ref_clip"])
    kw = {"spk_audio_prompt": args.speaker, "text": act["tts_text"], "output_path": out_wav, "verbose": True}
    if os.path.isfile(emo_ref):
        kw["emo_audio_prompt"] = emo_ref
        kw["emo_alpha"] = args.emo_alpha
    else:
        kw["emo_vector"] = act["indextts2_emo_vector"]
        kw["emo_alpha"] = args.emo_alpha
    print(f"[IndexTTS-2] Act {act['act_idx']:02d} [{act['mood']}] -> {out_wav}")
    tts.infer(**kw)

print(f"DONE -> {args.out_dir} ({len(acts)} clean emotional acts ready for --import-acts)")
'''
    with open(os.path.join(out_dir, "run_indextts2_vi.py"), "w", encoding="utf-8") as fp:
        fp.write(idx2_py)

    # 2. F5-TTS-Vietnamese runner (`nguyenthienhy/F5-TTS-Vietnamese`)
    f5_py = '''#!/usr/bin/env python3
"""Run on your GPU PC with `F5-TTS-Vietnamese`:
  Place 4-8s emotional reference clips in `refs/` (`calm.wav`, `curious.wav`, `whisper.wav`, `fear.wav`, `panic.wav`, `cold_twist.wav`)
  alongside matching `.txt` transcripts (`calm.txt`, `fear.txt`...), then run:
  python3 run_f5tts_vi.py --ckpt /path/to/model_last.pt --vocab /path/to/vocab.txt --default-ref refs/calm.wav --default-ref-text "..."
"""
import argparse, json, os, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", required=True)
ap.add_argument("--vocab", required=True)
ap.add_argument("--default-ref", required=True)
ap.add_argument("--default-ref-text", default="")
ap.add_argument("--out-dir", default="rendered_acts")
args = ap.parse_args()

HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(args.out_dir, exist_ok=True)
with open(os.path.join(HERE, "acts.json"), encoding="utf-8") as fp:
    acts = json.load(fp)["acts"]

for act in acts:
    ref_wav = os.path.join(HERE, act["emo_ref_clip"])
    ref_txt_p = os.path.splitext(ref_wav)[0] + ".txt"
    if not os.path.isfile(ref_wav):
        ref_wav = args.default_ref
        ref_txt = args.default_ref_text
    else:
        ref_txt = open(ref_txt_p, encoding="utf-8").read().strip() if os.path.isfile(ref_txt_p) else args.default_ref_text
    subprocess.run(
        [
            "f5-tts_infer-cli",
            "--model", "F5TTS_Base",
            "--ckpt_file", args.ckpt,
            "--vocab_file", args.vocab,
            "--ref_audio", ref_wav,
            "--ref_text", ref_txt,
            "--gen_text", act["tts_text"],
            "--output_dir", args.out_dir,
            "--output_file", act["file"],
        ],
        check=True,
    )
print(f"DONE -> {args.out_dir}")
'''
    with open(os.path.join(out_dir, "run_f5tts_vi.py"), "w", encoding="utf-8") as fp:
        fp.write(f5_py)

    print(f"GPU VOICE PACK READY -> {out_dir} ({len(acts)} coherent acts for IndexTTS-2 Vietnamese / F5-TTS-Vietnamese)")
    return acts_json


def export_vc_pack(items: list, out_dir: str, tmp_dir: str, args, synth_fn=None):
    """Build clean 1-File So-VITS-SVC VC-Pack (`narrator_guide_44k.wav` + `vc_pack_manifest.json` + `-na` helper scripts).
    100% distortion-free whole-act guide so So-VITS-SVC (`-na`) converts cleanly with full natural rhythm & F0!"""
    os.makedirs(out_dir, exist_ok=True)
    pad_samples = int(round(VC_PACK_PAD_SEC * SR_VC))
    cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(out_dir)), ".tts_cache")

    guide_parts = []
    manifest_segs = []
    cursor = 0
    n_idx = 0

    narrator_items = [i for i, it in enumerate(items) if it["kind"] == "speech" and it["is_narrator"]]
    human_chunks = {}
    if getattr(args, "human_guide", None):
        raw_h = load_audio_mono(args.human_guide, SR_VC)
        raw_h = _hp(raw_h, 55.0, SR_VC, order=2)
        h_parts = split_audio_vad(raw_h, SR_VC, len(narrator_items))
        for item_idx, seg_h in zip(narrator_items, h_parts):
            seg_h = trim_silence(seg_h, SR_VC, pad_s=0.03)
            it = items[item_idx]
            human_chunks[item_idx] = (seg_h, estimate_syllable_words(it["text"], len(seg_h) / float(SR_VC), 0.0, it["speaker"], it["mood"]))

    for idx, it in enumerate(items):
        if it["kind"] != "speech" or not it["is_narrator"]:
            continue
        n_idx += 1
        if idx in human_chunks:
            seg, rel_words = human_chunks[idx]
        else:
            seg, rel_words = synth_line_auto(it, SR_VC, tmp_dir, idx, args, cache_dir=cache_dir, synth_fn=synth_fn)
        seg = normalize_rms(_hp(seg, 45.0, SR_VC, order=2), target_dbfs=-19.0)
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
        raise ValueError("No [NARRATOR] acts found in script to export VC pack")

    guide = np.concatenate(guide_parts)
    guide_wav = os.path.join(out_dir, "narrator_guide_44k.wav")
    write_wav_mono16(guide_wav, guide, SR_VC)

    mf = {
        "version": "v6.0-vc-pack",
        "sr": SR_VC,
        "total_samples": len(guide),
        "pad_sec": VC_PACK_PAD_SEC,
        "segments": manifest_segs,
    }
    mf_path = os.path.join(out_dir, "vc_pack_manifest.json")
    with open(mf_path, "w", encoding="utf-8") as fp:
        json.dump(mf, fp, ensure_ascii=False, indent=2)

    bat = (
        "@echo off\r\n"
        "REM Chay tren may So-VITS-SVC: Dung -na (--no-auto-predict-f0) de giu nguyen ngu dieu & nhip do tu nhien!\r\n"
        f'"{os.path.join(args.vc_venv, "Scripts", "svc.exe")}" infer narrator_guide_44k.wav -o narrator_svc_out.wav '
        f'-s {args.speaker} -m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\r\n"
    )
    sh = (
        "#!/usr/bin/env bash\n"
        "# Run on So-VITS-SVC machine with -na (--no-auto-predict-f0) to preserve natural prosody & rhythm!\n"
        f'svc infer narrator_guide_44k.wav -o narrator_svc_out.wav -s "{args.speaker}" '
        f'-m "{args.vc_model}" -c "{args.vc_config}" -fm {args.f0_method} -na -t {args.transpose} '
        f"-n {args.noise_scale} -p {args.pad_seconds} -mc {args.max_chunk_seconds}\n"
    )
    with open(os.path.join(out_dir, "run_svc_win.bat"), "w", encoding="utf-8") as fp:
        fp.write(bat)
    with open(os.path.join(out_dir, "run_svc_unix.sh"), "w", encoding="utf-8") as fp:
        fp.write(sh)

    print(f"VC PACK READY -> {guide_wav} ({len(guide) / SR_VC:.2f}s, {n_idx} clean coherent acts)")
    return guide_wav, mf_path


def run_local_svc(in_wav: str, out_wav: str, args):
    svc_bin = os.path.join(args.vc_venv, "Scripts", "svc.exe") if os.name == "nt" else os.path.join(args.vc_venv, "bin", "svc")
    if not os.path.isfile(svc_bin):
        raise FileNotFoundError(f"svc executable not found at {svc_bin}")
    if not os.path.isfile(args.vc_model) or not os.path.isfile(args.vc_config):
        raise FileNotFoundError(f"Missing VC model/config: {args.vc_model} / {args.vc_config}")

    vc_env = os.environ.copy()
    vc_env["HF_HOME"] = os.path.join(args.vc_cache_root, "cache", "hf")
    vc_env["TORCH_HOME"] = os.path.join(args.vc_cache_root, "cache", "torch")
    vc_env["XDG_CACHE_HOME"] = os.path.join(args.vc_cache_root, "cache", "xdg")
    vc_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"
    cmd = [
        svc_bin, "infer", in_wav, "-o", out_wav,
        "-s", args.speaker, "-m", args.vc_model, "-c", args.vc_config,
        "-fm", args.f0_method, "-n", str(args.noise_scale),
        "-p", str(args.pad_seconds), "-mc", str(args.max_chunk_seconds),
    ]
    if args.auto_predict_f0:
        cmd.append("-a")
    else:
        cmd.extend(["-na", "-t", str(args.transpose)])
    subprocess.run(cmd, env=vc_env, check=True)


def _assemble_imported_voice(items: list, args):
    """v15.0: Ingest ONE single real-recorded / RVC clean WAV (`--import-voice`) with 0% tempo/pitch DSP + Whisper forced alignment."""
    src_path = args.import_voice
    if not os.path.isfile(src_path):
        raise FileNotFoundError(f"Imported voice file not found: {src_path}")
    aligner_mode = getattr(args, "word_aligner", "auto")
    whisper_model = getattr(args, "whisper_model", "base")

    raw_48k = load_audio_mono(src_path, SR_FINAL)
    clean_48k = _hp(raw_48k, 45.0, SR_FINAL, order=2)
    clean_48k = normalize_rms(clean_48k, target_dbfs=-19.0, max_peak=0.92)
    pk = float(np.max(np.abs(clean_48k)))
    if pk > 0.94:
        clean_48k *= 0.94 / pk

    speech_items = [it for it in items if it["kind"] == "speech"]
    token_meta = []
    full_tokens = []
    for act_idx, it in enumerate(speech_items, 1):
        for tok in it["text"].split():
            if tok.strip():
                full_tokens.append(tok)
                token_meta.append((act_idx, it["speaker"], it["mood"], it["fx"], it.get("prox", "normal"), it.get("vieneu_voice")))

    full_text = " ".join(full_tokens)
    aligned, used_mode = align_audio_words_v11(
        full_text, clean_48k, SR_FINAL, 0.0,
        "NARRATOR", "calm_omen",
        aligner_mode=aligner_mode, whisper_model=whisper_model,
    )

    all_words = []
    by_act: dict[int, list[dict]] = {}
    for w_obj, meta in zip(aligned, token_meta):
        act_idx, spk, mood, fx, prox, vv = meta
        entry = {
            "w": w_obj["w"],
            "s": round(float(w_obj["s"]), 4),
            "e": round(float(w_obj["e"]), 4),
            "speaker": spk,
            "mood": mood,
            "prox": prox,
        }
        all_words.append(entry)
        by_act.setdefault(act_idx, []).append(entry)

    sentences = []
    for act_idx, it in enumerate(speech_items, 1):
        aw = by_act.get(act_idx) or []
        if not aw:
            continue
        s_dur = max(0.05, aw[-1]["e"] - aw[0]["s"])
        sentences.append({
            "sent": act_idx,
            "speaker": it["speaker"],
            "mood": it["mood"],
            "fx": it["fx"],
            "prox": it.get("prox", "normal"),
            "vieneu_voice": it.get("vieneu_voice"),
            "s": aw[0]["s"],
            "e": aw[-1]["e"],
            "wps": round(len(aw) / s_dur, 2),
            "text": it["text"],
        })

    # Map script silence_drops / dead_silences onto real inter-act gaps in the recording
    dead_silences = []
    silence_drops = []
    visual_beats = []
    speech_seen = 0
    for it in items:
        if it["kind"] == "speech":
            speech_seen += 1
        elif it["kind"] in ("dead_silence", "silence_drop", "visual"):
            prev_end = by_act[speech_seen][-1]["e"] if speech_seen in by_act and by_act[speech_seen] else 0.0
            next_start = by_act[speech_seen + 1][0]["s"] if (speech_seen + 1) in by_act and by_act[speech_seen + 1] else min(len(clean_48k) / float(SR_FINAL), prev_end + float(it["dur"]))
            if next_start <= prev_end + 0.05:
                next_start = min(len(clean_48k) / float(SR_FINAL), prev_end + float(it["dur"]))
            rec = {"s": round(prev_end, 4), "e": round(next_start, 4), "dur": round(max(0.0, next_start - prev_end), 4)}
            if it["kind"] == "dead_silence":
                dead_silences.append({"s": rec["s"], "e": rec["e"]})
            elif it["kind"] == "silence_drop":
                silence_drops.append(rec)
            else:
                visual_beats.append(rec)

    os.makedirs(args.out_dir, exist_ok=True)
    final_wav = os.path.join(args.out_dir, args.out_wav)
    write_wav_mono16(final_wav, clean_48k, SR_FINAL)

    final_dur = len(clean_48k) / float(SR_FINAL)
    total_frames = int(math.ceil((final_dur + 0.35) * args.fps))
    rms_env = extract_rms_envelope_30fps(clean_48k, SR_FINAL, fps=args.fps)
    wps = round(len(all_words) / max(0.1, final_dur), 2)

    payload = {
        "engine": "horror-voice-v15",
        "version": "15.0.0",
        "voice": os.path.basename(src_path),
        "narrator_source": "imported_voice_clean",
        "dsp_tempo_pitch_enabled": False,
        "alignment_mode": used_mode,
        "dur": round(final_dur, 4),
        "fps": args.fps,
        "total_frames": total_frames,
        "words_per_sec": wps,
        "spoken_words_per_sec": wps,
        "visual_breathing_ratio": round(sum(x["e"] - x["s"] for x in dead_silences + silence_drops + visual_beats) / max(0.1, final_dur), 3),
        "rms_threshold": 0.08,
        "rms_envelope_30fps": rms_env,
        "words": all_words,
        "sentences": sentences,
        "dead_silences": dead_silences,
        "silence_drops": silence_drops,
        "visual_beats": visual_beats,
    }
    words_json = os.path.join(args.out_dir, "words.json")
    with open(words_json, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)

    if args.words_ts:
        os.makedirs(os.path.dirname(os.path.abspath(args.words_ts)), exist_ok=True)
        with open(args.words_ts, "w", encoding="utf-8") as fp:
            fp.write("// Auto-generated by scripts/gen_horror_voice.py (v15.0 Clean Studio Voice + RMS Envelope)\n")
            fp.write(f"export const VOICE_DUR = {round(final_dur, 4)};\n")
            fp.write(f"export const TOTAL_FRAMES = {total_frames};\n")
            fp.write("export type WordTiming = { w: string; s: number; e: number; speaker?: string; mood?: string; prox?: string };\n")
            fp.write("export const WORDS: WordTiming[] = " + json.dumps(all_words, ensure_ascii=False) + ";\n")
            fp.write("export const RMS_ENVELOPE: number[] = " + json.dumps(rms_env) + ";\n")

    print(f"VOICE IMPORT OK -> {final_wav} ({final_dur:.3f}s, {total_frames}f @ {args.fps}fps, {len(all_words)} words, aligner={used_mode}, 0% tempo/pitch DSP)")
    return final_wav, words_json, payload


def assemble_voice(items: list, args, tmp_dir: str, synth_fn=None):
    """Assemble studio-clean 48 kHz mono `voice.wav` + `words.json` (with 30fps RMS envelope & 0% tempo/pitch DSP by default)."""
    if getattr(args, "import_voice", None):
        return _assemble_imported_voice(items, args)
    cache_dir = getattr(args, "tts_cache", None) or os.path.join(os.path.dirname(os.path.abspath(args.out_dir)), ".tts_cache")
    speech_indices = [i for i, it in enumerate(items) if it["kind"] == "speech"]
    narrator_indices = [i for i in speech_indices if items[i]["is_narrator"]]
    preloaded_clips = {}

    aligner_mode = getattr(args, "word_aligner", "auto")
    whisper_model = getattr(args, "whisper_model", "base")

    if getattr(args, "import_acts", None):
        for a_idx, item_idx in enumerate(speech_indices, 1):
            it = items[item_idx]
            p = find_act_clip(args.import_acts, a_idx)
            clip = trim_silence(load_audio_mono(p, SR_FINAL), SR_FINAL, pad_s=0.025)
            rel_w, _ = align_audio_words_v11(it["text"], clip, SR_FINAL, 0.0, it["speaker"], it["mood"], aligner_mode=aligner_mode, whisper_model=whisper_model)
            preloaded_clips[item_idx] = (clip, rel_w)
    elif args.vc_pack and args.narrator_vc_wav:
        mf_path = os.path.join(args.vc_pack, "vc_pack_manifest.json")
        with open(mf_path, encoding="utf-8") as fp:
            mf = json.load(fp)
        vc_full = load_audio_mono(args.narrator_vc_wav, SR_VC)
        n_target = int(mf["total_samples"])
        vc_full = vc_full[:n_target] if len(vc_full) >= n_target else np.pad(vc_full, (0, n_target - len(vc_full)))
        for seg in mf["segments"]:
            clip_44 = vc_full[int(seg["start_sample"]) : int(seg["end_sample"])].copy()
            preloaded_clips[int(seg["item_idx"])] = (resample_mono(clip_44, SR_VC, SR_FINAL), seg.get("words") or [])
    elif args.narrator_dir:
        for n_idx, item_idx in enumerate(narrator_indices, 1):
            it = items[item_idx]
            p = find_act_clip(args.narrator_dir, n_idx)
            clip = trim_silence(load_audio_mono(p, SR_FINAL), SR_FINAL, pad_s=0.025)
            rel_w, _ = align_audio_words_v11(it["text"], clip, SR_FINAL, 0.0, it["speaker"], it["mood"], aligner_mode=aligner_mode, whisper_model=whisper_model)
            preloaded_clips[item_idx] = (clip, rel_w)
    elif getattr(args, "human_guide", None):
        raw_full = _hp(load_audio_mono(args.human_guide, SR_FINAL), 55.0, SR_FINAL, order=2)
        chunks = split_audio_vad(raw_full, SR_FINAL, len(narrator_indices))
        for item_idx, clip in zip(narrator_indices, chunks):
            it = items[item_idx]
            clip = trim_silence(clip, SR_FINAL, pad_s=0.025)
            rel_w, _ = align_audio_words_v11(it["text"], clip, SR_FINAL, 0.0, it["speaker"], it["mood"], aligner_mode=aligner_mode, whisper_model=whisper_model)
            preloaded_clips[item_idx] = (clip, rel_w)
    elif args.narrator_audio:
        raw_full = load_audio_mono(args.narrator_audio, SR_FINAL)
        chunks = split_audio_vad(raw_full, SR_FINAL, len(narrator_indices))
        for item_idx, clip in zip(narrator_indices, chunks):
            it = items[item_idx]
            clip = trim_silence(clip, SR_FINAL, pad_s=0.025)
            rel_w, _ = align_audio_words_v11(it["text"], clip, SR_FINAL, 0.0, it["speaker"], it["mood"], aligner_mode=aligner_mode, whisper_model=whisper_model)
            preloaded_clips[item_idx] = (clip, rel_w)

    use_local_vc = (not preloaded_clips) and (not args.no_vc) and os.path.isfile(args.vc_model)
    if use_local_vc and narrator_indices:
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
            clip_44 = vc_full[int(seg["start_sample"]) : int(seg["end_sample"])].copy()
            preloaded_clips[int(seg["item_idx"])] = (resample_mono(clip_44, SR_VC, SR_FINAL), seg.get("words") or [])

    timeline = []
    all_words = []
    sentences = []
    dead_silences = []
    silence_drops = []
    visual_beats = []
    pause_total_s = 0.0
    alignment_modes_used = set()
    cur_sec = 0.0

    if args.lead_silence > 0:
        n_lead = int(round(args.lead_silence * SR_FINAL))
        timeline.append(np.zeros(n_lead, dtype=np.float64))
        cur_sec += n_lead / float(SR_FINAL)

    act_num = 0
    for idx, it in enumerate(items):
        if it["kind"] in ("pause", "beat_pause", "visual", "silence_drop", "dead_silence"):
            n_sil = int(round(it["dur"] * SR_FINAL))
            sil_s = cur_sec
            sil_e = cur_sec + n_sil / float(SR_FINAL)
            timeline.append(np.zeros(n_sil, dtype=np.float64))
            if it["kind"] == "dead_silence":
                dead_silences.append({"s": round(sil_s, 4), "e": round(sil_e, 4)})
            elif it["kind"] == "silence_drop":
                silence_drops.append({"s": round(sil_s, 4), "e": round(sil_e, 4), "dur": round(sil_e - sil_s, 4)})
                pause_total_s += (sil_e - sil_s)
            elif it["kind"] == "visual":
                visual_beats.append({"s": round(sil_s, 4), "e": round(sil_e, 4), "dur": round(sil_e - sil_s, 4)})
                pause_total_s += (sil_e - sil_s)
            else:
                pause_total_s += (sil_e - sil_s)
            cur_sec = sil_e
            continue

        mood = it["mood"]
        prof = MOOD_PROFILES.get(mood, MOOD_PROFILES["calm_omen"])
        if idx in preloaded_clips:
            raw_seg, rel_words = preloaded_clips[idx]
        else:
            raw_seg, rel_words = synth_line_auto(it, SR_FINAL, tmp_dir, idx, args, cache_dir=cache_dir, synth_fn=synth_fn)

        # v15.0: Clause-level tempo/pitch stretching is OFF by default (`--enable-legacy-tempo-dsp` required to opt in)
        if bool(getattr(args, "enable_legacy_tempo_dsp", False)) and not it.get("_clause_shaped_in_synth") and not getattr(args, "no_tempo_trim", False):
            c_pace = float(it["clause_pace"]) if it.get("clause_pace") is not None else 1.0
            c_pst = float(it.get("clause_pitch_st") or 0.0)
            if abs(c_pace - 1.0) >= 0.02 or abs(c_pst) >= 0.08:
                old_dur = max(0.05, len(raw_seg) / float(SR_FINAL))
                raw_seg = apply_clean_tempo(raw_seg, SR_FINAL, c_pace, tmp_dir=tmp_dir, pitch_st=c_pst)
                new_dur = max(0.05, len(raw_seg) / float(SR_FINAL))
                if rel_words:
                    ratio_t = new_dur / old_dur
                    rel_words = [
                        {**rw, "s": round(float(rw["s"]) * ratio_t, 4), "e": round(float(rw["e"]) * ratio_t, 4)}
                        for rw in rel_words
                    ]

        prox = str(it.get("prox") or "normal").lower()
        target_rms = float(prof.get("target_rms_dbfs", -19.0))
        if prox in ("close", "close_ear") and mood != "whisper":
            target_rms -= 2.2
        elif prox == "distant":
            target_rms -= 3.5

        seg = normalize_rms(raw_seg, target_dbfs=target_rms)
        seg = apply_voice_fx(seg, SR_FINAL, fx=it["fx"], mood=mood, prox=prox)
        if float(prof.get("gain_db", 0.0)) != 0.0:
            seg = seg * (10.0 ** (float(prof["gain_db"]) / 20.0))

        fx_pre_s = 0.22 if it["fx"] == "ghost" else 0.0
        seg_start = cur_sec
        timeline.append(seg)
        cur_sec += len(seg) / float(SR_FINAL)

        if not rel_words:
            rel_words, u_mode = align_audio_words_v11(
                it["text"], raw_seg, SR_FINAL, 0.0, it["speaker"], mood,
                aligner_mode=aligner_mode, whisper_model=whisper_model,
            )
            alignment_modes_used.add(u_mode)
        else:
            alignment_modes_used.add("whisper_or_acoustic" if aligner_mode != "proportional" else "proportional")

        act_words = []
        for rw in rel_words:
            w_obj = {
                "w": rw["w"],
                "s": round(seg_start + fx_pre_s + float(rw["s"]), 4),
                "e": round(seg_start + fx_pre_s + float(rw["e"]), 4),
                "speaker": it["speaker"],
                "mood": mood,
                "prox": prox,
            }
            all_words.append(w_obj)
            act_words.append(w_obj)

        act_num += 1
        if act_words:
            s_dur = max(0.05, act_words[-1]["e"] - act_words[0]["s"])
            sentences.append({
                "sent": act_num,
                "speaker": it["speaker"],
                "mood": mood,
                "fx": it["fx"],
                "prox": prox,
                "vieneu_voice": it.get("vieneu_voice"),
                "s": act_words[0]["s"],
                "e": act_words[-1]["e"],
                "wps": round(len(act_words) / s_dur, 2),
                "text": it["text"],
            })

        next_it = items[idx + 1] if idx + 1 < len(items) else None
        if next_it and next_it["kind"] == "speech":
            gap_s = float(prof["tail_pad"]) + (0.10 if next_it["speaker"] != it["speaker"] else 0.0)
            n_gap = int(round(gap_s * SR_FINAL))
            timeline.append(np.zeros(n_gap, dtype=np.float64))
            cur_sec += n_gap / float(SR_FINAL)
            pause_total_s += gap_s

    if args.tail_silence > 0:
        n_tail = int(round(args.tail_silence * SR_FINAL))
        timeline.append(np.zeros(n_tail, dtype=np.float64))
        cur_sec += n_tail / float(SR_FINAL)

    full_48k = np.concatenate(timeline) if timeline else np.zeros(SR_FINAL, dtype=np.float64)
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
    spoken_dur_only = max(0.1, final_dur - ds_total - pause_total_s)
    spoken_wps = round(len(all_words) / spoken_dur_only, 2)
    visual_ratio = round((pause_total_s + ds_total) / max(0.1, final_dur), 3)

    eng_choice = str(getattr(args, "tts_engine", "vieneu") or "vieneu").strip().lower()
    if getattr(args, "import_acts", None):
        src_label = "gpu_acts_imported"
    elif args.vc_pack and args.narrator_vc_wav:
        src_label = "vc_pack_external"
    elif args.narrator_dir:
        src_label = "narrator_dir"
    elif getattr(args, "human_guide", None):
        src_label = "human_voice_guide"
    elif args.narrator_audio:
        src_label = "narrator_audio"
    elif use_local_vc:
        src_label = "local_svc"
    elif eng_choice == "gemini" and synth_fn is None:
        src_label = "gemini_tts"
    elif (eng_choice == "vieneu" or (eng_choice == "auto" and _has_vieneu())) and synth_fn is None:
        src_label = f"vieneu_{getattr(args, 'vieneu_mode', 'v3turbo')}_48k"
    else:
        src_label = "edge_tts_clean"

    rms_env = extract_rms_envelope_30fps(full_48k, SR_FINAL, fps=args.fps)

    payload = {
        "engine": "horror-voice-v6",
        "version": "15.0.0",
        "voice": getattr(args, "vieneu_voice", None) or args.base_voice,
        "narrator_source": src_label,
        "dsp_tempo_pitch_enabled": bool(getattr(args, "enable_legacy_tempo_dsp", False)),
        "alignment_mode": getattr(args, "word_aligner", "auto"),
        "dur": round(final_dur, 4),
        "fps": args.fps,
        "total_frames": total_frames,
        "words_per_sec": wps,
        "spoken_words_per_sec": spoken_wps,
        "visual_breathing_ratio": visual_ratio,
        "rms_threshold": 0.08,
        "rms_envelope_30fps": rms_env,
        "words": all_words,
        "sentences": sentences,
        "dead_silences": dead_silences,
        "silence_drops": silence_drops,
        "visual_beats": visual_beats,
    }
    words_json = os.path.join(args.out_dir, "words.json")
    with open(words_json, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=2)

    if args.words_ts:
        os.makedirs(os.path.dirname(os.path.abspath(args.words_ts)), exist_ok=True)
        with open(args.words_ts, "w", encoding="utf-8") as fp:
            fp.write("// Auto-generated by scripts/gen_horror_voice.py (v15.0 Clean Studio Voice + RMS Envelope + Forced Word Alignment)\n")
            fp.write(f"export const VOICE_DUR = {round(final_dur, 4)};\n")
            fp.write(f"export const TOTAL_FRAMES = {total_frames};\n")
            fp.write("export type WordTiming = { w: string; s: number; e: number; speaker?: string; mood?: string; prox?: string };\n")
            fp.write("export const WORDS: WordTiming[] = " + json.dumps(all_words, ensure_ascii=False) + ";\n")
            fp.write("export const RMS_ENVELOPE: number[] = " + json.dumps(rms_env) + ";\n")

    first_word_s = float(all_words[0]["s"]) if all_words else 0.0
    print(f"VOICE OK -> {final_wav} ({final_dur:.3f}s, {total_frames}f @ {args.fps}fps, {len(all_words)} words, {wps:.2f} w/s effective [{spoken_wps:.2f} spoken], first_word={first_word_s:.2f}s, visual_ratio={visual_ratio:.2f}, src={src_label})")
    eff_max_wps = 2.85
    spoken_max_wps = 3.25
    try:
        import constitution as _const_mod
        _sp_cfg = (_const_mod.load_constitution().get("speech") or {})
        eff_max_wps = float(_sp_cfg.get("wordsPerSecondMax", eff_max_wps))
        spoken_max_wps = float(_sp_cfg.get("spokenWordsPerSecondMax", spoken_max_wps))
    except Exception:
        pass
    if wps > eff_max_wps:
        print(f"  [PACING WARN] Effective speech density {wps:.2f} w/s > {eff_max_wps:.2f} w/s — add natural punctuation pauses or [VISUAL Xs] / [BEAT Xs] breathing in SCRIPT.md!")
    if spoken_wps > spoken_max_wps:
        print(f"  [CADENCE WARN] Spoken speed {spoken_wps:.2f} w/s > {spoken_max_wps:.2f} w/s — split long run-on clauses or add clean [BEAT Xs] pauses (never distort with [PACE=slow])!")
    if getattr(args, "strict_hook", False) and all_words and first_word_s > 0.45:
        print(f"  [HOOK WARN] First spoken word starts at {first_word_s:.2f}s > 0.45s — cut opening dead air so the 1-5s Cold Hook hits immediately!")
    for sb in sentences:
        print(f"  Act {sb['sent']:02d} [{sb['speaker']}({sb.get('vieneu_voice') or '-'}) · {sb['mood']}/{sb['fx']}/{sb['prox']} · {sb['wps']:4.2f}w/s] [{sb['s']:6.2f}s..{sb['e']:6.2f}s] {sb['text'][:58]}")
    for vb in visual_beats:
        print(f"  VISUAL_BEAT  [{vb['s']:6.2f}s..{vb['e']:6.2f}s] ({vb['dur']:.2f}s ambient/Foley breathing)")
    for sd in silence_drops:
        print(f"  SILENCE_DROP [{sd['s']:6.2f}s..{sd['e']:6.2f}s] ({sd['dur']:.2f}s uncanny hush)")
    for ds in dead_silences:
        print(f"  DEAD_SILENCE [{ds['s']:6.2f}s..{ds['e']:6.2f}s]")
    return final_wav, words_json, payload


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v15.3 Clean 1.0x VieNeu-TTS & Studio Voice Pipeline.")
    ap.add_argument("--script", required=True, help="Path to horror SCRIPT.md / .txt")
    ap.add_argument("--out-dir", default="out/voice", help="Output directory for voice.wav and words.json")
    ap.add_argument("--tts-engine", default="vieneu", choices=["vieneu", "auto", "edge", "gemini"], help="Neural TTS backend (default: vieneu 1.0x clean free local 48kHz; auto -> vieneu else edge; gemini only when explicitly requested)")
    ap.add_argument("--vieneu-mode", default="v3turbo", choices=["v3turbo", "v3nano"], help="VieNeu-TTS ONNX CPU model (v3turbo=48kHz best, v3nano=24kHz fast)")
    ap.add_argument("--vieneu-voice", default="Thiện Minh", help="VieNeu-TTS built-in preset voice name (default: 'Thiện Minh' storytelling voice)")
    ap.add_argument("--ref-audio", default=None, help="Recommended 5-8s clean storytelling voice sample WAV for VieNeu-TTS 1.0x cloning (prioritized over auto emotion_refs; 0%% tempo/pitch DSP)")
    ap.add_argument("--emotion-refs", default=None, help="Optional folder of per-mood 3-8s reference clips (auto-detected at audio/emotion_refs/ if present)")
    ap.add_argument("--narrator-anchor", default=None, help="Optional 5-15s narrator voice clip (or auto audio/narrator_anchor.wav) to lock speaker identity across all emotions")
    ap.add_argument("--speaker-lock", action=argparse.BooleanOptionalAction, default=True, help="Lock narrator speaker_emb to ONE single voice across all emotion_refs acts (default: True)")
    ap.add_argument("--speaker-lock-source", default="auto", choices=["auto", "preset", "calm", "anchor"], help="Single-voice anchor source when --speaker-lock is enabled (default: auto -> narrator_anchor.wav else --vieneu-voice preset)")
    ap.add_argument("--ref-codes-max-frames", type=int, default=84, help="Max MOSS codec ref_codes frames for full Vietnamese tonal cadence transfer under --speaker-lock (default: 84; 0=full)")
    ap.add_argument("--no-auto-refs", action="store_true", help="Disable auto-detection of audio/emotion_refs/")
    ap.add_argument("--no-tempo-trim", action="store_true", help="Compatible no-op (tempo/pitch DSP is already OFF by default in v15.0)")
    ap.add_argument("--enable-legacy-tempo-dsp", action="store_true", help="Opt-in legacy tempo/pitch/F0 DSP stretching & clause splitting (OFF by default in v15.0)")
    ap.add_argument("--import-voice", default=None, help="v15.0: Import ONE real-recorded or RVC clean WAV (0%% tempo/pitch DSP) + Whisper forced alignment + 30fps RMS envelope")
    ap.add_argument("--multi-style-guide", action="store_true", help="Vary built-in VieNeu presets by mood when exporting a So-VITS-SVC VC-Pack guide")
    ap.add_argument("--human-guide", default=None, help="Voice-to-Voice Directing: your own 1-take rough acting recording (.m4a/.wav) for So-VITS-SVC -na or direct assembly")
    ap.add_argument("--base-voice", default="vi-VN-NamMinhNeural", help="Fallback edge-tts voice")
    ap.add_argument("--gemini-model", default="gemini-2.5-flash-preview-tts")
    ap.add_argument("--gemini-voice", default="Charon")
    ap.add_argument("--gemini-api-key", default=None)
    ap.add_argument("--speed-scale", type=float, default=1.0, help="Global speed multiplier for edge fallback")
    ap.add_argument("--lead-silence", type=float, default=0.05, help="Lead silence before first act (s)")
    ap.add_argument("--tail-silence", type=float, default=0.30, help="Trailing silence after last act (s)")
    ap.add_argument("--strict-hook", action="store_true", help="Warn if first spoken word starts after 0.45s")
    ap.add_argument("--fps", type=int, default=30, help="Timeline FPS for total_frames")
    ap.add_argument("--out-wav", default="voice.wav", help="Output WAV filename inside --out-dir")
    ap.add_argument("--tts-cache", default=None, help="Optional disk cache directory for TTS acts")
    ap.add_argument("--words-ts", default=None, help="Optional TypeScript words.ts export path")
    ap.add_argument("--word-aligner", default="auto", choices=["auto", "whisper", "acoustic", "proportional"], help="v11.0 Word timestamp aligner: 'auto' uses faster-whisper forced alignment (<35ms) with acoustic pause-island fallback (<80ms)")
    ap.add_argument("--whisper-model", default="base", help="faster-whisper model name for 1B forced word alignment (default: base)")

    # Local GPU Open-Source Acting Pack (`IndexTTS-2 Vietnamese` / `F5-TTS-Vietnamese`) & 1-File So-VITS-SVC VC-Pack
    ap.add_argument("--export-gpu-voice-pack", default=None, help="Export act-level GPU pack (IndexTTS-2 Vietnamese 8-D emotions + F5-TTS)")
    ap.add_argument("--import-acts", default=None, help="Import rendered act WAVs (act_01.wav, act_02.wav...) from GPU PC")
    ap.add_argument("--export-vc-pack", default=None, help="Step 1: Export clean 1-file narrator_guide_44k.wav + manifest for So-VITS-SVC PC")
    ap.add_argument("--vc-pack", default=None, help="Step 3: VC pack folder produced by --export-vc-pack")
    ap.add_argument("--narrator-vc-wav", default=None, help="Step 3: Converted narrator_svc_out.wav returned from So-VITS-SVC PC")
    ap.add_argument("--export-narrator-script", default=None, help="Export numbered narrator act cue sheet (.txt)")
    ap.add_argument("--narrator-dir", default=None, help="Folder of individual external narrator WAVs (N01.wav, N02.wav...)")
    ap.add_argument("--narrator-audio", default=None, help="Single combined external narrator WAV/MP3 (auto-split via VAD)")

    # Local So-VITS-SVC options (`-na` / --no-auto-predict-f0 default!)
    ap.add_argument("--vc-venv", default="D:/voice-engine/venv")
    ap.add_argument("--vc-model", default="D:/voice-engine/models/ngan/G_1001.pth")
    ap.add_argument("--vc-config", default="D:/voice-engine/models/ngan/config.json")
    ap.add_argument("--vc-cache-root", default="D:/voice-engine")
    ap.add_argument("--speaker", default="ngan")
    ap.add_argument("--f0-method", default="parselmouth", choices=["crepe", "crepe-tiny", "parselmouth", "dio", "harvest", "rmvpe"])
    ap.add_argument("--transpose", type=int, default=-5)
    ap.add_argument("--auto-predict-f0", action=argparse.BooleanOptionalAction, default=False)
    ap.add_argument("--noise-scale", type=float, default=0.30)
    ap.add_argument("--pad-seconds", type=float, default=0.25)
    ap.add_argument("--max-chunk-seconds", type=float, default=20.0)
    ap.add_argument("--no-vc", action="store_true", help="Skip local So-VITS-SVC conversion")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    items = parse_script(
        args.script,
        default_voice=args.base_voice,
        narrator_vieneu=args.vieneu_voice or "Thiện Minh",
        enable_clause_dsp_split=bool(getattr(args, "enable_legacy_tempo_dsp", False)),
    )

    if args.export_narrator_script:
        export_narrator_script(items, args.export_narrator_script)
        return
    if args.export_gpu_voice_pack:
        export_gpu_voice_pack(items, args.export_gpu_voice_pack, args)
        return

    tmp_dir = tempfile.mkdtemp(prefix="hvoice6_")
    try:
        if args.export_vc_pack:
            export_vc_pack(items, args.export_vc_pack, tmp_dir, args)
            return
        assemble_voice(items, args, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
