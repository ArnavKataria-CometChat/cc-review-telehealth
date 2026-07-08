/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle for a lean Docker runtime image.
  output: 'standalone',
  reactStrictMode: true,
  // The build gate for this component is `docker build` (type-checking runs via
  // `tsc --noEmit` in verify.sh). We don't ship an ESLint config in the
  // baseline, so don't let a missing linter fail the production build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
