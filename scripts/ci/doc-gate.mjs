#!/usr/bin/env node

const baseUrl = process.env.WIUD_GATE_BASE_URL;
if (!baseUrl) {
  console.log("doc-gate: WIUD_GATE_BASE_URL not set, skipping.");
  process.exit(0);
}

const apiKey = process.env.WIUD_GATE_API_KEY;
const tenantId = process.env.WIUD_GATE_TENANT_ID ?? "default";
const sources = (process.env.WIUD_GATE_SOURCES ?? "openai")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowBreaking = process.env.ALLOW_DOC_BREAKING === "true";
const question = process.env.WIUD_GATE_QUESTION ?? "Reasoning models";

function withHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  headers.set("x-wiud-tenant-id", tenantId);
  if (apiKey) {
    headers.set("authorization", `Bearer ${apiKey}`);
  }
  return { ...init, headers };
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, withHeaders(init));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`doc-gate request failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function main() {
  const failures = [];

  for (const source of sources) {
    const changes = await request(
      `/v1/changes?source=${encodeURIComponent(source)}&limit=50`,
      { method: "GET" },
    );

    const risky = (changes.changes ?? []).filter(
      (item) => item.event_type === "breaking_change" || item.severity === "critical",
    );
    if (risky.length > 0 && !allowBreaking) {
      failures.push(
        `Source ${source} has ${risky.length} critical/breaking change event(s). Set ALLOW_DOC_BREAKING=true to override.`,
      );
    }
  }

  const answer = await request("/v1/answer", {
    method: "POST",
    body: JSON.stringify({
      question,
      filters: { sources },
      max_citations: 3,
    }),
  });

  const blockedStatuses = new Set([
    "stale_sources",
    "unsafe_content",
    "conflict_detected",
    "policy_blocked",
  ]);
  if (blockedStatuses.has(answer?.decision?.status)) {
    failures.push(`Decision status is ${answer.decision.status} for gate question "${question}".`);
  }

  if (failures.length > 0) {
    console.error("doc-gate: FAILED");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("doc-gate: PASSED");
}

main().catch((error) => {
  console.error(`doc-gate: ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
