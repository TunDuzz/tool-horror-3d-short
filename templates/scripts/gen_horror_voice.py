# Generate horror narrator voice.wav (48 kHz mono 16-bit) + word-locked words.json.
# Pipeline:
#   1. Parse script (.txt/.md) with optional [PAUSE Xs] and [DEAD SILENCE Xs] directives.
#   2. Single-call edge-tts synthesis (WordBoundary) -> ffmpeg atempo -> 44.1 kHz mono WAV.
#   3. Splice exact silence durations at declared [PAUSE]/[DEAD SILENCE] boundaries & align words.json.
#   4. So-VITS-SVC (`ngan` deep narrator by default) conversion on GPU -> exact sample parity -> dead-silence gate.
#   5. 65 Hz highpass + 48 kHz mono WAV export.
#
# Usage:
#   python scripts/gen_horror_voice.py --script out/<project>/SCRIPT.md --out-dir out/<project>/voice
import argparse
import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
import wave

import edge_tts
import numpy as np

SR_VC = 44100
SR_FINAL = 48000
PAUSE_RE = re.compile(r"(\[(?:PAUSE|DEAD\s+SILENCE)\s+(\d+(?:\.\d+)?)\s*s?\])", re.IGNORECASE)


def norm_tok(tok: str) -> str:
    return re.sub(r"[^\w\u00C0-\u1EF9]", "", tok, flags=re.UNICODE).lower()


def parse_script(path: str):
    """Parse .txt or .md into ordered items: {'kind': 'speech', 'text'} or {'kind': 'pause'|'dead_silence', 'dur'}."""
    raw = open(path, encoding="utf-8").read()
    if raw.startswith("---"):
        raw = re.sub(r"^---\s*\n.*?\n---\s*\n", "", raw, count=1, flags=re.DOTALL)
    raw = re.sub(r"```.*?```", "", raw, flags=re.DOTALL)
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)

    items = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#") or s.startswith(">") or re.fullmatch(r"[-*_]{3,}", s):
            continue
        s = re.sub(r"^[-*+]\s+", "", s)
        s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
        s = re.sub(r"`(.+?)`", r"\1", s)

        parts = PAUSE_RE.split(s)
        i = 0
        while i < len(parts):
            txt = parts[i].strip()
            if txt:
                items.append({"kind": "speech", "text": txt})
            if i + 2 < len(parts):
                tag = parts[i + 1].upper()
                dur = max(0.05, float(parts[i + 2]))
                kind = "dead_silence" if "DEAD" in tag else "pause"
                items.append({"kind": kind, "dur": dur})
            i += 3
    if not any(it["kind"] == "speech" for it in items):
        raise ValueError(f"No spoken lines parsed from {path}")
    return items


async def synth_edge_full(text: str, voice: str, rate: str, out_mp3: str):
    last_err = None
    for attempt in range(1, 5):
        try:
            kwargs = {"boundary": "WordBoundary"}
            if rate and rate != "+0%":
                kwargs["rate"] = rate
            comm = edge_tts.Communicate(text, voice, **kwargs)
            events = []
            with open(out_mp3, "wb") as fp:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        fp.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        s = chunk["offset"] / 1e7
                        d = chunk["duration"] / 1e7
                        events.append({"w": chunk["text"], "s": s, "e": s + d})
            if not events:
                raise RuntimeError("No WordBoundary events returned")
            return events
        except Exception as exc:
            last_err = exc
            await asyncio.sleep(2.0 * attempt)
    raise RuntimeError(f"edge-tts failed after 4 attempts: {last_err}")


def probe_dur(path: str) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        text=True,
    ).strip()
    return float(out)


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
    q = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(q.tobytes())


def align_full_script(speech_chunks: list, raw_events: list, t0: float, speed: float, max_dur_s: float):
    """Align all display tokens per speech chunk onto global WordBoundary events."""
    tts_words = []
    for ev in raw_events:
        s = max(0.0, min(max_dur_s - 0.04, (ev["s"] - t0) / speed))
        e = max(s + 0.04, min(max_dur_s, (ev["e"] - t0) / speed))
        tts_words.append({"w": ev["w"], "s": s, "e": e})

    disp_entries = []
    for ci, ch in enumerate(speech_chunks):
        for tok in ch["text"].split():
            disp_entries.append((ci, tok))

    aligned = []
    if len(disp_entries) == len(tts_words):
        for (ci, disp), w in zip(disp_entries, tts_words):
            aligned.append({"w": disp, "s": w["s"], "e": w["e"], "chunk": ci})
        return aligned

    j = 0
    for ci, disp in disp_entries:
        nt = norm_tok(disp)
        matched = None
        for k in range(j, min(len(tts_words), j + 5)):
            if norm_tok(tts_words[k]["w"]) == nt:
                matched = k
                break
        if matched is not None:
            w = tts_words[matched]
            aligned.append({"w": disp, "s": w["s"], "e": w["e"], "chunk": ci})
            j = matched + 1
        elif j < len(tts_words):
            w = tts_words[j]
            aligned.append({"w": disp, "s": w["s"], "e": w["e"], "chunk": ci})
            j += 1
        elif aligned:
            pe = aligned[-1]["e"]
            aligned.append({"w": disp, "s": pe, "e": min(max_dur_s, pe + 0.12), "chunk": ci})
    return aligned


