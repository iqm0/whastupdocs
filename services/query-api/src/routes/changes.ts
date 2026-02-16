import type { FastifyInstance } from "fastify";

import { recordTelemetryEvent } from "../lib/audit.js";
import { getDbPool } from "../lib/db.js";
import { listChanges } from "../lib/docs-service.js";
import { ListChangesQuerySchema } from "../validation.js";

export async function registerChangeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/changes", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const parsed = ListChangesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/changes",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: 400,
        metadata: { error: "invalid_request" },
      });
      return reply.badRequest(parsed.error.message);
    }

    const result = await listChanges(db, parsed.data, {
      tenantId: request.wiudContext.tenantId,
      policy: request.wiudContext.policy,
    });
    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/changes",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      metadata: { change_count: result.changes.length },
    });
    return reply.send(result);
  });
}
