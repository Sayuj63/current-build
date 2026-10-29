/**
 * MOVEMENT 00 — ORIGIN
 *
 * Near-black void, one object, almost no information. The purpose is curiosity
 * and nothing else, so the restraint here is the design: no environment, no
 * grid, no title, no particles beyond the entity itself.
 *
 * Three things make this scene work.
 *
 * First, the object is not decorative geometry — it is the register at rest,
 * collapsed almost to a point. Everything that happens for the next twelve
 * movements happens to these same 256 nodes.
 *
 * Second, the smallest scroll produces a physical response before it produces
 * any progress. The equatorial ring breathes outward with input, and once
 * touched it keeps a faint ember for the rest of the movement. The object
 * remembers having been touched, which is the first hint that this is a system
 * rather than a video.
 *
 * Third, the exit is not a transition. The shell splits along its own equator
 * and the halves separate, so the nodes leave ORIGIN already travelling
 * outward — and CHAOS inherits that momentum instead of starting from rest.
 *
 * Slow visitors are rewarded rather than punished: hold still and the frame
 * puts calipers on the object and tells you what it is called.
 */

import { state } from '../core/state.js';
import { ease, lerp, clamp01, TAU } from '../core/math.js';
import * as R from '../entity/register.js';
import {
  sub,
  staggerSeed,
  curiosity,
  aimAt,
  warm,
  rotY,
  rotX,
  knn,
  loop,
  lline,
  llabel,
  lring,
} from './kit.js';

const SHELL = 0;
const CORE = 1;
const RING = 2;

const RING_N = 32;
const ringIdx = [];
const coreIdx = [];

/** Peak-following response to input. Decays fast; this is a flinch, not a mode. */
let response = 0;
/** Retained trace of having been touched at all. Never decays within the scene. */
let awoken = 0;

/** Radius of the assembled object, in world units. */
const R_COLLAPSED = 9;
const R_OPEN = 300;

/** Live global radius, needed by the stage for the calipers. */
let radiusNow = R_COLLAPSED;

