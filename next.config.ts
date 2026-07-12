import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// The backend (market data + realtime rooms) is served by the custom
	// server in server.ts on this same origin, so no rewrite/proxy is needed.

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
