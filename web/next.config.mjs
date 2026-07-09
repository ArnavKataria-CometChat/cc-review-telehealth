/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle for a lean Docker runtime image.
  output: 'standalone',
  reactStrictMode: true,
  // The build gate for this component is `docker build` (type-checking runs via
  // `tsc --noEmit` in verify.sh). We don't ship an ESLint config in the
  // baseline, so don't let a missing linter fail the production build.
  eslint: { ignoreDuringBuilds: true },
  // The CometChat WebRTC calls SDK references Node built-ins (`fs`/`path`)
  // behind a runtime guard. They never execute in the browser, but webpack
  // still tries to resolve them for the client bundle — stub them out.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
