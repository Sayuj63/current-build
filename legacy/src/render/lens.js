/**
 * The lens.
 *
 * The world canvas is treated as a negative and this is the optical path that
 * photographs it. Everything here exists because a real lens does it, not
 * because it looks like an effect:
 *
 *   Barrel distortion is constant and small, because glass bends.
 *   Chromatic aberration is radial and grows with velocity, because fast pans
 *     are where a real lens shows its edges.
 *   Bloom is anisotropic — roughly two to one, wider horizontally — which is
 *     the signature of an anamorphic taking lens. This is what produces the
 *     horizontal flare on the orange nodes without a single flare sprite.
 *   Halation is weighted toward the orange channel, so the signal colour
 *     blooms more readily than white. Colour means something here, including
 *     optically.
 *   Grain is advanced at twenty-four steps per second rather than per frame.
 *     Per-frame noise reads as video hiss; stepped noise reads as film.
 *   The frame crush is a real mask that breathes with the movement.
 *
 * The desync tear is the one non-optical element, and that is the point: when
 * the visitor outruns the system, the illusion of a photographed world is what
 * breaks.
 */

import { state } from '../core/state.js';
import { clamp01, damp, lerp, norm } from '../core/math.js';
import { MOVEMENTS } from '../content/movements.js';
import { IS_LIGHT, PALETTE } from './world.js';

/**
 * Parse the '#rrggbb' PALETTE.void into a WebGL clear colour. The lens paints
 * outside the frame crush with this so the letterbox reads as the same paper
 * (or the same photograph-black) as the world underneath — not a hardcoded
 * black that would slash across a light theme.
 */
function hexToVec3(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}
const CRUSH_RGB = hexToVec3(PALETTE.void);

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** Bright-pass and downsample. Orange is favoured so the signal halates. */
const FRAG_BRIGHT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float warm = clamp((c.r - c.b) * 1.6, 0.0, 1.0);
  float w = max(lum - uThreshold, 0.0) / max(1.0 - uThreshold, 0.001);
  gl_FragColor = vec4(c * w * (1.0 + warm * 1.35), 1.0);
}`;

/** Separable nine-tap gaussian. Direction carries the anisotropy. */
const FRAG_BLUR = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 sum = texture2D(uTex, vUv).rgb * 0.2270270270;
  sum += texture2D(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  sum += texture2D(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}`;

