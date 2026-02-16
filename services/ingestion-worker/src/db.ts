import { Pool } from "pg";

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString =
    process.env.DATABASE_URL ?? "postgres://wiud:wiud@localhost:5433/wiud";

  pool = new Pool({
    connectionString,
    max: 5,
  });

  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
