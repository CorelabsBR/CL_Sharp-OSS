import { defineConfig } from "vite";
import path from "node:path";

const vitePort = Number(process.env.VITE_PORT ?? 5173);

export default defineConfig({
  root: ".",
  publicDir: "resources",
  base: "./",
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@editor": path.resolve(__dirname, "src/editor"),
      "@renderer": path.resolve(__dirname, "src/renderer"),
      "@shared": path.resolve(__dirname, "src/shared")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    host: "127.0.0.1",
    port: Number.isFinite(vitePort) ? vitePort : 5173,
    strictPort: true
  }
});
