/**
 * MOVEMENT 05 — TRUST
 *
 * FILE → CHUNK → DIGEST → COMMIT → VERIFY, with the camera almost stationary.
 * After four movements of travel, stillness is the effect.
 *
 * This is what the number 256 has been for. The register becomes a real
 * SHA-256 digest — one node per bit, computed in this frame by the
 * implementation in core/sha256.js over a manifest of the actual work. The bit
 * pattern is rendered as a physical relief: a one stands forward and is lit, a
 * zero sits back and is dark. The same digest is printed as hex beside it, so
 * the frame shows one fact in two representations and they can be checked
 * against each other.
 *
 * Nothing here is a simulation of hashing. If you read the hex off the screen
 * and hash the manifest yourself, you get the same string, and the relief is
 * that string in binary.
 *
 * Then it commits: the bits compress into a single block and take their place in
 * a chain, where the neighbouring blocks carry their own real digests. What the
 * movement is arguing is that verification does not require trusting whoever
 * stored the file — and the movement is built so that it does not require
 * trusting this page either.
 */

import { ease, lerp, clamp, clamp01, hash01 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { digestOf, hex, utf8 } from '../core/sha256.js';
import { sub, staggerSeed, curiosity, aimAt, warm, holdAmount, lline, llabel } from './kit.js';
import { IDENTITY, COMMERCE_WORK, ALPHA, TRUST_WORK, PEOPLE_WORK, INTEL_WORK } from '../content/work.js';

/**
 * The payload. A canonical manifest of real work — deterministic, so the
 * digest, and therefore the shape of the object, is identical on every load.
 */
const MANIFEST = [
  IDENTITY.name,
  COMMERCE_WORK.map((w) => w.name).join('|'),
  ALPHA.platform,
  INTEL_WORK.title,
  TRUST_WORK.title,
  PEOPLE_WORK.title,
].join(' · ');

const DIGEST = digestOf(MANIFEST);
const DIGEST_HEX = hex(DIGEST);

/**
 * The real UTF-8 byte length. Not MANIFEST.length — that counts UTF-16 code
 * units, and the separator is multi-byte, so the two disagree by five. In a
 * movement whose entire argument is that the numbers on screen can be checked,
 * a label reading BYTES has to actually report bytes.
 */
const PAYLOAD_BYTES = utf8(MANIFEST).length;

/** Neighbouring blocks in the chain, each with its own genuine digest. */
const CHAIN = [-2, -1, 1, 2].map((k) => ({
  k,
  hash: hex(digestOf(`${MANIFEST}#${k}`), 0, 4),
}));

const FA = [0, 0, 0];
const FB = [0, 0, 0];

const BLOCK_W = 168;
const CHAIN_GAP = 268;

/** FILE, CHUNK, DIGEST, COMMIT, VERIFY. */
function formation(k, i, out) {
  const col = i % 16;
  const row = (i / 16) | 0;

  if (k === 0) {
    // FILE — a document. Dense, ordered, unremarkable.
    out[0] = (col - 7.5) * 23;
    out[1] = (7.5 - row) * 29;
    out[2] = 0;
    return out;
  }

  if (k === 1) {
    // CHUNK — eight bands separate in depth. The file is being read in pieces.
    const chunk = (row / 2) | 0;
    out[0] = (col - 7.5) * 23;
    out[1] = (7.5 - row) * 29 + (3.5 - chunk) * 16;
    out[2] = (chunk - 3.5) * 76;
    return out;
  }

  if (k === 2) {
    // DIGEST — 256 bits as a relief. A one stands forward.
    out[0] = (col - 7.5) * 29;
    out[1] = (7.5 - row) * 29;
    out[2] = R.bit[i] ? 62 : -18;
    return out;
  }

  // COMMIT and VERIFY — the bits compress into one block in the chain.
  const bx = i % 8;
  const by = ((i / 8) | 0) % 8;
  const bz = (i / 64) | 0;
  out[0] = (bx - 3.5) * (BLOCK_W / 8);
  out[1] = (by - 3.5) * (BLOCK_W / 8);
  out[2] = (bz - 1.5) * 34;
  return out;
}

/** Twelve edges of an axis-aligned box. */
function box(cx, cy, cz, w, h, d, heat, a) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  for (const z of [z0, z1]) {
    lline(x0, y0, z, x1, y0, z, heat, a, 1);
    lline(x1, y0, z, x1, y1, z, heat, a, 1);
    lline(x1, y1, z, x0, y1, z, heat, a, 1);
    lline(x0, y1, z, x0, y0, z, heat, a, 1);
  }
  lline(x0, y0, z0, x0, y0, z1, heat, a * 0.7, 1);
  lline(x1, y0, z0, x1, y0, z1, heat, a * 0.7, 1);
  lline(x1, y1, z0, x1, y1, z1, heat, a * 0.7, 1);
  lline(x0, y1, z0, x0, y1, z1, heat, a * 0.7, 1);
}

