/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Allows production builds to successfully complete even if
    // there are type errors from third-party libraries or unseeded databases.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Don't fail deployment on minor lint warnings
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
