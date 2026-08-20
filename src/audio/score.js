/**
 * The score.
 *
 * Entirely procedural — no audio files, no samples, nothing to load. Every sound
 * in the piece is synthesised from oscillators and shaped noise, which is partly
 * a performance decision and mostly an aesthetic one: the brief asks that the
 * visitor sometimes be unsure whether a sound is music or the machine, and the
 * surest way to achieve that is for both to come out of the same synthesiser.
 *
 * Velocity controls density, not timeline position. Scrubbing a recording with
 * scroll is the obvious approach and it always sounds like scrubbing a
 * recording. Instead the transport runs at a fixed tempo and the visitor's speed
 * decides how many layers are playing, how much percussion lands, and how much
 * low-end is under it. Moving slowly leaves air and texture; moving fast brings
 * in the kit and the sub. The visitor controls the energy, not the position.
 *
 * The long arc is already written down in content/movements.js: each movement
 * declares a root note, a density and an air amount, and reading those in order
 * gives exactly the shape the brief asks for — silence, texture, pulse, rhythm,
 * acceleration, impact, silence, sparse ending. AUTONOMY is the loudest thing
 * here and FAILURE is nearly silent, because that is what those movements are.
 *
 * It is off by default and the piece is complete without it.
 */

import { state } from '../core/state.js';
import { MOVEMENTS } from '../content/movements.js';
import { clamp01, lerp, damp } from '../core/math.js';
import * as signal from '../core/signal.js';
import * as R from '../entity/register.js';

/** Driving 4/4. Sixteenth-note grid. */
const BPM = 132;
const STEP = 60 / BPM / 4;

/** How far ahead of the audio clock events are scheduled. */
const LOOKAHEAD = 0.22;

let ctx = null;
let master, limiter;
let airSrc, airFilter, airGain;
let droneGain, droneFilter;
const droneOsc = [];
let subGain;
let on = false;
let button, bars;

let nextStep = 0;
let stepIndex = 0;

/** Smoothed control values, so nothing in the mix ever steps. */
const mix = { energy: 0, air: 0, density: 0, low: 0, root: 55 };

// ── Graph ───────────────────────────────────────────────────────────────────

/**
 * One noise buffer for the whole score, read from a random offset for variation.
 * Allocating a fresh buffer per percussion hit — filling thousands of floats
 * with Math.random() several times a second — is real garbage pressure on a
 * phone, and it buys nothing a read offset does not.
 */
let noise = null;

function noiseBuffer(seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A voice reading the shared noise, from somewhere new each time. */
function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  return s;
}

function build() {
  noise = noiseBuffer(2);

  master = ctx.createGain();
  master.gain.value = 0;

  // A limiter rather than a compressor for tone: this exists so that a fast
  // scroll stacking every layer at once cannot clip.
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.18;

  master.connect(limiter);
  limiter.connect(ctx.destination);

  // AIR — the environment. Filtered noise, always present, opens with velocity.
  airSrc = ctx.createBufferSource();
  airSrc.buffer = noise;
  airSrc.loop = true;
  airFilter = ctx.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 420;
  airFilter.Q.value = 0.7;
  airGain = ctx.createGain();
  airGain.gain.value = 0;
  airSrc.connect(airFilter).connect(airGain).connect(master);
  airSrc.start();

  // DRONE — the harmonic bed. Root, fifth and octave, slightly detuned so it
  // beats rather than sitting perfectly still.
  droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 900;
  droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneFilter.connect(droneGain).connect(master);

  for (const [mult, detune, level] of [
    [1, -4, 1],
    [1.5, 5, 0.42],
    [2, -7, 0.3],
    [0.5, 0, 0.55],
  ]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 55 * mult;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(droneFilter);
    o.start();
    droneOsc.push({ o, mult });
  }

  // SUB — the low end that arrives with speed.
  subGain = ctx.createGain();
  subGain.gain.value = 0;
  subGain.connect(master);
}

// ── Voices ──────────────────────────────────────────────────────────────────

/** Membrane hit. Pitch drops fast; this is the kick. */
function kick(t, level) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(132, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.3);
}

/** Shaped noise burst. Doubles as a hat and as machine noise. */
function tick_(t, level, freq = 6200, q = 1.4, decay = 0.045) {
  const s = noiseSource();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  s.connect(f).connect(g).connect(master);
  // A different slice of the same noise each time, so repeated hits are not
  // bit-identical.
  s.start(t, Math.random() * 1.8);
  s.stop(t + decay + 0.02);
}

/** Metallic ring. Used only when the visitor finds the ideal rhythm. */
function ring(t, level, base) {
  for (const [mult, lv] of [
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.24],
  ]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = base * mult;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level * lv, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 1.4);
  }
}

/** A downward sweep with the tuning pulled apart. The sound of losing sync. */
function tear(t, level) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.55);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1600;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.65);
  tick_(t, level * 0.8, 1800, 0.8, 0.3);
}

/** A movement boundary. Felt more than heard. */
function thunk(t, level) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(84, t);
  o.frequency.exponentialRampToValueAtTime(31, t + 0.4);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.75);
  tick_(t, level * 0.35, 900, 0.7, 0.12);
}

