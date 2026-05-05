-- Limit get_seeding_candidates to 200 rows ordered by recency descending.
--
-- Without a LIMIT, the RPC returns full embedding vectors for every domain-matched
-- candidate (up to 767 for Technology & AI). At 1536 float4 values per embedding
-- serialised as JSON text, this produces ~12 MB of data per call — enough to push
-- the seed-onboarding endpoint over Vercel's default 10-second function timeout.
--
-- 200 candidates still produces excellent diversity (15 final slots with a 4/source
-- cap); very old candidates score poorly under the 90-day recency decay anyway,
-- so pre-filtering by published_at DESC has negligible quality impact.

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
    AND c.embedding IS NOT NULL
  ORDER BY c.published_at DESC NULLS LAST
  LIMIT 200;
$$;
