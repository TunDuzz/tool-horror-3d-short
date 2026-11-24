#!/usr/bin/env python3
"""Horror Engine v3: Pre-render Script-to-Frame Consistency & Anti-Repetition Validator.

Checks:
  1. Timeline contiguity & coverage across 0..totalFrames (zero gaps, overlaps, or out-of-range peakFrames).
  2. LocationBlueprint completeness (archetype, dimensions, valid ceilingType, wall/floor/ceiling materials, >= 3 heroProps).
  3. Strict v3 LightKey compliance (warmLamp | coldMoon | fluorescent | duskFog | flashlight).
  4. Spoken line fidelity against SCRIPT.md and word-timestamp alignment against words.json (+-0.35s).
  5. Phone3D detail (clock / notifTime / notifSender) synchronization with HUD notification fields.
  6. Cross-Video & Cross-Part Anti-Repetition Gate against LOCATION_REGISTRY.json (emits ANTI_REPEAT_ERROR
     whenever unrelated videos or unrelated locations without explicit `sameLocationOf` share the same
     (archetype, ceilingType, wall/floor materials) or >= 60% feature overlap).
  7. Emits still_manifest.json listing 100% of beats' peakFrame + cameraIntent + expected states.

Usage:
  python3 scripts/validate_manifest.py <manifest.json>
    [--script SCRIPT.md] [--words words.json]
    [--registry LOCATION_REGISTRY.json] [--update-registry]
    [--still-out still_manifest.json]
"""

import argparse
import json
import os
import re
import sys

VALID_LIGHTS = {"warmLamp", "coldMoon", "fluorescent", "duskFog", "flashlight"}
VALID_CEILINGS = {
    "aFrameThatch",
    "aFrameTile",
    "flatConcrete",
    "dropCeiling",
    "vaulted",
    "openSky",
    "vehicleCabin",
}
VALID_POSES = {
    "standIdle",
    "nervousIdle",
    "talkCalm",
    "talkUrgent",
    "reachInteract",
    "glassSlam",
    "sitCrossLegged",
    "sitChair",
    "sitBenchHunched",
    "walk",
    "creep",
    "peerForward",
    "recoil",
    "holdPhone",
    "holdLantern",
    "point",
    "lunge",
    "loomingStill",
    "peekAroundDoor",
    "turnHead",
    "stalkLoom",
    "jawUnlatch",
    "crawler",
    "doorwayPeek",
    "backbendCrab",
    "lungeCloseUp",
}
VALID_ROLES = {"human", "entity", "silhouette", "lurker"}
VALID_HAIR_STYLES = {"shortParted", "spiky", "elderThin", "bun", "longDraped", "messyFringe", "bald"}
VALID_GARMENTS = {"funeralRobe", "shirt", "coat", "hospitalGown", "casualJacket", "shroud"}
VALID_EYE_HORROR = {"sanpaku", "voidSockets", "weepingIchor", "stitched", "multiEye"}
VALID_EXPRS = {
    "calm",
    "wary",
    "uneasy",
    "dread",
    "terrified",
    "deadStare",
    "unsettlingSmile",
    "hollow",
}
FPS = 30.0


def norm_text(s: str) -> str:
    return re.sub(r"[^\w\s]", "", s.lower(), flags=re.UNICODE).strip()


def loc_feature_set(loc: dict) -> set:
    mats = loc.get("materials") or {}
    feats = {
        f"arch:{str(loc.get('archetype', '')).strip().lower()}",
        f"ceil:{str(loc.get('ceilingType', '')).strip().lower()}",
        f"wall:{str(mats.get('wall', '')).strip().lower()}",
        f"floor:{str(mats.get('floor', '')).strip().lower()}",
        f"cmat:{str(mats.get('ceiling', '')).strip().lower()}",
    }
    for p in loc.get("heroProps") or []:
        feats.add(f"prop:{str(p).strip().lower()}")
    return feats


