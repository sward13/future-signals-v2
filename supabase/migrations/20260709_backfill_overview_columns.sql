-- ============================================================
-- Backfill: projects.last_visited_at and analyses.updated_at
--
-- Both columns were added directly to staging (kptatqipjwihkdxdxlvh) on
-- 2026-07-02 to support the ProjectOverview screen (commit 74246e3b),
-- with no migration file — the same undocumented-schema-change pattern
-- already seen with projects.source_template_id. Confirmed via direct
-- SQL against production (tbxjudpxzovbasuomekq) on 2026-07-09 that
-- neither column exists there. ProjectOverview.jsx and its use of these
-- columns exist only on workspace-refactor and have never merged to
-- master, so this is undeployed drift, not a live incident — but it
-- must land before that merge, or both columns silently no-op in
-- production (see Claude Code audit, 2026-07-09).
--
-- Column shapes below are cross-checked against the current
-- staging-generated src/types/database.types.ts, not assumed from the
-- 20260417_future_models.sql pattern:
--   - projects.last_visited_at: nullable, no default (matches
--     `last_visited_at: string | null` with no server-side stamping
--     other than the explicit UPDATE in useAppState.js openProject()).
--   - analyses.updated_at: nullable, DEFAULT now(), and — unlike
--     scenarios/preferred_futures/strategic_options in
--     20260417_future_models.sql — NOT NULL on staging. It is `string |
--     null` there, so this migration intentionally does not add a
--     NOT NULL constraint; doing so would make production stricter
--     than staging instead of matching it.
--
-- Both ALTER statements use IF NOT EXISTS so this is a no-op if run
-- against staging (verified before running against production).
--
-- No GRANT block: unlike 20260705_scanner_tables_schema.sql, this migration
-- only adds columns to existing tables (projects, analyses), which already
-- have working grants. The CLAUDE.md explicit-grant requirement applies to
-- new tables (CREATE TABLE), not new columns on existing ones.
--
-- Discovered mid-run on staging (2026-07-09): a trigger already existed —
-- analyses_set_updated_at, calling a separate pre-existing function
-- set_updated_at() with an identical body to handle_updated_at() — another
-- undocumented artifact from the same 2026-07-02 ad hoc change that added the
-- column itself. Applying this migration as originally written left two
-- redundant triggers on analyses. Fixed by hand on staging (dropped
-- analyses_set_updated_at; set_updated_at() was only referenced by that one
-- trigger, confirmed via pg_trigger, so left in place unused rather than
-- dropping a function on a hunch) and folded into this file below so
-- production converges to the same single-trigger end state.
-- ============================================================

-- ─── 1. projects.last_visited_at ────────────────────────────────────────────
-- Stamped fire-and-forget by openProject() in useAppState.js; read by
-- ProjectOverview.jsx to compute "N new signals since your last visit."

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_visited_at timestamptz;

-- ─── 2. analyses.updated_at ─────────────────────────────────────────────────
-- Read by ProjectOverview.jsx (latestAnalysisTs) to attribute the
-- "Continue here" / most-recently-active phase card. Never written
-- explicitly by application code (upsertAnalysis only spreads the
-- SystemAnalysisCanvas panel fields) — without the trigger below it would
-- stay static at insert time and never reflect subsequent edits.

-- Ensure handle_updated_at trigger function exists (idempotent; same
-- function already used by scenarios, preferred_futures, strategic_options
-- in 20260417_future_models.sql).
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Drop the undocumented ad hoc trigger from the same 2026-07-02 change that
-- added the column, if present, so this migration is the single source of
-- truth going forward. set_updated_at() (the function it called) is left in
-- place, unused, rather than dropped.
DROP TRIGGER IF EXISTS analyses_set_updated_at ON analyses;

DROP TRIGGER IF EXISTS set_analyses_updated_at ON analyses;
CREATE TRIGGER set_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
