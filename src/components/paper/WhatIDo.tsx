"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { SERVICES } from "@/content/work";
import { paperScroll } from "@/lib/paper";
import { GlossyButton } from "../ui/GlossyButton";
import { ReturnArrow } from "../ui/icons";

const STATEMENT =
  "I design and engineer digital products for ambitious brands — from Shopify storefronts to data pipelines and AI tools. I start with why, then design, build and ship the rest";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Pinned "What I do". Everything is a function of how far the paper has
 * scrolled through this section, so it scrubs both ways and can rest at any
 * point:
 *   fill   the statement's words darken one after another
 *   list   the services rise through a focus line; the row on the line goes
 *          dark and its number becomes ↪, rows fade with distance from it
 *   flow   when the last row reaches the line, the pin releases
 */
export function WhatIDo() {
  const section = useRef<HTMLElement>(null);
  const words = useRef<HTMLSpanElement[]>([]);
  const rows = useRef<HTMLLIElement[]>([]);
  const list = useRef<HTMLUListElement>(null);
  const cta = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let lastActive = -1;
    let lastKey = "";
    const tick = () => {
      const vh = window.innerHeight;
      const s = paperScroll.y - el.offsetTop; // px scrolled into the pin
      const key = `${Math.round(s)}:${vh}`;
      if (key === lastKey) return; // nothing moved — no DOM writes at all
      lastKey = key;
      const rowH = rows.current[0]?.offsetHeight || 56;
      const n = rows.current.length;

      // Fill: one deliberate scroll (~a third of a screen) inks the statement.
      const fill = s / (vh * 0.32);
      const W = words.current.length;
      words.current.forEach((w, i) => {
        const k = smooth(i / W - 0.06, i / W + 0.1, fill);
        w.style.opacity = String(0.26 + 0.74 * k);
      });
      if (cta.current) {
        const c = smooth(0.8, 1.1, fill);
        cta.current.style.opacity = String(c);
        cta.current.style.transform = `translateY(${(1 - c) * 18}px)`;
      }

      // List: lives in the lower right, below the statement. Rows rise past a
      // focus line; only four are ever in view — the active one, one above,
      // two below — and the top one fades as the next arrives.
      const focus = vh * 0.66;
      const listStart = vh * 0.3;
      const startY = vh + rowH;
      // Release the pin when the last four rows are coming in, so the next
      // section starts rising while the list is still playing.
      const maxShift = startY - focus + (n - 4) * rowH;
      const shift = Math.min(maxShift + (n - 1 - (n - 4)) * rowH, Math.max(0, s - listStart));
      if (list.current) list.current.style.transform = `translate3d(0, ${startY - shift - focus}px, 0)`;
      let active = -1;
      let best = Infinity;
      rows.current.forEach((r, i) => {
        const y = startY - shift + i * rowH;
        const d = (y - focus) / rowH;
        if (Math.abs(d) < best) {
          best = Math.abs(d);
          active = i;
        }
        // window: −1 … +2 around the focus line, soft edges
        const vis = smooth(-2.1, -1.1, d) * (1 - smooth(2.2, 3.1, d));
        const enter = smooth(0, 1, (vh - y) / (rowH * 2.5));
        r.style.opacity = String(vis * enter);
        r.style.transform = `translate3d(${-(1 - enter) * 40}px, 0, 0)`;
      });
      if (s - listStart < -rowH) active = -1;
      if (active !== lastActive) {
        rows.current.forEach((r, i) => r.classList.toggle("is-active", i === active));
        lastActive = active;
      }
      const need = vh + listStart + maxShift;
      if (Math.abs(el.offsetHeight - need) > 2) el.style.height = `${need}px`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const parts = STATEMENT.split(" ");
  return (
    <section ref={section} className="wid" aria-labelledby="wid-title">
      <div className="wid__pin">
        <span className="ch-pill mono wid__pill">What I do</span>
        <p id="wid-title" className="wid__statement serif">
          <span className="wid__arrow" aria-hidden="true">
            <ReturnArrow />
          </span>
          {parts.map((w, i) => (
            <span
              key={i}
              ref={(el) => {
                if (el) words.current[i] = el;
              }}
              className="wid__word"
            >
              {w}{" "}
            </span>
          ))}
        </p>
        <div ref={cta} className="wid__cta">
          <GlossyButton href="#about" iconEnd={<ReturnArrow />}>
            More about me
          </GlossyButton>
        </div>
        <ul ref={list} className="wid__list" aria-label="Services">
          {SERVICES.map((name, i) => (
            <li
              key={name}
              ref={(el) => {
                if (el) rows.current[i] = el;
              }}
              className="wid__row"
            >
              <span className="wid__num mono">
                <span className="wid__n">({String(i + 1).padStart(3, "0")})</span>
                <span className="wid__a" aria-hidden="true">
                  <ReturnArrow />
                </span>
              </span>
              <span className="wid__name">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
