#!/usr/bin/env python3
"""Horror Engine v5.0: Cross-Platform Workspace Synchronizer (`templates/` -> `shorts-project/`).

Replaces 12 manual copy commands with one safe, idempotent CLI that syncs engine modules, procedural audio DSP,
automation/QA scripts, and project configs while NEVER deleting or overwriting user story folders in `src/<story>/`.

Usage:
  python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo
  python3 templates/scripts/sync_workspace.py --target shorts-project --include-demo --check
"""

import argparse
import filecmp
import os
import shutil
import sys


def resolve_templates_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    # Expected layout: <repo>/templates/scripts/sync_workspace.py
    cand = os.path.abspath(os.path.join(here, ".."))
    if os.path.isdir(os.path.join(cand, "engine")):
        return cand
    raise FileNotFoundError(f"Could not locate templates/ directory relative to {here}")


def collect_sync_pairs(templates_root: str, target_dir: str, include_demo: bool, force_root: bool, gemini_out: str | None):
    pairs = []

    def add_dir(src_sub: str, dst_sub: str, exts: tuple | None = None):
        src_d = os.path.join(templates_root, src_sub)
        dst_d = os.path.join(target_dir, dst_sub)
        if not os.path.isdir(src_d):
            return
        for fname in sorted(os.listdir(src_d)):
            if fname.startswith("__") or fname.endswith(".pyc"):
                continue
            sp = os.path.join(src_d, fname)
            if not os.path.isfile(sp):
                continue
            if exts and not fname.endswith(exts):
                continue
            pairs.append((sp, os.path.join(dst_d, fname)))

    add_dir("engine", os.path.join("src", "engine"), (".ts", ".tsx"))
    add_dir("audio", "audio", (".py",))
    add_dir("scripts", "scripts", (".py", ".mjs"))

    # Core project manifests & asset ambient declarations (always safe to keep in sync)
    for fname in ("package.json", "tsconfig.json", "requirements.txt"):
        sp = os.path.join(templates_root, "project", fname)
        if os.path.isfile(sp):
            pairs.append((sp, os.path.join(target_dir, fname)))
    assets_dts = os.path.join(templates_root, "project", "assets.d.ts")
    if os.path.isfile(assets_dts):
        pairs.append((assets_dts, os.path.join(target_dir, "src", "assets.d.ts")))

    # v11.0 Single-Source-of-Truth Pipeline Constitution
    const_sp = os.path.join(templates_root, "pipeline_constitution.json")
    if os.path.isfile(const_sp):
        pairs.append((const_sp, os.path.join(target_dir, "pipeline_constitution.json")))

    # Entry files: protect custom user Root.tsx registrations unless missing or --force-root
    for fname in ("index.ts", "Root.tsx"):
        sp = os.path.join(templates_root, "project", fname)
        dp = os.path.join(target_dir, "src", fname)
        if os.path.isfile(sp) and (force_root or not os.path.isfile(dp)):
            pairs.append((sp, dp))

    if include_demo:
        add_dir("horror-lab-v3", os.path.join("src", "horror-lab-v3"), (".ts", ".tsx", ".json"))

    if gemini_out:
        sp = os.path.join(templates_root, "project", "GEMINI.md")
        if os.path.isfile(sp):
            pairs.append((sp, gemini_out))

    return pairs


def main(argv=None):
    ap = argparse.ArgumentParser(description="Synchronize Horror Engine v5.0 templates/ into shorts-project/.")
    ap.add_argument("--templates", default=None, help="Path to templates/ root (auto-detected by default)")
    ap.add_argument("--target", default="shorts-project", help="Target Remotion workspace directory (default: shorts-project)")
    ap.add_argument("--include-demo", action="store_true", help="Also sync templates/horror-lab-v3 into src/horror-lab-v3")
    ap.add_argument("--force-root", action="store_true", help="Also overwrite existing src/Root.tsx and src/index.ts")
    ap.add_argument("--gemini-out", default=None, help="Optional destination path to sync templates/project/GEMINI.md")
    ap.add_argument("--check", action="store_true", help="Dry-run drift check: exit non-zero if any tracked file differs")
    args = ap.parse_args(argv)

    t_root = os.path.abspath(args.templates) if args.templates else resolve_templates_root()
    target = os.path.abspath(args.target)
    pairs = collect_sync_pairs(t_root, target, args.include_demo, args.force_root, args.gemini_out)

    drifted = []
    copied = 0
    for src, dst in pairs:
        same = os.path.isfile(dst) and filecmp.cmp(src, dst, shallow=False)
        if not same:
            drifted.append((src, dst))
            if not args.check:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
                copied += 1

    if args.check:
        if drifted:
            print(f"WORKSPACE DRIFT DETECTED ({len(drifted)} files out of sync with {t_root}):")
            for src, dst in drifted:
                print(f"  DIFF: {os.path.relpath(dst, target)} <- {os.path.relpath(src, t_root)}")
            sys.exit(1)
        print(f"SYNC CHECK OK: {len(pairs)} files in '{args.target}' match templates/ 100%.")
        return

    print(f"SYNC OK: updated {copied}/{len(pairs)} files in '{args.target}' (user project folders untouched).")


if __name__ == "__main__":
    main()
