// Horror Engine v4: 1024x1024 Gritty Semi-Realistic Dark-Horror Animated 2D Face Decal Generator & Cache.
// Supports both Style B gritty semi-realistic human faces (textured multi-ring iris, sculpted brow/cheek planes,
// natural shaded lips, skin pores, eye bags & subtle sweat) AND primal body-horror eye overlays
// (sanpaku, weepingIchor, voidSockets, stitched, multiEye, cheekSplitGrin).

import * as THREE from "three";
import { clamp01 } from "./camera";
import type { EyeHorrorMode } from "./bodyHorror";
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
  pupilScale?: number; // 0.22 (pinpoint terror) .. 1.0 (calm)
  mouth?: MouthShape;
  skinCol?: string;
  eyeHollow?: number; // 0..1 soft under-eye dark hollow shading
  browCol?: string;
  eyeGlow?: boolean;
  ageLines?: boolean;
  sweat?: boolean; // subtle cold sweat bead on temple (auto-enabled in terrified)
  realisticStyle?: boolean; // default true (v4 Style B): softer lash shading, textured iris, shaded lips
  pixelFace?: boolean; // v4.5 PSX low-poly mode: deeper orbital eye shadows & stronger facial contrast for 360x640 pixelation
  uncannyRealism?: boolean; // v5.0 opt-in PS1 Silent Hill / Mouthwashing harsh charcoal & flash-lit facial shading
  eyeHorror?: EyeHorrorMode;
  cheekSplitGrin?: boolean;
};

