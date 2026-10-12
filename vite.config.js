import { defineConfig } from "vite";

// ponytail: single root serves home plus P1-P5 static plus P6 transformed.
// Keep base relative so preview and Vercel subpaths resolve the same.
export default defineConfig({
  base: "./",
  server: { port: 8000, strictPort: true }
});
