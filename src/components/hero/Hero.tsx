"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { glText } from "@/lib/glText";
import { useApp } from "@/lib/store";
import { ReturnArrow } from "../ui/icons";
import { Assistant, SiteHeader } from "../ui/SiteHeader";
import { useChapters } from "./useChapters";


const KICKER = ["Shopify architecture, quant pipelines and", "interfaces — for brands that need it to run"];
const LINES = ["Systems that turn", "ambiguity into", "things that work"];
const SUB = {
  approach: ["From brief to production — design, engineering, launch", "and the support after. One person, the whole pipeline"],
  craft: ["Pixel-tight interfaces, motion and 3D —", "the details people feel before they notice them"],
  intent: ["Every pixel, query and line of code has a reason —", "commerce, data, automation, AI, built to last"],
  outcomes: ["Live stores, real users, real traffic.", "I measure work by what is still running"],
};

const TITLE = { fontSize: "clamp(34px, 5.5vw, 92px)", lineHeight: 0.9, letterSpacing: "-0.012em" } as const;

function Sub({ lines, className = "" }: { lines: string[]; className?: string }) {
  return (
    <p className={`ch-sub mono text-white ${className}`}>
      {lines.map((l) => (
        <span key={l} className="line-mask">
          <span data-gl>{l}</span>
        </span>
      ))}
    </p>
  );
}

/** A line that opens into an indent while a ↪ lands in front of it. */
function IndentLine({ children }: { children: React.ReactNode }) {
  return (
    <span className="line-mask" style={{ position: "relative" }}>
      <span className="ch-arrow" aria-hidden="true">
        <ReturnArrow />
      </span>
      <span className="ch-indent">{children}</span>
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <span className="line-mask">
      <span style={{ display: "flex", alignItems: "baseline", gap: "0.22em" }}>{children}</span>
    </span>
  );
}



