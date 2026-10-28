// vite.index-only.config.js
import path from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.json'],
  root: import.meta.dirname,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'index.html'),
    },
  },
});
