import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack configuration for DuckDB WASM
  webpack: (config, { isServer }) => {
    // Only apply to client-side builds
    if (!isServer) {
      // Handle WASM files
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });

      // Handle worker files
      config.module.rules.push({
        test: /\.worker\.js$/,
        type: 'asset/resource',
      });
    }

    // Fix for WASM modules
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },

  // Security headers required for SharedArrayBuffer (DuckDB threading)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
