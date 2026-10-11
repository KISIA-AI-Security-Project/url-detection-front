import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "extension" ? "./" : "/",
  server: {
    proxy: {
      "/api": {
        target: "https://d2gmygchoew9ed.cloudfront.net",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: mode === "extension" ? "dist-extension" : "dist",
    rollupOptions: { input: { main: "index.html", popup: "popup.html" } },
  },
}));
