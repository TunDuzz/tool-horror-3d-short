# Dark-Aware & Directing-Aware Frame-by-Frame QA for Horror 3D videos (9:16 & 16:9 @ 30 fps).
# Checks: specs, loudness, silences, unplanned black/white/frozen/pops, dark readability (luma/p98),
# consecutive shot-scale/angle repetition warnings, and 2 s contact sheets.
# Usage: python scripts/short_qa.py <video.mp4> <outdir> [shots.json]
import json
import os
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

if len(sys.argv) < 3:
    print("Usage: python scripts/short_qa.py <video.mp4> <outdir> [shots.json]", file=sys.stderr)
    sys.exit(1)

vid, out = sys.argv[1], sys.argv[2]
meta = json.load(open(sys.argv[3], encoding="utf-8")) if len(sys.argv) > 3 else {}
shots = meta.get("shots", [])
planned = set()
planned_black_set = set()
flash_win = [meta["flash"]] if meta.get("flash") else []
for a, b in meta.get("xfade", []) + meta.get("planned", []) + flash_win:
    planned.update(range(a - 1, b + 1))
for a, b in meta.get("planned_black", []):
    planned_black_set.update(range(a, b))
    planned.update((a - 1, a, b - 1, b))
for s in shots:
    planned.update((s["a"] - 1, s["a"]))
os.makedirs(out, exist_ok=True)
run = lambda *a: subprocess.run(a, capture_output=True, text=True)
R = []

