import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const activityGateway = env.VITE_ACTIVITY_GATEWAY_URL || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("@discord/embedded-app-sdk")) return "discord-sdk";
            if (id.includes("@phosphor-icons/react")) return "icons";
            if (id.includes("/motion/")) return "motion";
            return undefined;
          },
        },
      },
    },
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
