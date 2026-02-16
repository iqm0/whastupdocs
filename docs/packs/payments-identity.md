# Payments + Identity Pack

Last updated: 2026-02-16

This pack is the first ICP default profile for fintech/integration teams.

## What it optimizes for

- Fast detection of payment/auth integration risk from doc changes.
- Fewer stale or wrong-context agent answers in production workflows.
- Clear escalation path when deprecations or breaking changes appear.

## Pack file

- `config/packs/payments-identity.json`

## Suggested baseline setup

1. Set tenant policy to allow only required sources and trust thresholds.
2. Set CI gates:
   - docs risk gate (`scripts/ci/doc-gate.mjs`)
   - retrieval quality gate (`scripts/ci/retrieval-gate.mjs`)
3. Enable Slack change alerts with medium-or-higher severity.
4. Use context defaults in prompts and MCP calls:
   - `version=latest`
   - `region=us`
   - `plan=enterprise`
   - `deployment_type=cloud`

## Example retrieval call profile

```json
{
  "query": "webhook signature verification and retry behavior",
  "filters": {
    "sources": ["stripe"],
    "version": "latest",
    "region": "us",
    "plan": "enterprise",
    "deployment_type": "cloud"
  },
  "top_k": 8
}
```

## Example Fly env alignment

```bash
fly secrets set \
  WIUD_SLACK_CHANGE_MIN_SEVERITY='medium' \
  WIUD_SLACK_CHANGE_INCLUDE_UPDATED='false' \
  WIUD_SLACK_CHANGE_MAX_EVENTS='8' \
  --app wud-ingestion-worker-prod
```
