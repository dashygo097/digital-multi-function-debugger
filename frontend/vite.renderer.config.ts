import { defineConfig } from "vite";
import { resolve } from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@components": resolve(__dirname, "./src/components"),
      "@utils": resolve(__dirname, "./src/utils"),
      "@styles": resolve(__dirname, "./src/styles"),
      "@contexts": resolve(__dirname, "./src/contexts"),
      "@assets": resolve(__dirname, "./src/assets"),
    },
  },
});
