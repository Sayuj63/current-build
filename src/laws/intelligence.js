/**
 * MOVEMENT 04 — INTELLIGENCE
 *
 * A probability landscape, and a route that emerges through it.
 *
 * The register scatters across a height field where elevation is likelihood, so
 * the terrain is not decoration — it is the data. A route is then selected the
 * way an optimiser would select it: the x axis is divided into twelve bins and
 * the highest node in each bin is taken, which traces the ridge of the field.
 * Nothing is hand-placed, and because the field and the scatter are both
 * deterministic, the same route is found on every load and on the reverse pass.
 *
 * Then the important half: once the route exists, the rest of the data collapses
 * onto it. Every unselected node is drawn toward its nearest point on the route
 * and the terrain wireframe fades out, until all that is left is the decision.
 * That is the actual product of a system like this — not more information, a
 * route through it.
 *
 * The admit-chance readout is derived from the mean elevation of the chosen
 * route rather than written down, so the number the frame reports is genuinely
 * the number the geometry contains.
 */

import { ease, lerp, clamp01, hash01, fbm3 } from '../core/math.js';
import * as R from '../entity/register.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel, lpath } from './kit.js';
import { INTEL_WORK } from '../content/work.js';

/*
 * The field has to cover the camera's lateral travel plus a frame's width at
 * this magnification, otherwise trucking across it exposes empty frame at both
 * ends of the movement.
 */
const FIELD_W = 2180;
const FIELD_D = 1400;
const AMP = 265;

const BINS = 12;
const MESH_X = 21;
const MESH_Z = 14;

/** Elevation is likelihood. Static — data does not breathe. */
const H = (x, z) => fbm3(x * 0.00162, 4.7, z * 0.00191, 3);

const px = new Float32Array(R.N);
const py = new Float32Array(R.N);
const pz = new Float32Array(R.N);

/** Order along the route, or −1. */
const routeOrder = new Int16Array(R.N);
/** For every node, the route node it collapses onto. */
const anchor = new Int16Array(R.N);

const route = [];
const meshLines = [];

/** Mean normalised elevation of the chosen route. The decision's confidence. */
let confidence = 0;
/** The highest node on the route — the maximum the selection actually found. */
let peak = -1;

