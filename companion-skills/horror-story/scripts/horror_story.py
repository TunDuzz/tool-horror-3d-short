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
VALID_ROLE_TYPES = {"human", "entity", "silhouette", "lurker"}
VALID_JUMPSCARE_STYLES = {"cinema_stab", "entity_shriek", "metal_dread", "vhs_psx_glitch"}
VALID_LANDMARK_KINDS = {"stance", "prop", "portal", "window", "entity", "lurker", "camera", "zone"}
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
        "schemaVersion": "2.0",
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
                "roleType": "human",
                "role": "Nhân vật chính",
                "heightMeters": 1.72,
                "trait": "",
                "appearanceBrief": "",
                "movementRules": "Ngồi/đứng/chạy có lộ trình thực tế qua cửa nối giữa các phòng",
                "arc": "",
                "from": ["Sáng tác mới" if args.adapt_mode == "original" else "Nguồn gốc"],
            },
            {
                "id": "C02",
                "name": "",
                "tier": "lead",
                "roleType": "entity",
                "role": "Thực thể kinh dị / Phản diện",
                "heightMeters": 1.85,
                "trait": "",
                "appearanceBrief": "",
                "movementRules": "Ẩn sau khe cửa / góc tối trước Dead Silence, chỉ lộ diện toàn thân ở cao trào",
                "arc": "",
                "from": ["Sáng tác mới" if args.adapt_mode == "original" else "Nguồn gốc"],
            },
        ],
        "scenes": [
            {
                "id": "S01",
                "name": "",
                "primary": True,
                "archetype": "oldRuralWoodenHouse",
                "dimensions": [6.0, 7.2, 4.0],
                "ceilingType": "aFrameThatch",
                "atmosphere": "",
                "practicalLights": ["oilLamp"],
                "landmarks": [
                    {"id": "POV_START", "kind": "stance", "pos": [0.0, 0.0, 1.8], "note": "Vị trí xuất phát nhân vật chính"},
                    {"id": "HERO_PROP_SPOT", "kind": "prop", "pos": [1.0, 0.0, 0.4], "note": "Vị trí bàn/đèn/đạo cụ"},
                    {"id": "MAIN_DOOR", "kind": "portal", "pos": [0.0, 0.0, -3.4], "note": "Cửa chính của căn phòng"},
                ],
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
                "actionBeats": [],
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


def evaluate_gates(doc, stage="full", strict_spatial=False):
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
    spatial_mode = (
        bool(strict_spatial)
        or str(doc.get("schemaVersion", "")).strip().startswith("2")
        or any(bool(s.get("landmarks")) for s in scenes)
        or any(bool(p.get("actionBeats")) for p in parts)
    )

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

    # Spatial & Action Blocking Gates (15..18 — active automatically for v2.0 / landmarks / actionBeats or --strict-spatial)
    if spatial_mode:
        # 15. char-appearance-brief
        ap_errs = []
        for c in chars:
            cid = c.get("id") or "?"
            brief = str(c.get("appearanceBrief", "")).strip()
            if len(brief) < 12:
                ap_errs.append(f"{cid} thiếu appearanceBrief chi tiết (>=12 ký tự)")
            rt = c.get("roleType")
            if rt is not None and rt not in VALID_ROLE_TYPES:
                ap_errs.append(f"{cid} roleType={rt!r} không hợp lệ")
        add_gate(
            "char-appearance-brief",
            "15. Khóa ngoại hình nhân vật (`appearanceBrief`)",
            not ap_errs,
            "100% nhân vật/thực thể có mô tả ngoại hình chi tiết chuyển thẳng sang CharacterBlueprint"
            if not ap_errs
            else "; ".join(ap_errs[:4]),
        )

        # 16. scene-spatial-floorplan
        fp_errs = []
        scene_lm_map = {}
        for s in scenes:
            sid = s.get("id") or "?"
            lms = s.get("landmarks") or []
            scene_lm_map[sid] = {str(lm.get("id")): lm for lm in lms if isinstance(lm, dict) and lm.get("id")}
            if not s.get("primary", True) and not lms:
                continue
            dims = s.get("dimensions")
            if not (isinstance(dims, list) and len(dims) == 3 and all(isinstance(v, (int, float)) and v > 0 for v in dims)):
                fp_errs.append(f"{sid} thiếu dimensions [w, d, h] > 0")
                w, d, h = 10.0, 10.0, 5.0
            else:
                w, d, h = float(dims[0]), float(dims[1]), float(dims[2])
            if len(lms) < 3:
                fp_errs.append(f"{sid} cần >= 3 landmarks trên mặt bằng (hiện có {len(lms)})")
            seen_lm = set()
            for lm in lms:
                lid = str(lm.get("id", "")).strip()
                if not lid:
                    fp_errs.append(f"{sid} có landmark thiếu id")
                    continue
                if lid in seen_lm:
                    fp_errs.append(f"{sid} trùng landmark '{lid}'")
                seen_lm.add(lid)
                pos = lm.get("pos")
                if not (isinstance(pos, list) and len(pos) == 3 and all(isinstance(v, (int, float)) for v in pos)):
                    fp_errs.append(f"{sid}:{lid} thiếu tọa độ pos [x,y,z]")
                    continue
                px, py, pz = float(pos[0]), float(pos[1]), float(pos[2])
                kind = str(lm.get("kind", "zone")).lower()
                # Allow exterior corridor portals/entity staging up to 5m past back/front wall
                x_lim = w * 0.5 + (2.5 if kind in ("portal", "entity", "lurker") else 0.75)
                z_lim = d * 0.5 + (5.0 if kind in ("portal", "entity", "lurker") else 0.75)
                if abs(px) > x_lim or not (-1.0 <= py <= h + 1.0) or abs(pz) > z_lim:
                    fp_errs.append(f"{sid}:{lid} pos={pos} vượt khỏi kích thước phòng {dims}")
        # Validate portal connectsTo references
        for s in scenes:
            sid = s.get("id") or "?"
            for lm in s.get("landmarks") or []:
                conn = str(lm.get("connectsTo", "")).strip()
                if conn and ":" in conn:
                    t_sid, t_lid = conn.split(":", 1)
                    if t_sid not in scene_lm_map or t_lid not in scene_lm_map[t_sid]:
                        fp_errs.append(f"{sid}:{lm.get('id')} connectsTo='{conn}' không tồn tại")
        add_gate(
            "scene-spatial-floorplan",
            "16. Mặt bằng 2D & Tọa độ Điểm neo (`landmarks`)",
            not fp_errs,
            "Đủ kích thước phòng, >=3 điểm neo hợp lệ và cửa thông phòng khớp 100%"
            if not fp_errs
            else "; ".join(fp_errs[:4]),
        )

        # 17 & 18: Action Blocking Continuity + Jumpscare Pacing Cap (checked at stage=full)
        if stage == "full":
            blk_errs = []
            js_errs = []
            char_ids_set = {c.get("id") for c in chars if c.get("id")}
            prop_map_full = {pr.get("id"): pr for pr in props if pr.get("id")}
            for p in parts:
                pid = p.get("part")
                abeats = p.get("actionBeats") or []
                if len(abeats) < 2:
                    blk_errs.append(f"P{pid} thiếu actionBeats tuần tự (>=2 hành động)")
                    continue
                actor_last = {}  # actor_id -> (sceneId, toLandmark, visible)
                prop_state = {
                    pr_id: (pr.get("initialState") or ((pr.get("states") or [None])[0]))
                    for pr_id, pr in prop_map_full.items()
                }
                js_count = 0
                for idx_ab, ab in enumerate(abeats):
                    ab_id = ab.get("beatId") or f"P{pid}_AB{idx_ab+1}"
                    ab_sid = ab.get("sceneId")
                    if ab_sid not in scene_lm_map:
                        blk_errs.append(f"{ab_id} sceneId='{ab_sid}' không tồn tại")
                        continue
                    lm_ids = scene_lm_map[ab_sid]
                    cam = ab.get("camera") or {}
                    for ck in ("posLandmark", "lookLandmark"):
                        val = cam.get(ck)
                        if val and val not in lm_ids and val not in char_ids_set:
                            blk_errs.append(f"{ab_id} camera.{ck}='{val}' không có trong {ab_sid}.landmarks")
                    cut_type = str(ab.get("cutType", "")).strip()
                    for act in ab.get("actors") or []:
                        aid = act.get("id")
                        if aid not in char_ids_set:
                            blk_errs.append(f"{ab_id} actor '{aid}' chưa khai báo")
                            continue
                        vis = bool(act.get("visible", True))
                        frm = act.get("fromLandmark") or act.get("landmark")
                        to = act.get("toLandmark") or frm
                        if frm and frm not in lm_ids:
                            blk_errs.append(f"{ab_id} actor {aid} fromLandmark='{frm}' không có trong {ab_sid}")
                        if to and to not in lm_ids:
                            blk_errs.append(f"{ab_id} actor {aid} toLandmark='{to}' không có trong {ab_sid}")
                        prev = actor_last.get(aid)
                        if (
                            vis
                            and prev is not None
                            and prev[2]
                            and prev[0] == ab_sid
                            and frm
                            and prev[1]
                            and frm != prev[1]
                            and not act.get("allowTeleport")
                            and cut_type not in ("blackout", "timeSkip", "flashCut")
                        ):
                            blk_errs.append(
                                f"TELEPORT ở {ab_id}: {aid} vừa ở '{prev[1]}' bỗng nhảy sang '{frm}' trong cùng {ab_sid}!"
                            )
                        actor_last[aid] = (ab_sid, to or frm, vis)
                    for pc in ab.get("propChanges") or []:
                        pr_id = pc.get("id")
                        if pr_id not in prop_map_full:
                            blk_errs.append(f"{ab_id} prop '{pr_id}' chưa khai báo")
                            continue
                        pr_def = prop_map_full[pr_id]
                        valid_states = pr_def.get("states") or []
                        st_from = pc.get("fromState")
                        st_to = pc.get("toState")
                        if valid_states:
                            if st_from and st_from not in valid_states:
                                blk_errs.append(f"{ab_id} prop {pr_id} fromState='{st_from}' ngoài states={valid_states}")
                            if st_to and st_to not in valid_states:
                                blk_errs.append(f"{ab_id} prop {pr_id} toState='{st_to}' ngoài states={valid_states}")
                        cur_st = prop_state.get(pr_id)
                        if cur_st and st_from and st_from != cur_st:
                            blk_errs.append(
                                f"PROP_STATE_DRIFT ở {ab_id}: {pr_id} đang ở '{cur_st}' nhưng khai báo fromState='{st_from}'!"
                            )
                        if st_to:
                            prop_state[pr_id] = st_to
                    js_st = ab.get("jumpscareStyle")
                    if js_st:
                        js_count += 1
                        if js_st not in VALID_JUMPSCARE_STYLES:
                            js_errs.append(f"{ab_id} jumpscareStyle='{js_st}' không hợp lệ")
                        if idx_ab == 0 and pid == 1:
                            js_errs.append(f"{ab_id} không đặt Jumpscare ngay beat đầu tiên của Phần 1")
                if js_count > 2:
                    js_errs.append(f"P{pid} có {js_count} Jumpscare (>2 sẽ gây nhờn cảm xúc)")
            add_gate(
                "action-blocking-continuity",
                "17. Liên tục hành động & Trạng thái đạo cụ (`actionBeats`)",
                not blk_errs,
                "0 lỗi teleport nhân vật, 0 lỗi nhảy ngược đạo cụ, 100% điểm neo khớp mặt bằng"
                if not blk_errs
                else "; ".join(blk_errs[:4]),
            )
            add_gate(
                "horror-pacing-jumpscare-cap",
                "18. Giới hạn Jumpscare & Đồng bộ Audio (`<=2`/phần)",
                not js_errs,
                "Phân bổ Jumpscare hợp lý, đúng 4 phong cách v7.1" if not js_errs else "; ".join(js_errs[:4]),
            )
        else:
            add_gate("action-blocking-continuity", "17. Liên tục hành động (`actionBeats`)", True, "Kiểm ở stage full", applies=False)
            add_gate("horror-pacing-jumpscare-cap", "18. Giới hạn Jumpscare (`<=2`/phần)", True, "Kiểm ở stage full", applies=False)
    else:
        for gid, gtitle in [
            ("char-appearance-brief", "15. Khóa ngoại hình nhân vật"),
            ("scene-spatial-floorplan", "16. Mặt bằng 2D & Điểm neo"),
            ("action-blocking-continuity", "17. Liên tục hành động (`actionBeats`)"),
            ("horror-pacing-jumpscare-cap", "18. Giới hạn Jumpscare (`<=2`/phần)"),
        ]:
            add_gate(gid, gtitle, True, "Bỏ qua (schema v1 cũ — nâng cấp schemaVersion:'2.0' hoặc dùng --strict-spatial để bật)", applies=False)

    failed = [g for g in gates if g["applies"] and not g["ok"]]
    return gates, failed


def cmd_validate(args):
    doc = read_json(args.story)
    gates, failed = evaluate_gates(doc, stage=args.stage, strict_spatial=getattr(args, "strict_spatial", False))
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
    gates, failed = evaluate_gates(doc, stage="full", strict_spatial=getattr(args, "strict_spatial", False))
    for g in gates:
        mark = "✓" if (g["ok"] or not g["applies"]) else "✗"
        print(f" {mark} {g['title']} — {g['detail']}")
    sys.exit(1 if failed else 0)


def _render_scene_floorplan_svg(scene, all_action_beats):
    """Render an interactive-ready Top-Down 2D architectural SVG floorplan with room bounds, landmarks, portals & movement paths."""
    lms = scene.get("landmarks") or []
    dims = scene.get("dimensions") or [6.0, 7.0, 3.6]
    if not lms:
        return ""
    w_m, d_m = float(dims[0]), float(dims[1])
    xs = [-w_m * 0.5, w_m * 0.5] + [float(lm["pos"][0]) for lm in lms if isinstance(lm.get("pos"), list) and len(lm["pos"]) == 3]
    zs = [-d_m * 0.5, d_m * 0.5] + [float(lm["pos"][2]) for lm in lms if isinstance(lm.get("pos"), list) and len(lm["pos"]) == 3]
    min_x, max_x = min(xs) - 0.8, max(xs) + 0.8
    min_z, max_z = min(zs) - 0.8, max(zs) + 0.8
    span_x = max(2.0, max_x - min_x)
    span_z = max(2.0, max_z - min_z)
    W, H, pad = 420.0, 340.0, 34.0
    scale = min((W - 2 * pad) / span_x, (H - 2 * pad) / span_z)
    ox = (W - span_x * scale) * 0.5
    oz = (H - span_z * scale) * 0.5

    def pt(x, z):
        return (ox + (x - min_x) * scale, oz + (z - min_z) * scale)

    rx0, rz0 = pt(-w_m * 0.5, -d_m * 0.5)
    rx1, rz1 = pt(w_m * 0.5, d_m * 0.5)
    lm_pos = {lm["id"]: pt(float(lm["pos"][0]), float(lm["pos"][2])) for lm in lms if lm.get("id") and isinstance(lm.get("pos"), list) and len(lm["pos"]) == 3}

    sid = scene.get("id")
    cam_pts = []
    ent_paths = []
    for ab in all_action_beats:
        if ab.get("sceneId") != sid:
            continue
        cam_lm = (ab.get("camera") or {}).get("posLandmark")
        if cam_lm in lm_pos:
            cam_pts.append((ab.get("beatId", ""), lm_pos[cam_lm]))
        for act in ab.get("actors") or []:
            if not act.get("visible", True):
                continue
            f_lm = act.get("fromLandmark") or act.get("landmark")
            t_lm = act.get("toLandmark") or f_lm
            if f_lm in lm_pos and t_lm in lm_pos:
                ent_paths.append((ab.get("beatId", ""), lm_pos[f_lm], lm_pos[t_lm]))

    parts_svg = [
        f"<svg viewBox='0 0 {int(W)} {int(H)}' class='fp-svg' xmlns='http://www.w3.org/2000/svg'>",
        "<defs><marker id='arr-cam' markerWidth='7' markerHeight='7' refX='6' refY='3.5' orient='auto'><polygon points='0 0, 7 3.5, 0 7' fill='#63b3ed'/></marker>"
        "<marker id='arr-ent' markerWidth='7' markerHeight='7' refX='6' refY='3.5' orient='auto'><polygon points='0 0, 7 3.5, 0 7' fill='#fc8181'/></marker></defs>",
        f"<rect x='0' y='0' width='{int(W)}' height='{int(H)}' rx='10' fill='#0a0c12'/>",
        # Room architectural wall outline
        f"<rect x='{rx0:.1f}' y='{rz0:.1f}' width='{rx1 - rx0:.1f}' height='{rz1 - rz0:.1f}' fill='#141824' stroke='#64748b' stroke-width='2.5'/>",
        f"<text x='{(rx0+rx1)/2:.1f}' y='{rz0 - 8:.1f}' fill='#94a3b8' font-size='10' text-anchor='middle'>BẮC (-Z) · {w_m:.1f}m × {d_m:.1f}m</text>",
        f"<text x='{(rx0+rx1)/2:.1f}' y='{rz1 + 14:.1f}' fill='#64748b' font-size='10' text-anchor='middle'>NAM (+Z)</text>",
    ]
    # Camera path arrows
    for i in range(len(cam_pts) - 1):
        (_, (x0, y0)), (_, (x1, y1)) = cam_pts[i], cam_pts[i + 1]
        if math.hypot(x1 - x0, y1 - y0) > 4.0:
            parts_svg.append(f"<line x1='{x0:.1f}' y1='{y0:.1f}' x2='{x1:.1f}' y2='{y1:.1f}' stroke='#63b3ed' stroke-width='1.8' stroke-dasharray='4 3' marker-end='url(#arr-cam)' opacity='0.85'/>")
    # Entity movement arrows
    for _, (x0, y0), (x1, y1) in ent_paths:
        if math.hypot(x1 - x0, y1 - y0) > 4.0:
            parts_svg.append(f"<line x1='{x0:.1f}' y1='{y0:.1f}' x2='{x1:.1f}' y2='{y1:.1f}' stroke='#fc8181' stroke-width='2.2' marker-end='url(#arr-ent)' opacity='0.92'/>")
    # Landmark markers
    kind_col = {"portal": "#38bdf8", "window": "#60a5fa", "prop": "#f59e0b", "stance": "#34d399", "entity": "#f87171", "lurker": "#fb7185", "camera": "#38bdf8"}
    for lm in lms:
        lid = str(lm.get("id", ""))
        if lid not in lm_pos:
            continue
        cx, cy = lm_pos[lid]
        k = str(lm.get("kind", "zone")).lower()
        col = kind_col.get(k, "#cbd5e1")
        if k == "portal":
            parts_svg.append(f"<rect x='{cx - 10:.1f}' y='{cy - 4:.1f}' width='20' height='8' rx='2' fill='{col}' stroke='#0b0c10' stroke-width='1.2'/>")
        elif k in ("entity", "lurker"):
            parts_svg.append(f"<polygon points='{cx:.1f},{cy-7:.1f} {cx+7:.1f},{cy:.1f} {cx:.1f},{cy+7:.1f} {cx-7:.1f},{cy:.1f}' fill='{col}'/>")
        else:
            parts_svg.append(f"<circle cx='{cx:.1f}' cy='{cy:.1f}' r='5.5' fill='{col}' stroke='#0b0c10' stroke-width='1.2'/>")
        lbl = html.escape(lid)
        parts_svg.append(f"<text x='{cx + 8:.1f}' y='{cy + 3:.1f}' fill='#e2e8f0' font-size='9.5' font-family='monospace'>{lbl}</text>")
    parts_svg.append("</svg>")
    return "".join(parts_svg)


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
        "## 2. Bối cảnh, Mặt bằng & Đạo cụ kể chuyện",
        "### Bối cảnh & Điểm neo (`landmarks`)",
    ]
    for s in scenes:
        reuse = f" · *Tái sử dụng:* {s['reusePlan']}" if s.get("reusePlan") else ""
        dims = f" · `{s['dimensions'][0]}×{s['dimensions'][1]}×{s['dimensions'][2]}m`" if isinstance(s.get("dimensions"), list) and len(s["dimensions"]) == 3 else ""
        lines.append(f"- **`{s.get('id')}` {s.get('name')}** (`{'Chính' if s.get('primary', True) else 'Phụ'}`{dims}): {s.get('atmosphere', '')}{reuse}")
        for lm in s.get("landmarks") or []:
            conn = f" -> nối tới `{lm['connectsTo']}`" if lm.get("connectsTo") else ""
            lines.append(f"  - `{lm.get('id')}` (`{lm.get('kind', 'zone')}` @ `{lm.get('pos')}`): {lm.get('note', '')}{conn}")

    lines += ["", "### Đạo cụ gánh cốt truyện"]
    if props:
        for pr in props:
            st = " -> ".join(pr.get("states") or [])
            lines.append(f"- **`{pr.get('id')}` {pr.get('name')}**: {pr.get('function', '')} (Beats: `{','.join(pr.get('beatIds') or [])}`" + (f"; State Machine: `{st}`" if st else "") + ")")
    else:
        lines.append("- *(Chưa có đạo cụ)*")

    lines += ["", "## 3. Nhịp Cao trào (`Beats`)"]
    for b in beats:
        lines.append(f"- **`{b.get('id')}` [P{b.get('part')} · {b.get('weight', 'minor').upper()} · {b.get('type')}]**: *Gieo:* {b.get('setup')} -> *Gặt:* {b.get('payoff')}")

    lines += ["", "## 4. Tóm tắt & Bảng Blocking Hành Động từng phần"]
    for p in parts:
        dur = float(p.get("target_sec") or 60)
        wb = round(dur * wps)
        lines += [
            f"### Phần {p.get('part')}: {p.get('title', '')} (`{int(dur)}s` · ~`{wb} từ` · `{p.get('light')}`)",
            f"- **Hook mở:** {p.get('hook', '')}",
            f"- **Diễn biến:** {p.get('synopsis', '')}",
            f"- **Treo cuối (Suspense):** {p.get('suspense', '')}",
            f"- **Nhân vật / Bối cảnh / Đạo cụ:** `{','.join(p.get('characterIds') or [])}` / `{','.join(p.get('sceneIds') or [])}` / `{','.join(p.get('propIds') or [])}`",
        ]
        if p.get("actionBeats"):
            lines += [
                "",
                "| Beat | Phòng | Camera (`pos -> look`) | Nhân vật & Di chuyển | Biến đổi Đạo cụ | Audio / Jumpscare |",
                "|---|---|---|---|---|---|",
            ]
            for ab in p["actionBeats"]:
                cam = ab.get("camera") or {}
                cam_s = f"`{cam.get('posLandmark', '-')}` -> `{cam.get('lookLandmark', '-')}` ({cam.get('stance', '-')})"
                acts_s = "; ".join(
                    f"`{a.get('id')}`({'hiện' if a.get('visible', True) else 'ẩn'} {a.get('fromLandmark', '-') }->{a.get('toLandmark', a.get('fromLandmark', '-'))} · {a.get('pose', '-')})"
                    for a in (ab.get("actors") or [])
                ) or "—"
                props_s = "; ".join(
                    f"`{pc.get('id')}`: `{pc.get('fromState', '-')}`->`{pc.get('toState', '-')}`"
                    for pc in (ab.get("propChanges") or [])
                ) or "—"
                aud_s = f"`{ab.get('audioCue') or '-'}`" + (f" · **JS:{ab.get('jumpscareStyle')}**" if ab.get("jumpscareStyle") else "")
                lines.append(f"| `{ab.get('beatId')}` | `{ab.get('sceneId')}` | {cam_s} | {acts_s} | {props_s} | {aud_s} |")
        lines.append("")
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
        ab_html = ""
        if p.get("actionBeats"):
            ab_rows = []
            for ab in p["actionBeats"]:
                cam = ab.get("camera") or {}
                cam_s = f"<code>{esc(cam.get('posLandmark', '-'))}</code> → <code>{esc(cam.get('lookLandmark', '-'))}</code> ({esc(cam.get('stance', '-'))})"
                acts_s = "<br/>".join(
                    f"<code>{esc(a.get('id'))}</code> ({'hiện' if a.get('visible', True) else 'ẩn'}: <code>{esc(a.get('fromLandmark', '-'))}</code> → <code>{esc(a.get('toLandmark', a.get('fromLandmark', '-')))}</code> · {esc(a.get('pose', '-'))})"
                    for a in (ab.get("actors") or [])
                ) or "—"
                pr_s = "<br/>".join(
                    f"<code>{esc(pc.get('id'))}</code>: <code>{esc(pc.get('fromState', '-'))}</code> → <code>{esc(pc.get('toState', '-'))}</code>"
                    for pc in (ab.get("propChanges") or [])
                ) or "—"
                js_tag = f" <span class='pill red'>JS: {esc(ab.get('jumpscareStyle'))}</span>" if ab.get("jumpscareStyle") else ""
                ab_rows.append(
                    f"<tr><td><code>{esc(ab.get('beatId'))}</code><div class='g-det'>{esc(ab.get('sceneId'))} · {esc(ab.get('mood', ''))}</div></td>"
                    f"<td>{cam_s}</td><td>{acts_s}</td><td>{pr_s}</td>"
                    f"<td>{esc(ab.get('actionSummary', ''))}<div class='g-det'>SFX: <code>{esc(ab.get('audioCue') or '-')}</code>{js_tag}</div></td></tr>"
                )
            ab_html = (
                "<div style='margin-top:12px'><strong style='color:var(--gold);font-size:12px;text-transform:uppercase'>Bảng Blocking Hành Động (Action Beats)</strong>"
                "<table style='margin-top:6px'><thead><tr><th>Beat</th><th>Camera (Neo → Nhìn)</th><th>Nhân vật & Di chuyển</th><th>Đạo cụ (State Machine)</th><th>Diễn biến & Audio</th></tr></thead>"
                f"<tbody>{''.join(ab_rows)}</tbody></table></div>"
            )
        part_cards.append(
            f"<div class='card part-card'><div class='part-top'><h3>Phần {esc(p.get('part'))}: {esc(p.get('title'))}</h3>"
            f"<div class='meta'><span class='pill'>{int(dur)}s (~{wb} từ)</span><span class='pill light-{esc(p.get('light'))}'>{esc(p.get('light'))}</span></div></div>"
            f"<p class='kv'><strong>Hook mở:</strong> {esc(p.get('hook'))}</p>"
            f"<p class='syn'>{esc(p.get('synopsis'))}</p>"
            f"<p class='kv'><strong>Treo cuối:</strong> {esc(p.get('suspense'))}</p>"
            f"<div class='tags'><span><strong>Nhân vật:</strong> {esc(cs)}</span> · <span><strong>Bối cảnh:</strong> {esc(ss)}</span> · <span><strong>Đạo cụ:</strong> {esc(ps)}</span></div>"
            f"{cues_html}{ab_html}</div>"
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

    all_action_beats = [ab for p in parts for ab in (p.get("actionBeats") or [])]
    scene_cards = []
    for s in scenes:
        svg_fp = _render_scene_floorplan_svg(s, all_action_beats)
        dims = s.get("dimensions")
        dims_badge = f"<span class='pill'>{dims[0]}×{dims[1]}×{dims[2]}m</span>" if isinstance(dims, list) and len(dims) == 3 else ""
        lm_list = ""
        if s.get("landmarks"):
            lm_items = "".join(
                f"<li><code>{esc(lm.get('id'))}</code> ({esc(lm.get('kind', 'zone'))} @ {esc(lm.get('pos'))}): {esc(lm.get('note', ''))}"
                + (f" → <code>{esc(lm.get('connectsTo'))}</code>" if lm.get("connectsTo") else "")
                + "</li>"
                for lm in s["landmarks"]
            )
            lm_list = f"<ul class='lm-list'>{lm_items}</ul>"
        scene_cards.append(
            f"<div class='card'><strong><code>{esc(s.get('id'))}</code> {esc(s.get('name'))}</strong> "
            f"<span class='pill dim'>{'Bối cảnh chính' if s.get('primary', True) else 'Phụ'}</span>{dims_badge}"
            f"<p>{esc(s.get('atmosphere'))}</p>"
            + (f"<div class='fp-wrap'>{svg_fp}</div>" if svg_fp else "")
            + lm_list
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
  .fp-wrap {{ margin:10px 0; }}
  .fp-svg {{ width:100%; max-width:460px; height:auto; border:1px solid var(--line); border-radius:10px; display:block; }}
  .lm-list {{ margin:8px 0 0; padding-left:18px; font-size:12px; color:#c8d0de; }}
  .lm-list li {{ margin:3px 0; }}
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

  <h2>Kiểm định Chất lượng Cốt truyện ({len(gates)} Cổng)</h2>
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


def cmd_export_blueprint(args):
    """Export 3 synchronized downstream starters (SCRIPT.skeleton.md, manifest.draft.json, cues.draft.json) from story.json."""
    doc = read_json(args.story)
    parts = doc.get("parts") or []
    part_no = int(args.part or 1)
    part = next((p for p in parts if int(p.get("part", 0)) == part_no), parts[0] if parts else {})
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    props = doc.get("props") or []
    abeats = part.get("actionBeats") or []
    project_id = args.project_id or re.sub(r"[^a-z0-9-]+", "-", str(doc.get("title", "horror-short")).lower()).strip("-") or "horror-short"
    if len(parts) > 1:
        project_id = f"{project_id}-p{part_no:02d}"

    # 1. SCRIPT.skeleton.md grouped into coherent Acts by mood/deadSilence
    script_lines = [f"# {doc.get('title', project_id)} — Phần {part_no}", ""]
    if abeats:
        cur_mood = None
        for ab in abeats:
            mood = ab.get("mood") or "calm_omen"
            if ab.get("deadSilenceBeforeSec"):
                script_lines.append(f"[DEAD SILENCE {float(ab['deadSilenceBeforeSec']):.2f}s]")
                cur_mood = None
            elif ab.get("pauseBeforeSec"):
                script_lines.append(f"[PAUSE {float(ab['pauseBeforeSec']):.2f}s]")
            if mood != cur_mood:
                script_lines.append(f"[NARRATOR | mood={mood}]")
                cur_mood = mood
            script_lines.append(f"<!-- @{ab.get('beatId')} ({ab.get('sceneId')}): {ab.get('actionSummary', '')} -->")
            script_lines.append(ab.get("spokenHint") or f"[VIẾT LỜI THOẠI CHO {ab.get('beatId')}: {ab.get('actionSummary', '')}]")
    else:
        script_lines += ["[NARRATOR | mood=calm_omen]", part.get("synopsis", "")]

    # 2. manifest.draft.json with locked locations[].anchors + castBlueprints[] + action-synced beats[]
    loc_blueprints = []
    for s in scenes:
        if part.get("sceneIds") and s.get("id") not in part["sceneIds"]:
            continue
        anchors = {
            str(lm["id"]): [float(v) for v in lm["pos"]]
            for lm in (s.get("landmarks") or [])
            if lm.get("id") and isinstance(lm.get("pos"), list) and len(lm["pos"]) == 3
        }
        portals = {
            str(lm["id"]): {"pos": [float(v) for v in lm["pos"]], **({"connectsTo": lm["connectsTo"]} if lm.get("connectsTo") else {})}
            for lm in (s.get("landmarks") or [])
            if lm.get("id") and str(lm.get("kind", "")).lower() == "portal" and isinstance(lm.get("pos"), list) and len(lm["pos"]) == 3
        }
        s_props = [pr.get("name", pr.get("id")) for pr in props if pr.get("sceneId") == s.get("id")]
        while len(s_props) < 3:
            s_props.append(f"storyProp_{len(s_props)+1}")
        loc_blueprints.append({
            "id": s.get("id"),
            "archetype": s.get("archetype") or "customHorrorRoom",
            "dimensions": s.get("dimensions") or [6.0, 7.0, 3.6],
            "ceilingType": s.get("ceilingType") or "flatConcrete",
            "materials": s.get("materials") or {"wall": "mottledPlasterTex", "floor": "darkTimberTex", "ceiling": "concreteCeilingTex"},
            "practicalLights": s.get("practicalLights") or ["oilLamp"],
            "heroProps": s_props,
            "signatureShadowBeat": s.get("atmosphere") or "Story-driven shadow motif",
            "anchors": anchors,
            **({"portals": portals} if portals else {}),
        })

    cast_blueprints = []
    for c in chars:
        if part.get("characterIds") and c.get("id") not in part["characterIds"]:
            continue
        role_t = c.get("roleType") or ("entity" if "thực thể" in str(c.get("role", "")).lower() or "ma" in str(c.get("role", "")).lower() else "human")
        cast_blueprints.append({
            "id": c.get("id"),
            "role": role_t if role_t in VALID_ROLE_TYPES else "human",
            "storyDescription": c.get("appearanceBrief") or c.get("trait") or c.get("role", ""),
            "appearance": {
                "height": float(c.get("heightMeters") or (1.82 if role_t == "entity" else 1.72)),
                "lowPoly": True,
                "outlineMode": "off",
                **({"entity": {"heightScale": 1.15, "breathing": False, "steppedFps": 8}} if role_t == "entity" else {}),
            },
        })

    fps = 30
    cur_f = 0
    m_beats = []
    cues_events = []
    for idx_ab, ab in enumerate(abeats, 1):
        dur_f = max(15, int(round(float(ab.get("durationSec") or 5.0) * fps)))
        a_f, b_f = cur_f, cur_f + dur_f
        cur_f = b_f
        cast_states = {}
        for act in ab.get("actors") or []:
            frm = act.get("fromLandmark") or act.get("landmark") or ""
            to = act.get("toLandmark") or frm
            st_obj = {
                "visible": bool(act.get("visible", True)),
                "anchor": frm,
                "pose": act.get("pose") or "loomingStill",
            }
            if to and to != frm:
                st_obj["moveFromAnchor"] = frm
                st_obj["moveToAnchor"] = to
            if act.get("alignPart"):
                st_obj["alignPart"] = act["alignPart"]
            if act.get("allowTeleport"):
                st_obj["allowTeleport"] = True
            cast_states[act["id"]] = st_obj
        prop_states = {}
        for pc in ab.get("propChanges") or []:
            prop_states[pc["id"]] = {
                "visible": True,
                "fromState": pc.get("fromState", ""),
                "state": pc.get("toState") or pc.get("fromState") or "default",
                **({"triggerWord": pc["triggerWord"]} if pc.get("triggerWord") else {}),
            }
        cam = ab.get("camera") or {}
        beat_cue_ids = []
        if ab.get("jumpscareStyle"):
            cid_ev = f"js_{ab.get('beatId')}"
            beat_cue_ids.append(cid_ev)
            cues_events.append({
                "id": cid_ev,
                "jumpscare": ab["jumpscareStyle"],
                "bus": "sfx",
                "at": round(a_f / fps, 2),
                "target_peak_dbfs": -1.2,
                "tinnitus": True,
                "label": f"Jumpscare {ab['jumpscareStyle']} ({ab.get('beatId')}): {ab.get('actionSummary', '')}",
            })
        elif ab.get("audioCue"):
            cid_ev = f"sfx_{ab.get('beatId')}"
            beat_cue_ids.append(cid_ev)
            cues_events.append({
                "id": cid_ev,
                "sound": ab["audioCue"],
                "bus": "sfx",
                "at": round((a_f + dur_f * 0.25) / fps, 2),
                "align": "onset",
                "target_peak_dbfs": -5.5,
                "label": f"{ab.get('beatId')}: {ab.get('actionSummary', '')}",
            })
        m_beats.append({
            "beatId": ab.get("beatId") or f"B{idx_ab:02d}",
            "shotId": idx_ab,
            "a": a_f,
            "b": b_f,
            "peakFrame": a_f + dur_f // 2,
            "locationId": ab.get("sceneId") or (loc_blueprints[0]["id"] if loc_blueprints else "S01"),
            "lightState": {
                "preset": ab.get("light") or part.get("light") or "coldMoon",
                "lampsOn": list(ab.get("lampsOn") or []),
            },
            "castStates": cast_states,
            "propStates": prop_states,
            **({"camera": {
                "posAnchor": cam.get("posLandmark", ""),
                "lookAnchor": cam.get("lookLandmark", ""),
                **({"lookPart": cam["lookPart"]} if cam.get("lookPart") else {}),
                **({"motion": cam["motion"]} if cam.get("motion") else {}),
            }} if cam.get("posLandmark") or cam.get("lookLandmark") else {}),
            **({"audioCueIds": beat_cue_ids} if beat_cue_ids else {}),
            "cameraIntent": ab.get("actionSummary") or f"Beat {idx_ab}",
        })

    manifest_draft = {
        "projectId": project_id,
        "title": doc.get("title", project_id),
        "totalFrames": cur_f if cur_f > 0 else int(round(float(part.get("target_sec") or 60) * fps)),
        "aspect": args.aspect,
        "locations": loc_blueprints,
        "castBlueprints": cast_blueprints,
        "beats": m_beats,
    }
    cues_draft = {
        "voice": "voice/voice.wav",
        "words": "voice/words.json",
        "target_lufs": -15.0,
        "ceil_db": -1.2,
        "dead_silence_floor_db": -48.0,
        "max_jumpscares": 2,
        "beds": [
            {
                "sound": args.bed_sound,
                "target_rms_dbfs": -33.0,
                "hp_hz": 110,
                "lp_hz": 3200,
                "voice_notch_db": -3.0,
                "duck_db": -4.0,
                "whisper_duck_db": -9.0,
                "label": f"1 nền tùy biến theo bối cảnh: {(scenes[0].get('atmosphere') if scenes else '')[:80]}",
            }
        ],
        "events": cues_events,
    }

    os.makedirs(args.out, exist_ok=True)
    p_script = os.path.join(args.out, "SCRIPT.skeleton.md")
    p_man = os.path.join(args.out, "manifest.draft.json")
    p_cues = os.path.join(args.out, "cues.draft.json")
    write_text(p_script, "\n".join(script_lines) + "\n")
    write_text(p_man, json.dumps(manifest_draft, ensure_ascii=False, indent=2) + "\n")
    write_text(p_cues, json.dumps(cues_draft, ensure_ascii=False, indent=2) + "\n")
    print(f"BLUEPRINT EXPORTED -> {args.out}")
    print(f"  - {p_script}")
    print(f"  - {p_man} ({len(loc_blueprints)} locations, {len(cast_blueprints)} castBlueprints, {len(m_beats)} beats)")
    print(f"  - {p_cues} ({len(cues_events)} synchronized audio/jumpscare cues)")


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

    p_vl = sub.add_parser("validate", help="Run 18 deterministic story & spatial-blocking quality gates")
    p_vl.add_argument("story")
    p_vl.add_argument("--stage", choices=["skeleton", "beats", "full"], default="full")
    p_vl.add_argument("--strict-spatial", action="store_true", help="Require v2.0 spatial floorplan landmarks & actionBeats even on v1 JSON")

    p_ck = sub.add_parser("checkup", help="Compact pass/fail summary of all 18 gates")
    p_ck.add_argument("story")
    p_ck.add_argument("--strict-spatial", action="store_true")

    p_rn = sub.add_parser("render", help="Render Story Bible as HTML (with 2D SVG Floorplans) or Markdown")
    p_rn.add_argument("story")
    p_rn.add_argument("--html", action="store_true")
    p_rn.add_argument("--md", action="store_true")
    p_rn.add_argument("--out")

    p_ex = sub.add_parser("export-outline", help="Export OUTLINE.json compatible with horror-series-pipeline")
    p_ex.add_argument("story")
    p_ex.add_argument("--aspect", choices=["9:16", "16:9"], default="9:16")
    p_ex.add_argument("--drone-hz", type=float, default=43.65)
    p_ex.add_argument("--out")

    p_bp = sub.add_parser("export-blueprint", help="Export synchronized SCRIPT.skeleton.md, manifest.draft.json & cues.draft.json")
    p_bp.add_argument("story")
    p_bp.add_argument("--out", required=True, help="Output directory for synchronized blueprint files")
    p_bp.add_argument("--part", type=int, default=1)
    p_bp.add_argument("--project-id", default=None)
    p_bp.add_argument("--aspect", choices=["9:16", "16:9"], default="9:16")
    p_bp.add_argument("--bed-sound", default="room_tone_dark", help="Story-matched ambience bed slug")

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
    elif args.cmd == "export-blueprint":
        cmd_export_blueprint(args)


if __name__ == "__main__":
    main()
