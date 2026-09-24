import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// In dev, Vite serves the app and proxies the live photo/state API to the
// same Node server used in production (started alongside by scripts/dev.mjs).
const API = `http://127.0.0.1:${process.env.PORT || 4747}`;

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/wallpapers': API,
      '/voronoi-images': API,
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        spike: resolve(import.meta.dirname, 'spike.html'),
      },
    },
  },
});
