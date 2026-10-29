"use client";

import { Cloud, Clouds, Environment, MeshReflectorMaterial, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HDRI, ROCK_ACCENTS, ROCKS, TEXTURES } from "@/lib/assets";
import { heightAt, MARK, mulberry32, POND, ROCK_R, WATER_Y } from "./terrain";

export const PALETTE = {
  skyTop: "#f28e5c",
  skyMid: "#ffb48e",
  skyHorizon: "#ffe2cc",
  fog: "#ffcfb0",
  ground: "#9c3409",
  rock: "#a5583f",
  water: "#ffd6bf",
};

/* ── Sky ──────────────────────────────────────────────────────────────────── */
export function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(PALETTE.skyTop) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    }),
    [],
  );
  return (
    <mesh scale={160} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
            c = mix(c, uTop, smoothstep(0.15, 0.6, h));
            gl_FragColor = vec4(c, 1.0);
          }`}
      />
    </mesh>
  );
}

/* ── Clouds (drei volumetric sprites, local CC0 texture) ──────────────────── */
const CLOUD_RING = Array.from({ length: 8 }, (_, i) => {
  const rnd = mulberry32(300 + i);
  const a = (i / 8) * Math.PI * 2 + rnd() * 0.4;
  const r = 46 + rnd() * 10;
  const colors = ["#ffc6a6", "#ffd8c2", "#ffb896"];
  return {
    seed: 2 + i * 3,
    seg: 18 + Math.floor(rnd() * 8),
    w: 12 + rnd() * 6,
    vol: 7 + rnd() * 3,
    color: colors[i % 3],
    op: 0.4 + rnd() * 0.15,
    pos: [MARK.x + Math.sin(a) * r, 13 + rnd() * 6, MARK.z - Math.cos(a) * r] as [number, number, number],
  };
});
export function SkyClouds() {
  const ref = useRef<THREE.Group>(null);
  // The whole bank drifts slowly sideways on top of each cloud's own churn.
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.004;
  });
  return (
    <Clouds ref={ref} texture={TEXTURES.cloud} limit={260} material={THREE.MeshBasicMaterial}>
      {/* A ring of cloud banks, so every angle of the orbit has a sky. */}
      {CLOUD_RING.map((c, i) => (
        <Cloud key={i} seed={c.seed} segments={c.seg} bounds={[c.w, 2.4, 3]} volume={c.vol} color={c.color} opacity={c.op} fade={70} speed={0.22} position={c.pos} />
      ))}
    </Clouds>
  );
}

/* ── Ground ───────────────────────────────────────────────────────────────── */
export function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(180, 180, 240, 240);
    g.rotateX(-Math.PI / 2);
    g.translate(MARK.x, 0, MARK.z);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={PALETTE.ground} roughness={1} />
    </mesh>
  );
}

/* ── Rocks (Kenney Nature Kit, CC0) ───────────────────────────────────────── */

/**
 * Flatten a GLB into one geometry with a unit footprint and unit height, base
 * at y=0. Normalising both axes turns Kenney's wide, flat boulders into the
 * chunky monoliths the horizon needs; per-instance scale then sets the shape.
 */
function toUnitGeometry(scene: THREE.Object3D) {
  const parts: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  const merged = mergeGeometries(parts)!;
  merged.computeBoundingBox();
  const b = merged.boundingBox!;
  const h = b.max.y - b.min.y || 1;
  const foot = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1;
  merged.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  merged.scale(1 / foot, 1 / h, 1 / foot);
  merged.computeVertexNormals();
  return merged;
}

export function Rocks() {
  const gltfs = useGLTF(ROCKS);
  const geos = useMemo(() => gltfs.map((g) => toUnitGeometry(g.scene)), [gltfs]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.92, flatShading: true }), []);

  // Two rings of boulders around the mark, outside the camera's orbit, so a
  // crown of rocks stands behind the mark from every angle.
  const placements = useMemo(() => {
    const rnd = mulberry32(21);
    const boulders = geos.length - ROCK_ACCENTS;
    const out: { geo: number; pos: [number, number, number]; rot: number; scale: [number, number, number] }[] = [];
    const ring = (count: number, rMin: number, rMax: number, hMin: number, hMax: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.08;
        const r = rMin + rnd() * (rMax - rMin);
        const x = MARK.x + Math.sin(a) * r;
        const z = MARK.z + Math.cos(a) * r;
        const accent = rnd() < 0.1;
        const h = (hMin + rnd() * (hMax - hMin)) * (accent ? 1.45 : 1);
        const w = h * (accent ? 0.55 : 0.75 + rnd() * 0.5);
        const geo = accent ? boulders + Math.floor(rnd() * ROCK_ACCENTS) : Math.floor(rnd() * boulders);
        out.push({ geo, pos: [x, heightAt(x, z) - 0.15, z], rot: rnd() * Math.PI * 2, scale: [w, h, w] });
      }
    };
    ring(64, ROCK_R, ROCK_R + 4, 1.5, 2.9);
    ring(44, ROCK_R + 7, ROCK_R + 12, 2.2, 3.6);
    return out;
  }, [geos.length]);

  // One InstancedMesh per rock model: ~14 draw calls for the whole ring.
  const batches = useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    return geos.map((geo, gi) => {
      const mine = placements.filter((p) => p.geo === gi);
      const mats = mine.map((p) => m.compose(new THREE.Vector3(...p.pos), q.setFromEuler(new THREE.Euler(0, p.rot, 0)), new THREE.Vector3(...p.scale)).clone());
      return { geo, mats };
    });
  }, [geos, placements]);

  return (
    <group>
      {batches.map((b, i) =>
        b.mats.length ? <RockBatch key={i} geometry={b.geo} material={material} matrices={b.mats} /> : null,
      )}
    </group>
  );
}

function RockBatch({ geometry, material, matrices }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mt, i) => mesh.setMatrixAt(i, mt));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} />;
}

/* ── Water (three.js water normals, MIT) ──────────────────────────────────── */
export function Water() {
  const normal = useTexture(TEXTURES.waterNormals);
  useLayoutEffect(() => {
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(3, 1.2);
  }, [normal]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    normal.offset.x += dt * 0.012;
    normal.offset.y += dt * 0.02;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, WATER_Y, POND.z]}>
      <planeGeometry args={[POND.rx * 2.4, POND.rz * 2.4]} />
      <MeshReflectorMaterial
        ref={mat as never}
        resolution={768}
        blur={[180, 40]}
        mixBlur={0.6}
        mixStrength={1.4}
        mirror={0.9}
        roughness={0.35}
        metalness={0.55}
        depthScale={0}
        color={PALETTE.water}
        normalMap={normal}
        normalScale={new THREE.Vector2(0.12, 0.12)}
      />
    </mesh>
  );
}

/* ── Lighting ─────────────────────────────────────────────────────────────── */
export function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffe0cc", "#6e2408", 1.4]} />
      <directionalLight position={[-12, 14, -10]} intensity={1.8} color="#ffc29e" />
      <directionalLight position={[8, 6, 12]} intensity={0.5} color="#ffd9c4" />
      <Environment files={HDRI} environmentIntensity={0.35} />
    </>
  );
}

ROCKS.forEach((r) => useGLTF.preload(r));
