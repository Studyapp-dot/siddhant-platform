import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/topic',
        destination: '/nodes',
        permanent: true,
      },
      {
        source: '/search',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/watchlist',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
