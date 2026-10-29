/**
 * Shared apparatus for the laws.
 *
 * A law's job is to answer one question per frame: where does each of the 256
 * nodes want to be, and how hot is it. Everything in this file exists to make
 * that answer expressible without each law reinventing sequencing, staggering
 * or neighbour topology.
 *
 * Nothing here draws. Laws own their own environment, because shared visual
 * furniture is exactly how a world starts looking generic.
 */

import { state } from '../core/state.js';
import { clamp, clamp01, norm, lerp, ease, TAU, fibSphere } from '../core/math.js';
import * as R from '../entity/register.js';
import { set as SET } from '../render/camera.js';
import { line3, path3, rect3, ring3, quad3, label3 } from '../render/world.js';

// ── Sequencing ──────────────────────────────────────────────────────────────

/**
 * Progress inside a sub-band of the movement, clamped.
 * Laws are written as a series of these so beats can be re-timed in one place.
 */
export const sub = (p, a, b) => norm(p, a, b);

/**
 * Per-node staggered progress. `overlap` is how much of the band every node
 * shares: 1 means perfectly simultaneous, 0 means strictly sequential.
 *
 * Major components should rarely start and finish together — this is what
 * produces temporal hierarchy instead of one synchronised lurch.
 */
export function stagger(i, n, p, overlap = 0.55) {
  const window_ = overlap;
  const spread = 1 - window_;
  const start = (i / Math.max(1, n - 1)) * spread;
  return clamp01((p - start) / Math.max(0.0001, window_));
}

/** Stagger ordered by the node's own immutable character rather than index. */
export function staggerSeed(i, p, overlap = 0.55) {
  const spread = 1 - overlap;
  return clamp01((p - R.seed[i] * spread) / Math.max(0.0001, overlap));
}

/**
 * How deep the visitor is into the movement's hold. Holds are where
 * comprehension happens; laws use this to stop transforming and let the frame
 * settle rather than animating continuously.
 */
export function holdAmount(p, movement) {
  const [a, b] = movement.hold;
  if (p < a) return 0;
  if (p > b) return clamp01(1 - norm(p, b, Math.min(1, b + 0.08)));
  return ease.out(norm(p, a, Math.min(b, a + 0.06)));
}

/**
 * Reward for slowing down. Ramps in after most of a second of stillness and
 * decays as soon as the visitor moves, so secondary geometry is genuinely
 * discovered rather than merely delayed.
 */
export function curiosity() {
  return ease.out(clamp01((state.dwell - 0.7) / 2.1));
}

/** 0..1 how far past comfortable reading speed the visitor is travelling. */
export const urgency = () => clamp01(state.speed * 1.9);

/**
 * True on the handheld edit. Mobile is a separate cut, not a scaled layout:
 * laws use this to drop secondary layers rather than to shrink them, because a
 * small frame cannot hold three simultaneous movements legibly.
 */
export const hand = () => state.edit === 'hand';

// ── Placement ───────────────────────────────────────────────────────────────

export function aim(i, x, y, z) {
  R.tx[i] = x;
  R.ty[i] = y;
  R.tz[i] = z;
}

/** Blend a node's target toward a point. Lets laws layer two formations. */
export function aimToward(i, x, y, z, k) {
  R.tx[i] += (x - R.tx[i]) * k;
  R.ty[i] += (y - R.ty[i]) * k;
  R.tz[i] += (z - R.tz[i]) * k;
}

/** Per-node heat approach, framerate independent. Colour is a state signal. */
export function warm(i, v, rate, dt) {
  R.heat[i] += (v - R.heat[i]) * (1 - Math.pow(1 - rate, dt * 60));
}

/** Snap a node's position and kill its velocity. Use only on hard cuts. */
export function place(i, x, y, z) {
  R.x[i] = x;
  R.y[i] = y;
  R.z[i] = z;
  R.vx[i] = R.vy[i] = R.vz[i] = 0;
}

