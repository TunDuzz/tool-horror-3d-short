#!/usr/bin/env python3
"""Horror Engine v11.0: Automatic SceneManifest <-> words.json Single-Lock Aligner.

Locks 4 timeline layers simultaneously from one `words.json` source of truth:
  1. `beats[]` contiguous `[a, b)` ranges, `peakFrame`, and `lightState.blendRange`
  2. `shots[]` (`startPhrase`, `endPhrase`, `visualBeatIndex`, `leadFrames`, `tailFrames`, `actionTriggerPhrase`)
  3. `propStates.*.triggerFrame` from `triggerWord`
  4. `captionChunks[]` (crisp 4-8 word subtitle phrases locked to acoustic word timestamps)

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

try:
    from constitution import load_constitution
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from constitution import load_constitution


def norm_text(s: str) -> str:
    return re.sub(r"[^\w\s]", "", s.lower(), flags=re.UNICODE).strip()


def _find_phrase_span(norm_words: list, phrase: str, cursor: int = 0):
    """Find `(hit_idx, end_idx_inclusive, start_s, end_s)` for `phrase` starting monotonically at `cursor`."""
    toks = [t for t in norm_text(phrase).split() if t]
    if not toks or not norm_words:
        return None
    n = len(toks)
    for idx in range(max(0, cursor), len(norm_words) - n + 1):
        if all(norm_words[idx + k][0] == toks[k] for k in range(n)):
            return idx, idx + n - 1, norm_words[idx][1], norm_words[idx + n - 1][2]
    for idx in range(0, min(max(0, cursor), len(norm_words) - n + 1)):
        if all(norm_words[idx + k][0] == toks[k] for k in range(n)):
            return idx, idx + n - 1, norm_words[idx][1], norm_words[idx + n - 1][2]
    return None


def split_caption_phrases(text: str, max_words: int = 7, max_chars: int = 44):
    """Split a Vietnamese spoken paragraph into crisp 4-8 word subtitle phrases breaking at natural punctuation."""
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return []
    raw_words = clean.split(" ")
    if len(raw_words) <= max_words + 1 and len(clean) <= max_chars + 6:
        return [clean]

    chunks = []
    cur = []
    cur_chars = 0

    def flush():
        nonlocal cur, cur_chars
        if cur:
            chunks.append(" ".join(cur))
            cur = []
            cur_chars = 0

    for w in raw_words:
        next_chars = cur_chars + (1 if cur else 0) + len(w)
        hard_punct = bool(re.search(r"[.!?…]$", w)) or w.endswith("...")
        soft_punct = bool(re.search(r"[,;:—–]$", w))
        if cur and (len(cur) >= max_words or next_chars > max_chars):
            flush()
        cur.append(w)
        cur_chars += (1 if len(cur) > 1 else 0) + len(w)
        if hard_punct and len(cur) >= 2:
            flush()
        elif soft_punct and (len(cur) >= 4 or cur_chars >= int(max_chars * 0.65)):
            flush()
    flush()

    if len(chunks) >= 2:
        last_w = chunks[-1].split(" ")
        prev_w = chunks[-2].split(" ")
        if len(last_w) <= 2 and len(prev_w) + len(last_w) <= max_words + 1 and len(chunks[-2]) + len(chunks[-1]) + 1 <= max_chars + 10:
            chunks[-2] = f"{chunks[-2]} {chunks[-1]}"
            chunks.pop()
    return chunks


def build_word_caption_chunks(manifest: dict, words: list, fps: float = 30.0, max_words: int | None = None, max_chars: int | None = None):
    """Generate exact word-timed 4-8 word captionChunks[] from aligned manifest beats & words.json."""
    const = load_constitution()
    cap_cfg = const.get("captions") or {}
    eff_max_words = max_words if max_words is not None else min(7, int(cap_cfg.get("maxWords", 8)) - 1)
    eff_max_chars = max_chars if max_chars is not None else int(cap_cfg.get("maxChars", 44))

    w_list = [
        (
            norm_text(str(w.get("w", w.get("word", "")))),
            float(w.get("s", w.get("start", 0.0))),
            float(w.get("e", w.get("end", 0.0))),
        )
        for w in words
        if str(w.get("w", w.get("word", ""))).strip()
    ]
    out = []
    cursor = 0
    for b in manifest.get("beats") or []:
        sl = b.get("spokenLine")
        if not isinstance(sl, dict) or not str(sl.get("text", "")).strip():
            continue
        ba, bb = int(b.get("a", 0)), int(b.get("b", 0))
        phrases = split_caption_phrases(str(sl["text"]), max_words=eff_max_words, max_chars=eff_max_chars)
        beat_hl = sl.get("highlight") or []
        ph_matches = []
        for ph in phrases:
            hit = _find_phrase_span(w_list, ph, cursor=cursor)
            if hit is not None:
                hit_idx, end_idx, s0, e0 = hit
                ca = max(ba, int(math.floor(s0 * fps)))
                cb = min(bb, max(ca + 8, int(math.ceil((e0 + 0.12) * fps))))
                if hit_idx >= cursor:
                    cursor = end_idx + 1
                ph_matches.append((ca, cb, ph))
            else:
                ph_matches.append((None, None, ph))

        span = max(1, bb - ba)
        tot_chars = max(1, sum(len(x[2]) for x in ph_matches))
        fb_cur = ba
        for idx_p, (ca, cb, ph) in enumerate(ph_matches):
            if ca is None or cb is None:
                ca = fb_cur
                cb = bb if idx_p == len(ph_matches) - 1 else min(bb, ca + max(12, int(round(len(ph) / tot_chars * span))))
            fb_cur = cb
            ph_l = ph.lower()
            hl = [h for h in beat_hl if h and str(h).lower() in ph_l]
            entry = {
                "a": int(ca),
                "b": max(int(ca) + 1, int(cb)),
                "text": ph,
            }
            if sl.get("speaker"):
                entry["speaker"] = sl["speaker"]
            if sl.get("speakerColor"):
                entry["speakerColor"] = sl["speakerColor"]
            if hl:
                entry["highlight"] = hl
            out.append(entry)

    for i in range(1, len(out)):
        if out[i]["a"] < out[i - 1]["b"]:
            out[i - 1]["b"] = max(out[i - 1]["a"] + 4, out[i]["a"])
    return out


def load_words_payload(path: str):
    with open(path, encoding="utf-8") as fp:
        raw = json.load(fp)
    if isinstance(raw, list):
        return raw, None, [], []
    return (
        raw.get("words", []),
        raw.get("total_frames"),
        raw.get("dead_silences", []),
        raw.get("visual_beats", []),
    )


def _align_shots_in_place(updated: dict, norm_words: list, visual_beats: list, fps: float, old_total: int):
    """Lock `updated['shots']` contiguously across `[0..totalFrames)` using `startPhrase` / `endPhrase` / `visualBeatIndex`."""
    shots = updated.get("shots")
    if not isinstance(shots, list) or not shots:
        return []

    total_f = int(updated["totalFrames"])
    n_shots = len(shots)
    cursor = 0
    raw_starts = [0] * n_shots
    explicit_ends: list[int | None] = [None] * n_shots

    for i, sh in enumerate(shots):
        lead_f = int(sh.get("leadFrames", 0) or 0)
        tail_f = int(sh.get("tailFrames", 0) or 0)
        vb_idx = sh.get("visualBeatIndex")

        if i == 0:
            raw_starts[i] = 0
        elif isinstance(vb_idx, int) and 0 <= vb_idx < len(visual_beats):
            raw_starts[i] = max(1, int(round(float(visual_beats[vb_idx]["s"]) * fps)) - lead_f)
        elif sh.get("startPhrase"):
            hit = _find_phrase_span(norm_words, str(sh["startPhrase"]), cursor=cursor)
            if hit is None:
                raise ValueError(f"Shot #{sh.get('id', i + 1)} startPhrase not found in words.json: {sh['startPhrase']!r}")
            hit_idx, _, s0, _ = hit
            raw_starts[i] = max(1, int(round(s0 * fps)) - lead_f)
            if hit_idx >= cursor:
                cursor = hit_idx
        elif explicit_ends[i - 1] is not None:
            raw_starts[i] = int(explicit_ends[i - 1])
        else:
            old_a = int(sh.get("a", 0) or 0)
            raw_starts[i] = max(1, int(round((old_a / float(max(1, old_total))) * total_f)))

        if sh.get("endPhrase"):
            ehit = _find_phrase_span(norm_words, str(sh["endPhrase"]), cursor=cursor)
            if ehit is None:
                raise ValueError(f"Shot #{sh.get('id', i + 1)} endPhrase not found in words.json: {sh['endPhrase']!r}")
            _, end_idx, _, e0 = ehit
            explicit_ends[i] = min(total_f, int(round(e0 * fps)) + tail_f)
            if end_idx >= cursor:
                cursor = end_idx + 1
        elif isinstance(vb_idx, int) and 0 <= vb_idx < len(visual_beats):
            explicit_ends[i] = min(total_f, int(round(float(visual_beats[vb_idx]["e"]) * fps)) + tail_f)

    # Enforce strict monotonic contiguity [0..total_f) with >= 12 frames per shot
    MIN_SHOT_F = 12
    starts = [0] * n_shots
    for i in range(1, n_shots):
        lo = starts[i - 1] + MIN_SHOT_F
        hi = max(lo, total_f - MIN_SHOT_F * (n_shots - i))
        cand = raw_starts[i]
        starts[i] = max(lo, min(hi, cand))

    beats = updated.get("beats") or []
    shot_changes = []
    trig_cursor = 0
    for i, sh in enumerate(shots):
        old_a, old_b = sh.get("a"), sh.get("b")
        na = starts[i]
        nb = starts[i + 1] if i + 1 < n_shots else total_f
        sh["id"] = int(sh.get("id", i + 1))
        sh["a"] = na
        sh["b"] = nb

        mid_f = (na + nb) // 2
        matched_beat = None
        for b in beats:
            if int(b["a"]) <= mid_f < int(b["b"]):
                matched_beat = b
                break
        if matched_beat is None and beats:
            matched_beat = beats[-1]
        if matched_beat is not None:
            if not sh.get("beatId"):
                sh["beatId"] = matched_beat.get("beatId")
            if not sh.get("light"):
                sh["light"] = (matched_beat.get("lightState") or {}).get("preset", "warmLamp")

        if sh.get("actionTriggerPhrase"):
            thit = _find_phrase_span(norm_words, str(sh["actionTriggerPhrase"]), cursor=trig_cursor)
            if thit is not None:
                t_idx, t_end, ts0, _ = thit
                sh["actionTriggerFrame"] = max(na, min(nb - 1, int(round(ts0 * fps))))
                if t_idx >= trig_cursor:
                    trig_cursor = t_end + 1

        shot_changes.append({"id": sh["id"], "old": [old_a, old_b], "new": [na, nb]})
    return shot_changes


def align_manifest_data(manifest: dict, words: list, fps: float = 30.0, target_total_frames=None, visual_beats=None):
    """Return `(updated_manifest, changes_list)` with contiguous beat AND shot frames locked to `words`."""
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

    old_total = int(manifest.get("totalFrames") or 1)
    matched_spans = []
    cursor = 0
    for b in beats:
        sl = b.get("spokenLine")
        txt = str(sl.get("text", "")).strip() if isinstance(sl, dict) else ""
        if not norm_text(txt):
            matched_spans.append(None)
            continue
        hit = _find_phrase_span(norm_words, txt, cursor=cursor)
        if hit is None:
            raise ValueError(f"Beat '{b.get('beatId')}' spokenLine not found in words.json: {txt!r}")
        hit_idx, end_idx, s0, e0 = hit
        if hit_idx >= cursor:
            cursor = end_idx + 1
        matched_spans.append((s0, e0))

    last_word_end = max((w[2] for w in norm_words), default=0.0)
    last_vis_end = max((float(v.get("e", 0.0)) for v in (visual_beats or [])), default=0.0)
    max_end_s = max(last_word_end, last_vis_end)
    total_f = int(target_total_frames) if target_total_frames else int(math.ceil((max_end_s + 0.35) * fps))

    starts = [0] * len(beats)
    for i, sp in enumerate(matched_spans):
        if i == 0:
            starts[i] = 0
        elif sp is not None:
            starts[i] = max(starts[i - 1] + 1, int(round(sp[0] * fps)))
        else:
            prev_sp = matched_spans[i - 1]
            prev_end_f = int(round((prev_sp[1] + 0.10) * fps)) if prev_sp else starts[i - 1] + 15
            starts[i] = max(starts[i - 1] + 1, prev_end_f)

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

    _align_shots_in_place(updated, norm_words, visual_beats or [], fps=fps, old_total=old_total)
    updated["captionChunks"] = build_word_caption_chunks(updated, words, fps=fps)
    return updated, changes


def main(argv=None):
    ap = argparse.ArgumentParser(description="Auto-align SceneManifest beats, shots, triggers, and captions to words.json.")
    ap.add_argument("manifest", help="Path to manifest.json")
    ap.add_argument("--words", required=True, help="Path to words.json")
    ap.add_argument("--fps", type=float, default=30.0, help="Timeline FPS (default 30)")
    ap.add_argument("--in-place", action="store_true", help="Overwrite input manifest.json in place")
    ap.add_argument("--out", default=None, help="Output path for aligned manifest.json")
    ap.add_argument("--dry-run", action="store_true", help="Print alignment diff without writing")
    args = ap.parse_args(argv)

    with open(args.manifest, encoding="utf-8") as fp:
        manifest = json.load(fp)
    words, total_f, _, visual_beats = load_words_payload(args.words)
    updated, changes = align_manifest_data(manifest, words, fps=args.fps, target_total_frames=total_f, visual_beats=visual_beats)

    n_shots = len(updated.get("shots") or [])
    n_caps = len(updated.get("captionChunks") or [])
    print(f"ALIGNED '{updated.get('projectId')}' -> totalFrames={updated['totalFrames']} ({len(changes)} beats, {n_shots} shots, {n_caps} captionChunks):")
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
