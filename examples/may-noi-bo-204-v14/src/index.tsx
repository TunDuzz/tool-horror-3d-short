import React from "react";
import { ShortPlayer, hudFromManifest } from "../engine";
import { DOF, MANIFEST, MAY_NOI_BO_204_FRAMES, OVERLAYS, SHOTS } from "./story";
import { createMayNoiBo204World } from "./world";

export { MAY_NOI_BO_204_FRAMES };

const HUD = hudFromManifest(MANIFEST);

export const MayNoiBo204: React.FC = () => (
  <ShortPlayer
    shots={SHOTS}
    dof={DOF}
    overlays={OVERLAYS}
    hud={HUD}
    renderStyle="psxHorror"
    psxOptions={{
      pixelScale: 2.8,
      colorLevels: 24,
      ditherStrength: 0.80,
      scanlineStrength: 0.14,
      vhsWave: 0.16,
      chromaPx: 1.25,
      crtCurvature: 0.036,
      vertexSnap: 300,
    }}
    ssao={true}
    grainAmount={0.012}
    width={1080}
    height={1920}
    background="#06080b"
    createWorld={createMayNoiBo204World}
  />
);
