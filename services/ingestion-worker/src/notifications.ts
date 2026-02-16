import type { Pool } from "pg";

type Severity = "low" | "medium" | "high" | "critical";
type EventType = "document_added" | "updated" | "deprecation" | "breaking_change";

type ChangeEvent = {
  source: string;
  title: string;
  canonical_url: string;
  event_type: EventType;
  severity: Severity;
  summary: string;
  details: Record<string, unknown>;
  detected_at: string;
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseSeverity(value: string | undefined): Severity {
  const normalized = (value ?? "medium").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "critical") {
    return normalized;
  }
  return "medium";
}

function buildRecommendedActions(event: ChangeEvent): string[] {
  const actions: string[] = [];

  if (event.event_type === "breaking_change") {
    actions.push("Open migration task and block deploy until compatibility checks pass.");
    actions.push("Run integration tests against affected API paths.");
  } else if (event.event_type === "deprecation") {
    actions.push("Create deprecation remediation ticket and assign owner.");
    actions.push("Identify deprecated usage and schedule replacement changes.");
  } else if (event.event_type === "updated") {
    actions.push("Review updated docs and validate impacted runbooks.");
  } else {
    actions.push("Review newly added docs and update internal integration notes.");
  }

  if (event.severity === "high" || event.severity === "critical") {
    actions.push("Escalate to platform owner for pre-merge review.");
  }

  return actions;
}

function selectAlertEvents(events: ChangeEvent[]): ChangeEvent[] {
  const minSeverity = parseSeverity(process.env.WIUD_SLACK_CHANGE_MIN_SEVERITY);
  const includeUpdated = parseBoolean(process.env.WIUD_SLACK_CHANGE_INCLUDE_UPDATED, false);
  const maxEvents = Math.max(1, Number(process.env.WIUD_SLACK_CHANGE_MAX_EVENTS ?? 8));

  const filtered = events.filter((event) => {
    if (SEVERITY_WEIGHT[event.severity] < SEVERITY_WEIGHT[minSeverity]) {
      return false;
    }
    if (!includeUpdated && (event.event_type === "updated" || event.event_type === "document_added")) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const severityDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return Date.parse(b.detected_at) - Date.parse(a.detected_at);
  });

  return filtered.slice(0, maxEvents);
}

export function buildSlackChangeMessage(source: string, events: ChangeEvent[]): string | null {
  const selected = selectAlertEvents(events);
  if (selected.length === 0) {
    return null;
  }

  const header = `*what is up, docs* change alert for \`${source}\` (${selected.length} event${selected.length === 1 ? "" : "s"})`;
  const lines: string[] = [header];

  for (const event of selected) {
    const actions = buildRecommendedActions(event);
    lines.push(
      `• [${event.severity.toUpperCase()}] ${event.event_type} - ${event.title}`,
      `  ${event.summary}`,
      `  Action: ${actions[0]}`,
      `  ${event.canonical_url}`,
    );
  }

  return lines.join("\n");
}

export async function postSlackText(webhookUrl: string, text: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`slack_webhook_failed status=${response.status} body=${body}`);
  }
}

export async function sendSlackTestMessage(input?: {
  webhook_url?: string;
  source?: string;
  actor?: string;
  message?: string;
}): Promise<void> {
  const webhook = input?.webhook_url ?? process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL;
  if (!webhook) {
    throw new Error("slack_webhook_not_configured");
  }

  const text =
    input?.message?.trim() ||
    [
      "*what is up, docs* Slack test notification",
      `source: \`${input?.source?.trim() || "manual"}\``,
      `actor: \`${input?.actor?.trim() || "operator"}\``,
      "status: onboarding webhook verified",
    ].join("\n");

  await postSlackText(webhook, text);
}

export async function notifySlackChanges(
  db: Pool,
  source: string,
  detectedAt: string,
): Promise<void> {
  const webhook = process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL;
  if (!webhook) {
    return;
  }

  const result = await db.query(
    `
      SELECT source_id, title, canonical_url, event_type, severity, summary, details, detected_at
      FROM change_event
      WHERE source_id = $1
        AND detected_at = $2::timestamptz
      ORDER BY detected_at DESC
    `,
    [source, detectedAt],
  );

  if (result.rows.length === 0) {
    return;
  }

  const events: ChangeEvent[] = result.rows.map((row) => ({
    source: String(row.source_id),
    title: String(row.title),
    canonical_url: String(row.canonical_url),
    event_type: row.event_type as EventType,
    severity: row.severity as Severity,
    summary: String(row.summary),
    details: (row.details ?? {}) as Record<string, unknown>,
    detected_at: new Date(row.detected_at).toISOString(),
  }));

  const text = buildSlackChangeMessage(source, events);
  if (!text) {
    return;
  }

  await postSlackText(webhook, text);
}