def splice_pauses(samples: np.ndarray, sr: int, aligned: list, pause_markers: list):
    """Splice exact silence durations at pause boundaries between chunks and shift subsequent timestamps."""
    chunk_last_word = {}
    for idx, w in enumerate(aligned):
        chunk_last_word[w["chunk"]] = idx

    out_segs = []
    dead_silences = []
    cur_sample = 0
    fade = max(1, int(round(0.008 * sr)))

    markers = sorted(pause_markers, key=lambda m: m["after_chunk"])
    word_shifts = [0.0] * len(aligned)
    active_shift = 0.0
    m_ptr = 0

    for idx, w in enumerate(aligned):
        word_shifts[idx] = active_shift
        while m_ptr < len(markers):
            mk = markers[m_ptr]
            end_w_idx = chunk_last_word.get(mk["after_chunk"], -1)
            if idx != end_w_idx or idx + 1 >= len(aligned):
                break
            t_a = w["e"]
            t_b = aligned[idx + 1]["s"]
            gap = max(0.0, t_b - t_a)
            pad = min(0.055, gap * 0.35)
            cut_a = int(round((t_a + pad) * sr))
            cut_b = int(round((t_b - pad) * sr))
            if cut_b < cut_a:
                cut_a = cut_b = int(round(0.5 * (t_a + t_b) * sr))
            cut_a = max(cur_sample, min(len(samples), cut_a))
            cut_b = max(cut_a, min(len(samples), cut_b))

            seg = samples[cur_sample:cut_a].copy()
            if len(seg) >= fade:
                seg[-fade:] *= np.linspace(1.0, 0.0, fade)
            out_segs.append(seg)

            n_sil = int(round(mk["dur"] * sr))
            sil_start = sum(len(s) for s in out_segs) / float(sr)
            out_segs.append(np.zeros(n_sil, dtype=np.float64))
            sil_dur = n_sil / float(sr)
            if mk["kind"] == "dead_silence":
                dead_silences.append({"s": round(sil_start, 4), "e": round(sil_start + sil_dur, 4)})

            removed_dur = (cut_b - cut_a) / float(sr)
            active_shift += sil_dur - removed_dur
            cur_sample = cut_b
            m_ptr += 1

    out_segs.append(samples[cur_sample:].copy())

    rebuilt = []
    prev_was_sil = False
    for s_arr in out_segs:
        if len(s_arr) == 0:
            continue
        if prev_was_sil and np.any(s_arr):
            arr = s_arr.copy()
            f_in = min(fade, len(arr))
            arr[:f_in] *= np.linspace(0.0, 1.0, f_in)
            rebuilt.append(arr)
        else:
            rebuilt.append(s_arr)
        prev_was_sil = not np.any(s_arr)

    shifted_words = []
    for w, sh in zip(aligned, word_shifts):
        shifted_words.append({
            "w": w["w"],
            "s": round(w["s"] + sh, 4),
            "e": round(w["e"] + sh, 4),
            "chunk": w["chunk"],
        })
    return np.concatenate(rebuilt), shifted_words, dead_silences


def gate_dead_silences(samples: np.ndarray, sr: int, dead_silences: list):
    out = samples.copy()
    n = len(out)
    fade = max(1, int(round(0.015 * sr)))
    for ds in dead_silences:
        a = max(0, int(round(ds["s"] * sr)))
        b = min(n, int(round(ds["e"] * sr)))
        if b <= a:
            continue
        fa = min(fade, (b - a) // 3)
        if fa > 0:
            out[a : a + fa] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0, 1, fa)))
            out[a + fa : b - fa] = 0.0
            out[b - fa : b] *= 0.5 * (1.0 - np.cos(np.pi * np.linspace(0, 1, fa)))
        else:
            out[a:b] = 0.0
    return out


