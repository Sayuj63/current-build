"use client";

import { Center, Environment, RoundedBox, Text3D } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { HDRI } from "@/lib/assets";

/**
 * The floating 3D badge beside the toolkit: a dark glossy plaque with the
 * group's glyph extruded in orange (three.js's Helvetiker typeface). Switching
 * groups spins the plaque away edge-on, swaps the glyph out of sight, and
 * spins the new one back in — the same beat as the reference's trophies.
 */
const FONT = "/fonts/helvetiker_bold.typeface.json";

function Badge({ glyph }: { glyph: string }) {
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState(glyph);
  const turn = useRef(0); // 0 facing, 1 edge-on

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const want = shown === glyph ? 0 : 1;
    turn.current = THREE.MathUtils.damp(turn.current, want, 7, dt);
    if (want === 1 && turn.current > 0.97) setShown(glyph); // swap while edge-on
    const t = state.clock.elapsedTime;
    g.rotation.y = -0.45 + Math.sin(t * 0.5) * 0.25 + turn.current * Math.PI * 0.5;
    g.rotation.x = 0.12 + Math.sin(t * 0.37) * 0.08;
    g.rotation.z = 0.18 + Math.sin(t * 0.29) * 0.05;
    g.position.y = Math.sin(t * 0.8) * 0.12;
  });

  return (
    <group ref={group}>
      <RoundedBox args={[2.1, 3.3, 0.55]} radius={0.12} smoothness={4}>
        <meshPhysicalMaterial color="#1c0b05" roughness={0.28} metalness={0.4} clearcoat={1} clearcoatRoughness={0.15} />
      </RoundedBox>
      <group position={[0, -0.15, 0.28]}>
        <Center key={shown}>
          <Text3D font={FONT} size={shown.length > 2 ? 0.55 : 0.95} height={0.18} bevelEnabled bevelSize={0.02} bevelThickness={0.03} curveSegments={8}>
            {shown}
            <meshPhysicalMaterial color="#ff5b14" roughness={0.25} metalness={0.2} clearcoat={0.8} emissive="#ff5b14" emissiveIntensity={0.15} />
          </Text3D>
        </Center>
      </group>
      <mesh position={[0.62, 1.2, 0.28]}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial color="#8a6a5c" roughness={0.4} />
      </mesh>
    </group>
  );
}

export function ToolkitBadge({ glyph, active }: { glyph: string; active: boolean }) {
  return (
    <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 35 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <Environment files={HDRI} environmentIntensity={0.8} />
      <Badge glyph={glyph} />
    </Canvas>
  );
}
