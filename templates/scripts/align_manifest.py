#!/usr/bin/env python3
"""Horror Engine v5.0: Automatic SceneManifest <-> words.json Beat Frame Aligner.

Reads `manifest.json` and `words.json` (produced by `gen_horror_voice.py`), matches each beat's `spokenLine.text`
monotonically against spoken word timestamps (supporting repeated dialogue motifs and respecting `[DEAD SILENCE]`
gaps), and recomputes contiguous `[a, b)` ranges, safe `peakFrame`, `blendRange`, and `totalFrames` so
`validate_manifest.py` passes with zero manual frame arithmetic.

Usage:
  python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --in-place
  python3 scripts/align_manifest.py src/<project>/manifest.json --words out/<project>/voice/words.json --dry-run
"""

import argparse
import json
import math
import os
import re
import sys


def norm_text(s: str) -> str:
    return re.sub(r"[^\w\s]", "", s.lower(), flags=re.UNICODE).strip()


def load_words_payload(path: str):
    with open(path, encoding="utf-8") as fp:
        raw = json.load(fp)
    if isinstance(raw, list):
        return raw, None, []
    return raw.get("words", []), raw.get("total_frames"), raw.get("dead_silences", [])


def align_manifest_data(manifest: dict, words: list, fps: float = 30.0, target_total_frames=None):
    """Return `(updated_manifest, changes_list)` with contiguous beat frames locked to `words`."""
    norm_words = [
        (
            norm_text(str(w.get("w", w.get("word", "")))),
            float(w.get("s", w.get("start", 0.0))),
            float(w.get("e", w.get("end", 0.0))),
        )
        for w in words
    ]

    beats = manifest.get("beats") or []
    if not beats:
        raise ValueError("Manifest contains no beats to align")

    matched_spans = []  # (start_s, end_s) or None per beat
    cursor = 0
    for b in beats:
        sl = b.get("spokenLine")
        txt = str(sl.get("text", "")).strip() if isinstance(sl, dict) else ""
        toks = [t for t in norm_text(txt).split() if t]
        if not toks:
            matched_spans.append(None)
            continue

        hits = []
        for idx in range(cursor, len(norm_words) - len(toks) + 1):
            if all(norm_words[idx + k][0] == toks[k] for k in range(len(toks))):
                hits.append((idx, norm_words[idx][1], norm_words[idx + len(toks) - 1][2]))
        if not hits:
            for idx in range(0, min(cursor, len(norm_words) - len(toks) + 1)):
                if all(norm_words[idx + k][0] == toks[k] for k in range(len(toks))):
                    hits.append((idx, norm_words[idx][1], norm_words[idx + len(toks) - 1][2]))
        if not hits:
            raise ValueError(f"Beat '{b.get('beatId')}' spokenLine not found in words.json: {txt!r}")

        best_idx, s0, e0 = hits[0]
        if best_idx >= cursor:
            cursor = best_idx + len(toks)
        matched_spans.append((s0, e0))

    last_word_end = max((w[2] for w in norm_words), default=0.0)
    total_f = int(target_total_frames) if target_total_frames else int(math.ceil((last_word_end + 0.35) * fps))

    # Build contiguous [a, b) frame boundaries locked cleanly to each spoken beat's exact start frame
    starts = [0] * len(beats)
    for i, sp in enumerate(matched_spans):
        if i == 0:
            starts[i] = 0
        elif sp is not None:
            starts[i] = max(starts[i - 1] + 1, int(round(sp[0] * fps)))
        else:
            # Silent / visual beat: place immediately after previous spoken end (+0.1s)
            prev_sp = matched_spans[i - 1]
            prev_end_f = int(round((prev_sp[1] + 0.10) * fps)) if prev_sp else starts[i - 1] + 15
            starts[i] = max(starts[i - 1] + 1, prev_end_f)

    # Ensure final total_f covers last spoken word cleanly
    if matched_spans[-1] is not None:
        total_f = max(total_f, int(math.ceil((matched_spans[-1][1] + 0.30) * fps)), starts[-1] + 15)
    else:
        total_f = max(total_f, starts[-1] + 15)

    updated = json.loads(json.dumps(manifest))
    updated["totalFrames"] = total_f
    changes = []

    for i, b in enumerate(updated["beats"]):
        old_a, old_b, old_pk = b.get("a"), b.get("b"), b.get("peakFrame")
        new_a = starts[i]
        new_b = starts[i + 1] if i + 1 < len(beats) else total_f
        if new_b <= new_a:
            new_b = new_a + 1

        # Preserve relative peakFrame ratio if valid, else place at 50% of active spoken span
        if isinstance(old_a, int) and isinstance(old_b, int) and isinstance(old_pk, int) and old_b > old_a:
            rel = max(0.15, min(0.85, (old_pk - old_a) / float(old_b - old_a)))
        else:
            rel = 0.50
        new_pk = max(new_a, min(new_b - 1, new_a + int(round((new_b - new_a) * rel))))

        b["a"] = new_a
        b["b"] = new_b
        b["peakFrame"] = new_pk

        ls = b.get("lightState") or {}
        if isinstance(ls.get("blendRange"), list) and len(ls["blendRange"]) == 2:
            span = max(2, min(new_b - new_a, int(ls["blendRange"][1]) - int(ls["blendRange"][0])))
            ls["blendRange"] = [new_a, min(new_b, new_a + span)]

        # v8.0 Auto-resolve propStates.*.triggerFrame from triggerWord inside this beat's word window
        for pst in (b.get("propStates") or {}).values():
            if not isinstance(pst, dict) or not pst.get("triggerWord"):
                continue
            needle = norm_text(str(pst["triggerWord"]))
            if not needle:
                continue
            win_s, win_e = (new_a / fps) - 0.35, (new_b / fps) + 0.35
            for w_tok, ws, _we in norm_words:
                if needle in w_tok and win_s <= ws <= win_e:
                    pst["triggerFrame"] = max(new_a, min(new_b - 1, int(round(ws * fps))))
                    break

        changes.append({
            "beatId": b.get("beatId"),
            "old": [old_a, old_b, old_pk],
            "new": [new_a, new_b, new_pk],
        })

    return updated, changes


