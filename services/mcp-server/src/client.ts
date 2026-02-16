import type {
  AnswerRequest,
  AnswerResponse,
  ListChangesQuery,
  ListChangesResponse,
  ListSourcesResponse,
  SearchRequest,
  SearchResponse,
} from "./types.js";

function getConfig(): { backendUrl: string; apiKey?: string } {
  return {
    backendUrl: process.env.WIUD_BACKEND_URL ?? "http://localhost:8080",
    apiKey: process.env.WIUD_API_KEY,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { backendUrl, apiKey } = getConfig();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (apiKey) {
    headers.set("authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WIUD backend error (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export async function searchDocs(payload: SearchRequest): Promise<SearchResponse> {
  return request<SearchResponse>("/v1/search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function answerWithSources(
  payload: AnswerRequest,
): Promise<AnswerResponse> {
  return request<AnswerResponse>("/v1/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSources(): Promise<ListSourcesResponse> {
  return request<ListSourcesResponse>("/v1/sources", {
    method: "GET",
  });
}

export async function listChanges(query: ListChangesQuery): Promise<ListChangesResponse> {
  const params = new URLSearchParams();
  if (query.source) {
    params.set("source", query.source);
  }
  if (query.event_type) {
    params.set("event_type", query.event_type);
  }
  if (query.severity) {
    params.set("severity", query.severity);
  }
  if (query.limit) {
    params.set("limit", String(query.limit));
  }

  const qs = params.toString();
  const path = qs ? `/v1/changes?${qs}` : "/v1/changes";

  return request<ListChangesResponse>(path, {
    method: "GET",
  });
}
