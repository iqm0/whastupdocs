import assert from "node:assert/strict";
import test from "node:test";

import { buildSlackChangeMessage, sendSlackTestMessage } from "../src/notifications.ts";

test("buildSlackChangeMessage filters low-priority updated events by default", () => {
  process.env.WIUD_SLACK_CHANGE_MIN_SEVERITY = "medium";
  process.env.WIUD_SLACK_CHANGE_INCLUDE_UPDATED = "false";
  process.env.WIUD_SLACK_CHANGE_MAX_EVENTS = "8";

  const message = buildSlackChangeMessage("stripe", [
    {
      source: "stripe",
      title: "General updates",
      canonical_url: "https://docs.stripe.com/api",
      event_type: "updated",
      severity: "low",
      summary: "Generic update",
      details: {},
      detected_at: new Date().toISOString(),
    },
    {
      source: "stripe",
      title: "Payment Intents",
      canonical_url: "https://docs.stripe.com/payments/payment-intents",
      event_type: "breaking_change",
      severity: "critical",
      summary: "Potential breaking behavior change",
      details: {},
      detected_at: new Date().toISOString(),
    },
  ]);

  assert.ok(message);
  assert.match(message ?? "", /breaking_change/);
  assert.doesNotMatch(message ?? "", /General updates/);
});

test("buildSlackChangeMessage returns null when no events pass filters", () => {
  process.env.WIUD_SLACK_CHANGE_MIN_SEVERITY = "high";
  process.env.WIUD_SLACK_CHANGE_INCLUDE_UPDATED = "false";

  const message = buildSlackChangeMessage("openai", [
    {
      source: "openai",
      title: "Docs",
      canonical_url: "https://platform.openai.com/docs",
      event_type: "updated",
      severity: "medium",
      summary: "Minor update",
      details: {},
      detected_at: new Date().toISOString(),
    },
  ]);

  assert.equal(message, null);
});

test("sendSlackTestMessage posts test payload to webhook", async () => {
  let posted = false;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    posted = true;
    const body = JSON.parse(String(init?.body ?? "{}"));
    assert.match(String(body.text ?? ""), /Slack test notification/i);
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  await sendSlackTestMessage({
    webhook_url: "https://hooks.slack.com/services/T000/B000/XXX",
    source: "onboarding",
  });

  assert.equal(posted, true);
});
