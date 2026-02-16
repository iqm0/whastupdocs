# what is up, docs

`what is up, docs` is a DocsOps platform for LLMs, IDEs, and Slack.

It continuously ingests official developer documentation and changelogs, indexes content with freshness metadata, and serves source-cited answers through:

- MCP tools for any compatible LLM agent
- Slack app commands and mentions
- IDE integrations (starting with VS Code)

## Repository Layout

- `docs/implementation-plan.md`: product + engineering implementation plan
- `docs/fly-deployment.md`: Fly.io deployment guide (cloud API + worker, local MCP)
- `docs/mcp-client-setup.md`: MCP client setup for local/hosted/Ollama workflows
- `docs/risk-register.md`: competitive risks, threats, and mitigation actions
- `openapi/openapi.yaml`: backend API contract (MVP)
- `db/migrations/0001_init.sql`: initial PostgreSQL schema
- `db/migrations/0002_source_sync_request.sql`: source sync request queue tracking
- `db/migrations/0005_chunk_embedding.sql`: optional semantic embedding storage for chunk retrieval
- `services/query-api/`: Fastify API scaffold aligned with OpenAPI
- `services/mcp-server/`: TypeScript MCP server skeleton (`search_docs`, `answer_with_sources`, `check_freshness`)
- `services/ingestion-worker/`: queue consumer for source sync jobs
- `config/source-registry.json`: curated source definitions used by ingestion worker
- `docker-compose.yml`: local dependencies (Postgres, Redis, OpenSearch)
- `scripts/run-migrations.sh`: migration runner

## Quick Start (Local Dev)

Prerequisites: Node.js 22+, `psql`, Docker with Compose v2 plugin.

1. Install workspace dependencies:

```bash
npm install
```

2. Start dependencies:

```bash
npm run infra:up
```

3. Apply migrations:

```bash
npm run db:migrate
```

Optional: review or extend source registry in `config/source-registry.json`.
Optional: tune ingestion with `MAX_INGEST_PAGES`, `INGEST_TIMEOUT_MS`, `MAX_CRAWL_DEPTH`, `FETCH_RETRIES`, and `RETRY_BACKOFF_MS` in `services/ingestion-worker/.env.example`.

4. Run query API:

```bash
npm run dev:query-api
```

5. Run ingestion worker (in a separate terminal):

```bash
npm run dev:ingestion-worker
```

6. Run MCP server (in a separate terminal):

```bash
npm run dev:mcp
```

## Quick Start (Per Service)

### Query API

```bash
cd services/query-api
npm install
npm run build
npm run dev
```

### MCP Server

```bash
cd services/mcp-server
npm install
npm run build
npm start
```

Environment variables:

- `WIUD_BACKEND_URL`: backend API base URL for MCP server (default: `http://localhost:8080`)
- `WIUD_API_KEY`: optional bearer token for backend API
- `WIUD_TENANT_ID`: optional tenant routing header passed to backend
- `WIUD_MCP_API_KEYS`: optional comma-separated bearer keys required for hosted MCP HTTP mode

## Current Status

This is an early but working baseline. The `query-api` reads from PostgreSQL, supports queue-backed source sync, and uses hybrid retrieval (lexical + full-text + intent + optional semantic embeddings). The ingestion worker includes adapters for OpenAI, Next.js, Stripe, and React (fetch -> extract -> chunk -> persist) and can optionally persist chunk embeddings for semantic rank fusion. Slack runtime and IDE runtime remain open milestones.

The source sync flow is now queue-backed:

1. `POST /v1/sources/sync` writes `source_sync_request` and enqueues BullMQ job.
2. `ingestion-worker` consumes the job and records a `snapshot`.
3. `GET /v1/sources` reports freshness from latest snapshots.

Optional semantic retrieval path:

- Enable in both query API and ingestion worker with `WIUD_EMBEDDINGS_ENABLED=true`.
- Supported providers: OpenAI-compatible embeddings APIs and local Ollama embeddings.
- If embeddings are disabled or unavailable, ranking gracefully falls back to lexical/FTS/intent fusion.

Retrieval evaluation:

- Run `npm run eval:retrieval` to score current index quality using fixture cases.
- Default fixtures live at `scripts/eval/retrieval-fixtures.json`.
- Override fixture path with `WIUD_RETRIEVAL_FIXTURES_PATH`.

## Safety Notes

- Ingestion sanitizes high-risk prompt-injection lines before indexing content.
- Ingestion applies source-specific noise filtering to remove common docs-site boilerplate before chunking.
- Answer generation detects prompt-injection patterns in retrieved chunks and can abstain with `decision.status = unsafe_content`.
- API responses expose warnings and policy flags so agents can avoid unsafe autonomous actions.
- Change events now include `recommended_actions` to drive migration/remediation workflows.

## Multi-Tenant Policy and Auth

