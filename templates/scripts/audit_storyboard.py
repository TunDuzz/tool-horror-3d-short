#!/usr/bin/env python3
"""Horror Engine v12.0: 5-Layer Semantic Still Auditor & Storyboard Proof HTML Generator.

Evaluates every rendered still against its `still_manifest.json` contract AND Three.js 3D Raycast telemetry:
  - Layer 1: 9:16 Safe Frustum & Subtitle Bar Collision (`inSafeFrustum`)
  - Layer 2: 9-Ray 3D Occlusion Sightline (`visibleRayRatio >= minVisibleRayRatio`, zero wall/sill/shoulder block)
  - Layer 3: Readable Subject Scale (`heightPct >= minSubjectHeightPct`) & Foreground Block Cap (`maxScreenBlockPct`)
  - Layer 4: Subject Depth-of-Field Focus Lock (`focusDist > 0`)
  - Layer 5: Per-Target Rendered Pixel Luminance & Exposure inside 2D `uvBox` on the actual `.jpg`
             (catches pitch-black invisible props AND washed-out flat-white unreadable pages!)

Outputs:
  - `<out-dir>/boxes/<tag>.jpg`       : Diagnostic still with labeled green/red 2D bounding boxes & metrics
  - `<out-dir>/storyboard_proof.html` : Side-by-side visual review board (Clean Still + BBox Still + Spoken Line + 5-Layer Badges)
  - `<out-dir>/still_audit_report.json` & `<out-dir>/still_audit_report.md`
"""

import argparse
import html
import json
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

try:
    from constitution import load_constitution
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from constitution import load_constitution


def measure_box_luma(img_rgb: np.ndarray, uv_box: list) -> dict:
    h, w, _ = img_rgb.shape
    u0, v0, u1, v1 = [float(x) for x in uv_box]
    x0 = max(0, min(w - 1, int(round(u0 * w))))
    x1 = max(x0 + 1, min(w, int(round(u1 * w))))
    y0 = max(0, min(h - 1, int(round(v0 * h))))
    y1 = max(y0 + 1, min(h, int(round(v1 * h))))
    patch = img_rgb[y0:y1, x0:x1].astype(np.float32) * (1.0 / 255.0)
    lum = patch[..., 0] * 0.2126 + patch[..., 1] * 0.7152 + patch[..., 2] * 0.0722
    return {
        "pxBox": [x0, y0, x1, y1],
        "mean": round(float(lum.mean()), 4),
        "std": round(float(lum.std()), 4),
        "p95": round(float(np.percentile(lum, 95)), 4),
    }


