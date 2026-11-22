// Project-local outfits, character hooks, and 2D folklore FX for the Vietnamese "Ma Da" horror short.
// Strictly outside src/engine/ — uses Outfit hooks and Pen canvas helpers.

import { BodyCtx, INK, Outfit, P2, Pen, SH_CLOTH, TorsoCtx, mul } from "../engine";

const drawStormLantern = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 4 * u, ly = hy + 30 * u;
  // Iron handle ring & bail
  p.stroke(
    [
      [hx - 3 * u, hy + 2 * u],
      [lx, ly - 17 * u],
      [hx + 4 * u, hy + 2 * u],
    ],
    2.4 * u,
    INK,
  );
  // Top chimney cap
  p.poly(
    [
      [lx - 7 * u, ly - 17 * u],
      [lx + 7 * u, ly - 17 * u],
      [lx + 10 * u, ly - 12 * u],
      [lx - 10 * u, ly - 12 * u],
    ],
    "#252932",
    ow * 0.65,
  );
  // Outer protective cage / frame
  p.poly(
    [
      [lx - 10 * u, ly - 12 * u],
      [lx + 10 * u, ly - 12 * u],
      [lx + 12 * u, ly + 8 * u],
      [lx - 12 * u, ly + 8 * u],
    ],
    "#2b303a",
    ow * 0.65,
  );
  // Warm glass globe
  p.poly(
    [
      [lx - 7 * u, ly - 9 * u],
      [lx + 7 * u, ly - 9 * u],
      [lx + 8 * u, ly + 5 * u],
      [lx - 8 * u, ly + 5 * u],
    ],
    "#ffcf70",
    1.5 * u,
  );
  // Bright flame core
  p.dot(lx, ly - 1.5 * u, 3.8 * u, "#fff7d6");
  // Wire guard ribs
  p.stroke([[lx - 8 * u, ly - 2 * u], [lx + 8 * u, ly - 2 * u]], 1.4 * u, INK);
  // Bottom oil reservoir base
  p.poly(
    [
      [lx - 11 * u, ly + 8 * u],
      [lx + 11 * u, ly + 8 * u],
      [lx + 9 * u, ly + 13 * u],
      [lx - 9 * u, ly + 13 * u],
    ],
    "#20242c",
    ow * 0.65,
  );
};

const drawBaBaScarfAndButtons = (p: Pen, ctx: TorsoCtx) => {
  const { tcx, chin, torsoBot, W, u, ow } = ctx;
  // Traditional Vietnamese checkered khăn rằn draped around neck
  const scarfL: P2[] = [
    [tcx - 0.24 * W, chin + 2 * u],
    [tcx - 0.12 * W, chin + 4 * u],
    [tcx - 0.15 * W, chin + 34 * u],
    [tcx - 0.28 * W, chin + 31 * u],
  ];
  const scarfR: P2[] = [
    [tcx + 0.12 * W, chin + 4 * u],
    [tcx + 0.24 * W, chin + 2 * u],
    [tcx + 0.28 * W, chin + 29 * u],
    [tcx + 0.15 * W, chin + 32 * u],
  ];
  p.poly(scarfL, "#d2cbc0", ow * 0.55);
  p.poly(scarfR, "#d2cbc0", ow * 0.55);
  for (const sy of [10, 18, 25]) {
    p.stroke([[tcx - 0.26 * W, chin + sy * u], [tcx - 0.14 * W, chin + (sy + 2) * u]], 2.0 * u, "#23252a");
    p.stroke([[tcx + 0.14 * W, chin + (sy + 1) * u], [tcx + 0.26 * W, chin + sy * u]], 2.0 * u, "#23252a");
  }
  // Áo bà ba center seam & wooden buttons
  p.stroke([[tcx, chin + 6 * u], [tcx, torsoBot - 3 * u]], 1.8 * u, INK);
  for (const f of [0.28, 0.50, 0.72]) {
    const by = chin + (torsoBot - chin) * f;
    p.dot(tcx + 3.5 * u, by, 2.1 * u, "#8f7a62");
  }
};

/** Ông Tư — elderly river watchman carrying a storm lantern on the wharf. */
export const ONG_TU: Outfit = {
  jacket: "#483a30",
  pants: "#22252e",
  boots: "#1c1816",
  hat: "cap",
  cap: "#57483b",
  hasBrim: true,
  skin: "#deb798",
  belt: null,
  torsoDetail: drawBaBaScarfAndButtons,
  inFrontHand: drawStormLantern,
};

