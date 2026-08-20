/**
 * Camera rig.
 *
 * A real dolly / truck / pedestal rig: the camera translates and rolls but
 * never yaws or pitches. That restriction is deliberate — it is the grammar of
 * a camera on rails rather than a video-game free-look, and it keeps every
 * movement legible as one deliberate gesture.
 *
 * The path is chained at layout time: each movement's declared travel becomes
 * a delta, and anchors accumulate, so the camera arrives at movement N+1
 * exactly where movement N left it. There is no cut anywhere in the film.
 *
 * Scale is separated from dolly on purpose. Enlarging a sprite is not the same
 * as moving a lens toward it; only the second changes the spatial relationship
 * between foreground and background, and that difference is the entire reason
 * the world reads as a place.
 */

import { MOVEMENTS } from '../content/movements.js';
import { state } from '../core/state.js';
import { clamp, clamp01, damp, lerp, smoothstep, noise3, norm } from '../core/math.js';

/** Live camera. Read by the world renderer every frame. */
export const cam = {
  x: 0,
  y: 0,
  z: 900,
  roll: 0,
  fov: 800,
  /** Distance in front of the camera that is perfectly sharp. */
  focus: 900,
  /** Depth of field aperture. Higher = shallower focus. */
  aperture: 0.55,
};

/** Impulse channels, decayed every frame. */
const shake = { x: 0, y: 0, roll: 0 };
let kick = 0;

const anchors = [];

(function chain() {
  let ax = 0,
    ay = 0,
    az = 900;
  for (let i = 0; i < MOVEMENTS.length; i++) {
    const c = MOVEMENTS[i].camera;
    // Anchor i carries movement i's own focal length, so a movement opens on
    // the lens it declared and transitions toward the next across its span.
    anchors.push({ x: ax, y: ay, z: az, fov: c.fov, roll: 0 });
    ax += c.lateral;
    ay += c.rise;
    az += c.dolly;
  }
  const tail = MOVEMENTS[MOVEMENTS.length - 1].camera.fov;
  anchors.push({ x: ax, y: ay, z: az, fov: tail, roll: 0 });
})();

/** Add a positional impulse. Used on hard narrative beats. */
export function impulse(amount) {
  kick = Math.max(kick, amount);
}

/**
 * The set.
 *
 * Because the camera path is chained and never cuts, the camera travels from
 * z = 900 at ORIGIN down past z = −5000 and back — so the world is a corridor,
 * not a stage. `set` is the world-space frame the current movement's geometry
 * should be built in, and laws place everything relative to it. Without this a
 * law would build at the world origin and the camera would simply have left.
 *
 *   x, y, z          centre of this movement's set
 *   spanX/Y/Z        how far the camera travels through it, signed
 *   near, far        the z range a corridor law should fill, so there is always
 *                    material ahead of the lens and some left behind it
 *   lNear, lFar      the same range expressed in the set's own local frame,
 *                    which is what corridor laws actually build against
 */
export const set = {
  x: 0,
  y: 0,
  z: 0,
  spanX: 0,
  spanY: 0,
  spanZ: 0,
  near: 0,
  far: 0,
  lNear: 0,
  lFar: 0,
};

function updateSet(m, a, b) {
  const fov = m.camera.fov;
  set.x = (a.x + b.x) / 2;
  set.y = (a.y + b.y) / 2;
  // One focal length in front of the midpoint of the travel: at the reference
  // plane the framing is exactly the declared world scale.
  set.z = (a.z + b.z) / 2 - fov;
  set.spanX = b.x - a.x;
  set.spanY = b.y - a.y;
  set.spanZ = b.z - a.z;
  set.near = a.z - fov * 0.35;
  set.far = b.z - fov * 1.5;
  set.lNear = set.near - set.z;
  set.lFar = set.far - set.z;
}

