/**
 * World renderer.
 *
 * Draws into an offscreen 2D canvas which the lens then treats as a negative.
 * Canvas 2D rather than WebGL for the world itself is a deliberate choice: the
 * aesthetic is machined line work — hairlines, exact rectangles, tabular
 * metadata — and 2D gives that precision for free while WebGL would fight it.
 *
 * Two rules govern everything here:
 *   Colour is a state signal. Inert geometry is monochrome; only what is
 *   active, changing or important is allowed to be orange.
 *   Depth of field is physical. Out-of-focus points grow and soften into a
 *   circle of confusion rather than simply fading.
 *
 * There is no string allocation in the hot path. Colours come from a
 * precomputed lookup table and soft discs come from pre-rendered sprites, so a
 * frame drawing 256 nodes and several hundred links allocates nothing.
 */

import { state } from '../core/state.js';
import { clamp, clamp01, lerp } from '../core/math.js';
import { cam, project, proj, setViewScale, getViewScale } from './camera.js';
import * as R from '../entity/register.js';

export const PALETTE = {
  void: '#06070a',
  graphite: '#14161a',
  steelDark: '#2b3037',
  steel: '#575f69',
  steelLit: '#98a1ab',
  offwhite: '#e9e7e2',
  orange: [255, 77, 10],
  orangeHot: [255, 168, 108],
  steelRGB: [140, 152, 165],
};

export const FONT = {
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  grotesque:
    '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, "Segoe UI", system-ui, sans-serif',
};

export let canvas = null;
export let ctx = null;
let W = 0,
  H = 0,
  CX = 0,
  CY = 0,
  DPR = 1;

// ── Colour lookup ───────────────────────────────────────────────────────────
// 16 heat steps × 16 alpha steps, built once. Indexing a table is measurably
// cheaper than template-string concatenation at this call volume.

const HEAT_STEPS = 16;
const ALPHA_STEPS = 16;
const COLOR_LUT = new Array(HEAT_STEPS * ALPHA_STEPS);

(function buildLut() {
  const [sr, sg, sb] = PALETTE.steelRGB;
  const [or_, og, ob] = PALETTE.orange;
  const [hr, hg, hb] = PALETTE.orangeHot;
  for (let h = 0; h < HEAT_STEPS; h++) {
    const t = h / (HEAT_STEPS - 1);
    // Steel → orange → hot core. The second leg only engages above 0.7 so
    // mid-heat never reads as a wash of peach.
    let r, g, b;
    if (t < 0.7) {
      const k = t / 0.7;
      r = lerp(sr, or_, k);
      g = lerp(sg, og, k);
      b = lerp(sb, ob, k);
    } else {
      const k = (t - 0.7) / 0.3;
      r = lerp(or_, hr, k);
      g = lerp(og, hg, k);
      b = lerp(ob, hb, k);
    }
    r = r | 0;
    g = g | 0;
    b = b | 0;
    for (let a = 0; a < ALPHA_STEPS; a++) {
      COLOR_LUT[h * ALPHA_STEPS + a] = `rgba(${r},${g},${b},${(a / (ALPHA_STEPS - 1)).toFixed(3)})`;
    }
  }
})();

function colour(heat, alpha) {
  const h = (clamp01(heat) * (HEAT_STEPS - 1) + 0.5) | 0;
  const a = (clamp01(alpha) * (ALPHA_STEPS - 1) + 0.5) | 0;
  return COLOR_LUT[h * ALPHA_STEPS + a];
}

// ── Soft-disc sprites ───────────────────────────────────────────────────────
// Six softness levels per colour, pre-rendered. Out-of-focus nodes composite
// two sprites weighted by heat instead of building a radial gradient per node.

const SPRITE_LEVELS = 6;
const SPRITE_SIZE = 64;
const spritesSteel = [];
const spritesOrange = [];

