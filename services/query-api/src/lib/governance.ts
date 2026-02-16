import type { Pool } from "pg";

import { applySourcePolicy, type TenantPolicy } from "./policy.js";

export type AuditExportQuery = {
  from?: string;
  to?: string;
  limit?: number;
};

export type PolicyObservability = {
  tenant_id: string;
  policy: TenantPolicy;
  source_coverage: {
    total_sources: number;
    effective_sources: number;
    denied_sources: number;
  };
  last_7d: {
    total_requests: number;
    policy_blocked_decisions: number;
    forbidden_requests: number;
    stale_decisions: number;
    unsafe_decisions: number;
  };
};

export async function exportAuditEvents(
  db: Pool,
  tenantId: string,
  query: AuditExportQuery,
): Promise<Array<Record<string, unknown>>> {
  const values: unknown[] = [tenantId];
  const where = ["tenant_id = $1"];

  if (query.from) {
    values.push(query.from);
    where.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (query.to) {
    values.push(query.to);
    where.push(`created_at <= $${values.length}::timestamptz`);
  }

  values.push(Math.max(1, Math.min(5000, query.limit ?? 500)));
  const limitIndex = values.length;

  const result = await db.query(
    `
      SELECT id, tenant_id, endpoint, auth_subject, latency_ms, http_status, decision_status, metadata, created_at
      FROM telemetry_event
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}
    `,
    values,
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    endpoint: String(row.endpoint),
    auth_subject: String(row.auth_subject),
    latency_ms: Number(row.latency_ms ?? 0),
    http_status: Number(row.http_status ?? 0),
    decision_status: row.decision_status ? String(row.decision_status) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: new Date(row.created_at).toISOString(),
  }));
}

export async function getPolicyObservability(
  db: Pool,
  tenantId: string,
  policy: TenantPolicy,
): Promise<PolicyObservability> {
  const sourceRows = await db.query(`SELECT id FROM source ORDER BY id ASC`);
  const sourceIds = sourceRows.rows.map((row) => String(row.id));
  const effective = applySourcePolicy(sourceIds, policy) ?? sourceIds;
  const denied = new Set(sourceIds.filter((source) => !effective.includes(source)));

  const telemetry = await db.query(
    `
      SELECT
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE decision_status = 'policy_blocked')::int AS policy_blocked_decisions,
        COUNT(*) FILTER (WHERE http_status = 403)::int AS forbidden_requests,
        COUNT(*) FILTER (WHERE decision_status = 'stale_sources')::int AS stale_decisions,
        COUNT(*) FILTER (WHERE decision_status = 'unsafe_content')::int AS unsafe_decisions
      FROM telemetry_event
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
    `,
    [tenantId],
  );

  const summary = telemetry.rows[0] ?? {};

  return {
    tenant_id: tenantId,
    policy,
    source_coverage: {
      total_sources: sourceIds.length,
      effective_sources: effective.length,
      denied_sources: denied.size,
    },
    last_7d: {
      total_requests: Number(summary.total_requests ?? 0),
      policy_blocked_decisions: Number(summary.policy_blocked_decisions ?? 0),
      forbidden_requests: Number(summary.forbidden_requests ?? 0),
      stale_decisions: Number(summary.stale_decisions ?? 0),
      unsafe_decisions: Number(summary.unsafe_decisions ?? 0),
    },
  };
}
