import type { NextConfig } from "next";

const hostIp = process.env.HOST_IP || "localhost";
const backendPort = process.env.BACKEND_PORT || "4000";
const backendUrl = process.env.BACKEND_URL || `http://${hostIp}:${backendPort}`;

const nextConfig: NextConfig = {
  // Only enable standalone output for production/Docker builds
  ...(process.env.STANDALONE === "true" ? { output: "standalone" as const } : {}),
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
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: hostIp,
        port: String(backendPort),
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "joust.escillex.com",
        pathname: "/api/backend/uploads/**",
      },
    ],
  },
};

export default nextConfig;
