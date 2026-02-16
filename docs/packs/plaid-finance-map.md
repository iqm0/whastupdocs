# Plaid Docs Coverage Map

Last updated: 2026-02-16

This map captures Plaid's documentation surface for ingestion and change monitoring.

## Primary docs entrypoints

- Main docs home: `https://plaid.com/docs/`
- Quickstart flow: `https://plaid.com/docs/quickstart/`
- API reference: `https://plaid.com/docs/api/`
- Link implementation: `https://plaid.com/docs/link/`
- LLM index pages:
  - `https://plaid.com/docs/llms.txt`
  - `https://plaid.com/docs/llms-full.txt`

## Product domains to monitor

- Link and onboarding flows
- Auth and account verification
- Transactions and recurring transactions
- Assets and statements
- Identity and Identity Verification
- Income and employment
- Liabilities
- Investments and holdings
- Payment rails:
  - Transfer
  - Signal
  - Identity Match
  - Payment Initiation
  - Virtual accounts
- Connectors and integrations:
  - Plaid Exchange
  - Core Exchange
  - FDX
- Insights and anti-fraud:
  - Beacon
  - Monitor
- Reporting and support APIs:
  - Reports
  - Dashboard and webhooks

## Integration paths (recommended retrieval workflows)

1. New institution integration path:
- Start with `quickstart` and Link setup.
- Validate required products and account filters.
- Confirm region/product support constraints.
- Implement API endpoints and webhook lifecycle.
- Add deprecation/breaking-change watchlist for used endpoints.

2. Existing integration hardening path:
- Run `list_changes` weekly for `plaid` source with `severity>=medium`.
- Diff auth/link/webhook docs for backwards-incompatible behavior.
- Re-run retrieval eval fixtures for Plaid-heavy prompts.
- Create migration tickets from `recommended_actions` when deprecations appear.

3. Incident response path:
- Use `answer_with_sources` constrained to `sources=["plaid"]` and environment context.
- Escalate when decision status is `stale_sources`, `conflict_detected`, or `unsafe_content`.
- Trigger immediate source sync and re-evaluate before patch rollout.

## Suggested source policy defaults for fintech tenants

```json
{
  "allow_sources": ["plaid", "stripe", "openai"],
  "min_trust_score": 0.9,
  "sync_allowed_sources": ["plaid", "stripe", "openai"]
}
```

## Suggested CI gate profile

- `WIUD_GATE_SOURCES=plaid,stripe`
- `WIUD_GATE_QUESTION=What changed in auth, link setup, webhooks, and transfer docs?`
- `ALLOW_DOC_BREAKING=false`

## Notes

- Plaid docs are broad and fast-evolving; prefer focused source+context filters over broad unconstrained queries.
- Keep Link and webhook documentation in the highest-priority watchlist because they are high-blast-radius integration surfaces.