def check_location_similarity(loc_a: dict, loc_b: dict):
    """Return an ANTI_REPEAT_ERROR reason string if two unrelated locations are too similar, else None."""
    mats_a = loc_a.get("materials") or {}
    mats_b = loc_b.get("materials") or {}

    same_core = (
        str(loc_a.get("archetype", "")).lower() == str(loc_b.get("archetype", "")).lower()
        and str(loc_a.get("ceilingType", "")).lower() == str(loc_b.get("ceilingType", "")).lower()
        and str(mats_a.get("wall", "")).lower() == str(mats_b.get("wall", "")).lower()
        and str(mats_a.get("floor", "")).lower() == str(mats_b.get("floor", "")).lower()
    )
    if same_core:
        return (
            f"exact architectural/material duplicate (archetype={loc_a.get('archetype')}, "
            f"ceilingType={loc_a.get('ceilingType')}, wall={mats_a.get('wall')}, floor={mats_a.get('floor')})"
        )

    fa, fb = loc_feature_set(loc_a), loc_feature_set(loc_b)
    union = fa | fb
    overlap = len(fa & fb) / max(1, len(union))
    if overlap >= 0.60:
        return f"feature overlap {overlap * 100:.0f}% >= 60% across archetype/materials/heroProps"
    return None


def entity_signature(bp: dict) -> dict:
    """Extract normalized story-driven visual signature of a horror entity blueprint for Anti-Clone checks."""
    ap = bp.get("appearance") or {}
    ent = ap.get("entity") or {}
    bh = ent.get("bodyHorror") or {}
    active_bh = sorted(
        k
        for k, v in bh.items()
        if (isinstance(v, bool) and v) or (isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0) or (isinstance(v, str) and v)
    )
    return {
        "hairStyle": str(ap.get("hairStyle", "shortParted")).strip().lower(),
        "garment": str(ap.get("garment", "shirt")).strip().lower(),
        "eyeHorror": str(bh.get("eyeHorror", "")).strip().lower(),
        "mattedLongHair": bool(bh.get("mattedLongHair")),
        "suturesAndWounds": bool(bh.get("suturesAndWounds")),
        "extraArms": int(bh.get("extraArms") or 0),
        "traits": active_bh,
    }


def check_entity_similarity(bp_a: dict, bp_b: dict):
    """Return an ANTI_REPEAT_ENTITY_ERROR reason if two unrelated entities clone the same anatomy/outfit signature."""
    if bp_a.get("role") != "entity" or bp_b.get("role") != "entity":
        return None
    sa, sb = entity_signature(bp_a), entity_signature(bp_b)
    if (
        sa["hairStyle"] == sb["hairStyle"]
        and sa["garment"] == sb["garment"]
        and sa["eyeHorror"] == sb["eyeHorror"]
        and sa["mattedLongHair"] == sb["mattedLongHair"]
        and sa["suturesAndWounds"] == sb["suturesAndWounds"]
        and sa["extraArms"] == sb["extraArms"]
        and sa["traits"] == sb["traits"]
    ):
        return (
            f"exact entity appearance clone (garment={sa['garment']}, hair={sa['hairStyle']}, "
            f"mattedLongHair={sa['mattedLongHair']}, sutures={sa['suturesAndWounds']}, extraArms={sa['extraArms']})"
        )
    return None


