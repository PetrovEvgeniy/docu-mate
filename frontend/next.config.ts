import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/': ['./**/*'],
    },
  },
};

export default nextConfig;
