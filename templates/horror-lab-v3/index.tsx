import React from "react";
import { ShortPlayer, hudFromManifest } from "../engine";
import { DOF, HORROR_LAB_V3_FRAMES, MANIFEST, OVERLAYS, SHOTS } from "./story";
import { HorrorLabV3World } from "./world";

export { HORROR_LAB_V3_FRAMES };

const HUD = hudFromManifest(MANIFEST);

const LabBase: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <ShortPlayer
    shots={SHOTS}
    dof={DOF}
    overlays={OVERLAYS}
    hud={HUD}
    renderStyle="semiReal"
    ssao={true}
    grainAmount={0.018}
    width={width}
    height={height}
    background="#06060b"
    createWorld={() => new HorrorLabV3World()}
  />
);

export const HorrorLabV3Vertical: React.FC = () => <LabBase width={1080} height={1920} />;
export const HorrorLabV3Wide: React.FC = () => <LabBase width={1920} height={1080} />;
