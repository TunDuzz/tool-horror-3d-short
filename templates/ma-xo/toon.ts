// Gothic Ink-Noir character outfits & custom perspective-locked 2D FX for "Ma Xo — Bat Sut Sau Bep Ong Tao".
// Strict engine neutrality: all Ma Xo character hooks & ash FX live cleanly in src/ma-xo/toon.ts.

import { BodyCtx, HeadCtx, INK, Outfit, P2, Pen, TorsoCtx } from "../engine";

/** Lan's dark tied Vietnamese low bun hair with subtle loose ink strands (rounded silhouette in front/side/back!). */
const drawLanHair = (p: Pen, ctx: HeadCtx) => {
  const { cx, crown, hc, W, HH, u, light, ow, time, wind, side, back } = ctx;
  const sw = Math.sin(time * 2.1) * (2.5 + 6 * wind) * u;
  if (back) {
    const cap: P2[] = [
      [cx - W * 0.56, hc + HH * 0.16],
      [cx - W * 0.54, hc - HH * 0.24],
      [cx - W * 0.34, crown - HH * 0.05],
      [cx, crown - HH * 0.09],
      [cx + W * 0.34, crown - HH * 0.05],
      [cx + W * 0.54, hc - HH * 0.24],
      [cx + W * 0.56, hc + HH * 0.16],
      [cx + W * 0.38, hc + HH * 0.34],
      [cx, hc + HH * 0.42],
      [cx - W * 0.38, hc + HH * 0.34],
    ];
    p.gradFill(cap, "#1b1a20", "#08070c", light);
    p.poly(cap, null, ow * 0.9, INK);
    // Low tied chignon bun at nape
    p.dot(cx, hc + HH * 0.36, 16 * u, "#131118");
    p.stroke([[cx - 12 * u, hc + HH * 0.36], [cx + 12 * u, hc + HH * 0.36]], 2.2 * u, "#4a3e38");
    return;
  }
  if (side) {
    const hairSide: P2[] = [
      [cx + W * 0.46, hc - HH * 0.18],
      [cx + W * 0.20, crown - HH * 0.06],
      [cx - W * 0.36, crown - HH * 0.04],
      [cx - W * 0.58, hc - HH * 0.04],
      [cx - W * 0.54, hc + HH * 0.28],
      [cx - W * 0.20, hc + HH * 0.16],
      [cx - W * 0.04, hc - HH * 0.08],
      [cx + W * 0.18, hc - HH * 0.14],
    ];
    p.gradFill(hairSide, "#1b1a20", "#08070c", light);
    p.poly(hairSide, null, ow * 0.9, INK);
    p.dot(cx - W * 0.58, hc + HH * 0.22, 14 * u, "#131118");
    return;
  }
  const hairTop: P2[] = [
    [cx - W * 0.56, hc + HH * 0.08],
    [cx - W * 0.54, hc - HH * 0.24],
    [cx - W * 0.34, crown - HH * 0.05],
    [cx, crown - HH * 0.09],
    [cx + W * 0.34, crown - HH * 0.05],
    [cx + W * 0.54, hc - HH * 0.24],
    [cx + W * 0.56, hc + HH * 0.08],
    [cx + W * 0.38, crown + HH * 0.20],
    [cx + W * 0.06, crown + HH * 0.12],
    [cx - W * 0.28, crown + HH * 0.22],
  ];
  p.gradFill(hairTop, "#1b1a20", "#08070c", light);
  p.poly(hairTop, null, ow * 0.9, INK);
  p.stroke([[cx - W * 0.52, hc + HH * 0.04], [cx - W * 0.56 + sw * 0.5, hc + HH * 0.48]], 3.8 * u, "#121118");
  p.stroke([[cx + W * 0.50, hc + HH * 0.06], [cx + W * 0.54 + sw * 0.4, hc + HH * 0.42]], 3.4 * u, "#121118");
};

/** Low tied hair bun visible behind head/neck. */
const drawLanBunBehind = (p: Pen, ctx: HeadCtx) => {
  const { cx, hc, W, HH, light, ow, back } = ctx;
  if (back) return;
  const bun: P2[] = [
    [cx - W * 0.42, hc + HH * 0.14],
    [cx + W * 0.44, hc + HH * 0.14],
    [cx + W * 0.50, hc + HH * 0.46],
    [cx, hc + HH * 0.58],
    [cx - W * 0.50, hc + HH * 0.46],
  ];
  p.gradFill(bun, "#18161d", "#07060b", light);
  p.poly(bun, null, ow * 0.85, INK);
};

