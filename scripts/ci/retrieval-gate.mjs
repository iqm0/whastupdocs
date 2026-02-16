#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.WIUD_GATE_BASE_URL;
if (!baseUrl) {
  console.log("retrieval-gate: WIUD_GATE_BASE_URL not set, skipping.");
  process.exit(0);
}

const apiKey = process.env.WIUD_GATE_API_KEY;
const tenantId = process.env.WIUD_GATE_TENANT_ID ?? "default";
const fixturePath = process.env.WIUD_RETRIEVAL_FIXTURES_PATH ?? "scripts/eval/retrieval-fixtures.json";
const minHitAtK = Number(process.env.WIUD_RETRIEVAL_GATE_MIN_HIT_AT_K ?? 0.65);
const minMrr = Number(process.env.WIUD_RETRIEVAL_GATE_MIN_MRR ?? 0.5);

function withHeaders(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");
  headers.set("x-wiud-tenant-id", tenantId);
  if (apiKey) {
    headers.set("authorization", `Bearer ${apiKey}`);
  }
  return { ...init, headers };
}

async function request(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, withHeaders(init));
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`retrieval-gate request failed ${response.status}: ${text}`);
  }
  return response.json();
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function matchesExpectation(item, expected) {
  if (expected.source && item.source !== expected.source) {
    return false;
  }
  if (expected.url_contains && !normalize(item.url).includes(normalize(expected.url_contains))) {
    return false;
  }
  if (expected.title_contains && !normalize(item.title).includes(normalize(expected.title_contains))) {
    return false;
  }
  if (expected.text_contains && !normalize(item.text).includes(normalize(expected.text_contains))) {
    return false;
  }
  return true;
}

async function main() {
  const raw = await readFile(path.resolve(process.cwd(), fixturePath), "utf8");
  const parsed = JSON.parse(raw);
  const fixtures = parsed.fixtures ?? [];

  if (fixtures.length === 0) {
    console.log("retrieval-gate: no fixtures found, skipping.");
    process.exit(0);
  }

  const rows = [];
  for (const fixture of fixtures) {
    const topK = fixture.top_k ?? 10;
    const response = await request("/v1/search", {
      method: "POST",
      body: JSON.stringify({
        query: fixture.query,
        top_k: topK,
        filters: fixture.filters ?? {},
      }),
    });

    const results = response.results ?? [];
    let rank = null;
    for (let index = 0; index < results.length; index += 1) {
      if (matchesExpectation(results[index], fixture.expected ?? {})) {
        rank = index + 1;
        break;
      }
    }

    rows.push({
      id: fixture.id,
      query: fixture.query,
      topK,
      rank,
      hit: rank !== null,
    });
  }

  const total = rows.length;
  const hits = rows.filter((row) => row.hit).length;
  const hitAtK = total > 0 ? hits / total : 0;
  const mrr =
    total > 0
      ? rows.reduce((acc, row) => acc + (row.rank ? 1 / row.rank : 0), 0) / total
      : 0;

  const failures = [];
  if (hitAtK < minHitAtK) {
    failures.push(`hit@k ${hitAtK.toFixed(4)} below threshold ${minHitAtK.toFixed(4)}`);
  }
  if (mrr < minMrr) {
    failures.push(`mrr ${mrr.toFixed(4)} below threshold ${minMrr.toFixed(4)}`);
  }

  console.log(
    JSON.stringify(
      {
        gate: "retrieval-quality",
        total,
        hits,
        hit_at_k: Number(hitAtK.toFixed(4)),
        mrr: Number(mrr.toFixed(4)),
        thresholds: {
          min_hit_at_k: minHitAtK,
          min_mrr: minMrr,
        },
        failed_cases: rows.filter((row) => !row.hit).map((row) => ({ id: row.id, query: row.query })),
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    console.error("retrieval-gate: FAILED");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("retrieval-gate: PASSED");
}

main().catch((error) => {
  console.error(`retrieval-gate: ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
