import type { FastifyInstance } from "fastify";

import { recordTelemetryEvent } from "../lib/audit.js";
import { answerQuestion } from "../lib/docs-service.js";
import { getDbPool } from "../lib/db.js";
import { AnswerRequestSchema } from "../validation.js";

export async function registerAnswerRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/answer", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/answer",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: 400,
        metadata: { error: "invalid_request" },
      });
      return reply.badRequest(parsed.error.message);
    }

    const result = await answerQuestion(db, parsed.data, {
      tenantId: request.wiudContext.tenantId,
      policy: request.wiudContext.policy,
    });
    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/answer",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      decisionStatus: result.decision.status,
      metadata: {
        warning_count: result.warnings.length,
        citation_count: result.citations.length,
      },
    });
    return reply.send(result);
  });
}
