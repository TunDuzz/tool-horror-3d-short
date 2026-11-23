// Project-local Gothic Ink-Noir outfits & props for HorrorLab (strictly outside src/engine/ via Outfit hooks).

import { BodyCtx, INK, Outfit, P2, Pen, SH_CLOTH, mul } from "../engine";

const drawGothicLantern = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 4 * u, ly = hy + 34 * u;
  // Bail ring
  p.stroke([[hx - 4 * u, hy + 2 * u], [lx, ly - 18 * u], [hx + 4 * u, hy + 2 * u]], 2.2 * u, INK);
  // Domed chimney cap
  p.poly([[lx - 7 * u, ly - 18 * u], [lx + 7 * u, ly - 18 * u], [lx + 11 * u, ly - 11 * u], [lx - 11 * u, ly - 11 * u]], "#20242d", ow * 0.6);
  // Tapered iron cage + warm glowing glass
  p.poly([[lx - 10 * u, ly - 11 * u], [lx + 10 * u, ly - 11 * u], [lx + 8 * u, ly + 8 * u], [lx - 8 * u, ly + 8 * u]], "#1f242c", ow * 0.6);
  p.poly([[lx - 7 * u, ly - 9 * u], [lx + 7 * u, ly - 9 * u], [lx + 5.5 * u, ly + 6 * u], [lx - 5.5 * u, ly + 6 * u]], "#f5b856", 1.5 * u);
  p.dot(lx, ly - 2 * u, 3.6 * u, "#fff4cc");
  p.stroke([[lx, ly - 11 * u], [lx, ly + 8 * u]], 1.4 * u, INK);
  // Base reservoir
  p.poly([[lx - 10 * u, ly + 8 * u], [lx + 10 * u, ly + 8 * u], [lx + 9 * u, ly + 13 * u], [lx - 9 * u, ly + 13 * u]], "#1a1d24", ow * 0.6);
};

export const TRAVELER: Outfit = {
  build: "adult",
  jacket: "#353c48",
  pants: "#222630",
  boots: "#16141a",
  coatLen: 0.45,
  hat: "cap",
  cap: "#522b30",
  skin: "#ccb4a0",
  belt: "#1d181e",
  buttons: "#7e8490",
  inFrontHand: drawGothicLantern,
};

export const GHOST_FIGURE: Outfit = {
  build: "gaunt",
  uncanny: true,
  jacket: "#4c5c70",
  pants: "#364456",
  boots: "#232d3b",
  dress: "#46566a",
  tattered: true,
  skin: "#b2c2d4",
  eyeGlow: "#dceeff",
  hat: "hood",
  hair: "#435368",
  torsoDetail: (p, ctx) => {
    const { tcx, chin, torsoBot, u } = ctx;
    for (const dx of [-24, -8, 10, 24]) {
      p.stroke([[tcx + dx * u, chin + 30], [tcx + (dx - 4) * u, torsoBot - 16]], 2.0 * u, "rgba(18,22,34,0.65)");
    }
  },
};
