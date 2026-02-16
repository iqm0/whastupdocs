import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

test("health allows anonymous requests when WIUD_API_KEYS is not configured", async () => {
  const previous = process.env.WIUD_API_KEYS;
  delete process.env.WIUD_API_KEYS;

  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  await app.close();
  process.env.WIUD_API_KEYS = previous;

  assert.equal(response.statusCode, 200);
});

test("health rejects requests without bearer token when WIUD_API_KEYS is configured", async () => {
  const previous = process.env.WIUD_API_KEYS;
  process.env.WIUD_API_KEYS = "test-key-1,test-key-2";

  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  await app.close();
  process.env.WIUD_API_KEYS = previous;

  assert.equal(response.statusCode, 401);
});

test("health accepts valid bearer token when WIUD_API_KEYS is configured", async () => {
  const previous = process.env.WIUD_API_KEYS;
  process.env.WIUD_API_KEYS = "test-key-1,test-key-2";

  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/health",
    headers: {
      authorization: "Bearer test-key-2",
    },
  });

  await app.close();
  process.env.WIUD_API_KEYS = previous;

  assert.equal(response.statusCode, 200);
});

test("health accepts x-api-key header when WIUD_API_KEYS is configured", async () => {
  const prev = process.env.WIUD_API_KEYS;
  process.env.WIUD_API_KEYS = "abc";
  const app = await buildApp({ logger: false });
  const response = await app.inject({
    method: "GET",
    url: "/health",
    headers: {
      "x-api-key": "abc",
    },
  });
  await app.close();
  process.env.WIUD_API_KEYS = prev;
  assert.equal(response.statusCode, 200);
});

test("production mode fails closed without api keys unless WIUD_ALLOW_ANONYMOUS=true", async () => {
  const previousKeys = process.env.WIUD_API_KEYS;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllowAnon = process.env.WIUD_ALLOW_ANONYMOUS;
  delete process.env.WIUD_API_KEYS;
  process.env.NODE_ENV = "production";
  delete process.env.WIUD_ALLOW_ANONYMOUS;

  const app = await buildApp({ logger: false });
  const blocked = await app.inject({
    method: "GET",
    url: "/health",
  });

  process.env.WIUD_ALLOW_ANONYMOUS = "true";
  const allowed = await app.inject({
    method: "GET",
    url: "/health",
  });

  await app.close();
  process.env.WIUD_API_KEYS = previousKeys;
  process.env.NODE_ENV = previousNodeEnv;
  process.env.WIUD_ALLOW_ANONYMOUS = previousAllowAnon;

  assert.equal(blocked.statusCode, 401);
  assert.equal(allowed.statusCode, 200);
});
