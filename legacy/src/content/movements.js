/**
 * The score sheet.
 *
 * Every movement declares its own scroll span, camera language, law, and the
 * exposure the lens should hold. Nothing about pacing lives anywhere else, so
 * the whole film can be re-cut from this one file.
 *
 * `span` is in viewport heights. Desktop and handheld are separate edits, not
 * a scaled version of each other — handheld gets shorter scenes and one
 * dominant movement rather than three simultaneous ones.
 *
 * Camera fields:
 *   dolly    z travel across the movement, in world units (− is toward viewer)
 *   lateral  x travel
 *   rise     y travel
 *   roll     radians of camera roll at the midpoint
 *   fov      focal length in world units; higher = longer lens = flatter
 *   drift    amplitude of idle camera drift; 0 is locked off
 *
 * Lens fields:
 *   exposure  multiplier on the composite
 *   lift      black level; > 0 washes, < 0 crushes
 *   grain     film grain intensity
 *   crush     anamorphic frame crush, 0 = full bleed, 1 = hard letterbox
 *
 * A movement's set sits one focal length in front of the midpoint of its
 * travel, so `dolly` and `fov` together decide how much the subject magnifies
 * across the scene. Keeping |dolly| under roughly a quarter of `fov` holds that
 * change near 1.3x, which reads as an approach; much beyond it and the subject
 * balloons and can no longer be framed. The two corridor movements — CHAOS and
 * AUTONOMY — are exempt, because their geometry spans the travel rather than
 * sitting in front of it.
 */

