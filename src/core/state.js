/**
 * One source of truth.
 *
 * A single mutable object, never reallocated, read by every subsystem in the
 * same frame. Subsystems must not write to fields they do not own — ownership
 * is noted per field. This is the contract that stops competing animation
 * loops from fighting each other.
 */

export const state = {
  // ── owned by signal.js ────────────────────────────────────────────────────
  /** 0..1 across the whole document. */
  scrollProgress: 0,
  scrollY: 0,
  /** 0..1 within the current movement. */
  sceneProgress: 0,
  /** Signed, px/s, smoothed. Negative is upward. */
  scrollVelocity: 0,
  /** Unsmoothed magnitude, px/s. For impact detection. */
  rawSpeed: 0,
  /** 0..1 normalised magnitude against the desync threshold. */
  speed: 0,
  scrollDirection: 1,
  /** Index into MOVEMENTS. */
  scene: 0,
  sceneId: 'origin',
  /** Seconds the visitor has held near-still. Rewards curiosity. */
  dwell: 0,
  /** 0..1. Falls when scrolled faster than the system can follow. */
  sync: 1,
  /** True while held inside the ideal velocity band. */
  locked: false,
  /** 'stable' | 'accelerating' | 'desynced' */
  systemState: 'stable',
  /** Set while a scripted glide owns the scroll position. */
  scripted: false,

  // ── owned by clock.js ─────────────────────────────────────────────────────
  time: 0,
  dt: 0,
  frame: 0,
  /** Rolling average, Hz. */
  fps: 60,

  // ── owned by boot.js ──────────────────────────────────────────────────────
  /** 'wide' | 'hand' — separate edits, not a scaled layout. */
  edit: 'wide',
  reduced: false,
  viewportW: 1280,
  viewportH: 720,
  dpr: 1,
  /** Falls to 0 when the tab is hidden so nothing animates off-screen. */
  visible: 1,

  // ── owned by pointer.js ───────────────────────────────────────────────────
  /** −1..1, smoothed, origin at viewport centre. */
  pointerX: 0,
  pointerY: 0,
  pointerActive: 0,

  // ── owned by score.js ─────────────────────────────────────────────────────
  audioEnergy: 0,
  audioOn: false,
};

/**
 * Narrative events that have already fired. Guards one-shot beats so the
 * strongest moments cannot become repetitive warnings.
 */
export const fired = {
  tooFast: 0,
  syncFound: 0,
  firstDesync: false,
  sigilBuilt: false,
};

/**
 * Velocity thresholds, px/s, measured against the smoothed travel speed rather
 * than the per-frame delta. Tuned against both a trackpad and a notched wheel:
 * a wheel's smoothed average sits well below its instantaneous spikes, so
 * thresholds set from spike values are never reached in practice.
 */
export const THRESH = {
  /** Below this the visitor is considered to be dwelling. */
  still: 70,
  /** Ceiling of comfortable reading speed. */
  stable: 1900,
  /** Above this the environment visibly accelerates. */
  accel: 4200,
  /** Above this synchronisation degrades. */
  desync: 7000,
  /** The ideal band. Hitting it locks camera, object and score together. */
  lockLo: 820,
  lockHi: 1720,
  /** Seconds inside the band before the lock is acknowledged. */
  lockDwell: 0.9,
};