function buildSprites() {
  spritesSteel.length = 0;
  spritesOrange.length = 0;
  for (let l = 0; l < SPRITE_LEVELS; l++) {
    // level 0 is nearly hard-edged; level 5 is a wide, flat bokeh disc.
    const soft = 0.12 + (l / (SPRITE_LEVELS - 1)) * 0.85;
    for (const [store, rgb] of [
      [spritesSteel, PALETTE.steelRGB],
      [spritesOrange, PALETTE.orange],
    ]) {
      const c = document.createElement('canvas');
      c.width = c.height = SPRITE_SIZE;
      const g = c.getContext('2d');
      const r = SPRITE_SIZE / 2;
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      const [rr, gg, bb] = rgb;
      grad.addColorStop(0, `rgba(${rr},${gg},${bb},1)`);
      grad.addColorStop(clamp(1 - soft, 0.02, 0.98), `rgba(${rr},${gg},${bb},0.72)`);
      grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      store.push(c);
    }
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────

export function init(target) {
  canvas = target || document.createElement('canvas');
  ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  buildSprites();
  resize();
  return canvas;
}

/**
 * Ceiling on the device pixel ratio. Lowered by the boot quality governor if
 * the frame budget is missed: complexity is allowed, waste is not.
 */
let dprCap = 2;

export function setDprCap(v) {
  dprCap = Math.max(0.75, v);
}

export const getDprCap = () => dprCap;

export function resize() {
  // Beyond 2 the extra fill rate buys nothing at this line weight and costs a
  // great deal on a laptop GPU.
  DPR = Math.min(window.devicePixelRatio || 1, dprCap);
  W = Math.round(state.viewportW * DPR);
  H = Math.round(state.viewportH * DPR);
  canvas.width = W;
  canvas.height = H;
  CX = W / 2;
  CY = H / 2;
  state.dpr = DPR;

  // World space is anchored to the frame's *shorter* axis: 1000 world units
  // spans it at the reference plane. Using the height alone would frame
  // correctly on a landscape desktop and then crop every horizontal
  // composition on a portrait phone, because the compositions here are wide.
  // Referencing the short axis keeps a scene safe in both orientations.
  setViewScale(Math.min(W, H) / 1000);

  // In-world metadata is set in CSS pixels, and 8px of it is unreadable on a
  // phone. The handheld edit reads the same information at a larger size.
  textScale = state.edit === 'hand' ? 1.45 : 1;
}

/** Multiplier on in-world type size. Larger on handheld. */
let textScale = 1;

export const metrics = () => ({ W, H, CX, CY, DPR });

/** Device pixels per world unit at the reference plane. */
export const unit = () => getViewScale();

/**
 * Diameter of a size-1 node, in world units. Nodes are specified in world
 * units rather than pixels so a node has a physical size in the space and
 * grows as the camera approaches it, which is the whole distinction between a
 * dolly and a scale.
 */
const NODE_WORLD = 2.6;

// ── Frame ───────────────────────────────────────────────────────────────────

export function clear() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, W, H);
  labelCount = 0;
}

// ── Label collision suppression ─────────────────────────────────────────────
/*
 * In-world metadata is positioned in three dimensions, so whether two labels
 * collide depends entirely on where the camera is — a composition that reads
 * perfectly on a wide frame can stack four labels on top of each other in
 * portrait. Rather than hand-tune every law for every viewport, a label that
 * would overlap one already drawn this frame is simply dropped.
 *
 * First-drawn wins, which is why laws draw their primary furniture before their
 * curiosity extras: under pressure the frame sheds the optional detail and keeps
 * the structural labels. This is also what makes the handheld edit legible
 * without a second set of layouts.
 */
const LABEL_CAP = 96;
const boxX0 = new Float32Array(LABEL_CAP);
const boxY0 = new Float32Array(LABEL_CAP);
const boxX1 = new Float32Array(LABEL_CAP);
const boxY1 = new Float32Array(LABEL_CAP);
let labelCount = 0;

