/**
 * Pointer.
 *
 * Lowest friction channel in the system, per the motion physics: camera is
 * medium, background is heavy, pointer is light. It is deliberately weak in
 * amplitude — the pointer nudges the frame, it does not fly the camera. On a
 * touch device it stays neutral, because a finger is not a gaze.
 */

import { state } from './state.js';
import { damp, clamp } from './math.js';

let targetX = 0;
let targetY = 0;
let targetActive = 0;

export function init() {
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        targetX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
        targetY = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
        targetActive = 1;
      },
      { passive: true }
    );

    // Leaving the window should return the frame to level, not freeze it
    // wherever the cursor happened to exit.
    document.addEventListener('pointerleave', () => {
      targetActive = 0;
      targetX = 0;
      targetY = 0;
    });
  }
}

export function tick(dt) {
  state.pointerX = damp(state.pointerX, targetX, 0.16, dt);
  // Y is inverted so a cursor high in the frame lifts the camera, which is how
  // looking up actually behaves.
  state.pointerY = damp(state.pointerY, -targetY, 0.16, dt);
  state.pointerActive = damp(state.pointerActive, targetActive, 0.05, dt);
}