- Query API auth is enabled when `WIUD_API_KEYS` is configured (comma-separated bearer tokens).
- Query API is fail-closed in production by default. To allow anonymous access explicitly, set `WIUD_ALLOW_ANONYMOUS=true`.
- Tenant context is passed with `x-wiud-tenant-id` (defaults to `default`).
- Tenant policy controls can be configured with `WIUD_TENANT_POLICIES_JSON`:
  - `allow_sources`
  - `deny_sources`
  - `min_trust_score`
  - `sync_allowed_sources`
- Optional token-to-tenant binding: `WIUD_API_KEY_TENANT_MAP_JSON` (prevents tenant spoofing via header).
- Optional Query API network controls:
  - `WIUD_IP_ALLOWLIST` (comma-separated exact/prefix patterns; `10.0.*`)
  - `WIUD_RATE_LIMIT_MAX` + `WIUD_RATE_LIMIT_WINDOW_MS`
- Hosted MCP auth is enabled when `WIUD_MCP_API_KEYS` is configured.
- Hosted MCP is fail-closed in production by default unless `WIUD_MCP_ALLOW_ANONYMOUS=true`.
- Optional MCP network controls:
  - `WIUD_MCP_IP_ALLOWLIST`
  - `WIUD_MCP_RATE_LIMIT_MAX` + `WIUD_MCP_RATE_LIMIT_WINDOW_MS`

## CI Gates

- GitHub Actions CI runs build + tests on push/PR: `.github/workflows/ci.yml`.
- Optional docs risk gate runs when `WIUD_GATE_BASE_URL` is configured in repository secrets.
- Optional retrieval quality gate runs against fixture queries when `WIUD_GATE_BASE_URL` is configured.
- Manual run:

```bash
node scripts/ci/doc-gate.mjs
node scripts/ci/retrieval-gate.mjs
```

Retrieval gate thresholds:

- `WIUD_RETRIEVAL_GATE_MIN_HIT_AT_K` (default `0.65`)
- `WIUD_RETRIEVAL_GATE_MIN_MRR` (default `0.50`)
- `WIUD_RETRIEVAL_FIXTURES_PATH` (default `scripts/eval/retrieval-fixtures.json`)

## Change Alerts

- Ingestion worker can send Slack webhook alerts for detected change events.
- Fly onboarding/runbook commands: see `docs/fly-deployment.md` section "Slack onboarding and webhook verification".
- Fly OOM runbook: see `docs/fly-deployment.md` section "OOM incident runbook (ingestion worker)".
- Configure in `services/ingestion-worker/.env.example`:
  - `WIUD_SLACK_CHANGE_WEBHOOK_URL`
  - `WIUD_SLACK_CHANGE_MIN_SEVERITY`
  - `WIUD_SLACK_CHANGE_INCLUDE_UPDATED`
  - `WIUD_SLACK_CHANGE_MAX_EVENTS`
- Send a manual onboarding test message:
  - CLI: `npm run slack:test -- --source onboarding`
  - API (auth required): `POST /v1/alerts/slack/test`
    - uses `WIUD_SLACK_CHANGE_WEBHOOK_URL` by default
    - optional `webhook_url` override requires `WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE=true`

## Slack Runtime

- Slack slash commands endpoint: `POST /v1/slack/commands`
- Slack Events endpoint: `POST /v1/slack/events`
- Both endpoints validate Slack request signatures using `WIUD_SLACK_SIGNING_SECRET`.
- Optional app mention replies require `WIUD_SLACK_BOT_TOKEN`.
- Optional command source defaults: `WIUD_SLACK_COMMAND_SOURCES` (comma-separated).

## Governance Endpoints

- `GET /v1/audit/export`: tenant-scoped telemetry audit export (`json` or `ndjson`).
- `GET /v1/policy/observability`: effective source coverage + 7-day policy risk summary.

## ICP Packs

- First wedge pack: `config/packs/payments-identity.json`
- Playbook: `docs/packs/payments-identity.md`
- Plaid docs coverage map: `docs/packs/plaid-finance-map.md`

## License

This repository is distributed under the `What Is Up, Docs Community License v1.0` (`LICENSE`).

- Allowed: personal, educational, research, and non-commercial internal use.
- Restricted: commercial productization, hosted commercial offerings, and competing commercial derivatives without a commercial license.

## Deployment Modes

- Local-first mode: run API + worker + MCP server on your machine.
- Cloud mode: deploy `query-api` and `ingestion-worker` to Fly; run MCP locally and point it to cloud API.
- Hosted MCP mode: deploy `mcp-server` with `WIUD_MCP_TRANSPORT=streamable-http` and expose `/mcp` for enterprise-managed clients.
- Hybrid local-LLM mode: pair local Ollama model with local MCP + local or cloud backend API.

See `docs/fly-deployment.md` for concrete Fly commands.
