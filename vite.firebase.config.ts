import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./firebase", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    emptyOutDir: true,
    outDir: fileURLToPath(new URL("./firebase-dist", import.meta.url)),
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
