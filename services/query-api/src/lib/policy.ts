export type TenantPolicy = {
  allow_sources?: string[];
  deny_sources?: string[];
  min_trust_score?: number;
  sync_allowed_sources?: string[];
};

type TenantPolicyMap = Record<string, TenantPolicy>;

const DEFAULT_POLICY: TenantPolicy = {};

let cachedRaw = "";
let cachedPolicies: TenantPolicyMap = {};

function parsePolicies(raw: string): TenantPolicyMap {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    const next: TenantPolicyMap = {};
    for (const [tenantId, value] of entries) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      const candidate = value as Record<string, unknown>;
      next[tenantId] = {
        allow_sources: Array.isArray(candidate.allow_sources)
          ? candidate.allow_sources.filter((v): v is string => typeof v === "string")
          : undefined,
        deny_sources: Array.isArray(candidate.deny_sources)
          ? candidate.deny_sources.filter((v): v is string => typeof v === "string")
          : undefined,
        sync_allowed_sources: Array.isArray(candidate.sync_allowed_sources)
          ? candidate.sync_allowed_sources.filter((v): v is string => typeof v === "string")
          : undefined,
        min_trust_score:
          typeof candidate.min_trust_score === "number"
            ? Math.max(0, Math.min(1, candidate.min_trust_score))
            : undefined,
      };
    }
    return next;
  } catch {
    return {};
  }
}

function getPolicyMap(): TenantPolicyMap {
  const raw = process.env.WIUD_TENANT_POLICIES_JSON ?? "";
  if (raw === cachedRaw) {
    return cachedPolicies;
  }
  cachedRaw = raw;
  cachedPolicies = parsePolicies(raw);
  return cachedPolicies;
}

export function getTenantPolicy(tenantId: string): TenantPolicy {
  const map = getPolicyMap();
  return map[tenantId] ?? map.default ?? DEFAULT_POLICY;
}

export function applySourcePolicy(
  requestedSources: string[] | undefined,
  policy: TenantPolicy,
): string[] | undefined {
  const allow = new Set(policy.allow_sources ?? []);
  const deny = new Set(policy.deny_sources ?? []);

  const hasAllow = allow.size > 0;
  const input = requestedSources ? [...requestedSources] : hasAllow ? Array.from(allow) : undefined;

  if (!input) {
    return undefined;
  }

  const filtered = input.filter((source) => {
    if (deny.has(source)) {
      return false;
    }
    if (hasAllow && !allow.has(source)) {
      return false;
    }
    return true;
  });

  return Array.from(new Set(filtered));
}

export function canSyncSource(source: string, policy: TenantPolicy): boolean {
  if (policy.sync_allowed_sources && policy.sync_allowed_sources.length > 0) {
    return policy.sync_allowed_sources.includes(source);
  }

  const denied = new Set(policy.deny_sources ?? []);
  if (denied.has(source)) {
    return false;
  }

  const allowed = policy.allow_sources;
  if (allowed && allowed.length > 0) {
    return allowed.includes(source);
  }

  return true;
}
