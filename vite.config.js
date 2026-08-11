import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // navigateFallback null: il routing SPA è gestito da Vercel (handle:filesystem).
        // Il Service Worker non intercetta le navigazioni.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'GeoKanban V3',
        short_name: 'GeoKanban',
        description: 'Kinetic Fleet Management System',
        theme_color: '#0058be',
        background_color: '#f7f9fb',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks — cached independently by the browser across deploys
          'vendor-framer':  ['framer-motion'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-recharts':['recharts'],
          'vendor-xlsx':    ['xlsx'],
        },
      },
    },
  },
})
