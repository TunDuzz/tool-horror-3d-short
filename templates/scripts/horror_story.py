#!/usr/bin/env python3
"""Horror Story Architect CLI — zero-dependency pre-production story structurer, validator & HTML Story Bible renderer.

Methodology integrates 2-round skeleton-first story planning, character tiers, narrative-prop binding,
story-driven CharacterBlueprint appearance briefs, and deterministic quality gates (inspired by
eternityspring/shuohao-skills `novel-outline`, Apache-2.0) with psychological horror reveal pacing and
Horror Engine v5.0 (`horror-3d-short`) continuity & anti-repetition schemas.
"""

import argparse
import html
import json
import math
import os
import re
import sys

VALID_LIGHTS = {"warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"}
VALID_TIERS = {"lead", "support", "functional"}
VALID_BEAT_TYPES = {"hook", "omen", "dread", "scare", "reveal", "twist", "escape", "climax"}
VALID_WEIGHTS = {"major", "minor"}
DIALOGUE_QUOTE_RE = re.compile(r'["“”«»「」『』]')
CHAPTER_RE = re.compile(r"^\s*(?:chương|hồi|phần|tập|chapter)\s+[0-9ivxlcdm]+", re.IGNORECASE | re.MULTILINE)


def read_text_auto(path):
    raw = open(path, "rb").read()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    return raw.decode("utf-8-sig")


def read_json(path):
    return json.loads(read_text_auto(path))


def write_text(path, content):
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fp:
        fp.write(content)


def default_thresholds(params):
    parts_n = int(params.get("parts") or 1)
    mode = params.get("mode", "standalone")
    if mode == "standalone" or parts_n == 1:
        auto_scenes = 3
        auto_gap = 1
    else:
        auto_scenes = max(3, min(12, 4 + math.ceil(parts_n / 10)))
        auto_gap = 2
    base = {
        "maxLeads": 5,
        "maxSupport": 10,
        "maxFunctional": 10,
        "maxProps": 8,
        "maxBeatGap": auto_gap,
        "maxPrimaryScenes": auto_scenes,
    }
    custom = params.get("thresholds") or {}
    if isinstance(custom, dict):
        for k, v in custom.items():
            if isinstance(v, (int, float)):
                base[k] = int(v)
    return base


def cmd_chunk(args):
    text = read_text_auto(args.book)
    os.makedirs(args.workdir, exist_ok=True)

    matches = list(CHAPTER_RE.finditer(text))
    chunks = []
    if len(matches) >= 2:
        chapters = []
        for idx, m in enumerate(matches):
            start = m.start()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            chapters.append(text[start:end].strip())
        step = max(1, args.per_volume)
        for i in range(0, len(chapters), step):
            chunks.append("\n\n".join(chapters[i : i + step]))
    else:
        # Fall back to fixed character chunks (~18,000 chars per volume)
        size = max(4000, args.chunk_chars)
        for i in range(0, len(text), size):
            chunks.append(text[i : i + size].strip())

    out_files = []
    for idx, body in enumerate(chunks, 1):
        out_path = os.path.join(args.workdir, f"vol-{idx:02d}.txt")
        write_text(out_path, body + "\n")
        out_files.append(out_path)

    print(json.dumps({"volumes": len(out_files), "files": out_files}, ensure_ascii=False, indent=2))


def cmd_seed(args):
    n_parts = max(1, args.parts)
    mode = "standalone" if n_parts == 1 and args.mode == "auto" else ("series" if n_parts > 1 and args.mode == "auto" else args.mode)
    sec = 70 if mode == "standalone" else 60
    doc = {
        "title": args.title,
        "lang": "vi",
        "params": {
            "mode": mode,
            "parts": n_parts,
            "secondsPerPart": sec,
            "wordsPerSecond": 2.9,
            "genre": args.genre,
            "adaptMode": args.adapt_mode,
            "thresholds": default_thresholds({"parts": n_parts, "mode": mode}),
        },
        "premise": {
            "core": "",
            "entityRule": "",
            "twistCore": "",
            "keep": [{"what": "", "why": "", "evidence": ""}],
            "cut": [],
            "risks": [],
        },
        "characters": [
            {
                "id": "C01",
                "name": "",
                "tier": "lead",
                "role": "Nhân vật chính",
                "trait": "",
                "appearanceBrief": "",
                "arc": "",
                "from": ["Sáng tác mới" if args.adapt_mode == "original" else "Nguồn gốc"],
            },
            {
                "id": "C02",
                "name": "",
                "tier": "lead",
                "role": "Thực thể kinh dị / Phản diện",
                "trait": "",
                "appearanceBrief": "",
                "arc": "",
                "from": ["Sáng tác mới" if args.adapt_mode == "original" else "Nguồn gốc"],
            },
        ],
        "scenes": [
            {
                "id": "S01",
                "name": "",
                "primary": True,
                "atmosphere": "",
            }
        ],
        "beats": [
            {
                "id": "B01",
                "part": 1,
                "type": "hook",
                "weight": "minor",
                "setup": "",
                "payoff": "",
            },
            {
                "id": "B02",
                "part": n_parts,
                "type": "twist",
                "weight": "major",
                "setup": "",
                "payoff": "",
            },
        ],
        "props": [],
        "parts": [
            {
                "part": i,
                "title": f"Phần {i}",
                "target_sec": sec,
                "light": "warmLamp" if i == 1 else "coldMoon",
                "synopsis": "",
                "hook": "",
                "suspense": "",
                "sceneIds": ["S01"],
                "characterIds": ["C01"],
                "propIds": [],
                "soundCues": [],
                "warnings": [],
            }
            for i in range(1, n_parts + 1)
        ],
    }
    out_txt = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        write_text(args.out, out_txt)
        print(f"Seeded story.json -> {args.out}")
    else:
        print(out_txt, end="")


