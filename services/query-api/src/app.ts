import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { checkAndConsumeRateLimit, getClientIp, isIpAllowed } from "./lib/access-control.js";
import { closeDbPool } from "./lib/db.js";
import { getTenantPolicy } from "./lib/policy.js";
import { closeQueue } from "./lib/queue.js";
import { authorizeRequest, resolveRequestContext } from "./lib/request-context.js";
import { registerAnswerRoute } from "./routes/answer.js";
import { registerAlertRoutes } from "./routes/alerts.js";
import { registerChangeRoutes } from "./routes/changes.js";
import { registerGovernanceRoutes } from "./routes/governance.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerSearchRoute } from "./routes/search.js";
import { registerSlackRoutes } from "./routes/slack.js";
import { registerSourceRoutes } from "./routes/sources.js";

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const boolEnv = (name: string, fallback: boolean) => {
    const raw = process.env[name];
    if (!raw) return fallback;
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
  };

  // Operator-only surfaces. Default disabled for managed cloud.
  const ENABLE_SLACK_RUNTIME = boolEnv("WIUD_ENABLE_SLACK_RUNTIME", false);
  const ENABLE_ALERTS_API = boolEnv("WIUD_ENABLE_ALERTS_API", false);
  const ENABLE_METRICS_API = boolEnv("WIUD_ENABLE_METRICS_API", false);
  const ENABLE_GOVERNANCE_API = boolEnv("WIUD_ENABLE_GOVERNANCE_API", false);

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
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const rawBody = String(body);
      request.rawBody = rawBody;
      const raw = rawBody.trim();
      if (!raw) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (request, body, done) => {
      const rawBody = String(body);
      request.rawBody = rawBody;
      done(null, rawBody);
    },
  );

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

    if (ENABLE_SLACK_RUNTIME && request.url.startsWith("/v1/slack/")) {
      const tenantId = process.env.WIUD_SLACK_TENANT_ID ?? "default";
      request.wiudContext = {
        tenantId,
        authSubject: "slack",
        policy: getTenantPolicy(tenantId),
      };
      return;
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
  if (ENABLE_ALERTS_API) {
    await registerAlertRoutes(app);
  }
  await registerSourceRoutes(app);
  await registerChangeRoutes(app);
  if (ENABLE_METRICS_API) {
    await registerMetricsRoutes(app);
  }
  if (ENABLE_GOVERNANCE_API) {
    await registerGovernanceRoutes(app);
  }
  if (ENABLE_SLACK_RUNTIME) {
    await registerSlackRoutes(app);
  }

  app.addHook("onClose", async () => {
    await closeQueue();
    await closeDbPool();
  });

  return app;
}
