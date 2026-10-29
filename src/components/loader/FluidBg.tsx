"use client";

import { forwardRef, useEffect, useRef } from "react";

/**
 * Cursor smoke for the gate. Pavel Dobryakov's WebGL fluid simulation (MIT),
 * via the webgl-fluid-enhanced wrapper (MIT). Tuned for a light page: long
 * lingering dye in peach/orange, no bloom or sunrays, and a heavy CSS blur on
 * top so it reads as soft vapour rather than ink.
 */
export const FluidBg = forwardRef<HTMLDivElement>(function FluidBg(_, outerRef) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sim: import("webgl-fluid-enhanced").default | null = null;
    let idle: ReturnType<typeof setInterval> | undefined;
    let last = performance.now();
    const onMove = () => (last = performance.now());
    let cancelled = false;

    (async () => {
      const { default: WebGLFluidEnhanced } = await import("webgl-fluid-enhanced");
      if (cancelled) return;
      sim = new WebGLFluidEnhanced(el);
      sim.setConfig({
        simResolution: 128,
        dyeResolution: 512,
        densityDissipation: 0.45,
        velocityDissipation: 0.5,
        pressure: 0.8,
        curl: 16,
        splatRadius: 0.4,
        splatForce: 3200,
        shading: false,
        colorful: false,
        colorPalette: ["#ff8a4c", "#ff6a26", "#ffb48c", "#ff7a3d"],
        hover: true,
        transparent: true,
        brightness: 0.9,
        bloom: false,
        sunrays: false,
      });
      sim.start();

      // A slow plume so the gate is alive before the visitor moves.
      const plume = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        sim?.splatAtLocation(w * (0.25 + Math.random() * 0.5), h * 0.85, (Math.random() - 0.5) * 300, -600);
      };
      plume();
      idle = setInterval(() => {
        if (performance.now() - last > 2500) plume();
      }, 2600);
    })();

    window.addEventListener("pointermove", onMove);
    return () => {
      cancelled = true;
      clearInterval(idle);
      window.removeEventListener("pointermove", onMove);
      sim?.stop();
      el.innerHTML = "";
    };
  }, []);

  return (
    <div ref={outerRef} className="pointer-events-none absolute inset-0">
      <div
        ref={ref}
        className="pointer-events-auto absolute inset-0"
        style={{ filter: "blur(22px) saturate(1.15)", opacity: 0.85 }}
      />
    </div>
  );
});
