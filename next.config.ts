import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output for the Docker deployment on the office
  // server (spec §8) — no effect on `next dev`.
  output: "standalone",
  async redirects() {
    return [
      // The board lived at /schedule before the "Production" naming
      // (design spec §13); keep old bookmarks working.
      { source: "/schedule", destination: "/production", permanent: true },
    ];
  },
};

export default nextConfig;
