import type { FastifyInstance } from "fastify";

import { recordTelemetryEvent } from "../lib/audit.js";
import { enqueueSourceSync, listSources } from "../lib/docs-service.js";
import { getDbPool } from "../lib/db.js";
import { SourceSyncRequestSchema } from "../validation.js";

export async function registerSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/sources", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const query = (request.query ?? {}) as { sources?: string | string[] };
    const sources =
      typeof query.sources === "string"
        ? query.sources.split(",").map((item) => item.trim()).filter(Boolean)
        : Array.isArray(query.sources)
          ? query.sources
          : undefined;

    const result = await listSources(db, sources, {
      tenantId: request.wiudContext.tenantId,
      policy: request.wiudContext.policy,
    });
    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/sources",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      metadata: { source_count: result.sources.length },
    });
    return reply.send(result);
  });

  app.post("/v1/sources/sync", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const parsed = SourceSyncRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/sources/sync",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: 400,
        metadata: { error: "invalid_request" },
      });
      return reply.badRequest(parsed.error.message);
    }

    let result;
    try {
      result = await enqueueSourceSync(db, parsed.data, {
        tenantId: request.wiudContext.tenantId,
        policy: request.wiudContext.policy,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes("policy_blocked") ? 403 : 500;
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/sources/sync",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: statusCode,
        metadata: { error: message },
      });
      if (statusCode === 403) {
        return reply.forbidden(message);
      }
      throw error;
    }

    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/sources/sync",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 202,
      metadata: { source: result.source },
    });
    return reply.code(202).send(result);
  });
}
