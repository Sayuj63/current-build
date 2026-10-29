"use client";

import { useEffect, useRef } from "react";

/**
 * The soft white vapour that follows the cursor across the paper — the same
 * MIT fluid simulation as the gate, tuned pale and slow. The content sits
 * above it, so the pointer is fed in by hand from window events.
 */
export function Glitter({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sim: import("webgl-fluid-enhanced").default | null = null;
    let cancelled = false;
    let last: { x: number; y: number } | null = null;

    (async () => {
      const { default: Fluid } = await import("webgl-fluid-enhanced");
      if (cancelled) return;
      sim = new Fluid(el);
      sim.setConfig({
        simResolution: 64,
        dyeResolution: 256,
        densityDissipation: 0.9,
        velocityDissipation: 0.9,
        pressure: 0.7,
        curl: 8,
        splatRadius: 0.32,
        splatForce: 2200,
        shading: false,
        colorful: false,
        colorPalette: ["#ffffff", "#fff4ec", "#ffe6d6"],
        hover: false,
        transparent: true,
        brightness: 0.9,
        bloom: false,
        sunrays: false,
      });
      sim.start();
    })();

    const onMove = (e: PointerEvent) => {
      if (!activeRef.current || !sim) {
        last = null;
        return;
      }
      if (last) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 1) sim.splatAtLocation(e.clientX, e.clientY, dx * 6, -dy * 6);
      }
      last = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", onMove);
      sim?.stop();
      el.innerHTML = "";
    };
  }, []);

  // The library sets its own container to position: relative, so it lives
  // inside a fixed layer it cannot touch.
  return (
    <div className="paper__glitter" aria-hidden="true">
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
