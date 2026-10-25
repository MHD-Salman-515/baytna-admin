import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

export default function config(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    experimental: {
      agentFeedback: true,
    },
    cacheComponents: true,
    partialPrefetching: true,
    // Files named *.dev.ts are routes ONLY under `next dev`. This is how the
    // dev-OTP helper (app/api/dev/otp/route.dev.ts) is kept out of production
    // builds entirely, rather than merely disabled.
    pageExtensions: isDevServer ? ["dev.ts", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
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
        { source: "/:path*", headers: securityHeaders },
        // Admin pages show personal data; never let a shared cache keep them.
        {
          source: "/((?!_next/static|_next/image).*)",
          headers: [{ key: "Cache-Control", value: "no-store" }],
        },
      ];
    },
  };
}
