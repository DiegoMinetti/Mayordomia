import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// vite.config.ts is evaluated in Node by Vite, but the project's tsconfig
// doesn't include @types/node (it intentionally keeps the app bundle free of
// Node globals). Read the base path from the env without pulling node types
// in: `loadEnv` would do this cleanly but requires more setup, so we just
// duck-type process here.
interface ProcessLike { env?: { VITE_BASE_PATH?: string } }
const proc: ProcessLike | undefined = (globalThis as { process?: ProcessLike }).process;
const envBase: string | undefined = proc?.env?.['VITE_BASE_PATH'];

export default defineConfig(({ command }) => {
  const base = envBase ?? (command === 'serve' ? '/' : '/Mayordomia/');
  return {
    base,
    plugins: [react(), VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mayordomía', short_name: 'Mayordomía', description: 'Organización para servir',
        theme_color: '#214E46', background_color: '#F7F5EF', display: 'standalone',
        start_url: base,
        scope: base,
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg}'] }
    })],
    test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }
  };
});
