import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import { exportAuditEvents, getPolicyObservability } from "../src/lib/governance.js";

test("exportAuditEvents returns tenant-scoped mapped rows", async () => {
  const db = {
    query: async () => ({
      rows: [
        {
          id: "tel_1",
          tenant_id: "default",
          endpoint: "/v1/search",
          auth_subject: "bearer",
          latency_ms: 10,
          http_status: 200,
          decision_status: null,
          metadata: { a: 1 },
          created_at: new Date("2026-02-16T00:00:00Z"),
        },
      ],
    }),
  } as unknown as Pool;

  const rows = await exportAuditEvents(db, "default", { limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.endpoint, "/v1/search");
  assert.equal(rows[0]?.tenant_id, "default");
});

test("getPolicyObservability computes source coverage and telemetry summary", async () => {
  const db = {
    query: async (sql: string) => {
      if (sql.includes("SELECT id FROM source")) {
        return {
          rows: [{ id: "openai" }, { id: "stripe" }, { id: "react" }],
        };
      }
      return {
        rows: [
          {
            total_requests: 20,
            policy_blocked_decisions: 2,
            forbidden_requests: 1,
            stale_decisions: 3,
            unsafe_decisions: 1,
          },
        ],
      };
    },
  } as unknown as Pool;

  const result = await getPolicyObservability(db, "default", {
    allow_sources: ["openai", "stripe"],
    deny_sources: ["stripe"],
  });

  assert.equal(result.source_coverage.total_sources, 3);
  assert.equal(result.source_coverage.effective_sources, 1);
  assert.equal(result.source_coverage.denied_sources, 2);
  assert.equal(result.last_7d.total_requests, 20);
  assert.equal(result.last_7d.policy_blocked_decisions, 2);
});
