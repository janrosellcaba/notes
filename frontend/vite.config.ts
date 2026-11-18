import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: {
        name: "Notes",
        short_name: "Notes",
        description: "Personal notes, tasks, and meetings",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#09090B",
        theme_color: "#09090B",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        share_target: {
          action: "/capture",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2,webmanifest}"],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        configure: (proxy) => {
          const events = proxy as unknown as {
            on(event: "proxyReq", listener: (proxyReq: { removeHeader(name: string): void }) => void): void;
          };
          events.on("proxyReq", (proxyReq) => {
            // The browser origin is the Vite port. Drop it so local mutations
            // match the same-origin deployment the cookie was designed for.
            proxyReq.removeHeader("origin");
          });
        },
      },
    },
  },
});