const INK = "#120d16";

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
  const rx = 68;
  const ry = 32;
  const lid = clamp01(spec.lid ?? 0);
  const hollow = clamp01(spec.eyeHollow ?? def.hollow);
  const gazeX = Math.max(-1, Math.min(1, spec.gazeX ?? 0));
  const gazeY = Math.max(-1, Math.min(1, spec.gazeY ?? 0));
  const pupilScale = Math.max(0.22, Math.min(1.0, spec.pupilScale ?? def.pupil));

  // 1. Soft orbital & under-eye dark hollow shading (deeper sunken PSX/Uncanny hollows!)
  const pfBoost = spec.uncannyRealism ? 1.82 : spec.pixelFace ? 1.48 : 1.0;
  if (hollow > 0.02 || spec.pixelFace || spec.uncannyRealism) {
    const hVal = Math.max(hollow, spec.uncannyRealism ? 0.78 : spec.pixelFace ? 0.65 : 0);
    const gr = g.createRadialGradient(cx, cy + 12, 10, cx, cy + 10, spec.uncannyRealism ? 114 : spec.pixelFace ? 104 : 94);
    gr.addColorStop(0, `rgba(9, 5, 14, ${Math.min(0.94, 0.56 * hVal * pfBoost).toFixed(3)})`);
    gr.addColorStop(0.55, `rgba(16, 10, 22, ${Math.min(0.68, 0.28 * hVal * pfBoost).toFixed(3)})`);
    gr.addColorStop(1, "rgba(22, 14, 32, 0)");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy + 10, spec.uncannyRealism ? 110 : spec.pixelFace ? 102 : 94, spec.uncannyRealism ? 74 : spec.pixelFace ? 66 : 58, 0, 0, Math.PI * 2);
    g.fill();

    // Subtle crisp tired under-eye bag crease
    g.strokeStyle = `rgba(14, 8, 20, ${Math.min(0.75, 0.48 * hVal * pfBoost).toFixed(3)})`;
    g.lineWidth = spec.pixelFace ? 5.2 : 4.0;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - rx * 0.72, cy + ry + 12);
    g.quadraticCurveTo(cx, cy + ry + 23, cx + rx * 0.78, cy + ry + 10);
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
    // Sclera with soft top-lid shadow band (desaturated uneasy ash-ochre sclera in uncannyRealism mode)
    const scG = g.createLinearGradient(cx, cy - ry, cx, cy + ry);
    scG.addColorStop(0, spec.uncannyRealism ? "#7c757e" : "#a9a3ae");
    scG.addColorStop(0.32, spec.uncannyRealism ? "#cbc4b8" : "#e8e4dc");
    scG.addColorStop(1, spec.uncannyRealism ? "#b6afa4" : "#dcd7cf");
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

    // Iris & contracted pupil (multi-ring textured iris in v4 Style B — kills flat cartoon dot look!)
    const ix = cx + gazeX * 20;
    const iy = cy + gazeY * 8;
    const isSanpaku = spec.eyeHorror === "sanpaku" || spec.eyeHorror === "weepingIchor";
    const irisR = (isSanpaku ? 16 : 23) * (0.48 + 0.52 * pupilScale);
    const pupilR = Math.max(4.0, irisR * (isSanpaku ? 0.44 : 0.54 + 0.14 * (1 - pupilScale)));

    // Outer dark limbal ring + deep textured brown-charcoal iris gradient
    const irG = g.createRadialGradient(ix, iy, pupilR * 0.8, ix, iy, irisR);
    irG.addColorStop(0, "#120c10");
    irG.addColorStop(0.55, isSanpaku ? "#594c3e" : "#3a2822");
    irG.addColorStop(0.84, "#1e161c");
    irG.addColorStop(1, "#0d0910");
    g.fillStyle = irG;
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fill();

    // Subtle radial iris fibers
    g.strokeStyle = "rgba(116, 86, 68, 0.24)";
    g.lineWidth = 1.1;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * (pupilR + 1), iy + Math.sin(a) * (pupilR + 1));
      g.lineTo(ix + Math.cos(a) * (irisR - 1.5), iy + Math.sin(a) * (irisR - 1.5));
      g.stroke();
    }

    g.fillStyle = "#040307";
    g.beginPath();
    g.arc(ix, iy, pupilR, 0, Math.PI * 2);
    g.fill();

    // Crisp tiny moist cornea specular glint
    const glintAlpha = spec.expr === "calm" || spec.expr === "wary" ? 0.82 : 0.46;
    g.fillStyle = `rgba(246, 242, 234, ${glintAlpha})`;
    g.beginPath();
    g.arc(ix - irisR * 0.30, iy - irisR * 0.28, Math.max(2.0, irisR * 0.18), 0, Math.PI * 2);
    g.fill();
  }

  // Eyelid curtain (droop + blink)
  const droop = Math.max(def.upperLidDroop, lid);
  if (droop > 0.01 && !spec.eyeHorror) {
    const lidY = cy - ry + droop * (ry * 2.02);
    g.fillStyle = spec.skinCol ?? "#c8b39e";
    g.fillRect(cx - rx - 8, cy - ry - 12, rx * 2 + 16, lidY - (cy - ry - 12));
    g.strokeStyle = "rgba(18, 12, 20, 0.85)";
    g.lineWidth = spec.realisticStyle === false ? 6.5 : 4.2;
    g.beginPath();
    g.moveTo(cx - rx - 4, lidY);
    g.quadraticCurveTo(cx, lidY + 4, cx + rx + 4, lidY);
    g.stroke();
  }
  g.restore();

  // Upper & lower lash framing (softer realistic lid shadow in Style B, bolder ink only when realisticStyle === false)
  const realB = spec.realisticStyle !== false;
  const innerX = cx - side * rx;
  const outerX = cx + side * rx;
  g.strokeStyle = realB ? "rgba(18, 12, 18, 0.86)" : INK;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = realB ? 6.4 : 10.0;
  g.beginPath();
  g.moveTo(innerX, cy + 3);
  g.bezierCurveTo(
    cx - side * rx * 0.45, cy - ry * 1.15,
    cx + side * rx * 0.45, cy - ry * 1.08,
    outerX, cy - 2,
  );
  g.stroke();

  g.strokeStyle = realB ? "rgba(38, 24, 30, 0.56)" : INK;
  g.lineWidth = realB ? 3.2 : 5.2;
  g.beginPath();
  g.moveTo(outerX, cy - 2);
  g.bezierCurveTo(
    cx + side * rx * 0.42, cy + ry * 0.96,
    cx - side * rx * 0.42, cy + ry * 1.02,
    innerX, cy + 3,
  );
  g.stroke();

  // Upper eyelid depth fold
  g.strokeStyle = "rgba(22, 14, 24, 0.58)";
  g.lineWidth = 3.0;
  g.beginPath();
  g.moveTo(cx - side * rx * 0.78, cy - ry - 7);
  g.quadraticCurveTo(cx, cy - ry - 17, cx + side * rx * 0.82, cy - ry - 5);
  g.stroke();

  // Weeping dark ichor trails painted onto cheekbones when requested
  if (spec.eyeHorror === "weepingIchor") {
    for (let k = 0; k < 3; k++) {
      const tx = cx + (k - 1) * 20;
      const len = 72 + k * 24;
      const gr = g.createLinearGradient(tx, cy + ry, tx, cy + ry + len);
      gr.addColorStop(0, "rgba(12, 4, 8, 0.88)");
      gr.addColorStop(0.65, "rgba(32, 6, 10, 0.62)");
      gr.addColorStop(1, "rgba(24, 6, 10, 0)");
      g.fillStyle = gr;
      g.fillRect(tx - 4, cy + ry - 2, 7.5 - k, len);
    }
  } else if (spec.eyeHorror === "stitched") {
    g.strokeStyle = "#110d14";
    g.lineWidth = 5.5;
    for (let k = -2; k <= 2; k++) {
      const sx = cx + k * 24;
      g.beginPath();
      g.moveTo(sx - 8, cy - ry - 10);
      g.lineTo(sx + 8, cy + ry + 10);
      g.stroke();
    }
  }
}

