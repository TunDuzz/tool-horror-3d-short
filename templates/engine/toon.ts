// Horror Engine v2: Gothic Ink-Noir 2D Character & Atmospheric FX Drawing Engine (Canvas2D Pen API).
// Aesthetic: Don't Starve x Darkest Dungeon x Mike Mignola (gaunt ~4.8-head proportions, angular skulls,
// articulated tapered limbs & 4-finger gaunt hands, recessed shadowed eye sockets, dip-pen variable ink weight,
// cross-hatching shadows, 3 views including Back + Over-The-Shoulder glance, and continuous horror actions).
// Project-specific hats, hair, props, and garments are injected cleanly via Outfit hooks in src/<project>/toon.ts.
// Design space: 600 x 1000 units (soles at y = 970).

export const INK = "#0c0712";
export const SKIN = "#cfb7a2";
const WHITE = "#e8e4dc";
const MOUTH = "#1e0c14";
export type C3 = [number, number, number];
export const SH_SKIN: C3 = [0.68, 0.62, 0.68];
export const SH_CLOTH: C3 = [0.48, 0.46, 0.56];
export const SH_FELT: C3 = [0.46, 0.44, 0.54];

export type Build = "adult" | "elder" | "gaunt" | "kid";
export type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
export const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
export const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
export const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

// ---------------- Gothic Dip-Pen API (Woodcut / Junji Ito Ink Wobble) ----------------
const wobbleHash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

export class Pen {
  g: CanvasRenderingContext2D;
  ol = 6;
  grit = 0.95; // 0 = clean vector, 1 = hand-inked dip-pen wobble, 1.6 = frantic uncanny horror scratch
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) {
    this.g = g;
  }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0;
    const c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean, jitter = 0) {
    const g = this.g;
    g.beginPath();
    const n = pts.length;
    if (!n) return;
    const [x0, y0] = this.P(pts[0][0], pts[0][1]);
    g.moveTo(x0, y0);
    const segCount = close ? n : n - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (jitter > 0.05 && len > 24) {
        const steps = Math.min(7, Math.max(2, Math.floor(len / 22)));
        const nx = -dy / len, ny = dx / len;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const off = wobbleHash(a[0] * 0.37 + s * 17.3, a[1] * 0.41 + b[0] * 0.19) * jitter;
          const [px, py] = this.P(a[0] + dx * t + nx * off, a[1] + dy * t + ny * off);
          g.lineTo(px, py);
        }
      }
      const [bx, by] = this.P(b[0], b[1]);
      g.lineTo(bx, by);
    }
    if (close) g.closePath();
  }
  poly(pts: P2[], fill: string | null, ol?: number, inkCol = INK) {
    const g = this.g, w = ol ?? this.ol;
    const j = this.grit * 1.15;
    this.path(pts, true, j);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (w) {
      g.lineWidth = w;
      g.strokeStyle = inkCol;
      g.lineJoin = "round";
      g.stroke();
      // Subtle woodcut scratch over-stroke for organic dip-pen grit (stronger on uncanny horror entities)
      if (this.grit >= 1.25 && w >= 2.2) {
        this.path(pts, true, j * 1.85);
        g.lineWidth = Math.max(1, w * 0.36);
        g.strokeStyle = "rgba(6,3,10,0.46)";
        g.stroke();
      }
    }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round";
    g.lineJoin = "round";
    this.path(pts, false, this.grit * 0.9);
    g.strokeStyle = fill;
    g.lineWidth = w;
    g.stroke();
  }
  /** Dark dripping ichor/ink tear streak descending vertically with pooled droplet tip. */
  drip(x: number, y: number, len: number, w = 2.2, col = "rgba(6,3,10,0.82)") {
    const midX = x + wobbleHash(x, y) * w * 0.7;
    this.stroke([[x, y], [midX, y + len * 0.55], [x + wobbleHash(y, x) * w * 0.5, y + len]], w, col);
    this.dot(x + wobbleHash(y, x) * w * 0.5, y + len, w * 0.88, col);
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 20; i++) {
      pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 20)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 20))]);
    }
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath();
    this.g.arc(x, y, r, 0, Math.PI * 2);
    this.g.fillStyle = fill;
    this.g.fill();
  }
  clip(pts: P2[], fn: () => void) {
    const g = this.g;
    g.save();
    this.path(pts, true);
    g.clip();
    fn();
    g.restore();
  }
  /** Two-step chiaroscuro fill (sharp Gothic shadow cut + soft dark falloff away from light). */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.42) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, R * 0.15, gx, gy, R * 1.38);
    gr.addColorStop(0, base);
    gr.addColorStop(0.62, base);
    gr.addColorStop(0.84, mix(base, shadow, 0.72));
    gr.addColorStop(1, shadow);
    this.path(pts, true);
    g.fillStyle = gr;
    g.fill();
  }
  /** Broad Gothic chiaroscuro linear wash across a garment along light angle. */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.18) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) {
      cx += x / n; cy += y / n;
      const d = x * dx + y * dy;
      lo = Math.min(lo, d); hi = Math.max(hi, d);
    }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc));
    const [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base);
    gr.addColorStop(flat, base);
    gr.addColorStop(0.66, mix(base, shadow, 0.65));
    gr.addColorStop(1, shadow);
    this.path(pts, true);
    g.fillStyle = gr;
    g.fill();
  }
  /** Hand-inked Gothic cross-hatching lines clipped inside `pts` on the shadow side away from `light`. */
  hatch(pts: P2[], light: number, spacing = 10, lw = 1.6, col = "rgba(12,7,18,0.48)", cross = false) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5;
    const sx = -Math.cos(light), sy = -Math.sin(light);
    const span = Math.hypot(x1 - x0, y1 - y0) * 0.6;
    const drawSet = (angDeg: number, step: number, alphaK = 1) => {
      const a = rad(angDeg), ca = Math.cos(a), sa = Math.sin(a);
      const nx = -sa, ny = ca;
      const g = this.g;
      g.strokeStyle = col;
      g.lineWidth = lw * alphaK;
      g.lineCap = "round";
      for (let d = -span; d <= span; d += step) {
        const px = cx + nx * d, py = cy + ny * d;
        // Favor shadow side of the silhouette
        const side = (px - cx) * sx + (py - cy) * sy;
        if (side < -span * 0.16) continue;
        const pA = this.P(px - ca * span, py - sa * span);
        const pB = this.P(px + ca * span, py + sa * span);
        g.beginPath();
        g.moveTo(pA[0], pA[1]);
        g.lineTo(pB[0], pB[1]);
        g.stroke();
      }
    };
    this.clip(pts, () => {
      drawSet(38, spacing, 1);
      if (cross) drawSet(-34, spacing * 1.45, 0.72);
    });
  }
  /** Variable dip-pen ink ring: razor-thin on lit edge, heavy pooled obsidian ink on shadow side. */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.58, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]);
      inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => {
      r.forEach(([x0, y0], i) => {
        const [x, y] = this.P(x0, y0);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
    };
    g.beginPath();
    trace(out);
    trace(inn.reverse());
    g.fillStyle = col;
    g.fill("evenodd");
  }
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g;
    g.lineCap = cap;
    g.lineJoin = "round";
    this.path(pts, false);
    g.strokeStyle = INK;
    g.lineWidth = w + 2 * rim;
    g.stroke();
    this.path(pts, false);
    g.strokeStyle = fill;
    g.lineWidth = w;
    g.stroke();
    g.lineCap = "round";
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 36): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

export const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly(
    [
      [a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2],
      [b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2],
      [b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2],
      [a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2],
    ],
    col,
    0,
  );
  p.dot(a[0], a[1], wa / 2, col);
  p.dot(b[0], b[1], wb / 2, col);
};

/** Tapered shaded limb segment (sleeve/trouser volume) instead of stickman lines! */
const limbPoly = (a: P2, b: P2, wa: number, wb: number): P2[] => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  return [
    [a[0] + nx * wa * 0.5, a[1] + ny * wa * 0.5],
    [b[0] + nx * wb * 0.5, b[1] + ny * wb * 0.5],
    [b[0] - nx * wb * 0.5, b[1] - ny * wb * 0.5],
    [a[0] - nx * wa * 0.5, a[1] - ny * wa * 0.5],
  ];
};

const drawArticulatedLimb = (
  p: Pen,
  root: P2,
  joint: P2,
  tip: P2,
  wRoot: number,
  wJoint: number,
  wTip: number,
  fill: string,
  light: number,
  ow: number,
) => {
  const sh = mul(fill, SH_CLOTH);
  const seg1 = limbPoly(root, joint, wRoot, wJoint);
  const seg2 = limbPoly(joint, tip, wJoint * 0.96, wTip);
  p.gradFill(seg1, fill, sh, light, 0.25);
  p.poly(seg1, null, ow * 0.82);
  p.gradFill(seg2, fill, sh, light, 0.25);
  p.poly(seg2, null, ow * 0.82);
  // Subtle joint crease fold
  p.dot(joint[0], joint[1], wJoint * 0.44, mix(fill, sh, 0.45));
};

/** Articulated bony hand with 4 tapered fingers (clawed/grasping for horror entities, tense fingers for humans). */
const drawGauntHand = (
  p: Pen,
  wrist: P2,
  elbow: P2,
  u: number,
  skin: string,
  claw: boolean,
  open: boolean,
  ow: number,
) => {
  const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1];
  const ang = Math.atan2(dy, dx);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const palmL = (claw ? 16 : 12.5) * u;
  const palmW = (claw ? 11 : 11.5) * u;
  const palm: P2[] = [
    [wrist[0] - nx * palmW * 0.45, wrist[1] - ny * palmW * 0.45],
    [wrist[0] + ca * palmL - nx * palmW * 0.55, wrist[1] + sa * palmL - ny * palmW * 0.55],
    [wrist[0] + ca * palmL + nx * palmW * 0.55, wrist[1] + sa * palmL + ny * palmW * 0.55],
    [wrist[0] + nx * palmW * 0.45, wrist[1] + ny * palmW * 0.45],
  ];
  p.poly(palm, mul(skin, [0.92, 0.90, 0.92]), ow * 0.58);
  const fLen = (claw ? 24 : open ? 15 : 9.5) * u;
  const spread = claw ? 0.32 : open ? 0.24 : 0.12;
  for (let i = 0; i < 4; i++) {
    const fFrac = (i - 1.5) / 1.5;
    const base: P2 = [
      wrist[0] + ca * palmL * 0.88 + nx * fFrac * palmW * 0.48,
      wrist[1] + sa * palmL * 0.88 + ny * fFrac * palmW * 0.48,
    ];
    const fa = ang + fFrac * spread;
    const len = fLen * (i === 1 || i === 2 ? 1.08 : 0.88);
    const mid: P2 = [base[0] + Math.cos(fa) * len * 0.55, base[1] + Math.sin(fa) * len * 0.55];
    const tipA = fa + (claw ? 0.35 : open ? 0.14 : 0.65);
    const tip: P2 = [mid[0] + Math.cos(tipA) * len * 0.5, mid[1] + Math.sin(tipA) * len * 0.5];
    p.stroke([base, mid, tip], (claw ? 3.2 : 3.4) * u, INK);
    p.stroke([base, mid], (claw ? 1.7 : 2.1) * u, skin);
  }
};

/** Pointed Gothic boot/shoe volume instead of a flat bar. */
const drawBoot = (p: Pen, ank: P2, dir: number, pitch: number, u: number, col: string, ow: number) => {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  const pt = (lx: number, ly: number): P2 => [ank[0] + (lx * c - ly * s) * dir, ank[1] + (lx * s + ly * c)];
  const poly: P2[] = [
    pt(-6 * u, -4 * u),
    pt(6 * u, -3 * u),
    pt(21 * u, 3 * u),
    pt(23 * u, 8.5 * u),
    pt(-8 * u, 8.5 * u),
    pt(-9 * u, 2 * u),
  ];
  p.poly(poly, col, ow * 0.72);
  // Boot heel notch
  p.stroke([pt(-7 * u, 7.5 * u), pt(21 * u, 7.5 * u)], 2.2 * u, INK);
};

// ---------------- Gothic Angular Skull Contours ----------------
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.75, -Math.cos(light));
const DEF_LIGHT = rad(-120);

/** Angular gaunt Gothic front/3-quarter head contour (defined temples, sunken cheeks, optional elongated uncanny jawDrop). */
const gothicHeadFront = (cx: number, hc: number, hw: number, hh: number, facing: number, gaunt: boolean, jawDrop = 0): P2[] => {
  const f = facing * 0.10 * hw;
  const cheek = gaunt ? 0.88 : 0.94;
  const jaw = gaunt ? 0.50 : 0.64;
  const chin = gaunt ? 0.22 : 0.31;
  const drop = jawDrop * hh * 0.34;
  return [
    [cx + f * 0.3, hc - hh], // crown
    [cx + hw * 0.62 + f * 0.3, hc - hh * 0.90],
    [cx + hw * 0.98 + f * 0.4, hc - hh * 0.42], // temple R
    [cx + hw * cheek + f * 0.6, hc + hh * 0.02], // cheekbone R
    [cx + hw * (cheek - 0.14) + f * 0.5, hc + hh * 0.28], // sunken hollow R
    [cx + hw * jaw + f * 0.4, hc + hh * 0.60 + drop * 0.55], // jaw corner R
    [cx + hw * chin + f * 0.2, hc + hh * 0.96 + drop], // chin R
    [cx + f * 0.15, hc + hh * 1.03 + drop], // chin tip
    [cx - hw * chin + f * 0.1, hc + hh * 0.96 + drop], // chin L
    [cx - hw * jaw + f * 0.1, hc + hh * 0.60 + drop * 0.55], // jaw corner L
    [cx - hw * (cheek - 0.14) + f * 0.15, hc + hh * 0.28], // sunken hollow L
    [cx - hw * cheek + f * 0.2, hc + hh * 0.02], // cheekbone L
    [cx - hw * 0.98 + f * 0.2, hc - hh * 0.42], // temple L
    [cx - hw * 0.62 + f * 0.2, hc - hh * 0.90],
  ];
};

