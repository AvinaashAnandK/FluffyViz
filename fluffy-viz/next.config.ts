import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude embedding-atlas from server-side rendering
    if (isServer) {
      config.externals = [...(config.externals || []), 'embedding-atlas'];
    }

    // Handle WASM and worker files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;
