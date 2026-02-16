import { Queue } from "bullmq";

export const SOURCE_SYNC_QUEUE = "source-sync";

let sourceSyncQueue: Queue | null = null;

function getRedisConnectionOptions(): { host: string; port: number; password?: string } {
  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
  };
}

export function getSourceSyncQueue(): Queue {
  if (sourceSyncQueue) {
    return sourceSyncQueue;
  }

  sourceSyncQueue = new Queue(SOURCE_SYNC_QUEUE, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    },
  });

  return sourceSyncQueue;
}

export async function closeQueue(): Promise<void> {
  if (sourceSyncQueue) {
    await sourceSyncQueue.close();
    sourceSyncQueue = null;
  }
}
