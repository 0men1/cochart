import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	// The backend (market data + realtime rooms) is served by the custom
	// server in server.ts on this same origin, so no rewrite/proxy is needed.
};

export default nextConfig;
