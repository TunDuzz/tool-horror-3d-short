// Project-local Gothic Ink-Noir outfits, props, and drowned clawed hand FX for "Ma Da" v2.
// Strictly outside src/engine/ via Outfit hooks and Pen helpers.

import { BodyCtx, HeadCtx, INK, Outfit, P2, Pen, SH_CLOTH, TorsoCtx, mul } from "../engine";

/** Tapered iron storm lantern hanging from Ông Tư's hand (matches 3D storm lantern silhouette). */
const drawStormLantern = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 5 * u, ly = hy + 38 * u;
  // Iron bail ring
  p.stroke([[hx - 4 * u, hy + 2 * u], [lx, ly - 20 * u], [hx + 5 * u, hy + 2 * u]], 2.2 * u, INK);
  // Domed chimney & cap
  p.poly([[lx - 6 * u, ly - 20 * u], [lx + 6 * u, ly - 20 * u], [lx + 11 * u, ly - 12 * u], [lx - 11 * u, ly - 12 * u]], "#1f232b", ow * 0.6);
  // Tapered iron cage
  p.poly([[lx - 11 * u, ly - 12 * u], [lx + 11 * u, ly - 12 * u], [lx + 8.5 * u, ly + 8 * u], [lx - 8.5 * u, ly + 8 * u]], "#1c2028", ow * 0.6);
  // Warm amber glowing glass
  p.poly([[lx - 7.5 * u, ly - 9.5 * u], [lx + 7.5 * u, ly - 9.5 * u], [lx + 6 * u, ly + 6 * u], [lx - 6 * u, ly + 6 * u]], "#f5b854", 1.5 * u);
  p.dot(lx, ly - 2 * u, 3.8 * u, "#fff6d6");
  p.stroke([[lx, ly - 12 * u], [lx, ly + 8 * u]], 1.4 * u, INK);
  // Oil reservoir base
  p.poly([[lx - 10 * u, ly + 8 * u], [lx + 10 * u, ly + 8 * u], [lx + 9 * u, ly + 13 * u], [lx - 9 * u, ly + 13 * u]], "#181b22", ow * 0.6);
};

/** Authentic Vietnamese dark-checkered khăn rằn draped naturally around the neck + áo bà ba placket & buttons. */
const drawBaBaAndKhanRan = (p: Pen, ctx: TorsoCtx) => {
  const { tcx, chin, torsoBot, W, u, ow, side, back, time, wind } = ctx;
  if (back) return;
  const shY = chin + 20 * u;
  const sway = Math.sin(time * 2.8) * (3 + 7 * wind) * u;
  if (side) {
    // Draped scarf around collar in profile
    const wrap: P2[] = [
      [tcx - 16 * u, shY - 6 * u],
      [tcx + 22 * u, shY - 2 * u],
      [tcx + 24 * u, shY + 18 * u],
      [tcx - 14 * u, shY + 14 * u],
    ];
    p.poly(wrap, "#8f8a82", ow * 0.5);
    for (const sx of [-6, 4, 14]) {
      p.stroke([[tcx + sx * u, shY - 4 * u], [tcx + (sx - 2) * u, shY + 15 * u]], 1.8 * u, "#1e1f24");
    }
    return;
  }
  // Collar wrap around gaunt neck + asymmetric hanging checkered scarf tail (NOT soldier epaulets!)
  const collar: P2[] = [
    [tcx - 28 * u, shY - 8 * u],
    [tcx + 28 * u, shY - 8 * u],
    [tcx + 32 * u, shY + 12 * u],
    [tcx, shY + 20 * u],
    [tcx - 32 * u, shY + 12 * u],
  ];
  const tail: P2[] = [
    [tcx - 24 * u, shY + 8 * u],
    [tcx - 4 * u, shY + 14 * u],
    [tcx - 10 * u + sway, shY + 88 * u],
    [tcx - 30 * u + sway, shY + 82 * u],
  ];
  p.poly(tail, "#8d8880", ow * 0.55);
  p.clip(tail, () => {
    for (let y = 16; y <= 84; y += 11) {
      p.stroke([[tcx - 34 * u + sway, shY + y * u], [tcx, shY + (y + 3) * u]], 2.1 * u, "#1e2026");
    }
    p.stroke([[tcx - 16 * u, shY + 10 * u], [tcx - 20 * u + sway, shY + 86 * u]], 1.8 * u, "#1e2026");
  });
  p.poly(collar, "#9c968d", ow * 0.55);
  for (const sx of [-18, -6, 6, 18]) {
    p.stroke([[tcx + sx * u, shY - 8 * u], [tcx + sx * u, shY + 16 * u]], 1.8 * u, "#1e2026");
  }
  // Áo bà ba front seam & dark wooden buttons
  p.stroke([[tcx + 2 * u, shY + 20 * u], [tcx + 2 * u, torsoBot - 6 * u]], 1.9 * u, INK);
  for (const f of [0.34, 0.52, 0.70]) {
    p.dot(tcx + 7 * u, chin + (torsoBot - chin) * f, 2.3 * u, "#786552");
  }
};

