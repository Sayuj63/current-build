/**
 * MOVEMENT 01 — CHAOS
 *
 * A field of fragments the camera travels through. This is the only movement
 * besides AUTONOMY built as a corridor rather than a subject: the camera covers
 * 2600 units here, far more than its own focal length, so there is no single
 * object to approach — there is material distributed through depth, and the
 * lens moves past it.
 *
 * The register does not become a field of debris. It *is* the field. The same
 * 256 nodes that were a sealed object one movement ago are now scattered
 * through 3300 units of depth, and they arrived here carrying the outward
 * velocity the shell gave them when it split.
 *
 * The idea that makes this scene mean something: most fragments are inert. A
 * handful — about eighteen — are warm, and only those carry real project names.
 * Those are the experiments that survived and became production systems. The
 * rest are labelled with the code and paths they were made of. Breadth is the
 * subject, and the honest version of breadth includes the parts that went
 * nowhere.
 *
 * Nothing is connected. Link count reads zero for almost the whole movement,
 * which is precisely the state that ASSEMBLY resolves.
 */

import { state } from '../core/state.js';
import { ease, lerp, clamp, clamp01, hash01, fbm3 } from '../core/math.js';
import * as R from '../entity/register.js';
import { cam } from '../render/camera.js';
import {
  sub,
  curiosity,
  aimAt,
  warm,
  localOf,
  hand,
  lline,
  llabel,
  lrect,
  SET,
} from './kit.js';
import { FRAGMENTS, COMMERCE_WORK } from '../content/work.js';

const CODE = 0;
const PATH = 1;
const DIAG = 2;
const PANEL = 3;

/** Deterministic per-node scatter, independent of the rest sphere. */
const fx = new Float32Array(R.N);
const fy = new Float32Array(R.N);
const ft = new Float32Array(R.N);
const kind = new Uint8Array(R.N);
const survivor = new Uint8Array(R.N);
const textIdx = new Uint8Array(R.N);

/** Indices of the fragments that became production systems. */
const survivors = [];

const FIELD_W = 1560;
const FIELD_H = 940;

