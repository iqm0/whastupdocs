import assert from "node:assert/strict";
import test from "node:test";

import { getSourceAdapter } from "../src/adapters/index.ts";

test("adapter registry exposes all configured source adapters", () => {
  assert.equal(typeof getSourceAdapter("openai"), "function");
  assert.equal(typeof getSourceAdapter("nextjs"), "function");
  assert.equal(typeof getSourceAdapter("stripe"), "function");
  assert.equal(typeof getSourceAdapter("react"), "function");
  assert.equal(getSourceAdapter("unknown"), undefined);
});
