import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/api/chat',
        destination: `${BACKEND_URL}/api/chat`,
      },
      {
        source: '/api/bot/:path*',
        destination: `${BACKEND_URL}/api/bot/:path*`,
      },
      {
        source: '/api/faqs/:path*',
        destination: `${BACKEND_URL}/api/faqs/:path*`,
      },
      {
        source: '/api/faqs',
        destination: `${BACKEND_URL}/api/faqs`,
      },
    ];
  },
};

export default nextConfig;
