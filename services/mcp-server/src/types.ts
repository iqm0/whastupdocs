export type QueryFilters = {
  sources?: string[];
  version?: string;
  updated_after?: string;
  language?: string;
  region?: string;
  plan?: string;
  deployment_type?: string;
  cloud?: string;
  reference_date?: string;
};

export type SearchRequest = {
  query: string;
  filters?: QueryFilters;
  top_k?: number;
};

export type SearchResult = {
  chunk_id: string;
  score: number;
  text: string;
  title: string;
  url: string;
  source: string;
  version_tag?: string | null;
  last_changed_at: string;
};

export type SearchResponse = {
  results: SearchResult[];
};

export type AnswerRequest = {
  question: string;
  filters?: QueryFilters;
  style?: "concise" | "detailed";
  max_citations?: number;
};

export type Citation = {
  title: string;
  url: string;
  source: string;
  version_tag?: string | null;
  last_changed_at: string;
};

export type DecisionEnvelope = {
  status:
    | "grounded"
    | "insufficient_sources"
    | "stale_sources"
    | "conflict_detected"
    | "unsafe_content"
    | "policy_blocked";
  confidence: number;
  uncertainties: string[];
  policy_flags: string[];
  actionability: {
    recommended_next_steps: string[];
  };
};

export type AnswerResponse = {
  answer: string;
  citations: Citation[];
  freshness: {
    generated_at: string;
    max_source_age_minutes: number;
  };
  warnings: string[];
  decision: DecisionEnvelope;
};

export type SourceStatus = {
  source: string;
  status: "healthy" | "degraded" | "failing";
  last_sync_at: string;
  lag_minutes: number;
  error?: string | null;
};

export type ListSourcesResponse = {
  sources: SourceStatus[];
};

export type ChangeEvent = {
  id: string;
  source: string;
  canonical_url: string;
  title: string;
  event_type: "document_added" | "updated" | "deprecation" | "breaking_change";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  details: Record<string, unknown>;
  recommended_actions: string[];
  detected_at: string;
};

export type ListChangesQuery = {
  source?: string;
  event_type?: ChangeEvent["event_type"];
  severity?: ChangeEvent["severity"];
  limit?: number;
};

export type ListChangesResponse = {
  changes: ChangeEvent[];
};
