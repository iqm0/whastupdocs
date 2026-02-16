# Local Testing (Hobbyist/Solo)

Last updated: 2026-02-16

This guide gets you running everything locally with minimal setup. No cloud accounts required.

Prerequisites

- Node.js 22+
- Docker with Compose v2
- `psql` CLI (optional, for quick checks)

Startup

1) Install deps: `npm install`
2) Start infra: `npm run infra:up`
   - Brings up Postgres on `localhost:5433` and Redis on `6379`.
3) Run migrations: `npm run db:migrate`
4) Start API: `npm run dev:query-api`
5) Start worker (new terminal): `npm run dev:ingestion-worker`
6) Start MCP (new terminal): `npm run dev:mcp`

Smoke Test

- List sources: `curl -sS http://localhost:8080/v1/sources | jq .`
- Trigger a sync: `curl -sS -X POST http://localhost:8080/v1/sources/sync -H 'content-type: application/json' -d '{"source":"openai"}'`
- Ask a question: `curl -sS -X POST http://localhost:8080/v1/answer -H 'content-type: application/json' -d '{"question":"How do I use reasoning models?","filters":{"sources":["openai"]}}' | jq .`

MCP in an IDE/Agent

- Use `npm run dev:mcp` (stdio) and attach it in your MCP‑capable client.
- To target the local API explicitly: set `WIUD_BACKEND_URL='http://localhost:8080'` when starting MCP.

Optional: Local Embeddings

- Embeddings are off by default; retrieval falls back to Postgres FTS + intent ranking.
- To enable embeddings:
  - In API: set `WIUD_EMBEDDINGS_ENABLED=true` and provider settings in `services/query-api/.env.example` values.
  - In worker: mirror the same in `services/ingestion-worker/.env.example` and restart both processes.
- Ollama pairing: keep embeddings disabled, and use Ollama only for generation while using MCP tools for retrieval.

Eval + CI‑style Checks

- Retrieval eval: `npm run eval:retrieval` (uses `scripts/eval/retrieval-fixtures.json`).
- Slack change alert test (local only): `npm run slack:test -- --source onboarding`.

Troubleshooting

- Port 5433 in use: stop other Postgres or change `POSTGRES_PORT` env when running Compose.
- Empty answers: wait for the worker to process snapshots, or re‑run the sync call.
- Rate‑limited: unset `WIUD_RATE_LIMIT_MAX` locally or slow requests.

Shutdown

- `npm run infra:down` to stop and remove local containers/volumes.

