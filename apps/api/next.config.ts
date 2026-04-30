import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@audiotext/db", "@audiotext/shared"],
};

export default nextConfig;
