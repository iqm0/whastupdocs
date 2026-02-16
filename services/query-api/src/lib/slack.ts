function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return parsed.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

function resolveWebhookUrl(override?: string): string {
  const defaultWebhook = process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL?.trim();
  const allowOverride = process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE === "true";

  if (override) {
    if (!allowOverride) {
      throw new Error("webhook_override_not_allowed");
    }
    if (!isAllowedWebhookUrl(override)) {
      throw new Error("invalid_webhook_url");
    }
    return override;
  }

  if (!defaultWebhook) {
    throw new Error("slack_webhook_not_configured");
  }

  if (!isAllowedWebhookUrl(defaultWebhook)) {
    throw new Error("invalid_default_webhook_url");
  }

  return defaultWebhook;
}

export async function sendSlackTestNotification(input: {
  webhook_url?: string;
  source?: string;
  message?: string;
  actor?: string;
}): Promise<{ ok: true; webhook_target: "default" | "override"; sent_at: string }> {
  const webhook = resolveWebhookUrl(input.webhook_url);
  const source = input.source?.trim() || "manual";
  const actor = input.actor?.trim() || "system";
  const text =
    input.message?.trim() ||
    [
      "*what is up, docs* Slack test notification",
      `source: \`${source}\``,
      `actor: \`${actor}\``,
      "status: onboarding webhook verified",
    ].join("\n");

  const response = await fetch(webhook, {
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

  return {
    ok: true,
    webhook_target: input.webhook_url ? "override" : "default",
    sent_at: new Date().toISOString(),
  };
}
