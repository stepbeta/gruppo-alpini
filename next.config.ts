import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The Playwright suite drives the dev server through 127.0.0.1; Next.js
  // blocks cross-origin dev resources (including client bundles) by default.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
