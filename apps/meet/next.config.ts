import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pulsebeam/ui", "@pulsebeam/react"],
  reactStrictMode: true,
  output: "export"
};

export default nextConfig;
