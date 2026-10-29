import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";

/**
 * The world is laid out around the mark, because the camera orbits it a full
 * 360°. One height function is shared by everything that sits on the ground —
 * terrain mesh, grass, rocks — so nothing floats and nothing sinks.
 *
 *   r <  ORBIT_R − 2   meadow between camera and mark, with the pond in front
 *   r ≈  ORBIT_R       the camera's path (kept clear of grass)
 *   r ≥  ROCK_R        a ring of boulders, then hills rising into the haze
 */
const noise = new SimplexNoise({ random: mulberry32(7) });

/** Where the mark lives; the orbit is centred on it. */
export const MARK = { x: 0, y: 3.45, z: -5 };
export const ORBIT_R = 16.5;
export const ROCK_R = 21;
export const WATER_Y = 0;
/** Pond: an ellipse in front of the mark (as seen from the hero shot). */
export const POND = { x: 0.8, z: MARK.z + 6.2, rx: 10, rz: 3.9 };

export function pondDist(x: number, z: number) {
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
}

export function heightAt(x: number, z: number) {
  const dx = x - MARK.x;
  const dz = z - MARK.z;
  const r = Math.hypot(dx, dz);
  const roll = noise.noise(x * 0.06, z * 0.06) * 0.2 + noise.noise(x * 0.18, z * 0.18) * 0.06;
  const hills = smoothstep(ROCK_R + 2, ROCK_R + 26, r) * (2.2 + noise.noise(dx * 0.05, dz * 0.05) * 1.2);
  const bank = 0.24 + roll + hills;
  const lake = 1 - smoothstep(0.78, 1.12, pondDist(x, z));
  return bank * (1 - lake) + -0.7 * lake;
}

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Deterministic PRNG so the world is identical on every load. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
