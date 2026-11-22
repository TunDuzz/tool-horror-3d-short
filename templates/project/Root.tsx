import React from "react";
import { Composition } from "remotion";
import { HORROR_LAB_FRAMES, HorrorLabVertical, HorrorLabWide } from "./horror-lab";
import { MADA_FRAMES, MadaShort } from "./mada";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="HorrorLabVertical"
        component={HorrorLabVertical}
        durationInFrames={HORROR_LAB_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="HorrorLabWide"
        component={HorrorLabWide}
        durationInFrames={HORROR_LAB_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="MadaShort"
        component={MadaShort}
        durationInFrames={MADA_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