const FRAG_COMPOSITE = `
precision mediump float;
varying vec2 vUv;

uniform sampler2D uTex;
uniform sampler2D uBloom;
uniform vec2  uRes;
uniform float uTime;
uniform float uExposure;
uniform float uLift;
uniform float uGrain;
uniform float uCrush;
uniform float uAberration;
uniform float uBloomAmt;
uniform float uDesync;
uniform float uVignette;
uniform float uFlash;
uniform vec3  uCrushCol;
uniform float uLight;

/*
 * Decorrelated 2D hash. A cheaper two-term hash leaves visible rows and blocks
 * at grain amplitudes this low, which reads as compression artefacts rather
 * than emulsion.
 */
float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);

  // Barrel distortion. Small and always present — this is glass, not a filter.
  uv = 0.5 + c * (1.0 + 0.055 * r2 + 0.020 * r2 * r2);

  // Desync tear. Horizontal bands slip, and a few of them slip badly.
  if (uDesync > 0.001) {
    float band = floor(uv.y * 46.0);
    float t24 = floor(uTime * 26.0);
    float rr = hash(vec2(band, t24));
    float gate = step(1.0 - uDesync * 0.62, rr);
    uv.x += (rr - 0.5) * uDesync * 0.085 * gate;
    uv.y += (hash(vec2(t24, 3.7)) - 0.5) * uDesync * 0.012;
  }

  // Radial chromatic aberration. Zero at centre, strongest at the corners.
  float ab = uAberration * (0.0016 + uDesync * 0.010);
  vec2 dir = c * (1.0 + r2 * 1.4);
  vec3 col;
  col.r = texture2D(uTex, uv + dir * ab).r;
  col.g = texture2D(uTex, uv).g;
  col.b = texture2D(uTex, uv - dir * ab * 1.12).b;

  vec3 bloom = texture2D(uBloom, uv).rgb;
  col += bloom * uBloomAmt;

  col *= uExposure;
  col += uLift;
  col += uFlash;

  // Vignette. Optical falloff, not a dark overlay.
  float vig = 1.0 - uVignette * smoothstep(0.16, 0.92, r2 * 1.9);
  col *= vig;

  // Filmic shoulder. Keeps the orange from clipping to white on dark stock.
  // On paper the same curve compresses the near-white ground down to muddy
  // grey and steals the warmth, so light theme skips the tone map and
  // clamps instead — the palette is already inside sRGB by construction.
  if (uLight < 0.5) {
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  } else {
    col = clamp(col, 0.0, 1.0);
  }

  // Grain, advanced in twenty-four discrete steps per second.
  float gt = floor(uTime * 24.0);
  float g = hash(gl_FragCoord.xy * 0.7 + vec2(gt * 13.7, gt * 7.3)) - 0.5;
  // Weighted into the shadows and mid-tones, as real emulsion is.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += g * uGrain * (1.0 - lum * 0.72);

  // Frame crush. A real mask that breathes with the movement. On a dark theme
  // the mask is black by construction; on a light theme the mask is the paper
  // colour, so the letterbox stays inside the print rather than slashing two
  // black bars across it.
  float bar = uCrush * 0.145;
  float inside = step(bar, vUv.y) * step(vUv.y, 1.0 - bar);
  col = mix(uCrushCol, col, inside);

  // Edges of the mask carry a hairline so the frame reads as intentional.
  float edge = min(abs(vUv.y - bar), abs(vUv.y - (1.0 - bar)));
  col += vec3(0.055, 0.058, 0.062) * step(edge, 1.0 / uRes.y) * step(0.004, bar);

  gl_FragColor = vec4(col, 1.0);
}`;

let gl = null;
let canvas = null;
let progBright, progBlur, progComposite;
let quadBuf;
let worldTex;
let fboA, fboB, texA, texB;
let bloomW = 1,
  bloomH = 1;
let sourceCanvas = null;
export let supported = false;

/** Smoothed lens state so movement changes do not snap the exposure. */
const L = { exposure: 0.85, lift: 0, grain: 0.05, crush: 0.12, vignette: 0.5, flash: 0 };

function compile(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[lens] shader', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function program(vert, frag) {
  const p = gl.createProgram();
  const v = compile(vert, gl.VERTEX_SHADER);
  const f = compile(frag, gl.FRAGMENT_SHADER);
  if (!v || !f) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[lens] link', gl.getProgramInfoLog(p));
    return null;
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

function makeTarget(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return [fbo, tex];
}

export function init(displayCanvas, worldCanvas) {
  canvas = displayCanvas;
  sourceCanvas = worldCanvas;
  gl =
    canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    }) || canvas.getContext('experimental-webgl');

  if (!gl) {
    supported = false;
    return false;
  }

  progBright = program(VERT, FRAG_BRIGHT);
  progBlur = program(VERT, FRAG_BLUR);
  progComposite = program(VERT, FRAG_COMPOSITE);
  if (!progBright || !progBlur || !progComposite) {
    supported = false;
    return false;
  }

  quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  worldTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, worldTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  supported = true;
  resize();
  return true;
}

export function resize() {
  if (!supported) return;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  canvas.width = w;
  canvas.height = h;

  // Bloom runs at a quarter of each axis. At this line weight the loss is
  // invisible and the fill-rate saving is large.
  bloomW = Math.max(1, w >> 2);
  bloomH = Math.max(1, h >> 2);

  if (fboA) {
    gl.deleteFramebuffer(fboA);
    gl.deleteTexture(texA);
    gl.deleteFramebuffer(fboB);
    gl.deleteTexture(texB);
  }
  [fboA, texA] = makeTarget(bloomW, bloomH);
  [fboB, texB] = makeTarget(bloomW, bloomH);
}

