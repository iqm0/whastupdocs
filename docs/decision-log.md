# what is up, docs - Decision Log

## 2026-02-16 - Reliability-first response contract
Decision:
Adopt a structured `DecisionEnvelope` in answer responses and enforce abstain behavior when evidence is insufficient, stale, or conflicting.

Why:
Trust and correctness matter more than fluent but uncertain output.

Impact:
- Query API now returns explicit decision state and confidence.
- MCP and clients can build deterministic UX around reliability signals.

## 2026-02-16 - Queue-backed ingestion architecture
Decision:
Use `source_sync_request` + BullMQ worker for source sync processing instead of direct inline sync.

Why:
Provides resilience, retry behavior, and operational observability for high-volume source updates.

Impact:
- Sync requests are durable.
- Worker handles crawl + persistence asynchronously.

## 2026-02-16 - Crawler adapter model
Decision:
Use shared crawler core with per-source policy adapters (OpenAI/Next.js/Stripe/React).

Why:
Allows broad source coverage quickly while keeping source-specific controls configurable.

Impact:
- Common URL filtering, retries, and chunking.
- Faster onboarding for additional source packs.

## 2026-02-16 - Change intelligence as first-class data
Decision:
Persist change events (`document_added`, `updated`, `deprecation`, `breaking_change`) in `change_event` table.

Why:
The product should inform decisions and risk, not just answer queries.

Impact:
- New `/v1/changes` API and MCP `list_changes` tool.
- Foundation for CI/PR change gating and alerts.

## 2026-02-16 - Local runtime compatibility baseline
Decision:
Standardize local Postgres mapping on `5433` for this project and keep infra scripts explicit about Docker Compose requirements.

Why:
Avoid conflicts with existing host Postgres and reduce setup ambiguity.

Impact:
- Faster onboarding and fewer local environment failures.

## 2026-02-16 - Market strategy layering (universal + stack + vertical)
Decision:
Position product scope in three layers: universal docs (common stack), company-specific stack connectors, and vertical packs (for example fintech/open banking), instead of building only for one company profile.

Why:
Different customers have distinct documentation surfaces and change risks; Plaid-style needs are a strong wedge but not representative of all developer organizations.

Impact:
- Roadmap now distinguishes platform-engineering stack coverage from vertical specialization.
- Prioritization favors high-churn public ecosystems first, with gated portals later.

## 2026-02-16 - Context-aware retrieval as mandatory reliability control
Decision:
Add first-class context filters (`version`, `region`, `plan`, `deployment_type`, `cloud`, `reference_date`) to search and answer flows.

Why:
Without context constraints, even fresh documentation answers can be wrong for a team's actual environment.

Impact:
- Query API and MCP tool contracts include context filters.
- Retrieval now supports context-aware matching and date scoping.

## 2026-02-16 - Progressive documentation lookup for agents
Decision:
Add a token-efficient MCP preflight entrypoint (`docs_preflight`) and compact response modes for docs tools.

Why:
Agents should not pay retrieval and context costs on every run; they need staged escalation from no lookup to deep research.

Impact:
- Agents can decide lookup depth before calling heavier tools.
- Search/answer/freshness/change tools support compact payloads to reduce token usage.

## 2026-02-16 - Defense-in-depth against prompt injection in docs
Decision:
Apply prompt-injection controls at two layers: sanitize suspicious instruction lines during ingestion and enforce unsafe-content abstention at answer time.

Why:
Documentation content is untrusted input for LLM agents; indexing raw prompt-injection payloads creates an execution-risk path.

Impact:
- Ingestion strips high-risk instruction-like payload lines before chunk persistence.
- Query API flags prompt-injection signals and can return `unsafe_content` decisions for manual review.

## 2026-02-16 - Source-available commercial protection baseline
Decision:
Adopt a community license model that permits personal/educational/non-commercial use but blocks commercial productization without a separate commercial license.

Why:
Protect product moat while keeping the project usable for independent developers and learning.

Impact:
- Repository now has explicit commercial-use restrictions and commercial licensing contact path.
- Future enterprise/commercial packaging can be layered without relicensing ambiguity.

## 2026-02-16 - Cloud API + local MCP deployment model
Decision:
Use a split deployment model: host `query-api` and `ingestion-worker` in cloud (Fly), keep MCP server as local `stdio` client bridge by default.

Why:
It serves both enterprise and individual users: centralized freshness/change intelligence for teams, while preserving lightweight local MCP integration and local-model options (for example Ollama).

Impact:
- Added Fly deployment artifacts and runbook.
- Added release-time migration command in the container runtime.
- Established clear path to later add hosted MCP transport for enterprise-managed clients.

## 2026-02-16 - Dual-mode MCP runtime (stdio + streamable HTTP)
Decision:
Run MCP server in dual mode via config:
- `stdio` default for local developer tooling
- `streamable-http` for hosted enterprise-managed clients