// ── Rotation ────────────────────────────────────────────────────────────────

/** Scratch vector. Reused; never retain a reference. */
export const V = { x: 0, y: 0, z: 0 };

export function rotY(x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  V.x = x * c + z * s;
  V.y = y;
  V.z = -x * s + z * c;
  return V;
}

export function rotX(x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  V.x = x;
  V.y = y * c - z * s;
  V.z = y * s + z * c;
  return V;
}

export function rotZ(x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  V.x = x * c - y * s;
  V.y = x * s + y * c;
  V.z = z;
  return V;
}

// ── Topology ────────────────────────────────────────────────────────────────

/**
 * k-nearest neighbours over the register's rest sphere, computed once and
 * cached. Because rest positions are immutable, this table is a permanent
 * property of the entity: the cage it forms in ORIGIN is the same cage that
 * reappears in REBUILD, which is a large part of why the object reads as one
 * thing across the whole film.
 */
const knnCache = new Map();

export function knn(k) {
  const hit = knnCache.get(k);
  if (hit) return hit;

  const out = new Int16Array(R.N * k);
  const d = new Float32Array(R.N);
  const idx = new Int16Array(R.N);

  for (let i = 0; i < R.N; i++) {
    for (let j = 0; j < R.N; j++) {
      const dx = R.restX[j] - R.restX[i];
      const dy = R.restY[j] - R.restY[i];
      const dz = R.restZ[j] - R.restZ[i];
      d[j] = j === i ? Infinity : dx * dx + dy * dy + dz * dz;
      idx[j] = j;
    }
    // Partial selection sort: k passes beats a full sort at these sizes.
    for (let s = 0; s < k; s++) {
      let best = s;
      for (let j = s + 1; j < R.N; j++) if (d[idx[j]] < d[idx[best]]) best = j;
      const t = idx[s];
      idx[s] = idx[best];
      idx[best] = t;
      out[i * k + s] = idx[s];
    }
  }

  knnCache.set(k, out);
  return out;
}

/**
 * Link every node to its k nearest, each undirected pair emitted once.
 * `gate(i)` may veto a node; `heatOf(i,j)` supplies link heat.
 */
export function cage(k, gate = null, heatOf = null) {
  const nb = knn(k);
  for (let i = 0; i < R.N; i++) {
    if (gate && !gate(i)) continue;
    for (let s = 0; s < k; s++) {
      const j = nb[i * k + s];
      if (j <= i) continue;
      if (gate && !gate(j)) continue;
      R.link(i, j, heatOf ? heatOf(i, j) : 0);
    }
  }
}

/** Close a loop through an ordered list of node indices. */
export function loop(indices, heat = 0, closed = true) {
  for (let n = 0; n < indices.length - (closed ? 0 : 1); n++) {
    R.link(indices[n], indices[(n + 1) % indices.length], heat);
  }
}

/** Chain an ordered list without closing it. */
export const chain = (indices, heat = 0) => loop(indices, heat, false);

// ── Formations ──────────────────────────────────────────────────────────────

/** Point on a circle in the XY plane. Writes into the scratch vector. */
export function onRing(t, radius, z = 0, phase = 0) {
  const a = t * TAU + phase;
  V.x = Math.cos(a) * radius;
  V.y = Math.sin(a) * radius;
  V.z = z;
  return V;
}

/** Point on the shared rest sphere, scaled. */
export function onSphere(i, radius) {
  V.x = R.restX[i] * radius;
  V.y = R.restY[i] * radius;
  V.z = R.restZ[i] * radius;
  return V;
}

/**
 * A three-dimensional integer lattice site for node `i`, given a box count per
 * axis and spacing. Deterministic, so ASSEMBLY seats the same node in the same
 * socket on every pass including the reverse one.
 */
