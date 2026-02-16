import type { FastifyRequest } from "fastify";

type Counter = {
  count: number;
  resetAt: number;
};

const counters = new Map<string, Counter>();

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchIpPattern(ip: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }
  if (pattern.endsWith("*")) {
    return ip.startsWith(pattern.slice(0, -1));
  }
  return ip === pattern;
}

export function getClientIp(request: FastifyRequest): string {
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0]!.trim();
  }
  return request.ip ?? "unknown";
}

export function isIpAllowed(ip: string): boolean {
  const allowlist = parseList(process.env.WIUD_IP_ALLOWLIST);
  if (allowlist.length === 0) {
    return true;
  }
  return allowlist.some((pattern) => matchIpPattern(ip, pattern));
}

export function checkAndConsumeRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const max = Number(process.env.WIUD_RATE_LIMIT_MAX ?? 0);
  if (!Number.isFinite(max) || max <= 0) {
    return { allowed: true, retryAfterSec: 0 };
  }
  const windowMs = Math.max(1000, Number(process.env.WIUD_RATE_LIMIT_WINDOW_MS ?? 60000));
  const now = Date.now();
  const existing = counters.get(key);
  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
