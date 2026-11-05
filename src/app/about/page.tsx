import type { Metadata } from "next";
import { AboutPage } from "@/components/about/AboutPage";

export const metadata: Metadata = {
  title: "About — Sayuj Pillai",
  description: "Developer in Navi Mumbai building Shopify stores, web products and AI tools that actually ship.",
};

export default function About() {
  return <AboutPage />;
}
