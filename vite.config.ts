import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Store-listing screenshots are only ever read by the install prompt,
        // which is online by definition. No sense spending offline cache on them.
        globIgnores: ['**/screenshots/**'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Backwards Brain — Reverse Speech Game',
        short_name: 'Backwards Brain',
        description: 'Record a phrase, hear it backwards, then try to say it backwards yourself!',
        theme_color: '#7c3aed',
        background_color: '#0f0a1e',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Both form factors are needed for the richer install UI: at least one
        // `wide` for desktop, and at least one non-`wide` for mobile.
        screenshots: [
          {
            src: 'screenshots/home-wide.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Backwards Brain on a laptop, ready to record a phrase',
          },
          {
            src: 'screenshots/home-narrow.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Backwards Brain on a phone, ready to record a phrase',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
