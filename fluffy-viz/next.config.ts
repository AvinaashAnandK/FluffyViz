import type { NextConfig } from "next";
import webpack from 'webpack';

const nextConfig: NextConfig = {
  // Skip bundling embedding-atlas on server (it's client-only anyway)
  serverExternalPackages: ['embedding-atlas'],

  // Webpack configuration for DuckDB WASM and embedding-atlas
  webpack: (config, { isServer }) => {
    // Enable WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add fallback for worker_threads (used by embedding-atlas workers)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      worker_threads: false,
    };

    // Ignore embedding-atlas on server build entirely
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^embedding-atlas/,
        })
      );
    }

    // For client build, handle embedding-atlas asset module compatibility
    if (!isServer) {
      // Ignore problematic worker file imports during static analysis
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /\.worker\.js$/,
          (resource: any) => {
            if (resource.request.includes('embedding-atlas')) {
              // Keep the request as-is, but mark for special handling
              resource.request = resource.request;
            }
          }
        )
      );
    }

    return config;
  },

  // Turbopack configuration for embedding-atlas and DuckDB compatibility
  turbopack: {
    resolveAlias: {
      // Provide mock worker_threads module with Worker class for browser environment
      // This allows embedding-atlas and DuckDB WASM code to bundle without errors
      'worker_threads': './src/lib/shims/worker-threads-shim.js',
      // Force DuckDB to use browser entry point instead of Node.js entry point
      '@duckdb/duckdb-wasm': './node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser.mjs',
    },
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