/** Angular Gothic side profile skull (brow ridge, recessed eye socket, bony nose, angular chin, optional jawDrop). */
const gothicHeadSide = (cx: number, hc: number, hw: number, hh: number, gaunt: boolean, jawDrop = 0): P2[] => {
  const nose = gaunt ? 1.22 : 1.14;
  const drop = jawDrop * hh * 0.30;
  return [
    [cx - hw * 0.10, hc - hh], // top crown
    [cx + hw * 0.56, hc - hh * 0.86], // forehead top
    [cx + hw * 0.90, hc - hh * 0.32], // brow ridge
    [cx + hw * 0.76, hc - hh * 0.05], // deep eye socket notch
    [cx + hw * nose, hc + hh * 0.18], // bony nose tip
    [cx + hw * 0.82, hc + hh * 0.28], // under nose
    [cx + hw * 0.88, hc + hh * 0.48 + drop * 0.35], // lips
    [cx + hw * 0.70, hc + hh * 0.90 + drop], // angular chin
    [cx + hw * 0.22, hc + hh * 0.99 + drop], // under jaw
    [cx - hw * 0.38, hc + hh * 0.74 + drop * 0.4], // jaw back
    [cx - hw * 0.88, hc + hh * 0.24], // occiput
    [cx - hw * 0.96, hc - hh * 0.35], // rear cranium
    [cx - hw * 0.68, hc - hh * 0.84],
  ];
};

// ---------------- Horror Expressions (Darkest Dungeon / Mignola Chiaroscuro) ----------------
export type Expr =
  | "stoic"
  | "wary"
  | "suspicious"
  | "dread"
  | "uneasy"
  | "terrified"
  | "hollow"
  | "unhinged"
  | "possessed";

type FaceStyle = {
  socketDepth: number; // 0..1 darkness of upper-face brow shadow
  eye: "slit" | "widePin" | "pinpoint" | "void" | "glowSlit" | "tense";
  browTilt: number; // + furrowed/suspicious, - terrified/angled up
  mouth: "tight" | "downturn" | "quiver" | "gasp" | "slack" | "eerieGrin";
  underRings: boolean;
  cheekHatch: boolean;
};

const FACES: Record<Expr, FaceStyle> = {
  stoic: { socketDepth: 0.58, eye: "slit", browTilt: 2, mouth: "tight", underRings: false, cheekHatch: true },
  wary: { socketDepth: 0.66, eye: "slit", browTilt: 4, mouth: "downturn", underRings: true, cheekHatch: true },
  suspicious: { socketDepth: 0.72, eye: "slit", browTilt: 5, mouth: "tight", underRings: true, cheekHatch: true },
  uneasy: { socketDepth: 0.68, eye: "tense", browTilt: -3, mouth: "quiver", underRings: true, cheekHatch: true },
  dread: { socketDepth: 0.78, eye: "widePin", browTilt: -5, mouth: "quiver", underRings: true, cheekHatch: true },
  terrified: { socketDepth: 0.82, eye: "pinpoint", browTilt: -8, mouth: "gasp", underRings: true, cheekHatch: true },
  hollow: { socketDepth: 0.92, eye: "void", browTilt: -1, mouth: "slack", underRings: true, cheekHatch: true },
  unhinged: { socketDepth: 0.84, eye: "pinpoint", browTilt: -6, mouth: "eerieGrin", underRings: true, cheekHatch: true },
  possessed: { socketDepth: 0.96, eye: "glowSlit", browTilt: 3, mouth: "slack", underRings: false, cheekHatch: true },
};

const drawHorrorEye = (
  p: Pen,
  kind: FaceStyle["eye"],
  x: number,
  y: number,
  u: number,
  look: number,
  lid: number,
  shiver: number,
  time: number,
  eyeGlow?: string,
  uncanny = false,
  eyeScale = 1,
) => {
  const jx = shiver > 0 ? Math.sin(time * 47 + x) * 1.3 * u * shiver : 0;
  const jy = shiver > 0 ? Math.cos(time * 53 + y) * 1.0 * u * shiver : 0;
  const sc = eyeScale;
  const lx = x + look * 3.0 * u + jx;
  const ly = y + jy;

  // Deep Darkest-Dungeon sunken obsidian orbital cavity (pitch-black skull socket!)
  p.ell(x, y + 1.8 * u, 16.0 * u * sc, 13.8 * u * sc, "rgba(5,2,9,0.88)", 0);
  p.ell(x, y + 2.2 * u, 13.2 * u * sc, 11.4 * u * sc, "#06030a", 0);

  if (lid >= 0.95 && kind !== "void" && kind !== "glowSlit") {
    p.stroke([[x - 11 * u * sc, y + 1 * u], [x + 11 * u * sc, y + 1 * u]], 3.2 * u, INK);
    return;
  }
  const lidScale = lid > 0 && kind !== "void" && kind !== "glowSlit" ? 0.45 : 1.0;
  switch (kind) {
    case "slit": {
      p.ell(x, y, 9.8 * u * sc, 3.6 * u * lidScale * sc, "#bdb7ac", 2.2 * u);
      p.dot(lx, ly, 2.0 * u * sc, INK);
      p.stroke([[x - 12.5 * u * sc, y - 3.6 * u], [x + 12.5 * u * sc, y - 2.4 * u]], 4.4 * u, INK);
      break;
    }
    case "tense": {
      p.ell(x, y, 9.8 * u * sc, 6.2 * u * lidScale * sc, "#c8c2b4", 2.5 * u);
      p.dot(lx, ly, 2.1 * u * sc, INK);
      // Fine tired eyelid crease
      p.arc(x, y - 4.5 * u, 10 * u * sc, 4 * u, 200, 340, 1.8 * u, INK);
      break;
    }
    case "widePin": {
      p.ell(x, y, 10.8 * u * sc, 8.6 * u * lidScale * sc, "#cfc9be", 2.8 * u);
      // Subtle bloodshot capillaries in corners
      p.stroke([[x - 9.5 * u * sc, y + 1 * u], [x - 5.5 * u * sc, y + 2 * u]], 1.0 * u, "rgba(110,22,26,0.58)");
      p.stroke([[x + 9.5 * u * sc, y - 1 * u], [x + 5.5 * u * sc, y]], 1.0 * u, "rgba(110,22,26,0.58)");
      p.dot(lx, ly + 0.5 * u, 1.8 * u * sc, INK);
      break;
    }
    case "pinpoint": {
      const rw = (uncanny ? 11.8 : 10.6) * u * sc;
      const rh = (uncanny ? 10.4 : 8.8) * u * lidScale * sc;
      p.ell(x, y, rw, rh, uncanny ? "#dcd8ce" : "#d0cabd", 2.9 * u);
      // Uncanny dilated bloodshot veins radiating toward iris
      p.stroke([[x - rw * 0.9, y + 1 * u], [x - rw * 0.45, y + 2 * u]], 1.15 * u, "rgba(128,18,24,0.68)");
      p.stroke([[x + rw * 0.9, y - 2 * u], [x + rw * 0.45, y - 0.5 * u]], 1.15 * u, "rgba(128,18,24,0.68)");
      p.stroke([[x - rw * 0.65, y - rh * 0.65], [x - rw * 0.3, y - rh * 0.35]], 0.95 * u, "rgba(128,18,24,0.52)");
      // Razor-tiny terrifying pinpoint pupil (off-axis slightly when uncanny)
      p.dot(lx, ly, (uncanny ? 1.25 : 1.4) * u * sc, INK);
      if (uncanny) {
        p.dot(lx + 0.8 * u, ly - 0.8 * u, 0.7 * u, "#ffffff");
        p.drip(x - 4 * u * sc, y + rh * 0.85, 22 * u, 1.7 * u, "rgba(6,3,10,0.82)");
        p.drip(x + 4 * u * sc, y + rh * 0.85, 14 * u, 1.3 * u, "rgba(6,3,10,0.68)");
      }
      break;
    }
    case "void": {
      p.ell(x, y + 0.8 * u, 12.2 * u * sc, 13.8 * u * sc, "#030106", 2.4 * u);
      if (eyeGlow) {
        // Tiny cold spectral pinhole floating inside bottomless black socket
        p.dot(lx, ly, 3.0 * u * sc, "rgba(210,235,255,0.22)");
        p.dot(lx, ly, 1.55 * u * sc, eyeGlow);
      }
      // Heavy dripping black river-ooze / ichor tears streaming down gaunt cheeks
      p.drip(x - 4.2 * u * sc, y + 10 * u * sc, 28 * u, 2.0 * u, "rgba(5,2,9,0.86)");
      p.drip(x + 3.4 * u * sc, y + 11 * u * sc, 20 * u, 1.5 * u, "rgba(5,2,9,0.74)");
      p.drip(x, y + 12 * u * sc, 15 * u, 1.2 * u, "rgba(5,2,9,0.65)");
      break;
    }
    case "glowSlit": {
      p.ell(x, y, 12.5 * u * sc, 10.5 * u * sc, "#030106", 0);
      const col = eyeGlow ?? "#dceeff";
      p.poly(
        [
          [x - 9.0 * u * sc, y],
          [x, y - 2.6 * u * sc],
          [x + 9.0 * u * sc, y],
          [x, y + 2.2 * u * sc],
        ],
        col,
        0,
      );
      p.drip(x - 2 * u, y + 9 * u, 18 * u, 1.5 * u, "rgba(5,2,9,0.78)");
      break;
    }
  }
};

