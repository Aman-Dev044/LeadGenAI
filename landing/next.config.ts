import type { NextConfig } from 'next';

/** Icons in /public — fingerprinted by name, so they can be cached forever. */
const STATIC_ICONS = [
  'icon.svg',
  'icon.png',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
].join('|');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // This folder sits next to a monorepo that has its own lockfile; pin the root
  // so Next traces files from here rather than guessing a parent directory.
  outputFileTracingRoot: __dirname,

  // A marketing site is mostly static: let Next compress and fingerprint it.
  compress: true,

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // The icon set never changes between deploys.
        source: `/:file(${STATIC_ICONS})`,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
