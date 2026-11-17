import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * `Strict-Transport-Security` is deliberately absent: Vercel already emits
 * `max-age=63072000; includeSubDomains; preload` on production deployments, and
 * setting a second, weaker value here would produce a duplicate header. If the
 * app is ever self-hosted, add it back at that point.
 *
 * `frame-ancestors 'none'` and `X-Frame-Options` overlap by design: the former
 * only applies to browsers that understand CSP, the latter covers older ones.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/**
 * Report-only CSP. It is deliberately not enforcing yet: Next.js emits inline
 * bootstrap scripts, and a strict `script-src` requires nonces through
 * middleware, which would force every route to render dynamically and defeat
 * `cacheComponents`. Until that trade-off is taken on purpose, this policy
 * reports violations without breaking the portal.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://*.supabase.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://accounts.google.com",
].join("; ");

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
