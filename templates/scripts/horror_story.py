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
VALID_FORMATS = {"micro", "short", "series"}
FORMAT_DURATION_BOUNDS = {"micro": (45, 105), "short": (150, 360), "series": (480, 960)}
VALID_POVS = {"first_person_survivor", "third_person_close", "found_footage_tape", "oral_folklore"}
VALID_CLUE_KINDS = {"foreshadow", "physical_clue", "red_herring", "truth_piece"}
VALID_PACING_TYPES = {"setup", "slow_burn", "investigation", "false_relief", "escalation", "twist_reveal", "climax_chase", "aftermath"}
VALID_CLIFFHANGERS = {"question", "sensory_shock", "rule_broken", "betrayal", "arrival", "final_twist", "none"}
VALID_ENGINE_POSES = {
    "standIdle", "nervousIdle", "talkCalm", "talkUrgent", "reachInteract", "glassSlam",
    "sitCrossLegged", "sitChair", "sitBenchHunched", "walk", "creep", "peerForward", "recoil",
    "holdPhone", "holdLantern", "point", "lunge", "loomingStill", "peekAroundDoor",
    "turnHead", "stalkLoom", "jawUnlatch", "crawler", "doorwayPeek", "backbendCrab", "lungeCloseUp",
    "handoverProp", "fleePanic", "shrug", "startledFlinch",
}
DIALOGUE_QUOTE_RE = re.compile(r'["“”«»「」『』]')
CHAPTER_RE = re.compile(r"^\s*(?:chương|hồi|phần|tập|chapter)\s+[0-9ivxlcdm]+", re.IGNORECASE | re.MULTILINE)
EXPOSITION_TELL_RE = re.compile(
    r"(?:tôi cảm thấy vô cùng (?:sợ hãi|kinh hãi|hoảng sợ)|bầu không khí thật (?:rùng rợn|đáng sợ|ghê rợn)|như có ma quỷ|cảnh tượng thật kinh hoàng)",
    re.IGNORECASE,
)
BORING_CHRONO_HOOK_RE = re.compile(
    r"^\s*(?:vào\s+một\s+(?:đêm|buổi|ngày)|tháng\s+\d+\s+(?:mùa|năm)|đêm\s+cuối\s+(?:năm|tháng)|mùa\s+(?:đông|mưa|hè|thu)\s+năm|hôm\s+(?:đó|ấy)\s+trời|tôi\s+tên\s+là|xin\s+chào\s+mọi\s+người|câu\s+chuyện\s+(?:này\s+)?bắt\s+đầu)",
    re.IGNORECASE,
)
LITERARY_SLOP_RE = re.compile(
    r"(?:một\s+cảm\s+giác\s+lạnh\s+lẽo\s+bao\s+trùm|bất\s+giác\s+tôi\s+nhận\s+ra|không\s+gian\s+đặc\s+quánh|tựa\s+hồ\s+như|nỗi\s+sợ\s+hãi\s+vô\s+hình|trái\s+tim\s+tôi\s+như\s+ngừng\s+đập)",
    re.IGNORECASE,
)
BANNED_PLATFORM_SLURS_RE = re.compile(
    r"\b(?:địt|đụ\s+má|đéo|vãi\s+lồn|con\s+cặc|cái\s+lồn)\b",
    re.IGNORECASE,
)
VALID_MOTIF_MODES = {"steady_then_stop", "accelerate", "decelerate", "approach", "stutter_break"}
VALID_PACING_PROFILES = {"viral_short", "deep_story"}
VALID_HOOK_ARCHETYPES = {"paradox_prop", "blunt_taboo_dialogue", "flash_forward_crisis", "raw_confession"}
VALID_GRIT_LEVELS = {"platform_safe_raw", "clean_folklore"}
VALID_DIALECT_REGIONS = {"north", "central", "south"}


def resolve_vieneu_cast_voice(name: str, voice_profile: str = "", role: str = "", narrator_voice: str = "Thiện Minh") -> str:
    """Deterministic multi-speaker VieNeu-TTS voice casting from character honorifics, age, gender & dialect."""
    blob = f"{name} {voice_profile} {role}".lower()
    is_female = any(k in blob for k in ("nữ", "bà", "cô", "chị", "mẹ", "má", "dì", "thiếu nữ", "bé gái"))
    is_elder = any(k in blob for k in ("già", "lão", "lớn tuổi", "ông", "bà", "chú", "bác", "cụ", "khàn"))
    is_south = any(k in blob for k in ("miền nam", "nam bộ", "miền tây", "sài gòn", "sông hậu", "chú tư", "má"))
    is_central = any(k in blob for k in ("miền trung", "huế", "quảng", "trung bộ"))

    if is_female:
        if is_south:
            cand = "Thục Đoan" if is_elder else "Mỹ Duyên"
        elif is_central:
            cand = "Ngọc Trân"
        else:
            cand = "Ngọc Linh" if is_elder else "Trúc Ly"
    else:
        if is_south:
            cand = "Thái Sơn" if is_elder else "Đức Trí"
        elif is_central:
            cand = "Quang Sơn"
        elif is_elder:
            cand = "Thiền Tâm Đức"
        else:
            cand = "Thanh Bình" if narrator_voice == "Thiện Minh" else "Thiện Minh"
    if cand == narrator_voice:
        cand = "Thái Sơn" if narrator_voice != "Thái Sơn" else "Thiền Tâm Đức"
    return cand


def read_text_auto(path):
    with open(path, "rb") as fp:
        raw = fp.read()
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


def resolve_format(params):
    fmt = str(params.get("format") or "").strip().lower()
    if fmt in VALID_FORMATS:
        return fmt
    mode = str(params.get("mode") or "standalone").strip().lower()
    parts_n = int(params.get("parts") or 1)
    if mode in VALID_FORMATS:
        return mode
    if parts_n == 1:
        return "micro"
    if parts_n <= 5:
        return "short"
    return "series"