/** Ông Tư after dropping his lantern during the escape into the watchman's shack. */
export const ONG_TU_SHACK: Outfit = {
  ...ONG_TU,
  inFrontHand: undefined,
};

/** Ma Da — drowned water-spirit with sodden black hair, river weed strands, and mud-stained tattered garments. */
export const MA_DA_GHOST: Outfit = {
  jacket: "#3a5054",
  pants: "#27373a",
  boots: "#1d292b",
  dress: "#31464a",
  skin: "#b2cad0",
  hat: "hair",
  hair: "#172224",
  belt: null,
  torsoDetail: (p, ctx) => {
    const { tcx, chin, torsoBot, W, u } = ctx;
    // Dark river weeds & dripping water streaks down the soaked tunic
    for (const [dx, y0, y1, col] of [
      [-20, 0.18, 0.92, "#203632"],
      [-8, 0.25, 0.98, "#1b2c2e"],
      [7, 0.15, 0.95, "#233b36"],
      [19, 0.28, 0.90, "#1b2c2e"],
    ] as const) {
      const sy0 = chin + (torsoBot - chin) * y0;
      const sy1 = chin + (torsoBot - chin) * y1;
      p.stroke(
        [
          [tcx + dx * u, sy0],
          [tcx + (dx - 3) * u, (sy0 + sy1) * 0.5],
          [tcx + (dx + 2) * u, sy1],
        ],
        2.8 * u,
        col,
      );
    }
    // Tattered hem notches
    for (const dx of [-0.32, -0.14, 0.08, 0.28]) {
      p.stroke([[tcx + dx * W, torsoBot - 14 * u], [tcx + (dx - 0.03) * W, torsoBot]], 2.4 * u, "#182426");
    }
  },
};

/** 2D FX: A battered Vietnamese conical hat (nón lá) drifting upstream with concentric ripples. */
export function fxConicalHat(p: Pen, u: number) {
  const { g } = p;
  const cw = 420, ch = 300;
  const cx = cw * 0.5, cy = ch * 0.55;
  g.save();
  // Water ripples around the floating hat
  for (let i = 0; i < 2; i++) {
    const ph = (u + i * 0.5) % 1;
    const rx = cw * (0.24 + ph * 0.22);
    const ry = ch * (0.10 + ph * 0.10);
    g.strokeStyle = `rgba(175, 215, 235, ${(1 - ph) * 0.45})`;
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(cx, cy + 16, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // Conical hat silhouette with bamboo ribs & dark river-rot patches
  const brimW = cw * 0.34, brimH = ch * 0.11, peakY = cy - ch * 0.26;
  const grad = g.createLinearGradient(cx - brimW, peakY, cx + brimW, cy + brimH);
  grad.addColorStop(0, "#b89f74");
  grad.addColorStop(0.55, "#8b734e");
  grad.addColorStop(1, "#4e3e28");
  g.fillStyle = grad;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx, peakY);
  g.lineTo(cx + brimW, cy);
  g.ellipse(cx, cy, brimW, brimH, 0, 0, Math.PI, false);
  g.closePath();
  g.fill();
  g.stroke();

  // Concentric bamboo stitching rings
  g.strokeStyle = "rgba(40, 28, 18, 0.55)";
  g.lineWidth = 2.2;
  for (const f of [0.35, 0.65, 0.88]) {
    g.beginPath();
    g.ellipse(cx, peakY + (cy - peakY) * f, brimW * f, brimH * f * 0.65, 0, 0.08 * Math.PI, 0.92 * Math.PI);
    g.stroke();
  }
  // Dark tear/notch on the brim
  g.fillStyle = "#15222e";
  g.beginPath();
  g.moveTo(cx + brimW * 0.35, cy + brimH * 0.65);
  g.lineTo(cx + brimW * 0.48, cy - 12);
  g.lineTo(cx + brimW * 0.60, cy + brimH * 0.45);
  g.closePath();
  g.fill();
  g.restore();
}

/** 2D FX: A pale drowned hand reaching out of the dark water to grip the boat's mooring rope. */
export function fxPaleHand(p: Pen, u: number) {
  const { g } = p;
  const cw = 360, ch = 440;
  const cx = cw * 0.5, baseY = ch * 0.76;
  g.save();
  // Eerie water rings at the wrist emergence point
  for (const [rx, ry, al] of [
    [cw * 0.34, ch * 0.08, 0.48],
    [cw * 0.22, ch * 0.05, 0.68],
  ] as const) {
    g.strokeStyle = `rgba(140, 225, 200, ${al})`;
    g.lineWidth = 3.5;
    g.beginPath();
    g.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();
  }

  // Mooring rope segment taut from top-left into the water
  g.strokeStyle = "#8a6d46";
  g.lineWidth = 10;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - cw * 0.22, ch * 0.06);
  g.quadraticCurveTo(cx - cw * 0.04, ch * 0.42, cx + cw * 0.02, baseY + 10);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();

  // Pale bluish-grey forearm & fingers clutching the rope
  const dy = (1 - u) * 28;
  g.fillStyle = "#bdd6dc";
  g.strokeStyle = INK;
  g.lineWidth = 5;
  g.lineJoin = "round";
  // Forearm rising from water
  g.beginPath();
  g.moveTo(cx - 22, baseY + 6);
  g.lineTo(cx - 16, ch * 0.42 + dy);
  g.lineTo(cx + 18, ch * 0.40 + dy);
  g.lineTo(cx + 24, baseY + 6);
  g.closePath();
  g.fill();
  g.stroke();

  // Four curled fingers + thumb gripping the rope
  for (let i = 0; i < 4; i++) {
    const fy = ch * (0.28 + i * 0.045) + dy;
    const fw = 34 - i * 2;
    g.beginPath();
    g.roundRect(cx - 20, fy, fw, 14, 7);
    g.fill();
    g.stroke();
  }
  // Dark water cover below wrist line
  const wgr = g.createLinearGradient(0, baseY - 6, 0, ch);
  wgr.addColorStop(0, "rgba(10, 24, 32, 0.2)");
  wgr.addColorStop(0.5, "rgba(10, 24, 32, 0.92)");
  wgr.addColorStop(1, "rgba(10, 24, 32, 0)");
  g.fillStyle = wgr;
  g.fillRect(cx - cw * 0.4, baseY - 6, cw * 0.8, ch - baseY);
  g.restore();
}

