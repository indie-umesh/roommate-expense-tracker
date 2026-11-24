import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.svg", "favicon.svg"],
      manifest: {
        name: "Roommate Expense Tracker",
        short_name: "Roommate",
        description: "Fast 3-tap expense splitting and settlement for roommates",
        theme_color: "#00966d",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: process.env.VITE_BASE || "/app/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
