/**
 * MOVEMENT 08 — FAILURE
 *
 * The structure breaks. This is the emotional low point and it is the only
 * movement that is allowed to take something away from the visitor.
 *
 * It is built as the exact inverse of ASSEMBLY, and the instrument makes that
 * legible: the link readout climbed from zero to several hundred while the
 * lattice was being built, and here it falls back toward zero as connections
 * fail. Nothing else in the film reverses a previous movement's plot.
 *
 * Three things break, in the order they break in real systems. Connections go
 * first — a link is only drawn while both of its nodes are still intact.
 * Structure goes second: a failed node loses its grip, gravity takes it, and it
 * settles into debris on the floor. And then some things simply stop: nine nodes
 * never fall and never reconnect. They hold their original positions,
 * unresolved, and they are the ones carrying labels.
 *
 * The honest part is that last third. A portfolio that shows only finished
 * surfaces is not showing engineering, and a system that has never failed has
 * usually never been used.
 */

import { ease, lerp, clamp01, hash01 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel, lrect } from './kit.js';
import { FAILURES } from '../content/work.js';

const NX = 16;
const NY = 16;
const PITCH = 44;
const HALF_W = ((NX - 1) * PITCH) / 2;
const HALF_H = ((NY - 1) * PITCH) / 2;

/**
 * Where the debris settles.
 *
 * This has to sit inside the frame. World space puts 1000 units across the
 * short axis, so the visible band is roughly ±500 — a floor at −520 dropped the
 * entire collapse out of shot and the movement read as an empty black frame
 * with captions. The point of the scene is watching the structure come down.
 */
const FLOOR = -360;

/** When each node gives way, in [0,1]. Deterministic, so failure is repeatable. */
const failAt = new Float32Array(R.N);

/** The nodes that never fall and never reconnect. */
const unresolved = [];

/** Fraction of the structure still intact. Reported, not invented. */
let integrity = 1;

