"use client";

import gsap from "gsap";
import Lenis from "lenis";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Footer } from "../paper/Footer";
import { Glitter } from "../paper/Glitter";
import { GlossyButton } from "../ui/GlossyButton";
import { ReturnArrow } from "../ui/icons";
import { Assistant, SiteHeader } from "../ui/SiteHeader";
import { aboutState } from "./AboutWorld";

const AboutWorld = dynamic(() => import("./AboutWorld").then((m) => m.AboutWorld), { ssr: false });

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** A line that arrives flush, then opens into an indent as the ↪ lands. */
function Indent({ children }: { children: React.ReactNode }) {
  return (
    <span className="line-mask ab-indent-line">
      <span className="ch-arrow" aria-hidden="true">
        <ReturnArrow />
      </span>
      <span className="ch-indent ab-move">{children}</span>
    </span>
  );
}
const L = ({ children }: { children: React.ReactNode }) => (
  <span className="line-mask">
    <span className="ab-move">{children}</span>
  </span>
);

const FAQ: [string, string][] = [
  ["Who is Sayuj?", "A developer and B.Tech CSE student in Navi Mumbai who builds production Shopify stores, web products and AI tools for brands and founders."],
  ["What do you build?", "Shopify themes and storefronts, marketing sites, web apps and dashboards, data pipelines and automation, AI agents — and 3D and motion work like this site."],
  ["Who do you work with?", "DTC brands, startups, agencies and solo founders who need something that actually ships and keeps running."],
  ["What is your stack?", "Next.js, React, TypeScript, Three.js and GSAP on the front. Shopify, Liquid and the Admin APIs for commerce. Python, FastAPI and Node for data and AI."],
  ["How does a project run?", "A short call to understand the why, then design, build and launch — and I stay around after launch for the fixes and iterations that make it last."],
  ["How do we start?", "Use “Start a project” below, or reach me through any of the links in the footer."],
];

/**
 * /about — five hero beats over the same 3D world as the home page (the
 * camera moves to a new spot for each), then the story, me, the approach,
 * an FAQ and the footer on paper.
 */
