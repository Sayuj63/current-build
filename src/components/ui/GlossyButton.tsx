"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Drifting colour blobs painted into a small canvas, then blurred by CSS.
 * This is what gives the pill its liquid, glossy interior.
 */
function useGradientCanvas(colors: string[]) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const blobs = colors.map((col, i) => ({
      c: col.slice(0, col.lastIndexOf(",")).replace("rgba(", ""),
      a: parseFloat(col.slice(col.lastIndexOf(",") + 1)),
      phase: i * 2.1,
      speed: 0.35 + i * 0.12,
    }));

    let raf = 0;
    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      const s = t / 1000;
      for (const b of blobs) {
        const x = w * (0.5 + 0.42 * Math.sin(s * b.speed + b.phase));
        const y = h * (0.5 + 0.55 * Math.cos(s * b.speed * 1.3 + b.phase));
        const r = Math.max(w, h) * 0.38;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        // Fade to the same hue at zero alpha; "transparent" is black and greys the pill.
        grad.addColorStop(0, `rgba(${b.c},${b.a})`);
        grad.addColorStop(1, `rgba(${b.c},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [colors]);

  return ref;
}

const LIGHT = ["rgba(255,138,76,0.75)", "rgba(255,255,255,0.9)", "rgba(255,91,20,0.55)"];
const DARK = ["rgba(255,91,20,0.85)", "rgba(255,190,150,0.6)", "rgba(181,57,11,0.8)"];

type Props = {
  children: string;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  size?: "md" | "sm";
  tone?: "dark" | "light";
  onClick?: () => void;
  href?: string;
  className?: string;
};

export function GlossyButton({ children, icon, iconEnd, size = "md", tone = "dark", onClick, href, className = "" }: Props) {
  const canvasRef = useGradientCanvas(tone === "light" ? DARK : LIGHT);
  const cls = `gbtn ${size === "sm" ? "gbtn--sm" : ""} ${tone === "light" ? "gbtn--light" : ""} ${className}`;

  const inner = (
    <>
      <span className="gbtn__canvas" aria-hidden="true">
        <canvas ref={canvasRef} />
      </span>
      {icon && <span className="gbtn__icon">{icon}</span>}
      <span className="gbtn__label">
        <span>{children}</span>
        <span aria-hidden="true">{children}</span>
      </span>
      {iconEnd && <span className="gbtn__icon">{iconEnd}</span>}
      <span className="gbtn__shadow" aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <a className={cls} href={href}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
