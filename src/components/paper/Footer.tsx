"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { CONTACT } from "@/content/work";
import { GlossyButton } from "../ui/GlossyButton";
import { ReturnArrow } from "../ui/icons";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function OutArrow() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 9L9 3M4 3h5v5" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M3 3h6v8M6 8l3 3 3-3" />
    </svg>
  );
}

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () =>
      setT(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date()));
    f();
    const id = setInterval(f, 15000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{t} IST</span>;
}

/**
 * Closing CTA + footer. "SOMETHING" arrives flush left, then — as the visitor
 * scrolls the footer into place — slides right while the ↪ lands in front of
 * it, the same beat as the reference.
 */
export function Footer() {
  const root = useRef<HTMLElement>(null);
  const indent = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let last = -1;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the footer top enters the bottom, 1 when it has risen to 15% from the top
      const k = clamp01((vh - r.top) / (vh * 0.85));
      const s = clamp01((k - 0.45) / 0.45);
      const e = s * s * (3 - 2 * s);
      if (Math.abs(e - last) < 0.001) return;
      last = e;
      if (indent.current) indent.current.style.transform = `translateX(${e * 1.1}em)`;
      if (arrow.current) {
        arrow.current.style.opacity = String(clamp01((e - 0.35) / 0.5));
        arrow.current.style.transform = `translateX(${(1 - e) * -12}px)`;
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const social = CONTACT.social.filter(([, url]) => url);
  const pages: [string, string][] = [
    ["Home", "#top"],
    ["Work", "#work"],
    ["Skills", "#skills"],
    ["Contact", "#contact"],
  ];
  const email = CONTACT.email;

  return (
    <footer ref={root} className="foot" id="contact">
      <div className="foot__left">
        <span className="ch-pill mono">Stay in touch</span>
        <h2 className="foot__title serif">
          <span>
            <em>Let&apos;s</em> BUILD
          </span>
          <span className="foot__line2">
            <span ref={arrow} className="foot__arrow" aria-hidden="true">
              <ReturnArrow />
            </span>
            <span ref={indent} className="foot__indent">
              SOMETHING
            </span>
          </span>
          <span>THAT WORKS</span>
        </h2>
        <GlossyButton href={email ? `mailto:${email}` : social[0]?.[1] ?? "#"} iconEnd={<ReturnArrow />}>
          Start a project
        </GlossyButton>
      </div>

      <div className="foot__right">
        <p className="foot__lede mono">
          Have an idea, a store, or a system that needs
          <br />
          to actually run? Let&apos;s make it real
        </p>
        <div className="foot__cols">
          <div>
            <p className="foot__h">
              Social <DownArrow />
            </p>
            <ul className="foot__list mono">
              {social.map(([name, url], i) => (
                <li key={name}>
                  <span className="foot__n">[{String(i + 1).padStart(2, "0")}]</span>
                  <a href={url} target="_blank" rel="noopener">
                    {name} <OutArrow />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="foot__h">
              Pages <DownArrow />
            </p>
            <ul className="foot__list mono">
              {pages.map(([name, href], i) => (
                <li key={name}>
                  <span className="foot__n">[{String(i + 1).padStart(2, "0")}]</span>
                  <a href={href}>{name}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="foot__h">
              Location <DownArrow />
            </p>
            <p className="mono foot__text">
              Based in {CONTACT.location}
              <br />
              Local time <Clock />
            </p>
          </div>
          {email && (
            <div>
              <p className="foot__h">
                E-mail <DownArrow />
              </p>
              <a className="mono foot__text" href={`mailto:${email}`}>
                {email}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="foot__bottom mono">
        <span>© {new Date().getFullYear()} Sayuj Pillai</span>
        <span>Designed &amp; built from scratch — Next.js, Three.js, GSAP</span>
      </div>
    </footer>
  );
}
