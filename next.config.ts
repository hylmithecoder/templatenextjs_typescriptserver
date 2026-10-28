import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "true";

// Bun backend (WebSocket + REST) that `next dev` proxies to, so the browser
// can always talk to the same origin it loaded the page from.
const backendOrigin =
  process.env.BACKEND_ORIGIN ||
  `http://127.0.0.1:${process.env.APP_SERVER_PORT || 5790}`;

const devOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {
        experimental: {
          agentFeedback: true,
        },
        cacheComponents: true,
        partialPrefetching: true,
        // External rewrites are proxied by Next.js, including WebSocket
        // upgrade requests (see router-server upgradeHandler).
        async rewrites() {
          return {
            beforeFiles: [
              { source: "/ws", destination: `${backendOrigin}/ws` },
              { source: "/api/:path*", destination: `${backendOrigin}/api/:path*` },
              { source: "/health", destination: `${backendOrigin}/health` },
              { source: "/docs", destination: `${backendOrigin}/docs` },
              { source: "/openapi.json", destination: `${backendOrigin}/openapi.json` },
            ],
            afterFiles: [],
            fallback: [],
          };
        },
      }),
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
