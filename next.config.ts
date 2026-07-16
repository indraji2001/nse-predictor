import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: removed `output: "standalone"` — Vercel uses its own build pipeline
  // and the standalone output mode is only needed for self-hosted Docker/VPS.
  // Keeping it would cause Vercel to deploy incorrectly.

  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // sharp is used for image optimization — already a dependency.
  // No special config needed for Vercel.
};

export default nextConfig;
