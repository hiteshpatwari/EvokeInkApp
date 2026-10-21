export function requireProductionPromptApiUrl(
  value: string | undefined,
  mode: string,
): string | undefined {
  const configured = value?.trim();
  if (!configured && mode !== "production") return undefined;

  try {
    const url = new URL(configured ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    ) {
      throw new Error("unsafe URL");
    }
    return url.href;
  } catch {
    throw new Error(
      "VITE_PROMPT_API_URL must be an explicit HTTPS URL for a production mobile build.",
    );
  }
}
