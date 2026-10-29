"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { TEXTURES } from "@/lib/assets";
import { PALETTE } from "./Landscape";
import { mulberry32 } from "./terrain";

/**
 * Things that move without being asked: leaves carried across the frame on
 * the breeze, and a far-off flock crossing the sky. All motion is computed in
 * the vertex shader from time and a per-instance seed — no per-frame JS.
 */

const leafVertex = /* glsl */ `
  attribute vec4 aSeed;
  attribute float aCell;
  uniform float uTime;
  varying vec2 vUv;
  varying float vShade;
  varying float vDepth;

  mat3 rot(vec3 axis, float a) {
    axis = normalize(axis);
    float s = sin(a), c = cos(a), oc = 1.0 - c;
    return mat3(oc*axis.x*axis.x + c, oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s,
                oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c, oc*axis.y*axis.z - axis.x*s,
                oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c);
  }

  void main() {
    float cell = aCell;
    vUv = (uv + vec2(mod(cell, 3.0), floor(cell / 3.0))) / 3.0;

    float t = uTime;
    float speed = 0.6 + aSeed.w * 0.9;
    // Drift across a box in front of the camera, wrapping at the edges.
    vec3 p;
    p.x = mod(aSeed.x * 44.0 + t * speed, 44.0) - 22.0;
    p.y = mod(aSeed.y * 11.0 - t * (0.18 + aSeed.w * 0.2), 11.0) + 0.3;
    p.z = -12.0 + aSeed.z * 20.0;
    p.x += sin(t * 0.9 + aSeed.y * 20.0) * 0.6;
    p.y += sin(t * 1.3 + aSeed.x * 17.0) * 0.35;

    float size = 0.09 + aSeed.w * 0.12;
    vec3 axis = vec3(aSeed.y - 0.5, 0.6, aSeed.x - 0.5);
    mat3 r = rot(axis, t * (1.2 + aSeed.z * 2.5) + aSeed.x * 6.28);
    vec3 local = r * (position * size);
    vShade = 0.65 + 0.35 * abs((r * vec3(0.0, 0.0, 1.0)).z);

    vec4 mv = viewMatrix * vec4(p + local, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const leafFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uDark;
  uniform vec3 uLight;
  uniform vec3 uFog;
  varying vec2 vUv;
  varying float vShade;
  varying float vDepth;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.5) discard;
    float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
    vec3 c = mix(uDark, uLight, lum * 1.4) * vShade;
    c = mix(c, uFog, smoothstep(14.0, 40.0, vDepth) * 0.8);
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function Leaves({ count = 140 }: { count?: number }) {
  const map = useTexture(TEXTURES.leaves);
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    g.setAttribute("uv", base.attributes.uv);
    const rnd = mulberry32(41);
    const seeds = new Float32Array(count * 4);
    const cells = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
      cells[i] = Math.floor(rnd() * 9);
    }
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    g.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 1));
    g.instanceCount = count;
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: leafVertex,
        fragmentShader: leafFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: map },
          uTime: { value: 0 },
          uDark: { value: new THREE.Color("#4a1505") },
          uLight: { value: new THREE.Color("#c4561f") },
          uFog: { value: new THREE.Color(PALETTE.fog) },
        },
      }),
    [map],
  );

  useFrame((s) => {
    material.uniforms.uTime.value = s.clock.elapsedTime;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/* ── Birds ────────────────────────────────────────────────────────────────── */

const birdVertex = /* glsl */ `
  attribute float aWing;
  attribute float aPhase;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float flap = sin(uTime * 7.0 + aPhase * 6.28);
    p.y += flap * abs(aWing) * 0.35;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export function Birds({ count = 7 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const rnd = mulberry32(77);
    const pos: number[] = [];
    const wing: number[] = [];
    const phase: number[] = [];
    for (let i = 0; i < count; i++) {
      // Loose V formation.
      const row = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      const ox = -row * 1.1 + (rnd() - 0.5) * 0.4;
      const oy = side * row * 0.55 + (rnd() - 0.5) * 0.3;
      const oz = (rnd() - 0.5) * 1.5;
      const ph = rnd();
      const s = 0.32 + rnd() * 0.12;
      // Two wings, each a thin triangle hinged at the body; only the tips flap.
      const tri = (dir: number) => {
        pos.push(ox, oy, oz, ox + dir * 0.35 * s, oy - 0.12 * s, oz, ox + dir * 1.0 * s, oy + 0.05 * s, oz);
        wing.push(0, 0.35 * dir, dir);
        phase.push(ph, ph, ph);
      };
      tri(1);
      tri(-1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aWing", new THREE.Float32BufferAttribute(wing, 1));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: birdVertex,
        fragmentShader: "void main(){ gl_FragColor = vec4(0.36, 0.12, 0.05, 0.85); }",
        side: THREE.DoubleSide,
        transparent: true,
        uniforms: { uTime: { value: 0 } },
      }),
    [],
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    const g = group.current;
    if (!g) return;
    // Cross the sky every ~38 s, with a lazy rise and fall.
    const k = ((t + 6) % 38) / 38;
    g.position.set(-40 + k * 80, 11 + Math.sin(k * Math.PI * 2) * 1.2, -34);
    g.rotation.z = Math.sin(t * 0.4) * 0.05;
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
