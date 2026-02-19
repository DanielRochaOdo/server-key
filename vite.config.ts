import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lucide-react': fileURLToPath(new URL('./src/lib/icons.tsx', import.meta.url)),
      xlsx: 'xlsx/dist/xlsx.full.min.js',
      'xlsx-js-style': 'xlsx-js-style/dist/xlsx.bundle.js',
      stream: fileURLToPath(new URL('./src/shims/stream.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['xlsx-js-style'],
    exclude: ['xlsx'],
  },
});
