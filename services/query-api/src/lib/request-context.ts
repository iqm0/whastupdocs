import type { FastifyRequest } from "fastify";

import { getTenantPolicy, type TenantPolicy } from "./policy.js";

export type RequestContext = {
  tenantId: string;
  authSubject: string;
  policy: TenantPolicy;
};

function parseApiKeys(): string[] {
  const raw = process.env.WIUD_API_KEYS ?? process.env.WIUD_API_KEY ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBearerToken(header: string | string[] | undefined): string | null {
  if (!header) {
    return null;
  }
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    return null;
  }
  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

function normalizeTenantId(request: FastifyRequest): string {
  const raw = request.headers["x-wiud-tenant-id"];
  if (typeof raw !== "string" || !raw.trim()) {
    return "default";
  }
  return raw.trim().slice(0, 80);
}

export function resolveRequestContext(request: FastifyRequest): RequestContext {
  const tenantId = normalizeTenantId(request);
  const authSubject = request.headers.authorization ? "bearer" : "anonymous";
  const policy = getTenantPolicy(tenantId);

  return {
    tenantId,
    authSubject,
    policy,
  };
}

export function requireApiAuthIfConfigured(request: FastifyRequest): boolean {
  const apiKeys = parseApiKeys();
  if (apiKeys.length === 0) {
    return true;
  }

  const token = parseBearerToken(request.headers.authorization);
  if (!token) {
    return false;
  }

  return apiKeys.includes(token);
}
