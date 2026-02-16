import type { FastifyInstance } from "fastify";

import { answerQuestion } from "../lib/docs-service.js";
import { getDbPool } from "../lib/db.js";
import { AnswerRequestSchema } from "../validation.js";

export async function registerAnswerRoute(app: FastifyInstance): Promise<void> {
  app.post("/v1/answer", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    const result = await answerQuestion(getDbPool(), parsed.data);
    return reply.send(result);
  });
}