/** Weathered Vietnamese nón lá / frayed fisherman cap worn by Ông Tư (shadowing his brow for dark chiaroscuro!). */
const drawFishermanHat = (p: Pen, ctx: HeadCtx) => {
  const { cx, crown, W, HH, u, ow, light, side } = ctx;
  const col = "#473c30";
  const brimY = crown + 0.28 * HH;
  if (side) {
    const cap: P2[] = [
      [cx - 0.54 * W, brimY + 2 * u],
      [cx - 0.44 * W, crown - 0.04 * HH],
      [cx + 0.14 * W, crown - 0.08 * HH],
      [cx + 0.52 * W, brimY],
    ];
    p.gradFill(cap, col, mul(col, SH_CLOTH), light);
    p.hatch(cap, light, 8, 1.3);
    p.poly(cap, null, ow);
    // Low shadowed brim shading eyes
    p.poly([[cx + 0.28 * W, brimY - 3 * u], [cx + 0.84 * W, brimY + 8 * u], [cx + 0.34 * W, brimY + 11 * u]], "#2a231c", ow * 0.8);
  } else {
    const cap: P2[] = [
      [cx - 0.54 * W, brimY],
      [cx - 0.42 * W, crown - 0.05 * HH],
      [cx, crown - 0.11 * HH],
      [cx + 0.42 * W, crown - 0.05 * HH],
      [cx + 0.54 * W, brimY],
    ];
    p.gradFill(cap, col, mul(col, SH_CLOTH), light);
    p.hatch(cap, light, 8, 1.3);
    p.poly(cap, null, ow);
    p.poly([[cx - 0.58 * W, brimY], [cx, brimY - 4 * u], [cx + 0.58 * W, brimY], [cx + 0.44 * W, brimY + 12 * u], [cx - 0.44 * W, brimY + 12 * u]], "#2a231c", ow * 0.8);
  }
};

