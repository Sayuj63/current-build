/**
 * MOVEMENT 03 — COMMERCE
 *
 * PRODUCT → VARIANT → SELECTION → CART → CHECKOUT → DATA, as six stations on a
 * line the camera trucks along. Nothing appears and nothing disappears: the
 * same 256 nodes are re-formed at each station, so the pipeline is one
 * continuous transformation rather than six illustrations of one.
 *
 * The arithmetic does real work again. 256 is 16 × 16, so PRODUCT is a complete
 * flat panel. It is also 4 × 64, so VARIANT separates that panel into four
 * option slabs with none left over, SELECTION brings exactly one slab forward,
 * and DATA lands as 8 rows of 32. Every formation is exact.
 *
 * Motion is mechanical throughout: no camera drift, linear travel, and a hard
 * seat at each station. A production line does not wander and does not ease in.
 *
 * The SELECTION station carries a real defect and its real fix, because the
 * difference between naming Shopify and having engineered on it is whether you
 * can say what went wrong and why the fix was structural.
 */

import { state } from '../core/state.js';
import { ease, lerp, clamp, clamp01 } from '../core/math.js';
import * as R from '../entity/register.js';
import {
  sub,
  staggerSeed,
  curiosity,
  aimAt,
  warm,
  knn,
  hand,
  lline,
  llabel,
  lrect,
} from './kit.js';
import { PIPELINE, DEFECT, COMMERCE_WORK } from '../content/work.js';

/** Half the length of the line, matched to the camera's 900 units of truck. */
const LINE_HALF = 470;

/** Which option slab the selection resolves to. Fixed, so the reverse pass agrees. */
const CHOSEN = 2;

const FA = [0, 0, 0];
const FB = [0, 0, 0];

const isChosen = (i) => ((i / 64) | 0) === CHOSEN;

/**
 * Station formations, in the travelling centre's local frame. Each one is a
 * complete partition of all 256 nodes.
 */
function formation(k, i, out) {
  if (k === 0) {
    // PRODUCT — one complete panel. 16 × 16.
    const ix = i % 16;
    const iy = (i / 16) | 0;
    out[0] = (ix - 7.5) * 33;
    out[1] = (iy - 7.5) * 33;
    out[2] = 0;
    return out;
  }

  if (k === 1) {
    // VARIANT — the panel separates into four option slabs in depth.
    const slab = (i / 64) | 0;
    const j = i % 64;
    out[0] = ((j % 8) - 3.5) * 56;
    out[1] = (((j / 8) | 0) - 3.5) * 56;
    out[2] = (slab - 1.5) * 145;
    return out;
  }

  if (k === 2) {
    // SELECTION — one slab resolves forward, the rest fall back.
    const slab = (i / 64) | 0;
    const j = i % 64;
    const chosen = slab === CHOSEN;
    const s = chosen ? 62 : 34;
    out[0] = ((j % 8) - 3.5) * s;
    out[1] = (((j / 8) | 0) - 3.5) * s;
    out[2] = chosen ? 180 : -220 - Math.abs(slab - CHOSEN) * 90;
    return out;
  }

  if (k === 3) {
    // CART — the resolved slab gathers; everything unselected collapses behind.
    if (isChosen(i)) {
      out[0] = R.restX[i] * 104;
      out[1] = R.restY[i] * 104;
      out[2] = R.restZ[i] * 104 + 150;
    } else {
      out[0] = R.restX[i] * 30;
      out[1] = R.restY[i] * 30;
      out[2] = -460;
    }
    return out;
  }

  if (k === 4) {
    // CHECKOUT — everything compresses into one column through a narrow gate.
    out[0] = R.restX[i] * 22;
    out[1] = (i / (R.N - 1) - 0.5) * 610;
    out[2] = R.restZ[i] * 22;
    return out;
  }

  // DATA — 8 rows of 32. An order becomes a table.
  const col = i % 32;
  const row = (i / 32) | 0;
  out[0] = (col - 15.5) * 27;
  out[1] = (row - 3.5) * 46;
  out[2] = 0;
  return out;
}

/** Live station state, needed by the stage. */
let stationK = 0;
let stationT = 0;
let centreX = LINE_HALF;

