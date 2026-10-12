import { defineConfig } from "vite";

// ponytail: base relative so the built preview works from a subfolder.
// Upgrade to base slash only if P6 ever becomes the domain root.
export default defineConfig({
  base: "./"
});
