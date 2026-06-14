import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = (() => {
  if (!supabaseUrl) return null;

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
          },
        ]
      : undefined,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'chrismworks.ca',
          },
        ],
        destination: 'https://chrismworks.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.chrismworks.ca',
          },
        ],
        destination: 'https://chrismworks.com/:path*',
        permanent: true,
      },
      {
        source: '/school',
        destination: '/schools',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
