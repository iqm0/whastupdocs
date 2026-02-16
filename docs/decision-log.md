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
