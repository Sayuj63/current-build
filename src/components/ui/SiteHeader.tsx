"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ensureAudio, setMuted } from "@/lib/audio";
import { useApp } from "@/lib/store";
import { GlossyButton } from "./GlossyButton";
import { GearIcon, ReturnArrow } from "./icons";
import { Wordmark } from "./Wordmark";

const SiriOrb = dynamic(() => import("./SiriOrb").then((m) => m.SiriOrb), { ssr: false });

function SoundBars({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} aria-label={on ? "Mute sound" : "Play sound"} className={`bars ${on ? "bars--on" : ""}`}>
      {Array.from({ length: 7 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${i * -0.13}s` }} />
      ))}
    </button>
  );
}

/**
 * The site header, identical on every page. `home` switches the section links
 * between in-page anchors (on the home page) and links back to them.
 */
export function SiteHeader({ home = false, hidden = false }: { home?: boolean; hidden?: boolean }) {
  const audioOn = useApp((s) => s.audioOn);
  const setAudioOn = useApp((s) => s.setAudioOn);
  const toggleSound = async () => {
    const next = !audioOn;
    setAudioOn(next);
    if (next) await ensureAudio();
    setMuted(!next);
  };
  const a = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <header className={`site-header ${hidden ? "is-hidden" : ""} pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-5 md:px-8 md:pt-6`}>
      {/* Plain links between pages: each page starts its 3D world fresh. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="nav-item" aria-label="Sayuj Pillai — home">
        <Wordmark size={30} light />
      </a>
      <nav className="nav-item mono hidden gap-8 text-white md:flex" style={{ fontSize: 12 }}>
        <a href="/about" className="navlink">
          About
        </a>
        <a href="/work" className="navlink">
          Work
        </a>
        <a href={a("contact")} className="navlink">
          Contact
        </a>
      </nav>
      <button type="button" className="nav-item mono hidden items-center gap-2 text-white md:flex" style={{ fontSize: 12 }}>
        <span className="block h-4 w-4">
          <GearIcon />
        </span>
        Settings
      </button>
      <div className="nav-item hidden md:block">
        <SoundBars on={audioOn} onToggle={toggleSound} />
      </div>
      <div className="nav-item">
        <GlossyButton size="sm" tone="light" href={a("contact")} iconEnd={<ReturnArrow />}>
          Let&apos;s talk
        </GlossyButton>
      </div>
    </header>
  );
}

/** Bottom-right assistant: a living orb whose bubble opens on hover only. Chat comes later. */
export function Assistant() {
  const [hover, setHover] = useState(false);
  return (
    <div className="assistant pointer-events-none absolute bottom-7 right-7 z-20 hidden items-center gap-3 md:flex">
      <p className={`assistant__bubble mono ${hover ? "is-open" : ""}`} aria-hidden={!hover}>
        I&apos;m Sayuj&apos;s AI assistant. Click to talk to me.
      </p>
      <button
        type="button"
        className="assistant__orb pointer-events-auto"
        aria-label="Open the AI assistant"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <SiriOrb active={hover} />
      </button>
    </div>
  );
}
