/**
 * The instrument.
 *
 * Everything here lives on the glass rather than inside the photograph, which
 * is why it stays hairline-crisp while the world carries grain and bloom. The
 * split is the typographic thesis of the piece: evidence is photographed,
 * diagnostics are not.
 *
 * Readouts tick rather than glide. They are quantised and written at 8 Hz, and
 * only when the string has actually changed — partly for the frame budget, but
 * mostly because a smoothly interpolating number reads as an animation whereas
 * a stepping one reads as a measurement.
 *
 * The orientation rail is also the keyboard interface to the film: thirteen
 * real buttons, so the entire piece is navigable without a pointer and without
 * breaking the frame.
 */

import { state, fired } from '../core/state.js';
import { MOVEMENTS } from '../content/movements.js';
import * as signal from '../core/signal.js';
import * as camera from '../render/camera.js';
import * as lens from '../render/lens.js';
import { quantise, clamp01 } from '../core/math.js';
import * as R from '../entity/register.js';

let elIndex, elName, elState, elSync, elMeta, elPos, elRail, elBeat, elHint;
const ticks = [];

let acc = 0;
let last = { index: '', name: '', st: '', sync: '', meta: '', pos: '' };
let hintShown = false;
let touched = false;

const write = (el, key, value) => {
  if (last[key] === value) return;
  last[key] = value;
  el.textContent = value;
};

// ── Beats ───────────────────────────────────────────────────────────────────

let beatToken = 0;

/**
 * A one-shot statement from the system. Tracking opens as it arrives and the
 * hold is generous, because these fire at most a couple of times per visit and
 * are meant to be read, not glimpsed.
 */
function beat(text, { hold = 900, size = 1, colour = null } = {}) {
  if (!elBeat) return;
  const token = ++beatToken;
  elBeat.textContent = text;
  elBeat.style.fontSize = size === 1 ? '' : `clamp(${14 * size}px, ${4.4 * size}vw, ${46 * size}px)`;
  if (colour) elBeat.style.color = colour;

  elBeat.animate(
    [
      { opacity: 0, letterSpacing: '0.62em', filter: 'blur(6px)' },
      { opacity: 1, letterSpacing: '0.3em', filter: 'blur(0px)', offset: 0.22 },
      { opacity: 1, letterSpacing: '0.3em', filter: 'blur(0px)', offset: 0.78 },
      { opacity: 0, letterSpacing: '0.2em', filter: 'blur(3px)' },
    ],
    { duration: 420 + hold, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
  );

  setTimeout(() => {
    if (token === beatToken) elBeat.style.color = '';
  }, 460 + hold);
}

// ── Rail ────────────────────────────────────────────────────────────────────

function buildRail() {
  elRail.innerHTML = '';
  ticks.length = 0;
  for (let i = 0; i < MOVEMENTS.length; i++) {
    const m = MOVEMENTS[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tick';
    b.setAttribute('aria-label', `Go to movement ${String(i).padStart(2, '0')} — ${m.name}`);
    b.addEventListener('click', () => {
      // Glide rather than jump: a cut is the one thing this film never does.
      signal.glide(signal.yAt(i, 0.04), 1.5);
    });
    elRail.appendChild(b);
    ticks.push(b);
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

export function init() {
  elIndex = document.getElementById('hud-index');
  elName = document.getElementById('hud-name');
  elState = document.getElementById('hud-state');
  elSync = document.getElementById('hud-sync');
  elMeta = document.getElementById('hud-meta');
  elPos = document.getElementById('hud-pos');
  elRail = document.getElementById('hud-rail');
  elBeat = document.getElementById('hud-beat');
  elHint = document.getElementById('hud-hint');

  if (elRail) buildRail();

  // The instrument reports the system losing its footing, and the camera and
  // the lens are struck at the same instant so the failure is felt physically
  // rather than merely announced.
  signal.on('desync', () => {
    beat('SYNC LOST', { hold: 620, size: 0.72 });
    camera.impulse(9);
  });

  signal.on('tooFast', () => {
    beat('TOO FAST.', { hold: 1500, size: 1.25 });
    camera.impulse(22);
    lens.flash(0.1);
  });

  signal.on('lock', () => {
    beat('SYNC 100', { hold: 520, size: 0.62, colour: 'var(--offwhite)' });
    lens.flash(0.045);
  });

  // Any real input retires the hint permanently.
  const retire = () => {
    touched = true;
    if (elHint) elHint.dataset.show = '0';
  };
  window.addEventListener('wheel', retire, { once: true, passive: true });
  window.addEventListener('touchstart', retire, { once: true, passive: true });
  window.addEventListener('keydown', retire, { once: true });
}

export function resize() {
  // Layout is entirely CSS-driven; nothing is cached that a resize invalidates.
}

export function tick(dt) {
  // The one instruction in the entire piece, offered only if the visitor has
  // not worked it out on their own within a few seconds.
  if (!touched && !hintShown && state.time > 3.4 && state.scrollY < 24) {
    hintShown = true;
    if (elHint) elHint.dataset.show = '1';
  }

  // Safety net: any means of travelling into the film retires the hint, not
  // just the input events that happen to be listened for.
  if (!touched && state.scrollY > 200) {
    touched = true;
    if (elHint) elHint.dataset.show = '0';
  }

  acc += dt;
  if (acc < 0.125) return;
  acc = 0;

  const m = MOVEMENTS[Math.min(state.scene, MOVEMENTS.length - 1)];

  write(elIndex, 'index', String(state.scene).padStart(2, '0'));
  write(elName, 'name', m.name);

  const st = state.systemState.toUpperCase();
  if (elState.dataset.state !== state.systemState) elState.dataset.state = state.systemState;
  write(elState, 'st', st);

  const syncPct = Math.round(state.sync * 100);
  const low = syncPct < 70 ? '1' : '0';
  if (elSync.dataset.low !== low) elSync.dataset.low = low;
  write(elSync, 'sync', `SYNC ${String(syncPct).padStart(3, ' ')}`);

  if (elMeta) {
    write(elMeta, 'meta', `REG ${R.N} · LNK ${String(R.getLinkCount()).padStart(4, '0')}`);
  }

  if (elPos) {
    // Signed velocity, because direction is a first-class input and the readout
    // should admit it.
    const v = quantise(state.scrollVelocity, 10).toFixed(0);
    write(elPos, 'pos', `${state.scrollProgress.toFixed(3)} · ${v} PX/S`);
  }

  for (let i = 0; i < ticks.length; i++) {
    const active = i === state.scene ? '1' : '0';
    const past = i < state.scene ? '1' : '0';
    if (ticks[i].dataset.active !== active) ticks[i].dataset.active = active;
    if (ticks[i].dataset.past !== past) ticks[i].dataset.past = past;
  }
}

export { beat };