const drawHorrorMouth = (
  p: Pen,
  kind: FaceStyle["mouth"],
  mx: number,
  my: number,
  u: number,
  k = 1,
  shiver = 0,
  time = 0,
  uncanny = false,
) => {
  const j = shiver > 0 ? Math.sin(time * 51) * 1.2 * u * shiver : 0;
  const y = my + j;
  switch (kind) {
    case "tight":
      p.stroke([[mx - 9.5 * u * k, y], [mx + 9.5 * u * k, y - 0.8 * u]], 3.2 * u, INK);
      p.stroke([[mx - 5 * u * k, y + 5 * u], [mx + 5 * u * k, y + 5 * u]], 1.6 * u, "rgba(10,5,16,0.52)");
      break;
    case "downturn":
      p.arc(mx, y + 5.5 * u, 10 * u * k, 5.2 * u, 200, 340, 3.4 * u, INK);
      break;
    case "quiver": {
      const pts: P2[] = [];
      for (let i = 0; i <= 10; i++) {
        pts.push([mx - 10.5 * u * k + i * 2.1 * u * k, y + Math.sin(i * 1.7 + time * 19) * (1.3 + 0.9 * shiver) * u]);
      }
      p.stroke(pts, 2.8 * u, INK);
      // Tense nasolabial creases
      p.stroke([[mx - 12 * u * k, y - 6 * u], [mx - 10 * u * k, y + 4 * u]], 1.4 * u, "rgba(10,5,16,0.55)");
      p.stroke([[mx + 12 * u * k, y - 6 * u], [mx + 10 * u * k, y + 4 * u]], 1.4 * u, "rgba(10,5,16,0.55)");
      break;
    }
    case "gasp": {
      // Truly terrified clenched/ragged scream grimace with shadowed tooth ridges (ZERO cute cartoon round 'O'!)
      const poly: P2[] = [
        [mx - 14.5 * u * k, y + 2 * u],
        [mx - 9 * u * k, y - 5.5 * u],
        [mx, y - 4.0 * u],
        [mx + 9 * u * k, y - 5.5 * u],
        [mx + 14.5 * u * k, y + 2 * u],
        [mx + 10.5 * u * k, y + 10.5 * u],
        [mx, y + 8.5 * u],
        [mx - 10.5 * u * k, y + 10.5 * u],
      ];
      p.poly(poly, "#08030a", 2.9 * u);
      // Shadowed upper & lower clenched teeth bars with vertical ink gaps
      p.stroke([[mx - 9.5 * u * k, y - 2.6 * u], [mx + 9.5 * u * k, y - 2.6 * u]], 2.4 * u, "#9f988c");
      p.stroke([[mx - 8.0 * u * k, y + 7.2 * u], [mx + 8.0 * u * k, y + 7.2 * u]], 2.0 * u, "#847d74");
      for (const tx of [-6, -2, 2, 6]) {
        p.stroke([[mx + tx * u * k, y - 4.2 * u], [mx + tx * u * k, y - 0.8 * u]], 1.0 * u, INK);
        p.stroke([[mx + tx * u * k, y + 5.6 * u], [mx + tx * u * k, y + 8.8 * u]], 1.0 * u, INK);
      }
      // Deep screaming cheek strain furrows
      p.stroke([[mx - 18 * u * k, y - 7 * u], [mx - 15 * u * k, y + 9 * u]], 1.8 * u, "rgba(10,5,16,0.68)");
      p.stroke([[mx + 18 * u * k, y - 7 * u], [mx + 15 * u * k, y + 9 * u]], 1.8 * u, "rgba(10,5,16,0.68)");
      break;
    }
    case "slack": {
      // Uncanny elongated yawning black abyss (jaw-dropped horror entity!)
      const stretch = uncanny ? 1.85 : 1.15;
      const poly: P2[] = [
        [mx - 10.5 * u * k, y - 2 * u],
        [mx, y - 6 * u],
        [mx + 10.5 * u * k, y - 2 * u],
        [mx + 8.5 * u * k, y + 14 * u * stretch],
        [mx, y + 18 * u * stretch],
        [mx - 8.5 * u * k, y + 14 * u * stretch],
      ];
      p.poly(poly, "#040107", 2.8 * u);
      if (uncanny) {
        // Needle teeth clinging inside upper/lower black void + black ooze dripping off lower lip
        p.stroke([[mx - 7.5 * u * k, y - 2.5 * u], [mx + 7.5 * u * k, y - 2.5 * u]], 1.8 * u, "#8c928e");
        for (const tx of [-5.5, -2.2, 1.2, 4.8]) {
          p.stroke([[mx + tx * u * k, y - 4 * u], [mx + tx * u * k, y + 0.5 * u]], 1.0 * u, INK);
        }
        p.drip(mx - 5 * u * k, y + 15 * u * stretch, 16 * u, 1.5 * u, "rgba(5,2,9,0.85)");
        p.drip(mx + 3 * u * k, y + 17 * u * stretch, 22 * u, 1.8 * u, "rgba(5,2,9,0.88)");
      }
      break;
    }
    case "eerieGrin": {
      // Junji Ito cheek-splitting manic rictus grin lined with thin gapped needle teeth & radial horror creases!
      const wMul = uncanny ? 1.28 : 1.0;
      const pts: P2[] = [
        [mx - 23 * u * k * wMul, y - 10 * u],
        [mx - 12 * u * k * wMul, y + 5 * u],
        [mx, y + 9 * u],
        [mx + 12 * u * k * wMul, y + 5 * u],
        [mx + 23 * u * k * wMul, y - 10 * u],
        [mx + 11 * u * k * wMul, y - 0.5 * u],
        [mx, y + 1.5 * u],
        [mx - 11 * u * k * wMul, y - 0.5 * u],
      ];
      p.poly(pts, "#050208", 2.7 * u);
      // Upper and lower rows of pale bone-grey needle teeth separated by fine ink cracks
      p.stroke([[mx - 17 * u * k * wMul, y + 1.2 * u], [mx + 17 * u * k * wMul, y + 1.2 * u]], 2.0 * u, "#9da6a4");
      p.stroke([[mx - 13 * u * k * wMul, y + 5.6 * u], [mx + 13 * u * k * wMul, y + 5.6 * u]], 1.6 * u, "#7e8684");
      for (const tx of [-15, -11, -7, -3.5, 0, 3.5, 7, 11, 15]) {
        p.stroke(
          [[mx + tx * u * k * wMul, y - 1.5 * u], [mx + tx * u * k * wMul, y + 8.5 * u]],
          1.15 * u,
          INK,
        );
      }
      // Deep Junji Ito cheek-carving creases & oozing corner drips
      for (const s of [-1, 1]) {
        p.stroke([[mx + s * 25 * u * k * wMul, y - 14 * u], [mx + s * 19 * u * k * wMul, y + 1 * u]], 2.0 * u, "rgba(8,3,14,0.82)");
        p.stroke([[mx + s * 28 * u * k * wMul, y - 9 * u], [mx + s * 22 * u * k * wMul, y + 5 * u]], 1.3 * u, "rgba(8,3,14,0.58)");
      }
      if (uncanny) {
        p.drip(mx - 18 * u * k * wMul, y - 2 * u, 20 * u, 1.6 * u, "rgba(5,2,9,0.84)");
        p.drip(mx + 16 * u * k * wMul, y - 1 * u, 16 * u, 1.4 * u, "rgba(5,2,9,0.78)");
      }
      break;
    }
  }
};

const drawFaceFront = (
  p: Pen,
  cx: number,
  hc: number,
  hp: P2[],
  W: number,
  expr: Expr,
  facing: number,
  look: number,
  lid: number,
  shiver: number,
  time: number,
  eyeGlow?: string,
  ageLines?: boolean,
  uncanny = false,
  underLight = 0,
) => {
  const u = W / 100, F = FACES[expr], fx = cx + 9 * u * facing;
  const ey = hc - 2 * u, ex = 19 * u;
  // Mignola / Darkest Dungeon upper-face shadow band (or terrifying inverted under-lighting!)
  p.clip(hp, () => {
    if (underLight > 0.05) {
      // Under-lighting: heavy ink shadow pressed across upper forehead & brow while lower jaw glows eeriely
      const gr = p.g.createLinearGradient(cx, hc - 56 * u, cx, hc + 42 * u);
      gr.addColorStop(0, `rgba(5,2,10,${(0.94 * underLight + 0.15).toFixed(2)})`);
      gr.addColorStop(0.52, `rgba(5,2,10,${(0.66 * underLight).toFixed(2)})`);
      gr.addColorStop(0.78, "rgba(5,2,10,0)");
      gr.addColorStop(1, `rgba(255,220,165,${(0.18 * underLight).toFixed(2)})`);
      p.g.fillStyle = gr;
      p.g.fillRect(cx - W, hc - W, W * 2, W * 2);
    } else {
      const gr = p.g.createLinearGradient(cx, hc - 48 * u, cx, hc + 24 * u);
      gr.addColorStop(0, `rgba(6,3,12,${(F.socketDepth * 0.96).toFixed(2)})`);
      gr.addColorStop(0.56, `rgba(6,3,12,${(F.socketDepth * 0.62).toFixed(2)})`);
      gr.addColorStop(1, "rgba(6,3,12,0)");
      p.g.fillStyle = gr;
      p.g.fillRect(cx - W, hc - W, W * 2, W * 1.45);
    }
    // Junji Ito fine vertical stress/dread scratch lines descending across brow & temples
    if (uncanny || expr === "terrified" || expr === "dread") {
      for (let i = -4; i <= 4; i++) {
        const sx = fx + i * 9.5 * u;
        p.stroke([[sx, hc - 46 * u], [sx + i * 0.6 * u, hc - 14 * u]], 1.15 * u, "rgba(6,3,12,0.52)");
      }
    }
  });
  for (const side of [-1, 1]) {
    // Deliberate Uncanny Valley asymmetry on horror entities (one eye slightly larger & higher, misaligned gaze!)
    const x = fx + side * ex;
    const yOff = uncanny ? (side < 0 ? -3.2 * u : 2.6 * u) : 0;
    const eScale = uncanny ? (side < 0 ? 1.16 : 0.86) : 1.0;
    const eLook = uncanny ? look + side * 0.28 : look;
    drawHorrorEye(p, F.eye, x, ey + yOff, u, eLook, lid, shiver, time, eyeGlow, uncanny, eScale);
    if (F.underRings) {
      p.arc(x, ey + yOff + 11.5 * u * eScale, 12 * u * eScale, 5.0 * u, 16, 164, 2.2 * u, "rgba(10,4,16,0.82)");
      p.arc(x, ey + yOff + 16 * u * eScale, 9 * u * eScale, 3.4 * u, 24, 156, 1.5 * u, "rgba(10,4,16,0.56)");
    }
    const by = ey + yOff - 14.5 * u * eScale;
    const tilt = F.browTilt * u;
    taper(p, [x - side * 13 * u, by + tilt * 0.6], [x + side * 12 * u, by - tilt * 0.55], 4.6 * u, 1.9 * u, INK);
  }
  // Sharp bony nose bridge + shadowed nostrils
  const nx = fx + 2.5 * u * facing;
  p.stroke([[nx, ey + 2 * u], [nx + 2.5 * u * (facing || 1), ey + 17 * u], [nx - 3.5 * u * (facing || 1), ey + 19 * u]], 2.4 * u, INK);
  if (uncanny) {
    p.dot(nx - 3 * u, ey + 18 * u, 1.8 * u, "#050208");
    p.dot(nx + 3 * u, ey + 18 * u, 1.8 * u, "#050208");
  }
  // Sunken gaunt cheek hollows & harsh cross-hatch furrows
  if (F.cheekHatch) {
    for (const side of [-1, 1]) {
      const chx = fx + side * 32 * u;
      p.stroke([[chx, ey + 13 * u], [chx - side * 9 * u, ey + 35 * u]], 2.1 * u, "rgba(10,5,16,0.68)");
      p.stroke([[chx - side * 4 * u, ey + 17 * u], [chx - side * 12 * u, ey + 33 * u]], 1.4 * u, "rgba(10,5,16,0.52)");
      if (ageLines || uncanny) p.stroke([[chx - side * 10 * u, ey + 21 * u], [chx - side * 16 * u, ey + 38 * u]], 1.4 * u, "rgba(10,5,16,0.50)");
    }
  }
  // Cold sweat drop on terrified humans
  if (!uncanny && (expr === "terrified" || expr === "dread")) {
    p.poly([[fx + 30 * u, ey - 14 * u], [fx + 33 * u, ey - 5 * u], [fx + 27 * u, ey - 5 * u]], "#d8e6ee", 1.3 * u);
  }
  drawHorrorMouth(p, F.mouth, fx + 1 * u * facing, ey + 32 * u, u, 1, shiver, time, uncanny);
};

const drawFaceSide = (
  p: Pen,
  hx: number,
  hc: number,
  hp: P2[],
  W: number,
  expr: Expr,
  lid: number,
  shiver: number,
  time: number,
  eyeGlow?: string,
  ageLines?: boolean,
  uncanny = false,
  underLight = 0,
) => {
  const u = W / 100, F = FACES[expr];
  const ex = hx + 27 * u, ey = hc - 2 * u;
  p.clip(hp, () => {
    if (underLight > 0.05) {
      const gr = p.g.createLinearGradient(hx, hc - 54 * u, hx, hc + 42 * u);
      gr.addColorStop(0, `rgba(5,2,10,${(0.92 * underLight + 0.15).toFixed(2)})`);
      gr.addColorStop(0.52, `rgba(5,2,10,${(0.62 * underLight).toFixed(2)})`);
      gr.addColorStop(0.80, "rgba(5,2,10,0)");
      gr.addColorStop(1, `rgba(255,220,165,${(0.18 * underLight).toFixed(2)})`);
      p.g.fillStyle = gr;
      p.g.fillRect(hx - W, hc - W, W * 2, W * 2);
    } else {
      const gr = p.g.createLinearGradient(hx, hc - 46 * u, hx, hc + 22 * u);
      gr.addColorStop(0, `rgba(6,3,12,${(F.socketDepth * 0.94).toFixed(2)})`);
      gr.addColorStop(0.58, `rgba(6,3,12,${(F.socketDepth * 0.56).toFixed(2)})`);
      gr.addColorStop(1, "rgba(6,3,12,0)");
      p.g.fillStyle = gr;
      p.g.fillRect(hx - W, hc - W, W * 2, W * 1.45);
    }
    if (uncanny || expr === "terrified" || expr === "dread") {
      for (let i = -2; i <= 3; i++) {
        p.stroke([[hx + i * 10 * u, hc - 44 * u], [hx + i * 10 * u, hc - 14 * u]], 1.15 * u, "rgba(6,3,12,0.52)");
      }
    }
  });
  drawHorrorEye(p, F.eye, ex, ey, u, 0.5, lid, shiver, time, eyeGlow, uncanny, uncanny ? 1.12 : 1.0);
  if (F.underRings) {
    p.arc(ex, ey + 11.5 * u, 10.5 * u, 4.4 * u, 18, 162, 2.1 * u, "rgba(10,4,16,0.82)");
    p.arc(ex, ey + 15.5 * u, 7.5 * u, 3.0 * u, 25, 155, 1.4 * u, "rgba(10,4,16,0.55)");
  }
  const by = ey - 14.5 * u;
  taper(p, [ex + 11 * u, by + F.browTilt * 0.55 * u], [ex - 12 * u, by - F.browTilt * 0.55 * u], 4.6 * u, 1.9 * u, INK);
  // Sunken profile cheek furrow
  p.stroke([[hx + 16 * u, ey + 14 * u], [hx + 5 * u, ey + 35 * u]], 2.1 * u, "rgba(10,5,16,0.70)");
  p.stroke([[hx + 11 * u, ey + 18 * u], [hx + 1 * u, ey + 34 * u]], 1.4 * u, "rgba(10,5,16,0.52)");
  if (ageLines || uncanny) p.stroke([[hx + 24 * u, ey + 20 * u], [hx + 15 * u, ey + 35 * u]], 1.4 * u, "rgba(10,5,16,0.50)");
  drawHorrorMouth(p, F.mouth, hx + 33 * u, ey + 31 * u, u, 0.68, shiver, time, uncanny);
};