/** Traditional warm glowing brass oil lamp held in Lan's front hand. */
const drawLanOilLamp = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow, time } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 4 * u, ly = hy + 28 * u;
  const fl = 0.88 + 0.12 * Math.sin(time * 24);
  const g = p.g;
  g.save();
  const gr = g.createRadialGradient(lx, ly - 4 * u, 3 * u, lx, ly - 4 * u, 54 * u);
  gr.addColorStop(0, `rgba(255,215,120,${0.66 * fl})`);
  gr.addColorStop(0.5, `rgba(255,148,58,${0.26 * fl})`);
  gr.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(lx, ly - 4 * u, 54 * u, 0, Math.PI * 2);
  g.fill();
  g.restore();

  p.stroke([[hx - 3 * u, hy + 2 * u], [lx, ly - 18 * u], [hx + 4 * u, hy + 2 * u]], 2.0 * u, INK);
  p.poly(
    [
      [lx - 6 * u, ly - 17 * u],
      [lx + 6 * u, ly - 17 * u],
      [lx + 10 * u, ly + 4 * u],
      [lx - 10 * u, ly + 4 * u],
    ],
    "#f8c86a",
    1.6 * u,
  );
  p.poly([[lx, ly - 10 * u], [lx + 4 * u, ly - 1 * u], [lx, ly + 3 * u], [lx - 4 * u, ly - 1 * u]], "#fff9dc", 0);
  p.poly([[lx - 11 * u, ly + 4 * u], [lx + 11 * u, ly + 4 * u], [lx + 13 * u, ly + 15 * u], [lx - 13 * u, ly + 15 * u]], "#2a2422", ow * 0.65);
};

const drawLanAoBaBaButtons = (p: Pen, ctx: TorsoCtx) => {
  const { tcx, chin, torsoBot, u } = ctx;
  p.stroke([[tcx, chin + 12 * u], [tcx, torsoBot - 8 * u]], 2.4 * u, INK);
  for (let i = 0; i < 4; i++) {
    const by = chin + (torsoBot - chin) * (0.24 + i * 0.17);
    p.dot(tcx + 3 * u, by, 3.6 * u, "#d4cab8");
  }
};

export const LAN_LAMP: Outfit = {
  build: "adult",
  jacket: "#4f5954",
  pants: "#1c1a20",
  boots: "#110f15",
  skin: "#c6b9ac",
  coatLen: 0.44,
  hat: null,
  hatBehind: drawLanBunBehind,
  hatOn: drawLanHair,
  torsoDetail: drawLanAoBaBaButtons,
  inFrontHand: drawLanOilLamp,
};

export const LAN_NO_LAMP: Outfit = {
  ...LAN_LAMP,
  inFrontHand: undefined,
};

/** Ma Xó's skull-hugging straggly cobweb-matted black hair (never swallows face or flares into a wing!). */
const drawMaXoHairBehind = (p: Pen, ctx: HeadCtx) => {
  const { cx, crown, hc, W, HH, u, light, ow, time, wind } = ctx;
  const sw = Math.sin(time * 3.1) * (3 + 7 * wind) * u;
  const drape: P2[] = [
    [cx - W * 0.58, crown + 6 * u],
    [cx + W * 0.58, crown + 6 * u],
    [cx + W * 0.68 + sw, hc + HH * 0.86],
    [cx + W * 0.34 + sw * 0.6, hc + HH * 1.02],
    [cx - W * 0.34 + sw * 0.6, hc + HH * 1.00],
    [cx - W * 0.66 + sw, hc + HH * 0.84],
  ];
  p.gradFill(drape, "#18181c", "#050508", light);
  p.poly(drape, null, ow * 0.85, INK);
};

