import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // First-party proxy for Umami analytics. Serving the tracker script and
  // event endpoint under our own domain (/stats/*) keeps the requests
  // same-origin, so ad blockers (Brave, uBlock, Pi-hole) that block the
  // public cloud.umami.is paths no longer drop the beacons. The script tag
  // in app/layout.tsx points at /stats/script.js with
  // data-host-url="https://cochart.app/stats".
  async rewrites() {
    return [
      {
        source: "/stats/script.js",
        destination: "https://cloud.umami.is/script.js",
      },
      {
        source: "/stats/api/send",
        destination: "https://cloud.umami.is/api/send",
      },
    ];
  },

  // Dev-only: Next 16 blocks cross-origin dev requests (HMR, RSC, static
  // chunks) unless the origin is listed here. Needed to run `npm run dev`
  // against a remote host by IP/domain. Has no effect in production.
  // Set ALLOWED_DEV_ORIGINS (comma-separated) locally — see .env.example.
  allowedDevOrigins:
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
};

export default nextConfig;
