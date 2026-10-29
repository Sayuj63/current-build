"use client";

import { Orb, type OrbPalette } from "react-ai-orb";

/**
 * Siri-style assistant orb — react-ai-orb (MIT, github.com/Steve0929/react-ai-orb):
 * blurred gradient blobs rotating in 3D inside a glass sphere, pure CSS.
 * Palette tuned to the site: cream-white glass, warm orange swirl.
 */
const EMBER: OrbPalette = {
  mainBgStart: "rgb(255, 246, 238)",
  mainBgEnd: "rgb(255, 150, 95)",
  shadowColor1: "rgba(255, 120, 60, 0)",
  shadowColor2: "rgba(255, 120, 60, 0.45)",
  shadowColor3: "rgba(255, 255, 255, 0.85)",
  shadowColor4: "rgb(255, 91, 20)",
  shapeAStart: "rgb(255, 255, 255)",
  shapeAEnd: "rgba(255, 200, 170, 0)",
  shapeBStart: "rgb(255, 214, 190)",
  shapeBMiddle: "rgb(255, 138, 76)",
  shapeBEnd: "rgba(255, 91, 20, 0)",
  shapeCStart: "rgba(255, 255, 255, 0)",
  shapeCMiddle: "rgba(255, 190, 150, 0.55)",
  shapeCEnd: "#ff7a33",
  shapeDStart: "rgba(255, 255, 255, 0)",
  shapeDMiddle: "rgba(255, 120, 60, 0.5)",
  shapeDEnd: "#ff5b14",
};

export function SiriOrb({ active = false }: { active?: boolean }) {
  return (
    <Orb
      palette={EMBER}
      size={0.78}
      animationSpeedBase={active ? 2.2 : 1}
      animationSpeedHue={active ? 1.6 : 1}
      hueRotation={18}
      blobAOpacity={0.45}
      blobBOpacity={0.7}
    />
  );
}
