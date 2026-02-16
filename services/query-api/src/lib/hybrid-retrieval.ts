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
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
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
  const normalizedFts = normalizeByMax(candidates.map((item) => item.fts_score));
  const semanticShifted = candidates.map((item) =>
    Math.max(0, Math.min(1, ((item.semantic_score ?? 0) + 1) / 2))
  );
  const normalizedSemantic = normalizeByMax(semanticShifted);
  const now = Date.now();

  const scored = candidates.map((item, idx) => {
    const intentScore = computeIntentScore(item, intentTerms);
    const ageMinutes = Math.max(0, (now - new Date(item.last_changed_at).getTime()) / 60000);
    const recencyScore = 1 / (1 + ageMinutes / (24 * 60));
    const combined =
      item.ilike_score * 0.28 +
      normalizedFts[idx]! * 0.28 +
      normalizedSemantic[idx]! * 0.32 +
      intentScore * 0.08 +
      recencyScore * 0.04;

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
      title: item.title,
      url: item.url,
      source: item.source,
      version_tag: item.version_tag ?? null,
      last_changed_at: item.last_changed_at,
    })),
  };
}
