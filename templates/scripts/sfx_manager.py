#!/usr/bin/env python3
"""Horror Engine v6.0: Asset-First Cinema Horror SFX Manager (100% Free & Open-Source).

Replaces synthetic-sounding procedural Foley with real studio-recorded CC0 Foley (Freesound API / local folders)
and open-source local GPU Neural SFX packs (`declare-lab/TangoFlux` text-to-SFX + `hkchengrex/MMAudio` video-to-audio).

All imported/downloaded assets are normalized cleanly to `48 kHz stereo 24-bit WAV` inside `audio/sfx_library/`
with a tracked `manifest.json` (name, category, license, duration, source) ready for `mix_base.load_sfx_asset(...)`.

Subcommands:
  python3 scripts/sfx_manager.py fetch-freesound --preset horror-starter --library shorts-project/audio/sfx_library
  python3 scripts/sfx_manager.py fetch-freesound --query "wooden door creak horror" --name door_creak --library ...
  python3 scripts/sfx_manager.py import-local --src /path/to/my_sfx_folder --library shorts-project/audio/sfx_library
  python3 scripts/sfx_manager.py export-sfx-pack --cues sfx_cues.json --out-dir out/<project>/gpu_sfx_pack [--video video.mp4]
  python3 scripts/sfx_manager.py list --library shorts-project/audio/sfx_library
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import wave

import numpy as np

SR_LIB = 48000
OPENVERSE_API = "https://api.openverse.org/v1/audio/"
ALLOWED_COMMERCIAL_LICENSES = {"cc0", "pdm", "by", "by-sa"}
CC0_GITHUB_RAW_BASE = "https://raw.githubusercontent.com/lavenderdotpet/CC0-Public-Domain-Sounds/main"

# 25 verified 100% CC0 / Public Domain real-recorded horror Foley & ambience assets (zero API key required, commercial-safe!)
# Tuple: (slug, category, repo_rel_path, vi_desc, highpass_hz, max_dur_sec)
CC0_OPEN_HORROR_PACK = [
    ("wooden_door_creak", "foley", "kenney_rpgaudio/Audio/creak1.ogg", "Cửa gỗ cũ kẽo kẹt chậm", 45.0, 8.0),
    ("floorboard_creak", "foley", "kenney_rpgaudio/Audio/creak2.ogg", "Sàn gỗ / gác xép kêu răng rắc", 45.0, 8.0),
    ("door_open_creak", "foley", "kenney_rpgaudio/Audio/doorOpen_1.ogg", "Cánh cửa gỗ tự hé mở", 45.0, 8.0),
    ("heavy_door_slam", "foley", "100-CC0-SFX/door_close_01.ogg", "Cửa gỗ đóng sập mạnh", 35.0, 6.0),
    ("door_bolt_latch", "foley", "100-CC0-wood-metal-SFX/lock_open_01.ogg", "Chốt sắt / khóa cửa trượt kêu lách cách", 60.0, 6.0),
    ("door_bang_impact", "foley", "25-CC0-bang-sfx/bang_01.ogg", "Cú đập mạnh vào cửa", 30.0, 6.0),
    ("wood_footsteps_slow", "foley", "100-cc0-sfx-2/sfx100v2_footstep_wood_01.ogg", "Bước chân trên sàn gỗ cũ", 45.0, 8.0),
    ("wet_footsteps", "foley", "100-cc0-sfx-2/sfx100v2_footstep_wet_01.ogg", "Bước chân trên vũng nước / ngõ mưa", 50.0, 8.0),
    ("rain_on_roof", "ambience", "30-cc0-sfx-loops/rain.ogg", "Mưa đêm rơi liên tục (lặp mượt)", 60.0, 20.0),
    ("distant_thunder", "ambience", "100-cc0-sfx-2/sfx100v2_thunder_01.ogg", "Sấm rền xa giữa đêm mưa", 25.0, 16.0),
    ("room_tone_dark", "ambience", "bb - Fans and Drones (Jul 2021)/Outside.wav", "Không gian đêm yên ắng tự nhiên", 40.0, 18.0),
    ("wind_howl_night", "ambience", "30-cc0-sfx-loops/ambient_01.ogg", "Gió đêm rít qua khe cửa", 45.0, 18.0),
    ("clock_ticking", "ambience", "bb - Smol Mechanisms (May 2021)/Ratchet Muted 1.wav", "Tiếng tích tắc cơ khí / đồng hồ lúc 01:06", 80.0, 4.0),
    ("insect_flies", "ambience", "80-CC0-creature-SFX/bug_01.ogg", "Tiếng ruồi / côn trùng đêm vo ve", 80.0, 8.0),
    ("glass_break", "foley", "100-cc0-sfx-2/sfx100v2_glass_01.ogg", "Tiếng kính vỡ / va chạm sắc", 60.0, 6.0),
    ("flashlight_click", "foley", "bb - Smol Mechanisms (May 2021)/Click Button 1.wav", "Bấm công tắc đèn pin cơ thật", 70.0, 4.0),
    ("paper_talisman_rustle", "foley", "bb - Books, Paper, Writing (Jan 2021)/Page Turn 1.wav", "Tiếng lá bùa giấy vàng / thư cũ sột soạt", 80.0, 6.0),
    ("knife_metal_scrape", "foley", "kenney_rpgaudio/Audio/drawKnife1.ogg", "Tiếng kim loại rít lạnh sống lưng", 80.0, 6.0),
    ("vhs_static", "analog", "Micro Pack - Record Fuzzies/Classic Record Fuzz.wav", "Nhiễu hạt analog băng VHS / rách băng", 60.0, 12.0),
    ("emf_glitch_buzz", "analog", "Micro Pack - NazdyNate - Electromagnetic Sounds/NazdyNate - EM Room Noise 1.wav", "Nhiễu sóng điện từ / điện thoại lúc ma hiện hình", 60.0, 10.0),
    ("whip_pan_whoosh", "transition", "Micro Pack - Organic Wooshes/Classic Swish 1.wav", "Tiếng vút quay đầu đột ngột (whipPan)", 50.0, 4.0),
    ("breathing_heavy", "vocal_fx", "BB_2HTC Samples Vol 4/Weird/2022-04-16 Triple-C THICCC - Heavy Breathing.wav", "Hơi thở dốc nặng trong bóng tối", 55.0, 12.0),
    ("cello_dread_sting", "tension", "bb - Novice Cello (Nov 2021)/C2 - Sforzando 1.wav", "Tiếng kéo dây Cello C2 trầm rợn thật", 0.0, 10.0),
    ("cinematic_boom", "tension", "BB_2HTC Samples Vol 4/Drums/2022-08-17 Approaching the Crash Site - Boom.wav", "Cú đấm sub-bass điện ảnh sau Dead Silence", 0.0, 8.0),
    ("gong_omen", "tension", "100-CC0-SFX/gong_01.ogg", "Tiếng chiêng / chuông điềm báo kinh dị dân gian", 25.0, 10.0),
]

HORROR_STARTER_PRESETS = [
    ("wooden_door_creak", "wooden door creak slow eerie", "foley"),
    ("heavy_door_slam", "heavy wooden door slam shut", "foley"),
    ("wood_footsteps_slow", "slow footsteps creaking wooden floor", "foley"),
    ("footsteps_running", "footsteps running panic wood concrete", "foley"),
    ("rain_on_roof", "heavy night rain on tin roof ambience", "ambience"),
    ("distant_thunder", "distant dark thunder rumble storm", "ambience"),
    ("wind_howl_night", "eerie howling wind dark night horror", "ambience"),
    ("floorboard_creak", "single wooden floorboard creak dark house", "foley"),
    ("glass_scrape", "fingernails scraping glass eerie", "foley"),
    ("heartbeat_deep", "deep slow tense human heartbeat", "tension"),
    ("human_gasp_fear", "sudden terrified human gasp intake breath", "vocal_fx"),
    ("breathing_heavy", "scared trembling heavy breathing dark", "vocal_fx"),
    ("whisper_eerie", "unintelligible eerie ghost whisper reverb", "supernatural"),
    ("clock_ticking", "old wall clock ticking slow quiet room", "ambience"),
    ("flashlight_click", "metal flashlight button click switch", "foley"),
    ("vhs_static", "analog vhs tape static glitch tracking noise", "analog"),
]

DEFAULT_SFX_CUES = [
    {"name": "wooden_door_creak", "dur": 4.0, "prompt": "Slow heavy wooden door creaking open in a silent dark old Vietnamese rural house, realistic foley, close mic"},
    {"name": "wood_footsteps_slow", "dur": 6.0, "prompt": "Slow cautious bare footsteps walking on creaking old wooden floorboards at night, realistic horror foley"},
    {"name": "rain_night_interior", "dur": 12.0, "prompt": "Muffled heavy night rain falling on an old tin roof outside a quiet dark house with soft distant thunder rumble"},
    {"name": "door_bolt_slide", "dur": 3.0, "prompt": "Rusted iron door bolt slowly sliding open by itself on an old wooden door in dead silence, tactile close-mic foley"},
    {"name": "fingernails_scratch_wood", "dur": 4.5, "prompt": "Slow eerie fingernails lightly scratching on the outside of a wooden door at night, quiet tense horror foley"},
    {"name": "flashlight_click_fail", "dur": 3.0, "prompt": "Tactile metal flashlight button click followed by brief electrical flicker sputter hum in dead silence"},
    {"name": "paper_talisman_flutter", "dur": 3.5, "prompt": "Dry yellow paper talisman fluttering and rustling softly in cold night draft inside a dark room"},
    {"name": "terrified_human_gasp", "dur": 2.5, "prompt": "Sudden sharp terrified human intake breath gasp in complete silence, realistic close-mic foley"},
    {"name": "heavy_door_slam_hall", "dur": 3.0, "prompt": "Heavy old wooden door slamming violently shut with short dark concrete corridor echo"},
    {"name": "vhs_tape_glitch", "dur": 2.0, "prompt": "Short sharp analog VHS magnetic tape static burst and tracking glitch crackle"},
    {"name": "cinematic_sub_boom", "dur": 4.0, "prompt": "Deep dark cinematic horror sub bass boom impact with long cold dark hall tail"},
    {"name": "cello_bow_screech_dread", "dur": 5.0, "prompt": "Single dark dissonant low cello bow swell descending slowly into dread silence, film horror score"},
]


def safe_slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", name.strip().lower()).strip("_")
    return s or "sfx_item"


def load_manifest(lib_dir: str) -> dict:
    p = os.path.join(lib_dir, "manifest.json")
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as fp:
            return json.load(fp)
    return {"version": "v6.0-sfx-library", "sr": SR_LIB, "assets": {}}


def save_manifest(lib_dir: str, mf: dict):
    os.makedirs(lib_dir, exist_ok=True)
    p = os.path.join(lib_dir, "manifest.json")
    with open(p, "w", encoding="utf-8") as fp:
        json.dump(mf, fp, ensure_ascii=False, indent=2)


def probe_wav_dur(path: str) -> float:
    try:
        with wave.open(path, "rb") as w:
            return round(w.getnframes() / float(max(1, w.getframerate())), 4)
    except Exception:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
            text=True,
        ).strip()
        return round(float(out), 4)


def read_wav_stereo(path: str) -> tuple[np.ndarray, int]:
    """Read PCM16 WAV as `(2, N)` float64 array."""
    with wave.open(path, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / float(1 << 23)
    elif sw == 4:
        x = np.frombuffer(raw, "<i4").astype(np.float64) / float(1 << 31)
    else:
        raise ValueError(f"Unsupported sample width {sw} in {path}")
    if ch == 1:
        x = np.stack([x, x])
    else:
        x = x.reshape(-1, ch).T[:2]
    return x, sr


def write_wav_stereo16(path: str, x: np.ndarray, sr: int = SR_LIB):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    arr = np.asarray(x, dtype=np.float64)
    if arr.ndim == 1:
        arr = np.stack([arr, arr])
    inter = np.clip(np.round(arr[:2].T * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(inter.tobytes())


def convert_to_library_wav(src_path: str, dst_wav: str, max_dur: float | None = None, highpass_hz: float = 0.0, peak_ceil_db: float = -1.5):
    """Normalize any audio file to crisp 48 kHz stereo PCM16 WAV with 0 clipping (universal stdlib wave + Remotion compatible)."""
    os.makedirs(os.path.dirname(os.path.abspath(dst_wav)), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp_wav = tf.name
    try:
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", src_path]
        if max_dur and max_dur > 0:
            cmd.extend(["-t", f"{max_dur:.3f}"])
        if highpass_hz and highpass_hz > 0:
            cmd.extend(["-af", f"highpass=f={highpass_hz:.1f}"])
        cmd.extend(["-ar", str(SR_LIB), "-ac", "2", "-c:a", "pcm_s16le", tmp_wav])
        subprocess.run(cmd, check=True)

        x, sr = read_wav_stereo(tmp_wav)
        if x.shape[1] > 0:
            # Normalize quiet recordings gently without over-amplifying room floor; hard-protect peak <= peak_ceil_db
            pk = float(np.max(np.abs(x)))
            ceil_lin = 10.0 ** (float(peak_ceil_db) / 20.0)
            if pk > 1e-6:
                target_pk = ceil_lin if pk > ceil_lin else min(ceil_lin, max(pk, 10.0 ** (-4.0 / 20.0)))
                # Cap boost to +14 dB so subtle ambiences don't turn noisy
                gain = min(target_pk / pk, 10.0 ** (14.0 / 20.0))
                if pk > ceil_lin:
                    gain = ceil_lin / pk
                x = x * gain
            nf = min(int(0.008 * sr), x.shape[1] // 6)
            if nf > 1:
                x[:, :nf] *= np.linspace(0.0, 1.0, nf)[None, :]
                x[:, -nf:] *= np.linspace(1.0, 0.0, nf)[None, :]
        write_wav_stereo16(dst_wav, x, sr)
    finally:
        if os.path.exists(tmp_wav):
            os.remove(tmp_wav)


def inspect_wav_metrics(path: str) -> dict:
    with wave.open(path, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
    x, _ = read_wav_stereo(path)
    pk = float(np.max(np.abs(x))) if x.size else 0.0
    rms = float(np.sqrt(np.mean(x * x) + 1e-18)) if x.size else 0.0
    clips = int(np.sum(np.abs(x) >= 0.999))
    return {
        "sr": sr,
        "ch": ch,
        "dur": round(n / float(max(1, sr)), 3),
        "peak_dbfs": round(20.0 * math.log10(max(pk, 1e-9)), 2),
        "rms_dbfs": round(20.0 * math.log10(max(rms, 1e-9)), 2),
        "clips": clips,
    }


def analyze_sfx_envelope(path: str) -> dict:
    """Measure exact `onset_s`, `peak_s`, `tail_end_s`, `dur_s`, and `rms_dbfs` via 10ms RMS envelope for onset/peak/end alignment."""
    x, sr = read_wav_stereo(path)
    mono = x.mean(axis=0) if x.ndim == 2 else x.reshape(-1)
    dur_s = len(mono) / float(max(1, sr))
    if len(mono) < 64:
        return {"onset_s": 0.0, "peak_s": 0.0, "tail_end_s": round(dur_s, 4), "dur_s": round(dur_s, 4), "rms_dbfs": -99.0}

    win = max(16, int(round(0.010 * sr)))
    hop = max(8, win // 2)
    n_frm = max(1, (len(mono) - win) // hop + 1)
    env = np.empty(n_frm, dtype=np.float64)
    for i in range(n_frm):
        seg = mono[i * hop : i * hop + win]
        env[i] = math.sqrt(float(np.mean(seg * seg)) + 1e-18)

    pk_val = float(np.max(env))
    pk_idx = int(np.argmax(env))
    peak_s = (pk_idx * hop + win * 0.5) / float(sr)

    onset_thr = max(1e-5, pk_val * 0.15)
    above_onset = np.flatnonzero(env >= onset_thr)
    onset_s = (int(above_onset[0]) * hop) / float(sr) if len(above_onset) else 0.0

    tail_thr = max(1e-5, pk_val * (10.0 ** (-30.0 / 20.0)))
    above_tail = np.flatnonzero(env >= tail_thr)
    tail_end_s = min(dur_s, (int(above_tail[-1]) * hop + win) / float(sr)) if len(above_tail) else dur_s

    rms = math.sqrt(float(np.mean(mono * mono)) + 1e-18)
    return {
        "onset_s": round(onset_s, 4),
        "peak_s": round(peak_s, 4),
        "tail_end_s": round(tail_end_s, 4),
        "dur_s": round(dur_s, 4),
        "rms_dbfs": round(20.0 * math.log10(max(rms, 1e-9)), 2),
    }


def is_commercial_safe_license(lic: str, allow_cc_by: bool = False) -> bool:
    """Strictly allow commercial-safe open licenses (`cc0`/`pdm`, plus `by`/`by-sa` only when opted in; NEVER `nc`/`nd`)."""
    s = (lic or "").strip().lower()
    if not s or "nc" in s or "nd" in s:
        return False
    if s in ("cc0", "pdm"):
        return True
    return bool(allow_cc_by and s in ("by", "by-sa"))


def load_recent_history(lib_dir: str, last_n_projects: int = 10) -> set[str]:
    p = os.path.join(lib_dir, "history.jsonl")
    if not os.path.isfile(p):
        return set()
    rows = []
    with open(p, encoding="utf-8") as fp:
        for ln in fp:
            ln = ln.strip()
            if ln:
                try:
                    rows.append(json.loads(ln))
                except Exception:
                    pass
    used = set()
    for row in rows[-last_n_projects:]:
        for sid in row.get("used_ids") or []:
            used.add(str(sid))
    return used


def append_history(lib_dir: str, project_name: str, used_ids: list[str]):
    os.makedirs(lib_dir, exist_ok=True)
    p = os.path.join(lib_dir, "history.jsonl")
    rec = {"project": project_name, "used_ids": sorted(set(str(x) for x in used_ids if x))}
    with open(p, "a", encoding="utf-8") as fp:
        fp.write(json.dumps(rec, ensure_ascii=False) + "\n")


def write_credits_file(credits_path: str, entries: list[dict]):
    """Write verbatim Openverse / CC0 attributions to `credits.txt`."""
    os.makedirs(os.path.dirname(os.path.abspath(credits_path)), exist_ok=True)
    lines = ["# Audio & SFX Attributions (Auto-generated by Horror Engine v7.0)", ""]
    seen = set()
    for e in entries:
        attr = str(e.get("attribution") or "").strip()
        slug = e.get("slug") or e.get("file") or ""
        lic = e.get("license") or "CC0"
        src = e.get("source") or ""
        line = f"- [{slug}] {attr}" if attr else f"- [{slug}] License: {lic} ({src})"
        if line not in seen:
            seen.add(line)
            lines.append(line)
    with open(credits_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")


def openverse_search(
    query: str,
    allow_cc_by: bool = False,
    sources: str = "freesound,jamendo",
    min_sec: float = 0.2,
    max_sec: float = 60.0,
    page_size: int = 15,
    exclude_ids: set[str] | None = None,
    http_get_fn=None,
) -> list[dict]:
    """Search Openverse Audio API v1 (5.2M free Freesound/Jamendo files, ZERO API key!).
    Enforces commercial-safe license filtering (CC0/PDM default; optional CC-BY/BY-SA; NEVER NC/ND)."""
    lic_param = "cc0,pdm,by,by-sa" if allow_cc_by else "cc0,pdm"
    params = urllib.parse.urlencode({
        "q": query,
        "license": lic_param,
        "source": sources,
        "page_size": str(min(20, max(1, int(page_size)))),
    })
    url = f"{OPENVERSE_API}?{params}"
    if http_get_fn is not None:
        data = http_get_fn(url)
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "HorrorEngineV7-OpenverseSFX/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))

    excluded = exclude_ids or set()
    out = []
    for item in data.get("results") or []:
        lic = str(item.get("license") or "").lower()
        if not is_commercial_safe_license(lic, allow_cc_by=allow_cc_by):
            continue
        oid = str(item.get("id") or "")
        if oid in excluded:
            continue
        dur_ms = item.get("duration")
        dur_s = (float(dur_ms) / 1000.0) if dur_ms is not None else 0.0
        if dur_s > 0 and (dur_s < min_sec or dur_s > max_sec):
            continue
        if not item.get("url"):
            continue
        out.append({
            "id": oid,
            "title": str(item.get("title") or "").strip(),
            "creator": str(item.get("creator") or "").strip(),
            "source": str(item.get("source") or "openverse"),
            "license": lic,
            "dur_s": round(dur_s, 2),
            "url": str(item.get("url")),
            "attribution": str(item.get("attribution") or "").strip(),
            "landing_url": str(item.get("foreign_landing_url") or ""),
        })
    # Prefer CC0/PDM first, then durations closest to mid-range
    out.sort(key=lambda r: (0 if r["license"] in ("cc0", "pdm") else 1, abs(r["dur_s"] - min(12.0, max_sec * 0.4))))
    return out


def cmd_search_openverse(args):
    excl = load_recent_history(args.library) if args.fresh else set()
    hits = openverse_search(
        args.query,
        allow_cc_by=args.allow_cc_by,
        sources=args.sources,
        min_sec=args.min_sec,
        max_sec=args.max_sec,
        page_size=args.limit,
        exclude_ids=excl,
    )
    print(f"OPENVERSE SEARCH '{args.query}' ({len(hits)} commercial-safe hits, cc_by={args.allow_cc_by}):")
    for idx, h in enumerate(hits, 1):
        print(f"  [{idx:02d}] id={h['id']} | {h['dur_s']:6.2f}s | {h['license']:5s} | {h['source']:9s} | {h['title'][:52]} — by {h['creator']}")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fp:
            json.dump(hits, fp, ensure_ascii=False, indent=2)


def cmd_fetch_openverse(args):
    """Download a chosen Openverse CC0/CC-BY sound by --id or top --query into 48 kHz stereo library + analyze onset/peak + credits.txt."""
    chosen = None
    if args.id:
        req = urllib.request.Request(f"{OPENVERSE_API}{urllib.parse.quote(args.id)}/", headers={"User-Agent": "HorrorEngineV7-OpenverseSFX/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            item = json.loads(resp.read().decode("utf-8"))
        lic = str(item.get("license") or "").lower()
        if not is_commercial_safe_license(lic, allow_cc_by=args.allow_cc_by):
            raise ValueError(f"Refused non-commercial or disallowed license '{lic}' for Openverse ID {args.id}")
        chosen = {
            "id": str(item.get("id") or args.id),
            "title": str(item.get("title") or args.name or args.id),
            "creator": str(item.get("creator") or ""),
            "source": str(item.get("source") or "openverse"),
            "license": lic,
            "dur_s": round(float(item.get("duration") or 0) / 1000.0, 2),
            "url": str(item.get("url") or ""),
            "attribution": str(item.get("attribution") or "").strip(),
        }
    elif args.query:
        excl = load_recent_history(args.library) if args.fresh else set()
        hits = openverse_search(
            args.query,
            allow_cc_by=args.allow_cc_by,
            sources=args.sources,
            min_sec=args.min_sec,
            max_sec=args.max_sec,
            page_size=12,
            exclude_ids=excl,
        )
        if not hits:
            raise RuntimeError(f"No Openverse hits found for query={args.query!r}")
        chosen = hits[min(max(0, args.pick_index), len(hits) - 1)]
    else:
        raise ValueError("Provide either --id <openverse_id> or --query '<english query>'")

    if not chosen.get("url"):
        raise RuntimeError(f"Selected Openverse entry has no audio URL: {chosen}")

    slug = safe_slug(args.name or chosen["title"])
    os.makedirs(args.library, exist_ok=True)
    dst_wav = os.path.join(args.library, f"{slug}.wav")
    if os.path.isfile(dst_wav) and not args.overwrite:
        print(f"SKIP (exists): {dst_wav} (pass --overwrite to replace)")
        return

    # Peak-normalize one-shots cleanly to -3.0 dBTP (NEVER ffmpeg loudnorm on short SFX!); beds to -4.0 dBTP
    peak_ceil = -4.0 if args.category == "ambience" else -3.0
    hp_hz = 45.0 if args.category != "tension" else 0.0
    with tempfile.TemporaryDirectory(prefix="ov_sfx_") as td:
        ext = os.path.splitext(urllib.parse.urlparse(chosen["url"]).path)[1].lower() or ".mp3"
        tmp_dl = os.path.join(td, f"{slug}{ext}")
        req = urllib.request.Request(chosen["url"], headers={"User-Agent": "HorrorEngineV7-OpenverseSFX/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(tmp_dl, "wb") as fp:
            fp.write(resp.read())
        convert_to_library_wav(tmp_dl, dst_wav, max_dur=args.max_dur, highpass_hz=hp_hz, peak_ceil_db=peak_ceil)

    m = inspect_wav_metrics(dst_wav)
    env = analyze_sfx_envelope(dst_wav)
    mf = load_manifest(args.library)
    mf["version"] = "v7.0-sfx-library"
    mf["assets"][slug] = {
        "file": f"{slug}.wav",
        "category": args.category,
        "desc": args.desc or chosen["title"],
        "dur": m["dur"],
        "peak_dbfs": m["peak_dbfs"],
        "clips": m["clips"],
        "onset_s": env["onset_s"],
        "peak_s": env["peak_s"],
        "tail_end_s": env["tail_end_s"],
        "rms_dbfs": env["rms_dbfs"],
        "license": chosen["license"].upper(),
        "source": f"openverse:{chosen['source']}:{chosen['id']}",
        "openverse_id": chosen["id"],
        "creator": chosen["creator"],
        "attribution": chosen["attribution"] or f'"{chosen["title"]}" by {chosen["creator"]} ({chosen["license"].upper()})',
    }
    save_manifest(args.library, mf)
    all_credits = [{"slug": k, **v} for k, v in sorted(mf["assets"].items())]
    write_credits_file(os.path.join(args.library, "credits.txt"), all_credits)
    print(
        f"OPENVERSE FETCH OK -> {dst_wav} ({m['dur']:.2f}s | onset={env['onset_s']:.3f}s | peak={env['peak_s']:.3f}s | "
        f"{m['peak_dbfs']:.1f} dBFS | clips={m['clips']} | lic={chosen['license'].upper()})"
    )
    print(f"  Attribution logged -> {os.path.join(args.library, 'credits.txt')}")


def cmd_analyze(args):
    """Measure and store `onset_s`, `peak_s`, `tail_end_s`, `rms_dbfs` in manifest.json for every WAV in library."""
    mf = load_manifest(args.library)
    assets = mf.get("assets") or {}
    updated = 0
    for slug, info in sorted(assets.items()):
        p = os.path.join(args.library, info["file"])
        if not os.path.isfile(p):
            continue
        env = analyze_sfx_envelope(p)
        info.update(env)
        updated += 1
        print(f"  ANALYZED {slug:24s} | dur={env['dur_s']:5.2f}s | onset={env['onset_s']:5.3f}s | peak={env['peak_s']:5.3f}s | end={env['tail_end_s']:5.3f}s")
    mf["version"] = "v7.0-sfx-library"
    save_manifest(args.library, mf)
    print(f"ANALYZE DONE: updated envelope timings for {updated} assets in {args.library}")


def build_sfx_audition_reel(lib_dir: str, out_wav: str, max_per_clip_s: float = 3.5) -> str:
    """Build ONE stereo 48 kHz audition reel playing every SFX in manifest.json sequentially with crisp 660Hz pips."""
    mf = load_manifest(lib_dir)
    assets = mf.get("assets") or {}
    t_pip = np.arange(int(0.075 * SR_LIB), dtype=np.float64) / SR_LIB
    pip_m = 0.07 * np.sin(2.0 * np.pi * 660.0 * t_pip) * np.hanning(len(t_pip))
    pip = np.stack([pip_m, pip_m])
    gap = np.zeros((2, int(0.38 * SR_LIB)), dtype=np.float64)

    parts = []
    max_n = int(round(max_per_clip_s * SR_LIB))
    for slug in sorted(assets.keys()):
        p = os.path.join(lib_dir, assets[slug]["file"])
        if not os.path.isfile(p):
            continue
        x, _ = read_wav_stereo(p)
        if x.shape[1] > max_n:
            x = x[:, :max_n].copy()
            nf = min(int(0.06 * SR_LIB), x.shape[1] // 4)
            x[:, -nf:] *= np.linspace(1.0, 0.0, nf)[None, :]
        parts.extend([pip, gap, x, gap])
    reel = np.concatenate(parts, axis=1) if parts else np.zeros((2, SR_LIB), dtype=np.float64)
    pk = float(np.max(np.abs(reel)))
    if pk > 0.92:
        reel *= 0.92 / pk
    write_wav_stereo16(out_wav, reel, SR_LIB)
    return out_wav


def write_sfx_catalog(lib_dir: str, out_md: str, reel_wav: str | None = None) -> str:
    """Write a clickable Markdown SFX catalog (`SFX_CATALOG.md`) with license, duration, peak, clips & file:// links."""
    mf = load_manifest(lib_dir)
    assets = mf.get("assets") or {}
    lines = [
        "# Kho SFX Foley Điện Ảnh Thu Âm Thật (`100% CC0` · 48 kHz Stereo)",
        "",
        f"- **Thư mục kho:** `{os.path.abspath(lib_dir)}` (**{len(assets)}** tài nguyên chuẩn `48 kHz stereo PCM16 WAV`, an toàn thương mại YouTube/TikTok).",
    ]
    if reel_wav and os.path.isfile(reel_wav):
        lines.append(f"- **Nghe nối tiếp toàn bộ kho SFX (1 file duy nhất, có tiếng bíp ngăn cách):** [sfx_audition_reel.wav](file://{os.path.abspath(reel_wav)})")
    lines.extend([
        "",
        "| # | Tên chuẩn (`slug`) | Nhóm | Mô tả / Công dụng | Độ dài | Peak · Clips | Giấy phép | Nghe trực tiếp |",
        "|---|---|---|---|---|---|---|---|",
    ])
    for idx, slug in enumerate(sorted(assets.keys()), 1):
        info = assets[slug]
        ap = os.path.abspath(os.path.join(lib_dir, info["file"]))
        m = inspect_wav_metrics(ap) if os.path.isfile(ap) else {"dur": 0.0, "peak_dbfs": -99.0, "clips": -1}
        desc = str(info.get("desc") or info.get("query") or info.get("source") or "").replace("|", "/")
        lines.append(
            f"| {idx:02d} | `{slug}` | `{info.get('category', '')}` | {desc} | "
            f"{m['dur']:.2f}s | `{m['peak_dbfs']:.1f} dBFS` · `{m['clips']}` clips | "
            f"`{info.get('license', 'CC0')}` | [{info['file']}](file://{ap}) |"
        )
    os.makedirs(os.path.dirname(os.path.abspath(out_md)), exist_ok=True)
    with open(out_md, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")
    return out_md


def cmd_fetch_cc0_open(args):
    """Fetch 25 verified strict-CC0 real-recorded horror Foley assets directly from public GitHub (ZERO API key)."""
    only_set = {safe_slug(s) for s in args.only.split(",") if s.strip()} if args.only else None
    jobs = [row for row in CC0_OPEN_HORROR_PACK if (only_set is None or row[0] in only_set)]
    if not jobs:
        raise ValueError(f"No matching CC0 slugs for --only={args.only!r}")

    os.makedirs(args.library, exist_ok=True)
    mf = load_manifest(args.library)
    fetched = 0

    def _download_one(row, td):
        slug, cat, rel_path, desc, hp_hz, max_d = row
        dst_wav = os.path.join(args.library, f"{slug}.wav")
        if os.path.isfile(dst_wav) and not args.overwrite:
            return slug, "skip", None
        url = f"{CC0_GITHUB_RAW_BASE}/{urllib.parse.quote(rel_path, safe='/')}"
        ext = os.path.splitext(rel_path)[1].lower() or ".wav"
        tmp_src = os.path.join(td, f"{slug}{ext}")
        req = urllib.request.Request(url, headers={"User-Agent": "HorrorEngineV64-CC0SFX/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(tmp_src, "wb") as fp:
            fp.write(resp.read())
        convert_to_library_wav(tmp_src, dst_wav, max_dur=max_d, highpass_hz=hp_hz)
        m = inspect_wav_metrics(dst_wav)
        entry = {
            "file": f"{slug}.wav",
            "category": cat,
            "desc": desc,
            "dur": m["dur"],
            "peak_dbfs": m["peak_dbfs"],
            "clips": m["clips"],
            "license": "CC0-1.0 (Public Domain)",
            "source": f"github:lavenderdotpet/CC0-Public-Domain-Sounds/{rel_path}",
        }
        return slug, "ok", entry

    with tempfile.TemporaryDirectory(prefix="cc0_sfx_") as td:
        with ThreadPoolExecutor(max_workers=4) as ex:
            futs = {ex.submit(_download_one, row, td): row for row in jobs}
            for fut in as_completed(futs):
                slug = futs[fut][0]
                try:
                    sl, status, entry = fut.result()
                    if status == "skip":
                        print(f"  SKIP (exists): {sl}.wav")
                    elif status == "ok" and entry is not None:
                        mf["assets"][sl] = entry
                        fetched += 1
                        print(f"  OK [{entry['category']:10s}] {sl:22s} ({entry['dur']:5.2f}s · {entry['peak_dbfs']:5.1f} dBFS · clips={entry['clips']})")
                except Exception as exc:
                    print(f"  WARN '{slug}': {exc}")

    mf["version"] = "v6.4-sfx-library"
    save_manifest(args.library, mf)

    reel_wav = None
    if not args.no_reel and mf.get("assets"):
        reel_dir = args.catalog_dir or args.library
        reel_wav = build_sfx_audition_reel(args.library, os.path.join(reel_dir, "sfx_audition_reel.wav"))
        cat_md = write_sfx_catalog(args.library, os.path.join(reel_dir, "SFX_CATALOG.md"), reel_wav=reel_wav)
        print(f"AUDITION REEL -> {reel_wav}")
        print(f"SFX CATALOG   -> {cat_md}")
    print(f"CC0 OPEN PACK DONE: fetched {fetched} new assets into {args.library} (total={len(mf['assets'])})")


def cmd_verify(args):
    """Verify every WAV listed in manifest.json exists, is 48 kHz stereo PCM16, non-empty, and has 0 clipping."""
    mf = load_manifest(args.library)
    assets = mf.get("assets") or {}
    if not assets:
        print(f"VERIFY FAIL: SFX library empty ({args.library})", file=sys.stderr)
        sys.exit(1)
    bad = 0
    print(f"VERIFYING SFX LIBRARY ({args.library}) — {len(assets)} assets:")
    for slug in sorted(assets.keys()):
        info = assets[slug]
        p = os.path.join(args.library, info["file"])
        if not os.path.isfile(p):
            print(f"  [FAIL] {slug:24s} MISSING FILE")
            bad += 1
            continue
        m = inspect_wav_metrics(p)
        ok = (m["sr"] == SR_LIB) and (m["ch"] == 2) and (m["dur"] >= 0.05) and (m["clips"] == 0)
        tag = "OK  " if ok else "FAIL"
        if not ok:
            bad += 1
        print(f"  [{tag}] {slug:24s} | {m['dur']:5.2f}s | {m['sr']}Hz {m['ch']}ch | peak={m['peak_dbfs']:6.2f} dBFS | clips={m['clips']}")
    if bad:
        print(f"VERIFY FAILED: {bad}/{len(assets)} assets failed quality check", file=sys.stderr)
        sys.exit(1)
    print(f"VERIFY OK: {len(assets)}/{len(assets)} real SFX assets passed (48 kHz stereo, 0 clips)")


def freesound_search(query: str, api_key: str, max_dur: float = 25.0, page_size: int = 5) -> list:
    """Query Freesound API v2 strictly filtered for CC0 (Creative Commons 0 / Public Domain) real recordings."""
    params = urllib.parse.urlencode({
        "query": query,
        "filter": f'license:"Creative Commons 0" duration:[0.3 TO {max_dur}]',
        "fields": "id,name,duration,license,previews,username",
        "sort": "rating_desc",
        "page_size": str(page_size),
        "token": api_key,
    })
    url = f"https://freesound.org/apiv2/search/text/?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "HorrorEngineV6-SFX/1.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("results") or []


def cmd_fetch_freesound(args):
    api_key = args.api_key or os.environ.get("FREESOUND_API_KEY")
    if not api_key:
        print(
            "ERROR: FREESOUND_API_KEY is not set.\n"
            "  Get a 100% FREE API key in 30 seconds at https://freesound.org/apiv2/apply/\n"
            "  Then run: export FREESOUND_API_KEY='your_key' (or pass --api-key YOUR_KEY)\n"
            "  Or import local CC0 WAVs via: python3 scripts/sfx_manager.py import-local --src <folder>",
            file=sys.stderr,
        )
        sys.exit(2)

    jobs = []
    if args.preset == "horror-starter":
        jobs = list(HORROR_STARTER_PRESETS)
    elif args.query:
        jobs = [(safe_slug(args.name or args.query), args.query, args.category)]
    else:
        print("ERROR: Specify either --preset horror-starter or --query '...'", file=sys.stderr)
        sys.exit(2)

    os.makedirs(args.library, exist_ok=True)
    mf = load_manifest(args.library)
    fetched = 0

    with tempfile.TemporaryDirectory(prefix="fs_sfx_") as td:
        for slug, query, cat in jobs:
            dst_wav = os.path.join(args.library, f"{slug}.wav")
            if os.path.isfile(dst_wav) and not args.overwrite:
                print(f"  SKIP (exists): {slug}.wav")
                continue
            try:
                hits = freesound_search(query, api_key, max_dur=args.max_dur)
                if not hits:
                    print(f"  MISS: no CC0 results for '{query}'")
                    continue
                best = hits[0]
                previews = best.get("previews") or {}
                dl_url = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
                if not dl_url:
                    print(f"  MISS: no preview URL for '{best.get('name')}'")
                    continue
                tmp_mp3 = os.path.join(td, f"{slug}.mp3")
                req = urllib.request.Request(dl_url, headers={"User-Agent": "HorrorEngineV6-SFX/1.0"})
                with urllib.request.urlopen(req, timeout=30) as resp, open(tmp_mp3, "wb") as fp:
                    fp.write(resp.read())
                convert_to_library_wav(tmp_mp3, dst_wav, max_dur=args.max_dur)
                dur = probe_wav_dur(dst_wav)
                mf["assets"][slug] = {
                    "file": f"{slug}.wav",
                    "category": cat,
                    "dur": dur,
                    "license": best.get("license", "CC0"),
                    "source": f"freesound:{best.get('id')}",
                    "author": best.get("username", ""),
                    "query": query,
                }
                fetched += 1
                print(f"  OK [{cat}] {slug}.wav ({dur:.2f}s) <- Freesound #{best.get('id')} ({best.get('name')})")
            except Exception as exc:
                print(f"  WARN '{slug}': {exc}")

    save_manifest(args.library, mf)
    print(f"FREESOUND DONE: fetched {fetched} CC0 assets into {args.library} (total={len(mf['assets'])})")


def cmd_import_local(args):
    src_dir = os.path.abspath(args.src)
    if not os.path.isdir(src_dir):
        raise FileNotFoundError(f"Source SFX directory not found: {src_dir}")
    os.makedirs(args.library, exist_ok=True)
    mf = load_manifest(args.library)
    exts = (".wav", ".mp3", ".flac", ".ogg", ".m4a")
    imported = 0

    for fname in sorted(os.listdir(src_dir)):
        if not fname.lower().endswith(exts):
            continue
        stem = os.path.splitext(fname)[0]
        slug = safe_slug(stem)
        src_p = os.path.join(src_dir, fname)
        dst_wav = os.path.join(args.library, f"{slug}.wav")
        convert_to_library_wav(src_p, dst_wav, max_dur=args.max_dur)
        dur = probe_wav_dur(dst_wav)
        mf["assets"][slug] = {
            "file": f"{slug}.wav",
            "category": args.category,
            "dur": dur,
            "license": args.license,
            "source": f"local:{fname}",
        }
        imported += 1
        print(f"  IMPORTED {slug}.wav ({dur:.2f}s) <- {fname}")

    save_manifest(args.library, mf)
    print(f"IMPORT DONE: {imported} assets ready in {args.library}")


def cmd_export_sfx_pack(args):
    """Export portable GPU Neural SFX pack with ready-to-run `declare-lab/TangoFlux` & `hkchengrex/MMAudio` scripts."""
    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)

    if args.cues and os.path.isfile(args.cues):
        with open(args.cues, encoding="utf-8") as fp:
            cues_data = json.load(fp)
        cues = cues_data.get("cues", cues_data) if isinstance(cues_data, dict) else cues_data
    else:
        cues = DEFAULT_SFX_CUES

    prompts_json = os.path.join(out_dir, "sfx_prompts.json")
    with open(prompts_json, "w", encoding="utf-8") as fp:
        json.dump({"version": "v6.0-gpu-sfx-pack", "cues": cues}, fp, ensure_ascii=False, indent=2)

    # 1. TangoFlux Text-to-SFX generator script (44.1 kHz stereo in ~3.7s/clip on RTX GPU)
    tf_script = '''#!/usr/bin/env python3
"""Run on your RTX GPU PC with `declare-lab/TangoFlux` installed:
  pip install git+https://github.com/declare-lab/TangoFlux
  python3 run_tangoflux_sfx.py
Then copy the generated `generated_sfx/*.wav` folder back and run:
  python3 scripts/sfx_manager.py import-local --src generated_sfx --library shorts-project/audio/sfx_library
"""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "generated_sfx")
os.makedirs(OUT_DIR, exist_ok=True)

with open(os.path.join(HERE, "sfx_prompts.json"), encoding="utf-8") as fp:
    cues = json.load(fp)["cues"]

for c in cues:
    name = c["name"]
    dur = float(c.get("dur", 5.0))
    prompt = c["prompt"]
    out_wav = os.path.join(OUT_DIR, f"{name}.wav")
    print(f"[TangoFlux] Generating {name}.wav ({dur:.1f}s): {prompt}")
    subprocess.run(
        ["tangoflux", prompt, out_wav, "--duration", str(dur), "--steps", "50"],
        check=True,
    )

print(f"DONE -> {OUT_DIR} ({len(cues)} studio 44.1kHz stereo SFX clips)")
'''
    with open(os.path.join(out_dir, "run_tangoflux_sfx.py"), "w", encoding="utf-8") as fp:
        fp.write(tf_script)

    # 2. MMAudio Video-to-Audio script (frame-locked Foley directly from rendered video.mp4!)
    vid_name = os.path.basename(args.video) if args.video else "video.mp4"
    mm_script = f'''#!/usr/bin/env python3
"""Run on your RTX GPU PC with `hkchengrex/MMAudio` installed (~6 GB VRAM):
  git clone https://github.com/hkchengrex/MMAudio.git && cd MMAudio && pip install -e .
  Copy `{vid_name}` next to this script, then run:
  python3 run_mmaudio_video.py --mmaudio-dir /path/to/MMAudio
Outputs a frame-synchronized realistic Foley track (`mmaudio_foley.wav`) to layer softly beneath narration!
"""
import argparse, os, subprocess

ap = argparse.ArgumentParser()
ap.add_argument("--mmaudio-dir", required=True, help="Path to cloned hkchengrex/MMAudio repository")
ap.add_argument("--video", default="{vid_name}", help="Rendered silent horror video.mp4")
ap.add_argument("--prompt", default="dark quiet horror atmosphere, subtle wooden creaks, eerie footsteps, realistic foley, no music, no speech")
ap.add_argument("--negative-prompt", default="music, singing, speech, talking, crowd, upbeat")
args = ap.parse_args()

demo_py = os.path.join(args.mmaudio_dir, "demo.py")
subprocess.run(
    [
        "python3", demo_py,
        "--variant", "large_44k_v2",
        "--video", os.path.abspath(args.video),
        "--prompt", args.prompt,
        "--negative_prompt", args.negative_prompt,
        "--output", os.path.abspath("mmaudio_out"),
    ],
    check=True,
)
print("DONE -> Extract audio from mmaudio_out/*.mp4 using ffmpeg and blend beneath voice in build_audio.py!")
'''
    with open(os.path.join(out_dir, "run_mmaudio_video.py"), "w", encoding="utf-8") as fp:
        fp.write(mm_script)

    print(f"GPU SFX PACK READY -> {out_dir} ({len(cues)} TangoFlux prompts + MMAudio video-to-audio script)")
    return out_dir


def cmd_list(args):
    mf = load_manifest(args.library)
    assets = mf.get("assets") or {}
    if not assets:
        print(f"SFX LIBRARY EMPTY ({args.library}). Run `fetch-freesound`, `import-local`, or `export-sfx-pack`.")
        return
    print(f"SFX LIBRARY ({args.library}) — {len(assets)} assets @ {mf.get('sr', SR_LIB)} Hz stereo:")
    for slug, info in sorted(assets.items()):
        exists = "OK" if os.path.isfile(os.path.join(args.library, info["file"])) else "MISSING"
        print(f"  [{exists}] {slug:24s} ({info.get('dur', 0):5.2f}s) | {info.get('category', ''):12s} | {info.get('license', '')} | {info.get('source', '')}")


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v7.0 Asset-First Cinema SFX Manager (Openverse 5.2M API + CC0 Pack + TangoFlux + MMAudio).")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_os = sub.add_parser("search-openverse", help="Search 5.2M free Openverse (Freesound/Jamendo) SFX with ZERO API key")
    p_os.add_argument("--query", required=True, help="English sound query (e.g. 'wooden door creak', 'night rain')")
    p_os.add_argument("--allow-cc-by", action="store_true", help="Include CC-BY / CC-BY-SA in addition to default CC0/PDM (never NC/ND)")
    p_os.add_argument("--sources", default="freesound,jamendo")
    p_os.add_argument("--min-sec", type=float, default=0.2)
    p_os.add_argument("--max-sec", type=float, default=60.0)
    p_os.add_argument("--limit", type=int, default=12)
    p_os.add_argument("--fresh", action="store_true", help="Exclude Openverse IDs used in recent videos (history.jsonl)")
    p_os.add_argument("--library", default="audio/sfx_library")
    p_os.add_argument("--json-out", default=None)
    p_os.set_defaults(func=cmd_search_openverse)

    p_of = sub.add_parser("fetch-openverse", help="Fetch chosen Openverse SFX into 48kHz stereo library + measure onset/peak + log credits.txt")
    p_of.add_argument("--id", default=None, help="Exact Openverse audio UUID from search-openverse")
    p_of.add_argument("--query", default=None, help="Or search and pick top match by query")
    p_of.add_argument("--pick-index", type=int, default=0, help="0-based index in search results when using --query")
    p_of.add_argument("--name", default=None, help="Target slug name inside audio/sfx_library/")
    p_of.add_argument("--desc", default=None, help="Optional Vietnamese/English description for manifest")
    p_of.add_argument("--category", default="foley", choices=["foley", "ambience", "tension", "analog", "transition", "vocal_fx"])
    p_of.add_argument("--allow-cc-by", action="store_true")
    p_of.add_argument("--sources", default="freesound,jamendo")
    p_of.add_argument("--min-sec", type=float, default=0.2)
    p_of.add_argument("--max-sec", type=float, default=180.0)
    p_of.add_argument("--max-dur", type=float, default=30.0, help="Trim saved WAV to max duration (s)")
    p_of.add_argument("--fresh", action="store_true")
    p_of.add_argument("--overwrite", action="store_true")
    p_of.add_argument("--library", default="audio/sfx_library")
    p_of.set_defaults(func=cmd_fetch_openverse)

    p_an = sub.add_parser("analyze", help="Analyze onset/peak/tail timings for all WAVs in audio/sfx_library/ into manifest.json")
    p_an.add_argument("--library", default="audio/sfx_library")
    p_an.set_defaults(func=cmd_analyze)

    p_cc0 = sub.add_parser("fetch-cc0-open", help="Fetch 25 verified 100% CC0 real-recorded horror Foley assets (ZERO API key!)")
    p_cc0.add_argument("--library", default="audio/sfx_library")
    p_cc0.add_argument("--catalog-dir", default=None, help="Optional folder for SFX_CATALOG.md & sfx_audition_reel.wav (defaults to --library)")
    p_cc0.add_argument("--only", default=None, help="Comma-separated subset of slugs to fetch/replace")
    p_cc0.add_argument("--overwrite", action="store_true")
    p_cc0.add_argument("--no-reel", action="store_true", help="Skip generating sfx_audition_reel.wav and SFX_CATALOG.md")
    p_cc0.set_defaults(func=cmd_fetch_cc0_open)

    p_fs = sub.add_parser("fetch-freesound", help="Fetch real recorded CC0 horror Foley from Freesound API")
    p_fs.add_argument("--preset", choices=["horror-starter"], default=None)
    p_fs.add_argument("--query", default=None)
    p_fs.add_argument("--name", default=None)
    p_fs.add_argument("--category", default="foley")
    p_fs.add_argument("--api-key", default=None)
    p_fs.add_argument("--max-dur", type=float, default=20.0)
    p_fs.add_argument("--overwrite", action="store_true")
    p_fs.add_argument("--library", default="audio/sfx_library")
    p_fs.set_defaults(func=cmd_fetch_freesound)

    p_imp = sub.add_parser("import-local", help="Import & normalize local WAV/MP3/FLAC SFX into 48kHz stereo library")
    p_imp.add_argument("--src", required=True)
    p_imp.add_argument("--category", default="foley")
    p_imp.add_argument("--license", default="CC0 / Local")
    p_imp.add_argument("--max-dur", type=float, default=None)
    p_imp.add_argument("--library", default="audio/sfx_library")
    p_imp.set_defaults(func=cmd_import_local)

    p_exp = sub.add_parser("export-sfx-pack", help="Export GPU Neural SFX pack (declare-lab/TangoFlux + hkchengrex/MMAudio)")
    p_exp.add_argument("--cues", default=None, help="Optional JSON list of {name, dur, prompt} cues")
    p_exp.add_argument("--video", default=None, help="Optional video.mp4 path for MMAudio script")
    p_exp.add_argument("--out-dir", required=True)
    p_exp.set_defaults(func=cmd_export_sfx_pack)

    p_ls = sub.add_parser("list", help="List available normalized assets in audio/sfx_library")
    p_ls.add_argument("--library", default="audio/sfx_library")
    p_ls.set_defaults(func=cmd_list)

    p_vf = sub.add_parser("verify", help="Verify all SFX assets in audio/sfx_library are 48kHz stereo with 0 clipping")
    p_vf.add_argument("--library", default="audio/sfx_library")
    p_vf.set_defaults(func=cmd_verify)
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
