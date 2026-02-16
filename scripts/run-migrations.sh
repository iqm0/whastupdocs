#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run migrations"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-postgres://wiud:wiud@localhost:5433/wiud}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../db/migrations" && pwd)"

echo "Running migrations from ${MIGRATIONS_DIR}"
for migration in "${MIGRATIONS_DIR}"/*.sql; do
  echo "Applying $(basename "$migration")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Migrations completed"
