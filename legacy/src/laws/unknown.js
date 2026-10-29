/**
 * MOVEMENT 11 — UNKNOWN
 *
 * The visitor expects another scene. For the first half of a 360vh movement
 * there is nothing at all — not a dimmed version of something, nothing. The
 * register is pushed thousands of units into the depth and its opacity is taken
 * below the render threshold, so the frame is genuinely empty. Holding an empty
 * frame for that long is the boldest thing in the piece and the least
 * expensive; the temptation is to fill it, and filling it would ruin it.
 *
 * Then an object arrives out of the depth, and it is unfinished. Roughly a third
 * of its sockets are empty, and which third drifts slowly and never settles,
 * because it is still building itself. There is no state of this object that is
 * complete.
 *
 * And then the last idea in the film. The occupancy stops being noise and
 * becomes the 256 bits of a SHA-256 of *this visit* — how long the visitor
 * lingered in each movement, how fast they went, how many times they turned
 * back, whether they ever outran the system. The unfinished object resolves into
 * a fingerprint of the person looking at it, on the same 256 nodes that have
 * been there since the first frame.
 *
 * The future is undefined, so the closing object is the one thing that could
 * not have been designed in advance.
 */

import { ease, lerp, clamp01, fbm3 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import * as session from '../core/session.js';
import { sub, curiosity, aimAt, warm, lline, llabel } from './kit.js';
import { ENDING } from '../content/work.js';

const PITCH = 30;
const HALF = (15 * PITCH) / 2;

/** Where the register waits during the emptiness. */
const VOID_Z = -2400;

/** Progress at which the visit is fingerprinted. */
const SEAL_AT = 0.78;

let sigil = null;

export default {
  id: 'unknown',

  enter(dir) {
    for (let i = 0; i < R.N; i++) R.role[i] = 0;
    // Arriving from CURRENT BUILD, the object has not been fingerprinted yet.
    // Arriving backwards from TERMINUS it already has been, and stays that way.
    if (dir > 0 && !session.isSealed()) sigil = null;
    else sigil = session.peek();
  },

  field(p, dt) {
    R.physics.stiffness = 14;
    R.physics.damping = 0.88;

    // Nothing, for a long time.
    const arrive = ease.out(sub(p, 0.48, 0.76));

    if (p >= SEAL_AT && !sigil) {
      // The visit is fingerprinted exactly once, and the bits are written onto
      // the same register that has carried every other movement.
      sigil = session.seal();
      R.loadBits(sigil.bytes);
    }
    if (sigil) R.loadBits(sigil.bytes);

    const t = state.time;

    for (let i = 0; i < R.N; i++) {
      const gx = ((i % 16) - 7.5) * PITCH;
      const gy = (7.5 - ((i / 16) | 0)) * PITCH;

      // Occupancy: drifting noise while the object is still indeterminate, then
      // the visitor's own bits once the session is sealed.
      const occupied = sigil
        ? R.bit[i] === 1
        : fbm3(gx * 0.004, gy * 0.004, t * 0.07, 2) * 0.5 + 0.5 > 0.44;

      const z = lerp(VOID_Z, occupied ? 34 : -30, arrive);
      aimAt(i, gx * (0.4 + arrive * 0.6), gy * (0.4 + arrive * 0.6), z);

      R.grip[i] = lerp(0.1, occupied ? 1.15 : 0.5, arrive);
      R.size[i] = occupied ? 1.35 : 0.6;

      // Below the render threshold until the object arrives, so the emptiness
      // is real rather than merely dark.
      R.alive[i] = occupied ? arrive : arrive * 0.22;

      const lit = sigil ? (occupied ? 0.9 : 0.02) : occupied ? 0.4 : 0.02;
      warm(i, lit * arrive, 0.08, dt);
    }

    // Only set bits are connected, so the fingerprint's own structure is the
    // topology — exactly as it was for the manifest digest in TRUST.
    if (arrive > 0.4) {
      for (let i = 0; i < R.N; i++) {
        const occ = sigil
          ? R.bit[i] === 1
          : fbm3(((i % 16) - 7.5) * PITCH * 0.004, (7.5 - ((i / 16) | 0)) * PITCH * 0.004, t * 0.07, 2) *
                0.5 +
              0.5 >
            0.44;
        if (!occ) continue;
        if (i % 16 !== 15) {
          const nxt = sigil ? R.bit[i + 1] === 1 : false;
          if (nxt) R.link(i, i + 1, 0.7);
        }
        if (i + 16 < R.N) {
          const dn = sigil ? R.bit[i + 16] === 1 : false;
          if (dn) R.link(i, i + 16, 0.7);
        }
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const arrive = ease.out(sub(p, 0.48, 0.76));

    // ── The state sequence ──────────────────────────────────────────────────
    // Three lines, spaced far apart. The gaps between them are doing as much
    // work as the words.
    const at = [0.5, 0.68, 0.88];
    for (let s = 0; s < ENDING.length; s++) {
      const a = clamp01((p - at[s]) / 0.07) * clamp01(1 - (p - at[s] - 0.22) / 0.1);
      if (a < 0.02) continue;
      llabel(0, -HALF - 120, 0, ENDING[s], s === 2 ? 0.9 : 0, a * 0.7, 11, 'center');
    }

    if (arrive < 0.05) return;

    // ── The fingerprint ─────────────────────────────────────────────────────
    if (sigil) {
      const a = clamp01((p - SEAL_AT) / 0.08);
      llabel(HALF + 60, HALF, 0, 'THIS VISIT', 0.9, a * 0.75, 9, 'left');
      llabel(HALF + 60, HALF - 20, 0, 'SHA-256', 0, a * 0.4, 8, 'left');
      for (let r = 0; r < 4; r++) {
        llabel(HALF + 60, HALF - 48 - r * 18, 0, sigil.hex.slice(r * 16, r * 16 + 16), 0, a * 0.62, 9, 'left');
      }

      // What was actually measured. These are the inputs to the hash, so the
      // artifact can be checked rather than taken on trust.
      if (c > 0.04) {
        const b = c * 0.5;
        const rows = [
          `ELAPSED ${sigil.elapsed}s`,
          `PEAK ${sigil.peak} PX/S`,
          `REVERSALS ${sigil.reversals}`,
          `DESYNCS ${sigil.desyncs}`,
          `SYNC FOUND ${sigil.locks}`,
        ];
        for (let r = 0; r < rows.length; r++) {
          llabel(-HALF - 60, HALF - r * 18, 0, rows[r], 0, b * 0.55, 8, 'right');
        }
      }
    } else {
      const a = arrive;
      llabel(HALF + 60, HALF, 0, 'UNRESOLVED', 0, a * 0.45, 9, 'left');
      llabel(HALF + 60, HALF - 20, 0, 'STILL BUILDING', 0, a * 0.3, 8, 'left');
    }

    // A frame around the object. It is the only furniture in the movement.
    if (arrive > 0.3) {
      const a = (arrive - 0.3) * 0.24;
      const b = HALF + 34;
      const t2 = 40;
      for (const [sx, sy] of [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ]) {
        lline(sx * b, sy * b, 0, sx * (b - t2), sy * b, 0, 0, a, 1);
        lline(sx * b, sy * b, 0, sx * b, sy * (b - t2), 0, 0, a, 1);
      }
    }
  },
};

export const currentSigil = () => sigil;