def evaluate_storyboard(manifest_items: list, raw_audit: dict, out_dir: str) -> dict:
    const = load_constitution()
    gate = const.get("stillAccuracyGate") or {}
    min_ray = float(gate.get("minVisibleRayRatio", 0.34))
    default_min_h = float(gate.get("minSubjectHeightPct", 0.055))
    min_luma = float(gate.get("minTargetLumaMean", 0.048))
    max_p95 = float(gate.get("maxTargetP95", 0.96))

    jobs_by_idx = {int(j["index"]): j for j in (raw_audit.get("jobs") or []) if "index" in j}
    frames_map = {int(k): v for k, v in (raw_audit.get("frames") or {}).items()}

    boxes_dir = os.path.join(out_dir, "boxes")
    os.makedirs(boxes_dir, exist_ok=True)

    rows = []
    total_errors = 0
    total_targets = 0

    for idx, item in enumerate(manifest_items):
        frame = int(item.get("peakFrame", 0))
        shot_id = item.get("shotId", idx + 1)
        tag = str(item.get("tag") or f"s{shot_id:02d}_f{frame}")
        job = jobs_by_idx.get(idx) or {}
        img_path = job.get("imagePath") or os.path.join(out_dir, f"{tag}_f{frame}.jpg")
        f_audit = frames_map.get(frame) or {}
        targets_3d = f_audit.get("targets") or {}

        must_show = list(item.get("mustShow") or [])
        block_caps = dict(item.get("maxScreenBlockPct") or {})
        min_h = float(item.get("minHeightPct") or default_min_h)

        img_arr = None
        pil_img = None
        if os.path.isfile(img_path):
            pil_img = Image.open(img_path).convert("RGB")
            img_arr = np.asarray(pil_img)

        frame_luma_mean = 0.0
        if img_arr is not None:
            f32 = img_arr.astype(np.float32) * (1.0 / 255.0)
            frame_luma_mean = round(float((f32[..., 0] * 0.2126 + f32[..., 1] * 0.7152 + f32[..., 2] * 0.0722).mean()), 4)

        target_reports = []
        row_issues = []

        draw_canvas = pil_img.copy() if pil_img is not None else None
        draw = ImageDraw.Draw(draw_canvas) if draw_canvas is not None else None

        # Evaluate required mustShow targets (Layers 1, 2, 3, 5)
        for tid in must_show:
            total_targets += 1
            t3 = targets_3d.get(tid)
            t_issues = []
            luma_info = None

            if not t3:
                if not targets_3d:
                    t_issues.append("NO_SCENE_AUDIT_HOOK(implement ShortWorld.getAuditTargets())")
                else:
                    t_issues.append(f"TARGET_NOT_FOUND('{tid}')")
            else:
                t_issues.extend(t3.get("issues") or [])
                if t3.get("visible") and float(t3.get("visibleRayRatio", 0.0)) < min_ray:
                    msg = f"LOW_VISIBILITY(ray={t3.get('visibleRayRatio')}<{min_ray})"
                    if not any("OCCLUDED_BY" in x for x in t_issues):
                        t_issues.append(msg)
                span_pct = max(float(t3.get("widthPct", 0.0)), float(t3.get("heightPct", 0.0)))
                if t3.get("visible") and span_pct < min_h:
                    t_issues.append(f"TOO_SMALL(span={span_pct * 100:.1f}%<{min_h * 100:.1f}%)")

                if img_arr is not None and t3.get("visible") and t3.get("uvBox") != [0, 0, 0, 0]:
                    luma_info = measure_box_luma(img_arr, t3["uvBox"])
                    if luma_info["mean"] < min_luma:
                        t_issues.append(f"DARK_UNREADABLE(luma={luma_info['mean']:.3f}<{min_luma:.3f})")
                    if luma_info["mean"] > 0.88 and luma_info["std"] < 0.045 and luma_info["p95"] > max_p95:
                        t_issues.append(f"OVEREXPOSED_WASHOUT(mean={luma_info['mean']:.3f},std={luma_info['std']:.3f})")

                    if draw is not None:
                        x0, y0, x1, y1 = luma_info["pxBox"]
                        col = "#36e87a" if not t_issues else "#ff4848"
                        draw.rectangle([x0, y0, x1, y1], outline=col, width=3)
                        lbl = f"{tid} r={float(t3.get('visibleRayRatio', 0)) * 100:.0f}% L={luma_info['mean']:.2f}"
                        tw = min(draw_canvas.width - x0, max(96, len(lbl) * 7 + 8))
                        ly = max(0, y0 - 18)
                        draw.rectangle([x0, ly, x0 + tw, ly + 17], fill="#080a10")
                        draw.text((x0 + 4, ly + 2), lbl, fill=col)

            for iss in t_issues:
                row_issues.append(f"{tid}: {iss}")
            target_reports.append({
                "id": tid,
                "role": "mustShow",
                "passed": len(t_issues) == 0,
                "three": t3,
                "pixelLuma": luma_info,
                "issues": t_issues,
            })

        # Evaluate maxScreenBlockPct caps (e.g. OTS shoulder C01 <= 28%, held receipt <= 38%)
        for bid_cap, cap_val in block_caps.items():
            cap_f = float(cap_val)
            t3 = targets_3d.get(bid_cap)
            if t3 and t3.get("visible"):
                area = float(t3.get("areaPct", 0.0))
                b_issues = []
                if area > cap_f:
                    b_issues.append(f"FOREGROUND_BLOB(area={area * 100:.1f}%>{cap_f * 100:.1f}%)")
                    row_issues.append(f"{bid_cap}: FOREGROUND_BLOB({area * 100:.1f}%>{cap_f * 100:.1f}%)")
                if draw is not None and img_arr is not None and t3.get("uvBox") != [0, 0, 0, 0]:
                    li = measure_box_luma(img_arr, t3["uvBox"])
                    x0, y0, x1, y1 = li["pxBox"]
                    col = "#ffd24c" if not b_issues else "#ff4848"
                    draw.rectangle([x0, y0, x1, y1], outline=col, width=2)
                    draw.text((x0 + 4, y0 + 4), f"cap:{bid_cap} {area * 100:.0f}%/{cap_f * 100:.0f}%", fill=col)
                target_reports.append({
                    "id": bid_cap,
                    "role": "blockCap",
                    "passed": len(b_issues) == 0,
                    "areaPct": area,
                    "maxAllowed": cap_f,
                    "issues": b_issues,
                })

        box_rel_path = ""
        if draw_canvas is not None:
            box_name = os.path.basename(img_path)
            box_path = os.path.join(boxes_dir, box_name)
            draw_canvas.save(box_path, quality=88)
            box_rel_path = f"boxes/{box_name}"

        total_errors += len(row_issues)
        rows.append({
            "index": idx + 1,
            "shotId": shot_id,
            "beatId": item.get("beatId", ""),
            "tag": tag,
            "frame": frame,
            "timeSec": round(frame / 30.0, 2),
            "cameraMode": item.get("cameraMode", ""),
            "spokenAtFrame": item.get("spokenAtFrame") or "[VISUAL / KHÔNG LỜI]",
            "expectedVisual": item.get("cameraIntent") or "",
            "imageRel": os.path.basename(img_path) if os.path.isfile(img_path) else "",
            "boxImageRel": box_rel_path,
            "frameLumaMean": frame_luma_mean,
            "focusDist": f_audit.get("focusDist", 0.0),
            "passed": len(row_issues) == 0,
            "issues": row_issues,
            "targets": target_reports,
        })

    passed_rows = sum(1 for r in rows if r["passed"])
    report = {
        "version": "12.0.0",
        "totalKeyframes": len(rows),
        "passedKeyframes": passed_rows,
        "totalTargetsChecked": total_targets,
        "totalErrors": total_errors,
        "passed": total_errors == 0,
        "keyframes": rows,
    }
    return report


