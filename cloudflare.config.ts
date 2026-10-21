import {
  bindings,
  defineConfig,
  defineWorker,
  exports as workerExports,
} from "cf/config";

const workerName = "read-and-reflect";

function environmentText(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

const providerName = environmentText("AI_PROVIDER", "mock").toLowerCase();
if (providerName !== "mock" && providerName !== "openai") {
  throw new Error("AI_PROVIDER must be either mock or openai.");
}

const providerSecretBindings =
  providerName === "openai"
    ? {
        OPENAI_API_KEY: bindings.secret(),
        AI_QUOTA_HASH_SECRET: bindings.secret(),
      }
    : {};

export default defineConfig({
  worker: defineWorker({
    name: workerName,
    entrypoint: "./worker/index.ts",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      ...providerSecretBindings,
      AI_PROVIDER: bindings.text(providerName),
      OPENAI_MODEL: bindings.text(
        environmentText("OPENAI_MODEL", "gpt-5-mini"),
      ),
      OPENAI_TIMEOUT_MS: bindings.text(
        environmentText("OPENAI_TIMEOUT_MS", "15000"),
      ),
      OPENAI_MAX_RETRIES: bindings.text(
        environmentText("OPENAI_MAX_RETRIES", "1"),
      ),
      APP_ALLOWED_ORIGINS: bindings.text(
        environmentText("APP_ALLOWED_ORIGINS", "http://localhost:3001"),
      ),
      AI_MAX_REQUEST_BYTES: bindings.text(
        environmentText("AI_MAX_REQUEST_BYTES", "12000"),
      ),
      AI_INSTALLATION_MONTHLY_LIMIT: bindings.text(
        environmentText("AI_INSTALLATION_MONTHLY_LIMIT", "20"),
      ),
      AI_IP_MONTHLY_LIMIT: bindings.text(
        environmentText("AI_IP_MONTHLY_LIMIT", "200"),
      ),
      AI_MONTHLY_BUDGET_USD: bindings.text(
        environmentText("AI_MONTHLY_BUDGET_USD", "250"),
      ),
      AI_ESTIMATED_REQUEST_COST_USD: bindings.text(
        environmentText("AI_ESTIMATED_REQUEST_COST_USD", "0.01"),
      ),
      PROMPT_CONTROL_STORE: bindings.text("cloudflare"),
      PROMPT_CONTROLS: bindings.durableObject({
        worker: workerName,
        exportName: "PromptControlDurableObject",
      }),
    },
    exports: {
      PromptControlDurableObject: workerExports.durableObject({
        storage: "sqlite",
      }),
    },
  }),
});