def evaluate_gates(doc, stage="full"):
    params = doc.get("params") or {}
    th = default_thresholds(params)
    n_parts = int(params.get("parts") or 1)
    adapt_mode = str(params.get("adaptMode") or "original")

    premise = doc.get("premise") or {}
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    beats = doc.get("beats") or []
    props = doc.get("props") or []
    parts = doc.get("parts") or []

    gates = []

    def add_gate(gid, title, ok, detail, applies=True):
        gates.append({"id": gid, "title": title, "ok": bool(ok), "detail": detail, "applies": applies})

    # 1. premise-core
    core_ok = bool(str(premise.get("core", "")).strip())
    rule_ok = bool(str(premise.get("entityRule", "")).strip())
    cut_ok = True
    if adapt_mode in ("adapt", "reimagine"):
        cuts = premise.get("cut") or []
        cut_ok = isinstance(cuts, list) and len(cuts) >= 1 and all(str(x.get("what", "")).strip() and str(x.get("why", "")).strip() for x in cuts if isinstance(x, dict))
    add_gate(
        "premise-core",
        "1. Tiền đề & Luật thực thể",
        core_ok and rule_ok and cut_ok,
        "Đủ core + entityRule" + ("" if adapt_mode not in ("adapt", "reimagine") else " + danh sách cắt tuyến")
        if (core_ok and rule_ok and cut_ok)
        else "Thiếu core, entityRule hoặc thiếu giải thích cắt tuyến khi chuyển thể",
    )

    # 2. char-tier-caps
    leads = [c for c in chars if c.get("tier") == "lead"]
    supports = [c for c in chars if c.get("tier") == "support"]
    funcs = [c for c in chars if c.get("tier") == "functional"]
    bad_tiers = [c.get("id") for c in chars if c.get("tier") not in VALID_TIERS]
    tier_ok = (
        not bad_tiers
        and 1 <= len(leads) <= th["maxLeads"]
        and len(supports) <= th["maxSupport"]
        and len(funcs) <= th["maxFunctional"]
    )
    add_gate(
        "char-tier-caps",
        "2. Giới hạn nhân vật theo cấp",
        tier_ok,
        f"lead={len(leads)}/{th['maxLeads']}, support={len(supports)}/{th['maxSupport']}, functional={len(funcs)}/{th['maxFunctional']}"
        + (f" (tier lỗi: {bad_tiers})" if bad_tiers else ""),
    )

    # 3. char-arcs
    arc_missing = []
    for c in chars:
        cid = c.get("id") or c.get("name") or "?"
        if not str(c.get("name", "")).strip() or not str(c.get("role", "")).strip():
            arc_missing.append(f"{cid} thiếu name/role")
        if c.get("tier") in ("lead", "support") and not str(c.get("arc", "")).strip():
            arc_missing.append(f"{cid} thiếu arc")
        frm = c.get("from")
        if not isinstance(frm, list) or not frm or not any(str(x).strip() for x in frm):
            arc_missing.append(f"{cid} thiếu nguồn from")
    add_gate(
        "char-arcs",
        "3. Hồ sơ & Cung phát triển nhân vật",
        not arc_missing,
        "Đầy đủ arc & nguồn nhân vật" if not arc_missing else "; ".join(arc_missing[:4]),
    )

    # 4. scene-cap
    primary_scenes = [s for s in scenes if s.get("primary", True)]
    unnamed_scenes = [s.get("id") for s in scenes if not str(s.get("name", "")).strip()]
    sc_ok = len(scenes) >= 1 and len(primary_scenes) <= th["maxPrimaryScenes"] and not unnamed_scenes
    add_gate(
        "scene-cap",
        "4. Giới hạn bối cảnh chính",
        sc_ok,
        f"{len(primary_scenes)}/{th['maxPrimaryScenes']} bối cảnh chính (tổng {len(scenes)})"
        + (f"; thiếu tên: {unnamed_scenes}" if unnamed_scenes else ""),
    )

    # 5. scene-reuse (full stage with multi-part)
    if stage == "full" and n_parts >= 2:
        scene_usage = {s.get("id"): 0 for s in scenes}
        for p in parts:
            for sid in set(p.get("sceneIds") or []):
                if sid in scene_usage:
                    scene_usage[sid] += 1
        one_off = [s for s in scenes if scene_usage.get(s.get("id"), 0) == 1 and not str(s.get("reusePlan", "")).strip()]
        add_gate(
            "scene-reuse",
            "5. Phương án tái sử dụng bối cảnh lẻ",
            not one_off,
            "Các bối cảnh xuất hiện 1 lần đều có reusePlan" if not one_off else f"Thiếu reusePlan cho: {[x.get('id') for x in one_off]}",
            applies=True,
        )
    else:
        add_gate("scene-reuse", "5. Phương án tái sử dụng bối cảnh lẻ", True, "Bỏ qua (standalone hoặc stage beats)", applies=False)

    # Beats & Props preparation
    beat_ids = {b.get("id") for b in beats if b.get("id")}
    # 6. prop-purpose (checked when beats finalized or full; props optional on skeleton)
    if stage in ("beats", "full") and props:
        prop_errs = []
        if len(props) > th["maxProps"]:
            prop_errs.append(f"Số đạo cụ {len(props)} > {th['maxProps']}")
        for pr in props:
            pid = pr.get("id") or "?"
            if not str(pr.get("name", "")).strip() or not str(pr.get("function", "")).strip():
                prop_errs.append(f"{pid} thiếu name/function")
            for bid in pr.get("beatIds") or []:
                if bid not in beat_ids:
                    prop_errs.append(f"{pid} trỏ tới beat không tồn tại '{bid}'")
        add_gate(
            "prop-purpose",
            "6. Đạo cụ kể chuyện & Vai trò cao trào",
            not prop_errs,
            f"{len(props)}/{th['maxProps']} đạo cụ gắn chặt cốt truyện" if not prop_errs else "; ".join(prop_errs[:4]),
        )
    else:
        add_gate(
            "prop-purpose",
            "6. Đạo cụ kể chuyện & Vai trò cao trào",
            True,
            "Chưa khai báo props (chốt sau vòng 1)" if not props else "Bỏ qua ở stage skeleton",
            applies=False,
        )

    # 7. beat-major
    if stage in ("beats", "full"):
        majors = [b for b in beats if b.get("weight", "minor") == "major"]
        bad_beats = [b.get("id") for b in beats if b.get("weight", "minor") not in VALID_WEIGHTS or not str(b.get("setup", "")).strip()]
        major_parts = sorted([int(b.get("part", 1)) for b in majors])
        early_major_ok = True if n_parts < 2 else (bool(major_parts) and major_parts[0] < n_parts)
        beat_ok = len(majors) >= 1 and early_major_ok and not bad_beats
        add_gate(
            "beat-major",
            "7. Cao trào lớn (Major Beats)",
            beat_ok,
            f"{len(majors)} major / {len(beats)} tổng beats (phần: {major_parts})"
            if beat_ok
            else "Cần >=1 major beat có setup rõ ràng (và major đầu không ở phần cuối với series)",
        )

        # 8. beat-spacing
        beat_parts = sorted([int(b.get("part", 1)) for b in beats if 1 <= int(b.get("part", 0)) <= n_parts])
        gap_errs = []
        if not beat_parts:
            gap_errs.append("Không có beat hợp lệ nào trong phạm vi 1..parts")
        else:
            if n_parts >= 2 and beat_parts[0] - 1 > th["maxBeatGap"]:
                gap_errs.append(f"Khoảng trống đầu truyện quá dài ({beat_parts[0] - 1} phần)")
            if n_parts >= 2 and n_parts - beat_parts[-1] > th["maxBeatGap"]:
                gap_errs.append(f"Khoảng trống cuối truyện quá dài ({n_parts - beat_parts[-1]} phần)")
            for a, b_p in zip(beat_parts, beat_parts[1:]):
                if b_p - a - 1 > th["maxBeatGap"]:
                    gap_errs.append(f"Khoảng cách giữa phần {a} và {b_p} vượt maxBeatGap={th['maxBeatGap']}")
            if n_parts == 1 and len(beats) < 3:
                gap_errs.append("Truyện 1 phần cần tối thiểu 3 beats (Hook -> Escalation -> Climax/Twist)")
        add_gate(
            "beat-spacing",
            "8. Mật độ & Nhịp cao trào",
            not gap_errs,
            "Nhịp phân bổ đều, không khoảng chết" if not gap_errs else "; ".join(gap_errs),
        )

        # 9. reveal-discipline
        ordered_beats = sorted(enumerate(beats), key=lambda x: (int(x[1].get("part", 1)), x[0]))
        first_type = str(ordered_beats[0][1].get("type", "")).lower() if ordered_beats else ""
        first_w = str(ordered_beats[0][1].get("weight", "minor")).lower() if ordered_beats else ""
        rev_ok = not (len(ordered_beats) >= 2 and first_type in ("reveal", "climax", "twist") and first_w == "major")
        add_gate(
            "reveal-discipline",
            "9. Kỷ luật giấu mặt thực thể (No early spoiler)",
            rev_ok,
            "Mở đầu bằng Hook/Omen ngoại vi trước khi lộ thực thể" if rev_ok else "Beat đầu tiên đang đặt major reveal/climax — dễ lộ quái quá sớm",
        )
    else:
        for gid, gtitle in [
            ("beat-major", "7. Cao trào lớn (Major Beats)"),
            ("beat-spacing", "8. Mật độ & Nhịp cao trào"),
            ("reveal-discipline", "9. Kỷ luật giấu mặt thực thể"),
        ]:
            add_gate(gid, gtitle, True, "Kiểm ở stage beats/full", applies=False)

    # Full stage checks (10..14)
    if stage == "full":
        # 10. part-duration
        p_errs = []
        if len(parts) != n_parts:
            p_errs.append(f"Số phần là {len(parts)}, expected {n_parts}")
        for idx, p in enumerate(parts, 1):
            if p.get("part") != idx:
                p_errs.append(f"Phần thứ {idx} có số part={p.get('part')!r}")
            dur = p.get("target_sec")
            if not isinstance(dur, (int, float)) or not (45 <= dur <= 75):
                p_errs.append(f"P{idx} target_sec={dur} ngoài [45,75]")
            if p.get("light") not in VALID_LIGHTS:
                p_errs.append(f"P{idx} light={p.get('light')!r} không hợp lệ")
        add_gate(
            "part-duration",
            "10. Cấu trúc phần & Thời lượng (45–75s)",
            not p_errs,
            f"Đủ {n_parts} phần đúng thời lượng & ánh sáng hợp lệ" if not p_errs else "; ".join(p_errs[:4]),
        )

        # 11. prose-only
        quote_hits = []
        for p in parts:
            pid = p.get("part")
            for fld in ("synopsis", "hook", "suspense"):
                val = str(p.get(fld, ""))
                if not val.strip() and fld == "synopsis":
                    quote_hits.append(f"P{pid} thiếu synopsis")
                elif DIALOGUE_QUOTE_RE.search(val):
                    quote_hits.append(f"P{pid}.{fld} chứa lời thoại trong ngoặc kép")
        add_gate(
            "prose-only",
            "11. Văn xuôi kể chuyện (Tách khỏi lời thoại)",
            not quote_hits,
            "Sạch văn xuôi kể chuyện" if not quote_hits else "; ".join(quote_hits[:4]),
        )

        # 12. hook-suspense
        hs_errs = []
        for p in parts:
            pid = p.get("part")
            if not str(p.get("hook", "")).strip():
                hs_errs.append(f"P{pid} thiếu hook")
            if not str(p.get("suspense", "")).strip():
                hs_errs.append(f"P{pid} thiếu suspense")
        add_gate(
            "hook-suspense",
            "12. Móc mở đầu (Hook) & Treo cuối (Suspense)",
            not hs_errs,
            "Mọi phần đều có Hook mở & Suspense kết" if not hs_errs else "; ".join(hs_errs[:4]),
        )

        # 13. referential-integrity
        char_ids = {c.get("id") for c in chars if c.get("id")}
        scene_ids = {s.get("id") for s in scenes if s.get("id")}
        prop_ids = {pr.get("id") for pr in props if pr.get("id")}
        used_c, used_s, used_p = set(), set(), set()
        ref_errs = []
        for p in parts:
            pid = p.get("part")
            for cid in p.get("characterIds") or []:
                if cid not in char_ids:
                    ref_errs.append(f"P{pid} gọi nhân vật lạ '{cid}'")
                used_c.add(cid)
            for sid in p.get("sceneIds") or []:
                if sid not in scene_ids:
                    ref_errs.append(f"P{pid} gọi bối cảnh lạ '{sid}'")
                used_s.add(sid)
            for prid in p.get("propIds") or []:
                if prid not in prop_ids:
                    ref_errs.append(f"P{pid} gọi đạo cụ lạ '{prid}'")
                used_p.add(prid)
        if char_ids - used_c:
            ref_errs.append(f"Nhân vật chưa xuất hiện: {sorted(char_ids - used_c)}")
        if scene_ids - used_s:
            ref_errs.append(f"Bối cảnh chưa dùng: {sorted(scene_ids - used_s)}")
        if prop_ids - used_p:
            ref_errs.append(f"Đạo cụ chưa xuất hiện: {sorted(prop_ids - used_p)}")
        add_gate(
            "referential-integrity",
            "13. Toàn vẹn tham chiếu (Không tài nguyên thừa)",
            not ref_errs,
            "100% nhân vật, bối cảnh và đạo cụ được sử dụng nhất quán" if not ref_errs else "; ".join(ref_errs[:4]),
        )

        # 14. horror-cues
        cue_errs = []
        for p in parts:
            pid = p.get("part")
            cues = (p.get("soundCues") or []) + (p.get("warnings") or [])
            if not cues:
                cue_errs.append(f"P{pid} chưa có soundCues hoặc warnings")
        add_gate(
            "horror-cues",
            "14. Điểm nhấn âm thanh / Lưu ý đạo diễn",
            not cue_errs,
            "Đủ gợi ý không khí cho giai đoạn viết SCRIPT.md & audio" if not cue_errs else "; ".join(cue_errs[:4]),
        )
    else:
        for gid, gtitle in [
            ("part-duration", "10. Cấu trúc phần & Thời lượng (45–75s)"),
            ("prose-only", "11. Văn xuôi kể chuyện"),
            ("hook-suspense", "12. Móc mở đầu & Treo cuối"),
            ("referential-integrity", "13. Toàn vẹn tham chiếu"),
            ("horror-cues", "14. Điểm nhấn âm thanh / Lưu ý"),
        ]:
            add_gate(gid, gtitle, True, "Kiểm ở stage full", applies=False)

    failed = [g for g in gates if g["applies"] and not g["ok"]]
    return gates, failed


