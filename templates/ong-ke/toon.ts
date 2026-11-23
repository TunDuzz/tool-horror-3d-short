// Project-local Gothic Ink-Noir outfits, props, burlap sack, and curled skeletal fingers for "Ong Ke".
// Strictly outside src/engine/ via Outfit hooks and Pen helpers.

import { BodyCtx, HeadCtx, INK, Outfit, P2, Pen, SH_CLOTH, TorsoCtx, mul } from "../engine";

/** Traditional Vietnamese glass-chimney oil lamp carried by Bé Minh. */
const drawOilLamp = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 4 * u, ly = hy + 28 * u;
  p.stroke([[hx - 3 * u, hy + 2 * u], [lx, ly - 18 * u], [hx + 4 * u, hy + 2 * u]], 2.0 * u, INK);
  p.poly(
    [
      [lx - 5.5 * u, ly - 17 * u],
      [lx + 5.5 * u, ly - 17 * u],
      [lx + 9.5 * u, ly + 4 * u],
      [lx - 9.5 * u, ly + 4 * u],
    ],
    "#f8c86a",
    1.6 * u,
  );
  p.poly([[lx, ly - 10 * u], [lx + 4 * u, ly - 1 * u], [lx, ly + 3 * u], [lx - 4 * u, ly - 1 * u]], "#fff9dc", 0);
  p.poly([[lx - 11 * u, ly + 4 * u], [lx + 11 * u, ly + 4 * u], [lx + 13 * u, ly + 15 * u], [lx - 13 * u, ly + 15 * u]], "#2a2422", ow * 0.65);
};

/** Natural short tousled rural boy hair (clean rounded silhouette in back/side/front — never boxy!). */
const drawMinhHair = (p: Pen, ctx: HeadCtx) => {
  const { cx, hc, crown, W, HH, u, ow, light, side, back } = ctx;
  const col = "#19151e";
  const sh = "#0c0a10";
  if (back) {
    const cap: P2[] = [
      [cx - 0.52 * W, hc + 0.14 * HH],
      [cx - 0.50 * W, hc - 0.24 * HH],
      [cx - 0.34 * W, crown - 0.05 * HH],
      [cx, crown - 0.09 * HH],
      [cx + 0.34 * W, crown - 0.05 * HH],
      [cx + 0.50 * W, hc - 0.24 * HH],
      [cx + 0.52 * W, hc + 0.14 * HH],
      [cx + 0.36 * W, hc + 0.28 * HH],
      [cx, hc + 0.24 * HH],
      [cx - 0.36 * W, hc + 0.28 * HH],
    ];
    p.gradFill(cap, col, sh, light);
    p.poly(cap, null, ow * 0.9);
  } else if (side) {
    const hair: P2[] = [
      [cx + 0.44 * W, hc - 0.20 * HH],
      [cx + 0.18 * W, crown - 0.06 * HH],
      [cx - 0.32 * W, crown - 0.04 * HH],
      [cx - 0.54 * W, hc - 0.08 * HH],
      [cx - 0.48 * W, hc + 0.22 * HH],
      [cx - 0.18 * W, hc + 0.14 * HH],
      [cx - 0.06 * W, hc - 0.06 * HH],
      [cx + 0.16 * W, hc - 0.14 * HH],
    ];
    p.gradFill(hair, col, sh, light);
    p.poly(hair, null, ow * 0.9);
  } else {
    const bangs: P2[] = [
      [cx - 0.52 * W, hc + 0.04 * HH],
      [cx - 0.50 * W, hc - 0.24 * HH],
      [cx - 0.34 * W, crown - 0.05 * HH],
      [cx, crown - 0.09 * HH],
      [cx + 0.34 * W, crown - 0.05 * HH],
      [cx + 0.50 * W, hc - 0.24 * HH],
      [cx + 0.52 * W, hc + 0.04 * HH],
      [cx + 0.38 * W, hc - 0.10 * HH],
      [cx + 0.18 * W, hc - 0.18 * HH],
      [cx + 0.04 * W, hc - 0.06 * HH],
      [cx - 0.14 * W, hc - 0.20 * HH],
      [cx - 0.36 * W, hc - 0.08 * HH],
    ];
    p.gradFill(bangs, col, sh, light);
    p.poly(bangs, null, ow * 0.9);
  }
  // Subtle stray lock at crown
  p.stroke([[cx - 4 * u, crown - 4 * u], [cx + 8 * u, crown - 13 * u]], 2.2 * u, INK);
};