const drawMaXoHairTop = (p: Pen, ctx: HeadCtx) => {
  const { cx, crown, hc, W, HH, u, light, ow, time, wind } = ctx;
  const sw = Math.sin(time * 2.8) * (3 + 6 * wind) * u;
  const crownHair: P2[] = [
    [cx - W * 0.56, hc + HH * 0.04],
    [cx - W * 0.54, crown - 8 * u],
    [cx - W * 0.14, crown - 14 * u],
    [cx + W * 0.30, crown - 12 * u],
    [cx + W * 0.58, crown - 4 * u],
    [cx + W * 0.56, hc + HH * 0.06],
    [cx + W * 0.30, crown + HH * 0.20],
    [cx + W * 0.02, crown + HH * 0.08],
    [cx - W * 0.26, crown + HH * 0.22],
  ];
  p.gradFill(crownHair, "#1b1a20", "#06050a", light);
  p.poly(crownHair, null, ow * 0.85, INK);
  // Thin straggly strands framing cheeks (kept clear of hollow glowing eyes!)
  for (const [fx, len] of [[-0.50, 0.72], [-0.34, 0.36], [0.36, 0.40], [0.52, 0.74]] as const) {
    p.stroke(
      [
        [cx + fx * W, crown + HH * 0.14],
        [cx + fx * W + sw * 0.5, hc + HH * len],
      ],
      3.0 * u,
      "#0b0a0f",
    );
  }
  p.stroke([[cx - W * 0.48, crown + 2 * u], [cx + W * 0.46, crown + 12 * u]], 1.3 * u, "rgba(210,220,218,0.36)");
};

/** Ma Xó — hunched gaunt hearth spirit coated in grey wood-ash, soot streaks, tattered soot-black rags & hollow pale pinpoints. */
export const MA_XO_ENTITY: Outfit = {
  build: "gaunt",
  uncanny: true,
  jacket: "#212026",
  pants: "#111016",
  boots: "#09080c",
  dress: "#1b1a20",
  coatLen: 0.64,
  tattered: true,
  skin: "#9aa4a0",
  eyeGlow: "#e6f2ee",
  hat: null,
  hatBehind: drawMaXoHairBehind,
  hatOn: drawMaXoHairTop,
  torsoDetail: (p, ctx) => {
    const { tcx, chin, torsoBot, u, time, wind } = ctx;
    const sw = Math.sin(time * 2.6) * (3 + 7 * wind) * u;
    // Diagonal dry wood-ash dust streaks across tattered cloak (organic strokes, zero polka dots!)
    for (const [x0, y0, x1, y1] of [
      [-24, 0.24, -6, 0.42],
      [18, 0.32, 4, 0.52],
      [-18, 0.56, 8, 0.72],
      [22, 0.62, 6, 0.82],
    ] as const) {
      p.stroke(
        [
          [tcx + x0 * u, chin + (torsoBot - chin) * y0],
          [tcx + x1 * u, chin + (torsoBot - chin) * y1],
        ],
        3.2 * u,
        "rgba(182,190,186,0.22)",
      );
    }
    // Torn vertical soot-black cloth shreds
    for (const [dx, y0, y1] of [
      [-28, 0.16, 0.94],
      [-6, 0.20, 0.96],
      [16, 0.18, 0.92],
    ] as const) {
      p.stroke(
        [
          [tcx + dx * u, chin + (torsoBot - chin) * y0],
          [tcx + (dx - 3) * u + sw, chin + (torsoBot - chin) * y1],
        ],
        2.4 * u,
        "#0a090d",
      );
    }
  },
};

