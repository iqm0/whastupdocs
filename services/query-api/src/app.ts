import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { closeDbPool } from "./lib/db.js";
import { closeQueue } from "./lib/queue.js";
import { requireApiAuthIfConfigured, resolveRequestContext } from "./lib/request-context.js";
import { registerAnswerRoute } from "./routes/answer.js";
import { registerChangeRoutes } from "./routes/changes.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerSearchRoute } from "./routes/search.js";
import { registerSourceRoutes } from "./routes/sources.js";

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger
      ? {
          transport:
            process.env.NODE_ENV === "development"
              ? { target: "pino-pretty" }
              : undefined,
          level: process.env.LOG_LEVEL ?? "info",
        }
      : false,
  });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.addHook("onRequest", async (request, reply) => {
    if (!requireApiAuthIfConfigured(request)) {
      return reply.unauthorized("missing_or_invalid_api_token");
    }
    request.wiudContext = resolveRequestContext(request);
  });

  app.get("/health", async () => ({ status: "ok", service: "query-api" }));

  await registerSearchRoute(app);
  await registerAnswerRoute(app);
  await registerSourceRoutes(app);
  await registerChangeRoutes(app);
  await registerMetricsRoutes(app);

  app.addHook("onClose", async () => {
    await closeQueue();
    await closeDbPool();
  });

  return app;
}