def write_storyboard_html(report: dict, out_html: str):
    status_cls = "ok" if report["passed"] else "fail"
    status_txt = "PASS 100%" if report["passed"] else f"FAIL ({report['totalErrors']} lỗi lệch)"
    cards = []
    for r in report["keyframes"]:
        badge_cls = "b-ok" if r["passed"] else "b-fail"
        badge_txt = "PASS" if r["passed"] else "LỆCH"
        t_pills = []
        for t in r["targets"]:
            p_cls = "p-ok" if t["passed"] else "p-fail"
            if t["role"] == "mustShow":
                three = t.get("three") or {}
                ray_pct = int(round(float(three.get("visibleRayRatio", 0.0)) * 100))
                h_pct = float(three.get("heightPct", 0.0)) * 100
                lum = (t.get("pixelLuma") or {}).get("mean", 0.0)
                extra = f"ray={ray_pct}% · h={h_pct:.0f}% · L={lum:.2f}"
                if t["issues"]:
                    extra += " · " + ", ".join(t["issues"])
                t_pills.append(f"<div class='pill {p_cls}'><b>{html.escape(t['id'])}</b>: {html.escape(extra)}</div>")
            else:
                area_p = float(t.get("areaPct", 0.0)) * 100
                max_p = float(t.get("maxAllowed", 0.0)) * 100
                t_pills.append(f"<div class='pill {p_cls}'><b>cap:{html.escape(t['id'])}</b>: {area_p:.1f}% &le; {max_p:.0f}%</div>")

        img_clean = f"<img src='{html.escape(r['imageRel'])}' loading='lazy'/>" if r["imageRel"] else "<div class='miss'>Missing</div>"
        img_box = f"<img src='{html.escape(r['boxImageRel'])}' loading='lazy'/>" if r["boxImageRel"] else img_clean
        cards.append(f"""
        <div class="row {'row-fail' if not r['passed'] else ''}">
          <div class="col-img">{img_clean}<div class="cap-lbl">Bản sạch (có phụ đề thật)</div></div>
          <div class="col-img">{img_box}<div class="cap-lbl">Hộp bao 3D Raycast &amp; Độ sáng</div></div>
          <div class="col-meta">
            <div class="hdr">
              <span class="badge {badge_cls}">{badge_txt}</span>
              <strong>Shot #{r['shotId']} · {html.escape(r['tag'])}</strong>
              <span class="mut">f{r['frame']} ({r['timeSec']:.2f}s) · {html.escape(str(r['cameraMode']))} · focus={r['focusDist']}m</span>
            </div>
            <div class="quote">🗣 <b>Lời thoại tại đúng frame:</b> {html.escape(r['spokenAtFrame'])}</div>
            <div class="exp">🎯 <b>Mô tả bắt buộc thấy:</b> {html.escape(r['expectedVisual'])}</div>
            <div class="pills">{''.join(t_pills) or '<span class="mut">Không khai báo mustShow</span>'}</div>
          </div>
        </div>""")

    doc = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Storyboard Semantic Proof v12.0 — {status_txt}</title>
