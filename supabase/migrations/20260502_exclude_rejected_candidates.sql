-- Update get_seeding_candidates to exclude status = 'rejected' in addition to 'expired'.
-- Candidates marked rejected by the Layer 2 relevance filter should not surface
-- in the onboarding scanner inbox.

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
    AND c.status   NOT IN ('expired', 'rejected')
    AND c.embedding IS NOT NULL;
$$;