function drawQuad() {
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function render(dt) {
  if (!supported) return;

  const m = MOVEMENTS[Math.min(state.scene, MOVEMENTS.length - 1)];
  const desync = clamp01(1 - state.sync / 0.5);

  // Lens state moves on its own slow friction so a movement change reads as a
  // stop being pulled, not as a cut.
  L.exposure = damp(L.exposure, m.lens.exposure * (1 + state.speed * 0.1), 0.045, dt);
  L.lift = damp(L.lift, m.lens.lift, 0.045, dt);
  L.grain = damp(L.grain, m.lens.grain + desync * 0.09, 0.08, dt);
  L.crush = damp(L.crush, m.lens.crush, 0.035, dt);
  L.vignette = damp(L.vignette, 0.46 + state.speed * 0.22, 0.05, dt);
  L.flash = damp(L.flash, 0, 0.14, dt);

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Upload the negative.
  gl.bindTexture(gl.TEXTURE_2D, worldTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

  // Bright pass → A. On a light theme the paper itself is above the default
  // threshold, so it would seed the entire frame into the bloom target. Bump
  // the threshold so only the orange signal halates on paper.
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
  gl.viewport(0, 0, bloomW, bloomH);
  gl.useProgram(progBright.p);
  gl.uniform1i(progBright.u.uTex, 0);
  gl.uniform1f(progBright.u.uThreshold, IS_LIGHT ? 0.94 : 0.26);
  drawQuad();

  // Horizontal blur, wide → B. This is the anamorphic axis.
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
  gl.useProgram(progBlur.p);
  gl.bindTexture(gl.TEXTURE_2D, texA);
  gl.uniform1i(progBlur.u.uTex, 0);
  gl.uniform2f(progBlur.u.uDir, 2.15 / bloomW, 0);
  drawQuad();

  // Vertical blur, narrow → A. Roughly two to one against the horizontal.
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
  gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.uniform2f(progBlur.u.uDir, 0, 1.0 / bloomH);
  drawQuad();

  // Second horizontal pass extends the streak without a third target.
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
  gl.bindTexture(gl.TEXTURE_2D, texA);
  gl.uniform2f(progBlur.u.uDir, 4.6 / bloomW, 0);
  drawQuad();

  // Composite → screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(progComposite.p);
  const u = progComposite.u;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, worldTex);
  gl.uniform1i(u.uTex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.uniform1i(u.uBloom, 1);
  gl.activeTexture(gl.TEXTURE0);

  gl.uniform2f(u.uRes, canvas.width, canvas.height);
  gl.uniform1f(u.uTime, state.time);
  gl.uniform1f(u.uExposure, L.exposure);
  gl.uniform1f(u.uLift, L.lift);
  gl.uniform1f(u.uGrain, L.grain);
  gl.uniform1f(u.uCrush, L.crush);
  gl.uniform1f(u.uAberration, 1 + state.speed * 5.5);
  // Bloom is heavy on dark stock and light on paper — additive bloom over a
  // near-white ground washes to pure white. Halation is kept only enough to
  // give the orange nodes their signature warm bleed.
  gl.uniform1f(u.uBloomAmt, IS_LIGHT ? 0.12 + state.speed * 0.05 : 0.78 + state.speed * 0.3);
  gl.uniform1f(u.uDesync, desync);
  // Vignette on paper is a warm falloff, not a black tunnel — the print
  // needs only a hint or the corners look like burn marks.
  gl.uniform1f(u.uVignette, IS_LIGHT ? L.vignette * 0.35 : L.vignette);
  gl.uniform1f(u.uFlash, L.flash);
  gl.uniform3fv(u.uCrushCol, CRUSH_RGB);
  gl.uniform1f(u.uLight, IS_LIGHT ? 1.0 : 0.0);

  drawQuad();
}

/** One-frame exposure lift. For arrivals and impacts. */
export function flash(amount) {
  L.flash = Math.max(L.flash, amount);
}

/** Push the frame crush independently of the movement. Used on holds. */
export function crushTo(v) {
  L.crush = Math.max(L.crush, v);
}
