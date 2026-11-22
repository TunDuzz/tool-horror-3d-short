// Remotion Composition entry for the Vietnamese "Ma Da" horror short (MadaShort).
// 9:16 vertical format (1080x1920 logical canvas, 2K export via --scale 1.3333).

import React from "react";
import { ShortPlayer } from "../engine";
import { DOF, OVERLAYS, SHOTS, TOTAL, XFADE } from "./story";
import { MadaWorld } from "./world";

export const MADA_FRAMES = TOTAL;

export const MadaShort: React.FC = () => (
  <ShortPlayer
    shots={SHOTS}
    dof={DOF}
    xfade={XFADE}
    overlays={OVERLAYS}
    grainAmount={0.015}
    background="#070b14"
    createWorld={() => new MadaWorld()}
  />
);
