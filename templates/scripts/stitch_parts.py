# Stitch rendered 1-minute horror parts into a seamless long-form episode (supports both 9:16 and 16:9).
# Usage: python scripts/stitch_parts.py <parts_dir_or_manifest.json> <out_full.mp4> [--videos-dir DIR] [--xfade 0.25] [--normalize] [--target-lufs -15.0]
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile


def natural_part_key(name):
    m = re.search(r"p(\d+)", name, re.IGNORECASE) or re.search(r"(\d+)", name)
    return (int(m.group(1)) if m else 10**9, name)


def probe_video(path):
    r = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "stream=codec_type,width,height,r_frame_rate,sample_rate,channels:format=duration",
            "-of", "json", path,
        ],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(r.stdout)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    if not v:
        raise ValueError(f"No video stream in {path}")
    return {
        "path": path,
        "dur": float(data["format"]["duration"]),
        "width": int(v["width"]),
        "height": int(v["height"]),
        "fps": v["r_frame_rate"],
        "has_audio": a is not None,
    }


def parse_transition(spec, default_fade):
    if not spec:
        return ("cut", 0.0) if default_fade <= 0 else ("fade", default_fade)
    s = str(spec).strip().lower()
    if s == "cut":
        return ("cut", 0.0)
    if ":" in s:
        kind, dur_s = s.split(":", 1)
        d = float(dur_s)
    else:
        kind, d = s, (default_fade if default_fade > 0 else 0.25)
    if kind in ("blackout", "fadeblack", "black"):
        return ("fadeblack", max(0.05, d))
    if kind in ("fade", "xfade", "dissolve"):
        return ("fade", max(0.05, d))
    raise ValueError(f"Unsupported transition spec: {spec}")


def resolve_inputs(source, videos_dir, default_fade):
    items = []
    if os.path.isdir(source):
        # Discover pXX/final.mp4 or pXX_final.mp4 or *.mp4
        candidates = []
        for entry in sorted(os.listdir(source), key=natural_part_key):
            full = os.path.join(source, entry)
            if os.path.isdir(full):
                f_mp4 = os.path.join(full, "final.mp4")
                if os.path.isfile(f_mp4):
                    candidates.append(f_mp4)
            elif entry.lower().endswith(".mp4") and "full" not in entry.lower():
                candidates.append(full)
        if not candidates:
            raise FileNotFoundError(f"No part MP4 files found inside {source}")
        for idx, path in enumerate(candidates):
            items.append({"file": path, "transition_out": "cut" if idx == len(candidates) - 1 else None})
    else:
        with open(source, encoding="utf-8") as fp:
            data = json.load(fp)
        base_dir = videos_dir or os.path.dirname(os.path.abspath(source))
        raw_parts = data.get("parts", data if isinstance(data, list) else [])
        if not raw_parts:
            raise ValueError(f"No parts array found in {source}")
        for idx, p in enumerate(raw_parts):
            f_path = p.get("file") or p.get("video")
            if not f_path:
                pid = int(p.get("part", idx + 1))
                for rel in (f"p{pid:02d}/final.mp4", f"p{pid:02d}_final.mp4", f"p{pid:02d}.mp4"):
                    cand = os.path.join(base_dir, rel)
                    if os.path.isfile(cand):
                        f_path = cand
                        break
            elif not os.path.isabs(f_path):
                f_path = os.path.join(base_dir, f_path)
            if not f_path or not os.path.isfile(f_path):
                raise FileNotFoundError(f"Missing video for part {idx + 1}: {f_path}")
            tr = p.get("transition_out") or p.get("transition_to_next")
            items.append({"file": f_path, "transition_out": tr})

    resolved = []
    for idx, it in enumerate(items):
        meta = probe_video(it["file"])
        if not meta["has_audio"]:
            raise ValueError(f"Part {it['file']} has no audio stream (mux audio first!)")
        tr_kind, tr_dur = parse_transition(it["transition_out"], default_fade) if idx < len(items) - 1 else ("cut", 0.0)
        resolved.append({**meta, "tr_kind": tr_kind, "tr_dur": tr_dur})
    return resolved


