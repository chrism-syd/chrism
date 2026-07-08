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
        source: '/school',
        destination: '/schools',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
