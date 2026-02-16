BEGIN;

CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('docs', 'repo', 'api_ref', 'changelog')),
  base_url TEXT NOT NULL,
  owner TEXT,
  trust_score NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  version_tag TEXT,
  language TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  last_changed_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunk (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  heading_path TEXT,
  code_lang TEXT,
  embedding_vector_ref TEXT,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index, valid_from)
);

CREATE TABLE IF NOT EXISTS snapshot (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ NOT NULL,
  raw_blob_ref TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  freshness_summary JSONB NOT NULL,
  confidence NUMERIC(4,3),
  policy_flags JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citation (
  id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES answer_log(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunk(id) ON DELETE RESTRICT,
  quoted_text TEXT,
  url TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_source_version ON document(source_id, version_tag);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_source_url_version_uniq
  ON document(source_id, canonical_url, COALESCE(version_tag, ''));
CREATE INDEX IF NOT EXISTS idx_document_last_changed_at ON document(last_changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunk_document ON chunk(document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_validity ON chunk(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_snapshot_source_fetched_at ON snapshot(source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_log_tenant_created ON answer_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_citation_answer ON citation(answer_id);

COMMIT;
