"use client";

import gsap from "gsap";
import { type RefObject, useEffect } from "react";
import { playOnce } from "@/lib/audio";
import { glText } from "@/lib/glText";
import { CHAPTER_STEPS, RING_STEP } from "@/lib/journey";
import { JOURNEY_END, motion } from "@/lib/motion";
import { paperScroll } from "@/lib/paper";

/**
 * The chapter director.
 *
 * Scrolling never scrubs the film directly. Each deliberate gesture moves a
 * whole-number *target* one step; the journey progress `motion.p` then glides
 * to it on a critically damped spring — it always finishes on its own, never
 * rests between chapters, and never jerks when retargeted mid-move. A gesture
 * made while a move is in flight queues the next step, so continuous scrolling
 * keeps travelling instead of feeling dead.
 *
 * Everything on screen is a pure function of `motion.p`: the camera orbit and
 * the mark's shape read it in the render loop, and this hook derives every
 * line of type from it each frame. Scrolling back is therefore an exact
 * reversal, and nothing can drift out of sync.
 *
 * Inside each `[data-chapter]` section:
 *   .ch-pill    label; pops in        .ch-indent  slides into its indent
 *   [data-gl]   lines; rise / melt    .ch-arrow   lands as the indent opens
 */

const OMEGA = 2.05; // spring stiffness — one step glides for ~2.5 s
const OMEGA_PORTAL = 1.35; // the white portal opens slower still (~3.5 s)
const GAP_MS = 200; // wheel silence that ends a gesture
const THRESHOLD = 26; // accumulated wheel delta that counts as intent
const MAX_LEAD = 1.6; // how far the target may run ahead of the film

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const cubicIn = (t: number) => t * t * t;
const backOut = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

type Section = {
  el: HTMLElement;
  lines: HTMLElement[];
  pills: HTMLElement[];
  arrows: HTMLElement[];
  indent: HTMLElement | null;
  indentPx: number;
};

