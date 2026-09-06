-- Add relevance marker to cluster_suggestions so the naming step can flag a
-- suggestion as low-relevance to the project (generic domain overlap only,
-- no real tie to scope_in, or something scope_out explicitly excludes)
-- without dropping the row. Existing rows default to 'core' (unaffected).

ALTER TABLE cluster_suggestions
  ADD COLUMN IF NOT EXISTS relevance text NOT NULL DEFAULT 'core';

ALTER TABLE cluster_suggestions
  DROP CONSTRAINT IF EXISTS cluster_suggestions_relevance_check;
ALTER TABLE cluster_suggestions
  ADD CONSTRAINT cluster_suggestions_relevance_check
  CHECK (relevance IN ('core', 'low'));
