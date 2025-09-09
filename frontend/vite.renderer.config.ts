import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@components": resolve("./src/components"),
      "@utils": resolve("./src/utils"),
      "@styles": resolve("./src/styles"),
    },
  },
});
