/**
 * The only animation loop in the application.
 *
 * Every subsystem registers a tick and is called in priority order once per
 * frame, so signal always resolves before the world reads it and the lens
 * always composites after the world has drawn. Nothing else may call
 * requestAnimationFrame.
 */

import { state } from './state.js';

const PRIORITY = { SIGNAL: 0, WORLD: 10, ENTITY: 20, LENS: 30, UI: 40, SOUND: 50 };

const ticks = [];
let running = false;
let last = 0;
let rafId = 0;
let fpsAccum = 0;
let fpsFrames = 0;

/** Large dt after a tab switch would launch the physics into orbit. */
const MAX_DT = 1 / 20;

export function add(fn, priority = PRIORITY.UI, label = '') {
  ticks.push({ fn, priority, label });
  ticks.sort((a, b) => a.priority - b.priority);
  return () => {
    const i = ticks.findIndex((t) => t.fn === fn);
    if (i >= 0) ticks.splice(i, 1);
  };
}

function frame(now) {
  rafId = requestAnimationFrame(frame);

  const raw = (now - last) / 1000;
  last = now;
  if (raw <= 0) return;

  const dt = Math.min(raw, MAX_DT);
  state.dt = dt;
  state.time += dt;
  state.frame++;

  fpsAccum += raw;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    state.fps = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  for (let i = 0; i < ticks.length; i++) {
    ticks[i].fn(dt, state);
  }
}

export function start() {
  if (running) return;
  running = true;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

export function stop() {
  running = false;
  cancelAnimationFrame(rafId);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.visible = 0;
    stop();
  } else {
    state.visible = 1;
    start();
  }
});

export { PRIORITY };
