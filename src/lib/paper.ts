import type Lenis from "lenis";

/**
 * Shared state of the paper scroller (the DOM sections after the portal).
 * The chapter director reads it to know when a scroll up should hand control
 * back to the 3D journey: only once the paper has rested at its very top.
 */
export const paperScroll = {
  lenis: null as Lenis | null,
  y: 0,
  velocity: 0,
  /** performance.now() when the paper last arrived at y = 0, or −1. */
  topSince: -1,
};
