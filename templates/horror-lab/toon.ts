// Project-local outfits & props for HorrorLab (strictly outside src/engine/ via Outfit hooks).

import { BodyCtx, INK, Outfit, P2, Pen, mul, SH_CLOTH } from "../engine";

const drawLanternProp = (p: Pen, hand: P2, ctx: BodyCtx) => {
  const { u, ow } = ctx;
  const hx = hand[0], hy = hand[1];
  const lx = hx + 3 * u, ly = hy + 28 * u;
  p.stroke([[hx, hy], [lx, ly - 14 * u]], 2.6 * u, INK);
  p.poly(
    [
      [lx - 9 * u, ly - 14 * u],
      [lx + 9 * u, ly - 14 * u],
      [lx + 11 * u, ly + 8 * u],
      [lx - 11 * u, ly + 8 * u],
    ],
    "#262b34",
    ow * 0.65,
  );
  p.poly(
    [
      [lx - 6 * u, ly - 10 * u],
      [lx + 6 * u, ly - 10 * u],
      [lx + 7 * u, ly + 4 * u],
      [lx - 7 * u, ly + 4 * u],
    ],
    "#ffd278",
    1.6 * u,
  );
  p.dot(lx, ly - 2 * u, 3.2 * u, "#fff6cc");
};

export const TRAVELER: Outfit = {
  jacket: "#3d4656",
  pants: "#292f3b",
  boots: "#1a1820",
  hat: "cap",
  cap: "#693538",
  hasBrim: true,
  skin: "#edd0b8",
  belt: "#241d22",
  buttons: "#8d929c",
  inFrontHand: drawLanternProp,
};

export const GHOST_FIGURE: Outfit = {
  jacket: "#8aa0bc",
  pants: "#697e9b",
  boots: "#546680",
  dress: "#7e95b5",
  skin: "#d8e6f6",
  hatBehind: (p, ctx) => {
    const { cx, hc, W, HH, ow, light } = ctx;
    const hood: P2[] = [
      [cx - 0.58 * W, hc + 0.45 * HH],
      [cx - 0.48 * W, hc - 0.62 * HH],
      [cx, hc - 0.74 * HH],
      [cx + 0.48 * W, hc - 0.62 * HH],
      [cx + 0.58 * W, hc + 0.45 * HH],
    ];
    p.shadedFill(hood, "#677c9c", mul("#677c9c", SH_CLOTH), light, W * 0.5);
    p.poly(hood, null, ow * 0.85);
  },
  torsoDetail: (p, ctx) => {
    const { tcx, torsoBot, W, u } = ctx;
    for (const dx of [-18, -5, 9, 21]) {
      p.stroke([[tcx + dx * u, torsoBot - 0.45 * W], [tcx + (dx - 3) * u, torsoBot]], 2.2 * u, "#4c5d78");
    }
  },
};
