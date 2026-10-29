"use client";

import gsap from "gsap";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { TOOLKIT } from "@/content/work";

const ToolkitBadge = dynamic(() => import("./ToolkitBadge").then((m) => m.ToolkitBadge), { ssr: false });

const TOTAL = TOOLKIT.reduce((n, g) => n + g.items.length, 0);

/**
 * Skills & toolkit. The group nearest the middle of the screen is the active
 * one (hovering a group overrides it); inactive groups fade back, and the 3D
 * badge in the left column swaps to the active group's glyph.
 */
export function Toolkit({ active, gl }: { active: boolean; gl: boolean }) {
  const root = useRef<HTMLElement>(null);
  const groups = useRef<HTMLDivElement[]>([]);
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const shown = hovered ?? current;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    let last = -1;
    const tick = () => {
      const mid = window.innerHeight * 0.5;
      let best = 0;
      let bestD = Infinity;
      groups.current.forEach((g, i) => {
        const r = g.getBoundingClientRect();
        const d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== last) {
        last = best;
        setCurrent(best);
      }
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
    };
  }, []);

  return (
    <section ref={root} className="kit" aria-labelledby="kit-title">
      <header className="kit__head">
        <h2 id="kit-title" className="kit__title serif">
          Skills &amp;
          <br />
          Toolkit
        </h2>
        <p className="kit__sub mono">
          The tools I reach for — sharpened on
          <br />
          live client work, not tutorials
        </p>
        <span className="ch-pill mono kit__total">Total: {TOTAL}</span>
      </header>

      <div className="kit__body">
        <div className="kit__stage" aria-hidden="true">
          <div className="kit__canvas">
            {gl && <ToolkitBadge glyph={TOOLKIT[shown].glyph} active={active && inView} />}
          </div>
        </div>
        {TOOLKIT.map((g, i) => (
          <div
            key={g.group}
            ref={(el) => {
              if (el) groups.current[i] = el;
            }}
            className={`kit__group ${i === shown ? "is-active" : ""}`}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
          >
            <p className="kit__label">
              {g.group}
              <sup className="mono">[{g.items.length}]</sup>
            </p>
            <ul className="kit__items">
              {g.items.map(([name, tag]) => (
                <li key={name}>
                  <span className="serif">{name}</span>
                  <span className="mono">{tag}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
