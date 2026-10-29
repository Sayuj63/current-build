/**
 * The score for the 360° journey. One scroll = one step; `motion.p` glides
 * between whole steps. Every keyframe below is indexed by step.
 *
 * A chapter lives on three steps, the way the reference paces it:
 *   arrive  final shape, the chapter's type rises in
 *   drift   type holds while the camera keeps turning and the object moves
 *   leave   type slides away with the camera; the object is mid-morph
 * then the next chapter arrives. So between two chapters there are three
 * scrolls, the next type appears on the third, and the object passes
 * through two in-between shapes on its way.
 *
 *  step  0    3       6        9       12     13    14
 *        S    cube    ball     heart   ring   dive  paper
 */

export const JOURNEY_END = 14;
/** The step each chapter's type arrives on (index = chapter). */
export const CHAPTER_STEPS = [0, 3, 6, 9, 12];
/** The last chapter (the ring) dims instead of leaving. */
export const RING_STEP = 12;

/**
 * Camera, per step. θ in degrees around the mark; `radius` is distance (the
 * zoom — it sets how big the object reads); `side` slides the look-at target
 * sideways (− puts the mark on the right of frame, + on the left); `lookY`
 * moves it up or down the frame.
 *
 * Framing measured from the reference, as fraction of the viewport:
 *   cube  centre (0.78, 0.45), 0.36 tall   — right, text left
 *   ball  centre (0.50, 0.30), 0.70 tall   — camera down in the grass, looking
 *                                            up; the ball looms over the horizon
 *   heart centre (0.27, 0.45), 0.42 tall   — left, text right
 *   ring  centre (0.50, 0.46), 0.40 tall   — middle, text below
 * The steps between chapters travel the object from one framing to the next.
 */
export const KEY = {
  theta: [0, 30, 60, 90, 120, 150, 180, 205, 230, 255, 290, 325, 360, 360, 360],
  radius: [16.5, 16.0, 14.6, 12.9, 12.4, 11.0, 9.8, 10.2, 13.0, 15.2, 16.4, 17.6, 18.5, 7.6, 5.4],
  height: [2.5, 2.8, 3.1, 3.3, 3.0, 1.8, 1.3, 1.4, 2.1, 2.8, 2.9, 2.9, 2.9, 3.45, 3.45],
  lookY: [2.1, 2.3, 2.7, 3.0, 2.6, 2.3, 2.35, 2.4, 2.6, 2.9, 3.0, 3.05, 3.1, 3.45, 3.45],
  side: [0, -1.0, -2.6, -4.0, -3.4, -1.4, 0, 2.2, 3.4, 3.85, 2.2, 0.8, 0, 0, 0],
};
/** Phones: no room beside the type, so the mark stays centred above it. */
export const KEY_PORTRAIT = {
  ...KEY,
  side: KEY.side.map(() => 0),
  lookY: KEY.lookY.map((y, i) => (i >= 13 ? y : y - 0.9)),
};

/** Orbit angle (radians) at a journey progress — linear between keys. */
export function thetaAt(p: number) {
  const n = KEY.theta.length - 1;
  const c = Math.min(n, Math.max(0, p));
  const i = Math.min(n - 1, Math.floor(c));
  const f = c - i;
  return ((KEY.theta[i] + (KEY.theta[i + 1] - KEY.theta[i]) * f) * Math.PI) / 180;
}

/**
 * Which chapter shape the mark is (0 S · 1 cube · 2 ball · 3 heart · 4 ring),
 * as a float. There are no in-between shapes: a chapter's shape holds while
 * its type is on screen and through the next scroll, then morphs slowly into
 * the next chapter's shape across the two scrolls after that.
 */
export function shapeAt(p: number) {
  if (p >= RING_STEP) return CHAPTER_STEPS.length - 1;
  if (p <= 0) return 0;
  const k = Math.floor(p / 3);
  const local = p - k * 3; // 0..3 within this chapter's stretch
  const e = Math.min(1, Math.max(0, (local - 1) / 2));
  return k + e * e * (3 - 2 * e);
}
