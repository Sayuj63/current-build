import { create } from "zustand";

/**
 * Phases of the opening sequence.
 *
 *  loading   assets, fonts and audio are downloading; the scene is mounted
 *            behind the loader so its shaders compile while the user waits
 *  ready     everything is decoded and the GPU has drawn real frames — the
 *            enter buttons are shown
 *  entering  the portal is opening
 *  entered   the loader is gone and the hero is interactive
 */
export type Phase = "loading" | "ready" | "entering" | "entered";

type Progress = { assets: number; fonts: number; audio: number; gpu: number };

type AppState = {
  phase: Phase;
  progress: Progress;
  audioOn: boolean;
  /** True once the closing portal has opened onto the paper sections. */
  paper: boolean;
  /** Paper mode only: the header tucks away on scroll down, returns on scroll up. */
  headerHidden: boolean;
  setPaper: (on: boolean) => void;
  setHeaderHidden: (hidden: boolean) => void;
  setPhase: (phase: Phase) => void;
  setProgress: (part: Partial<Progress>) => void;
  setAudioOn: (on: boolean) => void;
};

export const useApp = create<AppState>((set) => ({
  phase: "loading",
  progress: { assets: 0, fonts: 0, audio: 0, gpu: 0 },
  audioOn: false,
  paper: false,
  headerHidden: false,
  setPaper: (paper) => set({ paper, headerHidden: paper }),
  setHeaderHidden: (headerHidden) => set({ headerHidden }),
  setPhase: (phase) => set({ phase }),
  setProgress: (part) => set((s) => ({ progress: { ...s.progress, ...part } })),
  setAudioOn: (audioOn) => set({ audioOn }),
}));

/** Weighted total, 0–1. Assets dominate because they dominate the wait. */
export function totalProgress(p: Progress) {
  return p.assets * 0.65 + p.fonts * 0.1 + p.audio * 0.15 + p.gpu * 0.1;
}
