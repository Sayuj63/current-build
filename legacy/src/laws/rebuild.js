/**
 * MOVEMENT 09 — REBUILD
 *
 * The reveal, and it is made structurally rather than asserted.
 *
 * For the first two thirds the register rapidly re-forms into shapes the visitor
 * has already seen: the lattice from ASSEMBLY, the page from TRUST, the divided
 * rings from PEOPLE, the test series from AUTONOMY. Because it is literally the
 * same 256 nodes taking each shape in turn, the montage is not a recap — it is
 * the proof of the claim. Those projects were never separate things. They were
 * one behaviour applied to different material, and here is the material
 * changing while the thing doing it does not.
 *
 * Then everything converges into a single mechanism: three nested rings on
 * different axes around a core. It is deliberately a relative of the sealed
 * object from ORIGIN — same family, more articulated — because the film is a
 * loop and the ending has to make the beginning mean something different. The
 * object at the start was closed and unexplained. This one is built, and you
 * watched every part of it arrive.
 *
 * The camera pulls back throughout, which is the only way a synthesis can be
 * shown: you have to be able to see the whole thing at once.
 */

import { ease, lerp, clamp, clamp01, TAU, hash01 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { sub, staggerSeed, curiosity, aimAt, warm, knn, lline, llabel } from './kit.js';
import { CONVERGENCE } from '../content/work.js';

/** The four shapes recalled before the convergence, in narrative order. */
const RECALLS = ['ASSEMBLY', 'TRUST', 'PEOPLE', 'AUTONOMY'];

const FA = [0, 0, 0];
const FB = [0, 0, 0];

/** Ring radii of the final mechanism. */
const R0 = 305;
const R1 = 258;
const R2 = 212;
const CORE_R = 96;

function formation(k, i, out) {
  if (k === 0) {
    // ASSEMBLY — the lattice.
    const ix = i % 8;
    const iy = ((i / 8) | 0) % 8;
    const iz = (i / 64) | 0;
    out[0] = (ix - 3.5) * 76;
    out[1] = (iy - 3.5) * 76;
    out[2] = (iz - 1.5) * 76;
    return out;
  }

  if (k === 1) {
    // TRUST — the page.
    out[0] = ((i % 16) - 7.5) * 34;
    out[1] = (7.5 - ((i / 16) | 0)) * 34;
    out[2] = 0;
    return out;
  }

  if (k === 2) {
    // PEOPLE — sixteen rings of sixteen.
    const u = i >> 4;
    const n = i & 15;
    const r = Math.sqrt((u + 0.5) / 16) * 500;
    const ua = u * 2.399963229728653;
    const a = (n / 16) * TAU;
    out[0] = Math.cos(ua) * r + Math.cos(a) * 44;
    out[1] = Math.sin(ua) * r * 0.72 + Math.sin(a) * 44;
    out[2] = (hash01(u * 733 + 17) - 0.5) * 300;
    return out;
  }

  if (k === 3) {
    // AUTONOMY — sixteen test series, stacked.
    const c = i >> 4;
    const n = i & 15;
    out[0] = (n / 15 - 0.5) * 620;
    out[1] = (c - 7.5) * 58 + Math.sin(n * 0.9 + c * 2.1) * 20;
    out[2] = (c % 2 === 0 ? -1 : 1) * 120;
    return out;
  }

  // The mechanism. Three rings on three axes, and a core.
  const group = (i / 64) | 0;
  const n = i & 63;
  const a = (n / 64) * TAU;
  const t = state.time;

  if (group === 0) {
    // Equatorial, spinning about Y.
    const s = t * 0.1;
    out[0] = Math.cos(a + s) * R0;
    out[1] = 0;
    out[2] = Math.sin(a + s) * R0;
  } else if (group === 1) {
    // Meridian, precessing about Y.
    const s = t * 0.071;
    const cx = Math.cos(a) * R1;
    out[0] = cx * Math.cos(s);
    out[1] = Math.sin(a) * R1;
    out[2] = -cx * Math.sin(s);
  } else if (group === 2) {
    // Third axis, precessing about Z.
    const s = -t * 0.089;
    const cy = Math.cos(a) * R2;
    out[0] = -cy * Math.sin(s);
    out[1] = cy * Math.cos(s);
    out[2] = Math.sin(a) * R2;
  } else {
    out[0] = R.restX[i] * CORE_R;
    out[1] = R.restY[i] * CORE_R;
    out[2] = R.restZ[i] * CORE_R;
  }
  return out;
}

let phaseF = 0;

export default {
  id: 'rebuild',

  enter() {
    for (let i = 0; i < R.N; i++) {
      R.alive[i] = 1;
      R.role[i] = (i / 64) | 0;
    }
  },

  field(p, dt) {
    R.physics.stiffness = 26;
    R.physics.damping = 0.84;

    const f = clamp(sub(p, 0.03, 0.62) * 4, 0, 4);
    phaseF = f;
    const k = Math.min(3, Math.floor(f));
    const t = clamp01(f - k);
    const converged = clamp01((f - 3) / 1);

    for (let i = 0; i < R.N; i++) {
      const ts = ease.out(staggerSeed(i, t, 0.74));
      formation(k, i, FA);
      formation(k + 1, i, FB);
      aimAt(i, lerp(FA[0], FB[0], ts), lerp(FA[1], FB[1], ts), lerp(FA[2], FB[2], ts));

      R.grip[i] = lerp(0.9, 1.3, converged);
      R.size[i] = lerp(0.95, 1.12, converged);

      // Reconstruction is change, so it is lit; the finished mechanism settles
      // to a low steady warmth rather than going fully cold, because it is
      // running.
      const moving = clamp01(R.nodeSpeed(i) / 900);
      warm(i, 0.04 + Math.max(moving * 0.7, converged * 0.2), 0.13, dt);
    }

    // ── Topology of whichever shape is dominant ─────────────────────────────
    const dom = t < 0.5 ? k : k + 1;

    if (dom === 0) {
      for (let i = 0; i < R.N; i++) {
        if (i % 8 !== 7) R.link(i, i + 1, 0);
        if (((i / 8) | 0) % 8 !== 7) R.link(i, i + 8, 0);
      }
    } else if (dom === 1) {
      for (let i = 0; i < R.N; i++) if (i % 16 !== 15) R.link(i, i + 1, 0);
    } else if (dom === 2) {
      for (let u = 0; u < 16; u++) {
        for (let n = 0; n < 16; n++) R.link(u * 16 + n, u * 16 + ((n + 1) % 16), 0);
      }
    } else if (dom === 3) {
      for (let i = 0; i < R.N; i++) if (i % 16 !== 15) R.link(i, i + 1, 0.3);
    } else {
      // The mechanism: three closed rings and a bound core.
      for (let g = 0; g < 3; g++) {
        for (let n = 0; n < 64; n++) {
          R.link(g * 64 + n, g * 64 + ((n + 1) % 64), converged * 0.25);
        }
      }
      const nb = knn(3);
      for (let i = 192; i < R.N; i++) {
        for (let s = 0; s < 3; s++) {
          const j = nb[i * 3 + s];
          if (j <= i || j < 192) continue;
          R.link(i, j, 0.2);
        }
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const f = phaseF;
    const converged = clamp01((f - 3) / 1);

    // ── Recall ──────────────────────────────────────────────────────────────
    // Each shape names itself as it passes. Without the names the montage is
    // just shapes; with them it is an argument.
    if (f < 3.9) {
      const k = Math.min(3, Math.floor(f));
      const t = f - k;
      // Brightest at the middle of each recall, gone at the handover.
      const a = ease.breathe(clamp01(t));
      llabel(0, 470, 0, RECALLS[k], 0, a * 0.6, 10, 'center');
      llabel(0, 448, 0, `RECALL ${k + 1} / 4`, 0, a * 0.3, 8, 'center');
    }

    // ── Convergence ─────────────────────────────────────────────────────────
    // The four behaviours every one of those projects turned out to share.
    if (converged > 0.02) {
      for (let s = 0; s < CONVERGENCE.length; s++) {
        const reveal = clamp01((converged - s * 0.17) / 0.3);
        if (reveal < 0.02) continue;
        const y = 470 - s * 22;
        llabel(-660, y, 0, CONVERGENCE[s], s === 0 ? 0.9 : 0, reveal * 0.6, 9, 'left');
      }
      llabel(660, 470, 0, 'ONE BEHAVIOUR', 0.9, converged * 0.7, 10, 'right');
      llabel(660, 448, 0, 'DIFFERENT MATERIAL', 0, converged * 0.45, 8, 'right');
    }

    if (c > 0.04 && converged > 0.5) {
      const a = c * 0.32;
      lline(-R0, -R0 - 60, 0, R0, -R0 - 60, 0, 0, a * 0.4, 1);
      llabel(0, -R0 - 84, 0, '3 RINGS · 1 CORE · 256 NODES', 0, a * 0.8, 8, 'center');
    }
  },
};
