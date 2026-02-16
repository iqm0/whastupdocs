export type PreflightLevel = "none" | "freshness" | "search" | "deep";

export type PreflightDecision = {
  should_lookup: boolean;
  level: PreflightLevel;
  reason_codes: string[];
  recommended_actions: string[];
  query_plan: {
    search_top_k: number;
    max_citations: number;
    include_changes: boolean;
    include_freshness: boolean;
  };
};

const HIGH_STAKES = [
  "security",
  "auth",
  "authentication",
  "oauth",
  "token",
  "payment",
  "billing",
  "pii",
  "compliance",
  "encryption",
  "production",
  "incident",
  "outage",
  "migration",
];

const CHANGE_SENSITIVE = [
  "latest",
  "today",
  "new",
  "recent",
  "release",
  "changelog",
  "deprecation",
  "deprecated",
  "breaking",
  "version",
  "upgrade",
  "api",
  "endpoint",
];

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function docsPreflight(task: string, sources: string[] = []): PreflightDecision {
  const normalized = task.toLowerCase();
  const reasons: string[] = [];

  const mentionsSources = sources.length > 0;
  const isHighStakes = hasAny(normalized, HIGH_STAKES);
  const isChangeSensitive = hasAny(normalized, CHANGE_SENSITIVE);
  const asksHowTo = /(how|implement|configure|setup|integrate|fix)/.test(normalized);

  if (isHighStakes) {
    reasons.push("high_stakes_topic");
  }
  if (isChangeSensitive) {
    reasons.push("change_sensitive_topic");
  }
  if (mentionsSources) {
    reasons.push("source_scoped_request");
  }
  if (asksHowTo) {
    reasons.push("implementation_request");
  }

  if (reasons.length === 0) {
    return {
      should_lookup: false,
      level: "none",
      reason_codes: ["no_doc_signal"],
      recommended_actions: ["Proceed without documentation lookup."],
      query_plan: {
        search_top_k: 0,
        max_citations: 0,
        include_changes: false,
        include_freshness: false,
      },
    };
  }

  if (isHighStakes && isChangeSensitive) {
    return {
      should_lookup: true,
      level: "deep",
      reason_codes: reasons,
      recommended_actions: [
        "Check freshness for selected sources.",
        "Run targeted search with small top_k.",
        "Generate grounded answer with citations.",
        "List recent deprecations/breaking changes.",
      ],
      query_plan: {
        search_top_k: 8,
        max_citations: 5,
        include_changes: true,
        include_freshness: true,
      },
    };
  }

  if (isChangeSensitive) {
    return {
      should_lookup: true,
      level: "search",
      reason_codes: reasons,
      recommended_actions: [
        "Run targeted search.",
        "Use grounded answer with citations if needed.",
      ],
      query_plan: {
        search_top_k: 6,
        max_citations: 4,
        include_changes: false,
        include_freshness: true,
      },
    };
  }

  return {
    should_lookup: true,
    level: "freshness",
    reason_codes: reasons,
    recommended_actions: ["Check source freshness before proceeding."],
    query_plan: {
      search_top_k: 4,
      max_citations: 3,
      include_changes: false,
      include_freshness: true,
    },
  };
}
