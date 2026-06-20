import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 4040,
    host: true,
    proxy: {
      "/api": { target: `http://localhost:${process.env.API_PORT || 4141}`, changeOrigin: true },
    },
  },
});
