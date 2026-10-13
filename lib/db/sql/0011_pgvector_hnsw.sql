-- REA-02: move vector_embeddings to pgvector with an HNSW index.
-- NOT applied by `drizzle-kit push`; run manually once the target Postgres
-- has the pgvector extension (>= 0.5 for HNSW).
--
-- The vector dimension is a parameter (no hard-coded size). Pass the
-- embedder's output size as a psql variable:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v embed_dim=384 -f lib/db/sql/0011_pgvector_hnsw.sql
-- Running without -v embed_dim fails fast instead of guessing.
\if :{?embed_dim}
\else
  \echo 'ERROR: set -v embed_dim=<embedder output size>'
  \quit
\endif
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE vector_embeddings ADD COLUMN IF NOT EXISTS embedding_vec vector(:embed_dim);
UPDATE vector_embeddings
   SET embedding_vec = (embedding::text)::vector
 WHERE embedding_vec IS NULL AND jsonb_array_length(embedding) = :embed_dim;
CREATE INDEX IF NOT EXISTS vector_embeddings_hnsw
  ON vector_embeddings USING hnsw (embedding_vec vector_cosine_ops);
-- Keyword side of hybrid search:
CREATE INDEX IF NOT EXISTS vector_embeddings_content_fts
  ON vector_embeddings USING gin (to_tsvector('english', content));
