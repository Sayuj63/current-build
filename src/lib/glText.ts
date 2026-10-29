/**
 * Hand-off between the DOM hero copy and the WebGL text layer.
 *
 * The hero animates its type in as real DOM. Once settled, it points `root`
 * at itself and bumps `version`; the text layer then redraws every
 * `[data-gl]` line into a texture that lives inside the 3D frame, so the
 * same cursor-trail distortion that bends the world bends the type too.
 */
export const glText = {
  root: null as HTMLElement | null,
  version: 0,
  visible: false,
  /** True while lines are animating: the layer redraws every frame. */
  live: false,
  /** Liquid melt applied to the type texture during an exit, 0–1. */
  warp: 0,
};
