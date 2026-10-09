import type { NextConfig } from "next";

// Stamped into every build so open apps can tell when a newer version is live
const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

// Content-Security-Policy, in REPORT-ONLY mode first (it logs what it would block without blocking anything).
// Switch the header key to "Content-Security-Policy" once the reports are clean. Tally runs on the user's PC (localhost).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://mercury.phonepe.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.phonepe.com https://api-preprod.phonepe.com http://localhost:7001 http://localhost:7002 http://127.0.0.1:7001 http://127.0.0.1:7002",
  "frame-src 'self' https://mercury.phonepe.com https://api.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://mercury.phonepe.com",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  poweredByHeader: false,
  experimental: {}, // build-bust: 2026-08-18
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          // Never a wildcard: pages and API answer only to frework.online
          { key: "Access-Control-Allow-Origin", value: "https://frework.online" },
          { key: "Vary", value: "Origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/refund", destination: "/refund-policy", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.frework.online" }],
        destination: "https://frework.online/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000"; // frework.online API
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

