import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The legacy vanilla site lives in /legacy for reference only.
  outputFileTracingExcludes: { "*": ["./legacy/**"] },
};

export default nextConfig;