export function Hero() {
  const phase = useApp((s) => s.phase);
  const root = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const paper = useApp((s) => s.paper);
  const setPaper = useApp((s) => s.setPaper);
  const headerHidden = useApp((s) => s.headerHidden);
  useChapters(copy, ready, setPaper);

  useEffect(() => {
    if (phase !== "entered" || !root.current) return;
    const copyEl = copy.current;
    const handOff = () => {
      // Type is settled: move it into the 3D frame so it shares the world's
      // cursor wake, and hide the DOM copy (it stays for a11y and selection).
      glText.root = copyEl;
      glText.version++;
      glText.visible = true;
      copyEl?.setAttribute("data-gl-on", "");
      setReady(true);
    };
    // A context, so cleanup reverts every inline style it set — otherwise a
    // re-run (StrictMode, fast refresh) starts its .from() tweens from the
    // half-finished state of the killed run.
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "expo.out" }, onComplete: handOff })
        .set(root.current, { autoAlpha: 1 })
        .from(".nav-item", { y: -14, autoAlpha: 0, duration: 1.1, stagger: 0.06 }, 0.2)
        .from(".hero-lead [data-gl]", { yPercent: 110, duration: 1.4 }, 0.35)
        .from(".hero-title [data-gl]", { yPercent: 110, duration: 1.4, stagger: 0.09 }, 0.45)
        .from(".hero-kicker [data-gl]", { yPercent: 110, duration: 1.2, stagger: 0.08 }, 0.7)
        .fromTo(".assistant", { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.2, ease: "back.out(1.7)" }, 1.0);
    }, root);

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => glText.version++);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      ctx.revert();
      glText.visible = false;
      copyEl?.removeAttribute("data-gl-on");
      setReady(false);
    };
  }, [phase]);


  return (
    <div ref={root} className={`hero pointer-events-none fixed inset-0 z-10 ${paper ? "on-paper" : ""}`} style={{ visibility: "hidden" }}>
      <SiteHeader home hidden={headerHidden && paper} />

      <div ref={copy} className="gl-root absolute inset-0">
        {/* Chapter 0 — hero */}
        <section data-chapter="0" className="absolute inset-x-0 bottom-0 px-6 pb-8 md:px-8 md:pb-10">
          <p className="hero-kicker mono mb-7 text-white md:mb-9">
            {KICKER.map((l) => (
              <span key={l} className="line-mask">
                <span data-gl>{l}</span>
              </span>
            ))}
          </p>
          <div className="grid items-start md:grid-cols-[minmax(0,34%)_1fr]">
            <h2 className="hero-lead line-mask serif italic text-white" style={{ fontSize: "clamp(40px, 5.4vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.01em" }}>
              <span data-gl>I build</span>
            </h2>
            <h1 className="hero-title serif mt-2 uppercase text-white md:mt-[0.62em]" style={{ fontSize: "clamp(34px, 5.5vw, 92px)", lineHeight: 0.9, letterSpacing: "-0.012em" }}>
              {LINES.map((l) => (
                <span key={l} className="line-mask">
                  <span data-gl>{l}</span>
                </span>
              ))}
            </h1>
          </div>
        </section>

        {/* Chapter 1 — approach (mark on the right) */}
        <section data-chapter="1" className="ch ch--left absolute px-6 md:px-8" style={{ visibility: "hidden" }}>
          <span className="ch-pill mono">Approach</span>
          <h2 className="serif uppercase text-white" style={TITLE}>
            <Row>
              <span data-gl className="italic normal-case">I</span>
              <span data-gl>build</span>
            </Row>
            <IndentLine>
              <span data-gl>more than</span>
            </IndentLine>
            <span className="line-mask">
              <span data-gl>websites. I build</span>
            </span>
            <span className="line-mask">
              <span data-gl>systems</span>
            </span>
          </h2>
          <Sub lines={SUB.approach} />
        </section>

        {/* Chapter 2 — craft (the big ball fills the top of frame) */}
        <section data-chapter="2" className="ch ch--vibes absolute inset-x-0 bottom-0 px-6 pb-8 md:px-8 md:pb-10" style={{ visibility: "hidden" }}>
          <div>
            <span className="ch-pill mono">Craft</span>
            <h2 className="serif uppercase text-white" style={TITLE}>
              <Row>
                <span data-gl>code</span>
                <span data-gl className="italic normal-case">as</span>
              </Row>
              <IndentLine>
                <span data-gl>craft</span>
              </IndentLine>
            </h2>
          </div>
          <Sub lines={SUB.craft} className="ch-sub--side" />
        </section>

        {/* Chapter 3 — intent (heart on the left, type on the right) */}
        <section data-chapter="3" className="ch ch--right absolute px-6 md:px-8" style={{ visibility: "hidden" }}>
          <span className="ch-pill mono">Intent</span>
          <h2 className="serif uppercase text-white" style={TITLE}>
            <Row>
              <span data-gl>built</span>
              <span data-gl className="italic normal-case">with</span>
            </Row>
            <span className="line-mask">
              <span data-gl>a reason</span>
            </span>
          </h2>
          <Sub lines={SUB.intent} />
        </section>

        {/* Chapter 4 — outcomes (the ring, front and centre) */}
        <section data-chapter="4" className="ch ch--bottom absolute inset-x-0 bottom-0 px-6 pb-8 md:px-8 md:pb-10" style={{ visibility: "hidden" }}>
          <span className="ch-pill mono">Outcomes</span>
          <Sub lines={SUB.outcomes} className="ch-sub--top" />
          <div className="grid items-start md:grid-cols-[minmax(0,34%)_1fr]">
            <h2 className="line-mask serif italic text-white" style={{ fontSize: "clamp(40px, 5.4vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.01em" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3em" }}>
                <span data-gl>It</span>
                <span className="ch-arrow ch-arrow--inline" aria-hidden="true">
                  <ReturnArrow />
                </span>
              </span>
            </h2>
            <h2 className="serif mt-2 uppercase text-white md:mt-[0.62em]" style={TITLE}>
              <span className="line-mask">
                <span data-gl>ships — and it</span>
              </span>
              <span className="line-mask">
                <span data-gl>stays shipped</span>
              </span>
            </h2>
          </div>
        </section>
      </div>

      <Assistant />
    </div>
  );
}
