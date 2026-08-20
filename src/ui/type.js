/**
 * Kinetic typography.
 *
 * Deliberately one device, used once per movement. The brief is explicit that
 * typography is not the spectacle here and that giant display type is to be
 * avoided, so this is not a title system — it is a transition. A movement
 * announces itself on the glass, holds long enough to be read, and leaves.
 *
 * The techniques are the approved ones and each does a job. Characters are
 * split and masked so the line arrives from behind an edge rather than fading,
 * which reads as mechanical rather than decorative. The stagger runs left to
 * right so the eye is led along the line. Tracking expands with scroll velocity,
 * so the type is visibly under the visitor's control — the same input driving
 * the camera is driving the letterforms. Baseline drift is tied to the same
 * signal and kept small.
 *
 * ORIGIN gets no card at all. Naming the first movement would answer the
 * question it exists to ask.
 */

import { state } from '../core/state.js';
import { MOVEMENTS } from '../content/movements.js';
import { MOVEMENT_LINES } from '../content/work.js';
import { clamp01, damp } from '../core/math.js';

let stage = null;
let token = 0;
let title = null;
let sub = null;
let tracking = 0;

/** Split text into masked per-character spans. */
function split(text, role) {
  const el = document.createElement('p');
  el.className = 'line';
  el.dataset.role = role;
  // The whole line is one accessible string; the per-character spans are
  // presentation only and must not be read out letter by letter.
  el.setAttribute('aria-hidden', 'true');

  const chars = [];
  for (const ch of text) {
    if (ch === ' ') {
      el.appendChild(document.createTextNode(' '));
      continue;
    }
    const mask = document.createElement('span');
    mask.className = 'mask';
    const inner = document.createElement('span');
    inner.textContent = ch;
    mask.appendChild(inner);
    el.appendChild(mask);
    chars.push(inner);
  }
  return { el, chars };
}

function animateIn(chars, dir, delay) {
  chars.forEach((c, i) => {
    c.animate(
      [
        { transform: `translateY(${dir > 0 ? '105%' : '-105%'})` },
        { transform: 'translateY(0)' },
      ],
      {
        duration: 640,
        // Arrival: decisive start, settled finish.
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        delay: delay + i * 17,
        fill: 'both',
      }
    );
  });
}

function animateOut(chars, dir, delay, done) {
  let last = null;
  chars.forEach((c, i) => {
    last = c.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${dir > 0 ? '-105%' : '105%'})` }],
      {
        duration: 460,
        easing: 'cubic-bezier(0.7, 0, 0.84, 0)',
        delay: delay + i * 9,
        fill: 'both',
      }
    );
  });
  if (last) last.finished.then(done).catch(() => {});
  else done();
}

export function init() {
  stage = document.getElementById('hud-stage');
}

/**
 * Announce a movement. `dir` is the direction of travel, so reversing through
 * the film reverses the direction the type arrives from.
 */
export function announce(sceneIndex, dir = 1) {
  if (!stage) return;
  const m = MOVEMENTS[sceneIndex];
  if (!m) return;

  const line = MOVEMENT_LINES[m.id];
  if (!line) {
    clear();
    return;
  }

  const mine = ++token;
  clear();

  const t = split(`${String(sceneIndex).padStart(2, '0')}  ${m.name}`, 'title');
  const s = split(line, 'meta');
  title = t;
  sub = s;

  stage.appendChild(t.el);
  stage.appendChild(s.el);

  animateIn(t.chars, dir, 0);
  animateIn(s.chars, dir, 220);

  // Held long enough to read, then it leaves. A card that stayed would become
  // furniture and start competing with the world.
  setTimeout(() => {
    if (mine !== token) return;
    animateOut(t.chars, dir, 0, () => {});
    animateOut(s.chars, dir, 60, () => {
      if (mine === token) clear();
    });
  }, 2600);
}

export function clear() {
  if (!stage) return;
  stage.textContent = '';
  title = null;
  sub = null;
}

export function tick(dt) {
  if (!title) return;
  // Tracking expands with velocity: the same input driving the camera is
  // visibly driving the letterforms.
  tracking = damp(tracking, clamp01(state.speed * 2.2), 0.12, dt);
  if (tracking > 0.002) {
    title.el.style.letterSpacing = `${(-0.03 + tracking * 0.16).toFixed(4)}em`;
    // Baseline drift, kept small enough to be felt rather than seen.
    title.el.style.transform = `translateY(${(tracking * 5 * state.scrollDirection).toFixed(2)}px)`;
  }
}
