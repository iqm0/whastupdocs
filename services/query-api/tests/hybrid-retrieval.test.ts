import assert from "node:assert/strict";
import test from "node:test";

import { rerankHybridCandidates } from "../src/lib/hybrid-retrieval.js";

test("rerankHybridCandidates boosts intent-aligned chunks", () => {
  const now = new Date().toISOString();
  const response = rerankHybridCandidates(
    "oauth token auth",
    [
      {
        chunk_id: "a",
        score: 0,
        text: "General overview without details",
        title: "Overview",
        url: "https://example.com/overview",
        source: "example",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.8,
        fts_score: 0.2,
      },
      {
        chunk_id: "b",
        score: 0,
        text: "Use OAuth bearer token authentication flow.",
        title: "Authentication",
        url: "https://example.com/auth",
        source: "example",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.8,
        fts_score: 0.2,
      },
    ],
    2,
  );

  assert.equal(response.results.length, 2);
  assert.equal(response.results[0]?.chunk_id, "b");
});

test("rerankHybridCandidates boosts semantically aligned chunks", () => {
  const now = new Date().toISOString();
  const response = rerankHybridCandidates(
    "rate limit retries",
    [
      {
        chunk_id: "a",
        score: 0,
        text: "Retry API requests using exponential backoff and jitter.",
        title: "Retries",
        url: "https://example.com/retries",
        source: "example",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.8,
        fts_score: 0.8,
        semantic_score: 0.1,
      },
      {
        chunk_id: "b",
        score: 0,
        text: "Use bounded retries for rate-limit errors.",
        title: "Limits",
        url: "https://example.com/limits",
        source: "example",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.65,
        fts_score: 0.6,
        semantic_score: 0.95,
      },
    ],
    2,
  );

  assert.equal(response.results[0]?.chunk_id, "b");
});
