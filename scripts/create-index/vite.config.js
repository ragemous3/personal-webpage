// vite.index-only.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.json'],
  root: __dirname,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