function drawEyebrow(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  side: -1 | 1,
  spec: FaceSpec,
  def: (typeof EXPR_DEFAULTS)[FaceExpr],
) {
  const by = cy - 56 - def.browLift;
  const tilt = def.browTilt * 26;
  const innerX = cx - side * 56;
  const outerX = cx + side * 66;
  const innerY = by - tilt;
  const outerY = by + tilt * 0.55 + 5;

  // Textured layered eyebrow hairs instead of single plastic marker stroke
  g.strokeStyle = spec.browCol ?? "rgba(22, 16, 20, 0.88)";
  g.lineWidth = 10.5;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(innerX, innerY);
  g.quadraticCurveTo(cx + side * 6, (innerY + outerY) * 0.5 - 9, outerX, outerY);
  g.stroke();

  g.strokeStyle = "rgba(14, 10, 14, 0.52)";
  g.lineWidth = 2.4;
  for (let i = 0; i < 11; i++) {
    const u = i / 10;
    const hx = innerX + (outerX - innerX) * u;
    const hy = innerY + (outerY - innerY) * u - Math.sin(u * Math.PI) * 5;
    g.beginPath();
    g.moveTo(hx, hy + 5);
    g.lineTo(hx + side * 8, hy - 6);
    g.stroke();
  }
}

