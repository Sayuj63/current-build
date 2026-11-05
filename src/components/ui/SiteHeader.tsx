"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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

/** Bottom-right assistant: a living orb that opens a chat with Sayuj's AI assistant. */
export function Assistant() {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div className="assistant pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-3 md:bottom-7 md:right-7">
      {open && <ChatPanel onClose={close} onBusy={setBusy} />}
      <p className={`assistant__bubble mono hidden md:block ${hover && !open ? "is-open" : ""}`} aria-hidden={!hover || open}>
        I&apos;m Sayuj&apos;s AI assistant. Click to talk to me.
      </p>
      <button
        type="button"
        className="assistant__orb pointer-events-auto"
        aria-label={open ? "Close the AI assistant" : "Open the AI assistant"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <SiriOrb active={hover || busy} />
      </button>
    </div>
  );
}

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["What does Sayuj build?", "Show me his Shopify work", "Tell me about his AI projects", "Can he help with my store?"];

/** Markdown links, bare URLs and **bold** — all the formatting the assistant is asked to use. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        const md = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        const href = md?.[2] ?? (/^https?:\/\//.test(p) ? p.replace(/[.,]$/, "") : null);
        if (href && /^https?:\/\//.test(href))
          return (
            <a key={i} href={href} target="_blank" rel="noreferrer">
              {md?.[1] ?? href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          );
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return p;
      })}
    </>
  );
}

function ChatPanel({ onClose, onBusy }: { onClose: () => void; onBusy: (b: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  // Both callbacks are stable, so this runs once per open; re-running would
  // abort the request in flight.
  useEffect(() => {
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abort.current?.abort();
      onBusy(false);
    };
  }, [onClose, onBusy]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [msgs]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    onBusy(true);
    const write = (content: string) => setMsgs([...history, { role: "assistant", content }]);
    try {
      abort.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        write((await res.text()) || "Something went wrong. Try again.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        write(answer);
      }
      if (!answer.trim()) write("I didn't catch that. Could you ask again?");
    } catch (e) {
      if ((e as Error).name !== "AbortError") write("I couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  return (
    // The pages drive their 3D worlds from window-level wheel, key, touch and
    // drag listeners; input inside the chat stays in the chat.
    <section
      className="chat pointer-events-auto"
      role="dialog"
      aria-label="Chat with Sayuj's AI assistant"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <header className="chat__head">
        <div>
          <p className="chat__title serif">Ask about Sayuj</p>
          <p className="chat__sub mono">AI assistant · answers from this site</p>
        </div>
        <button type="button" className="chat__close" onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </header>
      <div ref={log} className="chat__log" data-lenis-prevent aria-live="polite">
        {msgs.length === 0 ? (
          <div className="chat__intro">
            <p>Hi! I can tell you about Sayuj&apos;s work, skills and how he runs projects. What would you like to know?</p>
            <div className="chat__chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chat__chip mono" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={`chat__msg chat__msg--${m.role}`}>
              {m.content ? <Rich text={m.content} /> : <span className="chat__dots" aria-label="Thinking"><i /><i /><i /></span>}
            </div>
          ))
        )}
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={field}
          className="chat__input"
          rows={1}
          maxLength={1200}
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button type="submit" className="chat__send" disabled={busy || !input.trim()} aria-label="Send">
          <ReturnArrow />
        </button>
      </form>
    </section>
  );
}
