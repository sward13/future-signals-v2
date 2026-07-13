import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Single-file IIFE bundle for MV3 content script (no shared chunks). */
export default defineConfig({
  root: dirname,
  build: {
    lib: {
      entry: path.resolve(dirname, "src/content.ts"),
      name: "FutureSignalsCapture",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