// ---------------- Extensible Outfit & Hooks ----------------
export type HeadCtx = {
  hp: P2[];
  cx: number;
  hc: number;
  W: number;
  HH: number;
  u: number;
  crown: number;
  ow: number;
  light: number;
  thick: number;
  seed: number;
  facing: number;
  side: boolean;
  back: boolean;
  time: number;
  wind: number;
  rot: (pts: P2[]) => P2[];
};
export type TorsoCtx = {
  tp: P2[];
  tcx: number;
  tcy: number;
  chin: number;
  torsoBot: number;
  W: number;
  HH: number;
  u: number;
  ow: number;
  light: number;
  thick: number;
  facing: number;
  side: boolean;
  back: boolean;
  time: number;
  wind: number;
};
export type BodyCtx = {
  tcx: number;
  chin: number;
  torsoBot: number;
  crown: number;
  W: number;
  HH: number;
  u: number;
  ow: number;
  light: number;
  facing: number;
  side: boolean;
  back: boolean;
  time: number;
  wind: number;
  hands: [P2, P2]; // [back/left hand, front/right hand]
};

export type Outfit = {
  jacket: string;
  pants: string;
  boots: string;
  skin?: string;
  coatLen?: number; // extra coat hem drop below hip (0..0.95 HH)
  tattered?: boolean; // ragged jagged hem strips animated by wind/time
  hat?: "cap" | "hair" | "hood" | null;
  cap?: string;
  hair?: string;
  eyeGlow?: string; // eerie pinpoint/slit glow color in dark eye sockets
  uncanny?: boolean; // Junji Ito / Silent Hill uncanny mode: asymmetric eyes, stretched jaw, scratchy double-ink, ichor drips
  ageLines?: boolean;
  belt?: string | null;
  buttons?: string;
  sash?: string;
  dress?: string;
  build?: Build;
  hasBrim?: boolean;
  hatBehind?: (p: Pen, ctx: HeadCtx) => void;
  hatOn?: (p: Pen, ctx: HeadCtx) => void;
  torsoDetail?: (p: Pen, ctx: TorsoCtx) => void;
  behindBody?: (p: Pen, ctx: BodyCtx) => void;
  inFrontHand?: (p: Pen, hand: P2, ctx: BodyCtx) => void;
};

const drawBuiltinHeadgear = (p: Pen, o: Outfit, ctx: HeadCtx) => {
  if (!o.hat) return;
  const { cx, hc, W, HH, u, crown, ow, light, side, back, time, wind } = ctx;
  const col = o.hat === "cap" ? (o.cap ?? "#2c282a") : (o.hair ?? "#121018");
  const sh = mul(col, SH_FELT);
  if (o.hat === "hair") {
    const sway = Math.sin(time * 2.6 + cx * 0.02) * (3 + 8 * wind) * u;
    if (back) {
      // Full matted hair draping down back of skull & nape
      const poly: P2[] = [
        [cx - 0.56 * W, hc - 0.10 * HH],
        [cx - 0.44 * W, crown - 0.04 * HH],
        [cx, crown - 0.08 * HH],
        [cx + 0.44 * W, crown - 0.04 * HH],
        [cx + 0.56 * W, hc - 0.10 * HH],
        [cx + 0.54 * W + sway, hc + 0.62 * HH],
        [cx + 0.25 * W + sway * 0.7, hc + 0.74 * HH],
        [cx + sway * 0.8, hc + 0.60 * HH],
        [cx - 0.25 * W + sway * 0.7, hc + 0.76 * HH],
        [cx - 0.54 * W + sway, hc + 0.64 * HH],
      ];
      p.gradFill(poly, col, sh, light);
      p.hatch(poly, light, 8, 1.5);
      p.poly(poly, null, ow);
    } else if (side) {
      const poly: P2[] = [
        [cx + 0.46 * W, hc - 0.20 * HH],
        [cx + 0.22 * W, crown - 0.05 * HH],
        [cx - 0.36 * W, crown - 0.03 * HH],
        [cx - 0.58 * W, hc - 0.02 * HH],
        [cx - 0.56 * W + sway, hc + 0.58 * HH],
        [cx - 0.26 * W + sway * 0.6, hc + 0.48 * HH],
        [cx - 0.08 * W, hc - 0.02 * HH],
        [cx + 0.18 * W, hc - 0.14 * HH],
      ];
      p.gradFill(poly, col, sh, light);
      p.poly(poly, null, ow);
    } else {
      // Jagged Gothic fringe overhanging shadowed forehead + dangling side strands
      const poly: P2[] = [
        [cx - 0.56 * W, hc + 0.28 * HH],
        [cx - 0.54 * W, hc - 0.24 * HH],
        [cx - 0.36 * W, crown - 0.05 * HH],
        [cx, crown - 0.08 * HH],
        [cx + 0.36 * W, crown - 0.05 * HH],
        [cx + 0.54 * W, hc - 0.24 * HH],
        [cx + 0.56 * W, hc + 0.28 * HH],
        [cx + 0.42 * W + sway * 0.4, hc - 0.06 * HH],
        [cx + 0.24 * W, hc - 0.12 * HH],
        [cx + 0.08 * W + sway * 0.2, hc - 0.02 * HH],
        [cx - 0.10 * W, hc - 0.15 * HH],
        [cx - 0.28 * W + sway * 0.2, hc - 0.04 * HH],
        [cx - 0.42 * W + sway * 0.4, hc - 0.08 * HH],
      ];
      p.gradFill(poly, col, sh, light);
      p.poly(poly, null, ow);
    }
  } else if (o.hat === "cap") {
    const capY = crown + 0.30 * HH;
    const dome: P2[] = [
      [cx - 0.53 * W, capY],
      [cx - 0.46 * W, crown - 0.04 * HH],
      [cx, crown - 0.10 * HH],
      [cx + 0.46 * W, crown - 0.04 * HH],
      [cx + 0.53 * W, capY],
    ];
    p.gradFill(dome, col, sh, light);
    p.hatch(dome, light, 9, 1.3);
    p.poly(dome, null, ow);
    if (!back) {
      if (side) {
        p.poly(
          [
            [cx + 0.34 * W, capY - 2 * u],
            [cx + 0.80 * W, capY + 6 * u],
            [cx + 0.38 * W, capY + 9 * u],
          ],
          shade(col, 0.72),
          ow * 0.85,
        );
      } else {
        p.poly(
          [
            [cx - 0.50 * W, capY],
            [cx, capY - 4 * u],
            [cx + 0.50 * W, capY],
            [cx + 0.38 * W, capY + 11 * u],
            [cx - 0.38 * W, capY + 11 * u],
          ],
          shade(col, 0.72),
          ow * 0.85,
        );
      }
    }
  } else if (o.hat === "hood") {
    if (back) {
      const hood: P2[] = [
        [cx - 0.64 * W, hc + 0.48 * HH],
        [cx - 0.60 * W, hc - 0.22 * HH],
        [cx - 0.34 * W, crown - 0.12 * HH],
        [cx, crown - 0.20 * HH],
        [cx + 0.34 * W, crown - 0.12 * HH],
        [cx + 0.60 * W, hc - 0.22 * HH],
        [cx + 0.64 * W, hc + 0.48 * HH],
      ];
      p.gradFill(hood, col, sh, light);
      p.hatch(hood, light, 9, 1.5, "rgba(8,4,12,0.52)", true);
      p.poly(hood, null, ow);
    } else if (side) {
      // Side-profile draped cowl behind crown & neck, overhanging forehead without covering eyes/nose
      const cowlSide: P2[] = [
        [cx - 0.68 * W, hc + 0.50 * HH],
        [cx - 0.66 * W, hc - 0.24 * HH],
        [cx - 0.26 * W, crown - 0.16 * HH],
        [cx + 0.34 * W, crown - 0.10 * HH],
        [cx + 0.58 * W, crown + 0.08 * HH],
        [cx + 0.24 * W, crown + 0.14 * HH],
        [cx - 0.18 * W, hc - 0.06 * HH],
        [cx - 0.26 * W, hc + 0.46 * HH],
      ];
      p.gradFill(cowlSide, col, sh, light);
      p.hatch(cowlSide, light, 9, 1.4, "rgba(8,4,12,0.48)", true);
      p.poly(cowlSide, null, ow);
    } else {
      // Front open-faced Gothic hood cowl arch framing the face & casting deep shadow across the brow
      const cowl: P2[] = [
        [cx - 0.68 * W, hc + 0.50 * HH],
        [cx - 0.64 * W, hc - 0.20 * HH],
        [cx - 0.34 * W, crown - 0.14 * HH],
        [cx, crown - 0.22 * HH],
        [cx + 0.34 * W, crown - 0.14 * HH],
        [cx + 0.64 * W, hc - 0.20 * HH],
        [cx + 0.68 * W, hc + 0.50 * HH],
        [cx + 0.44 * W, hc + 0.44 * HH],
        [cx + 0.46 * W, hc - 0.14 * HH],
        [cx + 0.26 * W, crown + 0.11 * HH],
        [cx, crown + 0.15 * HH],
        [cx - 0.26 * W, crown + 0.11 * HH],
        [cx - 0.46 * W, hc - 0.14 * HH],
        [cx - 0.44 * W, hc + 0.44 * HH],
      ];
      p.gradFill(cowl, col, sh, light);
      p.hatch(cowl, light, 9, 1.4, "rgba(8,4,12,0.48)", true);
      p.poly(cowl, null, ow);
    }
  }
};

// ---------------- Proportions & Articulated Horror Rig ----------------
type RigSpec = {
  headW: number;
  headH: number;
  neckH: number;
  shW: number;
  waistW: number;
  torsoH: number;
  legH: number;
  armScale: number;
  hunch: number;
  gaunt: boolean;
  claw: boolean;
};

const RIGS: Record<Build, RigSpec> = {
  adult: { headW: 57, headH: 73, neckH: 24, shW: 94, waistW: 54, torsoH: 260, legH: 410, armScale: 1.0, hunch: 3, gaunt: false, claw: false },
  elder: { headW: 55, headH: 71, neckH: 22, shW: 88, waistW: 52, torsoH: 248, legH: 392, armScale: 0.98, hunch: 9, gaunt: true, claw: false },
  gaunt: { headW: 52, headH: 76, neckH: 34, shW: 84, waistW: 44, torsoH: 274, legH: 428, armScale: 1.22, hunch: 10, gaunt: true, claw: true },
  kid: { headW: 53, headH: 66, neckH: 18, shW: 72, waistW: 44, torsoH: 198, legH: 312, armScale: 0.92, hunch: 2, gaunt: false, claw: false },
};

export type Action =
  | "idle"
  | "walk"
  | "creep"
  | "flee"
  | "peer"
  | "crouch"
  | "recoil"
  | "lunge"
  | "reach"
  | "boltDoor"
  | "cower"
  | "emerge";

export type FrontArm = "hold" | "raise" | "extend" | "defend" | ["swing", number];

export type PoseOpts = {
  action?: Action;
  phase?: number; // 0..1 walk/flee stride cycle
  poseMix?: number; // 0..1 continuous intensity of peer/recoil/lunge/boltDoor
  expr?: Expr;
  look?: number; // -1..1 horizontal eye gaze
  blink?: boolean | number;
  frontArm?: FrontArm;
  holdProp?: boolean;
  tilt?: number; // extra body tilt deg
  headTilt?: number; // extra head cant deg (use 25..42 deg with uncannyTwitch for inhuman neck snaps!)
  headPitch?: number; // -1 (look down) .. +1 (look up)
  jawDrop?: number; // 0..1 unnatural elongated slack/screaming jaw for horror entities
  underLight?: number; // 0..1 eerie upward lantern/floor under-lighting casting shadows up across brow
  glance?: -1 | 0 | 1; // for bodyBack: over-the-shoulder profile glance!
  facing?: -1 | 0 | 1;
  time?: number; // continuous seconds driving breathing, wind, shiver
  shiver?: number; // 0..1 nervous tremor
  wind?: number; // 0..1 fluttering hair / coat hem
  stride?: number;
  light?: number;
  seed?: number;
};