Why:
This keeps local setup friction low while enabling a cloud MCP endpoint for centrally managed org rollouts.

Impact:
- MCP server now supports `WIUD_MCP_TRANSPORT`, `WIUD_MCP_PORT`, and `WIUD_MCP_PATH`.
- Added optional hosted MCP deployment artifacts for Fly.

## 2026-02-16 - Fly deployment baseline region and builder path
Decision:
Use `dfw` as the baseline region for this environment and deploy with Fly remote builder (`--depot=false`) when Depot registry auth paths are unstable.

Why:
`mia` is deprecated for new resources in this account context, and remote builder mode provided stable image build/push in this environment without local Docker daemon.

Impact:
- Live stack deployed successfully on Fly in `dfw`.
- Deployment runbook now aligns with actual platform constraints observed during rollout.

## 2026-02-16 - Competitive posture: reliability workflows over doc chat
Decision:
Position the product moat around reliability workflows (version/context correctness, change detection, and safe action gating), not generic "chat with docs."

Why:
The market for docs chat is crowded and increasingly bundled into incumbent platforms. A standalone product must prove operational risk reduction and engineering time savings.

Impact:
- Added formal risk register with prioritized mitigations.
- Roadmap now includes explicit enterprise-readiness and procurement-grade differentiation work (auth, tenant policy, CI gates, ROI metrics).

## 2026-02-16 - Hosted auth + tenant policy enforcement baseline
Decision:
Enforce optional bearer auth on hosted query API and hosted MCP endpoints, and apply tenant policy controls (source allow/deny, trust thresholds, sync restrictions) at request time.

Why:
Enterprise readiness and controlled rollouts require identity- and tenant-aware governance, not global open access.

Impact:
- Added auth guards and tenant context propagation.
- Added policy-aware filtering in search/answer/sources/changes/sync flows.

## 2026-02-16 - Procurement-facing telemetry and CI risk gating
Decision:
Instrument per-request telemetry and expose tenant summary metrics, plus enforce optional PR gate checks against live change/decision risk signals.

Why:
Winning procurement requires measurable reliability and risk controls, not feature claims.

Impact:
- Added `telemetry_event` data model and `/v1/metrics/summary`.
- Added CI workflow with optional doc-risk gate script for breaking/deprecation and unsafe decision states.

## 2026-02-16 - Section-level change classifier baseline
Decision:
Upgrade change detection from whole-document keyword checks to section-level diff + keyword signals and add fixture-based evaluation loop.

Why:
Whole-document keyword matching creates avoidable false positives and weak explainability.

Impact:
- Change events now include changed-section metadata.
- Added classifier evaluation command and fixtures for regression tracking.

## 2026-02-16 - External review triage and next-step sequence
Decision:
Adopt the external review conclusions as a planning checkpoint and prioritize the next implementation wave in this order:
1) hybrid retrieval quality,
2) source-specific parsing quality,
3) action-oriented change intelligence packaging,
4) ICP wedge packaging (payments/identity first).

Why:
The review correctly identifies that "docs chat" is commoditized; differentiation depends on reliability outcomes and operational workflows. Current platform controls are strong, but retrieval quality remains the biggest technical limiter.

Impact:
- Roadmap updated to reflect completed enterprise controls and CI gates.
- New milestone added for retrieval + wedge depth.
- Journal now explicitly distinguishes solved controls from remaining quality bottlenecks.

## 2026-02-16 - Embeddings architecture for hybrid retrieval
Decision:
Implement semantic retrieval as an optional, provider-agnostic path using normalized embeddings stored in Postgres (`chunk_embedding` as JSON vectors), then fuse cosine similarity with lexical/FTS/intent scores at query time.

Why:
This delivers immediate semantic lift without requiring pgvector extension operations, while supporting both hosted OpenAI embeddings and local Ollama setups.

Impact:
- Ingestion can generate chunk embeddings when enabled.
- Query API can score candidate chunks semantically and rerank with hybrid fusion.
- Retrieval path remains fail-open to lexical ranking when embeddings are disabled/unavailable.

## 2026-02-16 - Retrieval evaluation baseline as fixture-driven harness
Decision:
Add a fixture-driven retrieval evaluator (`eval:retrieval`) that runs query cases against the live index and reports hit@k + MRR with explicit failed scenarios.

Why:
Retrieval quality must be measured continuously, especially for developer-phrase vs docs-phrase mismatch where relevance regressions are easy to miss.

Impact:
- Added shared retrieval fixtures and scoring script.
- Established baseline metrics for ranking changes and parser updates.

## 2026-02-16 - Source-specific denoising before chunking
Decision:
Add source-level HTML and line noise filtering rules in crawler adapters to strip navigation/boilerplate and reduce junk chunks before indexing.

Why:
Generic extraction works but includes high-volume UI chrome on JS-heavy docs sites, which harms retrieval precision and increases false positives.

