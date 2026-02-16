BEGIN;

CREATE TABLE IF NOT EXISTS chunk_embedding (
  chunk_id TEXT PRIMARY KEY REFERENCES chunk(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  vector JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_embedding_model ON chunk_embedding(model);

COMMIT;
