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
- `openapi/openapi.yaml`: backend API contract (MVP)
- `db/migrations/0001_init.sql`: initial PostgreSQL schema
- `db/migrations/0002_source_sync_request.sql`: source sync request queue tracking
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

## Current Status

This is an initial scaffold focused on planning and core interface contracts. The `query-api` now reads from PostgreSQL and exposes queue-backed source sync. The ingestion worker now includes real adapters for OpenAI, Next.js, Stripe, and React (fetch -> extract -> chunk -> persist). Hybrid retrieval indexing, Slack runtime, and IDE runtime are intentionally not implemented yet.

The source sync flow is now queue-backed:

1. `POST /v1/sources/sync` writes `source_sync_request` and enqueues BullMQ job.
2. `ingestion-worker` consumes the job and records a `snapshot`.
3. `GET /v1/sources` reports freshness from latest snapshots.

## Safety Notes

- Ingestion sanitizes high-risk prompt-injection lines before indexing content.
- Answer generation detects prompt-injection patterns in retrieved chunks and can abstain with `decision.status = unsafe_content`.
- API responses expose warnings and policy flags so agents can avoid unsafe autonomous actions.

## License

This repository is distributed under the `What Is Up, Docs Community License v1.0` (`/Users/igormoreira/code/wud/LICENSE`).

- Allowed: personal, educational, research, and non-commercial internal use.
- Restricted: commercial productization, hosted commercial offerings, and competing commercial derivatives without a commercial license.

## Deployment Modes

- Local-first mode: run API + worker + MCP server on your machine.
- Cloud mode: deploy `query-api` and `ingestion-worker` to Fly; run MCP locally and point it to cloud API.
- Hosted MCP mode: deploy `mcp-server` with `WIUD_MCP_TRANSPORT=streamable-http` and expose `/mcp` for enterprise-managed clients.
- Hybrid local-LLM mode: pair local Ollama model with local MCP + local or cloud backend API.

See `/Users/igormoreira/code/wud/docs/fly-deployment.md` for concrete Fly commands.
