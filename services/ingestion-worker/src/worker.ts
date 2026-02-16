import { Worker, type Job } from "bullmq";

import { getSourceAdapter } from "./adapters/index.js";
import type { IngestRunResult } from "./adapters/types.js";
import { closeDbPool, getDbPool } from "./db.js";
import { newId } from "./id.js";
import { loadSourceRegistry } from "./registry.js";
import type { SourceRegistryEntry } from "./registry.js";
import { persistIngestRun } from "./store.js";
import type { SourceSyncJob } from "./types.js";

const SOURCE_SYNC_QUEUE = "source-sync";
const PARSER_VERSION = "ingestion-worker@0.3.0";

function nowIso(): string {
  return new Date().toISOString();
}

function getRedisConnectionOptions(): { host: string; port: number; password?: string } {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

async function upsertSource(sourceId: string, sourceConfig?: SourceRegistryEntry): Promise<void> {
  const db = getDbPool();
  await db.query(
    `
      INSERT INTO source (id, name, kind, base_url, status, trust_score, poll_interval_minutes, updated_at)
      VALUES ($1, $2, $3, $4, 'active', $5, $6, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        base_url = EXCLUDED.base_url,
        trust_score = EXCLUDED.trust_score,
        poll_interval_minutes = EXCLUDED.poll_interval_minutes,
        updated_at = NOW()
    `,
    [
      sourceId,
      sourceConfig?.name ?? sourceId,
      sourceConfig?.kind ?? "docs",
      sourceConfig?.base_url ?? `https://docs.example.com/${sourceId}`,
      sourceConfig?.trust_score ?? 1.0,
      sourceConfig?.poll_interval_minutes ?? 60,
    ],
  );
}

function summarizeRawRef(run: IngestRunResult, requestId: string): string {
  if (run.fetched_urls.length > 0) {
    return run.fetched_urls.slice(0, 8).join(",");
  }

  return `queue://source-sync/${requestId}`;
}

async function runSourceAdapter(
  source: string,
  sourceConfig?: SourceRegistryEntry,
): Promise<IngestRunResult> {
  const adapter = getSourceAdapter(source);

  if (!adapter || !sourceConfig) {
    return {
      source,
      status: "partial",
      documents: [],
      fetched_urls: [],
      failed_urls: [],
      errors: ["adapter_not_configured"],
    };
  }

  return adapter(sourceConfig);
}

async function processSourceSync(
  job: Job<SourceSyncJob>,
  sourceRegistry: Map<string, SourceRegistryEntry>,
): Promise<void> {
  const db = getDbPool();
  const { request_id: requestId, source } = job.data;
  const sourceConfig = sourceRegistry.get(source);

  await db.query(
    `
      UPDATE source_sync_request
      SET status = 'processing', processed_at = NULL, error = NULL
      WHERE id = $1
    `,
    [requestId],
  );

  try {
    await upsertSource(source, sourceConfig);

    const run = await runSourceAdapter(source, sourceConfig);
    const ingestedAt = nowIso();

    const stats = await persistIngestRun(db, source, run, ingestedAt);

    const snapshotStatus =
      run.status === "failed" ? "failed" : run.status === "partial" ? "partial" : "success";
    const errorMessage = run.errors.length > 0 ? run.errors.slice(0, 10).join(" | ") : null;

    await db.query(
      `
        INSERT INTO snapshot (id, source_id, fetched_at, raw_blob_ref, parser_version, status, error)
        VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7)
      `,
      [
        newId("snap"),
        source,
        ingestedAt,
        summarizeRawRef(run, requestId),
        PARSER_VERSION,
        snapshotStatus,
        errorMessage,
      ],
    );

    await db.query(
      `
        UPDATE source_sync_request
        SET status = $2, processed_at = $3::timestamptz, error = $4
        WHERE id = $1
      `,
      [requestId, snapshotStatus === "failed" ? "failed" : "completed", ingestedAt, errorMessage],
    );

    process.stdout.write(
      `source=${source} docs_inserted=${stats.inserted_documents} docs_updated=${stats.updated_documents} chunks_inserted=${stats.inserted_chunks} change_events=${stats.change_events} status=${snapshotStatus}\n`,
    );

    if (snapshotStatus === "failed") {
      throw new Error(errorMessage ?? "ingestion_failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query(
      `
        UPDATE source_sync_request
        SET status = 'failed', processed_at = $2::timestamptz, error = $3
        WHERE id = $1
      `,
      [requestId, nowIso(), message],
    );
    throw error;
  }
}

async function main(): Promise<void> {
  const sourceRegistry = await loadSourceRegistry();

  const worker = new Worker<SourceSyncJob>(
    SOURCE_SYNC_QUEUE,
    async (job) => {
      await processSourceSync(job, sourceRegistry);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    },
  );

  worker.on("completed", (job) => {
    process.stdout.write(`completed job ${job.id}\n`);
  });

  worker.on("failed", (job, err) => {
    process.stderr.write(`failed job ${job?.id ?? "unknown"}: ${err.message}\n`);
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await closeDbPool();
  };

  process.on("SIGINT", () => {
    shutdown().finally(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    shutdown().finally(() => process.exit(0));
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
