import type { FastifyRequest } from "fastify";

import { getTenantPolicy, type TenantPolicy } from "./policy.js";

export type RequestContext = {
  tenantId: string;
  authSubject: string;
  policy: TenantPolicy;
};

export type AuthResolution = {
  ok: boolean;
  authSubject: string;
  tenantFromToken?: string;
  reason?: string;
};

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseApiKeys(): string[] {
  return parseCsv(process.env.WIUD_API_KEYS ?? process.env.WIUD_API_KEY ?? "");
}

function parseApiKeyTenantMap(): Record<string, string> {
  const raw = process.env.WIUD_API_KEY_TENANT_MAP_JSON ?? "";
  if (!raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [token, tenant] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === "string" && typeof tenant === "string" && token.trim() && tenant.trim()) {
        result[token.trim()] = tenant.trim().slice(0, 80);
      }
    }
    return result;
  } catch {
    return {};
  }
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

function shouldRequireAuth(configuredAuthKeys: Set<string>): boolean {
  const explicit = (process.env.WIUD_REQUIRE_AUTH ?? "").trim().toLowerCase();
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }
  if (configuredAuthKeys.size > 0) {
    return true;
  }
  return process.env.NODE_ENV === "production" && process.env.WIUD_ALLOW_ANONYMOUS !== "true";
}

function normalizeTenantId(request: FastifyRequest): string {
  const raw = request.headers["x-wiud-tenant-id"];
  if (typeof raw !== "string" || !raw.trim()) {
    return "default";
  }
  return raw.trim().slice(0, 80);
}

export function resolveRequestContext(request: FastifyRequest, auth: AuthResolution): RequestContext {
  const tenantId = auth.tenantFromToken ?? normalizeTenantId(request);
  const authSubject = auth.authSubject;
  const policy = getTenantPolicy(tenantId);

  return {
    tenantId,
    authSubject,
    policy,
  };
}

export function authorizeRequest(request: FastifyRequest): AuthResolution {
  const apiKeys = parseApiKeys();
  const tenantMap = parseApiKeyTenantMap();
  const allowed = new Set<string>([...apiKeys, ...Object.keys(tenantMap)]);
  const requireAuth = shouldRequireAuth(allowed);
  const token = parseBearerToken(request.headers.authorization);

  if (!requireAuth) {
    if (!token) {
      return {
        ok: true,
        authSubject: "anonymous",
      };
    }
    if (allowed.size === 0 || allowed.has(token)) {
      return {
        ok: true,
        authSubject: "bearer",
        tenantFromToken: tenantMap[token],
      };
    }
    return {
      ok: false,
      authSubject: "anonymous",
      reason: "invalid_api_token",
    };
  }

  if (!token) {
    return {
      ok: false,
      authSubject: "anonymous",
      reason: "missing_api_token",
    };
  }

  if (!allowed.has(token)) {
    return {
      ok: false,
      authSubject: "anonymous",
      reason: "invalid_api_token",
    };
  }

  return {
    ok: true,
    authSubject: "bearer",
    tenantFromToken: tenantMap[token],
  };
}
