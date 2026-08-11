import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/static/dist/",

  build: {
    outDir: "static/dist",
    emptyOutDir: true,
    manifest: true,

    rolldownOptions: {
      input: {
        map: resolve(__dirname, "static/js/map.js"),
        savedRoutes: resolve(__dirname, "static/js/routes/savedRoutesDashboard.js"),
        importRoute: resolve(__dirname, "static/js/importRoute.js"),
      },
      output: {
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});