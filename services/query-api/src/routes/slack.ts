import type { FastifyInstance } from "fastify";

import { recordTelemetryEvent } from "../lib/audit.js";
import { getDbPool } from "../lib/db.js";
import { handleSlackCommand, handleSlackEvent, verifySlackRequest } from "../lib/slack-runtime.js";

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function requireSlackSigningSecret(): string {
  const secret = process.env.WIUD_SLACK_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("slack_signing_secret_not_configured");
  }
  return secret;
}

function ensureValidSlackSignature(input: {
  headers: Record<string, unknown>;
  rawBody: string;
}): void {
  const signingSecret = requireSlackSigningSecret();
  const timestampHeader = getHeaderValue(input.headers["x-slack-request-timestamp"] as string | string[] | undefined);
  const signatureHeader = getHeaderValue(input.headers["x-slack-signature"] as string | string[] | undefined);

  const valid = verifySlackRequest({
    signingSecret,
    timestampHeader,
    signatureHeader,
    rawBody: input.rawBody,
  });

  if (!valid) {
    throw new Error("invalid_slack_signature");
  }
}

export async function registerSlackRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/slack/commands", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const rawBody = request.rawBody ?? (typeof request.body === "string" ? request.body : "");

    try {
      ensureValidSlackSignature({
        headers: request.headers as Record<string, unknown>,
        rawBody,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "slack_signing_secret_not_configured" ? 503 : 401;
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/slack/commands",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: statusCode,
        metadata: { error: message },
      });
      return reply.code(statusCode).send({ error: message });
    }

    const result = await handleSlackCommand({
      db,
      rawBody,
      policy: request.wiudContext.policy,
    });

    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/slack/commands",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: 200,
      metadata: {},
    });

    if (result.deferred) {
      setTimeout(() => {
        result.deferred?.().catch(() => undefined);
      }, 0);
    }

    return reply.send(result.immediate);
  });

  app.post("/v1/slack/events", async (request, reply) => {
    const startedAt = Date.now();
    const db = getDbPool();
    const rawBody = request.rawBody ?? (typeof request.body === "string" ? request.body : "{}");

    try {
      ensureValidSlackSignature({
        headers: request.headers as Record<string, unknown>,
        rawBody,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message === "slack_signing_secret_not_configured" ? 503 : 401;
      await recordTelemetryEvent(db, {
        tenantId: request.wiudContext.tenantId,
        endpoint: "/v1/slack/events",
        authSubject: request.wiudContext.authSubject,
        latencyMs: Date.now() - startedAt,
        httpStatus: statusCode,
        metadata: { error: message },
      });
      return reply.code(statusCode).send({ error: message });
    }

    const result = await handleSlackEvent({
      db,
      rawBody,
      policy: request.wiudContext.policy,
    });

    await recordTelemetryEvent(db, {
      tenantId: request.wiudContext.tenantId,
      endpoint: "/v1/slack/events",
      authSubject: request.wiudContext.authSubject,
      latencyMs: Date.now() - startedAt,
      httpStatus: result.status,
      metadata: {},
    });

    if (result.deferred) {
      setTimeout(() => {
        result.deferred?.().catch(() => undefined);
      }, 0);
    }

    return reply.code(result.status).send(result.body);
  });
}