// ── Transport ───────────────────────────────────────────────────────────────

/**
 * Fixed grid, variable density. Which voices fire on a given step depends on
 * the visitor's energy, never on their scroll position — that is the whole
 * difference between this and scrubbing a track.
 */
function schedule() {
  const now = ctx.currentTime;
  while (nextStep < now + LOOKAHEAD) {
    const t = Math.max(nextStep, now);
    const s = stepIndex % 16;
    const e = mix.energy;

    // Kick: the backbone, from moderate energy upward.
    if (e > 0.2 && (s === 0 || s === 6 || (e > 0.62 && s === 10))) {
      kick(t, 0.5 * clamp01(e * 1.3));
    }

    // Hats: the sense of speed. Only once the visitor is actually moving.
    if (e > 0.34 && s % 4 === 2) tick_(t, 0.1 * e, 7400, 1.6, 0.035);
    if (e > 0.58 && s % 2 === 1) tick_(t, 0.055 * e, 9200, 2.2, 0.022);

    // Sixteenth drive at the top end. This is the acceleration.
    if (e > 0.78 && s % 2 === 0) tick_(t, 0.04 * e, 5200, 3, 0.018);

    // Machine noise, driven by how much the register itself is moving. This is
    // the layer that blurs the line between the score and the mechanism.
    const agitation = clamp01(R.agitation() / 900);
    if (agitation > 0.12 && Math.random() < agitation * 0.5) {
      tick_(t, 0.035 * agitation, 2400 + Math.random() * 5000, 5, 0.03);
    }

    nextStep += STEP;
    stepIndex++;
  }
}

// ── Control ─────────────────────────────────────────────────────────────────

export function tick(dt) {
  if (!on || !ctx) return;

  const m = MOVEMENTS[Math.min(state.scene, MOVEMENTS.length - 1)];

  // Velocity sets density; the movement sets the floor and the colour.
  const target = clamp01(m.tone.density * 0.62 + state.speed * 0.85);
  mix.energy = damp(mix.energy, target, 0.06, dt);
  mix.air = damp(mix.air, m.tone.air, 0.03, dt);
  mix.density = damp(mix.density, m.tone.density, 0.03, dt);
  mix.low = damp(mix.low, clamp01(state.speed * 1.5), 0.05, dt);

  const now = ctx.currentTime;

  // Air opens up under speed: more of the room becomes audible.
  airGain.gain.setTargetAtTime(0.06 * mix.air * (0.5 + mix.energy), now, 0.2);
  airFilter.frequency.setTargetAtTime(340 + mix.energy * 2600, now, 0.15);

  droneGain.gain.setTargetAtTime(0.075 * mix.density, now, 0.3);
  droneFilter.frequency.setTargetAtTime(500 + mix.energy * 1500, now, 0.25);

  // Root note per movement, glided rather than switched.
  if (Math.abs(mix.root - m.tone.root) > 0.01) {
    mix.root = damp(mix.root, m.tone.root, 0.02, dt);
    for (const d of droneOsc) d.o.frequency.setTargetAtTime(mix.root * d.mult, now, 0.6);
  }

  // Stability affects tuning: as sync degrades the drone detunes.
  const off = (1 - state.sync) * 55;
  for (let i = 0; i < droneOsc.length; i++) {
    droneOsc[i].o.detune.setTargetAtTime((i % 2 ? 5 : -4) - off, now, 0.1);
  }

  schedule();

  state.audioEnergy = mix.energy;

  // The button reports the mix rather than decorating it.
  if (bars) {
    for (let i = 0; i < bars.length; i++) {
      const h = 1 + Math.round(clamp01(mix.energy * (0.5 + i * 0.28)) * 9);
      bars[i].style.height = `${h}px`;
    }
  }
}

async function enable() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    build();
    // Events are wired only once audio exists, so nothing is computed for a
    // visitor who never turns it on.
    signal.on('scene', () => thunk(ctx.currentTime + 0.01, 0.34));
    signal.on('lock', () => ring(ctx.currentTime + 0.01, 0.16, 880));
    signal.on('desync', () => tear(ctx.currentTime + 0.01, 0.2));
    signal.on('tooFast', () => {
      tear(ctx.currentTime + 0.01, 0.34);
      kick(ctx.currentTime + 0.02, 0.6);
    });
    nextStep = ctx.currentTime + 0.1;
  }
  if (ctx.state === 'suspended') await ctx.resume();
  on = true;
  state.audioOn = true;
  master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
  button.setAttribute('aria-pressed', 'true');
}

function disable() {
  on = false;
  state.audioOn = false;
  state.audioEnergy = 0;
  if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  button.setAttribute('aria-pressed', 'false');
  if (bars) for (const b of bars) (b.style.height = '1px');
}

export function init() {
  button = document.getElementById('audio-toggle');
  if (!button) return;
  bars = button.querySelectorAll('.audio-bars i');
  // The score owns this control, so it only appears once the score exists.
  button.hidden = false;
  button.addEventListener('click', () => (on ? disable() : enable()));
}

export const isOn = () => on;
