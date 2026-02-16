import type { SearchResponse, SearchResult } from "../types.js";

type Candidate = SearchResult & {
  ilike_score: number;
  fts_score: number;
  semantic_score?: number;
};

const QUERY_EXPANSIONS: Record<string, string[]> = {
  auth: ["authentication", "oauth", "token", "bearer"],
  oauth: ["token", "authorization"],
  payments: ["payment", "payout", "charge", "invoice"],
  webhook: ["event", "callback", "signature"],
  reasoning: ["reasoning models", "deliberate", "chain"],
  migration: ["upgrade", "deprecation", "breaking change"],
  retry: ["backoff", "idempotency", "timeout"],
  plaid: ["link", "link token", "products", "payment initiation", "open banking"],
  stripe: ["payment intents", "webhooks", "endpoint secret", "checkout"],
  "payment": ["initiation", "intent", "mandate", "consent", "sepa", "pis", "open banking"],
  "open": ["open banking", "open-banking"],
  "banking": ["open banking", "open-banking"],
  europe: ["eu", "uk", "sepa"],
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function buildIntentTerms(query: string): Set<string> {
  const terms = new Set<string>();
  for (const token of tokenize(query)) {
    terms.add(token);
    const expanded = QUERY_EXPANSIONS[token] ?? [];
    for (const term of expanded) {
      terms.add(term.toLowerCase());
    }
  }
  return terms;
}

function buildIntentPhrases(query: string): string[] {
  const terms = tokenize(query);
  const phrases = new Set<string>();
  for (let i = 0; i < terms.length - 1; i += 1) {
    phrases.add(`${terms[i]} ${terms[i + 1]}`);
  }
  return Array.from(phrases);
}

function computeIntentScore(item: SearchResult, intentTerms: Set<string>): number {
  if (intentTerms.size === 0) {
    return 0;
  }

  const haystack = `${item.title} ${item.text} ${item.url}`.toLowerCase();
  let hits = 0;
  for (const term of intentTerms) {
    if (haystack.includes(term)) {
      hits += 1;
    }
  }
  return hits / intentTerms.size;
}

function computePhraseScore(item: SearchResult, intentPhrases: string[]): number {
  if (intentPhrases.length === 0) {
    return 0;
  }

  const haystack = `${item.title} ${item.text} ${item.url}`.toLowerCase();
  let hits = 0;
  for (const phrase of intentPhrases) {
    if (haystack.includes(phrase)) {
      hits += 1;
    }
  }
  return hits / intentPhrases.length;
}

function computeSchemaNoisePenalty(text: string): number {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    return 0;
  }

  const schemaLikeLines = lines.filter((line) =>
    /^\s*[a-z0-9_]+\s+(nullable\s+)?(string|integer|number|boolean|array|object)\b/i.test(line.trim())
  ).length;

  const typeTokenMatches = text.match(/\b(nullable|string|integer|number|boolean|array|object)\b/gi);
  const typeTokenCount = typeTokenMatches?.length ?? 0;

  const linePenalty = Math.min(1, schemaLikeLines / 6);
  const tokenPenalty = Math.min(1, typeTokenCount / 45);
  return linePenalty * 0.7 + tokenPenalty * 0.3;
}

function computeContentQualityScore(item: SearchResult): number {
  const text = `${item.title}\n${item.text}`;
  const penalty = computeSchemaNoisePenalty(text);
  return Math.max(0, 1 - penalty);
}

function computeSectionTypeScore(item: SearchResult, query: string): number {
  const terms = tokenize(query);
  const actionIntent = terms.some((term) =>
    ["enable", "setup", "configure", "integrate", "create", "start", "initiation"].includes(term)
  );
  if (!actionIntent) {
    return 0.5;
  }

  const context = `${item.heading_path ?? ""} ${item.title} ${item.url}`.toLowerCase();
  let score = 0.5;

  if (/\b(quickstart|get started|get-started|how to|setup|configure|integration|guide)\b/.test(context)) {
    score += 0.35;
  }

  if (/\b(dashboard|activity|logs?|errors?|status|reference|schema)\b/.test(context)) {
    score -= 0.3;
  }

  // Domain-specific boosts for Plaid payment initiation and Open Banking guides.
  if (/plaid\.com\/.+\b(payment-initiation|open-banking)\b/.test(item.url.toLowerCase())) {
    score += 0.15;
  }
  if (/stripe\.com\/.+\b(webhooks|payment-intents|checkout)\b/.test(item.url.toLowerCase())) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

function normalizeByMax(values: number[]): number[] {
  const max = values.reduce((acc, value) => Math.max(acc, value), 0);
  if (max <= 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / max);
}

export function rerankHybridCandidates(
  query: string,
  candidates: Candidate[],
  topK: number,
): SearchResponse {
  if (candidates.length === 0) {
    return { results: [] };
  }

  const intentTerms = buildIntentTerms(query);
  const intentPhrases = buildIntentPhrases(query);
  const normalizedFts = normalizeByMax(candidates.map((item) => item.fts_score));
  const semanticShifted = candidates.map((item) =>
    Math.max(0, Math.min(1, ((item.semantic_score ?? 0) + 1) / 2))
  );
  const normalizedSemantic = normalizeByMax(semanticShifted);
  const now = Date.now();

  const scored = candidates.map((item, idx) => {
    const intentScore = computeIntentScore(item, intentTerms);
    const phraseScore = computePhraseScore(item, intentPhrases);
    const qualityScore = computeContentQualityScore(item);
    const sectionTypeScore = computeSectionTypeScore(item, query);
    const ageMinutes = Math.max(0, (now - new Date(item.last_changed_at).getTime()) / 60000);
    const recencyScore = 1 / (1 + ageMinutes / (24 * 60));
    const combined =
      item.ilike_score * 0.2 +
      normalizedFts[idx]! * 0.22 +
      normalizedSemantic[idx]! * 0.26 +
      intentScore * 0.12 +
      phraseScore * 0.09 +
      sectionTypeScore * 0.08 +
      qualityScore * 0.02 +
      recencyScore * 0.01;

    return {
      ...item,
      score: combined,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.slice(0, topK).map((item) => ({
      chunk_id: item.chunk_id,
      score: item.score,
      text: item.text,
      heading_path: item.heading_path ?? null,
      code_lang: item.code_lang ?? null,
      title: item.title,
      url: item.url,
      source: item.source,
      version_tag: item.version_tag ?? null,
      last_changed_at: item.last_changed_at,
    })),
  };
}
