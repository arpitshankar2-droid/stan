import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws (used by @neondatabase/serverless) probes for its optional native
  // accelerators at require-time; webpack bundling them as stubs instead of
  // leaving them unresolved makes ws think they're present and call methods
  // that don't exist on the stub. Excluding them from the bundle lets Node's
  // real module resolution fail over to ws's pure-JS path, as intended.
  webpack: (config) => {
    config.externals.push("bufferutil", "utf-8-validate");
    return config;
  },
};

export default nextConfig;