export function tick(dt) {
  const i = clamp(state.scene, 0, MOVEMENTS.length - 1);
  const m = MOVEMENTS[i];
  const a = anchors[i];
  const b = anchors[i + 1];

  updateSet(m, a, b);

  // Smoothstep rather than a strong in-out curve: gentle enough at the seams
  // that boundaries are not felt as stops, smooth enough to avoid a corner.
  const p = smoothstep(state.sceneProgress);

  let tzPos = lerp(a.z, b.z, p);
  let txPos = lerp(a.x, b.x, p);
  let tyPos = lerp(a.y, b.y, p);

  // The focal length holds for most of the movement and changes only near the
  // seam. Interpolating it across the whole span would make every movement a
  // continuous zoom, which is both a different gesture from the one declared
  // and a slow magnification creep the composition cannot be framed against.
  const tFov = lerp(a.fov, b.fov, smoothstep(norm(state.sceneProgress, 0.72, 1)));

  // Depth response to scroll velocity. The world pulls away as the visitor
  // accelerates, which is what makes speed feel like distance rather than
  // like a faster animation.
  const push = state.speed * state.speed * 420 * state.scrollDirection;
  tzPos += push;

  // Idle drift. Keeps the world alive without competing for attention.
  const d = m.camera.drift;
  if (d > 0) {
    const t = state.time * 0.055;
    txPos += noise3(t, 11.3, i * 3.7) * 44 * d;
    tyPos += noise3(t * 0.83, 27.1, i * 3.7) * 30 * d;
  }

  // Pointer parallax reads as looking around a still frame, so it is small,
  // slow, and never applied to the subject plane.
  txPos += state.pointerX * 26 * state.pointerActive;
  tyPos += state.pointerY * 18 * state.pointerActive;

  // Decay impulses.
  if (kick > 0) {
    shake.x += (Math.random() - 0.5) * kick;
    shake.y += (Math.random() - 0.5) * kick;
    shake.roll += (Math.random() - 0.5) * kick * 0.0012;
    kick *= Math.pow(0.02, dt);
    if (kick < 0.01) kick = 0;
  }
  shake.x = damp(shake.x, 0, 0.22, dt);
  shake.y = damp(shake.y, 0, 0.22, dt);
  shake.roll = damp(shake.roll, 0, 0.18, dt);

  // Medium friction on the camera. Heavier than type, lighter than background.
  cam.x = damp(cam.x, txPos, 0.075, dt) + shake.x;
  cam.y = damp(cam.y, tyPos, 0.075, dt) + shake.y;
  cam.z = damp(cam.z, tzPos, 0.09, dt);
  cam.fov = damp(cam.fov, tFov, 0.05, dt);

  // Roll peaks at the midpoint of a movement and returns to level.
  const rollTarget = Math.sin(p * Math.PI) * m.camera.roll + shake.roll;
  cam.roll = damp(cam.roll, rollTarget, 0.06, dt);

  // Focus tracks the plane the movement's set actually occupies, not the
  // camera's own coordinate — otherwise the subject would sit permanently in
  // front of the focal plane and never be sharp. The aperture stops down under
  // speed the way an operator would to hold focus through a fast move.
  const subjectDepth = cam.z - set.z;
  cam.focus = damp(cam.focus, subjectDepth, 0.1, dt);
  cam.aperture = damp(cam.aperture, 0.55 - state.speed * 0.3, 0.06, dt);
}

// ── Projection ──────────────────────────────────────────────────────────────

/** Scratch result. Reused every call; do not retain. */
export const proj = { sx: 0, sy: 0, scale: 0, depth: 0, blur: 0, ok: false };

const NEAR = 40;

/**
 * Device pixels per world unit at the reference plane, set by the renderer on
 * resize. World space is defined so that 1000 units spans the viewport height
 * at the reference plane, which makes every composition in the film
 * resolution-independent: the same numbers frame identically on a phone at
 * DPR 3 and an external display at DPR 1.
 */
let viewScale = 1;

export function setViewScale(v) {
  viewScale = Math.max(0.0001, v);
}

export const getViewScale = () => viewScale;

/**
 * Weak-perspective projection with roll, writing into the shared scratch.
 * `cx`/`cy` are the screen-space centre in device pixels.
 */
export function project(wx, wy, wz, cx, cy) {
  const dz = cam.z - wz;
  if (dz <= NEAR) {
    proj.ok = false;
    return proj;
  }
  const s = (cam.fov / dz) * viewScale;
  let px = (wx - cam.x) * s;
  let py = (wy - cam.y) * s;

  if (cam.roll !== 0) {
    const c = Math.cos(cam.roll),
      sn = Math.sin(cam.roll);
    const rx = px * c - py * sn;
    py = px * sn + py * c;
    px = rx;
  }

  proj.sx = cx + px;
  // Screen Y is inverted so positive world Y is up, as in every other tool.
  proj.sy = cy - py;
  proj.scale = s;
  proj.depth = dz;
  // Circle of confusion: grows with distance from the focal plane, which is
  // how out-of-focus points actually behave.
  proj.blur = clamp01((Math.abs(dz - cam.focus) / cam.focus) * cam.aperture * 1.8);
  proj.ok = true;
  return proj;
}

/** Reset to the opening frame. Used by RETURN. */
export function rewind() {
  cam.x = anchors[0].x;
  cam.y = anchors[0].y;
  cam.z = anchors[0].z;
  cam.fov = anchors[0].fov;
  cam.roll = 0;
  shake.x = shake.y = shake.roll = 0;
  kick = 0;
}

// A law's enter() may run before the first camera tick, so the set is valid
// from module load rather than from the first frame.
updateSet(MOVEMENTS[0], anchors[0], anchors[1]);
