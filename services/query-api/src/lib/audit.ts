import type { Pool } from "pg";

import { newId } from "./id.js";

export type TelemetryEvent = {
  tenantId: string;
  endpoint: string;
  authSubject: string;
  latencyMs: number;
  httpStatus: number;
  decisionStatus?: string;
  metadata?: Record<string, unknown>;
};

export async function recordTelemetryEvent(db: Pool, event: TelemetryEvent): Promise<void> {
  await db.query(
    `
      INSERT INTO telemetry_event (
        id,
        tenant_id,
        endpoint,
        auth_subject,
        latency_ms,
        http_status,
        decision_status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      newId("tel"),
      event.tenantId,
      event.endpoint,
      event.authSubject,
      Math.max(0, Math.round(event.latencyMs)),
      event.httpStatus,
      event.decisionStatus ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}
