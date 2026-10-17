import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    proxy: {
      "/ws": { target: "http://localhost:3900", ws: true },
      "/health": "http://localhost:3900",
    },
  },
  build: { target: "es2022" },
});
