/**
 * Boot.
 *
 * Owns the environment fields in the shared state, wires every subsystem into
 * the single clock in a fixed priority order, and gets out of the way. The
 * order below is the whole render contract:
 *
 *   signal → pointer → camera → law → integrate → draw world → lens → hud
 *
 * Nothing in the application may call requestAnimationFrame, and nothing may
 * read the state before signal has resolved it for the current frame.
 */

import { state } from './state.js';
import * as clock from './clock.js';
import { PRIORITY } from './clock.js';
import * as signal from './signal.js';
import * as pointer from './pointer.js';
import * as camera from '../render/camera.js';
import * as world from '../render/world.js';
import * as lens from '../render/lens.js';
import * as laws from '../laws/index.js';
import * as R from '../entity/register.js';
import * as session from './session.js';
import * as hud from '../ui/hud.js';
import * as type from '../ui/type.js';
import * as terminus from '../ui/terminus.js';
import * as theme from '../ui/theme.js';
import * as score from '../audio/score.js';

const html = document.documentElement;

function readEnvironment() {
  state.viewportW = window.innerWidth;
  state.viewportH = window.innerHeight;
  // Handheld is a separate edit, not a scaled layout.
  state.edit = window.matchMedia('(max-width: 720px)').matches ? 'hand' : 'wide';
  state.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The film always starts at ORIGIN. A restored scroll position would drop the
 * visitor into the middle of a sentence.
 */
function resetScroll() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

function renderFrame(dt) {
  camera.tick(dt);
  laws.field(dt);
  R.integrate(dt);

  world.clear();
  laws.stage();
  world.drawRegister();
  laws.overlay();
}

// ── Quality governor ────────────────────────────────────────────────────────

let budgetDebt = 0;
let qualityStep = 0;
const QUALITY = [2, 1.5, 1];

function governQuality(dt) {
  if (qualityStep >= QUALITY.length - 1) return;
  // Only react to a sustained deficit. A single long frame is a hiccup, not a
  // verdict on the device.
  budgetDebt = state.fps < 46 ? budgetDebt + dt : Math.max(0, budgetDebt - dt * 0.6);
  if (budgetDebt > 2.5) {
    budgetDebt = 0;
    qualityStep++;
    world.setDprCap(QUALITY[qualityStep]);
    world.resize();
    lens.resize();
  }
}

// ── Resize ──────────────────────────────────────────────────────────────────

let resizeTimer = 0;

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Hold the visitor's place in the narrative across a layout change: the
    // document height is about to change and raw scrollY would mean something
    // different afterwards.
    const progress = state.scrollProgress;
    const wasEdit = state.edit;

    readEnvironment();
    world.resize();
    lens.resize();
    const l = signal.measure();
    hud.resize();

    if (wasEdit !== state.edit || Math.abs(progress) > 0.0001) {
      window.scrollTo(0, progress * Math.max(1, l.total - state.viewportH));
    }
  }, 140);
}

// ── Start ───────────────────────────────────────────────────────────────────

function main() {
  readEnvironment();

  // Theme comes up before anything else so the doc — which may be about to
  // become the site — paints in the correct palette on the first frame.
  theme.init();

  // Reduced motion promotes the semantic document to being the site. The
  // cinematic layer enhances the document; it is not a prerequisite for it.
  // The contact path has to survive that switch, so it is wired here too —
  // the world actions do not exist in this mode, and without this the visitor
  // would be left with no way to reach anyone.
  if (state.reduced) {
    html.classList.add('reduced');
    terminus.wireDocumentContacts();
    document.getElementById('audio-toggle')?.remove();
    document.getElementById('terminus')?.remove();
    document.getElementById('doc')?.removeAttribute('tabindex');
    return;
  }

  resetScroll();

  const worldCanvas = document.getElementById('world');
  const displayCanvas = document.getElementById('display');

  world.init(worldCanvas);

  if (!lens.init(displayCanvas, worldCanvas)) {
    // Without WebGL the world is shown unphotographed: no bloom, no grain, no
    // frame crush. Every narrative beat still lands.
    html.classList.add('no-lens');
    console.info('[boot] lens unavailable — showing the negative directly');
  }

  signal.init();
  session.init();
  hud.init();
  type.init();
  terminus.init();
  score.init();
  laws.activate(state.sceneId, 1);

  signal.on('scene', (scene, from) => {
    const dir = scene > from ? 1 : -1;
    laws.activate(state.sceneId, dir);
    type.announce(scene, dir);
  });

  clock.add(signal.tick, PRIORITY.SIGNAL, 'signal');
  clock.add(pointer.tick, PRIORITY.SIGNAL + 1, 'pointer');
  clock.add(session.tick, PRIORITY.SIGNAL + 2, 'session');
  clock.add(renderFrame, PRIORITY.WORLD, 'world');
  clock.add(lens.render, PRIORITY.LENS, 'lens');
  clock.add(hud.tick, PRIORITY.UI, 'hud');
  clock.add(type.tick, PRIORITY.UI + 1, 'type');
  clock.add(terminus.tick, PRIORITY.UI + 2, 'terminus');
  clock.add(governQuality, PRIORITY.UI + 3, 'quality');
  clock.add(score.tick, PRIORITY.SOUND, 'score');

  pointer.init();
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });

  clock.start();

  // Reveal the instrument only once a frame has actually been photographed, so
  // the HUD never appears over an empty canvas.
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('running')));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
