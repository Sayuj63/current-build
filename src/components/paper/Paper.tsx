"use client";

import gsap from "gsap";
import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import { paperScroll } from "@/lib/paper";
import { useApp } from "@/lib/store";
import { Glitter } from "./Glitter";
import { Projects } from "./Projects";
import { Footer } from "./Footer";
import { Toolkit } from "./Toolkit";
import { WhatIDo } from "./WhatIDo";

/**
 * The paper: everything after the closing portal. A separate smooth scroller
 * (Lenis on its own wrapper) so the 3D journey above it is untouched. It is
 * shown once the portal has opened and hands control back to the journey when
 * the visitor scrolls up from its very top (see useChapters).
 */
export function Paper() {
  const paper = useApp((s) => s.paper);
  const setHeaderHidden = useApp((s) => s.setHeaderHidden);
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const openRef = useRef(() => {});
  // Its WebGL layers (glitter, cards, badge) are only created once the
  // visitor first reaches the paper — never alongside the 3D world.
  const [reached, setReached] = useState(false);
  useEffect(() => {
    if (paper) setReached(true);
  }, [paper]);

  useEffect(() => {
    const w = wrapper.current;
    const c = content.current;
    if (!w || !c) return;
    const lenis = new Lenis({ wrapper: w, content: c, duration: 1.35, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 0.8, touchMultiplier: 1.3, anchors: true });
    paperScroll.lenis = lenis;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __paper: object }).__paper = paperScroll;
    lenis.stop();
    let quietUntil = 0;
    openRef.current = () => (quietUntil = performance.now() + 600);

    lenis.on("scroll", (l: Lenis) => {
      paperScroll.y = l.scroll;
      paperScroll.velocity = l.velocity;
      if (l.scroll <= 0.5) {
        if (paperScroll.topSince < 0) paperScroll.topSince = performance.now();
      } else paperScroll.topSince = -1;
      // Every scroll down tucks the header away; any scroll up brings it back.
      // Starts tucked away when the paper opens; only real scrolling moves it.
      if (performance.now() < quietUntil || Math.abs(l.velocity) < 0.5) return;
      if (l.direction < 0) setHeaderHidden(false);
      else if (l.direction > 0) setHeaderHidden(true);
    });

    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      paperScroll.lenis = null;
    };
  }, [setHeaderHidden]);

  // Start from the top each time the portal opens; freeze while hidden.
  useEffect(() => {
    const lenis = paperScroll.lenis;
    if (!lenis) return;
    if (paper) {
      openRef.current();
      setHeaderHidden(true);
      lenis.scrollTo(0, { immediate: true, force: true });
      paperScroll.topSince = performance.now();
      lenis.start();
    } else {
      lenis.stop();
    }
  }, [paper, setHeaderHidden]);

  return (
    <div
      ref={wrapper}
      className={`paper ${paper ? "paper--on" : ""}`}
      aria-hidden={!paper}
    >
      {reached && <Glitter active={paper} />}
      <div ref={content} className="paper__content">
        <WhatIDo />
        <Projects active={paper} gl={reached} />
        <div id="skills">
          <Toolkit active={paper} gl={reached} />
        </div>
        <Footer />
      </div>
    </div>
  );
}
