import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //   CHANGED THIS
  reactStrictMode: false,
  output: 'standalone',
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${process.env.SERVER_URL || 'http://localhost:8080'}/:path*`,
    }]
  }
};

export default nextConfig;
