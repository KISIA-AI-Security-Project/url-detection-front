import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "extension" ? "./" : "/",
  build: {
    outDir: mode === "extension" ? "dist-extension" : "dist",
    rollupOptions: { input: { main: "index.html", popup: "popup.html" } },
  },
}));
