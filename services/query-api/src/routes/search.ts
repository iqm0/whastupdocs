import type { FastifyInstance } from "fastify";

import { recordTelemetryEvent } from "../lib/audit.js";
import { getDbPool } from "../lib/db.js";
import { searchDocsWithPolicy } from "../lib/docs-service.js";
import { SearchRequestSchema } from "../validation.js";

export async function registerSearchRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/search", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/search",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: 400,
        metadata: { error: "invalid_request" },
      });
      return reply.badRequest(parsed.error.message);
    }

    const result = await searchDocsWithPolicy(db, parsed.data, {
      tenantId: request.wiudContext.tenantId,
      policy: request.wiudContext.policy,
    });
    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/search",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      metadata: {
        result_count: result.results.length,
      },
    });
    return reply.send(result);
  });
}
