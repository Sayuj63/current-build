/**
 * MOVEMENT 07 — PEOPLE
 *
 * One system becomes many, by binary fission.
 *
 * The register starts as a single ring of all 256 nodes — one complete working
 * thing — and then divides: two rings of 128, four of 64, eight of 32, sixteen
 * of 16. Because the node count is a power of two, every generation partitions
 * the register exactly, and every unit at every generation is a closed loop.
 * Nothing is ever half a system.
 *
 * That is the argument about teaching, made structurally rather than stated:
 * each division produces smaller units, but each one is whole and runs on its
 * own. The originating unit is not privileged in the final frame — by the last
 * generation it is one ring among sixteen, which is the point.
 *
 * The camera is observational here rather than mechanical: it drifts, it does
 * not inspect. This scene is watched, not operated.
 */

import { ease, lerp, clamp, clamp01, hash01, TAU } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel } from './kit.js';
import { PEOPLE_WORK } from '../content/work.js';

/** Five generations: 1, 2, 4, 8, 16 units. */
const GENS = 4;

/** How far apart the units of each generation sit. */
const SPREAD = [0, 300, 440, 560, 690];

const FA = [0, 0, 0];
const FB = [0, 0, 0];

/** Golden-angle placement of unit `u` of `n`, so units never clump. */
function unitCentre(out, u, n, radius) {
  if (n === 1) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
  }
  const r = Math.sqrt((u + 0.5) / n) * radius;
  const a = u * 2.399963229728653;
  out[0] = Math.cos(a) * r;
  out[1] = Math.sin(a) * r * 0.72;
  out[2] = (hash01(u * 733 + 17) - 0.5) * 420;
  return out;
}

function formation(g, i, out) {
  const n = 1 << g;
  const count = R.N >> g;
  const u = i >> (8 - g);
  const k = i & (count - 1);

  unitCentre(out, u, n, SPREAD[g]);
  // A ring's radius follows its membership, so a unit visibly shrinks as it
  // divides while staying a complete loop.
  const ringR = 24 + count * 1.05;
  const a = (k / count) * TAU + u * 0.7;
  const tilt = hash01(u * 97 + 5) * 0.5 - 0.25;

  out[0] += Math.cos(a) * ringR;
  out[1] += Math.sin(a) * ringR * Math.cos(tilt);
  out[2] += Math.sin(a) * ringR * Math.sin(tilt);
  return out;
}

let genNow = 0;
let unitsNow = 1;

export default {
  id: 'people',

  enter() {
    for (let i = 0; i < R.N; i++) R.alive[i] = 1;
  },

  field(p, dt) {
    // Softer than the mechanical movements. People are not sockets.
    R.physics.stiffness = 16;
    R.physics.damping = 0.86;

    const f = clamp(sub(p, 0.05, 0.8) * GENS, 0, GENS);
    const g = Math.min(GENS - 1, Math.floor(f));
    const t = clamp01(f - g);
    genNow = g;
    unitsNow = 1 << Math.round(f);

    const breathe = Math.sin(state.time * 0.5) * 0.02;

    for (let i = 0; i < R.N; i++) {
      // Division is staggered so a generation splits as a wave through the
      // group rather than all at once.
      const ts = ease.out(clamp01((t - R.seed[i] * 0.3) / 0.7));

      formation(g, i, FA);
      formation(g + 1 > GENS ? GENS : g + 1, i, FB);

      const s = 1 + breathe;
      aimAt(
        i,
        lerp(FA[0], FB[0], ts) * s,
        lerp(FA[1], FB[1], ts) * s,
        lerp(FA[2], FB[2], ts) * s
      );

      R.grip[i] = 0.55;
      R.size[i] = 1;

      // A unit lights while it is dividing — the act of replication is the
      // change, so that is what the signal colour marks.
      const dividing = ease.breathe(ts) * 0.62;
      warm(i, 0.035 + dividing, 0.1, dt);
    }

    // ── Topology ────────────────────────────────────────────────────────────
    const gg = t < 0.5 ? g : Math.min(GENS, g + 1);
    const count = R.N >> gg;
    const units = 1 << gg;

    // Each unit closed into its own loop. This is what makes it a system.
    for (let u = 0; u < units; u++) {
      const base = u * count;
      for (let k = 0; k < count; k++) {
        R.link(base + k, base + ((k + 1) % count), 0);
      }
    }

    // Interaction between units. Only once there is more than one, and kept
    // sparse — a community is not a mesh.
    if (units > 1) {
      const reach = clamp01((f - 0.6) / 2);
      for (let u = 0; u < units; u++) {
        const v = (u + 1) % units;
        if (hash01(u * 41 + 3) > 0.35 + reach * 0.4) continue;
        const a = u * count + ((hash01(u * 53) * count) | 0);
        const b = v * count + ((hash01(v * 59) * count) | 0);
        R.link(a, b, 0.55);
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.64, 0.84] });
    const f = clamp(sub(p, 0.05, 0.8) * GENS, 0, GENS);

    llabel(-660, 470, 0, PEOPLE_WORK.title, 0, 0.45, 10, 'left');
    llabel(-660, 448, 0, `SYSTEMS ${String(unitsNow).padStart(2, '0')}`, 0.9, 0.7, 10, 'left');

    // The four things the club actually does, revealed as the group grows.
    for (let s = 0; s < PEOPLE_WORK.roles.length; s++) {
      const reveal = clamp01((f - s * 0.9) / 0.6);
      if (reveal < 0.02) continue;
      const y = 420 - s * 20;
      llabel(-660, y, 0, PEOPLE_WORK.roles[s], 0, reveal * 0.42, 8, 'left');
    }

    // Scale lands only once the division has actually happened, so the number
    // is a consequence of what the frame showed rather than an assertion.
    const grown = clamp01((f - 2.6) / 1.2);
    if (grown > 0.02) {
      llabel(660, 470, 0, PEOPLE_WORK.scale, 0.9, grown * 0.8, 11, 'right');
    }

    if (hold > 0.05) {
      llabel(0, -470, 0, PEOPLE_WORK.claim, 0, hold * 0.55, 9, 'center');
    }

    if (c > 0.04) {
      const a = c * 0.34;
      const count = R.N >> genNow;
      llabel(660, 448, 0, `GENERATION ${genNow}`, 0, a, 8, 'right');
      llabel(660, 430, 0, `${unitsNow} × ${count} NODES`, 0, a, 8, 'right');
      llabel(660, 412, 0, 'EACH ONE COMPLETE', 0, a * 0.8, 8, 'right');
    }
  },
};