/** Long sodden matted black hair & dripping water-weed curtains hanging over Ma Da's face and gaunt shoulders! */
const drawMaDaWetHair = (p: Pen, ctx: HeadCtx) => {
  const { cx, hc, crown, W, HH, u, ow, light, side, back, time, wind } = ctx;
  const sway = Math.sin(time * 2.7 + 0.5) * (5 + 12 * wind) * u;
  const col = "#10171a";
  if (back) return;
  if (side) {
    // Matted dripping hair cascading forward over brow & down back
    const backMass: P2[] = [
      [cx + 0.48 * W, hc - 0.18 * HH],
      [cx + 0.15 * W, crown - 0.08 * HH],
      [cx - 0.44 * W, crown - 0.05 * HH],
      [cx - 0.64 * W, hc + 0.05 * HH],
      [cx - 0.72 * W + sway, hc + 1.35 * HH],
      [cx - 0.36 * W + sway * 0.7, hc + 1.48 * HH],
      [cx - 0.14 * W + sway * 0.4, hc + 0.72 * HH],
      [cx + 0.08 * W, hc - 0.06 * HH],
    ];
    p.gradFill(backMass, col, "#070b0d", light);
    p.poly(backMass, null, ow * 0.85);
    // Clumped wet locks hanging over forehead & cheek
    for (const [dx, len] of [[0.32, 0.52], [0.16, 0.82], [-0.04, 1.05]] as const) {
      p.stroke(
        [
          [cx + dx * W, crown + 0.15 * HH],
          [cx + (dx + 0.06) * W + sway * 0.3, hc + len * 0.5 * HH],
          [cx + (dx - 0.02) * W + sway * 0.5, hc + len * HH],
        ],
        3.2 * u,
        "#0b1114",
      );
    }
    return;
  }
  // Front: long dripping curtains flanking pale skull + straggly wet strands across shadowed eyes
  const mass: P2[] = [
    [cx - 0.68 * W + sway, hc + 1.45 * HH],
    [cx - 0.62 * W, hc - 0.12 * HH],
    [cx - 0.42 * W, crown - 0.06 * HH],
    [cx, crown - 0.12 * HH],
    [cx + 0.42 * W, crown - 0.06 * HH],
    [cx + 0.62 * W, hc - 0.12 * HH],
    [cx + 0.68 * W + sway, hc + 1.42 * HH],
    [cx + 0.46 * W + sway * 0.6, hc + 1.18 * HH],
    [cx + 0.42 * W, hc - 0.05 * HH],
    [cx + 0.24 * W, hc - 0.18 * HH],
    [cx + 0.06 * W, hc - 0.04 * HH],
    [cx - 0.14 * W, hc - 0.20 * HH],
    [cx - 0.34 * W, hc - 0.05 * HH],
    [cx - 0.46 * W + sway * 0.6, hc + 1.22 * HH],
  ];
  p.gradFill(mass, col, "#06090c", light);
  p.poly(mass, null, ow * 0.85);
  // Thin dripping mud-tangled strands falling past eye sockets + black river-ooze drips
  for (const [fx, len] of [[-0.28, 0.68], [-0.05, 0.52], [0.22, 0.76], [0.36, 0.92]] as const) {
    p.stroke(
      [
        [cx + fx * W, crown + 0.18 * HH],
        [cx + fx * W + sway * 0.25, hc + len * HH],
      ],
      2.6 * u,
      "#070b0d",
    );
    p.drip(cx + fx * W + sway * 0.25, hc + len * HH, 18 * u, 1.6 * u, "rgba(5,3,8,0.85)");
  }
};

/** Ông Tư — gaunt weathered Mekong river watchman carrying a storm lantern. */
export const ONG_TU: Outfit = {
  build: "elder",
  jacket: "#3c322a",
  pants: "#1d2028",
  boots: "#141114",
  coatLen: 0.32,
  skin: "#c4a38a",
  ageLines: true,
  hat: null,
  hatOn: drawFishermanHat,
  torsoDetail: drawBaBaAndKhanRan,
  inFrontHand: drawStormLantern,
};

/** Ông Tư inside the watchman's shack (lantern dropped outside during his escape). */
export const ONG_TU_SHACK: Outfit = {
  ...ONG_TU,
  inFrontHand: undefined,
};

