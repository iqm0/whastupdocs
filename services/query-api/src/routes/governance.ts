import type { FastifyInstance } from "fastify";

import { getDbPool } from "../lib/db.js";
import { exportAuditEvents, getPolicyObservability } from "../lib/governance.js";
import { AuditExportQuerySchema } from "../validation.js";

export async function registerGovernanceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/audit/export", async (request, reply) => {
    const parsed = AuditExportQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const events = await exportAuditEvents(
      getDbPool(),
      request.wiudContext.tenantId,
      parsed.data,
    );

    if (parsed.data.format === "ndjson") {
      const lines = events.map((event) => JSON.stringify(event)).join("\n");
      reply.header("content-type", "application/x-ndjson");
      return reply.send(lines);
    }

    return reply.send({
      tenant_id: request.wiudContext.tenantId,
      count: events.length,
      events,
    });
  });

  app.get("/v1/policy/observability", async (request) => {
    return getPolicyObservability(
      getDbPool(),
      request.wiudContext.tenantId,
      request.wiudContext.policy,
    );
  });
}
