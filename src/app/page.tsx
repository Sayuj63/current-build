"use client";

import dynamic from "next/dynamic";
import { Hero } from "@/components/hero/Hero";
import { Loader } from "@/components/loader/Loader";
import { Paper } from "@/components/paper/Paper";

// WebGL only exists in the browser; the world is never server-rendered.
const Experience = dynamic(() => import("@/components/scene/Experience").then((m) => m.Experience), { ssr: false });

export default function Home() {
  return (
    <main>
      <Experience />
      <Paper />
      <Hero />
      <Loader />
    </main>
  );
}
