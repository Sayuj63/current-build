/**
 * SOURCE / CONNECT / MESSAGE / RETURN.
 *
 * Not a call-to-action section. These are the four things you can do inside the
 * world, and they only exist once the film has finished — the piece never asks
 * for anything while it still has something to show.
 *
 * RETURN is the important one. It is not a link and it does not jump: it flies
 * the entire film backwards to ORIGIN over sixteen seconds, running every law in
 * reverse on the way. That is what closes the loop, and it is only possible
 * because the choreography was built to be reversible rather than replayed.
 * Coming back to the opening object after that is the point of the whole
 * structure: nothing about the first frame has changed, and it means something
 * completely different.
 *
 * MESSAGE opens the object, takes WHO / EMAIL / SIGNAL, and hands off to a real
 * mail client — there is no backend, and pretending otherwise would be the one
 * dishonest thing in a piece whose closing argument is that its claims can be
 * checked.
 */

import { state } from '../core/state.js';
import * as signal from '../core/signal.js';
import * as session from '../core/session.js';
import * as camera from '../render/camera.js';
import * as lens from '../render/lens.js';
import { MOVEMENTS } from '../content/movements.js';
import { IDENTITY } from '../content/work.js';
import { beat } from './hud.js';

const TERMINUS = MOVEMENTS.length - 1;

/** Seconds for the flight back. Long enough to be a journey, not a rewind. */
const RETURN_TIME = 16;

let root, keepBtn, panel, shown = false;
let lastFocus = null;

// ── The message object ──────────────────────────────────────────────────────

function buildPanel() {
  panel = document.createElement('div');
  panel.className = 'msg';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Send a message');
  panel.hidden = true;
  panel.innerHTML = `
    <form class="msg-body" novalidate>
      <p class="msg-head mono">MESSAGE</p>
      <label class="msg-field">
        <span class="mono">WHO</span>
        <input name="who" type="text" autocomplete="name" required />
      </label>
      <label class="msg-field">
        <span class="mono">EMAIL</span>
        <input name="email" type="email" autocomplete="email" required />
      </label>
      <label class="msg-field">
        <span class="mono">SIGNAL</span>
        <textarea name="signal" rows="4" required></textarea>
      </label>
      <div class="msg-actions">
        <button class="act mono" type="submit">SEND</button>
        <button class="act mono" type="button" data-close>CLOSE</button>
      </div>
      <p class="msg-note mono">OPENS YOUR MAIL CLIENT · NOTHING IS SENT FROM THIS PAGE</p>
    </form>`;
  document.body.appendChild(panel);

  panel.querySelector('[data-close]').addEventListener('click', closeMessage);
  panel.querySelector('form').addEventListener('submit', send);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMessage();
    if (e.key !== 'Tab') return;
    // A modal has to keep focus inside it, or the keyboard user is dropped
    // behind the panel into a canvas they cannot see.
    const f = panel.querySelectorAll('input, textarea, button');
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function openMessage() {
  if (!panel) buildPanel();
  lastFocus = document.activeElement;
  panel.hidden = false;
  requestAnimationFrame(() => {
    panel.dataset.open = '1';
    panel.querySelector('input[name="who"]').focus();
  });
}

function closeMessage() {
  if (!panel) return;
  panel.dataset.open = '0';
  setTimeout(() => {
    panel.hidden = true;
  }, 260);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function send(e) {
  e.preventDefault();
  const form = e.target;
  const who = form.who.value.trim();
  const email = form.email.value.trim();
  const body = form.signal.value.trim();
  if (!who || !email || !body) return;

  const s = session.peek();
  const subject = `Signal from ${who}`;
  // The sigil rides along, so a message from this page is identifiable as one.
  const lines = [body, '', '—', `${who} · ${email}`];
  if (s) lines.push(`session ${s.short}`);

  const href = `mailto:${IDENTITY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join('\n')
  )}`;

  closeMessage();
  // The world acknowledges it: the frame is struck and the lens flares. The
  // message leaves the glass and enters the photograph.
  camera.impulse(14);
  lens.flash(0.075);
  beat('SIGNAL SENT', { hold: 900, size: 0.7 });
  window.location.href = href;
}

// ── Return to origin ────────────────────────────────────────────────────────

function returnToOrigin() {
  if (state.scripted) return;
  beat('RETURN', { hold: 1100, size: 0.8 });
  // A second pass through the film earns its own fingerprint.
  session.reset();
  signal.glide(0, RETURN_TIME, (t) => t * t * (3 - 2 * t), () => {
    camera.rewind();
  });
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Point the semantic document's contact list at the real destinations, and
 * remove any entry that has no destination.
 *
 * Called both by init() and, on its own, in reduced-motion mode — where the
 * document *is* the site and none of the interactive world actions exist. A
 * reduced-motion visitor must still have a reliable contact path, which is
 * exactly what this guarantees.
 */
export function wireDocumentContacts() {
  const docConnect = document.getElementById('doc-connect');
  if (docConnect) {
    if (IDENTITY.linkedin) docConnect.href = IDENTITY.linkedin;
    else docConnect.closest('li')?.remove();
  }

  const docMessage = document.getElementById('doc-message');
  if (docMessage) {
    if (IDENTITY.email) docMessage.href = `mailto:${IDENTITY.email}`;
    else docMessage.closest('li')?.remove();
  }
}

export function init() {
  root = document.getElementById('terminus');
  if (!root) return;

  wireDocumentContacts();

  const source = document.getElementById('act-source');
  const connect = document.getElementById('act-connect');
  const message = document.getElementById('act-message');
  const ret = document.getElementById('act-return');

  source.href = IDENTITY.github;

  // An action that cannot work is removed rather than left to fail. Both of
  // these come alive the moment the constant in content/work.js is filled in.
  if (IDENTITY.linkedin) {
    connect.href = IDENTITY.linkedin;
  } else {
    connect.remove();
    console.warn('[terminus] IDENTITY.linkedin is empty — CONNECT removed. Set it in src/content/work.js');
  }

  if (IDENTITY.email) {
    message.addEventListener('click', openMessage);
  } else {
    message.remove();
    console.warn('[terminus] IDENTITY.email is empty — MESSAGE removed. Set it in src/content/work.js');
  }

  ret.addEventListener('click', returnToOrigin);

  // Keeping the artifact. Deliberately not a fifth call to action: it belongs
  // to the object rather than to the navigation, so it sits apart and reads as
  // the sigil's own caption.
  keepBtn = document.createElement('button');
  keepBtn.type = 'button';
  keepBtn.id = 'act-keep';
  keepBtn.className = 'keep mono';
  keepBtn.textContent = 'KEEP THIS SIGIL';
  keepBtn.hidden = true;
  keepBtn.addEventListener('click', () => {
    const s = session.download();
    beat(`SIGIL ${s.short.toUpperCase()}`, { hold: 800, size: 0.62 });
  });
  document.body.appendChild(keepBtn);
}

export function tick() {
  if (!root) return;
  // Available for the last movement, and for the tail of UNKNOWN once the
  // fingerprint exists — but never while the film still has something to show.
  const want =
    state.scene >= TERMINUS ||
    (state.scene === TERMINUS - 1 && state.sceneProgress > 0.86 && session.isSealed());

  if (want === shown) return;
  shown = want;
  root.hidden = !want;
  root.dataset.show = want ? '1' : '0';
  if (keepBtn) {
    keepBtn.hidden = !want;
    keepBtn.dataset.show = want ? '1' : '0';
  }
}
