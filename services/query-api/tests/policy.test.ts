import assert from "node:assert/strict";
import test from "node:test";

import { applySourcePolicy, canSyncSource } from "../src/lib/policy.js";

test("applySourcePolicy enforces allow and deny lists", () => {
  const policy = {
    allow_sources: ["openai", "stripe"],
    deny_sources: ["stripe"],
  };

  const result = applySourcePolicy(["openai", "stripe", "nextjs"], policy);
  assert.deepEqual(result, ["openai"]);
});

test("canSyncSource honors sync_allowed_sources when present", () => {
  const policy = {
    sync_allowed_sources: ["openai"],
    deny_sources: ["openai"],
  };

  assert.equal(canSyncSource("openai", policy), true);
  assert.equal(canSyncSource("stripe", policy), false);
});
