import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	// The backend (market data + realtime rooms) is served by the custom
	// server in server.ts on this same origin, so no rewrite/proxy is needed.

	// Dev-only: Next 16 blocks cross-origin dev requests (HMR, RSC, static
	// chunks) unless the origin is listed here. Needed to run `npm run dev`
	// against a remote host by IP/domain. Has no effect in production.
	allowedDevOrigins: ["104.131.178.81"],
};

export default nextConfig;