export default {
  id: 'origin',

  enter() {
    ringIdx.length = 0;
    coreIdx.length = 0;

    // Interleaved by index so every subset is itself evenly distributed over
    // the sphere. A contiguous split would band the object into stripes.
    for (let i = 0; i < R.N; i++) {
      const m = i % 8;
      if (m === 0) {
        R.role[i] = RING;
        ringIdx.push(i);
      } else if (m === 1 || m === 2) {
        R.role[i] = CORE;
        coreIdx.push(i);
      } else {
        R.role[i] = SHELL;
      }
      R.alive[i] = 1;
      R.bit[i] = 0;
    }
  },

  field(p, dt) {
    // Heavy and precisely seated. This object is machined, not organic.
    R.physics.stiffness = 18;
    R.physics.damping = 0.845;

    // Input response. The peak follower means a flick reads as a flinch and a
    // sustained scroll reads as a sustained push.
    const impulse = clamp01(state.rawSpeed / 1100);
    response = Math.max(response * Math.pow(0.12, dt), impulse);
    awoken = Math.max(awoken, Math.min(1, impulse * 1.6));

    const grow = ease.out(sub(p, 0.06, 0.58));
    const op = ease.outQuart(sub(p, 0.78, 1.0));

    // One coherent radius for the mechanism, per-node staggering for the shell.
    const radG = lerp(R_COLLAPSED, R_OPEN, grow);
    radiusNow = radG;

    const spin = state.time * 0.055 + p * 0.9;
    const tilt = 0.28 + Math.sin(state.time * 0.07) * 0.022;

    // The ring opens decisively but stays inside the frame; a mechanism
    // operating, not an object detonating.
    const ringR = radG * 1.16 + response * 38 + op * radG * 0.45;
    const ringA = state.time * 0.12 + p * 1.6;

    for (let i = 0; i < R.N; i++) {
      const role = R.role[i];
      let lx, ly, lz, useSpin;

      if (role === RING) {
        // The ring sits on the object's own equator, in local XZ.
        const k = i >> 3;
        const a = (k / RING_N) * TAU + ringA;
        lx = Math.cos(a) * ringR;
        ly = 0;
        lz = Math.sin(a) * ringR;
        useSpin = 0; // the ring carries its own rotation
        R.grip[i] = 1.5;
        R.size[i] = 1.45 + op * 0.35;
      } else if (role === CORE) {
        const cr = radG * (0.4 + op * 0.34);
        lx = R.restX[i] * cr;
        ly = R.restY[i] * cr;
        lz = R.restZ[i] * cr;
        useSpin = -spin * 0.65; // counter-rotating interior
        R.grip[i] = 0.42;
        R.size[i] = 1.2 + op * 0.4;
      } else {
        const gi = ease.outQuart(staggerSeed(i, grow, 0.62));
        const rr = lerp(R_COLLAPSED, R_OPEN, gi);
        lx = R.restX[i] * rr;
        ly = R.restY[i] * rr;
        lz = R.restZ[i] * rr;
        // The shell splits along its own equator, so the seam belongs to the
        // object and stays attached to it through the rotation.
        if (op > 0) {
          const s = R.restY[i] >= 0 ? 1 : -1;
          ly += s * op * 235;
          const bulge = 1 + op * 0.3;
          lx *= bulge;
          lz *= bulge;
        }
        useSpin = spin;
        R.grip[i] = 0.85 + R.seed[i] * 0.3;
        R.size[i] = 1;
      }

      let v = rotY(lx, ly, lz, useSpin);
      v = rotX(v.x, v.y, v.z, tilt);
      aimAt(i, v.x, v.y, v.z);

      // Colour is a state signal, so almost everything here stays monochrome.
      // The interior lights progressively rather than all at once — a hundred
      // nodes igniting on the same frame reads as fire, not as revelation.
      let heatTarget = 0.03;
      let rate = 0.05;
      if (role === RING) {
        heatTarget = Math.max(0.03, awoken * 0.45, response * 0.9, op * 0.9);
        rate = 0.22;
      } else if (role === CORE) {
        heatTarget = lerp(0.03, 0.62, ease.out(staggerSeed(i, op, 0.5)));
      } else if (Math.abs(R.restY[i]) < 0.19) {
        // Nodes on the seam light as the object gives way.
        heatTarget = 0.03 + op * 0.42;
      }
      warm(i, heatTarget, rate, dt);
    }

    // ── Topology ────────────────────────────────────────────────────────────

    // Geodesic cage over the shell. Written by hand rather than via cage()
    // because the seam has to be able to break: past the halfway point of the
    // opening, links spanning the equator stop being emitted, so the cage
    // stretches and then snaps rather than rubber-banding across the gap.
    const k = 5;
    const nb = knn(k);
    const seamBreaks = op > 0.42;
    for (let i = 0; i < R.N; i++) {
      if (R.role[i] !== SHELL) continue;
      for (let s = 0; s < k; s++) {
        const j = nb[i * k + s];
        if (j <= i || R.role[j] !== SHELL) continue;
        if (seamBreaks && R.restY[i] >= 0 !== R.restY[j] >= 0) continue;
        R.link(i, j, 0);
      }
    }

    loop(ringIdx, Math.max(awoken * 0.4, op));

    // A sparse interior web. Two links per core node reads as mechanism; more
    // reads as a ball of wool.
    const nb2 = knn(3);
    for (let n = 0; n < coreIdx.length; n++) {
      const i = coreIdx[n];
      for (let s = 0; s < 3; s++) {
        const j = nb2[i * 3 + s];
        if (j <= i || R.role[j] !== CORE) continue;
        R.link(i, j, op * 0.8);
      }
    }
  },

  /**
   * The void. The only thing ever drawn here is the reward for standing still:
   * calipers on the object and its name. Fast visitors never see it, which is
   * the intended asymmetry.
   */
  stage(p) {
    const c = curiosity();
    const op = sub(p, 0.78, 1);
    // Instruments retract as the object begins to come apart. Measuring
    // something mid-failure would be a lie about what the frame is doing.
    const a = c * 0.3 * (1 - op);
    if (a < 0.006) {
      if (op > 0.01) lring(0, 0, 0, radiusNow * 1.16, 0.9, op * 0.12, 1, 64);
      return;
    }

    const rad = radiusNow;
    const ext = rad * 0.62;

    // Caliper jaws, frame-aligned rather than object-aligned, because a
    // measuring instrument does not rotate with the thing it measures.
    lline(-rad, -ext, 0, -rad, ext, 0, 0, a * 0.75, 1);
    lline(rad, -ext, 0, rad, ext, 0, 0, a * 0.75, 1);

    // Dimension line, clear of the object so the readout is legible.
    const dy = -rad * 1.16;
    lline(-rad, dy, 0, rad, dy, 0, 0, a * 0.5, 1);
    lline(-rad, dy - 9, 0, -rad, dy + 9, 0, 0, a * 0.6, 1);
    lline(rad, dy - 9, 0, rad, dy + 9, 0, 0, a * 0.6, 1);

    llabel(0, dy - 30, 0, `Ø ${(rad * 2).toFixed(0)}`, 0, a * 1.9, 9, 'center');

    // The entity gets named exactly once in the whole film, here, to whoever
    // waited. 256 is the number that the ending depends on.
    llabel(rad * 1.5, ext * 0.72, 0, 'REGISTER', 0, a * 1.7, 9, 'left');
    llabel(rad * 1.5, ext * 0.72 - 26, 0, '256 NODES', 0.85, a * 1.5, 9, 'left');

    // A faint reference frame. Corner ticks only — a full box would be furniture.
    const b = rad * 1.32;
    const t = rad * 0.16;
    const corners = [
      [-b, b, -1, 1],
      [b, b, 1, 1],
      [-b, -b, -1, -1],
      [b, -b, 1, -1],
    ];
    for (let i = 0; i < 4; i++) {
      const [cx, cy, sx, sy] = corners[i];
      lline(cx, cy, 0, cx - sx * t, cy, 0, 0, a * 0.4, 1);
      lline(cx, cy, 0, cx, cy - sy * t, 0, 0, a * 0.4, 1);
    }

    // Once the shell begins to give way the ring's swept path is drawn, so the
    // opening reads as a mechanism operating rather than an object exploding.
    if (op > 0.01) {
      lring(0, 0, 0, radiusNow * 1.16, 0.9, op * 0.12, 1, 64);
    }
  },
};