function drawMouth(g: CanvasRenderingContext2D, mouth: MouthShape, spec: FaceSpec) {
  const cx = 256;
  const cy = 406;
  const realB = spec.realisticStyle !== false;

  // Soft realistic upper & lower lip shading pillow + lower-lip cushion (eliminates cartoon flat mouth look!)
  if (realB && mouth !== "jawSlack") {
    const lipG = g.createRadialGradient(cx, cy + 4, 8, cx, cy + 6, 68);
    lipG.addColorStop(0, "rgba(116, 64, 58, 0.56)");
    lipG.addColorStop(0.55, "rgba(92, 48, 48, 0.30)");
    lipG.addColorStop(1, "rgba(86, 46, 48, 0)");
    g.fillStyle = lipG;
    g.beginPath();
    g.ellipse(cx, cy + 5, 62, 24, 0, 0, Math.PI * 2);
    g.fill();

    // Subtle weathered lower-lip highlight & chin shadow
    g.fillStyle = "rgba(215, 178, 156, 0.14)";
    g.beginPath();
    g.ellipse(cx, cy + 16, 30, 7, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = realB ? "rgba(24, 12, 16, 0.86)" : INK;
  g.lineCap = "round";
  g.lineJoin = "round";

  if (mouth === "closed") {
    g.lineWidth = realB ? 5.2 : 8.0;
    g.beginPath();
    g.moveTo(cx - 48, cy + 2);
    g.quadraticCurveTo(cx, cy - 3, cx + 48, cy + 2);
    g.stroke();
  } else if (mouth === "tense") {
    g.lineWidth = realB ? 5.5 : 8.0;
    g.beginPath();
    g.moveTo(cx - 56, cy + 9);
    g.quadraticCurveTo(cx, cy - 5, cx + 56, cy + 9);
    g.stroke();
  } else if (mouth === "parted" || mouth === "talkE") {
    const h = mouth === "talkE" ? 15 : 11;
    const w = mouth === "talkE" ? 46 : 34;
    g.fillStyle = "#16080e";
    g.beginPath();
    g.ellipse(cx, cy + 4, w, h, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = realB ? 4.4 : 6.5;
    g.stroke();
    if (mouth === "talkE") {
      g.fillStyle = "#d4cbbd";
      g.fillRect(cx - 24, cy - 2, 48, 5);
    }
  } else if (mouth === "talkA" || mouth === "talkO") {
    const w = mouth === "talkO" ? 20 : 32;
    const h = mouth === "talkO" ? 20 : 18;
    g.fillStyle = "#15070c";
    g.beginPath();
    g.ellipse(cx, cy + 6, w, h, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = realB ? 4.4 : 6.0;
    g.stroke();
  } else if (mouth === "gasp") {
    g.fillStyle = "#12050a";
    g.beginPath();
    g.moveTo(cx - 44, cy + 12);
    g.quadraticCurveTo(cx, cy - 10, cx + 44, cy + 12);
    g.quadraticCurveTo(cx, cy + 32, cx - 44, cy + 12);
    g.closePath();
    g.fill();
    g.lineWidth = realB ? 4.6 : 6.5;
    g.stroke();
    g.fillStyle = "#d8d1c4";
    g.fillRect(cx - 24, cy + 3, 48, 6);
  } else if (mouth === "unsettlingSmile") {
    g.lineWidth = realB ? 5.2 : 6.5;
    g.beginPath();
    g.moveTo(cx - 76, cy - 12);
    g.bezierCurveTo(cx - 34, cy + 22, cx + 34, cy + 22, cx + 76, cy - 12);
    g.stroke();
    g.fillStyle = "#13050b";
    g.beginPath();
    g.ellipse(cx, cy + 7, 44, 7, 0, 0, Math.PI * 2);
    g.fill();
  } else if (mouth === "jawSlack") {
    g.fillStyle = "#060208";
    g.beginPath();
    g.ellipse(cx, cy + 24, 38, 52, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 6.0;
    g.stroke();
  }

  // Torn bloody cheek-split grin scars extending past corners of mouth
  if (spec.cheekSplitGrin) {
    g.strokeStyle = "rgba(86, 12, 16, 0.85)";
    g.lineWidth = 5.5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 46, cy + 4);
      g.quadraticCurveTo(cx + s * 92, cy - 6, cx + s * 134, cy - 28);
      g.stroke();
    }
  }

  // Subtle lower-lip & chin cleft shadow
  g.strokeStyle = "rgba(18, 12, 24, 0.36)";
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(cx - 18, cy + 32);
  g.quadraticCurveTo(cx, cy + 38, cx + 18, cy + 32);
  g.stroke();
}

/** Render a 1024x1024 (logical 512x512 × 2x HiDPI) gritty dark-horror face onto transparent Canvas2D. */
export function drawFace2D(g: CanvasRenderingContext2D, spec: FaceSpec): void {
  const def = EXPR_DEFAULTS[spec.expr] ?? EXPR_DEFAULTS.calm;
  const hollow = clamp01(spec.eyeHollow ?? def.hollow);
  const w = g.canvas?.width || 512;
  const scale = w / 512;
  g.save();
  g.clearRect(0, 0, w, w);
  g.scale(scale, scale);

  // 1. Sculpted brow overhang shadow + sunken gaunt cheekbones + weathered nose/jaw planes
  const browShade = g.createLinearGradient(256, 114, 256, 214);
  browShade.addColorStop(0, `rgba(18, 11, 22, ${(0.28 + 0.16 * hollow).toFixed(3)})`);
  browShade.addColorStop(0.55, `rgba(22, 14, 28, ${(0.14 + 0.10 * hollow).toFixed(3)})`);
  browShade.addColorStop(1, "rgba(22, 14, 28, 0)");
  g.fillStyle = browShade;
  g.beginPath();
  g.ellipse(256, 178, 218, 66, 0, 0, Math.PI * 2);
  g.fill();

  for (const s of [-1, 1] as const) {
    const cx = 256 + s * 168;
    const cy = 326;
    const ck = g.createRadialGradient(cx, cy, 8, cx, cy, 104);
    ck.addColorStop(0, `rgba(20, 12, 24, ${(0.24 + 0.26 * hollow).toFixed(3)})`);
    ck.addColorStop(0.62, `rgba(22, 14, 26, ${(0.10 + 0.12 * hollow).toFixed(3)})`);
    ck.addColorStop(1, "rgba(22, 14, 26, 0)");
    g.fillStyle = ck;
    g.beginPath();
    g.ellipse(cx, cy, 88, 114, s * 0.26, 0, Math.PI * 2);
    g.fill();
  }

  // Nose-bridge & nostril shadow anchor
  const noseShade = g.createRadialGradient(256, 308, 4, 256, 314, 46);
  noseShade.addColorStop(0, "rgba(20, 12, 22, 0.30)");
  noseShade.addColorStop(1, "rgba(20, 12, 22, 0)");
  g.fillStyle = noseShade;
  g.beginPath();
  g.ellipse(256, 314, 36, 28, 0, 0, Math.PI * 2);
  g.fill();

  // Subtle vertical philtrum shadow lines
  g.strokeStyle = "rgba(22, 14, 24, 0.26)";
  g.lineWidth = 2.6;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(248, 336);
  g.lineTo(246, 372);
  g.moveTo(264, 336);
  g.lineTo(266, 372);
  g.stroke();

  // Brow-furrow & forehead worry wrinkles
  if (spec.expr === "uneasy" || spec.expr === "dread" || spec.expr === "terrified" || spec.expr === "wary" || spec.ageLines) {
    g.strokeStyle = "rgba(18, 11, 20, 0.66)";
    g.lineWidth = 3.6;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(245, 146);
    g.lineTo(243, 184);
    g.moveTo(267, 146);
    g.lineTo(269, 184);
    g.stroke();
    if (spec.expr === "dread" || spec.expr === "terrified" || spec.ageLines) {
      g.strokeStyle = "rgba(18, 12, 22, 0.38)";
      g.lineWidth = 2.4;
      for (const fy of [104, 120]) {
        g.beginPath();
        g.moveTo(186, fy);
        g.quadraticCurveTo(256, fy + 8, 326, fy);
        g.stroke();
      }
    }
  }

  drawAlmondEye(g, 148, 222, -1, spec, def);
  drawAlmondEye(g, 364, 222, 1, spec, def);
  drawEyebrow(g, 148, 222, -1, spec, def);
  drawEyebrow(g, 364, 222, 1, spec, def);

  // Gaunt nasolabial & crow's-feet creases
  if (spec.ageLines || spec.expr === "dread" || spec.expr === "terrified" || spec.expr === "deadStare") {
    g.strokeStyle = `rgba(18, 12, 22, ${spec.ageLines ? "0.48" : "0.30"})`;
    g.lineWidth = 3.0;
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(256 + s * 60, 312);
      g.quadraticCurveTo(256 + s * 78, 352, 256 + s * 62, 394);
      g.stroke();
      if (spec.ageLines) {
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(256 + s * 176, 220);
        g.lineTo(256 + s * 204, 212);
        g.moveTo(256 + s * 176, 228);
        g.lineTo(256 + s * 202, 234);
        g.stroke();
        g.lineWidth = 3.0;
      }
    }
  }

  // Subtle realistic cold sweat droplet on temple
  if (spec.sweat || spec.expr === "terrified") {
    g.fillStyle = "rgba(218, 228, 240, 0.52)";
    g.strokeStyle = "rgba(24, 20, 32, 0.36)";
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(432, 168);
    g.quadraticCurveTo(440, 194, 432, 202);
    g.quadraticCurveTo(424, 194, 432, 168);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Subtle weathered jaw stubble & sunken chin-side shadow for gritty Style B adult depth
  if (spec.ageLines) {
    const stubG = g.createRadialGradient(256, 438, 18, 256, 418, 175);
    stubG.addColorStop(0, "rgba(22, 16, 18, 0.28)");
    stubG.addColorStop(0.6, "rgba(26, 20, 22, 0.14)");
    stubG.addColorStop(1, "rgba(26, 20, 22, 0)");
    g.fillStyle = stubG;
    g.beginPath();
    g.ellipse(256, 424, 168, 92, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Uncanny PS1 charcoal cheek-plane shadows, deeper nasolabial creases & weathered flash-lit skin grain (opt-in!)
  if (spec.uncannyRealism) {
    // Sunken buccal hollows & bruised temple shading
    for (const s of [-1, 1] as const) {
      const hx = 256 + s * 138;
      const hy = 352;
      const hg = g.createRadialGradient(hx, hy, 6, hx, hy, 88);
      hg.addColorStop(0, "rgba(12, 7, 15, 0.56)");
      hg.addColorStop(0.65, "rgba(18, 12, 22, 0.24)");
      hg.addColorStop(1, "rgba(18, 12, 22, 0)");
      g.fillStyle = hg;
      g.beginPath();
      g.ellipse(hx, hy, 68, 96, s * 0.22, 0, Math.PI * 2);
      g.fill();

      // Deep gaunt nasolabial fold & lower-lip shadow crease
      g.strokeStyle = "rgba(14, 8, 16, 0.62)";
      g.lineWidth = 4.2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(256 + s * 54, 308);
      g.quadraticCurveTo(256 + s * 78, 354, 256 + s * 60, 404);
      g.stroke();
    }
    // Deterministic weathered PS1 facial film/pore stipple (kills plastic smooth skin!)
    for (let i = 0; i < 420; i++) {
      const h1 = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const h2 = Math.sin(i * 93.9898 + 19.137) * 43758.5453;
      const rx = (h1 - Math.floor(h1)) * 410 + 51;
      const ry = (h2 - Math.floor(h2)) * 410 + 51;
      g.fillStyle = i % 3 === 0 ? "rgba(12, 8, 14, 0.22)" : "rgba(218, 206, 194, 0.11)";
      g.fillRect(rx, ry, 3.2, 3.2);
    }
  }

  drawMouth(g, spec.mouth ?? def.mouth, spec);
  g.restore();
}

/** Caches rendered 1024x1024 face CanvasTextures by quantized FaceSpec key (safe in headless Node without DOM). */
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
      !!s.sweat,
      s.realisticStyle !== false,
      !!s.pixelFace,
      !!s.uncannyRealism,
      s.eyeHorror ?? "",
      !!s.cheekSplitGrin,
    ]);
  }

  get(spec: FaceSpec): THREE.CanvasTexture {
    const k = this.keyOf(spec);
    let tex = this.map.get(k);
    if (!tex) {
      if (typeof document !== "undefined" && typeof document.createElement === "function") {
        const cv = document.createElement("canvas");
        cv.width = 1024;
        cv.height = 1024;
        const ctx = cv.getContext("2d");
        if (ctx) drawFace2D(ctx, spec);
        tex = new THREE.CanvasTexture(cv);
      } else {
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