def main():
    ap = argparse.ArgumentParser(description="Generate horror narrator voice.wav + words.json using edge-tts + So-VITS-SVC.")
    ap.add_argument("--script", required=True, help="Path to narration script (.txt or .md)")
    ap.add_argument("--out-dir", required=True, help="Output directory for voice.wav and words.json")
    ap.add_argument("--base-voice", default="vi-VN-NamMinhNeural", help="edge-tts base voice")
    ap.add_argument("--rate", default="+0%", help="edge-tts SSML rate string (keep +0%% for vi-VN-NamMinhNeural)")
    ap.add_argument("--speed", type=float, default=0.86, help="ffmpeg atempo speed before VC (default 0.86 for ~2.9-3.2 words/s)")
    ap.add_argument("--lead-silence", type=float, default=0.08, help="Initial lead silence before first word (s)")
    ap.add_argument("--tail-silence", type=float, default=0.35, help="Trailing tail silence after last word (s)")
    ap.add_argument("--fps", type=int, default=30, help="Timeline FPS for total_frames")
    ap.add_argument("--out-wav", default="voice.wav", help="Output WAV filename inside --out-dir (default voice.wav)")

    ap.add_argument("--vc-venv", default="D:/voice-engine/venv", help="Path to So-VITS-SVC venv root")
    ap.add_argument("--vc-model", default="D:/voice-engine/models/ngan/G_1001.pth", help="So-VITS-SVC generator checkpoint")
    ap.add_argument("--vc-config", default="D:/voice-engine/models/ngan/config.json", help="So-VITS-SVC config.json")
    ap.add_argument("--vc-cache-root", default="D:/voice-engine", help="Root dir holding cache/{hf,torch,xdg} and tmp/")
    ap.add_argument("--speaker", default="ngan", help="Target speaker key in config.json")
    ap.add_argument("--f0-method", default="parselmouth", choices=["crepe", "crepe-tiny", "parselmouth", "dio", "harvest"])
    ap.add_argument("--transpose", type=int, default=-5, help="Semitone transpose when --no-auto-predict-f0 is used (default -5)")
    ap.add_argument("--auto-predict-f0", action=argparse.BooleanOptionalAction, default=True, help="Auto F0 prediction (default on; pass --no-auto-predict-f0 for fixed transpose)")
    ap.add_argument("--noise-scale", type=float, default=0.30)
    ap.add_argument("--pad-seconds", type=float, default=0.25)
    ap.add_argument("--max-chunk-seconds", type=float, default=20.0)
    ap.add_argument("--no-vc", action="store_true", help="Skip So-VITS-SVC voice conversion (plain edge-tts)")
    ap.add_argument("--words-ts", default=None, help="Optional path to write TypeScript words.ts")
    ap.add_argument("--keep-temp", action="store_true", help="Keep intermediate TTS / raw VC WAVs")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    items = parse_script(args.script)

    speech_chunks = []
    pause_markers = []
    for it in items:
        if it["kind"] == "speech":
            txt = it["text"].strip()
            speech_chunks.append({"text": txt})
        elif speech_chunks:
            prev = speech_chunks[-1]["text"]
            if prev and prev[-1] not in ".!?,;:…":
                speech_chunks[-1]["text"] = prev + "."
            pause_markers.append({"after_chunk": len(speech_chunks) - 1, "kind": it["kind"], "dur": it["dur"]})

    full_text = " ".join(ch["text"] for ch in speech_chunks)

    cache_tmp = os.path.join(args.vc_cache_root, "tmp")
    tmp_dir = tempfile.mkdtemp(prefix="hvoice_", dir=cache_tmp if os.path.isdir(cache_tmp) else None)
    try:
        raw_mp3 = os.path.join(tmp_dir, "tts_raw.mp3")
        base_wav = os.path.join(tmp_dir, "tts_base.wav")
        raw_events = asyncio.run(synth_edge_full(full_text, args.base_voice, args.rate, raw_mp3))
        raw_dur = probe_dur(raw_mp3)

        t0 = max(0.0, raw_events[0]["s"] - args.lead_silence * args.speed)
        t1 = min(raw_dur, raw_events[-1]["e"] + args.tail_silence * args.speed)
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-ss", f"{t0:.4f}", "-to", f"{t1:.4f}", "-i", raw_mp3,
                "-af", f"atempo={args.speed:.5f}",
                "-ar", str(SR_VC), "-ac", "1", "-sample_fmt", "s16",
                base_wav,
            ],
            check=True,
        )

        base_samples, _ = read_wav_mono(base_wav)
        base_dur = len(base_samples) / float(SR_VC)
        aligned = align_full_script(speech_chunks, raw_events, t0, args.speed, base_dur)
        tts_44k, shifted_words, dead_silences = splice_pauses(base_samples, SR_VC, aligned, pause_markers)

        tts_wav = os.path.join(args.out_dir, "voice_tts.wav") if args.keep_temp else os.path.join(tmp_dir, "voice_tts.wav")
        write_wav_mono16(tts_wav, tts_44k, SR_VC)

        if args.no_vc:
            vc_44k = tts_44k
            vc_label = None
        else:
            svc_exe = os.path.join(args.vc_venv, "Scripts", "svc.exe")
            if not os.path.isfile(svc_exe):
                raise FileNotFoundError(f"svc.exe not found at {svc_exe}")
            if not os.path.isfile(args.vc_model) or not os.path.isfile(args.vc_config):
                raise FileNotFoundError(f"Missing VC model/config: {args.vc_model} / {args.vc_config}")

            vc_raw_wav = os.path.join(args.out_dir, "voice_vc_raw.wav") if args.keep_temp else os.path.join(tmp_dir, "voice_vc_raw.wav")
            vc_env = os.environ.copy()
            vc_env["HF_HOME"] = os.path.join(args.vc_cache_root, "cache", "hf")
            vc_env["TORCH_HOME"] = os.path.join(args.vc_cache_root, "cache", "torch")
            vc_env["XDG_CACHE_HOME"] = os.path.join(args.vc_cache_root, "cache", "xdg")
            vc_env["TEMP"] = cache_tmp if os.path.isdir(cache_tmp) else vc_env.get("TEMP", "")
            vc_env["TMP"] = cache_tmp if os.path.isdir(cache_tmp) else vc_env.get("TMP", "")
            vc_env["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"

            cmd = [
                svc_exe, "infer", tts_wav,
                "-o", vc_raw_wav,
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

            t_start = time.time()
            subprocess.run(cmd, env=vc_env, check=True)
            print(f"So-VITS-SVC conversion done in {time.time() - t_start:.1f}s")

            vc_44k, vc_sr = read_wav_mono(vc_raw_wav)
            if vc_sr != SR_VC:
                raise ValueError(f"Expected {SR_VC} Hz from svc infer, got {vc_sr}")
            n_target = len(tts_44k)
            if len(vc_44k) > n_target:
                vc_44k = vc_44k[:n_target]
            elif len(vc_44k) < n_target:
                vc_44k = np.pad(vc_44k, (0, n_target - len(vc_44k)))
            vc_label = os.path.basename(args.vc_model)

        if dead_silences:
            vc_44k = gate_dead_silences(vc_44k, SR_VC, dead_silences)

        gated_wav = os.path.join(tmp_dir, "voice_gated_44k.wav")
        write_wav_mono16(gated_wav, vc_44k, SR_VC)

        final_wav = os.path.join(args.out_dir, args.out_wav)
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", gated_wav,
                "-af", "highpass=f=45",
                "-ar", str(SR_FINAL), "-ac", "1", "-sample_fmt", "s16",
                final_wav,
            ],
            check=True,
        )

        final_samples, _ = read_wav_mono(final_wav)
        final_dur = len(final_samples) / float(SR_FINAL)
        total_frames = int(math.ceil((final_dur + 0.35) * args.fps))

        sentences = []
        for ci, ch in enumerate(speech_chunks):
            cw = [w for w in shifted_words if w["chunk"] == ci]
            if cw:
                sentences.append({"sent": ci + 1, "s": cw[0]["s"], "e": cw[-1]["e"], "text": ch["text"]})

        clean_words = [{"w": w["w"], "s": w["s"], "e": w["e"]} for w in shifted_words]
        ds_total = sum(d["e"] - d["s"] for d in dead_silences)
        wps = round(len(clean_words) / max(0.1, final_dur - ds_total), 2)

        payload = {
            "voice": args.base_voice,
            "vc_model": vc_label,
            "speaker": None if args.no_vc else args.speaker,
            "speed": round(args.speed, 4),
            "dur": round(final_dur, 4),
            "fps": args.fps,
            "total_frames": total_frames,
            "words_per_sec": wps,
            "words": clean_words,
            "sentences": sentences,
            "dead_silences": dead_silences,
        }
        words_json = os.path.join(args.out_dir, "words.json")
        with open(words_json, "w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)

        if args.words_ts:
            os.makedirs(os.path.dirname(os.path.abspath(args.words_ts)), exist_ok=True)
            with open(args.words_ts, "w", encoding="utf-8") as fp:
                fp.write("// Auto-generated by scripts/gen_horror_voice.py\n")
                fp.write(f"export const VOICE_DUR = {round(final_dur, 4)};\n")
                fp.write(f"export const TOTAL_FRAMES = {total_frames};\n")
                fp.write("export type WordTiming = { w: string; s: number; e: number };\n")
                fp.write("export const WORDS: WordTiming[] = " + json.dumps(clean_words, ensure_ascii=False) + ";\n")

        print(f"VOICE OK -> {final_wav} ({final_dur:.3f}s, {total_frames}f @ {args.fps}fps, {len(clean_words)} words, {wps:.2f} w/s)")
        for sb in sentences:
            print(f"  S{sb['sent']:02d} [{sb['s']:6.2f}s..{sb['e']:6.2f}s] {sb['text'][:65]}")
        for ds in dead_silences:
            print(f"  DEAD_SILENCE [{ds['s']:6.2f}s..{ds['e']:6.2f}s]")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
