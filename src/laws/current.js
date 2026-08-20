/**
 * MOVEMENT 10 — CURRENT BUILD
 *
 * The mechanism from REBUILD, running, with the work currently attached to it.
 *
 * The three rings continue exactly as they were — same node groups, same radii,
 * same rotation rates — so there is no seam at the boundary. What changes is the
 * core: its 64 nodes migrate outward into four modules of sixteen, one per thing
 * that is actually being built right now.
 *
 * Two of those modules are RUNNING: complete, fully linked, steadily lit. Two
 * are BUILDING: visibly missing nodes, links that come and go, never resolving.
 * The difference is not a label, it is the state of the geometry — which is the
 * only honest way to show a portfolio of work in progress.
 *
 * One of the BUILDING modules is this page.
 *
 * The camera pulls back extremely slowly throughout, so the frame gradually
 * admits that the mechanism is a small thing in a large amount of empty space.
 */

import { ease, lerp, clamp01, TAU, hash01, fbm3 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel } from './kit.js';
import { CURRENT_WORK } from '../content/work.js';

const R0 = 305;
const R1 = 258;
const R2 = 212;

/** Where the four modules sit around the mechanism. */
const MOD_R = 560;
const MOD_TILT = [0.6, -0.5, 2.5, -2.6];

/** Which of the four are running rather than still being built. */
const RUNNING = [true, true, false, false];

/** Module centre for module `m`. */
function moduleCentre(out, m) {
  const a = MOD_TILT[m];
  out[0] = Math.cos(a) * MOD_R;
  out[1] = Math.sin(a) * MOD_R * 0.66;
  out[2] = (m % 2 === 0 ? -1 : 1) * 150;
  return out;
}

const MC = [0, 0, 0];

