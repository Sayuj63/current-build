/**
 * The session.
 *
 * This is the closing idea of the piece, and the reason the entity has exactly
 * 256 nodes rather than a round number that merely looked good.
 *
 * Everything the visitor did while operating the system is recorded: how long
 * they dwelled in each of the thirteen movements, the fastest they ever
 * travelled, how many times they reversed direction, how often they outran the
 * system, whether they ever found the ideal rhythm. That record is serialised
 * into a canonical string and hashed with the same SHA-256 implementation that
 * MOVEMENT 05 used on the manifest of real work. The resulting 256 bits are
 * written onto the same 256 nodes.
 *
 * So the object the visitor is left looking at is a fingerprint of their own
 * visit. Two people cannot get the same one, the same person cannot repeat one,
 * and it is verifiable in the same way the manifest digest was: the canonical
 * string is printed alongside it, so anyone can hash it themselves and check.
 *
 * The record is sealed the first time it is asked for, because a fingerprint
 * that kept changing while you looked at it would not be a fingerprint.
 */

import { state, fired } from './state.js';
import { MOVEMENTS } from '../content/movements.js';
import { sha256, utf8, hex } from './sha256.js';
import * as signal from './signal.js';

const record = {
  /** Seconds spent in each movement. */
  dwell: new Float32Array(MOVEMENTS.length),
  /** Highest instantaneous speed reached, px/s. */
  peak: 0,
  reversals: 0,
  desyncs: 0,
  locks: 0,
  tooFast: 0,
  /** Deepest movement reached. */
  reached: 0,
  elapsed: 0,
};

let sealed = null;

export function init() {
  signal.on('reversal', () => {
    record.reversals++;
  });
  signal.on('desync', () => {
    record.desyncs++;
  });
  signal.on('lock', () => {
    record.locks++;
  });
  signal.on('tooFast', () => {
    record.tooFast++;
  });
}

export function tick(dt) {
  // Scripted travel is the system moving itself, not the visitor operating it,
  // so it is excluded from the record.
  if (state.scripted) return;
  record.elapsed += dt;
  record.dwell[state.scene] += dt;
  if (state.rawSpeed > record.peak) record.peak = state.rawSpeed;
  if (state.scene > record.reached) record.reached = state.scene;
}

/**
 * The canonical serialisation. Quantised deliberately: dwell to whole seconds
 * and peak to the nearest ten pixels per second, so the string is a description
 * of how someone moved rather than a recording of floating-point noise. It is
 * printed on screen next to the digest so the hash can be checked by hand.
 */
export function canonical() {
  const dwell = Array.from(record.dwell, (d) => Math.round(d)).join(',');
  return [
    'CURRENT BUILD/1',
    `dwell=${dwell}`,
    `peak=${Math.round(record.peak / 10) * 10}`,
    `rev=${record.reversals}`,
    `desync=${record.desyncs}`,
    `lock=${record.locks}`,
    `fast=${record.tooFast}`,
    `reached=${record.reached}`,
    `elapsed=${Math.round(record.elapsed)}`,
    `edit=${state.edit}`,
  ].join('|');
}

/** Seal the record and return the sigil. Idempotent until reset. */
export function seal() {
  if (sealed) return sealed;
  const payload = canonical();
  const bytes = sha256(utf8(payload));
  sealed = {
    payload,
    bytes,
    hex: hex(bytes),
    short: hex(bytes, 0, 4),
    reversals: record.reversals,
    desyncs: record.desyncs,
    locks: record.locks,
    elapsed: Math.round(record.elapsed),
    peak: Math.round(record.peak),
  };
  fired.sigilBuilt = true;
  return sealed;
}

export const isSealed = () => Boolean(sealed);
export const peek = () => sealed;

/** Break the seal so a second pass through the film earns its own sigil. */
export function reset() {
  sealed = null;
  fired.sigilBuilt = false;
}

/**
 * The artifact, as SVG. Chosen over a canvas export because it is vector,
 * text-selectable, tiny, and contains the payload string in the file — so the
 * downloaded object carries everything needed to verify itself.
 */
export function svg() {
  const s = seal();
  const CELL = 22;
  const PAD = 40;
  const W = CELL * 16 + PAD * 2;
  const H = W + 150;

  let cells = '';
  for (let i = 0; i < 256; i++) {
    const byte = s.bytes[i >> 3];
    const bit = (byte >> (7 - (i & 7))) & 1;
    const x = PAD + (i % 16) * CELL;
    const y = PAD + ((i / 16) | 0) * CELL;
    cells += bit
      ? `<rect x="${x + 4}" y="${y + 4}" width="${CELL - 8}" height="${CELL - 8}" fill="#ff4d0a"/>`
      : `<rect x="${x + CELL / 2 - 1}" y="${y + CELL / 2 - 1}" width="2" height="2" fill="#3a4048"/>`;
  }

  const rows = [0, 1, 2, 3]
    .map(
      (r) =>
        `<text x="${PAD}" y="${W + 26 + r * 18}" font-family="ui-monospace,monospace" font-size="13" fill="#98a1ab" letter-spacing="1.5">${s.hex.slice(
          r * 16,
          r * 16 + 16
        )}</text>`
    )
    .join('');

  // The payload is embedded so the file proves its own digest.
  const esc = s.payload.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#06070a"/>
<text x="${PAD}" y="26" font-family="ui-monospace,monospace" font-size="10" fill="#575f69" letter-spacing="3">SESSION SIGIL — SHA-256</text>
${cells}
${rows}
<text x="${PAD}" y="${W + 110}" font-family="ui-monospace,monospace" font-size="8" fill="#2b3037">${esc}</text>
<text x="${PAD}" y="${W + 128}" font-family="ui-monospace,monospace" font-size="9" fill="#575f69" letter-spacing="2">BUILD CONTINUES</text>
</svg>`;
}

export function download() {
  const s = seal();
  const blob = new Blob([svg()], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `current-build-sigil-${s.short}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next turn of the event loop; the click has already consumed it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return s;
}

export { record };
