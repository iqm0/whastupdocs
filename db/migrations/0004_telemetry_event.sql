BEGIN;

CREATE TABLE IF NOT EXISTS telemetry_event (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  http_status INTEGER NOT NULL,
  decision_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_tenant_created_at
  ON telemetry_event(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_endpoint_created_at
  ON telemetry_event(endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_decision_status
  ON telemetry_event(decision_status);

COMMIT;
