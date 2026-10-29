"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { use, useMemo, useRef } from "react";
import * as THREE from "three";
import { shapeAt, thetaAt } from "@/lib/journey";
import { motion } from "@/lib/motion";
import { mulberry32 } from "./terrain";

/**
 * The mark: an "S" set in the display serif, sampled into thousands of glossy
 * beads. Each bead is a point sprite shaded as a sphere in the fragment
 * shader, so it reads as a solid lit object without any geometry.
 *
 * Behaviour, all on the GPU:
 *   assemble  beads fly in from a scattered cloud, staggered per bead
 *   shape     one shape per chapter — S, cube, ball, heart, ring — morphing
 *             slowly across two scrolls (lib/journey.ts). Targets live in one
 *             float texture; each bead leaves at its own moment and settles
 *   idle      every bead rides a slowly evolving noise field
 *   pointer   beads near the cursor are pushed aside (in view space, so it
 *             works from any angle of the orbit)
 *   hover     the mark swells, twists and heats toward white
 */

const HEIGHT = 4.3;

function sampleGlyph(char: string, fontFamily: string, count: number, seed: number) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#fff";
  g.font = `400 ${size * 0.92}px ${fontFamily}`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const m = g.measureText(char);
  const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const glyphW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const baseline = size / 2 + glyphH / 2 - m.actualBoundingBoxDescent;
  const xShift = (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
  g.fillText(char, size / 2 + xShift, baseline);

  const data = g.getImageData(0, 0, size, size).data;
  const filled: number[] = [];
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) if (data[(y * size + x) * 4 + 3] > 140) filled.push(x, y);

  const rnd = mulberry32(seed);
  const n = filled.length / 2;
  const scale = HEIGHT / Math.max(glyphH, 1);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rnd() * n) * 2;
    const px = filled[k] + rnd() - 0.5;
    const py = filled[k + 1] + rnd() - 0.5;
    out[i * 3] = (px - size / 2) * scale;
    out[i * 3 + 1] = -(py - size / 2) * scale;
    // Volume: deeper in the middle of the stroke than at its edges.
    out[i * 3 + 2] = (rnd() - 0.5) * 0.8 * (0.4 + rnd() * 0.6);
  }
  return { points: out, aspect: glyphW / glyphH };
}

// 3D simplex noise — Ashima Arts / Stefan Gustavson, MIT.
const SIMPLEX = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

/* ── Target shapes ─────────────────────────────────────────────────────────
   Each sampler returns one point in the shape's own frame, facing +z. The
   shape is then turned to face the camera from the orbit angle it is seen
   at, so the heart reads as a heart and the ring as a ring. */

type Pt = [number, number, number];
type Sampler = (rnd: () => number) => Pt;
const TAU = Math.PI * 2;
const j = (rnd: () => number, a: number) => (rnd() - 0.5) * a;

const cube: Sampler = (rnd) => {
  const C = 1.38;
  const p: Pt = [(rnd() * 2 - 1) * C, (rnd() * 2 - 1) * C, (rnd() * 2 - 1) * C];
  if (rnd() < 0.75) p[Math.floor(rnd() * 3)] = (rnd() < 0.5 ? -1 : 1) * (C - rnd() * 0.18);
  return p;
};





const ball: Sampler = (rnd) => {
  const R = 2.35;
  const r = R * (rnd() < 0.7 ? 1 - rnd() * 0.12 : Math.cbrt(rnd()));
  const th = rnd() * TAU;
  const ph = Math.acos(2 * rnd() - 1);
  return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)];
};



const heart: Sampler = (rnd) => {
  // Filled implicit heart (x²+y²−1)³ − x²y³ ≤ 0, puffed in depth.
  for (;;) {
    const x = (rnd() * 2 - 1) * 1.2;
    const y = rnd() * 2.4 - 1.1;
    const f = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
    if (f > 0) continue;
    const depth = Math.sqrt(Math.min(1, -f * 6));
    const S = 1.95;
    return [x * S, (y - 0.12) * S, (rnd() - 0.5) * 1.3 * depth];
  }
};



const ring: Sampler = (rnd) => {
  const tube = 0.66 * Math.sqrt(rnd());
  const u = rnd() * TAU;
  const v = rnd() * TAU;
  const rr = 2.05 + tube * Math.cos(v);
  return [rr * Math.cos(u), rr * Math.sin(u), tube * Math.sin(v) * 0.8];
};

