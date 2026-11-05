import { AUDIO } from "./assets";

/**
 * Web Audio, not <audio> tags: buffers are fetched and decoded during the
 * loader, so the first sound after "Enter with audio" plays with zero latency.
 * The context is created suspended (browsers allow decoding before a gesture)
 * and resumed by the click that enters the site.
 *
 * Beds loop by crossfading two overlapping copies, so there is never a gap or
 * an audible seam at the loop point.
 */
type Key = keyof typeof AUDIO;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers: Partial<Record<Key, AudioBuffer>> = {};
const beds = new Set<Key>();

function context() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

let preloaded: Promise<void> | null = null;

/** Load the sounds if the page didn't (e.g. /work opened directly). */
export function ensureAudio() {
  return preloadAudio(() => {});
}

/** Fetch and decode every sound once; later callers share the same load. */
export function preloadAudio(onProgress: (p: number) => void) {
  if (preloaded) {
    void preloaded.then(() => onProgress(1));
    return preloaded;
  }
  preloaded = loadAll(onProgress);
  return preloaded;
}

async function loadAll(onProgress: (p: number) => void) {
  const keys = Object.keys(AUDIO) as Key[];
  let done = 0;
  await Promise.all(
    keys.map(async (k) => {
      try {
        const res = await fetch(AUDIO[k]);
        const data = await res.arrayBuffer();
        buffers[k] = await context().decodeAudioData(data);
      } catch {
        // Sound is optional; a failed decode must never block entry.
      }
      onProgress(++done / keys.length);
    }),
  );
}

/** Seamless bed: each pass starts `xfade` seconds before the last one ends. */
function startBed(key: Key, volume: number, fadeIn: number, xfade = 6) {
  const c = context();
  const buf = buffers[key];
  if (!buf || !master || beds.has(key)) return;
  beds.add(key);
  const bus = c.createGain();
  bus.gain.setValueAtTime(0, c.currentTime);
  bus.gain.linearRampToValueAtTime(volume, c.currentTime + fadeIn);
  bus.connect(master);

  const pass = (at: number, first: boolean) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const end = at + buf.duration;
    g.gain.setValueAtTime(first ? 1 : 0, at);
    if (!first) g.gain.linearRampToValueAtTime(1, at + xfade);
    g.gain.setValueAtTime(1, end - xfade);
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g).connect(bus);
    src.start(at);
    const next = end - xfade;
    // Schedule the next pass a couple of seconds before it is due.
    setTimeout(() => pass(next, false), Math.max(0, (next - c.currentTime - 2) * 1000));
  };
  pass(c.currentTime + 0.05, true);
}

export function playOnce(key: Key, volume = 1) {
  const c = context();
  const buf = buffers[key];
  if (!buf || !master) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(master);
  src.start();
}

function startBeds() {
  startBed("music", 0.42, 5);
  startBed("ambient", 0.55, 3);
  startBed("wind", 0.16, 7);
}

/** Called from the enter click, which is the user gesture that unlocks audio. */
export async function startSoundscape() {
  const c = context();
  if (c.state === "suspended") await c.resume();
  setMuted(false);
  playOnce("enter", 0.8);
}

export function setMuted(muted: boolean) {
  const c = context();
  if (!master) return;
  if (!muted && c.state === "suspended") void c.resume();
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setValueAtTime(master.gain.value, c.currentTime);
  master.gain.linearRampToValueAtTime(muted ? 0 : 1, c.currentTime + 0.8);
  if (!muted) startBeds();
}
