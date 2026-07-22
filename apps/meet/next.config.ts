import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pulsebeam/ui", "@pulsebeam/react", "@pulsebeam/web", "@pulsebeam/core"],
  reactStrictMode: true,
  output: "export",
  basePath: '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
