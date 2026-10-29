"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { PROJECTS, type Project } from "@/content/work";
import { paperScroll } from "@/lib/paper";
import { ReturnArrow } from "../ui/icons";
import { CardsGL } from "./cardsGL";

/**
 * "Some of my projects": uneven cards spread across the width, the way the
 * reference lays them out. Positions are in vw so the composition scales.
 * Each entry: left, top, width (vw) and the image aspect (w / h).
 */
const LAYOUT = [
  { left: 3.3, top: 0, width: 22.5, aspect: 0.8 },
  { left: 50.5, top: 15, width: 14.6, aspect: 0.88 },
  { left: 74.2, top: 0, width: 22.5, aspect: 0.8 },
  { left: 27, top: 41, width: 14.6, aspect: 0.88 },
  { left: 58.4, top: 41, width: 22.5, aspect: 0.8 },
  { left: 3.3, top: 79, width: 22.5, aspect: 0.8 },
  { left: 42.7, top: 79, width: 14.6, aspect: 0.88 },
];
const HEIGHT_VW = 124;

function host(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function Details({ p, i }: { p: Project; i: number }) {
  const rows: [string, string[]][] = [
    ["Client:", [p.name]],
    ["Type:", [p.type]],
    ["Scope:", p.scope],
    ["Stack:", p.stack],
    ["Live:", [host(p.url)]],
  ];
  return (
    <div className="pcard__details mono" aria-hidden="true">
      <div className="pcard__drow" style={{ ["--i" as string]: 0 }}>
        <span>Prjct</span>
        <span>/{String(i + 1).padStart(2, "0")}</span>
      </div>
      {rows.map(([k, v], j) => (
        <div key={k} className="pcard__drow" style={{ ["--i" as string]: j + 1, ["--indent" as string]: `${(j % 4) * 9 + 5}%` }}>
          <span>{k}</span>
          <span className="pcard__dval">
            {v.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Projects({ active, gl: glOn }: { active: boolean; gl: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const cv = canvas.current;
    const el = root.current;
    if (!glOn || !cv || !el) return;
    const gl = new CardsGL(cv);
    const cleanups: (() => void)[] = [];

    el.querySelectorAll<HTMLElement>(".pcard").forEach((card) => {
      const media = card.querySelector<HTMLElement>(".pcard__media")!;
      const img = media.querySelector("img")!;
      const api = gl.add(media, img.currentSrc || img.src, () => card.classList.add("is-gl"));
      const enter = () => {
        api.hover(true);
        card.classList.add("is-hover");
      };
      const leave = () => {
        api.hover(false);
        card.classList.remove("is-hover");
      };
      const move = (e: PointerEvent) => {
        const r = media.getBoundingClientRect();
        api.pointer((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      };
      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointerleave", leave);
      card.addEventListener("pointermove", move);
      cleanups.push(() => {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("pointerleave", leave);
        card.removeEventListener("pointermove", move);
      });
    });

    // Header reveal when it scrolls into view.
    const head = el.querySelector(".proj__head");
    const io = new IntersectionObserver(([e]) => head?.classList.toggle("is-in", e.isIntersecting), { threshold: 0.2 });
    if (head) io.observe(head);

    let vel = 0;
    const tick = (t: number, dms: number) => {
      if (!activeRef.current) return;
      vel += (paperScroll.velocity - vel) * 0.12;
      gl.frame(t, Math.min(dms / 1000, 1 / 20), vel);
    };
    gsap.ticker.add(tick);
    const onResize = () => gl.resize();
    window.addEventListener("resize", onResize);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      cleanups.forEach((c) => c());
      gl.dispose();
    };
  }, [glOn]);

  return (
    <section ref={root} className="proj" id="work" aria-labelledby="proj-title">
      <canvas ref={canvas} className="proj__gl" aria-hidden="true" />
      <header className="proj__head">
        <h2 id="proj-title" className="proj__title serif">
          <span className="line-mask proj__w1">
            <span>Some</span>
          </span>
          <span className="line-mask proj__w2">
            <span className="italic">Of my</span>
          </span>
          <span className="proj__arrow" aria-hidden="true">
            <svg viewBox="0 0 48 16">
              <path className="shaft" d="M2 8H45" />
              <path className="head" d="M38 2l7 6-7 6" />
            </svg>
          </span>
          <span className="line-mask proj__w3">
            <span>Projects</span>
          </span>
        </h2>
        <p className="proj__sub mono">
          A selection of projects where design,
          <br />
          engineering and strategy come together
        </p>
      </header>

      <div className="proj__grid" style={{ ["--h" as string]: `${HEIGHT_VW}vw` }}>
        {PROJECTS.slice(0, LAYOUT.length).map((p, i) => {
          const l = LAYOUT[i];
          return (
            <a
              key={p.slug}
              className="pcard"
              href={p.url}
              target="_blank"
              rel="noopener"
              style={{ ["--l" as string]: `${l.left}vw`, ["--t" as string]: `${l.top}vw`, ["--w" as string]: `${l.width}vw` }}
            >
              <div className="pcard__media" style={{ aspectRatio: String(l.aspect) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/work/${p.slug}.jpg`} alt={`${p.name} storefront`} loading="eager" />
                <Details p={p} i={i} />
              </div>
              <p className="pcard__tags mono">{p.tags.join(" / ")}</p>
              <h3 className="pcard__title serif">
                <span className="pcard__arrow" aria-hidden="true">
                  <ReturnArrow />
                </span>
                <span className="pcard__name">{p.name}</span>
              </h3>
            </a>
          );
        })}
      </div>
    </section>
  );
}
