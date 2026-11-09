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
  // the FastAPI backend, served from this site so its auth cookies are first-party (main-websie/server)
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${process.env.FMD_API_URL ?? "http://localhost:8000"}/api/v1/:path*` }];
  },
  async headers() {
    const forever = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/:path*.glb", headers: forever },
      { source: "/models/:path*", headers: forever },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
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