export default {
  id: 'commerce',

  enter() {
    for (let i = 0; i < R.N; i++) {
      R.role[i] = (i / 64) | 0;
      R.alive[i] = 1;
    }
  },

  field(p, dt) {
    // Deliberate and stiff. Every arrival is a mechanical seat.
    R.physics.stiffness = 30;
    R.physics.damping = 0.82;

    const f = clamp(sub(p, 0.04, 0.86) * 5, 0, 5);
    const k = Math.min(4, Math.floor(f));
    const t = clamp01(f - k);
    stationK = k;
    stationT = t;

    // The camera trucks the length of the line, and the units travel with it.
    centreX = lerp(LINE_HALF, -LINE_HALF, f / 5);

    for (let i = 0; i < R.N; i++) {
      // Staggered so the re-formation ripples through the batch rather than
      // switching on one frame.
      const ts = ease.seat(staggerSeed(i, t, 0.72));

      formation(k, i, FA);
      formation(k + 1, i, FB);

      aimAt(
        i,
        centreX + lerp(FA[0], FB[0], ts),
        lerp(FA[1], FB[1], ts),
        lerp(FA[2], FB[2], ts)
      );

      R.grip[i] = 1.15;
      R.size[i] = 1;

      // Changing is orange. The resolved variant stays warm from the moment it
      // is selected until it is checked out, because it is the important one.
      let h = ease.breathe(ts) * 0.72;
      if (isChosen(i) && (k === 2 || k === 3)) h = Math.max(h, 0.44);
      if (k >= 2 && !isChosen(i) && k < 4) h *= 0.35;
      warm(i, 0.03 + h, 0.16, dt);
    }

    // ── Topology per station ────────────────────────────────────────────────
    // The dominant station owns the topology, so connections belong to the form
    // the batch is actually in.
    const dom = t < 0.5 ? k : k + 1;

    if (dom === 1 || dom === 2) {
      // Each product's four option values, chained through depth.
      for (let j = 0; j < 64; j++) {
        for (let s = 0; s < 3; s++) {
          const a = j + s * 64;
          const b = j + (s + 1) * 64;
          const heat = dom === 2 && (s === CHOSEN - 1 || s + 1 === CHOSEN) ? 0.8 : 0;
          R.link(a, b, heat);
        }
      }
    } else if (dom === 3) {
      const nb = knn(4);
      for (let i = 0; i < R.N; i++) {
        if (!isChosen(i)) continue;
        for (let s = 0; s < 4; s++) {
          const j = nb[i * 4 + s];
          if (j <= i || !isChosen(j)) continue;
          R.link(i, j, 0.5);
        }
      }
    } else if (dom === 5) {
      // Rows of a table.
      for (let i = 0; i < R.N; i++) {
        if (i % 32 !== 31) R.link(i, i + 1, 0.25);
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const f = clamp(sub(p, 0.04, 0.86) * 5, 0, 5);

    // ── The line ────────────────────────────────────────────────────────────
    // A single datum running the full length. This is the floor of the movement
    // and the thing that makes six stations read as one process.
    const dy = -340;
    lline(-LINE_HALF - 150, dy, 0, LINE_HALF + 150, dy, 0, 0, 0.16, 1);
    lline(-LINE_HALF - 150, dy, -180, LINE_HALF + 150, dy, -180, 0, 0.08, 1);

    // ── Stations ────────────────────────────────────────────────────────────
    // Ordered so the station the batch is nearest is drawn first and therefore
    // always wins the label space.
    const order = [];
    for (let s = 0; s < PIPELINE.length; s++) order.push(s);
    order.sort((a, b) => Math.abs(f - a) - Math.abs(f - b));

    const small = hand();

    for (const s of order) {
      const sx = lerp(LINE_HALF, -LINE_HALF, s / (PIPELINE.length - 1));
      // How close the batch currently is to this station.
      const prox = clamp01(1 - Math.abs(f - s) * 1.25);
      const live = prox > 0.02;
      const a = 0.11 + prox * 0.34;

      // The tick on the datum always exists: it is how the line reads as six
      // stations rather than as one.
      lline(sx, dy - 10, 0, sx, dy + 10, 0, live ? 0.9 : 0, 0.2 + prox * 0.5, 1);
      llabel(sx, dy - 26, 0, `0${s + 1}`, 0, 0.2 + prox * 0.4, 8, 'center');

      // On a portrait frame the portals are wider than their spacing, so only
      // the station being worked is built. One dominant movement, not six.
      if (small && prox < 0.3) continue;

      lrect(sx, -40, 0, 330, 470, live ? 0.9 : 0, a, 1);
      lline(sx, -275, 0, sx, dy, 0, 0, 0.1 + prox * 0.14, 1);

      llabel(sx, 232, 0, PIPELINE[s].stage, live ? 0.9 : 0, 0.34 + prox * 0.6, 10, 'center');
      llabel(sx, 212, 0, PIPELINE[s].detail.toUpperCase(), 0, 0.16 + prox * 0.42, 8, 'center');
    }

    // ── The defect ──────────────────────────────────────────────────────────
    // Held at SELECTION, where the bug actually lived. Three lines: what was
    // observed, what caused it, and why the fix removed the cause rather than
    // patching the symptom.
    const atSelection = clamp01(1 - Math.abs(f - 2) * 1.5);
    if (atSelection > 0.02) {
      const sx = lerp(LINE_HALF, -LINE_HALF, 2 / 5);
      const a = atSelection;
      lline(sx + 190, 60, 180, sx + 240, 60, 180, 0.9, a * 0.5, 1);
      llabel(sx + 252, 60, 180, DEFECT.symptom, 0.9, a * 0.85, 9, 'left');
      llabel(sx + 252, 40, 180, DEFECT.cause, 0, a * 0.5, 8, 'left');
      llabel(sx + 252, 22, 180, DEFECT.fix, 0, a * 0.62, 8, 'left');
    }

    // ── The order ───────────────────────────────────────────────────────────
    // At DATA the stream is annotated with the stores this actually ran on.
    const atData = clamp01((f - 4.2) / 0.8);
    if (atData > 0.02) {
      const sx = -LINE_HALF;
      for (let s = 0; s < 8; s++) {
        const w = COMMERCE_WORK[s % COMMERCE_WORK.length];
        const y = (s - 3.5) * 46;
        const reveal = clamp01((atData - s * 0.06) * 3);
        if (reveal < 0.02) continue;
        llabel(sx + 470, y, 0, w.name, 0, reveal * 0.5, 8, 'left');
      }
      llabel(sx + 470, -230, 0, 'PRODUCTION', 0.9, atData * 0.6, 9, 'left');
    }

    // ── Throughput ──────────────────────────────────────────────────────────
    if (c > 0.04) {
      const a = c * 0.4;
      llabel(LINE_HALF + 40, 300, 0, `BATCH ${R.N}`, 0, a, 9, 'left');
      llabel(LINE_HALF + 40, 282, 0, `STATION ${stationK + 1} / ${PIPELINE.length}`, 0, a * 0.8, 8, 'left');
    }
  },
};
