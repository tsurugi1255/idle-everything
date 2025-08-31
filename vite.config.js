import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: "Idle Everything",
        short_name: "Idle Everything",
        start_url: ".",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0d6efd",
        icons: [
          {
            src: "/icon.jpg",
            sizes: "612x612",
            type: "image/jpg"
          }
        ]
      }
    })
  ],
})