/** Shot 5 ECU: Perspective-locked (`flat: true`) swept pale wood-ash patch with TWO gaunt bare footprints facing STRAIGHT INTO THE BACK WALL! (512 x 512) */
export function fxAshFootprintsDecal(p: Pen, reveal = 1) {
  const g = p.g;
  g.save();
  g.globalAlpha = Math.max(0.05, Math.min(1, reveal));

  // Pale-grey swept wood-ash patch (high contrast so p98 stays crisp and eerie!)
  const ashGr = g.createRadialGradient(256, 256, 30, 256, 256, 238);
  ashGr.addColorStop(0, "rgba(202,208,204,0.88)");
  ashGr.addColorStop(0.55, "rgba(138,144,142,0.68)");
  ashGr.addColorStop(0.84, "rgba(56,58,60,0.34)");
  ashGr.addColorStop(1, "rgba(22,22,26,0)");
  g.fillStyle = ashGr;
  g.beginPath();
  g.ellipse(256, 256, 232, 212, 0.08, 0, Math.PI * 2);
  g.fill();

  // Broom sweep arcs across ash
  g.strokeStyle = "rgba(232,238,234,0.32)";
  g.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(90 + i * 28, 430, 260 + i * 18, -Math.PI * 0.72, -Math.PI * 0.24);
    g.stroke();
  }

  // Draw two eerie gaunt bare human footprints pointing UP (-Y on canvas -> -Z straight into the back wall!)
  const drawBareFoot = (cx: number, cy: number, side: -1 | 1) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(side * 0.06);

    // Recessed soot-black heel & narrow gaunt arch + ball of foot
    g.fillStyle = "rgba(10,9,13,0.92)";
    // Heel
    g.beginPath();
    g.ellipse(0, 74, 22, 30, 0, 0, Math.PI * 2);
    g.fill();
    // Gaunt outer bridge
    g.beginPath();
    g.moveTo(side * 4, 58);
    g.quadraticCurveTo(side * 24, 10, side * 26, -34);
    g.lineTo(-side * 12, -32);
    g.quadraticCurveTo(side * 2, 16, -side * 14, 58);
    g.closePath();
    g.fill();
    // Ball of foot
    g.beginPath();
    g.ellipse(0, -34, 30, 24, side * -0.14, 0, Math.PI * 2);
    g.fill();

    // 5 elongated splayed eerie toes pointing straight toward the wall (-Y)
    const toes: [number, number, number, number][] = [
      [-side * 20, -78, 10, 17], // big toe
      [-side * 4, -84, 7.5, 16],
      [side * 10, -78, 7.0, 15],
      [side * 22, -68, 6.2, 13],
      [side * 32, -55, 5.5, 11],
    ];
    for (const [tx, ty, rx, ry] of toes) {
      g.beginPath();
      g.ellipse(tx, ty, rx, ry, side * 0.08, 0, Math.PI * 2);
      g.fill();
      // Subtle nail scratch dig ahead of each toe
      g.strokeStyle = "rgba(8,6,10,0.82)";
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(tx, ty - ry);
      g.lineTo(tx + side * 2, ty - ry - 14);
      g.stroke();
    }

    // Raised pale ash rim caught in lantern side-light around the footprint edge!
    g.strokeStyle = "rgba(242,248,244,0.68)";
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(0, 74, 24, 32, 0, 0.3, Math.PI * 1.4);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -34, 32, 26, side * -0.14, -Math.PI * 0.85, Math.PI * 0.15);
    g.stroke();
    g.restore();
  };

  drawBareFoot(192, 266, -1);
  drawBareFoot(318, 252, 1);

  // Fine dark ash speckles
  g.fillStyle = "rgba(18,16,20,0.55)";
  for (let i = 0; i < 36; i++) {
    const sx = 60 + ((i * 73) % 390);
    const sy = 60 + ((i * 119) % 390);
    g.fillRect(sx, sy, 3 + (i % 3), 3 + (i % 2));
  }
  g.restore();
}

/** Shot 3 LOW: Subtle fingernail scratch grooves gouged into ash & dirt (`flat: true`, 512 x 512). */
export function fxAshScratchesDecal(p: Pen, reveal: number) {
  const g = p.g;
  g.save();
  g.globalAlpha = Math.max(0.04, Math.min(1, reveal));
  // Soft ash halo
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 220);
  gr.addColorStop(0, "rgba(165,170,168,0.55)");
  gr.addColorStop(0.65, "rgba(85,88,90,0.28)");
  gr.addColorStop(1, "rgba(20,20,24,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(256, 256, 215, 165, -0.12, 0, Math.PI * 2);
  g.fill();

  // 4 jagged parallel claw scratch grooves dug through the ash
  g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const y0 = 178 + i * 38;
    const len = 180 + (i === 1 || i === 2 ? 75 : 20) * reveal;
    g.strokeStyle = "rgba(8,6,10,0.88)";
    g.lineWidth = 7.5;
    g.beginPath();
    g.moveTo(390, y0);
    g.quadraticCurveTo(280, y0 + (i - 1.5) * 9, 390 - len, y0 + 18);
    g.stroke();
    g.strokeStyle = "rgba(225,232,228,0.42)";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(390, y0 - 4);
    g.quadraticCurveTo(280, y0 + (i - 1.5) * 9 - 4, 390 - len, y0 + 14);
    g.stroke();
  }
  g.restore();
}

