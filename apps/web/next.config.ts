import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/types", "@repo/ingest", "@repo/match"],
};

export default nextConfig;
