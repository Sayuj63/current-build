/**
 * THE REGISTER — the recurring entity.
 *
 * Exactly 256 nodes. Allocated once at module load and never destroyed, never
 * added to, never reset. Movements do not replace the object; they replace the
 * *law* that governs it. When the visitor crosses from CHAOS into ASSEMBLY the
 * identical particles physically travel out of the noise field and into the
 * lattice, because there is nothing else for them to do.
 *
 * That is why continuity in this piece is structural rather than animated. No
 * cross-fade is required between scenes: A cannot stop being A and start being
 * B, because A and B were always the same 256 things.
 *
 * 256 is not arbitrary. A SHA-256 digest is 256 bits, so in TRUST the register
 * becomes a real digest — one node per bit — and at the end it becomes the
 * digest of the visitor's own session.
 *
 * Memory layout is structure-of-arrays over typed arrays: one contiguous read
 * per attribute per frame, no per-node objects, no allocation in the hot path.
 */

import { fibSphere, rng, clamp01 } from '../core/math.js';

export const N = 256;
const LINK_CAP = 2048;

const seedRandom = rng(0x53415955); // "SAYU"

/** Live position. */
export const x = new Float32Array(N);
export const y = new Float32Array(N);
export const z = new Float32Array(N);

/** Velocity. Persists across law changes — this is what carries momentum. */
export const vx = new Float32Array(N);
export const vy = new Float32Array(N);
export const vz = new Float32Array(N);

/** Where the current law wants each node. */
export const tx = new Float32Array(N);
export const ty = new Float32Array(N);
export const tz = new Float32Array(N);

/**
 * How hard this node pulls toward its target, 0..1+. Laws vary it per node to
 * make some nodes feel seated and others loose within the same formation.
 */
export const grip = new Float32Array(N);

/** 0 = inert monochrome, 1 = fully active orange. Colour is a state signal. */
export const heat = new Float32Array(N);

/** Render radius in world units. */
export const size = new Float32Array(N);

/** 0 or 1. Written by TRUST and by the closing sigil. */
export const bit = new Uint8Array(N);

/** 1 = intact. FAILURE drives this down; REBUILD brings it back. */
export const alive = new Float32Array(N);

/** Law-specific integer channel: lane, cluster, stage, candidate id. */
export const role = new Int16Array(N);

/** Law-specific scalar channel. */
export const phase = new Float32Array(N);

/** Immutable per-node character. Identical on every load and on reverse. */
export const seed = new Float32Array(N);

/** Stable per-node offset on the unit sphere. */
export const restX = new Float32Array(N);
export const restY = new Float32Array(N);
export const restZ = new Float32Array(N);

// ── Link buffer ─────────────────────────────────────────────────────────────
// Laws rewrite topology each frame. At 256 nodes this is cheaper than any
// incremental structure and lets connections form and snap freely.

export const linkA = new Uint16Array(LINK_CAP);
export const linkB = new Uint16Array(LINK_CAP);
export const linkHeat = new Float32Array(LINK_CAP);
export let linkCount = 0;

export function clearLinks() {
  linkCount = 0;
}

export function link(a, b, h = 0) {
  if (linkCount >= LINK_CAP) return;
  linkA[linkCount] = a;
  linkB[linkCount] = b;
  linkHeat[linkCount] = h;
  linkCount++;
}

export const getLinkCount = () => linkCount;

// ── Global physics, set by the active law each frame ────────────────────────

export const physics = {
  /** Spring constant applied through per-node grip. */
  stiffness: 26,
  /** Velocity retained per 1/60 s. Lower = heavier. */
  damping: 0.86,
  /** Constant acceleration. Only FAILURE uses this. */
  gravityY: 0,
  /** Scales all motion; drops to 0 to freeze the register mid-flight. */
  timeScale: 1,
};

export function resetPhysics() {
  physics.stiffness = 26;
  physics.damping = 0.86;
  physics.gravityY = 0;
  physics.timeScale = 1;
}

// ── Initial condition ───────────────────────────────────────────────────────

(function seedRegister() {
  for (let i = 0; i < N; i++) {
    seed[i] = seedRandom();
    const [sx, sy, sz] = fibSphere(i, N);
    restX[i] = sx;
    restY[i] = sy;
    restZ[i] = sz;

    // Everything begins collapsed almost to a point. ORIGIN opens from here.
    const r = 6 + seed[i] * 3;
    x[i] = sx * r;
    y[i] = sy * r;
    z[i] = sz * r;
    tx[i] = x[i];
    ty[i] = y[i];
    tz[i] = z[i];
    grip[i] = 1;
    heat[i] = 0;
    size[i] = 1;
    alive[i] = 1;
    bit[i] = 0;
    role[i] = 0;
    phase[i] = seed[i] * Math.PI * 2;
  }
})();

// ── Integrator ──────────────────────────────────────────────────────────────

/**
 * The single integrator. Runs once per frame after the active law has written
 * targets. Because it is shared and never reset, a node's momentum survives
 * the boundary between movements — which is precisely the effect we want.
 */
export function integrate(dt) {
  const h = dt * physics.timeScale;
  if (h <= 0) return;

  const k = physics.stiffness;
  const damp = Math.pow(physics.damping, h * 60);
  const g = physics.gravityY;

  for (let i = 0; i < N; i++) {
    const gi = grip[i];

    vx[i] = (vx[i] + (tx[i] - x[i]) * gi * k * h) * damp;
    vy[i] = (vy[i] + ((ty[i] - y[i]) * gi * k + g) * h) * damp;
    vz[i] = (vz[i] + (tz[i] - z[i]) * gi * k * h) * damp;

    x[i] += vx[i] * h;
    y[i] += vy[i] * h;
    z[i] += vz[i] * h;
  }
}

/** Speed of a node in world units per second. Drives render streaks. */
export function nodeSpeed(i) {
  return Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
}

/** Mean speed across the register. Feeds the score and the lens. */
export function agitation() {
  let s = 0;
  for (let i = 0; i < N; i++) s += Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(vz[i]);
  return s / N;
}

/** Mean heat. Used for global exposure response. */
export function activity() {
  let s = 0;
  for (let i = 0; i < N; i++) s += heat[i];
  return s / N;
}

/** Write the 256 bits of a digest onto the register. */
export function loadBits(bytes) {
  for (let i = 0; i < N; i++) {
    const byteIndex = i >> 3;
    const bitIndex = 7 - (i & 7);
    bit[i] = bytes && byteIndex < bytes.length ? (bytes[byteIndex] >> bitIndex) & 1 : 0;
  }
}

/** Uniform helpers laws use to set a whole channel without a loop each time. */
export function fillGrip(v) {
  for (let i = 0; i < N; i++) grip[i] = v;
}
export function fillSize(v) {
  for (let i = 0; i < N; i++) size[i] = v;
}
export function coolTo(v, rate, dt) {
  const k = 1 - Math.pow(1 - rate, dt * 60);
  for (let i = 0; i < N; i++) heat[i] += (v - heat[i]) * k;
}
export function reviveTo(v, rate, dt) {
  const k = 1 - Math.pow(1 - rate, dt * 60);
  for (let i = 0; i < N; i++) alive[i] = clamp01(alive[i] + (v - alive[i]) * k);
}
