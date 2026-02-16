import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import { listChanges } from "../src/lib/docs-service.js";

function createFakeDb(rows: Array<Record<string, unknown>>): Pool {
  return {
    query: async () => ({ rows }),
  } as unknown as Pool;
}

test("listChanges adds recommended actions for breaking/deprecation events", async () => {
  const db = createFakeDb([
    {
      id: "chg_1",
      source_id: "stripe",
      canonical_url: "https://docs.stripe.com/payments",
      title: "Payments",
      event_type: "breaking_change",
      severity: "critical",
      summary: "Breaking update",
      details: { changed_sections: ["Authentication", "Retries"] },
      detected_at: new Date().toISOString(),
    },
    {
      id: "chg_2",
      source_id: "openai",
      canonical_url: "https://platform.openai.com/docs/deprecations",
      title: "Deprecations",
      event_type: "deprecation",
      severity: "medium",
      summary: "Deprecated endpoint",
      details: {},
      detected_at: new Date().toISOString(),
    },
  ]);

  const response = await listChanges(db, { limit: 10 });
  assert.equal(response.changes.length, 2);

  const first = response.changes[0]!;
  assert.ok(first.recommended_actions.length >= 3);
  assert.ok(
    first.recommended_actions.some((item) =>
      /block automatic deploy|on-call|pre-merge verification/i.test(item),
    ),
  );

  const second = response.changes[1]!;
  assert.ok(second.recommended_actions.some((item) => /deprecation remediation/i.test(item)));
});
