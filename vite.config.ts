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
    sourcemap: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/monaco-editor")) return "monaco";
          if (id.includes("node_modules/@capacitor")) return "capacitor";
          if (id.includes("node_modules")) return "vendor";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: Number.isFinite(vitePort) ? vitePort : 5173,
    strictPort: true,
    watch: {
      // Some Linux environments impose a very small inotify/file-descriptor limit.
      // Polling keeps HMR available without allocating an inotify handle per path.
      usePolling: process.platform === "linux",
      interval: 700,
      // Android/packaging output can contain thousands of files and must never trigger HMR.
      ignored: ["**/.git/**", "**/dist/**", "**/dist-electron/**", "**/android/**", "**/release/**"]
    }
  }
});
