-- RPC function for onboarding candidate seeding.
--
-- Joins candidates → sources to filter by domain, and uses SQL-level
-- "IS NOT NULL" on the embedding column. This sidesteps the PostgREST
-- pgvector filter issue where .not('embedding', 'is', null) fails silently.
--
-- Returns embedding as text so the caller can JSON.parse it — consistent
-- with how api/score.js already handles the column.

CREATE OR REPLACE FUNCTION get_seeding_candidates(p_domain text)
RETURNS TABLE (
  id                 uuid,
  title              text,
  summary_ai         text,
  url                text,
  published_at       timestamptz,
  steepled           text[],
  embedding          text,
  source_name        text,
  source_credibility text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.title,
    c.summary_ai,
    c.url,
    c.published_at,
    c.steepled,
    c.embedding::text,
    s.name            AS source_name,
    s.credibility     AS source_credibility
  FROM candidates c
  JOIN sources s ON s.id = c.source_id
  WHERE s.domain    =  p_domain
    AND c.status   != 'expired'
    AND c.embedding IS NOT NULL;
$$;
