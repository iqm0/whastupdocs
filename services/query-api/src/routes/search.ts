import type { FastifyInstance } from "fastify";

import { getDbPool } from "../lib/db.js";
import { searchDocs } from "../lib/docs-service.js";
import { SearchRequestSchema } from "../validation.js";

export async function registerSearchRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/search", async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const result = await searchDocs(getDbPool(), parsed.data);
    return reply.send(result);
  });
}
