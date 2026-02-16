import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

test("slack test alert sends notification using configured webhook", async () => {
  const prevKeys = process.env.WIUD_API_KEYS;
  const prevWebhook = process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL;
  const prevAllowOverride = process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE;
  const prevEnableAlerts = process.env.WIUD_ENABLE_ALERTS_API;
  process.env.WIUD_API_KEYS = "test-key";
  process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/XXX";
  process.env.WIUD_ENABLE_ALERTS_API = "true";
  delete process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE;

  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "POST",
    url: "/v1/alerts/slack/test",
    headers: {
      authorization: "Bearer test-key",
    },
    payload: {
      source: "onboarding",
    },
  });

  await app.close();
  process.env.WIUD_API_KEYS = prevKeys;
  process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL = prevWebhook;
  process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE = prevAllowOverride;
  process.env.WIUD_ENABLE_ALERTS_API = prevEnableAlerts;

  assert.equal(response.statusCode, 202);
  assert.equal(called, true);
});

test("slack test alert blocks webhook override unless enabled", async () => {
  const prevKeys = process.env.WIUD_API_KEYS;
  const prevWebhook = process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL;
  const prevAllowOverride = process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE;
  const prevEnableAlerts = process.env.WIUD_ENABLE_ALERTS_API;
  process.env.WIUD_API_KEYS = "test-key";
  process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/XXX";
  process.env.WIUD_ENABLE_ALERTS_API = "true";
  delete process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE;

  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "POST",
    url: "/v1/alerts/slack/test",
    headers: {
      authorization: "Bearer test-key",
    },
    payload: {
      webhook_url: "https://hooks.slack.com/services/T111/B111/YYY",
    },
  });

  await app.close();
  process.env.WIUD_API_KEYS = prevKeys;
  process.env.WIUD_SLACK_CHANGE_WEBHOOK_URL = prevWebhook;
  process.env.WIUD_ALLOW_TEST_WEBHOOK_OVERRIDE = prevAllowOverride;
  process.env.WIUD_ENABLE_ALERTS_API = prevEnableAlerts;

  assert.equal(response.statusCode, 403);
  assert.equal(called, false);
});
