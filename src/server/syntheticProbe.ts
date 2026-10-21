export interface SyntheticProbeResult {
  ok: boolean;
  web: boolean;
  health: boolean;
  prompt: boolean;
  errors: string[];
}

function isPrompt(value: unknown): value is { required: boolean } {
  if (!value || typeof value !== "object") return false;
  const prompt = value as Record<string, unknown>;
  return (
    typeof prompt["text"] === "string" &&
    prompt["text"].length >= 15 &&
    typeof prompt["skill"] === "string" &&
    prompt["skill"].length >= 2 &&
    typeof prompt["explanation"] === "string" &&
    prompt["explanation"].length >= 8 &&
    typeof prompt["required"] === "boolean" &&
    typeof prompt["suggestedResponseLength"] === "string" &&
    ["generic", "parent_notes", "parent_summary"].includes(
      String(prompt["grounding"]),
    ) &&
    ["accessible", "grade_level", "challenging", "advanced"].includes(
      String(prompt["difficultyLevel"]),
    )
  );
}

const syntheticPayload = {
  child: {
    gradeOrAge: "Adult",
    difficulty: "grade_level",
    responseLength: "short",
  },
  book: {
    title: "Synthetic Test Book",
    author: "Synthetic Test Author",
    genre: "fiction",
    progress: "Chapter 1",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

export async function runSyntheticProbe(
  rawBaseUrl: string,
  allowedOrigin: string,
  fetcher: typeof fetch = fetch,
): Promise<SyntheticProbeResult> {
  const baseUrl = new URL(rawBaseUrl);
  if (
    baseUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(baseUrl.hostname)
  ) {
    throw new Error("Synthetic probes require HTTPS except on localhost.");
  }
  const result: SyntheticProbeResult = {
    ok: false,
    web: false,
    health: false,
    prompt: false,
    errors: [],
  };

  try {
    const response = await fetcher(new URL("/", baseUrl));
    result.web = response.status === 200;
    if (!result.web) result.errors.push(`web_status_${response.status}`);
  } catch {
    result.errors.push("web_request_failed");
  }

  try {
    const response = await fetcher(new URL("/api/health", baseUrl));
    const body = (await response.json()) as { status?: unknown };
    result.health =
      response.status === 200 &&
      response.headers.get("cache-control") === "no-store" &&
      body.status === "ok";
    if (!result.health) result.errors.push("health_contract_failed");
  } catch {
    result.errors.push("health_request_failed");
  }

  try {
    const response = await fetcher(new URL("/api/prompts", baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: allowedOrigin,
        "x-installation-token": "00000000-0000-4000-8000-000000000009",
      },
      body: JSON.stringify(syntheticPayload),
    });
    const body = (await response.json()) as {
      prompts?: unknown[];
      provider?: unknown;
      fallback?: unknown;
    };
    result.prompt =
      response.status === 200 &&
      response.headers.get("cache-control") === "no-store" &&
      body.prompts?.length === 4 &&
      body.prompts.every(isPrompt) &&
      body.prompts.filter((prompt) => isPrompt(prompt) && prompt.required)
        .length === 3 &&
      body.provider === "mock" &&
      body.fallback === false;
    if (!result.prompt) result.errors.push("prompt_contract_failed");
  } catch {
    result.errors.push("prompt_request_failed");
  }

  result.ok = result.web && result.health && result.prompt;
  return result;
}
