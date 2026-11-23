// Horror Engine v3: 512x512 Clean-Line Dark-Horror Animated 2D Face Decal Generator & Cache.
// Non-chibi realistic-stylized almond eyes, contracted pinpoint pupils, soft shaded under-eye hollows,
// expressive brows, and subtle mouths — ZERO cute round chibi eyes, ZERO Pen.grit wobble, ZERO solid sunglass patches.

import * as THREE from "three";
import { clamp01 } from "./camera";
import type { FaceExpr } from "./manifest";

export type MouthShape =
  | "closed"
  | "parted"
  | "talkA"
  | "talkO"
  | "talkE"
  | "tense"
  | "gasp"
  | "unsettlingSmile"
  | "jawSlack";

export type FaceSpec = {
  expr: FaceExpr;
  lid?: number; // 0 = open, 1 = fully shut blink
  gazeX?: number; // -1..+1 horizontal pupil offset
  gazeY?: number; // -1..+1 vertical pupil offset
  pupilScale?: number; // 0.25 (pinpoint terror) .. 1.0 (calm)
  mouth?: MouthShape;
  skinCol?: string;
  eyeHollow?: number; // 0..1 soft under-eye dark hollow shading
  browCol?: string;
  eyeGlow?: boolean;
  ageLines?: boolean;
};

const INK = "#09070d";

const EXPR_DEFAULTS: Record<FaceExpr, { pupil: number; hollow: number; mouth: MouthShape; browTilt: number; browLift: number; upperLidDroop: number }> = {
  calm:            { pupil: 0.78, hollow: 0.35, mouth: "closed",          browTilt:  0.00, browLift:  0, upperLidDroop: 0.14 },
  wary:            { pupil: 0.62, hollow: 0.50, mouth: "closed",          browTilt: -0.18, browLift: -4, upperLidDroop: 0.28 },
  uneasy:          { pupil: 0.52, hollow: 0.65, mouth: "tense",           browTilt:  0.22, browLift:  5, upperLidDroop: 0.18 },
  dread:           { pupil: 0.36, hollow: 0.80, mouth: "parted",          browTilt:  0.34, browLift: 12, upperLidDroop: 0.04 },
  terrified:       { pupil: 0.26, hollow: 0.90, mouth: "gasp",            browTilt:  0.42, browLift: 18, upperLidDroop: 0.00 },
  deadStare:       { pupil: 0.28, hollow: 0.95, mouth: "closed",          browTilt: -0.05, browLift: -6, upperLidDroop: 0.05 },
  unsettlingSmile: { pupil: 0.30, hollow: 0.92, mouth: "unsettlingSmile", browTilt: -0.14, browLift:  8, upperLidDroop: 0.08 },
  hollow:          { pupil: 0.22, hollow: 1.00, mouth: "jawSlack",        browTilt:  0.10, browLift:  4, upperLidDroop: 0.00 },
};

