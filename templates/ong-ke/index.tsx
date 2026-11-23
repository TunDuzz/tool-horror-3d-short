// Remotion Composition entry for the Vietnamese folklore horror short "Ong Ke" (Gothic Ink-Noir x Shadow-Depth).
// 9:16 vertical format (1080x1920 logical canvas; render with integer scales --scale 1, 1.25, or 1.5).

import React from "react";
import { ShortPlayer } from "../engine";
import { DOF, OVERLAYS, SHOTS, TOTAL, XFADE } from "./story";
import { OngKeWorld } from "./world";

export const ONG_KE_FRAMES = TOTAL;

export const OngKeShort: React.FC = () => (
  <ShortPlayer
    shots={SHOTS}
    dof={DOF}
    xfade={XFADE}
    overlays={OVERLAYS}
    grainAmount={0.018}
    background="#06080f"
    createWorld={() => new OngKeWorld()}
  />
);
