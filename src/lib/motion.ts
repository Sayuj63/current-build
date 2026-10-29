/**
 * Mutable animation values shared between GSAP timelines (which write them)
 * and render loops (which read them every frame). Deliberately not React
 * state: these change 60 times a second and must never trigger a render.
 */
export const motion = {
  /** Portal radius, 0 = closed (all paper), 1 = fully open. */
  reveal: 0,
  /** Camera intro dolly, 0 = pulled back, 1 = resting position. */
  intro: 0,
  /** Particle mark assembly, 0 = scattered, 1 = formed. */
  assemble: 0,
  /** Smoothed hover over the particle mark, 0–1. Written by the mark itself. */
  hover: 0,
  /** Pointer in normalised device coords, −1…1, y up. */
  pointer: { x: 0, y: 0 },
  /** False until the first real pointer event — (0,0) is the screen centre,
   *  which would otherwise read as "hovering the mark" on load. */
  pointerSeen: false,
  /** Journey progress in steps (see lib/journey.ts). Everything — camera
   *  orbit, mark shape, type, the closing portal — is a pure function of it,
   *  so the film never desyncs and scrolling back is an exact reversal. */
  p: 0,
  /** dp/dt, for banking the camera into the move. */
  v: 0,
};

export { JOURNEY_END } from "./journey";