const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const ik = (hip: P2, ank: P2, l1: number, l2: number, bendDir = 1): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.5);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const k = Math.atan2(dy, dx) - A * bendDir;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** Build organically curved Gothic coat/tunic silhouette (curved spine/shoulders, flared coat drape, optional tatters). */
const coatTorsoPts = (
  cx: number,
  shY: number,
  hipY: number,
  shW: number,
  waistW: number,
  coatDrop: number,
  tattered: boolean,
  time: number,
  wind: number,
  facing: number,
): P2[] => {
  const waistY = shY + (hipY - shY) * 0.62;
  const hemY = hipY + coatDrop;
  const hemW = Math.max(waistW * 1.24, shW * (coatDrop > 40 ? 0.96 : 0.78));
  const sway = Math.sin(time * 2.5 + 0.6) * (4 + 14 * wind);
  const f = facing * 6;
  const shL: P2 = [cx - shW + f * 0.3, shY + 18];
  const shR: P2 = [cx + shW + f * 0.3, shY + 18];
  const wL: P2 = [cx - waistW + f * 0.2, waistY];
  const wR: P2 = [cx + waistW + f * 0.2, waistY];
  const hL: P2 = [cx - hemW + sway, hemY];
  const hR: P2 = [cx + hemW + sway, hemY];

  const topEdge = curve(shL, [cx + f * 0.4, shY - 12], shR, 8);
  const rightSide = curve(shR, [wR[0] - 4, waistY], hR, 8);
  const leftSide = curve(hL, [wL[0] + 4, waistY], shL, 8);

  const pts: P2[] = [...topEdge, ...rightSide.slice(1)];
  if (tattered) {
    const teeth = 7;
    for (let i = teeth - 1; i >= 1; i--) {
      const u = i / teeth;
      const tx = cx - hemW + u * hemW * 2 + sway * (0.7 + 0.3 * Math.sin(i * 1.7));
      const drop = i % 2 === 1 ? 26 + 10 * Math.sin(time * 3.1 + i) : -6;
      pts.push([tx, hemY + drop]);
    }
  } else {
    pts.push([cx + sway * 0.9, hemY + 8]);
  }
  pts.push(...leftSide);
  return pts;
};

