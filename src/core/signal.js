/**
 * Scroll as instrument.
 *
 * Position is narrative progress. Velocity is an independent design input —
 * dwelling reveals detail, speed accelerates the environment, and past a
 * ceiling the system audibly and visibly loses synchronisation. Direction is
 * respected everywhere, so scrolling back reverses the choreography exactly
 * rather than replaying it forward.
 *
 * Reads scroll position once per frame in the clock rather than listening for
 * scroll events. Event-driven sampling is jittery and rate-limited by the
 * browser; per-frame sampling gives true velocity aligned to the render.
 */

import { state, fired, THRESH } from './state.js';
import { clamp01, damp, norm, ease, lerp } from './math.js';
import { layout } from '../content/movements.js';

let bands = [];
let total = 1;
let prevY = 0;
let lockTimer = 0;
let desyncCooldown = 0;
let lockCooldown = 0;
let glideFrom = 0;
let glideTo = 0;
let glideT = 0;
let glideDur = 0;
let glideEase = ease.camera;
let glideDone = null;

const listeners = { scene: [], desync: [], resync: [], lock: [], tooFast: [], reversal: [] };

export function on(event, fn) {
  listeners[event].push(fn);
  return () => {
    const i = listeners[event].indexOf(fn);
    if (i >= 0) listeners[event].splice(i, 1);
  };
}

const emit = (event, ...args) => {
  const l = listeners[event];
  for (let i = 0; i < l.length; i++) l[i](...args);
};

/** Recompute the document height. Called on boot and on resize. */
export function measure() {
  const l = layout(state.viewportH, state.edit);
  bands = l.bands;
  total = l.total;
  const spacer = document.getElementById('scroll-extent');
  if (spacer) spacer.style.height = `${total}px`;
  return l;
}

export const getBands = () => bands;
export const getTotal = () => total;

/** Absolute document Y at a normalised point inside a movement. */
export function yAt(sceneIndex, progress = 0) {
  const b = bands[Math.max(0, Math.min(bands.length - 1, sceneIndex))];
  return b.start + b.height * clamp01(progress);
}

/** Drive the scroll position under script control. Used by RETURN. */
export function glide(targetY, duration, easing = ease.camera, done = null) {
  glideFrom = window.scrollY;
  glideTo = Math.max(0, Math.min(total - state.viewportH, targetY));
  glideDur = Math.max(0.001, duration);
  glideT = 0;
  glideEase = easing;
  glideDone = done;
  state.scripted = true;
}

export function cancelGlide() {
  state.scripted = false;
  glideDone = null;
}

function resolveScene(y) {
  // Linear scan over thirteen bands is cheaper than any index it could build.
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (y < b.end || i === bands.length - 1) {
      return [i, clamp01((y - b.start) / b.height)];
    }
  }
  return [0, 0];
}

export function tick(dt) {
  if (state.scripted) {
    glideT += dt;
    const t = clamp01(glideT / glideDur);
    window.scrollTo(0, lerp(glideFrom, glideTo, glideEase(t)));
    if (t >= 1) {
      state.scripted = false;
      const cb = glideDone;
      glideDone = null;
      if (cb) cb();
    }
  }

  const y = window.scrollY;
  const delta = y - prevY;
  prevY = y;

  state.scrollY = y;
  state.scrollProgress = clamp01(y / Math.max(1, total - state.viewportH));

  const instant = delta / dt;
  state.rawSpeed = Math.abs(instant);
  // Two-stage smoothing: enough to kill wheel-tick chatter, fast enough that
  // the environment responds inside a single gesture.
  state.scrollVelocity = damp(state.scrollVelocity, instant, 0.28, dt);
  state.speed = clamp01(Math.abs(state.scrollVelocity) / THRESH.desync);

  /*
   * Everything that asks "how fast is this person travelling" reads the
   * smoothed velocity rather than the per-frame delta.
   *
   * A mouse wheel delivers one large delta and then several frames of nothing,
   * so the instantaneous value alternates between enormous and zero. Judging
   * state on that has two failure modes, both of which were real: sync decayed
   * on the spike and recovered in the gaps, so a genuinely fast wheel user could
   * never trigger the desync beat; and dwell accumulated during those same gaps,
   * so the rewards for standing still appeared while someone was racing. The
   * raw value is kept only where an instantaneous reading is the point — the
   * peak in the session record, and the flinch ORIGIN responds to.
   */
  const travel = Math.abs(state.scrollVelocity);

  if (Math.abs(delta) > 0.5) {
    const dir = delta > 0 ? 1 : -1;
    if (dir !== state.scrollDirection) {
      state.scrollDirection = dir;
      emit('reversal', dir);
    }
  }

  // Dwell. Rewards slow inspection rather than punishing it.
  if (travel < THRESH.still) {
    state.dwell += dt;
  } else {
    state.dwell = damp(state.dwell, 0, 0.5, dt);
  }

  // ── Synchronisation ───────────────────────────────────────────────────────
  const over = norm(travel, THRESH.accel, THRESH.desync);
  const wasDesynced = state.systemState === 'desynced';

  if (over > 0) {
    state.sync = clamp01(state.sync - over * 1.9 * dt);
  } else {
    state.sync = clamp01(state.sync + (1 - state.sync) * Math.min(1, dt * 1.7));
  }

  state.systemState =
    state.sync < 0.4 ? 'desynced' : travel > THRESH.stable ? 'accelerating' : 'stable';

  desyncCooldown = Math.max(0, desyncCooldown - dt);
  lockCooldown = Math.max(0, lockCooldown - dt);

  if (state.systemState === 'desynced' && !wasDesynced) {
    fired.firstDesync = true;
    emit('desync', state.sync);
  } else if (wasDesynced && state.systemState !== 'desynced') {
    emit('resync');
  }

  // The strongest beat in the piece, so it is rationed hard: twice per visit.
  if (state.sync < 0.12 && fired.tooFast < 2 && desyncCooldown === 0) {
    fired.tooFast++;
    desyncCooldown = 22;
    emit('tooFast', fired.tooFast);
  }

  // ── The ideal band ────────────────────────────────────────────────────────
  const inBand = travel >= THRESH.lockLo && travel <= THRESH.lockHi;
  if (inBand) {
    lockTimer += dt;
    if (lockTimer >= THRESH.lockDwell && !state.locked) {
      state.locked = true;
      if (lockCooldown === 0) {
        fired.syncFound++;
        lockCooldown = 14;
        emit('lock', fired.syncFound);
      }
    }
  } else {
    lockTimer = Math.max(0, lockTimer - dt * 2.2);
    if (lockTimer === 0) state.locked = false;
  }

  // ── Scene resolution ──────────────────────────────────────────────────────
  const [scene, progress] = resolveScene(y);
  if (scene !== state.scene) {
    const from = state.scene;
    state.scene = scene;
    state.sceneId = bands[scene].id;
    emit('scene', scene, from);
  }
  state.sceneProgress = progress;
}

export function init() {
  prevY = window.scrollY;
  measure();
  const [scene, progress] = resolveScene(prevY);
  state.scene = scene;
  state.sceneId = bands[scene].id;
  state.sceneProgress = progress;
}
