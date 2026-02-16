# Managed Cloud (Hosted Consumption)

Last updated: 2026-02-16

This path assumes you consume a hosted `query-api` and optionally a hosted MCP endpoint provided by the platform/company. You do not run infrastructure.

What You Get

- Base URL for API (e.g., `https://<tenant>.wudapi.example.com`)
- Optional hosted MCP URL (e.g., `https://<tenant>.wudmcp.example.com/mcp`)
- One or more API tokens bound to your tenant

Quick Start

- Call search: `POST {BASE_URL}/v1/search` with `authorization: Bearer <token>`
- Call answer: `POST {BASE_URL}/v1/answer`
- List freshness: `GET {BASE_URL}/v1/sources`

MCP Options

- Local MCP pointed at hosted API:
  - `WIUD_BACKEND_URL='{BASE_URL}' npm run dev:mcp`
- Hosted MCP:
  - Use the provided URL in your MCP‑capable client and pass the MCP API key if required.

Tenant Controls

- Ask support to set `WIUD_TENANT_POLICIES_JSON` for your tenant if you need allow/deny source lists, trust thresholds, or stricter auth binding.

Security Defaults

- The managed API is fail‑closed unless keys are configured for you.
- Operator‑only surfaces like Slack, Alerts, Governance are disabled by default in managed multi‑tenant runtime.

Migration Signals

- Use `GET {BASE_URL}/v1/sources` to spot stale coverage.
- Use `POST {BASE_URL}/v1/answer` with `decision.status` to detect `stale_sources`, `conflict_detected`, or `unsafe_content` before changes.

