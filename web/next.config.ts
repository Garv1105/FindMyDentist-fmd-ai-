import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: { qualities: [75, 92], minimumCacheTTL: 31536000 }, // optimised /_next/image copies stay cached a year
  devIndicators: false,
  partialPrefetching: true,
  experimental: { agentUpgrade: "security" },
  // Every model and still is requested with ?v=N, so it can be cached forever (bump N to ship a change); the plain
  // artwork under /img has no version in its URL, so it revalidates in the background after a day
  async headers() {
    const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/:path*.glb", headers: forever },
      { source: "/models/:path*", headers: forever },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
  // FastAPI (server/) answers /api/v1/*: proxied through this origin, so its session cookies are first-party. This
  // app's own route handlers live under /api/* outside v1, so the two never collide.
  async rewrites() {
    const api = process.env.API_URL ?? "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
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