/** Ma Da — gaunt drowned water-spirit with spindly clawed limbs, tattered sodden shroud, and dripping mud hair. */
export const MA_DA_GHOST: Outfit = {
  build: "gaunt",
  uncanny: true,
  jacket: "#243538",
  pants: "#172225",
  boots: "#0d1416",
  dress: "#1d2d30",
  tattered: true,
  skin: "#9cb2b8",
  eyeGlow: "#d8f6ff",
  hat: null,
  hatBehind: (p, ctx) => {
    const { cx, hc, W, HH, u, time, wind } = ctx;
    const sway = Math.sin(time * 2.5) * (6 + 14 * wind) * u;
    const veil: P2[] = [
      [cx - 0.52 * W, hc - 0.32 * HH],
      [cx, hc - 0.56 * HH],
      [cx + 0.52 * W, hc - 0.32 * HH],
      [cx + 0.68 * W + sway * 0.3, hc + 0.45 * HH],
      [cx + 0.76 * W + sway, hc + 1.55 * HH],
      [cx + 0.44 * W + sway * 0.8, hc + 1.32 * HH],
      [cx + 0.24 * W + sway * 0.9, hc + 1.82 * HH],
      [cx + sway * 0.7, hc + 1.44 * HH],
      [cx - 0.22 * W + sway * 0.9, hc + 1.86 * HH],
      [cx - 0.46 * W + sway * 0.8, hc + 1.36 * HH],
      [cx - 0.76 * W + sway, hc + 1.58 * HH],
      [cx - 0.68 * W + sway * 0.3, hc + 0.45 * HH],
    ];
    p.gradFill(veil, "#111a1e", "#070b0d", ctx.light);
    p.poly(veil, null, ctx.ow * 0.65);
  },
  hatOn: drawMaDaWetHair,
  torsoDetail: (p, ctx) => {
    const { tcx, chin, torsoBot, u, time } = ctx;
    // Wet clinging river-weed tendrils & dripping grime streaks
    for (const [dx, y0, y1, col] of [
      [-28, 0.16, 0.94, "#162926"],
      [-10, 0.22, 0.98, "#101c1f"],
      [9, 0.14, 0.96, "#182e2a"],
      [26, 0.26, 0.92, "#101c1f"],
    ] as const) {
      const sy0 = chin + (torsoBot - chin) * y0;
      const sy1 = chin + (torsoBot - chin) * y1;
      const w = Math.sin(time * 2.2 + dx) * 3 * u;
      p.stroke([[tcx + dx * u, sy0], [tcx + (dx - 4) * u + w, (sy0 + sy1) * 0.5], [tcx + (dx + 2) * u + w, sy1]], 2.8 * u, col);
    }
  },
};

