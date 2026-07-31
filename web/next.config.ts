import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
// Where `next dev` proxies /api/* (HTTP) so the browser can stay same-origin
// while the collab/api server runs as a separate process.
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  transpilePackages: ["@cochart/protocol"],

  // Dev-only: proxy HTTP API calls to the standalone server so the browser
  // stays same-origin (no CORS)
  ...(dev && {
    async rewrites() {
      return [
        { source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` },
      ];
    },
  }),

  // Dev-only: Next 16 blocks cross-origin dev requests (HMR, RSC, static
  // chunks) unless the origin is listed here. Needed to run `npm run dev`
  allowedDevOrigins:
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
};

export default nextConfig;
