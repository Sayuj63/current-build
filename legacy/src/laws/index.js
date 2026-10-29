/**
 * Law dispatch.
 *
 * The register is never swapped, so there is nothing here that creates or
 * destroys anything. Exactly one law is active, and a scene change simply hands
 * the same 256 nodes to a different set of intentions. Continuity is a
 * consequence of the shared integrator rather than of any cross-fade: momentum
 * survives the boundary, so the nodes are visibly *travelling* out of the old
 * formation and into the new one during the seam.
 *
 * Links and physics are reset every frame before the law runs. A law therefore
 * declares its topology from scratch each frame and cannot leak state into the
 * movement after it.
 */

import { state } from '../core/state.js';
import { MOVEMENTS } from '../content/movements.js';
import * as R from '../entity/register.js';
import { onSphere, aimAt, warm, clamp01 } from './kit.js';

import origin from './origin.js';
import chaos from './chaos.js';
import assembly from './assembly.js';
import commerce from './commerce.js';
import intelligence from './intelligence.js';
import trust from './trust.js';
import autonomy from './autonomy.js';
import people from './people.js';
import failure from './failure.js';
import rebuild from './rebuild.js';
import current from './current.js';
import unknown from './unknown.js';
import terminus from './terminus.js';

const REGISTRY = {
  origin,
  chaos,
  assembly,
  commerce,
  intelligence,
  trust,
  autonomy,
  people,
  failure,
  rebuild,
  current,
  unknown,
  terminus,
};

/**
 * Stand-in for movements that are not yet written. Holds the register in a
 * slow, inert sphere so the film remains navigable during production. Not
 * reachable once every law is present.
 */
const unwritten = {
  id: 'unwritten',
  field(p, dt) {
    R.physics.stiffness = 9;
    R.physics.damping = 0.9;
    for (let i = 0; i < R.N; i++) {
      const v = onSphere(i, 300);
      aimAt(i, v.x, v.y, v.z);
      R.grip[i] = 0.6;
      R.size[i] = 1;
      warm(i, 0.04, 0.02, dt);
    }
  },
};

let active = null;
let activeName = '';

/** Swap the governing law. `dir` is the direction of travel through the film. */
export function activate(id, dir = 1) {
  const next = REGISTRY[id] || unwritten;
  if (next === active) return;
  if (active && active.exit) active.exit(dir);
  active = next;
  // Reports what is actually running, not what was asked for. If a law is
  // missing, the readout must say `unwritten` rather than quietly claiming the
  // name of a law that never loaded.
  activeName = active.id;
  if (active.enter) active.enter(dir);
}

export function field(dt) {
  R.clearLinks();
  R.resetPhysics();
  if (!active) activate(state.sceneId, 1);
  active.field(state.sceneProgress, dt, MOVEMENTS[state.scene]);
}

/** Environment behind the register. */
export function stage() {
  if (active && active.stage) active.stage(state.sceneProgress, MOVEMENTS[state.scene]);
}

/** Furniture in front of the register. Used sparingly. */
export function overlay() {
  if (active && active.overlay) active.overlay(state.sceneProgress, MOVEMENTS[state.scene]);
}

export const activeId = () => activeName;
export const has = (id) => Boolean(REGISTRY[id]);
export { clamp01 };
