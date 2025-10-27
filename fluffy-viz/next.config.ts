import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack configuration for DuckDB WASM
  webpack: (config, { isServer }) => {
    // Enable WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Note: client-side resolve.alias causes Turbopack to crash
    // with "boolean values are invalid in exports field entries"

    return config;
  },

  // Turbopack configuration for embedding-atlas compatibility
  // Note: Currently turbopack has issues with embedding-atlas
  // experimental: {
  //   turbo: {
  //     resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  //   },
  // },

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