/** Simple rustic rural kid pajama shirt collar & buttons. */
const drawMinhShirt = (p: Pen, ctx: TorsoCtx) => {
  const { tcx, chin, torsoBot, u, side, back } = ctx;
  if (back) return;
  const shY = chin + 18 * u;
  if (side) {
    p.stroke([[tcx + 4 * u, shY], [tcx + 12 * u, shY + 14 * u]], 1.8 * u, INK);
    return;
  }
  p.stroke([[tcx - 16 * u, shY - 2 * u], [tcx, shY + 14 * u], [tcx + 16 * u, shY - 2 * u]], 2.0 * u, INK);
  p.stroke([[tcx, shY + 14 * u], [tcx, torsoBot - 6 * u]], 1.8 * u, INK);
  for (const f of [0.38, 0.56, 0.74]) {
    p.dot(tcx + 5 * u, chin + (torsoBot - chin) * f, 2.1 * u, "#9e968a");
  }
};

/** Bé Minh (7-year-old boy) carrying an oil lamp in the dark wooden house. */
export const BE_MINH: Outfit = {
  build: "kid",
  jacket: "#6e685e",
  pants: "#232630",
  boots: "#161418",
  coatLen: 0.14,
  skin: "#d8bfa8",
  hat: null,
  hair: "#19151e",
  hatOn: drawMinhHair,
  torsoDetail: drawMinhShirt,
  inFrontHand: drawOilLamp,
};

/** Bé Minh without the oil lamp (climax recoil / escape / bedroom so lamp never overlaps raised arms). */
export const BE_MINH_NO_LAMP: Outfit = {
  ...BE_MINH,
  inFrontHand: undefined,
};

/** Heavy weathered burlap sack slung compactly over Ông Kẹ's upper back/shoulder (NEVER stretches to floor!). */
const drawOngKeBurlapSack = (p: Pen, ctx: BodyCtx) => {
  const { tcx, chin, u, ow, light, side, time, wind } = ctx;
  const sway = Math.sin(time * 2.2) * (4 + 8 * wind) * u;
  const sx = side ? tcx - 38 * u : tcx + 52 * u;
  const sy = chin + 10 * u;
  const botY = chin + 225 * u; // anchored cleanly at hip level, NOT ankle dress hem!
  const sack: P2[] = [
    [sx - 12 * u, sy - 6 * u],
    [sx + 20 * u, sy - 16 * u],
    [sx + 58 * u + sway * 0.4, sy + 44 * u],
    [sx + 66 * u + sway, sy + 128 * u],
    [sx + 48 * u + sway, botY - 8 * u],
    [sx + 8 * u + sway * 0.8, botY + 14 * u],
    [sx - 24 * u + sway * 0.5, botY - 12 * u],
    [sx - 28 * u + sway * 0.3, sy + 64 * u],
  ];
  p.gradFill(sack, "#574a3a", "#261f18", light);
  p.hatch(sack, light, 8, 1.4, "rgba(10,7,12,0.58)", true, -0.10);
  p.poly(sack, null, ow * 0.9);
  // Tied hemp rope cinching top neck of sack + dark wet mud drips
  p.stroke([[sx - 16 * u, sy + 10 * u], [sx + 26 * u, sy - 2 * u]], 5.0 * u, "#3c3022");
  p.stroke([[sx - 16 * u, sy + 10 * u], [sx + 26 * u, sy - 2 * u]], 1.8 * u, INK);
  p.drip(sx + 14 * u + sway, botY + 10 * u, 26 * u, 2.0 * u, "rgba(6,4,8,0.85)");
  p.drip(sx + 44 * u + sway, botY - 4 * u, 20 * u, 1.7 * u, "rgba(6,4,8,0.80)");
};

