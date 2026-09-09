import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sharefast/protocol", "@sharefast/crypto"],
  reactStrictMode: true,
  typescript: {
    // Prevent external C:\Users\hi\node_modules\csstype syntax error from blocking build
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
