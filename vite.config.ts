import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Garfish Parent Container",
        short_name: "Garfish",
        start_url: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#0f172a",
        icons: [
          {
            src: "/pwa-192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          },
          {
            src: "/pwa-512.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/apps\//]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    port: 5173
  }
});