/** Shape list, index = journey step. Index 0 (the S) is sampled from the font. */
/** One shape per chapter — S, cube, ball, heart, ring. Nothing in between. */
const SHAPES: (Sampler | null)[] = [null, cube, ball, heart, ring];
const TEX_W = 1024;

function sprayAround(p: Pt, rnd: () => number, amount: number): Pt {
  const n = Math.hypot(p[0], p[1], p[2]) || 1;
  const r = 0.1 + Math.pow(rnd(), 2.6) * amount;
  return [p[0] + (p[0] / n) * r + j(rnd, 0.3), p[1] + (p[1] / n) * r + j(rnd, 0.3), p[2] + (p[2] / n) * r + j(rnd, 0.3)];
}

/** Pack every shape into one RGBA float texture: shape k occupies `rows` rows. */
function buildShapeTexture(count: number, core: number, sPoints: Float32Array) {
  const rows = Math.ceil(count / TEX_W);
  const data = new Float32Array(TEX_W * rows * SHAPES.length * 4);
  SHAPES.forEach((sampler, k) => {
    const rnd = mulberry32(100 + k);
    for (let i = 0; i < count; i++) {
      let p: Pt;
      if (!sampler) p = [sPoints[i * 3], sPoints[i * 3 + 1], sPoints[i * 3 + 2]];
      else {
        const q = sampler(rnd);
        p = i < core ? q : sprayAround(q, rnd, 0.9);
      }
      const o = ((k * rows + Math.floor(i / TEX_W)) * TEX_W + (i % TEX_W)) * 4;
      data[o] = p[0];
      data[o + 1] = p[1];
      data[o + 2] = p[2];
      data[o + 3] = 1;
    }
  });
  const tex = new THREE.DataTexture(data, TEX_W, rows * SHAPES.length, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { tex, rows };
}

const vertex = /* glsl */ `
  attribute float aIndex;
  attribute vec3 aScatter;
  attribute vec4 aRand;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aDrift;
  uniform sampler2D uShapes;
  uniform int uRows;
  uniform float uTime;
  uniform float uAssemble;
  uniform float uShape;
  uniform float uMaxShape;
  uniform float uHover;
  uniform float uPixelRatio;
  uniform float uProj;
  uniform vec3 uMouse;
  uniform float uMouseOn;
  varying vec3 vColor;
  varying float vHeat;
  ${SIMPLEX}

  vec3 shapeOf(float k) {
    int i = int(aIndex + 0.5);
    return texelFetch(uShapes, ivec2(i % ${TEX_W}, i / ${TEX_W} + int(k) * uRows), 0).xyz;
  }

  void main() {
    float d = aRand.x * 0.45;
    float a = smoothstep(d, d + 0.55, uAssemble);

    // Morph: each bead leaves at its own moment and travels on its own curve.
    float s = clamp(uShape, 0.0, uMaxShape);
    float k0 = min(floor(s), uMaxShape - 1.0);
    float fr = s - k0;
    float mi = clamp(fr * 1.45 - aRand.x * 0.45, 0.0, 1.0);
    mi = mi * mi * (3.0 - 2.0 * mi);
    vec3 A = shapeOf(k0);
    vec3 B = shapeOf(k0 + 1.0);
    vec3 base = mix(A, B, mi);
    float flight = sin(mi * 3.14159);
    float transit = sin(clamp(fr, 0.0, 1.0) * 3.14159);

    // Flow: every bead rides a slowly evolving noise field — always alive,
    // and much freer while it is in flight between shapes.
    float t = uTime * 0.16;
    vec3 q = base * 0.6;
    vec3 flow = vec3(snoise(q + vec3(t, 0.0, 0.0)), snoise(q + vec3(0.0, t + 11.0, 0.0)), snoise(q + vec3(0.0, 0.0, t + 23.0)));
    base += flow * (0.045 + 0.06 * aRand.z) * (1.0 + uHover * 0.9);
    vec3 travel = B - A;
    vec3 sidev = normalize(cross(travel + vec3(1e-3, 2e-3, 0.0), vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
    base += flow * flight * (0.3 + aRand.y * 0.45);
    base += sidev * flight * (aRand.z - 0.5) * 0.5 + vec3(0.0, flight * (aRand.w - 0.4) * 0.35, 0.0);
    base *= 1.0 + transit * 0.1;

    // Drifters peel off, float up and away, shrink to nothing, reappear.
    float life = fract(uTime * (0.045 + 0.06 * aRand.y) + aRand.w);
    float fade = mix(1.0, sin(life * 3.14159), aDrift);
    base += aDrift * vec3(flow.x * 0.9 + life * 0.6, life * 1.7, flow.z * 0.8) * life;

    // Hover: twist on the vertical axis and breathe outward.
    float tw = uHover * base.y * 0.32;
    float cs = cos(tw), sn = sin(tw);
    base.xz = mat2(cs, -sn, sn, cs) * base.xz;
    base *= 1.0 + uHover * 0.07;

    vec3 p = mix(aScatter, base, a);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Cursor repel in view space, so it reads the same from any orbit angle.
    vec2 dm = mv.xy - uMouse.xy;
    float push = smoothstep(1.0, 0.0, length(dm)) * uMouseOn * a;
    mv.xy += normalize(dm + 1e-4) * push * 0.42;
    mv.z += push * 0.5;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * fade * uPixelRatio * uProj / -mv.z * (1.0 + uHover * 0.12 + transit * 0.1);
    vColor = aColor;
    vHeat = uHover * smoothstep(0.55, 1.0, aRand.w) + push * 0.45 + flight * smoothstep(0.7, 1.0, aRand.w) * 0.5;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vHeat;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    vec3 n = vec3(c.x, -c.y, sqrt(1.0 - r2));
    vec3 L = normalize(vec3(-0.45, 0.6, 0.65));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
    vec3 col = vColor * (0.45 + 0.65 * diff) + spec * 0.32;
    col = mix(col, vec3(1.0, 0.9, 0.82) * (0.8 + 0.3 * diff), clamp(vHeat * 0.75, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const COLORS = ["#e8400a", "#ff5a14", "#ff7a33", "#ffa070", "#ffd0b4"].map((c) => new THREE.Color(c));

// The glyph is sampled from the real font, so suspend until it has loaded.
let fontPromise: Promise<unknown> | null = null;
function serifFamily() {
  return getComputedStyle(document.body).getPropertyValue("--font-serif").split(",")[0].trim() || "serif";
}
function fontReady() {
  fontPromise ??= document.fonts.load(`400 200px ${serifFamily()}`).catch(() => undefined);
  return fontPromise;
}

export function ParticleMark({ count = 16000, position = [0, 3.45, -5] as [number, number, number] }) {
  use(fontReady());
  const { gl, camera, size } = useThree();
  const group = useRef<THREE.Group>(null);
  const plane = useMemo(() => new THREE.Plane(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const hitView = useMemo(() => new THREE.Vector3(), []);
  const centreView = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const mouseView = useRef(new THREE.Vector3(99, 99, 0));
  const mouseOn = useRef(0);
  const sway = useRef(0);

  const { geometry, shapes } = useMemo(() => {
    const fam = serifFamily();
    const core = Math.round(count * 0.9);
    const { points } = sampleGlyph("S", fam, core, 5);
    const rnd = mulberry32(17);

    const sPts = new Float32Array(count * 3);
    const index = new Float32Array(count);
    const scatter = new Float32Array(count * 3);
    const rand = new Float32Array(count * 4);
    const color = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const drift = new Float32Array(count);
    const tmp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number;
      if (i < core) {
        x = points[i * 3];
        y = points[i * 3 + 1];
        z = points[i * 3 + 2];
      } else {
        // Spray: a loose drift of beads around the letter, densest near it.
        const src = Math.floor(rnd() * core) * 3;
        const r = 0.12 + Math.pow(rnd(), 2.6) * 1.5;
        const th = rnd() * Math.PI * 2;
        x = points[src] + Math.cos(th) * r;
        y = points[src + 1] + Math.sin(th) * r * 0.9 + rnd() * 0.35;
        z = points[src + 2] + (rnd() - 0.5) * 0.8;
      }
      sPts.set([x, y, z], i * 3);
      index[i] = i;

      const sr = 6 + rnd() * 10;
      const st = rnd() * Math.PI * 2;
      const sp = Math.acos(2 * rnd() - 1);
      scatter.set([sr * Math.sin(sp) * Math.cos(st), sr * Math.cos(sp) * 0.6 + 2, sr * Math.sin(sp) * Math.sin(st)], i * 3);
      rand.set([rnd(), rnd(), rnd(), rnd()], i * 4);
      drift[i] = rnd() < 0.08 ? 1 : 0;

      // Hot core toward the middle of the letter, deep orange at the rim.
      const centre = 1 - Math.min(1, Math.hypot(x * 0.9, y * 0.55) / 2.2);
      const pick = Math.min(COLORS.length - 1, Math.max(0, Math.floor(rnd() * 2.3 + centre * 1.5)));
      tmp.copy(COLORS[pick]);
      if (rnd() < 0.015) tmp.set("#ffffff");
      color.set([tmp.r, tmp.g, tmp.b], i * 3);

      sizes[i] = i < core ? 0.06 + rnd() * 0.045 : 0.025 + rnd() * 0.035;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(sPts, 3));
    g.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    g.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aDrift", new THREE.BufferAttribute(drift, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    return { geometry: g, shapes: buildShapeTexture(count, core, sPts) };
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uShapes: { value: shapes.tex },
          uRows: { value: shapes.rows },
          uMaxShape: { value: SHAPES.length - 1 },
          uTime: { value: 0 },
          uAssemble: { value: 0 },
          uShape: { value: 0 },
          uHover: { value: 0 },
          uPixelRatio: { value: 1 },
          uProj: { value: 800 },
          uMouse: { value: new THREE.Vector3(99, 99, 0) },
          uMouseOn: { value: 0 },
        },
      }),
    [shapes],
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const u = material.uniforms;
    const persp = camera as THREE.PerspectiveCamera;
    const t = state.clock.elapsedTime;
    u.uTime.value = t;
    u.uAssemble.value = motion.assemble;
    u.uShape.value = shapeAt(motion.p);
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uProj.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2));

    // Cursor → a plane through the mark facing the camera, then view space.
    camera.getWorldDirection(fwd);
    plane.setFromNormalAndCoplanarPoint(fwd, g.position);
    ray.setFromCamera(new THREE.Vector2(motion.pointer.x, motion.pointer.y), camera);
    const onPlane = ray.ray.intersectPlane(plane, hit);
    centreView.copy(g.position).applyMatrix4(camera.matrixWorldInverse);
    let near = false;
    if (onPlane) {
      hitView.copy(hit).applyMatrix4(camera.matrixWorldInverse);
      mouseView.current.lerp(hitView, 1 - Math.exp(-dt * 14));
      near = Math.abs(hitView.x - centreView.x) < 1.9 && Math.abs(hitView.y - centreView.y) < 2.4;
    }
    // Interaction only while outside the dive into the ring.
    const active = motion.assemble > 0.95 && motion.pointerSeen && motion.p < 12.15 ? 1 : 0;
    mouseOn.current = THREE.MathUtils.damp(mouseOn.current, onPlane ? active : 0, 6, dt);
    motion.hover = THREE.MathUtils.damp(motion.hover, near ? active : 0, near ? 4 : 2.5, dt);
    u.uMouse.value.copy(mouseView.current);
    u.uMouseOn.value = mouseOn.current;
    u.uHover.value = motion.hover;

    // Gentle idle sway (shapes are pre-turned to face the orbit, so no spin);
    // on hover, tilt toward the pointer. Calms as we face the ring.
    const calm = 1 - THREE.MathUtils.smoothstep(motion.p, 11.6, 12.2);
    const ry = (Math.sin(t * 0.32) * 0.14 + Math.sin(t * 0.11) * 0.06) * calm + motion.pointer.x * 0.6 * motion.hover;
    const rx = Math.sin(t * 0.23) * 0.06 * calm - motion.pointer.y * 0.3 * motion.hover;
    // The object always faces the viewer while the world turns behind it.
    sway.current = THREE.MathUtils.damp(sway.current, ry, 3, dt);
    g.rotation.y = thetaAt(motion.p) + sway.current;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rx, 3, dt);
    g.rotation.z = Math.sin(t * 0.17) * 0.035 * calm;
    g.position.set(position[0], position[1] + Math.sin(t * 0.6) * 0.12 * calm, position[2]);
  });

  return (
    <group ref={group} position={position}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
