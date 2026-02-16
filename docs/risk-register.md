# what is up, docs - Risk Register

Last updated: 2026-02-16

## Summary

The external analysis is directionally correct: "chat with docs" is commoditized.
Our defensible wedge is:

1. Version-aware + context-aware reliability controls by default.
2. Change intelligence that blocks risky actions before merge/deploy.
3. Enterprise-safe connector model (permissions, audit, tenant isolation).

## Priority Risks and Actions

## R1: Product becomes a feature in incumbent suites
Severity: Critical  
Likelihood: High  

Why it matters:
- Docs platforms, search vendors, and bundled work suites already ship "ask docs" experiences.

Actions:
- Make "safe execution" the core value, not "chat": policy-aware decision envelope + CI gates.
- Ship PR/CI checks for deprecations and breaking changes as first workflow moat.
- Publish outcome metrics (incident avoidance, integration lead-time reduction).

Status:
- Partially mitigated (decision envelope + change events live).
- Pending CI enforcement and metrics dashboard.

## R2: Connectors/MCP become commodity
Severity: High  
Likelihood: High  

Why it matters:
- Integration breadth alone is easy to copy.

Actions:
- Differentiate on reliability logic and workflow outcomes:
  - context-aware retrieval constraints
  - temporal/version conflict handling
  - action gating for unsafe/stale/conflicting evidence
- Keep MCP tools token-efficient (`docs_preflight`, compact mode) to improve real agent performance.

Status:
- Mitigation active; continue improving precision and workflow integrations.

## R3: Licensing/legal exposure for third-party docs
Severity: High  
Likelihood: Medium  

Why it matters:
- Gated docs and proprietary support portals have strict terms and access controls.

Actions:
- Build connector policy model:
  - customer-owned credentials
  - per-source legal mode (public crawl vs authenticated retrieval)
  - audit trace for retrieval events
- Maintain blocked-source list where terms disallow ingestion.

Status:
- Not implemented yet (requirements defined only).

## R4: Security and governance gaps block enterprise sales
Severity: Critical  
Likelihood: High  

Why it matters:
- Enterprise procurement requires tenant isolation, access controls, and auditability.

Actions:
- Add tenant identity layer and tenant-scoped source policies.
- Add authentication for hosted query API and hosted MCP endpoints.
- Add audit event store for retrieval calls and policy decisions.

Status:
- Core mitigations implemented (hosted auth, tenant policy controls, rate limiting, IP allowlists).
- Remaining gap: audit export workflows and enterprise-facing governance reporting.

## R5: Accuracy/trust failures from stale or wrong-context answers
Severity: Critical  
Likelihood: Medium  

Why it matters:
- Single confident-but-wrong answer can create production incidents.

Actions:
- Keep abstention-first defaults for stale/insufficient/unsafe/conflicting evidence.
- Improve diff precision (section-level semantic diff, not only keyword heuristics).
- Add evaluation harness for false positives/false negatives across key providers.

Status:
- Partial mitigation active; precision/eval backlog open.

## R6: Unit economics pressure from indexing + LLM + agent loops
Severity: High  
Likelihood: Medium  

Why it matters:
- Competing against subsidized bundles requires disciplined cost control.

Actions:
- Keep progressive lookup path default (`docs_preflight` before deep calls).
- Add response caching and source-level refresh budgets.
- Track cost per grounded answer and per avoided incident workflow.

Status:
- Partial mitigation via compact/progressive tooling; cost analytics pending.

## R7: Procurement gravity favors existing approved suites
Severity: High  
Likelihood: High  

Why it matters:
- Security/IT approval cycles can outlast engineering enthusiasm.

Actions:
- Prioritize "coexistence" deployment model:
  - cloud backend for teams
  - local model + MCP option for privacy-sensitive developers
- Add enterprise controls before broad GTM (auth, audit, tenant policy).
- Prepare security architecture and data handling docs early.

Status:
- Deployment flexibility exists and enterprise baseline controls are active.
- Remaining work: procurement-facing governance docs and connector compliance packs.

## Immediate Next Actions (Execution Order)

1. Add IDE extension integration with compact-first docs lookup strategy.
2. Add false-positive/false-negative tracking loop for change classifier quality.
3. Define legal connector policy templates for public, authenticated, and restricted sources.
4. Expand source parser rules to additional high-churn provider packs.
5. Add procurement-ready governance dashboards on top of audit export feeds.
