# Validate external series state (OUTLINE.json, CONTINUITY.json, shared/assets.ts ANCHORS) before building Part N.
# Usage: python scripts/validate_continuity.py <path/to/src/<episode>> [--part N]
import argparse
import json
import os
import re
import sys

VALID_LIGHTS = {"warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"}
VALID_ASPECTS = {"9:16", "16:9"}
VALID_TRANSITION_PREFIXES = ("cut", "fade", "xfade", "blackout", "fadeblack", "match_cut")


def extract_anchors(assets_path):
    if not os.path.isfile(assets_path):
        return set(), f"Missing {assets_path}"
    txt = open(assets_path, encoding="utf-8").read()
    m = re.search(r"export\s+const\s+ANCHORS\b[^=]*=\s*\{(.*?)\}\s*(?:as\s+const)?;", txt, re.DOTALL)
    if not m:
        return set(), f"Could not find `export const ANCHORS = {{ ... }}` in {assets_path}"
    keys = set(re.findall(r"(?:^|[,{\s])([A-Za-z_]\w*)\s*:", m.group(1)))
    if not keys:
        return set(), f"No anchor keys parsed inside ANCHORS in {assets_path}"
    return keys, None


def valid_transition(tr):
    if not isinstance(tr, str) or not tr.strip():
        return False
    base = tr.strip().lower().split(":", 1)[0]
    if base not in VALID_TRANSITION_PREFIXES:
        return False
    if ":" in tr:
        try:
            return float(tr.split(":", 1)[1]) >= 0
        except ValueError:
            return False
    return True


def main():
    ap = argparse.ArgumentParser(description="Validate multi-part horror series continuity & outline.")
    ap.add_argument("episode_dir", help="Episode folder containing bible/ and shared/")
    ap.add_argument("--part", type=int, default=1, help="Target Part number N about to be authored (default 1)")
    args = ap.parse_args()

    ep_dir = os.path.abspath(args.episode_dir)
    outline_path = os.path.join(ep_dir, "bible", "OUTLINE.json")
    cont_path = os.path.join(ep_dir, "bible", "CONTINUITY.json")
    assets_cand = os.path.join(ep_dir, "shared", "assets.ts")
    loc_cand = os.path.join(ep_dir, "shared", "locations.ts")
    assets_path = assets_cand if os.path.isfile(assets_cand) else loc_cand

    errors = []

    if not os.path.isfile(outline_path):
        errors.append(f"Missing OUTLINE.json: {outline_path}")
        outline = {}
    else:
        outline = json.load(open(outline_path, encoding="utf-8"))

    aspect = outline.get("aspect")
    if aspect not in VALID_ASPECTS:
        errors.append(f"OUTLINE.aspect must be one of {sorted(VALID_ASPECTS)}, got {aspect!r}")

    parts = outline.get("parts", [])
    if not isinstance(parts, list) or not parts:
        errors.append("OUTLINE.parts must be a non-empty list")
    else:
        for idx, p in enumerate(parts):
            pid = p.get("part")
            if pid != idx + 1:
                errors.append(f"OUTLINE.parts[{idx}].part expected {idx + 1}, got {pid!r} (must be contiguous 1..M)")
            dur = p.get("target_sec", p.get("duration_sec"))
            if not isinstance(dur, (int, float)) or not (45 <= dur <= 90):
                errors.append(f"Part {pid}: target_sec/duration_sec={dur!r} outside [45, 90]")
            light = p.get("light")
            if light not in VALID_LIGHTS:
                errors.append(f"Part {pid}: light={light!r} not in {sorted(VALID_LIGHTS)}")
            tr = p.get("transition_out", "cut")
            if not valid_transition(tr):
                errors.append(f"Part {pid}: invalid transition_out={tr!r}")

    anchors, anchor_err = extract_anchors(assets_path)
    if anchor_err:
        errors.append(anchor_err)

    need_cont = args.part > 1 or os.path.isfile(cont_path)
    if need_cont:
        if not os.path.isfile(cont_path):
            errors.append(f"Missing CONTINUITY.json required for --part {args.part}: {cont_path}")
        else:
            cont = json.load(open(cont_path, encoding="utf-8"))
            comp = cont.get("completed_part")
            if args.part > 1 and comp != args.part - 1:
                errors.append(f"CONTINUITY.completed_part is {comp!r}, expected {args.part - 1} before building Part {args.part}")

            ws = cont.get("world_state", {})
            if not isinstance(ws, dict) or not ws.get("era"):
                errors.append("CONTINUITY.world_state.era must be non-empty")
            if ws.get("light") not in VALID_LIGHTS:
                errors.append(f"CONTINUITY.world_state.light={ws.get('light')!r} not in {sorted(VALID_LIGHTS)}")

            ab = cont.get("audio_bridge", {})
            drone_hz = ab.get("drone_hz") if isinstance(ab, dict) else None
            if not isinstance(drone_hz, (int, float)) or drone_hz <= 0:
                errors.append(f"CONTINUITY.audio_bridge.drone_hz must be > 0, got {drone_hz!r}")
            elif isinstance(outline.get("audio_drone_hz"), (int, float)) and abs(drone_hz - outline["audio_drone_hz"]) > 0.05:
                errors.append(f"CONTINUITY.audio_bridge.drone_hz ({drone_hz}) differs from OUTLINE.audio_drone_hz ({outline['audio_drone_hz']})")

            chars = cont.get("characters", {})
            if isinstance(chars, dict):
                for cname, cdata in chars.items():
                    anc = cdata.get("anchor") if isinstance(cdata, dict) else None
                    if not anc:
                        errors.append(f"CONTINUITY.characters.{cname}.anchor missing")
                    elif anchors and anc not in anchors:
                        errors.append(f"CONTINUITY.characters.{cname}.anchor={anc!r} not found in shared/assets.ts ANCHORS ({sorted(anchors)})")
            else:
                errors.append("CONTINUITY.characters must be an object mapping character keys to state")

    if errors:
        print("CONTINUITY VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    print(
        f"PASS: {os.path.basename(ep_dir)} ready for Part {args.part} "
        f"(aspect={aspect}, parts={len(parts)}, anchors={len(anchors)})"
    )


if __name__ == "__main__":
    main()
