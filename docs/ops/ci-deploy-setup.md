# CI & Deploy Setup

Owner tasks to enable cloud deploys and nightly retrieval evaluation.

## Required GitHub Actions configuration

Secrets (Repository → Settings → Actions → Secrets):
- `FLY_API_TOKEN`: Fly.io API token for deploys.
- `WIUD_GATE_API_KEY`: Query API key for retrieval gate.
- `SLACK_WEBHOOK_URL` (optional): Slack Incoming Webhook for gate failure alerts.

Variables (optional):
- `WIUD_GATE_BASE_URL`: Base URL for the Query API used by gates. Default `https://wud-query-api-prod.fly.dev`.

Workflows created:
- `.github/workflows/fly-deploy.yml`: builds and deploys Query API on `main`.
- `.github/workflows/retrieval-nightly.yml`: runs retrieval gate nightly and alerts Slack on failure.

## Post‑merge rollout checklist

1. Run the Fly deploy workflow
   - GitHub → Actions → "Fly Deploy" → Run workflow (branch `main`).
2. Verify health with an API key
   - Query API accepts `Authorization: Bearer` and `x-api-key`/`x-wiud-api-key`.
   - Example:
     ```bash
     curl -sS https://wud-query-api-prod.fly.dev/health -H "x-api-key: $WIUD_GATE_API_KEY"
     ```
3. Trigger source syncs (operator-only)
   - Only for self-hosts or ops. Managed cloud keeps operator routes disabled by default.
   - Example:
     ```bash
     curl -sS -X POST https://wud-query-api-prod.fly.dev/v1/sources/sync \
       -H 'content-type: application/json' \
       -H "x-api-key: $WIUD_GATE_API_KEY" \
       -d '{"source":"plaid"}'
     ```
   - Repeat for: `stripe`, `openbanking-uk`, `mdn-http`.
4. Run retrieval gate against prod
   - From the repo root:
     ```bash
     WIUD_GATE_BASE_URL=https://wud-query-api-prod.fly.dev \
     WIUD_GATE_API_KEY=$WIUD_GATE_API_KEY \
     node scripts/ci/retrieval-gate.mjs
     ```
   - Review `failed_cases` and `skipped_fixtures` in the output.
5. Nightly alerts
   - If `SLACK_WEBHOOK_URL` is set, gate failures post to Slack automatically.

## Operator-only surfaces (gated off by default)

Environment flags (Query API):
- `WIUD_ENABLE_SLACK_RUNTIME=false`
- `WIUD_ENABLE_ALERTS_API=false`
- `WIUD_ENABLE_METRICS_API=false`
- `WIUD_ENABLE_GOVERNANCE_API=false`

Enable only for self-hosting or internal ops; keep disabled in managed cloud.

## Notes
- If Fly deploy via local CLI fails with registry 401, prefer the GitHub Actions "Fly Deploy" workflow (uses `FLY_API_TOKEN`).
- See also: `docs/fly-deployment.md`, `docs/self-hosting.md`, `docs/managed-cloud.md`.