/** High-craft Gothic inked drowned skeletal forearm & splayed grasping clawed hand emerging from dark water (Shot 5 ECU). */
export function fxGothicDrownedHand(p: Pen, grab: number, time: number) {
  const { g } = p;
  const cw = 440, ch = 520;
  const cx = cw * 0.48, waterY = ch * 0.80;
  const dy = (1 - grab) * 56;
  const trem = Math.sin(time * 26) * 2.4 * grab;

  g.save();
  p.grit = 1.6;
  // Gaunt corpse-pale wet forearm angled diagonally up out of dark water
  const arm: P2[] = [
    [cx - 46, waterY + 28],
    [cx - 32 + trem, ch * 0.52 + dy],
    [cx - 24 + trem, ch * 0.37 + dy],
    [cx + 16 + trem, ch * 0.35 + dy],
    [cx + 18 + trem, ch * 0.52 + dy],
    [cx + 22, waterY + 28],
  ];
  p.gradFill(arm, "#8aa2a8", "#304248", -2.1);
  p.hatch(arm, -2.1, 8, 1.6, "rgba(8,10,16,0.58)", true);
  p.poly(arm, null, 5.2, INK);

  // Tendons & wet dark river weeds draped around wrist
  p.stroke([[cx - 10 + trem, ch * 0.42 + dy], [cx - 22, waterY + 8]], 2.2, "rgba(10,16,20,0.58)");
  p.stroke([[cx + 3 + trem, ch * 0.42 + dy], [cx - 2, waterY + 8]], 2.0, "rgba(10,16,20,0.52)");
  p.stroke([[cx - 32 + trem, ch * 0.50 + dy], [cx + 18 + trem, ch * 0.58 + dy], [cx - 36, ch * 0.70 + dy]], 8.5, "#152621");
  p.stroke([[cx - 32 + trem, ch * 0.50 + dy], [cx + 18 + trem, ch * 0.58 + dy], [cx - 36, ch * 0.70 + dy]], 2.0, INK);

  // Bony angular palm
  const palm: P2[] = [
    [cx - 25 + trem, ch * 0.38 + dy],
    [cx - 34 + trem, ch * 0.25 + dy],
    [cx - 6 + trem, ch * 0.20 + dy],
    [cx + 26 + trem, ch * 0.23 + dy],
    [cx + 18 + trem, ch * 0.36 + dy],
  ];
  p.gradFill(palm, "#9cb4ba", "#425860", -2.0);
  p.hatch(palm, -2.0, 7, 1.4, "rgba(8,10,16,0.45)");
  p.poly(palm, null, 4.8, INK);

  // Four organic splayed, articulated gnarled clutching fingers wrapping forward with crooked knuckles & dark claws
  const fingerSpecs: [number, number, number, number, number][] = [
    [-26, 0.24, -0.52, 76, 12],
    [-8, 0.21, -0.18, 90, 12],
    [10, 0.22, 0.14, 86, 11],
    [23, 0.25, 0.48, 70, 10],
  ];
  for (const [bx, byFrac, ang, len, w0] of fingerSpecs) {
    const k0: P2 = [cx + bx + trem, ch * byFrac + dy];
    const a1 = -Math.PI * 0.42 + ang;
    const k1: P2 = [k0[0] + Math.cos(a1) * len * 0.52, k0[1] + Math.sin(a1) * len * 0.52];
    const a2 = a1 + 0.58; // sharply hooked claw bend!
    const k2: P2 = [k1[0] + Math.cos(a2) * len * 0.48, k1[1] + Math.sin(a2) * len * 0.48];
    const drawBone = (pA: P2, pB: P2, wa: number, wb: number) => {
      const dx = pB[0] - pA[0], dy2 = pB[1] - pA[1], L = Math.hypot(dx, dy2) || 1;
      const nx = -dy2 / L, ny = dx / L;
      const seg: P2[] = [
        [pA[0] + nx * wa * 0.5, pA[1] + ny * wa * 0.5],
        [pB[0] + nx * wb * 0.5, pB[1] + ny * wb * 0.5],
        [pB[0] - nx * wb * 0.5, pB[1] - ny * wb * 0.5],
        [pA[0] - nx * wa * 0.5, pA[1] - ny * wa * 0.5],
      ];
      p.gradFill(seg, "#a6bfc5", "#445a62", -2.0);
      p.poly(seg, null, 3.8, INK);
    };
    drawBone(k0, k1, w0, w0 * 0.78);
    drawBone(k1, k2, w0 * 0.76, w0 * 0.34);
    // Swollen bony knuckle shadow + elongated jagged black claw nail + dripping black river ichor
    p.dot(k1[0], k1[1], w0 * 0.44, "#4b6068");
    const nailTip: P2 = [k2[0] + Math.cos(a2 + 0.28) * 20, k2[1] + Math.sin(a2 + 0.28) * 20];
    p.poly([[k2[0] - 3.5, k2[1] - 3.5], nailTip, [k2[0] + 3.5, k2[1] + 3.5]], "#080b0e", 2.2);
    p.drip(k1[0], k1[1] + 6, 36, 2.0, "rgba(5,3,8,0.82)");
  }

  // Opposing gnarled thumb clamping inward from left
  const t0: P2 = [cx - 26 + trem, ch * 0.35 + dy];
  const t1: P2 = [cx - 58 + trem, ch * 0.28 + dy];
  const t2: P2 = [cx - 44 + trem, ch * 0.19 + dy];
  p.stroke([t0, t1, t2], 14, INK);
  p.stroke([t0, t1, t2], 7.5, "#96aeb4");

  // Dark water surface fade submerging forearm cleanly
  const wMask = g.createLinearGradient(0, waterY - 12, 0, ch);
  wMask.addColorStop(0, "rgba(7,16,22,0)");
  wMask.addColorStop(0.38, "rgba(7,16,22,0.92)");
  wMask.addColorStop(1, "rgba(7,16,22,0)");
  g.fillStyle = wMask;
  g.fillRect(0, waterY - 12, cw, ch - waterY + 12);
  g.restore();
}
