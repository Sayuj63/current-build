/**
 * Numeric foundation. No dependencies.
 *
 * Easing is organised by physical meaning, not by name, because the motion
 * spec assigns curves to roles: linear for system/data movement, ease-out for
 * arrival, spring for physical UI, long slow curves for camera.
 */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = lerp;

/** Inverse lerp, clamped. Maps a value in [a,b] onto [0,1]. */
export const norm = (v, a, b) => (b === a ? 0 : clamp01((v - a) / (b - a)));

/** Remap without clamping. */
export const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);

export const smoothstep = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};

export const smootherstep = (t) => {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Framerate-independent exponential approach.
 *
 * `rate` is the fraction of remaining distance closed per 1/60 s, so the same
 * constant behaves identically at 60 Hz and 120 Hz. This is the workhorse for
 * everything with weight: camera, background, pointer.
 */
export function damp(current, target, rate, dt) {
  if (rate >= 1) return target;
  const k = 1 - Math.pow(1 - rate, dt * 60);
  return current + (target - current) * k;
}

/** Critically-damped spring toward target. Returns [value, velocity]. */
export function spring(value, velocity, target, stiffness, damping, dt) {
  const force = (target - value) * stiffness;
  velocity = (velocity + force * dt) * Math.pow(damping, dt * 60);
  return [value + velocity * dt, velocity];
}

// ── Easing by role ──────────────────────────────────────────────────────────

export const ease = {
  /** System / data movement. Machines do not accelerate. */
  linear: (t) => t,

  /** Arrival. Decisive start, settled finish. */
  out: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),

  /** Departure. */
  in: (t) => t * t * t,

  /** Camera and environment: long, slow, no visible impulse. */
  camera: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  /** Mechanical seating — fast approach, hard stop, no bounce. */
  seat: (t) => 1 - Math.pow(1 - t, 6),

  /** Physical UI. Slight overshoot, one oscillation only. */
  spring: (t) => {
    if (t >= 1) return 1;
    return 1 - Math.pow(2, -9 * t) * Math.cos(t * 11);
  },

  /** Elastic snap for things that latch. */
  latch: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 + Math.pow(2, -11 * t) * Math.sin((t * 11 - 0.75) * (TAU / 3));
  },

  /** Breath. 0 → 1 → 0 over the unit interval, no discontinuity. */
  breathe: (t) => Math.sin(clamp01(t) * Math.PI),
};

// ── Deterministic randomness ────────────────────────────────────────────────

/**
 * mulberry32. Seeded, fast, good enough distribution for visual work.
 * Determinism matters: the register's per-node character must be identical on
 * every load and on every reverse pass, or the entity stops being one object.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap deterministic hash → [0,1). For per-node, per-frame jitter. */
export function hash01(x) {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ── Value noise ─────────────────────────────────────────────────────────────

/**
 * 3D value noise with smootherstep interpolation, built on a permutation
 * table. Chosen over simplex deliberately: value noise has flatter plateaus
 * and sharper transitions, which reads as machined rather than organic.
 */
const PERM = (() => {
  const p = new Uint8Array(512);
  const r = rng(0x5eed);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
})();

const vgrad = (h) => (h & 255) / 255;

export function noise3(x, y, z) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = smootherstep(xf),
    v = smootherstep(yf),
    w = smootherstep(zf);
  const X = xi & 255,
    Y = yi & 255,
    Z = zi & 255;

  const aaa = vgrad(PERM[PERM[PERM[X] + Y] + Z]);
  const aba = vgrad(PERM[PERM[PERM[X] + Y + 1] + Z]);
  const aab = vgrad(PERM[PERM[PERM[X] + Y] + Z + 1]);
  const abb = vgrad(PERM[PERM[PERM[X] + Y + 1] + Z + 1]);
  const baa = vgrad(PERM[PERM[PERM[X + 1] + Y] + Z]);
  const bba = vgrad(PERM[PERM[PERM[X + 1] + Y + 1] + Z]);
  const bab = vgrad(PERM[PERM[PERM[X + 1] + Y] + Z + 1]);
  const bbb = vgrad(PERM[PERM[PERM[X + 1] + Y + 1] + Z + 1]);

  const x1 = lerp(aaa, baa, u);
  const x2 = lerp(aba, bba, u);
  const x3 = lerp(aab, bab, u);
  const x4 = lerp(abb, bbb, u);
  return lerp(lerp(x1, x2, v), lerp(x3, x4, v), w) * 2 - 1;
}

/** Fractal sum. `oct` bands, each half amplitude and double frequency. */
export function fbm3(x, y, z, oct = 3) {
  let sum = 0,
    amp = 0.5,
    norm_ = 0;
  for (let i = 0; i < oct; i++) {
    sum += noise3(x, y, z) * amp;
    norm_ += amp;
    x *= 2.03;
    y *= 2.01;
    z *= 1.97;
    amp *= 0.5;
  }
  return sum / norm_;
}

// ── Geometry helpers ────────────────────────────────────────────────────────

/**
 * Fibonacci sphere. Deterministic, near-uniform point distribution — used for
 * the register's rest formation so nodes never clump.
 */
export function fibSphere(i, n) {
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.399963229728653; // golden angle
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax,
    dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Shortest signed angular difference, in [-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Quantise to a step. Used to make readouts tick rather than glide. */
export const quantise = (v, step) => Math.round(v / step) * step;