function drawAlmondEye(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: -1 | 1,
  spec: FaceSpec,
  def: (typeof EXPR_DEFAULTS)[FaceExpr],
) {
  const rx = 52;
  const ry = 25;
  const lid = clamp01(spec.lid ?? 0);
  const hollow = clamp01(spec.eyeHollow ?? def.hollow);
  const gazeX = Math.max(-1, Math.min(1, spec.gazeX ?? 0));
  const gazeY = Math.max(-1, Math.min(1, spec.gazeY ?? 0));
  const pupilScale = Math.max(0.22, Math.min(1.0, spec.pupilScale ?? def.pupil));

  // 1. Soft orbital & under-eye dark hollow shading (smooth gradient, NOT a solid black block!)
  if (hollow > 0.02) {
    const gr = g.createRadialGradient(cx, cy + 12, 10, cx, cy + 10, 74);
    gr.addColorStop(0, `rgba(18, 12, 26, ${(0.44 * hollow).toFixed(3)})`);
    gr.addColorStop(0.55, `rgba(24, 16, 34, ${(0.22 * hollow).toFixed(3)})`);
    gr.addColorStop(1, "rgba(24, 16, 34, 0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy + 10, 74, 48, 0, 0, Math.PI * 2);
    g.fill();

    // Subtle crisp tired under-eye bag crease
    g.strokeStyle = `rgba(18, 12, 24, ${(0.42 * hollow).toFixed(3)})`;
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - rx * 0.72, cy + ry + 11);
    g.quadraticCurveTo(cx, cy + ry + 20, cx + rx * 0.78, cy + ry + 9);
    g.stroke();
  }

  // Blink nearly shut: clean curved lash line
  if (lid >= 0.92) {
    g.strokeStyle = INK;
    g.lineWidth = 8.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - rx * 0.95, cy + 3);
    g.quadraticCurveTo(cx, cy + 13, cx + rx * 0.95, cy + 2);
    g.stroke();
    return;
  }

  // Almond eye contour path (slightly sharper outer corner, grounded inner tear duct)
  const traceEye = () => {
    const innerX = cx - side * rx;
    const outerX = cx + side * rx;
    g.beginPath();
    g.moveTo(innerX, cy + 3);
    g.bezierCurveTo(
      cx - side * rx * 0.45, cy - ry * 1.15,
      cx + side * rx * 0.45, cy - ry * 1.08,
      outerX, cy - 2,
    );
    g.bezierCurveTo(
      cx + side * rx * 0.42, cy + ry * 0.96,
      cx - side * rx * 0.42, cy + ry * 1.02,
      innerX, cy + 3,
    );
    g.closePath();
  };

  g.save();
  traceEye();
  g.clip();

  if (spec.expr === "hollow") {
    // Deep sunken void socket for hollow entities
    const voidG = g.createRadialGradient(cx, cy, 4, cx, cy, rx);
    voidG.addColorStop(0, "#050308");
    voidG.addColorStop(1, "#181020");
    g.fillStyle = voidG;
    g.fillRect(cx - rx - 6, cy - ry - 6, rx * 2 + 12, ry * 2 + 12);
    if (spec.eyeGlow) {
      g.fillStyle = "#eef6ff";
      g.beginPath();
      g.arc(cx + gazeX * 14, cy + gazeY * 6, 6.5, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Sclera with soft top-lid shadow band for recessed depth
    const scG = g.createLinearGradient(cx, cy - ry, cx, cy + ry);
    scG.addColorStop(0, "#a9a3ae");
    scG.addColorStop(0.32, "#e8e4dc");
    scG.addColorStop(1, "#dcd7cf");
    g.fillStyle = scG;
    g.fillRect(cx - rx - 6, cy - ry - 6, rx * 2 + 12, ry * 2 + 12);

    // Subtle bloodshot edge veins only in terrified / dread / unsettlingSmile
    if (spec.expr === "terrified" || spec.expr === "dread" || spec.expr === "unsettlingSmile") {
      g.strokeStyle = "rgba(135, 34, 40, 0.34)";
      g.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * (rx - 2), cy + 1);
        g.lineTo(cx + s * (rx - 15), cy - 3);
        g.moveTo(cx + s * (rx - 4), cy + 5);
        g.lineTo(cx + s * (rx - 17), cy + 6);
        g.stroke();
      }
    }

    // Iris & contracted pupil (horror intensity driven by small cold pupils!)
    const ix = cx + gazeX * 18;
    const iy = cy + gazeY * 7;
    const irisR = 19 * (0.48 + 0.52 * pupilScale);
    const pupilR = Math.max(4.5, irisR * (0.56 + 0.14 * (1 - pupilScale)));

    g.fillStyle = "#221d26";
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#060409";
    g.beginPath();
    g.arc(ix, iy, pupilR, 0, Math.PI * 2);
    g.fill();

    // Very tiny muted glint ONLY in calm/wary (dead matte eyes in horror states!)
    if (spec.expr === "calm" || spec.expr === "wary") {
      g.fillStyle = "rgba(245, 240, 232, 0.72)";
      g.beginPath();
      g.arc(ix - irisR * 0.32, iy - irisR * 0.30, Math.max(2.2, irisR * 0.20), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Eyelid curtain (droop + blink)
  const droop = Math.max(def.upperLidDroop, lid);
  if (droop > 0.01) {
    const lidY = cy - ry + droop * (ry * 2.02);
    g.fillStyle = spec.skinCol ?? "#c8b39e";
    g.fillRect(cx - rx - 8, cy - ry - 12, rx * 2 + 16, lidY - (cy - ry - 12));
    g.strokeStyle = INK;
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(cx - rx - 4, lidY);
    g.quadraticCurveTo(cx, lidY + 4, cx + rx + 4, lidY);
    g.stroke();
  }
  g.restore();

  // Crisp upper & lower eye outlines
  const innerX = cx - side * rx;
  const outerX = cx + side * rx;
  g.strokeStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = 7.5;
  g.beginPath();
  g.moveTo(innerX, cy + 3);
  g.bezierCurveTo(
    cx - side * rx * 0.45, cy - ry * 1.15,
    cx + side * rx * 0.45, cy - ry * 1.08,
    outerX, cy - 2,
  );
  g.stroke();

  g.lineWidth = 4.0;
  g.beginPath();
  g.moveTo(outerX, cy - 2);
  g.bezierCurveTo(
    cx + side * rx * 0.42, cy + ry * 0.96,
    cx - side * rx * 0.42, cy + ry * 1.02,
    innerX, cy + 3,
  );
  g.stroke();

  // Subtle upper eyelid crease
  g.strokeStyle = "rgba(18, 12, 24, 0.55)";
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(cx - side * rx * 0.72, cy - ry - 5);
  g.quadraticCurveTo(cx, cy - ry - 13, cx + side * rx * 0.78, cy - ry - 4);
  g.stroke();
}

function drawEyebrow(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: -1 | 1,
  spec: FaceSpec,
  def: (typeof EXPR_DEFAULTS)[FaceExpr],
) {
  const by = cy - 48 - def.browLift;
  const tilt = def.browTilt * 24;
  const innerX = cx - side * 46;
  const outerX = cx + side * 52;
  const innerY = by - tilt;
  const outerY = by + tilt * 0.55 + 4;

  g.strokeStyle = spec.browCol ?? INK;
  g.lineWidth = 10.5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(innerX, innerY);
  g.quadraticCurveTo(cx + side * 6, (innerY + outerY) * 0.5 - 8, outerX, outerY);
  g.stroke();
}

function drawMouth(g: CanvasRenderingContext2D, mouth: MouthShape) {
  const cx = 256;
  const cy = 382;
  g.strokeStyle = INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  if (mouth === "closed") {
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(cx - 34, cy + 2);
    g.quadraticCurveTo(cx, cy - 2, cx + 34, cy + 2);
    g.stroke();
  } else if (mouth === "tense") {
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(cx - 42, cy + 7);
    g.quadraticCurveTo(cx, cy - 4, cx + 42, cy + 7);
    g.stroke();
  } else if (mouth === "parted" || mouth === "talkE") {
    const h = mouth === "talkE" ? 13 : 9;
    const w = mouth === "talkE" ? 36 : 26;
    g.fillStyle = "#1a0b12";
    g.beginPath();
    g.ellipse(cx, cy + 4, w, h, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 5.5;
    g.stroke();
  } else if (mouth === "talkA" || mouth === "talkO") {
    const w = mouth === "talkO" ? 20 : 32;
    const h = mouth === "talkO" ? 20 : 18;
    g.fillStyle = "#180a10";
    g.beginPath();
    g.ellipse(cx, cy + 6, w, h, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6.0;
    g.stroke();
  } else if (mouth === "gasp") {
    // Tense jagged-corner horror gasp (NOT a cute round cartoon O)
    g.fillStyle = "#15070d";
    g.beginPath();
    g.moveTo(cx - 44, cy + 12);
    g.quadraticCurveTo(cx, cy - 10, cx + 44, cy + 12);
    g.quadraticCurveTo(cx, cy + 32, cx - 44, cy + 12);
    g.closePath();
    g.fill();
    g.lineWidth = 6.5;
    g.stroke();
    // Subtle upper teeth rim
    g.fillStyle = "#ddd8ce";
    g.fillRect(cx - 24, cy + 3, 48, 6);
  } else if (mouth === "unsettlingSmile") {
    // Unnaturally wide thin tense horror smile curving high toward cheekbones
    g.lineWidth = 6.5;
    g.beginPath();
    g.moveTo(cx - 72, cy - 10);
    g.bezierCurveTo(cx - 32, cy + 20, cx + 32, cy + 20, cx + 72, cy - 10);
    g.stroke();
    // Faint dark lip parting in center
    g.fillStyle = "#15070d";
    g.beginPath();
    g.ellipse(cx, cy + 7, 38, 6, 0, 0, Math.PI * 2);
    g.fill();
  } else if (mouth === "jawSlack") {
    // Elongated dark drop-jaw void
    g.fillStyle = "#08040a";
    g.beginPath();
    g.ellipse(cx, cy + 24, 34, 48, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 7.0;
    g.stroke();
  }

  // Subtle chin shadow stroke
  g.strokeStyle = "rgba(18, 12, 24, 0.32)";
  g.lineWidth = 3.0;
  g.beginPath();
  g.moveTo(cx - 16, cy + 34);
  g.quadraticCurveTo(cx, cy + 39, cx + 16, cy + 34);
  g.stroke();
}

/** Render a 512x512 clean-line dark-horror face onto a transparent Canvas2D context. */
export function drawFace2D(g: CanvasRenderingContext2D, spec: FaceSpec): void {
  const def = EXPR_DEFAULTS[spec.expr] ?? EXPR_DEFAULTS.calm;
  g.clearRect(0, 0, 512, 512);

  // Subtle brow-furrow crease lines between eyebrows in tense expressions
  if (spec.expr === "uneasy" || spec.expr === "dread" || spec.expr === "terrified" || spec.expr === "wary") {
    g.strokeStyle = "rgba(16, 10, 22, 0.55)";
    g.lineWidth = 3.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(246, 154);
    g.lineTo(244, 182);
    g.moveTo(266, 154);
    g.lineTo(268, 182);
    g.stroke();
  }

  drawAlmondEye(g, 168, 224, -1, spec, def);
  drawAlmondEye(g, 344, 224, 1, spec, def);
  drawEyebrow(g, 168, 224, -1, spec, def);
  drawEyebrow(g, 344, 224, 1, spec, def);

  // Subtle age / gaunt cheekbone lines if requested
  if (spec.ageLines) {
    g.strokeStyle = "rgba(18, 12, 24, 0.36)";
    g.lineWidth = 3.0;
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(256 + s * 64, 304);
      g.quadraticCurveTo(256 + s * 76, 336, 256 + s * 56, 368);
      g.stroke();
    }
  }

  drawMouth(g, spec.mouth ?? def.mouth);
}

/** Caches rendered 512x512 face CanvasTextures by quantized FaceSpec key (safe in headless Node without DOM). */
export class FaceTextureCache {
  private map = new Map<string, THREE.CanvasTexture>();

  private keyOf(s: FaceSpec): string {
    const q = (v: number | undefined, n = 20) => (v === undefined ? "" : Math.round(v * n) / n);
    return JSON.stringify([
      s.expr,
      q(s.lid, 10),
      q(s.gazeX, 10),
      q(s.gazeY, 10),
      q(s.pupilScale, 15),
      s.mouth ?? "",
      s.skinCol ?? "",
      q(s.eyeHollow, 10),
      s.browCol ?? "",
      !!s.eyeGlow,
      !!s.ageLines,
    ]);
  }

  get(spec: FaceSpec): THREE.CanvasTexture {
    const k = this.keyOf(spec);
    let tex = this.map.get(k);
    if (!tex) {
      if (typeof document !== "undefined" && typeof document.createElement === "function") {
        const cv = document.createElement("canvas");
        cv.width = 512;
        cv.height = 512;
        const ctx = cv.getContext("2d");
        if (ctx) drawFace2D(ctx, spec);
        tex = new THREE.CanvasTexture(cv);
      } else {
        // Headless Node unit-test fallback (valid DataTexture-like CanvasTexture stub)
        tex = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      this.map.set(k, tex);
    }
    return tex;
  }

  dispose(): void {
    for (const t of this.map.values()) t.dispose();
    this.map.clear();
  }
}