export function AboutPage() {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const [onPaper, setOnPaper] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [world, setWorld] = useState(false);

  // Type first, then the world fades up behind it.
  useEffect(() => {
    let alive = true;
    const skip = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("noworld");
    if (!skip) document.fonts.ready.then(() => setTimeout(() => alive && setWorld(true), 500));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const w = wrapper.current;
    const c = content.current;
    const h = hero.current;
    if (!w || !c || !h) return;
    const lenis = new Lenis({ wrapper: w, content: c, duration: 1.35, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 0.8 });
    const beats = [...h.querySelectorAll<HTMLElement>("[data-beat]")];
    const parts = beats.map((el) => ({
      el,
      lines: [...el.querySelectorAll<HTMLElement>(".ab-move")],
      pill: el.querySelector<HTMLElement>(".ch-pill"),
      sub: el.querySelector<HTMLElement>(".ab-sub"),
      indent: el.querySelector<HTMLElement>(".ch-indent"),
      arrow: el.querySelector<HTMLElement>(".ch-arrow"),
    }));

    let paperNow = false;
    let lastY = -1;
    const layout = (y: number) => {
      const vh = window.innerHeight;
      // hero beat from scroll; holds on each beat, glides between
      const raw = y / vh;
      const i = Math.floor(raw);
      const beat = Math.min(beats.length - 1, i + smooth(0.3, 0.85, raw - i));
      aboutState.beat = beat;
      const heroEnd = h.offsetHeight - vh;
      aboutState.live = y < heroEnd + vh * 0.9;
      const nowPaper = y > heroEnd + vh * 0.55;
      if (nowPaper !== paperNow) {
        paperNow = nowPaper;
        setOnPaper(nowPaper);
      }

      parts.forEach((p, k) => {
        const d = beat - k; // <0 arriving, 0 resting, >0 leaving
        const vis = d > -1 && d < 1;
        p.el.style.visibility = vis ? "visible" : "hidden";
        if (!vis) return;
        const inn = d < 0 ? 1 - smooth(-1, -0.15, d) : 0; // 1 = not yet in
        const out = d > 0 ? smooth(0.15, 0.85, d) : 0; // 1 = gone
        p.lines.forEach((ln, j) => {
          const lag = clamp01(inn * (1 + j * 0.12));
          ln.style.transform = `translate3d(${-out * 12}vw, ${lag * 110 - out * 30}%, 0)`;
          ln.style.opacity = String(1 - out);
        });
        const fade = (1 - clamp01(inn * 1.4)) * (1 - out);
        if (p.pill) p.pill.style.opacity = String(fade);
        if (p.sub) p.sub.style.opacity = String(fade * (1 - clamp01(inn * 3)));
        // arrives flush; as the beat settles the line opens and the ↪ lands
        const open = smooth(-0.32, -0.02, d) * (1 - out);
        if (p.indent) p.indent.style.marginLeft = `${1.55 * open}em`;
        if (p.arrow) p.arrow.style.opacity = String(smooth(0.35, 0.95, open) * (1 - out));
      });
    };

    lenis.on("scroll", (l: Lenis) => {
      layout(l.scroll);
      if (Math.abs(l.velocity) < 0.5) return;
      if (l.direction < 0) setHidden(false);
      else if (l.direction > 0 && l.scroll > window.innerHeight * 0.3) setHidden(true);
    });
    const tick = (t: number) => {
      lenis.raf(t * 1000);
      if (lastY !== lenis.scroll) {
        lastY = lenis.scroll;
        layout(lenis.scroll);
      }
    };
    layout(0);
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return (
    <div className={`about ${onPaper ? "on-paper" : ""}`}>
      <div className={`about__world ${world ? "is-on" : ""}`} aria-hidden="true">
        {world && <AboutWorld />}
      </div>

      <div ref={wrapper} className="about__scroll">
        <div ref={content}>
          {/* ── Hero: five beats over the world ── */}
          <section ref={hero} className="ab-hero" aria-label="About">
            <div className="ab-hero__pin">
              <div data-beat className="ab-beat ab-beat--split">
                <p className="ab-sub mono ab-sub--top">
                  Hi. I&apos;m Sayuj — and I care about
                  <br />
                  one thing more than most
                </p>
                <h1 className="serif uppercase ab-title">
                  <L>People don&apos;t</L>
                  <L>remember code</L>
                  <Indent>they remember</Indent>
                  <L>
                    what it <em className="normal-case">did</em>
                  </L>
                </h1>
              </div>

              <div data-beat className="ab-beat ab-beat--right">
                <span className="ch-pill mono">What I am</span>
                <h2 className="serif uppercase ab-title">
                  <L>A developer</L>
                  <L>designing &amp;</L>
                  <L>engineering</L>
                  <Indent>systems that ship</Indent>
                </h2>
                <p className="ab-sub mono">For brands and founders who need it to run</p>
              </div>

              <div data-beat className="ab-beat ab-beat--left">
                <span className="ch-pill mono">The difference</span>
                <h2 className="serif uppercase ab-title">
                  <L>A good site</L>
                  <L>gets looked at</L>
                  <Indent>a great one</Indent>
                  <L>
                    <em className="normal-case">gets used</em>
                  </L>
                </h2>
                <p className="ab-sub mono">
                  The space between “nice” and “it just works” is where
                  <br />
                  all my work lives
                </p>
              </div>

              <div data-beat className="ab-beat ab-beat--right">
                <span className="ch-pill mono">How I think</span>
                <h2 className="serif uppercase ab-title">
                  <L>It starts</L>
                  <L>
                    with <em className="normal-case">why</em>
                  </L>
                </h2>
                <p className="ab-sub mono">
                  Before a pixel or a line of code, I learn the business —
                  <br />
                  what it does, who it&apos;s for, what it needs to achieve
                </p>
              </div>

              <div data-beat className="ab-beat ab-beat--left">
                <span className="ch-pill mono">Who I am</span>
                <h2 className="serif uppercase ab-title">
                  <L>One person.</L>
                  <Indent>the whole pipeline</Indent>
                </h2>
                <p className="ab-sub mono">
                  From first call to final deploy, you talk to the person
                  <br />
                  who designs and writes the code
                </p>
              </div>
            </div>
          </section>

          {/* ── Paper ── */}
          <div className="about__paper">
            <section className="ab-story">
              <span className="ch-pill mono">Est 2024</span>
              <h2 className="serif uppercase ab-story__title">
                How it <span className="ab-story__arrow" aria-hidden="true"><ReturnArrow /></span> began
              </h2>
              <div className="ab-story__cols">
                <p className="serif ab-story__lede">
                  I started in 2024 — a first-year computer science student who didn&apos;t want to wait four years to build real things.
                </p>
                <div className="ab-story__body">
                  <p>
                    It began with small sites: a restaurant page, a photo gallery, a freelancer portfolio. Then came Shopify client work — and clients kept asking for more than a theme tweak. A swatch system that picks the right variant. A catalogue import that doesn&apos;t take a week. A store that loads fast on a phone.
                  </p>
                  <p>
                    Everything I know I taught myself on live work — commerce first, then data pipelines, quant research and AI agents. Today that&apos;s a hundred public repositories, and stores that real customers buy from every day.
                  </p>
                </div>
              </div>
            </section>

            <section className="ab-me" id="me">
              <div className="ab-me__head">
                <span className="ch-pill mono">Me</span>
                <p className="serif ab-me__intro">
                  <span className="ab-story__arrow" aria-hidden="true"><ReturnArrow /></span> One developer, many hats — which is exactly the point
                </p>
              </div>
              <div className="ab-me__card">
                <div className="ab-me__portrait" aria-hidden="true">
                  <span className="serif">S<em>P</em></span>
                </div>
                <div className="ab-me__text">
                  <p className="mono ab-me__tag">[ Ambiguity → Systems ]</p>
                  <h3 className="serif ab-me__name">Sayuj Pillai</h3>
                  <p className="ab-me__desc">
                    Turns tangled briefs into things that run. Design and engineering in one head — from the first sketch to the final deploy, and the support after. B.Tech CSE at ITM Skills University, based in Navi Mumbai.
                  </p>
                  <a className="mono ab-me__link" href="https://github.com/Sayuj63" target="_blank" rel="noopener">
                    GitHub ↗
                  </a>
                </div>
              </div>
            </section>

            <section className="ab-approach">
              <h2 className="serif uppercase ab-approach__title">
                <em className="normal-case">Where</em>
                <span className="ab-approach__line">
                  <span className="ab-story__arrow" aria-hidden="true"><ReturnArrow /></span> the best
                </span>
                <span>projects start</span>
              </h2>
              <div className="ab-approach__body">
                <p>The best projects tend to start the same way — someone cares. About how it looks, how it works, and whether it keeps working.</p>
                <p>You don&apos;t need everything figured out; that&apos;s what I&apos;m here for. If you&apos;ve got something you&apos;re excited about and want it done well, let&apos;s shape it together.</p>
                <GlossyButton href="#contact" iconEnd={<ReturnArrow />}>
                  Start a project
                </GlossyButton>
              </div>
            </section>

            <section className="ab-faq" aria-labelledby="faq-title">
              <h2 id="faq-title" className="serif uppercase ab-faq__title">
                FAQ<span className="normal-case">(s)</span>
              </h2>
              <ul className="ab-faq__list">
                {FAQ.map(([q, a], i) => (
                  <li key={q} className={open === i ? "is-open" : ""}>
                    <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                      <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                      <span className="ab-faq__q">{q}</span>
                      <span className="ab-faq__plus" aria-hidden="true" />
                    </button>
                    <div className="ab-faq__a">
                      <p>{a}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <Footer />
          </div>
        </div>
      </div>

      <div className="about__smoke">
        <Glitter active />
      </div>
      <SiteHeader hidden={hidden && onPaper} />
      <Assistant />
    </div>
  );
}
