/**
 * MOVEMENT 12 — TERMINUS
 *
 * Stillness, and the four actions.
 *
 * The register holds the visitor's own fingerprint from the previous movement —
 * the same 256 nodes, still not replaced — and stops moving. No dolly worth
 * mentioning, no drift, no transformation. After thirty-eight viewport heights
 * of continuous motion, stopping is the strongest available gesture.
 *
 * There is no call-to-action section. SOURCE, CONNECT, MESSAGE and RETURN are
 * actions inside the world, owned by ui/terminus.js, and RETURN in particular is
 * not a link — it flies the whole film backwards to ORIGIN, which is what makes
 * the piece a loop rather than a page with an end.
 */

import { ease, clamp01 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import * as session from '../core/session.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel } from './kit.js';
import { IDENTITY } from '../content/work.js';

const PITCH = 32;
const HALF = (15 * PITCH) / 2;

let sigil = null;

export default {
  id: 'terminus',

  enter() {
    // Anyone reaching TERMINUS has a sealed session; sealing here covers the
    // case of arriving by the rail rather than by scrolling through UNKNOWN.
    sigil = session.seal();
    R.loadBits(sigil.bytes);
    for (let i = 0; i < R.N; i++) R.role[i] = R.bit[i];
  },

  field(p, dt) {
    // Firm and quiet. Nothing here is going anywhere.
    R.physics.stiffness = 20;
    R.physics.damping = 0.86;

    if (sigil) R.loadBits(sigil.bytes);

    const settle = ease.out(sub(p, 0, 0.22));
    // A single slow breath across the whole plate, so the frame is still but
    // not dead.
    const breath = Math.sin(state.time * 0.35) * 5;

    for (let i = 0; i < R.N; i++) {
      const on = R.bit[i] === 1;
      const gx = ((i % 16) - 7.5) * PITCH;
      const gy = (7.5 - ((i / 16) | 0)) * PITCH;
      aimAt(i, gx, gy, (on ? 30 : -26) + (on ? breath : 0));

      R.grip[i] = 1.2;
      R.size[i] = on ? 1.4 : 0.6;
      R.alive[i] = on ? 1 : 0.5;
      warm(i, (on ? 0.88 : 0.02) * settle, 0.06, dt);
    }

    for (let i = 0; i < R.N; i++) {
      if (R.bit[i] !== 1) continue;
      if (i % 16 !== 15 && R.bit[i + 1] === 1) R.link(i, i + 1, 0.7);
      if (i + 16 < R.N && R.bit[i + 16] === 1) R.link(i, i + 16, 0.7);
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.3, 0.9] });
    if (!sigil) return;

    llabel(0, HALF + 92, 0, IDENTITY.name, 0, 0.5, 12, 'center', false);
    llabel(0, HALF + 66, 0, 'SESSION SIGIL', 0, 0.35, 9, 'center');

    // The digest, and the exact string it was computed from. Printing the
    // payload is the whole difference between an artifact and a decoration:
    // anyone can hash this line themselves and get the object above it.
    const a = clamp01(hold + 0.35);
    for (let r = 0; r < 4; r++) {
      llabel(0, -HALF - 40 - r * 20, 0, sigil.hex.slice(r * 16, r * 16 + 16), 0, a * 0.6, 10, 'center');
    }

    if (c > 0.04) {
      llabel(0, -HALF - 140, 0, sigil.payload, 0, c * 0.4, 7, 'center');
      llabel(0, -HALF - 162, 0, 'HASH THAT LINE — YOU GET THIS OBJECT', 0, c * 0.35, 7, 'center');
    }

    // A quiet frame. Corner ticks, nothing more.
    const b = HALF + 40;
    const t2 = 44;
    for (const [sx, sy] of [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      lline(sx * b, sy * b, 0, sx * (b - t2), sy * b, 0, 0, 0.16, 1);
      lline(sx * b, sy * b, 0, sx * b, sy * (b - t2), 0, 0, 0.16, 1);
    }
  },
};
