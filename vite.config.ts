import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dungeon-dash-proto/',
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
