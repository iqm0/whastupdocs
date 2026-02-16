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

test("rerankHybridCandidates penalizes schema-heavy chunks and prefers actionable guidance", () => {
  const now = new Date().toISOString();
  const response = rerankHybridCandidates(
    "how to enable payment initiation in europe",
    [
      {
        chunk_id: "schema",
        score: 0,
        text: "error_message string string display_message nullable string request_id string causes array status integer documentation_url string suggested_action string",
        title: "API - Payment Initiation (Europe)",
        url: "https://plaid.com/docs/api/products/payment-initiation",
        source: "plaid",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.9,
        fts_score: 0.85,
        semantic_score: 0.5,
      },
      {
        chunk_id: "guide",
        score: 0,
        text: "To enable Payment Initiation in Europe, create a Link token with the payment_initiation product and then create and authorize a payment.",
        title: "Payment Initiation setup guide",
        url: "https://plaid.com/docs/payment-initiation",
        source: "plaid",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.82,
        fts_score: 0.8,
        semantic_score: 0.66,
      },
    ],
    2,
  );

  assert.equal(response.results[0]?.chunk_id, "guide");
});

test("rerankHybridCandidates boosts setup sections for action-intent queries", () => {
  const now = new Date().toISOString();
  const response = rerankHybridCandidates(
    "how to enable payment initiation in europe",
    [
      {
        chunk_id: "logs",
        score: 0,
        text: "Dashboard logs for payment attempts and status history.",
        heading_path: "Dashboard logs",
        title: "Account - Activity, logs, and status",
        url: "https://plaid.com/docs/account/activity",
        source: "plaid",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.92,
        fts_score: 0.9,
        semantic_score: 0.65,
      },
      {
        chunk_id: "setup",
        score: 0,
        text: "Create a Link token with payment_initiation and then authorize the payment.",
        heading_path: "Quickstart",
        title: "Payment Initiation setup guide",
        url: "https://plaid.com/docs/payment-initiation",
        source: "plaid",
        version_tag: "latest",
        last_changed_at: now,
        ilike_score: 0.84,
        fts_score: 0.82,
        semantic_score: 0.7,
      },
    ],
    2,
  );

  assert.equal(response.results[0]?.chunk_id, "setup");
});
