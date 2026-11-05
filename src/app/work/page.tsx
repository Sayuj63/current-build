import type { Metadata } from "next";
import { WorkPage } from "@/components/work/WorkPage";

export const metadata: Metadata = {
  title: "Work — Sayuj Pillai",
  description: "Storefronts, products, AI agents and tools — sixteen projects from github.com/Sayuj63.",
};

export default function Work() {
  return <WorkPage />;
}
