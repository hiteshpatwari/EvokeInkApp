import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { requireProductionPromptApiUrl } from "./src/promptApiConfig.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, import.meta.dirname, "VITE_");
  const promptApiUrl = requireProductionPromptApiUrl(
    environment["VITE_PROMPT_API_URL"],
    mode,
  );

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.join(repositoryRoot, "src") },
      dedupe: ["react", "react-dom"],
    },
    define: {
      __PROMPT_API_URL__: JSON.stringify(promptApiUrl ?? ""),
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
