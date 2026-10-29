"use client";

import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { preloadAudio, startSoundscape } from "@/lib/audio";
import { motion } from "@/lib/motion";
import { totalProgress, useApp } from "@/lib/store";
import { GlossyButton } from "../ui/GlossyButton";
import { SoundOffIcon, SoundOnIcon } from "../ui/icons";
import { Wordmark } from "../ui/Wordmark";
import { FluidBg } from "./FluidBg";

/** Resolve a next/font CSS variable to the real (hashed) family name. */
function family(varName: string) {
  return getComputedStyle(document.body).getPropertyValue(varName).split(",")[0].trim();
}

/**
 * The gate. Its job is practical, not decorative: nothing about the site is
 * allowed to load after the visitor commits. Models, textures, the HDRI,
 * fonts and decoded audio all arrive here, and the 3D scene is already
 * mounted and drawing behind the paper — so shaders are compiled and
 * textures are on the GPU before the portal opens. That is what makes the
 * first second after "Enter" hitch-free.
 */
export function Loader() {
  const phase = useApp((s) => s.phase);
  const setPhase = useApp((s) => s.setPhase);
  const setProgress = useApp((s) => s.setProgress);
  const setAudioOn = useApp((s) => s.setAudioOn);
  const { progress: threeProgress, total } = useProgress();

  const [shown, setShown] = useState(0);
  const [gone, setGone] = useState(false);
  const shownRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fluidRef = useRef<HTMLDivElement>(null);

  // Three.js loaders report through drei's progress store.
  useEffect(() => {
    if (total > 0) setProgress({ assets: threeProgress / 100 });
  }, [threeProgress, total, setProgress]);

  // Fonts and audio are outside three's loading manager; track them here.
  useEffect(() => {
    const fonts = [
      `400 120px ${family("--font-serif")}`,
      `italic 400 120px ${family("--font-serif")}`,
      `500 12px ${family("--font-mono")}`,
      `500 15px ${family("--font-sans")}`,
    ];
    let n = 0;
    fonts.forEach((f) =>
      document.fonts
        .load(f)
        .catch(() => undefined)
        .finally(() => setProgress({ fonts: ++n / fonts.length })),
    );
    void preloadAudio((p) => setProgress({ audio: p }));
  }, [setProgress]);

  // The counter eases toward the real figure but never runs backwards and
  // never claims 100 before the GPU has actually drawn the scene.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = totalProgress(useApp.getState().progress) * 100;
      const next = Math.min(100, shownRef.current + Math.max(0, target - shownRef.current) * 0.08 + (target > shownRef.current ? 0.15 : 0));
      shownRef.current = Math.min(next, target);
      setShown(Math.floor(shownRef.current + 0.001));
      if (shownRef.current >= 99.95) {
        setShown(100);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (shown >= 100 && phase === "loading") {
      const t = setTimeout(() => setPhase("ready"), 450);
      return () => clearTimeout(t);
    }
  }, [shown, phase, setPhase]);

  // Dev convenience: `?enter` walks straight through the gate once ready.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && phase === "ready" && new URLSearchParams(window.location.search).has("enter")) enter(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const enter = (withAudio: boolean) => {
    if (useApp.getState().phase !== "ready") return;
    setPhase("entering");
    if (withAudio) {
      void startSoundscape();
      setAudioOn(true);
    }

    const tl = gsap.timeline({ onComplete: () => setGone(true) });
    tl.to(contentRef.current, { opacity: 0, y: -12, duration: 0.6, ease: "power2.in" }, 0)
      .to(bottomRef.current, { opacity: 0, y: 12, duration: 0.5, ease: "power2.in" }, 0)
      .to(fluidRef.current, { opacity: 0, duration: 1.1, ease: "power1.out" }, 0.1)
      .to(motion, { reveal: 1, duration: 2.6, ease: "power2.inOut" }, 0.35)
      .to(motion, { intro: 1, duration: 3.6, ease: "power3.out" }, 0.35)
      .to(motion, { assemble: 1, duration: 2.8, ease: "power3.inOut" }, 0.8)
      .call(() => setPhase("entered"), [], 1.9)
      .set(rootRef.current, { pointerEvents: "none" }, 0.6);
  };

  if (gone) return null;

  const pct = String(shown).padStart(3, "0");
  const ready = phase !== "loading";

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 select-none" aria-live="polite">
      <FluidBg ref={fluidRef} />

      <div ref={contentRef} className="pointer-events-none absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5 px-4 text-center">
        <Wordmark size={40} />
        <p className="mono" style={{ fontSize: 12, maxWidth: 300, color: "var(--deep)" }}>
          Systems, storefronts and signals
          <br />
          built to actually ship
        </p>
      </div>

      <div ref={bottomRef} className="absolute inset-x-0 bottom-5 flex flex-col items-center px-4">
        {!ready ? (
          <div className="flex w-[300px] max-w-full flex-col gap-2" style={{ color: "var(--deep)" }}>
            <div className="relative h-[2px] w-full overflow-hidden rounded-[1px]" style={{ background: "rgba(var(--orange-rgb),0.18)" }}>
              <div
                className="absolute inset-0 origin-left"
                style={{ background: "var(--orange)", transform: `scaleX(${shown / 100})`, transition: "transform 0.12s linear" }}
              />
            </div>
            <div className="mono flex justify-between" style={{ fontSize: 10 }}>
              <span style={{ color: "var(--muted)" }}>
                Experience is loading<span className="loader-dots" />
              </span>
              <span>
                <span style={{ color: "var(--orange)" }}>{pct}%</span> out of 100
              </span>
            </div>
          </div>
        ) : (
          <div className="loader-actions flex flex-col items-center gap-4">
            <GlossyButton icon={<SoundOnIcon />} onClick={() => enter(true)}>
              Enter with audio
            </GlossyButton>
            <button type="button" className="tlink" onClick={() => enter(false)}>
              <span className="gbtn__icon">
                <SoundOffIcon />
              </span>
              Enter without audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
