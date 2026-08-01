import path from "path";
import type { NextConfig } from "next";

const hostIp = process.env.HOST_IP || "localhost";
const backendPort = process.env.BACKEND_PORT || "4000";
const backendUrl = process.env.BACKEND_URL || `http://${hostIp}:${backendPort}`;

// Extra hostnames allowed to make dev-server asset and HMR requests, as a
// comma-separated list. Needed when `next dev` is reached through a tunnel
// rather than on the LAN: Next rejects dev requests from an origin it does not
// know, so the public hostname has to be named. See deploy.md 9.5.
//
// Deliberately its own variable rather than reusing HOST_IP: HOST_IP also feeds
// images.remotePatterns and the backendUrl fallback above, so putting a public
// hostname in it would break image optimization and the API base URL.
const extraDevOrigins = (process.env.EXTRA_DEV_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Only enable standalone output for production/Docker builds
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [],
  allowedDevOrigins: [
    "localhost",
    hostIp,
    `localhost:3000`,
    `${hostIp}:3000`,
    `${hostIp}:${backendPort}`,
    ...extraDevOrigins,
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
        // Server Actions keep their own origin allowlist, so a tunnelled
        // hostname has to be named here too or every action 403s.
        ...extraDevOrigins,
        ...extraDevOrigins.map((o) => `https://${o}`),
      ],
    },
  },
  async headers() {
    return [
      {
        // The service worker file itself must never be cached by the
        // browser: if it were, users could keep running an old caching
        // logic long after a new one was deployed.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
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