def run_loudness_report(path):
    e = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    tail = e[e.rfind("Summary:"):]
    lines = [l.strip() for l in tail.splitlines() if l.strip().startswith(("I:", "LRA:", "Peak:"))]
    return " | ".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Stitch rendered 1-min horror parts into an 8-10 min episode.")
    ap.add_argument("source", help="Directory containing pXX/final.mp4 or JSON manifest / OUTLINE.json")
    ap.add_argument("output", help="Output stitched MP4 path")
    ap.add_argument("--videos-dir", default=None, help="Directory holding pXX/final.mp4 when source is OUTLINE.json")
    ap.add_argument("--xfade", type=float, default=0.0, help="Default crossfade seconds when transition not specified (default 0 = cut)")
    ap.add_argument("--normalize", action="store_true", help="Run loudnorm pass to match --target-lufs")
    ap.add_argument("--target-lufs", type=float, default=-15.0, help="Target integrated LUFS when --normalize is enabled")
    args = ap.parse_args()

    parts = resolve_inputs(args.source, args.videos_dir, args.xfade)
    out_dir = os.path.dirname(os.path.abspath(args.output))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Verify uniform dimensions
    w0, h0 = parts[0]["width"], parts[0]["height"]
    for p in parts[1:]:
        if (p["width"], p["height"]) != (w0, h0):
            raise ValueError(f"Resolution mismatch: {p['path']} is {p['width']}x{p['height']}, expected {w0}x{h0}")

    all_cuts = all(p["tr_kind"] == "cut" for p in parts[:-1])
    if len(parts) == 1:
        subprocess.run(["ffmpeg", "-y", "-i", parts[0]["path"], "-c", "copy", args.output], check=True)
    elif all_cuts and not args.normalize:
        # Fast lossless concat when every boundary is a clean cut
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
            for p in parts:
                safe_p = os.path.abspath(p["path"]).replace("\\", "/").replace("'", "'\\''")
                tf.write(f"file '{safe_p}'\n")
            list_path = tf.name
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", args.output],
                check=True,
            )
        finally:
            os.remove(list_path)
    else:
        # Exact sample-locked filter_complex supporting mixed cuts, crossfades, and fade-through-black
        cmd = ["ffmpeg", "-y"]
        for p in parts:
            cmd.extend(["-i", p["path"]])

        filters = []
        for i in range(len(parts)):
            filters.append(f"[{i}:v]setpts=PTS-STARTPTS,format=yuv420p[v{i}]")
            filters.append(f"[{i}:a]asetpts=PTS-STARTPTS[a{i}]")

        v_cur = "[v0]"
        a_cur = "[a0]"
        cum_dur = parts[0]["dur"]

        for i in range(len(parts) - 1):
            tr_kind = parts[i]["tr_kind"]
            d = parts[i]["tr_dur"]
            next_dur = parts[i + 1]["dur"]
            v_out = f"[vx{i}]"
            a_out = f"[ax{i}]"

            if tr_kind == "cut" or d <= 0.0:
                # 8ms micro-declick fade at seam without changing duration -> 0.000s A/V drift
                filters.append(f"{v_cur}[v{i + 1}]concat=n=2:v=1:a=0{v_out}")
                filters.append(f"{a_cur}afade=t=out:st={max(0.0, cum_dur - 0.008):.4f}:d=0.008[acur_d{i}]")
                filters.append(f"[a{i + 1}]afade=t=in:st=0:d=0.008[anext_d{i}]")
                filters.append(f"[acur_d{i}][anext_d{i}]concat=n=2:v=0:a=1{a_out}")
                cum_dur += next_dur
            else:
                d = min(d, max(0.05, cum_dur * 0.4), max(0.05, next_dur * 0.4))
                offset = max(0.0, cum_dur - d)
                filters.append(f"{v_cur}[v{i + 1}]xfade=transition={tr_kind}:duration={d:.4f}:offset={offset:.4f}{v_out}")
                filters.append(f"{a_cur}[a{i + 1}]acrossfade=d={d:.4f}:c1=tri:c2=tri{a_out}")
                cum_dur = cum_dur + next_dur - d

            v_cur = v_out
            a_cur = a_out

        if args.normalize:
            filters.append(f"{a_cur}loudnorm=I={args.target_lufs}:TP=-1.2:LRA=8[a_final]")
            a_cur = "[a_final]"

        cmd.extend([
            "-filter_complex", ";".join(filters),
            "-map", v_cur, "-map", a_cur,
            "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-r", "30",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            args.output,
        ])
        subprocess.run(cmd, check=True)

    final_meta = probe_video(args.output)
    loud = run_loudness_report(args.output)
    print(f"STITCHED {len(parts)} parts -> {args.output} ({final_meta['width']}x{final_meta['height']}, {final_meta['dur']:.2f}s)")
    if loud:
        print(f"LOUDNESS {loud}")


if __name__ == "__main__":
    main()
