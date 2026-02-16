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

const queryEmbeddingCache = new Map<string, number[]>();
const QUERY_EMBEDDING_CACHE_LIMIT = 200;

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
    timeoutMs: numberEnv("WIUD_EMBEDDINGS_TIMEOUT_MS", 12000),
    maxCharsPerInput: numberEnv("WIUD_EMBEDDINGS_MAX_CHARS", 3500),
  };
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

function trimInput(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars);
}

function cacheGet(key: string): number[] | null {
  const hit = queryEmbeddingCache.get(key);
  if (!hit) {
    return null;
  }

  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, vector: number[]): void {
  if (queryEmbeddingCache.has(key)) {
    queryEmbeddingCache.delete(key);
  }
  queryEmbeddingCache.set(key, vector);

  while (queryEmbeddingCache.size > QUERY_EMBEDDING_CACHE_LIMIT) {
    const oldest = queryEmbeddingCache.keys().next().value;
    if (!oldest) {
      break;
    }
    queryEmbeddingCache.delete(oldest);
  }
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

async function requestOpenAIEmbedding(config: EmbeddingConfig, input: string): Promise<number[] | null> {
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
        input,
      }),
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = payload.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    return null;
  }

  return normalizeVector(vector.map((value) => Number(value)));
}

async function requestOllamaEmbedding(config: EmbeddingConfig, input: string): Promise<number[] | null> {
  const response = await fetchWithTimeout(
    `${config.baseUrl.replace(/\/$/, "")}/api/embeddings`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt: input,
      }),
    },
    config.timeoutMs,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    embedding?: number[];
  };

  if (!Array.isArray(payload.embedding)) {
    return null;
  }

  return normalizeVector(payload.embedding.map((value) => Number(value)));
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  const input = trimInput(text, config.maxCharsPerInput);
  if (!input) {
    return null;
  }

  const cacheKey = `${config.provider}:${config.model}:${input}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const vector =
      config.provider === "ollama"
        ? await requestOllamaEmbedding(config, input)
        : await requestOpenAIEmbedding(config, input);

    if (vector) {
      cacheSet(cacheKey, vector);
    }

    return vector;
  } catch {
    return null;
  }
}

export function getEmbeddingModelId(): string {
  const config = getConfig();
  return `${config.provider}:${config.model}`;
}

export function parseStoredEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return normalizeVector(value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseStoredEmbedding(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

export function cosineSimilarity(normalizedLeft: number[], normalizedRight: number[]): number {
  if (normalizedLeft.length === 0 || normalizedRight.length === 0) {
    return 0;
  }

  if (normalizedLeft.length !== normalizedRight.length) {
    return 0;
  }

  let dot = 0;
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    dot += normalizedLeft[index]! * normalizedRight[index]!;
  }
  return Math.max(-1, Math.min(1, dot));
}
