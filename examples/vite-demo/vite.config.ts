import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
    allowedHosts: ["localhost", "127.0.0.1", "709b8936bddd.ngrok-free.app"],
  },
  root: __dirname,
  resolve: {
    alias: {
      "@chime/one2one": path.resolve(__dirname, "../../src"),
    },
  },
});
