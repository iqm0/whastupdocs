# Fly.io Deployment Guide

Last updated: 2026-02-16

## Deployment model

- `query-api` is internet-facing HTTP.
- `ingestion-worker` is private background processing.
- `mcp-server` can run:
  - locally in `stdio` mode (IDE/CLI clients)
  - hosted in `streamable-http` mode (`/mcp`) for enterprise managed access

This supports:
- Enterprise cloud runtime (shared managed backend + central ingestion).
- Individual local runtime (all services local, optional local LLM + MCP client).

## Prerequisites

- Fly account and `flyctl` installed.
- Postgres and Redis URLs available (Fly managed or external).
- Repo checked out locally.

## 1) Create apps

App names must be globally unique. Example:

```bash
fly apps create wud-query-api-prod
fly apps create wud-ingestion-worker-prod
fly apps create wud-mcp-server-prod
```

Update:
- `deploy/fly/query-api/fly.toml`
- `deploy/fly/ingestion-worker/fly.toml`
- `deploy/fly/mcp-server/fly.toml`

Set `app = "<your-app-name>"` in each file.

## 2) Set secrets

Set the same database and redis URLs on both apps:

```bash
fly secrets set \
  DATABASE_URL='postgres://...' \
  REDIS_URL='redis://...' \
  WIUD_API_KEYS='replace-with-strong-api-key' \
  --app wud-query-api-prod

fly secrets set \
  DATABASE_URL='postgres://...' \
  REDIS_URL='redis://...' \
  --app wud-ingestion-worker-prod
```

Optional tenant policy controls on query API:

```bash
fly secrets set \
  WIUD_TENANT_POLICIES_JSON='{"default":{"allow_sources":["openai","stripe"],"min_trust_score":0.8}}' \
  --app wud-query-api-prod
```

Set backend URL for hosted MCP:

```bash
fly secrets set \
  WIUD_BACKEND_URL='https://wud-query-api-prod.fly.dev' \
  WIUD_MCP_API_KEYS='replace-with-strong-mcp-key' \
  --app wud-mcp-server-prod
```

Optional on `query-api`:

```bash
fly secrets set ANSWER_STALE_THRESHOLD_MINUTES='1440' --app wud-query-api-prod
```

## 3) Deploy query API (runs migrations automatically)

```bash
fly deploy \
  --config deploy/fly/query-api/fly.toml \
  --dockerfile deploy/fly/query-api/Dockerfile \
  --app wud-query-api-prod
```

Health check:

```bash
curl -sS https://wud-query-api-prod.fly.dev/v1/sources
```

## 4) Deploy ingestion worker

```bash
fly deploy \
  --config deploy/fly/ingestion-worker/fly.toml \
  --dockerfile deploy/fly/ingestion-worker/Dockerfile \
  --app wud-ingestion-worker-prod
```

Keep one worker machine running:

```bash
fly scale count 1 --app wud-ingestion-worker-prod
```

## 5) Smoke test cloud flow

Trigger sync:

```bash
curl -sS -X POST https://wud-query-api-prod.fly.dev/v1/sources/sync \
  -H 'content-type: application/json' \
  -d '{"source":"openai"}'
```

After worker processes, query:

```bash
curl -sS -X POST https://wud-query-api-prod.fly.dev/v1/answer \
  -H 'content-type: application/json' \
  -d '{"question":"How do I use reasoning models?","filters":{"sources":["openai"]}}'
```

## 6) Deploy hosted MCP endpoint (optional)

Deploy:

```bash
fly deploy \
  --config deploy/fly/mcp-server/fly.toml \
  --dockerfile deploy/fly/mcp-server/Dockerfile \
  --app wud-mcp-server-prod
```

Health check:

```bash
curl -sS https://wud-mcp-server-prod.fly.dev/health
```

MCP endpoint:

- `https://wud-mcp-server-prod.fly.dev/mcp`

## 7) Use MCP locally against cloud API

Run local MCP server with cloud backend:

```bash
WIUD_BACKEND_URL='https://wud-query-api-prod.fly.dev' npm run dev:mcp
```

Local default is `stdio`, ideal for local IDE/agent tools.

To run local MCP in hosted-compatible mode:

```bash
WIUD_MCP_TRANSPORT=streamable-http WIUD_MCP_PORT=3001 npm run dev:mcp
```

## Local LLM + Ollama mode

`what is up, docs` does retrieval/freshness/change intelligence. You can pair it with a local model via any MCP-compatible client:

1. Run stack locally (`query-api`, `ingestion-worker`, `mcp-server`).
2. Use an IDE/agent client configured with:
   - model provider: Ollama (`http://localhost:11434`)
   - MCP server command: `npm run dev:mcp` from the repository root (for `stdio`)
   - or remote MCP URL: `https://wud-mcp-server-prod.fly.dev/mcp`
3. Keep tool mode compact-first (`docs_preflight`, then `search_docs`/`answer_with_sources` as needed).

This gives local inference privacy while retaining fresh, cited docs retrieval.