function claim(x0, y0, x1, y1) {
  for (let i = 0; i < labelCount; i++) {
    if (x0 < boxX1[i] && x1 > boxX0[i] && y0 < boxY1[i] && y1 > boxY0[i]) return false;
  }
  if (labelCount < LABEL_CAP) {
    boxX0[labelCount] = x0;
    boxY0[labelCount] = y0;
    boxX1[labelCount] = x1;
    boxY1[labelCount] = y1;
    labelCount++;
  }
  return true;
}

// ── Primitives available to laws ────────────────────────────────────────────

const A = { sx: 0, sy: 0, scale: 0, depth: 0, ok: false };

/** Project a world point, copying out of the shared scratch. */
export function to(wx, wy, wz, out = A) {
  const p = project(wx, wy, wz, CX, CY);
  out.sx = p.sx;
  out.sy = p.sy;
  out.scale = p.scale;
  out.depth = p.depth;
  out.ok = p.ok;
  return out;
}

const L1 = { sx: 0, sy: 0, scale: 0, depth: 0, ok: false };
const L2 = { sx: 0, sy: 0, scale: 0, depth: 0, ok: false };

/** A hairline in world space. Width is in device pixels, not world units. */
export function line3(x1, y1, z1, x2, y2, z2, heat = 0, alpha = 0.5, width = 1) {
  to(x1, y1, z1, L1);
  to(x2, y2, z2, L2);
  if (!L1.ok || !L2.ok) return;
  ctx.strokeStyle = colour(heat, alpha);
  ctx.lineWidth = width * DPR;
  ctx.beginPath();
  ctx.moveTo(L1.sx, L1.sy);
  ctx.lineTo(L2.sx, L2.sy);
  ctx.stroke();
}

/** Open polyline through an array of [x,y,z] triples flattened. */
export function path3(pts, heat = 0, alpha = 0.5, width = 1) {
  ctx.strokeStyle = colour(heat, alpha);
  ctx.lineWidth = width * DPR;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < pts.length; i += 3) {
    to(pts[i], pts[i + 1], pts[i + 2], L1);
    if (!L1.ok) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(L1.sx, L1.sy);
      started = true;
    } else {
      ctx.lineTo(L1.sx, L1.sy);
    }
  }
  ctx.stroke();
}

/** Axis-aligned rectangle on the XY plane at depth z. Architectural. */
export function rect3(cx, cy, cz, w, h, heat = 0, alpha = 0.4, width = 1) {
  const hw = w / 2,
    hh = h / 2;
  line3(cx - hw, cy - hh, cz, cx + hw, cy - hh, cz, heat, alpha, width);
  line3(cx + hw, cy - hh, cz, cx + hw, cy + hh, cz, heat, alpha, width);
  line3(cx + hw, cy + hh, cz, cx - hw, cy + hh, cz, heat, alpha, width);
  line3(cx - hw, cy + hh, cz, cx - hw, cy - hh, cz, heat, alpha, width);
}

/** Ring on the XY plane. `seg` low enough to read as machined, not smooth. */
export function ring3(cx, cy, cz, r, heat = 0, alpha = 0.4, width = 1, seg = 48, from = 0, to_ = Math.PI * 2) {
  ctx.strokeStyle = colour(heat, alpha);
  ctx.lineWidth = width * DPR;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= seg; i++) {
    const a = from + ((to_ - from) * i) / seg;
    to(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz, L1);
    if (!L1.ok) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(L1.sx, L1.sy);
      started = true;
    } else ctx.lineTo(L1.sx, L1.sy);
  }
  ctx.stroke();
}

