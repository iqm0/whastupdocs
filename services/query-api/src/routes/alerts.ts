import type { FastifyInstance } from "fastify";

import { sendSlackTestNotification } from "../lib/slack.js";
import { SlackTestAlertRequestSchema } from "../validation.js";

export async function registerAlertRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/alerts/slack/test", async (request, reply) => {
    const parsed = SlackTestAlertRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }

    try {
      const result = await sendSlackTestNotification({
        webhook_url: parsed.data.webhook_url,
        source: parsed.data.source,
        message: parsed.data.message,
        actor: request.wiudContext.authSubject,
      });
      return reply.code(202).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "slack_webhook_not_configured" || message === "invalid_default_webhook_url") {
        return reply.badRequest(message);
      }
      if (message === "invalid_webhook_url") {
        return reply.forbidden(message);
      }
      if (message === "webhook_override_not_allowed") {
        return reply.forbidden(message);
      }
      return reply.internalServerError(message);
    }
  });
}