def cmd_validate(args):
    doc = read_json(args.story)
    gates, failed = evaluate_gates(doc, stage=args.stage)
    for g in gates:
        mark = "PASS" if (g["ok"] or not g["applies"]) else "FAIL"
        tag = f"[{mark}]" if g["applies"] else "[SKIP]"
        print(f"{tag} {g['title']}: {g['detail']}")
    if failed:
        print(f"\nFAILED {len(failed)} gate(s) at stage={args.stage}.", file=sys.stderr)
        sys.exit(1)
    print(f"\nALL GATES PASSED (stage={args.stage}).")


def cmd_checkup(args):
    doc = read_json(args.story)
    gates, failed = evaluate_gates(doc, stage="full")
    for g in gates:
        mark = "✓" if (g["ok"] or not g["applies"]) else "✗"
        print(f" {mark} {g['title']} — {g['detail']}")
    sys.exit(1 if failed else 0)


def render_markdown(doc):
    params = doc.get("params") or {}
    premise = doc.get("premise") or {}
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    beats = doc.get("beats") or []
    props = doc.get("props") or []
    parts = doc.get("parts") or []
    wps = float(params.get("wordsPerSecond") or 2.9)

    lines = [
        f"# STORY BIBLE: {doc.get('title', 'Chưa đặt tên')}",
        "",
        f"- **Quy mô:** `{params.get('mode', 'standalone')}` · **{len(parts)} phần** · Thể loại: `{params.get('genre', '-')}` · Nguồn: `{params.get('adaptMode', '-')}`",
        f"- **Cốt lõi:** {premise.get('core', '')}",
        f"- **Luật thực thể / Cấm kỵ:** {premise.get('entityRule', '')}",
        f"- **Cú lật / Trọng tâm kết:** {premise.get('twistCore', '')}",
        "",
        "## 1. Nhân vật (Hồ sơ Ngoại hình cho `castBlueprints`)",
        "| ID | Tên | Cấp | Vai trò | Ngoại hình theo cốt truyện (`appearanceBrief`) | Cung phát triển (`arc`) |",
        "|---|---|---|---|---|---|",
    ]
    for c in chars:
        lines.append(
            f"| `{c.get('id')}` | {c.get('name')} | `{c.get('tier')}` | {c.get('role')} | {c.get('appearanceBrief', c.get('trait', '-'))} | {c.get('arc', '-')} |"
        )

    lines += [
        "",
        "## 2. Bối cảnh & Đạo cụ kể chuyện",
        "### Bối cảnh",
    ]
    for s in scenes:
        reuse = f" · *Tái sử dụng:* {s['reusePlan']}" if s.get("reusePlan") else ""
        lines.append(f"- **`{s.get('id')}` {s.get('name')}** (`{'Chính' if s.get('primary', True) else 'Phụ'}`): {s.get('atmosphere', '')}{reuse}")

    lines += ["", "### Đạo cụ gánh cốt truyện"]
    if props:
        for pr in props:
            st = ", ".join(pr.get("states") or [])
            lines.append(f"- **`{pr.get('id')}` {pr.get('name')}**: {pr.get('function', '')} (Beats: `{','.join(pr.get('beatIds') or [])}`" + (f"; Trạng thái: {st}" if st else "") + ")")
    else:
        lines.append("- *(Chưa có đạo cụ)*")

    lines += ["", "## 3. Nhịp Cao trào (`Beats`)"]
    for b in beats:
        lines.append(f"- **`{b.get('id')}` [P{b.get('part')} · {b.get('weight', 'minor').upper()} · {b.get('type')}]**: *Gieo:* {b.get('setup')} -> *Gặt:* {b.get('payoff')}")

    lines += ["", "## 4. Tóm tắt từng phần"]
    for p in parts:
        dur = float(p.get("target_sec") or 60)
        wb = round(dur * wps)
        lines += [
            f"### Phần {p.get('part')}: {p.get('title', '')} (`{int(dur)}s` · ~`{wb} từ` · `{p.get('light')}`)",
            f"- **Hook mở:** {p.get('hook', '')}",
            f"- **Diễn biến:** {p.get('synopsis', '')}",
            f"- **Treo cuối (Suspense):** {p.get('suspense', '')}",
            f"- **Nhân vật / Bối cảnh / Đạo cụ:** `{','.join(p.get('characterIds') or [])}` / `{','.join(p.get('sceneIds') or [])}` / `{','.join(p.get('propIds') or [])}`",
            "",
        ]
    return "\n".join(lines)


