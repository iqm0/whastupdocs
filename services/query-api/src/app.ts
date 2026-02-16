import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { closeDbPool } from "./lib/db.js";
import { closeQueue } from "./lib/queue.js";
import { registerAnswerRoute } from "./routes/answer.js";
import { registerChangeRoutes } from "./routes/changes.js";
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

  app.get("/health", async () => ({ status: "ok", service: "query-api" }));

  await registerSearchRoute(app);
  await registerAnswerRoute(app);
  await registerSourceRoutes(app);
  await registerChangeRoutes(app);

  app.addHook("onClose", async () => {
    await closeQueue();
    await closeDbPool();
  });

  return app;
}