export default {
  id: 'chaos',

  enter() {
    survivors.length = 0;
    for (let i = 0; i < R.N; i++) {
      fx[i] = (hash01(i * 7919 + 11) - 0.5) * FIELD_W;
      fy[i] = (hash01(i * 104729 + 23) - 0.5) * FIELD_H;
      ft[i] = hash01(i * 15485863 + 37);
      kind[i] = (hash01(i * 999331 + 5) * 4) | 0;
      // Roughly seven per cent. Deliberately a small minority.
      survivor[i] = R.seed[i] > 0.93 ? 1 : 0;
      if (survivor[i]) survivors.push(i);
      textIdx[i] = (hash01(i * 2654435761 + 91) * 255) | 0;
      R.role[i] = kind[i];
      R.alive[i] = 1;
    }
  },

  field(p, dt) {
    // Loose and floating. Nothing here is seated, because nothing here has
    // been decided yet.
    R.physics.stiffness = 7;
    R.physics.damping = 0.9;

    const drift = state.time * 0.055;
    // Fragments spread apart as the movement proceeds: the field opens up as
    // the camera commits to travelling through it.
    const spread = lerp(0.72, 1.12, ease.out(sub(p, 0, 0.55)));
    // The premonition of order. Only in the last sixth, and only faintly.
    const converge = ease.in(sub(p, 0.84, 1));

    for (let i = 0; i < R.N; i++) {
      const zl = lerp(SET.lNear, SET.lFar, ft[i]);

      // Depth-graded drift. Distant material moves less, which reads as
      // atmosphere rather than as everything wobbling equally.
      const depthK = 0.35 + ft[i] * 0.85;
      const n1 = fbm3(fx[i] * 0.0012, fy[i] * 0.0012, drift, 2);
      const n2 = fbm3(fy[i] * 0.0013 + 8.3, drift, fx[i] * 0.0011, 2);

      let lx = fx[i] * spread + n1 * 74 * depthK;
      let ly = fy[i] * spread + n2 * 52 * depthK;

      // At the very end the field begins to gather toward the axis, so the
      // lattice in ASSEMBLY is something the visitor half-expects.
      if (converge > 0) {
        lx = lerp(lx, lx * 0.55, converge);
        ly = lerp(ly, ly * 0.55, converge);
      }

      aimAt(i, lx, ly, zl);

      R.grip[i] = 0.16 + hash01(i * 31 + 3) * 0.2;
      R.size[i] = survivor[i] ? 1.5 : 0.72 + hash01(i * 17 + 9) * 0.5;

      // The survivors carry heat; the rest stay monochrome. Speed lifts the
      // whole field slightly — the environment accelerating with the visitor.
      const base = survivor[i] ? 0.62 + Math.sin(state.time * 0.9 + R.seed[i] * 9) * 0.14 : 0.025;
      warm(i, clamp01(base + state.speed * 0.14), 0.05, dt);
    }
  },

  stage(p) {
    const c = curiosity();
    const small = hand();

    // ── Depth gates ─────────────────────────────────────────────────────────
    // Architectural frames at intervals through the corridor. These are the
    // scene's depth cue: passing through them is what makes 2600 units of
    // travel legible as distance rather than as zoom. The handheld edit uses
    // fewer, because depth reads from three planes as well as from nine and the
    // small frame cannot afford the clutter.
    const GATES = small ? 6 : 9;
    for (let g = 0; g < GATES; g++) {
      const t = (g + 0.5) / GATES;
      const zl = lerp(SET.lNear, SET.lFar, t);
      const dz = cam.z - (zl + SET.z);
      if (dz < 60) continue;
      // Fade in from the far distance and out as the gate passes the lens.
      const a = clamp01(1 - Math.abs(dz - 900) / 1500) * 0.2;
      if (a < 0.01) continue;
      const w = 1180 + g * 46;
      const h = 720 + g * 28;
      lrect(0, 0, zl, w, h, 0, a, 1);
      // Corner brackets only on the near gates, so the far ones stay quiet.
      if (dz < 1400) {
        const bx = w / 2;
        const by = h / 2;
        const t2 = 46;
        lline(-bx, by, zl, -bx + t2, by, zl, 0, a * 2.2, 1);
        lline(bx, -by, zl, bx - t2, -by, zl, 0, a * 2.2, 1);
      }
    }

    // ── Fragment material ───────────────────────────────────────────────────
    // Only fragments near the lens are annotated, so the reveal happens as the
    // camera arrives rather than all at once. Survivors are always named — the
    // evidence has to land even for a visitor moving quickly — while the code
    // and paths that make up the rest are the reward for slowing down.
    for (let i = 0; i < R.N; i++) {
      const dz = cam.z - R.z[i];
      if (dz < 120 || dz > 1500) continue;

      const near = clamp01(1 - (dz - 200) / 1200);
      const v = localOf(i);
      const lx = v.x;
      const ly = v.y;
      const lz = v.z;

      if (survivor[i]) {
        const w = COMMERCE_WORK[textIdx[i] % COMMERCE_WORK.length];
        const off = 22 + R.size[i] * 8;
        lline(lx, ly, lz, lx + off * 0.7, ly + off * 0.5, lz, 0.8, near * 0.4, 1);
        llabel(lx + off, ly + off * 0.5 + 4, lz, w.name, 0.85, near * 0.9, 10, 'left');
        if (c > 0.05) {
          llabel(lx + off, ly + off * 0.5 - 12, lz, w.note.toUpperCase(), 0, near * c * 0.6, 8, 'left');
        }
        continue;
      }

      // Thinned deterministically. Annotating every fragment turns breadth into
      // noise, and the point of the field is that most of it is quiet. The
      // handheld edit carries the survivors only — the evidence, not the
      // texture.
      if (small) continue;
      if (c < 0.04 || dz > 950 || hash01(i * 61 + 7) < 0.42) continue;
      const a = near * c;

      if (kind[i] === CODE) {
        llabel(lx + 14, ly, lz, FRAGMENTS.code[textIdx[i] % FRAGMENTS.code.length], 0, a * 0.5, 8, 'left');
      } else if (kind[i] === PATH) {
        llabel(lx + 14, ly, lz, FRAGMENTS.paths[textIdx[i] % FRAGMENTS.paths.length], 0, a * 0.42, 8, 'left');
      } else if (kind[i] === DIAG) {
        llabel(
          lx + 14,
          ly,
          lz,
          FRAGMENTS.diagnostics[textIdx[i] % FRAGMENTS.diagnostics.length],
          0,
          a * 0.55,
          8,
          'left'
        );
      } else {
        // A UI fragment, reduced to its wireframe. Enough to read as interface
        // without pretending to be a screenshot.
        const w = 76;
        const h = 46;
        lrect(lx + 14 + w / 2, ly, lz, w, h, 0, a * 0.45, 1);
        lline(lx + 20, ly + 12, lz, lx + 20 + w * 0.62, ly + 12, lz, 0, a * 0.35, 1);
        lline(lx + 20, ly + 4, lz, lx + 20 + w * 0.4, ly + 4, lz, 0, a * 0.3, 1);
        lline(lx + 20, ly - 6, lz, lx + 20 + w * 0.5, ly - 6, lz, 0, a * 0.3, 1);
        // One lit element per card: the state the fragment was in.
        lline(lx + 20, ly - 15, lz, lx + 20 + w * 0.22, ly - 15, lz, 0.9, a * 0.7, 2);
      }
    }

    // ── Field readout ───────────────────────────────────────────────────────
    // A single tabular fact, placed in the world rather than on the glass so it
    // belongs to the space. It is also the movement's whole thesis.
    if (c > 0.1) {
      const zl = lerp(SET.lNear, SET.lFar, 0.5);
      llabel(-FIELD_W * 0.42, FIELD_H * 0.5, zl, 'FRAGMENTS 256', 0, c * 0.5, 10, 'left');
      llabel(
        -FIELD_W * 0.42,
        FIELD_H * 0.5 - 20,
        zl,
        `SURVIVED ${String(survivors.length).padStart(3, '0')}`,
        0.85,
        c * 0.55,
        10,
        'left'
      );
    }
  },
};
