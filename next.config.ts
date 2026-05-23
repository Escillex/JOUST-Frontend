import type { NextConfig } from "next";

const hostIp = process.env.HOST_IP || "localhost";
const backendPort = process.env.BACKEND_PORT || "4000";
const backendUrl = process.env.BACKEND_URL || `http://${hostIp}:${backendPort}`;

const nextConfig: NextConfig = {
  // Only enable standalone output for production/Docker builds
  output: 'standalone',
  serverExternalPackages: [],
  allowedDevOrigins: [
    "localhost",
    hostIp,
    `localhost:3000`,
    `${hostIp}:3000`,
    `${hostIp}:${backendPort}`,
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        `localhost:3000`,
        `${hostIp}:3000`,
        `${hostIp}:${backendPort}`,
        `http://localhost:3000`,
        `http://${hostIp}:3000`,
        `http://${hostIp}:${backendPort}`,
      ],
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