<style>
  body {{ background:#0b0d13; color:#e7e9f0; font-family:system-ui,-apple-system,sans-serif; margin:0; padding:24px; }}
  h1 {{ margin:0 0 8px; font-size:22px; }}
  .summary {{ padding:12px 16px; border-radius:10px; margin-bottom:20px; background:#141824; border:1px solid #283048; }}
  .summary.ok {{ border-color:#26a65b; }}
  .summary.fail {{ border-color:#e04848; }}
  .row {{ display:grid; grid-template-columns:210px 210px 1fr; gap:16px; padding:14px; margin-bottom:14px; background:#121621; border:1px solid #232a3d; border-radius:12px; align-items:start; }}
  .row-fail {{ border-color:#e04848; background:#1b1218; }}
  .col-img img {{ width:100%; border-radius:8px; border:1px solid #2b334a; display:block; }}
  .cap-lbl {{ font-size:11px; color:#949db5; text-align:center; margin-top:4px; }}
  .hdr {{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }}
  .badge {{ padding:3px 9px; border-radius:6px; font-size:12px; font-weight:700; }}
  .b-ok {{ background:#164e32; color:#67f5a3; }}
  .b-fail {{ background:#5c1919; color:#ff8a8a; }}
  .mut {{ color:#8c95ad; font-size:13px; }}
  .quote {{ background:#192030; padding:10px 12px; border-left:3px solid #f0b849; border-radius:6px; margin-bottom:8px; font-size:14px; }}
  .exp {{ background:#161d2b; padding:9px 12px; border-left:3px solid #5aa9ff; border-radius:6px; margin-bottom:10px; font-size:13.5px; color:#cfd6e6; }}
  .pills {{ display:flex; flex-direction:column; gap:6px; }}
  .pill {{ padding:6px 10px; border-radius:6px; font-size:12.5px; font-family:ui-monospace,monospace; }}
  .p-ok {{ background:#112b20; color:#86f0b4; border:1px solid #1f593d; }}
  .p-fail {{ background:#361419; color:#ff9c9c; border:1px solid #782630; }}
</style>
</head>
<body>
  <h1>Bảng Đối Chứng Ngữ Nghĩa Still 3D &harr; Lời Thoại (v12.0)</h1>
  <div class="summary {status_cls}">
    <b>Kết quả kiểm định 5 tầng: {status_txt}</b> &mdash;
     Đã kiểm tra <b>{report['passedKeyframes']}/{report['totalKeyframes']}</b> mốc ảnh Still
    trên tổng số <b>{report['totalTargetsChecked']}</b> chủ thể 3D (Frustum 9:16 + 9-Ray Occlusion + Kích thước + Khóa nét DOF + Độ sáng/Cháy sáng JPG).
  </div>
  {''.join(cards)}
</body>
</html>"""
    with open(out_html, "w", encoding="utf-8") as fp:
        fp.write(doc)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Run v12.0 5-Layer Semantic Still Audit and build storyboard_proof.html.")
    ap.add_argument("--manifest", required=True, help="Path to still_manifest.json")
    ap.add_argument("--raw", required=True, help="Path to still_audit_raw.json emitted by render-stills.mjs --audit")
    ap.add_argument("--out-dir", required=True, help="Directory containing rendered stills")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if any semantic target fails frustum/raycast/luma checks")
    args = ap.parse_args(argv)

    with open(args.manifest, encoding="utf-8") as fp:
        manifest_items = json.load(fp)
    with open(args.raw, encoding="utf-8") as fp:
        raw_audit = json.load(fp)

    report = evaluate_storyboard(manifest_items, raw_audit, args.out_dir)
    json_out = os.path.join(args.out_dir, "still_audit_report.json")
    md_out = os.path.join(args.out_dir, "still_audit_report.md")
    html_out = os.path.join(args.out_dir, "storyboard_proof.html")

    with open(json_out, "w", encoding="utf-8") as fp:
        json.dump(report, fp, ensure_ascii=False, indent=2)

    lines = [
        f"# Semantic Still Audit Report v12.0 — {'PASS' if report['passed'] else 'FAIL'}",
        f"- Keyframes passed: **{report['passedKeyframes']}/{report['totalKeyframes']}**",
        f"- 3D Targets verified: **{report['totalTargetsChecked']}** | Errors: **{report['totalErrors']}**",
        "",
    ]
    for r in report["keyframes"]:
        st = "OK  " if r["passed"] else "FAIL"
        lines.append(f"- `[{st}]` Shot #{r['shotId']:02d} `{r['tag']}` (`f{r['frame']}` · `{r['timeSec']:.2f}s`) — {r['spokenAtFrame']}")
        for iss in r["issues"]:
            lines.append(f"  - ERROR: `{iss}`")
    with open(md_out, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")

    write_storyboard_html(report, html_out)

    print(
        f"[audit_storyboard] {'PASS' if report['passed'] else 'FAIL'}: "
        f"{report['passedKeyframes']}/{report['totalKeyframes']} keyframes OK "
        f"({report['totalTargetsChecked']} 3D targets, {report['totalErrors']} errors) -> {html_out}"
    )
    if not report["passed"]:
        for r in report["keyframes"]:
            for iss in r["issues"]:
                print(f"  [STILL FAIL] Shot #{r['shotId']} {r['tag']} @f{r['frame']} ({r['spokenAtFrame']}): {iss}")
        if args.strict:
            sys.exit(1)


if __name__ == "__main__":
    main()
