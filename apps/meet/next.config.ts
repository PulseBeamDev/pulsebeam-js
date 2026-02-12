import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pulsebeam/ui", "@pulsebeam/react"],
  reactStrictMode: true,
};

export default nextConfig;