/** Torn tattered broad-brimmed bamboo/cloth hat pulled low over Ông Kẹ's brow. */
const drawOngKeTornHat = (p: Pen, ctx: HeadCtx) => {
  const { cx, crown, W, HH, u, ow, light, side, back, time, wind } = ctx;
  const sway = Math.sin(time * 2.8) * (4 + 8 * wind) * u;
  const col = "#2a241f";
  const brimY = crown + 0.28 * HH;
  if (side) {
    const hat: P2[] = [
      [cx - 0.85 * W, brimY + 10 * u],
      [cx - 0.42 * W, crown - 0.16 * HH],
      [cx + 0.18 * W, crown - 0.22 * HH],
      [cx + 0.92 * W, brimY + 14 * u],
      [cx + 0.36 * W, brimY + 8 * u],
      [cx - 0.46 * W, brimY + 6 * u],
    ];
    p.gradFill(hat, col, mul(col, SH_CLOTH), light);
    p.hatch(hat, light, 7, 1.4, "rgba(6,3,10,0.6)", true);
    p.poly(hat, null, ow);
  } else {
    const hat: P2[] = [
      [cx - 0.96 * W, brimY + 12 * u],
      [cx - 0.48 * W, crown - 0.12 * HH],
      [cx, crown - 0.28 * HH],
      [cx + 0.48 * W, crown - 0.12 * HH],
      [cx + 0.96 * W, brimY + 12 * u],
      [cx + 0.56 * W, brimY + 4 * u],
      [cx, brimY + (back ? 10 : 14) * u],
      [cx - 0.56 * W, brimY + 4 * u],
    ];
    p.gradFill(hat, col, mul(col, SH_CLOTH), light);
    p.hatch(hat, light, 7, 1.4, "rgba(6,3,10,0.6)", true);
    p.poly(hat, null, ow);
  }
  for (const fx of [-0.62, -0.25, 0.34, 0.68]) {
    p.stroke(
      [
        [cx + fx * W, brimY + 8 * u],
        [cx + fx * W + sway, brimY + 26 * u],
      ],
      2.2 * u,
      "#161214",
    );
  }
};

/** Ông Kẹ — towering, crooked Vietnamese folklore boogeyman with torn cloak, bent neck, burlap sack & needle-teeth grin. */
export const ONG_KE_ENTITY: Outfit = {
  build: "gaunt",
  uncanny: true,
  jacket: "#252126",
  pants: "#16141a",
  boots: "#0d0b10",
  dress: "#221e23",
  coatLen: 0.72,
  tattered: true,
  skin: "#98a29f",
  eyeGlow: "#e4f5ec",
  hat: null,
  behindBody: drawOngKeBurlapSack,
  hatOn: drawOngKeTornHat,
  torsoDetail: (p, ctx) => {
    const { tcx, chin, torsoBot, u, time, wind } = ctx;
    p.stroke([[tcx - 36 * u, chin + 20 * u], [tcx + 34 * u, chin + 215 * u]], 7.0 * u, "#5e4c36");
    p.stroke([[tcx - 36 * u, chin + 20 * u], [tcx + 34 * u, chin + 215 * u]], 2.0 * u, INK);
    const sw = Math.sin(time * 2.5) * (3 + 8 * wind) * u;
    for (const [dx, y0, y1] of [
      [-32, 0.18, 0.92],
      [-14, 0.24, 0.96],
      [6, 0.16, 0.94],
      [28, 0.22, 0.90],
    ] as const) {
      const sy0 = chin + (torsoBot - chin) * y0;
      const sy1 = chin + (torsoBot - chin) * y1;
      p.stroke([[tcx + dx * u, sy0], [tcx + (dx - 3) * u + sw, sy1]], 2.4 * u, "#121015");
    }
  },
};

