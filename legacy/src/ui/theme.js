/**
 * Theme switch.
 *
 * The film — canvas, lens, grain, bloom — is dark by intent. It is a
 * photograph, and photographs do not invert. The theme switch therefore does
 * two things when the visitor asks for a light surface: it repaints the CSS
 * palette to a warm reading white, and it promotes the accessible document to
 * being the site (identical to reduced-motion). Dark restores the film.
 *
 * Preference persists in localStorage so a return visit lands in the same
 * mode. The initial paint is applied by a tiny inline script in the head to
 * avoid a flash of the wrong theme on load — this module owns the toggle and
 * runtime transitions.
 */

import { NAMED_PROJECTS } from '../content/work.js';

const KEY = 'sayuj.theme';
const html = document.documentElement;

function readStored() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode or storage disabled — accept the loss silently.
  }
}

export function current() {
  return html.dataset.theme === 'light' ? 'light' : 'dark';
}

export function apply(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  html.dataset.theme = next;
  // The film runs in both themes — dark is a photograph, light is a print of
  // the same photograph. The canvas is repainted at render time by the lens
  // and world modules, which read the theme once at init.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'light' ? '#f4f0e8' : '#06070a');
  const btn = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  if (btn) btn.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
  if (label) label.textContent = next === 'light' ? 'DARK' : 'LIGHT';
  write(next);
}

/**
 * Render the Projects showcase — a list of named systems with real links
 * where the URL is set. Entries without a URL degrade to plain lines so a
 * private storefront never breaks the render.
 */
function renderProjects() {
  const list = document.getElementById('doc-projects-list');
  if (!list) return;
  // Pull the two collections lazily so the module never dies if either is
  // missing — content is easier to lose than code.
  Promise.all([
    import('../content/work.js').then((m) => m.COMMERCE_WORK || []),
  ]).then(([commerce]) => {
    const items = [
      ...commerce.map((p) => ({ ...p, kind: 'STORE' })),
      ...(NAMED_PROJECTS || []).map((p) => ({ ...p, kind: 'SYSTEM' })),
    ];
    list.innerHTML = '';
    for (const p of items) {
      const li = document.createElement('li');
      li.className = 'proj';
      const row = p.url
        ? document.createElement('a')
        : document.createElement('div');
      row.className = 'proj-row';
      if (p.url) {
        row.href = p.url;
        row.rel = 'noopener';
        row.target = '_blank';
      } else {
        row.dataset.private = '1';
      }
      row.innerHTML = `
        <span class="proj-kind">${p.kind}</span>
        <span class="proj-name">${p.name}</span>
        <span class="proj-note">${p.note}</span>
        <span class="proj-arrow" aria-hidden="true">${p.url ? '↗' : '·'}</span>
      `;
      li.appendChild(row);
      list.appendChild(li);
    }
  });
}

export function init() {
  const btn = document.getElementById('theme-toggle');
  // Dark by default. Light is opt-in — only a stored preference from a
  // previous visit brings it back. See the pre-paint script in index.html
  // for the reasoning; the two paths have to agree or the first paint
  // flashes the wrong theme on reload.
  const initial = readStored() === 'light' ? 'light' : 'dark';
  apply(initial);
  renderProjects();
  if (!btn) return;
  btn.addEventListener('click', () => {
    // The film has running clocks, WebGL context, pointer listeners and a
    // scroll extent tuned to the current mode. A live swap between "film" and
    // "document as the site" is fragile; a reload guarantees the target mode
    // gets a clean init. Preference has already been written to storage so
    // the next paint lands where the visitor asked.
    write(current() === 'light' ? 'dark' : 'light');
    window.location.reload();
  });
}
