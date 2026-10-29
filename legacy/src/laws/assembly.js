/**
 * MOVEMENT 02 — ASSEMBLY
 *
 * The scattered field becomes a structure. 8 × 8 × 4 is 256 exactly, so the
 * register maps onto a complete three-dimensional lattice with no node left
 * over and no socket left empty — which is the whole argument of the movement
 * stated in arithmetic.
 *
 * Two decisions carry this scene.
 *
 * The assembly is sequential and mechanical: columns seat left to right behind
 * a gantry, and a node does not travel to its socket because something
 * interpolated its position — it travels because its grip rises when its turn
 * comes, and the shared integrator does the rest. The motion is therefore
 * genuinely physical, and running the scroll backwards genuinely disassembles.
 *
 * Heat is derived from node speed rather than scripted. A node in transit is
 * changing, so it is orange; a node seated in its socket is finished, so it is
 * steel. That is the colour rule of the whole piece expressed as a formula
 * instead of a keyframe, and it reverses for free.
 *
 * Links only exist between seated nodes, so the structure visibly wires itself
 * as it completes. The link readout climbing from zero to 640 is the movement's
 * plot.
 */

import { ease, lerp, clamp01, hash01, fbm3 } from '../core/math.js';
import { state } from '../core/state.js';
import * as R from '../entity/register.js';
import { sub, curiosity, aimAt, warm, holdAmount, lline, llabel, SET } from './kit.js';
import { PROCESS } from '../content/work.js';

const NX = 8;
const NY = 8;
const NZ = 4;
const SPACING = 92;

const HALF_W = ((NX - 1) * SPACING) / 2;
const HALF_H = ((NY - 1) * SPACING) / 2;
const HALF_D = ((NZ - 1) * SPACING) / 2;

/**
 * A fixed yaw and pitch on the lattice. Nothing here animates its rotation —
 * the structure is bolted down, and the camera's lateral travel is what reveals
 * it. The angle exists only so the frame reads three-dimensionally.
 */
const YAW = 0.34;
const PITCH = 0.13;
const CY = Math.cos(YAW);
const SY = Math.sin(YAW);
const CP = Math.cos(PITCH);
const SP = Math.sin(PITCH);

const PA = [0, 0, 0];
const PB = [0, 0, 0];

function xf(out, x, y, z) {
  const x1 = x * CY + z * SY;
  const z1 = -x * SY + z * CY;
  out[0] = x1;
  out[1] = y * CP - z1 * SP;
  out[2] = y * SP + z1 * CP;
  return out;
}

/** Line in the lattice's own frame. */
function LN(ax, ay, az, bx, by, bz, h, a, w) {
  xf(PA, ax, ay, az);
  xf(PB, bx, by, bz);
  lline(PA[0], PA[1], PA[2], PB[0], PB[1], PB[2], h, a, w);
}

/** Label in the lattice's own frame. */
function LB(x, y, z, t, h, a, px, al) {
  xf(PA, x, y, z);
  llabel(PA[0], PA[1], PA[2], t, h, a, px, al);
}

/** How far each node has travelled into its socket, this frame. */
const seated = new Float32Array(R.N);

/** Staging scatter, so nodes wait in a loose cloud rather than in a queue. */
const sx = new Float32Array(R.N);
const sy = new Float32Array(R.N);
const sz = new Float32Array(R.N);

let buildFront = 0;

