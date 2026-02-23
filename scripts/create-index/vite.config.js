// vite.index-only.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

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
