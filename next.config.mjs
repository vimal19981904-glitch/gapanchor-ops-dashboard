/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['msedge-tts', 'ws', 'bufferutil', 'utf-8-validate'],
  },
};

export default nextConfig;