export default {
  id: 'intelligence',

  enter() {
    route.length = 0;
    meshLines.length = 0;

    for (let i = 0; i < R.N; i++) {
      const x = (hash01(i * 3571 + 17) - 0.5) * FIELD_W;
      const z = (hash01(i * 8191 + 43) - 0.5) * FIELD_D;
      px[i] = x;
      pz[i] = z;
      py[i] = H(x, z) * AMP + (hash01(i * 12289 + 71) - 0.5) * 24;
      routeOrder[i] = -1;
    }

    // Highest node per bin. This is the whole selection algorithm, and it is
    // the same one an optimiser would run over the same field.
    for (let b = 0; b < BINS; b++) {
      const lo = -FIELD_W / 2 + (b / BINS) * FIELD_W;
      const hi = -FIELD_W / 2 + ((b + 1) / BINS) * FIELD_W;
      let best = -1;
      for (let i = 0; i < R.N; i++) {
        if (px[i] < lo || px[i] >= hi) continue;
        if (best < 0 || py[i] > py[best]) best = i;
      }
      if (best >= 0) {
        routeOrder[best] = route.length;
        route.push(best);
      }
    }

    let sum = 0;
    peak = route.length ? route[0] : -1;
    for (let n = 0; n < route.length; n++) {
      const j = route[n];
      sum += py[j] / AMP;
      if (py[j] > py[peak]) peak = j;
    }
    confidence = clamp01((sum / Math.max(1, route.length) + 1) / 2);

    // Nearest route node for every unselected node, by full 3D distance.
    for (let i = 0; i < R.N; i++) {
      let best = route[0] ?? 0;
      let bd = Infinity;
      for (let n = 0; n < route.length; n++) {
        const j = route[n];
        const dx = px[j] - px[i];
        const dy = py[j] - py[i];
        const dz = pz[j] - pz[i];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      anchor[i] = best;
      R.alive[i] = 1;
      R.role[i] = routeOrder[i] >= 0 ? 1 : 0;
    }

    // Terrain wireframe. Static, so it is built once.
    for (let zi = 0; zi < MESH_Z; zi++) {
      const z = (zi / (MESH_Z - 1) - 0.5) * FIELD_D;
      const line = new Float32Array(MESH_X * 3);
      for (let xi = 0; xi < MESH_X; xi++) {
        const x = (xi / (MESH_X - 1) - 0.5) * FIELD_W;
        line[xi * 3] = x;
        line[xi * 3 + 1] = H(x, z) * AMP;
        line[xi * 3 + 2] = z;
      }
      meshLines.push(line);
    }
    for (let xi = 0; xi < MESH_X; xi++) {
      const x = (xi / (MESH_X - 1) - 0.5) * FIELD_W;
      const line = new Float32Array(MESH_Z * 3);
      for (let zi = 0; zi < MESH_Z; zi++) {
        const z = (zi / (MESH_Z - 1) - 0.5) * FIELD_D;
        line[zi * 3] = x;
        line[zi * 3 + 1] = H(x, z) * AMP;
        line[zi * 3 + 2] = z;
      }
      meshLines.push(line);
    }
  },

  field(p, dt) {
    R.physics.stiffness = 15;
    R.physics.damping = 0.87;

    const reveal = sub(p, 0.32, 0.66) * route.length;
    const collapse = ease.out(sub(p, 0.66, 0.96));

    for (let i = 0; i < R.N; i++) {
      const o = routeOrder[i];
      const onRoute = o >= 0;

      let tx = px[i];
      let ty = py[i];
      let tz = pz[i];

      if (!onRoute && collapse > 0) {
        // Collapse onto the nearest point of the decision, keeping a small
        // deterministic offset so the ridge has thickness rather than becoming
        // a single line of coincident nodes.
        const a = anchor[i];
        const jx = (hash01(i * 97 + 5) - 0.5) * 46;
        const jy = (hash01(i * 89 + 11) - 0.5) * 34;
        const jz = (hash01(i * 79 + 23) - 0.5) * 46;
        tx = lerp(tx, px[a] + jx, collapse * 0.92);
        ty = lerp(ty, py[a] + jy, collapse * 0.92);
        tz = lerp(tz, pz[a] + jz, collapse * 0.92);
      }

      aimAt(i, tx, ty, tz);

      if (onRoute) {
        const lit = clamp01(reveal - o);
        R.grip[i] = 1.25;
        R.size[i] = 1 + lit * 0.75;
        warm(i, 0.05 + lit * 0.9, 0.1, dt);
      } else {
        R.grip[i] = 0.3;
        R.size[i] = 0.8;
        // Unselected data warms only while it is actually moving.
        warm(i, 0.025 + collapse * (1 - collapse) * 0.5, 0.06, dt);
      }
    }

    // The route, drawn progressively as it is found.
    for (let n = 0; n < route.length - 1; n++) {
      const lit = clamp01(reveal - n - 1);
      if (lit < 0.02) break;
      R.link(route[n], route[n + 1], 0.6 + lit * 0.4);
    }

    // Collapsed data tethered to the decision it collapsed onto.
    if (collapse > 0.12) {
      for (let i = 0; i < R.N; i++) {
        if (routeOrder[i] >= 0) continue;
        if (hash01(i * 131 + 3) > 0.45) continue;
        R.link(i, anchor[i], 0.1);
      }
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.68, 0.85] });
    const collapse = ease.out(sub(p, 0.66, 0.96));
    const reveal = sub(p, 0.32, 0.66);

    // ── Terrain ─────────────────────────────────────────────────────────────
    // The field recedes as the decision resolves. Once you have the route you
    // no longer need to see every alternative, and the frame should agree.
    const mesh = 0.11 * (1 - collapse * 0.88);
    if (mesh > 0.004) {
      for (let n = 0; n < meshLines.length; n++) {
        lpath(meshLines[n], 0, mesh, 1);
      }
    }

    // Baseline, so elevation reads as elevation.
    const base = -AMP - 150;
    lline(-FIELD_W / 2, base, 0, FIELD_W / 2, base, 0, 0, 0.13, 1);

    // ── Facets ──────────────────────────────────────────────────────────────
    // The real stages of the product, along the axis the route travels.
    for (let s = 0; s < INTEL_WORK.facets.length; s++) {
      const t = s / (INTEL_WORK.facets.length - 1);
      const x = (t - 0.5) * FIELD_W * 0.92;
      const a = 0.3 + clamp01(reveal * 1.3 - t) * 0.45;
      lline(x, base, 0, x, base + 24, 0, 0, a * 0.4, 1);
      llabel(x, base - 24, 0, INTEL_WORK.facets[s], 0, a * 0.8, 8, 'center');
    }

    // ── The decision ────────────────────────────────────────────────────────
    // Derived from the geometry: the mean elevation of the route that was
    // actually chosen, resolving as the route completes. It is anchored to the
    // route's own peak, because the peak is what the number is about.
    if (peak >= 0 && reveal > 0.02) {
      const shown = Math.round(confidence * 100 * clamp01(reveal * 1.15));
      const a = clamp01(reveal * 1.4);
      lline(px[peak], py[peak], pz[peak], px[peak] + 54, py[peak] + 96, pz[peak], 0.9, a * 0.45, 1);
      llabel(px[peak] + 64, py[peak] + 100, pz[peak], 'ADMIT CHANCE', 0, a * 0.6, 8, 'left');
      llabel(
        px[peak] + 64,
        py[peak] + 76,
        pz[peak],
        `${String(shown).padStart(2, '0')}%`,
        0.95,
        a * 0.95,
        15,
        'left'
      );
    }

    // ── Title and claim ─────────────────────────────────────────────────────
    // Kept inboard of the field edges so a lateral truck never carries the
    // typography out of frame.
    llabel(-660, AMP + 210, 0, INTEL_WORK.title, 0, 0.42, 10, 'left');
    if (hold > 0.05) {
      llabel(-660, AMP + 188, 0, INTEL_WORK.claim, 0.9, hold * 0.55, 9, 'left');
    }

    // ── Metrics ─────────────────────────────────────────────────────────────
    if (c > 0.04) {
      const a = c * 0.36;
      llabel(660, AMP + 210, 0, `CANDIDATES ${R.N}`, 0, a, 9, 'right');
      llabel(660, AMP + 190, 0, `ROUTE ${route.length} NODES`, 0.85, a, 9, 'right');
      llabel(660, AMP + 170, 0, `COLLAPSE ${Math.round(collapse * 100)}%`, 0, a * 0.8, 8, 'right');
    }
  },
};