/** Shot 10 FINALE: Soot-blackened ash-dusted skeletal hand creeping OUT from the pitch-black right nook to hook & pull the cold rice bowl! (520 x 360) */
export function fxMaXoAshHand(p: Pen, reach: number, time: number) {
  const { g } = p;
  const trem = Math.sin(time * 20) * 1.8 * (0.25 + reach);
  // Hand creeps leftward from right-hand pitch-black recess (x = 490 -> left!)
  const wristX = 486 - reach * 92;
  const wristY = 188 + trem * 0.4;

  g.save();
  p.grit = 1.45;

  // Feathered pitch-black nook shadow masking wrist entry on right edge
  const sh = g.createRadialGradient(485, 190, 20, 485, 190, 175);
  sh.addColorStop(0, "rgba(4,2,6,0.94)");
  sh.addColorStop(0.55, "rgba(4,2,6,0.46)");
  sh.addColorStop(1, "rgba(4,2,6,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(475, 190, 145, 155, 0, 0, Math.PI * 2);
  g.fill();

  // Gaunt soot-black forearm & bony wrist emerging from right shadow
  const arm: P2[] = [
    [515, wristY - 34],
    [wristX, wristY - 24],
    [wristX - 18, wristY + 18],
    [515, wristY + 34],
  ];
  p.gradFill(arm, "#525856", "#101014", -1.4);
  p.hatch(arm, -1.4, 8, 1.3, "rgba(4,2,6,0.65)", true, -0.1);
  p.poly(arm, null, 3.8, INK);

  // Five long gaunt ash-coated skeletal fingers reaching left & hooking down around the rice bowl!
  const fingers: [number, number, number, number, number][] = [
    // [dy, ang1, ang2, len, w]
    [-26, Math.PI - 0.16, Math.PI + 0.14, 156, 17],
    [-10, Math.PI - 0.04, Math.PI + 0.22, 184, 18],
    [8, Math.PI + 0.06, Math.PI + 0.30, 176, 17],
    [24, Math.PI + 0.18, Math.PI + 0.40, 146, 15],
    [38, Math.PI + 0.42, Math.PI + 0.68, 118, 17],
  ];

  for (let i = 0; i < fingers.length; i++) {
    const [dy, a1, a2, len, w0] = fingers[i];
    const ext = Math.max(0.22, Math.min(1, reach * 1.25 - i * 0.05));
    const L1 = len * 0.54 * ext;
    const L2 = len * 0.46 * ext;
    const k0: P2 = [wristX - 12, wristY + dy];
    const k1: P2 = [k0[0] + Math.cos(a1) * L1, k0[1] + Math.sin(a1) * L1 + trem];
    const k2: P2 = [k1[0] + Math.cos(a2) * L2, k1[1] + Math.sin(a2) * L2 + trem];
    const claw: P2 = [k2[0] + Math.cos(a2 + 0.34) * 26 * ext, k2[1] + Math.sin(a2 + 0.34) * 26 * ext];

    // Floor cast shadow below each finger
    g.save();
    g.strokeStyle = "rgba(4,2,6,0.56)";
    g.lineWidth = w0 * 1.25;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(k0[0], k0[1] + 10);
    g.lineTo(k1[0], k1[1] + 12);
    g.lineTo(k2[0], k2[1] + 11);
    g.stroke();
    g.restore();

    const drawBone = (a: P2, b: P2, wa: number, wb: number) => {
      const dx = b[0] - a[0], dyb = b[1] - a[1], L = Math.hypot(dx, dyb) || 1;
      const nx = -dyb / L, ny = dx / L;
      const seg: P2[] = [
        [a[0] + nx * wa * 0.5, a[1] + ny * wa * 0.5],
        [b[0] + nx * wb * 0.5, b[1] + ny * wb * 0.5],
        [b[0] - nx * wb * 0.5, b[1] - ny * wb * 0.5],
        [a[0] - nx * wa * 0.5, a[1] - ny * wa * 0.5],
      ];
      // Ash-dusted charcoal fingers with pale wood-ash rim catching firelight!
      p.gradFill(seg, "#9ca4a0", "#1e2022", -1.4);
      p.hatch(seg, -1.4, 7, 1.2, "rgba(4,2,6,0.58)", false, 0.05);
      p.poly(seg, null, 3.4, INK);
      p.stroke([seg[3], seg[2]], 2.0, "rgba(222,232,226,0.68)");
    };

    drawBone(k0, k1, w0, w0 * 0.78);
    drawBone(k1, k2, w0 * 0.76, w0 * 0.45);
    p.dot(k1[0], k1[1], w0 * 0.42, "#4a504e");
    // Black soot talon + falling ash specks
    p.poly([[k2[0] + 3, k2[1] - 4], claw, [k2[0] + 2, k2[1] + 5]], "#07050a", 2.0);
    p.drip(k1[0] - 2, k1[1] + 7, 22 * ext, 1.8, "rgba(18,16,20,0.72)");
  }

  g.restore();
}
