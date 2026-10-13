-- REA-02: move vector_embeddings to pgvector with an HNSW index.
-- NOT applied by `drizzle-kit push`; run manually once the target Postgres
-- has the pgvector extension (>= 0.5 for HNSW). Requires a fixed dimension:
-- set EMBED_DIM to the embedder's output size before running.
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE vector_embeddings ADD COLUMN IF NOT EXISTS embedding_vec vector(384);
UPDATE vector_embeddings
   SET embedding_vec = (embedding::text)::vector
 WHERE embedding_vec IS NULL AND jsonb_array_length(embedding) = 384;
CREATE INDEX IF NOT EXISTS vector_embeddings_hnsw
  ON vector_embeddings USING hnsw (embedding_vec vector_cosine_ops);
-- Keyword side of hybrid search:
CREATE INDEX IF NOT EXISTS vector_embeddings_content_fts
  ON vector_embeddings USING gin (to_tsvector('english', content));
