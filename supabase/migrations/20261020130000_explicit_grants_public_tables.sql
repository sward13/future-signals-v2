-- Explicit Data API grants for every public table, ahead of Supabase's
-- October 30, 2026 removal of automatic grants on new objects
-- (https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
-- After that date a table created without an explicit GRANT returns
-- 42501 permission denied through the Data API (PostgREST/supabase-js/
-- GraphQL), for anon, authenticated, AND service_role alike. Existing
-- tables keep their current (broader, Supabase-default) live grants
-- regardless — this migration is purely additive and changes nothing on
-- a database that already has those defaults; it exists so a from-scratch
-- replay (new project, disaster recovery, or a fresh `supabase db reset`
-- once that becomes possible — see docs/supabase-grants-audit-report.md
-- and docs/project-negative-pool-migration-closeout.md on why it isn't
-- today) produces a working set of grants instead of none.
--
-- Source: docs/supabase-grants-audit-report.md (Sections 1, 2, 4, 5).
-- Matrix derivation, tables left out, and verification are written up in
-- docs/supabase-grants-migration-closeout.md.
--
-- Decisions (see that closeout for the full reasoning):
--   * anon: no grants on any table. The audit's client usage map (Section 4)
--     found zero code paths — browser, extension, api/*.js, server-lib/*.js,
--     or Supabase Edge Functions — that query Postgres as the genuine anon
--     role. Browser code never reads data before login; every server path,
--     including the public /p/{slug} Publish pages, uses
--     SUPABASE_SERVICE_ROLE_KEY.
--   * service_role: SELECT, INSERT, UPDATE, DELETE on every table below,
--     including source_health (service_role bypasses RLS by role attribute,
--     not by grant — it still needs the grant to touch the table at all
--     post-cutover).
--   * authenticated: SELECT, INSERT, UPDATE, DELETE only on tables the
--     audit's client usage map shows browser code querying with the user
--     session (Section 4's 21-table browser list). Tables reached only
--     through service_role get no authenticated grant.
--   * access_codes is deliberately excluded entirely — already
--     service_role-only by design (20260929120000_access_codes.sql) and by
--     actual usage (zero .from() call sites anywhere in client code).
--     Adding an authenticated or anon grant here would be a regression, not
--     a fix.
--   * Never TRUNCATE, REFERENCES, or TRIGGER — not needed by any caller.
--   * No REVOKEs — trimming the live anon privileges every table already
--     holds (Supabase's blanket pre-cutover default) is a separate,
--     deliberately-deferred decision; see the closeout's Open questions.
--   * No sequence grants — the audit (Section 3) found zero sequences in
--     public; every table uses `uuid primary key default gen_random_uuid()`.
--     Nothing to grant.
--
-- Idempotent: GRANT is additive and re-granting an already-held privilege
-- is a no-op, so running this against production/staging today changes
-- nothing observable — both already hold a superset of these grants via
-- Supabase's blanket default. Its effect is only visible on a from-scratch
-- replay that doesn't have that default.

-- ── service_role ─────────────────────────────────────────────────────────
-- Every table except access_codes (already covered in its own migration).

grant select, insert, update, delete on public.ai_usage_log to service_role;
grant select, insert, update, delete on public.analyses to service_role;
grant select, insert, update, delete on public.candidates to service_role;
grant select, insert, update, delete on public.canvas_nodes to service_role;
grant select, insert, update, delete on public.canvas_text_nodes to service_role;
grant select, insert, update, delete on public.cluster_inputs to service_role;
grant select, insert, update, delete on public.cluster_suggestions to service_role;
grant select, insert, update, delete on public.clusters to service_role;
grant select, insert, update, delete on public.inputs to service_role;
grant select, insert, update, delete on public.preferred_futures to service_role;
grant select, insert, update, delete on public.project_candidates to service_role;
grant select, insert, update, delete on public.project_negative_pool to service_role;
grant select, insert, update, delete on public.project_publications to service_role;
grant select, insert, update, delete on public.project_sources to service_role;
grant select, insert, update, delete on public.project_system_map_background to service_role;
grant select, insert, update, delete on public.projects to service_role;
grant select, insert, update, delete on public.relationships to service_role;
grant select, insert, update, delete on public.scenario_clusters to service_role;
grant select, insert, update, delete on public.scenarios to service_role;
grant select, insert, update, delete on public.source_health to service_role;
grant select, insert, update, delete on public.sources to service_role;
grant select, insert, update, delete on public.strategic_options to service_role;
grant select, insert, update, delete on public.system_map_templates to service_role;
grant select, insert, update, delete on public.user_preferences to service_role;
grant select, insert, update, delete on public.workspace_settings to service_role;
grant select, insert, update, delete on public.workspaces to service_role;

-- ── authenticated ────────────────────────────────────────────────────────
-- Only the 21 tables the client usage map shows browser code (post-login,
-- the only state in which the SPA ever fetches data) actually querying.
-- ai_usage_log, candidates, project_negative_pool, project_publications,
-- and source_health are deliberately NOT granted here — Section 4 found no
-- browser call site for any of the five; they're service_role-only paths
-- (api/*.js logging, the scanner pipeline, clone-project.js, the Publish
-- API route, and the scanner-health check, respectively).

grant select, insert, update, delete on public.analyses to authenticated;
grant select, insert, update, delete on public.canvas_nodes to authenticated;
grant select, insert, update, delete on public.canvas_text_nodes to authenticated;
grant select, insert, update, delete on public.cluster_inputs to authenticated;
grant select, insert, update, delete on public.cluster_suggestions to authenticated;
grant select, insert, update, delete on public.clusters to authenticated;
grant select, insert, update, delete on public.inputs to authenticated;
grant select, insert, update, delete on public.preferred_futures to authenticated;
grant select, insert, update, delete on public.project_candidates to authenticated;
grant select, insert, update, delete on public.project_sources to authenticated;
grant select, insert, update, delete on public.project_system_map_background to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.relationships to authenticated;
grant select, insert, update, delete on public.scenario_clusters to authenticated;
grant select, insert, update, delete on public.scenarios to authenticated;
grant select, insert, update, delete on public.sources to authenticated;
grant select, insert, update, delete on public.strategic_options to authenticated;
grant select, insert, update, delete on public.system_map_templates to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.workspace_settings to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;

-- No anon grants. No REVOKE statements. No sequence grants (none exist).
