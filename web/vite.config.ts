import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/health': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/engine-status': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
