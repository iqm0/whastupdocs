import assert from "node:assert/strict";
import test from "node:test";

import { handleToolCall } from "../src/tool-handlers.ts";

type FetchCall = {
  input: string;
  init?: RequestInit;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("docs_preflight returns progressive lookup plan", async () => {
  const result = await handleToolCall("docs_preflight", {
    task: "Check latest Stripe API breaking changes for production auth flow",
    sources: ["stripe"],
  });

  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  assert.equal(payload.should_lookup, true);
  assert.equal(payload.level, "deep");
  assert.equal(payload.query_plan.include_changes, true);
});

test("search_docs forwards mapped payload to backend", async () => {
  const calls: FetchCall[] = [];
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return jsonResponse({
      results: [
        {
          chunk_id: "chk_1",
          score: 0.9,
          text: "hello",
          title: "Title",
          url: "https://docs.example.com/a",
          source: "openai",
          last_changed_at: new Date().toISOString(),
        },
      ],
    });
  }) as typeof fetch;

  const result = await handleToolCall("search_docs", {
    query: "stream responses",
    sources: ["openai"],
    version: "latest",
    top_k: 8,
    region: "us",
    plan: "enterprise",
    deployment_type: "cloud",
    cloud: "aws",
    reference_date: "2026-02-16T00:00:00Z",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://fake-backend/v1/search");
  assert.equal(calls[0]?.init?.method, "POST");

  const parsedBody = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(parsedBody, {
    query: "stream responses",
    top_k: 8,
    filters: {
      sources: ["openai"],
      version: "latest",
      region: "us",
      plan: "enterprise",
      deployment_type: "cloud",
      cloud: "aws",
      reference_date: "2026-02-16T00:00:00Z",
    },
  });

  assert.equal(result.isError, undefined);
  assert.match(result.content[0]?.text ?? "", /"chunk_id": "chk_1"/);
});

test("search_docs supports compact mode", async () => {
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async () => {
    return jsonResponse({
      results: [
        {
          chunk_id: "chk_1",
          score: 0.9,
          text: "hello",
          title: "Title",
          url: "https://docs.example.com/a",
          source: "openai",
          last_changed_at: new Date().toISOString(),
        },
      ],
    });
  }) as typeof fetch;

  const result = await handleToolCall("search_docs", {
    query: "stream responses",
    compact: true,
  });

  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0]?.title, "Title");
  assert.equal(payload.results[0]?.text, undefined);
});

test("answer_with_sources forwards style and citation limits", async () => {
  const calls: FetchCall[] = [];
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return jsonResponse({
      answer: "Use idempotency keys",
      citations: [
        {
          title: "Idempotent requests",
          url: "https://docs.example.com/stripe/idempotency",
          source: "stripe",
          last_changed_at: new Date().toISOString(),
        },
      ],
      freshness: {
        generated_at: new Date().toISOString(),
        max_source_age_minutes: 15,
      },
      warnings: [],
      decision: {
        status: "grounded",
        confidence: 0.92,
        uncertainties: [],
        policy_flags: [],
        actionability: { recommended_next_steps: [] },
      },
    });
  }) as typeof fetch;

  const result = await handleToolCall("answer_with_sources", {
    question: "How should retries work?",
    sources: ["stripe"],
    style: "concise",
    max_citations: 3,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://fake-backend/v1/answer");
  const parsedBody = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(parsedBody.max_citations, 3);
  assert.equal(parsedBody.style, "concise");
  assert.deepEqual(parsedBody.filters.sources, ["stripe"]);
  assert.match(result.content[0]?.text ?? "", /Use idempotency keys/);
});

test("answer_with_sources supports compact mode", async () => {
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async () => {
    return jsonResponse({
      answer: "Use idempotency keys",
      citations: [
        {
          title: "Idempotent requests",
          url: "https://docs.example.com/stripe/idempotency",
          source: "stripe",
          last_changed_at: new Date().toISOString(),
        },
      ],
      freshness: {
        generated_at: new Date().toISOString(),
        max_source_age_minutes: 15,
      },
      warnings: [],
      decision: {
        status: "grounded",
        confidence: 0.92,
        uncertainties: [],
        policy_flags: [],
        actionability: { recommended_next_steps: [] },
      },
    });
  }) as typeof fetch;

  const result = await handleToolCall("answer_with_sources", {
    question: "How should retries work?",
    compact: true,
  });

  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  assert.equal(payload.answer, "Use idempotency keys");
  assert.equal(payload.decision.status, "grounded");
  assert.equal(payload.freshness, undefined);
});

test("check_freshness filters sources from backend response", async () => {
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async () => {
    return jsonResponse({
      sources: [
        {
          source: "openai",
          status: "healthy",
          last_sync_at: new Date().toISOString(),
          lag_minutes: 5,
        },
        {
          source: "nextjs",
          status: "degraded",
          last_sync_at: new Date().toISOString(),
          lag_minutes: 90,
        },
      ],
    });
  }) as typeof fetch;

  const result = await handleToolCall("check_freshness", {
    sources: ["openai"],
  });

  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  assert.equal(payload.sources.length, 1);
  assert.equal(payload.sources[0]?.source, "openai");
});

test("list_changes forwards query parameters", async () => {
  const calls: FetchCall[] = [];
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return jsonResponse({
      changes: [
        {
          id: "chg_1",
          source: "stripe",
          canonical_url: "https://docs.stripe.com/api/payment_intents",
          title: "PaymentIntents",
          event_type: "deprecation",
          severity: "medium",
          summary: "Deprecation language detected",
          details: {},
          recommended_actions: ["Create deprecation remediation ticket."],
          detected_at: new Date().toISOString(),
        },
      ],
    });
  }) as typeof fetch;

  const result = await handleToolCall("list_changes", {
    source: "stripe",
    event_type: "deprecation",
    severity: "medium",
    limit: 5,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.input,
    "http://fake-backend/v1/changes?source=stripe&event_type=deprecation&severity=medium&limit=5",
  );
  assert.equal(calls[0]?.init?.method, "GET");
  assert.match(result.content[0]?.text ?? "", /"event_type": "deprecation"/);
});

test("list_changes compact includes recommended action hints", async () => {
  process.env.WIUD_BACKEND_URL = "http://fake-backend";

  globalThis.fetch = (async () => {
    return jsonResponse({
      changes: [
        {
          id: "chg_1",
          source: "stripe",
          canonical_url: "https://docs.stripe.com/api/payment_intents",
          title: "PaymentIntents",
          event_type: "breaking_change",
          severity: "critical",
          summary: "Potential breaking change detected",
          details: {},
          recommended_actions: [
            "Open migration task.",
            "Run integration tests.",
            "Pin versions.",
          ],
          detected_at: new Date().toISOString(),
        },
      ],
    });
  }) as typeof fetch;

  const result = await handleToolCall("list_changes", {
    source: "stripe",
    compact: true,
  });

  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  assert.equal(payload.changes.length, 1);
  assert.deepEqual(payload.changes[0]?.recommended_actions, [
    "Open migration task.",
    "Run integration tests.",
  ]);
});

test("unknown tool returns tool error", async () => {
  const result = await handleToolCall("nonexistent_tool", {});
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Unknown tool/);
});