export default {
  id: 'current',

  enter() {
    for (let i = 0; i < R.N; i++) {
      R.alive[i] = 1;
      R.role[i] = i < 192 ? (i / 64) | 0 : 3 + (((i - 192) / 16) | 0);
    }
  },

  field(p, dt) {
    R.physics.stiffness = 22;
    R.physics.damping = 0.85;

    // The core migrates outward into the four modules.
    const spread = ease.out(sub(p, 0.04, 0.5));
    const t = state.time;

    for (let i = 0; i < R.N; i++) {
      if (i < 192) {
        // The rings, unchanged from REBUILD. Continuity is the point.
        const g = (i / 64) | 0;
        const n = i & 63;
        const a = (n / 64) * TAU;
        let x, y, z;
        if (g === 0) {
          const s = t * 0.1;
          x = Math.cos(a + s) * R0;
          y = 0;
          z = Math.sin(a + s) * R0;
        } else if (g === 1) {
          const s = t * 0.071;
          const cx = Math.cos(a) * R1;
          x = cx * Math.cos(s);
          y = Math.sin(a) * R1;
          z = -cx * Math.sin(s);
        } else {
          const s = -t * 0.089;
          const cy = Math.cos(a) * R2;
          x = -cy * Math.sin(s);
          y = cy * Math.cos(s);
          z = Math.sin(a) * R2;
        }
        aimAt(i, x, y, z);
        R.grip[i] = 1.25;
        R.size[i] = 1.05;
        warm(i, 0.2, 0.05, dt);
        continue;
      }

      // The modules.
      const m = ((i - 192) / 16) | 0;
      const k = (i - 192) % 16;
      moduleCentre(MC, m);

      // A 4 × 4 panel per module.
      const gx = ((k % 4) - 1.5) * 46;
      const gy = (((k / 4) | 0) - 1.5) * 46;

      const homeX = R.restX[i] * 96;
      const homeY = R.restY[i] * 96;
      const homeZ = R.restZ[i] * 96;

      const running = RUNNING[m];

      // An unbuilt socket is genuinely unoccupied, and which sockets those are
      // drifts slowly, so the module never finishes.
      const occupancy = running
        ? 1
        : fbm3(k * 0.6, m * 4.1, t * 0.09, 2) * 0.5 + 0.5 > 0.42
          ? 1
          : 0;

      const tx = lerp(homeX, MC[0] + gx, spread);
      const ty = lerp(homeY, MC[1] + gy, spread);
      const tz = lerp(homeZ, MC[2], spread);

      if (occupancy) {
        aimAt(i, tx, ty, tz);
        R.grip[i] = running ? 1.3 : 0.7;
        R.alive[i] = 1;
      } else {
        // Not yet placed: still hovering near the mechanism, unassigned.
        const j = hash01(i * 37 + ((t * 0.4) | 0)) - 0.5;
        aimAt(i, tx + j * 120, ty + j * 90, tz + 90);
        R.grip[i] = 0.28;
        R.alive[i] = 0.42;
      }

      R.size[i] = running ? 1.15 : 0.95;
      warm(i, running ? 0.62 : 0.1 + (occupancy ? 0.18 : 0), 0.07, dt);
    }

    // ── Topology ────────────────────────────────────────────────────────────
    for (let g = 0; g < 3; g++) {
      for (let n = 0; n < 64; n++) R.link(g * 64 + n, g * 64 + ((n + 1) % 64), 0.12);
    }

    // Each module wired as a 4 × 4 panel, but only between placed nodes — so a
    // module that is still building has visible holes in its wiring.
    for (let m = 0; m < 4; m++) {
      const base = 192 + m * 16;
      const live = (idx) => R.alive[idx] > 0.9;
      for (let k = 0; k < 16; k++) {
        const i = base + k;
        if (!live(i)) continue;
        if (k % 4 !== 3 && live(i + 1)) R.link(i, i + 1, RUNNING[m] ? 0.5 : 0.15);
        if (k < 12 && live(i + 4)) R.link(i, i + 4, RUNNING[m] ? 0.5 : 0.15);
      }
      // Spine back to the mechanism: the work is attached to the thing that
      // makes it, not floating beside it.
      if (spread > 0.3) R.link(base, m * 48, RUNNING[m] ? 0.4 : 0.12);
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.5, 0.86] });
    const spread = ease.out(sub(p, 0.04, 0.5));

    llabel(0, 640, 0, 'CURRENT BUILD', 0, 0.5, 11, 'center');

    if (spread > 0.05) {
      for (let m = 0; m < 4; m++) {
        moduleCentre(MC, m);
        const w = CURRENT_WORK[m];
        const a = clamp01((spread - m * 0.06) * 1.6);
        if (a < 0.02) continue;

        // Module frame. Dashed on the ones still being built — a broken outline
        // does the same work as the word.
        const half = 108;
        const running = RUNNING[m];
        if (running) {
          lline(MC[0] - half, MC[1] - half, MC[2], MC[0] + half, MC[1] - half, MC[2], 0, a * 0.3, 1);
          lline(MC[0] + half, MC[1] - half, MC[2], MC[0] + half, MC[1] + half, MC[2], 0, a * 0.3, 1);
          lline(MC[0] + half, MC[1] + half, MC[2], MC[0] - half, MC[1] + half, MC[2], 0, a * 0.3, 1);
          lline(MC[0] - half, MC[1] + half, MC[2], MC[0] - half, MC[1] - half, MC[2], 0, a * 0.3, 1);
        } else {
          for (let s = 0; s < 4; s++) {
            const sx = s === 0 || s === 3 ? -1 : 1;
            const sy = s < 2 ? -1 : 1;
            lline(
              MC[0] + sx * half,
              MC[1] + sy * half,
              MC[2],
              MC[0] + sx * half * 0.4,
              MC[1] + sy * half,
              MC[2],
              0,
              a * 0.22,
              1
            );
            lline(
              MC[0] + sx * half,
              MC[1] + sy * half,
              MC[2],
              MC[0] + sx * half,
              MC[1] + sy * half * 0.4,
              MC[2],
              0,
              a * 0.22,
              1
            );
          }
        }

        llabel(MC[0], MC[1] + half + 26, MC[2], w.name, 0, a * 0.7, 9, 'center');
        llabel(
          MC[0],
          MC[1] + half + 8,
          MC[2],
          w.state,
          running ? 0.9 : 0,
          a * (running ? 0.8 : 0.45),
          8,
          'center'
        );
      }
    }

    if (hold > 0.05) {
      llabel(0, -640, 0, 'STILL RUNNING', 0, hold * 0.5, 10, 'center');
    }

    if (c > 0.04) {
      const a = c * 0.32;
      llabel(-660, 640, 0, `RUNNING ${RUNNING.filter(Boolean).length}`, 0, a, 8, 'left');
      llabel(-660, 622, 0, `BUILDING ${RUNNING.filter((r) => !r).length}`, 0.85, a, 8, 'left');
    }
  },
};