let stage_ = 0;
let stageT = 0;

export default {
  id: 'trust',

  enter() {
    // One node per bit. This is the line the whole piece has been building to.
    R.loadBits(DIGEST);
    for (let i = 0; i < R.N; i++) {
      R.role[i] = R.bit[i];
      R.alive[i] = 1;
    }
  },

  field(p, dt) {
    // Precise and quiet. Certainty should feel like something settling.
    R.physics.stiffness = 24;
    R.physics.damping = 0.84;

    const f = clamp(sub(p, 0.02, 0.74) * 4, 0, 4);
    const k = Math.min(3, Math.floor(f));
    const t = clamp01(f - k);
    stage_ = k;
    stageT = t;

    const verify = sub(p, 0.74, 1);

    for (let i = 0; i < R.N; i++) {
      const ts = ease.out(staggerSeed(i, t, 0.66));
      formation(k, i, FA);
      formation(k + 1, i, FB);
      aimAt(i, lerp(FA[0], FB[0], ts), lerp(FA[1], FB[1], ts), lerp(FA[2], FB[2], ts));

      const bit = R.bit[i];
      const atDigest = k === 2 || (k === 1 && ts > 0.4) || (k === 3 && ts < 0.5);

      R.grip[i] = 1.3;

      if (atDigest) {
        // The relief. Ones are larger and lit; zeros are small and dark. The
        // digest is legible as an object, not merely represented by one.
        R.size[i] = bit ? 1.5 : 0.62;
        warm(i, bit ? 0.92 : 0.02, 0.12, dt);
      } else if (k === 3) {
        // Committed: the pattern is still readable in the block, held back.
        R.size[i] = bit ? 1.15 : 0.8;
        warm(i, bit ? 0.34 + verify * 0.16 : 0.02, 0.06, dt);
      } else {
        R.size[i] = 1;
        warm(i, 0.03 + ease.breathe(ts) * 0.3, 0.08, dt);
      }
    }

    // ── Topology ────────────────────────────────────────────────────────────
    if (k === 0 || (k === 1 && stageT < 0.5)) {
      // The file, as rows of a document.
      for (let i = 0; i < R.N; i++) if (i % 16 !== 15) R.link(i, i + 1, 0);
    } else if (k === 1) {
      // Chunk boundaries: each band bound to itself.
      for (let i = 0; i < R.N; i++) {
        const row = (i / 16) | 0;
        if (i % 16 !== 15) R.link(i, i + 1, 0);
        if (row % 2 === 0 && i + 16 < R.N) R.link(i, i + 16, 0);
      }
    } else if (k === 2) {
      // Only the set bits are connected, so the digest's own structure is the
      // topology. Runs of ones become visible chains.
      for (let i = 0; i < R.N; i++) {
        if (!R.bit[i]) continue;
        if (i % 16 !== 15 && R.bit[i + 1]) R.link(i, i + 1, 0.85);
        if (i + 16 < R.N && R.bit[i + 16]) R.link(i, i + 16, 0.85);
      }
    } else {
      // The committed block: a solid lattice.
      for (let i = 0; i < R.N; i++) {
        if (i % 8 !== 7) R.link(i, i + 1, 0);
        if (((i / 8) | 0) % 8 !== 7) R.link(i, i + 8, 0);
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.6, 0.9] });
    const f = clamp(sub(p, 0.02, 0.74) * 4, 0, 4);
    const verify = sub(p, 0.74, 1);

    // ── Steps ───────────────────────────────────────────────────────────────
    const steps = TRUST_WORK.steps;
    const baseY = -300;
    lline(-330, baseY, 0, 330, baseY, 0, 0, 0.14, 1);
    for (let s = 0; s < steps.length; s++) {
      const x = lerp(-300, 300, s / (steps.length - 1));
      const prox = clamp01(1 - Math.abs(f - s) * 1.3);
      lline(x, baseY - 8, 0, x, baseY + 8, 0, prox > 0.1 ? 0.9 : 0, 0.2 + prox * 0.6, 1);
      llabel(x, baseY - 26, 0, steps[s], prox > 0.1 ? 0.9 : 0, 0.28 + prox * 0.6, 9, 'center');
    }

    // ── The digest, as hex ──────────────────────────────────────────────────
    // Printed beside the relief so the two representations can be compared.
    const atDigest = clamp01(1 - Math.abs(f - 2) * 1.1);
    if (atDigest > 0.02) {
      const a = atDigest;
      const x = 300;
      llabel(x, 250, 0, TRUST_WORK.algo, 0.9, a * 0.8, 10, 'left');
      llabel(x, 230, 0, '256 BIT · 64 HEX', 0, a * 0.45, 8, 'left');
      for (let r = 0; r < 4; r++) {
        llabel(x, 196 - r * 20, 0, DIGEST_HEX.slice(r * 16, r * 16 + 16), 0, a * 0.72, 10, 'left');
      }
      llabel(x, 96, 0, 'PAYLOAD', 0, a * 0.4, 8, 'left');
      llabel(x, 78, 0, `${PAYLOAD_BYTES} BYTES`, 0, a * 0.5, 8, 'left');

      // One node called out, so the mapping is unambiguous rather than implied.
      if (c > 0.06) {
        const bitOne = R.bit[0] ? '1' : '0';
        llabel(-300, 250, 0, `NODE 000 = BIT 000 = ${bitOne}`, 0, c * 0.55, 8, 'left');
        llabel(-300, 232, 0, 'ONE NODE PER BIT', 0.85, c * 0.5, 8, 'left');
      }
    }

    // ── The chain ───────────────────────────────────────────────────────────
    const committed = clamp01((f - 2.6) / 1.4);
    if (committed > 0.02) {
      const a = committed;
      for (let n = 0; n < CHAIN.length; n++) {
        const b = CHAIN[n];
        const x = b.k * CHAIN_GAP;
        // Blocks further from the present are fainter: an archive receding.
        const fade = a * (1 - Math.abs(b.k) * 0.22);
        box(x, 0, 0, BLOCK_W, BLOCK_W, 74, 0, fade * 0.3);
        llabel(x, -BLOCK_W * 0.72, 0, b.hash, 0, fade * 0.6, 9, 'center');
      }
      // Connectors. The chain is what makes any single digest useful.
      for (let k = -2; k < 2; k++) {
        const x0 = k * CHAIN_GAP + BLOCK_W / 2;
        const x1 = (k + 1) * CHAIN_GAP - BLOCK_W / 2;
        lline(x0, 0, 0, x1, 0, 0, 0.8, a * 0.45, 1);
      }
      llabel(0, BLOCK_W * 0.78, 0, DIGEST_HEX.slice(0, 8), 0.95, a * 0.9, 10, 'center');
    }

    // ── Verification ────────────────────────────────────────────────────────
    if (verify > 0.02) {
      const a = clamp01(verify * 2.2);
      llabel(0, -190, 0, 'DIGEST MATCH', 0.95, a * 0.9, 11, 'center');
      if (hold > 0.05) {
        llabel(0, -212, 0, TRUST_WORK.claim, 0, hold * 0.55, 8, 'center');
      }
    }
  },
};