/** Shot 5 ECU: Five elongated pale-grey skeletal fingers curling OUT from the dark right-side wardrobe crack onto the door face (palm hidden inside crack!). */
export function fxOngKeClawFingers(p: Pen, pull: number, time: number) {
  const { g } = p;
  // Right edge of left wooden door panel meets the dark wardrobe gap near x = 350..385
  const crackX = 368 - pull * 14;
  const trem = Math.sin(time * 22) * 2.2 * (0.3 + pull);

  g.save();
  p.grit = 1.45;

  // Soft dark shadow clinging ONLY to the inside-crack edge on the right (palm remains hidden in the abyss!)
  const crackSh = g.createRadialGradient(crackX + 18, 280, 12, crackX + 18, 280, 150);
  crackSh.addColorStop(0, "rgba(3,2,6,0.92)");
  crackSh.addColorStop(0.55, "rgba(3,2,6,0.45)");
  crackSh.addColorStop(1, "rgba(3,2,6,0)");
  g.fillStyle = crackSh;
  g.beginPath();
  g.ellipse(crackX + 12, 280, 95, 225, 0, 0, Math.PI * 2);
  g.fill();

  // Five long gaunt crooked skeletal fingers curling from RIGHT crack -> LEFT across the wooden door planks
  // Angles are measured leftward from PI (PI = straight left, PI+0.25 = left-down, PI-0.25 = left-up)
  const fingers: [number, number, number, number, number][] = [
    // [baseY, ang1, ang2, totalLen, baseW]
    [136, Math.PI - 0.14, Math.PI + 0.18, 178, 19],  // index curling high & hooking down
    [202, Math.PI - 0.04, Math.PI + 0.24, 212, 21],  // middle longest gripping wide onto wood
    [270, Math.PI + 0.06, Math.PI + 0.30, 200, 20],  // ring finger digging tightly
    [336, Math.PI + 0.16, Math.PI + 0.42, 168, 18],  // pinky bent sharply downward
    [404, Math.PI + 0.32, Math.PI + 0.62, 134, 19],  // lower clutching thumb hooking wood edge
  ];

  for (let i = 0; i < fingers.length; i++) {
    const [by, a1, a2, len, w0] = fingers[i];
    const ext = Math.max(0.28, Math.min(1, pull * 1.24 - i * 0.06));
    const L1 = len * 0.54 * ext;
    const L2 = len * 0.46 * ext;
    const k0: P2 = [crackX + 26, by + trem * 0.4];
    const k1: P2 = [k0[0] + Math.cos(a1) * L1, k0[1] + Math.sin(a1) * L1 + trem];
    const k2: P2 = [k1[0] + Math.cos(a2) * L2, k1[1] + Math.sin(a2) * L2 + trem];
    const clawTip: P2 = [k2[0] + Math.cos(a2 + 0.32) * 30 * ext, k2[1] + Math.sin(a2 + 0.32) * 30 * ext];

    // Soft cast shadow on the wooden planks directly beneath each gripping finger
    g.save();
    g.strokeStyle = "rgba(4,2,6,0.52)";
    g.lineWidth = w0 * 1.25;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(k0[0], k0[1] + 10);
    g.lineTo(k1[0], k1[1] + 12);
    g.lineTo(k2[0], k2[1] + 11);
    g.stroke();
    g.restore();

    const drawBone = (a: P2, b: P2, wa: number, wb: number) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const seg: P2[] = [
        [a[0] + nx * wa * 0.5, a[1] + ny * wa * 0.5],
        [b[0] + nx * wb * 0.5, b[1] + ny * wb * 0.5],
        [b[0] - nx * wb * 0.5, b[1] - ny * wb * 0.5],
        [a[0] - nx * wa * 0.5, a[1] - ny * wa * 0.5],
      ];
      p.gradFill(seg, "#d8e8e2", "#3e4a47", -1.4);
      p.hatch(seg, -1.4, 7, 1.2, "rgba(8,5,12,0.44)", false, 0.10);
      p.poly(seg, null, 3.6, INK);
      // Crisp eerie moonlight rim highlight along upper finger ridge
      p.stroke([seg[3], seg[2]], 2.2, "rgba(236,252,246,0.74)");
    };

    drawBone(k0, k1, w0, w0 * 0.78);
    drawBone(k1, k2, w0 * 0.76, w0 * 0.46);
    // Swollen bony knuckle + pale bone glint + crease lines
    p.dot(k1[0], k1[1], w0 * 0.44, "#748480");
    p.dot(k1[0] - 2, k1[1] - 3, w0 * 0.18, "rgba(232,250,244,0.75)");
    p.stroke([[k1[0] - 4, k1[1] - 5], [k1[0] + 4, k1[1] + 5]], 2.0, "rgba(10,6,14,0.75)");
    // Sharp curved black talon claw digging into wood + faint dark scratch mark & drip
    p.poly([[k2[0] + 3, k2[1] - 4], clawTip, [k2[0] + 2, k2[1] + 5]], "#08060b", 2.2);
    p.stroke([[clawTip[0] + 18, clawTip[1] - 2], [clawTip[0] - 8, clawTip[1] + 3]], 1.8, "rgba(10,6,12,0.55)");
    p.drip(k1[0] - 2, k1[1] + 7, 28 * ext, 1.8, "rgba(6,4,10,0.72)");
  }

  g.restore();
}

/** Wet dark mud puddle decal (`flat: true`) under the protruding burlap sack / on bed floor (512 x 512). */
export function fxMudStainDecal(p: Pen, reveal: number) {
  const g = p.g;
  g.save();
  g.globalAlpha = Math.max(0.05, Math.min(1, reveal));
  const gr = g.createRadialGradient(256, 256, 22, 256, 256, 215);
  gr.addColorStop(0, "rgba(12,10,10,0.86)");
  gr.addColorStop(0.55, "rgba(22,18,14,0.58)");
  gr.addColorStop(1, "rgba(18,14,12,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(256, 256, 210, 148, 0.14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(10,8,8,0.78)";
  g.lineWidth = 10;
  g.lineCap = "round";
  for (const [y0, y1] of [[210, 224], [252, 266], [295, 304]] as const) {
    g.beginPath();
    g.moveTo(105, y0);
    g.quadraticCurveTo(250, (y0 + y1) * 0.5 - 12, 405, y1);
    g.stroke();
  }
  g.fillStyle = "rgba(185,150,115,0.28)";
  g.beginPath();
  g.ellipse(230, 232, 34, 9, -0.1, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
