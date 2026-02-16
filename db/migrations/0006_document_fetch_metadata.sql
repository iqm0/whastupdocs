BEGIN;

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS fetch_etag TEXT,
  ADD COLUMN IF NOT EXISTS fetch_last_modified TEXT,
  ADD COLUMN IF NOT EXISTS fetch_last_status INTEGER,
  ADD COLUMN IF NOT EXISTS fetch_last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_document_source_url_fetch
  ON document(source_id, canonical_url);

COMMIT;
