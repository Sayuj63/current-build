"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, RAINBOW, REPOS } from "@/content/repos";
import { motion } from "@/lib/motion";
import { Glitter } from "../paper/Glitter";
import { ReturnArrow } from "../ui/icons";
import { Assistant, SiteHeader } from "../ui/SiteHeader";
import { type RingControl, SLOTS, STEP } from "./Ring";

const Ring = dynamic(() => import("./Ring").then((m) => m.Ring), { ssr: false });

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h14M5.5 10h9M8 14h4" />
    </svg>
  );
}

const hsl = (h: number, s = 90, l = 56) => `hsl(${h} ${s}% ${l}%)`;

/**
 * /work — every project on an endlessly turning drum. It always flows; wheel,
 * drag, arrow keys and the scrubber ride on top of the flow. Each card hover
 * moves the whole room one step around a rainbow, and the cursor leaves the
 * same liquid wake and smoke as the home page.
 *
 * Arrival order: header and type first, then the carousel rises in last.
 */
export function WorkPage() {
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [hueStep, setHueStep] = useState(0);
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState<"type" | "ring">("type");
  const ctl = useRef<RingControl>({ rot: 0, vel: 0, target: null, lastInput: 0, hovered: -1, hue: RAINBOW[0] });
  const title = useRef<HTMLDivElement>(null);

  const repos = useMemo(() => (filter === "All" ? REPOS : REPOS.filter((r) => r.category === filter)), [filter]);
  const n = repos.length;
  const current = repos[((active % n) + n) % n];
  const hue = RAINBOW[hueStep % RAINBOW.length];

  // Every hover is a step around the rainbow — the 3D room eases to it too.
  const onHover = () => setHueStep((k) => k + 1);
  useEffect(() => {
    ctl.current.hue = hue;
  }, [hue]);

  // Type first; the carousel only mounts once the fonts are in and the
  // headline has had its moment.
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      setTimeout(() => alive && setStage("ring"), 900);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The cursor wake reads the shared pointer, like on the home page.
  useEffect(() => {
    motion.reveal = 1;
    const onMove = (e: PointerEvent) => {
      motion.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      motion.pointerSeen = true;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Read the focused card off the drum each frame; re-render only when it changes.
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      const slot = ((Math.round(-ctl.current.rot / STEP) % SLOTS) + SLOTS) % SLOTS;
      const idx = slot % n;
      if (idx !== last) {
        last = idx;
        setActive(idx);
        const t = title.current;
        if (t) {
          t.classList.remove("is-in");
          void t.offsetWidth;
          t.classList.add("is-in");
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [n]);

  const go = (dir: number) => {
    const c = ctl.current;
    const base = c.target ?? Math.round(c.rot / STEP) * STEP;
    c.target = base - dir * STEP;
    c.lastInput = performance.now();
  };
  const stepRef = useRef(go);
  useEffect(() => {
    stepRef.current = go;
  });

  // Input rides on top of the flow: wheel steps a card per ~70px, drag throws.
  useEffect(() => {
    const c = ctl.current;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      acc += (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) + e.deltaX;
      while (Math.abs(acc) >= 70) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * 70;
        stepRef.current(dir);
      }
    };
    let dragX: number | null = null;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      dragX = e.clientX;
      lastT = performance.now();
      c.target = null;
    };
    const move = (e: PointerEvent) => {
      if (dragX === null) return;
      const dx = e.clientX - dragX;
      const now = performance.now();
      dragX = e.clientX;
      c.rot += dx * 0.0042;
      c.vel = (dx * 0.0042) / Math.max(0.008, (now - lastT) / 1000);
      lastT = now;
    };
    const up = () => (dragX = null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") stepRef.current(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") stepRef.current(-1);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
  }, []);

  const jump = (i: number) => {
    const c = ctl.current;
    const half = Math.floor(n / 2);
    const delta = ((((i - active) % n) + n + half) % n) - half;
    c.target = Math.round(c.rot / STEP) * STEP - delta * STEP;
  };
  const pick = (slot: number) => {
    const c = ctl.current;
    const front = ((Math.round(-c.rot / STEP) % SLOTS) + SLOTS) % SLOTS;
    if (slot === front) window.open(repos[slot % n].url, "_blank", "noopener");
    else {
      const delta = ((slot - front + SLOTS + SLOTS / 2) % SLOTS) - SLOTS / 2;
      c.target = Math.round(c.rot / STEP) * STEP - delta * STEP;
    }
  };

  return (
    <main className={`work work--${stage}`} style={{ ["--hue" as string]: hsl(hue), ["--hue-bg" as string]: hsl(hue, 55, 4) }}>
      <div className="work__gl">{stage === "ring" && <Ring repos={repos} ctl={ctl} onPick={pick} onHover={onHover} />}</div>
      <div className="work__smoke">
        <Glitter active />
      </div>

      <SiteHeader />

      <p className="sr-only" aria-live="polite">
        Showing {current.name} — project {active + 1} of {n}
      </p>

      <div ref={title} className="work__title is-in">
        <a href={current.url} target="_blank" rel="noopener" className="work__name serif">
          <span className="work__arrow" aria-hidden="true">
            <ReturnArrow />
          </span>
          <span className="line-mask">
            <span>{current.name}</span>
          </span>
        </a>
        <p className="work__line mono">{current.line}</p>
      </div>

      <div className="work__controls">
        <div className={`work__filter ${filterOpen ? "is-open" : ""}`}>
          <ul className="mono">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  className={c === filter ? "is-on" : ""}
                  onClick={() => {
                    setFilter(c);
                    setFilterOpen(false);
                    ctl.current.rot = 0;
                    ctl.current.target = null;
                  }}
                >
                  {c}
                  <span>{c === "All" ? REPOS.length : REPOS.filter((r) => r.category === c).length}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="work__filterbtn" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen}>
            {filter === "All" ? "Filter" : filter}
            <FilterIcon />
          </button>
        </div>
        <div className="work__scrub mono">
          <span>{String(active + 1).padStart(2, "0")}</span>
          <div className="work__ticks">
            {repos.map((r, i) => (
              <button key={r.slug} type="button" aria-label={r.name} className={i === active ? "is-on" : ""} onClick={() => jump(i)} />
            ))}
          </div>
          <span>{String(n).padStart(2, "0")}</span>
        </div>
      </div>

      <Assistant />
    </main>
  );
}
