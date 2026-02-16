type EmbeddingsProvider = "openai" | "ollama";

type EmbeddingConfig = {
  enabled: boolean;
  provider: EmbeddingsProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  maxCharsPerInput: number;
};

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function numberEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) {
    return fallback;
  }
  return raw;
}

function getConfig(): EmbeddingConfig {
  const providerRaw = (process.env.WIUD_EMBEDDINGS_PROVIDER ?? "openai").toLowerCase();
  const provider: EmbeddingsProvider = providerRaw === "ollama" ? "ollama" : "openai";
  const model =
    process.env.WIUD_EMBEDDINGS_MODEL ??
    (provider === "ollama" ? "nomic-embed-text" : "text-embedding-3-small");

  return {
    enabled: boolEnv("WIUD_EMBEDDINGS_ENABLED", false),
    provider,
    model,
    baseUrl:
      process.env.WIUD_EMBEDDINGS_BASE_URL ??
      (provider === "ollama" ? DEFAULT_OLLAMA_BASE_URL : DEFAULT_OPENAI_BASE_URL),
    apiKey: process.env.WIUD_EMBEDDINGS_API_KEY,
    timeoutMs: numberEnv("WIUD_EMBEDDINGS_TIMEOUT_MS", 20000),
    maxCharsPerInput: numberEnv("WIUD_EMBEDDINGS_MAX_CHARS", 3500),
  };
}

function trimInput(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars);
}

function normalizeVector(values: number[]): number[] | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) {
    return null;
  }

  const magnitude = Math.sqrt(clean.reduce((acc, value) => acc + value * value, 0));
  if (magnitude <= 0) {
    return null;
  }

  return clean.map((value) => value / magnitude);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function embedViaOpenAI(config: EmbeddingConfig, texts: string[]): Promise<Array<number[] | null>> {
  const response = await fetchWithTimeout(
    `${config.baseUrl.replace(/\/$/, "")}/embeddings`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
      }),
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    return texts.map(() => null);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  return texts.map((_, index) => {
    const vector = payload.data?.[index]?.embedding;
    if (!Array.isArray(vector)) {
      return null;
    }
    return normalizeVector(vector.map((value) => Number(value)));
  });
}

async function embedViaOllama(config: EmbeddingConfig, texts: string[]): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = [];

  for (const text of texts) {
    const response = await fetchWithTimeout(
      `${config.baseUrl.replace(/\/$/, "")}/api/embeddings`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          prompt: text,
        }),
      },
      config.timeoutMs,
    );

    if (!response.ok) {
      results.push(null);
      continue;
    }

    const payload = (await response.json()) as { embedding?: number[] };
    if (!Array.isArray(payload.embedding)) {
      results.push(null);
      continue;
    }

    results.push(normalizeVector(payload.embedding.map((value) => Number(value))));
  }

  return results;
}

export function getEmbeddingModelId(): string {
  const config = getConfig();
  return `${config.provider}:${config.model}`;
}

export async function embedTexts(texts: string[]): Promise<Array<number[] | null> | null> {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  const normalizedTexts = texts.map((text) => trimInput(text, config.maxCharsPerInput));
  if (normalizedTexts.length === 0) {
    return [];
  }

  try {
    if (config.provider === "ollama") {
      return await embedViaOllama(config, normalizedTexts);
    }
    return await embedViaOpenAI(config, normalizedTexts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`embeddings_failed provider=${config.provider} reason=${message}\n`);
    return null;
  }
}
