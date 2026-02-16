import type { FastifyInstance } from "fastify";

import { enqueueSourceSync, listSources } from "../lib/docs-service.js";
import { getDbPool } from "../lib/db.js";
import { SourceSyncRequestSchema } from "../validation.js";

export async function registerSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/sources", async (request, reply) => {
    const query = (request.query ?? {}) as { sources?: string | string[] };
    const sources =
      typeof query.sources === "string"
        ? query.sources.split(",").map((item) => item.trim()).filter(Boolean)
        : Array.isArray(query.sources)
          ? query.sources
          : undefined;

    return reply.send(await listSources(getDbPool(), sources));
  });

  app.post("/v1/sources/sync", async (request, reply) => {
    const parsed = SourceSyncRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const result = await enqueueSourceSync(getDbPool(), parsed.data);
    return reply.code(202).send(result);
  });
}
