import type { Pool } from "pg";

import { newId } from "./id.js";
import { getSourceSyncQueue } from "./queue.js";
import type {
  AnswerRequest,
  AnswerResponse,
  ChangeEvent,
  DecisionEnvelope,
  ListChangesQuery,
  ListChangesResponse,
  ListSourcesResponse,
  SearchRequest,
  SearchResponse,
  SourceSyncRequest,
  SourceSyncResponse,
} from "../types.js";

const DEFAULT_STALE_THRESHOLD_MINUTES = 24 * 60;
const PROMPT_INJECTION_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  {
    id: "override_instructions",
    regex:
      /\b(ignore|disregard|override|bypass)\b.{0,50}\b(instruction|system|developer|prompt|policy|guardrail|previous)\b/i,
  },
  {
    id: "reveal_sensitive",
    regex:
      /\b(reveal|exfiltrate|leak|print|expose)\b.{0,50}\b(secret|token|api key|credential|system prompt|hidden prompt)\b/i,
  },
  {
    id: "do_not_follow_policy",
    regex:
      /\b(do not|don't)\b.{0,40}\b(follow|obey)\b.{0,40}\b(instruction|policy|guardrail|system|developer)\b/i,
  },
  {
    id: "tool_abuse",
    regex: /\b(call|run|execute)\b.{0,30}\b(tool|function)\b.{0,60}\b(delete|transfer|override|bypass)\b/i,
  },
  {
    id: "prompt_tag_payload",
    regex: /<\s*(system|assistant|developer)\s*>|BEGIN\s+(SYSTEM|PROMPT)/i,
  },
];

