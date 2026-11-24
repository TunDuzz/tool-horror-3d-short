#!/usr/bin/env python3
"""Horror Engine v6.1: Emotion Bank Reference Builder (`audio/emotion_refs/`).

Builds a permanent, reusable 6-clip Emotion Bank (4-7 seconds each, 48 kHz mono, denoised & RMS-normalized)
for zero-shot emotional cloning in `VieNeu-TTS v3 Turbo` (and `F5-TTS-Vietnamese` / `IndexTTS-2`).

Pair with So-VITS-SVC (`-na`): the 6 emotion clips DO NOT need to come from the same speaker!
  1. `VieNeu-TTS` performs each horror act using the matching `audio/emotion_refs/<mood>.wav` clip (real fear, whisper,
     curiosity, panic, dread at 48 kHz with ZERO DSP distortion).
  2. `So-VITS-SVC (-na)` unifies all 6 acts into YOUR single narrator voice while preserving 100% of the emotion & rhythm!

Subcommands:
  python3 scripts/prepare_emotion_refs.py guide
  python3 scripts/prepare_emotion_refs.py cut --src recording.m4a --slice calm=00:01-00:07 --slice whisper=00:10-00:16 --out-dir audio/emotion_refs
  python3 scripts/prepare_emotion_refs.py split-auto --src six_emotions_one_take.m4a --out-dir audio/emotion_refs
  python3 scripts/prepare_emotion_refs.py check --dir audio/emotion_refs
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

SR_REF = 48000

EMOTION_SLOTS = [
    (
        "calm",
        "Trầm lắng, chậm rãi, đều giọng (kể chuyện mở đầu)",
        "Đêm hôm đó trời mưa rất to, cả con hẻm vắng lặng không một bóng người qua lại.",
    ),
    (
        "curious",
        "Tò mò, dò xét, hơi nhấn & lên giọng ở câu hỏi",
        "Khoan đã... tiếng động lạ kia phát ra từ đâu vậy? Có ai đang ở ngoài đó không?",
    ),
    (
        "whisper",
        "Thì thầm thật sát mic, nhẹ hơi gió, chậm và dè chừng",
        "Suỵt... nói nhỏ thôi, đừng thở mạnh, hình như có thứ gì đang đứng ngay sau cánh cửa.",
    ),
    (
        "fear",
        "Sợ hãi, hụt hơi, giọng hơi run và nghẹn vì lo âu",
        "Trời ơi, tay tôi lạnh cóng rồi... cánh cửa đang tự mở ra kìa, đừng lại gần tôi!",
    ),
    (
        "panic",
        "Hoảng loạn, gấp gáp, nói nhanh dồn dập mất bình tĩnh",
        "Chạy mau đi! Đừng ngoái đầu lại! Khóa chặt cửa vào, nó đang lao tới ngay phía sau kia kìa!",
    ),
    (
        "dread",
        "Nặng nề, chậm rợn, hạ giọng lạnh sống lưng chốt cú lật",
        "Và rồi... khi ngọn đèn cuối cùng phụt tắt, tôi biết mình không còn đường thoát nữa.",
    ),
]


def parse_timestamp(ts: str) -> float:
    """Parse `SS.s`, `MM:SS`, `MM:SS.s`, or `HH:MM:SS` into seconds."""
    s = ts.strip()
    parts = s.split(":")
    if len(parts) == 1:
        return float(parts[0])
    if len(parts) == 2:
        return int(parts[0]) * 60.0 + float(parts[1])
    if len(parts) == 3:
        return int(parts[0]) * 3600.0 + int(parts[1]) * 60.0 + float(parts[2])
    raise ValueError(f"Invalid timestamp: {ts!r}")


def parse_slice_spec(spec: str):
    """Parse `mood=START-END` (e.g. `fear=00:25-00:31.5`)."""
    if "=" not in spec:
        raise ValueError(f"Invalid --slice {spec!r}; expected format `mood=START-END`")
    mood, rng_s = spec.split("=", 1)
    mood = re.sub(r"[^a-zA-Z0-9_-]+", "_", mood.strip().lower()).strip("_")
    if "-" not in rng_s:
        raise ValueError(f"Invalid time range in --slice {spec!r}; expected `START-END`")
    a_s, b_s = rng_s.split("-", 1)
    t0, t1 = parse_timestamp(a_s), parse_timestamp(b_s)
    if t1 <= t0:
        raise ValueError(f"Slice end <= start in {spec!r}")
    return mood, t0, t1


def read_wav_mono(path: str):
    with wave.open(path, "rb") as w:
        sr, ch, sw, n = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0
    elif sw == 4:
        x = np.frombuffer(raw, "<i4").astype(np.float64) / float(1 << 31)
    else:
        raise ValueError(f"Unsupported sample width {sw}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def write_wav_mono16(path: str, x: np.ndarray, sr: int = SR_REF):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    q = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(q.tobytes())


def decode_to_mono48(src_path: str, t0: float | None = None, t1: float | None = None) -> np.ndarray:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp_wav = tf.name
    try:
        cmd = ["ffmpeg", "-y", "-v", "error"]
        if t0 is not None:
            cmd.extend(["-ss", f"{t0:.4f}"])
        if t1 is not None:
            cmd.extend(["-to", f"{t1:.4f}"])
        cmd.extend(["-i", src_path, "-ar", str(SR_REF), "-ac", "1", "-c:a", "pcm_s16le", tmp_wav])
        subprocess.run(cmd, check=True)
        x, _ = read_wav_mono(tmp_wav)
        return x
    finally:
        if os.path.exists(tmp_wav):
            os.remove(tmp_wav)


def clean_reference_clip(x: np.ndarray, sr: int = SR_REF, use_denoiser: bool = False) -> np.ndarray:
    """Clean studio reference conditioning: 60 Hz HPF, trim silence, gentle RMS normalize (-19 dBFS), zero clipping."""
    if len(x) < 128:
        return x.astype(np.float64)
    y = x.astype(np.float64)
    # 60 Hz high-pass removes mic handling rumble & AC hum
    sos = signal.butter(2, 60.0 / (0.5 * sr), btype="highpass", output="sos")
    y = signal.sosfilt(sos, y)

    if use_denoiser:
        try:
            from vieneu import Vieneu
            tts = Vieneu(mode="v3turbo", device="cpu")
            y = np.asarray(tts.denoise(y, sr), dtype=np.float64).reshape(-1)
            tts.close()
        except Exception as exc:
            print(f"  [WARN] Optional VieNeu denoiser skipped: {exc}")

    # Trim leading/trailing silence leaving 40ms breath margin
    idx = np.flatnonzero(np.abs(y) > 0.008)
    if len(idx) > 0:
        pad = int(round(0.04 * sr))
        y = y[max(0, int(idx[0]) - pad) : min(len(y), int(idx[-1]) + pad)]

    # Normalize active speech RMS cleanly to -19 dBFS
    active = y[np.abs(y) > 0.008]
    rms = float(np.sqrt(np.mean(active ** 2))) if len(active) > 32 else float(np.sqrt(np.mean(y ** 2)))
    if rms > 1e-6:
        y = y * ((10.0 ** (-19.0 / 20.0)) / rms)
    pk = float(np.max(np.abs(y)))
    if pk > 0.88:
        y *= 0.88 / pk

    # Crisp 10ms edge fades
    nf = min(int(round(0.010 * sr)), len(y) // 4)
    if nf > 1:
        y[:nf] *= np.linspace(0.0, 1.0, nf)
        y[-nf:] *= np.linspace(1.0, 0.0, nf)
    return y


def split_by_long_pauses(x: np.ndarray, sr: int, expected: int = 6) -> list:
    """Split a 1-take recording of `expected` sentences (separated by >= 0.65s pauses) via energy VAD."""
    if expected <= 1 or len(x) < int(0.5 * sr):
        return [x]
    win = max(1, int(0.030 * sr))
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    thr = max(0.008, float(np.percentile(env, 85)) * 0.09)
    silent = env < thr

    min_gap = int(0.45 * sr)
    gaps = []
    i, n = 0, len(x)
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            if (j - i) >= min_gap and i > int(0.25 * sr) and j < n - int(0.25 * sr):
                gaps.append((j - i, (i + j) // 2))
            i = j
        else:
            i += 1

    need = expected - 1
    if len(gaps) >= need:
        chosen = sorted(mid for _, mid in sorted(gaps, key=lambda g: g[0], reverse=True)[:need])
        cuts = [0] + chosen + [n]
    else:
        cuts = [int(round(k * n / expected)) for k in range(expected + 1)]
    return [x[cuts[k] : cuts[k + 1]] for k in range(expected)]


def save_manifest(out_dir: str, entries: dict):
    p = os.path.join(out_dir, "emotion_refs_manifest.json")
    cur = {}
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as fp:
            cur = json.load(fp).get("refs", {})
    cur.update(entries)
    with open(p, "w", encoding="utf-8") as fp:
        json.dump({"version": "v6.1-emotion-refs", "sr": SR_REF, "refs": cur}, fp, ensure_ascii=False, indent=2)


def cmd_guide(_args):
    print("=" * 72)
    print("KỊCH BẢN DIỄN MẪU 35 GIÂY — TẠO BỘ KHUÔN CẢM XÚC VĨNH VIỄN (6 CLIPS)")
    print("Thu 1 lượt trên điện thoại (nghỉ ~1.5 giây giữa mỗi câu, không cần giọng hay,")
    print("chỉ cần diễn đúng nhịp & cảm xúc; So-VITS-SVC -na sẽ đổi về giọng narrator!)")
    print("=" * 72)
    for idx, (slug, desc, text) in enumerate(EMOTION_SLOTS, 1):
        print(f"\n[{idx}/6] {slug}.wav — {desc}")
        print(f'      "{text}"')
    print("\nSau khi thu xong 1 file (VD: emotions.m4a), chạy đúng 1 lệnh:")
    print("  python3 scripts/prepare_emotion_refs.py split-auto --src emotions.m4a --out-dir shorts-project/audio/emotion_refs")
    print("Hoặc cắt từ bất kỳ phim/truyện ma nào bằng:")
    print("  python3 scripts/prepare_emotion_refs.py cut --src source.mp3 --slice whisper=00:12-00:18 --slice fear=01:04-01:10 --out-dir shorts-project/audio/emotion_refs")


def cmd_cut(args):
    if not os.path.isfile(args.src):
        raise FileNotFoundError(f"Source file not found: {args.src}")
    os.makedirs(args.out_dir, exist_ok=True)
    entries = {}
    for spec in args.slice:
        mood, t0, t1 = parse_slice_spec(spec)
        raw = decode_to_mono48(args.src, t0=t0, t1=t1)
        clean = clean_reference_clip(raw, SR_REF, use_denoiser=args.denoise)
        dur = len(clean) / float(SR_REF)
        out_wav = os.path.join(args.out_dir, f"{mood}.wav")
        write_wav_mono16(out_wav, clean, SR_REF)
        warn = " [WARN: ideal 3-8s]" if (dur < 2.5 or dur > 9.5) else " [OK]"
        print(f"  SAVED {mood}.wav ({dur:.2f}s @ 48kHz){warn} <- {t0:.2f}s..{t1:.2f}s")
        entries[mood] = {"file": f"{mood}.wav", "dur": round(dur, 3), "source": os.path.basename(args.src), "range": [t0, t1]}
    save_manifest(args.out_dir, entries)
    print(f"EMOTION REFS READY -> {args.out_dir} ({len(entries)} clips)")


def cmd_split_auto(args):
    if not os.path.isfile(args.src):
        raise FileNotFoundError(f"Source file not found: {args.src}")
    slots = [s.strip().lower() for s in args.moods.split(",") if s.strip()] if args.moods else [m[0] for m in EMOTION_SLOTS]
    os.makedirs(args.out_dir, exist_ok=True)
    full = decode_to_mono48(args.src)
    chunks = split_by_long_pauses(full, SR_REF, expected=len(slots))
    entries = {}
    for mood, ch in zip(slots, chunks):
        clean = clean_reference_clip(ch, SR_REF, use_denoiser=args.denoise)
        dur = len(clean) / float(SR_REF)
        out_wav = os.path.join(args.out_dir, f"{mood}.wav")
        write_wav_mono16(out_wav, clean, SR_REF)
        warn = " [WARN: ideal 3-8s]" if (dur < 2.5 or dur > 9.5) else " [OK]"
        print(f"  SPLIT {mood}.wav ({dur:.2f}s @ 48kHz){warn}")
        entries[mood] = {"file": f"{mood}.wav", "dur": round(dur, 3), "source": os.path.basename(args.src)}
    save_manifest(args.out_dir, entries)
    print(f"AUTO-SPLIT READY -> {args.out_dir} ({len(entries)} emotion clips)")


def cmd_check(args):
    d = args.dir
    if not os.path.isdir(d):
        print(f"EMOTION REFS DIR NOT FOUND: {d} (run `prepare_emotion_refs.py guide` to create one in 3 minutes!)")
        sys.exit(1)
    expected = [m[0] for m in EMOTION_SLOTS]
    found = 0
    print(f"EMOTION BANK STATUS ({d}):")
    for mood in expected:
        p = os.path.join(d, f"{mood}.wav")
        if not os.path.isfile(p):
            print(f"  [MISSING] {mood}.wav")
            continue
        x, sr = read_wav_mono(p)
        dur = len(x) / float(sr)
        pk_db = 20.0 * np.log10(max(float(np.max(np.abs(x))), 1e-9))
        clips = int(np.sum(np.abs(x) >= 0.999))
        status = "OK" if (2.5 <= dur <= 9.5 and clips == 0) else "WARN"
        print(f"  [{status:4s}] {mood:10s} | {dur:5.2f}s | {sr}Hz | peak={pk_db:6.2f} dBFS | clips={clips}")
        found += 1
    print(f"TOTAL READY: {found}/{len(expected)} emotion clips")


def build_parser():
    ap = argparse.ArgumentParser(description="Horror Engine v6.1 Emotion Bank Builder for VieNeu-TTS & So-VITS-SVC (-na).")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_g = sub.add_parser("guide", help="Print 35-second 6-emotion Vietnamese acting script to record once")
    p_g.set_defaults(func=cmd_guide)

    p_c = sub.add_parser("cut", help="Cut exact timestamp slices from any audio/video into 48kHz emotion refs")
    p_c.add_argument("--src", required=True)
    p_c.add_argument("--slice", action="append", required=True, help="Repeatable `mood=START-END` e.g. `--slice whisper=00:12-00:18`")
    p_c.add_argument("--out-dir", default="audio/emotion_refs")
    p_c.add_argument("--denoise", action="store_true", help="Run VieNeu denoiser.onnx on clips")
    p_c.set_defaults(func=cmd_cut)

    p_s = sub.add_parser("split-auto", help="Auto-split a single 1-take 6-emotion recording via silence VAD")
    p_s.add_argument("--src", required=True)
    p_s.add_argument("--moods", default=None, help="Comma-separated mood order (default: calm,curious,whisper,fear,panic,dread)")
    p_s.add_argument("--out-dir", default="audio/emotion_refs")
    p_s.add_argument("--denoise", action="store_true")
    p_s.set_defaults(func=cmd_split_auto)

    p_k = sub.add_parser("check", help="Validate emotion reference clips in audio/emotion_refs/")
    p_k.add_argument("--dir", default="audio/emotion_refs")
    p_k.set_defaults(func=cmd_check)
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
