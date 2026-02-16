import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { checkAndConsumeRateLimit, getClientIp, isIpAllowed } from "./lib/access-control.js";
import { closeDbPool } from "./lib/db.js";
import { closeQueue } from "./lib/queue.js";
import { authorizeRequest, resolveRequestContext } from "./lib/request-context.js";
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
    const ip = getClientIp(request);
    if (!isIpAllowed(ip)) {
      return reply.forbidden("ip_not_allowed");
    }

    const ipLimit = checkAndConsumeRateLimit(`ip:${ip}`);
    if (!ipLimit.allowed) {
      reply.header("retry-after", String(ipLimit.retryAfterSec));
      return reply.code(429).send({ error: "rate_limited" });
    }

    const auth = authorizeRequest(request);
    if (!auth.ok) {
      return reply.unauthorized(auth.reason ?? "missing_or_invalid_api_token");
    }

    const subjectLimit = checkAndConsumeRateLimit(`subject:${auth.authSubject}:${ip}`);
    if (!subjectLimit.allowed) {
      reply.header("retry-after", String(subjectLimit.retryAfterSec));
      return reply.code(429).send({ error: "rate_limited" });
    }

    request.wiudContext = resolveRequestContext(request, auth);
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
