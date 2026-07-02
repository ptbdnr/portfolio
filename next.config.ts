import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server bundle (.next/standalone) for the
  // Docker image that runs on the NAS.
  output: "standalone",
};

export default nextConfig;
