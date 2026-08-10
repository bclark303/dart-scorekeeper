import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the app deployable as a normal Node container in addition to Vercel.
  // Vercel can still deploy the same Next.js project; the standalone output is
  // primarily our portability/self-hosting escape hatch.
  output: "standalone",
};

export default nextConfig;
