# Extract shots.json (shot frame ranges, crossfades, flashes, planned cuts, impact kicks) from any project's story.ts.
# Usage: python scripts/extract_shots.py <path/to/story.ts> <out/shots.json>
import ast
import json
import operator
import os
import re
import sys

if len(sys.argv) < 3:
    print("Usage: python scripts/extract_shots.py <path/to/story.ts> <out/shots.json>", file=sys.stderr)
    sys.exit(1)

story_path, out_path = sys.argv[1], sys.argv[2]
src = open(story_path, encoding="utf-8").read()

consts = {"FPS": 30.0}
for stmt in re.findall(r"(?:^|\n)\s*(?:export\s+)?const\s+[^;{]+;", src):
    for k, v in re.findall(r"\b([A-Za-z_]\w*)\s*(?::\s*number\s*)?=\s*(-?\d+(?:\.\d+)?)\b", stmt):
        consts[k] = float(v)
fps = int(consts.get("FPS", 30))
total_val = int(consts["TOTAL"]) if "TOTAL" in consts else None

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.USub: operator.neg, ast.UAdd: operator.pos}


def eval_expr(expr, consts_map):
    def _ev(node):
        if isinstance(node, ast.Expression):
            return _ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name) and node.id in consts_map:
            return float(consts_map[node.id])
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](_ev(node.operand))
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](_ev(node.left), _ev(node.right))
        raise ValueError(f"Unsupported expr: {expr}")
    return _ev(ast.parse(expr.strip(), mode="eval"))

shots = []
for sid, a_str, b_str in re.findall(r"\{\s*id:\s*(\d+)\s*,\s*a:\s*(\d+)\s*,\s*b:\s*(\w+)", src):
    if b_str.isdigit():
        b_val = int(b_str)
    elif b_str == "TOTAL" and total_val is not None:
        b_val = total_val
    elif b_str in consts:
        b_val = int(consts[b_str])
    else:
        raise ValueError(f"Cannot resolve end frame '{b_str}' for shot {sid}")
    shots.append({"id": int(sid), "a": int(a_str), "b": b_val})

xf = {}
xf_m = re.search(r"XFADE[^=]*=\s*\{([^}]*)\}", src, re.DOTALL)
if xf_m:
    xf = {int(k): int(v) for k, v in re.findall(r"(\d+)\s*:\s*(\d+)", xf_m.group(1))}
xfade = [[s["a"] - xf[s["id"]] // 2, s["a"] + xf[s["id"]] // 2] for s in shots if s["id"] in xf]

def resolve_num(tok, consts_map):
    if tok.isdigit():
        return int(tok)
    if tok in consts_map:
        return int(consts_map[tok])
    return int(round(float(tok)))


flashes = []
planned_black = []
overlay_planned = []

flash_single_m = re.search(r"(?:export\s+)?const\s+FLASH_AT\s*=\s*(\w+)", src)
if flash_single_m:
    f0 = resolve_num(flash_single_m.group(1), consts)
    flashes.append([f0, f0 + 4])
flashes_m = re.search(r"(?:export\s+)?const\s+FLASHES[^=]*=\s*\[([^\]]*)\]", src, re.DOTALL)
if flashes_m:
    for f_str in re.findall(r"\b(\d+|[A-Za-z_]\w*)\b", flashes_m.group(1)):
        f0 = resolve_num(f_str, consts)
        flashes.append([f0, f0 + 4])

blackouts_m = re.search(r"(?:export\s+)?const\s+BLACKOUTS[^=]*=\s*\[(.*?)\];", src, re.DOTALL)
if blackouts_m:
    for a_tok, b_tok in re.findall(r"\[\s*([A-Za-z_]\w*|\d+)\s*,\s*([A-Za-z_]\w*|\d+)\s*\]", blackouts_m.group(1)):
        a0, b0 = resolve_num(a_tok, consts), resolve_num(b_tok, consts)
        planned_black.append([a0, b0])
        overlay_planned.extend([[a0 - 1, a0 + 1], [b0 - 1, b0 + 1]])

overlays_m = re.search(r"(?:export\s+)?const\s+OVERLAYS[^=]*=\s*\[(.*?)\];", src, re.DOTALL)
if overlays_m:
    for obj in re.findall(r"\{([^}]*)\}", overlays_m.group(1), re.DOTALL):
        km = re.search(r"""kind\s*:\s*["'](\w+)["']""", obj)
        if not km:
            continue
        kind = km.group(1)
        if kind in ("flash", "lightning"):
            fm = re.search(r"\bf\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            dm = re.search(r"\bdur\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            if fm:
                f0 = resolve_num(fm.group(1), consts)
                dur = resolve_num(dm.group(1), consts) if dm else (7 if kind == "lightning" else 4)
                flashes.append([f0, f0 + dur])
                overlay_planned.append([f0 - 1, f0 + dur + 1])
        elif kind == "blackout":
            am = re.search(r"\ba\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            bm = re.search(r"\bb\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            if am and bm:
                a0, b0 = resolve_num(am.group(1), consts), resolve_num(bm.group(1), consts)
                planned_black.append([a0, b0])
                overlay_planned.extend([[a0 - 1, a0 + 1], [b0 - 1, b0 + 1]])
        elif kind == "flicker":
            am = re.search(r"\ba\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            bm = re.search(r"\bb\s*:\s*([A-Za-z_]\w*|\d+)", obj)
            if am and bm:
                a0, b0 = resolve_num(am.group(1), consts), resolve_num(bm.group(1), consts)
                overlay_planned.append([a0 - 1, b0 + 1])

cuts = [[int(f), int(f)] for f in re.findall(r"\{\s*f:\s*(\d+)\s*,\s*cut:\s*true", src)]

kicks = []
k_m = re.search(r"(?:export\s+)?const\s+KICKS[^=]*=\s*\[(.*?)\];", src, re.DOTALL)
if k_m:
    for t0, _ in re.findall(r"\[\s*([^,\]]+)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]", k_m.group(1)):
        try:
            t_sec = eval_expr(t0, consts)
            f0 = round(t_sec * fps)
            kicks.append([f0, f0 + 8])
        except Exception:
            pass

out_dir = os.path.dirname(out_path)
if out_dir:
    os.makedirs(out_dir, exist_ok=True)

payload = {
    "shots": shots,
    "xfade": xfade,
    "planned": cuts + kicks + flashes + overlay_planned,
    "planned_black": planned_black,
}
if len(flashes) == 1:
    payload["flash"] = flashes[0]

with open(out_path, "w", encoding="utf-8") as fp:
    json.dump(payload, fp, indent=1)

print(f"{len(shots)} shots -> {out_path} (xfade={xfade}, flashes={flashes}, black={planned_black}, cuts={[c[0] for c in cuts]}, kicks={kicks})")