def default_thresholds(params, schema_version="3.0"):
    parts_n = int(params.get("parts") or 1)
    fmt = resolve_format(params)
    sec_per_part = float(params.get("secondsPerPart") or (55 if fmt == "short" else 60))
    total_sec = float(params.get("targetTotalSec") or (parts_n * sec_per_part))
    v31 = str(schema_version or "")[:3] in ("3.1", "3.2")
    if fmt == "micro":
        base = {
            "maxLeads": 5,
            "maxSupport": 10,
            "maxFunctional": 10,
            "maxProps": 8,
            "maxBeatGap": 1,
            "maxPrimaryScenes": 3,
            "minJumpscaresTotal": 1,
            "maxJumpscaresTotal": 2,
        }
    elif fmt == "short":
        base = {
            "maxLeads": 5,
            "maxSupport": 10,
            "maxFunctional": 10,
            "maxProps": 10,
            "maxBeatGap": 1,
            "maxPrimaryScenes": 5,
            "minJumpscaresTotal": max(1, parts_n),
            "maxJumpscaresTotal": max(2, parts_n * 2),
        }
    else:
        base = {
            "maxLeads": 6,
            "maxSupport": 12,
            "maxFunctional": 12,
            "maxProps": 16,
            "maxBeatGap": 2,
            "maxPrimaryScenes": max(5, min(12, 4 + math.ceil(parts_n / 3))),
            "minJumpscaresTotal": max(1, parts_n),
            "maxJumpscaresTotal": max(5, parts_n * 2),
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
    req_fmt = str(getattr(args, "format", "auto") or "auto").lower()
    req_mode = str(getattr(args, "mode", "auto") or "auto").lower()
    req_parts = getattr(args, "parts", None)
    req_total = getattr(args, "total_sec", None)

    if req_fmt != "auto":
        fmt = req_fmt
    elif req_mode in VALID_FORMATS:
        fmt = req_mode
    elif req_mode == "standalone":
        fmt = "micro" if req_parts == 1 else "short"
    elif req_parts is not None:
        fmt = "micro" if req_parts == 1 else ("short" if req_parts <= 5 else "series")
    else:
        fmt = "short"

    if fmt == "micro":
        n_parts = max(1, req_parts or 1)
        total_sec = int(req_total or 75)
        sec = max(45, min(105, int(round(total_sec / n_parts))))
        mode = "standalone"
        default_aspect = "9:16"
    elif fmt == "short":
        total_sec = int(req_total or (req_parts * 72 if req_parts else 210))
        total_sec = max(150, min(360, total_sec))
        n_parts = max(3, min(5, req_parts or max(3, min(5, round(total_sec / 55)))))
        sec = max(45, min(105, int(round(total_sec / n_parts))))
        total_sec = sec * n_parts
        mode = "short"
        default_aspect = "9:16"
    else:
        total_sec = int(req_total or (req_parts * 72 if req_parts else 600))
        total_sec = max(480, min(960, total_sec))
        n_parts = max(8, min(15, req_parts or max(8, min(15, round(total_sec / 60)))))
        sec = max(45, min(105, int(round(total_sec / n_parts))))
        total_sec = sec * n_parts
        mode = "series"
        default_aspect = "16:9"

    aspect = getattr(args, "aspect", None) or default_aspect
    pov = getattr(args, "pov", None) or "first_person_survivor"

    # Build clean multi-act skeleton covering 1..n_parts contiguously
    if n_parts == 1:
        acts_seed = [
            {"act": 1, "name": "Hồi 1: Mở màn, Leo thang & Cú lật", "partRange": [1, 1], "goal": "", "turningPoint": "", "dominantEmotion": "calm_omen -> panic -> cold_twist"}
        ]
    elif n_parts <= 5:
        mid_a = max(1, n_parts // 3)
        mid_b = max(mid_a + 1, n_parts - 1)
        acts_seed = [
            {"act": 1, "name": "Hồi 1: Đời thường, Lý do mắc kẹt & Cài luật", "partRange": [1, mid_a], "goal": "", "turningPoint": "", "dominantEmotion": "calm_omen -> curious"},
            {"act": 2, "name": "Hồi 2: Dị biến leo thang, Khoảng thở giả & Bước ngoặt", "partRange": [mid_a + 1, mid_b], "goal": "", "turningPoint": "", "dominantEmotion": "dread -> false_relief -> fear"},
            {"act": 3, "name": "Hồi 3: Phá vỡ vòng vây, Cao trào & Cú lật ám ảnh", "partRange": [mid_b + 1, n_parts], "goal": "", "turningPoint": "", "dominantEmotion": "panic -> cold_twist"},
        ]
    else:
        a1 = max(2, round(n_parts * 0.2))
        a2 = max(a1 + 2, round(n_parts * 0.45))
        a3 = max(a2 + 2, round(n_parts * 0.72))
        a4 = max(a3 + 1, n_parts - 1)
        acts_seed = [
            {"act": 1, "name": "Hồi 1: Đời thường & Cài đặt cấm kỵ", "partRange": [1, a1], "goal": "", "turningPoint": "", "dominantEmotion": "calm_omen -> eerie"},
            {"act": 2, "name": "Hồi 2: Điều tra & Dị biến cấp 1–2", "partRange": [a1 + 1, a2], "goal": "", "turningPoint": "", "dominantEmotion": "curious -> dread"},
            {"act": 3, "name": "Hồi 3: Nhịp thở giả & Bước ngoặt Giữa phim", "partRange": [a2 + 1, a3], "goal": "", "turningPoint": "", "dominantEmotion": "false_relief -> betrayal"},
            {"act": 4, "name": "Hồi 4: Mất kiểm soát & Cao trào đỉnh điểm", "partRange": [a3 + 1, a4], "goal": "", "turningPoint": "", "dominantEmotion": "fear -> panic"},
            {"act": 5, "name": "Hồi 5: Giải mã sự thật & Dư âm rợn gáy", "partRange": [a4 + 1, n_parts], "goal": "", "turningPoint": "", "dominantEmotion": "dread -> cold_twist"},
        ]

    def act_of_part(pno):
        for a in acts_seed:
            if a["partRange"][0] <= pno <= a["partRange"][1]:
                return a["act"]
        return acts_seed[-1]["act"]

    pacing_seq_short = ["setup", "investigation", "false_relief", "escalation", "twist_reveal"]
    tension_curve = (
        [(4, 9, 8)] if n_parts == 1
        else [(3, 5, 4), (4, 7, 5), (6, 9, 8)] if n_parts == 3
        else [(3, 5, 4), (4, 7, 6), (5, 4, 6), (7, 9, 8)] if n_parts == 4
        else [(3, 5, 4), (4, 7, 6), (5, 4, 6), (6, 9, 8), (8, 10, 9)]
    )

    pacing_profile = getattr(args, "pacing_profile", None) or ("viral_short" if total_sec <= 120 else "deep_story")
    dialect_region = getattr(args, "dialect", None) or "north"
    grit_level = getattr(args, "grit_level", None) or "platform_safe_raw"

    seed_params = {
        "format": fmt,
        "mode": mode,
        "pacingProfile": pacing_profile,
        "parts": n_parts,
        "secondsPerPart": sec,
        "targetTotalSec": total_sec,
        "wordsPerSecond": 2.65,
        "aspect": aspect,
        "seamlessStitch": n_parts > 1,
        "genre": args.genre,
        "adaptMode": args.adapt_mode,
    }
    seed_params["thresholds"] = default_thresholds(seed_params, schema_version="3.2")

    doc = {
        "schemaVersion": "3.2",
        "title": args.title,
        "lang": "vi",
        "params": seed_params,
        "narrativeStyle": {
            "pov": pov,
            "dialectRegion": dialect_region,
            "gritLevel": grit_level,
            "narratorVoice": "Giọng kể truyền miệng đời thật Việt Nam gọn sắc, vào thẳng biến cố ngay giây đầu, có buột miệng cảm thán đúng tâm lý (Thiện Minh)",
            "dialogueDensity": "balanced_dialogue",
            "toneKeywords": ["khẩu ngữ truyền miệng đời thật", "hook sốc 1-5s đầu", "văn hóa vùng miền", "âm thanh là nhân vật", "0 lạm dụng Jumpscare"],
            "forbiddenCliches": [
                "Mở bài dạo đầu thời tiết / ngày tháng / giới thiệu tên rườm rà ('Đêm cuối năm...', 'Tháng 10 năm...')",
                "Tỉnh dậy hóa ra chỉ là giấc mơ",
                "Văn viết sáo rỗng kiểu AI ('một cảm giác lạnh lẽo bao trùm', 'bất giác tôi nhận ra')",
                "Giải thích hộ cảm xúc ('tôi vô cùng kinh hãi', 'không khí thật rùng rợn')",
                "Lạm dụng Jumpscare hoặc tiếng reverse_suck báo trước",
            ],
        },
        "soundscapeDesign": {
            "nearBed": {
                "sound": "room_tone_dark",
                "label": "Lớp không gian gần trong phòng (gỗ ẩm, tim đèn dầu, không khí tĩnh)",
            },
            "farBed": {
                "sound": "night_rain_indoor",
                "label": "Lớp không gian xa ngoài trời (mưa/gió/sông tự đục đi khi đóng cửa)",
                "occlusionTrigger": {"atWord": "chốt", "lpHz": 580, "gainDeltaDb": -6.5},
            },
            "motifs": [
                {
                    "id": "m_primary_motif",
                    "sound": "water_drip_echo",
                    "intervalSec": 2.5,
                    "mode": "steady_then_stop",
                    "meaning": "Âm thanh lặp đời thường đếm nhịp căng thẳng rồi đột ngột tắt hẳn trước biến cố",
                    "breakBeatId": "P1_AB2",
                }
            ],
        },
        "premise": {
            "core": "",
            "entityRule": "",
            "twistCore": "",
            "keep": [{"what": "", "why": "", "evidence": ""}],
            "cut": [],
            "risks": [],
        },
        "worldLore": {
            "era": "",
            "settingDetail": "",
            "weatherProgression": ["Mưa rả rích đầu đêm", "Gió giật mạnh & mất điện"],
            "backstory": "",
            "tabooLore": "",
        },
        "entityProfile": {
            "name": "",
            "origin": "",
            "rules": [
                {"rule": "", "trigger": "", "consequence": "", "loophole": ""},
                {"rule": "", "trigger": "", "consequence": "", "loophole": ""},
            ],
            "sensoryTells": ["Âm thanh đặc trưng", "Mùi/nhiệt độ lạ", "Biến dạng ánh sáng / nhiễu VHS"],
            "escalationStages": [
                "Cấp 1: Dấu hiệu ngoại vi & vật thể sai lệch vị trí",
                "Cấp 2: Bóng rình góc khuất & tiếng giả giọng",
                "Cấp 3: Xâm nhập vùng an toàn & phá vỡ quy tắc bảo vệ",
                "Cấp 4: Hiện nguyên hình toàn thân & đối đầu trực diện",
            ],
        },
        "characters": [
            {
                "id": "C01",
                "name": "",
                "age": 24,
                "tier": "lead",
                "roleType": "human",
                "role": "Nhân vật chính (POV)",
                "heightMeters": 1.72,
                "trait": "",
                "goal": "",
                "trappedReason": "",
                "flaw": "",
                "secret": "",
                "voiceProfile": "Trầm ổn, dè dặt, giọng Việt tự nhiên; khi hoảng thở gấp, câu ngắn ngắt nhịp",
                "wardrobe": "",
                "carriedItems": ["Điện thoại pin yếu", "Đèn pin cầm tay"],
                "appearanceBrief": "",
                "movementRules": "Di chuyển có lộ trình vật lý qua đúng cửa nối giữa các phòng",
                "arc": "",
                "relationships": [{"targetId": "C02", "relation": "Mục tiêu bị săn đuổi", "tension": ""}],
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
                "goal": "",
                "flaw": "",
                "voiceProfile": "Thì thầm méo tiếng / giả giọng người thân (fx=ghost)",
                "appearanceBrief": "",
                "movementRules": "Tuân thủ 4 cấp lộ diện, chỉ hiện thân đầy đủ ở cao trào",
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
        "acts": acts_seed,
        "clues": [
            {
                "id": "CL01",
                "kind": "physical_clue",
                "plantedInPart": 1,
                "plantedDetail": "",
                "payoffInPart": n_parts,
                "recontextualization": "",
            },
            {
                "id": "CL02",
                "kind": "red_herring",
                "plantedInPart": 1 if n_parts == 1 else 2,
                "plantedDetail": "",
                "payoffInPart": n_parts,
                "recontextualization": "",
            },
        ],
        "beats": [
            {"id": "B01", "part": 1, "type": "hook", "weight": "minor", "setup": "", "payoff": ""},
            {"id": "B02", "part": max(1, n_parts // 2), "type": "dread", "weight": "major", "setup": "", "payoff": ""},
            {"id": "B03", "part": n_parts, "type": "twist", "weight": "major", "setup": "", "payoff": ""},
        ],
        "props": [],
        "parts": [
            {
                "part": i,
                "act": act_of_part(i),
                "title": f"Chương {i}",
                "target_sec": sec,
                "light": "warmLamp" if i == 1 else "coldMoon",
                "pacingType": pacing_seq_short[min(i - 1, len(pacing_seq_short) - 1)] if n_parts <= 5 else ("setup" if i <= 2 else ("false_relief" if i == max(3, n_parts // 2) else ("climax_chase" if i == n_parts - 1 else ("aftermath" if i == n_parts else "escalation")))),
                "tensionStart": tension_curve[min(i - 1, len(tension_curve) - 1)][0],
                "tensionPeak": tension_curve[min(i - 1, len(tension_curve) - 1)][1],
                "tensionEnd": tension_curve[min(i - 1, len(tension_curve) - 1)][2],
                "newInfoRevealed": "",
                "cliffhangerType": "final_twist" if i == n_parts else "sensory_shock",
                "transitionOut": "fade:0.5" if i == n_parts else "cut",
                "synopsis": "",
                "hook": "",
                **({"coldHook": {"hookArchetype": "paradox_prop", "openingLine": "", "openingSoundCue": ""}} if i == 1 else {}),
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
        print(f"Seeded story.json ({fmt}, {n_parts} parts, {total_sec}s, {aspect}) -> {args.out}")
    else:
        print(out_txt, end="")


def evaluate_gates(doc, stage="full", strict_spatial=False, strict_story=False):
    sv = str(doc.get("schemaVersion", "")).strip()
    params = doc.get("params") or {}
    th = default_thresholds(params, schema_version=sv or "3.0")
    fmt = resolve_format(params)
    n_parts = int(params.get("parts") or 1)
    adapt_mode = str(params.get("adaptMode") or "original")

    premise = doc.get("premise") or {}
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    beats = doc.get("beats") or []
    props = doc.get("props") or []
    parts = doc.get("parts") or []
    acts = doc.get("acts") or []
    clues = doc.get("clues") or []
    world_lore = doc.get("worldLore") or {}
    entity_prof = doc.get("entityProfile") or {}

    sv = str(doc.get("schemaVersion", "")).strip()
    narrative_mode = (
        bool(strict_story)
        or sv.startswith("3")
        or bool(world_lore)
        or bool(entity_prof)
        or bool(clues)
        or bool(acts)
    )
    spatial_mode = (
        bool(strict_spatial)
        or narrative_mode
        or sv.startswith("2")
        or any(bool(s.get("landmarks")) for s in scenes)
        or any(bool(p.get("actionBeats")) for p in parts)
    )
    # Normalize 3-round stages: lore -> beats+lore, structure -> full minus actionBeats
    eff_stage = "beats" if stage == "lore" else ("full" if stage == "structure" else stage)
    require_action_beats = stage == "full"

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
    if eff_stage == "full" and n_parts >= 2:
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
    if eff_stage in ("beats", "full") and props:
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
    if eff_stage in ("beats", "full"):
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
    if eff_stage == "full":
        # 10. part-duration
        p_errs = []
        if len(parts) != n_parts:
            p_errs.append(f"Số phần là {len(parts)}, expected {n_parts}")
        for idx, p in enumerate(parts, 1):
            if p.get("part") != idx:
                p_errs.append(f"Phần thứ {idx} có số part={p.get('part')!r}")
            dur = p.get("target_sec")
            if not isinstance(dur, (int, float)) or not (45 <= dur <= 90):
                p_errs.append(f"P{idx} target_sec={dur} ngoài [45,90]")
            if p.get("light") not in VALID_LIGHTS:
                p_errs.append(f"P{idx} light={p.get('light')!r} không hợp lệ")
        add_gate(
            "part-duration",
            "10. Cấu trúc phần & Thời lượng chương (45–90s)",
            not p_errs,
            f"Đủ {n_parts} chương đúng thời lượng & ánh sáng hợp lệ" if not p_errs else "; ".join(p_errs[:4]),
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
        if require_action_beats:
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
                            and cut_type not in ("blackout", "timeSkip", "flashCut", "locationJump")
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
                        # Only check local-part drift here for v2; v3 Gate 24 verifies cross-part continuous prop state!
                        if not narrative_mode and cur_st and st_from and st_from != cur_st:
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
                "18. Giới hạn Jumpscare & Đồng bộ Audio (`<=2`/chương)",
                not js_errs,
                "Phân bổ Jumpscare hợp lý, đúng 4 phong cách v7.1" if not js_errs else "; ".join(js_errs[:4]),
            )
        else:
            add_gate("action-blocking-continuity", "17. Liên tục hành động (`actionBeats`)", True, "Kiểm ở stage full", applies=False)
            add_gate("horror-pacing-jumpscare-cap", "18. Giới hạn Jumpscare (`<=2`/chương)", True, "Kiểm ở stage full", applies=False)
    else:
        for gid, gtitle in [
            ("char-appearance-brief", "15. Khóa ngoại hình nhân vật"),
            ("scene-spatial-floorplan", "16. Mặt bằng 2D & Điểm neo"),
            ("action-blocking-continuity", "17. Liên tục hành động (`actionBeats`)"),
            ("horror-pacing-jumpscare-cap", "18. Giới hạn Jumpscare (`<=2`/chương)"),
        ]:
            add_gate(gid, gtitle, True, "Bỏ qua (schema v1 cũ — nâng cấp schemaVersion:'2.0'/'3.0' hoặc dùng --strict-spatial để bật)", applies=False)

    # Narrative Studio v3.0 Deep Storytelling & Long-Form Gates (19..24 — active for schemaVersion 3.0+ / --strict-story)
    if narrative_mode:
        # 19. format-duration-budget
        dur_errs = []
        lo_d, hi_d = FORMAT_DURATION_BOUNDS.get(fmt, (150, 300))
        if eff_stage == "full":
            tot_sec = sum(float(p.get("target_sec") or 0) for p in parts)
            if not (lo_d <= tot_sec <= hi_d):
                dur_errs.append(f"Tổng thời lượng {tot_sec:.0f}s ngoài khung '{fmt}' [{lo_d}s..{hi_d}s]")
            if require_action_beats:
                for p in parts:
                    pid = p.get("part")
                    tsec = float(p.get("target_sec") or 0)
                    ab_sum = sum(float(ab.get("durationSec") or 0) for ab in (p.get("actionBeats") or []))
                    if tsec > 0 and ab_sum > 0 and not (tsec * 0.80 <= ab_sum <= tsec * 1.20):
                        dur_errs.append(f"P{pid} tổng actionBeats={ab_sum:.1f}s lệch >20% so với target_sec={tsec:.0f}s")
            add_gate(
                "format-duration-budget",
                f"19. Ngân sách Thời lượng chuẩn `{fmt}` ({lo_d}–{hi_d}s)",
                not dur_errs,
                f"Tổng {tot_sec:.0f}s ({len(parts)} chương) khớp chuẩn '{fmt}' và khớp từng actionBeat (±20%)"
                if not dur_errs
                else "; ".join(dur_errs[:4]),
            )
        else:
            t_target = float(params.get("targetTotalSec") or (n_parts * float(params.get("secondsPerPart") or 60)))
            if not (lo_d <= t_target <= hi_d):
                dur_errs.append(f"targetTotalSec={t_target:.0f}s ngoài khung '{fmt}' [{lo_d}s..{hi_d}s]")
            add_gate(
                "format-duration-budget",
                f"19. Ngân sách Thời lượng chuẩn `{fmt}` ({lo_d}–{hi_d}s)",
                not dur_errs,
                f"Dự kiến {t_target:.0f}s ({n_parts} chương) đạt chuẩn '{fmt}'" if not dur_errs else "; ".join(dur_errs[:4]),
            )

        # 20. world-lore-and-entity-rules
        wl_errs = []
        if not str(world_lore.get("era", "")).strip():
            wl_errs.append("worldLore thiếu era (thời đại/năm)")
        if not str(world_lore.get("settingDetail", "")).strip():
            wl_errs.append("worldLore thiếu settingDetail (địa lý/không gian sống)")
        if not str(world_lore.get("backstory", "")).strip():
            wl_errs.append("worldLore thiếu backstory (bi kịch gốc)")
        wp = world_lore.get("weatherProgression") or []
        if not isinstance(wp, list) or len([x for x in wp if str(x).strip()]) < 2:
            wl_errs.append("worldLore.weatherProgression cần >= 2 mốc diễn biến thời tiết")
        if not str(entity_prof.get("origin", "")).strip():
            wl_errs.append("entityProfile thiếu origin (nguồn gốc thực thể)")
        ep_rules = entity_prof.get("rules") or []
        valid_rules = [
            r for r in ep_rules
            if isinstance(r, dict) and str(r.get("rule", "")).strip() and str(r.get("trigger", "")).strip() and str(r.get("consequence", "")).strip()
        ]
        if len(valid_rules) < 2:
            wl_errs.append("entityProfile.rules cần >= 2 quy tắc đầy đủ (rule, trigger, consequence)")
        tells = [x for x in (entity_prof.get("sensoryTells") or []) if str(x).strip()]
        if len(tells) < 3:
            wl_errs.append(f"entityProfile.sensoryTells cần >= 3 dấu hiệu giác quan (hiện {len(tells)})")
        stages_e = [x for x in (entity_prof.get("escalationStages") or []) if str(x).strip()]
        if len(stages_e) < 3:
            wl_errs.append(f"entityProfile.escalationStages cần >= 3 cấp độ lộ diện leo thang (hiện {len(stages_e)})")
        add_gate(
            "world-lore-and-entity-rules",
            "20. Thế giới quan (`worldLore`) & Hệ quy tắc Thực thể 4 cấp",
            not wl_errs,
            f"Đủ bối cảnh/bi kịch gốc, {len(valid_rules)} quy tắc có kẽ hở, {len(tells)} dấu hiệu giác quan & {len(stages_e)} cấp lộ diện"
            if not wl_errs
            else "; ".join(wl_errs[:4]),
        )

        # 21. character-depth-and-stakes
        cd_errs = []
        all_cids = {c.get("id") for c in chars if c.get("id")}
        rel_count = 0
        for c in chars:
            cid = c.get("id") or "?"
            rt = str(c.get("roleType") or "human").lower()
            if c.get("tier") == "lead" and rt == "human":
                if not str(c.get("goal", "")).strip():
                    cd_errs.append(f"{cid} thiếu goal (mục tiêu trước biến cố)")
                if len(str(c.get("trappedReason", "")).strip()) < 10:
                    cd_errs.append(f"{cid} thiếu trappedReason (>=10 ký tự — lý do không thể bỏ chạy ngay!)")
                if not str(c.get("flaw", "")).strip():
                    cd_errs.append(f"{cid} thiếu flaw (điểm yếu tâm lý/lỗi lầm)")
                if not str(c.get("voiceProfile", "")).strip():
                    cd_errs.append(f"{cid} thiếu voiceProfile (tông giọng/khẩu ngữ)")
            for rel in c.get("relationships") or []:
                if isinstance(rel, dict) and rel.get("targetId") in all_cids and str(rel.get("relation", "")).strip():
                    rel_count += 1
                elif isinstance(rel, dict) and rel.get("targetId") and rel.get("targetId") not in all_cids:
                    cd_errs.append(f"{cid} relationship trỏ tới targetId lạ '{rel.get('targetId')}'")
        if len(chars) >= 2 and rel_count < 1:
            cd_errs.append("Truyện có >= 2 nhân vật cần khai báo relationships[] giữa các nhân vật")
        add_gate(
            "character-depth-and-stakes",
            "21. Tâm lý Nhân vật, Lý do mắc kẹt & Mạng quan hệ",
            not cd_errs,
            f"Đủ goal, trappedReason, flaw, voiceProfile & {rel_count} tuyến quan hệ"
            if not cd_errs
            else "; ".join(cd_errs[:4]),
        )

        # 22. clue-twist-economy
        cl_errs = []
        min_clues = 4 if fmt == "series" else (2 if fmt == "short" else 1)
        if len(clues) < min_clues:
            cl_errs.append(f"Định dạng '{fmt}' cần >= {min_clues} manh mối trong clues[] (hiện có {len(clues)})")
        red_herrings = 0
        early_planted = 0
        for cl in clues:
            clid = cl.get("id") or "?"
            kind = str(cl.get("kind", "")).strip()
            if kind not in VALID_CLUE_KINDS:
                cl_errs.append(f"{clid} kind={kind!r} không hợp lệ")
            if kind == "red_herring":
                red_herrings += 1
            p_in = int(cl.get("plantedInPart") or 0)
            p_out = int(cl.get("payoffInPart") or 0)
            if not (1 <= p_in <= n_parts) or not (1 <= p_out <= n_parts):
                cl_errs.append(f"{clid} plantedInPart={p_in}/payoffInPart={p_out} ngoài [1..{n_parts}]")
            elif p_in > p_out:
                cl_errs.append(f"PLOT_HOLE ở {clid}: gieo ở P{p_in} sau khi lật kèo ở P{p_out}!")
            if p_in < n_parts:
                early_planted += 1
            if not str(cl.get("plantedDetail", "")).strip() or not str(cl.get("recontextualization", "")).strip():
                cl_errs.append(f"{clid} thiếu plantedDetail hoặc recontextualization")
        if n_parts >= 2 and clues and early_planted < 1:
            cl_errs.append("Phải có >= 1 manh mối gieo sớm trước chương kết để cú twist không bị gượng ép")
        if fmt == "series" and red_herrings < 1:
            cl_errs.append("Series 8–15 phút cần >= 1 red_herring (đánh lạc hướng) để giữ hồi hộp")
        add_gate(
            "clue-twist-economy",
            "22. Kinh tế Manh mối, Đánh lạc hướng & Lật kèo (`clues`)",
            not cl_errs,
            f"{len(clues)} manh mối (gồm {red_herrings} red herring) gieo sớm & khép kín logic 100%"
            if not cl_errs
            else "; ".join(cl_errs[:4]),
        )

        # 23. multi-act-tension-curve
        if eff_stage == "full" and n_parts >= 2:
            tc_errs = []
            covered = set()
            for a in acts:
                pr = a.get("partRange")
                if not (isinstance(pr, list) and len(pr) == 2 and all(isinstance(x, int) for x in pr) and 1 <= pr[0] <= pr[1] <= n_parts):
                    tc_errs.append(f"Act {a.get('act')} partRange={pr!r} không hợp lệ")
                else:
                    for x in range(pr[0], pr[1] + 1):
                        if x in covered:
                            tc_errs.append(f"Chương P{x} bị chồng chéo giữa 2 Hồi")
                        covered.add(x)
                if not str(a.get("turningPoint", "")).strip():
                    tc_errs.append(f"Act {a.get('act')} thiếu turningPoint (bước ngoặt đổi chiều)")
            expected_set = set(range(1, n_parts + 1))
            if covered != expected_set:
                tc_errs.append(f"acts[] chưa phủ đủ các chương {sorted(expected_set - covered)}")
            t_vals = []
            for p in parts:
                pid = p.get("part")
                pt = str(p.get("pacingType", "")).strip()
                if pt not in VALID_PACING_TYPES:
                    tc_errs.append(f"P{pid} pacingType={pt!r} không hợp lệ")
                if not str(p.get("newInfoRevealed", "")).strip():
                    tc_errs.append(f"P{pid} thiếu newInfoRevealed (cấm chương câu giờ rỗng ruột)")
                for tk in ("tensionStart", "tensionPeak", "tensionEnd"):
                    tv = p.get(tk)
                    if not isinstance(tv, (int, float)) or not (1 <= tv <= 10):
                        tc_errs.append(f"P{pid}.{tk}={tv!r} ngoài [1..10]")
                    else:
                        t_vals.append(float(tv))
            if t_vals:
                if min(t_vals) > 5:
                    tc_errs.append(f"Đường căng thẳng quá phẳng/ngợp (min={min(t_vals):.0f} > 5 — cần nhịp lắng/thở giả an toàn <=5!)")
                if max(t_vals) < 8:
                    tc_errs.append(f"Thiếu đỉnh cao trào (max={max(t_vals):.0f} < 8)")
            add_gate(
                "multi-act-tension-curve",
                "23. Cấu trúc Đa Hồi & Đường cong Căng thẳng (Có nhịp thở)",
                not tc_errs,
                f"{len(acts)} Hồi phủ kín {n_parts} chương, biên độ căng thẳng {int(min(t_vals)) if t_vals else 0}→{int(max(t_vals)) if t_vals else 0}/10"
                if not tc_errs
                else "; ".join(tc_errs[:4]),
            )
        else:
            add_gate("multi-act-tension-curve", "23. Cấu trúc Đa Hồi & Đường cong Căng thẳng", True, "Kiểm ở stage structure/full (>=2 chương)", applies=False)

        # 24. cross-part-continuity-and-dialogue-briefs
        if require_action_beats:
            x_errs = []
            prop_map_x = {pr.get("id"): pr for pr in props if pr.get("id")}
            global_prop_state = {
                pr_id: (pr.get("initialState") or ((pr.get("states") or [None])[0]))
                for pr_id, pr in prop_map_x.items()
            }
            global_actor_last = {}
            total_js = 0
            zero_js_parts = 0
            wps_cfg = float(params.get("wordsPerSecond") or 2.35)
            for p in parts:
                pid = p.get("part")
                abeats = p.get("actionBeats") or []
                part_js = 0
                part_wb = 0
                for idx_ab, ab in enumerate(abeats):
                    ab_id = ab.get("beatId") or f"P{pid}_AB{idx_ab+1}"
                    ab_sid = ab.get("sceneId")
                    cut_type = str(ab.get("cutType", "")).strip()
                    # Cross-part actor continuity
                    for act in ab.get("actors") or []:
                        aid = act.get("id")
                        vis = bool(act.get("visible", True))
                        frm = act.get("fromLandmark") or act.get("landmark")
                        to = act.get("toLandmark") or frm
                        prev = global_actor_last.get(aid)
                        if (
                            vis and prev is not None and prev[2] and prev[0] == ab_sid
                            and frm and prev[1] and frm != prev[1]
                            and not act.get("allowTeleport")
                            and cut_type not in ("blackout", "timeSkip", "flashCut", "locationJump")
                        ):
                            x_errs.append(f"CROSS_PART_TELEPORT ở {ab_id}: {aid} đang ở '{prev[1]}' (từ nhịp trước) nhảy sang '{frm}'!")
                        global_actor_last[aid] = (ab_sid, to or frm, vis)
                    # Cross-part prop state continuity
                    for pc in ab.get("propChanges") or []:
                        pr_id = pc.get("id")
                        st_from = pc.get("fromState")
                        st_to = pc.get("toState")
                        cur_st = global_prop_state.get(pr_id)
                        if cur_st and st_from and st_from != cur_st and cut_type not in ("timeSkip", "flashCut"):
                            x_errs.append(f"CROSS_PART_PROP_DRIFT ở {ab_id}: {pr_id} đang ở '{cur_st}' nhưng khai báo fromState='{st_from}'!")
                        if st_to:
                            global_prop_state[pr_id] = st_to
                    # Narrative craft on each actionBeat: subtext + sensoryDetails + spokenBeat
                    if not str(ab.get("subtext", "")).strip():
                        x_errs.append(f"{ab_id} thiếu subtext (nội tâm/cảm xúc ngầm)")
                    sens = ab.get("sensoryDetails")
                    if not (isinstance(sens, dict) and (str(sens.get("sight", "")).strip() or str(sens.get("sound", "")).strip())):
                        x_errs.append(f"{ab_id} thiếu sensoryDetails (sight/sound)")
                    sb = ab.get("spokenBeat")
                    if isinstance(sb, dict):
                        wb = int(sb.get("wordBudget") or 0)
                        part_wb += wb
                        if wb > 0 and not str(sb.get("intent", "")).strip():
                            x_errs.append(f"{ab_id} spokenBeat có lời nhưng thiếu intent")
                    elif not ab.get("deadSilenceBeforeSec"):
                        x_errs.append(f"{ab_id} thiếu spokenBeat (định hướng thoại & wordBudget)")
                    if ab.get("jumpscareStyle"):
                        part_js += 1
                        total_js += 1
                if part_js == 0:
                    zero_js_parts += 1
                exp_words = float(p.get("target_sec") or 60) * wps_cfg
                if part_wb > 0 and not (exp_words * 0.55 <= part_wb <= exp_words * 1.45):
                    x_errs.append(f"P{pid} tổng wordBudget={part_wb} lệch nhiều so với chuẩn ~{int(exp_words)} từ")
            min_js_total = int(th.get("minJumpscaresTotal", 1 if sv[:3] >= "3.2" else 0))
            if sv[:3] >= "3.2" and total_js < min_js_total:
                x_errs.append(f"Tổng toàn phim mới có {total_js} Jumpscare < tối thiểu {min_js_total} cho '{fmt}' (v15.0 bắt buộc >= 1 cú cao trào!)")
            if total_js > th["maxJumpscaresTotal"]:
                x_errs.append(f"Tổng toàn phim có {total_js} Jumpscare > trần {th['maxJumpscaresTotal']} cho '{fmt}' (gây nhờn!)")
            add_gate(
                "cross-part-continuity-and-dialogue-briefs",
                "24. Liên tục Xuyên Chương, Subtext/Cảm giác & Nhịp Jumpscare Toàn Phim",
                not x_errs,
                f"0 lỗi xuyên chương, đủ subtext/sensory/spokenBeat, tổng {total_js}/{th['maxJumpscaresTotal']} Jumpscare"
                if not x_errs
                else "; ".join(x_errs[:4]),
            )
        else:
            add_gate("cross-part-continuity-and-dialogue-briefs", "24. Liên tục Xuyên Chương & Định hướng Thoại", True, "Kiểm ở stage full", applies=False)

        # 25. psychological-soundscape-and-subtext (active on schemaVersion 3.1+ or when soundscapeDesign is present)
        sc_design = doc.get("soundscapeDesign")
        v31_mode = sv[:3] in ("3.1", "3.2") or isinstance(sc_design, dict)
        if v31_mode and eff_stage == "full":
            p25_errs = []
            # 1) Anti-Exposition / Anti-Tell prose & spokenBeat check
            for p in parts:
                pid = p.get("part")
                for fld in ("synopsis", "hook", "suspense"):
                    val = str(p.get(fld, ""))
                    if EXPOSITION_TELL_RE.search(val):
                        p25_errs.append(f"P{pid}.{fld} vi phạm Anti-Exposition (giải thích hộ nỗi sợ thay vì gợi chi tiết giác quan)")
                for idx_ab, ab in enumerate(p.get("actionBeats") or [], 1):
                    ab_id = ab.get("beatId") or f"P{pid}_AB{idx_ab}"
                    sb = ab.get("spokenBeat") or {}
                    for s_fld in ("intent", "keyPhrase"):
                        if EXPOSITION_TELL_RE.search(str(sb.get(s_fld, ""))):
                            p25_errs.append(f"{ab_id}.spokenBeat.{s_fld} vi phạm Anti-Exposition (kể hộ nỗi sợ)")
                    if ab.get("jumpscareStyle"):
                        reason = str(ab.get("jumpscareReason") or "").strip()
                        if len(reason) < 12:
                            p25_errs.append(f"{ab_id} dùng jumpscareStyle nhưng thiếu jumpscareReason (>=12 ký tự chứng minh thực sự bắt buộc)")

            # 2) Narrative Soundscape & Motif check
            if not isinstance(sc_design, dict):
                p25_errs.append("Thiếu khối soundscapeDesign (nearBed, farBed, motifs)")
            else:
                motifs = sc_design.get("motifs") or []
                if not isinstance(motifs, list) or len(motifs) < 1:
                    p25_errs.append("soundscapeDesign.motifs cần >= 1 âm thanh lặp chủ đạo (motif) đóng vai trò dẫn truyện")
                else:
                    all_ab_ids = {
                        str(ab.get("beatId"))
                        for p in parts
                        for ab in (p.get("actionBeats") or [])
                        if ab.get("beatId")
                    }
                    for mf in motifs:
                        mid = mf.get("id") or "motif"
                        if not str(mf.get("sound", "")).strip():
                            p25_errs.append(f"Motif '{mid}' thiếu trường sound")
                        mmode = str(mf.get("mode") or "steady_then_stop").strip()
                        if mmode not in VALID_MOTIF_MODES:
                            p25_errs.append(f"Motif '{mid}' mode={mmode!r} không hợp lệ ({sorted(VALID_MOTIF_MODES)})")
                        brk = str(mf.get("breakBeatId") or "").strip()
                        if not brk:
                            p25_errs.append(f"Motif '{mid}' thiếu breakBeatId (điểm âm lặp thay đổi quy luật / tắt bặt)")
                        elif all_ab_ids and brk not in all_ab_ids:
                            p25_errs.append(f"Motif '{mid}' breakBeatId='{brk}' không khớp actionBeat nào")

            add_gate(
                "psychological-soundscape-and-subtext",
                "25. Thoại Gợi Mở (Anti-Exposition), Âm Lặp (`motifs`) & Kỷ Luật Jumpscare Có Mục Đích",
                not p25_errs,
                "Thoại giàu ẩn ý không kể hộ cảm xúc, có Motif âm thanh biến đổi quy luật & Jumpscare có lý do rõ ràng"
                if not p25_errs
                else "; ".join(p25_errs[:4]),
            )
        elif v31_mode:
            add_gate(
                "psychological-soundscape-and-subtext",
                "25. Thoại Gợi Mở (Anti-Exposition), Âm Lặp (`motifs`) & Kỷ Luật Jumpscare Có Mục Đích",
                True,
                "Kiểm ở stage full",
                applies=False,
            )

        # 26. viral-hook-and-oral-authenticity (v14.0: 1-5s Cold Hook, Zero Boring Weather Opener, Oral Colloquial & Platform-Safe Grit)
        nar_st = doc.get("narrativeStyle") or {}
        pacing_prof = str(params.get("pacingProfile") or "").strip()
        v32_mode = sv.startswith("3.2") or bool(pacing_prof) or any(isinstance(p.get("coldHook"), dict) for p in parts)
        if v32_mode and eff_stage == "full":
            p26_errs = []
            if pacing_prof and pacing_prof not in VALID_PACING_PROFILES:
                p26_errs.append(f"params.pacingProfile={pacing_prof!r} không hợp lệ ({sorted(VALID_PACING_PROFILES)})")
            grit_lv = str(nar_st.get("gritLevel") or "platform_safe_raw").strip()
            if grit_lv not in VALID_GRIT_LEVELS:
                p26_errs.append(f"narrativeStyle.gritLevel={grit_lv!r} không hợp lệ ({sorted(VALID_GRIT_LEVELS)})")
            dial_reg = str(nar_st.get("dialectRegion") or "north").strip()
            if dial_reg not in VALID_DIALECT_REGIONS:
                p26_errs.append(f"narrativeStyle.dialectRegion={dial_reg!r} không hợp lệ ({sorted(VALID_DIALECT_REGIONS)})")

            if parts:
                p1 = parts[0]
                p1_hook = str(p1.get("hook") or "").strip()
                if BORING_CHRONO_HOOK_RE.search(p1_hook):
                    p26_errs.append("P1.hook mở bài tả thời tiết/ngày tháng/giới thiệu tên rườm rà — phải đập thẳng biến cố/nghịch lý/cấm kỵ ngay 1–5s đầu!")
                ch_obj = p1.get("coldHook")
                p1_abs = p1.get("actionBeats") or []
                ab1 = p1_abs[0] if p1_abs else {}
                ab1_sb = (ab1.get("spokenBeat") or {}) if isinstance(ab1, dict) else {}
                ab1_phrase = str(ab1_sb.get("keyPhrase") or "").strip()
                if BORING_CHRONO_HOOK_RE.search(ab1_phrase):
                    p26_errs.append("P1_AB1.spokenBeat.keyPhrase mở bài kiểu nhật ký thời tiết/năm tháng — làm rớt người xem ở 3 giây đầu!")
                if float(ab1.get("visualBeforeSec") or 0.0) >= 0.45:
                    p26_errs.append(f"P1_AB1 đặt visualBeforeSec={ab1.get('visualBeforeSec')}s >= 0.45s gây chết lặng đầu video — phải vào thoại ngay 0.05-0.25s!")

                if isinstance(ch_obj, dict):
                    h_arch = str(ch_obj.get("hookArchetype") or "paradox_prop").strip()
                    if h_arch not in VALID_HOOK_ARCHETYPES:
                        p26_errs.append(f"P1.coldHook.hookArchetype={h_arch!r} không hợp lệ ({sorted(VALID_HOOK_ARCHETYPES)})")
                    op_line = str(ch_obj.get("openingLine") or ab1_phrase).strip()
                    op_words = len(op_line.split())
                    if op_words == 0:
                        p26_errs.append("P1.coldHook.openingLine đang để trống — bắt buộc chốt câu mở màn 1–5s đầu!")
                    elif op_words > 26:
                        p26_errs.append(f"P1.coldHook.openingLine dài {op_words} từ (>26 từ) — vượt quá khung 1–5s giữ chân đầu video!")
                    if BORING_CHRONO_HOOK_RE.search(op_line):
                        p26_errs.append("P1.coldHook.openingLine vi phạm mẫu mở bài thời tiết/ngày tháng nhàm chán!")
                    op_sfx = str(ch_obj.get("openingSoundCue") or ab1.get("audioCue") or "").strip()
                    if not op_sfx:
                        p26_errs.append("P1.coldHook thiếu openingSoundCue (hoặc P1_AB1.audioCue) để đánh thức thính giác ngay 0.1–0.4s đầu!")

            for p in parts:
                pid = p.get("part")
                for fld in ("synopsis", "hook", "suspense"):
                    val = str(p.get(fld) or "")
                    if LITERARY_SLOP_RE.search(val):
                        p26_errs.append(f"P{pid}.{fld} dùng văn viết sáo rỗng kiểu AI — hãy chuyển sang khẩu ngữ truyền miệng gọn sắc!")
                    if grit_lv == "platform_safe_raw" and BANNED_PLATFORM_SLURS_RE.search(val):
                        p26_errs.append(f"P{pid}.{fld} chứa từ tục vượt ngưỡng an toàn nền tảng (dùng 'mẹ kiếp', 'chết tiệt', 'chó chết', 'bỏ mẹ rồi' thay vì văng tục nhạy cảm)")
                for idx_ab, ab in enumerate(p.get("actionBeats") or [], 1):
                    ab_id = ab.get("beatId") or f"P{pid}_AB{idx_ab}"
                    if pacing_prof == "viral_short" and float(ab.get("durationSec") or 0.0) > 15.5:
                        p26_errs.append(f"{ab_id} kéo dài {ab.get('durationSec')}s (>15.5s trong chế độ viral_short) — phải mở tình tiết/thoại mới mỗi 8–14s!")
                    sb = ab.get("spokenBeat") or {}
                    for s_fld in ("intent", "keyPhrase"):
                        s_val = str(sb.get(s_fld) or "")
                        if LITERARY_SLOP_RE.search(s_val):
                            p26_errs.append(f"{ab_id}.spokenBeat.{s_fld} chứa văn mẫu sáo rỗng kiểu AI")
                        if grit_lv == "platform_safe_raw" and BANNED_PLATFORM_SLURS_RE.search(s_val):
                            p26_errs.append(f"{ab_id}.spokenBeat.{s_fld} chứa từ tục vượt ngưỡng an toàn nền tảng")

            add_gate(
                "viral-hook-and-oral-authenticity",
                "26. Đòn Mở Màn 1–5s (`coldHook`), Khẩu Ngữ Truyền Miệng & Nhịp Giữ Chân (`viral_short`)",
                not p26_errs,
                "Hook 1–5s đánh thẳng biến cố không dạo đầu thời tiết, khẩu ngữ đời thật gọn sắc, an toàn nền tảng"
                if not p26_errs
                else "; ".join(p26_errs[:4]),
            )
        elif v32_mode:
            add_gate(
                "viral-hook-and-oral-authenticity",
                "26. Đòn Mở Màn 1–5s (`coldHook`), Khẩu Ngữ Truyền Miệng & Nhịp Giữ Chân (`viral_short`)",
                True,
                "Kiểm ở stage full",
                applies=False,
            )

    failed = [g for g in gates if g["applies"] and not g["ok"]]
    return gates, failed


def cmd_validate(args):
    doc = read_json(args.story)
    gates, failed = evaluate_gates(
        doc,
        stage=args.stage,
        strict_spatial=getattr(args, "strict_spatial", False),
        strict_story=getattr(args, "strict_story", False),
    )
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
    gates, failed = evaluate_gates(
        doc,
        stage="full",
        strict_spatial=getattr(args, "strict_spatial", False),
        strict_story=getattr(args, "strict_story", False),
    )
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


def _render_tension_curve_svg(doc):
    """Render a wide SVG Tension & Pacing Curve (1..10) across all Acts/Parts with Clue, Jumpscare & Twist markers."""
    parts = doc.get("parts") or []
    acts = doc.get("acts") or []
    clues = doc.get("clues") or []
    beats = doc.get("beats") or []
    if len(parts) < 2 or not any(p.get("tensionPeak") is not None for p in parts):
        return ""
    W, H = 760.0, 235.0
    pad_l, pad_r, pad_t, pad_b = 44.0, 24.0, 28.0, 42.0
    n = len(parts)
    plot_w = W - pad_l - pad_r
    plot_h = H - pad_t - pad_b
    col_w = plot_w / max(1, n)

    def py(val):
        v = max(1.0, min(10.0, float(val)))
        return pad_t + plot_h * (1.0 - (v - 1.0) / 9.0)

    svg = [
        f"<svg viewBox='0 0 {int(W)} {int(H)}' class='tc-svg' xmlns='http://www.w3.org/2000/svg'>",
        f"<rect x='0' y='0' width='{int(W)}' height='{int(H)}' rx='10' fill='#0a0c12'/>",
    ]
    # Subtle Act bands
    act_cols = ["#141b29", "#1a1726", "#221620", "#241318", "#161926"]
    for idx_a, a in enumerate(acts):
        pr = a.get("partRange") or []
        if len(pr) == 2:
            x0 = pad_l + (pr[0] - 1) * col_w
            xw = (pr[1] - pr[0] + 1) * col_w
            c = act_cols[idx_a % len(act_cols)]
            svg.append(f"<rect x='{x0:.1f}' y='{pad_t:.1f}' width='{xw:.1f}' height='{plot_h:.1f}' fill='{c}' opacity='0.75'/>")
            lbl = html.escape(str(a.get("name", f"Hồi {a.get('act', idx_a+1)}"))[:28])
            svg.append(f"<text x='{x0 + xw / 2:.1f}' y='{pad_t - 9:.1f}' fill='#d69e4e' font-size='10' text-anchor='middle'>{lbl}</text>")

    # Horizontal gridlines (tension 2, 5, 8, 10)
    for lvl in (2, 5, 8, 10):
        gy = py(lvl)
        dash = "3 3" if lvl != 5 else "6 3"
        stroke = "#334155" if lvl != 5 else "#475569"
        svg.append(f"<line x1='{pad_l:.1f}' y1='{gy:.1f}' x2='{W - pad_r:.1f}' y2='{gy:.1f}' stroke='{stroke}' stroke-width='1' stroke-dasharray='{dash}'/>")
        svg.append(f"<text x='{pad_l - 8:.1f}' y='{gy + 3.5:.1f}' fill='#94a3b8' font-size='10' text-anchor='end'>{lvl}</text>")

    # Build polyline points across Start -> Peak -> End of each part
    pts = []
    part_centers = {}
    for idx_p, p in enumerate(parts):
        pno = int(p.get("part") or (idx_p + 1))
        x_s = pad_l + idx_p * col_w + 6.0
        x_m = pad_l + (idx_p + 0.5) * col_w
        x_e = pad_l + (idx_p + 1) * col_w - 6.0
        t_s = float(p.get("tensionStart") or 4)
        t_p = float(p.get("tensionPeak") or max(t_s, 6))
        t_e = float(p.get("tensionEnd") or t_p)
        pts.extend([(x_s, py(t_s)), (x_m, py(t_p)), (x_e, py(t_e))])
        part_centers[pno] = (x_m, py(t_p), p)
        # X-axis label
        pt_lbl = html.escape(str(p.get("pacingType", ""))[:12])
        svg.append(f"<text x='{x_m:.1f}' y='{H - 22:.1f}' fill='#e2e8f0' font-size='10.5' font-weight='600' text-anchor='middle'>P{pno} ({int(p.get('target_sec') or 60)}s)</text>")
        if pt_lbl:
            svg.append(f"<text x='{x_m:.1f}' y='{H - 9:.1f}' fill='#94a3b8' font-size='9' text-anchor='middle'>{pt_lbl}</text>")

    poly_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    area_str = f"{pts[0][0]:.1f},{pad_t + plot_h:.1f} {poly_str} {pts[-1][0]:.1f},{pad_t + plot_h:.1f}"
    svg.append(f"<polygon points='{area_str}' fill='#c8433c' opacity='0.14'/>")
    svg.append(f"<polyline points='{poly_str}' fill='none' stroke='#f87171' stroke-width='2.6' stroke-linejoin='round'/>")

    # Plot Clue diamonds (gold), Major Beats (purple), Jumpscare markers (red)
    for cl in clues:
        p_in = int(cl.get("plantedInPart") or 0)
        if p_in in part_centers:
            cx, cy, _ = part_centers[p_in]
            cy_m = min(pad_t + plot_h - 8, cy + 14)
            svg.append(f"<polygon points='{cx:.1f},{cy_m-5:.1f} {cx+5:.1f},{cy_m:.1f} {cx:.1f},{cy_m+5:.1f} {cx-5:.1f},{cy_m:.1f}' fill='#fbbf24' stroke='#0a0c12' stroke-width='1'/>")
    for b in beats:
        if b.get("weight") == "major":
            bp = int(b.get("part") or 0)
            if bp in part_centers:
                cx, cy, _ = part_centers[bp]
                svg.append(f"<circle cx='{cx:.1f}' cy='{cy:.1f}' r='5.5' fill='#a78bfa' stroke='#0a0c12' stroke-width='1.5'/>")
    for pno, (cx, cy, p) in part_centers.items():
        js_n = sum(1 for ab in (p.get("actionBeats") or []) if ab.get("jumpscareStyle"))
        if js_n > 0:
            svg.append(f"<polygon points='{cx:.1f},{cy-14:.1f} {cx+6:.1f},{cy-4:.1f} {cx-6:.1f},{cy-4:.1f}' fill='#ef4444' stroke='#fff' stroke-width='0.9'/>")

    # Compact legend top-right
    svg.append(
        f"<text x='{W - pad_r:.1f}' y='14' fill='#94a3b8' font-size='9.5' text-anchor='end'>"
        "▲ Jumpscare · ● Major Beat · ◆ Gieo Manh mối</text>"
    )
    svg.append("</svg>")
    return "".join(svg)


def render_markdown(doc):
    params = doc.get("params") or {}
    premise = doc.get("premise") or {}
    world_lore = doc.get("worldLore") or {}
    entity_prof = doc.get("entityProfile") or {}
    nar_style = doc.get("narrativeStyle") or {}
    acts = doc.get("acts") or []
    clues = doc.get("clues") or []
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    beats = doc.get("beats") or []
    props = doc.get("props") or []
    parts = doc.get("parts") or []
    wps = float(params.get("wordsPerSecond") or 2.9)
    total_sec = sum(float(p.get("target_sec") or 0) for p in parts)

    lines = [
        f"# STORY BIBLE: {doc.get('title', 'Chưa đặt tên')}",
        "",
        f"- **Định dạng & Quy mô:** `{resolve_format(params)}` (`{params.get('aspect', '9:16')}`) · **{len(parts)} chương** (`{int(total_sec)}s` ≈ `{total_sec/60.0:.1f} phút` · ~`{round(total_sec*wps)} từ`) · Thể loại: `{params.get('genre', '-')}` · Nguồn: `{params.get('adaptMode', '-')}`",
        f"- **Cốt lõi:** {premise.get('core', '')}",
        f"- **Luật thực thể / Cấm kỵ:** {premise.get('entityRule', '')}",
        f"- **Cú lật / Trọng tâm kết:** {premise.get('twistCore', '')}",
    ]
    if nar_style:
        lines.append(f"- **Góc nhìn & Giọng kể:** `{nar_style.get('pov', '-')}` · {nar_style.get('narratorVoice', '')}")
    if world_lore:
        lines += [
            "",
            "## 0. Thế Giới Quan (`worldLore`) & Hồ Sơ Thực Thể 4 Cấp (`entityProfile`)",
            f"- **Thời đại & Không gian:** {world_lore.get('era', '')} — {world_lore.get('settingDetail', '')}",
            f"- **Diễn biến thời tiết:** {' → '.join(world_lore.get('weatherProgression') or [])}",
            f"- **Bi kịch gốc:** {world_lore.get('backstory', '')}",
            f"- **Kiêng kỵ dân gian:** {world_lore.get('tabooLore', '')}",
        ]
    if entity_prof:
        lines += [
            f"- **Thực thể:** **{entity_prof.get('name', '-')}** — {entity_prof.get('origin', '')}",
            f"- **Dấu hiệu 5 giác quan:** {' · '.join(entity_prof.get('sensoryTells') or [])}",
            "- **4 Cấp lộ diện leo thang:** " + " → ".join(entity_prof.get("escalationStages") or []),
        ]
        if entity_prof.get("rules"):
            lines += ["", "| Quy tắc | Kích hoạt | Hậu quả | Lỗ hổng / Cái bẫy |", "|---|---|---|---|"]
            for r in entity_prof["rules"]:
                lines.append(f"| {r.get('rule', '')} | {r.get('trigger', '')} | {r.get('consequence', '')} | {r.get('loophole', '')} |")

    lines += [
        "",
        "## 1. Nhân vật (Tâm lý, Lý do mắc kẹt & Ngoại hình cho `castBlueprints`)",
        "| ID | Tên | Cấp | Vai trò | Mục tiêu / Lý do mắc kẹt / Điểm yếu | Ngoại hình (`appearanceBrief`) | Cung phát triển (`arc`) |",
        "|---|---|---|---|---|---|---|",
    ]
    for c in chars:
        psych = " · ".join(
            x for x in [
                f"**Mục tiêu:** {c['goal']}" if c.get("goal") else "",
                f"**Mắc kẹt:** {c['trappedReason']}" if c.get("trappedReason") else "",
                f"**Điểm yếu:** {c['flaw']}" if c.get("flaw") else "",
                f"**Giọng:** {c['voiceProfile']}" if c.get("voiceProfile") else "",
            ] if x
        ) or c.get("trait", "-")
        lines.append(
            f"| `{c.get('id')}` | {c.get('name')} | `{c.get('tier')}` | {c.get('role')} | {psych} | {c.get('appearanceBrief', c.get('trait', '-'))} | {c.get('arc', '-')} |"
        )

    if acts:
        lines += ["", "## 1B. Cấu trúc Đa Hồi (`acts`)"]
        for a in acts:
            pr = a.get("partRange") or [1, 1]
            lines.append(f"- **Hồi {a.get('act')}: {a.get('name')}** (`P{pr[0]}–P{pr[1]}` · *{a.get('dominantEmotion', '')}*): {a.get('goal', '')} — **Bước ngoặt:** {a.get('turningPoint', '')}")

    if clues:
        lines += ["", "## 1C. Kinh tế Manh mối, Đánh lạc hướng & Lật kèo (`clues`)", "| ID | Loại | Gieo tại | Chi tiết gieo | Lật tại | Ý nghĩa thật khi lật kèo |", "|---|---|---|---|---|---|"]
        for cl in clues:
            lines.append(f"| `{cl.get('id')}` | `{cl.get('kind')}` | `P{cl.get('plantedInPart')}` | {cl.get('plantedDetail', '')} | `P{cl.get('payoffInPart')}` | {cl.get('recontextualization', '')} |")

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

    lines += ["", "## 4. Tóm tắt & Bảng Blocking Hành Động + Định hướng Thoại từng Chương"]
    for p in parts:
        dur = float(p.get("target_sec") or 60)
        wb = round(dur * wps)
        t_str = f" · Căng thẳng `{p.get('tensionStart')}→{p.get('tensionPeak')}→{p.get('tensionEnd')}/10` (`{p.get('pacingType', '-')}`)" if p.get("tensionPeak") is not None else ""
        lines += [
            f"### Chương {p.get('part')}: {p.get('title', '')} (`{int(dur)}s` · ~`{wb} từ` · `{p.get('light')}`{t_str})",
            f"- **Hook mở:** {p.get('hook', '')}",
            f"- **Diễn biến:** {p.get('synopsis', '')}",
        ]
        if p.get("newInfoRevealed"):
            lines.append(f"- **Thông tin mới hé lộ:** {p['newInfoRevealed']}")
        lines += [
            f"- **Treo cuối (Suspense):** {p.get('suspense', '')}",
            f"- **Nhân vật / Bối cảnh / Đạo cụ:** `{','.join(p.get('characterIds') or [])}` / `{','.join(p.get('sceneIds') or [])}` / `{','.join(p.get('propIds') or [])}`",
        ]
        if p.get("actionBeats"):
            lines += [
                "",
                "| Beat | Phòng · Nhịp | Camera (`pos -> look`) | Nhân vật & Di chuyển | Đạo cụ (State) | Subtext · Cảm giác · Định hướng Thoại |",
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
                sb = ab.get("spokenBeat") or {}
                sb_s = f"Thoại `{sb.get('speaker', 'NARRATOR')}` (~{sb.get('wordBudget', 0)} từ): {sb.get('intent', '')}" if sb else ""
                sub_s = f"Nội tâm: {ab.get('subtext', '')}" if ab.get("subtext") else ""
                aud_s = f"SFX: `{ab.get('audioCue') or '-'}`" + (f" · **JS:{ab.get('jumpscareStyle')}**" if ab.get("jumpscareStyle") else "")
                detail_col = " · ".join(x for x in [ab.get("actionSummary", ""), sub_s, sb_s, aud_s] if x)
                lines.append(f"| `{ab.get('beatId')}` ({ab.get('durationSec', '-')}s) | `{ab.get('sceneId')}` · `{ab.get('mood', '')}` | {cam_s} | {acts_s} | {props_s} | {detail_col} |")
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
        psych_bits = []
        if c.get("goal"):
            psych_bits.append(f"<strong>Mục tiêu:</strong> {esc(c['goal'])}")
        if c.get("trappedReason"):
            psych_bits.append(f"<strong>Lý do mắc kẹt:</strong> {esc(c['trappedReason'])}")
        if c.get("flaw"):
            psych_bits.append(f"<strong>Điểm yếu:</strong> {esc(c['flaw'])}")
        if c.get("voiceProfile"):
            psych_bits.append(f"<strong>Giọng:</strong> {esc(c['voiceProfile'])}")
        if c.get("appearanceBrief"):
            psych_bits.append(f"<strong>Ngoại hình:</strong> {esc(c['appearanceBrief'])}")
        if c.get("relationships"):
            rels = ", ".join(f"→<code>{esc(r.get('targetId'))}</code> ({esc(r.get('relation'))})" for r in c["relationships"] if isinstance(r, dict))
            if rels:
                psych_bits.append(f"<strong>Quan hệ:</strong> {rels}")
        psych_html = "<br/>".join(psych_bits) if psych_bits else esc(c.get("trait"))
        char_rows.append(
            f"<tr><td><code>{esc(c.get('id'))}</code></td><td><strong>{esc(c.get('name'))}</strong></td>"
            f"<td><span class='pill tier-{tier}'>{tier}</span></td><td>{esc(c.get('role'))}</td>"
            f"<td>{psych_html}</td><td>{esc(c.get('arc') or '—')}</td></tr>"
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
                extra_bits = []
                if ab.get("subtext"):
                    extra_bits.append(f"<em>Nội tâm:</em> {esc(ab['subtext'])}")
                sens = ab.get("sensoryDetails")
                if isinstance(sens, dict):
                    s_parts = [f"{k}: {esc(v)}" for k, v in sens.items() if str(v).strip()]
                    if s_parts:
                        extra_bits.append(f"<em>Cảm giác:</em> {' · '.join(s_parts)}")
                sb = ab.get("spokenBeat")
                if isinstance(sb, dict):
                    extra_bits.append(
                        f"<em>Thoại ({esc(sb.get('speaker', 'NARRATOR'))}, ~{int(sb.get('wordBudget') or 0)} từ):</em> {esc(sb.get('intent', ''))}"
                        + (f" — <code>{esc(sb['keyPhrase'])}</code>" if sb.get("keyPhrase") else "")
                    )
                extra_html = f"<div class='g-det'>{'<br/>'.join(extra_bits)}</div>" if extra_bits else ""
                ab_rows.append(
                    f"<tr><td><code>{esc(ab.get('beatId'))}</code> ({esc(ab.get('durationSec', '-'))}s)<div class='g-det'>{esc(ab.get('sceneId'))} · {esc(ab.get('mood', ''))}</div></td>"
                    f"<td>{cam_s}</td><td>{acts_s}</td><td>{pr_s}</td>"
                    f"<td>{esc(ab.get('actionSummary', ''))}{extra_html}<div class='g-det'>SFX: <code>{esc(ab.get('audioCue') or '-')}</code>{js_tag}</div></td></tr>"
                )
            ab_html = (
                "<div style='margin-top:12px'><strong style='color:var(--gold);font-size:12px;text-transform:uppercase'>Bảng Blocking Hành Động & Định Hướng Thoại (Action Beats)</strong>"
                "<table style='margin-top:6px'><thead><tr><th>Beat</th><th>Camera (Neo → Nhìn)</th><th>Nhân vật & Di chuyển</th><th>Đạo cụ (State Machine)</th><th>Diễn biến, Nội tâm, Cảm giác & Thoại</th></tr></thead>"
                f"<tbody>{''.join(ab_rows)}</tbody></table></div>"
            )
        t_pill = (
            f"<span class='pill dim'>Căng thẳng {esc(p.get('tensionStart'))}→{esc(p.get('tensionPeak'))}→{esc(p.get('tensionEnd'))}/10</span>"
            f"<span class='pill dim'>{esc(p.get('pacingType'))}</span>"
            if p.get("tensionPeak") is not None else ""
        )
        new_info_html = f"<p class='kv'><strong>Thông tin mới hé lộ:</strong> {esc(p['newInfoRevealed'])}</p>" if p.get("newInfoRevealed") else ""
        part_cards.append(
            f"<div class='card part-card'><div class='part-top'><h3>Chương {esc(p.get('part'))}: {esc(p.get('title'))}</h3>"
            f"<div class='meta'><span class='pill'>{int(dur)}s (~{wb} từ)</span>{t_pill}<span class='pill light-{esc(p.get('light'))}'>{esc(p.get('light'))}</span></div></div>"
            f"<p class='kv'><strong>Hook mở:</strong> {esc(p.get('hook'))}</p>"
            f"<p class='syn'>{esc(p.get('synopsis'))}</p>{new_info_html}"
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

    # Build v3.0 Narrative Studio sections (World Lore, Entity 4-Stage Profile, Tension Curve SVG, Acts & Clues)
    world_lore = doc.get("worldLore") or {}
    entity_prof = doc.get("entityProfile") or {}
    acts = doc.get("acts") or []
    clues = doc.get("clues") or []
    tension_svg = _render_tension_curve_svg(doc)

    lore_section = ""
    if world_lore or entity_prof:
        wl_card = ""
        if world_lore:
            w_prog = " → ".join(esc(x) for x in (world_lore.get("weatherProgression") or []))
            wl_card = (
                "<div class='card'><h3>Thế giới quan & Bi kịch gốc</h3>"
                f"<p class='kv'><strong>Thời đại:</strong> {esc(world_lore.get('era'))}</p>"
                f"<p class='kv'><strong>Không gian:</strong> {esc(world_lore.get('settingDetail'))}</p>"
                f"<p class='kv'><strong>Thời tiết:</strong> {w_prog}</p>"
                f"<p class='kv'><strong>Bi kịch gốc:</strong> {esc(world_lore.get('backstory'))}</p>"
                f"<p class='kv'><strong>Cấm kỵ dân gian:</strong> {esc(world_lore.get('tabooLore'))}</p></div>"
            )
        ep_card = ""
        if entity_prof:
            rule_items = "".join(
                f"<li><strong>{esc(r.get('rule'))}</strong><div class='g-det'>Kích hoạt: {esc(r.get('trigger'))} · Hậu quả: {esc(r.get('consequence'))}"
                + (f" · <em>Kẽ hở/Bẫy:</em> {esc(r['loophole'])}" if r.get("loophole") else "")
                + "</div></li>"
                for r in (entity_prof.get("rules") or []) if isinstance(r, dict)
            )
            tells_chips = "".join(f"<span class='chip'>{esc(x)}</span>" for x in (entity_prof.get("sensoryTells") or []))
            stage_items = "".join(f"<li>{esc(x)}</li>" for x in (entity_prof.get("escalationStages") or []))
            ep_card = (
                f"<div class='card'><h3>Hồ sơ Thực thể: {esc(entity_prof.get('name') or 'Thực thể')}</h3>"
                f"<p class='kv'><strong>Bản chất:</strong> {esc(entity_prof.get('origin'))}</p>"
                f"<div class='chips'>{tells_chips}</div>"
                f"<ul class='lm-list'>{rule_items}</ul>"
                f"<div style='margin-top:8px'><strong style='font-size:12px;color:var(--gold)'>4 Cấp Lộ Diện Leo Thang:</strong><ol class='lm-list'>{stage_items}</ol></div></div>"
            )
        lore_section = f"<h2>Thế Giới Quan & Hệ Quy Tắc Thực Thể</h2><div class='grid2'>{wl_card}{ep_card}</div>"

    tension_section = ""
    if tension_svg or acts:
        act_cards = "".join(
            f"<div class='card'><strong>Hồi {esc(a.get('act'))}: {esc(a.get('name'))}</strong> "
            f"<span class='pill dim'>P{esc((a.get('partRange') or [1,1])[0])}–P{esc((a.get('partRange') or [1,1])[-1])}</span>"
            f"<p class='kv'>{esc(a.get('goal'))}</p>"
            f"<div class='g-det'><strong>Bước ngoặt:</strong> {esc(a.get('turningPoint'))} · <em>{esc(a.get('dominantEmotion'))}</em></div></div>"
            for a in acts
        )
        tension_section = (
            "<h2>Cấu Trúc Đa Hồi & Đường Cong Căng Thẳng (Tension Curve)</h2>"
            + (f"<div class='card' style='margin-bottom:12px'>{tension_svg}</div>" if tension_svg else "")
            + (f"<div class='grid2'>{act_cards}</div>" if act_cards else "")
        )

    clues_section = ""
    if clues:
        cl_rows = "".join(
            f"<tr><td><code>{esc(cl.get('id'))}</code></td><td><span class='pill {'red' if cl.get('kind')=='red_herring' else 'dim'}'>{esc(cl.get('kind'))}</span></td>"
            f"<td><code>P{esc(cl.get('plantedInPart'))}</code></td><td>{esc(cl.get('plantedDetail'))}</td>"
            f"<td><code>P{esc(cl.get('payoffInPart'))}</code></td><td>{esc(cl.get('recontextualization'))}</td></tr>"
            for cl in clues
        )
        clues_section = (
            "<h2>Kinh Tế Manh Mối, Đánh Lạc Hướng & Cú Lật (Clues & Payoff)</h2>"
            "<table><thead><tr><th>ID</th><th>Loại</th><th>Gieo</th><th>Chi tiết gieo</th><th>Lật</th><th>Ý nghĩa thật khi lật kèo</th></tr></thead>"
            f"<tbody>{cl_rows}</tbody></table>"
        )

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
  .wrap {{ max-width:1160px; margin:0 auto; padding:28px 20px 64px; }}
  header {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; gap:14px; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:22px; }}
  h1 {{ margin:0; font-size:26px; letter-spacing:.2px; }}
  h2 {{ margin:28px 0 12px; font-size:17px; color:var(--gold); text-transform:uppercase; letter-spacing:.8px; }}
  h3 {{ margin:0 0 6px; font-size:16px; }}
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
  .part-top {{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; }}
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
  .tc-svg {{ width:100%; height:auto; border:1px solid var(--line); border-radius:10px; display:block; }}
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
      <div class="pill">{esc(params.get('genre'))}</div><div class="pill dim">{esc(resolve_format(params))} · {esc(params.get('aspect', '9:16'))} · {esc(params.get('adaptMode'))}</div>
      <h1>{esc(doc.get('title'))}</h1>
    </div>
    <div><span class="pill {'red' if failed else ''}">{status_badge}</span></div>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="v">{len(parts)}</div><div class="k">Số chương ({int(total_sec)}s ≈ {total_sec/60.0:.1f}p · ~{total_words} từ)</div></div>
    <div class="kpi"><div class="v">{len(chars)}</div><div class="k">Nhân vật</div></div>
    <div class="kpi"><div class="v">{len(scenes)}</div><div class="k">Bối cảnh</div></div>
    <div class="kpi"><div class="v">{len(props)}</div><div class="k">Đạo cụ kể chuyện</div></div>
    <div class="kpi"><div class="v">{len(clues) if clues else len(beats)}</div><div class="k">{'Manh mối & Twist' if clues else 'Cao trào / Tiết lộ'}</div></div>
  </div>

  <div class="premise">
    <p class="kv"><strong>Cốt lõi (Premise):</strong> {esc(premise.get('core'))}</p>
    <p class="kv"><strong>Luật thực thể / Điều cấm kỵ:</strong> {esc(premise.get('entityRule'))}</p>
    <p class="kv"><strong>Trọng tâm cú lật (Twist):</strong> {esc(premise.get('twistCore'))}</p>
  </div>

  {lore_section}
  {tension_section}
  {clues_section}

  <h2>Nhịp Cao trào & Tiết lộ (Beats)</h2>
  <div class="beats">{''.join(beat_cards)}</div>

  <h2>Tuyến Nhân vật (Tâm lý, Lý do mắc kẹt & Ngoại hình)</h2>
  <table><thead><tr><th>ID</th><th>Tên</th><th>Cấp</th><th>Vai trò</th><th>Tâm lý · Lý do mắc kẹt · Ngoại hình</th><th>Cung biến đổi (Arc)</th></tr></thead>
  <tbody>{''.join(char_rows)}</tbody></table>

  <h2>Bối cảnh (Mặt bằng 2D SVG) & Đạo cụ kể chuyện</h2>
  <div class="grid2">{''.join(scene_cards)}{''.join(prop_cards)}</div>

  <h2>Tóm tắt & Blocking Chi tiết từng Chương</h2>
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


def build_outline_dict(doc, aspect=None, drone_hz=43.65):
    params = doc.get("params") or {}
    parts = doc.get("parts") or []
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    return {
        "title": doc.get("title", ""),
        "format": resolve_format(params),
        "aspect": aspect or params.get("aspect") or ("16:9" if resolve_format(params) == "series" else "9:16"),
        "seamlessStitch": bool(params.get("seamlessStitch", len(parts) > 1)),
        "audio_drone_hz": drone_hz,
        "locations": [
            {
                "id": s.get("id", f"S{idx:02d}"),
                "name": s.get("name", ""),
                "dimensions": s.get("dimensions"),
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
                "voiceProfile": c.get("voiceProfile", ""),
                "appearanceBrief": c.get("appearanceBrief") or c.get("trait", ""),
            }
            for idx, c in enumerate(chars, 1)
        ],
        "parts": [
            {
                "part": p["part"],
                "act": p.get("act"),
                "title": p.get("title", f"Part {p['part']}"),
                "target_sec": p.get("target_sec", 60),
                "light": p.get("light", "coldMoon"),
                "pacingType": p.get("pacingType"),
                "transition_out": p.get("transitionOut") or ("cut" if i < len(parts) else "fade:0.5"),
                "cliffhanger": p.get("suspense", ""),
            }
            for i, p in enumerate(parts, 1)
        ],
    }


def cmd_export_outline(args):
    doc = read_json(args.story)
    outline = build_outline_dict(doc, aspect=args.aspect, drone_hz=args.drone_hz)
    text = json.dumps(outline, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        write_text(args.out, text)
        print(f"Exported OUTLINE.json -> {args.out}")
    else:
        print(text)


_HUMAN_ACTING_RULES = [
    (("thở dài", "mệt mỏi", "kiệt sức", "buông xuôi", "chán nản", "sigh"), "sighDrop", None, "both"),
    (("nhún vai", "mặc xác", "kệ nó", "chịu thua", "chẳng rõ", "shrug"), "shrug", None, "both"),
    (("thở dốc", "hổn hển", "thở gấp", "hụt hơi", "pant"), "heavyPant", "fear", "both"),
    (("nín thở", "chết lặng", "im bặt", "không dám thở", "đứng chết trân", "freeze"), "breathHold", None, "both"),
    (("rùng mình", "lạnh gáy", "nổi da gà", "ớn lạnh", "run rẩy", "run bần bật", "shiver"), "shiver", "fear", "both"),
    (("giật mình", "giật bắn", "điếng người", "đứng tim", "khựng lại", "hoảng hồn", "flinch"), "flinch", "shock", "both"),
    (("lắng nghe", "tiếng gõ", "bước chân", "dỏng tai", "nghe ngóng", "listen"), "tiltListen", None, "left"),
    (("liếc", "ngoái", "nhìn sang", "quay sang", "ngó quanh", "glance"), "glanceAside", None, "right"),
    (("rụt cổ", "cúi gằm", "thu người", "nép vào", "chin tuck"), "chinTuck", None, "both"),
    (("ghé sát", "nhìn kỹ", "cúi sát", "rướn người", "soi kỹ", "lean in"), "leanIn", None, "both"),
    (("lùi lại", "ngả người", "lùi bước", "né tránh", "lean back"), "leanBack", "fear", "both"),
    (("co rúm", "run sợ", "ôm đầu", "co người", "cower"), "cower", "fear", "both"),
    (("lắc đầu", "không thể", "không phải", "đừng", "shake head"), "headShake", None, "both"),
    (("gật lia", "vội gật", "gật liên tiếp", "gật gù"), "nodDouble", None, "both"),
    (("gật đầu", "đúng rồi", "đồng ý", "nod"), "nodSlow", None, "both"),
    (("loạng choạng", "bước đi", "đi tới", "step"), "stepSway", None, "both"),
]

_ENTITY_ACTING_RULES = [
    (("ngoẹo cổ", "vặn cổ", "bẻ cổ", "nghiêng cổ", "gập cổ", "crack neck"), "neckCrack", None, "right"),
    (("rung giật", "giật liên hồi", "co giật", "twitch"), "neckTwitch", None, "both"),
    (("há miệng", "há hàm", "cười ngoác", "nhe răng", "nụ cười", "grin", "jaw"), "jawStretch", "entity_scare", "both"),
    (("tiến sát", "áp sát", "lao tới", "phình lớn", "dí sát", "loom"), "loomSwell", "entity_scare", "both"),
    (("đứng im", "bất động", "chết lặng", "im phăng phắc", "motionless"), "breathHold", None, "both"),
]


def infer_acting_cues_from_text(text: str, role: str = "human", max_cues: int = 3) -> list:
    """Infer story-driven 2.5D `actingCues[]` directly from Vietnamese beat action/dialogue text (zero hardcoded loops!)."""
    raw = str(text or "").strip()
    if not raw:
        return []
    low = raw.lower()
    is_entity = str(role or "human").lower() in ("entity", "lurker", "silhouette")
    rules = _ENTITY_ACTING_RULES if is_entity else _HUMAN_ACTING_RULES
    hits = []
    seen_gestures = set()
    for keywords, gesture, expr_to, side in rules:
        if gesture in seen_gestures:
            continue
        best_pos = -1
        best_kw = ""
        for kw in keywords:
            pos = low.find(kw)
            if pos >= 0 and (best_pos < 0 or pos < best_pos):
                best_pos = pos
                best_kw = raw[pos : pos + len(kw)]
        if best_pos >= 0:
            seen_gestures.add(gesture)
            cue = {"gesture": gesture, "onPhrase": best_kw, "intensity": 0.9}
            if side != "both":
                cue["side"] = side
            if expr_to:
                cue["exprTo"] = expr_to
                cue["exprBlendFrames"] = 6
            hits.append((best_pos, cue))
    hits.sort(key=lambda x: x[0])
    return [c for _, c in hits[:max_cues]]


def _export_single_part_blueprint(doc, part, out_dir, base_project_id, aspect, bed_sound, first_seen_locs=None, first_seen_chars=None):
    parts = doc.get("parts") or []
    part_no = int(part.get("part", 1))
    chars = doc.get("characters") or []
    scenes = doc.get("scenes") or []
    props = doc.get("props") or []
    abeats = part.get("actionBeats") or []
    project_id = f"{base_project_id}-p{part_no:02d}" if len(parts) > 1 else base_project_id

    # Map character names/IDs to distinct VieNeu-TTS voices so NPCs never clone the narrator
    char_voice_map = {}
    for c in chars:
        cname = str(c.get("name") or "").strip()
        cid = str(c.get("id") or "").strip()
        if cid == "C01" or "pov" in str(c.get("role", "")).lower():
            continue
        v_pick = resolve_vieneu_cast_voice(
            cname or cid,
            str(c.get("voiceProfile") or ""),
            str(c.get("role") or ""),
            narrator_voice="Thiện Minh",
        )
        if cname:
            char_voice_map[cname.upper()] = v_pick
        if cid:
            char_voice_map[cid.upper()] = v_pick

    # 1. SCRIPT.skeleton.md grouped into coherent Acts with v13 clause prosody, [BEAT Xs], [SILENCE_DROP Xs] & auto-cast voices
    script_lines = [
        f"# {doc.get('title', project_id)} — Chương {part_no}: {part.get('title', '')}",
        f"<!-- Format: {resolve_format(doc.get('params') or {})} | Target: {int(part.get('target_sec') or 60)}s | Pacing: {part.get('pacingType', '-')} -->",
        "",
    ]
    if abeats:
        script_lines.append("<!-- v14.0 Immediate 0.05s Cold Hook Entry: CẤM chèn [VISUAL] im lặng ở đầu chương! Vào thẳng câu Hook sốc 1–5s đầu tiên -->")
        cur_header = None
        ch_meta = part.get("coldHook") if isinstance(part.get("coldHook"), dict) else {}
        for idx_ab_s, ab in enumerate(abeats):
            sb = ab.get("spokenBeat") or {}
            deliv = sb.get("delivery") if isinstance(sb.get("delivery"), dict) else {}
            mood = sb.get("mood") or ab.get("mood") or ("tense" if idx_ab_s == 0 else "calm_omen")
            speaker = str(sb.get("speaker") or "NARRATOR").strip()
            prox = str(deliv.get("prox") or "").strip()
            if ab.get("deadSilenceBeforeSec"):
                script_lines.append(f"[DEAD SILENCE {float(ab['deadSilenceBeforeSec']):.2f}s]")
                cur_header = None
            elif ab.get("silenceDropBeforeSec") or deliv.get("silenceDropBeforeSec"):
                sd_s = float(ab.get("silenceDropBeforeSec") or deliv.get("silenceDropBeforeSec"))
                script_lines.append(f"[SILENCE_DROP {sd_s:.2f}s]")
                cur_header = None
            elif idx_ab_s > 0 and ab.get("visualBeforeSec"):
                script_lines.append(f"[VISUAL {float(ab['visualBeforeSec']):.2f}s]")
            elif idx_ab_s > 0 and ab.get("pauseBeforeSec"):
                script_lines.append(f"[PAUSE {float(ab['pauseBeforeSec']):.2f}s]")

            if speaker.upper() == "NARRATOR":
                prox_attr = f" | prox={prox}" if prox else ""
                hdr = f"[NARRATOR | mood={mood}{prox_attr}]"
            else:
                v_cast = char_voice_map.get(speaker.upper()) or resolve_vieneu_cast_voice(speaker, "", "")
                fx_tag = str(deliv.get("fx") or "room")
                hdr = f"[SPEAKER: {speaker} | voice={v_cast} | mood={mood} | fx={fx_tag}]"
            if hdr != cur_header:
                script_lines.append(hdr)
                cur_header = hdr
            meta_bits = [f"@{ab.get('beatId')} ({ab.get('sceneId')}, {ab.get('durationSec', '-')}s)"]
            if ab.get("subtext"):
                meta_bits.append(f"Nội tâm: {ab['subtext']}")
            if isinstance(ab.get("sensoryDetails"), dict):
                sd = ", ".join(f"{k}={v}" for k, v in ab["sensoryDetails"].items() if str(v).strip())
                if sd:
                    meta_bits.append(f"Cảm giác: {sd}")
            if sb.get("wordBudget"):
                meta_bits.append(f"~{int(sb['wordBudget'])} từ")
            script_lines.append(f"<!-- {' | '.join(meta_bits)} -->")
            beat_pre = f"[BEAT {float(deliv['beatBeforeSec']):.2f}s] " if deliv.get("beatBeforeSec") else ""
            pace_tag = ""
            if deliv.get("pace") or deliv.get("pitchSt"):
                kv_p = []
                if deliv.get("pace"):
                    kv_p.append(f"PACE={deliv['pace']}")
                if deliv.get("pitchSt") is not None:
                    kv_p.append(f"PITCH={deliv['pitchSt']}")
                pace_tag = f"[{' | '.join(kv_p)}] "
            open_line = str(ch_meta.get("openingLine") or "").strip() if idx_ab_s == 0 else ""
            hint = open_line or sb.get("keyPhrase") or ab.get("spokenHint") or sb.get("intent") or ab.get("actionSummary", "")
            body_line = hint if (open_line or ab.get("spokenHint")) else f"[VIẾT LỜI THOẠI {ab.get('beatId')}: {hint}]"
            script_lines.append(f"{beat_pre}{pace_tag}{body_line}")
    else:
        script_lines += ["[NARRATOR | mood=calm_omen]", part.get("synopsis", "")]

    # 2. manifest.draft.json with locked locations[].anchors + castBlueprints[] + sameLocationOf/sameCharacterOf continuity
    loc_blueprints = []
    for s in scenes:
        if part.get("sceneIds") and s.get("id") not in part["sceneIds"]:
            continue
        sid = s.get("id")
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
        s_props = [pr.get("name", pr.get("id")) for pr in props if pr.get("sceneId") == sid]
        while len(s_props) < 3:
            s_props.append(f"storyProp_{len(s_props)+1}")
        revisit = {}
        if first_seen_locs is not None:
            if sid in first_seen_locs:
                revisit["sameLocationOf"] = first_seen_locs[sid]
            else:
                first_seen_locs[sid] = f"{project_id}:{sid}"
        loc_blueprints.append({
            "id": sid,
            "archetype": s.get("archetype") or "customHorrorRoom",
            "dimensions": s.get("dimensions") or [6.0, 7.0, 3.6],
            "ceilingType": s.get("ceilingType") or "flatConcrete",
            "materials": s.get("materials") or {"wall": "mottledPlasterTex", "floor": "darkTimberTex", "ceiling": "concreteCeilingTex"},
            "practicalLights": s.get("practicalLights") or ["oilLamp"],
            "heroProps": s_props,
            "signatureShadowBeat": s.get("atmosphere") or "Story-driven shadow motif",
            "anchors": anchors,
            **({"portals": portals} if portals else {}),
            **revisit,
        })

    cast_blueprints = []
    for c in chars:
        if part.get("characterIds") and c.get("id") not in part["characterIds"]:
            continue
        cid = c.get("id")
        role_t = c.get("roleType") or ("entity" if "thực thể" in str(c.get("role", "")).lower() or "ma" in str(c.get("role", "")).lower() else "human")
        revisit_c = {}
        if first_seen_chars is not None:
            if cid in first_seen_chars:
                revisit_c["sameCharacterOf"] = first_seen_chars[cid]
            else:
                first_seen_chars[cid] = f"{project_id}:{cid}"
        cast_blueprints.append({
            "id": cid,
            "role": role_t if role_t in VALID_ROLE_TYPES else "human",
            "characterMode": "sprite2d",
            **({"scareTier": int(c.get("scareTier") or 5)} if role_t == "entity" else {}),
            "storyDescription": c.get("appearanceBrief") or c.get("trait") or c.get("role", ""),
            "appearance": {
                "height": float(c.get("heightMeters") or (1.82 if role_t == "entity" else 1.72)),
                "lowPoly": True,
                "outlineMode": "off",
                **({"entity": {"heightScale": 1.15, "breathing": False, "steppedFps": 10}} if role_t == "entity" else {}),
            },
            **revisit_c,
        })

    fps = 30
    cur_f = 0
    m_beats = []
    cues_events = []
    js_clips_draft = []
    primary_entity_id = next((cb["id"] for cb in cast_blueprints if cb.get("role") == "entity"), None)
    for idx_ab, ab in enumerate(abeats, 1):
        dur_f = max(15, int(round(float(ab.get("durationSec") or 5.0) * fps)))
        a_f, b_f = cur_f, cur_f + dur_f
        cur_f = b_f
        cast_states = {}
        role_by_id = {str(b.get("id")): str(b.get("role") or "human") for b in cast_blueprints}
        beat_text_hint = " ".join(
            str(x)
            for x in (
                ab.get("actionSummary") or "",
                ab.get("dialogueCue") or "",
                ab.get("spokenLine") or "",
            )
            if x
        )
        for act in ab.get("actors") or []:
            frm = act.get("fromLandmark") or act.get("landmark") or ""
            to = act.get("toLandmark") or frm
            raw_pose = str(act.get("pose") or "loomingStill")
            safe_pose = raw_pose if raw_pose in VALID_ENGINE_POSES else ("walk" if "walk" in raw_pose.lower() or "pace" in raw_pose.lower() else ("standIdle" if "idle" in raw_pose.lower() else "loomingStill"))
            st_obj = {
                "visible": bool(act.get("visible", True)),
                "anchor": frm,
                "pose": safe_pose,
            }
            if to and to != frm:
                st_obj["moveFromAnchor"] = frm
                st_obj["moveToAnchor"] = to
            if act.get("alignPart"):
                st_obj["alignPart"] = act["alignPart"]
            if act.get("allowTeleport"):
                st_obj["allowTeleport"] = True
            act_role = role_by_id.get(str(act.get("id")), "human")
            act_hint = str(act.get("actingNote") or "") + " " + beat_text_hint
            inferred_cues = infer_acting_cues_from_text(act_hint, role=act_role)
            if inferred_cues:
                st_obj["actingCues"] = inferred_cues
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
            js_dur_f = min(max(60, dur_f), 90)
            js_a = a_f
            js_b = min(b_f, js_a + js_dur_f)
            if js_b - js_a < 54:
                js_b = js_a + 60
            js_clips_draft.append({
                "id": f"js{len(js_clips_draft) + 1}",
                "src": f"assets/jumpscare_js{len(js_clips_draft) + 1}.mp4",
                "a": js_a,
                "b": js_b,
                "anchorFrame": max(0, js_a - 1),
                "transitionStyle": str(ab.get("transitionStyle") or "first_frame_seamless"),
                "audioCueId": cid_ev,
                **({"entityId": primary_entity_id} if primary_entity_id else {}),
                "prompt": str(ab.get("actionSummary") or "Sudden uncanny horror reveal"),
            })
            cues_events.append({
                "id": cid_ev,
                "jumpscare": ab["jumpscareStyle"],
                "bus": "sfx",
                "at": round(js_a / fps, 2),
                "target_peak_dbfs": -1.0,
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
            "recommendedMicroShots": max(1, int(math.ceil(float(ab.get("durationSec") or 5.0) / 3.5))),
        })

    pov_mode = str((doc.get("params") or {}).get("pov") or "first_person_survivor")
    pacing_prof_bp = str((doc.get("params") or {}).get("pacingProfile") or "")
    use_cold_hook_open = (part_no == 1) and (pacing_prof_bp == "viral_short" or isinstance(part.get("coldHook"), dict))
    total_f_draft = cur_f if cur_f > 0 else int(round(float(part.get("target_sec") or 75) * fps))
    starter_shots = []
    if m_beats:
        seen_starter_locs = set()
        sh_id = 1
        for idx_mb, mb in enumerate(m_beats):
            ba_f = int(mb["a"])
            bb_f = int(mb["b"]) if idx_mb < len(m_beats) - 1 else total_f_draft
            if bb_f <= ba_f:
                continue
            loc_id = mb.get("locationId", "S01")
            if loc_id not in seen_starter_locs:
                seen_starter_locs.add(loc_id)
                span_b = bb_f - ba_f
                if use_cold_hook_open and ba_f == 0 and span_b >= 120:
                    hk_end = min(135, max(45, span_b // 3))
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": 0,
                        "b": hk_end,
                        "scale": "POV_CU",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "cold_hook",
                        "axisSide": "pov_center",
                        "note": f"1-5s Cold Hook ({loc_id}) — immediate anomaly/prop/warning before room reveal",
                    })
                    sh_id += 1
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": hk_end,
                        "b": bb_f,
                        "scale": "WS",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "master",
                        "axisSide": "pov_center",
                        "note": f"Master Establishing Shot ({loc_id}) — snap context & readable room geography",
                    })
                    sh_id += 1
                elif span_b >= 135:
                    m_end = ba_f + max(66, min(105, span_b // 2))
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": ba_f,
                        "b": m_end,
                        "scale": "WS",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "master",
                        "axisSide": "pov_center",
                        "note": f"Master Establishing Shot ({loc_id}) — readable room geography & practical lamps",
                    })
                    sh_id += 1
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": m_end,
                        "b": bb_f,
                        "scale": "POV",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "pov",
                        "axisSide": "pov_center",
                        "povMode": "idle",
                        "note": mb.get("cameraIntent", f"Anchored POV beat {mb['beatId']}"),
                    })
                    sh_id += 1
                else:
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": ba_f,
                        "b": bb_f,
                        "scale": "WS",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "master",
                        "axisSide": "pov_center",
                        "note": f"Master Establishing Shot ({loc_id}) — {mb.get('cameraIntent', '')}",
                    })
                    sh_id += 1
            else:
                use_ots = (idx_mb == 2 and (bb_f - ba_f) >= 120)
                if use_ots:
                    ots_len = min(90, max(45, (bb_f - ba_f) // 3))
                    ots_end = ba_f + ots_len
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": ba_f,
                        "b": ots_end,
                        "scale": "OTS",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "ots_same_side",
                        "axisSide": "right",
                        "note": f"Brief same-side OTS transition ({mb['beatId']})",
                    })
                    sh_id += 1
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": ots_end,
                        "b": bb_f,
                        "scale": "POV",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "pov",
                        "axisSide": "pov_center",
                        "povMode": "idle",
                        "note": mb.get("cameraIntent", f"Anchored POV beat {mb['beatId']}"),
                    })
                    sh_id += 1
                else:
                    starter_shots.append({
                        "id": sh_id,
                        "beatId": mb["beatId"],
                        "a": ba_f,
                        "b": bb_f,
                        "scale": "POV",
                        "light": mb["lightState"]["preset"],
                        "cameraMode": "pov",
                        "axisSide": "pov_center",
                        "povMode": "idle",
                        "note": mb.get("cameraIntent", f"Anchored POV beat {mb['beatId']}"),
                    })
                    sh_id += 1

    # v15.0: Ensure every exported part has >= 1 synchronized Jumpscare clip + cues event (min_jumpscares >= 1)!
    if not js_clips_draft and m_beats:
        climax_b = m_beats[-1]
        js_dur_f = min(75, max(54, climax_b["b"] - climax_b["a"]))
        js_a = max(climax_b["a"], climax_b["b"] - js_dur_f)
        js_b = min(total_f_draft, js_a + js_dur_f)
        cid_ev = f"js_{climax_b['beatId']}"
        climax_b.setdefault("audioCueIds", []).append(cid_ev)
        js_clips_draft.append({
            "id": "js1",
            "src": "assets/jumpscare_js1.mp4",
            "a": js_a,
            "b": js_b,
            "anchorFrame": max(0, js_a - 1),
            "transitionStyle": "first_frame_seamless",
            "audioCueId": cid_ev,
            **({"entityId": primary_entity_id} if primary_entity_id else {}),
            "prompt": str(climax_b.get("cameraIntent") or "Sudden climax horror reveal"),
        })
        cues_events.append({
            "id": cid_ev,
            "jumpscare": "cinema_stab",
            "bus": "sfx",
            "at": round(js_a / fps, 2),
            "target_peak_dbfs": -1.0,
            "tinnitus": True,
            "label": f"Climax Jumpscare ({climax_b['beatId']})",
        })

    manifest_draft = {
        "projectId": project_id,
        "title": f"{doc.get('title', project_id)} — Chương {part_no}" if len(parts) > 1 else doc.get("title", project_id),
        "totalFrames": total_f_draft,
        "aspect": aspect,
        "characterMode": "sprite2d",
        "headerStyle": "camcorder" if pov_mode == "found_footage_tape" else "minimal",
        "locations": loc_blueprints,
        "castBlueprints": cast_blueprints,
        "beats": m_beats,
        **({"shots": starter_shots} if starter_shots else {}),
        **({"jumpscareClips": js_clips_draft} if js_clips_draft else {}),
    }
    sc_design = doc.get("soundscapeDesign") if isinstance(doc.get("soundscapeDesign"), dict) else {}
    far_cfg = sc_design.get("farBed") if isinstance(sc_design.get("farBed"), dict) else {}
    near_cfg = sc_design.get("nearBed") if isinstance(sc_design.get("nearBed"), dict) else {}
    far_sound = str(far_cfg.get("sound") or bed_sound)
    far_auto = []
    occ = far_cfg.get("occlusionTrigger") if isinstance(far_cfg.get("occlusionTrigger"), dict) else None
    if occ and occ.get("atWord"):
        far_auto.append({
            "at_word": occ["atWord"],
            "gain_delta_db": float(occ.get("gainDeltaDb", -6.0)),
            "lp_hz": float(occ.get("lpHz", 580)),
            "transition_s": float(occ.get("transitionSec", 0.75)),
        })
    draft_beds = [
        {
            "sound": far_sound,
            "role": "far",
            "target_rms_dbfs": -32.0,
            "hp_hz": 110,
            "lp_hz": 3400,
            "voice_notch_db": -3.0,
            "duck_db": -3.5,
            "whisper_duck_db": -9.0,
            **({"automation": far_auto} if far_auto else {}),
            "label": far_cfg.get("label") or f"Lớp nền xa ngoài trời: {(scenes[0].get('atmosphere') if scenes else '')[:80]}",
        }
    ]
    if near_cfg.get("sound") and near_cfg.get("sound") != far_sound:
        draft_beds.append({
            "sound": str(near_cfg["sound"]),
            "role": "near",
            "target_rms_dbfs": -36.5,
            "hp_hz": 80,
            "lp_hz": 2600,
            "duck_db": -3.0,
            "whisper_duck_db": -8.0,
            "label": near_cfg.get("label") or "Lớp nền cận cảnh trong phòng",
        })

    draft_motifs = []
    for mf in (sc_design.get("motifs") or []):
        if not isinstance(mf, dict) or not mf.get("sound"):
            continue
        draft_motifs.append({
            "id": mf.get("id") or "m_motif_01",
            "sound": mf["sound"],
            "start": {"at": 2.2},
            "end": {"at": round(max(6.0, (total_f_draft / fps) * 0.78), 2)},
            "interval_s": float(mf.get("intervalSec") or 2.5),
            "mode": str(mf.get("mode") or "steady_then_stop"),
            "space": str(mf.get("space") or "room"),
            "target_peak_dbfs": -16.0,
            "label": mf.get("meaning") or "Âm thanh lặp dẫn dắt tâm lý rồi phá vỡ quy luật",
        })

    explicit_js = max(1, len(js_clips_draft))
    cues_draft = {
        "voice": "voice/voice.wav",
        "words": "voice/words.json",
        "target_lufs": -16.0,
        "ceil_db": -1.0,
        "dead_silence_floor_db": -48.0,
        "min_jumpscares": 1,
        "max_jumpscares": max(2, explicit_js),
        "beds": draft_beds,
        **({"motifs": draft_motifs} if draft_motifs else {}),
        "events": cues_events,
    }

    os.makedirs(out_dir, exist_ok=True)
    p_script = os.path.join(out_dir, "SCRIPT.skeleton.md")
    p_man = os.path.join(out_dir, "manifest.draft.json")
    p_cues = os.path.join(out_dir, "cues.draft.json")
    write_text(p_script, "\n".join(script_lines) + "\n")
    write_text(p_man, json.dumps(manifest_draft, ensure_ascii=False, indent=2) + "\n")
    write_text(p_cues, json.dumps(cues_draft, ensure_ascii=False, indent=2) + "\n")
    return p_script, p_man, p_cues, len(loc_blueprints), len(cast_blueprints), len(m_beats), len(cues_events)


def cmd_export_blueprint(args):
    """Export synchronized downstream starters (SCRIPT.skeleton.md, manifest.draft.json, cues.draft.json) for 1 part or --all-parts."""
    doc = read_json(args.story)
    params = doc.get("params") or {}
    parts = doc.get("parts") or []
    base_project_id = args.project_id or re.sub(r"[^a-z0-9-]+", "-", str(doc.get("title", "horror-short")).lower()).strip("-") or "horror-short"
    aspect = args.aspect or params.get("aspect") or ("16:9" if resolve_format(params) == "series" else "9:16")

    if getattr(args, "all_parts", False) and len(parts) >= 1:
        os.makedirs(args.out, exist_ok=True)
        outline = build_outline_dict(doc, aspect=aspect, drone_hz=43.65)
        write_text(os.path.join(args.out, "OUTLINE.json"), json.dumps(outline, ensure_ascii=False, indent=2) + "\n")
        # Initial CONTINUITY.init.json seeded from worldLore + initial prop states + first landmarks
        wl = doc.get("worldLore") or {}
        first_scene = (doc.get("scenes") or [{}])[0]
        first_lm = ((first_scene.get("landmarks") or [{}])[0]).get("id") or "POV_START"
        cont_init = {
            "completed_part": 0,
            "world_state": {
                "era": wl.get("era") or doc.get("title", "Horror World"),
                "light": (parts[0].get("light") if parts else "warmLamp"),
                "weather": ((wl.get("weatherProgression") or ["Đêm tối"])[0]),
            },
            "audio_bridge": {"drone_hz": 43.65, "bed_sound": args.bed_sound},
            "characters": {
                c["id"]: {"anchor": first_lm, "sceneId": first_scene.get("id", "S01"), "carriedItems": c.get("carriedItems") or []}
                for c in (doc.get("characters") or []) if c.get("id")
            },
            "props": {
                pr["id"]: pr.get("initialState") or ((pr.get("states") or ["default"])[0])
                for pr in (doc.get("props") or []) if pr.get("id")
            },
        }
        write_text(os.path.join(args.out, "CONTINUITY.init.json"), json.dumps(cont_init, ensure_ascii=False, indent=2) + "\n")
        seen_locs, seen_chars = {}, {}
        for p in parts:
            pno = int(p.get("part", 1))
            p_dir = os.path.join(args.out, f"p{pno:02d}")
            _export_single_part_blueprint(doc, p, p_dir, base_project_id, aspect, args.bed_sound, seen_locs, seen_chars)
        print(f"BLUEPRINT ALL-PARTS EXPORTED ({len(parts)} chapters) -> {args.out}")
        return

    part_no = int(args.part or 1)
    part = next((p for p in parts if int(p.get("part", 0)) == part_no), parts[0] if parts else {})
    p_script, p_man, p_cues, n_loc, n_cast, n_b, n_c = _export_single_part_blueprint(
        doc, part, args.out, base_project_id, aspect, args.bed_sound
    )
    print(f"BLUEPRINT EXPORTED -> {args.out}")
    print(f"  - {p_script}")
    print(f"  - {p_man} ({n_loc} locations, {n_cast} castBlueprints, {n_b} beats)")
    print(f"  - {p_cues} ({n_c} synchronized audio/jumpscare cues)")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description="Horror Story Architect v3.0 CLI (24 quality gates, 150-300s Shorts & 8-15m Series)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ch = sub.add_parser("chunk", help="Split long source novel/story .txt into volumes")
    p_ch.add_argument("book")
    p_ch.add_argument("workdir")
    p_ch.add_argument("--per-volume", type=int, default=15)
    p_ch.add_argument("--chunk-chars", type=int, default=18000)

    p_sd = sub.add_parser("seed", help="Generate starter story.json v3.0 skeleton (short 150-300s, series 8-15m, micro 45-90s)")
    p_sd.add_argument("--title", required=True)
    p_sd.add_argument("--format", choices=["auto", "micro", "short", "series"], default="auto")
    p_sd.add_argument("--parts", type=int, default=None)
    p_sd.add_argument("--total-sec", type=int, default=None, help="Target total duration in seconds (short: 150-300, series: 480-900)")
    p_sd.add_argument("--mode", choices=["auto", "standalone", "short", "series", "micro"], default="auto")
    p_sd.add_argument("--aspect", choices=["9:16", "16:9"], default=None)
    p_sd.add_argument("--pov", choices=sorted(VALID_POVS), default="first_person_survivor")
    p_sd.add_argument("--genre", default="folklore")
    p_sd.add_argument("--pacing-profile", choices=sorted(VALID_PACING_PROFILES), default=None, help="viral_short (60-90s fast retention) or deep_story (2.5-10m)")
    p_sd.add_argument("--dialect", choices=sorted(VALID_DIALECT_REGIONS), default="north", help="Vietnamese regional dialect & folk lexicon (north, central, south)")
    p_sd.add_argument("--grit-level", choices=sorted(VALID_GRIT_LEVELS), default="platform_safe_raw", help="Colloquial strong language level (platform_safe_raw default)")
    p_sd.add_argument("--adapt-mode", choices=["original", "folklore", "adapt", "reimagine"], default="original")
    p_sd.add_argument("--out")

    p_vl = sub.add_parser("validate", help="Run 24 deterministic story, tension, clue & spatial-blocking quality gates")
    p_vl.add_argument("story")
    p_vl.add_argument("--stage", choices=["skeleton", "lore", "beats", "structure", "full"], default="full")
    p_vl.add_argument("--strict-spatial", action="store_true", help="Require v2.0 spatial floorplan landmarks & actionBeats even on v1 JSON")
    p_vl.add_argument("--strict-story", action="store_true", help="Require v3.0 Narrative Studio gates (19..24) even on v1/v2 JSON")

    p_ck = sub.add_parser("checkup", help="Compact pass/fail summary of all 24 gates")
    p_ck.add_argument("story")
    p_ck.add_argument("--strict-spatial", action="store_true")
    p_ck.add_argument("--strict-story", action="store_true")

    p_rn = sub.add_parser("render", help="Render Story Bible as HTML (with Tension Curve SVG + 2D Floorplans) or Markdown")
    p_rn.add_argument("story")
    p_rn.add_argument("--html", action="store_true")
    p_rn.add_argument("--md", action="store_true")
    p_rn.add_argument("--out")

    p_ex = sub.add_parser("export-outline", help="Export OUTLINE.json compatible with horror-series-pipeline")
    p_ex.add_argument("story")
    p_ex.add_argument("--aspect", choices=["9:16", "16:9"], default=None)
    p_ex.add_argument("--drone-hz", type=float, default=43.65)
    p_ex.add_argument("--out")

    p_bp = sub.add_parser("export-blueprint", help="Export synchronized SCRIPT.skeleton.md, manifest.draft.json & cues.draft.json")
    p_bp.add_argument("story")
    p_bp.add_argument("--out", required=True, help="Output directory for synchronized blueprint files")
    p_bp.add_argument("--part", type=int, default=1)
    p_bp.add_argument("--all-parts", action="store_true", help="Export OUTLINE.json, CONTINUITY.init.json and p01..pNN folders for all chapters")
    p_bp.add_argument("--project-id", default=None)
    p_bp.add_argument("--aspect", choices=["9:16", "16:9"], default=None)
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
