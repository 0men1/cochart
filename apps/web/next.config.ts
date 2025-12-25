import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://server:8080'}/:path*`,
    }]
  }
};

export default nextConfig;
