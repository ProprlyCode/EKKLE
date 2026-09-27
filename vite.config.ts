import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Accounts live at <sub>.localhost in dev and tests (docs/tenancy.md).
  server: { allowedHosts: ['.localhost'] },
  preview: { allowedHosts: ['.localhost'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
