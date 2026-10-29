"use client";

import { PerformanceMonitor, Sparkles } from "@react-three/drei";
import { Canvas, type RootState } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { motion } from "@/lib/motion";
import { useApp } from "@/lib/store";
import { CameraRig, Warmup } from "./CameraRig";
import { Effects } from "./Effects";
import { Grass } from "./Grass";
import { Ground, Lights, PALETTE, Rocks, Sky, SkyClouds, Water } from "./Landscape";
import { ParticleMark } from "./ParticleMark";
import { Birds, Leaves } from "./Atmosphere";
import { TextLayer } from "./TextLayer";
import { Trail } from "./Trail";

/**
 * The world. Mounted on first paint, underneath the loader, so it downloads,
 * compiles and renders while the visitor is still on the gate.
 */
export function Experience() {
  // Decided once, before the first render, so the field is never built twice.
  const [lite] = useState(() => window.matchMedia("(max-width: 768px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4);

  // Covered by the paper: stop drawing the world entirely.
  const paper = useApp((s) => s.paper);

  // Adaptive resolution: starts at full quality and steps down (never below
  // 1x) if the machine can't hold the frame rate, so slower laptops stay smooth.
  const maxDpr = lite ? 1.25 : 1.6;
  const [dpr, setDpr] = useState(maxDpr);

  // If the browser drops the GL context (GPU pressure, tab switch), ask for it
  // back instead of leaving a blank frame.
  const onCreated = ({ gl }: RootState) => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", (e) => e.preventDefault(), false);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      motion.pointerSeen = true;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true" style={{ background: "#ffe2cc" }}>
      <Canvas
        frameloop={paper ? "never" : "always"}
        dpr={dpr}
        onCreated={onCreated}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 38, near: 0.1, far: 400, position: [0, 2.9, 18.5] }}
      >
        <color attach="background" args={[PALETTE.skyHorizon]} />
        <fog attach="fog" args={[PALETTE.fog, 24, 92]} />
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(1, +(d - 0.2).toFixed(2)))}
          onIncline={() => setDpr((d) => Math.min(maxDpr, +(d + 0.1).toFixed(2)))}
        />
        <CameraRig />
        <Trail />
        <Suspense fallback={null}>
          <Sky />
          <SkyClouds />
          <Lights />
          <Ground />
          <Rocks />
          <Water />
          <Grass lite={lite} />
          <ParticleMark count={lite ? 9000 : 22000} />
          {/* Constant ambient life: pollen, embers, leaves, a passing flock. */}
          <Sparkles count={lite ? 70 : 160} scale={[36, 10, 20]} position={[0, 4.5, -5]} size={3.4} speed={0.35} opacity={0.95} color="#fff4ea" noise={1.2} />
          <Sparkles count={lite ? 30 : 70} scale={[30, 8, 16]} position={[0, 3.5, -3]} size={5} speed={0.5} opacity={0.8} color="#ffb48a" noise={2} />
          <Leaves count={lite ? 60 : 150} />
          <Birds />
          <TextLayer />
          <Warmup />
        </Suspense>
        <Effects lite={lite} />
      </Canvas>
    </div>
  );
}