/** 2D FX: Wet black-mud footprints and a spreading puddle on dry floorboards behind Ông Tư. */
export function fxWetFootprints(p: Pen, reveal: number) {
  const { g } = p;
  const cw = 420, ch = 420;
  g.save();
  g.globalAlpha = Math.max(0.08, Math.min(1, reveal));

  // Perspective foreshortening so the footprints read as lying flat on the wooden floorboards
  g.translate(cw * 0.5, ch * 0.62);
  g.scale(1.0, 0.52);

  // Spreading dark river-water puddle halo on the wood planks
  const puddle = g.createRadialGradient(0, 0, 15, 0, 0, 175);
  puddle.addColorStop(0, "rgba(12, 18, 24, 0.88)");
  puddle.addColorStop(0.55, "rgba(25, 36, 44, 0.55)");
  puddle.addColorStop(0.82, "rgba(180, 95, 85, 0.22)");
  puddle.addColorStop(1, "rgba(18, 24, 30, 0)");
  g.fillStyle = puddle;
  g.beginPath();
  g.ellipse(0, 0, 175, 135, 0, 0, Math.PI * 2);
  g.fill();

  const drawFoot = (fx: number, fy: number, rot: number, mirror: number) => {
    g.save();
    g.translate(fx, fy);
    g.rotate(rot);
    g.scale(mirror, 1);

    // Dark river-mud sole & heel imprint with warm lamp/blood-moon wet rim
    g.fillStyle = "#0b0f12";
    g.strokeStyle = "rgba(235, 150, 125, 0.68)";
    g.lineWidth = 3.2;
    // Forefoot
    g.beginPath();
    g.ellipse(-4, -24, 28, 38, 0.08, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Heel
    g.beginPath();
    g.ellipse(2, 36, 20, 24, -0.05, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // 5 distinct mud toe prints
    for (const [tx, ty, tr] of [
      [-23, -68, 9.0],
      [-8, -75, 7.6],
      [6, -73, 6.8],
      [18, -67, 6.0],
      [27, -58, 5.2],
    ] as const) {
      g.beginPath();
      g.ellipse(tx, ty, tr * 0.9, tr * 1.15, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.restore();
  };

  drawFoot(-58, 14, -0.10, 1);
  drawFoot(56, -18, 0.08, -1);

  // Specular wet glints catching the oil lamp light
  g.fillStyle = "rgba(255, 210, 185, 0.78)";
  for (const [gx, gy, gw, gh] of [
    [-64, 4, 15, 5],
    [52, -26, 16, 5],
    [-4, 46, 24, 6],
    [18, -58, 14, 4],
  ] as const) {
    g.beginPath();
    g.ellipse(gx, gy, gw, gh, 0.15, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
