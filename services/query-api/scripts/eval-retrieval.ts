import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closeDbPool, getDbPool } from "../src/lib/db.js";
import { searchDocsWithPolicy } from "../src/lib/docs-service.js";

type FixtureExpectation = {
  source?: string;
  url_contains?: string;
  title_contains?: string;
  text_contains?: string;
};

type RetrievalFixture = {
  id: string;
  query: string;
  top_k?: number;
  filters?: {
    sources?: string[];
    version?: string;
    region?: string;
    plan?: string;
    deployment_type?: string;
    cloud?: string;
    reference_date?: string;
  };
  expected: FixtureExpectation;
};

type FixtureFile = {
  fixtures: RetrievalFixture[];
};

function normalize(value: string): string {
  return value.toLowerCase();
}

function matchesExpectation(
  item: {
    source: string;
    url: string;
    title: string;
    text: string;
  },
  expected: FixtureExpectation,
): boolean {
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

async function loadFixtures(): Promise<RetrievalFixture[]> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultPath = path.resolve(scriptDir, "../../../scripts/eval/retrieval-fixtures.json");
  const fixturePath = process.env.WIUD_RETRIEVAL_FIXTURES_PATH ?? defaultPath;
  const raw = await readFile(fixturePath, "utf8");
  const parsed = JSON.parse(raw) as FixtureFile;
  return parsed.fixtures ?? [];
}

async function main(): Promise<void> {
  const fixtures = await loadFixtures();
  if (fixtures.length === 0) {
    process.stdout.write("No retrieval fixtures found.\n");
    return;
  }

  const db = getDbPool();
  const rows: Array<{
    id: string;
    query: string;
    hit: boolean;
    rank: number | null;
    topK: number;
  }> = [];

  for (const fixture of fixtures) {
    const topK = fixture.top_k ?? 10;
    const response = await searchDocsWithPolicy(
      db,
      {
        query: fixture.query,
        top_k: topK,
        filters: fixture.filters,
      },
      {},
    );

    let rank: number | null = null;
    for (let index = 0; index < response.results.length; index += 1) {
      const item = response.results[index]!;
      if (matchesExpectation(item, fixture.expected)) {
        rank = index + 1;
        break;
      }
    }

    rows.push({
      id: fixture.id,
      query: fixture.query,
      hit: rank !== null,
      rank,
      topK,
    });
  }

  const total = rows.length;
  const hits = rows.filter((row) => row.hit).length;
  const hitAtK = total > 0 ? hits / total : 0;
  const mrr =
    total > 0
      ? rows.reduce((acc, row) => acc + (row.rank ? 1 / row.rank : 0), 0) / total
      : 0;

  const output = {
    generated_at: new Date().toISOString(),
    total,
    hits,
    hit_at_k: Number(hitAtK.toFixed(4)),
    mrr: Number(mrr.toFixed(4)),
    failures: rows
      .filter((row) => !row.hit)
      .map((row) => ({ id: row.id, query: row.query, top_k: row.topK })),
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  await closeDbPool();
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`retrieval_eval_failed: ${message}\n`);
  await closeDbPool();
  process.exit(1);
});