def render_html(doc):
    params = doc.get("params") or {}
    premise = doc.get("premise") or {}
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    beats = doc.get("beats") or []
    props = doc.get("props") or []
    parts = doc.get("parts") or []
    gates, failed = evaluate_gates(doc, stage="full")
    wps = float(params.get("wordsPerSecond") or 2.9)
    total_sec = sum(float(p.get("target_sec") or 0) for p in parts)
    total_words = round(total_sec * wps)

    esc = lambda v: html.escape(str(v or ""))
    char_map = {c.get("id"): c.get("name", c.get("id")) for c in chars}
    scene_map = {s.get("id"): s.get("name", s.get("id")) for s in scenes}
    prop_map = {pr.get("id"): pr.get("name", pr.get("id")) for pr in props}

    beat_cards = []
    for b in beats:
        is_maj = b.get("weight", "minor") == "major"
        cls = "beat major" if is_maj else "beat minor"
        beat_cards.append(
            f"<div class='{cls}'><div class='b-head'><span class='pill'>{esc(b.get('id'))}</span>"
            f"<span class='pill dim'>Phần {esc(b.get('part'))}</span>"
            f"<span class='pill {'red' if is_maj else 'slate'}'>{esc(b.get('type'))} · {esc(b.get('weight','minor').upper())}</span></div>"
            f"<div><strong>Gieo:</strong> {esc(b.get('setup'))}</div>"
            f"<div><strong>Gặt:</strong> {esc(b.get('payoff'))}</div></div>"
        )

    char_rows = []
    for c in chars:
        tier = esc(c.get("tier"))
        char_rows.append(
            f"<tr><td><code>{esc(c.get('id'))}</code></td><td><strong>{esc(c.get('name'))}</strong></td>"
            f"<td><span class='pill tier-{tier}'>{tier}</span></td><td>{esc(c.get('role'))}</td>"
            f"<td>{esc(c.get('trait'))}</td><td>{esc(c.get('arc') or '—')}</td></tr>"
        )

    part_cards = []
    for p in parts:
        dur = float(p.get("target_sec") or 60)
        wb = round(dur * wps)
        cs = ", ".join(char_map.get(x, x) for x in (p.get("characterIds") or []))
        ss = ", ".join(scene_map.get(x, x) for x in (p.get("sceneIds") or []))
        ps = ", ".join(prop_map.get(x, x) for x in (p.get("propIds") or [])) or "—"
        cues = "".join(f"<span class='chip'>{esc(x)}</span>" for x in (p.get("soundCues") or []))
        cues_html = f"<div class='chips'>{cues}</div>" if cues else ""
        part_cards.append(
            f"<div class='card part-card'><div class='part-top'><h3>Phần {esc(p.get('part'))}: {esc(p.get('title'))}</h3>"
            f"<div class='meta'><span class='pill'>{int(dur)}s (~{wb} từ)</span><span class='pill light-{esc(p.get('light'))}'>{esc(p.get('light'))}</span></div></div>"
            f"<p class='kv'><strong>Hook mở:</strong> {esc(p.get('hook'))}</p>"
            f"<p class='syn'>{esc(p.get('synopsis'))}</p>"
            f"<p class='kv'><strong>Treo cuối:</strong> {esc(p.get('suspense'))}</p>"
            f"<div class='tags'><span><strong>Nhân vật:</strong> {esc(cs)}</span> · <span><strong>Bối cảnh:</strong> {esc(ss)}</span> · <span><strong>Đạo cụ:</strong> {esc(ps)}</span></div>"
            f"{cues_html}</div>"
        )

    gate_rows = []
    for g in gates:
        st_cls = "ok" if g["ok"] else "bad"
        st_lbl = "ĐẠT" if (g["ok"] and g["applies"]) else ("BỎ QUA" if not g["applies"] else "CHƯA ĐẠT")
        gate_rows.append(
            f"<div class='gate {st_cls}'><span class='g-badge'>{st_lbl}</span>"
            f"<div><strong>{esc(g['title'])}</strong><div class='g-det'>{esc(g['detail'])}</div></div></div>"
        )

    prop_cards = []
    for pr in props:
        sts = " -> ".join(pr.get("states") or [])
        prop_cards.append(
            f"<div class='card'><strong><code>{esc(pr.get('id'))}</code> {esc(pr.get('name'))}</strong>"
            f"<p>{esc(pr.get('function'))}</p>"
            f"<div class='g-det'>Gánh beats: <code>{esc(', '.join(pr.get('beatIds') or []))}</code>"
            + (f" · Biến đổi: {esc(sts)}" if sts else "")
            + "</div></div>"
        )

    scene_cards = []
    for s in scenes:
        scene_cards.append(
            f"<div class='card'><strong><code>{esc(s.get('id'))}</code> {esc(s.get('name'))}</strong> "
            f"<span class='pill dim'>{'Bối cảnh chính' if s.get('primary', True) else 'Phụ'}</span>"
            f"<p>{esc(s.get('atmosphere'))}</p>"
            + (f"<div class='g-det'>Tái sử dụng: {esc(s.get('reusePlan'))}</div>" if s.get("reusePlan") else "")
            + "</div>"
        )

    raw_json = html.escape(json.dumps(doc, ensure_ascii=False, indent=2))
    status_badge = f"ĐẠT {len(gates) - len(failed)}/{len(gates)} CỔNG" if not failed else f"LỖI {len(failed)} CỔNG"

    return f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{esc(doc.get('title'))} — Horror Story Bible</title>
