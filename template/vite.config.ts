import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {rollupOptions: {input: {main: "index.html", settings: "settings.html", pet: "vibemon.html", bubble: "vibemon-bubble.html"}}},
  // module-chat spawns Web Workers through `new URL("@alwith/module-chat/*.worker", import.meta.url)`;
  // Vite's dependency pre-bundling breaks those URLs, so serve these ESM packages directly (as U does).
  // Their CommonJS dependencies (Base UI's store shim, diff2html for patches) still need pre-bundling (G11).
  optimizeDeps: {
    exclude: ["@alwith/module-chat", "@alwith/module-auth"],
    include: ["diff2html", "diff2html/lib/types", "use-sync-external-store/shim", "use-sync-external-store/shim/with-selector"]
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    watch: { ignored: ["**/src-tauri/**"] }
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  envPrefix: ["VITE_", "TAURI_ENV_*"]
})
