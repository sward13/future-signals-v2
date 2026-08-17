-- Multi-select project domains.
--
-- Adds:
--   * projects.domains       text[]  — predefined domain labels (a subset of the
--                                      eight/nine canonical DOMAINS in seeds.js)
--   * projects.custom_domain text    — freeform custom domain name (New Project
--                                      flow only). Kept in its OWN column so the
--                                      scanner join (sources.domain = ANY(domains))
--                                      never sees freeform text.
--
-- The legacy single `projects.domain` column is RETAINED for rollback safety;
-- a later migration drops it once the multi-domain code has soaked. New writes
-- from the app keep it populated (= domains[1] ?? custom_domain) so a code
-- rollback still renders a domain.
--
-- Backfill: every existing project with a predefined single domain becomes a
-- one-element array. The literal 'Custom / Other' (which never captured a real
-- custom name in the old UI) backfills to an empty array + null custom_domain.
--
-- Scanner join sites updated below (single-value -> array):
--   * trg_auto_populate_project_sources  (s.domain = NEW.domain  -> = ANY(NEW.domains))
--   * get_seeding_candidates(text)        -> get_seeding_candidates(text[])
--
-- Applied to staging (kptatqipjwihkdxdxlvh) first, then production on merge.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table projects
  add column if not exists domains       text[] not null default '{}',
  add column if not exists custom_domain text;

-- ── 2. Backfill from the legacy single-value column ─────────────────────────
update projects
   set domains = array[domain]
 where domain is not null
   and domain <> ''
   and domain <> 'Custom / Other'
   and (domains is null or domains = '{}');

-- ── 3. Trigger: auto-populate project_sources by domain match ───────────────
-- Now matches any of the project's selected predefined domains. An empty
-- domains array (custom-only or no-domain project) matches no curated sources,
-- which is the intended behaviour.
CREATE OR REPLACE FUNCTION auto_populate_project_sources()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_sources (project_id, source_id, opted_in)
  SELECT NEW.id, s.id, true
  FROM sources s
  WHERE s.domain = ANY(NEW.domains)
    AND s.active = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_populate_project_sources ON projects;
CREATE TRIGGER trg_auto_populate_project_sources
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION auto_populate_project_sources();

-- ── 4. Seeding RPC: accept an array of domains ──────────────────────────────
-- Body reproduced from 20260705100000_get_seeding_candidates_restrict.sql with
-- the single equality swapped for = ANY(p_domains). Retains SECURITY DEFINER,
-- SET search_path, the 200-row cap, and the authenticated/service_role grants.
-- The old single-text overload is dropped so callers can't drift back to it.
DROP FUNCTION IF EXISTS get_seeding_candidates(text);

CREATE OR REPLACE FUNCTION get_seeding_candidates(p_domains text[])
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
  WHERE s.domain    =  ANY(p_domains)
    AND c.status   NOT IN ('expired', 'rejected')
    AND c.embedding IS NOT NULL
  ORDER BY c.published_at DESC NULLS LAST
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION get_seeding_candidates(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_seeding_candidates(text[]) FROM anon;

GRANT EXECUTE ON FUNCTION get_seeding_candidates(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seeding_candidates(text[]) TO service_role;