export default {
  id: 'failure',

  enter() {
    unresolved.length = 0;

    for (let i = 0; i < R.N; i++) {
      failAt[i] = hash01(i * 2029 + 11);
      R.alive[i] = 1;
      R.role[i] = 0;
    }

    // The nine latest-failing nodes are the ones that never resolve. Choosing
    // them from the same ordering keeps the whole scene derived from one
    // deterministic source.
    const order = Array.from({ length: R.N }, (_, i) => i).sort((a, b) => failAt[b] - failAt[a]);
    for (let n = 0; n < 9; n++) {
      unresolved.push(order[n]);
      R.role[order[n]] = 1;
    }
  },

  field(p, dt) {
    // Slack. Nothing here is held firmly, which is the whole condition.
    R.physics.stiffness = 12;
    R.physics.damping = 0.9;

    const decay = ease.in(sub(p, 0.14, 0.82));
    // The only movement in the film that uses gravity.
    R.physics.gravityY = -300 * decay;

    let intact = 0;

    for (let i = 0; i < R.N; i++) {
      const ix = i % NX;
      const iy = (i / NX) | 0;
      const gx = (ix - (NX - 1) / 2) * PITCH;
      const gy = ((NY - 1) / 2 - iy) * PITCH;

      const failed = decay > failAt[i];
      const isUnresolved = R.role[i] === 1;

      if (isUnresolved) {
        // Held exactly where it was. Not falling, not connected, not finished.
        aimAt(i, gx, gy, 0);
        R.grip[i] = 0.9;
        R.size[i] = 1.3;
        R.alive[i] = 0.85;
        // A slow flicker: something is still trying.
        const flicker = (Math.sin(state.time * 2.1 + i) * 0.5 + 0.5) ** 3;
        warm(i, 0.06 + flicker * 0.5 * decay, 0.12, dt);
        continue;
      }

      if (!failed) {
        intact++;
        aimAt(i, gx, gy, 0);
        R.grip[i] = 1.1;
        R.size[i] = 1;
        R.alive[i] = 1;
        warm(i, 0.03, 0.05, dt);
      } else {
        // How long ago this node gave way. Debris settles into a pile rather
        // than dusting itself evenly across the frame — wreckage has a location.
        const since = clamp01((decay - failAt[i]) * 4);
        const dx = gx + (hash01(i * 17 + 3) - 0.5) * 150 * since;
        const dz = (hash01(i * 23 + 7) - 0.5) * 170 * since;
        aimAt(i, dx, lerp(gy, FLOOR + hash01(i * 31) * 46, ease.in(since)), dz);
        R.grip[i] = 0.1;
        R.size[i] = 0.85;
        // Debris stays visible. It is wreckage, not a disappearance — the frame
        // has to keep the evidence of what came down.
        R.alive[i] = 1 - since * 0.42;
        // A brief spark as it goes, then nothing.
        warm(i, 0.02 + ease.breathe(since) * 0.28, 0.1, dt);
      }
    }

    integrity = intact / R.N;

    // A connection survives only while both of its nodes do. Nothing is drawn
    // spanning a gap that has already opened.
    const ok = (j) => R.role[j] !== 1 && decay <= failAt[j];
    for (let i = 0; i < R.N; i++) {
      if (!ok(i)) continue;
      if (i % NX !== NX - 1 && ok(i + 1)) R.link(i, i + 1, 0);
      if (i + NX < R.N && ok(i + NX)) R.link(i, i + NX, 0);
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.72, 0.9] });
    const decay = ease.in(sub(p, 0.14, 0.82));

    // ── What was there ──────────────────────────────────────────────────────
    // The outline of the intact structure stays in frame after the structure
    // itself has gone. Being able to see the shape of what was lost is the
    // difference between a collapse and a mess.
    lrect(0, 0, 0, HALF_W * 2, HALF_H * 2, 0, 0.12 + decay * 0.2, 1);

    // ── Debris plane ────────────────────────────────────────────────────────
    if (decay > 0.05) {
      const a = decay * 0.24;
      for (let g = -3; g <= 3; g++) {
        const z = g * 120;
        lline(-HALF_W - 180, FLOOR - 40, z, HALF_W + 180, FLOOR - 40, z, 0, a * (1 - Math.abs(g) * 0.2), 1);
      }
    }

    // ── Integrity ───────────────────────────────────────────────────────────
    // Derived from how many nodes are actually still in place.
    llabel(-HALF_W, HALF_H + 92, 0, 'INTEGRITY', 0, 0.62, 9, 'left');
    llabel(
      -HALF_W,
      HALF_H + 66,
      0,
      `${String(Math.round(integrity * 100)).padStart(3, ' ')}%`,
      integrity < 0.5 ? 0.9 : 0,
      0.95,
      15,
      'left'
    );

    // ── Unresolved ──────────────────────────────────────────────────────────
    // The labels sit on the nodes that never resolved, so the words are
    // attached to the specific things that are still broken.
    if (decay > 0.25) {
      const a = clamp01((decay - 0.25) / 0.4);
      for (let n = 0; n < unresolved.length && n < FAILURES.length; n++) {
        const i = unresolved[n];
        const ix = i % NX;
        const iy = (i / NX) | 0;
        const gx = (ix - (NX - 1) / 2) * PITCH;
        const gy = ((NY - 1) / 2 - iy) * PITCH;
        const side = gx >= 0 ? 1 : -1;
        lline(gx, gy, 0, gx + side * 26, gy + 14, 0, 0.7, a * 0.45, 1);
        llabel(
          gx + side * 32,
          gy + 16,
          0,
          FAILURES[n],
          0,
          a * 0.85,
          8,
          side > 0 ? 'left' : 'right'
        );
      }
    }

    // ── The hold ────────────────────────────────────────────────────────────
    if (hold > 0.05) {
      llabel(0, FLOOR - 110, 0, 'SOME STATE REMAINS UNRESOLVED', 0, hold * 0.5, 10, 'center');
    }

    if (c > 0.04) {
      const a = c * 0.32;
      llabel(HALF_W, HALF_H + 92, 0, `LOST ${R.N - Math.round(integrity * R.N)}`, 0, a, 8, 'right');
      llabel(HALF_W, HALF_H + 74, 0, `UNRESOLVED ${unresolved.length}`, 0, a, 8, 'right');
    }
  },
};
