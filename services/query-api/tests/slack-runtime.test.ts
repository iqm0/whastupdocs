import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";

import { handleSlackCommand, handleSlackEvent, verifySlackRequest } from "../src/lib/slack-runtime.js";

function sign(secret: string, timestamp: number, rawBody: string): string {
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac("sha256", secret).update(base).digest("hex");
  return `v0=${digest}`;
}

function fakeDb(): Pool {
  return {
    query: async () => {
      throw new Error("db_not_expected");
    },
  } as unknown as Pool;
}

test("verifySlackRequest accepts valid signature", () => {
  const secret = "test-secret";
  const rawBody = "token=a&text=help";
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(secret, timestamp, rawBody);

  const valid = verifySlackRequest({
    signingSecret: secret,
    timestampHeader: String(timestamp),
    signatureHeader: signature,
    rawBody,
  });

  assert.equal(valid, true);
});

test("verifySlackRequest rejects stale timestamps", () => {
  const secret = "test-secret";
  const rawBody = "token=a&text=help";
  const timestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
  const signature = sign(secret, timestamp, rawBody);

  const valid = verifySlackRequest({
    signingSecret: secret,
    timestampHeader: String(timestamp),
    signatureHeader: signature,
    rawBody,
  });

  assert.equal(valid, false);
});

test("handleSlackCommand returns help text without db calls", async () => {
  const result = await handleSlackCommand({
    db: fakeDb(),
    rawBody: "command=%2Fwiud&text=help",
    policy: {},
  });

  assert.equal(result.deferred, undefined);
  assert.match(String(result.immediate.text ?? ""), /what is up, docs Slack commands/i);
});

test("handleSlackEvent returns challenge for url verification", async () => {
  const result = await handleSlackEvent({
    db: fakeDb(),
    rawBody: JSON.stringify({
      type: "url_verification",
      challenge: "abc123",
    }),
    policy: {},
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.challenge, "abc123");
});
