# what is up, docs - Progress Log

## 2026-02-16

### Completed

- Initialized repository structure and baseline docs.
- Added implementation plan, OpenAPI contract, and initial DB schema.
- Scaffolded MCP server and tool handlers (`search_docs`, `answer_with_sources`, `check_freshness`).
- Added workspace configuration and local infra scripts.
- Scaffolded query-api service and wired endpoint contracts.
- Replaced query-api stubs with Postgres-backed search/answer/source/sync behavior.
- Added source sync queue path with BullMQ and a dedicated ingestion worker.
- Installed Rancher Desktop and enabled local container runtime.
- Resolved local port conflicts by moving project Postgres default to `5433`.
- Verified infra startup, migrations, and end-to-end queue processing.
- Implemented crawler-based ingestion with URL canonicalization, filtering, BFS crawl, retries/backoff.
- Added source adapters for OpenAI, Next.js, Stripe, and React.
- Added adapter tests and source registry configuration for seeded crawl coverage.
- Added `change_event` migration and ingestion-time change event writing.
- Added `DecisionEnvelope` and reliability-first abstention handling in answer responses.
- Added `/v1/changes` endpoint and MCP `list_changes` tool.
- Updated MCP tests and validated build/tests green.
- Added context-aware retrieval filters across API + MCP (`region`, `plan`, `deployment_type`, `cloud`, `reference_date`).
- Added progressive MCP docs entrypoint (`docs_preflight`) and compact response mode for lower-token tool usage.
- Added prompt-injection sanitization in crawler ingestion (`sanitizePromptInjectionLines`) with signal tests.
- Added answer-time unsafe content detection and abstention path (`decision.status = unsafe_content`) with query-api tests.
- Added community license with commercial-use restriction and updated README safety/license guidance.
- Added Fly.io deployment artifacts for cloud API + worker:
  - `deploy/fly/query-api/*`
  - `deploy/fly/ingestion-worker/*`
- Added container-safe migration command (`npm --workspace @wiud/query-api run migrate`) for release deploys.
- Added deployment runbook for cloud + local MCP/Ollama hybrid in `docs/fly-deployment.md`.
- Added hosted MCP transport mode (`streamable-http`) with configurable endpoint path and health route.
- Added Fly deployment artifacts for hosted MCP service:
  - `deploy/fly/mcp-server/*`
- Added MCP client setup guide with local `stdio`, local HTTP, hosted endpoint, and Ollama pairing workflow.
- Deployed production baseline stack on Fly (`dfw`):
  - Query API: `https://wud-query-api-prod.fly.dev`
  - Ingestion worker: `wud-ingestion-worker-prod` running with Postgres + Upstash Redis
  - Hosted MCP (streamable HTTP): `https://wud-mcp-server-prod.fly.dev/mcp`
- Verified live smoke checks:
  - MCP health endpoint returns `{"status":"ok","transport":"streamable-http"}`
  - Source sync accepted and processed for `openai`
  - `/v1/changes` returns indexed change events
  - `/v1/answer` returns grounded response for indexed query terms
- Provisioned dedicated queue Redis (`wud-redis-queue-prod`) with no-eviction policy and rotated `REDIS_URL` secrets for query + worker.
- Added competitive/enterprise risk register and mitigation actions in `docs/risk-register.md`.
- Added hardened access controls for hosted surfaces:
  - production fail-closed auth defaults
  - optional API-key-to-tenant binding (`WIUD_API_KEY_TENANT_MAP_JSON`)
  - IP allowlist controls for query API and hosted MCP
  - configurable rate limits for query API and hosted MCP
- Added hosted endpoint auth controls:
  - Query API bearer auth via `WIUD_API_KEYS`
  - Hosted MCP bearer auth via `WIUD_MCP_API_KEYS`
- Added tenant policy engine and enforcement:
  - per-tenant source allow/deny and trust threshold controls
  - policy-aware source sync restrictions
- Added telemetry event pipeline and metrics endpoint:
  - migration `db/migrations/0004_telemetry_event.sql`
  - query API writes per-request telemetry
  - `/v1/metrics/summary` tenant-level reliability/latency summary
- Added CI/PR workflow and docs risk gate script:
  - `.github/workflows/ci.yml`
  - `scripts/ci/doc-gate.mjs`
- Upgraded change classification to section-level diff signals and added evaluation loop assets:
  - `services/ingestion-worker/src/store.ts`
  - `services/ingestion-worker/scripts/eval-change-classifier.ts`
  - `scripts/eval/change-classifier-fixtures.json`
- Triaged external product review and converted it into execution priorities:
  - Confirmed strategic direction: reliability workflows over generic docs chat
  - Marked hybrid retrieval and parser quality as highest technical gaps
  - Added dedicated roadmap milestone for retrieval depth + ICP wedge packaging
  - Marked already-completed controls (auth, tenant policy, CI gate, telemetry) to avoid duplicate work
- Started Milestone 11 with hybrid retrieval phase 1:
  - query API now combines lexical (`ILIKE`) + SQL full-text rank + intent-term reranking
  - candidate overfetch + fusion ranking added before response slicing
  - retrieval fusion logic covered by new query-api unit test
- Completed Milestone 11 hybrid retrieval phase 2:
  - added semantic embedding storage (`chunk_embedding`) with migration `db/migrations/0005_chunk_embedding.sql`
  - ingestion worker now optionally generates/stores normalized chunk embeddings (OpenAI or Ollama provider)
  - query API now optionally computes query embedding and fuses cosine semantic score into hybrid ranking
  - added env controls for embeddings across query API and ingestion worker
  - expanded hybrid retrieval tests for semantic-score ranking behavior

### Validation snapshots

- Build: passing across all workspaces.
- Tests: passing across ingestion worker + MCP server.
- Live source sync smoke tests: OpenAI, Next.js, Stripe, React successful.
- `/v1/answer` returns decision envelope with abstention when evidence is insufficient.

### In progress

- Add false-positive/false-negative tracking loop for change classification precision.
- Expand workflow integrations (Slack + IDE UX + production metrics surfaces).
- Add retrieval quality evaluation set (developer-phrase vs doc-phrase mismatch and regression tracking).

### Risks observed

- Some provider sitemaps can be missing or inconsistent (example resolved for React).
- Generic HTML extraction works but needs source-specific parsing quality upgrades for precision.
