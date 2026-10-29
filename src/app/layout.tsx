import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Display serif for headlines and the wordmark. The particle mark samples this
// face at runtime, so it is preloaded before the loader reports ready.
const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
});

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sayuj Pillai — Systems that ship",
  description:
    "Sayuj Pillai builds production Shopify architecture, autonomous quant research pipelines and interfaces that turn ambiguity into something that works.",
};

export const viewport: Viewport = {
  themeColor: "#fff3ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${mono.variable} ${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
