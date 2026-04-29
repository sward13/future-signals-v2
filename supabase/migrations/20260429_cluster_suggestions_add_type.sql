-- Add type, target_cluster_id, and confidence columns to cluster_suggestions.
-- Existing rows (from generate-cluster-suggestions) default to 'new_cluster'.

ALTER TABLE cluster_suggestions
  ADD COLUMN IF NOT EXISTS type              text    NOT NULL DEFAULT 'new_cluster',
  ADD COLUMN IF NOT EXISTS target_cluster_id uuid    REFERENCES clusters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confidence        text;

-- Type constraint
ALTER TABLE cluster_suggestions
  DROP CONSTRAINT IF EXISTS cluster_suggestions_type_check;
ALTER TABLE cluster_suggestions
  ADD CONSTRAINT cluster_suggestions_type_check
  CHECK (type IN ('new_cluster', 'assignment'));

-- Confidence constraint
ALTER TABLE cluster_suggestions
  DROP CONSTRAINT IF EXISTS cluster_suggestions_confidence_check;
ALTER TABLE cluster_suggestions
  ADD CONSTRAINT cluster_suggestions_confidence_check
  CHECK (confidence IS NULL OR confidence IN ('high', 'moderate'));
