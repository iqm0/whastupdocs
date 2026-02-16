import type { FastifyInstance } from "fastify";

import { getDbPool } from "../lib/db.js";
import { listChanges } from "../lib/docs-service.js";
import { ListChangesQuerySchema } from "../validation.js";

export async function registerChangeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/changes", async (request, reply) => {
    const parsed = ListChangesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const result = await listChanges(getDbPool(), parsed.data);
    return reply.send(result);
  });
}