export const MOVEMENTS = [
  {
    id: 'origin',
    index: 0,
    name: 'ORIGIN',
    law: 'origin',
    span: { wide: 240, hand: 170 },
    // Very slow approach. Nothing else moves. The object's own expansion does
    // most of the growing; the lens only leans in.
    camera: { dolly: -220, lateral: 0, rise: 0, roll: 0, fov: 900, drift: 0.15 },
    lens: { exposure: 0.82, lift: -0.02, grain: 0.055, crush: 0.14 },
    hold: [0.55, 0.78],
    tone: { root: 55.0, density: 0.05, air: 0.2 },
  },
  {
    id: 'chaos',
    index: 1,
    name: 'CHAOS',
    law: 'chaos',
    span: { wide: 330, hand: 210 },
    // Spatial travel through depth layers.
    camera: { dolly: -2600, lateral: 180, rise: -60, roll: 0.05, fov: 620, drift: 0.9 },
    lens: { exposure: 1.0, lift: 0.015, grain: 0.085, crush: 0.0 },
    hold: [0.62, 0.72],
    tone: { root: 48.999, density: 0.55, air: 0.75 },
  },
  {
    id: 'assembly',
    index: 2,
    name: 'ASSEMBLY',
    law: 'assembly',
    span: { wide: 300, hand: 200 },
    // Dolly plus lateral. Mechanical. The assembly is the primary motion, so
    // the camera stays secondary — mostly a truck, only a light lean.
    camera: { dolly: -180, lateral: -420, rise: 40, roll: 0, fov: 760, drift: 0.25 },
    lens: { exposure: 0.96, lift: 0.0, grain: 0.06, crush: 0.05 },
    hold: [0.66, 0.84],
    tone: { root: 65.406, density: 0.4, air: 0.35 },
  },
  {
    id: 'commerce',
    index: 3,
    name: 'COMMERCE',
    law: 'commerce',
    span: { wide: 320, hand: 210 },
    // Deliberate, mechanical, no drift. A production line does not wander.
    camera: { dolly: -240, lateral: -900, rise: 0, roll: 0, fov: 880, drift: 0.0 },
    lens: { exposure: 1.02, lift: 0.005, grain: 0.05, crush: 0.09 },
    hold: [0.7, 0.86],
    tone: { root: 73.416, density: 0.5, air: 0.3 },
  },
  {
    id: 'intelligence',
    index: 4,
    name: 'INTELLIGENCE',
    law: 'intelligence',
    span: { wide: 320, hand: 210 },
    // Wide spatial movement. The width is entirely lateral and rise — driving
    // the lens into the field would magnify it instead of crossing it.
    camera: { dolly: -120, lateral: 540, rise: 220, roll: -0.04, fov: 700, drift: 0.5 },
    lens: { exposure: 0.98, lift: 0.01, grain: 0.06, crush: 0.0 },
    hold: [0.68, 0.85],
    tone: { root: 82.407, density: 0.45, air: 0.6 },
  },
  {
    id: 'trust',
    index: 5,
    name: 'TRUST',
    law: 'trust',
    span: { wide: 280, hand: 190 },
    // Almost static. Certainty after complexity.
    camera: { dolly: -60, lateral: 0, rise: 0, roll: 0, fov: 1050, drift: 0.02 },
    lens: { exposure: 1.06, lift: -0.03, grain: 0.035, crush: 0.18 },
    hold: [0.6, 0.9],
    tone: { root: 43.654, density: 0.18, air: 0.15 },
  },
  {
    id: 'autonomy',
    index: 6,
    name: 'AUTONOMY',
    law: 'autonomy',
    span: { wide: 340, hand: 215 },
    // Fast movement, strong depth response. Velocity drives tempo here.
    camera: { dolly: -1500, lateral: -300, rise: -120, roll: 0.07, fov: 600, drift: 0.7 },
    lens: { exposure: 1.0, lift: 0.0, grain: 0.075, crush: 0.0 },
    hold: [0.74, 0.86],
    tone: { root: 97.999, density: 0.7, air: 0.5 },
  },
  {
    id: 'people',
    index: 7,
    name: 'PEOPLE',
    law: 'people',
    span: { wide: 280, hand: 190 },
    // Observational rather than mechanical. Watching, not inspecting.
    camera: { dolly: -190, lateral: 260, rise: 90, roll: 0, fov: 820, drift: 0.45 },
    lens: { exposure: 1.0, lift: 0.02, grain: 0.05, crush: 0.0 },
    hold: [0.64, 0.84],
    tone: { root: 87.307, density: 0.42, air: 0.55 },
  },
  {
    id: 'failure',
    index: 8,
    name: 'FAILURE',
    law: 'failure',
    span: { wide: 260, hand: 180 },
    // Destabilised. The camera loses its footing slightly. Still the darkest
    // plate in the film, but the collapse has to remain legible — crushing it
    // further turns the emotional low point into an empty frame.
    camera: { dolly: 180, lateral: -80, rise: -240, roll: 0.14, fov: 660, drift: 1.4 },
    lens: { exposure: 0.88, lift: -0.015, grain: 0.13, crush: 0.3 },
    hold: [0.72, 0.9],
    tone: { root: 46.249, density: 0.08, air: 0.9 },
  },
  {
    id: 'rebuild',
    index: 9,
    name: 'REBUILD',
    law: 'rebuild',
    span: { wide: 300, hand: 200 },
    // Controlled pullback.
    camera: { dolly: 760, lateral: 0, rise: 60, roll: 0, fov: 800, drift: 0.2 },
    lens: { exposure: 1.0, lift: 0.0, grain: 0.055, crush: 0.06 },
    hold: [0.7, 0.88],
    tone: { root: 65.406, density: 0.6, air: 0.4 },
  },
  {
    id: 'current',
    index: 10,
    name: 'CURRENT BUILD',
    law: 'current',
    span: { wide: 260, hand: 180 },
    // Extremely slow pullback.
    camera: { dolly: 900, lateral: 40, rise: 30, roll: 0, fov: 860, drift: 0.1 },
    lens: { exposure: 1.02, lift: -0.01, grain: 0.045, crush: 0.1 },
    hold: [0.5, 0.86],
    tone: { root: 55.0, density: 0.3, air: 0.45 },
  },
  {
    id: 'unknown',
    index: 11,
    name: 'UNKNOWN',
    law: 'unknown',
    span: { wide: 360, hand: 240 },
    // Stillness. The long negative space is the point; do not fill it.
    camera: { dolly: 140, lateral: 0, rise: 0, roll: 0, fov: 980, drift: 0.05 },
    lens: { exposure: 0.9, lift: -0.02, grain: 0.04, crush: 0.22 },
    hold: [0.18, 0.62],
    tone: { root: 36.708, density: 0.04, air: 0.25 },
  },
  {
    id: 'terminus',
    index: 12,
    name: 'TERMINUS',
    law: 'terminus',
    span: { wide: 220, hand: 200 },
    camera: { dolly: -80, lateral: 0, rise: 0, roll: 0, fov: 1000, drift: 0.06 },
    lens: { exposure: 1.0, lift: 0.0, grain: 0.04, crush: 0.12 },
    hold: [0.3, 0.9],
    tone: { root: 55.0, density: 0.12, air: 0.3 },
  },
];

export const MOVEMENT_BY_ID = Object.fromEntries(MOVEMENTS.map((m) => [m.id, m]));

/**
 * Absolute scroll layout. Returns each movement's start/end in document
 * pixels plus the total document height, given a viewport height and edit.
 */
export function layout(viewportH, edit = 'wide') {
  let cursor = 0;
  const bands = MOVEMENTS.map((m) => {
    const height = (m.span[edit] / 100) * viewportH;
    const band = { id: m.id, index: m.index, start: cursor, height, end: cursor + height };
    cursor += height;
    return band;
  });
  return { bands, total: cursor };
}