pr = json.loads(
    run(
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration",
        "-of",
        "json",
        vid,
    ).stdout
)
v = next(s for s in pr["streams"] if s["codec_type"] == "video")
vw, vh = int(v["width"]), int(v["height"])
is_wide = vw > vh
au = [s for s in pr["streams"] if s["codec_type"] == "audio"]
audio_desc = ", ".join(f"{s['codec_name']} {s['sample_rate']} Hz {s['channels']}ch" for s in au) if au else "NONE"
R.append(f"SPECS {vw}x{vh} {v['r_frame_rate']} fps, {v.get('nb_frames')} frames, {float(pr['format']['duration']):.3f} s; audio: {audio_desc}")
if au:
    e = run("ffmpeg", "-i", vid, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-").stderr
    tail = e[e.rfind("Summary:"):]
    I = [l.strip() for l in tail.splitlines() if l.strip().startswith(("I:", "LRA:", "Peak:"))]
    R.append("LOUDNESS " + " | ".join(I))
    e = run("ffmpeg", "-i", vid, "-map", "0:a:0", "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-").stderr
    R.append("SILENCES " + ("; ".join(l.split("] ")[-1] for l in e.splitlines() if "silence_" in l) or "none"))

W, H = (320, 180) if is_wide else (180, 320)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", vid, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
n = len(F)
w_luma = np.array([0.2126, 0.7152, 0.0722], np.float32)
stats = {k: np.empty(n, np.float32) for k in ("mean", "std", "p2", "p98", "sat")}
diff = np.empty(max(0, n - 1), np.float32)
CHUNK = 60
for start in range(0, n, CHUNK):
    end = min(n, start + CHUNK)
    f32 = F[start:end].astype(np.float32) * (1.0 / 255.0)
    lum = (f32 @ w_luma).reshape(end - start, -1)
    mx, mn = f32.max(-1), f32.min(-1)
    sat = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    stats["mean"][start:end] = lum.mean(1)
    stats["std"][start:end] = lum.std(1)
    stats["p2"][start:end] = np.percentile(lum, 2, 1)
    stats["p98"][start:end] = np.percentile(lum, 98, 1)
    stats["sat"][start:end] = sat.reshape(end - start, -1).mean(1)
    if end > start + 1:
        diff[start:end - 1] = np.abs(np.diff(F[start:end].astype(np.int16), axis=0)).mean(axis=(1, 2, 3))
    if end < n:
        diff[end - 1] = np.abs(F[end].astype(np.int16) - F[end - 1].astype(np.int16)).mean()
med = np.array([np.median(diff[max(0, i - 8):i + 9]) for i in range(len(diff))])
pops = [i + 1 for i in range(len(diff)) if diff[i] > 3 * med[i] + 1.0 and (i + 1) not in planned]
black = [i for i in range(n) if stats["mean"][i] < 0.035 and i not in planned_black_set]
planned_black_hits = [i for i in range(n) if stats["mean"][i] < 0.035 and i in planned_black_set]
white = [i for i in range(n) if stats["mean"][i] > 0.93 and i not in planned]
frozen, run_start = [], None
for i in range(len(diff)):
    if diff[i] < 0.02:
        run_start = i if run_start is None else run_start
    else:
        if run_start is not None and i - run_start >= 12:
            if not all(k in planned_black_set for k in range(run_start, i + 1)):
                frozen.append((run_start, i))
        run_start = None
if run_start is not None and len(diff) - run_start >= 12:
    if not all(k in planned_black_set for k in range(run_start, len(diff))):
        frozen.append((run_start, len(diff)))
R.append(f"FRAMES {n}; unplanned black {black[:20]} (planned black {len(planned_black_hits)}f); unplanned white {white[:20]}; frozen spans >=12f {frozen[:20]}")
R.append(f"POPS (unplanned frame-diff spikes > 3x local median): {pops[:40]}")
R.append(f"MOTION mean diff {diff.mean():.2f}; frames with diff<0.3 (held): {int((diff < 0.3).sum())} ({(diff < 0.3).mean() * 100:.0f}%)")

# Directing check: flag consecutive shots repeating the same scale or cutting with almost identical layout
directing_warns = []
for idx in range(1, len(shots)):
    prev_s, cur_s = shots[idx - 1], shots[idx]
    if prev_s.get("scale") and prev_s.get("scale") == cur_s.get("scale"):
        directing_warns.append(f"shot {prev_s['id']}->{cur_s['id']} repeats scale '{cur_s['scale']}'")
    cut_f = cur_s["a"]
    if 2 <= cut_f < n - 2 and cut_f not in planned_black_set:
        # Compare luminance structure (grayscale layout) across cut to catch static-angle filter jump-cuts
        g_prev = (F[cut_f - 2].astype(np.float32) * (1.0 / 255.0)) @ w_luma
        g_cur = (F[cut_f + 2].astype(np.float32) * (1.0 / 255.0)) @ w_luma
        corr = float(np.corrcoef(g_prev.ravel(), g_cur.ravel())[0, 1])
        if np.isfinite(corr) and corr > 0.88:
            directing_warns.append(f"shot {prev_s['id']}->{cur_s['id']} @f{cut_f} near-identical layout corr={corr:.2f} (static-camera jump-cut)")
if directing_warns:
    R.append("DIRECTING_WARNS " + "; ".join(directing_warns))
else:
    R.append("DIRECTING_WARNS none")

R.append("\nPER SHOT  (luma mean / std / p2 / p98 / saturation mean, medians over the shot)")
for s in shots or [{"id": 0, "a": 0, "b": n}]:
    a, b = s["a"], min(s["b"], n)
    if a >= b:
        continue
    med_mean = float(np.median(stats["mean"][a:b]))
    med_p98 = float(np.median(stats["p98"][a:b]))
    warns = []
    if med_p98 < 0.38:
        warns.append("crushed darks p98<0.38")
    if med_mean < 0.08:
        warns.append("too dark mean<0.08")
    tag = f" [{s['scale']}]" if s.get("scale") else ""
    warn_str = f" [WARN: {', '.join(warns)}]" if warns else ""
    R.append(f"  shot {s['id']:>2}{tag:<6} f{a}-{b - 1}: " + " / ".join(f"{np.median(stats[k][a:b]):.3f}" for k in ("mean", "std", "p2", "p98", "sat")) + warn_str)
np.savez(os.path.join(out, "perframe.npz"), diff=diff, **stats)

cw, ch, cols, rows = (192, 108, 6, 10) if is_wide else (108, 192, 10, 6)
for k in range(0, n, 60):
    S = Image.new("RGB", (cw * cols, ch * rows), "black")
    d = ImageDraw.Draw(S)
    for j in range(min(60, n - k)):
        x, y = (j % cols) * cw, (j // cols) * ch
        S.paste(Image.fromarray(F[k + j]).resize((cw, ch)), (x, y))
        d.rectangle([x, y, x + 34, y + 12], fill="black")
        d.text((x + 2, y + 1), str(k + j), fill="yellow")
    S.save(os.path.join(out, f"sheet_{k:04d}.jpg"), quality=85)
with open(os.path.join(out, "report.md"), "w", encoding="utf-8") as fp:
    fp.write("\n".join(R) + "\n")
print("\n".join(R))
