-- Renamed from 20260705_* on 2026-07-09: four migrations originally shared the
-- bare 20260705 date as their version, which collided in
-- supabase_migrations.schema_migrations' primary key on push (only the first,
-- ai_usage_log_insert_service_role, kept the bare date). Suffixed with a
-- synthetic time to disambiguate; no ordering significance vs. the others.
--
-- Restricts get_seeding_candidates (added 20260501, last changed 20260504)
-- to authenticated and service_role callers.
--
-- The function is SECURITY DEFINER with no auth check. Postgres grants EXECUTE
-- to PUBLIC by default, so anyone holding the anon key could call it directly
-- and pull up to 200 candidates per domain — titles, summaries, URLs, and full
-- embeddings. It also lacked SET search_path, unlike the other definer
-- functions (get_workspace_id, handle_new_user).
--
-- This migration:
--   1. Adds SET search_path = public via CREATE OR REPLACE — the function body,
--      parameters, and the 200-row limit are reproduced verbatim from 20260504.
--   2. Revokes EXECUTE from PUBLIC and anon.
--   3. Grants EXECUTE to authenticated and service_role only.
--
-- Caller: api/seed-onboarding.js executes this RPC through the service_role
-- client (behind a required user Bearer-token check). There is no anonymous or
-- client-side caller, so revoking anon does not break any flow.

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
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION get_seeding_candidates(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_seeding_candidates(text) FROM anon;

GRANT EXECUTE ON FUNCTION get_seeding_candidates(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seeding_candidates(text) TO service_role;
