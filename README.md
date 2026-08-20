# CURRENT BUILD

An interactive system rather than a portfolio. The visitor operates it by
scrolling, and the same object is present in every frame from the first to the
last.

No framework, no build step, no dependencies. Plain ES modules, Canvas 2D and a
hand-written WebGL shader stack.

## Run it

```bash
python3 serve.py          # http://localhost:8181
```

A server is required because the project is ES modules — opening `index.html`
from the file system will not work. `serve.py` exists only to defeat caching, so
any static server will do.

## Before shipping

Two constants in `src/content/work.js` are placeholders. Until they are filled
in, the CONNECT and MESSAGE actions remove themselves rather than fail:

```js
export const IDENTITY = {
  linkedin: '',   // ← set this
  email: '',      // ← set this
};
```

## The idea

The recurring entity is exactly **256 nodes**, allocated once and never
destroyed. A movement does not replace the object — it replaces the *law*
governing it. So when the visitor crosses from CHAOS into ASSEMBLY, the
identical particles physically travel out of the noise field into the lattice,
because there is nothing else for them to do. Continuity is structural rather
than animated, which is why there is no cross-fade anywhere in the film.

256 is not decorative. It is the bit width of a SHA-256 digest, so:

- In **TRUST**, the register becomes a real digest of a manifest of real work —
  one node per bit, rendered as a relief, with the hex printed beside it. Hash
  the manifest yourself and you get the same string.
- In **UNKNOWN**, the visitor's own session — dwell per movement, peak velocity,
  direction reversals, how often they outran the system — is serialised and
  hashed, and those 256 bits are written onto the same 256 nodes. The closing
  object is a fingerprint of the visit, and it is downloadable as SVG with the
  payload embedded so it proves its own digest.

## Architecture

```
core/     math, state, clock, signal, session, sha256, boot, pointer
entity/   the register — 256 nodes, one integrator, never reset
render/   camera rig, Canvas 2D world, WebGL lens
laws/     one file per movement; each writes targets, never positions
ui/       hud, kinetic type, terminus actions
audio/    procedural score, no assets
content/  movements (the score sheet) and work (real material)
```

Three rules hold the thing together.

**One clock.** `core/clock.js` owns the only `requestAnimationFrame` in the
application. Every subsystem registers a tick and runs in a fixed priority
order: signal resolves before the world reads it, and the lens composites after
the world has drawn.

**One source of truth.** `core/state.js` is a single mutable object, never
reallocated, with ownership noted per field. Nothing writes to a field it does
not own.

**Laws write intentions, not positions.** A law says where each node *wants* to
be and how hard it pulls; the shared integrator does the rest. That is what makes
momentum survive a scene boundary, and what makes scrolling backwards genuinely
disassemble rather than replay.

## Pacing

The entire film can be re-cut from `src/content/movements.js`. Each movement
declares its scroll span, camera language, lens state and musical root. Nothing
about timing lives anywhere else.

A movement's set sits one focal length in front of the midpoint of its travel,
so `dolly` and `fov` together decide how much the subject magnifies. Keeping
`|dolly|` under roughly a quarter of `fov` holds that near 1.3×. CHAOS and
AUTONOMY are exempt — their geometry spans the travel instead of sitting in front
of it, which is what makes them corridors rather than subjects.

## Accessibility

The cinematic layer enhances a document; it does not replace one. The full
content exists as real markup underneath and is promoted to being the site under
`prefers-reduced-motion`, where it becomes a readable text version with a working
contact path. The thirteen ticks on the left edge are real buttons, so the whole
film is navigable from the keyboard.

Handheld is a separate cut, not a scaled layout: shorter scenes, fewer layers,
one dominant movement per frame.
