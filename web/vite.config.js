import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const gateway = env.VITE_DASHBOARD_GATEWAY_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_WEB_PORT || 5174),
      strictPort: true,
      proxy: {
        "/api": { target: gateway, changeOrigin: true },
      },
    },
  };
});