Impact:
- Crawler now supports `htmlNoisePatterns` and `lineNoisePatterns`.
- OpenAI/Next.js/Stripe/React adapters now apply targeted denoising policies.

## 2026-02-16 - Actionable change-event payloads
Decision:
Attach deterministic `recommended_actions` to each `change_event` response (API and MCP) based on event type, severity, and changed section metadata.

Why:
Teams need immediate migration/mitigation next steps, not only event labels.

Impact:
- `/v1/changes` now returns prescriptive action guidance per event.
- MCP `list_changes` compact mode now surfaces top action hints for agent workflows.

## 2026-02-16 - Retrieval quality regression gate in CI
Decision:
Add a fixture-based retrieval gate (`scripts/ci/retrieval-gate.mjs`) to CI that checks hit@k and MRR against configurable thresholds on the deployed API.

Why:
Without explicit quality thresholds, retrieval regressions can pass build/test and degrade answer reliability silently.

Impact:
- CI now supports a `retrieval-quality-gate` job.
- Teams can enforce measurable retrieval quality before merge.

## 2026-02-16 - Slack webhook alerts from ingestion worker
Decision:
Send batched Slack alerts for newly detected change events directly from ingestion runs, with severity and event-type filters.

Why:
Change intelligence only matters when teams see it in operational channels fast enough to act.

Impact:
- Optional Slack notifications are now available without adding a separate service.
- Alert noise is constrained via min severity, include-updated toggle, and max event limits.

## 2026-02-16 - Slack onboarding verification endpoint and CLI
Decision:
Provide two explicit test-notification entrypoints:
1) `POST /v1/alerts/slack/test` (auth-protected API),
2) `npm run slack:test` (operator CLI via ingestion-worker).

Why:
Slack integrations need a fast, deterministic way to verify webhook delivery during onboarding and incident debugging.

Impact:
- Teams can validate webhook wiring without waiting for real change events.
- Webhook override in API is disabled by default and requires `WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE=true`.

## 2026-02-16 - Slack runtime integration model
Decision:
Implement Slack runtime with two signature-verified webhook endpoints:
1) `/v1/slack/commands` for slash commands,
2) `/v1/slack/events` for app mention/event callbacks.

Why:
Change alerts alone are one-way. Teams also need direct Slack request->answer workflows with trust controls.

Impact:
- Slack requests are validated with `WIUD_SLACK_SIGNING_SECRET`.
- Slash commands support help/search/changes/default answer flows.
- App mentions can reply in-thread when `WIUD_SLACK_BOT_TOKEN` is configured.

## 2026-02-16 - Governance observability via tenant-scoped exports
Decision:
Add governance endpoints for audit export and policy observability:
- `GET /v1/audit/export`
- `GET /v1/policy/observability`

Why:
Enterprise buyers require evidence of policy effectiveness and traceable runtime behavior.

Impact:
- Telemetry can now be exported in JSON or NDJSON for compliance and BI workflows.
- Policy observability snapshot reports effective source coverage and risk indicators.

## 2026-02-16 - First ICP pack publication (payments + identity)
Decision:
Publish an opinionated pack artifact and playbook for payments/identity workflows as the first ICP execution pack.

Why:
Positioning needs concrete deployable defaults, not only roadmap language.

Impact:
- Added `config/packs/payments-identity.json`.
- Added implementation playbook in `docs/packs/payments-identity.md`.

## 2026-02-16 - Plaid docs mapping as fintech expansion baseline
Decision:
Add Plaid as a first-class source adapter and publish a curated Plaid docs coverage map for high-volume fintech integration paths.

Why:
Fintech teams need broad product and API coverage across Link, Auth, Transactions, and payment-related workflows, with explicit change-monitoring focus.

Impact:
- Added `plaid` source adapter and registry seeds.
- Added `docs/packs/plaid-finance-map.md` for product topology and integration workflows.
- Updated payments/identity pack defaults to include Plaid.

## 2026-02-16 - Conditional-fetch ingestion + structure-aware chunk persistence
Decision:
Upgrade crawler ingestion to:
1) use conditional HTTP requests (`If-None-Match` / `If-Modified-Since`) with document-level fetch metadata,
2) persist structure-aware chunk metadata (`heading_path`, `code_lang`) and preserve code fences from source HTML,
3) improve retrieval answerability with generic query expansion and concise evidence synthesis.

Why:
Large doc surfaces change unevenly; re-fetching/re-chunking unchanged pages wastes cost and time. LLM and agent reliability also depends on chunk structure quality and instruction-rich evidence selection, not raw schema blobs.

Impact:
- Added migration `db/migrations/0006_document_fetch_metadata.sql`.
- Ingestion worker now stores and reuses document fetch metadata (`etag`, `last-modified`, status, checked_at) and tracks `304` not-modified pages.
- Chunk persistence now writes `heading_path` and `code_lang` into `chunk`.
- Query API retrieval now includes provider-agnostic query expansion and improved concise answer composition from high-signal lines.
