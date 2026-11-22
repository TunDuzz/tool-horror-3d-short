import React from "react";
import { AbsoluteFill } from "remotion";
import { ShortPlayer } from "../engine";
import { DOF, KICKS, OVERLAYS, SHOTS, TOTAL, XFADE } from "./story";
import { HorrorLabWorld } from "./world";

void KICKS;

export const HORROR_LAB_FRAMES = TOTAL;

const HorrorLabInner: React.FC = () => (
  <AbsoluteFill>
    <ShortPlayer
      shots={SHOTS}
      dof={DOF}
      xfade={XFADE}
      overlays={OVERLAYS}
      grainAmount={0.015}
      background="#070b14"
      createWorld={() => new HorrorLabWorld()}
    />
  </AbsoluteFill>
);

export const HorrorLabVertical: React.FC = () => <HorrorLabInner />;
export const HorrorLabWide: React.FC = () => <HorrorLabInner />;