// ---------------- 1. FRONT / 3-QUARTER VIEW ----------------
export const bodyFront = (p: Pen, o: Outfit, opts: PoseOpts = {}) => {
  const {
    action = "idle",
    phase = 0,
    poseMix = 1,
    expr = "wary",
    look = 0,
    blink = false,
    frontArm,
    tilt = 0,
    headTilt = 0,
    headPitch = 0,
    jawDrop = 0,
    underLight = 0,
    facing = 0,
    time = 0,
    shiver = 0,
    wind = 0.2,
    light = DEF_LIGHT,
    seed = 1,
  } = opts;
  const R = RIGS[o.build ?? "adult"];
  p.grit = o.uncanny || R.gaunt ? 1.55 : 0.95;
  const skin = o.skin ?? SKIN;
  const lid = lidOf(blink);
  const W = R.headW * 2, HH = R.headH * 2, u = W / 100;
  const sole = 970, two = Math.PI * 2;
  const ow = 4.6 * u, thick = thickAngle(light);

  // Continuous living breathing + crouch/peer/recoil vertical offset
  const breath = Math.sin(time * 2.4 + seed) * (action === "flee" ? 4.5 : 2.6);
  const crouchDrop =
    action === "crouch"
      ? 95 * poseMix
      : action === "peer"
      ? 42 * poseMix
      : action === "cower"
      ? 72 * poseMix
      : action === "recoil"
      ? 24 * poseMix
      : 0;
  const strideBob =
    action === "flee" ? 18 * Math.abs(Math.sin(two * phase)) : action === "walk" || action === "creep" ? 10 * Math.abs(Math.sin(two * phase)) : 0;

  const hipY = sole - R.legH + crouchDrop - strideBob;
  const shY = hipY - R.torsoH + breath;
  const chin = shY - R.neckH + (action === "peer" ? 14 * poseMix : 0);
  const hc = chin - R.headH + headPitch * -10;
  const crown = hc - R.headH;
  const tcx = 300 + facing * 6 + (shiver > 0 ? Math.sin(time * 43) * 2.2 * shiver : 0);

  // ---- Articulated Legs ----
  p.rot = null;
  const legCol = o.pants, bootCol = o.boots;
  const l1 = R.legH * 0.51, l2 = R.legH * 0.49;
  const stepLift = action === "flee" ? 78 : action === "walk" ? 44 : action === "creep" ? 28 : 0;
  for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
    const up = stepLift > 0 ? Math.max(0, Math.sin(two * (phase + ph))) * stepLift : 0;
    const spread = action === "recoil" ? 36 * poseMix : action === "flee" ? 34 : action === "crouch" ? 42 * poseMix : 22;
    const hip: P2 = [tcx + side * (R.waistW * 0.48), hipY - 8];
    const ank: P2 = [tcx + side * spread, sole - 8 - up];
    const knee: P2 = [
      (hip[0] + ank[0]) * 0.5 + side * (crouchDrop * 0.25 + up * 0.14 + 4),
      (hip[1] + ank[1]) * 0.5 - up * 0.10,
    ];
    drawArticulatedLimb(p, hip, knee, ank, 26 * u, 19 * u, 13 * u, legCol, light, ow);
    drawBoot(p, ank, side, up > 5 ? -0.14 : 0, u, bootCol, ow);
  }

  // ---- Upper Body Tilt & Lean ----
  const walkSway = action === "flee" ? 6 * Math.sin(two * phase) : action === "walk" || action === "creep" ? 2.5 * Math.sin(two * phase) : 0;
  const actTilt =
    action === "recoil"
      ? -13 * poseMix
      : action === "lunge"
      ? 14 * poseMix
      : action === "peer"
      ? 8 * poseMix
      : action === "cower"
      ? -8 * poseMix
      : 0;
  const A = tilt + walkSway + actTilt;
  p.rot = A ? [rad(A), tcx, hipY] : null;

  // ---- Articulated Arms ----
  const aLen = R.torsoH * 0.94 * R.armScale;
  const shL: P2 = [tcx - R.shW * 0.88, shY + 18];
  const shR: P2 = [tcx + R.shW * 0.88, shY + 18];
  const sw = action === "flee" ? Math.sin(two * phase) * 1.4 : action === "walk" || action === "creep" ? Math.sin(two * phase) * 0.6 : 0;
  const trembX = shiver > 0 ? Math.sin(time * 49) * 3.5 * shiver : 0;
  const trembY = shiver > 0 ? Math.cos(time * 55) * 3.0 * shiver : 0;

  let armL: [P2, P2, P2] = [shL, [shL[0] - 18 - sw * 14, shL[1] + aLen * 0.48], [shL[0] - 14 - sw * 28, shL[1] + aLen * 0.92]];
  let armR: [P2, P2, P2] = [shR, [shR[0] + 18 + sw * 14, shR[1] + aLen * 0.48], [shR[0] + 14 + sw * 28, shR[1] + aLen * 0.92]];
  let rightInFront = false;
  let openL = false, openR = false;

  if (action === "peer") {
    // Leaning forward lowering storm lantern/right hand out & down
    armL = [shL, [shL[0] - 26, shL[1] + aLen * 0.42], [shL[0] - 18, shL[1] + aLen * 0.80]];
    armR = [shR, [shR[0] + 34 * poseMix, shR[1] + aLen * 0.36], [shR[0] + 54 * poseMix + trembX, shR[1] + aLen * 0.72 + trembY]];
    rightInFront = true;
  } else if (action === "recoil" || action === "cower") {
    armL = [shL, [shL[0] - 42 * poseMix, shL[1] + 24], [shL[0] - 24 + trembX, shL[1] - 48 * poseMix + trembY]];
    armR = [shR, [shR[0] + 44 * poseMix, shR[1] + 10], [shR[0] + 28 + trembX, shR[1] - 68 * poseMix + trembY]];
    rightInFront = true;
    openL = openR = true;
  } else if (action === "lunge" || action === "reach") {
    armL = [shL, [shL[0] - 32, shL[1] + 42], [shL[0] - 58 * poseMix, shL[1] + 12]];
    armR = [shR, [shR[0] + 68 * poseMix, shR[1] - 10], [shR[0] + 148 * poseMix + trembX, shR[1] - 22 * poseMix + trembY]];
    rightInFront = true;
    openL = openR = true;
  } else if (action === "emerge") {
    const wr = Math.sin(time * 2.2) * 14;
    armL = [shL, [shL[0] - 52, shL[1] + 28 + wr], [shL[0] - 92, shL[1] - 16 - wr * 0.6]];
    armR = [shR, [shR[0] + 54, shR[1] + 24 - wr], [shR[0] + 96, shR[1] - 20 + wr * 0.6]];
    rightInFront = true;
    openL = openR = true;
  } else if (action === "boltDoor") {
    armL = [shL, [shL[0] - 12, shL[1] + 65], [tcx - 24, shY + 55]];
    armR = [shR, [shR[0] + 12, shR[1] + 65], [tcx + 28, shY + 55]];
    rightInFront = true;
  } else if (frontArm === "hold") {
    armR = [shR, [shR[0] + 26, shR[1] + aLen * 0.42], [tcx + R.shW * 0.56 + trembX, shR[1] + aLen * 0.44 + trembY]];
    rightInFront = true;
  } else if (frontArm === "raise") {
    armR = [shR, [shR[0] + 44, shR[1] - 8], [shR[0] + 56 + trembX, shR[1] - 82 + trembY]];
    rightInFront = true;
  } else if (frontArm === "extend") {
    armR = [shR, [shR[0] + 58, shR[1] + 22], [shR[0] + 114 + trembX, shR[1] + 18 + trembY]];
    rightInFront = true;
    openR = true;
  } else if (frontArm === "defend") {
    armR = [shR, [shR[0] + 24, shR[1] + 26], [tcx + 14 + trembX, shR[1] - 42 + trembY]];
    rightInFront = true;
    openR = true;
  } else if (Array.isArray(frontArm)) {
    const k = clamp(frontArm[1], 0, 1);
    armR = [
      shR,
      lerp2([shR[0] + 40, shR[1] - 12], [shR[0] + 48, shR[1] + 68], k),
      lerp2([shR[0] + 52, shR[1] - 78], [shR[0] + 92, shR[1] + 74], k),
    ];
    rightInFront = true;
  }

  const coatDrop = o.dress ? sole - hipY - 58 : (o.coatLen ?? 0.24) * HH;
  const tp = coatTorsoPts(tcx, shY, hipY, R.shW, R.waistW, coatDrop, !!o.tattered, time, wind, facing);
  const bodyCtx: BodyCtx = {
    tcx, chin, torsoBot: hipY + coatDrop, crown, W, HH, u, ow, light, facing, side: false, back: false, time, wind,
    hands: [armL[2], armR[2]],
  };

  o.behindBody?.(p, bodyCtx);
  drawArticulatedLimb(p, armL[0], armL[1], armL[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
  drawGauntHand(p, armL[2], armL[1], u, skin, R.claw, openL, ow);
  if (!rightInFront) {
    drawArticulatedLimb(p, armR[0], armR[1], armR[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
    drawGauntHand(p, armR[2], armR[1], u, skin, R.claw, openR, ow);
  }

  // ---- Torso / Coat with Gothic Cross-Hatching & Drapery Folds ----
  const mainCol = o.dress ?? o.jacket;
  p.gradFill(tp, mainCol, mul(mainCol, SH_CLOTH), light);
  p.hatch(tp, light, 11, 1.5, "rgba(10,6,16,0.44)", true);
  p.clip(tp, () => {
    // Vertical Gothic coat drapery creases
    p.stroke([[tcx - R.waistW * 0.35, shY + 40], [tcx - R.waistW * 0.55, hipY + coatDrop - 8]], 2.0 * u, "rgba(10,6,16,0.5)");
    p.stroke([[tcx + R.waistW * 0.32, shY + 46], [tcx + R.waistW * 0.50, hipY + coatDrop - 8]], 1.8 * u, "rgba(10,6,16,0.42)");
    if (o.belt) {
      const by = shY + R.torsoH * 0.66;
      p.band([[tcx - R.shW, by], [tcx + R.shW, by]], o.belt, 10 * u, 1.8 * u);
    }
    if (o.sash) {
      const by = shY + R.torsoH * 0.68;
      p.band([[tcx - R.shW, by], [tcx + R.shW, by]], o.sash, 16 * u, 1.8 * u);
    }
    if (o.buttons) {
      for (let i = 0; i < 4; i++) {
        p.dot(tcx + 3 * u * facing, shY + 34 + i * 44, 2.8 * u, o.buttons);
      }
    }
    o.torsoDetail?.(p, {
      tp, tcx, tcy: (shY + hipY) * 0.5, chin, torsoBot: hipY + coatDrop, W, HH, u, ow, light, thick, facing, side: false, back: false, time, wind,
    });
  });
  p.inkRing(tp, ow, thick);

  // ---- Slender Gothic Neck ----
  const neckPts: P2[] = [
    [tcx - 16 * u, chin - 24],
    [tcx + 16 * u, chin - 24],
    [tcx + 21 * u, shY + 18],
    [tcx - 21 * u, shY + 18],
  ];
  p.poly(neckPts, mul(skin, [0.72, 0.68, 0.72]), ow * 0.7);
  p.hatch(neckPts, light, 6, 1.3, "rgba(10,6,16,0.55)");

  if (rightInFront) {
    drawArticulatedLimb(p, armR[0], armR[1], armR[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
    drawGauntHand(p, armR[2], armR[1], u, skin, R.claw, openR, ow);
    o.inFrontHand?.(p, armR[2], bodyCtx);
  }

  // ---- Angular Gothic Head ----
  const headBreathTilt = Math.sin(time * 1.9 + seed) * 1.4;
  const Ah = A + headTilt + headBreathTilt + (action === "unhinged" as never ? 6 : 0);
  const [cpx, cpy] = rotAbout([tcx, chin], rad(A), [tcx, hipY]);
  p.rot = Ah ? [rad(Ah), tcx, chin, cpx - tcx, cpy - chin] : null;
  const effJaw = jawDrop || (o.uncanny && (expr === "hollow" || expr === "unhinged") ? 0.65 : 0);
  const hp = gothicHeadFront(tcx, hc, R.headW, R.headH, facing, R.gaunt, effJaw);
  const headCtx: HeadCtx = {
    hp, cx: tcx, hc, W, HH, u, crown, ow: 0.9 * ow, light, thick, seed, facing, side: false, back: false, time, wind,
    rot: (pts: P2[]) => rotPts(pts, 0, tcx, hc),
  };
  o.hatBehind?.(p, headCtx);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, R.headH);
  p.hatch(hp, light, o.uncanny ? 6.5 : 8.0, 1.35, o.uncanny ? "rgba(8,4,14,0.46)" : "rgba(12,7,18,0.38)", !!o.uncanny);
  p.inkRing(hp, ow, thick);
  drawFaceFront(p, tcx, hc, hp, W, expr, facing, look, lid, shiver, time, o.eyeGlow, o.ageLines, !!o.uncanny, underLight);
  drawBuiltinHeadgear(p, o, headCtx);
  o.hatOn?.(p, headCtx);
  p.rot = null;
};

// ---------------- 2. SIDE PROFILE VIEW ----------------
export const bodySide = (p: Pen, o: Outfit, opts: PoseOpts = {}) => {
  const {
    action = "idle",
    phase = 0,
    poseMix = 1,
    expr = "wary",
    blink = false,
    holdProp = false,
    tilt = 0,
    headTilt = 0,
    headPitch = 0,
    jawDrop = 0,
    underLight = 0,
    time = 0,
    shiver = 0,
    wind = 0.2,
    stride = 1,
    light = DEF_LIGHT,
    seed = 1,
  } = opts;
  const R = RIGS[o.build ?? "adult"];
  p.grit = o.uncanny || R.gaunt ? 1.55 : 0.95;
  const skin = o.skin ?? SKIN;
  const lid = lidOf(blink);
  const W = R.headW * 2, HH = R.headH * 2, u = W / 100;
  const sole = 970, ankY = sole - 8, two = Math.PI * 2;
  const ow = 4.6 * u, thick = thickAngle(light);
  const l1 = R.legH * 0.51, l2 = R.legH * 0.49;

  const breath = Math.sin(time * 2.4 + seed) * 2.6;
  const moving = action === "walk" || action === "creep" || action === "flee";
  const S = (action === "flee" ? 310 : action === "creep" ? 190 : 250) * stride;
  const liftH = action === "flee" ? 72 : action === "creep" ? 28 : 42;

  type LegS = { ank: P2; pitch: number; near: boolean };
  const legs: LegS[] = [];
  let hipY = ankY - R.legH * 0.97;
  let lean = R.hunch + tilt;
  let nearFwd = 0;

  if (moving) {
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) {
        const s = c / 0.5;
        return { x: S / 2 - S * s, h: 0, stance: true, s };
      }
      const s = (c - 0.5) / 0.5;
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = R.legH * (action === "creep" ? 0.92 : 0.97);
    hipY = ankY - Math.sqrt(Math.max(100, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const) {
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(28 * Math.sin(Math.PI * L.s) * (1 - 1.5 * L.s)), near });
    }
    lean += (action === "flee" ? 18 : action === "creep" ? 14 : 6) + 3 * Math.cos(2 * two * phase);
    nearFwd = nL.x / Math.max(1, S / 2);
  } else if (action === "peer" || action === "crouch") {
    hipY = ankY - R.legH * (action === "crouch" ? 0.72 : 0.88);
    legs.push({ ank: [272, ankY], pitch: 0, near: false }, { ank: [332, ankY], pitch: 0, near: true });
    lean += (action === "peer" ? 26 : 20) * poseMix;
  } else if (action === "recoil" || action === "cower") {
    hipY = ankY - R.legH * 0.88;
    legs.push({ ank: [255, ankY], pitch: rad(-10), near: false }, { ank: [345, ankY], pitch: 0, near: true });
    lean -= 16 * poseMix;
  } else if (action === "lunge" || action === "reach") {
    hipY = ankY - R.legH * 0.84;
    legs.push({ ank: [240, ankY], pitch: rad(-14), near: false }, { ank: [365, ankY], pitch: 0, near: true });
    lean += 24 * poseMix;
  } else {
    legs.push({ ank: [288, ankY], pitch: 0, near: false }, { ank: [314, ankY], pitch: 0, near: true });
  }

  const hip: P2 = [300, hipY];
  const shY = hipY - R.torsoH + breath;
  const chin = shY - R.neckH;
  const hc = chin - R.headH;
  const crown = hc - R.headH;

  // ---- Articulated IK Side Legs ----
  p.rot = null;
  for (const L of legs) {
    const hp0: P2 = [300 + (L.near ? 2 : -8), hipY - 6];
    const knee = ik(hp0, L.ank, l1, l2, 1);
    const col = L.near ? o.pants : shade(o.pants, 0.76);
    drawArticulatedLimb(p, hp0, knee, L.ank, 27 * u, 19 * u, 13 * u, col, light, ow);
    drawBoot(p, L.ank, 1, L.pitch, u, L.near ? o.boots : shade(o.boots, 0.78), ow);
  }

  // ---- Leaning Upper Body ----
  p.rot = lean ? [rad(lean), 300, hipY] : null;
  const tcx = 304, aLen = R.torsoH * 0.94 * R.armScale;
  const Spt: P2 = [tcx + 4, shY + 18];
  const trembX = shiver > 0 ? Math.sin(time * 49) * 3.5 * shiver : 0;
  const trembY = shiver > 0 ? Math.cos(time * 55) * 3.0 * shiver : 0;

  const swingArm = (ang: number): [P2, P2, P2] => {
    const e: P2 = [Spt[0] + Math.sin(ang) * aLen * 0.5, Spt[1] + Math.cos(ang) * aLen * 0.5];
    const a2 = ang + rad(22) * Math.sign(ang || 1);
    return [Spt, e, [e[0] + Math.sin(a2) * aLen * 0.5, e[1] + Math.cos(a2) * aLen * 0.5]];
  };

  let near: [P2, P2, P2] = swingArm(rad(-32) * nearFwd);
  let far: [P2, P2, P2] = swingArm(rad(32) * nearFwd);
  let openNear = false;

  if (action === "peer") {
    near = [Spt, [Spt[0] + 62 * poseMix, Spt[1] + 74], [Spt[0] + 132 * poseMix + trembX, Spt[1] + 92 + trembY]];
    far = [Spt, [Spt[0] - 18, Spt[1] + 85], [Spt[0] - 8, Spt[1] + 160]];
  } else if (action === "lunge" || action === "reach") {
    near = [Spt, [Spt[0] + 95 * poseMix, Spt[1] + 12], [Spt[0] + 195 * poseMix + trembX, Spt[1] - 6 + trembY]];
    far = [Spt, [Spt[0] + 70 * poseMix, Spt[1] - 18], [Spt[0] + 150 * poseMix, Spt[1] - 30]];
    openNear = true;
  } else if (action === "boltDoor") {
    near = [Spt, [Spt[0] + 68, Spt[1] + 22], [Spt[0] + 136, Spt[1] + 8]];
    far = [Spt, [Spt[0] + 58, Spt[1] + 8], [Spt[0] + 124, Spt[1] - 4]];
  } else if (action === "recoil" || action === "cower") {
    near = [Spt, [Spt[0] + 52, Spt[1] + 12], [Spt[0] + 88 + trembX, Spt[1] - 48 + trembY]];
    far = [Spt, [Spt[0] - 38, Spt[1] + 45], [Spt[0] - 62, Spt[1] + 110]];
    openNear = true;
  } else if (action === "emerge") {
    const wr = Math.sin(time * 2.2) * 16;
    near = [Spt, [Spt[0] + 76, Spt[1] + 22 + wr], [Spt[0] + 156, Spt[1] - 18 - wr * 0.6]];
    far = [Spt, [Spt[0] + 54, Spt[1] - 6 - wr], [Spt[0] + 118, Spt[1] - 34 + wr * 0.5]];
    openNear = true;
  } else if (holdProp) {
    near = [Spt, [Spt[0] + 16, Spt[1] + 92], [Spt[0] + 86 + trembX, Spt[1] + 88 + trembY]];
  }

  const coatDrop = o.dress ? sole - hipY - 58 : (o.coatLen ?? 0.24) * HH;
  const sideShW = R.shW * 0.62, sideWaistW = R.waistW * 0.72;
  const tp = coatTorsoPts(tcx, shY, hipY, sideShW, sideWaistW, coatDrop, !!o.tattered, time, wind, 1);
  const bodyCtx: BodyCtx = {
    tcx, chin, torsoBot: hipY + coatDrop, crown, W, HH, u, ow, light, facing: 1, side: true, back: false, time, wind,
    hands: [far[2], near[2]],
  };

  drawArticulatedLimb(p, far[0], far[1], far[2], 20 * u, 15 * u, 10 * u, shade(o.jacket, 0.75), light, ow);
  drawGauntHand(p, far[2], far[1], u, shade(skin, 0.8), R.claw, openNear, ow);
  o.behindBody?.(p, bodyCtx);

  // Torso
  const mainCol = o.dress ?? o.jacket;
  p.gradFill(tp, mainCol, mul(mainCol, SH_CLOTH), light);
  p.hatch(tp, light, 11, 1.5, "rgba(10,6,16,0.46)", true);
  p.clip(tp, () => {
    if (o.belt) p.band([[tcx - sideShW, shY + R.torsoH * 0.66], [tcx + sideShW, shY + R.torsoH * 0.66]], o.belt, 10 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - sideShW, shY + R.torsoH * 0.68], [tcx + sideShW, shY + R.torsoH * 0.68]], o.sash, 16 * u, 1.8 * u);
    o.torsoDetail?.(p, {
      tp, tcx, tcy: (shY + hipY) * 0.5, chin, torsoBot: hipY + coatDrop, W, HH, u, ow, light, thick, facing: 1, side: true, back: false, time, wind,
    });
  });
  p.inkRing(tp, ow, thick);

  // Slender forward-tilted neck
  const neckPts: P2[] = [
    [tcx - 10 * u, chin - 24],
    [tcx + 18 * u, chin - 24],
    [tcx + 14 * u, shY + 20],
    [tcx - 16 * u, shY + 20],
  ];
  p.poly(neckPts, mul(skin, [0.72, 0.68, 0.72]), ow * 0.7);
  p.hatch(neckPts, light, 6, 1.3, "rgba(10,6,16,0.55)");

  // Near arm + prop
  drawArticulatedLimb(p, near[0], near[1], near[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
  drawGauntHand(p, near[2], near[1], u, skin, R.claw, openNear, ow);
  if (holdProp || action === "peer") o.inFrontHand?.(p, near[2], bodyCtx);

  // Side Head
  const hx = tcx + 12 * u;
  const hPitchDeg = headPitch * -18 + headTilt;
  const [cpx, cpy] = rotAbout([hx, chin], rad(lean), [300, hipY]);
  p.rot = lean + hPitchDeg ? [rad(lean + hPitchDeg), hx, chin, cpx - hx, cpy - chin] : null;
  const effJawS = jawDrop || (o.uncanny && (expr === "hollow" || expr === "unhinged") ? 0.65 : 0);
  const hp = gothicHeadSide(hx, hc, R.headW, R.headH, R.gaunt, effJawS);
  const headCtx: HeadCtx = {
    hp, cx: hx, hc, W, HH, u, crown, ow: 0.9 * ow, light, thick, seed, facing: 1, side: true, back: false, time, wind,
    rot: (pts: P2[]) => rotPts(pts, 0, hx, hc),
  };
  o.hatBehind?.(p, headCtx);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, R.headH);
  p.hatch(hp, light, o.uncanny ? 6.5 : 8.0, 1.35, o.uncanny ? "rgba(8,4,14,0.46)" : "rgba(12,7,18,0.38)", !!o.uncanny);
  p.inkRing(hp, ow, thick);
  drawFaceSide(p, hx, hc, hp, W, expr, lid, shiver, time, o.eyeGlow, o.ageLines, !!o.uncanny, underLight);
  drawBuiltinHeadgear(p, o, headCtx);
  o.hatOn?.(p, headCtx);
  p.rot = null;
};

// ---------------- 3. TRUE BACK VIEW (Unlocks OTS Shots & Over-The-Shoulder Glances!) ----------------
export const bodyBack = (p: Pen, o: Outfit, opts: PoseOpts = {}) => {
  const {
    action = "idle",
    phase = 0,
    poseMix = 1,
    expr = "dread",
    blink = false,
    frontArm,
    holdProp = false,
    tilt = 0,
    headTilt = 0,
    underLight = 0,
    glance = 0, // -1 (glancing back left) | 0 (pure back of head) | +1 (glancing back right)
    time = 0,
    shiver = 0,
    wind = 0.2,
    light = DEF_LIGHT,
    seed = 1,
  } = opts;
  const R = RIGS[o.build ?? "adult"];
  p.grit = o.uncanny || R.gaunt ? 1.55 : 0.95;
  const skin = o.skin ?? SKIN;
  const lid = lidOf(blink);
  const W = R.headW * 2, HH = R.headH * 2, u = W / 100;
  const sole = 970, two = Math.PI * 2;
  const ow = 4.6 * u, thick = thickAngle(light);

  const breath = Math.sin(time * 2.4 + seed) * 2.6;
  const crouchDrop = action === "crouch" ? 85 * poseMix : action === "peer" ? 36 * poseMix : 0;
  const strideBob = action === "flee" ? 16 * Math.abs(Math.sin(two * phase)) : action === "walk" || action === "creep" ? 9 * Math.abs(Math.sin(two * phase)) : 0;
  const hipY = sole - R.legH + crouchDrop - strideBob;
  const shY = hipY - R.torsoH + breath;
  const chin = shY - R.neckH;
  const hc = chin - R.headH;
  const crown = hc - R.headH;
  const tcx = 300 + (shiver > 0 ? Math.sin(time * 43) * 2.2 * shiver : 0);

  // Legs from behind
  p.rot = null;
  const stepLift = action === "flee" ? 68 : action === "walk" ? 38 : action === "creep" ? 24 : 0;
  for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
    const up = stepLift > 0 ? Math.max(0, Math.sin(two * (phase + ph))) * stepLift : 0;
    const hip: P2 = [tcx + side * (R.waistW * 0.48), hipY - 8];
    const ank: P2 = [tcx + side * 24, sole - 8 - up];
    const knee: P2 = [(hip[0] + ank[0]) * 0.5 + side * 3, (hip[1] + ank[1]) * 0.5 - up * 0.08];
    drawArticulatedLimb(p, hip, knee, ank, 26 * u, 19 * u, 13 * u, shade(o.pants, 0.85), light, ow);
    // Heel view of boot
    p.poly(
      [
        [ank[0] - 11 * u, ank[1] - 4 * u],
        [ank[0] + 11 * u, ank[1] - 4 * u],
        [ank[0] + 13 * u, ank[1] + 8 * u],
        [ank[0] - 13 * u, ank[1] + 8 * u],
      ],
      o.boots,
      ow * 0.72,
    );
  }

  const A = tilt + (action === "walk" || action === "creep" ? 2.2 * Math.sin(two * phase) : 0);
  p.rot = A ? [rad(A), tcx, hipY] : null;

  // Arms from behind
  const aLen = R.torsoH * 0.94 * R.armScale;
  const shL: P2 = [tcx - R.shW * 0.88, shY + 18];
  const shR: P2 = [tcx + R.shW * 0.88, shY + 18];
  const sw = action === "flee" ? Math.sin(two * phase) * 1.2 : action === "walk" || action === "creep" ? Math.sin(two * phase) * 0.55 : 0;
  let armL: [P2, P2, P2] = [shL, [shL[0] - 18 - sw * 12, shL[1] + aLen * 0.48], [shL[0] - 14 - sw * 22, shL[1] + aLen * 0.90]];
  let armR: [P2, P2, P2] = [shR, [shR[0] + 18 + sw * 12, shR[1] + aLen * 0.48], [shR[0] + 14 + sw * 22, shR[1] + aLen * 0.90]];
  if (holdProp || frontArm === "hold" || action === "peer") {
    armR = [shR, [shR[0] + 34, shR[1] + aLen * 0.40], [shR[0] + 54, shR[1] + aLen * 0.58]];
  } else if (action === "boltDoor") {
    armL = [shL, [shL[0] - 24, shL[1] + 24], [shL[0] - 4, shL[1] - 18]];
    armR = [shR, [shR[0] + 24, shR[1] + 24], [shR[0] + 4, shR[1] - 18]];
  }

  const coatDrop = o.dress ? sole - hipY - 58 : (o.coatLen ?? 0.24) * HH;
  const tp = coatTorsoPts(tcx, shY, hipY, R.shW, R.waistW, coatDrop, !!o.tattered, time, wind, 0);
  const bodyCtx: BodyCtx = {
    tcx, chin, torsoBot: hipY + coatDrop, crown, W, HH, u, ow, light, facing: 0, side: false, back: true, time, wind,
    hands: [armL[2], armR[2]],
  };

  drawArticulatedLimb(p, armL[0], armL[1], armL[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
  drawGauntHand(p, armL[2], armL[1], u, skin, R.claw, false, ow);
  drawArticulatedLimb(p, armR[0], armR[1], armR[2], 22 * u, 16 * u, 11 * u, o.jacket, light, ow);
  drawGauntHand(p, armR[2], armR[1], u, skin, R.claw, false, ow);
  if (holdProp || frontArm === "hold" || action === "peer") o.inFrontHand?.(p, armR[2], bodyCtx);

  // Back of coat with center seam, shoulder-blade shadows, and cross-hatching
  const mainCol = o.dress ?? o.jacket;
  p.gradFill(tp, shade(mainCol, 0.92), mul(mainCol, SH_CLOTH), light);
  p.hatch(tp, light, 10, 1.5, "rgba(10,6,16,0.5)", true);
  p.clip(tp, () => {
    p.stroke([[tcx, shY + 12], [tcx, hipY + coatDrop]], 2.2 * u, "rgba(10,6,16,0.58)");
    p.stroke([[tcx - R.shW * 0.42, shY + 24], [tcx - R.waistW * 0.45, hipY + coatDrop - 12]], 1.8 * u, "rgba(10,6,16,0.45)");
    p.stroke([[tcx + R.shW * 0.42, shY + 24], [tcx + R.waistW * 0.45, hipY + coatDrop - 12]], 1.8 * u, "rgba(10,6,16,0.45)");
    if (o.belt) p.band([[tcx - R.shW, shY + R.torsoH * 0.66], [tcx + R.shW, shY + R.torsoH * 0.66]], o.belt, 10 * u, 1.8 * u);
  });
  p.inkRing(tp, ow, thick);

  // Nape of neck (overlaps cleanly behind skull base during glances)
  p.poly(
    [
      [tcx - 16 * u, chin - 26],
      [tcx + 16 * u, chin - 26],
      [tcx + 22 * u, shY + 18],
      [tcx - 22 * u, shY + 18],
    ],
    mul(skin, [0.65, 0.60, 0.65]),
    ow * 0.7,
  );

  // Back of head OR dramatic over-the-shoulder profile glance!
  const Ah = A + headTilt;
  const [cpx, cpy] = rotAbout([tcx, chin], rad(A), [tcx, hipY]);
  p.rot = Ah ? [rad(Ah), tcx, chin, cpx - tcx, cpy - chin] : null;
  if (glance !== 0) {
    // Dramatic over-the-shoulder glance: draw profile head facing left (-1) or right (+1)
    p.g.save();
    if (glance < 0) {
      p.g.translate(tcx * 2, 0);
      p.g.scale(-1, 1);
    }
    const hp = gothicHeadSide(tcx + 6 * u, hc, R.headW, R.headH, R.gaunt);
    const headCtx: HeadCtx = {
      hp, cx: tcx + 6 * u, hc, W, HH, u, crown, ow: 0.9 * ow, light, thick, seed, facing: 1, side: true, back: false, time, wind,
      rot: (pts: P2[]) => rotPts(pts, 0, tcx + 6 * u, hc),
    };
    o.hatBehind?.(p, headCtx);
    p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, R.headH);
    p.hatch(hp, light, 8.5, 1.3, "rgba(12,7,18,0.38)");
    p.inkRing(hp, ow, thick);
    drawFaceSide(p, tcx + 6 * u, hc, hp, W, expr, lid, shiver, time, o.eyeGlow, o.ageLines, !!o.uncanny, underLight);
    drawBuiltinHeadgear(p, o, headCtx);
    o.hatOn?.(p, headCtx);
    p.g.restore();
  } else {
    const hp = gothicHeadFront(tcx, hc, R.headW, R.headH, 0, R.gaunt);
    const headCtx: HeadCtx = {
      hp, cx: tcx, hc, W, HH, u, crown, ow: 0.9 * ow, light, thick, seed, facing: 0, side: false, back: true, time, wind,
      rot: (pts: P2[]) => rotPts(pts, 0, tcx, hc),
    };
    o.hatBehind?.(p, headCtx);
    p.shadedFill(hp, shade(skin, 0.78), mul(skin, SH_SKIN), light, R.headH);
    // Natural dark back-of-skull hair cover down to the nape so back views never look bald/bare
    const backHairCol = o.hair ?? "#1c1820";
    p.clip(hp, () => {
      const bh: P2[] = [
        [tcx - W * 0.65, crown - 10],
        [tcx + W * 0.65, crown - 10],
        [tcx + W * 0.65, hc + R.headH * 0.42],
        [tcx, hc + R.headH * 0.56],
        [tcx - W * 0.65, hc + R.headH * 0.42],
      ];
      p.gradFill(bh, backHairCol, shade(backHairCol, 0.62), light);
      p.hatch(bh, light, 7, 1.4, "rgba(6,4,10,0.55)");
    });
    p.hatch(hp, light, 8, 1.4, "rgba(12,7,18,0.45)");
    p.inkRing(hp, ow, thick);
    drawBuiltinHeadgear(p, o, headCtx);
    o.hatOn?.(p, headCtx);
  }
  p.rot = null;
};

// ---------------- Upgraded Gothic 2D Atmospheric FX ----------------

/** Soft contact shadow under feet on a 128 x 128 canvas (multiply blend). */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.3, 0.04], [0.5, 0.25], [0.68, 0.62], [0.84, 0.9], [1, 1]] as const) {
    gr.addColorStop(r, mix(col, "#ffffff", k));
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
};