export function latticeSite(i, nx, ny, nz, spacing) {
  const ix = i % nx;
  const iy = ((i / nx) | 0) % ny;
  const iz = (((i / (nx * ny)) | 0) % nz);
  V.x = (ix - (nx - 1) / 2) * spacing;
  V.y = (iy - (ny - 1) / 2) * spacing;
  V.z = (iz - (nz - 1) / 2) * spacing;
  return V;
}

/** Golden-ratio spiral disc. Even areal density, no visible rings. */
export function onDisc(i, n, radius, z = 0) {
  const r = Math.sqrt((i + 0.5) / n) * radius;
  const a = i * 2.399963229728653;
  V.x = Math.cos(a) * r;
  V.y = Math.sin(a) * r;
  V.z = z;
  return V;
}

// ── Partitioning ────────────────────────────────────────────────────────────

/**
 * Assign integer roles by contiguous share of the register. Laws call this in
 * `enter` so role membership is stable for the whole movement.
 */
export function partition(counts) {
  let cursor = 0;
  for (let role = 0; role < counts.length; role++) {
    const end = Math.min(R.N, cursor + counts[role]);
    for (let i = cursor; i < end; i++) R.role[i] = role;
    cursor = end;
  }
  for (let i = cursor; i < R.N; i++) R.role[i] = counts.length - 1;
}

/** Deterministic per-node pick in [0,n). Stable across loads and reversals. */
export const bucket = (i, n) => Math.min(n - 1, (R.seed[i] * n) | 0);

// ── The set frame ───────────────────────────────────────────────────────────

/*
 * The camera path is chained and never cuts, so it travels thousands of units
 * along −Z across the film. Laws therefore express everything in the local
 * frame of the current movement's set and let these wrappers translate into
 * world space. A law that used world coordinates directly would build its scene
 * somewhere the camera has long since left.
 */

/** Local-space target. */
export function aimAt(i, lx, ly, lz) {
  R.tx[i] = lx + SET.x;
  R.ty[i] = ly + SET.y;
  R.tz[i] = lz + SET.z;
}

/** Local-space hard placement. Kills velocity; use only on true cuts. */
export function placeAt(i, lx, ly, lz) {
  place(i, lx + SET.x, ly + SET.y, lz + SET.z);
}

/** Read a node's position back in local coordinates. */
export function localOf(i) {
  V.x = R.x[i] - SET.x;
  V.y = R.y[i] - SET.y;
  V.z = R.z[i] - SET.z;
  return V;
}

export const lline = (x1, y1, z1, x2, y2, z2, h, a, w) =>
  line3(x1 + SET.x, y1 + SET.y, z1 + SET.z, x2 + SET.x, y2 + SET.y, z2 + SET.z, h, a, w);

export const lrect = (cx, cy, cz, w, h, heat, a, lw) =>
  rect3(cx + SET.x, cy + SET.y, cz + SET.z, w, h, heat, a, lw);

export const lring = (cx, cy, cz, r, heat, a, lw, seg, from, to_) =>
  ring3(cx + SET.x, cy + SET.y, cz + SET.z, r, heat, a, lw, seg, from, to_);

export const llabel = (x, y, z, text, heat, a, px, align, mono, maxPx) =>
  label3(x + SET.x, y + SET.y, z + SET.z, text, heat, a, px, align, mono, maxPx);

/** Scratch buffer so translating a polyline never allocates in the hot path. */
let pathScratch = new Float32Array(256 * 3);

function translated(pts) {
  if (pathScratch.length < pts.length) pathScratch = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    pathScratch[i] = pts[i] + SET.x;
    pathScratch[i + 1] = pts[i + 1] + SET.y;
    pathScratch[i + 2] = pts[i + 2] + SET.z;
  }
  return pathScratch.subarray(0, pts.length);
}

export const lpath = (pts, heat, a, w) => path3(translated(pts), heat, a, w);
export const lquad = (pts, heat, a) => quad3(translated(pts), heat, a);

export { R, fibSphere, clamp, clamp01, lerp, norm, ease, TAU, SET };
