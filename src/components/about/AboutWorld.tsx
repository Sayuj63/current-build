"use client";

import { PerformanceMonitor, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { motion } from "@/lib/motion";
import { Birds, Leaves } from "../scene/Atmosphere";
import { Effects } from "../scene/Effects";
import { Grass } from "../scene/Grass";
import { Ground, Lights, PALETTE, Rocks, Sky, SkyClouds, Water } from "../scene/Landscape";
import { ParticleMark } from "../scene/ParticleMark";
import { MARK } from "../scene/terrain";
import { Trail } from "../scene/Trail";

/** Hero beat, written by the page from scroll (0…4). */
export const aboutState = { beat: 0, live: true };

/**
 * One camera shot per hero beat, around the same S as the home page:
 * θ around the mark, distance, height, look height, and `side` to slide the
 * mark across frame (− mark right, + mark left) so the type has room.
 */
const SHOTS = [
  { th: 28, r: 15.5, h: 1.5, look: 2.6, side: -3.6 }, // low, mark right
  { th: -55, r: 12.5, h: 2.2, look: 3.2, side: 3.4 }, // from the left, mark left
  { th: 0, r: 19, h: 5.4, look: 2.4, side: 0 }, // high and wide over the pond
  { th: 150, r: 13.5, h: 1.3, look: 2.9, side: 3.2 }, // behind, low
  { th: 360, r: 10.5, h: 2.9, look: 3.5, side: -2.6 }, // front, close
];

function lerpShot(b: number) {
  const i = Math.min(SHOTS.length - 2, Math.max(0, Math.floor(b)));
  const f = Math.min(1, Math.max(0, b - i));
  const e = f * f * (3 - 2 * f);
  const A = SHOTS[i];
  const B = SHOTS[i + 1];
  const L = (k: keyof typeof A) => A[k] + (B[k] - A[k]) * e;
  return { th: L("th"), r: L("r"), h: L("h"), look: L("look"), side: L("side"), arc: Math.sin(f * Math.PI) };
}

function AboutCamera() {
  const { camera } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => ({ v: 0, x: 0, intro: 0 }), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    // critically damped spring toward the scroll beat — glides, never jerks
    const w = 2.6;
    b.v += (w * w * (aboutState.beat - b.x) - 2 * w * b.v) * dt;
    b.x += b.v * dt;
    b.intro = Math.min(1, b.intro + dt / 3);
    motion.assemble = 1 - Math.pow(1 - b.intro, 3);

    const s = lerpShot(b.x);
    const t = state.clock.elapsedTime;
    const th = THREE.MathUtils.degToRad(s.th);
    const r = s.r + (1 - motion.assemble) * 6 + s.arc * 1.2;
    const px = motion.pointer.x * 0.35;
    camera.position.set(
      MARK.x + Math.sin(th) * r + Math.cos(th) * (px + Math.sin(t * 0.13) * 0.25),
      s.h + s.arc * 0.6 + motion.pointer.y * 0.15 + Math.sin(t * 0.21) * 0.08,
      MARK.z + Math.cos(th) * r - Math.sin(th) * (px + Math.sin(t * 0.13) * 0.25),
    );
    look.set(MARK.x + Math.cos(th) * s.side, s.look, MARK.z - Math.sin(th) * s.side);
    camera.lookAt(look);
    camera.rotateZ(-b.v * 0.03);
  });
  return null;
}

export function AboutWorld() {
  const [lite] = useState(() => window.matchMedia("(max-width: 768px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4);
  const [dpr, setDpr] = useState(lite ? 1.2 : 1.5);
  const [live, setLive] = useState(true);

  useEffect(() => {
    // The world is already "open" here: no gate, no portal, S in place.
    motion.reveal = 1;
    motion.intro = 1;
    motion.p = 0;
    motion.assemble = 0;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      motion.pointerSeen = true;
    };
    window.addEventListener("pointermove", onMove);
    // Stop drawing once the paper sections cover the world.
    const id = setInterval(() => setLive(aboutState.live), 250);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearInterval(id);
    };
  }, []);

  return (
    <Canvas
      frameloop={live ? "always" : "never"}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 38, near: 0.1, far: 400, position: [0, 3, 20] }}
    >
      <color attach="background" args={[PALETTE.skyHorizon]} />
      <fog attach="fog" args={[PALETTE.fog, 24, 92]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(lite ? 1.2 : 1.5)} />
      <AboutCamera />
      <Trail />
      <Suspense fallback={null}>
        <Sky />
        <SkyClouds />
        <Lights />
        <Ground />
        <Rocks />
        <Water />
        <Grass lite={lite} />
        <ParticleMark count={lite ? 8000 : 16000} />
        <Sparkles count={lite ? 60 : 120} scale={[36, 10, 20]} position={[0, 4.5, -5]} size={3.4} speed={0.35} opacity={0.95} color="#fff4ea" noise={1.2} />
        <Leaves count={lite ? 50 : 110} />
        <Birds />
      </Suspense>
      <Effects lite={lite} />
    </Canvas>
  );
}
