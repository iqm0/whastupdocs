BEGIN;

CREATE TABLE IF NOT EXISTS change_event (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES document(id) ON DELETE SET NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('document_added', 'updated', 'deprecation', 'breaking_change')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_event_source_detected
  ON change_event(source_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_event_type_severity
  ON change_event(event_type, severity, detected_at DESC);

COMMIT;
