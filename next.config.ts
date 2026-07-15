import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output for the Docker deployment on the office
  // server (spec §8) — no effect on `next dev`.
  output: "standalone",
};

export default nextConfig;