export default {
  id: 'assembly',

  enter() {
    for (let i = 0; i < R.N; i++) {
      sx[i] = (hash01(i * 6151 + 13) - 0.5) * 1500;
      sy[i] = (hash01(i * 24593 + 29) - 0.5) * 900;
      sz[i] = (hash01(i * 49157 + 47) - 0.5) * 900;
      R.role[i] = i % NX;
      R.alive[i] = 1;
    }
  },

  field(p, dt) {
    // Stiff and heavily damped: a mechanical seat with no bounce. Physical UI
    // gets a spring; a machined socket does not.
    R.physics.stiffness = 34;
    R.physics.damping = 0.8;

    // Linear, because this is system movement rather than an arrival. Machines
    // do not accelerate into their work.
    const build = sub(p, 0.06, 0.7);
    buildFront = build;

    const drift = state.time * 0.05;

    for (let i = 0; i < R.N; i++) {
      const ix = i % NX;
      const iy = ((i / NX) | 0) % NY;
      const iz = (i / (NX * NY)) | 0;

      // Column-ordered stagger. Every column overlaps its neighbour, so the
      // structure grows as a moving front rather than in discrete blocks.
      const s = clamp01((build - (ix / (NX - 1)) * 0.6) / 0.4);
      const seat = ease.seat(s);
      seated[i] = s;

      const lx = (ix - (NX - 1) / 2) * SPACING;
      const ly = (iy - (NY - 1) / 2) * SPACING;
      const lz = (iz - (NZ - 1) / 2) * SPACING;
      xf(PA, lx, ly, lz);

      // Waiting position: still drifting, still unresolved.
      const wx = sx[i] + fbm3(sx[i] * 0.001, drift, sz[i] * 0.001, 2) * 60;
      const wy = sy[i] + fbm3(drift, sy[i] * 0.001, 3.1, 2) * 44;
      const wz = sz[i];

      aimAt(i, lerp(wx, PA[0], seat), lerp(wy, PA[1], seat), lerp(wz, PA[2], seat));

      // Grip rises as the node commits, so the last stretch into the socket is
      // fast and final while the wait stays loose.
      R.grip[i] = lerp(0.14, 1.5, seat);
      R.size[i] = lerp(0.85, 1.05, seat);

      // Colour derived from state, not from a keyframe: in transit is changing,
      // seated is finished. The seating term guarantees the signal lands even
      // for a visitor moving slowly enough that node speed stays low, and both
      // terms are functions of progress, so the reverse pass reverses too.
      const moving = clamp01(R.nodeSpeed(i) / 820);
      const transiting = ease.breathe(s) * 0.6;
      warm(i, 0.03 + Math.max(moving * 0.88, transiting), 0.14, dt);
    }

    // ── Lattice edges ───────────────────────────────────────────────────────
    // Emitted only between nodes that have both arrived. The structure wires
    // itself; nothing is ever drawn stretching to a socket that is still empty.
    const LOCKED = 0.92;
    for (let i = 0; i < R.N; i++) {
      if (seated[i] < LOCKED) continue;
      const ix = i % NX;
      const iy = ((i / NX) | 0) % NY;

      if (ix < NX - 1 && seated[i + 1] >= LOCKED) R.link(i, i + 1, 0);
      if (iy < NY - 1 && seated[i + NX] >= LOCKED) R.link(i, i + NX, 0);
      if (i < NX * NY * (NZ - 1) && seated[i + NX * NY] >= LOCKED) R.link(i, i + NX * NY, 0);
    }
  },

  stage(p) {
    const c = curiosity();
    const hold = holdAmount(p, { hold: [0.66, 0.84] });
    const build = buildFront;

    // ── Floor ───────────────────────────────────────────────────────────────
    // A ground plane the structure stands on. Without it the lattice floats and
    // the scene stops being architecture.
    const fy = -HALF_H - 128;
    const gw = HALF_W + 260;
    const gd = HALF_D + 340;
    for (let g = -4; g <= 4; g++) {
      const t = g / 4;
      const a = 0.1 * (1 - Math.abs(t) * 0.55);
      LN(-gw, fy, t * gd, gw, fy, t * gd, 0, a, 1);
      LN(t * gw, fy, -gd, t * gw, fy, gd, 0, a * 0.7, 1);
    }

    // ── Gantry ──────────────────────────────────────────────────────────────
    // The machine doing the work. It travels with the build front and leaves
    // once the structure is complete, which is why the assembly reads as
    // something being done rather than something appearing. Corner brackets
    // carry the weight; full members would compete with the lattice itself.
    if (build > 0.001 && build < 0.999) {
      const gx = lerp(-HALF_W - 60, HALF_W + 60, build);
      const gh = HALF_H + 54;
      const gz = HALF_D + 38;
      const br = 62;

      for (let s = 0; s < 4; s++) {
        const sy2 = s < 2 ? 1 : -1;
        const sz2 = s % 2 === 0 ? 1 : -1;
        LN(gx, sy2 * gh, sz2 * gz, gx, sy2 * (gh - br), sz2 * gz, 0.95, 0.6, 1);
        LN(gx, sy2 * gh, sz2 * gz, gx, sy2 * gh, sz2 * (gz - br * 0.55), 0.95, 0.6, 1);
      }
      // Faint full frame behind the brackets, so the plane is still readable.
      LN(gx, -gh, -gz, gx, gh, -gz, 0.95, 0.12, 1);
      LN(gx, -gh, gz, gx, gh, gz, 0.95, 0.12, 1);
      LN(gx, gh, -gz, gx, gh, gz, 0.95, 0.1, 1);
      LN(gx, -gh, -gz, gx, -gh, gz, 0.95, 0.1, 1);

      // Travel rails, so the gantry is clearly constrained to one axis.
      LN(-HALF_W - 60, -gh, -gz, HALF_W + 60, -gh, -gz, 0, 0.13, 1);

      LB(
        gx,
        gh + 26,
        -gz,
        `BAY ${String(1 + Math.min(NX - 1, (build * NX) | 0)).padStart(2, '0')}`,
        0.95,
        0.8,
        9,
        'center'
      );
    }

    // ── Process ─────────────────────────────────────────────────────────────
    // The six stages are revealed under the structure as the build passes them.
    // This is the actual sequence the work follows, and it is the reason the
    // movement is called ASSEMBLY rather than CONSTRUCTION.
    for (let s = 0; s < PROCESS.length; s++) {
      const t = s / (PROCESS.length - 1);
      const reveal = clamp01((build - t * 0.72) / 0.16);
      if (reveal < 0.02) continue;
      const x = lerp(-HALF_W, HALF_W, t);
      const yl = fy + 42;
      LN(x, yl, gd * 0.2, x, yl + 22 * reveal, gd * 0.2, 0.9, reveal * 0.3, 1);
      LB(x, yl - 16, gd * 0.2, PROCESS[s], 0, reveal * 0.75, 9, 'center');
    }

    // ── Dimensions ──────────────────────────────────────────────────────────
    // The reward for standing still: the structure states its own size and
    // count. Real numbers, derived from the lattice rather than written down.
    if (c > 0.03) {
      const a = c * 0.34;
      const oy = HALF_H + 44;
      LN(-HALF_W, oy, 0, HALF_W, oy, 0, 0, a * 0.6, 1);
      LN(-HALF_W, oy - 8, 0, -HALF_W, oy + 8, 0, 0, a * 0.8, 1);
      LN(HALF_W, oy - 8, 0, HALF_W, oy + 8, 0, 0, a * 0.8, 1);
      LB(0, oy + 22, 0, `${NX} × ${NY} × ${NZ} = ${NX * NY * NZ}`, 0, a * 2.1, 10, 'center');
      LB(-HALF_W, oy + 22, 0, `PITCH ${SPACING}`, 0, a * 1.4, 8, 'left');

      // Column numbering along the base. Tabular metadata, not decoration.
      for (let ix = 0; ix < NX; ix++) {
        const x = (ix - (NX - 1) / 2) * SPACING;
        LB(x, -HALF_H - 46, HALF_D, String(ix + 1).padStart(2, '0'), 0, a * 1.1, 8, 'center');
      }
    }

    // ── Hold ────────────────────────────────────────────────────────────────
    // One sentence, once the structure is standing and the frame has settled.
    if (hold > 0.05 && build > 0.98) {
      LB(0, -HALF_H - 210, 0, 'CHAOS BECOMES A SYSTEM', 0, hold * 0.5, 11, 'center');
    }
  },
};
