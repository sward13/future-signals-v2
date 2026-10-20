-- Documentation migration: get_user_workspace_id().
--
-- Discovered undocumented during the Supabase grants/migration-replay work
-- (docs/project-negative-pool-migration-closeout.md) — a function referenced
-- by this migration's own successors (20260905200000_rls_fk_validation_batch1.sql
-- and its three siblings) and used live by RLS policies on seven tables
-- (ai_usage_log, clusters, cluster_inputs, inputs, projects, scenarios,
-- workspace_settings — see docs/get-user-workspace-id-migration-closeout.md
-- for the full dependent list and how it was derived), but with no CREATE
-- FUNCTION anywhere in supabase/migrations/ or schema.sql. It predates the
-- migrations/ directory: 20260705_ai_usage_log_insert_service_role.sql
-- already describes it, in a comment, as live and already diverged from
-- schema.sql's get_workspace_id() pattern as of 2026-07-05 — so it existed,
-- undocumented, before even that file. Same category as the other
-- undocumented-schema-change examples CLAUDE.md already tracks; this
-- introduces no new behavior, it documents what was already live.
--
-- Definition, owner, language, volatility, SECURITY mode, function-level
-- settings (proconfig), and EXECUTE privileges (proacl) reproduced verbatim
-- from both environments via pg_get_functiondef / pg_proc / pg_depend
-- (read-only introspection, 2026-10-24) — production and staging confirmed
-- identical before writing this file.
--
-- Deliberately NOT given `set search_path = public`, unlike its sibling
-- get_workspace_id() in schema.sql — the live function has no proconfig at
-- all (confirmed on both environments), so this does not add one. The two
-- functions are near-duplicates in intent but not byte-identical in
-- definition; this file preserves that distinction rather than silently
-- "fixing" it, since doing so would change live behavior, which is out of
-- scope here.
--
-- No explicit privilege statements: live EXECUTE (proacl) grants PUBLIC,
-- postgres, anon, authenticated, and service_role identically to every
-- other undecorated function in this schema (get_workspace_id(),
-- handle_new_user(), handle_updated_at(), touch_project_updated_at(),
-- auto_populate_project_sources(), find_similar_input_pairs() all show the
-- same live ACL shape) — this is this Supabase project's effective default
-- for newly created functions, not a deliberate grant specific to this one.
-- A plain CREATE FUNCTION with no GRANT/REVOKE reproduces it exactly.
--
-- Idempotent (CREATE OR REPLACE), changes nothing on a database that
-- already has this function in this form.

create or replace function public.get_user_workspace_id()
returns uuid
language sql
stable security definer
as $$
  select id from workspaces where user_id = auth.uid()
$$;