/** Filled quad. Used sparingly — solid fills read as mass. */
export function quad3(pts, heat, alpha) {
  ctx.fillStyle = colour(heat, alpha);
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 3) {
    to(pts[i], pts[i + 1], pts[i + 2], L1);
    if (!L1.ok) return;
    if (i === 0) ctx.moveTo(L1.sx, L1.sy);
    else ctx.lineTo(L1.sx, L1.sy);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Metadata positioned in the world. Size is specified in device pixels at the
 * subject plane and then scaled by perspective, so labels belong to the space
 * instead of floating on the glass.
 */
/**
 * Metadata positioned in the world. Size is specified in CSS pixels at the
 * reference plane and then scaled by perspective, so labels belong to the space
 * instead of floating on the glass.
 *
 * The cap matters more than it looks: without it, a label on a node passing
 * close to the lens becomes a headline, and this typography is explicitly not
 * the spectacle. Text that falls below legibility is dropped rather than drawn
 * as mush. A law that genuinely wants display type must ask for it via `maxPx`.
 */
export function label3(
  wx,
  wy,
  wz,
  text,
  heat = 0,
  alpha = 0.7,
  px = 10,
  align = 'left',
  mono = true,
  maxPx = 19
) {
  to(wx, wy, wz, L1);
  if (!L1.ok) return;
  const raw = (L1.scale / getViewScale()) * px * textScale * DPR;
  if (raw < 6.2 * DPR) return;
  const s = Math.min(raw, maxPx * textScale * DPR);
  ctx.font = `${mono ? '' : '600 '}${s.toFixed(1)}px ${mono ? FONT.mono : FONT.grotesque}`;

  // Reserve the space before committing ink, so a frame under pressure drops
  // whole labels rather than printing them across each other.
  const w = ctx.measureText(text).width;
  const pad = 3 * DPR;
  const x0 = align === 'center' ? L1.sx - w / 2 : align === 'right' ? L1.sx - w : L1.sx;
  if (!claim(x0 - pad, L1.sy - s * 0.62 - pad, x0 + w + pad, L1.sy + s * 0.62 + pad)) return;

  ctx.fillStyle = colour(heat, alpha);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, L1.sx, L1.sy);
}

/** Screen-space rule. For frame furniture that must not move with the camera. */
export function screenLine(x1, y1, x2, y2, heat = 0, alpha = 0.3, width = 1) {
  ctx.strokeStyle = colour(heat, alpha);
  ctx.lineWidth = width * DPR;
  ctx.beginPath();
  ctx.moveTo(x1 * W, y1 * H);
  ctx.lineTo(x2 * W, y2 * H);
  ctx.stroke();
}

// ── The register ────────────────────────────────────────────────────────────

const order = new Array(R.N);
for (let i = 0; i < R.N; i++) order[i] = i;

const sx = new Float32Array(R.N);
const sy = new Float32Array(R.N);
const ss = new Float32Array(R.N);
const sd = new Float32Array(R.N);
const sb = new Float32Array(R.N);
const sok = new Uint8Array(R.N);

/**
 * Project every node once, sort back-to-front, then draw links and nodes.
 * Projection is cached in typed arrays so links do not re-project endpoints.
 */
