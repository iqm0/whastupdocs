import assert from "node:assert/strict";
import test from "node:test";

import { detectDocumentChangeEvents } from "../src/store.ts";

test("detectDocumentChangeEvents promotes new breaking language to critical event", () => {
  const previous = `
## Limits
This endpoint is available.
`;
  const next = `
## Limits
This endpoint is no longer supported for API v1.
`;

  const events = detectDocumentChangeEvents(previous, next, "API Guide");
  assert.equal(events[0]?.event_type, "breaking_change");
  assert.equal(events[0]?.severity, "critical");
});

test("detectDocumentChangeEvents detects deprecation when introduced in changed section", () => {
  const previous = `
## Authentication
Use OAuth 2.0.
`;
  const next = `
## Authentication
Use OAuth 2.0. This method is deprecated and will be removed.
`;

  const events = detectDocumentChangeEvents(previous, next, "Auth Guide");
  assert.equal(events[0]?.event_type, "deprecation");
});

test("detectDocumentChangeEvents marks generic content changes as updated", () => {
  const previous = `
## Intro
Welcome to API docs.
`;
  const next = `
## Intro
Welcome to the API docs for v2.
`;

  const events = detectDocumentChangeEvents(previous, next, "Intro");
  assert.equal(events[0]?.event_type, "updated");
  assert.equal(events[0]?.severity, "low");
});
