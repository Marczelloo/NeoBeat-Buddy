import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const activityGateway = env.VITE_ACTIVITY_GATEWAY_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_ACTIVITY_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: activityGateway,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