function toLikeQuery(value: string): string {
  return `%${value}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildDecision(
  status: DecisionEnvelope["status"],
  maxAgeMinutes: number,
  hasConflict: boolean,
): DecisionEnvelope {
  const baseConfidence = 0.92;
  const agePenalty = Math.min(maxAgeMinutes / 10000, 0.35);
  const conflictPenalty = hasConflict ? 0.35 : 0;
  const statusPenalty = status === "grounded" ? 0 : 0.25;
  const confidence = clamp(baseConfidence - agePenalty - conflictPenalty - statusPenalty, 0, 1);

  if (status === "insufficient_sources") {
    return {
      status,
      confidence,
      uncertainties: ["insufficient_evidence"],
      policy_flags: ["abstained"],
      actionability: {
        recommended_next_steps: [
          "Broaden source filters or remove strict version constraints.",
          "Trigger a source sync if documentation may be stale.",
        ],
      },
    };
  }

  if (status === "stale_sources") {
    return {
      status,
      confidence,
      uncertainties: ["stale_evidence"],
      policy_flags: ["stale_source_block"],
      actionability: {
        recommended_next_steps: [
          "Sync affected sources and retry the request.",
          "Temporarily scope to fresher sources if available.",
        ],
      },
    };
  }

  if (status === "conflict_detected") {
    return {
      status,
      confidence,
      uncertainties: ["conflicting_sources"],
      policy_flags: ["manual_review_recommended"],
      actionability: {
        recommended_next_steps: [
          "Review cited sources directly before merging code changes.",
          "Pin version constraints to reduce ambiguity.",
        ],
      },
    };
  }

  if (status === "unsafe_content") {
    return {
      status,
      confidence,
      uncertainties: ["untrusted_source_content"],
      policy_flags: ["prompt_injection_block"],
      actionability: {
        recommended_next_steps: [
          "Inspect cited source pages directly before using any instructions.",
          "Run source sync and retry with stricter source/version filters.",
        ],
      },
    };
  }

  return {
    status,
    confidence,
    uncertainties: [],
    policy_flags: [],
    actionability: {
      recommended_next_steps: [
        "Validate implementation in a test environment.",
        "Keep source version constraints pinned in automation.",
      ],
    },
  };
}

function detectPromptInjectionSignals(value: string): string[] {
  const signals = new Set<string>();
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.regex.test(value)) {
      signals.add(pattern.id);
    }
  }
  return Array.from(signals);
}

export async function searchDocs(db: Pool, payload: SearchRequest): Promise<SearchResponse> {
  const topK = payload.top_k ?? 10;
  const values: unknown[] = [];
  const where: string[] = [];
  const contextLikeFields: Array<string | undefined> = [
    payload.filters?.region,
    payload.filters?.plan,
    payload.filters?.deployment_type,
    payload.filters?.cloud,
  ];

  values.push(toLikeQuery(payload.query));
  const likeIndex = values.length;

  if (payload.filters?.sources && payload.filters.sources.length > 0) {
    values.push(payload.filters.sources);
    where.push(`s.id = ANY($${values.length}::text[])`);
  }

  if (payload.filters?.version) {
    values.push(payload.filters.version);
    where.push(`COALESCE(d.version_tag, 'latest') = $${values.length}`);
  }

  if (payload.filters?.updated_after) {
    values.push(payload.filters.updated_after);
    where.push(`d.last_changed_at >= $${values.length}::timestamptz`);
  }

  if (payload.filters?.language) {
    values.push(payload.filters.language);
    where.push(`COALESCE(d.language, 'unknown') = $${values.length}`);
  }

  if (payload.filters?.reference_date) {
    values.push(payload.filters.reference_date);
    where.push(`d.last_changed_at <= $${values.length}::timestamptz`);
  }

  for (const field of contextLikeFields) {
    if (!field) {
      continue;
    }

    values.push(toLikeQuery(field));
    const idx = values.length;
    where.push(
      `(c.text ILIKE $${idx} OR d.title ILIKE $${idx} OR d.canonical_url ILIKE $${idx})`,
    );
  }

  values.push(topK);
  const topKIndex = values.length;

  const whereSql =
    where.length > 0
      ? `WHERE ${where.join(" AND ")} AND (c.text ILIKE $${likeIndex} OR d.title ILIKE $${likeIndex})`
      : `WHERE c.text ILIKE $${likeIndex} OR d.title ILIKE $${likeIndex}`;

  const sql = `
    SELECT
      c.id AS chunk_id,
      (
        CASE WHEN c.text ILIKE $${likeIndex} THEN 0.8 ELSE 0 END +
        CASE WHEN d.title ILIKE $${likeIndex} THEN 0.2 ELSE 0 END
      )::float8 AS score,
      c.text,
      d.title,
      d.canonical_url AS url,
      s.id AS source,
      d.version_tag,
      d.last_changed_at
    FROM chunk c
    INNER JOIN document d ON d.id = c.document_id
    INNER JOIN source s ON s.id = d.source_id
    ${whereSql}
    ORDER BY score DESC, d.last_changed_at DESC
    LIMIT $${topKIndex}
  `;

  const result = await db.query(sql, values);

  return {
    results: result.rows.map((row) => ({
      chunk_id: String(row.chunk_id),
      score: Number(row.score ?? 0),
      text: String(row.text),
      title: String(row.title),
      url: String(row.url),
      source: String(row.source),
      version_tag: row.version_tag ? String(row.version_tag) : null,
      last_changed_at: new Date(row.last_changed_at).toISOString(),
    })),
  };
}

export async function answerQuestion(
  db: Pool,
  payload: AnswerRequest,
): Promise<AnswerResponse> {
  const citationLimit = payload.max_citations ?? 5;
  const searchResult = await searchDocs(db, {
    query: payload.question,
    filters: payload.filters,
    top_k: citationLimit,
  });

  const generatedAt = new Date().toISOString();

  if (searchResult.results.length === 0) {
    const decision = buildDecision("insufficient_sources", 0, false);
    return {
      answer:
        "I could not find sufficient matching documentation in the selected sources.",
      citations: [],
      freshness: {
        generated_at: generatedAt,
        max_source_age_minutes: 0,
      },
      warnings: ["insufficient_sources"],
      decision,
    };
  }

  const now = Date.now();
  const scopedResults = searchResult.results.slice(0, citationLimit);
  const riskyResults = scopedResults.filter((result) =>
    detectPromptInjectionSignals(result.text).length > 0
  );
  const safeResults = scopedResults.filter((result) =>
    detectPromptInjectionSignals(result.text).length === 0
  );
  const hasPromptInjectionSignals = riskyResults.length > 0;

  if (hasPromptInjectionSignals && safeResults.length === 0) {
    const decision = buildDecision("unsafe_content", 0, false);
    return {
      answer:
        "Potential prompt-injection instructions were detected in retrieved content. Manual review is required before acting on this guidance.",
      citations: scopedResults.map((r) => ({
        title: r.title,
        url: r.url,
        source: r.source,
        version_tag: r.version_tag ?? null,
        last_changed_at: r.last_changed_at,
      })),
      freshness: {
        generated_at: generatedAt,
        max_source_age_minutes: 0,
      },
      warnings: ["prompt_injection_signals_detected"],
      decision,
    };
  }

  const effectiveResults = safeResults.length > 0 ? safeResults : scopedResults;
  const maxAgeMinutes = effectiveResults
    .map((r) => Math.max(0, Math.round((now - new Date(r.last_changed_at).getTime()) / 60000)))
    .sort((a, b) => b - a)[0] ?? 0;

  const staleThreshold = Number(
    process.env.ANSWER_STALE_THRESHOLD_MINUTES ?? DEFAULT_STALE_THRESHOLD_MINUTES,
  );

  const citations = effectiveResults.map((r) => ({
    title: r.title,
    url: r.url,
    source: r.source,
    version_tag: r.version_tag ?? null,
    last_changed_at: r.last_changed_at,
  }));

  if (citations.length === 0) {
    const decision = buildDecision("insufficient_sources", maxAgeMinutes, false);
    return {
      answer: "No citable evidence is available for this question.",
      citations: [],
      freshness: {
        generated_at: generatedAt,
        max_source_age_minutes: maxAgeMinutes,
      },
      warnings: ["insufficient_sources"],
      decision,
    };
  }

  const uniqueSources = new Set(citations.map((c) => c.source));
  const hasConflict =
    uniqueSources.size > 1 && effectiveResults.length > 1 &&
    Math.abs(effectiveResults[0]!.score - effectiveResults[1]!.score) <= 0.15;

  if (maxAgeMinutes > staleThreshold) {
    const decision = buildDecision("stale_sources", maxAgeMinutes, hasConflict);
    return {
      answer:
        "Sources are stale beyond policy threshold; sync sources before using this guidance.",
      citations,
      freshness: {
        generated_at: generatedAt,
        max_source_age_minutes: maxAgeMinutes,
      },
      warnings: hasPromptInjectionSignals
        ? ["stale_sources", "prompt_injection_signals_detected"]
        : ["stale_sources"],
      decision,
    };
  }

  const top = effectiveResults[0]!;
  const answer =
    payload.style === "detailed"
      ? [
          `Primary guidance from ${top.source}:`,
          top.text,
          "",
          "This response is grounded in indexed source content.",
        ].join("\n")
      : top.text;

  const status: DecisionEnvelope["status"] = hasConflict
    ? "conflict_detected"
    : "grounded";
  const decision = buildDecision(status, maxAgeMinutes, hasConflict);

  return {
    answer,
    citations,
    freshness: {
      generated_at: generatedAt,
      max_source_age_minutes: maxAgeMinutes,
    },
    warnings: [
      ...(hasConflict ? ["conflict_detected"] : []),
      ...(hasPromptInjectionSignals ? ["prompt_injection_signals_detected"] : []),
    ],
    decision,
  };
}

export async function listSources(
  db: Pool,
  filterSources?: string[],
): Promise<ListSourcesResponse> {
  const values: unknown[] = [];
  const where =
    filterSources && filterSources.length > 0
      ? (() => {
          values.push(filterSources);
          return `WHERE s.id = ANY($${values.length}::text[])`;
        })()
      : "";

  const sql = `
    SELECT
      s.id AS source,
      ls.fetched_at AS last_sync_at,
      CASE
        WHEN ls.fetched_at IS NULL THEN 1000000
        ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ls.fetched_at)) / 60))::int
      END AS lag_minutes,
      ls.status AS last_snapshot_status
    FROM source s
    LEFT JOIN LATERAL (
      SELECT fetched_at, status
      FROM snapshot
      WHERE source_id = s.id
      ORDER BY fetched_at DESC
      LIMIT 1
    ) ls ON TRUE
    ${where}
    ORDER BY s.id ASC
  `;

  const result = await db.query(sql, values);

  return {
    sources: result.rows.map((row) => {
      const lag = Number(row.lag_minutes ?? 1000000);
      const status = lag <= 60 ? "healthy" : lag <= 240 ? "degraded" : "failing";
      return {
        source: String(row.source),
        status,
        last_sync_at: row.last_sync_at
          ? new Date(row.last_sync_at).toISOString()
          : new Date(0).toISOString(),
        lag_minutes: lag,
        error: row.last_snapshot_status === "failed" ? "last_sync_failed" : null,
      };
    }),
  };
}

export async function listChanges(
  db: Pool,
  query: ListChangesQuery,
): Promise<ListChangesResponse> {
  const values: unknown[] = [];
  const where: string[] = [];

  if (query.source) {
    values.push(query.source);
    where.push(`source_id = $${values.length}`);
  }

  if (query.event_type) {
    values.push(query.event_type);
    where.push(`event_type = $${values.length}`);
  }

  if (query.severity) {
    values.push(query.severity);
    where.push(`severity = $${values.length}`);
  }

  values.push(query.limit ?? 20);
  const limitIndex = values.length;

  const sql = `
    SELECT
      id,
      source_id,
      canonical_url,
      title,
      event_type,
      severity,
      summary,
      details,
      detected_at
    FROM change_event
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY detected_at DESC
    LIMIT $${limitIndex}
  `;

  const result = await db.query(sql, values);

  return {
    changes: result.rows.map((row) => ({
      id: String(row.id),
      source: String(row.source_id),
      canonical_url: String(row.canonical_url),
      title: String(row.title),
      event_type: row.event_type as ChangeEvent["event_type"],
      severity: row.severity as ChangeEvent["severity"],
      summary: String(row.summary),
      details: (row.details ?? {}) as Record<string, unknown>,
      detected_at: new Date(row.detected_at).toISOString(),
    })),
  };
}

export async function enqueueSourceSync(
  db: Pool,
  payload: SourceSyncRequest,
): Promise<SourceSyncResponse> {
  const requestId = newId("ssr");
  const requestedAt = new Date().toISOString();

  await db.query(
    `
      INSERT INTO source_sync_request (id, source_id, status, requested_at)
      VALUES ($1, $2, 'queued', $3::timestamptz)
    `,
    [requestId, payload.source, requestedAt],
  );

  try {
    const queue = getSourceSyncQueue();
    await queue.add(
      "source.sync.requested",
      {
        request_id: requestId,
        source: payload.source,
        requested_at: requestedAt,
      },
      {
        jobId: requestId,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query(
      `
        UPDATE source_sync_request
        SET status = 'failed', processed_at = NOW(), error = $2
        WHERE id = $1
      `,
      [requestId, `queue_enqueue_failed: ${message}`],
    );
    throw error;
  }

  return {
    accepted: true,
    source: payload.source,
    requested_at: requestedAt,
  };
}