<style>
  :root {{ --bg:#0b0c10; --panel:#13161d; --panel2:#191d27; --ink:#eceae4; --muted:#9aa3b2; --acc:#c8433c; --gold:#d69e4e; --ok:#38a169; --line:#262b38; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }}
  .wrap {{ max-width:1120px; margin:0 auto; padding:28px 20px 64px; }}
  header {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; gap:14px; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:22px; }}
  h1 {{ margin:0; font-size:26px; letter-spacing:.2px; }}
  h2 {{ margin:28px 0 12px; font-size:17px; color:var(--gold); text-transform:uppercase; letter-spacing:.8px; }}
  h3 {{ margin:0; font-size:16px; }}
  .kpis {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }}
  .kpi {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }}
  .kpi .v {{ font-size:22px; font-weight:700; color:#fff; }}
  .kpi .k {{ font-size:12px; color:var(--muted); }}
  .grid2 {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; }}
  .card {{ background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }}
  .premise {{ background:linear-gradient(135deg,#18131a,#12161f); border:1px solid #35232b; border-radius:12px; padding:16px 18px; }}
  .pill {{ display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; background:#232938; color:#dfe6f2; margin-right:6px; }}
  .pill.red {{ background:#5f1c1e; color:#ffd4d2; }}
  .pill.dim {{ background:#1b202b; color:var(--muted); }}
  .pill.tier-lead {{ background:#5a2125; color:#ffd7d5; }}
  .pill.tier-support {{ background:#3d2f18; color:#ffe3b3; }}
  .beats {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:10px; }}
  .beat {{ background:var(--panel); border:1px solid var(--line); border-left:4px solid #48536a; border-radius:8px; padding:10px 12px; font-size:13px; }}
  .beat.major {{ border-left-color:var(--acc); background:#1a1318; }}
  .b-head {{ margin-bottom:6px; }}
  table {{ width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }}
  th, td {{ text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; font-size:13px; }}
  th {{ background:var(--panel2); color:var(--muted); font-weight:600; }}
  .part-card {{ margin-bottom:12px; }}
  .part-top {{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }}
  .syn {{ margin:8px 0; color:#e6e8ee; }}
  .kv {{ margin:4px 0; font-size:13px; color:#d2d7e2; }}
  .tags {{ margin-top:8px; font-size:12px; color:var(--muted); }}
  .chips {{ margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; }}
  .chip {{ background:#1e2330; border:1px solid var(--line); padding:2px 8px; border-radius:6px; font-size:11px; color:#c8d0de; }}
  .gate {{ display:flex; gap:10px; align-items:flex-start; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:10px 12px; }}
  .gate.bad {{ border-color:#78282b; background:#1c1114; }}
  .g-badge {{ font-size:11px; font-weight:700; padding:2px 7px; border-radius:6px; background:#1d3b2b; color:#9af0be; white-space:nowrap; }}
  .gate.bad .g-badge {{ background:#5e1c20; color:#ffc2c5; }}
  .g-det {{ font-size:12px; color:var(--muted); margin-top:2px; }}
  .toolbar {{ display:flex; gap:10px; margin-top:18px; }}
  button {{ cursor:pointer; background:var(--acc); color:#fff; border:none; border-radius:8px; padding:8px 14px; font-weight:600; }}
  button.sec {{ background:var(--panel2); border:1px solid var(--line); }}
  pre {{ display:none; background:#07080b; border:1px solid var(--line); padding:12px; border-radius:8px; overflow:auto; max-height:380px; font-size:12px; }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <div class="pill">{esc(params.get('genre'))}</div><div class="pill dim">{esc(params.get('mode'))} · {esc(params.get('adaptMode'))}</div>
      <h1>{esc(doc.get('title'))}</h1>
    </div>
    <div><span class="pill {'red' if failed else ''}">{status_badge}</span></div>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="v">{len(parts)}</div><div class="k">Số phần ({int(total_sec)}s · ~{total_words} từ)</div></div>
    <div class="kpi"><div class="v">{len(chars)}</div><div class="k">Nhân vật</div></div>
    <div class="kpi"><div class="v">{len(scenes)}</div><div class="k">Bối cảnh</div></div>
    <div class="kpi"><div class="v">{len(props)}</div><div class="k">Đạo cụ kể chuyện</div></div>
    <div class="kpi"><div class="v">{len(beats)}</div><div class="k">Cao trào / Tiết lộ</div></div>
  </div>

  <div class="premise">
    <p class="kv"><strong>Cốt lõi (Premise):</strong> {esc(premise.get('core'))}</p>
    <p class="kv"><strong>Luật thực thể / Điều cấm kỵ:</strong> {esc(premise.get('entityRule'))}</p>
    <p class="kv"><strong>Trọng tâm cú lật (Twist):</strong> {esc(premise.get('twistCore'))}</p>
  </div>

  <h2>Nhịp Cao trào & Tiết lộ (Beats)</h2>
  <div class="beats">{''.join(beat_cards)}</div>

  <h2>Tuyến Nhân vật</h2>
  <table><thead><tr><th>ID</th><th>Tên</th><th>Cấp</th><th>Vai trò</th><th>Đặc điểm</th><th>Cung biến đổi (Arc)</th></tr></thead>
  <tbody>{''.join(char_rows)}</tbody></table>

  <h2>Bối cảnh & Đạo cụ kể chuyện</h2>
  <div class="grid2">{''.join(scene_cards)}{''.join(prop_cards)}</div>

  <h2>Tóm tắt từng phần</h2>
  {''.join(part_cards)}

  <h2>Kiểm định Chất lượng Cốt truyện (14 Cổng)</h2>
  <div class="grid2">{''.join(gate_rows)}</div>

  <div class="toolbar">
    <button onclick="downloadJson()">Tải story.json</button>
    <button class="sec" onclick="toggleRaw()">Xem / Ẩn JSON gốc</button>
  </div>
  <pre id="raw">{raw_json}</pre>
</div>
<script>
const STORY_JSON = document.getElementById('raw').textContent;
function toggleRaw(){{ const el = document.getElementById('raw'); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }}
function downloadJson(){{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([STORY_JSON], {{type:'application/json'}}));
  a.download = 'story.json';
  a.click();
}}
</script>
</body>
</html>"""


def cmd_render(args):
    doc = read_json(args.story)
    out_txt = render_markdown(doc) if args.md else render_html(doc)
    if args.out:
        write_text(args.out, out_txt)
        print(f"Rendered -> {args.out}")
    else:
        print(out_txt)


def cmd_export_outline(args):
    doc = read_json(args.story)
    parts = doc.get("parts") or []
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    outline = {
        "title": doc.get("title", ""),
        "aspect": args.aspect,
        "audio_drone_hz": args.drone_hz,
        "locations": [
            {
                "id": s.get("id", f"S{idx:02d}"),
                "name": s.get("name", ""),
                "atmosphere": s.get("atmosphere", ""),
                "reusePlan": s.get("reusePlan", ""),
            }
            for idx, s in enumerate(scenes, 1)
        ],
        "castAppearanceBriefs": [
            {
                "id": c.get("id", f"C{idx:02d}"),
                "name": c.get("name", ""),
                "role": c.get("role", ""),
                "appearanceBrief": c.get("appearanceBrief") or c.get("trait", ""),
            }
            for idx, c in enumerate(chars, 1)
        ],
        "parts": [
            {
                "part": p["part"],
                "title": p.get("title", f"Part {p['part']}"),
                "target_sec": p.get("target_sec", 60),
                "light": p.get("light", "coldMoon"),
                "transition_out": "cut" if i < len(parts) else "fade:0.5",
                "cliffhanger": p.get("suspense", ""),
            }
            for i, p in enumerate(parts, 1)
        ],
    }
    text = json.dumps(outline, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        write_text(args.out, text)
        print(f"Exported OUTLINE.json -> {args.out}")
    else:
        print(text)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="Horror Story Architect CLI (2-round story planning & 14 quality gates)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ch = sub.add_parser("chunk", help="Split long source novel/story .txt into volumes")
    p_ch.add_argument("book")
    p_ch.add_argument("workdir")
    p_ch.add_argument("--per-volume", type=int, default=15)
    p_ch.add_argument("--chunk-chars", type=int, default=18000)

    p_sd = sub.add_parser("seed", help="Generate starter story.json skeleton")
    p_sd.add_argument("--title", required=True)
    p_sd.add_argument("--parts", type=int, default=1)
    p_sd.add_argument("--mode", choices=["auto", "standalone", "series"], default="auto")
    p_sd.add_argument("--genre", default="folklore")
    p_sd.add_argument("--adapt-mode", choices=["original", "folklore", "adapt", "reimagine"], default="original")
    p_sd.add_argument("--out")

    p_vl = sub.add_parser("validate", help="Run 14 deterministic story quality gates")
    p_vl.add_argument("story")
    p_vl.add_argument("--stage", choices=["skeleton", "beats", "full"], default="full")

    p_ck = sub.add_parser("checkup", help="Compact pass/fail summary of all 14 gates")
    p_ck.add_argument("story")

    p_rn = sub.add_parser("render", help="Render Story Bible as HTML (default) or Markdown")
    p_rn.add_argument("story")
    p_rn.add_argument("--html", action="store_true")
    p_rn.add_argument("--md", action="store_true")
    p_rn.add_argument("--out")

    p_ex = sub.add_parser("export-outline", help="Export OUTLINE.json compatible with horror-series-pipeline")
    p_ex.add_argument("story")
    p_ex.add_argument("--aspect", choices=["9:16", "16:9"], default="9:16")
    p_ex.add_argument("--drone-hz", type=float, default=43.65)
    p_ex.add_argument("--out")

    args = ap.parse_args()
    if args.cmd == "chunk":
        cmd_chunk(args)
    elif args.cmd == "seed":
        cmd_seed(args)
    elif args.cmd == "validate":
        cmd_validate(args)
    elif args.cmd == "checkup":
        cmd_checkup(args)
    elif args.cmd == "render":
        cmd_render(args)
    elif args.cmd == "export-outline":
        cmd_export_outline(args)


if __name__ == "__main__":
    main()
