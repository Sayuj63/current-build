"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TEXTURES } from "@/lib/assets";
import { PALETTE } from "./Landscape";
import { KEY } from "@/lib/journey";
import { heightAt, MARK, mulberry32, ORBIT_R, WATER_Y } from "./terrain";

/**
 * Grass cards textured from ambientCG's scanned foliage atlases (CC0), tinted
 * into the palette in the shader and swayed by a cheap two-frequency wind.
 * One InstancedMesh per atlas = two draw calls for the whole field.
 */

const vertex = /* glsl */ `
  attribute float aOffset;
  attribute float aTint;
  uniform float uTime;
  uniform float uAtlasW;
  varying vec2 vUv;
  varying float vH;
  varying float vTint;
  varying float vDepth;
  void main() {
    vUv = vec2(aOffset + uv.x * uAtlasW, uv.y);
    vH = uv.y;
    vTint = aTint;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float sway = sin(uTime * 1.4 + wp.x * 0.35 + wp.z * 0.22) * 0.6 + sin(uTime * 2.6 + wp.x * 0.9) * 0.25;
    // Gusts: broad bands of stronger wind rolling across the field.
    float gust = smoothstep(0.35, 1.0, sin(wp.x * 0.09 + wp.z * 0.05 - uTime * 0.9) * 0.5 + 0.5);
    float bend = vH * vH;
    wp.x += (sway * 0.22 + gust * 0.3) * bend;
    wp.z += (sway * 0.07 + gust * 0.08) * bend;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying float vH;
  varying float vTint;
  varying float vDepth;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.5) discard;
    float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
    vec3 c = mix(uBase, uTip, smoothstep(0.05, 1.0, vH));
    c *= 0.7 + lum * 0.9;
    c = mix(c, c * vec3(1.18, 0.86, 0.74), vTint);
    c = mix(c, uFog, smoothstep(uFogNear, uFogFar, vDepth));
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** An annulus of grass around the mark. `grow` makes blades taller toward rMax. */
type FieldSpec = {
  count: number;
  rMin: number;
  rMax: number;
  hMin: number;
  hMax: number;
  grow?: number;
};

// The camera's orbit is kept clear so no blade ever sits in the lens.
const CLEAR_IN = ORBIT_R - 2.8;
const CLEAR_OUT = ORBIT_R + 2.2;

// The journey also swoops in close (the ball chapter), so clear a corridor
// along the camera's actual flight path, sampled from the keyframes.
const PATH = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i < KEY.theta.length - 1; i++) {
    for (let f = 0; f < 1; f += 0.1) {
      const th = THREE.MathUtils.degToRad(KEY.theta[i] + (KEY.theta[i + 1] - KEY.theta[i]) * f);
      const r = KEY.radius[i] + (KEY.radius[i + 1] - KEY.radius[i]) * f;
      if (r < CLEAR_IN) pts.push([MARK.x + Math.sin(th) * r, MARK.z + Math.cos(th) * r]);
    }
  }
  return pts;
})();
const nearPath = (x: number, z: number) => PATH.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 2.1 * 2.1);

function buildCard() {
  // Two crossed quads, pivot at the base, a few rows so the bend is smooth.
  const a = new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  return mergeGeometries([a, b])!;
}

function useField(fields: FieldSpec[], seed: number, atlasSlots: number, atlasW: number) {
  return useMemo(() => {
    const rnd = mulberry32(seed);
    const matrices: THREE.Matrix4[] = [];
    const offsets: number[] = [];
    const tints: number[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (const f of fields) {
      let placed = 0;
      let guard = 0;
      while (placed < f.count && guard++ < f.count * 5) {
        // Uniform over the annulus area.
        const r = Math.sqrt(f.rMin * f.rMin + rnd() * (f.rMax * f.rMax - f.rMin * f.rMin));
        if (r > CLEAR_IN && r < CLEAR_OUT) continue;
        const a = rnd() * Math.PI * 2;
        const x = MARK.x + Math.sin(a) * r;
        const z = MARK.z + Math.cos(a) * r;
        const y = heightAt(x, z);
        if (y < WATER_Y + 0.05 || nearPath(x, z)) continue;
        const grow = 1 + (f.grow ?? 0) * ((r - f.rMin) / (f.rMax - f.rMin));
        const h = (f.hMin + rnd() * (f.hMax - f.hMin)) * grow;
        const w = h * (0.55 + rnd() * 0.35);
        e.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(w, h, w));
        matrices.push(m.clone());
        offsets.push(Math.floor(rnd() * atlasSlots) * (1 - atlasW) / Math.max(1, atlasSlots - 1));
        tints.push(rnd());
        placed++;
      }
    }
    return { matrices, offsets: new Float32Array(offsets), tints: new Float32Array(tints) };
  }, [fields, seed, atlasSlots, atlasW]);
}

function Field({
  map,
  fields,
  seed,
  atlasSlots,
  atlasW,
  base,
  tip,
}: {
  map: string;
  fields: FieldSpec[];
  seed: number;
  atlasSlots: number;
  atlasW: number;
  base: string;
  tip: string;
}) {
  const tex = useTexture(map);
  useLayoutEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);

  const geo = useMemo(buildCard, []);
  const { matrices, offsets, tints } = useField(fields, seed, atlasSlots, atlasW);
  const ref = useRef<THREE.InstancedMesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: tex },
          uTime: { value: 0 },
          uAtlasW: { value: atlasW },
          uBase: { value: new THREE.Color(base) },
          uTip: { value: new THREE.Color(tip) },
          uFog: { value: new THREE.Color(PALETTE.fog) },
          uFogNear: { value: 24 },
          uFogFar: { value: 80 },
        },
      }),
    [tex, atlasW, base, tip],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 1));
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
    mesh.computeBoundingSphere();
  }, [matrices, offsets, tints, geo]);

  useFrame((s) => {
    material.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return <instancedMesh ref={ref} args={[geo, material, matrices.length]} frustumCulled={false} />;
}

export function Grass({ lite = false }: { lite?: boolean }) {
  const k = lite ? 0.45 : 1;
  const blades = useMemo<FieldSpec[]>(
    () => [
      // The meadow inside the orbit: dense, taller toward the lens.
      { count: Math.round(17000 * k), rMin: 1.5, rMax: CLEAR_IN, hMin: 0.32, hMax: 0.6, grow: 0.5 },
      // Beyond the orbit, out to the rocks: seen only as background.
      { count: Math.round(11000 * k), rMin: CLEAR_OUT, rMax: 30, hMin: 0.45, hMax: 0.8 },
    ],
    [k],
  );
  const heads = useMemo<FieldSpec[]>(
    () => [
      { count: Math.round(380 * k), rMin: 2, rMax: CLEAR_IN, hMin: 0.6, hMax: 0.95, grow: 0.3 },
      { count: Math.round(300 * k), rMin: CLEAR_OUT, rMax: 28, hMin: 0.8, hMax: 1.2 },
    ],
    [k],
  );

  return (
    <>
      <Field map={TEXTURES.grassBlades} fields={blades} seed={3} atlasSlots={6} atlasW={3 / 8} base="#3e1203" tip="#e8561a" />
      <Field map={TEXTURES.grassHeads} fields={heads} seed={11} atlasSlots={4} atlasW={1 / 4} base="#7a2e0c" tip="#ffc9a3" />
    </>
  );
}