export function useChapters(root: RefObject<HTMLElement | null>, enabled: boolean, onPaper: (on: boolean) => void) {
  useEffect(() => {
    const host = root.current;
    if (!enabled || !host) return;

    const sections: Section[] = [...host.querySelectorAll<HTMLElement>("[data-chapter]")].map((el) => {
      const indent = el.querySelector<HTMLElement>(".ch-indent");
      return {
        el,
        lines: [...el.querySelectorAll<HTMLElement>("[data-gl]")],
        pills: [...el.querySelectorAll<HTMLElement>(".ch-pill")],
        arrows: [...el.querySelectorAll<HTMLElement>(".ch-arrow")],
        indent,
        indentPx: indent ? parseFloat(getComputedStyle(indent).marginLeft) : 0,
      };
    });
    const measure = () =>
      sections.forEach((s) => {
        if (s.indent) {
          gsap.set(s.indent, { x: 0 });
          s.indentPx = parseFloat(getComputedStyle(s.indent).marginLeft);
        }
      });

    // Dev convenience: `?paper` starts on the paper sections.
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("paper")) motion.p = JOURNEY_END;
    let target = Math.round(motion.p);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __journey: object }).__journey = { motion, get target() { return target; } };
    }
    let vel = 0;
    let settled = false;
    let paper = false;

    /* ── Per-frame layout of every chapter's type, from motion.p ─────────
       A chapter's type rises in over the second half of the step that
       arrives at it, holds through the next step (the camera keeps turning),
       then slides away with the camera and melts over the step after. The
       incoming type enters from the side the camera is heading, still warped,
       and settles. The ring chapter dims instead, as we dive into the ring. */
    const layout = (P: number) => {
      let warp = 0;
      const vw = window.innerWidth;
      sections.forEach((s, i) => {
        const at = CHAPTER_STEPS[i];
        const e = i === 0 ? 1 : clamp01((P - (at - 1) - 0.5) / 0.5);
        const x = at < RING_STEP ? clamp01((P - (at + 1)) / 0.5) : 0;
        const dim = at === RING_STEP ? 1 - (smooth(RING_STEP, RING_STEP + 1, P) * 0.62 + smooth(RING_STEP + 1, RING_STEP + 1.45, P) * 0.38) : 1;

        const visible = e > 0 && x < 1 && dim > 0.001;
        s.el.style.visibility = visible ? "visible" : "hidden";
        if (!visible) return;
        if (at < RING_STEP) warp = Math.max(warp, smooth(0, 0.7, x) * (1 - smooth(0.85, 1, x)));
        if (i > 0) warp = Math.max(warp, smooth(0, 0.12, e) * (1 - smooth(0.25, 0.95, e)) * 0.85);

        // Travel with the camera: out to the left, in from the right.
        const slideOut = -0.2 * vw;
        const slideIn = 0.16 * vw;

        const n = s.lines.length;
        const st = Math.min(0.07, 0.4 / Math.max(1, n));
        s.lines.forEach((line, j) => {
          const ej = clamp01((e - j * st) / (1 - (n - 1) * st));
          const xj = clamp01((x - j * 0.03) / (1 - (n - 1) * 0.03));
          const inn = expoOut(ej);
          gsap.set(line, {
            x: slideIn * (1 - inn) + slideOut * cubicIn(xj),
            yPercent: 70 * (1 - inn) + 25 * cubicIn(xj),
            opacity: (1 - smooth(0, 0.85, xj)) * dim,
          });
        });

        const pe = clamp01(e / 0.45);
        const out = 1 - clamp01(x / 0.4);
        const pillX = slideIn * (1 - expoOut(pe)) + slideOut * cubicIn(x);
        s.pills.forEach((pill) => gsap.set(pill, { x: pillX, scale: 0.7 + 0.3 * backOut(pe), opacity: pe * out * dim }));

        // The indented line arrives flush left and holds; on the next scroll
        // (while the type stays) it slides over and the ↪ lands in front.
        const hold = i === 0 ? 1 : clamp01((P - at - 0.05) / 0.55);
        const gi = smooth(0, 1, hold);
        if (s.indent) gsap.set(s.indent, { x: -s.indentPx * (1 - gi) });
        const ai = expoOut(clamp01((hold - 0.35) / 0.65));
        s.arrows.forEach((a) => gsap.set(a, { opacity: ai * out * dim, x: -14 * (1 - ai) + slideOut * cubicIn(x) }));
      });
      glText.warp = warp;

      // The paper fades in under the last of the portal, so when the opening
      // finishes the cream page is already there — no empty white beat.
      const nowPaper = paper ? P > JOURNEY_END - 0.4 : P > JOURNEY_END - 0.3;
      if (nowPaper !== paper) {
        paper = nowPaper;
        onPaper(paper);
      }
    };

    /* ── Spring toward the target ─────────────────────────────────────────── */
    const tick = (_t: number, deltaMs: number) => {
      const dt = Math.min(deltaMs / 1000, 1 / 30);
      const P = motion.p;
      const w = target === JOURNEY_END && P > JOURNEY_END - 1.2 ? OMEGA_PORTAL : OMEGA;
      const acc = w * w * (target - P) - 2 * w * vel;
      vel += acc * dt;
      let next = P + vel * dt;
      if (Math.abs(target - next) < 1e-4 && Math.abs(vel) < 1e-3) {
        next = target;
        vel = 0;
        if (!settled) {
          settled = true;
          motion.p = next;
          motion.v = 0;
          layout(next);
          glText.live = false;
          glText.version++;
        }
        return;
      }
      settled = false;
      motion.p = next;
      motion.v = vel;
      glText.live = true;
      layout(next);
    };
    gsap.ticker.add(tick);

    const step = (dir: 1 | -1) => {
      const next = Math.min(JOURNEY_END, Math.max(0, target + dir));
      if (next === target || Math.abs(next - motion.p) > MAX_LEAD) return;
      target = next;
      settled = false;
      // A soft swell only when a chapter's type is about to arrive, or on the dive.
      if (dir > 0 && (CHAPTER_STEPS.includes(next) || next >= RING_STEP + 1)) playOnce("chapter", 0.6);
    };

    /* ── Input ─────────────────────────────────────────────────────────────
       A gesture is armed by a pause in wheel events, a change of direction,
       or a fresh surge on top of a decaying trackpad tail — so an inertial
       flick steps once, yet you can always scroll straight back. */
    let acc = 0;
    let last = 0;
    let lastAbs = 0;
    let lastDir = 0;
    let armed = true;
    // On the paper, scrolling belongs to the paper. Only a scroll up made
    // after it has rested at its very top hands back to the 3D journey.
    const paperHolds = (d: number) => {
      if (target !== JOURNEY_END || motion.p < JOURNEY_END - 0.05) return false;
      if (d > 0) return true;
      return !(paperScroll.y <= 0.5 && paperScroll.topSince > 0 && performance.now() - paperScroll.topSince > 350);
    };

    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (paperHolds(d)) {
        last = now;
        armed = false;
        return;
      }
      const dir = Math.sign(d);
      const abs = Math.abs(d);
      if (now - last > GAP_MS || (dir !== 0 && dir !== lastDir) || abs > lastAbs * 1.8 + 6) {
        armed = true;
        acc = 0;
      }
      last = now;
      lastAbs = abs;
      if (dir !== 0) lastDir = dir;
      if (!armed) return;
      acc += d;
      if (Math.abs(acc) > THRESHOLD) {
        const dirStep = acc > 0 ? 1 : -1;
        armed = false;
        acc = 0;
        step(dirStep);
      }
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - e.touches[0].clientY;
      if (paperHolds(dy)) return;
      if (Math.abs(dy) > 40) {
        step(dy > 0 ? 1 : -1);
        touchY = null;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const up = ["ArrowUp", "PageUp"].includes(e.key);
      if (paperHolds(up ? -1 : 1)) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) step(1);
      else if (["ArrowUp", "PageUp"].includes(e.key)) step(-1);
    };
    const onResize = () => {
      measure();
      layout(motion.p);
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    layout(motion.p);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [root, enabled, onPaper]);
}