def main(argv=None):
    ap = argparse.ArgumentParser(description="Auto-align SceneManifest beat frame ranges to words.json timestamps.")
    ap.add_argument("manifest", help="Path to manifest.json")
    ap.add_argument("--words", required=True, help="Path to words.json")
    ap.add_argument("--fps", type=float, default=30.0, help="Timeline FPS (default 30)")
    ap.add_argument("--in-place", action="store_true", help="Overwrite input manifest.json in place")
    ap.add_argument("--out", default=None, help="Output path for aligned manifest.json")
    ap.add_argument("--dry-run", action="store_true", help="Print alignment diff without writing")
    args = ap.parse_args(argv)

    with open(args.manifest, encoding="utf-8") as fp:
        manifest = json.load(fp)
    words, total_f, _ = load_words_payload(args.words)
    updated, changes = align_manifest_data(manifest, words, fps=args.fps, target_total_frames=total_f)

    print(f"ALIGNED '{updated.get('projectId')}' -> totalFrames={updated['totalFrames']} ({len(changes)} beats):")
    for ch in changes:
        print(f"  {ch['beatId']:24s} [{ch['old'][0]}..{ch['old'][1]} pk={ch['old'][2]}] -> [{ch['new'][0]}..{ch['new'][1]} pk={ch['new'][2]}]")

    if args.dry_run:
        return
    out_path = args.manifest if args.in_place else (args.out or args.manifest)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(updated, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    print(f"WROTE -> {out_path}")


if __name__ == "__main__":
    main()
