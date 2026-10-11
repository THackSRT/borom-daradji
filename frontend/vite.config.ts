import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// En développement, /api et /storage sont relayés vers Laravel (php artisan serve).
const backend = process.env.VITE_BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api": backend,
      "/storage": backend,
    },
  },
  // `npm run preview` (build de production, service worker compris) : mêmes relais.
  preview: {
    port: 4173,
    proxy: {
      "/api": backend,
      "/storage": backend,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
