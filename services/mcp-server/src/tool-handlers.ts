import { answerWithSources, listChanges, listSources, searchDocs } from "./client.js";
import { docsPreflight } from "./relevance.js";
import {
  AnswerWithSourcesInputSchema,
  CheckFreshnessInputSchema,
  DocsPreflightInputSchema,
  ListChangesInputSchema,
  SearchDocsInputSchema,
} from "./validation.js";

type ToolContent = {
  type: "text";
  text: string;
};

export type ToolCallResult = {
  isError?: boolean;
  content: ToolContent[];
};

export async function handleToolCall(
  name: string,
  rawArgs: unknown,
): Promise<ToolCallResult> {
  if (name === "docs_preflight") {
    const input = DocsPreflightInputSchema.parse(rawArgs ?? {});
    const result = docsPreflight(input.task, input.sources ?? []);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (name === "search_docs") {
    const input = SearchDocsInputSchema.parse(rawArgs ?? {});
    const result = await searchDocs({
      query: input.query,
      top_k: input.top_k,
      filters: {
        sources: input.sources,
        version: input.version,
        updated_after: input.updated_after,
        language: input.language,
        region: input.region,
        plan: input.plan,
        deployment_type: input.deployment_type,
        cloud: input.cloud,
        reference_date: input.reference_date,
      },
    });

    const payload = input.compact
      ? {
          results: result.results.map((item) => ({
            title: item.title,
            url: item.url,
            source: item.source,
            last_changed_at: item.last_changed_at,
          })),
        }
      : result;

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  }

  if (name === "answer_with_sources") {
    const input = AnswerWithSourcesInputSchema.parse(rawArgs ?? {});
    const result = await answerWithSources({
      question: input.question,
      style: input.style,
      max_citations: input.max_citations,
      filters: {
        sources: input.sources,
        version: input.version,
        updated_after: input.updated_after,
        language: input.language,
        region: input.region,
        plan: input.plan,
        deployment_type: input.deployment_type,
        cloud: input.cloud,
        reference_date: input.reference_date,
      },
    });

    const payload = input.compact
      ? {
          answer: result.answer,
          decision: result.decision,
          citations: result.citations.map((item) => ({
            title: item.title,
            url: item.url,
            source: item.source,
          })),
        }
      : result;

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  }

  if (name === "check_freshness") {
    const input = CheckFreshnessInputSchema.parse(rawArgs ?? {});
    const result = await listSources();
    const filtered =
      input.sources && input.sources.length > 0
        ? {
            sources: result.sources.filter((source) =>
              input.sources?.includes(source.source),
            ),
          }
        : result;

    const payload = input.compact
      ? {
          sources: filtered.sources.map((source) => ({
            source: source.source,
            status: source.status,
            lag_minutes: source.lag_minutes,
          })),
        }
      : filtered;

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  }

  if (name === "list_changes") {
    const input = ListChangesInputSchema.parse(rawArgs ?? {});
    const result = await listChanges({
      source: input.source,
      event_type: input.event_type,
      severity: input.severity,
      limit: input.limit,
    });

    const payload = input.compact
      ? {
          changes: result.changes.map((change) => ({
            source: change.source,
            event_type: change.event_type,
            severity: change.severity,
            summary: change.summary,
            recommended_actions: change.recommended_actions.slice(0, 2),
            detected_at: change.detected_at,
          })),
        }
      : result;

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
}
