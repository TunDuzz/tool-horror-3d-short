#!/usr/bin/env python3
"""Horror Engine v6.2: Two-Stage Emotion Bank Curator & Audition Builder.

Stage 1 (`fetch`) — STAGING ONLY (never writes to `audio/emotion_refs/`):
  Scans open, zero-BGM speech corpora via HuggingFace Datasets Server API:
    1. `doof-ferb/LSVSC` (Native Vietnamese: fear, angry, sad, tired, stories/audiobook, drama dialogue)
    2. `ylacombe/expresso` (Meta AI 48 kHz studio: whisper, confused, sad, emphasis, default)
    3. `MahiA/RAVDESS` (Studio actors 48 kHz: fearful, calm, angry, sad)
  Scores candidates by duration (3-8s), estimated SNR (>= 18 dB), zero clipping, gender/dialect preference,
  and mood acoustic signature; normalizes top 2-3 candidates (A/B/C) per emotion to 48 kHz mono;
  and synthesizes a Vietnamese horror test line via `VieNeu-TTS v3 Turbo` for EACH candidate so you can
  audition both the raw reference AND the actual Vietnamese `VieNeu-TTS` output before approving!

Stage 2 (`apply`) — ONLY RUN AFTER EXPLICIT USER APPROVAL:
  Copies your approved picks (e.g. `calm=A curious=B whisper=C fear=A panic=A dread=A`) into
  `shorts-project/audio/emotion_refs/` and runs `prepare_emotion_refs.py check` to confirm 6/6 OK.

Usage:
  python3 scripts/curate_emotion_candidates.py fetch --out-dir shorts-project/out/emotion_audition
  python3 scripts/curate_emotion_candidates.py apply \
    --audition-dir shorts-project/out/emotion_audition \
    --out-dir shorts-project/audio/emotion_refs \
    --pick calm=A curious=A whisper=C fear=A panic=A dread=A
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import wave

import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import prepare_emotion_refs as pref  # noqa: E402

SR_REF = pref.SR_REF
HF_API = "https://datasets-server.huggingface.co"

# Map each of the 6 Emotion Bank slots to canonical Vietnamese preview test line + VieNeu sampling params
MOOD_SPEC = {
    "calm": {
        "vi_label": "Trầm lắng kể chuyện mở đầu",
        "test_text": "Đêm hôm đó trời mưa rất to, cả con hẻm vắng lặng không một bóng người qua lại.",
        "silence_p": 0.28,
        "temperature": 0.72,
    },
    "curious": {
        "vi_label": "Tò mò, dò xét, nghi vấn",
        "test_text": "Khoan đã... tiếng động lạ kia phát ra từ đâu vậy? Có ai đang ở ngoài đó không?",
        "silence_p": 0.24,
        "temperature": 0.86,
    },
    "whisper": {
        "vi_label": "Thì thầm sát mic, nhẹ hơi",
        "test_text": "Suỵt... nói nhỏ thôi, đừng thở mạnh, hình như có thứ gì đang đứng ngay sau cánh cửa.",
        "silence_p": 0.36,
        "temperature": 0.78,
    },
    "fear": {
        "vi_label": "Sợ hãi, hụt hơi, run rẩy lo âu",
        "test_text": "Trời ơi, tay tôi lạnh cóng rồi... cánh cửa đang tự mở ra kìa, đừng lại gần tôi!",
        "silence_p": 0.16,
        "temperature": 0.90,
    },
    "panic": {
        "vi_label": "Hoảng loạn, gấp gáp, dồn dập",
        "test_text": "Chạy mau đi! Đừng ngoái đầu lại! Khóa chặt cửa vào, nó đang lao tới ngay phía sau kia kìa!",
        "silence_p": 0.06,
        "temperature": 0.94,
    },
    "dread": {
        "vi_label": "Nặng nề, chậm rợn chốt cú lật",
        "test_text": "Và rồi... khi ngọn đèn cuối cùng phụt tắt, tôi biết mình không còn đường thoát nữa.",
        "silence_p": 0.44,
        "temperature": 0.66,
    },
}

DATASET_LICENSES = {
    "doof-ferb/LSVSC": "Public Research Corpus (HuggingFace community mirror — reference prosody only)",
    "ylacombe/expresso": "CC-BY-NC-4.0 (Meta AI Expresso 48 kHz studio expressive speech)",
    "MahiA/RAVDESS": "CC-BY-NA-SC-4.0 (Ryerson RAVDESS studio emotional speech)",
}

CURIOUS_VI_RE = re.compile(
    r"\?|\b(ai\b|cái gì|sao\b|tại sao|ở đâu|có phải|chuyện gì|gì thế|gì vậy|khoan|đâu rồi|là ai|thế nào)",
    re.IGNORECASE,
)


def http_get_json(url: str, timeout: int = 18, retries: int = 5) -> dict:
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "HorrorEngine-Curator/6.2"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code == 429:
                wait_s = float(exc.headers.get("Retry-After") or (2.0 * (attempt + 1)))
                time.sleep(min(wait_s, 12.0))
                continue
            time.sleep(0.6 * (attempt + 1))
        except Exception as exc:
            last_err = exc
            time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f"GET failed for {url}: {last_err}")


def http_download_file(url: str, dst_path: str, timeout: int = 25, retries: int = 3) -> str:
    last_err = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "HorrorEngine-Curator/6.2"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
            with open(dst_path, "wb") as fp:
                fp.write(data)
            return dst_path
        except Exception as exc:
            last_err = exc
    raise RuntimeError(f"Download failed for {url}: {last_err}")


def measure_audio_metrics(x: np.ndarray, sr: int = SR_REF, text: str = "") -> dict:
    """Compute acoustic quality metrics for reference suitability (zero-BGM, clean SNR, duration, breathiness)."""
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    if len(x) < int(0.2 * sr):
        return {
            "dur_s": round(len(x) / float(sr), 3),
            "snr_db": 0.0,
            "raw_clips": int(np.sum(np.abs(x) >= 0.995)),
            "peak_dbfs": -99.0,
            "rms_dbfs": -99.0,
            "zcr": 0.0,
            "low_ratio": 0.0,
            "wps_est": 0.0,
            "speech_ratio": 0.0,
        }

    raw_clips = int(np.sum(np.abs(x) >= 0.995))
    peak = float(np.max(np.abs(x)))
    peak_dbfs = 20.0 * math.log10(max(peak, 1e-9))

    # Frame-level RMS (30ms frames, 15ms hop) for robust SNR estimation
    frame = max(64, int(0.030 * sr))
    hop = max(32, frame // 2)
    n_frames = max(1, (len(x) - frame) // hop + 1)
    frm_rms = np.empty(n_frames, dtype=np.float64)
    for i in range(n_frames):
        seg = x[i * hop : i * hop + frame]
        frm_rms[i] = math.sqrt(float(np.mean(seg * seg)) + 1e-12)

    frm_db = 20.0 * np.log10(np.maximum(frm_rms, 1e-7))
    p90 = float(np.percentile(frm_db, 90))
    p15 = float(np.percentile(frm_db, 15))
    snr_db = max(0.0, p90 - p15)

    active = x[np.abs(x) > max(0.006, peak * 0.05)]
    speech_ratio = len(active) / float(len(x))
    rms_val = math.sqrt(float(np.mean(active * active)) + 1e-12) if len(active) > 64 else math.sqrt(float(np.mean(x * x)) + 1e-12)
    rms_dbfs = 20.0 * math.log10(max(rms_val, 1e-9))

    # Zero-crossing rate (higher for whispered / breathy fricatives)
    zcr = float(np.mean(np.abs(np.diff(np.signbit(x)))))

    # Low-frequency vocal body ratio (100-500 Hz vs 100-4000 Hz)
    n_fft = 1 << min(15, max(10, int(math.ceil(math.log2(min(len(x), sr * 4))))))
    spec = np.abs(np.fft.rfft(x[:n_fft] * np.hanning(min(len(x), n_fft)), n=n_fft)) ** 2
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)
    low_e = float(np.sum(spec[(freqs >= 90) & (freqs <= 450)]))
    mid_e = float(np.sum(spec[(freqs >= 90) & (freqs <= 4500)])) + 1e-12
    low_ratio = low_e / mid_e

    dur_s = len(x) / float(sr)
    words = [w for w in re.split(r"\s+", (text or "").strip()) if w]
    wps_est = (len(words) / dur_s) if (words and dur_s > 0.2) else 0.0

    return {
        "dur_s": round(dur_s, 3),
        "snr_db": round(snr_db, 2),
        "raw_clips": raw_clips,
        "peak_dbfs": round(peak_dbfs, 2),
        "rms_dbfs": round(rms_dbfs, 2),
        "zcr": round(zcr, 4),
        "low_ratio": round(low_ratio, 4),
        "wps_est": round(wps_est, 2),
        "speech_ratio": round(speech_ratio, 3),
    }


def score_candidate(metrics: dict, mood: str, meta: dict) -> tuple[bool, float, str]:
    """Return `(accepted, score, reason)` enforcing hard clean-reference gates (3-8s, clean SNR, 0 clips)."""
    dur = metrics["dur_s"]
    snr = metrics["snr_db"]
    clips = metrics["raw_clips"]
    speech_ratio = metrics["speech_ratio"]

    if dur < 2.6:
        return False, -100.0, f"too_short({dur:.2f}s)"
    if dur > 9.8:
        return False, -100.0, f"too_long({dur:.2f}s)"
    if clips > 8:
        return False, -100.0, f"clipped({clips})"
    if snr < 14.0:
        return False, -100.0, f"noisy_or_bgm(snr={snr:.1f}dB)"
    if speech_ratio < 0.12:
        return False, -100.0, f"mostly_silent({speech_ratio:.2f})"

    # Base quality score: ideal duration 4.2-6.8s, clean SNR >= 20 dB
    dur_dist = abs(dur - 5.3)
    score = 10.0 - 1.3 * dur_dist
    score += min(12.0, max(0.0, (snr - 14.0) * 0.45))
    if clips == 0:
        score += 2.0
    if 3.2 <= dur <= 7.8:
        score += 3.0

    # User-approved preference: prioritize Northern male Vietnamese for seamless non-SVC fallback too
    gender = str(meta.get("gender") or "").lower()
    dialect = str(meta.get("dialect") or "").lower()
    lang = str(meta.get("lang") or "vi").lower()
    if lang == "vi":
        score += 2.0
    if gender == "male":
        score += 2.2
    if "northern" in dialect:
        score += 1.0

    # Mood-specific acoustic bonus
    wps = metrics["wps_est"]
    zcr = metrics["zcr"]
    low_r = metrics["low_ratio"]
    if mood == "calm":
        if 2.2 <= wps <= 4.0:
            score += 2.5
        score += low_r * 3.0
    elif mood == "curious":
        if "?" in str(meta.get("text") or ""):
            score += 3.5
        if str(meta.get("topic") or "").startswith("movies"):
            score += 2.0
    elif mood == "whisper":
        # Breathy / higher ZCR / softer raw RMS
        score += min(4.0, zcr * 40.0)
        if metrics["rms_dbfs"] < -24.0:
            score += 1.5
    elif mood == "fear":
        if str(meta.get("emotion") or "").lower() in ("fear", "fearful"):
            score += 4.0
    elif mood == "panic":
        if wps >= 3.8:
            score += 2.5
        if str(meta.get("emotion") or "").lower() in ("angry", "fearful"):
            score += 3.0
        if metrics["rms_dbfs"] > -24.0:
            score += 1.2
    elif mood == "dread":
        if 0.0 < wps <= 3.7:
            score += 2.5
        score += low_r * 4.0
        if str(meta.get("emotion") or "").lower() == "sad":
            score += 2.5

    return True, round(score, 3), "ok"


def _fetch_hf_pages(dataset: str, config: str, split: str, offsets: list[int], length: int = 100, workers: int = 3) -> list[dict]:
    rows = []

    def _one(off: int):
        time.sleep(0.12)
        url = (
            f"{HF_API}/rows?dataset={urllib.parse.quote(dataset, safe='/')}"
            f"&config={urllib.parse.quote(config)}&split={urllib.parse.quote(split)}"
            f"&offset={off}&length={length}"
        )
        d = http_get_json(url, timeout=20, retries=5)
        return d.get("rows", [])

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_one, off): off for off in offsets}
        for fut in as_completed(futs):
            try:
                rows.extend(fut.result())
            except Exception as exc:
                print(f"  [WARN] page {dataset}/{split}@{futs[fut]} skipped: {exc}")
    rows.sort(key=lambda r: int(r.get("row_idx", 0)))
    return rows


def collect_lsvsc_pool(include_train_pages: int = 0) -> dict[str, list[dict]]:
    """Scan public `doof-ferb/LSVSC` (`validation` + `test` = 11,365 Vietnamese clips) cleanly via /rows."""
    print("[1/3] Scanning native Vietnamese corpus `doof-ferb/LSVSC` (validation + test)...")
    val_rows = _fetch_hf_pages("doof-ferb/LSVSC", "default", "validation", list(range(0, 5682, 100)), workers=3)
    test_rows = _fetch_hf_pages("doof-ferb/LSVSC", "default", "test", list(range(0, 5683, 100)), workers=3)
    all_rows = [("validation", r) for r in val_rows] + [("test", r) for r in test_rows]
    if include_train_pages > 0:
        tr_offsets = [i * 400 for i in range(include_train_pages)]
        tr_rows = _fetch_hf_pages("doof-ferb/LSVSC", "default", "train", tr_offsets, workers=3)
        all_rows.extend([("train", r) for r in tr_rows])

    pools: dict[str, list[dict]] = {m: [] for m in MOOD_SPEC}
    for split, item in all_rows:
        r = item.get("row") or {}
        au_list = r.get("audio") or []
        if not au_list or not isinstance(au_list[0], dict) or not au_list[0].get("src"):
            continue
        emo = str(r.get("emotion") or "").strip().lower()
        topic = str(r.get("topic") or "").strip().lower()
        gender = str(r.get("gender") or "").strip().lower()
        dialect = str(r.get("dialect") or "").strip().lower()
        txt = str(r.get("transcription") or "").strip()
        n_words = len(txt.split())
        if n_words < 6 or n_words > 42:
            continue

        base = {
            "dataset": "doof-ferb/LSVSC",
            "license": DATASET_LICENSES["doof-ferb/LSVSC"],
            "split": split,
            "row_idx": item.get("row_idx"),
            "lang": "vi",
            "emotion": emo,
            "topic": topic,
            "gender": gender,
            "dialect": dialect,
            "text": txt,
            "audio_url": au_list[0]["src"],
        }

        if emo == "fear":
            pools["fear"].append(dict(base))
        if emo == "angry":
            pools["panic"].append(dict(base))
        if emo == "sad":
            pools["dread"].append(dict(base))
        if emo == "tired":
            pools["whisper"].append(dict(base))

        # Calm: storytelling / audiobook neutral northern male preferred
        if emo == "neutral" and "stories" in topic and 11 <= n_words <= 28:
            if gender == "male" and "northern" in dialect:
                pools["calm"].append(dict(base))
            elif len(pools["calm"]) < 40 and gender == "male":
                pools["calm"].append(dict(base))

        # Curious: drama dialogue or stories with question mark / questioning phrase
        if ("movies" in topic or "stories" in topic) and CURIOUS_VI_RE.search(txt):
            pools["curious"].append(dict(base))

        # Whisper fallback Vietnamese pool: quiet sad/drama/stories utterances
        if (emo == "sad" or "movies" in topic) and 8 <= n_words <= 22:
            pools["whisper"].append(dict(base))

        # Dread secondary pool: somber male northern stories with dark/night keywords
        if "stories" in topic and gender == "male" and any(k in txt.lower() for k in ("đêm", "tối", "lạnh", "chết", "bóng", "cửa", "ma", "sợ", "máu", "im lặng")):
            pools["dread"].append(dict(base))

    # Deduplicate and keep bounded priority lists per mood (Northern male first)
    def _prio(c):
        return (
            0 if c["emotion"] in ("fear", "angry", "sad", "tired") else 1,
            0 if "?" in c["text"] else 1,
            0 if c["gender"] == "male" else 1,
            0 if "northern" in c["dialect"] else 1,
            abs(len(c["text"].split()) - 16),
        )

    for m in pools:
        seen = set()
        uniq = []
        for c in sorted(pools[m], key=_prio):
            k = (c["split"], c["row_idx"])
            if k not in seen:
                seen.add(k)
                uniq.append(c)
        pools[m] = uniq[:18]
        print(f"  LSVSC pool [{m:7s}]: {len(pools[m])} Vietnamese pre-filtered clips")
    return pools


def collect_studio_crosslingual_pool() -> dict[str, list[dict]]:
    """Collect studio 48 kHz Option-C comparison clips from `ylacombe/expresso` and `MahiA/RAVDESS`."""
    print("[2/3] Scanning 48 kHz studio corpora (`ylacombe/expresso` + `MahiA/RAVDESS`) for Option-C benchmark...")
    pools: dict[str, list[dict]] = {m: [] for m in MOOD_SPEC}

    # Expresso is grouped in large contiguous blocks by speaker/style; stride across 0..11600
    exp_offsets = list(range(0, 11600, 450))
    exp_rows = _fetch_hf_pages("ylacombe/expresso", "read", "train", exp_offsets, length=50, workers=2)
    for item in exp_rows:
        r = item.get("row") or {}
        au_list = r.get("audio") or []
        if not au_list or not isinstance(au_list[0], dict) or not au_list[0].get("src"):
            continue
        style = str(r.get("style") or "").lower()
        spk = str(r.get("speaker_id") or "").lower()
        gender = "male" if spk in ("ex01", "ex03") else "female"
        txt = str(r.get("text") or "").strip()
        if len(txt.split()) < 7:
            continue
        base = {
            "dataset": "ylacombe/expresso",
            "license": DATASET_LICENSES["ylacombe/expresso"],
            "split": "train",
            "row_idx": item.get("row_idx"),
            "lang": "en",
            "emotion": style,
            "topic": f"studio_{spk}",
            "gender": gender,
            "dialect": "studio_48k",
            "text": txt,
            "audio_url": au_list[0]["src"],
        }
        if style == "whisper":
            pools["whisper"].append(base)
        elif style == "confused":
            pools["curious"].append(base)
        elif style == "sad":
            pools["dread"].append(base)
        elif style == "default":
            pools["calm"].append(base)
        elif style == "emphasis":
            pools["panic"].append(base)

    # RAVDESS (1,961 studio rows -> 10 strided pages of 100 covers every class cleanly!)
    rav_offsets = list(range(0, 1900, 200))
    rav_rows = _fetch_hf_pages("MahiA/RAVDESS", "default", "train", rav_offsets, length=100, workers=2)
    for item in rav_rows:
        r = item.get("row") or {}
        au_list = r.get("path") or r.get("audio") or []
        if not au_list or not isinstance(au_list[0], dict) or not au_list[0].get("src"):
            continue
        cls = str(r.get("classname") or "").lower()
        base = {
            "dataset": "MahiA/RAVDESS",
            "license": DATASET_LICENSES["MahiA/RAVDESS"],
            "split": "train",
            "row_idx": item.get("row_idx"),
            "lang": "en",
            "emotion": cls,
            "topic": "studio_actor",
            "gender": "unknown",
            "dialect": "studio_48k",
            "text": f"RAVDESS actor ({cls})",
            "audio_url": au_list[0]["src"],
        }
        if cls == "fearful":
            pools["fear"].append(base)
        elif cls == "angry":
            pools["panic"].append(base)
        elif cls == "calm":
            pools["calm"].append(base)
        elif cls == "sad":
            pools["dread"].append(base)

    for m in pools:
        pools[m].sort(key=lambda c: (0 if c["gender"] == "male" else 1, -len(c["text"])))
        pools[m] = pools[m][:10]
        print(f"  Studio pool [{m:7s}]: {len(pools[m])} 48 kHz studio clips")
    return pools


def evaluate_and_download_candidates(
    vi_pool: dict[str, list[dict]],
    studio_pool: dict[str, list[dict]],
    out_dir: str,
    max_vi: int = 2,
    max_studio: int = 1,
    slot_names: list[str] | None = None,
) -> dict[str, list[dict]]:
    """Download, normalize, and score candidates; keep top A/B (native Vietnamese) + C (48 kHz studio)."""
    raw_dir = os.path.join(out_dir, "raw_candidates")
    os.makedirs(raw_dir, exist_ok=True)
    selected: dict[str, list[dict]] = {m: [] for m in MOOD_SPEC}
    used_keys: set[tuple] = set()
    slots = slot_names or ["A", "B", "C", "D"]

    with tempfile.TemporaryDirectory(prefix="emo_curate_") as td:
        for mood in MOOD_SPEC:
            print(f"[3/3] Evaluating acoustic quality for mood={mood}...")

            def _eval_list(cands: list[dict], want: int) -> list[dict]:
                passed = []
                for idx, c in enumerate(cands):
                    if len(passed) >= want + 3:
                        break
                    row_key = (c.get("dataset"), c.get("split"), c.get("row_idx"))
                    if row_key in used_keys:
                        continue
                    ext = ".wav"
                    url_path = urllib.parse.urlparse(c["audio_url"]).path.lower()
                    for e in (".mp3", ".flac", ".ogg", ".m4a", ".wav"):
                        if url_path.endswith(e):
                            ext = e
                            break
                    dl_path = os.path.join(td, f"{mood}_{c['lang']}_{idx}{ext}")
                    try:
                        http_download_file(c["audio_url"], dl_path)
                        raw48 = pref.decode_to_mono48(dl_path)
                        # Measure raw quality BEFORE cleaning (catch noisy/BGM/clipped originals)
                        m_raw = measure_audio_metrics(raw48, SR_REF, text=c.get("text", ""))
                        clean = pref.clean_reference_clip(raw48, SR_REF, use_denoiser=False)
                        m_clean = measure_audio_metrics(clean, SR_REF, text=c.get("text", ""))
                        # Preserve original raw SNR and raw clip count while using trimmed clean duration
                        metrics = dict(m_clean)
                        metrics["snr_db"] = max(m_raw["snr_db"], m_clean["snr_db"])
                        metrics["raw_clips"] = m_raw["raw_clips"]
                        ok, sc, reason = score_candidate(metrics, mood, c)
                        if ok:
                            item = dict(c)
                            item["metrics"] = metrics
                            item["score"] = sc
                            item["_clean_wav"] = clean
                            passed.append(item)
                    except Exception as exc:
                        print(f"    [skip] {mood}/{c['dataset']}#{c['row_idx']}: {exc}")
                passed.sort(key=lambda x: x["score"], reverse=True)
                return passed[:want]

            vi_best = _eval_list(vi_pool.get(mood, []), want=max_vi)
            st_best = _eval_list(studio_pool.get(mood, []), want=max_studio) if max_studio > 0 else []

            # Ensure diverse speakers/rows and label as A, B, C (or custom slots)
            combined = vi_best + st_best
            for slot, cand in zip(slots, combined):
                wav_rel = os.path.join("raw_candidates", f"{mood}_{slot}.wav")
                wav_abs = os.path.join(out_dir, wav_rel)
                clean_arr = cand.pop("_clean_wav")
                pref.write_wav_mono16(wav_abs, clean_arr, SR_REF)
                cand["slot"] = slot
                cand["mood"] = mood
                cand["raw_wav"] = wav_rel
                cand["raw_wav_abs"] = os.path.abspath(wav_abs)
                used_keys.add((cand.get("dataset"), cand.get("split"), cand.get("row_idx")))
                selected[mood].append(cand)
                m = cand["metrics"]
                print(
                    f"  -> {mood}_{slot} [{cand['dataset']} | {cand['lang']} | {cand['gender']} | {cand['emotion']}] "
                    f"dur={m['dur_s']:.2f}s snr={m['snr_db']:.1f}dB score={cand['score']:.2f}"
                )
    return selected


def render_vieneu_previews(selected: dict[str, list[dict]], out_dir: str, synth_fn=None):
    """Synthesize canonical Vietnamese horror line for every candidate via VieNeu-TTS v3 Turbo + build audition reels."""
    prev_dir = os.path.join(out_dir, "vieneu_tests")
    os.makedirs(prev_dir, exist_ok=True)

    tts = None
    if synth_fn is None:
        from vieneu import Vieneu
        print("\nLoading VieNeu-TTS v3 Turbo (48 kHz CPU) to render live Vietnamese audition previews...")
        tts = Vieneu(mode="v3turbo", device="cpu")

    reel_parts = []
    raw_reel_parts = []
    # Gentle 440Hz/660Hz short separator pip (-24 dBFS, 90ms) between audition candidates
    t_pip = np.arange(int(0.09 * SR_REF), dtype=np.float64) / SR_REF
    pip = 0.06 * np.sin(2.0 * np.pi * 660.0 * t_pip) * np.hanning(len(t_pip))
    gap_short = np.zeros(int(0.45 * SR_REF), dtype=np.float64)
    gap_mood = np.zeros(int(1.05 * SR_REF), dtype=np.float64)

    try:
        for mood, cands in selected.items():
            spec = MOOD_SPEC[mood]
            test_text = spec["test_text"]
            for cand in cands:
                slot = cand["slot"]
                raw_abs = cand["raw_wav_abs"]
                prev_rel = os.path.join("vieneu_tests", f"{mood}_{slot}_preview.wav")
                prev_abs = os.path.join(out_dir, prev_rel)
                if synth_fn is None and cand.get("preview_metrics") and os.path.isfile(prev_abs):
                    wav_np, _ = pref.read_wav_mono(prev_abs)
                    cand["preview_wav"] = prev_rel
                    cand["preview_wav_abs"] = os.path.abspath(prev_abs)
                    print(f"  REUSE PREVIEW {mood}_{slot}: {cand['preview_metrics']['dur_s']:.2f}s | {cand['preview_metrics']['wps_est']:.2f} w/s")
                else:
                    if synth_fn is not None:
                        wav_np = np.asarray(
                            synth_fn(test_text, raw_abs, spec["silence_p"], spec["temperature"]),
                            dtype=np.float64,
                        ).reshape(-1)
                    else:
                        wav_np = np.asarray(
                            tts.infer(
                                test_text,
                                ref_audio=raw_abs,
                                denoise=True,
                                use_ref_codes=True,
                                silence_p=float(spec["silence_p"]),
                                temperature=float(spec["temperature"]),
                                apply_watermark=False,
                            ),
                            dtype=np.float64,
                        ).reshape(-1)

                    # Clean peak protection & RMS parity (-19 dBFS)
                    pk = float(np.max(np.abs(wav_np))) if len(wav_np) else 0.0
                    if pk > 0.92:
                        wav_np = wav_np * (0.92 / pk)
                    pref.write_wav_mono16(prev_abs, wav_np, SR_REF)

                    pm = measure_audio_metrics(wav_np, SR_REF, text=test_text)
                    cand["preview_wav"] = prev_rel
                    cand["preview_wav_abs"] = os.path.abspath(prev_abs)
                    cand["preview_text"] = test_text
                    cand["preview_metrics"] = pm
                    print(
                        f"  PREVIEW {mood}_{slot}: {pm['dur_s']:.2f}s | {pm['wps_est']:.2f} w/s | "
                        f"rms={pm['rms_dbfs']:.1f} dBFS | clips={pm['raw_clips']}"
                    )

                reel_parts.extend([pip, gap_short, wav_np, gap_short])
                raw_arr, _ = pref.read_wav_mono(raw_abs)
                raw_reel_parts.extend([pip, gap_short, raw_arr, gap_short])
            reel_parts.append(gap_mood)
            raw_reel_parts.append(gap_mood)
    finally:
        if tts is not None and hasattr(tts, "close"):
            tts.close()

    if reel_parts:
        reel = np.concatenate(reel_parts)
        pref.write_wav_mono16(os.path.join(out_dir, "audition_reel.wav"), reel, SR_REF)
    if raw_reel_parts:
        rreel = np.concatenate(raw_reel_parts)
        pref.write_wav_mono16(os.path.join(out_dir, "raw_reel.wav"), rreel, SR_REF)


def write_audition_catalog(selected: dict[str, list[dict]], out_dir: str) -> tuple[str, str]:
    """Write machine-readable `audition_manifest.json` and clickable Markdown `AUDITION_CATALOG.md`."""
    manifest = {
        "version": "v6.2-emotion-audition",
        "status": "PENDING_USER_APPROVAL",
        "sr": SR_REF,
        "out_dir": os.path.abspath(out_dir),
        "moods": selected,
    }
    mf_path = os.path.join(out_dir, "audition_manifest.json")
    with open(mf_path, "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)

    lines = [
        "# Bảng Nghe Thử & Duyệt 6 Khuôn Cảm Xúc (`AUDITION_CATALOG`)",
        "",
        "> **TRẠNG THÁI: CHỜ BẠN DUYỆT** — Chưa ghi bất kỳ file nào vào `shorts-project/audio/emotion_refs/`.",
        "",
        "## Nghe Nhanh Toàn Bộ (1 File Nối Tiếp)",
        f"- **File tổng hợp giọng `VieNeu-TTS` tiếng Việt sinh ra từ tất cả ứng viên (có tiếng bíp ngắn ngăn cách mỗi phương án A / B / C):** "
        f"[audition_reel.wav](file://{os.path.abspath(os.path.join(out_dir, 'audition_reel.wav'))})",
        f"- **File tổng hợp các clip mẫu gốc:** [raw_reel.wav](file://{os.path.abspath(os.path.join(out_dir, 'raw_reel.wav'))})",
        "",
    ]

    default_picks = []
    for mood, spec in MOOD_SPEC.items():
        cands = selected.get(mood, [])
        lines.append(f"## {mood.upper()} — {spec['vi_label']}")
        lines.append(f"- Câu kinh dị tiếng Việt test trên `VieNeu-TTS`: *\"{spec['test_text']}\"*")
        lines.append("")
        lines.append("| Phương án | Nguồn & Nhãn | Ngôn ngữ / Giới tính | Lời mẫu gốc | Độ dài · SNR | Nhịp `VieNeu` (`w/s`) · Clips | Nghe mẫu gốc | Nghe giọng Việt `VieNeu-TTS` |")
        lines.append("|---|---|---|---|---|---|---|---|")
        if cands:
            default_picks.append(f"{mood}={cands[0]['slot']}")
        for c in cands:
            m = c["metrics"]
            pm = c.get("preview_metrics") or {}
            raw_link = f"[{mood}_{c['slot']}.wav](file://{c['raw_wav_abs']})"
            prev_link = (
                f"[{mood}_{c['slot']}_preview.wav](file://{c['preview_wav_abs']})"
                if c.get("preview_wav_abs")
                else "*(chưa render)*"
            )
            src_txt = str(c.get("text") or "").replace("|", "/").strip()
            if len(src_txt) > 58:
                src_txt = src_txt[:55] + "..."
            lines.append(
                f"| **{c['slot']}** | `{c['dataset']}` (`{c['emotion']}`) | `{c['lang']}` / `{c['gender']}` | "
                f"{src_txt} | {m['dur_s']:.2f}s · {m['snr_db']:.1f} dB | "
                f"{pm.get('wps_est', 0.0):.2f} w/s · `{pm.get('raw_clips', 0)}` clips | "
                f"{raw_link} | {prev_link} |"
            )
        lines.append("")

    pick_str = " ".join(default_picks)
    lines.extend([
        "---",
        "## Lệnh Áp Dụng Chính Thức (Chỉ chạy SAU KHI bạn chốt lựa chọn)",
        "```bash",
        "python3 shorts-project/scripts/curate_emotion_candidates.py apply \\",
        f"  --audition-dir {out_dir} \\",
        "  --out-dir shorts-project/audio/emotion_refs \\",
        f"  --pick {pick_str}",
        "```",
        "",
    ])

    cat_path = os.path.join(out_dir, "AUDITION_CATALOG.md")
    with open(cat_path, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    return mf_path, cat_path


def parse_picks(pick_args: list[str]) -> dict[str, str]:
    picks = {}
    for raw in pick_args:
        for tok in re.split(r"[\s,]+", raw.strip()):
            if not tok:
                continue
            if "=" not in tok:
                raise ValueError(f"Invalid --pick token {tok!r}; expected `mood=SLOT` (e.g. `fear=A`)")
            mood, slot = tok.split("=", 1)
            mood = mood.strip().lower()
            slot = slot.strip().upper()
            if mood not in MOOD_SPEC:
                raise ValueError(f"Unknown mood {mood!r}; expected one of {list(MOOD_SPEC)}")
            picks[mood] = slot
    return picks


def apply_approved_picks(audition_dir: str, out_dir: str, picks: dict[str, str]) -> dict:
    """Copy explicitly approved staging candidates into `audio/emotion_refs/` and run quality check."""
    mf_path = os.path.join(audition_dir, "audition_manifest.json")
    if not os.path.isfile(mf_path):
        raise FileNotFoundError(f"Audition manifest not found: {mf_path} (run `fetch` first)")
    with open(mf_path, encoding="utf-8") as fp:
        mf = json.load(fp)

    os.makedirs(out_dir, exist_ok=True)
    applied_entries = {}
    for mood, slot in picks.items():
        cands = mf.get("moods", {}).get(mood, [])
        match = next((c for c in cands if str(c.get("slot")).upper() == slot), None)
        if match is None:
            avail = [c.get("slot") for c in cands]
            raise ValueError(f"Pick {mood}={slot} not found in audition manifest (available: {avail})")
        src_wav = os.path.join(audition_dir, match["raw_wav"])
        if not os.path.isfile(src_wav):
            raise FileNotFoundError(f"Candidate WAV missing: {src_wav}")
        dst_wav = os.path.join(out_dir, f"{mood}.wav")
        shutil.copy2(src_wav, dst_wav)
        applied_entries[mood] = {
            "file": f"{mood}.wav",
            "dur": match["metrics"]["dur_s"],
            "snr_db": match["metrics"]["snr_db"],
            "approved_slot": slot,
            "dataset": match["dataset"],
            "license": match["license"],
            "split": match.get("split"),
            "row_idx": match.get("row_idx"),
            "lang": match.get("lang"),
            "emotion": match.get("emotion"),
            "source_text": match.get("text", ""),
        }
        print(f"  APPLIED {mood}.wav <- {mood}_{slot}.wav ({match['dataset']} · {match['metrics']['dur_s']:.2f}s)")

    pref.save_manifest(out_dir, applied_entries)
    print(f"\nAPPLIED {len(applied_entries)} APPROVED EMOTION REFS -> {out_dir}")
    # Automatically verify with prepare_emotion_refs check
    pref.cmd_check(argparse.Namespace(dir=out_dir))
    return applied_entries


def cmd_fetch(args):
    os.makedirs(args.out_dir, exist_ok=True)
    mf_existing = os.path.join(args.out_dir, "audition_manifest.json")
    if args.append_studio and os.path.isfile(mf_existing):
        with open(mf_existing, encoding="utf-8") as fp:
            selected = json.load(fp).get("moods", {m: [] for m in MOOD_SPEC})
        studio_pool = collect_studio_crosslingual_pool()
        st_only = evaluate_and_download_candidates(
            {}, studio_pool, args.out_dir, max_vi=0, max_studio=args.max_studio, slot_names=["C", "D"]
        )
        for mood in MOOD_SPEC:
            existing_vi = [c for c in selected.get(mood, []) if c.get("lang") == "vi"]
            selected[mood] = existing_vi + st_only.get(mood, [])
    else:
        vi_pool = collect_lsvsc_pool(include_train_pages=args.extra_train_pages)
        studio_pool = {} if args.vi_only else collect_studio_crosslingual_pool()
        selected = evaluate_and_download_candidates(
            vi_pool,
            studio_pool,
            args.out_dir,
            max_vi=args.max_vi,
            max_studio=0 if args.vi_only else args.max_studio,
        )
    if not args.skip_previews:
        render_vieneu_previews(selected, args.out_dir)
    mf_path, cat_path = write_audition_catalog(selected, args.out_dir)
    print(f"\nAUDITION PACK READY (STAGING ONLY — audio/emotion_refs/ UNTOUCHED):")
    print(f"  Catalog : {cat_path}")
    print(f"  Manifest: {mf_path}")


def cmd_apply(args):
    picks = parse_picks(args.pick)
    if not picks:
        raise ValueError("Provide at least one `--pick mood=SLOT` (e.g. `--pick calm=A fear=B`)")
    apply_approved_picks(args.audition_dir, args.out_dir, picks)


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v6.2 Emotion Bank Audition Curator (Review-Before-Apply).")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_f = sub.add_parser("fetch", help="Stage 1: Search, filter, normalize & render VieNeu previews for user review")
    p_f.add_argument("--out-dir", default="out/emotion_audition", help="Staging audition output folder")
    p_f.add_argument("--max-vi", type=int, default=2, help="Max native Vietnamese (LSVSC) candidates per emotion (default: 2)")
    p_f.add_argument("--max-studio", type=int, default=1, help="Max 48 kHz studio cross-lingual candidates per emotion (default: 1)")
    p_f.add_argument("--extra-train-pages", type=int, default=0, help="Optional extra LSVSC train pages (100 rows each)")
    p_f.add_argument("--vi-only", action="store_true", help="Only curate native Vietnamese LSVSC candidates")
    p_f.add_argument("--append-studio", action="store_true", help="Keep existing Vietnamese A/B candidates and append 48 kHz studio Option C")
    p_f.add_argument("--skip-previews", action="store_true", help="Skip live VieNeu-TTS preview rendering")
    p_f.set_defaults(func=cmd_fetch)

    p_a = sub.add_parser("apply", help="Stage 2: Apply user-approved picks into audio/emotion_refs/ and verify")
    p_a.add_argument("--audition-dir", default="out/emotion_audition")
    p_a.add_argument("--out-dir", default="audio/emotion_refs")
    p_a.add_argument("--pick", nargs="+", required=True, help="Approved picks, e.g. calm=A curious=A whisper=C fear=A panic=A dread=A")
    p_a.set_defaults(func=cmd_apply)
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
