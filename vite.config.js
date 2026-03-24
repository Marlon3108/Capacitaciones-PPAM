import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Mantenemos Tailwind para que no se rompan los estilos
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'LCCS Capacitaciones',
        short_name: 'LCCS App',
        description: 'Aplicación para la gestión de Listas de Chequeo de Capacitación en Sitio',
        theme_color: '#2563eb', // El color azul de la app
        background_color: '#ffffff',
        display: 'standalone', // Esto quita la barra del navegador en el celular
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