def main():
    ap = argparse.ArgumentParser(description="Validate Horror Engine v3 SceneManifest, script sync, and anti-repetition.")
    ap.add_argument("manifest", help="Path to manifest.json")
    ap.add_argument("--script", help="Optional SCRIPT.md to verify spokenLine fidelity")
    ap.add_argument("--words", help="Optional words.json to verify spokenLine timing alignment (+-0.35s)")
    ap.add_argument("--cues", help="Optional cues.json to cross-check beat audioCueIds & jumpscare timing (+-0.30s)")
    ap.add_argument("--registry", help="Optional LOCATION_REGISTRY.json for cross-video anti-repetition check")
    ap.add_argument("--update-registry", action="store_true", help="Register validated locations into --registry on pass")
    ap.add_argument("--still-out", help="Output path for generated still_manifest.json")
    args = ap.parse_args()

    with open(args.manifest, encoding="utf-8") as fp:
        manifest = json.load(fp)

    errors = []
    project_id = str(manifest.get("projectId", "")).strip()
    total_frames = manifest.get("totalFrames")
    if not project_id:
        errors.append("Manifest missing non-empty `projectId`")
    if not isinstance(total_frames, int) or total_frames <= 0:
        errors.append(f"Manifest `totalFrames` must be positive int, got {total_frames!r}")
        total_frames = 0

    # 1. Validate LocationBlueprints & intra-project anti-repetition
    locations = manifest.get("locations") or []
    loc_map = {}
    if not locations:
        errors.append("Manifest must declare at least 1 LocationBlueprint in `locations`")

    for loc in locations:
        lid = str(loc.get("id", "")).strip()
        if not lid:
            errors.append("LocationBlueprint missing `id`")
            continue
        if lid in loc_map:
            errors.append(f"Duplicate location id '{lid}'")
        loc_map[lid] = loc

        if not str(loc.get("archetype", "")).strip():
            errors.append(f"Location '{lid}' missing `archetype`")
        if loc.get("ceilingType") not in VALID_CEILINGS:
            errors.append(f"Location '{lid}' invalid ceilingType={loc.get('ceilingType')!r} (allowed: {sorted(VALID_CEILINGS)})")
        dims = loc.get("dimensions")
        if not isinstance(dims, list) or len(dims) != 3 or any(not isinstance(v, (int, float)) or v <= 0 for v in dims):
            errors.append(f"Location '{lid}' requires positive 3-number `dimensions` [w, d, h]")
        mats = loc.get("materials") or {}
        for mk in ("wall", "floor", "ceiling"):
            if not str(mats.get(mk, "")).strip():
                errors.append(f"Location '{lid}' missing materials.{mk}")
        props = loc.get("heroProps") or []
        if len(props) < 3:
            errors.append(f"Location '{lid}' must declare >= 3 story-unique `heroProps` (got {len(props)})")

        # v8.0 Spatial Bounds Gate: verify declared location.anchors lie within room physical bounds
        anchors = loc.get("anchors")
        if isinstance(anchors, dict) and isinstance(dims, list) and len(dims) == 3:
            rw, rd, rh = float(dims[0]), float(dims[1]), float(dims[2])
            for aname, apos in anchors.items():
                if not (isinstance(apos, list) and len(apos) == 3 and all(isinstance(v, (int, float)) for v in apos)):
                    errors.append(f"Location '{lid}' anchor '{aname}' must be 3-number [x, y, z], got {apos!r}")
                    continue
                ax, ay, az = float(apos[0]), float(apos[1]), float(apos[2])
                if abs(ax) > rw * 0.5 + 2.5 or not (-1.0 <= ay <= rh + 1.0) or abs(az) > rd * 0.5 + 5.0:
                    errors.append(
                        f"OUT_OF_BOUNDS_ERROR: Location '{lid}' anchor '{aname}' pos={apos} lies outside room dimensions {dims}"
                    )

    # Intra-project unrelated location anti-repetition check
    loc_list = list(loc_map.values())
    for i in range(len(loc_list)):
        for j in range(i + 1, len(loc_list)):
            la, lb = loc_list[i], loc_list[j]
            ref_a, ref_b = la.get("sameLocationOf"), lb.get("sameLocationOf")
            # Only skip intra-project pair if one explicitly declares revisit of the other
            if ref_a in (lb["id"], f"{project_id}:{lb['id']}") or ref_b in (la["id"], f"{project_id}:{la['id']}"):
                continue
            reason = check_location_similarity(la, lb)
            if reason:
                errors.append(f"ANTI_REPEAT_ERROR: unrelated locations '{la['id']}' and '{lb['id']}' in project '{project_id}' repeat background ({reason})")

    # Cross-video anti-repetition check against LOCATION_REGISTRY.json (backward-compatible with entity records!)
    registry = []
    if args.registry and os.path.isfile(args.registry):
        with open(args.registry, encoding="utf-8") as fp:
            registry = json.load(fp)
    loc_registry = [r for r in registry if r.get("entryType") != "entity"]
    ent_registry = [r for r in registry if r.get("entryType") == "entity"]

    for loc in loc_list:
        same_ref = loc.get("sameLocationOf")
        if same_ref:
            # Never allow self-referencing bypass of anti-repetition gate
            if same_ref in (loc["id"], f"{project_id}:{loc['id']}"):
                errors.append(f"ANTI_REPEAT_ERROR: location '{loc['id']}' cannot reference itself in sameLocationOf='{same_ref}'")
                continue
            known_refs = {f"{r.get('projectId')}:{r.get('id')}" for r in loc_registry} | (set(loc_map.keys()) - {loc["id"]})
            if args.registry and same_ref not in known_refs:
                errors.append(f"Location '{loc['id']}' has sameLocationOf='{same_ref}' not found in registry")
            continue
        for prev in loc_registry:
            if prev.get("projectId") == project_id and prev.get("id") == loc.get("id"):
                continue
            reason = check_location_similarity(loc, prev)
            if reason:
                errors.append(
                    f"ANTI_REPEAT_ERROR: project '{project_id}' location '{loc['id']}' repeats unrelated "
                    f"'{prev.get('projectId')}:{prev.get('id')}' ({reason}). Build a distinct environment or declare `sameLocationOf` if genuinely the same place."
                )

    # 1b. Validate story-driven castBlueprints & Anti-Clone Entity Gate (v5.0)
    cast_blueprints = manifest.get("castBlueprints") or []
    cast_bp_map = {}
    for bp in cast_blueprints:
        cid = str(bp.get("id", "")).strip()
        if not cid:
            errors.append("CharacterBlueprint missing `id`")
            continue
        if cid in cast_bp_map:
            errors.append(f"Duplicate castBlueprint id '{cid}'")
        cast_bp_map[cid] = bp

        role = bp.get("role")
        if role not in VALID_ROLES:
            errors.append(f"CharacterBlueprint '{cid}' invalid role={role!r} (allowed: {sorted(VALID_ROLES)})")
        if not str(bp.get("storyDescription", "")).strip():
            errors.append(f"CharacterBlueprint '{cid}' missing non-empty `storyDescription` justifying its appearance")
        ap = bp.get("appearance") or {}
        if ap.get("hairStyle") is not None and ap.get("hairStyle") not in VALID_HAIR_STYLES:
            errors.append(f"CharacterBlueprint '{cid}' invalid hairStyle={ap.get('hairStyle')!r}")
        if ap.get("garment") is not None and ap.get("garment") not in VALID_GARMENTS:
            errors.append(f"CharacterBlueprint '{cid}' invalid garment={ap.get('garment')!r}")
        bh = (ap.get("entity") or {}).get("bodyHorror") or {}
        if bh.get("eyeHorror") is not None and bh.get("eyeHorror") not in VALID_EYE_HORROR:
            errors.append(f"CharacterBlueprint '{cid}' invalid eyeHorror={bh.get('eyeHorror')!r}")

    # Intra-project unrelated entity anti-clone check
    bp_list = list(cast_bp_map.values())
    for i in range(len(bp_list)):
        for j in range(i + 1, len(bp_list)):
            ba, bb = bp_list[i], bp_list[j]
            ref_a, ref_b = ba.get("sameCharacterOf"), bb.get("sameCharacterOf")
            if ref_a in (bb["id"], f"{project_id}:{bb['id']}") or ref_b in (ba["id"], f"{project_id}:{ba['id']}"):
                continue
            reason = check_entity_similarity(ba, bb)
            if reason:
                errors.append(
                    f"ANTI_REPEAT_ENTITY_ERROR: unrelated entities '{ba['id']}' and '{bb['id']}' in project '{project_id}' "
                    f"share identical appearance ({reason}). Customize each villain to match its storyDescription!"
                )

    # Cross-video entity anti-clone check
    for bp in bp_list:
        if bp.get("role") != "entity":
            continue
        same_c = bp.get("sameCharacterOf")
        if same_c:
            if same_c in (bp["id"], f"{project_id}:{bp['id']}"):
                errors.append(f"ANTI_REPEAT_ENTITY_ERROR: entity '{bp['id']}' cannot reference itself in sameCharacterOf='{same_c}'")
            continue
        for prev in ent_registry:
            if prev.get("projectId") == project_id and prev.get("id") == bp.get("id"):
                continue
            reason = check_entity_similarity(bp, prev)
            if reason:
                errors.append(
                    f"ANTI_REPEAT_ENTITY_ERROR: project '{project_id}' entity '{bp['id']}' clones unrelated "
                    f"'{prev.get('projectId')}:{prev.get('id')}' ({reason}). Customize appearance to storyDescription or declare `sameCharacterOf`."
                )

    # 2. Validate beats timeline contiguity, lightState, castStates, propStates & script sync
    beats = manifest.get("beats") or []
    if not beats:
        errors.append("Manifest must declare at least 1 ScriptBeat in `beats`")

    script_norm = None
    if args.script:
        with open(args.script, encoding="utf-8") as fp:
            script_norm = norm_text(fp.read())
        if not script_norm:
            errors.append(f"SCRIPT.md '{args.script}' is empty")

    words_data = []
    if args.words:
        with open(args.words, encoding="utf-8") as fp:
            raw_w = json.load(fp)
            words_data = raw_w if isinstance(raw_w, list) else raw_w.get("words", [])
    norm_words = [
        (
            norm_text(str(w.get("w", w.get("word", "")))),
            float(w.get("s", w.get("start", 0))),
            float(w.get("e", w.get("end", 0))),
        )
        for w in words_data
    ]

    sorted_beats = sorted(beats, key=lambda b: b.get("a", 0))
    cursor = 0
    word_cursor = 0
    still_entries = []
    actor_prev_state = {}  # cid -> (locationId, endAnchor, visible, beatId)
    prop_prev_state = {}   # (locationId, pid) -> (state, beatId)
    cues_events_by_id = {}
    cues_raw = None
    if args.cues:
        with open(args.cues, encoding="utf-8") as fp:
            cues_raw = json.load(fp)
        for ev in cues_raw.get("events") or []:
            if ev.get("id"):
                cues_events_by_id[str(ev["id"])] = ev

    for b in sorted_beats:
        bid = str(b.get("beatId", "?"))
        a, bb, pk = b.get("a"), b.get("b"), b.get("peakFrame")
        if not isinstance(a, int) or not isinstance(bb, int) or a >= bb:
            errors.append(f"Beat '{bid}' has invalid frame range [{a}, {bb})")
            continue
        if a > cursor:
            errors.append(f"Timeline gap detected before beat '{bid}': missing frames [{cursor}, {a})")
        elif a < cursor:
            errors.append(f"Timeline overlap detected at beat '{bid}': starts at {a} < previous end {cursor}")
        cursor = max(cursor, bb)

        if not isinstance(pk, int) or not (a <= pk < bb):
            errors.append(f"Beat '{bid}' peakFrame={pk} outside [{a}, {bb})")

        lid = b.get("locationId")
        if lid not in loc_map:
            errors.append(f"Beat '{bid}' references undeclared locationId={lid!r}")

        ls = b.get("lightState") or {}
        preset = ls.get("preset")
        if preset not in VALID_LIGHTS:
            errors.append(f"Beat '{bid}' invalid lightState.preset={preset!r} (allowed v3 lights: {sorted(VALID_LIGHTS)})")
        if ls.get("blendTo") and ls.get("blendTo") not in VALID_LIGHTS:
            errors.append(f"Beat '{bid}' invalid lightState.blendTo={ls.get('blendTo')!r}")
        br = ls.get("blendRange")
        if br is not None:
            if not (isinstance(br, list) and len(br) == 2 and all(isinstance(v, int) for v in br) and a <= br[0] < br[1] <= bb):
                errors.append(f"Beat '{bid}' invalid lightState.blendRange={br!r} (must satisfy {a} <= f0 < f1 <= {bb})")

        loc_obj = loc_map.get(lid) or {}
        loc_anchors = loc_obj.get("anchors") if isinstance(loc_obj.get("anchors"), dict) else None

        # v8.0 Camera anchor check when location declares anchors
        cam_spec = b.get("camera")
        if isinstance(cam_spec, dict) and loc_anchors is not None:
            for ck in ("posAnchor", "lookAnchor"):
                aval = str(cam_spec.get(ck, "")).strip()
                if aval and aval not in loc_anchors and aval not in cast_bp_map:
                    errors.append(
                        f"ANCHOR_UNDECLARED_ERROR: Beat '{bid}' camera.{ck}='{aval}' not found in location '{lid}'.anchors"
                    )

        for cid, cst in (b.get("castStates") or {}).items():
            if not isinstance(cst, dict):
                continue
            if cast_bp_map and cid not in cast_bp_map:
                errors.append(f"Beat '{bid}' references cast '{cid}' missing from `castBlueprints`")
            pose = cst.get("pose")
            if pose is not None and pose not in VALID_POSES:
                errors.append(f"Beat '{bid}' cast '{cid}' invalid pose={pose!r}")
            pose_to = cst.get("poseTo")
            if pose_to is not None and pose_to not in VALID_POSES:
                errors.append(f"Beat '{bid}' cast '{cid}' invalid poseTo={pose_to!r}")
            expr = cst.get("expr")
            if expr is not None and expr not in VALID_EXPRS:
                errors.append(f"Beat '{bid}' cast '{cid}' invalid expr={expr!r}")

            # v8.0 Anchor resolution & Spatial Anti-Teleport Continuity Gate
            a_base = str(cst.get("anchor") or "").strip()
            a_from = str(cst.get("moveFromAnchor") or a_base).strip()
            a_to = str(cst.get("moveToAnchor") or a_from).strip()
            if loc_anchors is not None:
                for ak, aval in (("anchor", a_base), ("moveFromAnchor", cst.get("moveFromAnchor")), ("moveToAnchor", cst.get("moveToAnchor"))):
                    if aval and str(aval).strip() not in loc_anchors:
                        errors.append(
                            f"ANCHOR_UNDECLARED_ERROR: Beat '{bid}' cast '{cid}' {ak}='{aval}' not found in location '{lid}'.anchors"
                        )
            vis = bool(cst.get("visible", False))
            prev_c = actor_prev_state.get(cid)
            if (
                vis
                and prev_c is not None
                and prev_c[2]
                and prev_c[0] == lid
                and a_from
                and prev_c[1]
                and a_from != prev_c[1]
                and not cst.get("allowTeleport")
            ):
                errors.append(
                    f"SPATIAL_TELEPORT_ERROR: Beat '{bid}' cast '{cid}' teleports from '{prev_c[1]}' (beat '{prev_c[3]}') to '{a_from}' in same location '{lid}' without `allowTeleport: true`"
                )
            actor_prev_state[cid] = (lid, a_to or a_base, vis, bid)

        if not str(b.get("cameraIntent", "")).strip():
            errors.append(f"Beat '{bid}' missing non-empty `cameraIntent` for Still Gate audit")

        # Phone3D <-> HUD notification clock consistency + v8.0 Prop State Machine Continuity Gate
        props = b.get("propStates") or {}
        for pid_prop, pst in props.items():
            if not isinstance(pst, dict):
                continue
            cur_st = str(pst.get("state") or "").strip()
            req_from = str(pst.get("fromState") or "").strip()
            prev_p = prop_prev_state.get((lid, pid_prop))
            if req_from and prev_p is not None and prev_p[0] and req_from != prev_p[0]:
                errors.append(
                    f"PROP_STATE_REGRESSION_ERROR: Beat '{bid}' prop '{pid_prop}' expects fromState='{req_from}' but previous beat '{prev_p[1]}' ended in state='{prev_p[0]}'"
                )
            if cur_st:
                prop_prev_state[(lid, pid_prop)] = (cur_st, bid)

        # v8.0 Optional cues.json audioCueIds cross-check
        if cues_raw is not None:
            for qid in b.get("audioCueIds") or []:
                if str(qid) not in cues_events_by_id:
                    errors.append(f"AUDIO_CUES_SYNC_ERROR: Beat '{bid}' references audioCueId='{qid}' not found in cues.json events")
                else:
                    ev_c = cues_events_by_id[str(qid)]
                    if "at" in ev_c and ev_c["at"] is not None:
                        ev_t = float(ev_c["at"]) + float(ev_c.get("offset_s", 0.0))
                        if not ((a / FPS) - 0.30 <= ev_t <= (bb / FPS) + 0.30):
                            errors.append(
                                f"AUDIO_CUES_SYNC_ERROR: Beat '{bid}' [{a/FPS:.2f}..{bb/FPS:.2f}s] audioCueId='{qid}' lands at {ev_t:.2f}s outside beat window (+-0.30s)"
                            )
        phone = props.get("phone")
        if isinstance(phone, dict) and phone.get("visible"):
            det = phone.get("detail") or {}
            clk = det.get("clock")
            ntime = det.get("notifTime")
            if clk and ntime and str(clk).strip() != str(ntime).strip():
                errors.append(f"Beat '{bid}' phone clock mismatch: Phone3D clock='{clk}' != notifTime='{ntime}'")

        # SCRIPT.md + words.json fidelity check (monotonic cursor supports repeated dialogue motifs!)
        sl = b.get("spokenLine")
        if isinstance(sl, dict) and str(sl.get("text", "")).strip():
            line_txt = str(sl["text"]).strip()
            line_norm = norm_text(line_txt)
            if script_norm is not None and line_norm not in script_norm:
                errors.append(f"Beat '{bid}' spokenLine not found in SCRIPT.md: {line_txt!r}")
            if norm_words:
                toks = [t for t in line_norm.split() if t]
                if toks:
                    beat_start_s = a / FPS
                    beat_end_s = bb / FPS
                    matches = []
                    for idx in range(word_cursor, len(norm_words) - len(toks) + 1):
                        if all(norm_words[idx + k][0] == toks[k] for k in range(len(toks))):
                            matches.append((idx, norm_words[idx][1], norm_words[idx + len(toks) - 1][2]))
                    if not matches:
                        # Fallback full scan if beat ordering differs from transcript
                        for idx in range(0, min(word_cursor, len(norm_words) - len(toks) + 1)):
                            if all(norm_words[idx + k][0] == toks[k] for k in range(len(toks))):
                                matches.append((idx, norm_words[idx][1], norm_words[idx + len(toks) - 1][2]))
                    if not matches:
                        errors.append(f"Beat '{bid}' spokenLine tokens not found in words.json: {line_txt!r}")
                    else:
                        best_idx, matched_start, matched_end = min(matches, key=lambda m: abs(m[1] - beat_start_s))
                        if best_idx >= word_cursor:
                            word_cursor = best_idx + len(toks)
                        max_start_drift = 0.60 if a == 0 else 0.35
                        if abs(matched_start - beat_start_s) > max_start_drift:
                            errors.append(
                                f"Beat '{bid}' timing drift: beat starts at {beat_start_s:.2f}s vs words.json {matched_start:.2f}s (> {max_start_drift:.2f}s)"
                            )
                        if matched_end > beat_end_s + 0.35:
                            errors.append(
                                f"Beat '{bid}' timing overrun: spoken line ends at {matched_end:.2f}s > beat end {beat_end_s:.2f}s (+0.35s)"
                            )

        still_entries.append(
            {
                "beatId": bid,
                "shotId": b.get("shotId"),
                "peakFrame": pk,
                "range": [a, bb],
                "locationId": lid,
                "cameraIntent": b.get("cameraIntent", ""),
                "spokenLine": sl,
                "lightState": ls,
                "castStates": b.get("castStates") or {},
                "propStates": props,
            }
        )

    # 2b. v10.0 Subtitle Wall-of-Text Gate (captionChunks must stay compact 4-11 words / 1-2 short lines!)
    caption_chunks = manifest.get("captionChunks")
    if isinstance(caption_chunks, list):
        for ci, cc in enumerate(caption_chunks):
            txt_c = str(cc.get("text", "")).strip()
            w_cnt = len(txt_c.split())
            if w_cnt > 12:
                errors.append(
                    f"WALL_OF_TEXT_ERROR: captionChunks[{ci}] has {w_cnt} words (>12): {txt_c!r}. Re-run align_manifest.py to split into 4-8 word cinema subtitles."
                )

    if total_frames and cursor < total_frames:
        errors.append(f"Timeline gap at end of manifest: beats end at {cursor} < totalFrames {total_frames}")
    elif total_frames and cursor > total_frames:
        errors.append(f"Timeline overflow: beats end at {cursor} > totalFrames {total_frames}")

    if errors:
        print("MANIFEST VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    if args.still_out:
        out_dir = os.path.dirname(args.still_out)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(args.still_out, "w", encoding="utf-8") as fp:
            json.dump(still_entries, fp, ensure_ascii=False, indent=2)

    if args.registry and args.update_registry:
        kept = [r for r in registry if r.get("projectId") != project_id]
        for loc in loc_list:
            if not loc.get("sameLocationOf"):
                kept.append({**loc, "projectId": project_id})
        for bp in bp_list:
            if bp.get("role") == "entity" and not bp.get("sameCharacterOf"):
                kept.append({**bp, "entryType": "entity", "projectId": project_id})
        reg_dir = os.path.dirname(args.registry)
        if reg_dir:
            os.makedirs(reg_dir, exist_ok=True)
        with open(args.registry, "w", encoding="utf-8") as fp:
            json.dump(kept, fp, ensure_ascii=False, indent=2)

    print(
        f"PASS: manifest '{project_id}' validated ({len(locations)} locations, {len(still_entries)} beats, {total_frames} frames)"
    )


if __name__ == "__main__":
    main()
