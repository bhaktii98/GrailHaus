import type { NextConfig } from "next";

// shared/ writes NodeNext-style relative imports (e.g. "./types.js" pointing
// at types.ts) so tsc/Node resolve it correctly. Webpack supports remapping
// that via resolve.extensionAlias (used below); Turbopack does not yet
// (open bug: https://github.com/vercel/next.js/issues/82945), so `dev`/
// `build` are pinned to `--webpack` in package.json until that lands —
// don't drop the flag without re-testing that Turbopack can resolve
// @grailhaus/shared's exports.
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
