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
  turbopack: {
    resolveAlias: {
      'read-excel-file': 'read-excel-file/browser',
      'write-excel-file': 'write-excel-file/browser',
    },
  },
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
        source: '/ccic/schools',
        destination: '/ccic',
        permanent: false,
      },
      {
        source: '/schools',
        destination: '/',
        permanent: false,
      },
      {
        source: '/ccic/schools-2/:school/:path*',
        destination: '/ccic/schools/:school/:path*',
        permanent: true,
      },
      {
        source: '/schools-2/:school/:path*',
        destination: '/schools/:school/:path*',
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
