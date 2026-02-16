# what is up, docs - Roadmap

Last updated: 2026-02-16

## Milestone 1: Foundation and Contracts
Status: Completed

- [x] Define product architecture and implementation plan
- [x] Define OpenAPI contract for search, answer, sources, sync
- [x] Create initial Postgres schema and migrations
- [x] Scaffold MCP server with core tools

## Milestone 2: Local Runtime and Developer Workflow
Status: Completed

- [x] Add workspace scripts and service scaffolding
- [x] Add local infra setup (Postgres, Redis, OpenSearch)
- [x] Add migration runner and bootstrap docs
- [x] Add unit/integration-style tests for MCP handlers

## Milestone 3: Ingestion and Source Coverage
Status: In Progress

- [x] Implement queue-backed source sync flow
- [x] Build crawler-based ingestion adapter framework
- [x] Add adapters for OpenAI, Next.js, Stripe, React
- [x] Persist documents/chunks to Postgres
- [x] Add conditional HTTP fetch support (ETag/Last-Modified + 304 short-circuit)
- [x] Persist structured chunk metadata (`heading_path`, `code_lang`) for retrieval
- [ ] Add robust per-source parsing rules (beyond generic HTML extraction)
- [ ] Add retry budgets, circuit breakers, and source-specific backoff policy

## Milestone 4: Reliability Layer
Status: In Progress

- [x] Add decision envelope to answers
- [x] Enforce abstention on insufficient/stale/conflicting evidence
- [x] Add change_event data model and write path during ingestion
- [x] Add /v1/changes API and MCP list_changes tool
- [x] Add context-aware query filters (version/region/plan/deployment/cloud/date)
- [x] Add prompt-injection sanitization during ingestion
- [x] Add answer-time unsafe content detection and policy abstention
- [x] Improve change classification precision with section-level semantic diffing
- [ ] Add false-positive/false-negative tracking loop

## Milestone 5: Workflow Integrations
Status: In Progress

- [x] PR/CI doc drift checks
- [x] Slack webhook alerts for change events
- [x] Slack onboarding test endpoint and operator CLI
- [x] Slack runtime integration
- [ ] IDE extension integration
- [x] Unified reliability metrics dashboard

## Milestone 9: Packaging and Deployment
Status: In Progress

- [x] Add Fly.io deployment artifacts for `query-api`
- [x] Add Fly.io deployment artifacts for `ingestion-worker`
- [x] Add container-safe database migration command for release phase
- [x] Add hosted MCP transport option (HTTP/SSE) for enterprise-managed clients

## Milestone 7: GTM Wedge Execution
Status: In Progress

- [x] Prioritize public high-churn docs first (cloud-native + major API ecosystems)
- [x] Treat Plaid/fintech as a vertical pack, not product-wide assumption
- [ ] Add provider packs for platform engineering stack (AWS/K8s/Terraform/observability)
- [x] Add first API ecosystem pack with context rules (payments + identity)
- [ ] Define gated-doc connector requirements (Oracle/SAP-style auth and audit)

## Milestone 6: Enterprise and Multi-Tenant Controls
Status: In Progress

- [x] Tenant-aware source policies
- [x] Staleness and trust thresholds per org
- [x] Source allow/deny governance
- [x] Audit exports and policy observability

## Milestone 8: Licensing and Governance
Status: In Progress

- [x] Define community license for non-commercial and learning use
- [x] Restrict commercial productization without commercial license
- [ ] Publish commercial licensing terms and intake workflow

## Milestone 10: Competitive Moat and Enterprise Readiness
Status: Completed

- [x] Create formal competitive risk register and mitigation plan
- [x] Add auth for hosted query API and hosted MCP endpoints
- [x] Add tenant-aware policy primitives (source allow/deny, trust thresholds)
- [x] Add CI/PR gates for deprecation and breaking-change detection
- [x] Add reliability/cost outcome metrics for procurement-grade ROI proof

## Milestone 11: Retrieval and Wedge Depth
Status: In Progress

- [x] Implement first hybrid retrieval layer (ILIKE + Postgres full-text + intent reranking)
- [x] Add semantic embeddings retrieval path and fuse with lexical candidates
- [x] Add retrieval quality evaluation set (developer-phrase vs doc-phrase mismatch)
- [x] Add source-specific parsing upgrades for JS-heavy and noisy docs sites
- [x] Package change events into prescriptive migration/action recommendations
- [x] Publish ICP-specific wedge pack (payments/identity first) with opinionated defaults
- [x] Add generic query expansion and concise answer synthesis for intent-rich grounding
- [x] Add section-intent ranking + action-step extraction and enforce rank-target eval fixtures
