import React from "react";
import { Composition } from "remotion";
import { HORROR_LAB_V3_FRAMES, HorrorLabV3Vertical, HorrorLabV3Wide } from "./horror-lab-v3";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="HorrorLabV3Vertical"
        component={HorrorLabV3Vertical}
        durationInFrames={HORROR_LAB_V3_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="HorrorLabV3Wide"
        component={HorrorLabV3Wide}
        durationInFrames={HORROR_LAB_V3_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
