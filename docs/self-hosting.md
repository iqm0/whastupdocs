# Self‑Hosting (Enterprise)

Last updated: 2026-02-16

This guide covers running all components in your own cloud with production‑grade settings. See `docs/fly-deployment.md` for a concrete Fly.io example.

Components

- `query-api`: HTTP service (ingress‑facing)
- `ingestion-worker`: background jobs
- `mcp-server`: MCP over stdio or streamable HTTP
- Postgres 16+, Redis 7+, optional embeddings table

Baseline Architecture

- Private VPC for Postgres/Redis and workers
- Public ingress for `query-api`
- Optional public ingress for `mcp-server` when using hosted MCP (`/mcp`)

Minimum Configuration

- `DATABASE_URL`, `REDIS_URL` for API and worker
- API auth: `WIUD_API_KEYS` (comma‑separated) or integrate with your gateway
- Tenant policies: `WIUD_TENANT_POLICIES_JSON` to scope sources and trust thresholds
- MCP hosted mode: set `WIUD_BACKEND_URL` on MCP, and `WIUD_MCP_API_KEYS` when exposing `/mcp`

Sizing Guidance

- `query-api`: 256–512 MB RAM, 0.25–1 vCPU; scale based on QPS
- `ingestion-worker`: 512–1024 MB RAM; bump to 768+ MB for heavy docs or enable auto‑scale

Security Controls

- Network allowlists: `WIUD_IP_ALLOWLIST`, `WIUD_MCP_IP_ALLOWLIST`
- Rate limits: `WIUD_RATE_LIMIT_MAX` and `WIUD_MCP_RATE_LIMIT_MAX`
- Token to tenant binding: `WIUD_API_KEY_TENANT_MAP_JSON`

Operational Runbooks

- Change alerts and Slack onboarding: see `docs/fly-deployment.md` (operator‑only endpoints)
- OOM remediation for worker: see `docs/fly-deployment.md` section “OOM incident runbook”

Embeddings

- Optional. Enable in both API and worker with `WIUD_EMBEDDINGS_ENABLED=true` and provider credentials. Without embeddings, ranking uses Postgres FTS + intent heuristics.

Observability

- Health endpoints: `GET /health` on API and MCP, Fly/cluster logs for worker
- Telemetry summary (per tenant): `GET /v1/policy/observability` when governance enabled

