import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server output for a small Docker image.
  output: "standalone",
  // better-sqlite3 is a native module — keep it out of the bundle so the
  // compiled .node binary is loaded at runtime instead of being traced/bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
