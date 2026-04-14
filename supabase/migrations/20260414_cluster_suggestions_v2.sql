-- ─── inputs embedding column + index (idempotent) ────────────────────────────
-- Already applied in 20260407_cluster_suggestions.sql — kept here for reference.
-- The IF NOT EXISTS guards make re-running safe.

ALTER TABLE inputs ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS inputs_embedding_idx
  ON inputs
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── cluster_suggestions — add missing columns ────────────────────────────────
-- The base table, RLS, and policy already exist from 20260407_cluster_suggestions.sql.
-- This migration adds the full column set required by the AI clustering feature.

ALTER TABLE cluster_suggestions
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS subtype         text,
  ADD COLUMN IF NOT EXISTS generative_note text,
  ADD COLUMN IF NOT EXISTS avg_similarity  float,
  ADD COLUMN IF NOT EXISTS is_weak_signal  boolean NOT NULL DEFAULT false;

-- ─── CHECK constraints ────────────────────────────────────────────────────────

ALTER TABLE cluster_suggestions
  DROP CONSTRAINT IF EXISTS cluster_suggestions_subtype_check;
ALTER TABLE cluster_suggestions
  ADD CONSTRAINT cluster_suggestions_subtype_check
  CHECK (subtype IN ('trend', 'driver', 'tension'));

ALTER TABLE cluster_suggestions
  DROP CONSTRAINT IF EXISTS cluster_suggestions_status_check;
ALTER TABLE cluster_suggestions
  ADD CONSTRAINT cluster_suggestions_status_check
  CHECK (status IN ('pending', 'accepted', 'dismissed'));
