BEGIN;

CREATE TABLE IF NOT EXISTS source_sync_request (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_sync_request_status_requested
  ON source_sync_request(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_sync_request_source
  ON source_sync_request(source_id);

COMMIT;
