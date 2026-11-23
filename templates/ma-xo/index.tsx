// Remotion Composition entry for the Vietnamese folklore horror short "Ma Xo — Bat Sut Sau Bep Ong Tao".
// 9:16 vertical format (1080x1920 logical canvas; render with integer scales --scale 1, 1.25, or 1.5).

import React from "react";
import { ShortPlayer } from "../engine";
import { DOF, OVERLAYS, SHOTS, TOTAL, XFADE } from "./story";
import { MaXoWorld } from "./world";

export const MA_XO_FRAMES = TOTAL;

export const MaXoShort: React.FC = () => (
  <ShortPlayer
    shots={SHOTS}
    dof={DOF}
    xfade={XFADE}
    overlays={OVERLAYS}
    grainAmount={0.018}
    background="#06080f"
    createWorld={() => new MaXoWorld()}
  />
);