export function drawRegister(opts = {}) {
  const linkAlpha = opts.linkAlpha ?? 1;
  const nodeAlpha = opts.nodeAlpha ?? 1;
  const streaks = opts.streaks ?? true;

  for (let i = 0; i < R.N; i++) {
    const p = project(R.x[i], R.y[i], R.z[i], CX, CY);
    sok[i] = p.ok ? 1 : 0;
    if (!p.ok) continue;
    sx[i] = p.sx;
    sy[i] = p.sy;
    ss[i] = p.scale;
    sd[i] = p.depth;
    sb[i] = p.blur;
  }

  // Links first so nodes sit on top of their own connections.
  const lc = R.getLinkCount();
  if (lc > 0 && linkAlpha > 0) {
    ctx.lineWidth = Math.max(0.6, 0.75 * DPR);
    for (let k = 0; k < lc; k++) {
      const a = R.linkA[k],
        b = R.linkB[k];
      if (!sok[a] || !sok[b]) continue;
      const life = Math.min(R.alive[a], R.alive[b]);
      if (life < 0.04) continue;
      // Long links are dimmed: a connection stretched across the frame is
      // usually a projection artefact rather than a real relationship.
      const dx = sx[b] - sx[a],
        dy = sy[b] - sy[a];
      const len = Math.sqrt(dx * dx + dy * dy);
      const reach = clamp01(1 - len / (Math.min(W, H) * 0.85));
      const h = R.linkHeat[k] > 0 ? R.linkHeat[k] : Math.min(R.heat[a], R.heat[b]) * 0.7;
      const a2 = 0.42 * reach * life * linkAlpha * (0.35 + h * 0.65);
      if (a2 < 0.012) continue;
      ctx.strokeStyle = colour(h, a2);
      ctx.beginPath();
      ctx.moveTo(sx[a], sy[a]);
      ctx.lineTo(sx[b], sy[b]);
      ctx.stroke();
    }
  }

  order.sort((a, b) => sd[b] - sd[a]);

  for (let n = 0; n < R.N; n++) {
    const i = order[n];
    if (!sok[i]) continue;
    const life = R.alive[i];
    if (life < 0.03) continue;

    const h = R.heat[i];
    const blur = sb[i];
    // Size is physical: world units through perspective. The cap stops a node
    // passing close to the lens from swallowing the frame.
    const base = clamp(R.size[i] * NODE_WORLD * ss[i], 0.6 * DPR, 34 * DPR);

    if (blur < 0.09) {
      // In focus: a hard rectangle. Machined, not glowing.
      const s = Math.max(0.8 * DPR, base);
      ctx.fillStyle = colour(h, clamp01(0.55 + h * 0.45) * life * nodeAlpha);
      ctx.fillRect(sx[i] - s / 2, sy[i] - s / 2, s, s);
      // A hot node in focus gets a hairline cross: the only ornament in the
      // whole system, and it only appears on what matters most.
      if (h > 0.72) {
        const r = s * 2.6;
        ctx.strokeStyle = colour(h, 0.3 * life * nodeAlpha);
        ctx.lineWidth = 0.75 * DPR;
        ctx.beginPath();
        ctx.moveTo(sx[i] - r, sy[i]);
        ctx.lineTo(sx[i] + r, sy[i]);
        ctx.moveTo(sx[i], sy[i] - r);
        ctx.lineTo(sx[i], sy[i] + r);
        ctx.stroke();
      }
    } else {
      // Out of focus: a real circle of confusion. Grows and dims together.
      const lvl = Math.min(SPRITE_LEVELS - 1, (blur * SPRITE_LEVELS) | 0);
      const d = Math.max(2 * DPR, base * (1 + blur * 9));
      const a = clamp01((0.5 + h * 0.5) * (1 - blur * 0.62)) * life * nodeAlpha;
      ctx.globalAlpha = a * (1 - h);
      if (ctx.globalAlpha > 0.008) ctx.drawImage(spritesSteel[lvl], sx[i] - d / 2, sy[i] - d / 2, d, d);
      ctx.globalAlpha = a * h;
      if (ctx.globalAlpha > 0.008) ctx.drawImage(spritesOrange[lvl], sx[i] - d / 2, sy[i] - d / 2, d, d);
      ctx.globalAlpha = 1;
    }

    // Motion streak. Only for fast, in-focus, hot nodes, so it reads as an
    // event rather than as a permanent trail effect.
    if (streaks && blur < 0.35 && h > 0.25) {
      const sp = R.nodeSpeed(i);
      if (sp > 120) {
        ctx.strokeStyle = colour(h, clamp01(sp / 3200) * 0.34 * life);
        ctx.lineWidth = Math.max(0.7, base * 0.42);
        ctx.beginPath();
        ctx.moveTo(sx[i], sy[i]);
        // Trail length is the distance the node covered in the last ~26 ms.
        ctx.lineTo(sx[i] - R.vx[i] * ss[i] * 0.026, sy[i] + R.vy[i] * ss[i] * 0.026);
        ctx.stroke();
      }
    }
  }
}

export { colour };
