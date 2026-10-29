/**
 * MOVEMENT 06 — AUTONOMY
 *
 * A signal laboratory the camera flies down. The second corridor movement, and
 * the fastest thing in the film.
 *
 * The register is divided into sixteen candidates of sixteen nodes each. A
 * candidate is drawn as what an alpha actually is — a short time series — so the
 * sixteen nodes of a candidate array along x with their y set by the signal. Each
 * bay runs the real loop: GENERATE, SIMULATE, POLL, SCORE, GATE, and then either
 * REJECT or SUBMIT. Most are rejected. That is not pessimism, it is the
 * measured base rate of this kind of work.
 *
 * Tempo is velocity-driven without cheating. The lifecycle phase is a function
 * of scroll position, so scrolling faster genuinely runs more cycles per second
 * while the choreography stays exactly reversible — no time-based term is
 * smuggled into the sequencing. Velocity does add churn on top: the readouts
 * flicker and the bays agitate, which is the environment accelerating rather
 * than the story changing.
 *
 * And when the visitor outruns the system, the lab loses telemetry: the metric
 * digits scramble to hash noise while sync is degraded. The desync beat is not
 * decoration here, it is this movement's subject — an autonomous system is
 * exactly the thing you can outrun.
 */

import { ease, lerp, clamp, clamp01, hash01, fbm3 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { cam } from '../render/camera.js';
import { sub, curiosity, aimAt, warm, lline, llabel, lrect, SET } from './kit.js';
import { ALPHA } from '../content/work.js';

const CANDIDATES = 16;
const PER = 16;

/** Cycles each bay completes across the movement. */
const CYCLES = 3;

/** Bay geometry. Bays alternate sides of the corridor. */
const BAY_X = 300;
const SERIES_W = 300;
const SERIES_AMP = 118;

/** Live per-candidate state, needed by the stage. */
const phase = new Float32Array(CANDIDATES);
const cycle = new Int32Array(CANDIDATES);
const accepted = new Uint8Array(CANDIDATES);
const bayZ = new Float32Array(CANDIDATES);
const baySide = new Int8Array(CANDIDATES);

let tested = 0;
let passed = 0;

/** The signal for candidate `c` on cycle `n`, sampled at node `k` of 16. */
const sample = (c, n, k) => fbm3(k * 0.34, c * 7.7 + n * 13.1, 2.3, 3);

/** Deterministic verdict. Roughly one in six survives the gate. */
const verdictOf = (c, n) => (hash01(c * 31 + n * 9973 + 7) > 0.83 ? 1 : 0);

export default {
  id: 'autonomy',

  enter() {
    for (let c = 0; c < CANDIDATES; c++) {
      // Bays distributed along the corridor, alternating sides.
      bayZ[c] = c / (CANDIDATES - 1);
      baySide[c] = c % 2 === 0 ? -1 : 1;
    }
    for (let i = 0; i < R.N; i++) {
      R.role[i] = i >> 4;
      R.alive[i] = 1;
    }
  },

  field(p, dt) {
    R.physics.stiffness = 22;
    R.physics.damping = 0.83;

    // Extra agitation under speed. This is the only velocity term, and it
    // affects texture rather than sequencing.
    const churn = state.speed * state.speed;

    tested = 0;
    passed = 0;

    for (let c = 0; c < CANDIDATES; c++) {
      // Lifecycle from scroll position only, so the reverse pass un-runs the
      // experiments in the order they were run.
      const raw = p * CYCLES + c / CANDIDATES;
      const n = Math.floor(raw);
      const ph = raw - n;
      phase[c] = ph;
      cycle[c] = n;
      accepted[c] = verdictOf(c, n);

      tested += n;
      for (let k = 0; k <= n; k++) passed += verdictOf(c, k);

      const zl = lerp(SET.lNear, SET.lFar, bayZ[c]);
      const bx = baySide[c] * BAY_X;

      // Stages within one candidate's life.
      const gen = clamp01(ph / 0.16);
      const sim = clamp01((ph - 0.16) / 0.3);
      const score = clamp01((ph - 0.5) / 0.14);
      const gate = clamp01((ph - 0.68) / 0.1);
      const after = clamp01((ph - 0.78) / 0.22);

      for (let k = 0; k < PER; k++) {
        const i = c * PER + k;
        const t = k / (PER - 1);

        // GENERATE: a compact seed cluster.
        const cx0 = bx + (R.restX[i] * 26);
        const cy0 = R.restY[i] * 26;
        const cz0 = zl + R.restZ[i] * 26;

        // SIMULATE: the candidate unfolds into its time series.
        const sx = bx + (t - 0.5) * SERIES_W;
        const sy = sample(c, n, k) * SERIES_AMP * sim;
        const sz = zl;

        let tx = lerp(cx0, sx, ease.out(sim));
        let ty = lerp(cy0, sy, ease.out(sim));
        let tz = lerp(cz0, sz, ease.out(sim));

        if (after > 0) {
          if (accepted[c]) {
            // SUBMIT: the series locks into a tight column and is carried on.
            const ax = bx * 0.35;
            const ay = (t - 0.5) * 150;
            tx = lerp(tx, ax, ease.out(after));
            ty = lerp(ty, ay, ease.out(after));
            tz = lerp(tz, zl - 220 * after, after);
          } else {
            // REJECT: the candidate is discarded outward and goes dark.
            const rx = bx * (1 + after * 1.5) + (hash01(i * 13 + 1) - 0.5) * 260 * after;
            const ry = ty + (hash01(i * 29 + 3) - 0.5) * 300 * after;
            tx = lerp(tx, rx, after);
            ty = lerp(ty, ry, after);
            tz = zl + after * 150;
          }
        }

        // Churn: the rig vibrates when the visitor is moving fast.
        if (churn > 0.001) {
          const j = churn * 26;
          tx += (hash01(i * 7 + ((state.time * 22) | 0)) - 0.5) * j;
          ty += (hash01(i * 11 + ((state.time * 22) | 0) + 5) - 0.5) * j;
        }

        aimAt(i, tx, ty, tz);

        R.grip[i] = lerp(0.5, 1.25, sim);
        R.size[i] = accepted[c] && after > 0.2 ? 1.5 : 0.95;

        // Live during the run, lit if submitted, dead if rejected.
        let h = 0.04 + sim * (1 - score) * 0.35 + gate * 0.3;
        if (after > 0) h = accepted[c] ? lerp(h, 0.95, after) : lerp(h, 0.01, after);
        warm(i, h, 0.16, dt);

        // Rejected candidates dim out entirely; the lab does not keep them.
        R.alive[i] = accepted[c] ? 1 : 1 - after * 0.86;
      }

      // The series, chained. This is the signal itself.
      if (sim > 0.08) {
        const lit = accepted[c] ? 0.4 + after * 0.55 : 0.25 * (1 - after);
        for (let k = 0; k < PER - 1; k++) {
          R.link(c * PER + k, c * PER + k + 1, lit);
        }
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const desync = clamp01(1 - state.sync / 0.55);

    for (let ci = 0; ci < CANDIDATES; ci++) {
      const zl = lerp(SET.lNear, SET.lFar, bayZ[ci]);
      const dz = cam.z - (zl + SET.z);
      if (dz < 80 || dz > 1700) continue;

      const near = clamp01(1 - Math.abs(dz - 700) / 1100);
      if (near < 0.02) continue;

      const bx = baySide[ci] * BAY_X;
      const ph = phase[ci];
      const stage = Math.min(ALPHA.stages.length - 1, (ph * ALPHA.stages.length) | 0);
      const acc = accepted[ci];
      const after = clamp01((ph - 0.78) / 0.22);

      // Test rig.
      lrect(bx, 0, zl, SERIES_W + 90, 330, 0, near * 0.2, 1);
      // Zero line of the series: without it the signal has no reference.
      lline(bx - SERIES_W / 2, 0, zl, bx + SERIES_W / 2, 0, zl, 0, near * 0.22, 1);

      // Stage readout.
      llabel(bx - SERIES_W / 2, 190, zl, ALPHA.stages[stage], 0.85, near * 0.7, 9, 'left');
      llabel(
        bx - SERIES_W / 2,
        172,
        zl,
        `${ALPHA.operators[(ci + cycle[ci]) % ALPHA.operators.length]}`,
        0,
        near * 0.45,
        8,
        'left'
      );

      // Metrics. These scramble while the system is desynchronised, because
      // telemetry is the first thing you lose when you outrun a process.
      const m = ALPHA.metrics[ci % ALPHA.metrics.length];
      const real = (0.4 + hash01(ci * 61 + cycle[ci] * 17) * 1.6).toFixed(2);
      const shown =
        desync > 0.25
          ? (hash01(ci + ((state.time * 30) | 0)) * 9.99).toFixed(2)
          : ph > 0.5
            ? real
            : '——';
      llabel(bx + SERIES_W / 2, 190, zl, `${m} ${shown}`, 0, near * 0.55, 8, 'right');

      // Verdict.
      if (after > 0.1) {
        const label = acc ? 'SUBMIT' : 'REJECT';
        llabel(bx, -196, zl, label, acc ? 0.95 : 0, near * (acc ? 0.95 : 0.4), acc ? 11 : 9, 'center');
        if (acc) {
          lline(bx - 70, -210, zl, bx + 70, -210, zl, 0.95, near * 0.6, 1);
        }
      }

      llabel(bx, -228, zl, `BAY ${String(ci + 1).padStart(2, '0')} · RUN ${cycle[ci] + 1}`, 0, near * 0.3, 8, 'center');
    }

    // ── Throughput ──────────────────────────────────────────────────────────
    // Real running totals, derived from the same deterministic verdicts the
    // bays used. The point of the movement is that this number climbs whether
    // or not anyone is watching.
    const zl = lerp(SET.lNear, SET.lFar, 0.5);
    llabel(0, 380, zl, ALPHA.platform, 0, 0.5, 10, 'center');
    llabel(0, 356, zl, `TESTED ${String(tested).padStart(4, '0')}`, 0, 0.6, 10, 'center');
    llabel(0, 336, zl, `SUBMITTED ${String(passed).padStart(3, '0')}`, 0.9, 0.7, 10, 'center');

    if (c > 0.05) {
      llabel(0, 312, zl, 'GENERATE · SIMULATE · POLL · SCORE · GATE · SUBMIT', 0, c * 0.4, 8, 'center');
      llabel(0, 294, zl, 'LINEAGE TRACKED · RATE LIMITS HANDLED', 0, c * 0.35, 8, 'center');
    }
  },
};
