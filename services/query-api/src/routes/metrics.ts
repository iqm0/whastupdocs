import type { FastifyInstance } from "fastify";

import { getDbPool } from "../lib/db.js";
import { getTelemetrySummary } from "../lib/docs-service.js";
import { TelemetryQuerySchema } from "../validation.js";

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/metrics/summary", async (request, reply) => {
    const parsed = TelemetryQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const response = await getTelemetrySummary(
      getDbPool(),
      request.wiudContext.tenantId,
      parsed.data.days ?? 7,
    );
    return reply.send(response);
  });
}
