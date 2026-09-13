import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  // Load env files explicitly so the config sees `VITE_BASE_PATH` from
  // .env.production. Without this, the config falls back to /Mayordomia/
  // (the old GitHub Pages path) and assets 404 in the Pi nginx deploy.
  const env = loadEnv(mode, process.cwd(), '');
  const envBase = env['VITE_BASE_PATH'];
  const base = envBase && envBase.length > 0
    ? envBase
    : command === 'serve' ? '/' : '/Mayordomia/';
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
