# what is up, docs - Implementation Plan

## 1. MVP Goals

- Deliver up-to-date, citation-backed answers from trusted developer documentation.
- Expose the same retrieval/answer capability through API, MCP, Slack, and IDE.
- Enforce source provenance and freshness visibility on every answer.

## 2. MVP Scope

### In scope

- Curated source registry (official docs + changelogs + selected repo docs)
- Ingestion pipeline with schedule + trigger support
- Document normalization and versioning
- Hybrid retrieval API (`/v1/search`)
- Answer API with mandatory citations (`/v1/answer`)
- MCP server tools:
  - `search_docs`
  - `answer_with_sources`
  - `check_freshness`
- Initial Postgres schema and migration

### Out of scope (initial scaffold)

- Full crawler implementations
- Slack app runtime and OAuth flow
- VS Code extension runtime
- Advanced policy engine and enterprise SSO

## 3. Architecture (MVP)

1. `source-registry`: manages source definitions, polling cadence, trust score.
2. `ingestion-worker`: fetches source content and persists snapshots.
3. `normalizer`: converts raw docs/release data to canonical documents + chunks.
4. `indexer`: upserts BM25 and vector indices.
5. `query-api`: serves search, answer, and source health endpoints.
6. `mcp-server`: translates MCP tool calls to query API endpoints.

## 4. Data Contracts

- OpenAPI contract: `openapi/openapi.yaml`
- DB schema: `db/migrations/0001_init.sql`
- MCP contracts: `services/mcp-server/src/index.ts`

## 5. Execution Plan

## Phase 1: Contracts + Schema

- Finalize OpenAPI endpoints and payload constraints.
- Land initial Postgres migration.
- Set up MCP server scaffolding with typed request/response mapping.

Acceptance:

- Contract lint passes.
- SQL migration applies cleanly on empty DB.
- MCP server boots and lists tools.

## Phase 2: Retrieval Path

- Implement `/v1/search` with hybrid retrieval backend.
- Implement source filtering and version pinning.
- Track freshness lag per source.

Acceptance:

- Search returns ranked snippets with metadata and timestamps.
- Freshness endpoint reports sync lag by source.

## Phase 3: Answer Path

- Implement `/v1/answer` using retrieved chunks.
- Require citation attachment on non-empty answers.
- Add low-confidence fallback behavior (`insufficient_sources`).

Acceptance:

- P95 answer latency under 4 seconds at MVP load.
- >=95% of successful answers include at least one citation.

## Phase 4: Delivery Surfaces

- Slack app command handlers and thread replies.
- VS Code extension command and side panel.
- Usage telemetry and quality dashboards.

Acceptance:

- End-to-end demos from Slack and IDE with same backend answers.

## 6. Risks and Mitigations

1. Source drift and parser breakage
- Mitigation: parser versioning + failure alerts + fallback raw snapshots.

2. Staleness under upstream spikes
- Mitigation: priority queues + per-source backoff + on-demand sync endpoint.

3. Hallucinated synthesis
- Mitigation: strict retrieval grounding + citation presence check + low-confidence fallback.

4. Cost spikes from embedding/LLM usage
- Mitigation: dedupe via content hash + cache hot queries + limit context window.

## 7. Immediate Next Tasks

1. Stand up `query-api` service skeleton aligned to OpenAPI.
2. Add migration runner (`dbmate`, `node-pg-migrate`, or `flyway`) and CI check.
3. Add MCP integration test that validates tool schemas and backend forwarding.
