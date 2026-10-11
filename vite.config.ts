import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // Expose only the public deployment address. Never expose the env object or keys.
    define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify(env.VITE_CONVEX_URL || env.CONVEX_URL || "") },
    server: { host: "0.0.0.0" },
    build: { rollupOptions: { input: { app: "index.html", milestone1: "milestone-1.html" } } },
  };
});
