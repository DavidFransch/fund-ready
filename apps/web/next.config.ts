import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One self-contained server for the Docker image (Cloud Run).
  output: "standalone",
  // Trace files from the monorepo root so workspace packages are included.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // The same image runs in dev and production; a stable id per build avoids version skew.
  deploymentId: process.env.DEPLOYMENT_VERSION,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
