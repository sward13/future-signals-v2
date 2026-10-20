-- Documentation migration: project_negative_pool.
--
-- Discovered undocumented on 2026-10-20 during the Supabase grants audit
-- (docs/supabase-grants-audit-report.md) — a table that exists, identically,
-- on both production (tbxjudpxzovbasuomekq) and staging (kptatqipjwihkdxdxlvh),
-- but has no CREATE TABLE anywhere in supabase/migrations/ or in schema.sql.
-- It predates the migrations/ directory, same category as the schema.sql-era
-- tables and the other undocumented objects already backfilled in
-- 20260705110000_scanner_tables_schema.sql and
-- 20260709140000_document_auto_populate_project_sources.sql — this introduces
-- no new behavior, it documents what was already live.
--
-- A per-project cache of what that project's practitioner has already
-- rejected, intended to down-rank similar candidates in the future. One row
-- per project (project_id is UNIQUE). Not read or written by the live scoring
-- path — api/score.js computes negative_pool_sim live each run directly
-- against individual dismissed candidates' embeddings rather than maintaining
-- this centroid; see docs/database-schema-reference.md's own note on this
-- table for the full explanation. Referenced only by server-lib/clone-project.js,
-- which walks/copies it like any other project-scoped table.
--
-- Definition reproduced verbatim from both environments via
-- information_schema.columns, pg_constraint, pg_indexes, pg_policies, and
-- pg_trigger (read-only introspection, 2026-10-20) — production and staging
-- were confirmed identical before writing this file. No triggers exist on
-- this table. Idempotent throughout (IF NOT EXISTS / guarded policy blocks),
-- so safe to run against a database that already has these objects — the
-- GRANT block is deliberately NOT included here; that's handled by the
-- separate grants migration this file sorts ahead of.
--
-- Dependency note: the only foreign key is project_id -> projects(id). Like
-- this table, `projects` itself has no CREATE TABLE in supabase/migrations/ —
-- it's schema.sql-only (applied manually via the Supabase SQL Editor, not
-- through a migration replay). A migration-only replay (supabase db reset,
-- a brand-new project) would need schema.sql applied first regardless of
-- this file; that gap is pre-existing and out of scope here.

CREATE TABLE IF NOT EXISTS public.project_negative_pool (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid        NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  centroid_embedding vector(1536),
  count              integer     NOT NULL DEFAULT 0,
  recomputed_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_negative_pool ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_negative_pool'
      AND policyname = 'project_negative_pool_select'
  ) THEN
    CREATE POLICY "project_negative_pool_select" ON public.project_negative_pool
      FOR SELECT
      USING (
        project_id IN (
          SELECT id FROM public.projects
          WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_negative_pool'
      AND policyname = 'project_negative_pool_update'
  ) THEN
    CREATE POLICY "project_negative_pool_update" ON public.project_negative_pool
      FOR UPDATE
      USING (
        project_id IN (
          SELECT id FROM public.projects
          WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- No INSERT or DELETE policy exists live on either environment — matches the
-- live source of truth exactly; not an omission. Rows are presumably written
-- only via service_role (which bypasses RLS), consistent with this table
-- being dormant on the client-facing read/write path.