/** Drifting Gothic low-lying mist on 600 x 300 canvas with smooth top+bottom vertical alpha feathering (NEVER leaves hard floor cut!). */
export const fxMist = (p: Pen, t: number, col = "rgba(155,185,220,0.22)") => {
  const g = p.g;
  g.save();
  g.filter = "blur(18px)";
  g.fillStyle = col;
  const wisps: [number, number, number, number, number][] = [
    [120, 155, 130, 38, 1],
    [290, 135, 155, 44, -0.75],
    [460, 165, 135, 36, 0.85],
    [225, 185, 165, 34, 0.55],
    [390, 145, 120, 30, -0.5],
  ];
  for (const [bx, by, rx, ry, dir] of wisps) {
    const x = (((bx + t * 140 * dir) % 600) + 600) % 600;
    const y = by + 9 * Math.sin((t + bx * 0.01) * Math.PI * 2);
    for (const ox of [-600, 0, 600]) {
      g.beginPath();
      g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  // Smooth vertical feathering mask to 0 at both top and bottom edges
  g.save();
  g.globalCompositeOperation = "destination-in";
  const mask = g.createLinearGradient(0, 0, 0, 300);
  mask.addColorStop(0.0, "rgba(0,0,0,0)");
  mask.addColorStop(0.28, "rgba(0,0,0,1)");
  mask.addColorStop(0.72, "rgba(0,0,0,1)");
  mask.addColorStop(1.0, "rgba(0,0,0,0)");
  g.fillStyle = mask;
  g.fillRect(0, 0, 600, 300);
  g.restore();
};

/** Fine needle-sharp Gothic storm rain streaks (140 varying-depth translucent drops on 512 x 768 canvas). */
export const fxRain = (p: Pen, t: number, slant = 0.24, col = "rgba(185,212,240,0.42)") => {
  const g = p.g;
  g.lineCap = "round";
  for (let i = 0; i < 140; i++) {
    const depth = 0.35 + 0.65 * rnd(i + 1, 2);
    const rx = rnd(i + 1, 3), ry = rnd(i + 1, 7);
    const len = (20 + 46 * rnd(i + 1, 11)) * depth;
    const phase = (ry + t * (1.35 + 0.9 * depth)) % 1;
    const y0 = phase * 840 - 72;
    const x0 = (((rx * 512 - y0 * slant * 0.6) % 512) + 512) % 512;
    const gr = g.createLinearGradient(x0, y0, x0 - len * slant, y0 + len);
    gr.addColorStop(0, "rgba(185,212,240,0)");
    gr.addColorStop(0.45, col);
    gr.addColorStop(1, "rgba(220,238,255,0.06)");
    g.strokeStyle = gr;
    g.lineWidth = 0.55 + 0.75 * depth;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x0 - len * slant, y0 + len);
    g.stroke();
  }
};

/** Fractal jagged sky lightning bolt on 400 x 800 canvas. */
export const fxLightning = (p: Pen, seed: number, col = "#c8e4ff") => {
  const g = p.g;
  const pts: P2[] = [[200, 8]];
  let x = 200, y = 8;
  for (let i = 1; i <= 14; i++) {
    x += (rnd(seed * 19 + i, 5) - 0.5) * 76;
    x = clamp(x, 55, 345);
    y = 8 + (i / 14) * 765;
    pts.push([x, y]);
  }
  const trace = (arr: P2[]) => {
    g.beginPath();
    arr.forEach(([px, py], idx) => (idx ? g.lineTo(px, py) : g.moveTo(px, py)));
  };
  g.lineCap = "round";
  g.lineJoin = "round";
  trace(pts); g.strokeStyle = "rgba(130,190,255,0.34)"; g.lineWidth = 22; g.stroke();
  trace(pts); g.strokeStyle = col; g.lineWidth = 7; g.stroke();
  trace(pts); g.strokeStyle = "#ffffff"; g.lineWidth = 2.6; g.stroke();
  for (const bi of [3, 6, 10]) {
    const [sx, sy] = pts[bi];
    const dir = bi % 2 === 0 ? 1 : -1;
    const branch: P2[] = [
      [sx, sy],
      [sx + dir * 36, sy + 52],
      [sx + dir * 68, sy + 124],
      [sx + dir * 94, sy + 188],
    ];
    trace(branch); g.strokeStyle = "rgba(150,205,255,0.45)"; g.lineWidth = 8; g.stroke();
    trace(branch); g.strokeStyle = col; g.lineWidth = 3.2; g.stroke();
    trace(branch); g.strokeStyle = "#ffffff"; g.lineWidth = 1.4; g.stroke();
  }
};

/** Soft atmospheric lantern/candle halo on 400 x 400 soft canvas. */
export const fxFlickerGlow = (p: Pen, intensity = 1, col = "255,175,90") => {
  const g = p.g, a0 = clamp(0.55 * intensity, 0, 1), a1 = clamp(0.24 * intensity, 0, 1);
  const gr = g.createRadialGradient(200, 200, 4, 200, 200, 195);
  gr.addColorStop(0, `rgba(255,246,225,${a0.toFixed(3)})`);
  gr.addColorStop(0.24, `rgba(${col},${a1.toFixed(3)})`);
  gr.addColorStop(0.62, `rgba(${col},${(a1 * 0.30).toFixed(3)})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 400, 400);
};

/** Delicate curling cold night breath vapor trailing organically forward & upward (NO white round dot!). */
export const fxBreath = (p: Pen, t: number, dir = 1) => {
  const g = p.g, u = clamp(t, 0, 1), alpha = Math.sin(u * Math.PI) * 0.24;
  if (alpha <= 0.01) return;
  const s = dir >= 0 ? 1 : -1;
  g.save();
  g.filter = "blur(9px)";
  for (let i = 0; i < 6; i++) {
    const v = clamp(u * 1.35 - i * 0.11, 0, 1);
    if (v <= 0.01) continue;
    const x = 150 + s * (14 + v * (92 + i * 11));
    const y = 175 - v * (38 + i * 8) + Math.sin(v * 6 + i) * 7;
    const rx = 14 + v * 28, ry = 5 + v * 13;
    const a = alpha * (1 - v * 0.65);
    g.fillStyle = `rgba(205,225,245,${a.toFixed(3)})`;
    g.beginPath();
    g.ellipse(x, y, rx, ry, -s * 0.22, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

/** Subtle translucent concentric dark-water ripples for `flat: true` horizontal water placement (512 x 512). */
export const fxWaterRipple = (p: Pen, t: number, col = "165,200,225") => {
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = (t + k / 3) % 1;
    const alpha = Math.sin(u * Math.PI) * 0.42;
    if (alpha <= 0.01) continue;
    const radR = 32 + u * 200;
    g.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
    g.lineWidth = Math.max(1.2, 5.5 * (1 - u));
    g.beginPath();
    g.arc(256, 256, radR, 0, Math.PI * 2);
    g.stroke();
  }
};

/** Dark Gothic churning night-water spray & arcing droplets (translucent, never an opaque blocking wall) on 600 x 600 canvas. */
export const fxSplash = (p: Pen, t: number, tint = "#68889c") => {
  const g = p.g, c = 300, rise = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  g.save();
  g.lineCap = "round";
  if (rise > 0.03) {
    // Organic wispy spray fan streaks
    for (let i = 0; i < 13; i++) {
      const a = rad(205 + i * 11);
      const len = (70 + 135 * ((i % 3) / 2)) * rise;
      const x1 = c + Math.cos(a) * len, y1 = 500 + Math.sin(a) * len;
      g.strokeStyle = tint;
      g.globalAlpha = 0.42 * rise;
      g.lineWidth = 4.5 + (i % 2) * 2.5;
      g.beginPath();
      g.moveTo(c + (i - 6) * 14, 515);
      g.quadraticCurveTo(c + Math.cos(a) * len * 0.55, 505 + Math.sin(a) * len * 0.65, x1, y1);
      g.stroke();
    }
  }
  g.globalAlpha = 0.72 * (1 - t * 0.4);
  for (let i = 0; i < 18; i++) {
    const a = rad(195 + i * 9), d = 65 + 265 * t;
    const x = c + d * Math.cos(a);
    const y = 480 + d * Math.sin(a) + 370 * t * t;
    const r = Math.max(2, 9 * (1 - t));
    if (t > 0.04 && y < 565) p.ell(x, y, r * 0.7, r * 1.35, tint, 1.8);
  }
  g.restore();
};

/** Realistic wet black-mud barefoot prints + dark floor puddle strictly for `flat: true` horizontal decal placement (512 x 512). */
export const fxWetFootprints = (p: Pen, reveal: number, sheenRgb = "220,175,145") => {
  const g = p.g;
  g.save();
  g.globalAlpha = clamp(reveal, 0.02, 1);
  // Subtle dark wet water puddle soaking into wood floorboards (no bright orange ring!)
  const pud = g.createRadialGradient(256, 256, 24, 256, 256, 225);
  pud.addColorStop(0, "rgba(8,12,16,0.72)");
  pud.addColorStop(0.55, "rgba(12,16,20,0.38)");
  pud.addColorStop(1, "rgba(10,14,18,0)");
  g.fillStyle = pud;
  g.beginPath();
  g.ellipse(256, 256, 220, 175, 0.08, 0, Math.PI * 2);
  g.fill();

  const drawFoot = (fx: number, fy: number, rot: number, mirror: number) => {
    g.save();
    g.translate(fx, fy);
    g.rotate(rot);
    g.scale(mirror, 1);
    // Muddy sole & arch silhouette (realistic anatomical footprint curve, NOT two cartoon circles!)
    g.fillStyle = "#080b0e";
    g.beginPath();
    g.moveTo(-22, -48);
    g.bezierCurveTo(-34, -18, -16, 12, -20, 48);
    g.bezierCurveTo(-22, 72, 14, 74, 18, 48);
    g.bezierCurveTo(22, 20, 14, -8, 24, -36);
    g.bezierCurveTo(30, -56, -12, -66, -22, -48);
    g.closePath();
    g.fill();
    // Subtle wet specular rim catching the room's oil lamp
    g.strokeStyle = `rgba(${sheenRgb},0.34)`;
    g.lineWidth = 2.6;
    g.stroke();
    // 5 anatomical toes
    for (const [tx, ty, rx, ry] of [
      [-18, -74, 10.5, 13],
      [-2, -80, 7.2, 10],
      [11, -76, 6.2, 8.8],
      [21, -68, 5.4, 7.6],
      [29, -56, 4.6, 6.4],
    ] as const) {
      g.fillStyle = "#080b0e";
      g.beginPath();
      g.ellipse(tx, ty, rx, ry, 0.12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(${sheenRgb},0.28)`;
      g.lineWidth = 2.0;
      g.stroke();
    }
    // Delicate wet glint droplets
    g.fillStyle = `rgba(${sheenRgb},0.46)`;
    g.beginPath();
    g.ellipse(-10, -40, 8, 3.2, -0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(4, 42, 6, 2.6, 0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  drawFoot(182, 272, -0.10, 1);
  drawFoot(328, 232, 0.08, -1);
  // Stray mud droplets trailing behind
  for (const [dx, dy, r] of [[146, 355, 6], [198, 376, 4.5], [352, 336, 5], [274, 152, 4.5]] as const) {
    g.fillStyle = "rgba(8,11,14,0.85)";
    g.beginPath();
    g.arc(dx, dy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

// ---------------- Subliminal & Uncanny Horror FX Builders ----------------

/** Faint, asymmetric pinpoint eyes peering out of pitch-black reeds, trees, or dark windows (256 x 128). */
export const fxLurkingEyes = (p: Pen, blink = 0, col = "220,238,245") => {
  const g = p.g;
  if (blink > 0.85) return;
  const open = 1 - blink;
  g.save();
  // Dark shadow mask behind eyes so they sink seamlessly into dark foliage/windows
  const bg = g.createRadialGradient(128, 64, 10, 128, 64, 105);
  bg.addColorStop(0, "rgba(3,2,6,0.72)");
  bg.addColorStop(1, "rgba(3,2,6,0)");
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  // Two slightly asymmetric watching eyes (left slightly higher/wider for uncanny valley)
  for (const [ex, ey, rx, ry] of [
    [94, 60, 15, 7.5 * open],
    [164, 67, 13, 6.2 * open],
  ] as const) {
    const halo = g.createRadialGradient(ex, ey, 1, ex, ey, rx * 2.2);
    halo.addColorStop(0, `rgba(${col},0.42)`);
    halo.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = halo;
    g.beginPath();
    g.arc(ex, ey, rx * 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(${col},0.88)`;
    g.beginPath();
    g.ellipse(ex, ey, rx, Math.max(1.2, ry), -0.06, 0, Math.PI * 2);
    g.fill();
    // Razor-small pinpoint pupil staring dead-center
    g.fillStyle = "#040207";
    g.beginPath();
    g.arc(ex, ey, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

/** Pale gaunt clawed hand & elongated fingers pressed weakly against dark window glass from outside (320 x 380). */
export const fxWindowHand = (p: Pen, press = 1, tint = "#aeb8be") => {
  const g = p.g;
  g.save();
  g.globalAlpha = clamp(press, 0.05, 0.82);
  // Faint fogged condensation smudge around palm on cold glass
  const fog = g.createRadialGradient(160, 210, 18, 160, 210, 120);
  fog.addColorStop(0, "rgba(195,212,224,0.22)");
  fog.addColorStop(0.6, "rgba(165,185,200,0.08)");
  fog.addColorStop(1, "rgba(165,185,200,0)");
  g.fillStyle = fog;
  g.fillRect(0, 0, 320, 380);
  p.grit = 1.4;
  // Gaunt narrow wrist & palm pressed against glass
  p.poly([[128, 355], [122, 238], [134, 182], [190, 184], [198, 240], [186, 355]], shade(tint, 0.72), 3.6, "#06040a");
  // 5 impossibly long spindly skeletal fingers splayed across pane
  const fingers: [P2, P2, P2][] = [
    [[128, 224], [84, 194], [62, 162]],
    [[138, 188], [116, 114], [108, 48]],
    [[156, 182], [154, 100], [150, 24]],
    [[174, 184], [186, 108], [194, 42]],
    [[188, 198], [220, 142], [238, 92]],
  ];
  for (const [b, m, tip] of fingers) {
    p.stroke([b, m, tip], 14, "#06040a");
    p.stroke([b, m, tip], 8.5, tint);
    // Pale pressed fingertip pads + black claw smears
    p.dot(tip[0], tip[1], 5.2, "#dce4e8");
    p.drip(tip[0], tip[1] + 4, 24, 1.8, "rgba(6,4,10,0.65)");
  }
  g.restore();
};

/** Gravity-defying floating ash / eerie embers / hair wisps drifting UPWARD against physics (512 x 512). */
export const fxFloatingAsh = (p: Pen, t: number, col = "rgba(210,222,232,0.52)") => {
  const g = p.g;
  g.save();
  for (let i = 0; i < 36; i++) {
    const xBase = rnd(i, 11) * 512;
    const speed = 0.25 + rnd(i, 17) * 0.65;
    const y = ((1 - (t * speed + rnd(i, 23)) % 1) + 1) % 1 * 512;
    const sway = Math.sin(t * 2.4 + i * 1.7) * 18;
    const r = 1.4 + rnd(i, 31) * 3.2;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(xBase + sway, y, r * 1.5, r * 0.65, rnd(i, 37) * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

/** Impossibly elongated distorted clawed shadow-decal (`flat: true`) stretching across floors/planks (512 x 512). */
export const fxLongShadow = (p: Pen, twist = 0, col = "rgba(4,2,8,0.78)") => {
  const g = p.g;
  g.save();
  // Soft feathered dark shadow body stretching top-to-bottom
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(222, 470);
  g.quadraticCurveTo(205 + twist * 22, 310, 224 + twist * 18, 170);
  g.quadraticCurveTo(212 + twist * 14, 118, 256 + twist * 28, 72);
  g.quadraticCurveTo(298 + twist * 14, 118, 286 + twist * 18, 170);
  g.quadraticCurveTo(308 + twist * 22, 310, 290, 470);
  g.closePath();
  g.fill();
  // Elongated spindly skeletal shadow arms & splayed claws reaching forward independently!
  g.strokeStyle = col;
  g.lineCap = "round";
  g.lineWidth = 14;
  for (const s of [-1, 1]) {
    const sx = 256 + s * 32 + twist * 16;
    const ex = 256 + s * 112 + twist * 26;
    const ey = 148 - s * 16;
    g.beginPath();
    g.moveTo(sx, 220);
    g.quadraticCurveTo(sx + s * 54, 188, ex, ey);
    g.stroke();
    // 4 shadow claws
    g.lineWidth = 4.2;
    for (let f = -1.5; f <= 1.5; f += 1) {
      g.beginPath();
      g.moveTo(ex, ey);
      g.lineTo(ex + s * 38 + f * 12, ey - 32 + f * 10);
      g.stroke();
    }
    g.lineWidth = 14;
  }
  g.restore();
};
