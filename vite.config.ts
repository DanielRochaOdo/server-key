import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      xlsx: 'xlsx/dist/xlsx.full.min.js',
      stream: fileURLToPath(new URL('./src/shims/stream.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react', 'xlsx', 'xlsx-js-style'],
  },
});
