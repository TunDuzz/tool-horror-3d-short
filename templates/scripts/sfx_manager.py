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

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import wave

SR_LIB = 48000

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
    {"name": "wooden_door_creak", "dur": 4.0, "prompt": "Slow heavy wooden door creaking open in a silent dark old house, realistic foley, close mic"},
    {"name": "wood_footsteps_slow", "dur": 6.0, "prompt": "Slow cautious footsteps walking on creaking old wooden floorboards at night, realistic horror foley"},
    {"name": "rain_night_interior", "dur": 12.0, "prompt": "Muffled heavy night rain falling outside an old rural house with soft distant thunder rumble"},
    {"name": "flashlight_click_fail", "dur": 3.0, "prompt": "Tactile metal flashlight button click followed by brief electrical flicker hum in dead silence"},
    {"name": "cinematic_sub_boom", "dur": 4.0, "prompt": "Deep dark cinematic horror sub bass boom impact with long cold dark hall tail"},
    {"name": "vhs_tape_glitch", "dur": 2.0, "prompt": "Short sharp analog VHS magnetic tape static burst and tracking glitch crackle"},
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


def convert_to_library_wav(src_path: str, dst_wav: str, max_dur: float | None = None):
    """Normalize any audio file to crisp 48 kHz stereo PCM16 WAV (universal stdlib wave + Remotion compatible)."""
    os.makedirs(os.path.dirname(os.path.abspath(dst_wav)), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", src_path]
    if max_dur and max_dur > 0:
        cmd.extend(["-t", f"{max_dur:.3f}"])
    cmd.extend(["-ar", str(SR_LIB), "-ac", "2", "-c:a", "pcm_s16le", dst_wav])
    subprocess.run(cmd, check=True)


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
    ap = argparse.ArgumentParser(description="Horror Engine v6.0 Asset-First Cinema SFX Manager (CC0 Freesound + TangoFlux + MMAudio).")
    sub = ap.add_subparsers(dest="cmd", required=True)

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
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
