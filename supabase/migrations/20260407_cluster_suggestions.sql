-- ─── Step 1: Add embedding column to inputs ───────────────────────────────────

ALTER TABLE inputs ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS inputs_embedding_idx
  ON inputs
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── Step 2: cluster_suggestions table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cluster_suggestions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  name          text        NOT NULL,
  rationale     text,
  input_ids     uuid[]      NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  -- pending · accepted · dismissed
  generated_at  timestamptz DEFAULT now(),
  acted_on_at   timestamptz
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE cluster_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cluster_suggestions_all" ON cluster_suggestions
  FOR ALL USING (workspace_id = get_workspace_id());
